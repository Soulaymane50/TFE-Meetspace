package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EventBillingService;
import be.meetspace.service.EventPlanningService;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.dto.AdminEventRegistrationDto;
import be.meetspace.web.dto.EventCheckInRequest;
import be.meetspace.web.dto.EventCheckInResponseDto;
import be.meetspace.web.dto.EventRequestDto;
import be.meetspace.web.dto.EventResponseDto;
import be.meetspace.web.dto.PayReservationRequest;
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
@RequestMapping("/api/organizer/events")
public class OrganizerEventController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final UserRepository userRepository;
    private final EventPlanningService eventPlanningService;
    private final EventBillingService eventBillingService;
    private final ParkingCapacityService parkingCapacityService;
    private final AuditService auditService;

    public OrganizerEventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            UserRepository userRepository,
            EventPlanningService eventPlanningService,
            EventBillingService eventBillingService,
            ParkingCapacityService parkingCapacityService,
            AuditService auditService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.userRepository = userRepository;
        this.eventPlanningService = eventPlanningService;
        this.eventBillingService = eventBillingService;
        this.parkingCapacityService = parkingCapacityService;
        this.auditService = auditService;
    }

    @PostMapping
    @Transactional
    public EventResponseDto createEvent(@Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        User organizer = getAuthenticatedUser(authentication);

        if (!organizer.getRole().name().equals("ORGANIZER") && !organizer.getRole().name().equals("ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seuls les organisateurs peuvent créer des événements");
        }

        Event event = new Event();
        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, EventStatus.PENDING_APPROVAL),
                null
        );
        event.setCreatedBy(organizer);

        if (organizer.getRole().name().equals("ADMIN")) {
            event.setStatus(EventStatus.PUBLISHED);
            event.setApprovedAt(LocalDateTime.now());
            event.setApprovedBy(organizer);
        } else {
            event.setStatus(EventStatus.PENDING_APPROVAL);
        }

        Event saved = eventRepository.save(event);
        if (saved.getStatus() == EventStatus.PUBLISHED) {
            eventPlanningService.activateParkingForPublication(saved);
        }

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CREATE, "Event", saved.getId(),
                String.format("Création événement par organisateur: %s (statut: %s)", saved.getTitle(), saved.getStatus()),
                ipAddress);

        return toResponse(saved, 0);
    }

    @GetMapping("/my")
    public List<EventResponseDto> getMyEvents(Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);

        return eventRepository.findByCreatedByIdOrderByCreatedAtDesc(organizer.getId()).stream()
                .map(e -> {
                    int registered = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return toResponse(e, registered);
                })
                .toList();
    }

    @GetMapping("/my/{id}/attendees")
    @Transactional(readOnly = true)
    public List<AdminEventRegistrationDto> getEventAttendees(@PathVariable Long id, Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));
        ensureCanManage(event, organizer);
        return registrationRepository.findByEventId(id).stream()
                .map(AdminEventRegistrationDto::fromEntity)
                .toList();
    }

    @PostMapping("/my/{id}/check-in")
    @Transactional
    public EventCheckInResponseDto checkInAttendee(
            @PathVariable Long id,
            @Valid @RequestBody EventCheckInRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        User organizer = getAuthenticatedUser(authentication);
        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));
        ensureCanManage(event, organizer);

        String ticketToken = normalizeTicket(request.getTicket(), id);
        EventRegistration registration = registrationRepository.findByTicketTokenForUpdate(ticketToken)
                .filter(candidate -> candidate.getEvent().getId().equals(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Billet invalide pour cet événement"));

        if (registration.getStatus() != be.meetspace.entity.EventRegistrationStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce billet n'est plus actif");
        }

        boolean alreadyCheckedIn = registration.getCheckedInAt() != null;
        if (!alreadyCheckedIn) {
            registration.setCheckedInAt(LocalDateTime.now());
            registration.setCheckedInBy(organizer);
            registrationRepository.save(registration);
            auditService.log(AuditAction.EVENT_CHECK_IN, "EventRegistration", registration.getId(),
                    String.format("Contrôle d'accès: %s (%d participant(s))",
                            event.getTitle(), registration.getNumberOfParticipants()),
                    AuditService.getClientIpAddress(httpRequest));
        }

        return EventCheckInResponseDto.fromEntity(registration, alreadyCheckedIn);
    }

    @GetMapping("/my/{id}")
    public EventResponseDto getMyEvent(@PathVariable Long id, Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);

        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (!event.getCreatedBy().getId().equals(organizer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le créateur de cet événement");
        }

        int registered = registrationRepository.countTotalParticipantsByEventId(event.getId());
        return toResponse(event, registered);
    }

    @PostMapping("/my/{id}/pay-deposit")
    @Transactional
    public EventResponseDto payDeposit(@PathVariable Long id,
                                       @Valid @RequestBody PayReservationRequest request,
                                       Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);
        Event saved = eventBillingService.payDeposit(id, request.getPaymentIntentId(), organizer);
        return toResponse(saved, registrationRepository.countTotalParticipantsByEventId(saved.getId()));
    }

    @PostMapping("/my/{id}/pay-balance")
    @Transactional
    public EventResponseDto payBalance(@PathVariable Long id,
                                       @Valid @RequestBody PayReservationRequest request,
                                       Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);
        Event saved = eventBillingService.payBalance(id, request.getPaymentIntentId(), organizer);
        return toResponse(saved, registrationRepository.countTotalParticipantsByEventId(saved.getId()));
    }

    @PutMapping("/my/{id}")
    @Transactional
    public EventResponseDto updateMyEvent(@PathVariable Long id, @Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        User organizer = getAuthenticatedUser(authentication);

        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (!event.getCreatedBy().getId().equals(organizer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le créateur de cet événement");
        }

        if (event.getStatus() != EventStatus.PENDING_APPROVAL && event.getStatus() != EventStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Impossible de modifier un événement déjà publié ou annulé");
        }

        String oldStatus = event.getStatus().name();

        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, event.getStatus()),
                event.getId()
        );

        if (event.getStatus() == EventStatus.REJECTED) {
            event.setStatus(EventStatus.PENDING_APPROVAL);
            event.setRejectionReason(null);
        }

        Event saved = eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_UPDATE, "Event", saved.getId(),
                String.format("Modification événement par organisateur: %s", saved.getTitle()),
                oldStatus, saved.getStatus().name(), ipAddress);

        return toResponse(saved, registrationRepository.countTotalParticipantsByEventId(saved.getId()));
    }

    @DeleteMapping("/my/{id}")
    @Transactional
    public void cancelMyEvent(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        User organizer = getAuthenticatedUser(authentication);

        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (!event.getCreatedBy().getId().equals(organizer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le créateur de cet événement");
        }

        String oldStatus = event.getStatus().name();
        event.setStatus(EventStatus.CANCELLED);
        eventRepository.save(event);
        eventPlanningService.syncParkingStatus(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CANCEL, "Event", event.getId(),
                String.format("Annulation événement par organisateur: %s", event.getTitle()),
                oldStatus, "CANCELLED", ipAddress);
    }

    private void ensureCanManage(Event event, User organizer) {
        boolean isAdmin = organizer.getRole().name().equals("ADMIN");
        boolean isOwner = event.getCreatedBy() != null && event.getCreatedBy().getId().equals(organizer.getId());
        if (!isAdmin && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas gérer cet événement");
        }
    }

    private String normalizeTicket(String rawTicket, Long eventId) {
        String value = rawTicket == null ? "" : rawTicket.trim();
        String prefix = "MS-CHECKIN:" + eventId + ":";
        if (value.regionMatches(true, 0, prefix, 0, prefix.length())) {
            value = value.substring(prefix.length());
        } else if (value.regionMatches(true, 0, "MS-CHECKIN:", 0, 11)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce billet correspond à un autre événement");
        }
        value = value.replaceAll("[\\s-]+", "");
        if (!value.matches("[A-Za-z0-9]{24,64}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de billet invalide");
        }
        return value;
    }

    private EventResponseDto toResponse(Event event, int registered) {
        EventResponseDto dto = EventResponseDto.fromEntity(event, registered);
        if (event.getParkingSlot() != null) {
            ParkingCapacityService.CapacitySnapshot capacity = parkingCapacityService.snapshot(event.getParkingSlot());
            dto.applyParkingCapacity(capacity.allocatedSpaces(), capacity.availableSpaces(),
                    capacity.physicalCapacity(), capacity.globalRemainingSpaces());
        }
        return dto;
    }

    private User getAuthenticatedUser(Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}

