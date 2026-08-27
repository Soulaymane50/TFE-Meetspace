package be.meetspace.service;

import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class EmailDeliveryServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);

    @Test
    void prefersHttpsDeliveryWhenResendIsConfigured() {
        EmailDeliveryService service = new EmailDeliveryService(
                mailSender,
                true,
                "",
                "",
                "",
                "",
                "re_test_secret_value",
                "MeetSpace <notifications@example.com>",
                "https://api.resend.com/emails"
        );

        assertTrue(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=resend"));
        assertFalse(service.configurationStatus().contains("re_test_secret_value"));
    }

    @Test
    void keepsSmtpAsFallback() {
        EmailDeliveryService service = new EmailDeliveryService(
                mailSender,
                true,
                "smtp.example.com",
                "mailer@example.com",
                "app-password",
                "MeetSpace <mailer@example.com>",
                "",
                "",
                "https://api.resend.com/emails"
        );

        assertTrue(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=smtp"));
    }

    @Test
    void remainsDisabledWithoutACompleteProviderConfiguration() {
        EmailDeliveryService service = new EmailDeliveryService(
                mailSender,
                true,
                "smtp.example.com",
                "mailer@example.com",
                "",
                "",
                "",
                "",
                "https://api.resend.com/emails"
        );

        assertFalse(service.canSend());
        assertTrue(service.configurationStatus().contains("provider=missing"));
    }
}
