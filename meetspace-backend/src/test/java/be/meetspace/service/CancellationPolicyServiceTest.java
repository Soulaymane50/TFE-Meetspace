package be.meetspace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CancellationPolicyServiceTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Brussels");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 8, 21, 12, 0);

    private CancellationPolicyService service;

    @BeforeEach
    void setUp() {
        Instant instant = NOW.atZone(ZONE).toInstant();
        service = new CancellationPolicyService(Clock.fixed(instant, ZONE));
    }

    @Test
    void refundsFullyFromFortyEightHoursBeforeStart() {
        CancellationPolicyService.CancellationDecision decision = service.decide(NOW.plusHours(48), 12_345L);

        assertEquals(100, decision.refundPercent());
        assertEquals(12_345L, decision.refundAmountCents());
    }

    @Test
    void refundsHalfBetweenTwentyFourAndFortyEightHours() {
        CancellationPolicyService.CancellationDecision decision = service.decide(
                NOW.plusHours(47).plusMinutes(59), 12_345L);

        assertEquals(50, decision.refundPercent());
        assertEquals(6_173L, decision.refundAmountCents());
    }

    @Test
    void refundsHalfExactlyTwentyFourHoursBeforeStart() {
        CancellationPolicyService.CancellationDecision decision = service.decide(NOW.plusHours(24), 10_000L);

        assertEquals(50, decision.refundPercent());
        assertEquals(5_000L, decision.refundAmountCents());
    }

    @Test
    void doesNotRefundLessThanTwentyFourHoursBeforeStart() {
        CancellationPolicyService.CancellationDecision decision = service.decide(
                NOW.plusHours(23).plusMinutes(59), 10_000L);

        assertEquals(0, decision.refundPercent());
        assertEquals(0L, decision.refundAmountCents());
    }

    @Test
    void doesNotRefundWhenNothingWasPaid() {
        CancellationPolicyService.CancellationDecision decision = service.decide(NOW.plusDays(3), 0L);

        assertEquals(0, decision.refundPercent());
        assertEquals(0L, decision.refundAmountCents());
    }

    @Test
    void detectsStartedAndFutureSessionsAgainstTheSameClock() {
        assertTrue(service.hasStarted(NOW.minusMinutes(1)));
        assertTrue(service.hasStarted(NOW));
        assertFalse(service.hasStarted(NOW.plusMinutes(1)));
    }
}
