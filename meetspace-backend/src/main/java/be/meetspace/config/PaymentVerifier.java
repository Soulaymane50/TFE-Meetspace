package be.meetspace.config;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;

@Component
public class PaymentVerifier {

    @Value("${app.testing.allowFakePayments:false}")
    private boolean allowFakePayments;

    private final Environment environment;

    public PaymentVerifier(Environment environment) {
        this.environment = environment;
    }

    public void verifyPayment(String paymentIntentId) {
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement manquant");
        }

        if (paymentIntentId.startsWith("test_")) {
            if (allowFakePayments && isDevelopmentProfile()) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement de test non autorisé dans cet environnement");
        }

        try {
            PaymentIntent paymentIntent = PaymentIntent.retrieve(paymentIntentId);
            if (!"succeeded".equals(paymentIntent.getStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paiement non validé");
            }
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Erreur vérification paiement: " + e.getMessage());
        }
    }

    private boolean isDevelopmentProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("dev")
                        || profile.equalsIgnoreCase("local")
                        || profile.equalsIgnoreCase("test"));
    }
}
