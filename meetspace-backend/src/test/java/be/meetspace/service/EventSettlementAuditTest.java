package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventSettlementAuditTest {
    @Test
    void settlementUsesHistoricalTicketTotalsAndNeverMultipliesThemByParticipantCount() {
        Event event = settledEvent(100D);
        EventRegistrationRepository registrations = mock(EventRegistrationRepository.class);
        when(registrations.countTotalParticipantsByEventId(10L)).thenReturn(10);
        when(registrations.findByEventId(10L)).thenReturn(List.of(
                ticket(2, 40D, EventRegistrationStatus.CONFIRMED),
                ticket(8, 160D, EventRegistrationStatus.CONFIRMED),
                ticket(1, 999D, EventRegistrationStatus.CANCELLED),
                ticket(1, 999D, EventRegistrationStatus.PENDING)));
        billing(event, registrations).calculateDueSettlements();
        assertEquals(18000L, event.getPayoutAmountCents());
        assertEquals("READY_FOR_PAYOUT", event.getSettlementStatus());
        assertEquals(0L, event.getLateFeeCents());
    }

    @Test
    void historicalRevenueStillUsesTenPercentCommissionAndExistingUnpaidBalanceRule() {
        Event event = settledEvent(100D);
        event.setBalancePaidAt(null);
        event.setBalanceDueCents(1000L);
        EventRegistrationRepository registrations = mock(EventRegistrationRepository.class);
        when(registrations.countTotalParticipantsByEventId(10L)).thenReturn(2);
        when(registrations.findByEventId(10L)).thenReturn(List.of(ticket(2, 100D, EventRegistrationStatus.CONFIRMED)));
        billing(event, registrations).calculateDueSettlements();
        assertEquals(7950L, event.getPayoutAmountCents());
        assertEquals(50L, event.getLateFeeCents());
    }

    private EventBillingService billing(Event event, EventRegistrationRepository registrations) {
        EventRepository events = mock(EventRepository.class);
        when(events.findAll()).thenReturn(List.of(event));
        return new EventBillingService(events, registrations, mock(PaymentQuoteService.class),
                mock(PaymentLifecycleService.class), mock(EventPlanningService.class));
    }

    private Event settledEvent(double currentPrice) {
        Event event = new Event();
        event.setId(10L);
        event.setStatus(EventStatus.PUBLISHED);
        event.setPrice(currentPrice);
        event.setEndDateTime(LocalDateTime.now().minusDays(3));
        event.setSettlementDueAt(event.getEndDateTime().plusHours(48));
        event.setBalancePaidAt(LocalDateTime.now().minusDays(1));
        event.setBalanceDueCents(0L);
        return event;
    }

    private EventRegistration ticket(int participants, double historicalTotal, EventRegistrationStatus status) {
        EventRegistration registration = new EventRegistration();
        registration.setNumberOfParticipants(participants);
        registration.setTotalPrice(historicalTotal);
        registration.setStatus(status);
        return registration;
    }
}
