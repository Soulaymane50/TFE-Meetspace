package be.meetspace.service;

import be.meetspace.entity.User;

import java.util.Locale;

final class FinanceReportingPolicy {

    private FinanceReportingPolicy() {}

    static boolean isTechnicalUser(User user) {
        if (user == null || user.getEmail() == null) return false;
        String email = user.getEmail().trim().toLowerCase(Locale.ROOT);
        return email.endsWith(".invalid") || email.endsWith("@meetspace.local");
    }
}
