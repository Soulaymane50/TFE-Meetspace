package be.meetspace.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String host;
    private final String from;

    public EmailService(JavaMailSender mailSender,
                        @Value("${app.mail.enabled:false}") boolean enabled,
                        @Value("${spring.mail.host:}") String host,
                        @Value("${app.mail.from:}") String from) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.host = host;
        this.from = from;
    }

    public void sendPasswordResetEmail(String to, String firstName, String resetUrl) {
        ensureMailConfigured();

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Réinitialisation de votre mot de passe MeetSpace");
            helper.setText(buildPasswordResetText(firstName, resetUrl), buildPasswordResetHtml(firstName, resetUrl));
            mailSender.send(message);
        } catch (MessagingException | RuntimeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Impossible d'envoyer l'email de réinitialisation. Vérifiez la configuration SMTP."
            );
        }
    }

    private void ensureMailConfigured() {
        if (!enabled || !StringUtils.hasText(host) || !StringUtils.hasText(from)) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Service email non configuré. Renseignez la configuration SMTP."
            );
        }
    }

    private String buildPasswordResetText(String firstName, String resetUrl) {
        String greetingName = StringUtils.hasText(firstName) ? firstName : "Bonjour";
        return greetingName + ",\n\n"
                + "Vous avez demandé la réinitialisation de votre mot de passe MeetSpace.\n"
                + "Cliquez sur ce lien pour choisir un nouveau mot de passe :\n"
                + resetUrl + "\n\n"
                + "Ce lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
                + "MeetSpace";
    }

    private String buildPasswordResetHtml(String firstName, String resetUrl) {
        String greetingName = StringUtils.hasText(firstName) ? firstName : "Bonjour";
        return """
                <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
                  <h2 style="margin:0 0 16px">Réinitialisation de votre mot de passe</h2>
                  <p>%s,</p>
                  <p>Vous avez demandé la réinitialisation de votre mot de passe MeetSpace.</p>
                  <p>
                    <a href="%s" style="display:inline-block;padding:12px 18px;background:#0f1f3a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700">
                      Choisir un nouveau mot de passe
                    </a>
                  </p>
                  <p style="color:#64748b">Ce lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                </div>
                """.formatted(greetingName, resetUrl);
    }
}
