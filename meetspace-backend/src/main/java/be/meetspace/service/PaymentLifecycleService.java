package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.PaymentRecordRepository;
import be.meetspace.repository.PaymentRefundRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class PaymentLifecycleService {
    private static final Logger log = LoggerFactory.getLogger(PaymentLifecycleService.class);
    private final PaymentRecordRepository paymentRepository;
    private final BookingHoldService holdService;
    private final PaymentVerifier paymentVerifier;
    private final PaymentRefundRepository refundRepository;
    private final TransactionTemplate independent;

    public PaymentLifecycleService(PaymentRecordRepository paymentRepository,
                                   BookingHoldService holdService, PaymentVerifier paymentVerifier,
                                   PaymentRefundRepository refundRepository,
                                   PlatformTransactionManager transactionManager) {
        this.paymentRepository = paymentRepository;
        this.holdService = holdService;
        this.paymentVerifier = paymentVerifier;
        this.refundRepository = refundRepository;
        independent = new TransactionTemplate(transactionManager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional
    public PaymentRecord registerIntent(String paymentIntentId, User user,
                                        PaymentQuoteService.PaymentQuote quote, BookingHold hold,
                                        PaymentStatus initialStatus) {
        if (paymentRepository.findByPaymentIntentId(paymentIntentId).isPresent()) {
            throw conflict("Ce paiement est deja enregistre.");
        }
        PaymentRecord record = new PaymentRecord();
        record.setPaymentIntentId(paymentIntentId);
        record.setUser(user);
        record.setType(quote.type());
        record.setAmountCents(quote.amountCents());
        record.setCurrency(quote.currency());
        record.setResourceId(quote.resourceId());
        record.setBookingHold(hold);
        record.setStatus(initialStatus);
        return paymentRepository.save(record);
    }

    @Transactional
    public String createLocalPayment(User user, PaymentQuoteService.PaymentQuote quote, BookingHold hold) {
        if (!paymentVerifier.isFakePaymentAllowed()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Le paiement local est desactive.");
        }
        String paymentIntentId = "test_" + quote.type().name().toLowerCase(Locale.ROOT) + "_" + UUID.randomUUID();
        registerIntent(paymentIntentId, user, quote, hold, PaymentStatus.SUCCEEDED);
        return paymentIntentId;
    }

    @Transactional
    public PaymentRecord consume(String paymentIntentId, User user, PaymentType expectedType,
                                 long expectedAmountCents, Long expectedResourceId) {
        PaymentRecord record = lockedPayment(paymentIntentId);
        if (!record.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce paiement appartient a un autre compte.");
        }
        if (record.getType() != expectedType || record.getAmountCents() != expectedAmountCents
                || !Objects.equals(record.getResourceId(), expectedResourceId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce paiement ne correspond pas a la reservation.");
        }
        // A durable refund request also blocks reuse after the booking transaction rolled back.
        if (record.getConsumedAt() != null || record.getBookingEntityId() != null
                || record.getStatus() == PaymentStatus.CONSUMED
                || record.getStatus() == PaymentStatus.REFUND_PENDING
                || record.getStatus() == PaymentStatus.REFUNDED
                || record.getStatus() == PaymentStatus.PARTIALLY_REFUNDED
                || !journal(paymentIntentId).isEmpty()) {
            throw conflict("Ce paiement a deja ete utilise ou fait l'objet d'un remboursement.");
        }
        var snapshot = paymentVerifier.inspectPayment(paymentIntentId);
        validatePayment(record, snapshot.amountCents(), snapshot.currency(), snapshot.metadata(), snapshot.fake());
        if (record.getBookingHold() == null) throw conflict("Le blocage temporaire est introuvable.");
        holdService.consume(record.getBookingHold().getToken(), user, expectedType, expectedAmountCents);
        record.setStatus(PaymentStatus.CONSUMED);
        record.setConsumedAt(LocalDateTime.now());
        // These callers settle an existing event and do not call bindToBooking.
        if (expectedType == PaymentType.EVENT_DEPOSIT || expectedType == PaymentType.EVENT_BALANCE) {
            record.setBookingEntityId(expectedResourceId);
        }
        return record;
    }

    @Transactional(readOnly = true)
    public PaymentVerifier.PaymentSnapshot verifyOwnedPayment(String paymentIntentId, User user) {
        PaymentRecord record = paymentRepository.findByPaymentIntentId(paymentIntentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paiement introuvable."));
        if (!record.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce paiement appartient a un autre compte.");
        }
        return paymentVerifier.inspectPayment(paymentIntentId);
    }

    @Transactional
    public void bindToBooking(String paymentIntentId, Long bookingEntityId) {
        PaymentRecord record = lockedPayment(paymentIntentId);
        if (bookingEntityId == null || record.getStatus() != PaymentStatus.CONSUMED
                || (record.getBookingEntityId() != null && !record.getBookingEntityId().equals(bookingEntityId))) {
            throw conflict("Ce paiement ne peut pas etre lie a cette reservation.");
        }
        record.setBookingEntityId(bookingEntityId);
    }

    @Transactional
    public RefundResult refund(String paymentIntentId, long requestedAmountCents) {
        return refund(paymentIntentId, requestedAmountCents, "booking-cancellation");
    }

    /** The operation name is stable across retries; the original amount is immutable. */
    @Transactional
    public RefundResult refund(String paymentIntentId, long requestedAmountCents, String operation) {
        if (paymentIntentId == null || paymentIntentId.isBlank() || requestedAmountCents <= 0) {
            return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        }
        return requestRefund(lockedPayment(paymentIntentId), requestedAmountCents, operation);
    }

    private RefundResult requestRefund(PaymentRecord record, long requested, String operation) {
        syncProviderRefunds(record);
        String key = PaymentVerifier.operationKey(record.getPaymentIntentId(), operation);
        PaymentRefund request = independent.execute(tx -> {
            var existing = refundRepository.findByOperationKey(key);
            if (existing.isPresent()) return existing.get();
            List<PaymentRefund> all = refundRepository.findByPaymentIntentId(record.getPaymentIntentId());
            long reserved = all.stream().filter(r -> !isFullTarget(r) && !"failed".equals(r.getStatus()) && !"canceled".equals(r.getStatus()))
                    .mapToLong(PaymentRefund::getAmountCents).sum();
            long amount = Math.min(requested, Math.max(0L, record.getAmountCents() - reserved));
            if (amount == 0) return null;
            PaymentRefund refund = new PaymentRefund();
            refund.setOperationKey(key);
            refund.setPaymentIntentId(record.getPaymentIntentId());
            refund.setAmountCents(amount);
            refund.setCurrency(record.getCurrency());
            return refundRepository.saveAndFlush(refund);
        });
        if (request == null) {
            applyRefundTotals(record);
            return new RefundResult(0L, record.getRefundedAmountCents(), record.getStatus());
        }
        long before = record.getRefundedAmountCents();
        submitOrRecover(record, request);
        applyRefundTotals(record);
        return new RefundResult(Math.max(0L, record.getRefundedAmountCents() - before),
                record.getRefundedAmountCents(), record.getStatus());
    }

    private void submitOrRecover(PaymentRecord record, PaymentRefund request) {
        if (request.getStripeRefundId() != null) {
            if (!record.getPaymentIntentId().startsWith("test_")) {
                persistSnapshot(record, paymentVerifier.inspectRefund(request.getStripeRefundId()));
            }
            return;
        }
        if (!"requested".equals(request.getStatus()) && !"unknown".equals(request.getStatus())) return;
        // Stripe may forget keys after 24 h. Never submit an ambiguous operation outside that window.
        if (request.getFirstAttemptAt() != null
                && request.getFirstAttemptAt().isBefore(LocalDateTime.now().minusHours(23))) return;
        independent.executeWithoutResult(tx -> {
            PaymentRefund saved = refundRepository.findByOperationKey(request.getOperationKey()).orElseThrow();
            if (saved.getFirstAttemptAt() == null) saved.setFirstAttemptAt(LocalDateTime.now());
            saved.setStatus("unknown");
        });
        var snapshot = paymentVerifier.refund(record.getPaymentIntentId(),
                request.getAmountCents(), request.getOperationKey());
        persistSnapshot(record, snapshot);
    }

    @Transactional
    public RefundResult refundBookingPayment(String paymentIntentId, long requestedAmountCents,
                                              long paidAmountCents, User user, PaymentType type,
                                              Long resourceId, Long bookingEntityId) {
        if (paymentIntentId == null || paymentIntentId.isBlank() || requestedAmountCents <= 0) {
            return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        }
        return requestRefund(bookingPayment(paymentIntentId, requestedAmountCents, paidAmountCents,
                user, type, resourceId, bookingEntityId), requestedAmountCents, "booking-cancellation");
    }

    /** Room cancellation refunds a target total, not an additional amount after earlier refunds. */
    @Transactional
    public RefundResult refundRoomBookingToTarget(String paymentIntentId, long targetCents, long paidAmountCents,
            User user, PaymentType type, Long eventId) {
        if (targetCents <= 0) return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        if (targetCents > paidAmountCents) throw conflict("Le remboursement dépasse la location payée.");
        PaymentRecord record = bookingPayment(paymentIntentId, targetCents, paidAmountCents, user, type, eventId, eventId);
        syncProviderRefunds(record);
        String operation = "room-cancellation";
        String key = PaymentVerifier.operationKey(paymentIntentId, operation);
        List<PaymentRefund> journal = journal(paymentIntentId);
        var existing = journal.stream().filter(r -> key.equals(r.getOperationKey())).findFirst();
        if (existing.isPresent()) return requestRefund(record, existing.get().getAmountCents(), operation);
        long covered = journal.stream().filter(r -> !isFullTarget(r)
                && !"failed".equals(r.getStatus()) && !"canceled".equals(r.getStatus()))
                .mapToLong(PaymentRefund::getAmountCents).sum();
        long remaining = Math.max(0L, targetCents - covered);
        if (remaining == 0L) return new RefundResult(0L, record.getRefundedAmountCents(), record.getStatus());
        return requestRefund(record, remaining, operation);
    }

    private PaymentRecord bookingPayment(String paymentIntentId, long requestedAmountCents,
                                         long paidAmountCents, User user, PaymentType type,
                                         Long resourceId, Long bookingEntityId) {
        var current = paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId);
        if (current.isEmpty()) {
            var snapshot = paymentVerifier.inspectPayment(paymentIntentId);
            if (!snapshot.fake() && (snapshot.amountCents() != paidAmountCents
                    || snapshot.amountCents() < requestedAmountCents)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paiement historique ne couvre pas le remboursement.");
            }
            PaymentRecord legacy = new PaymentRecord();
            legacy.setPaymentIntentId(paymentIntentId);
            legacy.setUser(user);
            legacy.setType(type);
            legacy.setAmountCents(paidAmountCents);
            legacy.setCurrency(snapshot.currency());
            legacy.setResourceId(resourceId);
            legacy.setBookingEntityId(bookingEntityId);
            legacy.setStatus(PaymentStatus.CONSUMED);
            legacy.setConsumedAt(LocalDateTime.now());
            current = Optional.of(paymentRepository.saveAndFlush(legacy));
        }
        PaymentRecord record = current.orElseThrow();
        if (!record.getUser().getId().equals(user.getId()) || record.getType() != type
                || !Objects.equals(record.getBookingEntityId(), bookingEntityId)
                || record.getAmountCents() != paidAmountCents) {
            throw conflict("Le paiement ne correspond pas a la reservation annulee.");
        }
        return record;
    }

    /**
     * Provider cancellation: target 100% of the original payment, regardless of
     * the customer's 50% cancellation policy. Existing confirmed/pending refunds
     * are deducted. A durable target survives the caller's transaction rollback.
     */
    @Transactional
    public RefundResult refundFullBookingPayment(String paymentIntentId, long paidAmountCents,
                                                 User user, PaymentType type, Long resourceId,
                                                 Long bookingEntityId) {
        if (paymentIntentId == null || paymentIntentId.isBlank() || paidAmountCents <= 0) {
            return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        }
        return requestFullRefund(bookingPayment(paymentIntentId, paidAmountCents, paidAmountCents,
                user, type, resourceId, bookingEntityId));
    }

    @Transactional
    public RefundResult refundFull(String paymentIntentId) {
        return requestFullRefund(lockedPayment(paymentIntentId));
    }

    private RefundResult requestFullRefund(PaymentRecord record) {
        String targetKey = PaymentVerifier.operationKey(record.getPaymentIntentId(), "full-refund-target");
        independent.executeWithoutResult(tx -> {
            if (refundRepository.findByOperationKey(targetKey).isEmpty()) {
                PaymentRefund target = new PaymentRefund();
                target.setOperationKey(targetKey);
                target.setPaymentIntentId(record.getPaymentIntentId());
                target.setAmountCents(record.getAmountCents());
                target.setCurrency(record.getCurrency());
                target.setStatus("full_requested");
                refundRepository.saveAndFlush(target);
            }
        });
        syncProviderRefunds(record);
        List<PaymentRefund> covered = journal(record.getPaymentIntentId()).stream()
                .filter(r -> !isFullTarget(r) && !"failed".equals(r.getStatus()) && !"canceled".equals(r.getStatus()))
                .toList();
        long remaining = Math.max(0L, record.getAmountCents()
                - covered.stream().mapToLong(PaymentRefund::getAmountCents).sum());
        if (remaining == 0) return new RefundResult(0L, record.getRefundedAmountCents(), record.getStatus());
        // Identify this remaining leg by the operations that already cover the target.
        // If a pending customer refund fails later, the changed coverage gets its own stable leg.
        String coverage = covered.stream().map(PaymentRefund::getOperationKey).sorted()
                .reduce("", (left, right) -> left + "|" + right);
        return requestRefund(record, remaining, "full-refund:" + coverage);
    }

    private boolean isFullTarget(PaymentRefund refund) {
        return refund.getStatus().startsWith("full_");
    }

    @Transactional
    public void markSucceededFromWebhook(String paymentIntentId) {
        paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId).ifPresent(this::reconcileLockedPayment);
    }

    @Transactional
    public void markFailedFromWebhook(String paymentIntentId) {
        // Notifications can arrive out of order. Fetch Stripe's current state before changing anything.
        paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId).ifPresent(this::reconcileLockedPayment);
    }

    @Transactional
    public void reconcileRefundFromWebhook(String refundId) {
        var snapshot = paymentVerifier.inspectRefund(refundId);
        if (snapshot.paymentIntentId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Paiement du remboursement introuvable.");
        }
        paymentRepository.findByPaymentIntentIdForUpdate(snapshot.paymentIntentId()).ifPresent(record -> {
            persistSnapshot(record, snapshot);
            syncProviderRefunds(record);
            applyRefundTotals(record);
            if (journal(record.getPaymentIntentId()).stream().anyMatch(this::isFullTarget)) {
                requestFullRefund(record);
            }
        });
    }

    /** Each payment is isolated: one provider outage must not roll back the whole cleanup. */
    public void reconcilePayments() {
        List<String> candidates = paymentRepository.findReconciliationCandidates(LocalDateTime.now());
        for (String intentId : candidates) {
            try {
                independent.executeWithoutResult(tx ->
                        paymentRepository.findByPaymentIntentIdForUpdate(intentId).ifPresent(this::reconcileLockedPayment));
            } catch (RuntimeException exception) {
                log.warn("Reconciliation paiement differee ({})", exception.getClass().getSimpleName());
            }
        }
    }

    private void reconcileLockedPayment(PaymentRecord record) {
        boolean orphan = record.getBookingEntityId() == null && record.getBookingHold() != null
                && (!record.getBookingHold().getExpiresAt().isAfter(LocalDateTime.now())
                    || record.getBookingHold().getStatus() == BookingHoldStatus.CANCELLED
                    || record.getBookingHold().getStatus() == BookingHoldStatus.EXPIRED);
        if (record.getConsumedAt() == null || orphan) {
            var state = paymentVerifier.inspectPaymentState(record.getPaymentIntentId());
            if ("succeeded".equals(state.status())) {
                validatePayment(record, state.amountCents(), state.currency(), state.metadata(), state.fake());
                if (record.getStatus() == PaymentStatus.PENDING || record.getStatus() == PaymentStatus.FAILED) {
                    record.setStatus(PaymentStatus.SUCCEEDED);
                }
            } else if ("canceled".equals(state.status()) || "requires_payment_method".equals(state.status())) {
                if (record.getStatus() == PaymentStatus.PENDING || record.getStatus() == PaymentStatus.FAILED) {
                    record.setStatus(PaymentStatus.FAILED);
                    holdService.cancel(record.getBookingHold());
                }
            } else {
                return;
            }
            if (!"succeeded".equals(state.status())) return;
        }
        syncProviderRefunds(record);
        for (PaymentRefund refund : journal(record.getPaymentIntentId())) {
            submitOrRecover(record, refund);
        }
        applyRefundTotals(record);
        if ((orphan || journal(record.getPaymentIntentId()).stream().anyMatch(this::isFullTarget))
                && record.getRefundedAmountCents() < record.getAmountCents()) {
            requestFullRefund(record);
        }
    }

    private void validatePayment(PaymentRecord record, long amount, String currency,
                                 Map<String, String> metadata, boolean fake) {
        if (!fake && (amount != record.getAmountCents() || !record.getCurrency().equalsIgnoreCase(currency)
                || !String.valueOf(record.getUser().getId()).equals(metadata.get("userId"))
                || !record.getType().name().equals(metadata.get("reservationType")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les informations Stripe ne correspondent pas au paiement.");
        }
    }

    private void syncProviderRefunds(PaymentRecord record) {
        for (var refund : paymentVerifier.listRefunds(record.getPaymentIntentId())) persistSnapshot(record, refund);
        applyRefundTotals(record);
    }

    private void persistSnapshot(PaymentRecord record, PaymentVerifier.RefundSnapshot snapshot) {
        if (snapshot.id() == null || !record.getPaymentIntentId().equals(snapshot.paymentIntentId())
                || snapshot.amountCents() <= 0 || snapshot.amountCents() > record.getAmountCents()
                || !record.getCurrency().equalsIgnoreCase(snapshot.currency())
                || !Set.of("pending", "requires_action", "succeeded", "failed", "canceled").contains(snapshot.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Remboursement Stripe incoherent.");
        }
        independent.executeWithoutResult(tx -> {
            var byId = refundRepository.findByStripeRefundId(snapshot.id());
            var byOperation = snapshot.operationKey() == null ? Optional.<PaymentRefund>empty()
                    : refundRepository.findByOperationKey(snapshot.operationKey());
            PaymentRefund saved = byId.orElseGet(() -> byOperation.orElseGet(() -> {
                PaymentRefund external = new PaymentRefund();
                external.setOperationKey(PaymentVerifier.operationKey(snapshot.paymentIntentId(), "external:" + snapshot.id()));
                external.setPaymentIntentId(snapshot.paymentIntentId());
                external.setAmountCents(snapshot.amountCents());
                external.setCurrency(snapshot.currency());
                return external;
            }));
            if (!saved.getPaymentIntentId().equals(snapshot.paymentIntentId())
                    || saved.getAmountCents() != snapshot.amountCents()
                    || !saved.getCurrency().equalsIgnoreCase(snapshot.currency())
                    || (saved.getStripeRefundId() != null && !saved.getStripeRefundId().equals(snapshot.id()))) {
                throw conflict("L'identite du remboursement ne correspond pas a l'operation.");
            }
            saved.setStripeRefundId(snapshot.id());
            saved.setStatus(snapshot.status());
            refundRepository.saveAndFlush(saved);
        });
    }

    private List<PaymentRefund> journal(String intentId) {
        // A fresh transaction also avoids stale repeatable-read snapshots after a durable write on MySQL.
        return independent.execute(tx -> refundRepository.findByPaymentIntentId(intentId));
    }

    private void applyRefundTotals(PaymentRecord record) {
        List<PaymentRefund> refunds = journal(record.getPaymentIntentId());
        long total = refunds.stream().filter(r -> "succeeded".equals(r.getStatus()))
                .mapToLong(PaymentRefund::getAmountCents).sum();
        boolean unresolved = refunds.stream().anyMatch(r -> !isFullTarget(r) && !"succeeded".equals(r.getStatus()))
                || (total < record.getAmountCents() && refunds.stream().anyMatch(this::isFullTarget));
        if (total > record.getAmountCents()) throw conflict("Le total des remboursements depasse le paiement.");
        record.setRefundedAmountCents(total);
        if (total > 0) record.setRefundedAt(LocalDateTime.now());
        if (total >= record.getAmountCents()) {
            record.setStatus(PaymentStatus.REFUNDED);
            independent.executeWithoutResult(tx -> refundRepository.findByPaymentIntentId(record.getPaymentIntentId())
                    .stream().filter(this::isFullTarget).forEach(r -> r.setStatus("full_succeeded")));
        }
        else if (unresolved) record.setStatus(PaymentStatus.REFUND_PENDING);
        else if (total > 0) record.setStatus(PaymentStatus.PARTIALLY_REFUNDED);
    }

    private PaymentRecord lockedPayment(String intentId) {
        return paymentRepository.findByPaymentIntentIdForUpdate(intentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paiement introuvable."));
    }
    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
    public record RefundResult(long refundedNowCents, long refundedTotalCents, PaymentStatus status) {}
}
