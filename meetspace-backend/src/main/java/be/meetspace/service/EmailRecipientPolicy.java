package be.meetspace.service;

import be.meetspace.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import java.util.Locale;
import java.util.Set;

@Service
class EmailRecipientPolicy {
    private static final Set<String> RESERVED_TLDS = Set.of("local", "invalid", "test", "example", "admin");
    private static final Set<String> RESERVED_DOMAINS = Set.of("example.com", "example.net", "example.org");
    private final UserRepository users;

    EmailRecipientPolicy(UserRepository users) { this.users = users; }

    boolean canDeliver(String email) {
        if (!StringUtils.hasText(email)) return false;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        int separator = normalized.lastIndexOf('@');
        if (separator <= 0 || separator == normalized.length() - 1) return false;
        String domain = normalized.substring(separator + 1);
        int lastDot = domain.lastIndexOf('.');
        if (lastDot <= 0 || lastDot == domain.length() - 1) return false;
        if (RESERVED_TLDS.contains(domain.substring(lastDot + 1)) || RESERVED_DOMAINS.stream()
                .anyMatch(reserved -> domain.equals(reserved) || domain.endsWith("." + reserved))) return false;
        return !users.existsByEmailIgnoreCaseAndEmailDeliveryDisabledTrue(normalized);
    }
}
