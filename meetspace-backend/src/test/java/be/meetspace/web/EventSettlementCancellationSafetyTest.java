package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.service.*;
import be.meetspace.web.controller.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class EventSettlementCancellationSafetyTest {
    final EventRepository events=mock(EventRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final EventPlanningService planning=mock(EventPlanningService.class);
    final EventRegistrationRepository registrations=mock(EventRegistrationRepository.class);
    final User owner=new User();
    final Event event=new Event();
    final UsernamePasswordAuthenticationToken auth=new UsernamePasswordAuthenticationToken("owner@example.test",null);

    EventSettlementCancellationSafetyTest() {
        owner.setId(1L); owner.setRole(Role.ORGANIZER);
        event.setId(10L); event.setCreatedBy(owner); event.setStatus(EventStatus.PUBLISHED);
        event.setEndDateTime(LocalDateTime.now().plusDays(1));
        when(events.findByIdForUpdate(10L)).thenReturn(Optional.of(event));
        when(users.findByEmail(auth.getName())).thenReturn(Optional.of(owner));
    }
    @Test void organizerCannotCancelAnEventThatHasEnded() {
        event.setEndDateTime(LocalDateTime.now().minusHours(1));
        var controller=new OrganizerEventController(events,registrations,users,planning,
                mock(EventBillingService.class),mock(ParkingCapacityService.class),mock(AuditService.class));
        assertThrows(ResponseStatusException.class,()->controller.cancelMyEvent(10L,auth,new MockHttpServletRequest()));
        assertEquals(EventStatus.PUBLISHED,event.getStatus());
        verify(events,never()).save(any());
    }
    @Test void adminCannotCancelAnEventWithARecordedTransfer() {
        owner.setRole(Role.ADMIN); event.setSettlementStatus("PAID");
        var controller=new AdminEventController(events,registrations,mock(ParkingReservationRepository.class),
                users,planning,mock(EventBillingService.class),mock(AuditService.class),mock(NotificationService.class));
        assertThrows(ResponseStatusException.class,()->controller.updateStatus(10L,"CANCELLED",auth,new MockHttpServletRequest()));
        assertEquals(EventStatus.PUBLISHED,event.getStatus());
        verify(events,never()).save(any());
    }
}
