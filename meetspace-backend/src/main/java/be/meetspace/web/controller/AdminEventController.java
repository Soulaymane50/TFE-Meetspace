package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EventPlanningService;
import be.meetspace.web.dto.EventApprovalDto;
import be.meetspace.web.dto.EventRequestDto;
import be.meetspace.web.dto.EventResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/events")
public class AdminEventController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final UserRepository userRepository;
    private final EventPlanningService eventPlanningService;
    private final AuditService auditService;

    public AdminEventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            UserRepository userRepository,
            EventPlanningService eventPlanningService,
            AuditService auditService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.userRepository = userRepository;
        this.eventPlanningService = eventPlanningService;
        this.auditService = auditService;
    }

    @GetMapping
    public List<EventResponseDto> getAllEvents() {
        return eventRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(e -> {
                    int registered = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return EventResponseDto.fromEntity(e, registered);
                })
                .toList();
    }

    @GetMapping("/pending")
    public List<EventResponseDto> getPendingEvents() {
        return eventRepository.findByStatusOrderByCreatedAtDesc(EventStatus.PENDING_APPROVAL).stream()
                .map(e -> {
                    int registered = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return EventResponseDto.fromEntity(e, registered);
                })
                .toList();
    }

    @GetMapping("/{id}")
    public EventResponseDto getEvent(@PathVariable Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));
        int registered = registrationRepository.countTotalParticipantsByEventId(event.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PostMapping
    public EventResponseDto createEvent(@Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        User admin = getAuthenticatedAdmin(authentication);

        Event event = new Event();
        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, EventStatus.PUBLISHED),
                null
        );
        event.setStatus(EventStatus.PUBLISHED);
        event.setCreatedBy(admin);
        event.setApprovedAt(LocalDateTime.now());
        event.setApprovedBy(admin);

        Event saved = eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CREATE, "Event", saved.getId(),
                String.format("Création événement par admin: %s", saved.getTitle()), ipAddress);

        return EventResponseDto.fromEntity(saved);
    }

    @PutMapping("/{id}")
    public EventResponseDto updateEvent(@PathVariable Long id, @Valid @RequestBody EventRequestDto dto, HttpServletRequest httpRequest) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, event.getStatus()),
                event.getId()
        );

        Event saved = eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_UPDATE, "Event", saved.getId(),
                String.format("Modification événement: %s", saved.getTitle()), ipAddress);

        int registered = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PostMapping("/{id}/approve")
    public EventResponseDto approveOrRejectEvent(
            @PathVariable Long id,
            @RequestBody EventApprovalDto dto,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        User admin = getAuthenticatedAdmin(authentication);

        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet evenement n'est pas en attente d'approbation");
        }

        String oldStatus = event.getStatus().name();

        if (dto.isApproved()) {
            event.setStatus(EventStatus.PUBLISHED);
            event.setApprovedAt(LocalDateTime.now());
            event.setApprovedBy(admin);
            event.setRejectionReason(null);
        } else {
            event.setStatus(EventStatus.REJECTED);
            event.setRejectionReason(dto.getRejectionReason());
        }

        Event saved = eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        AuditAction action = dto.isApproved() ? AuditAction.EVENT_APPROVE : AuditAction.EVENT_REJECT;
        String details = dto.isApproved()
                ? String.format("Approbation événement: %s", saved.getTitle())
                : String.format("Rejet événement: %s - Raison: %s", saved.getTitle(), dto.getRejectionReason());
        auditService.log(action, "Event", saved.getId(), details, oldStatus, saved.getStatus().name(), ipAddress);

        int registered = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PatchMapping("/{id}/status")
    public EventResponseDto updateStatus(@PathVariable Long id, @RequestParam String status, Authentication authentication, HttpServletRequest httpRequest) {
        User admin = getAuthenticatedAdmin(authentication);

        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        String oldStatus = event.getStatus().name();

        try {
            EventStatus newStatus = EventStatus.valueOf(status.toUpperCase());
            event.setStatus(newStatus);

            if (newStatus == EventStatus.PUBLISHED && event.getApprovedAt() == null) {
                event.setApprovedAt(LocalDateTime.now());
                event.setApprovedBy(admin);
            }
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide");
        }

        Event saved = eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_UPDATE, "Event", saved.getId(),
                String.format("Changement statut événement: %s", saved.getTitle()),
                oldStatus, saved.getStatus().name(), ipAddress);

        int registered = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteEvent(@PathVariable Long id, HttpServletRequest httpRequest) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        String eventTitle = event.getTitle();

        if (event.getParkingSlot() != null) {
            parkingReservationRepository.deleteByParkingSlotId(event.getParkingSlot().getId());
        }
        registrationRepository.deleteByEventId(id);
        eventRepository.delete(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_DELETE, "Event", id,
                String.format("Suppression événement: %s", eventTitle), ipAddress);
    }

    private User getAuthenticatedAdmin(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}

