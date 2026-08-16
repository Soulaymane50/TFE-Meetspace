package be.meetspace.service;

import be.meetspace.entity.NotificationTone;
import be.meetspace.entity.User;
import be.meetspace.entity.UserNotification;
import be.meetspace.repository.UserNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final UserNotificationRepository notificationRepository;

    public NotificationService(UserNotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public UserNotification create(
            User user,
            NotificationTone tone,
            String title,
            String message,
            String path,
            String sourceType,
            Long sourceId
    ) {
        UserNotification notification = new UserNotification();
        notification.setUser(user);
        notification.setTone(tone);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setPath(path);
        notification.setSourceType(sourceType);
        notification.setSourceId(sourceId);
        return notificationRepository.save(notification);
    }
}
