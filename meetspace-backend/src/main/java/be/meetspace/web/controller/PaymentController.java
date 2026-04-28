package be.meetspace.web.controller;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Event;
import be.meetspace.entity.Espace;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.User;
import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import be.meetspace.web.dto.PaymentRequest;
import be.meetspace.web.dto.PaymentResponse;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @Value("${stripe.public-key}")
    private String publicKey;

    private final EventRepository eventRepository;
    private final EspaceRepository espaceRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final UserRepository userRepository;
    private final PaymentVerifier paymentVerifier;
    private final AuditService auditService;

    public PaymentController(EventRepository eventRepository,
                             EspaceRepository espaceRepository,
                             ParkingSlotRepository parkingSlotRepository,
                             ReservationRepository reservationRepository,
                             EventRegistrationRepository eventRegistrationRepository,
                             UserRepository userRepository,
                             PaymentVerifier paymentVerifier,
                             AuditService auditService) {
        this.eventRepository = eventRepository;
        this.espaceRepository = espaceRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.userRepository = userRepository;
        this.paymentVerifier = paymentVerifier;
        this.auditService = auditService;
    }

    @PostMapping("/create-payment-intent")
    public ResponseEntity<PaymentResponse> createPaymentIntent(@RequestBody PaymentRequest request, HttpServletRequest httpRequest) {
        try {
            if ("EVENT".equalsIgnoreCase(request.getReservationType()) && request.getEventId() != null) {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                String email = auth.getName();
                User user = userRepository.findByEmail(email)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non trouvé"));
                Event event = eventRepository.findById(request.getEventId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));

                if (eventRegistrationRepository.existsByUserAndEventAndStatusNot(user, event, EventRegistrationStatus.CANCELLED)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous êtes déjà inscrit à cet événement");
                }
            }

            Long calculatedAmount = calculateServerSideAmount(request);

            if (calculatedAmount <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le montant doit être supérieur à 0");
            }

            if (request.getAmount() != null && !request.getAmount().equals(calculatedAmount)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Montant invalide");
            }

            String normalizedReservationType = request.getReservationType();

            PaymentIntentCreateParams.Builder paramsBuilder = PaymentIntentCreateParams.builder()
                    .setAmount(calculatedAmount)
                    .setCurrency(request.getCurrency() != null ? request.getCurrency() : "eur")
                    .setDescription(request.getDescription())
                    .putMetadata("reservationType", normalizedReservationType);

            if (request.getReservationId() != null) {
                paramsBuilder.putMetadata("reservationId", String.valueOf(request.getReservationId()));
            }
            if (request.getEspaceId() != null) {
                paramsBuilder.putMetadata("espaceId", String.valueOf(request.getEspaceId()));
            }
            if (request.getParkingSlotId() != null) {
                paramsBuilder.putMetadata("parkingSlotId", String.valueOf(request.getParkingSlotId()));
            }
            if (request.getReservedSpaces() != null) {
                paramsBuilder.putMetadata("reservedSpaces", String.valueOf(request.getReservedSpaces()));
            }
            if (request.getNumberOfParticipants() != null) {
                paramsBuilder.putMetadata("numberOfParticipants", String.valueOf(request.getNumberOfParticipants()));
            }

            PaymentIntent paymentIntent = PaymentIntent.create(paramsBuilder.build());

            // Audit log
            String ipAddress = AuditService.getClientIpAddress(httpRequest);
            auditService.log(AuditAction.PAYMENT_INITIATED, "Payment", null,
                    String.format("Paiement initié: %.2f€ - Type: %s", calculatedAmount / 100.0, normalizedReservationType),
                    ipAddress);

            return ResponseEntity.ok(new PaymentResponse(paymentIntent.getClientSecret(), publicKey));
        } catch (StripeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Erreur Stripe: " + e.getMessage());
        }
    }

    private Long calculateServerSideAmount(PaymentRequest request) {
        String type = request.getReservationType();

        if ("EVENT".equalsIgnoreCase(type) && request.getEventId() != null) {
            Event event = eventRepository.findById(request.getEventId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));
            Double price = event.getPrice() != null ? event.getPrice() : 0.0;
            int participants = request.getNumberOfParticipants() != null ? request.getNumberOfParticipants() : 1;
            double eventTotal = price * participants;

            double parkingTotal = 0.0;
            if (request.getReservedSpaces() != null && request.getReservedSpaces() > 0) {
                ParkingSlot parkingSlot = event.getParkingSlot();
                if (parkingSlot != null) {
                    parkingTotal = parkingSlot.getParkingRate() * request.getReservedSpaces();
                }
            }

            return Math.round((eventTotal + parkingTotal) * 100);
        }

        if ("PARKING".equalsIgnoreCase(type) && request.getParkingSlotId() != null) {
            ParkingSlot parkingSlot = parkingSlotRepository.findById(request.getParkingSlotId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau parking introuvable"));
            int reservedSpaces = request.getReservedSpaces() != null ? request.getReservedSpaces() : 1;
            return Math.round(parkingSlot.getParkingRate() * reservedSpaces * 100);
        }

        if ("SPACE".equalsIgnoreCase(type) || "ESPACE".equalsIgnoreCase(type) || "PREMIUM_ROOM".equalsIgnoreCase(type)) {
            if (request.getReservationId() != null) {
                Reservation reservation = reservationRepository.findById(request.getReservationId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Réservation introuvable"));
                return Math.round(reservation.getTotalPrice() * 100);
            }

            if (request.getEspaceId() != null) {
                Espace espace = espaceRepository.findById(request.getEspaceId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable"));
                double hours = request.getHours() != null ? Math.max(1.0, request.getHours()) : 1.0;
                return Math.round(espace.getBasePrice() * hours * 100);
            }
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type de réservation invalide ou données manquantes");
    }

    @GetMapping("/verify/{paymentIntentId}")
    public ResponseEntity<Map<String, Object>> verifyPayment(@PathVariable String paymentIntentId, HttpServletRequest httpRequest) {
        Map<String, Object> response = new HashMap<>();
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        if (paymentVerifier != null) {
            try {
                paymentVerifier.verifyPayment(paymentIntentId);
                response.put("status", "succeeded");
                response.put("success", true);
                response.put("paymentIntentId", paymentIntentId);

                // Audit log success
                auditService.log(AuditAction.PAYMENT_SUCCESS, "Payment", null,
                        String.format("Paiement vérifié avec succès: %s", paymentIntentId), ipAddress);

                return ResponseEntity.ok(response);
            } catch (ResponseStatusException e) {
                response.put("status", "failed");
                response.put("success", false);
                response.put("error", e.getReason());

                // Audit log failure
                auditService.log(AuditAction.PAYMENT_FAILURE, "Payment", null,
                        String.format("Échec vérification paiement: %s - %s", paymentIntentId, e.getReason()), ipAddress);

                return ResponseEntity.status(e.getStatusCode()).body(response);
            }
        }

        try {
            PaymentIntent paymentIntent = PaymentIntent.retrieve(paymentIntentId);

            response.put("status", paymentIntent.getStatus());
            response.put("success", "succeeded".equals(paymentIntent.getStatus()));
            response.put("paymentIntentId", paymentIntentId);

            // Audit log based on status
            if ("succeeded".equals(paymentIntent.getStatus())) {
                auditService.log(AuditAction.PAYMENT_SUCCESS, "Payment", null,
                        String.format("Paiement vérifié avec succès: %s", paymentIntentId), ipAddress);
            } else {
                auditService.log(AuditAction.PAYMENT_FAILURE, "Payment", null,
                        String.format("Paiement en attente ou échoué: %s - Status: %s", paymentIntentId, paymentIntent.getStatus()), ipAddress);
            }

            return ResponseEntity.ok(response);
        } catch (StripeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());

            // Audit log error
            auditService.log(AuditAction.PAYMENT_FAILURE, "Payment", null,
                    String.format("Erreur vérification paiement: %s - %s", paymentIntentId, e.getMessage()), ipAddress);

            return ResponseEntity.badRequest().body(error);
        }
    }
}
