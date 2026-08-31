package be.meetspace.web.dto;

import jakarta.validation.constraints.NotBlank;

public class ParkingAccessCheckInRequest {
    @NotBlank
    private String pass;
    public String getPass() { return pass; }
    public void setPass(String pass) { this.pass = pass; }
}
