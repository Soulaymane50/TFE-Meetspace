package be.meetspace.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ParkingReservationRequest {

    @NotNull
    private Long parkingSlotId;

    @NotNull
    @Min(1)
    private Integer reservedSpaces;

    @NotBlank
    private String paymentIntentId;

    public Long getParkingSlotId() { return parkingSlotId; }
    public void setParkingSlotId(Long parkingSlotId) { this.parkingSlotId = parkingSlotId; }

    public Integer getReservedSpaces() { return reservedSpaces; }
    public void setReservedSpaces(Integer reservedSpaces) {
        this.reservedSpaces = reservedSpaces;
    }

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) {
        this.paymentIntentId = paymentIntentId;
    }
}
