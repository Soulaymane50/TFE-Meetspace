package be.meetspace.web.dto;

import be.meetspace.entity.Reservation;

import java.time.LocalDateTime;

public class AdminSpaceReservationDto {

    private Long id;
    private String userName;
    private String userEmail;
    private String espaceName;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private Double totalPrice;
    private String status;
    private LocalDateTime createdAt;

    public static AdminSpaceReservationDto fromEntity(Reservation r) {
        AdminSpaceReservationDto dto = new AdminSpaceReservationDto();
        dto.id = r.getId();
        dto.userName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();
        dto.espaceName = r.getEspace().getName();
        dto.startDateTime = r.getStartDateTime();
        dto.endDateTime = r.getEndDateTime();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getUserName() { return userName; }
    public String getUserEmail() { return userEmail; }
    public String getEspaceName() { return espaceName; }
    public LocalDateTime getStartDateTime() { return startDateTime; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public Double getTotalPrice() { return totalPrice; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
