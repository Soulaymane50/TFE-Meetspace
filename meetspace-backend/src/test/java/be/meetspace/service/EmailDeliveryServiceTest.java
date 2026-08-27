package be.meetspace.service;

import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class EmailDeliveryServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);

    @Test
    void prefersBrevoForProductionHttpsDelivery() {
        EmailDeliveryService service = service(
                "xkeysib-test-secret",
                "notifications@example.com",
                "re_test_secret_value",
                "MeetSpace <notifications@example.com>",
                "",
                "",
                "",
                ""
        );

        assertTrue(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=brevo"));
        assertFalse(service.configurationStatus().contains("xkeysib-test-secret"));
    }

    @Test
    void usesResendWhenBrevoIsNotConfigured() {
        EmailDeliveryService service = service(
                "",
                "",
                "re_test_secret_value",
                "MeetSpace <notifications@example.com>",
                "",
                "",
                "",
                ""
        );

        assertTrue(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=resend"));
        assertFalse(service.configurationStatus().contains("re_test_secret_value"));
    }

    @Test
    void keepsSmtpAsLastFallback() {
        EmailDeliveryService service = service(
                "",
                "",
                "",
                "",
                "smtp.example.com",
                "mailer@example.com",
                "app-password",
                "MeetSpace <mailer@example.com>"
        );

        assertTrue(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=smtp"));
    }

    @Test
    void remainsDisabledWithoutACompleteProviderConfiguration() {
        EmailDeliveryService service = service(
                "",
                "",
                "",
                "",
                "smtp.example.com",
                "mailer@example.com",
                "",
                ""
        );

        assertFalse(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=missing"));
    }

    private EmailDeliveryService service(String brevoKey,
                                         String brevoFrom,
                                         String resendKey,
                                         String resendFrom,
                                         String smtpHost,
                                         String smtpUsername,
                                         String smtpPassword,
                                         String smtpFrom) {
        return new EmailDeliveryService(
                mailSender,
                true,
                smtpHost,
                smtpUsername,
                smtpPassword,
                smtpFrom,
                brevoKey,
                brevoFrom,
                "MeetSpace",
                "https://api.brevo.com/v3/smtp/email",
                resendKey,
                resendFrom,
                "https://api.resend.com/emails"
        );
    }
}
