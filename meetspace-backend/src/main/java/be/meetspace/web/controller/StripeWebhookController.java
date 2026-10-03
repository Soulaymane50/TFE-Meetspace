package be.meetspace.web.controller;

import be.meetspace.service.PaymentLifecycleService;
import com.stripe.exception.*;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.Webhook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
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
        if (webhookSecret == null || webhookSecret.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (signature == null || signature.isBlank()) return ResponseEntity.badRequest().build();
        Event event;
        try {
            event = Webhook.constructEvent(payload, signature, webhookSecret);
        } catch (SignatureVerificationException | RuntimeException exception) {
            return ResponseEntity.badRequest().build();
        }
        try {
            boolean paymentEvent = "payment_intent.succeeded".equals(event.getType())
                    || "payment_intent.payment_failed".equals(event.getType())
                    || "payment_intent.canceled".equals(event.getType());
            boolean refundEvent = "refund.created".equals(event.getType())
                    || "refund.updated".equals(event.getType()) || "refund.failed".equals(event.getType());
            if (!paymentEvent && !refundEvent) return ResponseEntity.ok().build();
            // Signed events may use a newer API version. Only the ID is used, then retrieved from Stripe.
            Object object = event.getDataObjectDeserializer().getObject().orElse(null);
            if (object == null) object = event.getDataObjectDeserializer().deserializeUnsafe();
            if (paymentEvent && object instanceof PaymentIntent intent && intent.getId() != null) {
                if ("payment_intent.succeeded".equals(event.getType())) {
                    paymentLifecycleService.markSucceededFromWebhook(intent.getId());
                } else paymentLifecycleService.markFailedFromWebhook(intent.getId());
            } else if (refundEvent && object instanceof Refund refund && refund.getId() != null) {
                paymentLifecycleService.reconcileRefundFromWebhook(refund.getId());
            } else return ResponseEntity.badRequest().build();
            return ResponseEntity.ok().build();
        } catch (EventDataObjectDeserializationException exception) {
            return ResponseEntity.badRequest().build();
        }
    }
}
