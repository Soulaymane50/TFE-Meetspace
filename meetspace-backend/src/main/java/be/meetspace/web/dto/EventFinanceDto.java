package be.meetspace.web.dto;

public class EventFinanceDto {

    private final Long eventId;
    private final String eventTitle;
    private final String eventStatus;
    private final String organizerName;
    private final String roomName;
    private final Integer eventCapacity;
    private final Integer confirmedRegistrations;
    private final Integer confirmedParticipants;
    private final Double ticketPrice;
    private final Double durationHours;
    private final Double roomHourlyRate;
    private final Double grossRevenue;
    private final Double roomCost;
    private final Double meetSpaceCommission;
    private final Double organizerNetEstimate;
    private final Double commissionRate;

    public EventFinanceDto(
            Long eventId,
            String eventTitle,
            String eventStatus,
            String organizerName,
            String roomName,
            Integer eventCapacity,
            Integer confirmedRegistrations,
            Integer confirmedParticipants,
            Double ticketPrice,
            Double durationHours,
            Double roomHourlyRate,
            Double grossRevenue,
            Double roomCost,
            Double meetSpaceCommission,
            Double organizerNetEstimate,
            Double commissionRate
    ) {
        this.eventId = eventId;
        this.eventTitle = eventTitle;
        this.eventStatus = eventStatus;
        this.organizerName = organizerName;
        this.roomName = roomName;
        this.eventCapacity = eventCapacity;
        this.confirmedRegistrations = confirmedRegistrations;
        this.confirmedParticipants = confirmedParticipants;
        this.ticketPrice = ticketPrice;
        this.durationHours = durationHours;
        this.roomHourlyRate = roomHourlyRate;
        this.grossRevenue = grossRevenue;
        this.roomCost = roomCost;
        this.meetSpaceCommission = meetSpaceCommission;
        this.organizerNetEstimate = organizerNetEstimate;
        this.commissionRate = commissionRate;
    }

    public Long getEventId() { return eventId; }
    public String getEventTitle() { return eventTitle; }
    public String getEventStatus() { return eventStatus; }
    public String getOrganizerName() { return organizerName; }
    public String getRoomName() { return roomName; }
    public Integer getEventCapacity() { return eventCapacity; }
    public Integer getConfirmedRegistrations() { return confirmedRegistrations; }
    public Integer getConfirmedParticipants() { return confirmedParticipants; }
    public Double getTicketPrice() { return ticketPrice; }
    public Double getDurationHours() { return durationHours; }
    public Double getRoomHourlyRate() { return roomHourlyRate; }
    public Double getGrossRevenue() { return grossRevenue; }
    public Double getRoomCost() { return roomCost; }
    public Double getMeetSpaceCommission() { return meetSpaceCommission; }
    public Double getOrganizerNetEstimate() { return organizerNetEstimate; }
    public Double getCommissionRate() { return commissionRate; }
}
