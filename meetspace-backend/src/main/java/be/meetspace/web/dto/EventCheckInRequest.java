package be.meetspace.web.dto;

import jakarta.validation.constraints.NotBlank;

public class EventCheckInRequest {

    @NotBlank(message = "Le code du billet est requis")
    private String ticket;

    public String getTicket() {
        return ticket;
    }

    public void setTicket(String ticket) {
        this.ticket = ticket;
    }
}
