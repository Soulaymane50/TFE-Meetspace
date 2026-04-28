package be.meetspace.web.dto;

import jakarta.validation.constraints.NotBlank;

public class PayReservationRequest {

    @NotBlank
    private String paymentIntentId;

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }
}

