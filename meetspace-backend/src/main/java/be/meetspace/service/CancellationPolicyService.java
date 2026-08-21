package be.meetspace.service;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class CancellationPolicyService {

    private final Clock clock;

    public CancellationPolicyService() {
        this(Clock.systemDefaultZone());
    }

    CancellationPolicyService(Clock clock) {
        this.clock = Objects.requireNonNull(clock);
    }

    public boolean hasStarted(LocalDateTime startsAt) {
        return startsAt != null && !startsAt.isAfter(LocalDateTime.now(clock));
    }

    public CancellationDecision decide(LocalDateTime startsAt, long paidAmountCents) {
        if (startsAt == null || paidAmountCents <= 0) {
            return new CancellationDecision(0, 0L, "Aucun paiement a rembourser.");
        }
        long hours = Duration.between(LocalDateTime.now(clock), startsAt).toHours();
        if (hours >= 48) {
            return new CancellationDecision(100, paidAmountCents,
                    "Remboursement integral: annulation au moins 48 heures avant.");
        }
        if (hours >= 24) {
            return new CancellationDecision(50, Math.round(paidAmountCents * 0.5D),
                    "Remboursement de 50 %: annulation entre 24 et 48 heures avant.");
        }
        return new CancellationDecision(0, 0L,
                "Aucun remboursement automatique moins de 24 heures avant.");
    }

    public record CancellationDecision(int refundPercent, long refundAmountCents, String explanation) {}
}
