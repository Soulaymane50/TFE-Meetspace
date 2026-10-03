package be.meetspace.service;

import be.meetspace.entity.BookingHold;
import be.meetspace.entity.BookingHoldStatus;
import be.meetspace.entity.PaymentType;
import be.meetspace.repository.BookingHoldRepository;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ParkingCapacityService {
    @Autowired
    private BookingHoldRepository holdRepository;

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
        List<Long> targetIds = openSlots.stream().map(ParkingSlot::getId).distinct().toList();
        // Inclure aussi les occupants que le catalogue ne montre pas.
        Map<Long, ParkingSlot> relevantSlots = new LinkedHashMap<>();
        for (ParkingSlot slot : slotRepository.findOpenOverlappingSlotsForTargets(targetIds)) {
            relevantSlots.put(slot.getId(), slot);
        }
        openSlots.forEach(slot -> relevantSlots.putIfAbsent(slot.getId(), slot));
        List<Long> slotIds = List.copyOf(relevantSlots.keySet());
        Map<Long, Integer> reservedBySlot = new HashMap<>();
        for (var row : reservationRepository.sumReservedSpacesByParkingSlotIds(slotIds)) {
            reservedBySlot.put(row.getSlotId(), Math.toIntExact(row.getReservedSpaces()));
        }

        Map<LocalDate, List<ParkingSlot>> slotsByDate = new HashMap<>();
        for (ParkingSlot slot : relevantSlots.values()) {
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

    // Call before resource reads when creating a hold or editing parking inventory.
    public void lockInventory() {
        inventoryRepository.findByIdForUpdate(INVENTORY_ID)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Inventaire parking indisponible"));
    }

    public CapacitySnapshot lockAndAssertHoldAvailable(ParkingSlot target, int requestedSpaces) {
        return lockAndAssertAvailable(target, requestedSpaces);
    }

    // A free booking has no own hold: all outstanding promises must remain protected.
    public CapacitySnapshot lockAndAssertAvailable(ParkingSlot target, int requestedSpaces) {
        lockInventory();
        return assertAvailableIncludingHolds(target, requestedSpaces, null);
    }

    // Callers must lock inventory before loading the slot/event, in the same transaction.
    // A payment ID is resolved server-side; no client-supplied token can exclude a third-party hold.
    public CapacitySnapshot lockAndAssertAvailable(ParkingSlot target, int requestedSpaces,
                                                    String paymentIntentId, be.meetspace.entity.User user) {
        lockInventory();
        String excludedToken = null;
        if (paymentIntentId != null && !paymentIntentId.isBlank()) {
            BookingHold own = holdRepository.findByPaymentIntentId(paymentIntentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement inconnu."));
            if (user == null || !own.getUser().getId().equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce paiement appartient à un autre compte.");
            }
            Long heldSlotId = own.getType() == PaymentType.PARKING ? own.getResourceId() : own.getSecondaryResourceId();
            int heldQuantity = own.getType() == PaymentType.PARKING ? safe(own.getQuantity()) : safe(own.getSecondaryQuantity());
            if ((own.getType() != PaymentType.PARKING && own.getType() != PaymentType.EVENT)
                    || !target.getId().equals(heldSlotId) || heldQuantity != requestedSpaces) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce paiement ne correspond pas au parking réservé.");
            }
            if (own.getStatus() != BookingHoldStatus.ACTIVE || !own.getExpiresAt().isAfter(LocalDateTime.now())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Le blocage temporaire du parking a expiré.");
            }
            excludedToken = own.getToken();
        }
        return assertAvailableIncludingHolds(target, requestedSpaces, excludedToken);
    }

    private CapacitySnapshot assertAvailableIncludingHolds(ParkingSlot target, int requestedSpaces, String excludedToken) {
        CapacitySnapshot paid = snapshot(target);
        int heldForSlot = 0;
        int heldForWindow = 0;
        for (BookingHold hold : holdRepository.findActiveParkingForWindow(target.getSessionDate(),
                target.getStartTime(), target.getEndTime(), BookingHoldStatus.ACTIVE, LocalDateTime.now())) {
            if (java.util.Objects.equals(hold.getToken(), excludedToken)) continue;
            Long slotId = hold.getType() == PaymentType.PARKING ? hold.getResourceId() : hold.getSecondaryResourceId();
            int quantity = hold.getType() == PaymentType.PARKING ? safe(hold.getQuantity()) : safe(hold.getSecondaryQuantity());
            heldForWindow += quantity;
            if (target.getId().equals(slotId)) heldForSlot += quantity;
        }
        int available = Math.max(0, Math.min(paid.availableSpaces() - heldForSlot,
                paid.globalRemainingSpaces() - heldForWindow));
        if (requestedSpaces < 1 || requestedSpaces > available) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Capacité parking insuffisante sur ce créneau. Places disponibles : " + available);
        }
        return new CapacitySnapshot(paid.physicalCapacity(), paid.allocatedSpaces(),
                paid.reservedForSlot() + heldForSlot, paid.reservedForWindow() + heldForWindow,
                available, Math.max(0, paid.globalRemainingSpaces() - heldForWindow));
    }

    public boolean hasActiveHolds(ParkingSlot slot) {
        LocalDateTime now = LocalDateTime.now();
        return !holdRepository.findActiveForResource(PaymentType.PARKING, slot.getId(), BookingHoldStatus.ACTIVE, now).isEmpty()
                || !holdRepository.findActiveForSecondaryResource(slot.getId(), BookingHoldStatus.ACTIVE, now).isEmpty();
    }

    public void assertNoActiveHoldsForWindow(LocalDate date, java.time.LocalTime start, java.time.LocalTime end) {
        boolean held = holdRepository.findActiveParkingForWindow(date, start, end, BookingHoldStatus.ACTIVE, LocalDateTime.now())
                .stream().anyMatch(hold -> hold.getType() == PaymentType.PARKING
                        ? safe(hold.getQuantity()) > 0 : safe(hold.getSecondaryQuantity()) > 0);
        if (held) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "L'allocation parking de ce créneau est temporairement bloquée pour un paiement.");
        }
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
