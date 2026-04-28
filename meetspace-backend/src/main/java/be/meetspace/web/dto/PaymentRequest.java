package be.meetspace.web.dto;

public class PaymentRequest {
    private Long amount;
    private String currency;
    private String description;
    private String reservationType;
    private Long reservationId;
    private Double hours;
    private Integer numberOfParticipants;

    private Long parkingSlotId;
    private Long eventId;
    private Long espaceId;
    private Integer reservedSpaces;

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getReservationType() { return reservationType; }
    public void setReservationType(String reservationType) { this.reservationType = reservationType; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public Double getHours() { return hours; }
    public void setHours(Double hours) { this.hours = hours; }

    public Integer getNumberOfParticipants() { return numberOfParticipants; }
    public void setNumberOfParticipants(Integer numberOfParticipants) { this.numberOfParticipants = numberOfParticipants; }

    public Long getParkingSlotId() { return parkingSlotId; }
    public void setParkingSlotId(Long parkingSlotId) { this.parkingSlotId = parkingSlotId; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public Long getEspaceId() { return espaceId; }
    public void setEspaceId(Long espaceId) { this.espaceId = espaceId; }

    public Integer getReservedSpaces() { return reservedSpaces; }
    public void setReservedSpaces(Integer reservedSpaces) { this.reservedSpaces = reservedSpaces; }

}

