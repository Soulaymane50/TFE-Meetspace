package be.meetspace.web.controller;

import be.meetspace.entity.User;
import be.meetspace.entity.UserNotification;
import be.meetspace.repository.UserNotificationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.web.dto.UserNotificationDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user/notifications")
public class UserNotificationController {

    private final UserRepository userRepository;
    private final UserNotificationRepository notificationRepository;

    public UserNotificationController(
            UserRepository userRepository,
            UserNotificationRepository notificationRepository
    ) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication
    ) {
        User user = requireUser(authentication);
        int safeLimit = Math.max(1, Math.min(limit, 50));
        List<UserNotificationDto> items = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, safeLimit))
                .stream()
                .map(UserNotificationDto::fromEntity)
                .toList();
        return Map.of(
                "items", items,
                "unreadCount", notificationRepository.countByUserIdAndReadAtIsNull(user.getId())
        );
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public UserNotificationDto markRead(@PathVariable Long id, Authentication authentication) {
        User user = requireUser(authentication);
        UserNotification notification = notificationRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }
        return UserNotificationDto.fromEntity(notification);
    }

    @PatchMapping("/read-all")
    @Transactional
    public Map<String, Integer> markAllRead(Authentication authentication) {
        User user = requireUser(authentication);
        int updated = notificationRepository.markAllRead(user.getId(), LocalDateTime.now());
        return Map.of("updated", updated);
    }

    private User requireUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
    }
}
