package be.meetspace.service;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RequestRateLimitService {

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String scope, String subject, int limit, Duration duration) {
        String safeSubject = subject == null || subject.isBlank() ? "unknown" : subject.trim().toLowerCase();
        String key = scope + ":" + safeSubject;
        Instant now = Instant.now();

        Window current = windows.compute(key, (ignored, existing) -> {
            if (existing == null || !now.isBefore(existing.expiresAt())) {
                return new Window(1, now.plus(duration));
            }
            return new Window(existing.count() + 1, existing.expiresAt());
        });

        if (current.count() > limit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Trop de tentatives. Patientez quelques minutes avant de reessayer.");
        }
    }

    @Scheduled(fixedDelayString = "${app.security.rate-limit-cleanup-ms:300000}")
    public void removeExpiredWindows() {
        Instant now = Instant.now();
        windows.entrySet().removeIf(entry -> !now.isBefore(entry.getValue().expiresAt()));
    }

    private record Window(int count, Instant expiresAt) {}
}
