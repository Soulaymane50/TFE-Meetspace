package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.BusinessRules;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.dto.ParkingSlotRequest;
import be.meetspace.web.dto.ParkingSlotResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/parking")
public class AdminParkingController {

    private final ParkingSlotRepository sessionRepository;
    private final ParkingReservationRepository reservationRepository;
    private final AuditService auditService;

    private final ParkingCapacityService parkingCapacityService;
    public AdminParkingController(ParkingSlotRepository sessionRepository,
                                   ParkingReservationRepository reservationRepository,
                                   AuditService auditService,
                                   ParkingCapacityService parkingCapacityService) {
        this.sessionRepository = sessionRepository;
        this.reservationRepository = reservationRepository;
        this.auditService = auditService;
        this.parkingCapacityService = parkingCapacityService;
    }

    @GetMapping("/sessions")
    @Transactional(readOnly = true)
    public List<ParkingSlotResponseDto> listSessions() {
        List<ParkingSlot> slots = sessionRepository.findAll();
        if (slots.isEmpty()) return List.of();
        Map<Long, ParkingCapacityService.CapacitySnapshot> capacities = parkingCapacityService.snapshots(slots);
        Map<Long, Integer> reservedBySlot = new HashMap<>();
        for (var row : reservationRepository.sumReservedSpacesByParkingSlotIds(
                slots.stream().map(ParkingSlot::getId).toList())) {
            reservedBySlot.put(row.getSlotId(), Math.toIntExact(row.getReservedSpaces()));
        }
        return slots.stream().map(slot -> {
            var capacity = capacities.getOrDefault(slot.getId(),
                    new ParkingCapacityService.CapacitySnapshot(BusinessRules.TOTAL_PARKING_SPACES, 0, 0, 0, 0, 0));
            return ParkingSlotResponseDto.fromEntity(slot, reservedBySlot.getOrDefault(slot.getId(), 0),
                    capacity.allocatedSpaces(), capacity.availableSpaces(), capacity.physicalCapacity(),
                    capacity.globalRemainingSpaces());
        }).toList();
    }

    @PostMapping("/sessions")
    @Transactional
    public ParkingSlotResponseDto createSession(@Valid @RequestBody ParkingSlotRequest request, HttpServletRequest httpRequest) {
        parkingCapacityService.lockInventory();
        parkingCapacityService.assertNoActiveHoldsForWindow(request.getSlotDate(), request.getStartTime(), request.getEndTime());
        ParkingSlot s = new ParkingSlot();
        apply(request, s);
        ParkingSlot saved = sessionRepository.save(s);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_SESSION_CREATE, "ParkingSlot", saved.getId(),
                String.format("Création créneau parking: %s", saved.getTitle()), ipAddress);

        return toResponse(saved);
    }

    @GetMapping("/sessions/{id}")
    public ParkingSlotResponseDto getSession(@PathVariable Long id) {
        ParkingSlot s = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        return toResponse(s);
    }

    @PutMapping("/sessions/{id}")
    @Transactional
    public ParkingSlotResponseDto updateSession(
            @PathVariable Long id,
            @Valid @RequestBody ParkingSlotRequest request,
            HttpServletRequest httpRequest
    ) {
        parkingCapacityService.lockInventory();
        ParkingSlot s = sessionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        boolean windowChanged = !java.util.Objects.equals(s.getSessionDate(), request.getSlotDate())
                || !java.util.Objects.equals(s.getStartTime(), request.getStartTime())
                || !java.util.Objects.equals(s.getEndTime(), request.getEndTime());
        int confirmed = reservationRepository.countReservedSpacesByParkingSlotId(id);
        if (windowChanged && confirmed > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Les horaires d'un créneau avec des réservations confirmées ne peuvent pas être modifiés.");
        }
        if ((windowChanged || !java.util.Objects.equals(s.getCapacity(), request.getParkingCapacity())
                || s.getStatus() != request.getStatus()) && parkingCapacityService.hasActiveHolds(s)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce créneau est temporairement bloqué pour un paiement.");
        }
        if (windowChanged || !java.util.Objects.equals(s.getCapacity(), request.getParkingCapacity())
                || s.getStatus() != request.getStatus()) {
            parkingCapacityService.assertNoActiveHoldsForWindow(s.getSessionDate(), s.getStartTime(), s.getEndTime());
            parkingCapacityService.assertNoActiveHoldsForWindow(request.getSlotDate(), request.getStartTime(), request.getEndTime());
        }
        apply(request, s);
        ParkingSlot saved = sessionRepository.save(s);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_SESSION_UPDATE, "ParkingSlot", saved.getId(),
                String.format("Modification créneau parking: %s", saved.getTitle()), ipAddress);

        return toResponse(saved);
    }

    @DeleteMapping("/sessions/{id}")
    @Transactional
    public void deleteSession(@PathVariable Long id, HttpServletRequest httpRequest) {
        parkingCapacityService.lockInventory();
        ParkingSlot session = sessionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
        if (parkingCapacityService.hasActiveHolds(session)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce créneau est temporairement bloqué pour un paiement.");
        }
        String sessionTitle = session.getTitle();

        reservationRepository.deleteByParkingSlotId(id);
        sessionRepository.deleteById(id);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_SESSION_DELETE, "ParkingSlot", id,
                String.format("Suppression créneau parking: %s", sessionTitle), ipAddress);
    }

    private void apply(ParkingSlotRequest r, ParkingSlot s) {
        if (!r.getEndTime().isAfter(r.getStartTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'heure de fin doit être après l'heure de début");
        }

        if (r.getParkingCapacity() > BusinessRules.TOTAL_PARKING_SPACES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "La capacité d'un créneau ne peut pas dépasser les 150 places physiques"
            );
        }

        if (s.getId() != null) {
            Integer reservedSpaces = reservationRepository.countReservedSpacesByParkingSlotId(s.getId());
            if (reservedSpaces != null && reservedSpaces > r.getParkingCapacity()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La capacité parking ne peut pas être inférieure aux places déjà réservées (" + reservedSpaces + ")"
                );
            }
        }

        s.setTitle(r.getTitle());
        s.setDescription(r.getDescription());
        s.setSessionDate(r.getSlotDate());
        s.setStartTime(r.getStartTime());
        s.setEndTime(r.getEndTime());
        s.setCapacity(r.getParkingCapacity());
        s.setParkingRate(r.getParkingRate());
        s.setStatus(r.getStatus());
    }

    private ParkingSlotResponseDto toResponse(ParkingSlot slot) {
        int reserved = reservationRepository.countReservedSpacesByParkingSlotId(slot.getId());
        ParkingCapacityService.CapacitySnapshot capacity = parkingCapacityService.snapshot(slot);
        return ParkingSlotResponseDto.fromEntity(slot, reserved, capacity.allocatedSpaces(),
                capacity.availableSpaces(), capacity.physicalCapacity(),
                capacity.globalRemainingSpaces());
    }
}
