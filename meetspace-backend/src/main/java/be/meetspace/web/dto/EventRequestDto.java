package be.meetspace.web.dto;

import be.meetspace.entity.EventLocationType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class EventRequestDto {

    @NotBlank(message = "Le titre est requis")
    private String title;

    private String description;

    @NotNull(message = "La date de début est requise")
    private LocalDateTime startDateTime;

    @NotNull(message = "La date de fin est requise")
    private LocalDateTime endDateTime;

    private String location;

    @NotNull(message = "La capacité est requise")
    @Min(value = 1, message = "La capacité doit être d'au moins 1")
    private Integer capacity;

    private Double price;

    private EventLocationType locationType;
    private Long spaceId;
    private String externalAddress;

    private Boolean parkingRequired;
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

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public EventLocationType getLocationType() { return locationType; }
    public void setLocationType(EventLocationType locationType) { this.locationType = locationType; }

    public Long getSpaceId() { return spaceId; }
    public void setSpaceId(Long spaceId) { this.spaceId = spaceId; }

    public String getExternalAddress() { return externalAddress; }
    public void setExternalAddress(String externalAddress) { this.externalAddress = externalAddress; }

    public Boolean getParkingRequired() { return parkingRequired; }
    public void setParkingRequired(Boolean parkingRequired) { this.parkingRequired = parkingRequired; }

    public Double getParkingPrice() { return parkingPrice; }
    public void setParkingPrice(Double parkingPrice) { this.parkingPrice = parkingPrice; }

    public Integer getParkingCapacity() { return parkingCapacity; }
    public void setParkingCapacity(Integer parkingCapacity) { this.parkingCapacity = parkingCapacity; }

}
