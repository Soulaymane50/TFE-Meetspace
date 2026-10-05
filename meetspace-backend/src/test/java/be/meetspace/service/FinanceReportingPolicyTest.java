package be.meetspace.service;

import be.meetspace.entity.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FinanceReportingPolicyTest {

    @Test
    void excludesOnlyKnownTechnicalDomains() {
        User invalidUser = user("finance-check@example.invalid");
        User localUser = user("fixture.check@meetspace.local");
        User regularUser = user("membre@example.be");

        assertTrue(FinanceReportingPolicy.isTechnicalUser(invalidUser));
        assertTrue(FinanceReportingPolicy.isTechnicalUser(localUser));
        assertFalse(FinanceReportingPolicy.isTechnicalUser(regularUser));
        assertFalse(FinanceReportingPolicy.isTechnicalUser(null));
    }

    private User user(String email) {
        User user = mock(User.class);
        when(user.getEmail()).thenReturn(email);
        return user;
    }

    @Test
    void technicalAccountRemainsExcludedAfterRenaming() {
        User account = new User();
        account.setEmail("leonie.jacquet@example.net");
        account.setTechnicalAccount(true);
        assertTrue(FinanceReportingPolicy.isTechnicalUser(account));
    }

    @Test
    void ordinaryFictitiousAccountRemainsIncluded() {
        assertFalse(FinanceReportingPolicy.isTechnicalUser(user("amelie.mertens@example.com")));
    }

    @Test
    void technicalMarkerDoesNotDependOnHavingAnEmail() {
        User account = new User();
        account.setTechnicalAccount(true);
        assertTrue(FinanceReportingPolicy.isTechnicalUser(account));
    }
}
