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
    public List<ParkingSlotResponseDto> listSessions() {
        return sessionRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PostMapping("/sessions")
    public ParkingSlotResponseDto createSession(@Valid @RequestBody ParkingSlotRequest request, HttpServletRequest httpRequest) {
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
    public ParkingSlotResponseDto updateSession(
            @PathVariable Long id,
            @Valid @RequestBody ParkingSlotRequest request,
            HttpServletRequest httpRequest
    ) {
        ParkingSlot s = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

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
        ParkingSlot session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));
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
