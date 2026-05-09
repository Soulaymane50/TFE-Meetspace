package be.meetspace.web.dto;

import java.util.List;

public class FinanceSummaryDto {

    private final Double commissionRate;
    private final Integer eventCount;
    private final Integer confirmedRegistrations;
    private final Integer confirmedParticipants;
    private final Double eventGrossRevenue;
    private final Double eventCommissionRevenue;
    private final Double roomCostChargedToOrganizers;
    private final Double organizerNetEstimate;
    private final Double directRoomRevenue;
    private final Double parkingRevenue;
    private final Double meetSpaceEstimatedRevenue;
    private final List<EventFinanceDto> events;

    public FinanceSummaryDto(
            Double commissionRate,
            Integer eventCount,
            Integer confirmedRegistrations,
            Integer confirmedParticipants,
            Double eventGrossRevenue,
            Double eventCommissionRevenue,
            Double roomCostChargedToOrganizers,
            Double organizerNetEstimate,
            Double directRoomRevenue,
            Double parkingRevenue,
            Double meetSpaceEstimatedRevenue,
            List<EventFinanceDto> events
    ) {
        this.commissionRate = commissionRate;
        this.eventCount = eventCount;
        this.confirmedRegistrations = confirmedRegistrations;
        this.confirmedParticipants = confirmedParticipants;
        this.eventGrossRevenue = eventGrossRevenue;
        this.eventCommissionRevenue = eventCommissionRevenue;
        this.roomCostChargedToOrganizers = roomCostChargedToOrganizers;
        this.organizerNetEstimate = organizerNetEstimate;
        this.directRoomRevenue = directRoomRevenue;
        this.parkingRevenue = parkingRevenue;
        this.meetSpaceEstimatedRevenue = meetSpaceEstimatedRevenue;
        this.events = events;
    }

    public Double getCommissionRate() { return commissionRate; }
    public Integer getEventCount() { return eventCount; }
    public Integer getConfirmedRegistrations() { return confirmedRegistrations; }
    public Integer getConfirmedParticipants() { return confirmedParticipants; }
    public Double getEventGrossRevenue() { return eventGrossRevenue; }
    public Double getEventCommissionRevenue() { return eventCommissionRevenue; }
    public Double getRoomCostChargedToOrganizers() { return roomCostChargedToOrganizers; }
    public Double getOrganizerNetEstimate() { return organizerNetEstimate; }
    public Double getDirectRoomRevenue() { return directRoomRevenue; }
    public Double getParkingRevenue() { return parkingRevenue; }
    public Double getMeetSpaceEstimatedRevenue() { return meetSpaceEstimatedRevenue; }
    public List<EventFinanceDto> getEvents() { return events; }
}
