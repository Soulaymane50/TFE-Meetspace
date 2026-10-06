package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.controller.OrganizerEventController;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class OrganizerEventBatchReadTest {
    final EventRepository events = mock(EventRepository.class);
    final EventRegistrationRepository registrations = mock(EventRegistrationRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final ParkingCapacityService capacities = mock(ParkingCapacityService.class);
    final OrganizerEventController controller = new OrganizerEventController(events, registrations, users,
            null, null, capacities, null);
    final UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("owner@example.invalid", null);

    User owner() {
        User owner = new User(); owner.setId(1L); owner.setRole(Role.ORGANIZER);
        when(users.findByEmail(auth.getName())).thenReturn(Optional.of(owner));
        return owner;
    }

    @Test
    void loadsParticipantsAndSharedParkingTogetherAndPreservesClosedSessions() {
        owner();
        ParkingSlot open = new ParkingSlot(); open.setId(11L); open.setStatus(ParkingSlotStatus.OPEN); open.setCapacity(100);
        ParkingSlot closed = new ParkingSlot(); closed.setId(12L); closed.setStatus(ParkingSlotStatus.FULL); closed.setCapacity(50);
        Event first = new Event(); first.setId(1L); first.setCapacity(20); first.setParkingSlot(open);
        Event second = new Event(); second.setId(2L); second.setCapacity(50); second.setParkingSlot(closed);
        Event withoutParking = new Event(); withoutParking.setId(3L); withoutParking.setCapacity(40);
        when(events.findByCreatedByIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(first, second, withoutParking));
        var row = mock(EventRegistrationRepository.ParticipantsByEvent.class);
        when(row.getEventId()).thenReturn(1L); when(row.getParticipantCount()).thenReturn(7L);
        when(registrations.sumParticipantsByEventIds(List.of(1L, 2L, 3L))).thenReturn(List.of(row));
        when(capacities.snapshots(List.of(open, closed))).thenReturn(Map.of(11L,
                new ParkingCapacityService.CapacitySnapshot(150, 90, 12, 20, 78, 130)));
        var result = controller.getMyEvents(auth);
        assertThat(result).extracting(r -> r.getRegisteredCount()).containsExactly(7, 0, 0);
        assertThat(result).extracting(r -> r.getAvailablePlaces()).containsExactly(13, 50, 40);
        assertThat(result.get(0).getParkingCapacity()).isEqualTo(90);
        assertThat(result.get(0).getParkingAvailableSpaces()).isEqualTo(78);
        assertThat(result.get(0).getGlobalParkingRemainingSpaces()).isEqualTo(130);
        assertThat(result.get(1).getParkingCapacity()).isZero();
        assertThat(result.get(1).getParkingAvailableSpaces()).isZero();
        assertThat(result.get(1).getPhysicalParkingCapacity()).isEqualTo(150);
        assertThat(result.get(2).getParkingSlotId()).isNull();
        verify(registrations).sumParticipantsByEventIds(List.of(1L, 2L, 3L));
        verify(registrations, never()).countTotalParticipantsByEventId(anyLong());
        verify(capacities).snapshots(List.of(open, closed));
        verify(capacities, never()).snapshot(any());
    }

    @Test
    void emptyOrganizerDoesNotReadParticipantsOrParking() {
        owner();
        assertThat(controller.getMyEvents(auth)).isEmpty();
        verifyNoInteractions(registrations, capacities);
    }
}
