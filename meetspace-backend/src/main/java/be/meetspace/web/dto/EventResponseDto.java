package be.meetspace.web.dto;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventLocationType;
import be.meetspace.entity.ParkingSlot;

import java.time.LocalDateTime;

public class EventResponseDto {

    private Long id;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private String location;
    private EventLocationType locationType;
    private Long spaceId;
    private String externalAddress;
    private Integer capacity;
    private Double price;
    private String status;
    private Integer registeredCount;
    private Integer availablePlaces;

    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;

    private LocalDateTime approvedAt;
    private String approvedByName;
    private String rejectionReason;

    private boolean parkingRequired;
    private Long parkingSlotId;
    private Double parkingPrice;
    private Integer parkingCapacity;
    private Integer parkingAvailableSpaces;
    private Integer physicalParkingCapacity;
    private Integer globalParkingRemainingSpaces;
    private boolean sharedParkingInventory;
    private Long roomCostCents;
    private Long depositAmountCents;
    private LocalDateTime depositDueAt;
    private LocalDateTime depositPaidAt;
    private Long balanceDueCents;
    private LocalDateTime balancePaidAt;
    private LocalDateTime settlementDueAt;
    private Long lateFeeCents;
    private Long payoutAmountCents;
    private String settlementStatus;

    public static EventResponseDto fromEntity(Event e) {
        return fromEntity(e, 0);
    }

    public static EventResponseDto fromEntity(Event e, Integer registeredCount) {
        return fromEntity(e, registeredCount, 0);
    }

    public static EventResponseDto fromEntity(Event e, Integer registeredCount, Integer reservedParkingSpaces) {
        EventResponseDto dto = new EventResponseDto();
        dto.id = e.getId();
        dto.title = e.getTitle();
        dto.description = e.getDescription();
        dto.startDateTime = e.getStartDateTime();
        dto.endDateTime = e.getEndDateTime();
        dto.location = e.getLocation();
        dto.locationType = e.getLocationType();
        dto.spaceId = e.getSpace() != null ? e.getSpace().getId() : null;
        dto.externalAddress = e.getExternalAddress();
        dto.capacity = e.getCapacity();
        dto.price = e.getPrice();
        dto.status = e.getStatus().name();
        dto.registeredCount = registeredCount;
        dto.availablePlaces = e.getCapacity() != null ? e.getCapacity() - registeredCount : null;
        dto.createdAt = e.getCreatedAt();

        if (e.getCreatedBy() != null) {
            dto.createdById = e.getCreatedBy().getId();
            dto.createdByName = e.getCreatedBy().getFirstName() + " " + e.getCreatedBy().getLastName();
        }

        dto.approvedAt = e.getApprovedAt();
        if (e.getApprovedBy() != null) {
            dto.approvedByName = e.getApprovedBy().getFirstName() + " " + e.getApprovedBy().getLastName();
        }
        dto.rejectionReason = e.getRejectionReason();
        dto.roomCostCents = e.getRoomCostCents();
        dto.depositAmountCents = e.getDepositAmountCents();
        dto.depositDueAt = e.getDepositDueAt();
        dto.depositPaidAt = e.getDepositPaidAt();
        dto.balanceDueCents = e.getBalanceDueCents();
        dto.balancePaidAt = e.getBalancePaidAt();
        dto.settlementDueAt = e.getSettlementDueAt();
        dto.lateFeeCents = e.getLateFeeCents();
        dto.payoutAmountCents = e.getPayoutAmountCents();
        dto.settlementStatus = e.getSettlementStatus();

        dto.parkingRequired = e.isParkingRequired();
        ParkingSlot parkingSlot = e.getParkingSlot();
        if (parkingSlot != null) {
            dto.parkingSlotId = parkingSlot.getId();
            dto.parkingPrice = parkingSlot.getParkingRate();
            dto.parkingCapacity = parkingSlot.getCapacity();
            int reserved = reservedParkingSpaces != null ? reservedParkingSpaces : 0;
            dto.parkingAvailableSpaces = Math.max(0, parkingSlot.getCapacity() - reserved);
        }

        return dto;
    }

    public EventResponseDto applyParkingCapacity(Integer allocatedSpaces, Integer availableSpaces,
                                                  Integer physicalCapacity, Integer globalRemainingSpaces) {
        this.parkingCapacity = allocatedSpaces;
        this.parkingAvailableSpaces = availableSpaces;
        this.physicalParkingCapacity = physicalCapacity;
        this.globalParkingRemainingSpaces = globalRemainingSpaces;
        this.sharedParkingInventory = true;
        return this;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public LocalDateTime getStartDateTime() { return startDateTime; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
    public String getLocation() { return location; }
    public EventLocationType getLocationType() { return locationType; }
    public Long getSpaceId() { return spaceId; }
    public String getExternalAddress() { return externalAddress; }
    public Integer getCapacity() { return capacity; }
    public Double getPrice() { return price; }
    public String getStatus() { return status; }
    public Integer getRegisteredCount() { return registeredCount; }
    public Integer getAvailablePlaces() { return availablePlaces; }
    public Long getCreatedById() { return createdById; }
    public String getCreatedByName() { return createdByName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public String getApprovedByName() { return approvedByName; }
    public String getRejectionReason() { return rejectionReason; }
    public boolean isParkingRequired() { return parkingRequired; }
    public Long getParkingSlotId() { return parkingSlotId; }
    public Double getParkingPrice() { return parkingPrice; }
    public Integer getParkingCapacity() { return parkingCapacity; }
    public Integer getParkingAvailableSpaces() { return parkingAvailableSpaces; }

    public Integer getPhysicalParkingCapacity() { return physicalParkingCapacity; }
    public Integer getGlobalParkingRemainingSpaces() { return globalParkingRemainingSpaces; }
    public boolean isSharedParkingInventory() { return sharedParkingInventory; }
    public Long getRoomCostCents() { return roomCostCents; }
    public Long getDepositAmountCents() { return depositAmountCents; }
    public LocalDateTime getDepositDueAt() { return depositDueAt; }
    public LocalDateTime getDepositPaidAt() { return depositPaidAt; }
    public Long getBalanceDueCents() { return balanceDueCents; }
    public LocalDateTime getBalancePaidAt() { return balancePaidAt; }
    public LocalDateTime getSettlementDueAt() { return settlementDueAt; }
    public Long getLateFeeCents() { return lateFeeCents; }
    public Long getPayoutAmountCents() { return payoutAmountCents; }
    public String getSettlementStatus() { return settlementStatus; }
}
