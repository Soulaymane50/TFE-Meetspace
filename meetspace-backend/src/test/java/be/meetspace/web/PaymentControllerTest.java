package be.meetspace.web;

import be.meetspace.entity.User;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.BookingHoldService;
import be.meetspace.service.PaymentLifecycleService;
import be.meetspace.service.PaymentQuoteService;
import be.meetspace.service.RequestRateLimitService;
import be.meetspace.config.PaymentVerifier;
import be.meetspace.web.controller.PaymentController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentControllerTest {

    private PaymentController controller;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        UserRepository users = mock(UserRepository.class);
        User user = new User();
        user.setId(12L);
        user.setEmail("member@example.org");
        when(users.findByEmailIgnoreCase("member@example.org")).thenReturn(Optional.of(user));

        controller = new PaymentController(
                users,
                mock(PaymentQuoteService.class),
                mock(BookingHoldService.class),
                mock(PaymentLifecycleService.class),
                mock(PaymentVerifier.class),
                mock(AuditService.class),
                mock(RequestRateLimitService.class)
        );
        authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("member@example.org");
    }

    @Test
    void exposesOnlyThePublishableKeyWhenStripeIsReady() {
        ReflectionTestUtils.setField(controller, "publicKey", "pk_test_12345678901234567890");
        ReflectionTestUtils.setField(controller, "secretKey", "sk_test_12345678901234567890");

        ResponseEntity<Map<String, Object>> response = controller.paymentConfig(authentication);

        assertThat(response.getBody())
                .containsEntry("enabled", true)
                .containsEntry("provider", "stripe")
                .containsEntry("publicKey", "pk_test_12345678901234567890");
        assertThat(response.getBody()).doesNotContainKey("secretKey");
    }

    @Test
    void reportsPaymentsUnavailableWhenTheSecretKeyIsMissing() {
        ReflectionTestUtils.setField(controller, "publicKey", "pk_test_12345678901234567890");
        ReflectionTestUtils.setField(controller, "secretKey", "");

        ResponseEntity<Map<String, Object>> response = controller.paymentConfig(authentication);

        assertThat(response.getBody())
                .containsEntry("enabled", false)
                .doesNotContainKey("publicKey")
                .doesNotContainKey("secretKey");
    }

    @Test
    void rejectsMixedTestAndLiveStripeKeys() {
        ReflectionTestUtils.setField(controller, "publicKey", "pk_live_12345678901234567890");
        ReflectionTestUtils.setField(controller, "secretKey", "sk_test_12345678901234567890");

        ResponseEntity<Map<String, Object>> response = controller.paymentConfig(authentication);

        assertThat(response.getBody())
                .containsEntry("enabled", false)
                .doesNotContainKey("publicKey")
                .doesNotContainKey("secretKey");
    }
}
