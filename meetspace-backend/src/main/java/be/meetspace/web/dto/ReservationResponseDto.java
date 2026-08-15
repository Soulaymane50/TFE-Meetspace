package be.meetspace.web.dto;

import be.meetspace.entity.Reservation;
import be.meetspace.entity.ReservationStatus;

import java.time.LocalDateTime;

public class ReservationResponseDto {

    private Long id;
    private UserResponseDto user;
    private EspaceResponseDto espace;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private Double totalPrice;
    private ReservationStatus status;
    private String justification;
    private String rejectionReason;
    private LocalDateTime approvedAt;
    private LocalDateTime paymentDueAt;
    private LocalDateTime createdAt;

    public static ReservationResponseDto fromEntity(Reservation reservation) {
        ReservationResponseDto dto = new ReservationResponseDto();
        dto.id = reservation.getId();
        dto.user = UserResponseDto.fromEntity(reservation.getUser());
        dto.espace = EspaceResponseDto.fromEntity(reservation.getEspace());
        dto.startDateTime = reservation.getStartDateTime();
        dto.endDateTime = reservation.getEndDateTime();
        dto.totalPrice = reservation.getTotalPrice();
        dto.status = reservation.getStatus();
        dto.justification = reservation.getJustification();
        dto.rejectionReason = reservation.getRejectionReason();
        dto.approvedAt = reservation.getApprovedAt();
        dto.paymentDueAt = reservation.getPaymentDueAt();
        dto.createdAt = reservation.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public UserResponseDto getUser() { return user; }
    public EspaceResponseDto getEspace() { return espace; }
    public LocalDateTime getStartDateTime() { return startDateTime; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public Double getTotalPrice() { return totalPrice; }
    public ReservationStatus getStatus() { return status; }
    public String getJustification() { return justification; }
    public String getRejectionReason() { return rejectionReason; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public LocalDateTime getPaymentDueAt() { return paymentDueAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}

