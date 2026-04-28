package be.meetspace.web.dto;

import be.meetspace.entity.ParkingReservation;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class AdminParkingReservationDto {

    private Long id;
    private String userName;
    private String userEmail;
    private String parkingSlotTitle;
    private LocalDate slotDate;
    private Integer reservedSpaces;
    private Double totalPrice;
    private String status;
    private LocalDateTime createdAt;

    public static AdminParkingReservationDto fromEntity(ParkingReservation r) {
        AdminParkingReservationDto dto = new AdminParkingReservationDto();
        dto.id = r.getId();
        dto.userName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();
        dto.parkingSlotTitle = r.getParkingSlot().getTitle();
        dto.slotDate = r.getParkingSlot().getSessionDate();
        dto.reservedSpaces = r.getReservedSpaces();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getUserName() { return userName; }
    public String getUserEmail() { return userEmail; }
    public String getParkingSlotTitle() { return parkingSlotTitle; }
    public LocalDate getSlotDate() { return slotDate; }
    public Integer getReservedSpaces() { return reservedSpaces; }
    public Double getTotalPrice() { return totalPrice; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
