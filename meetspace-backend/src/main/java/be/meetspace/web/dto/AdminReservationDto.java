package be.meetspace.web.dto;

import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.Reservation;

import java.time.LocalDateTime;

public class AdminReservationDto {

    public enum ReservationType {
        ESPACE, EVENT, PARKING
    }

    private Long id;
    private ReservationType type;
    private String typeName;

    private Long userId;
    private String userFullName;
    private String userEmail;

    private String itemName;
    private String dateInfo;
    private Integer quantity;
    private Double totalPrice;
    private String status;
    private LocalDateTime createdAt;

    private String paymentIntentId;
    private boolean isPaid;

    public static AdminReservationDto fromEspaceReservation(Reservation r) {
        AdminReservationDto dto = new AdminReservationDto();
        dto.id = r.getId();
        dto.type = ReservationType.ESPACE;
        dto.typeName = "Espace";

        dto.userId = r.getUser().getId();
        dto.userFullName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();

        dto.itemName = r.getEspace().getName();
        dto.dateInfo = formatDateTime(r.getStartDateTime()) + " → " + formatDateTime(r.getEndDateTime());
        dto.quantity = null;
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();

        dto.paymentIntentId = r.getPaymentIntentId();
        dto.isPaid = r.getPaymentIntentId() != null && !r.getPaymentIntentId().isBlank();

        return dto;
    }

    public static AdminReservationDto fromEventRegistration(EventRegistration r) {
        AdminReservationDto dto = new AdminReservationDto();
        dto.id = r.getId();
        dto.type = ReservationType.EVENT;
        dto.typeName = "Événement";

        dto.userId = r.getUser().getId();
        dto.userFullName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();

        dto.itemName = r.getEvent().getTitle();
        dto.dateInfo = formatDateTime(r.getEvent().getStartDateTime());
        dto.quantity = r.getNumberOfParticipants();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();

        dto.paymentIntentId = r.getPaymentIntentId();
        dto.isPaid = r.getPaymentIntentId() != null && !r.getPaymentIntentId().isBlank();

        return dto;
    }

    public static AdminReservationDto fromParkingReservation(ParkingReservation r) {
        AdminReservationDto dto = new AdminReservationDto();
        dto.id = r.getId();
        dto.type = ReservationType.PARKING;
        dto.typeName = "Parking";

        dto.userId = r.getUser().getId();
        dto.userFullName = r.getUser().getFirstName() + " " + r.getUser().getLastName();
        dto.userEmail = r.getUser().getEmail();

        dto.itemName = r.getParkingSlot().getTitle();
        dto.dateInfo = r.getParkingSlot().getSessionDate().toString() + " " +
                r.getParkingSlot().getStartTime() + "-" + r.getParkingSlot().getEndTime();
        dto.quantity = r.getReservedSpaces();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus().name();
        dto.createdAt = r.getCreatedAt();

        dto.paymentIntentId = r.getPaymentIntentId();
        dto.isPaid = r.getPaymentIntentId() != null && !r.getPaymentIntentId().isBlank();

        return dto;
    }

    private static String formatDateTime(LocalDateTime dt) {
        if (dt == null) return "";
        return dt.toLocalDate().toString() + " " +
                String.format("%02d:%02d", dt.getHour(), dt.getMinute());
    }

    public Long getId() { return id; }
    public ReservationType getType() { return type; }
    public String getTypeName() { return typeName; }
    public Long getUserId() { return userId; }
    public String getUserFullName() { return userFullName; }
    public String getUserEmail() { return userEmail; }
    public String getItemName() { return itemName; }
    public String getDateInfo() { return dateInfo; }
    public Integer getQuantity() { return quantity; }
    public Double getTotalPrice() { return totalPrice; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getPaymentIntentId() { return paymentIntentId; }
    public boolean isPaid() { return isPaid; }
}
