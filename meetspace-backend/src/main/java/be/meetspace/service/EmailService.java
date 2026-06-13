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
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
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
import java.util.concurrent.CompletableFuture;

@Service
public class EmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailService.class);
    private static final Locale EMAIL_LOCALE = Locale.FRANCE;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final JavaMailSender mailSender;

    @Value("${app.mail.enabled:false}")
    private boolean enabled;

    @Value("${spring.mail.host:}")
    private String host;

    @Value("${spring.mail.username:}")
    private String username;

    @Value("${spring.mail.password:}")
    private String password;

    @Value("${app.mail.from:}")
    private String from;

    @Value("${app.support.admin-email:}")
    private String supportAdminEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @PostConstruct
    void logMailConfigurationStatus() {
        LOGGER.info("Email configuration status: {}", mailConfigurationStatus());
    }

    public void sendPasswordResetEmail(String to, String resetUrl) {
        ensureMailConfigured();

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Réinitialisation de votre mot de passe MeetSpace");
            helper.setText(buildPasswordResetText(resetUrl), buildPasswordResetHtml(resetUrl));
            mailSender.send(message);
            LOGGER.info("Password reset email sent to {}", maskEmail(to));
        } catch (MessagingException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible de préparer l'email de récupération", ex);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible d'envoyer l'email de récupération", ex);
        }
    }

    public void sendPasswordResetEmail(String to, String firstName, String resetUrl) {
        sendPasswordResetEmail(to, resetUrl);
    }

    public void sendAccountCreatedEmail(User user) {
        if (user == null || !StringUtils.hasText(user.getEmail())) {
            LOGGER.info("Account creation email skipped: missing user email");
            return;
        }

        Map<String, String> details = new LinkedHashMap<>();
        details.put("Compte", fullName(user));
        details.put("Email", user.getEmail());
        details.put("Acces", "Salles, evenements professionnels et parking");

        sendTransactionalEmailAsync(
                "account-created",
                user.getEmail(),
                "Bienvenue sur MeetSpace",
                "Votre compte MeetSpace est cree",
                "Votre espace est pret. Vous pouvez reserver une salle, rejoindre un evenement ou reserver du parking depuis MeetSpace.",
                details
        );
    }

    public void sendAccountDeletionConfirmationEmail(String to, String firstName, String confirmationUrl) {
        ensureMailConfigured();

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Validation de suppression de votre compte MeetSpace");
            helper.setText(
                    buildAccountDeletionText(firstName, confirmationUrl),
                    buildAccountDeletionHtml(firstName, confirmationUrl)
            );
            mailSender.send(message);
            LOGGER.info("Account deletion confirmation email sent to {}", maskEmail(to));
        } catch (MessagingException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible de preparer l'email de validation", ex);
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Impossible d'envoyer l'email de validation", ex);
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

        sendTransactionalEmail(
                "room-reservation",
                reservation.getUser().getEmail(),
                "Confirmation de votre réservation MeetSpace",
                "Réservation de salle confirmée",
                "Votre réservation est confirmée. Retrouvez les détails ci-dessous.",
                details
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

        sendTransactionalEmail(
                "event-registration",
                registration.getUser().getEmail(),
                "Confirmation de votre inscription MeetSpace",
                "Inscription événement confirmée",
                "Votre inscription est confirmée. Retrouvez les informations pratiques ci-dessous.",
                details
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

        sendTransactionalEmail(
                "parking-reservation",
                reservation.getUser().getEmail(),
                "Confirmation de votre parking MeetSpace",
                "Réservation parking confirmée",
                "Votre parking est confirmé. Retrouvez les détails de votre créneau ci-dessous.",
                details
        );
    }

    public void sendSupportContactEmail(SupportContactRequest request, LocalDateTime receivedAt) {
        String recipient = supportAdminEmail;
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Nom", request.name());
        details.put("Email", request.email());
        details.put("Categorie", formatSupportCategory(request.category()));
        details.put("Sujet", request.subject());
        details.put("Message", request.message());
        details.put("Reference reservation", StringUtils.hasText(request.reservationReference()) ? request.reservationReference() : "Non precisee");
        details.put("Date de reception", receivedAt == null ? "Non precisee" : receivedAt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

        if (!StringUtils.hasText(recipient)) {
            LOGGER.info("Support request received but no admin email is configured: {} from {}", request.category(), maskEmail(request.email()));
            return;
        }

        if (!canSendMail()) {
            LOGGER.info("Support request would be sent to {} but SMTP is not configured: {} from {}", maskEmail(recipient), request.category(), maskEmail(request.email()));
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(recipient);
            helper.setReplyTo(request.email());
            helper.setSubject("[MeetSpace Support] " + request.subject());
            helper.setText(
                    buildTransactionalText("Nouvelle demande support", "Une demande a ete envoyee depuis le formulaire Contact.", details),
                    buildTransactionalHtml("Nouvelle demande support", "Une demande a ete envoyee depuis le formulaire Contact.", details)
            );
            mailSender.send(message);
            LOGGER.info("Support email sent to {}", maskEmail(recipient));
        } catch (MessagingException ex) {
            LOGGER.warn("Support email could not be prepared for {}", maskEmail(recipient), ex);
        } catch (RuntimeException ex) {
            LOGGER.warn("Support email could not be sent to {}", maskEmail(recipient), ex);
        }
    }

    private void sendTransactionalEmail(String type, String to, String subject, String title, String intro, Map<String, String> details) {
        if (!StringUtils.hasText(to)) {
            LOGGER.info("Transactional email skipped: missing recipient for {}", type);
            return;
        }

        if (!canSendMail()) {
            LOGGER.info("Transactional email skipped because SMTP is not configured: {} for {}", type, maskEmail(to));
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(buildTransactionalText(title, intro, details), buildTransactionalHtml(title, intro, details));
            mailSender.send(message);
            LOGGER.info("Transactional email sent: {} for {}", type, maskEmail(to));
        } catch (MessagingException ex) {
            LOGGER.warn("Transactional email could not be prepared: {} for {}", type, maskEmail(to), ex);
        } catch (RuntimeException ex) {
            LOGGER.warn("Transactional email could not be sent: {} for {}", type, maskEmail(to), ex);
        }
    }

    private void sendTransactionalEmailAsync(String type, String to, String subject, String title, String intro, Map<String, String> details) {
        CompletableFuture.runAsync(() -> sendTransactionalEmail(type, to, subject, title, intro, details))
                .exceptionally(ex -> {
                    LOGGER.warn("Transactional email async task failed: {} for {}", type, maskEmail(to), ex);
                    return null;
                });
    }

    private void ensureMailConfigured() {
        if (!canSendMail()) {
            LOGGER.warn("Email send blocked because SMTP configuration is incomplete: {}", mailConfigurationStatus());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service email non configuré");
        }
    }

    public boolean canSendMail() {
        return enabled
                && StringUtils.hasText(host)
                && StringUtils.hasText(username)
                && StringUtils.hasText(normalizedPassword())
                && StringUtils.hasText(from);
    }

    private String normalizedPassword() {
        if (password == null) {
            return "";
        }
        return password.replaceAll("\\s+", "");
    }

    private String mailConfigurationStatus() {
        return "enabled=" + enabled
                + ", host=" + presence(host)
                + ", username=" + presence(username)
                + ", password=" + presence(normalizedPassword())
                + ", from=" + presence(from);
    }

    private String presence(String value) {
        return StringUtils.hasText(value) ? "present" : "missing";
    }

    private String buildPasswordResetText(String resetUrl) {
        return "Bonjour,\n\n"
                + "Vous avez demandé la réinitialisation de votre mot de passe MeetSpace.\n"
                + "Cliquez sur le lien suivant pour choisir un nouveau mot de passe :\n"
                + resetUrl + "\n\n"
                + "Ce lien expire automatiquement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
                + "MeetSpace";
    }

    private String buildPasswordResetHtml(String resetUrl) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
                  <p style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b;">MeetSpace</p>
                  <h2 style="margin: 0 0 16px;">Réinitialisation de votre mot de passe</h2>
                  <p>Vous avez demandé la réinitialisation de votre mot de passe MeetSpace.</p>
                  <p>
                    <a href="%s" style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #10213f; color: #ffffff; text-decoration: none;">
                      Choisir un nouveau mot de passe
                    </a>
                  </p>
                  <p style="color: #64748b;">Ce lien expire automatiquement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                </div>
                """.formatted(escapeHtml(resetUrl));
    }

    private String buildAccountDeletionText(String firstName, String confirmationUrl) {
        String greeting = StringUtils.hasText(firstName) ? "Bonjour " + firstName + "," : "Bonjour,";
        return greeting + "\n\n"
                + "Une demande de suppression de compte MeetSpace vient d'etre lancee.\n"
                + "Pour confirmer cette action, ouvrez le lien suivant :\n"
                + confirmationUrl + "\n\n"
                + "Ce lien expire automatiquement. Si vous n'etes pas a l'origine de cette demande, ignorez cet email et votre compte restera actif.\n\n"
                + "MeetSpace";
    }

    private String buildAccountDeletionHtml(String firstName, String confirmationUrl) {
        String greeting = StringUtils.hasText(firstName) ? "Bonjour " + firstName + "," : "Bonjour,";
        return """
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
                  <p style="font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b;">MeetSpace</p>
                  <h2 style="margin: 0 0 16px;">Validation de suppression de compte</h2>
                  <p>%s</p>
                  <p>Une demande de suppression de compte MeetSpace vient d'etre lancee.</p>
                  <p>
                    <a href="%s" style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #10213f; color: #ffffff; text-decoration: none;">
                      Confirmer la suppression
                    </a>
                  </p>
                  <p style="color: #64748b;">Ce lien expire automatiquement. Si vous n'etes pas a l'origine de cette demande, ignorez cet email et votre compte restera actif.</p>
                </div>
                """.formatted(escapeHtml(greeting), escapeHtml(confirmationUrl));
    }

    private String buildTransactionalText(String title, String intro, Map<String, String> details) {
        StringBuilder builder = new StringBuilder();
        builder.append("MeetSpace\n\n")
                .append(title).append("\n")
                .append(intro).append("\n\n");

        details.forEach((label, value) -> builder
                .append("- ")
                .append(label)
                .append(" : ")
                .append(value)
                .append("\n"));

        builder.append("\nEn cas de question, contactez le support MeetSpace en indiquant votre référence.\n\n")
                .append("MeetSpace");
        return builder.toString();
    }

    private String buildTransactionalHtml(String title, String intro, Map<String, String> details) {
        StringBuilder rows = new StringBuilder();
        details.forEach((label, value) -> rows.append("""
                <tr>
                  <td style="padding: 10px 0; color: #64748b; border-bottom: 1px solid #e5e7eb;">%s</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">%s</td>
                </tr>
                """.formatted(escapeHtml(label), escapeHtml(value))));

        return """
                <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #111827; background: #ffffff;">
                  <div style="padding: 28px; border: 1px solid #e5e7eb; border-radius: 20px;">
                    <p style="margin: 0 0 10px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b;">MeetSpace</p>
                    <h2 style="margin: 0 0 12px; font-size: 26px; line-height: 1.2;">%s</h2>
                    <p style="margin: 0 0 22px; color: #475569; line-height: 1.6;">%s</p>
                    <table style="width: 100%%; border-collapse: collapse;">%s</table>
                    <p style="margin: 24px 0 0; color: #64748b; line-height: 1.6;">
                      En cas de question, contactez le support MeetSpace en indiquant votre référence.
                    </p>
                    <p style="margin: 18px 0 0; font-weight: 700;">MeetSpace</p>
                  </div>
                </div>
                """.formatted(escapeHtml(title), escapeHtml(intro), rows);
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
            case "room_reservation" -> "Reservation salle";
            case "event" -> "Evenement";
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

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
