package be.meetspace.config;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Map;

@Component
public class PaymentVerifier {

    @Value("${app.testing.allowFakePayments:false}")
    private boolean allowFakePayments;

    private final Environment environment;

    public PaymentVerifier(Environment environment) {
        this.environment = environment;
    }

    public void verifyPayment(String paymentIntentId) {
        inspectPayment(paymentIntentId);
    }

    public PaymentSnapshot inspectPayment(String paymentIntentId) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement manquant");
        }

        if (paymentIntentId.startsWith("test_")) {
            if (isFakePaymentAllowed()) {
                return new PaymentSnapshot(-1L, "eur", Map.of(), true);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement de test non autorise dans cet environnement");
        }

        try {
            PaymentIntent paymentIntent = PaymentIntent.retrieve(paymentIntentId);
            if (!"succeeded".equals(paymentIntent.getStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement non valide");
            }
            return new PaymentSnapshot(
                    paymentIntent.getAmount(),
                    paymentIntent.getCurrency(),
                    paymentIntent.getMetadata() != null ? paymentIntent.getMetadata() : Map.of(),
                    false
            );
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Erreur de verification Stripe: " + e.getMessage());
        }
    }

    public void refund(String paymentIntentId, long amountCents) {
        if (amountCents <= 0) {
            return;
        }
        if (paymentIntentId != null && paymentIntentId.startsWith("test_")) {
            if (isFakePaymentAllowed()) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Remboursement de test non autorise");
        }
        try {
            Refund.create(RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount(amountCents)
                    .build());
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Remboursement Stripe impossible: " + e.getMessage());
        }
    }

    public boolean isFakePaymentAllowed() {
        return allowFakePayments && Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("dev")
                        || profile.equalsIgnoreCase("local")
                        || profile.equalsIgnoreCase("test"));
    }

    public record PaymentSnapshot(long amountCents, String currency, Map<String, String> metadata, boolean fake) {}
}
