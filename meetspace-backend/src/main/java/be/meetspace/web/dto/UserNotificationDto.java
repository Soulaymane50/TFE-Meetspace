package be.meetspace.web.dto;

import be.meetspace.entity.UserNotification;

import java.time.LocalDateTime;

public record UserNotificationDto(
        Long id,
        String tone,
        String title,
        String message,
        String path,
        String sourceType,
        Long sourceId,
        LocalDateTime createdAt,
        LocalDateTime readAt
) {
    public static UserNotificationDto fromEntity(UserNotification notification) {
        return new UserNotificationDto(
                notification.getId(),
                notification.getTone().name().toLowerCase(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getPath(),
                notification.getSourceType(),
                notification.getSourceId(),
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }
}
