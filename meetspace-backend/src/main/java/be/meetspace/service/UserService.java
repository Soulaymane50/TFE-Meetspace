package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final AuditService auditService;

    public UserService(UserRepository userRepository,
                       ReservationRepository reservationRepository,
                       EventRegistrationRepository eventRegistrationRepository,
                       ParkingReservationRepository parkingReservationRepository,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.auditService = auditService;
    }

    /**
     * Cancels all active reservations for a user.
     * This includes space reservations, event registrations, and parking reservations.
     */
    @Transactional
    public void cancelAllUserReservations(User user) {
        // Cancel space reservations
        List<Reservation> spaceReservations = reservationRepository.findByUser(user);
        for (Reservation reservation : spaceReservations) {
            if (reservation.getStatus() != ReservationStatus.CANCELLED) {
                reservation.setStatus(ReservationStatus.CANCELLED);
                reservationRepository.save(reservation);
            }
        }

        // Cancel event registrations
        List<EventRegistration> eventRegistrations = eventRegistrationRepository.findByUserId(user.getId());
        for (EventRegistration registration : eventRegistrations) {
            if (registration.getStatus() != EventRegistrationStatus.CANCELLED) {
                registration.setStatus(EventRegistrationStatus.CANCELLED);
                eventRegistrationRepository.save(registration);
            }
        }

        // Cancel parking reservations
        List<ParkingReservation> parkingReservations = parkingReservationRepository.findByUserId(user.getId());
        for (ParkingReservation reservation : parkingReservations) {
            if (reservation.getStatus() != ParkingReservationStatus.CANCELLED) {
                reservation.setStatus(ParkingReservationStatus.CANCELLED);
                parkingReservationRepository.save(reservation);
            }
        }
    }

    /**
     * Deactivates a user account (soft delete).
     * The user data is preserved for historical purposes, but the account cannot be used.
     */
    @Transactional
    public User deactivateAccount(User user, String ipAddress, boolean isSelfDelete) {
        UserStatus oldStatus = user.getStatus();
        user.setStatus(UserStatus.DELETED);

        // Cancel all reservations
        cancelAllUserReservations(user);

        User saved = userRepository.save(user);

        // Audit log
        String details = isSelfDelete
            ? "Suppression de compte par l'utilisateur: " + user.getEmail()
            : "Compte supprimÃƒÂ© par un administrateur: " + user.getEmail();
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

        User saved = userRepository.save(user);

        // Audit log
        String details = "Utilisateur rÃƒÂ©activÃƒÂ©: " + user.getEmail();
        auditService.log(AuditAction.USER_STATUS_CHANGE, "USER", user.getId(), details,
                oldStatus.name(), UserStatus.ACTIVE.name(), ipAddress);

        return saved;
    }
}

