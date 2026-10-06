package be.meetspace.web;

import be.meetspace.entity.Event;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminEventController;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AdminEventBatchReadTest {
    final EventRepository events = mock(EventRepository.class);
    final EventRegistrationRepository registrations = mock(EventRegistrationRepository.class);
    final AdminEventController controller = new AdminEventController(events, registrations,
            mock(ParkingReservationRepository.class), mock(UserRepository.class), null, null, null, null);

    @Test
    void countsAllEventsInOneGroupedQueryAndUsesZeroForAnEmptyEvent() {
        Event first = new Event(); first.setId(1L); first.setCapacity(20);
        Event second = new Event(); second.setId(2L); second.setCapacity(50);
        when(events.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(first, second));
        var total = mock(EventRegistrationRepository.ParticipantsByEvent.class);
        when(total.getEventId()).thenReturn(1L); when(total.getParticipantCount()).thenReturn(7L);
        when(registrations.sumParticipantsByEventIds(List.of(1L, 2L))).thenReturn(List.of(total));
        var result = controller.getAllEvents();
        assertThat(result).extracting(r -> r.getRegisteredCount()).containsExactly(7, 0);
        assertThat(result).extracting(r -> r.getAvailablePlaces()).containsExactly(13, 50);
        verify(registrations, times(1)).sumParticipantsByEventIds(List.of(1L, 2L));
        verify(registrations, never()).countTotalParticipantsByEventId(anyLong());
    }
    @Test
    void emptyEventListDoesNotQueryParticipants() {
        assertThat(controller.getAllEvents()).isEmpty();
        verifyNoInteractions(registrations);
    }
}
