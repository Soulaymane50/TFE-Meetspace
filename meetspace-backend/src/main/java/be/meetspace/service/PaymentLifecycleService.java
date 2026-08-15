package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.PaymentRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
public class PaymentLifecycleService {

    private final PaymentRecordRepository paymentRepository;
    private final BookingHoldService holdService;
    private final PaymentVerifier paymentVerifier;

    public PaymentLifecycleService(PaymentRecordRepository paymentRepository,
                                   BookingHoldService holdService,
                                   PaymentVerifier paymentVerifier) {
        this.paymentRepository = paymentRepository;
        this.holdService = holdService;
        this.paymentVerifier = paymentVerifier;
    }

    @Transactional
    public PaymentRecord registerIntent(String paymentIntentId,
                                        User user,
                                        PaymentQuoteService.PaymentQuote quote,
                                        BookingHold hold,
                                        PaymentStatus initialStatus) {
        if (paymentRepository.findByPaymentIntentId(paymentIntentId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce paiement est deja enregistre.");
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
    public String createLocalPayment(User user,
                                     PaymentQuoteService.PaymentQuote quote,
                                     BookingHold hold) {
        if (!paymentVerifier.isFakePaymentAllowed()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Le paiement local est desactive.");
        }
        String paymentIntentId = "test_" + quote.type().name().toLowerCase(Locale.ROOT) + "_" + UUID.randomUUID();
        registerIntent(paymentIntentId, user, quote, hold, PaymentStatus.SUCCEEDED);
        return paymentIntentId;
    }

    @Transactional
    public PaymentRecord consume(String paymentIntentId,
                                 User user,
                                 PaymentType expectedType,
                                 long expectedAmountCents,
                                 Long expectedResourceId) {
        PaymentRecord record = paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Paiement inconnu. Relancez le paiement depuis MeetSpace."));
        if (!record.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce paiement appartient a un autre compte.");
        }
        if (record.getType() != expectedType
                || record.getAmountCents() != expectedAmountCents
                || !java.util.Objects.equals(record.getResourceId(), expectedResourceId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce paiement ne correspond pas a la reservation.");
        }
        if (record.getStatus() == PaymentStatus.CONSUMED
                || record.getStatus() == PaymentStatus.REFUNDED
                || record.getStatus() == PaymentStatus.PARTIALLY_REFUNDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce paiement a deja ete utilise.");
        }

        PaymentVerifier.PaymentSnapshot snapshot = paymentVerifier.inspectPayment(paymentIntentId);
        if (!snapshot.fake()) {
            if (snapshot.amountCents() != expectedAmountCents
                    || !record.getCurrency().equalsIgnoreCase(snapshot.currency())) {
                record.setStatus(PaymentStatus.FAILED);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le montant Stripe ne correspond pas a la reservation.");
            }
            String metadataUserId = snapshot.metadata().get("userId");
            String metadataType = snapshot.metadata().get("reservationType");
            if (metadataUserId == null || !metadataUserId.equals(String.valueOf(user.getId()))
                    || metadataType == null || !metadataType.equals(expectedType.name())) {
                record.setStatus(PaymentStatus.FAILED);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les informations Stripe sont invalides.");
            }
        }

        holdService.consume(record.getBookingHold().getToken(), user, expectedType, expectedAmountCents);
        record.setStatus(PaymentStatus.CONSUMED);
        record.setConsumedAt(LocalDateTime.now());
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
        PaymentRecord record = paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paiement introuvable."));
        record.setBookingEntityId(bookingEntityId);
    }

    @Transactional
    public RefundResult refund(String paymentIntentId, long requestedAmountCents) {
        if (paymentIntentId == null || paymentIntentId.isBlank() || requestedAmountCents <= 0) {
            return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        }
        PaymentRecord record = paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paiement introuvable pour remboursement."));
        long alreadyRefunded = record.getRefundedAmountCents() != null ? record.getRefundedAmountCents() : 0L;
        long refundable = Math.max(0L, record.getAmountCents() - alreadyRefunded);
        long amount = Math.min(requestedAmountCents, refundable);
        if (amount == 0L) {
            return new RefundResult(0L, alreadyRefunded, record.getStatus());
        }

        record.setStatus(PaymentStatus.REFUND_PENDING);
        paymentVerifier.refund(paymentIntentId, amount);
        long totalRefunded = alreadyRefunded + amount;
        record.setRefundedAmountCents(totalRefunded);
        record.setRefundedAt(LocalDateTime.now());
        record.setStatus(totalRefunded >= record.getAmountCents()
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED);
        return new RefundResult(amount, totalRefunded, record.getStatus());
    }

    @Transactional
    public RefundResult refundBookingPayment(String paymentIntentId,
                                              long requestedAmountCents,
                                              long paidAmountCents,
                                              User user,
                                              PaymentType type,
                                              Long resourceId,
                                              Long bookingEntityId) {
        if (paymentIntentId == null || paymentIntentId.isBlank() || requestedAmountCents <= 0) {
            return new RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        }

        if (paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId).isEmpty()) {
            PaymentVerifier.PaymentSnapshot snapshot = paymentVerifier.inspectPayment(paymentIntentId);
            if (!snapshot.fake() && snapshot.amountCents() < requestedAmountCents) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Le paiement historique ne couvre pas le remboursement demande.");
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
            paymentRepository.saveAndFlush(legacy);
        }
        return refund(paymentIntentId, requestedAmountCents);
    }

    @Transactional
    public void markSucceededFromWebhook(String paymentIntentId) {
        paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId).ifPresent(record -> {
            if (record.getStatus() == PaymentStatus.PENDING) {
                record.setStatus(PaymentStatus.SUCCEEDED);
            }
        });
    }

    @Transactional
    public void markFailedFromWebhook(String paymentIntentId) {
        paymentRepository.findByPaymentIntentIdForUpdate(paymentIntentId).ifPresent(record -> {
            if (record.getStatus() == PaymentStatus.PENDING || record.getStatus() == PaymentStatus.SUCCEEDED) {
                record.setStatus(PaymentStatus.FAILED);
                holdService.cancel(record.getBookingHold());
            }
        });
    }

    public record RefundResult(long refundedNowCents, long refundedTotalCents, PaymentStatus status) {}
}
