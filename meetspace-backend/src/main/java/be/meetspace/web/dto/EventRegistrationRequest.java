package be.meetspace.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class EventRegistrationRequest {

    @NotNull
    private Long eventId;

    @NotNull
    @Min(1)
    private Integer numberOfParticipants = 1;

    private String paymentIntentId;

    private boolean addParking = false;

    @Min(1)
    private Integer reservedSpaces;

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public Integer getNumberOfParticipants() { return numberOfParticipants; }
    public void setNumberOfParticipants(Integer numberOfParticipants) { this.numberOfParticipants = numberOfParticipants; }

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }

    public boolean isAddParking() { return addParking; }
    public void setAddParking(boolean addParking) { this.addParking = addParking; }

    public Integer getReservedSpaces() { return reservedSpaces; }
    public void setReservedSpaces(Integer reservedSpaces) { this.reservedSpaces = reservedSpaces; }

}

