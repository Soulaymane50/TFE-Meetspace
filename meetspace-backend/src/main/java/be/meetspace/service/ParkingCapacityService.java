package be.meetspace.service;

import be.meetspace.entity.ParkingInventory;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.repository.ParkingInventoryRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ParkingCapacityService {
    private static final long INVENTORY_ID = 1L;
    private static final int ADVANCE_EVENT_LIMIT = 100;
    private static final long RELEASE_BEFORE_START_HOURS = 48L;

    private final ParkingInventoryRepository inventoryRepository;
    private final ParkingSlotRepository slotRepository;
    private final ParkingReservationRepository reservationRepository;

    public ParkingCapacityService(ParkingInventoryRepository inventoryRepository,
                                  ParkingSlotRepository slotRepository,
                                  ParkingReservationRepository reservationRepository) {
        this.inventoryRepository = inventoryRepository;
        this.slotRepository = slotRepository;
        this.reservationRepository = reservationRepository;
    }

    public CapacitySnapshot snapshot(ParkingSlot target) {
        if (target == null || target.getId() == null || target.getStatus() != ParkingSlotStatus.OPEN) {
            return new CapacitySnapshot(BusinessRules.TOTAL_PARKING_SPACES, 0, 0, 0, 0, 0);
        }
        int physicalCapacity = physicalCapacity();
        List<ParkingSlot> overlaps = new ArrayList<>(slotRepository.findOpenOverlappingSlots(
                target.getSessionDate(), target.getStartTime(), target.getEndTime()));
        if (overlaps.stream().noneMatch(slot -> slot.getId().equals(target.getId()))) overlaps.add(target);

        int reservedForTarget = safe(reservationRepository.countReservedSpacesByParkingSlotId(target.getId()));
        int reservedForWindow = safe(reservationRepository.countReservedSpacesForWindow(
                target.getSessionDate(), target.getStartTime(), target.getEndTime()));
        return buildSnapshot(target, overlaps, physicalCapacity, reservedForTarget, reservedForWindow);
    }

    public Map<Long, CapacitySnapshot> snapshots(List<ParkingSlot> candidates) {
        if (candidates == null || candidates.isEmpty()) return Map.of();

        List<ParkingSlot> openSlots = candidates.stream()
                .filter(slot -> slot != null && slot.getId() != null && slot.getStatus() == ParkingSlotStatus.OPEN)
                .toList();
        if (openSlots.isEmpty()) return Map.of();

        int physicalCapacity = physicalCapacity();
        List<Long> slotIds = openSlots.stream().map(ParkingSlot::getId).toList();
        Map<Long, Integer> reservedBySlot = new HashMap<>();
        for (var row : reservationRepository.sumReservedSpacesByParkingSlotIds(slotIds)) {
            reservedBySlot.put(row.getSlotId(), Math.toIntExact(row.getReservedSpaces()));
        }

        Map<LocalDate, List<ParkingSlot>> slotsByDate = new HashMap<>();
        for (ParkingSlot slot : openSlots) {
            slotsByDate.computeIfAbsent(slot.getSessionDate(), ignored -> new ArrayList<>()).add(slot);
        }

        Map<Long, CapacitySnapshot> result = new HashMap<>();
        for (ParkingSlot target : openSlots) {
            List<ParkingSlot> overlaps = slotsByDate.getOrDefault(target.getSessionDate(), List.of()).stream()
                    .filter(slot -> slot.getStartTime().isBefore(target.getEndTime())
                            && slot.getEndTime().isAfter(target.getStartTime()))
                    .toList();
            int reservedForTarget = reservedBySlot.getOrDefault(target.getId(), 0);
            int reservedForWindow = overlaps.stream()
                    .mapToInt(slot -> reservedBySlot.getOrDefault(slot.getId(), 0))
                    .sum();
            result.put(target.getId(), buildSnapshot(
                    target, overlaps, physicalCapacity, reservedForTarget, reservedForWindow));
        }
        return result;
    }

    private int physicalCapacity() {
        return inventoryRepository.findById(INVENTORY_ID)
                .map(ParkingInventory::getCapacity)
                .orElse(BusinessRules.TOTAL_PARKING_SPACES);
    }

    private CapacitySnapshot buildSnapshot(ParkingSlot target, List<ParkingSlot> overlaps,
                                           int physicalCapacity, int reservedForTarget, int reservedForWindow) {
        Map<Long, Integer> allocations = calculateAllocations(overlaps, physicalCapacity);
        int allocated = allocations.getOrDefault(target.getId(), 0);
        long hoursUntilStart = Duration.between(LocalDateTime.now(),
                LocalDateTime.of(target.getSessionDate(), target.getStartTime())).toHours();
        if (overlaps.size() == 1 && hoursUntilStart > RELEASE_BEFORE_START_HOURS) {
            allocated = Math.min(allocated, ADVANCE_EVENT_LIMIT);
        }

        int protectedAllocation = Math.max(allocated, reservedForTarget);
        int available = Math.min(
                Math.max(0, protectedAllocation - reservedForTarget),
                Math.max(0, physicalCapacity - reservedForWindow));
        return new CapacitySnapshot(physicalCapacity, allocated, reservedForTarget, reservedForWindow,
                available, Math.max(0, physicalCapacity - reservedForWindow));
    }

    public CapacitySnapshot lockAndAssertAvailable(ParkingSlot target, int requestedSpaces) {
        inventoryRepository.findByIdForUpdate(INVENTORY_ID)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Inventaire parking indisponible"));
        CapacitySnapshot snapshot = snapshot(target);
        if (requestedSpaces < 1 || requestedSpaces > snapshot.availableSpaces()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Capacité parking insuffisante sur ce créneau. Places disponibles : " + snapshot.availableSpaces());
        }
        return snapshot;
    }

    private Map<Long, Integer> calculateAllocations(List<ParkingSlot> slots, int physicalCapacity) {
        Map<Long, Integer> allocations = new HashMap<>();
        int totalWeight = slots.stream().mapToInt(this::weight).sum();
        if (totalWeight <= physicalCapacity) {
            slots.forEach(slot -> allocations.put(slot.getId(), weight(slot)));
            return allocations;
        }
        List<Share> shares = new ArrayList<>();
        int allocated = 0;
        for (ParkingSlot slot : slots) {
            double exact = ((double) physicalCapacity * weight(slot)) / totalWeight;
            int floor = (int) Math.floor(exact);
            allocated += floor;
            shares.add(new Share(slot.getId(), floor, exact - floor));
        }
        shares.sort(Comparator.comparingDouble(Share::remainder).reversed().thenComparing(Share::slotId));
        int remaining = physicalCapacity - allocated;
        for (int index = 0; index < shares.size(); index++) {
            Share share = shares.get(index);
            allocations.put(share.slotId(), share.floor() + (index < remaining ? 1 : 0));
        }
        return allocations;
    }

    private int weight(ParkingSlot slot) {
        return Math.max(1, Math.min(BusinessRules.TOTAL_PARKING_SPACES,
                slot.getCapacity() != null ? slot.getCapacity() : 1));
    }
    private static int safe(Integer value) { return value != null ? value : 0; }
    private record Share(Long slotId, int floor, double remainder) {}

    public record CapacitySnapshot(int physicalCapacity, int allocatedSpaces, int reservedForSlot,
                                   int reservedForWindow, int availableSpaces, int globalRemainingSpaces) {}
}
