package be.meetspace.web.controller;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EmailService;
import be.meetspace.web.dto.EventRegistrationRequest;
import be.meetspace.web.dto.EventRegistrationResponseDto;
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
@RequestMapping("/api/public/events")
public class EventRegistrationController {

    private final EventRegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final PaymentVerifier paymentVerifier;
    private final AuditService auditService;
    private final EmailService emailService;

    public EventRegistrationController(
            EventRegistrationRepository registrationRepository,
            EventRepository eventRepository,
            UserRepository userRepository,
            ParkingReservationRepository parkingReservationRepository,
            PaymentVerifier paymentVerifier,
            AuditService auditService,
            EmailService emailService
    ) {
        this.registrationRepository = registrationRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.paymentVerifier = paymentVerifier;
        this.auditService = auditService;
        this.emailService = emailService;
    }

    @PostMapping("/register")
    @Transactional
    public EventRegistrationResponseDto register(
            @Valid @RequestBody EventRegistrationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet événement n'est pas ouvert aux inscriptions");
        }

        if (event.getStartDateTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet événement est déjà passé");
        }

        if (registrationRepository.existsByUserAndEventAndStatusNot(user, event, EventRegistrationStatus.CANCELLED)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous êtes déjà inscrit à cet événement");
        }

        if (event.getCapacity() != null) {
            Integer currentParticipants = registrationRepository.countTotalParticipantsByEventId(event.getId());
            if (currentParticipants + request.getNumberOfParticipants() > event.getCapacity()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Capacité maximale atteinte");
            }
        }

        ParkingSlot parkingSlot = event.getParkingSlot();
        int reservedSpaces = 0;
        double parkingPrice = 0.0;

        if (request.isAddParking() && parkingSlot != null) {
            reservedSpaces = request.getReservedSpaces() != null ? request.getReservedSpaces() : 0;
            if (reservedSpaces <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de places invalide");
            }

            if (parkingSlot.getStatus() != ParkingSlotStatus.OPEN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le parking n'est pas disponible pour cet événement");
            }

            Integer currentlyReservedSpaces = parkingReservationRepository.countReservedSpacesByParkingSlotId(parkingSlot.getId());
            if (currentlyReservedSpaces == null) currentlyReservedSpaces = 0;
            if (currentlyReservedSpaces + reservedSpaces > parkingSlot.getCapacity()) {
                int remaining = parkingSlot.getCapacity() - currentlyReservedSpaces;
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Capacité parking insuffisante. Places restantes : " + remaining);
            }

            parkingPrice = parkingSlot.getParkingRate() * reservedSpaces;
        }

        Double eventPrice = 0.0;
        if (event.getPrice() != null && event.getPrice() > 0) {
            eventPrice = event.getPrice() * request.getNumberOfParticipants();
        }

        Double totalPrice = eventPrice + parkingPrice;

        if (totalPrice > 0) {
            if (request.getPaymentIntentId() == null || request.getPaymentIntentId().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement requis");
            }
            paymentVerifier.verifyPayment(request.getPaymentIntentId());
        }

        EventRegistration registration = new EventRegistration();
        registration.setUser(user);
        registration.setEvent(event);
        registration.setNumberOfParticipants(request.getNumberOfParticipants());
        registration.setTotalPrice(eventPrice);
        registration.setPaymentIntentId(request.getPaymentIntentId());
        registration.setStatus(EventRegistrationStatus.CONFIRMED);

        EventRegistration saved = registrationRepository.save(registration);

        // Get IP address for audit logging
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        ParkingReservation savedParkingReservation = null;

        if (request.isAddParking() && parkingSlot != null && reservedSpaces > 0) {
            ParkingReservation parkingReservation = new ParkingReservation();
            parkingReservation.setUser(user);
            parkingReservation.setParkingSlot(parkingSlot);
            parkingReservation.setReservedSpaces(reservedSpaces);
            parkingReservation.setTotalPrice(parkingPrice);
            parkingReservation.setPaymentIntentId(request.getPaymentIntentId());
            parkingReservation.setStatus(ParkingReservationStatus.CONFIRMED);
            savedParkingReservation = parkingReservationRepository.save(parkingReservation);

            auditService.log(AuditAction.PARKING_RESERVATION_CREATE, "ParkingReservation", savedParkingReservation.getId(),
                    String.format("Réservation parking pour événement: %s (%d places)", event.getTitle(), reservedSpaces),
                    ipAddress);
        }

        // Audit log for event registration
        auditService.log(AuditAction.EVENT_REGISTRATION_CREATE, "EventRegistration", saved.getId(),
                String.format("Inscription à l'événement: %s (%d participants)", event.getTitle(), request.getNumberOfParticipants()),
                ipAddress);

        emailService.sendEventRegistrationConfirmation(saved);
        if (savedParkingReservation != null) {
            emailService.sendParkingReservationConfirmation(savedParkingReservation);
        }

        return EventRegistrationResponseDto.fromEntity(saved);
    }

    @GetMapping("/registrations/me")
    public List<EventRegistrationResponseDto> getMyRegistrations(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        List<EventRegistration> registrations = registrationRepository.findByUserId(user.getId());
        return registrations.stream()
                .map(EventRegistrationResponseDto::fromEntity)
                .toList();
    }

    @DeleteMapping("/registrations/{id}/cancel")
    public void cancelRegistration(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        EventRegistration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inscription introuvable"));

        if (!registration.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas annuler cette inscription");
        }

        if (registration.getEvent().getStartDateTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'événement est déjà passé");
        }

        String oldStatus = registration.getStatus().name();
        registration.setStatus(EventRegistrationStatus.CANCELLED);
        registrationRepository.save(registration);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.EVENT_REGISTRATION_CANCEL, "EventRegistration", registration.getId(),
                String.format("Annulation inscription événement: %s", registration.getEvent().getTitle()),
                oldStatus, "CANCELLED", ipAddress);
    }
}

