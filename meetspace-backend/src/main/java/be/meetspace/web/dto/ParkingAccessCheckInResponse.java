package be.meetspace.web.dto;

import be.meetspace.entity.ParkingAccessPass;
import java.time.LocalDateTime;

public class ParkingAccessCheckInResponse {
    private Long passId;
    private Long reservationId;
    private String holderName;
    private String sessionTitle;
    private LocalDateTime checkedInAt;
    private boolean alreadyUsed;

    public static ParkingAccessCheckInResponse fromEntity(ParkingAccessPass pass, boolean alreadyUsed) {
        ParkingAccessCheckInResponse dto = new ParkingAccessCheckInResponse();
        dto.passId = pass.getId();
        dto.reservationId = pass.getParkingReservation().getId();
        dto.holderName = pass.getParkingReservation().getUser().getFirstName() + " "
                + pass.getParkingReservation().getUser().getLastName();
        dto.sessionTitle = pass.getParkingReservation().getParkingSlot().getTitle();
        dto.checkedInAt = pass.getCheckedInAt();
        dto.alreadyUsed = alreadyUsed;
        return dto;
    }

    public Long getPassId() { return passId; }
    public Long getReservationId() { return reservationId; }
    public String getHolderName() { return holderName; }
    public String getSessionTitle() { return sessionTitle; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
    public boolean isAlreadyUsed() { return alreadyUsed; }
}
