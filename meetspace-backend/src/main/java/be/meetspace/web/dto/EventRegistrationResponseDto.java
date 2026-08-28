package be.meetspace.web.dto;

import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventRegistrationStatus;

import java.time.LocalDateTime;

public class EventRegistrationResponseDto {

    private Long id;
    private Long eventId;
    private String eventTitle;
    private LocalDateTime eventStartDateTime;
    private LocalDateTime eventEndDateTime;
    private Integer numberOfParticipants;
    private Double totalPrice;
    private EventRegistrationStatus status;
    private LocalDateTime createdAt;
    private String ticketToken;
    private LocalDateTime checkedInAt;

    public static EventRegistrationResponseDto fromEntity(EventRegistration registration) {
        EventRegistrationResponseDto dto = new EventRegistrationResponseDto();
        dto.id = registration.getId();
        dto.eventId = registration.getEvent().getId();
        dto.eventTitle = registration.getEvent().getTitle();
        dto.eventStartDateTime = registration.getEvent().getStartDateTime();
        dto.eventEndDateTime = registration.getEvent().getEndDateTime();
        dto.numberOfParticipants = registration.getNumberOfParticipants();
        dto.totalPrice = registration.getTotalPrice();
        dto.status = registration.getStatus();
        dto.createdAt = registration.getCreatedAt();
        dto.ticketToken = registration.getTicketToken();
        dto.checkedInAt = registration.getCheckedInAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public String getEventTitle() { return eventTitle; }
    public LocalDateTime getEventStartDateTime() { return eventStartDateTime; }
    public LocalDateTime getEventEndDateTime() { return eventEndDateTime; }
    public Integer getNumberOfParticipants() { return numberOfParticipants; }
    public Double getTotalPrice() { return totalPrice; }
    public EventRegistrationStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getTicketToken() { return ticketToken; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
}

