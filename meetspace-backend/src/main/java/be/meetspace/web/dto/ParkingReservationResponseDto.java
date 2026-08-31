package be.meetspace.web.dto;

import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.List;

public class ParkingReservationResponseDto {

    private Long id;
    private Long parkingSlotId;
    private String parkingSlotTitle;
    private LocalDate slotDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer reservedSpaces;
    private Double totalPrice;
    private ParkingReservationStatus status;
    private LocalDateTime createdAt;
    private boolean complimentary;
    private List<ParkingAccessPassDto> accessPasses;

    public static ParkingReservationResponseDto fromEntity(ParkingReservation r) {
        ParkingReservationResponseDto dto = new ParkingReservationResponseDto();
        dto.id = r.getId();
        dto.parkingSlotId = r.getParkingSlot().getId();
        dto.parkingSlotTitle = r.getParkingSlot().getTitle();
        dto.slotDate = r.getParkingSlot().getSessionDate();
        dto.startTime = r.getParkingSlot().getStartTime();
        dto.endTime = r.getParkingSlot().getEndTime();
        dto.reservedSpaces = r.getReservedSpaces();
        dto.totalPrice = r.getTotalPrice();
        dto.status = r.getStatus();
        dto.createdAt = r.getCreatedAt();
        dto.complimentary = r.isComplimentary();
        dto.accessPasses = r.getAccessPasses().stream().map(ParkingAccessPassDto::fromEntity).toList();
        return dto;
    }

    public Long getId() { return id; }
    public Long getParkingSlotId() { return parkingSlotId; }
    public String getParkingSlotTitle() { return parkingSlotTitle; }
    public LocalDate getSlotDate() { return slotDate; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public Integer getReservedSpaces() { return reservedSpaces; }
    public Double getTotalPrice() { return totalPrice; }
    public ParkingReservationStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public boolean isComplimentary() { return complimentary; }
    public List<ParkingAccessPassDto> getAccessPasses() { return accessPasses; }
    public Long getSessionId() { return parkingSlotId; }
    @JsonIgnore
    public String getSessionTitle() { return parkingSlotTitle; }
    @JsonIgnore
    public LocalDate getSessionDate() { return slotDate; }
}

