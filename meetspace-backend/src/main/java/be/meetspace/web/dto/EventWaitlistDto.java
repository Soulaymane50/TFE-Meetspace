package be.meetspace.web.dto;

import be.meetspace.entity.EventWaitlistEntry;

import java.time.LocalDateTime;

public record EventWaitlistDto(
        Long id,
        Long eventId,
        String eventTitle,
        LocalDateTime eventStartDateTime,
        Integer participantCount,
        String status,
        LocalDateTime createdAt
) {
    public static EventWaitlistDto fromEntity(EventWaitlistEntry entry) {
        return new EventWaitlistDto(
                entry.getId(),
                entry.getEvent().getId(),
                entry.getEvent().getTitle(),
                entry.getEvent().getStartDateTime(),
                entry.getParticipantCount(),
                entry.getStatus().name(),
                entry.getCreatedAt()
        );
    }
}
