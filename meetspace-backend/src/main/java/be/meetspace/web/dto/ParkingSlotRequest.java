package be.meetspace.web.dto;

import be.meetspace.entity.ParkingSlotStatus;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public class ParkingSlotRequest {

    @NotBlank
    @Size(min = 3, max = 150)
    private String title;

    @NotBlank
    @Size(min = 10, max = 500)
    private String description;

    @NotNull
    @FutureOrPresent
    private LocalDate slotDate;

    @NotNull
    private LocalTime startTime;

    @NotNull
    private LocalTime endTime;

    @NotNull
    @Min(1)
    @Max(150)
    private Integer parkingCapacity;

    @NotNull
    @Min(0)
    private Double parkingRate;

    @NotNull
    private ParkingSlotStatus status;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getSlotDate() { return slotDate; }
    public void setSlotDate(LocalDate slotDate) { this.slotDate = slotDate; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getParkingCapacity() { return parkingCapacity; }
    public void setParkingCapacity(Integer parkingCapacity) { this.parkingCapacity = parkingCapacity; }

    public Double getParkingRate() { return parkingRate; }
    public void setParkingRate(Double parkingRate) { this.parkingRate = parkingRate; }

    public ParkingSlotStatus getStatus() { return status; }
    public void setStatus(ParkingSlotStatus status) { this.status = status; }

}

