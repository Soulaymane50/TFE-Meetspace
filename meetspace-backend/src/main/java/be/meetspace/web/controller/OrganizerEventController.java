package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EventPlanningService;
import be.meetspace.web.dto.EventRequestDto;
import be.meetspace.web.dto.EventResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
    private final AuditService auditService;

    public OrganizerEventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            UserRepository userRepository,
            EventPlanningService eventPlanningService,
            AuditService auditService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.userRepository = userRepository;
        this.eventPlanningService = eventPlanningService;
        this.auditService = auditService;
    }

    @PostMapping
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

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CREATE, "Event", saved.getId(),
                String.format("Création événement par organisateur: %s (statut: %s)", saved.getTitle(), saved.getStatus()),
                ipAddress);

        return EventResponseDto.fromEntity(saved);
    }

    @GetMapping("/my")
    public List<EventResponseDto> getMyEvents(Authentication authentication) {
        User organizer = getAuthenticatedUser(authentication);

        return eventRepository.findByCreatedByIdOrderByCreatedAtDesc(organizer.getId()).stream()
                .map(e -> {
                    int registered = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return EventResponseDto.fromEntity(e, registered);
                })
                .toList();
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
        return EventResponseDto.fromEntity(event, registered);
    }

    @PutMapping("/my/{id}")
    public EventResponseDto updateMyEvent(@PathVariable Long id, @Valid @RequestBody EventRequestDto dto, Authentication authentication, HttpServletRequest httpRequest) {
        User organizer = getAuthenticatedUser(authentication);

        Event event = eventRepository.findById(id)
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

        return EventResponseDto.fromEntity(saved);
    }

    @DeleteMapping("/my/{id}")
    public void cancelMyEvent(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        User organizer = getAuthenticatedUser(authentication);

        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (!event.getCreatedBy().getId().equals(organizer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous n'êtes pas le créateur de cet événement");
        }

        String oldStatus = event.getStatus().name();
        event.setStatus(EventStatus.CANCELLED);
        eventRepository.save(event);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_CANCEL, "Event", event.getId(),
                String.format("Annulation événement par organisateur: %s", event.getTitle()),
                oldStatus, "CANCELLED", ipAddress);
    }

    private User getAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}

