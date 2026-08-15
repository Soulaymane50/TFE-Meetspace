package be.meetspace.web.controller;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.AuditAction;
import be.meetspace.entity.BookingHold;
import be.meetspace.entity.PaymentStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.BookingHoldService;
import be.meetspace.service.PaymentLifecycleService;
import be.meetspace.service.PaymentQuoteService;
import be.meetspace.service.RequestRateLimitService;
import be.meetspace.web.dto.PaymentRequest;
import be.meetspace.web.dto.PaymentResponse;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.time.Duration;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final UserRepository userRepository;
    private final PaymentQuoteService quoteService;
    private final BookingHoldService holdService;
    private final PaymentLifecycleService paymentLifecycleService;
    private final PaymentVerifier paymentVerifier;
    private final AuditService auditService;
    private final RequestRateLimitService rateLimitService;

    @Value("${stripe.public-key:}")
    private String publicKey;

    public PaymentController(UserRepository userRepository,
                             PaymentQuoteService quoteService,
                             BookingHoldService holdService,
                             PaymentLifecycleService paymentLifecycleService,
                             PaymentVerifier paymentVerifier,
                             AuditService auditService,
                             RequestRateLimitService rateLimitService) {
        this.userRepository = userRepository;
        this.quoteService = quoteService;
        this.holdService = holdService;
        this.paymentLifecycleService = paymentLifecycleService;
        this.paymentVerifier = paymentVerifier;
        this.auditService = auditService;
        this.rateLimitService = rateLimitService;
    }

    @PostMapping("/create-payment-intent")
    public PaymentResponse createPaymentIntent(@Valid @RequestBody PaymentRequest request,
                                               Authentication authentication,
                                               HttpServletRequest httpRequest) {
        User user = authenticatedUser(authentication);
        rateLimitService.check("payment", user.getId() + ":" + AuditService.getClientIpAddress(httpRequest),
                30, Duration.ofMinutes(5));
        PaymentQuoteService.PaymentQuote quote = quoteService.quote(request, user);
        BookingHold hold = holdService.createHold(request, user, quote.type(), quote.amountCents());

        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(quote.amountCents())
                    .setCurrency(quote.currency())
                    .setDescription(safeDescription(request.getDescription()))
                    .putMetadata("reservationType", quote.type().name())
                    .putMetadata("userId", String.valueOf(user.getId()))
                    .putMetadata("resourceId", String.valueOf(quote.resourceId()))
                    .putMetadata("holdToken", hold.getToken())
                    .build();

            PaymentIntent intent = PaymentIntent.create(
                    params,
                    RequestOptions.builder().setIdempotencyKey("meetspace-" + hold.getToken()).build()
            );
            paymentLifecycleService.registerIntent(intent.getId(), user, quote, hold, PaymentStatus.PENDING);
            auditPayment(httpRequest, intent.getId(), quote, "Paiement Stripe initialise");
            return new PaymentResponse(intent.getClientSecret(), publicKey, intent.getId(), holdService.getHoldSeconds());
        } catch (StripeException exception) {
            holdService.cancel(hold);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Stripe ne peut pas initialiser le paiement pour le moment.");
        }
    }

    @PostMapping("/create-local-payment-intent")
    public PaymentResponse createLocalPaymentIntent(@Valid @RequestBody PaymentRequest request,
                                                    Authentication authentication,
                                                    HttpServletRequest httpRequest) {
        User user = authenticatedUser(authentication);
        rateLimitService.check("local-payment", user.getId() + ":" + AuditService.getClientIpAddress(httpRequest),
                30, Duration.ofMinutes(5));
        PaymentQuoteService.PaymentQuote quote = quoteService.quote(request, user);
        BookingHold hold = holdService.createHold(request, user, quote.type(), quote.amountCents());
        try {
            String paymentIntentId = paymentLifecycleService.createLocalPayment(user, quote, hold);
            auditPayment(httpRequest, paymentIntentId, quote, "Paiement local initialise");
            return new PaymentResponse(null, publicKey, paymentIntentId, holdService.getHoldSeconds());
        } catch (RuntimeException exception) {
            holdService.cancel(hold);
            throw exception;
        }
    }

    @GetMapping("/verify/{paymentIntentId}")
    public ResponseEntity<Map<String, Object>> verifyPayment(@PathVariable String paymentIntentId,
                                                              Authentication authentication) {
        User user = authenticatedUser(authentication);
        PaymentVerifier.PaymentSnapshot snapshot = paymentLifecycleService.verifyOwnedPayment(paymentIntentId, user);
        Map<String, Object> response = new HashMap<>();
        response.put("status", "succeeded");
        response.put("success", true);
        response.put("paymentIntentId", paymentIntentId);
        if (!snapshot.fake()) {
            response.put("amount", snapshot.amountCents());
            response.put("currency", snapshot.currency());
        }
        return ResponseEntity.ok(response);
    }

    private User authenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non connecte.");
        }
        return userRepository.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    private void auditPayment(HttpServletRequest request,
                              String paymentIntentId,
                              PaymentQuoteService.PaymentQuote quote,
                              String label) {
        auditService.log(
                AuditAction.PAYMENT_INITIATED,
                "Payment",
                null,
                String.format("%s: %s - %.2f EUR - %s",
                        label, paymentIntentId, quote.amountCents() / 100D, quote.type().name()),
                AuditService.getClientIpAddress(request)
        );
    }

    private static String safeDescription(String description) {
        if (description == null || description.isBlank()) {
            return "Reservation MeetSpace";
        }
        return description.length() > 300 ? description.substring(0, 300) : description;
    }
}
