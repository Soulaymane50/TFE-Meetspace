package be.meetspace.web.dto;

import be.meetspace.entity.EventRegistration;

import java.time.LocalDateTime;

public class AdminEventRegistrationDto {

    private Long id;
    private String userName;
    private String userEmail;
    private String eventTitle;
    private LocalDateTime eventDate;
    private Integer numberOfParticipants;
    private Double totalPrice;
    private String status;
    private LocalDateTime createdAt;

    public static AdminEventRegistrationDto fromEntity(EventRegistration r) {
        AdminEventRegistrationDto dto = new AdminEventRegistrationDto();
        dto.id = r.getId();
        dto.userName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();
        dto.eventTitle = r.getEvent().getTitle();
        dto.eventDate = r.getEvent().getStartDateTime();
        dto.numberOfParticipants = r.getNumberOfParticipants();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getUserName() { return userName; }
    public String getUserEmail() { return userEmail; }
    public String getEventTitle() { return eventTitle; }
    public LocalDateTime getEventDate() { return eventDate; }
    public Integer getNumberOfParticipants() { return numberOfParticipants; }
    public Double getTotalPrice() { return totalPrice; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
