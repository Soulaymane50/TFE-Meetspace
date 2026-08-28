package be.meetspace.web.dto;

import be.meetspace.entity.EventRegistration;

import java.time.LocalDateTime;

public class EventCheckInResponseDto {

    private Long registrationId;
    private Long eventId;
    private String attendeeName;
    private Integer numberOfParticipants;
    private LocalDateTime checkedInAt;
    private boolean alreadyCheckedIn;

    public static EventCheckInResponseDto fromEntity(EventRegistration registration, boolean alreadyCheckedIn) {
        EventCheckInResponseDto dto = new EventCheckInResponseDto();
        dto.registrationId = registration.getId();
        dto.eventId = registration.getEvent().getId();
        dto.attendeeName = registration.getUser().getFirstName() + " " + registration.getUser().getLastName();
        dto.numberOfParticipants = registration.getNumberOfParticipants();
        dto.checkedInAt = registration.getCheckedInAt();
        dto.alreadyCheckedIn = alreadyCheckedIn;
        return dto;
    }

    public Long getRegistrationId() {
        return registrationId;
    }

    public Long getEventId() {
        return eventId;
    }

    public String getAttendeeName() {
        return attendeeName;
    }

    public Integer getNumberOfParticipants() {
        return numberOfParticipants;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public boolean isAlreadyCheckedIn() {
        return alreadyCheckedIn;
    }
}
