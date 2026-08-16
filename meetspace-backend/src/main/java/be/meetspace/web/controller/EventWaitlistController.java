package be.meetspace.web.controller;

import be.meetspace.entity.*;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EventWaitlistRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.NotificationService;
import be.meetspace.web.dto.EventWaitlistDto;
import be.meetspace.web.dto.EventWaitlistRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/public/events/waitlist")
public class EventWaitlistController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final EventWaitlistRepository waitlistRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public EventWaitlistController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            EventWaitlistRepository waitlistRepository,
            UserRepository userRepository,
            NotificationService notificationService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.waitlistRepository = waitlistRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @PostMapping("/{eventId}")
    @Transactional
    public EventWaitlistDto join(
            @PathVariable Long eventId,
            @Valid @RequestBody EventWaitlistRequest request,
            Authentication authentication
    ) {
        User user = requireUser(authentication);
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (event.getStatus() != EventStatus.PUBLISHED || event.getStartDateTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet événement n'accepte plus de liste d'attente");
        }
        if (registrationRepository.existsByUserAndEventAndStatusNot(user, event, EventRegistrationStatus.CANCELLED)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous êtes déjà inscrit à cet événement");
        }

        int registered = registrationRepository.countTotalParticipantsByEventId(eventId);
        int available = event.getCapacity() == null ? Integer.MAX_VALUE : Math.max(0, event.getCapacity() - registered);
        if (available >= request.getParticipantCount()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Des places sont disponibles: inscrivez-vous directement");
        }

        EventWaitlistEntry entry = waitlistRepository.findByUserAndEvent(user, event)
                .orElseGet(EventWaitlistEntry::new);
        entry.setUser(user);
        entry.setEvent(event);
        entry.setParticipantCount(request.getParticipantCount());
        entry.setStatus(EventWaitlistStatus.WAITING);
        EventWaitlistEntry saved = waitlistRepository.save(entry);

        notificationService.create(user, NotificationTone.INFO,
                "Liste d'attente enregistrée",
                "Nous vous préviendrons si une place se libère pour " + event.getTitle() + ".",
                "/my-reservations?tab=events", "EventWaitlist", saved.getId());
        return EventWaitlistDto.fromEntity(saved);
    }

    @GetMapping("/me")
    public List<EventWaitlistDto> listMine(Authentication authentication) {
        User user = requireUser(authentication);
        return waitlistRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(EventWaitlistDto::fromEntity)
                .toList();
    }

    @DeleteMapping("/{id}")
    @Transactional
    public EventWaitlistDto leave(@PathVariable Long id, Authentication authentication) {
        User user = requireUser(authentication);
        EventWaitlistEntry entry = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Liste d'attente introuvable"));
        if (!entry.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Accès refusé");
        }
        entry.setStatus(EventWaitlistStatus.CANCELLED);
        return EventWaitlistDto.fromEntity(waitlistRepository.save(entry));
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}
