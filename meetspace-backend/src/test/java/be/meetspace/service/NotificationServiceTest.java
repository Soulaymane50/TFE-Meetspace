package be.meetspace.service;

import be.meetspace.entity.NotificationTone;
import be.meetspace.entity.User;
import be.meetspace.entity.UserNotification;
import be.meetspace.repository.UserNotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private UserNotificationRepository repository;

    @Test
    void persistsACompleteActionableNotification() {
        User user = new User();
        when(repository.save(any(UserNotification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        NotificationService service = new NotificationService(repository);

        UserNotification notification = service.create(
                user,
                NotificationTone.SUCCESS,
                "Réservation confirmée",
                "Votre salle est réservée.",
                "/my-reservations",
                "Reservation",
                19L);

        assertSame(user, notification.getUser());
        assertEquals(NotificationTone.SUCCESS, notification.getTone());
        assertEquals("Réservation confirmée", notification.getTitle());
        assertEquals("Votre salle est réservée.", notification.getMessage());
        assertEquals("/my-reservations", notification.getPath());
        assertEquals("Reservation", notification.getSourceType());
        assertEquals(19L, notification.getSourceId());
    }
}
