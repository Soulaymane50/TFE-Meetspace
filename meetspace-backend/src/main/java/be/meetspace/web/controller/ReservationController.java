package be.meetspace.web.controller;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.CalendarReservationDto;
import be.meetspace.web.dto.CreateReservationRequest;
import be.meetspace.web.dto.PayReservationRequest;
import be.meetspace.web.dto.PremiumRoomReservationRequest;
import be.meetspace.web.dto.ReservationResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    private final PaymentVerifier paymentVerifier;
    private final AuditService auditService;

    public ReservationController(ReservationRepository reservationRepository,
                                 UserRepository userRepository,
                                 EspaceRepository espaceRepository,
                                 EventRepository eventRepository,
                                 PaymentVerifier paymentVerifier,
                                 AuditService auditService) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.espaceRepository = espaceRepository;
        this.eventRepository = eventRepository;
        this.paymentVerifier = paymentVerifier;
        this.auditService = auditService;
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
    public ReservationResponseDto create(
            @Valid @RequestBody CreateReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        Espace espace = espaceRepository.findById(request.getEspaceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable"));

        if (espace.getType() == EspaceType.PREMIUM_ROOM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Les salles premium doivent etre reservees via l'endpoint /premium-room");
        }

        paymentVerifier.verifyPayment(request.getPaymentIntentId());

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        if (espace.getStatus() != EspaceStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Espace non disponible");
        }

        validateRoomWindow(request.getEspaceId(), request.getStartDateTime(), request.getEndDateTime());

        Reservation reservation = new Reservation();
        reservation.setUser(user);
        reservation.setEspace(espace);
        reservation.setStartDateTime(request.getStartDateTime());
        reservation.setEndDateTime(request.getEndDateTime());
        reservation.setTotalPrice(request.getTotalPrice());
        reservation.setPaymentIntentId(request.getPaymentIntentId());
        reservation.setStatus(ReservationStatus.CONFIRMED);

        Reservation saved = reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CREATE, "Reservation", saved.getId(),
                String.format("Reservation creee pour l'espace: %s (ID: %d)", espace.getName(), espace.getId()),
                ipAddress);

        return ReservationResponseDto.fromEntity(saved);
    }

    @PostMapping("/premium-room")
    public ReservationResponseDto requestPremiumRoomReservation(
            @Valid @RequestBody PremiumRoomReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        Espace espace = espaceRepository.findById(request.getEspaceId())
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

        Reservation reservation = new Reservation();
        reservation.setUser(user);
        reservation.setEspace(espace);
        reservation.setStartDateTime(request.getStartDateTime());
        reservation.setEndDateTime(request.getEndDateTime());
        reservation.setTotalPrice(request.getTotalPrice());
        reservation.setJustification(request.getJustification());
        reservation.setStatus(ReservationStatus.PENDING_APPROVAL);

        Reservation saved = reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CREATE, "Reservation", saved.getId(),
                String.format("Demande de reservation salle premium: %s (ID: %d) - En attente d'approbation",
                        espace.getName(), espace.getId()),
                ipAddress);

        return ReservationResponseDto.fromEntity(saved);
    }

    @PostMapping("/{id}/pay")
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

        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas payer cette reservation");
        }

        if (reservation.getStatus() != ReservationStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cette reservation n'est pas en attente de paiement. Statut actuel: " + reservation.getStatus());
        }

        paymentVerifier.verifyPayment(request.getPaymentIntentId());

        reservation.setPaymentIntentId(request.getPaymentIntentId());
        reservation.setStatus(ReservationStatus.CONFIRMED);

        Reservation saved = reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_UPDATE, "Reservation", saved.getId(),
                String.format("Paiement effectue pour reservation salle premium: %s", saved.getEspace().getName()),
                "APPROVED", "CONFIRMED", ipAddress);

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
    public void cancelReservation(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        Reservation reservation = reservationRepository.findById(id)
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
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.RESERVATION_CANCEL, "Reservation", reservation.getId(),
                String.format("Annulation reservation espace: %s", reservation.getEspace().getName()),
                oldStatus, "CANCELLED", ipAddress);
    }
}

