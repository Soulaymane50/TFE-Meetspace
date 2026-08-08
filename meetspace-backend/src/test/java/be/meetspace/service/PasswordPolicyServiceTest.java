package be.meetspace.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordPolicyServiceTest {

    private final PasswordPolicyService policy = new PasswordPolicyService();

    @Test
    void acceptsPasswordWithAllRequiredCharacterClasses() {
        assertTrue(policy.isValid("Meet123!"));
        assertDoesNotThrow(() -> policy.validateOrThrow("Meet123!"));
    }

    @Test
    void rejectsMissingOrIncompletePasswords() {
        assertFalse(policy.isValid(null));
        assertFalse(policy.isValid("Short1!"));
        assertFalse(policy.isValid("meetspace1!"));
        assertThrows(ResponseStatusException.class, () -> policy.validateOrThrow("Meetspace1"));
    }
}
