package be.meetspace.config;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.RefundListParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class PaymentVerifier {
    @Value("${app.testing.allowFakePayments:false}")
    private boolean allowFakePayments;
    private final Environment environment;
    public PaymentVerifier(Environment environment) { this.environment = environment; }

    public void verifyPayment(String paymentIntentId) { inspectPayment(paymentIntentId); }

    public PaymentSnapshot inspectPayment(String paymentIntentId) {
        PaymentStateSnapshot state = inspectPaymentState(paymentIntentId);
        if (!"succeeded".equals(state.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement non valide");
        }
        return new PaymentSnapshot(state.amountCents(), state.currency(), state.metadata(), state.fake());
    }

    public PaymentStateSnapshot inspectPaymentState(String paymentIntentId) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement manquant");
        }
        if (paymentIntentId.startsWith("test_")) {
            if (isFakePaymentAllowed()) {
                return new PaymentStateSnapshot("succeeded", -1L, "eur", Map.of(), true);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement de test non autorise");
        }
        try {
            PaymentIntent intent = PaymentIntent.retrieve(paymentIntentId);
            return new PaymentStateSnapshot(intent.getStatus(), intent.getAmount(), intent.getCurrency(),
                    intent.getMetadata() != null ? intent.getMetadata() : Map.of(), false);
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Verification Stripe indisponible", e);
        }
    }

    /** Compatible entry point; callers needing confirmation use the snapshot overload. */
    public void refund(String paymentIntentId, long amountCents) {
        if (amountCents > 0) refund(paymentIntentId, amountCents, operationKey(paymentIntentId, "booking-cancellation"));
    }

    public RefundSnapshot refund(String paymentIntentId, long amountCents, String operationKey) {
        if (paymentIntentId != null && paymentIntentId.startsWith("test_")) {
            if (isFakePaymentAllowed()) {
                return new RefundSnapshot("re_" + operationKey, paymentIntentId, amountCents, "eur", "succeeded", operationKey);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Remboursement de test non autorise");
        }
        try {
            Refund refund = Refund.create(RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId).setAmount(amountCents)
                    .putMetadata("meetspaceOperation", operationKey).build(),
                    RequestOptions.builder().setIdempotencyKey(operationKey).build());
            return snapshot(refund);
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Remboursement Stripe indisponible", e);
        }
    }

    public RefundSnapshot inspectRefund(String refundId) {
        try { return snapshot(Refund.retrieve(refundId)); }
        catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Verification du remboursement indisponible", e);
        }
    }

    /** Read all pages, including refunds performed outside MeetSpace. */
    public List<RefundSnapshot> listRefunds(String paymentIntentId) {
        if (paymentIntentId.startsWith("test_")) {
            if (isFakePaymentAllowed()) return List.of();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement de test non autorise");
        }
        try {
            List<RefundSnapshot> result = new ArrayList<>();
            for (Refund refund : Refund.list(RefundListParams.builder()
                    .setPaymentIntent(paymentIntentId).setLimit(100L).build()).autoPagingIterable()) {
                result.add(snapshot(refund));
            }
            return result;
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Historique des remboursements indisponible", e);
        }
    }

    private RefundSnapshot snapshot(Refund refund) {
        return new RefundSnapshot(refund.getId(), refund.getPaymentIntent(), refund.getAmount(),
                refund.getCurrency(), refund.getStatus(),
                refund.getMetadata() == null ? null : refund.getMetadata().get("meetspaceOperation"));
    }

    public static String operationKey(String paymentIntentId, String operation) {
        return "meetspace-refund-" + UUID.nameUUIDFromBytes(
                (paymentIntentId + ":" + operation).getBytes(StandardCharsets.UTF_8));
    }

    public boolean isFakePaymentAllowed() {
        return allowFakePayments && Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("dev")
                        || profile.equalsIgnoreCase("local") || profile.equalsIgnoreCase("test"));
    }

    public record PaymentSnapshot(long amountCents, String currency, Map<String, String> metadata, boolean fake) {}
    public record PaymentStateSnapshot(String status, long amountCents, String currency,
                                       Map<String, String> metadata, boolean fake) {}
    public record RefundSnapshot(String id, String paymentIntentId, long amountCents,
                                 String currency, String status, String operationKey) {}
}
