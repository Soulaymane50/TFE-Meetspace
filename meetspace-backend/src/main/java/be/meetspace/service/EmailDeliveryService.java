package be.meetspace.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
class EmailDeliveryService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailDeliveryService.class);

    private final JavaMailSender mailSender;
    private final RestClient brevoRestClient;
    private final RestClient resendRestClient;
    private final boolean enabled;
    private final String smtpHost;
    private final String smtpUsername;
    private final String smtpPassword;
    private final String smtpFrom;
    private final String brevoApiKey;
    private final String brevoFromEmail;
    private final String brevoFromName;
    private final String resendApiKey;
    private final String resendFrom;

    EmailDeliveryService(JavaMailSender mailSender,
                         @Value("${app.mail.enabled:false}") boolean enabled,
                         @Value("${spring.mail.host:}") String smtpHost,
                         @Value("${spring.mail.username:}") String smtpUsername,
                         @Value("${spring.mail.password:}") String smtpPassword,
                         @Value("${app.mail.from:}") String smtpFrom,
                         @Value("${app.mail.brevo.api-key:}") String brevoApiKey,
                         @Value("${app.mail.brevo.from-email:}") String brevoFromEmail,
                         @Value("${app.mail.brevo.from-name:MeetSpace}") String brevoFromName,
                         @Value("${app.mail.brevo.api-url:https://api.brevo.com/v3/smtp/email}") String brevoApiUrl,
                         @Value("${app.mail.resend.api-key:}") String resendApiKey,
                         @Value("${app.mail.resend.from:}") String resendFrom,
                         @Value("${app.mail.resend.api-url:https://api.resend.com/emails}") String resendApiUrl) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.smtpHost = clean(smtpHost);
        this.smtpUsername = clean(smtpUsername);
        this.smtpPassword = smtpPassword == null ? "" : smtpPassword.replaceAll("\\s+", "");
        this.smtpFrom = clean(smtpFrom);
        this.brevoApiKey = clean(brevoApiKey);
        this.brevoFromEmail = clean(brevoFromEmail);
        this.brevoFromName = clean(brevoFromName);
        this.resendApiKey = clean(resendApiKey);
        this.resendFrom = clean(resendFrom);
        this.brevoRestClient = RestClient.builder().baseUrl(brevoApiUrl).build();
        this.resendRestClient = RestClient.builder().baseUrl(resendApiUrl).build();
    }

    boolean canSend() {
        return enabled && (brevoReady() || resendReady() || smtpReady());
    }

    String configurationStatus() {
        return "enabled=" + enabled
                + ", provider=" + provider()
                + ", brevoKey=" + presence(brevoApiKey)
                + ", brevoFrom=" + presence(brevoFromEmail)
                + ", resendKey=" + presence(resendApiKey)
                + ", resendFrom=" + presence(resendFrom)
                + ", smtpHost=" + presence(smtpHost)
                + ", smtpUsername=" + presence(smtpUsername)
                + ", smtpPassword=" + presence(smtpPassword)
                + ", smtpFrom=" + presence(smtpFrom);
    }

    void send(String to,
              String subject,
              EmailTemplateRenderer.EmailContent content,
              String replyTo) {
        if (!canSend()) {
            throw new IllegalStateException("Service email non configure");
        }
        if (brevoReady()) {
            sendWithBrevo(to, subject, content, replyTo);
            return;
        }
        if (resendReady()) {
            sendWithResend(to, subject, content, replyTo);
            return;
        }
        sendWithSmtp(to, subject, content, replyTo);
    }

    private void sendWithBrevo(String to,
                               String subject,
                               EmailTemplateRenderer.EmailContent content,
                               String replyTo) {
        Map<String, Object> sender = new LinkedHashMap<>();
        sender.put("email", brevoFromEmail);
        if (StringUtils.hasText(brevoFromName)) {
            sender.put("name", brevoFromName);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sender", sender);
        body.put("to", List.of(Map.of("email", to)));
        body.put("subject", subject);
        body.put("htmlContent", content.html());
        if (StringUtils.hasText(replyTo)) {
            body.put("replyTo", Map.of("email", replyTo.trim()));
        }

        brevoRestClient.post()
                .header("api-key", brevoApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
        LOGGER.debug("Email accepted by Brevo for {}", maskEmail(to));
    }

    private void sendWithResend(String to,
                                String subject,
                                EmailTemplateRenderer.EmailContent content,
                                String replyTo) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", resendFrom);
        body.put("to", to);
        body.put("subject", subject);
        body.put("text", content.text());
        body.put("html", content.html());
        if (StringUtils.hasText(replyTo)) {
            body.put("reply_to", replyTo.trim());
        }

        resendRestClient.post()
                .header("Authorization", "Bearer " + resendApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
        LOGGER.debug("Email accepted by Resend for {}", maskEmail(to));
    }

    private void sendWithSmtp(String to,
                              String subject,
                              EmailTemplateRenderer.EmailContent content,
                              String replyTo) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(smtpFrom);
            helper.setTo(to);
            if (StringUtils.hasText(replyTo)) {
                helper.setReplyTo(replyTo.trim());
            }
            helper.setSubject(subject);
            helper.setText(content.text(), content.html());
            mailSender.send(message);
        } catch (MessagingException exception) {
            throw new IllegalStateException("Impossible de preparer le message SMTP", exception);
        }
    }

    private boolean brevoReady() {
        return StringUtils.hasText(brevoApiKey) && StringUtils.hasText(brevoFromEmail);
    }

    private boolean resendReady() {
        return StringUtils.hasText(resendApiKey) && StringUtils.hasText(resendFrom);
    }

    private boolean smtpReady() {
        return StringUtils.hasText(smtpHost)
                && StringUtils.hasText(smtpUsername)
                && StringUtils.hasText(smtpPassword)
                && StringUtils.hasText(smtpFrom);
    }

    private String provider() {
        if (!enabled) return "disabled";
        if (brevoReady()) return "brevo";
        if (resendReady()) return "resend";
        if (smtpReady()) return "smtp";
        return "missing";
    }

    private static String presence(String value) {
        return StringUtils.hasText(value) ? "present" : "missing";
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String maskEmail(String email) {
        if (!StringUtils.hasText(email) || !email.contains("@")) {
            return "unknown";
        }
        String[] parts = email.split("@", 2);
        String prefix = parts[0].length() <= 2 ? parts[0] : parts[0].substring(0, 2) + "***";
        return prefix + "@" + parts[1];
    }
}
