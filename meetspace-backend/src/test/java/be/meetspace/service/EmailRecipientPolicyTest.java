package be.meetspace.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import be.meetspace.repository.UserRepository;
import be.meetspace.entity.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailRecipientPolicyTest {
    EmailDeliveryService delivery = mock(EmailDeliveryService.class);
    UserRepository users = mock(UserRepository.class);
    EmailService service = new EmailService(delivery, new EmailRecipientPolicy(users));

    @ParameterizedTest
    @ValueSource(strings = {"amelie.mertens@example.com", "leonie.jacquet@example.net",
            "clemence.delaunay@example.org", "person@mail.example.com", "PERSON@EXAMPLE.COM", "person@gmail.test"})
    void reservedAndFictitiousAddressesNeverReachDelivery(String email) {
        when(delivery.canSend()).thenReturn(true);
        assertThatThrownBy(() -> service.sendPasswordResetEmail(email, "https://example.com/reset"))
                .isInstanceOf(ResponseStatusException.class);
        verify(delivery, never()).send(anyString(), anyString(), any(), any());
    }

    @Test
    void normalAddressesStillUseTheConfiguredDelivery() {
        when(delivery.canSend()).thenReturn(true);
        service.sendPasswordResetEmail("person@outlook.com", "https://example.com/reset");
        verify(delivery).send(eq("person@outlook.com"), anyString(), any(), isNull());
    }

    @ParameterizedTest
    @ValueSource(strings = {"amelie.mertens@gmail.com", "leonie.jacquet@hotmail.fr", "clemence.delaunay@outlook.be"})
    void fictitiousAccountsNeverReceiveMailOnPublicDomains(String email) {
        when(delivery.canSend()).thenReturn(true);
        when(users.existsByEmailIgnoreCaseAndEmailDeliveryDisabledTrue(email)).thenReturn(true);
        assertThatThrownBy(() -> service.sendPasswordResetEmail(email, "https://example.com/reset"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.sendAccountDeletionConfirmationEmail(email, "Alice", "https://example.com/delete"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.sendEmailChangeConfirmation(email, "Alice", "https://example.com/change"))
                .isInstanceOf(ResponseStatusException.class);
        verify(delivery, never()).send(anyString(), anyString(), any(), any());
    }

    @Test
    void blockedAccountCannotTriggerEmailByChoosingAnotherAddress() {
        User user = new User();
        user.setEmailDeliveryDisabled(true);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        EmailService emails = mock(EmailService.class);
        EmailChangeService changes = new EmailChangeService(users, encoder, emails, "https://example.com");
        assertThatThrownBy(() -> changes.request(user, "somebody@gmail.com", "fixture"))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(users, encoder, emails);
    }
}
