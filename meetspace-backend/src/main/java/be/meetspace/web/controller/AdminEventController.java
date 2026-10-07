package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.NotificationTone;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EventBillingService;
import be.meetspace.service.EventPlanningService;
import be.meetspace.service.NotificationService;
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
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/events")
public class AdminEventController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final UserRepository userRepository;
    private final EventPlanningService eventPlanningService;
    private final EventBillingService eventBillingService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public AdminEventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            UserRepository userRepository,
            EventPlanningService eventPlanningService,
            EventBillingService eventBillingService,
            AuditService auditService,
            NotificationService notificationService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.userRepository = userRepository;
        this.eventPlanningService = eventPlanningService;
        this.eventBillingService = eventBillingService;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<EventResponseDto> getAllEvents() {
        return eventResponses(eventRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/pending")
    @Transactional(readOnly = true)
    public List<EventResponseDto> getPendingEvents() {
        return eventResponses(eventRepository.findByStatusOrderByCreatedAtDesc(EventStatus.PENDING_APPROVAL));
    }

    private List<EventResponseDto> eventResponses(List<Event> events) {
        if (events.isEmpty()) return List.of();
        Map<Long, Long> participants = registrationRepository.sumParticipantsByEventIds(
                events.stream().map(Event::getId).toList()).stream()
                .collect(Collectors.toMap(EventRegistrationRepository.ParticipantsByEvent::getEventId,
                        EventRegistrationRepository.ParticipantsByEvent::getParticipantCount));
        return events.stream().map(event -> EventResponseDto.fromEntity(event,
                Math.toIntExact(participants.getOrDefault(event.getId(), 0L)))).toList();
    }

    @GetMapping("/{id}")
    public EventResponseDto getEvent(@PathVariable Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));
        int registered = registrationRepository.countTotalParticipantsByEventId(event.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PostMapping
    @Transactional
    public EventResponseDto createEvent(@Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        eventPlanningService.lockParkingInventory();
        User admin = getAuthenticatedAdmin(authentication);
        EventStatus requestedStatus = dto.getStatus() == null ? EventStatus.PUBLISHED : dto.getStatus();
        if (requestedStatus != EventStatus.PUBLISHED && requestedStatus != EventStatus.PENDING_APPROVAL
                && requestedStatus != EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce statut doit suivre le circuit d'approbation de l'événement.");
        }

        Event event = new Event();
        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, EventStatus.PENDING_APPROVAL),
                null
        );
        event.setCreatedBy(admin);
        event.setStatus(EventStatus.PENDING_APPROVAL);
        transitionStatus(event, requestedStatus, admin);

        Event saved = eventRepository.save(event);
        if (saved.getStatus() == EventStatus.PUBLISHED) eventPlanningService.activateParkingForPublication(saved);
        else eventPlanningService.syncParkingStatus(saved);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CREATE, "Event", saved.getId(),
                String.format("Création événement par admin: %s", saved.getTitle()), ipAddress);

        return EventResponseDto.fromEntity(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public EventResponseDto updateEvent(@PathVariable Long id, @Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        eventPlanningService.lockParkingInventory();
        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        User admin = getAuthenticatedAdmin(authentication);
        EventStatus requestedStatus = dto.getStatus() == null ? event.getStatus() : dto.getStatus();
        validateTransition(event, requestedStatus);
        if (requestedStatus == EventStatus.PUBLISHED && event.getStatus() != EventStatus.PUBLISHED) {
            // A data edit must not erase an existing unpaid deposit requirement.
            eventBillingService.validatePaymentForPublication(event);
        }

        eventPlanningService.applyAndValidate(
                event,
                EventPlanningService.EventData.from(dto, event.getStatus()),
                event.getId()
        );

        transitionStatus(event, requestedStatus, admin);

        Event saved = eventRepository.save(event);
        if (saved.getStatus() == EventStatus.PUBLISHED) {
            eventPlanningService.activateParkingForPublication(saved);
        } else {
            eventPlanningService.syncParkingStatus(saved);
        }

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_UPDATE, "Event", saved.getId(),
                String.format("Modification événement: %s", saved.getTitle()), ipAddress);

        int registered = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public EventResponseDto approveOrRejectEvent(
            @PathVariable Long id,
            @RequestBody EventApprovalDto dto,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        eventPlanningService.lockParkingInventory();
        User admin = getAuthenticatedAdmin(authentication);

        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet evenement n'est pas en attente d'approbation");
        }

        String oldStatus = event.getStatus().name();

        if (dto.isApproved()) {
            eventPlanningService.validateAvailabilityForPublication(event);
            eventBillingService.prepareAfterApproval(event);
            event.setApprovedAt(LocalDateTime.now());
            event.setApprovedBy(admin);
            event.setRejectionReason(null);
        } else {
            event.setStatus(EventStatus.REJECTED);
            event.setRejectionReason(dto.getRejectionReason());
        }

        Event saved = eventRepository.save(event);
        if (dto.isApproved() && saved.getStatus() == EventStatus.PUBLISHED) {
            eventPlanningService.activateParkingForPublication(saved);
        } else {
            eventPlanningService.syncParkingStatus(saved);
        }

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        AuditAction action = dto.isApproved() ? AuditAction.EVENT_APPROVE : AuditAction.EVENT_REJECT;
        String details = dto.isApproved()
                ? String.format("Approbation événement: %s", saved.getTitle())
                : String.format("Rejet événement: %s - Raison: %s", saved.getTitle(), dto.getRejectionReason());
        auditService.log(action, "Event", saved.getId(), details, oldStatus, saved.getStatus().name(), ipAddress);

        if (saved.getCreatedBy() != null) {
            notificationService.create(saved.getCreatedBy(),
                    dto.isApproved() ? NotificationTone.SUCCESS : NotificationTone.WARNING,
                    dto.isApproved() ? "Événement validé" : "Événement refusé",
                    dto.isApproved()
                            ? (saved.getStatus() == EventStatus.AWAITING_DEPOSIT
                                ? saved.getTitle() + " est validé. Payez la location pour le publier."
                                : saved.getTitle() + " est maintenant visible dans le catalogue.")
                            : saved.getTitle() + " doit être corrigé avant publication.",
                    "/organizer/events", "Event", saved.getId());
        }

        int registered = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(event, registered);
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public EventResponseDto updateStatus(@PathVariable Long id, @RequestParam String status, Authentication authentication, HttpServletRequest httpRequest) {
        eventPlanningService.lockParkingInventory();
        User admin = getAuthenticatedAdmin(authentication);

        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        String oldStatus = event.getStatus().name();

        try {
            EventStatus newStatus = EventStatus.valueOf(status.toUpperCase(java.util.Locale.ROOT));
            if (newStatus == event.getStatus()) {
                return EventResponseDto.fromEntity(event, registrationRepository.countTotalParticipantsByEventId(event.getId()));
            }
            transitionStatus(event, newStatus, admin);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide");
        }

        Event saved = eventRepository.save(event);
        if (saved.getStatus() == EventStatus.PUBLISHED) {
            eventPlanningService.activateParkingForPublication(saved);
        } else {
            eventPlanningService.syncParkingStatus(saved);
        }

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
        eventPlanningService.lockParkingInventory();
        Event event = eventRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable"));

        if (event.getDepositPaidAt() != null || event.getBalancePaidAt() != null
                || event.getDepositPaymentIntentId() != null || event.getBalancePaymentIntentId() != null
                || !registrationRepository.findByEventId(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cet événement possède un historique d'inscriptions ou de paiements. Annulez-le plutôt que de le supprimer.");
        }

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

    private void validateTransition(Event event, EventStatus next) {
        if (next == event.getStatus()) return;
        if (next == EventStatus.CANCELLED && "PAID".equals(event.getSettlementStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un événement dont le versement est enregistré ne peut plus être annulé.");
        }
        if (event.getStatus() == EventStatus.CANCELLED
                || (event.getStatus() == EventStatus.REJECTED && next == EventStatus.PUBLISHED)
                || (event.getStatus() == EventStatus.PUBLISHED && next != EventStatus.CANCELLED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette transition est interdite : un événement annulé ne peut pas être rouvert et un événement publié ne peut pas revenir en attente ou rejeté.");
        }
        if (next != EventStatus.PUBLISHED && next != EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Utilisez le circuit d'approbation pour ce statut.");
        }
        boolean internalAdminEvent = event.getCreatedBy() != null && event.getCreatedBy().getRole() == be.meetspace.entity.Role.ADMIN;
        if (next == EventStatus.PUBLISHED && event.getStatus() == EventStatus.PENDING_APPROVAL && !internalAdminEvent) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'événement doit être approuvé avant publication.");
        }
    }

    private void transitionStatus(Event event, EventStatus next, User admin) {
        validateTransition(event, next);
        if (next == event.getStatus()) return;
        if (next == EventStatus.PUBLISHED) {
            eventBillingService.validatePaymentForPublication(event);
            eventPlanningService.validateAvailabilityForPublication(event);
        }
        event.setStatus(next);
        if (next == EventStatus.PUBLISHED && event.getApprovedAt() == null) {
            event.setApprovedAt(LocalDateTime.now()); event.setApprovedBy(admin);
        }
    }

    private User getAuthenticatedAdmin(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}
