package be.meetspace.service;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventWaitlistEntry;
import be.meetspace.entity.EventWaitlistStatus;
import be.meetspace.entity.NotificationTone;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventWaitlistRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventWaitlistServiceTest {

    @Mock
    private EventWaitlistRepository waitlistRepository;
    @Mock
    private EventRegistrationRepository registrationRepository;
    @Mock
    private NotificationService notificationService;

    private EventWaitlistService service;

    @BeforeEach
    void setUp() {
        service = new EventWaitlistService(waitlistRepository, registrationRepository, notificationService);
    }

    @Test
    void offersTheFirstCompatibleRequestWithoutSkippingTheQueueSilently() {
        Event event = new Event();
        event.setId(42L);
        event.setTitle("Forum durable");
        event.setCapacity(10);

        EventWaitlistEntry oversized = entry(new User(), event, 3);
        User compatibleUser = new User();
        EventWaitlistEntry compatible = entry(compatibleUser, event, 2);

        when(registrationRepository.countTotalParticipantsByEventId(42L)).thenReturn(8);
        when(waitlistRepository.findByEventIdAndStatusOrderByCreatedAtAsc(42L, EventWaitlistStatus.WAITING))
                .thenReturn(List.of(oversized, compatible));

        service.offerAvailablePlaces(event);

        assertEquals(EventWaitlistStatus.WAITING, oversized.getStatus());
        assertEquals(EventWaitlistStatus.OFFERED, compatible.getStatus());
        verify(waitlistRepository).save(compatible);
        verify(notificationService).create(
                eq(compatibleUser),
                eq(NotificationTone.ACTION),
                eq("Une place est disponible"),
                any(String.class),
                eq("/events/register/42"),
                eq("EventWaitlist"),
                eq(compatible.getId()));
    }

    @Test
    void doesNotOfferWhenTheEventIsStillFull() {
        Event event = new Event();
        event.setId(7L);
        event.setCapacity(4);
        when(registrationRepository.countTotalParticipantsByEventId(7L)).thenReturn(4);

        service.offerAvailablePlaces(event);

        verify(waitlistRepository, never()).findByEventIdAndStatusOrderByCreatedAtAsc(any(), any());
        verify(notificationService, never()).create(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void marksAnExistingWaitlistRequestAsFulfilledAfterRegistration() {
        User user = new User();
        Event event = new Event();
        EventWaitlistEntry existing = entry(user, event, 1);
        existing.setStatus(EventWaitlistStatus.OFFERED);
        when(waitlistRepository.findByUserAndEvent(user, event)).thenReturn(Optional.of(existing));

        service.markFulfilled(user, event);

        assertEquals(EventWaitlistStatus.FULFILLED, existing.getStatus());
        verify(waitlistRepository).save(existing);
    }

    private static EventWaitlistEntry entry(User user, Event event, int participants) {
        EventWaitlistEntry entry = new EventWaitlistEntry();
        entry.setUser(user);
        entry.setEvent(event);
        entry.setParticipantCount(participants);
        return entry;
    }
}
