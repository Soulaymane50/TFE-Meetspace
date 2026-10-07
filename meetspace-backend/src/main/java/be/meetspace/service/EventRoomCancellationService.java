package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EventRoomCancellationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;

@Service
public class EventRoomCancellationService {
    private final EventRoomCancellationRepository journal;
    private final PaymentLifecycleService payments;
    private final CancellationPolicyService policy;
    private final NotificationService notifications;
    private final TransactionTemplate independent;

    public EventRoomCancellationService(EventRoomCancellationRepository journal, PaymentLifecycleService payments,
            CancellationPolicyService policy, NotificationService notifications, PlatformTransactionManager manager) {
        this.journal = journal; this.payments = payments; this.policy = policy; this.notifications = notifications;
        independent = new TransactionTemplate(manager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // Caller holds inventory and event locks, and has checked parking holds before external effects.
    public void refundRoom(Event event, boolean byProvider) {
        if (event.getStatus() != EventStatus.CANCELLED || event.getId() == null) return;
        long deposit = event.getDepositPaidAt() == null ? 0L : safe(event.getDepositAmountCents());
        long balance = event.getBalancePaidAt() == null ? 0L : safe(event.getBalanceDueCents());
        if (deposit + balance == 0L) return;
        if (event.getCreatedBy() == null || (deposit > 0 && !StringUtils.hasText(event.getDepositPaymentIntentId()))
                || (balance > 0 && !StringUtils.hasText(event.getBalancePaymentIntentId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Le paiement historique de la location doit être régularisé avant l'annulation.");
        }
        EventRoomCancellation terms = independent.execute(tx -> journal.findById(event.getId()).orElseGet(() -> {
            EventRoomCancellation decision = new EventRoomCancellation();
            decision.setEventId(event.getId()); decision.setByProvider(byProvider);
            decision.setRefundPercent(byProvider ? 100 : policy.decide(event.getStartDateTime(), deposit + balance).refundPercent());
            decision.setRequestedAt(LocalDateTime.now());
            return journal.saveAndFlush(decision);
        }));
        if (terms.getRefundPercent() == 0) return;
        long depositTarget = Math.round(deposit * terms.getRefundPercent() / 100D);
        long balanceTarget = Math.round((deposit + balance) * terms.getRefundPercent() / 100D) - depositTarget;
        long refundedNow = 0;
        boolean pending = false;
        if (deposit > 0) {
            var result = refund(event, event.getDepositPaymentIntentId(), deposit, depositTarget, PaymentType.EVENT_DEPOSIT, terms);
            refundedNow += result.refundedNowCents(); pending |= result.status() == PaymentStatus.REFUND_PENDING;
        }
        if (balance > 0) {
            var result = refund(event, event.getBalancePaymentIntentId(), balance, balanceTarget, PaymentType.EVENT_BALANCE, terms);
            refundedNow += result.refundedNowCents(); pending |= result.status() == PaymentStatus.REFUND_PENDING;
        }
        if (refundedNow > 0 || pending) {
            notifications.create(event.getCreatedBy(), NotificationTone.WARNING, "Annulation de la location",
                    "La location de « " + event.getTitle() + " » est annulée. Remboursement de "
                            + terms.getRefundPercent() + " % des montants payés : "
                            + (pending ? "en cours de traitement." : "confirmé."),
                    "/organizer/events", "Event", event.getId());
        }
    }

    private PaymentLifecycleService.RefundResult refund(Event event, String intent, long paid, long target,
            PaymentType type, EventRoomCancellation terms) {
        if (terms.isByProvider()) return payments.refundFullBookingPayment(intent, paid, event.getCreatedBy(), type, event.getId(), event.getId());
        return payments.refundRoomBookingToTarget(intent, target, paid, event.getCreatedBy(), type, event.getId());
    }
    private long safe(Long value) { return value == null ? 0L : Math.max(0L, value); }
}
