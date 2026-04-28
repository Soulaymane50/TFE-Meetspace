package be.meetspace.web.dto;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class ParkingSlotResponseDto {

    private Long id;
    private String title;
    private String description;
    private LocalDate slotDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer parkingCapacity;
    private Integer registeredSpaces;
    private Integer availableSpaces;
    private Double parkingRate;
    private ParkingSlotStatus status;
    private LocalDateTime createdAt;
    private Long eventId;

    public static ParkingSlotResponseDto fromEntity(ParkingSlot s) {
        ParkingSlotResponseDto dto = new ParkingSlotResponseDto();
        dto.id = s.getId();
        dto.title = s.getTitle();
        dto.description = s.getDescription();
        dto.slotDate = s.getSessionDate();
        dto.startTime = s.getStartTime();
        dto.endTime = s.getEndTime();
        dto.parkingCapacity = s.getCapacity();
        dto.parkingRate = s.getParkingRate();
        dto.status = s.getStatus();
        dto.createdAt = s.getCreatedAt();
        dto.eventId = s.getEvent() != null ? s.getEvent().getId() : null;
        return dto;
    }

    public static ParkingSlotResponseDto fromEntity(ParkingSlot s, Integer registeredCount) {
        ParkingSlotResponseDto dto = fromEntity(s);
        dto.registeredSpaces = registeredCount;
        dto.availableSpaces = s.getCapacity() - registeredCount;
        return dto;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public LocalDate getSlotDate() { return slotDate; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public Integer getParkingCapacity() { return parkingCapacity; }
    public Integer getRegisteredSpaces() { return registeredSpaces; }
    public Integer getAvailableSpaces() { return availableSpaces; }
    public Double getParkingRate() { return parkingRate; }
    public ParkingSlotStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getEventId() { return eventId; }
}

