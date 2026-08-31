package be.meetspace.web.dto;

import be.meetspace.entity.ParkingAccessPass;
import java.time.LocalDateTime;

public class ParkingAccessPassDto {
    private Long id;
    private String token;
    private String status;
    private LocalDateTime checkedInAt;

    public static ParkingAccessPassDto fromEntity(ParkingAccessPass pass) {
        ParkingAccessPassDto dto = new ParkingAccessPassDto();
        dto.id = pass.getId();
        dto.token = pass.getToken();
        dto.status = pass.getStatus().name();
        dto.checkedInAt = pass.getCheckedInAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getToken() { return token; }
    public String getStatus() { return status; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
}
