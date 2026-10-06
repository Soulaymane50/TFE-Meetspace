package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class FinancialSummaryBatchTest {
    final EventRepository events = mock(EventRepository.class);
    final EventRegistrationRepository registrations = mock(EventRegistrationRepository.class);
    final EspaceRepository spaces = mock(EspaceRepository.class);
    final ReservationRepository rooms = mock(ReservationRepository.class);
    final ParkingReservationRepository parking = mock(ParkingReservationRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final FinanceTransactionMetricsService metrics = mock(FinanceTransactionMetricsService.class);
    final FinancialSummaryService service = new FinancialSummaryService(events, spaces, registrations, rooms, parking, users, metrics);

    @Test
    void batchesRegistrationsWithoutChangingParticipantsCommissionOrTechnicalExclusions() {
        Event first = event(1L, EventStatus.PUBLISHED), second = event(2L, EventStatus.PUBLISHED);
        Event cancelled = event(3L, EventStatus.CANCELLED);
        when(events.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(first, second, cancelled));
        List<EventRegistration> fixture = List.of(
                registration(first, 2, EventRegistrationStatus.CONFIRMED, false),
                registration(first, 8, EventRegistrationStatus.CANCELLED, false),
                registration(second, 5, EventRegistrationStatus.CONFIRMED, true),
                registration(second, 3, EventRegistrationStatus.CONFIRMED, false));
        when(registrations.findByEventIdsForFinance(List.of(1L, 2L))).thenReturn(fixture);
        stubMetrics();
        var summary = service.getAdminSummary(null, null);
        assertThat(summary.getEventCount()).isEqualTo(2);
        assertThat(summary.getConfirmedRegistrations()).isEqualTo(2);
        assertThat(summary.getConfirmedParticipants()).isEqualTo(5);
        assertThat(summary.getEventGrossRevenue()).isEqualTo(100D);
        assertThat(summary.getEventCommissionRevenue()).isEqualTo(10D);
        verify(registrations, times(1)).findByEventIdsForFinance(List.of(1L, 2L));
        verify(registrations, never()).findByEventId(anyLong());
    }

    @Test
    void retainsPeriodRuleWhenAnOlderEventHasARegistrationInTheSelectedPeriod() {
        Event first = event(1L, EventStatus.PUBLISHED), empty = event(2L, EventStatus.PUBLISHED);
        when(events.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(first, empty));
        List<EventRegistration> fixture = List.of(registration(first, 2, EventRegistrationStatus.CONFIRMED, false));
        when(registrations.findByEventIdsForFinance(List.of(1L, 2L))).thenReturn(fixture);
        stubMetrics();
        var summary = service.getAdminSummary(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31));
        assertThat(summary.getEventCount()).isEqualTo(1);
        assertThat(summary.getConfirmedParticipants()).isEqualTo(2);
        assertThat(summary.getEventGrossRevenue()).isEqualTo(40D);
    }

    @Test
    void emptyCatalogueDoesNotIssueAnEmptyInQuery() {
        stubMetrics();
        assertThat(service.getAdminSummary(null, null).getEventCount()).isZero();
        verify(registrations, never()).findByEventIdsForFinance(anyList());
    }

    private void stubMetrics() {
        when(metrics.forAdmin(any(), any())).thenReturn(new FinanceTransactionMetricsService.Metrics(
                null, null, 0, 0, 0, 0, 0, 0.21, 0, 0, 0));
    }
    private Event event(Long id, EventStatus status) {
        Event e = new Event(); e.setId(id); e.setTitle("Conférence " + id); e.setStatus(status);
        e.setPrice(20D); e.setCapacity(20); e.setCreatedAt(LocalDateTime.of(2026, 8, 1, 9, 0));
        e.setStartDateTime(LocalDateTime.of(2026, 10, 20, 9, 0)); e.setEndDateTime(e.getStartDateTime().plusHours(2));
        return e;
    }
    private EventRegistration registration(Event event, int count, EventRegistrationStatus status, boolean technical) {
        EventRegistration r = mock(EventRegistration.class);
        User u = new User(); u.setTechnicalAccount(technical); u.setEmail("member@example.com");
        when(r.getUser()).thenReturn(u); when(r.getEvent()).thenReturn(event); when(r.getStatus()).thenReturn(status);
        when(r.getNumberOfParticipants()).thenReturn(count); when(r.getCreatedAt()).thenReturn(LocalDateTime.of(2026, 10, 5, 10, 0));
        return r;
    }
}
