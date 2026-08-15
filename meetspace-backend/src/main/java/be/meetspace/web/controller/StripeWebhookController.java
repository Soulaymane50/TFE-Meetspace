package be.meetspace.web.controller;

import be.meetspace.service.PaymentLifecycleService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class StripeWebhookController {

    private final PaymentLifecycleService paymentLifecycleService;
    private final String webhookSecret;

    public StripeWebhookController(PaymentLifecycleService paymentLifecycleService,
                                   @Value("${stripe.webhook-secret:}") String webhookSecret) {
        this.paymentLifecycleService = paymentLifecycleService;
        this.webhookSecret = webhookSecret;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> receive(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        if (webhookSecret == null || webhookSecret.isBlank() || signature == null || signature.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        try {
            Event event = Webhook.constructEvent(payload, signature, webhookSecret);
            Object object = event.getDataObjectDeserializer().getObject().orElse(null);
            if (object instanceof PaymentIntent intent) {
                if ("payment_intent.succeeded".equals(event.getType())) {
                    paymentLifecycleService.markSucceededFromWebhook(intent.getId());
                } else if ("payment_intent.payment_failed".equals(event.getType())
                        || "payment_intent.canceled".equals(event.getType())) {
                    paymentLifecycleService.markFailedFromWebhook(intent.getId());
                }
            }
            return ResponseEntity.ok().build();
        } catch (SignatureVerificationException exception) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
}
