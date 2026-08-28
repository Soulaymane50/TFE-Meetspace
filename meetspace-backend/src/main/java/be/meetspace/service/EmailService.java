package be.meetspace.service;

import be.meetspace.entity.Espace;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.User;
import be.meetspace.web.dto.SupportContactRequest;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.text.NumberFormat;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
public class EmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailService.class);
    private static final Locale EMAIL_LOCALE = Locale.FRANCE;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final Set<String> NON_DELIVERABLE_TLDS = Set.of("local", "invalid", "test", "example", "admin");

    private final EmailDeliveryService mailDelivery;

    @Value("${app.support.admin-email:}")
    private String supportAdminEmail;

    @Value("${app.frontend-url:http://localhost:5174}")
    private String frontendUrl;

    public EmailService(EmailDeliveryService mailDelivery) {
        this.mailDelivery = mailDelivery;
    }

    @PostConstruct
    void logMailConfigurationStatus() {
        LOGGER.info("Email configuration status: {}", mailConfigurationStatus());
    }

    public void sendPasswordResetEmail(String to, String resetUrl) {
        sendPasswordResetEmail(to, null, resetUrl);
    }

    public void sendPasswordResetEmail(String to, String firstName, String resetUrl) {
        ensureMailConfigured();
        ensureDeliverableRecipient(to);

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Réinitialisez votre mot de passe",
                "Une demande de nouveau mot de passe a été effectuée pour votre compte.",
                greeting(firstName),
                Map.of(),
                "Choisir un nouveau mot de passe",
                resetUrl,
                "Ce lien est personnel et expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, aucune action n'est nécessaire."
        );
        try {
            mailDelivery.send(to, "Réinitialisation de votre mot de passe MeetSpace", content, null);
            LOGGER.info("Password reset email sent to {}", maskEmail(to));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Impossible d'envoyer l'email de récupération", exception);
        }
    }

    public void sendAccountCreatedEmail(User user) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            LOGGER.info("Account creation email skipped: missing user email");
            return;
        }

        Map<String, String> details = new LinkedHashMap<>();
        details.put("Compte", fullName(user));
        details.put("Email", user.getEmail());
        details.put("Accès", "Salles, événements professionnels et parking");

        sendTransactionalEmailAsync(
                "account-created",
                user.getEmail(),
                "Bienvenue sur MeetSpace",
                "Votre compte MeetSpace est créé",
                "Votre espace est prêt. Vous pouvez réserver une salle, rejoindre un événement ou réserver du parking depuis une seule interface.",
                details,
                "Accéder à mon espace",
                frontendPath("/espace")
        );
    }

    public void sendAccountDeletionConfirmationEmail(String to, String firstName, String confirmationUrl) {
        ensureMailConfigured();
        ensureDeliverableRecipient(to);

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Confirmez la suppression de votre compte",
                "Une demande de suppression définitive vient d'être lancée.",
                greeting(firstName),
                Map.of(),
                "Confirmer la suppression",
                confirmationUrl,
                "Ce lien expire automatiquement. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre compte restera actif."
        );
        try {
            mailDelivery.send(to, "Validation de suppression de votre compte MeetSpace", content, null);
            LOGGER.info("Account deletion confirmation email sent to {}", maskEmail(to));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Impossible d'envoyer l'email de validation", exception);
        }
    }

    public void sendRoomReservationConfirmation(Reservation reservation) {
        if (reservation == null || reservation.getUser() == null) {
            return;
        }

        Espace espace = reservation.getEspace();
        String reference = "ROOM-" + safeId(reservation.getId());
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Client", fullName(reservation.getUser()));
        details.put("Salle", espace != null ? espace.getName() : "Salle MeetSpace");
        details.put("Date", formatDate(reservation.getStartDateTime()));
        details.put("Horaire", formatTimeRange(reservation.getStartDateTime(), reservation.getEndDateTime()));
        details.put("Durée", formatDuration(reservation.getStartDateTime(), reservation.getEndDateTime()));
        details.put("Prix total", formatMoney(reservation.getTotalPrice()));
        details.put("Statut", formatStatus(reservation.getStatus()));
        details.put("Paiement", formatPaymentState(reservation.getTotalPrice()));
        details.put("Référence", reference);

        sendTransactionalEmailAsync(
                "room-reservation",
                reservation.getUser().getEmail(),
                "Confirmation de votre réservation MeetSpace",
                "Réservation de salle confirmée",
                "Votre réservation est confirmée. Retrouvez les détails ci-dessous.",
                details,
                "Voir mes réservations",
                frontendPath("/my-reservations?tab=spaces")
        );
    }

    public void sendEventRegistrationConfirmation(EventRegistration registration) {
        if (registration == null || registration.getUser() == null || registration.getEvent() == null) {
            return;
        }

        Event event = registration.getEvent();
        String reference = "EVENT-" + safeId(registration.getId());
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Client", fullName(registration.getUser()));
        details.put("Événement", event.getTitle());
        details.put("Lieu", eventLocation(event));
        details.put("Date", formatDate(event.getStartDateTime()));
        details.put("Horaire", formatTimeRange(event.getStartDateTime(), event.getEndDateTime()));
        details.put("Participants", String.valueOf(registration.getNumberOfParticipants()));
        details.put("Prix total", formatMoney(registration.getTotalPrice()));
        details.put("Statut", formatStatus(registration.getStatus()));
        details.put("Paiement", formatPaymentState(registration.getTotalPrice()));
        details.put("Référence", reference);

        sendTransactionalEmailAsync(
                "event-registration",
                registration.getUser().getEmail(),
                "Confirmation de votre inscription MeetSpace",
                "Inscription événement confirmée",
                "Votre inscription est confirmée. Votre billet avec QR code est prêt pour l’accueil de l’événement.",
                details,
                "Afficher mon billet",
                frontendPath("/receipts/event/" + registration.getId())
        );
    }

    public void sendParkingReservationConfirmation(ParkingReservation reservation) {
        if (reservation == null || reservation.getUser() == null || reservation.getParkingSlot() == null) {
            return;
        }

        ParkingSlot slot = reservation.getParkingSlot();
        String reference = "PARK-" + safeId(reservation.getId());
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Client", fullName(reservation.getUser()));
        details.put("Créneau", slot.getTitle());
        details.put("Date", formatDate(slot.getSessionDate()));
        details.put("Horaire", formatTimeRange(slot.getStartTime(), slot.getEndTime()));
        details.put("Places", String.valueOf(reservation.getReservedSpaces()));
        details.put("Prix total", formatMoney(reservation.getTotalPrice()));
        details.put("Statut", formatStatus(reservation.getStatus()));
        details.put("Paiement", formatPaymentState(reservation.getTotalPrice()));
        details.put("Référence", reference);

        sendTransactionalEmailAsync(
                "parking-reservation",
                reservation.getUser().getEmail(),
                "Confirmation de votre parking MeetSpace",
                "Réservation parking confirmée",
                "Votre parking est confirmé. Retrouvez les détails de votre créneau ci-dessous.",
                details,
                "Voir mes réservations",
                frontendPath("/my-reservations?tab=parking")
        );
    }

    public void sendSupportContactEmail(SupportContactRequest request, LocalDateTime receivedAt) {
        String recipient = supportAdminEmail;
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Nom", request.name());
        details.put("Email", request.email());
        details.put("Catégorie", formatSupportCategory(request.category()));
        details.put("Sujet", request.subject());
        details.put("Message", request.message());
        details.put("Référence réservation", StringUtils.hasText(request.reservationReference()) ? request.reservationReference() : "Non précisée");
        details.put("Date de réception", receivedAt == null ? "Non précisée" : receivedAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

        if (!StringUtils.hasText(recipient)) {
            LOGGER.info("Support request received but no admin email is configured: {} from {}", request.category(), maskEmail(request.email()));
            return;
        }
        if (!canSendMail()) {
            LOGGER.info("Support request would be sent to {} but email delivery is not configured: {} from {}",
                    maskEmail(recipient), request.category(), maskEmail(request.email()));
            return;
        }

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Nouvelle demande au support",
                "Une demande a été envoyée depuis le formulaire Contact.",
                null,
                details,
                null,
                null,
                "Répondez directement à ce message pour contacter la personne."
        );
        CompletableFuture.runAsync(() -> {
            try {
                mailDelivery.send(recipient, "[MeetSpace Support] " + request.subject(), content, request.email());
                LOGGER.info("Support email sent to {}", maskEmail(recipient));
            } catch (RuntimeException exception) {
                LOGGER.warn("Support email could not be sent to {}", maskEmail(recipient), exception);
            }
        });
    }

    private void sendTransactionalEmail(String type,
                                        String to,
                                        String subject,
                                        String title,
                                        String intro,
                                        Map<String, String> details,
                                        String actionLabel,
                                        String actionUrl) {
        if (!StringUtils.hasText(to)) {
            LOGGER.info("Transactional email skipped: missing recipient for {}", type);
            return;
        }
        if (!canSendMail()) {
            LOGGER.info("Transactional email skipped because delivery is not configured: {} for {}", type, maskEmail(to));
            return;
        }
        if (!isDeliverableRecipient(to)) {
            LOGGER.info("Transactional email skipped for non-deliverable demo recipient: {} for {}", type, maskEmail(to));
            return;
        }

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                title,
                intro,
                null,
                details,
                actionLabel,
                actionUrl,
                "Conservez ce message : la référence permet au support de retrouver rapidement votre demande."
        );
        try {
            mailDelivery.send(to, subject, content, null);
            LOGGER.info("Transactional email sent: {} for {}", type, maskEmail(to));
        } catch (RuntimeException exception) {
            LOGGER.warn("Transactional email could not be sent: {} for {}", type, maskEmail(to), exception);
        }
    }

    public void sendEmailChangeConfirmation(String to, String firstName, String confirmationUrl) {
        ensureMailConfigured();
        ensureDeliverableRecipient(to);

        EmailTemplateRenderer.EmailContent content = EmailTemplateRenderer.render(
                "Confirmez votre nouvelle adresse e-mail",
                "Validez cette adresse pour terminer la modification de votre compte.",
                greeting(firstName),
                Map.of(),
                "Confirmer mon adresse",
                confirmationUrl,
                "Ce lien expire dans 30 minutes. Si vous n'avez pas demandé ce changement, conservez votre adresse actuelle et contactez le support."
        );
        try {
            mailDelivery.send(to, "Confirmez votre nouvelle adresse MeetSpace", content, null);
            LOGGER.info("Email change confirmation sent to {}", maskEmail(to));
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Impossible d'envoyer la confirmation de changement d'email", exception);
        }
    }

    private void sendTransactionalEmailAsync(String type,
                                             String to,
                                             String subject,
                                             String title,
                                             String intro,
                                             Map<String, String> details,
                                             String actionLabel,
                                             String actionUrl) {
        CompletableFuture.runAsync(() -> sendTransactionalEmail(
                        type, to, subject, title, intro, details, actionLabel, actionUrl))
                .exceptionally(exception -> {
                    LOGGER.warn("Transactional email async task failed: {} for {}", type, maskEmail(to), exception);
                    return null;
                });
    }

    private void ensureDeliverableRecipient(String email) {
        if (!isDeliverableRecipient(email)) {
            LOGGER.info("Email blocked for non-deliverable demo recipient: {}", maskEmail(email));
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adresse email de démonstration non distribuable");
        }
    }

    private void ensureMailConfigured() {
        if (!canSendMail()) {
            LOGGER.warn("Email send blocked because delivery configuration is incomplete: {}", mailConfigurationStatus());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service email non configuré");
        }
    }

    public boolean canSendMail() {
        return mailDelivery.canSend();
    }

    private String mailConfigurationStatus() {
        return mailDelivery.configurationStatus();
    }

    private boolean isDeliverableRecipient(String email) {
        if (!StringUtils.hasText(email)) {
            return false;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        int separator = normalized.lastIndexOf('@');
        if (separator <= 0 || separator == normalized.length() - 1) {
            return false;
        }
        String domain = normalized.substring(separator + 1);
        int lastDot = domain.lastIndexOf('.');
        if (lastDot <= 0 || lastDot == domain.length() - 1) {
            return false;
        }
        return !NON_DELIVERABLE_TLDS.contains(domain.substring(lastDot + 1));
    }

    private String frontendPath(String path) {
        String base = StringUtils.hasText(frontendUrl) ? frontendUrl.trim().replaceAll("/+$", "") : "";
        String suffix = path == null ? "" : (path.startsWith("/") ? path : "/" + path);
        return base + suffix;
    }

    private String greeting(String firstName) {
        return StringUtils.hasText(firstName)
                ? "Bonjour " + firstName.trim() + ","
                : "Bonjour,";
    }

    private String eventLocation(Event event) {
        if (event.getSpace() != null && StringUtils.hasText(event.getSpace().getName())) {
            return event.getSpace().getName();
        }
        if (StringUtils.hasText(event.getLocation())) {
            return event.getLocation();
        }
        if (StringUtils.hasText(event.getExternalAddress())) {
            return event.getExternalAddress();
        }
        return "Lieu à confirmer";
    }

    private String fullName(User user) {
        if (user == null) {
            return "Client MeetSpace";
        }
        String firstName = user.getFirstName() == null ? "" : user.getFirstName();
        String lastName = user.getLastName() == null ? "" : user.getLastName();
        String fullName = (firstName + " " + lastName).trim();
        return StringUtils.hasText(fullName) ? fullName : "Client MeetSpace";
    }

    private String safeId(Long id) {
        return id == null ? "PENDING" : id.toString();
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "Non précisée" : value.format(DATE_FORMATTER);
    }

    private String formatDate(LocalDate value) {
        return value == null ? "Non précisée" : value.format(DATE_FORMATTER);
    }

    private String formatTimeRange(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            return "Horaire à confirmer";
        }
        return start.format(TIME_FORMATTER) + " - " + end.format(TIME_FORMATTER);
    }

    private String formatTimeRange(LocalTime start, LocalTime end) {
        if (start == null || end == null) {
            return "Horaire à confirmer";
        }
        return start.format(TIME_FORMATTER) + " - " + end.format(TIME_FORMATTER);
    }

    private String formatDuration(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            return "Non précisée";
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes <= 0) {
            return "Non précisée";
        }
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;
        if (remainingMinutes == 0) {
            return hours + " h";
        }
        return hours + " h " + remainingMinutes + " min";
    }

    private String formatMoney(Double amount) {
        if (amount == null || amount <= 0) {
            return "Gratuit";
        }
        NumberFormat formatter = NumberFormat.getCurrencyInstance(EMAIL_LOCALE);
        return formatter.format(amount);
    }

    private String formatPaymentState(Double amount) {
        if (amount == null || amount <= 0) {
            return "Gratuit";
        }
        return "Paiement confirmé";
    }

    private String formatStatus(Enum<?> status) {
        if (status == null) {
            return "Confirmé";
        }
        return switch (status.name()) {
            case "CONFIRMED" -> "Confirmé";
            case "PENDING_APPROVAL" -> "En attente de validation";
            case "APPROVED" -> "Approuvé";
            case "REJECTED" -> "Refusé";
            case "CANCELLED" -> "Annulé";
            default -> status.name();
        };
    }

    private String formatSupportCategory(String category) {
        if (category == null) {
            return "Autre";
        }
        return switch (category) {
            case "account" -> "Compte";
            case "room_reservation" -> "Réservation salle";
            case "event" -> "Événement";
            case "parking" -> "Parking";
            case "payment" -> "Paiement";
            default -> "Autre";
        };
    }

    private String maskEmail(String email) {
        if (!StringUtils.hasText(email) || !email.contains("@")) {
            return "unknown";
        }
        String[] parts = email.split("@", 2);
        String prefix = parts[0].length() <= 2 ? parts[0] : parts[0].substring(0, 2) + "***";
        return prefix + "@" + parts[1];
    }
}
