package be.meetspace.web.controller;

import be.meetspace.entity.*;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.EmailService;
import be.meetspace.service.PaymentLifecycleService;
import be.meetspace.service.CancellationPolicyService;
import be.meetspace.service.NotificationService;
import be.meetspace.service.ParkingAccessService;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.dto.CancellationResponse;
import be.meetspace.web.dto.ParkingReservationRequest;
import be.meetspace.web.dto.ParkingReservationResponseDto;
import be.meetspace.web.dto.ParkingSlotResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/public/parking")
public class ParkingController {

    private final ParkingSlotRepository sessionRepository;
    private final ParkingReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final PaymentLifecycleService paymentLifecycleService;
    private final CancellationPolicyService cancellationPolicyService;
    private final AuditService auditService;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final ParkingCapacityService parkingCapacityService;
    private final ParkingAccessService parkingAccessService;

    public ParkingController(ParkingSlotRepository sessionRepository,
                              ParkingReservationRepository reservationRepository,
                              UserRepository userRepository,
                              PaymentLifecycleService paymentLifecycleService,
                              CancellationPolicyService cancellationPolicyService,
                              AuditService auditService,
                              EmailService emailService,
                              NotificationService notificationService,
                              ParkingCapacityService parkingCapacityService,
                              ParkingAccessService parkingAccessService) {
        this.sessionRepository = sessionRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.paymentLifecycleService = paymentLifecycleService;
        this.cancellationPolicyService = cancellationPolicyService;
        this.auditService = auditService;
        this.emailService = emailService;
        this.notificationService = notificationService;
        this.parkingCapacityService = parkingCapacityService;
        this.parkingAccessService = parkingAccessService;
    }

    @GetMapping("/sessions")
    public List<ParkingSlotResponseDto> listOpenSessions() {
        List<ParkingSlot> sessions =
                sessionRepository.findByStatusAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
                        ParkingSlotStatus.OPEN,
                        LocalDate.now()
                );
        return sessions.stream()
                .filter(session -> !cancellationPolicyService.hasStarted(startsAt(session)))
                .map(s -> {
                    Integer registeredCount = reservationRepository.countReservedSpacesByParkingSlotId(s.getId());
                    ParkingCapacityService.CapacitySnapshot capacity = parkingCapacityService.snapshot(s);
                    return ParkingSlotResponseDto.fromEntity(s, registeredCount, capacity.allocatedSpaces(),
                            capacity.availableSpaces(), capacity.physicalCapacity(),
                            capacity.globalRemainingSpaces());
                })
                .toList();
    }

    @PostMapping("/reservations")
    @Transactional
    public ParkingReservationResponseDto createReservation(
            @Valid @RequestBody ParkingReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        ParkingSlot session = sessionRepository.findByIdForUpdate(request.getParkingSlotId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau parking introuvable"));

        if (session.getStatus() != ParkingSlotStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session non ouverte à la réservation");
        }

        LocalDateTime startsAt = startsAt(session);
        if (cancellationPolicyService.hasStarted(startsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce créneau parking a déjà commencé");
        }

        int reservedSpaces = request.getReservedSpaces();
        if (reservedSpaces <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de places invalide");
        }

        parkingCapacityService.lockAndAssertAvailable(session, reservedSpaces);

        double totalPrice = session.getParkingRate() * reservedSpaces;
        long totalAmountCents = Math.round(totalPrice * 100D);
        String paymentIntentId = request.getPaymentIntentId();
        if (totalAmountCents > 0) {
            if (paymentIntentId == null || paymentIntentId.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement requis pour ce créneau parking");
            }
            paymentLifecycleService.consume(
                    paymentIntentId,
                    user,
                    PaymentType.PARKING,
                    totalAmountCents,
                    session.getId()
            );
        } else {
            paymentIntentId = null;
        }

        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(user);
        reservation.setParkingSlot(session);
        reservation.setReservedSpaces(reservedSpaces);
        reservation.setTotalPrice(totalPrice);
        reservation.setPaymentIntentId(paymentIntentId);
        reservation.setStatus(ParkingReservationStatus.CONFIRMED);

        ParkingReservation saved = reservationRepository.save(reservation);
        if (paymentIntentId != null) {
            paymentLifecycleService.bindToBooking(paymentIntentId, saved.getId());
        }
        parkingAccessService.ensurePasses(saved);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_RESERVATION_CREATE, "ParkingReservation", saved.getId(),
                String.format("Réservation parking: %s (%d places)", session.getTitle(), reservedSpaces),
                ipAddress);

        emailService.sendParkingReservationConfirmation(saved);

        notificationService.create(user, NotificationTone.SUCCESS,
                "Parking confirmé",
                "Votre réservation parking pour " + session.getTitle() + " est confirmée.",
                "/receipts/parking/" + saved.getId(), "ParkingReservation", saved.getId());
        return ParkingReservationResponseDto.fromEntity(saved);
    }

    @GetMapping("/reservations/me")
    @Transactional
    public List<ParkingReservationResponseDto> listMyReservations(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        List<ParkingReservation> reservations =
                reservationRepository.findByUserId(user.getId());

        return reservations.stream()
                .peek(parkingAccessService::ensurePasses)
                .map(ParkingReservationResponseDto::fromEntity)
                .toList();
    }

    @DeleteMapping("/reservations/{id}/cancel")
    @Transactional
    public CancellationResponse cancelReservation(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        ParkingReservation reservation = reservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Réservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas annuler cette réservation");
        }

        if (reservation.getStatus() == ParkingReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette réservation est déjà annulée");
        }

        LocalDateTime startsAt = startsAt(reservation.getParkingSlot());
        if (cancellationPolicyService.hasStarted(startsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce créneau parking a déjà commencé");
        }

        String oldStatus = reservation.getStatus().name();
        long paidAmountCents = Math.round((reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0D) * 100D);
        CancellationPolicyService.CancellationDecision decision = cancellationPolicyService.decide(startsAt, paidAmountCents);
        if (decision.refundAmountCents() > 0 && reservation.getPaymentIntentId() != null) {
            paymentLifecycleService.refundBookingPayment(
                    reservation.getPaymentIntentId(), decision.refundAmountCents(), paidAmountCents,
                    user, PaymentType.PARKING, reservation.getParkingSlot().getId(), reservation.getId());
        }
        reservation.setStatus(ParkingReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        // Audit log
        parkingAccessService.cancelPasses(reservation);
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_RESERVATION_CANCEL, "ParkingReservation", reservation.getId(),
                String.format("Annulation réservation parking: %s", reservation.getParkingSlot().getTitle()),
                oldStatus, "CANCELLED", ipAddress);
        notificationService.create(user, NotificationTone.WARNING,
                "Parking annulé",
                "Votre réservation parking pour " + reservation.getParkingSlot().getTitle() + " a été annulée.",
                "/my-reservations?tab=parking", "ParkingReservation", reservation.getId());
        return new CancellationResponse(
                "CANCELLED",
                decision.refundAmountCents(),
                decision.refundPercent(),
                decision.explanation()
        );
    }

    private static LocalDateTime startsAt(ParkingSlot session) {
        return LocalDateTime.of(session.getSessionDate(), session.getStartTime());
    }
}

