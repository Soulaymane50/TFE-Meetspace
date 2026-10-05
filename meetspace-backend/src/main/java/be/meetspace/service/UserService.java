package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.LocalDateTime;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final AuditService auditService;
    private final PaymentLifecycleService payments;
    private final CancellationPolicyService cancellationPolicy;
    private final ParkingCapacityService parkingCapacity;
    private final ParkingAccessService parkingAccess;
    private final EventWaitlistService waitlist;
    private final EventRepository events;

    public UserService(UserRepository userRepository,
                       ReservationRepository reservationRepository,
                       EventRegistrationRepository eventRegistrationRepository,
                       ParkingReservationRepository parkingReservationRepository,
                       AuditService auditService,
                       PaymentLifecycleService payments,
                       CancellationPolicyService cancellationPolicy,
                       ParkingCapacityService parkingCapacity,
                       ParkingAccessService parkingAccess,
                       EventWaitlistService waitlist,
                       EventRepository events) {
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.auditService = auditService;
        this.payments = payments;
        this.cancellationPolicy = cancellationPolicy;
        this.parkingCapacity = parkingCapacity;
        this.parkingAccess = parkingAccess;
        this.waitlist = waitlist;
        this.events = events;
    }

    /**
     * Cancels future reservations with the normal refund rules, preserving past activity.
     * This includes space reservations, event registrations, and parking reservations.
     */
    @Transactional
    public void cancelAllUserReservations(User user) {
        LocalDateTime now = LocalDateTime.now();
        // Cancel space reservations
        List<Reservation> spaceReservations = reservationRepository.findByUser(user);
        List<EventRegistration> eventRegistrations = eventRegistrationRepository.findByUserId(user.getId());
        List<ParkingReservation> parkingReservations = parkingReservationRepository.findByUserId(user.getId());
        if (spaceReservations.isEmpty() && eventRegistrations.isEmpty() && parkingReservations.isEmpty()) return;
        parkingCapacity.lockInventory();
        for (Reservation candidate : spaceReservations) {
            Reservation reservation = reservationRepository.findByIdForUpdate(candidate.getId()).orElseThrow();
            if (reservation.getStartDateTime().isAfter(now)
                    && reservation.getStatus() != ReservationStatus.CANCELLED
                    && reservation.getStatus() != ReservationStatus.REJECTED) {
                refund(user, reservation.getPaymentIntentId(), reservation.getStartDateTime(),
                        cents(reservation.getTotalPrice()),
                        reservation.getEspace().getType() == EspaceType.PREMIUM_ROOM ? PaymentType.PREMIUM_ROOM : PaymentType.SPACE,
                        reservation.getEspace().getId(), reservation.getId());
                reservation.setStatus(ReservationStatus.CANCELLED);
                reservationRepository.save(reservation);
            }
        }

        // Cancel event registrations
        for (EventRegistration candidate : eventRegistrations) {
            Event event = events.findByIdForUpdate(candidate.getEvent().getId()).orElseThrow();
            EventRegistration registration = eventRegistrationRepository.findByIdForUpdate(candidate.getId()).orElseThrow();
            if (event.getStartDateTime().isAfter(now) && registration.getStatus() != EventRegistrationStatus.CANCELLED) {
                ParkingReservation linked = parkingReservationRepository.findByEventRegistrationId(registration.getId()).orElse(null);
                long amount = cents(registration.getTotalPrice())
                        + (linked != null && linked.getStatus() != ParkingReservationStatus.CANCELLED ? cents(linked.getTotalPrice()) : 0);
                refund(user, registration.getPaymentIntentId(), event.getStartDateTime(), amount,
                        PaymentType.EVENT, event.getId(), registration.getId());
                registration.setStatus(EventRegistrationStatus.CANCELLED);
                eventRegistrationRepository.save(registration);
                if (linked != null && linked.getStatus() != ParkingReservationStatus.CANCELLED) {
                    linked.setStatus(ParkingReservationStatus.CANCELLED);
                    parkingReservationRepository.save(linked);
                    parkingAccess.cancelPasses(linked);
                }
                waitlist.offerAvailablePlaces(event);
            }
        }

        // Cancel parking reservations
        for (ParkingReservation candidate : parkingReservations) {
            ParkingReservation reservation = parkingReservationRepository.findByIdForUpdate(candidate.getId()).orElseThrow();
            LocalDateTime start = LocalDateTime.of(reservation.getParkingSlot().getSessionDate(), reservation.getParkingSlot().getStartTime());
            if (start.isAfter(now) && reservation.getStatus() != ParkingReservationStatus.CANCELLED) {
                refund(user, reservation.getPaymentIntentId(), start, cents(reservation.getTotalPrice()),
                        PaymentType.PARKING, reservation.getParkingSlot().getId(), reservation.getId());
                reservation.setStatus(ParkingReservationStatus.CANCELLED);
                parkingReservationRepository.save(reservation);
                parkingAccess.cancelPasses(reservation);
            }
        }
    }

    private static long cents(Double amount) { return Math.round((amount == null ? 0D : amount) * 100D); }

    private void refund(User user, String paymentId, LocalDateTime start, long amount, PaymentType type, Long resourceId, Long bookingId) {
        if (paymentId == null || amount <= 0) return;
        var decision = cancellationPolicy.decide(start, amount);
        if (decision.refundAmountCents() > 0) {
            payments.refundBookingPayment(paymentId, decision.refundAmountCents(), amount, user, type, resourceId, bookingId);
        }
    }

    /**
     * Deactivates a user account (soft delete).
     * The user data and existing reservations are preserved for historical
     * reporting, but the account cannot be used anymore.
     */
    @Transactional
    public User deactivateAccount(User user, String ipAddress, boolean isSelfDelete) {
        UserStatus oldStatus = user.getStatus();
        user.setStatus(UserStatus.DELETED);
        user.incrementTokenVersion();
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetExpiresAt(null);
        user.setAccountDeletionTokenHash(null);
        user.setAccountDeletionExpiresAt(null);
        user.setEmailChangeTokenHash(null);
        user.setEmailChangeExpiresAt(null);
        user.setPendingEmail(null);

        User saved = userRepository.save(user);

        // Audit log
        String details = isSelfDelete
            ? "Suppression de compte par l'utilisateur: " + user.getEmail()
            : "Compte supprimé par un administrateur: " + user.getEmail();
        auditService.log(AuditAction.USER_DELETE, "USER", user.getId(), details,
                oldStatus.name(), UserStatus.DELETED.name(), ipAddress);

        return saved;
    }

    /**
     * Bans a user account.
     * The user data is preserved for historical purposes, but the account cannot be used.
     */
    @Transactional
    public User banUser(User user, String ipAddress) {
        UserStatus oldStatus = user.getStatus();
        user.setStatus(UserStatus.BANNED);
        user.incrementTokenVersion();
        userRepository.save(user);

        // Cancel all reservations
        cancelAllUserReservations(user);

        User saved = userRepository.save(user);

        // Audit log
        String details = "Utilisateur banni: " + user.getEmail();
        auditService.log(AuditAction.USER_STATUS_CHANGE, "USER", user.getId(), details,
                oldStatus.name(), UserStatus.BANNED.name(), ipAddress);

        return saved;
    }

    /**
     * Reactivates a banned or deleted user account.
     */
    @Transactional
    public User reactivateUser(User user, String ipAddress) {
        UserStatus oldStatus = user.getStatus();
        user.setStatus(UserStatus.ACTIVE);
        user.incrementTokenVersion();

        User saved = userRepository.save(user);

        // Audit log
        String details = "Utilisateur réactivé: " + user.getEmail();
        auditService.log(AuditAction.USER_STATUS_CHANGE, "USER", user.getId(), details,
                oldStatus.name(), UserStatus.ACTIVE.name(), ipAddress);

        return saved;
    }
}

