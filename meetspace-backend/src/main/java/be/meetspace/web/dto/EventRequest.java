package be.meetspace.web.dto;

import be.meetspace.entity.EventLocationType;
import be.meetspace.entity.EventStatus;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class EventRequest {

    @NotBlank
    @Size(min = 3, max = 150)
    private String title;

    @NotBlank
    @Size(min = 10, max = 500)
    private String description;

    @NotNull
    @Future
    private LocalDateTime startDateTime;

    @NotNull
    @Future
    private LocalDateTime endDateTime;

    private Integer capacity;

    private Double price;

    @NotNull
    private EventStatus status;

    private EventLocationType locationType;
    private Long spaceId;
    private String externalAddress;
    private String location;

    private boolean parkingRequired;
    private Double parkingPrice;
    private Integer parkingCapacity;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getStartDateTime() { return startDateTime; }
    public void setStartDateTime(LocalDateTime startDateTime) { this.startDateTime = startDateTime; }

    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public EventStatus getStatus() { return status; }
    public void setStatus(EventStatus status) { this.status = status; }

    public EventLocationType getLocationType() { return locationType; }
    public void setLocationType(EventLocationType locationType) { this.locationType = locationType; }

    public Long getSpaceId() { return spaceId; }
    public void setSpaceId(Long spaceId) { this.spaceId = spaceId; }

    public String getExternalAddress() { return externalAddress; }
    public void setExternalAddress(String externalAddress) { this.externalAddress = externalAddress; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public boolean isParkingRequired() { return parkingRequired; }
    public void setParkingRequired(boolean parkingRequired) { this.parkingRequired = parkingRequired; }

    public Double getParkingPrice() { return parkingPrice; }
    public void setParkingPrice(Double parkingPrice) { this.parkingPrice = parkingPrice; }

    public Integer getParkingCapacity() { return parkingCapacity; }
    public void setParkingCapacity(Integer parkingCapacity) { this.parkingCapacity = parkingCapacity; }

}

