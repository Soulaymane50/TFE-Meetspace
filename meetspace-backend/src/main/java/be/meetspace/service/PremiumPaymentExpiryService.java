package be.meetspace.service;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.repository.ReservationRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class PremiumPaymentExpiryService {

    private final ReservationRepository reservationRepository;
    private final AuditService auditService;

    public PremiumPaymentExpiryService(ReservationRepository reservationRepository, AuditService auditService) {
        this.reservationRepository = reservationRepository;
        this.auditService = auditService;
    }

    @Scheduled(fixedDelayString = "${app.payments.premium-expiry-check-ms:300000}")
    @Transactional
    public void expireUnpaidApprovals() {
        LocalDateTime now = LocalDateTime.now();
        reservationRepository.findExpiredPendingReservations(now).forEach(reservation -> {
            reservation.setStatus(ReservationStatus.CANCELLED);
            reservation.setRejectionReason("Delai approbation expire : le creneau a commence");
            reservation.setPaymentDueAt(null);
            auditService.log(AuditAction.RESERVATION_CANCEL, "Reservation", reservation.getId(),
                    "Annulation automatique : demande non approuvee avant le debut du creneau", "system");
        });
        reservationRepository.findExpiredApprovedReservations(now, now.minusHours(48)).forEach(reservation -> {
            if (!reservation.isApprovalPaymentExpired(now)) return;
            reservation.setStatus(ReservationStatus.CANCELLED);
            reservation.setRejectionReason("Delai de paiement expire");
            reservation.setPaymentDueAt(null);
            auditService.log(AuditAction.RESERVATION_CANCEL, "Reservation", reservation.getId(),
                    "Annulation automatique: delai de paiement premium expire", "system");
        });
    }
}
