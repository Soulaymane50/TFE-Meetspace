package be.meetspace.web.controller;

import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EmailService;
import be.meetspace.service.PaymentLifecycleService;
import be.meetspace.service.PaymentQuoteService;
import be.meetspace.service.CancellationPolicyService;
import be.meetspace.service.NotificationService;
import be.meetspace.web.dto.CancellationResponse;
import be.meetspace.web.dto.CalendarReservationDto;
import be.meetspace.web.dto.CreateReservationRequest;
import be.meetspace.web.dto.PayReservationRequest;
import be.meetspace.web.dto.PremiumRoomReservationRequest;
import be.meetspace.web.dto.ReservationResponseDto;
import be.meetspace.web.dto.RescheduleReservationRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/reservations")
public class ReservationController {

    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final EspaceRepository espaceRepository;
    private final EventRepository eventRepository;
    private final PaymentLifecycleService paymentLifecycleService;
    private final PaymentQuoteService paymentQuoteService;
    private final CancellationPolicyService cancellationPolicyService;
    private final AuditService auditService;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public ReservationController(ReservationRepository reservationRepository,
                                 UserRepository userRepository,
                                 EspaceRepository espaceRepository,
                                 EventRepository eventRepository,
                                 PaymentLifecycleService paymentLifecycleService,
                                 PaymentQuoteService paymentQuoteService,
                                 CancellationPolicyService cancellationPolicyService,
                                 AuditService auditService,
                                 EmailService emailService,
                                 NotificationService notificationService) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.espaceRepository = espaceRepository;
        this.eventRepository = eventRepository;
        this.paymentLifecycleService = paymentLifecycleService;
        this.paymentQuoteService = paymentQuoteService;
        this.cancellationPolicyService = cancellationPolicyService;
        this.auditService = auditService;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    private void validateRoomWindow(Long espaceId, LocalDateTime startDateTime, LocalDateTime endDateTime) {
        if (startDateTime == null || endDateTime == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les horaires sont requis");
        }

        if (startDateTime.isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de debut ne peut pas etre dans le passe");
        }

        if (!endDateTime.isAfter(startDateTime)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit etre apres la date de debut");
        }

        boolean hasReservationOverlap = reservationRepository.existsOverlappingReservation(
                espaceId,
                startDateTime,
                endDateTime
        );

        boolean hasEventOverlap = eventRepository.existsOverlappingEventForSpace(
                espaceId,
                startDateTime,
                endDateTime,
                null
        );

        if (hasReservationOverlap || hasEventOverlap) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cet espace est deja occupe sur ce creneau. Merci de choisir un autre horaire.");
        }
    }

    @PostMapping
    @Transactional
    public ReservationResponseDto create(
            @Valid @RequestBody CreateReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        Espace espace = espaceRepository.findByIdForUpdate(request.getEspaceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable"));

        if (espace.getType() == EspaceType.PREMIUM_ROOM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Les salles premium doivent etre reservees via l'endpoint /premium-room");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        if (espace.getStatus() != EspaceStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Espace non disponible");
        }

        validateRoomWindow(request.getEspaceId(), request.getStartDateTime(), request.getEndDateTime());

        long expectedAmountCents = paymentQuoteService.calculateRoomPriceCents(
                espace, request.getStartDateTime(), request.getEndDateTime());
        paymentLifecycleService.consume(
                request.getPaymentIntentId(), user, PaymentType.SPACE, expectedAmountCents, espace.getId());

        Reservation reservation = new Reservation();
        reservation.setUser(user);
        reservation.setEspace(espace);
        reservation.setStartDateTime(request.getStartDateTime());
        reservation.setEndDateTime(request.getEndDateTime());
        reservation.setTotalPrice(expectedAmountCents / 100D);
        reservation.setPaymentIntentId(request.getPaymentIntentId());
        reservation.setStatus(ReservationStatus.CONFIRMED);

        Reservation saved = reservationRepository.save(reservation);
        paymentLifecycleService.bindToBooking(request.getPaymentIntentId(), saved.getId());

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CREATE, "Reservation", saved.getId(),
                String.format("Reservation creee pour l'espace: %s (ID: %d)", espace.getName(), espace.getId()),
                ipAddress);

        emailService.sendRoomReservationConfirmation(saved);
        notificationService.create(user, NotificationTone.SUCCESS,
                "Réservation confirmée",
                "Votre réservation pour " + espace.getName() + " est confirmée.",
                "/my-reservations?tab=spaces", "Reservation", saved.getId());

        return ReservationResponseDto.fromEntity(saved);
    }

    @PostMapping("/premium-room")
    @Transactional
    public ReservationResponseDto requestPremiumRoomReservation(
            @Valid @RequestBody PremiumRoomReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        Espace espace = espaceRepository.findByIdForUpdate(request.getEspaceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable"));

        if (espace.getType() != EspaceType.PREMIUM_ROOM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cet espace n'est pas une salle premium. Utilisez l'endpoint standard pour les salles.");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        if (espace.getStatus() != EspaceStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Espace non disponible");
        }

        validateRoomWindow(request.getEspaceId(), request.getStartDateTime(), request.getEndDateTime());

        long expectedAmountCents = paymentQuoteService.calculateRoomPriceCents(
                espace, request.getStartDateTime(), request.getEndDateTime());

        Reservation reservation = new Reservation();
        reservation.setUser(user);
        reservation.setEspace(espace);
        reservation.setStartDateTime(request.getStartDateTime());
        reservation.setEndDateTime(request.getEndDateTime());
        reservation.setTotalPrice(expectedAmountCents / 100D);
        reservation.setJustification(request.getJustification());
        reservation.setStatus(ReservationStatus.PENDING_APPROVAL);

        Reservation saved = reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CREATE, "Reservation", saved.getId(),
                String.format("Demande de reservation salle premium: %s (ID: %d) - En attente d'approbation",
                        espace.getName(), espace.getId()),
                ipAddress);

        notificationService.create(user, NotificationTone.ACTION,
                "Demande transmise",
                "Votre demande pour " + espace.getName() + " attend la validation de l’administration.",
                "/my-reservations?tab=spaces", "Reservation", saved.getId());

        return ReservationResponseDto.fromEntity(saved);
    }

    @PostMapping("/{id}/pay")
    @Transactional
    public ReservationResponseDto payApprovedReservation(
            @PathVariable Long id,
            @Valid @RequestBody PayReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        Reservation reservation = reservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas payer cette reservation");
        }

        if (reservation.getStatus() != ReservationStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cette reservation n'est pas en attente de paiement. Statut actuel: " + reservation.getStatus());
        }

        long expectedAmountCents = Math.round(reservation.getTotalPrice() * 100D);
        paymentLifecycleService.consume(
                request.getPaymentIntentId(), user, PaymentType.PREMIUM_ROOM, expectedAmountCents, reservation.getId());

        reservation.setPaymentIntentId(request.getPaymentIntentId());
        reservation.setStatus(ReservationStatus.CONFIRMED);

        Reservation saved = reservationRepository.save(reservation);
        paymentLifecycleService.bindToBooking(request.getPaymentIntentId(), saved.getId());

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_UPDATE, "Reservation", saved.getId(),
                String.format("Paiement effectue pour reservation salle premium: %s", saved.getEspace().getName()),
                "APPROVED", "CONFIRMED", ipAddress);

        emailService.sendRoomReservationConfirmation(saved);
        notificationService.create(user, NotificationTone.SUCCESS,
                "Paiement confirmé",
                "Votre réservation premium pour " + saved.getEspace().getName() + " est maintenant confirmée.",
                "/my-reservations?tab=spaces", "Reservation", saved.getId());

        return ReservationResponseDto.fromEntity(saved);
    }

    @GetMapping("/me")
    public List<ReservationResponseDto> getMyReservations(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        List<Reservation> reservations = reservationRepository.findByUser(user);
        return reservations.stream()
                .map(ReservationResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ReservationResponseDto getMyReservation(@PathVariable Long id, Authentication authentication) {
        User user = requireCurrentUser(authentication);
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces refuse");
        }
        return ReservationResponseDto.fromEntity(reservation);
    }

    @PatchMapping("/{id}/schedule")
    @Transactional
    public ReservationResponseDto rescheduleReservation(
            @PathVariable Long id,
            @Valid @RequestBody RescheduleReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        User user = requireCurrentUser(authentication);
        Reservation reservation = reservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas modifier cette réservation");
        }
        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seule une réservation confirmée peut être modifiée");
        }
        if (reservation.getStartDateTime().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La modification est fermee moins de 24 heures avant le debut");
        }
        if (request.getStartDateTime().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le nouveau creneau doit commencer dans plus de 24 heures");
        }
        if (!request.getEndDateTime().isAfter(request.getStartDateTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit etre apres la date de debut");
        }

        Duration previousDuration = Duration.between(reservation.getStartDateTime(), reservation.getEndDateTime());
        Duration requestedDuration = Duration.between(request.getStartDateTime(), request.getEndDateTime());
        if (!previousDuration.equals(requestedDuration)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La duree ne peut pas etre modifiee apres paiement");
        }

        boolean hasReservationOverlap = reservationRepository.existsOverlappingReservationExcludingId(
                reservation.getEspace().getId(), reservation.getId(),
                request.getStartDateTime(), request.getEndDateTime());
        boolean hasEventOverlap = eventRepository.existsOverlappingEventForSpace(
                reservation.getEspace().getId(), request.getStartDateTime(), request.getEndDateTime(), null);
        if (hasReservationOverlap || hasEventOverlap) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cet espace est deja occupe sur ce creneau. Merci de choisir un autre horaire.");
        }

        LocalDateTime previousStart = reservation.getStartDateTime();
        LocalDateTime previousEnd = reservation.getEndDateTime();
        reservation.setStartDateTime(request.getStartDateTime());
        reservation.setEndDateTime(request.getEndDateTime());
        Reservation saved = reservationRepository.save(reservation);

        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_UPDATE, "Reservation", saved.getId(),
                String.format("Creneau modifie: %s - %s vers %s - %s",
                        previousStart, previousEnd, saved.getStartDateTime(), saved.getEndDateTime()),
                ipAddress);
        emailService.sendRoomReservationConfirmation(saved);
        notificationService.create(user, NotificationTone.INFO,
                "Créneau modifié",
                "Le nouveau créneau de " + saved.getEspace().getName() + " a été enregistré.",
                "/my-reservations?tab=spaces", "Reservation", saved.getId());
        return ReservationResponseDto.fromEntity(saved);
    }

    @GetMapping("/user/{userId}")
    public List<ReservationResponseDto> getByUser(@PathVariable Long userId, Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        User requester = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable"));

        if (!requester.getId().equals(userId) && requester.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces refuse");
        }

        List<Reservation> reservations = reservationRepository.findByUser(user);
        return reservations.stream()
                .map(ReservationResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @GetMapping("/check-availability")
    public boolean checkAvailability(
            @RequestParam Long espaceId,
            @RequestParam String startDateTime,
            @RequestParam String endDateTime
    ) {
        LocalDateTime start = LocalDateTime.parse(startDateTime);
        LocalDateTime end = LocalDateTime.parse(endDateTime);
        return !reservationRepository.existsOverlappingReservation(espaceId, start, end)
                && !eventRepository.existsOverlappingEventForSpace(espaceId, start, end, null);
    }

    @GetMapping("/espace/{espaceId}/calendar")
    public List<CalendarReservationDto> getReservationsForCalendar(
            @PathVariable Long espaceId,
            @RequestParam int year,
            @RequestParam int month
    ) {
        espaceRepository.findById(espaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable"));

        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDateTime startOfMonth = yearMonth.atDay(1).atStartOfDay();
        LocalDateTime endOfMonth = yearMonth.atEndOfMonth().atTime(23, 59, 59);

        List<Reservation> reservations = reservationRepository.findByEspaceAndPeriod(
                espaceId, startOfMonth, endOfMonth
        );

        List<CalendarReservationDto> blockedSlots = reservations.stream()
                .map(CalendarReservationDto::fromEntity)
                .collect(Collectors.toList());

        eventRepository.findBySpaceId(espaceId).stream()
                .filter(event -> event.getStatus() != EventStatus.CANCELLED && event.getStatus() != EventStatus.REJECTED)
                .filter(event -> event.getStartDateTime().isBefore(endOfMonth) && event.getEndDateTime().isAfter(startOfMonth))
                .map(CalendarReservationDto::fromEvent)
                .forEach(blockedSlots::add);

        return blockedSlots;
    }

    @DeleteMapping("/{id}/cancel")
    @Transactional
    public CancellationResponse cancelReservation(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        Reservation reservation = reservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas annuler cette reservation");
        }

        if (reservation.getStartDateTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La reservation est deja passee");
        }

        if (reservation.getStatus() == ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette reservation est deja annulee");
        }

        String oldStatus = reservation.getStatus().name();
        long paidAmountCents = reservation.getPaymentIntentId() == null ? 0L : Math.round(reservation.getTotalPrice() * 100D);
        CancellationPolicyService.CancellationDecision decision = cancellationPolicyService.decide(
                reservation.getStartDateTime(), paidAmountCents);
        if (decision.refundAmountCents() > 0 && reservation.getPaymentIntentId() != null) {
            paymentLifecycleService.refundBookingPayment(
                    reservation.getPaymentIntentId(), decision.refundAmountCents(), paidAmountCents,
                    user,
                    reservation.getEspace().getType() == EspaceType.PREMIUM_ROOM
                            ? PaymentType.PREMIUM_ROOM : PaymentType.SPACE,
                    reservation.getEspace().getId(), reservation.getId());
        }
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CANCEL, "Reservation", reservation.getId(),
                String.format("Annulation reservation espace: %s", reservation.getEspace().getName()),
                oldStatus, "CANCELLED", ipAddress);
        notificationService.create(user, NotificationTone.WARNING,
                "Réservation annulée",
                "La réservation de " + reservation.getEspace().getName() + " a été annulée.",
                "/my-reservations?tab=spaces", "Reservation", reservation.getId());
        return new CancellationResponse(
                "CANCELLED",
                decision.refundAmountCents(),
                decision.refundPercent(),
                decision.explanation()
        );
    }

    private User requireCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}

