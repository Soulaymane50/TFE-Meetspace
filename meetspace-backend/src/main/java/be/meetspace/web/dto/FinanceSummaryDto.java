package be.meetspace.web.dto;

import java.time.LocalDate;
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
    private final Double eventPotentialGrossRevenue;
    private final Double eventPotentialCommissionRevenue;
    private final Double organizerPotentialNet;
    private final Double meetSpacePotentialRevenue;
    private final List<EventFinanceDto> events;
    private final LocalDate periodStart;
    private final LocalDate periodEnd;
    private final Double grossCollected;
    private final Double refundedAmount;
    private final Double estimatedProcessingFees;
    private final Double netCashFlow;
    private final Double outstandingReceivables;
    private final Double vatRate;
    private final Double revenueExcludingVat;
    private final Double vatIncluded;
    private final Integer transactionCount;

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
            Double eventPotentialGrossRevenue,
            Double eventPotentialCommissionRevenue,
            Double organizerPotentialNet,
            Double meetSpacePotentialRevenue,
            List<EventFinanceDto> events,
            LocalDate periodStart,
            LocalDate periodEnd,
            Double grossCollected,
            Double refundedAmount,
            Double estimatedProcessingFees,
            Double netCashFlow,
            Double outstandingReceivables,
            Double vatRate,
            Double revenueExcludingVat,
            Double vatIncluded,
            Integer transactionCount
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
        this.eventPotentialGrossRevenue = eventPotentialGrossRevenue;
        this.eventPotentialCommissionRevenue = eventPotentialCommissionRevenue;
        this.organizerPotentialNet = organizerPotentialNet;
        this.meetSpacePotentialRevenue = meetSpacePotentialRevenue;
        this.events = events;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.grossCollected = grossCollected;
        this.refundedAmount = refundedAmount;
        this.estimatedProcessingFees = estimatedProcessingFees;
        this.netCashFlow = netCashFlow;
        this.outstandingReceivables = outstandingReceivables;
        this.vatRate = vatRate;
        this.revenueExcludingVat = revenueExcludingVat;
        this.vatIncluded = vatIncluded;
        this.transactionCount = transactionCount;
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
    public Double getEventPotentialGrossRevenue() { return eventPotentialGrossRevenue; }
    public Double getEventPotentialCommissionRevenue() { return eventPotentialCommissionRevenue; }
    public Double getOrganizerPotentialNet() { return organizerPotentialNet; }
    public Double getMeetSpacePotentialRevenue() { return meetSpacePotentialRevenue; }
    public List<EventFinanceDto> getEvents() { return events; }
    public LocalDate getPeriodStart() { return periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public Double getGrossCollected() { return grossCollected; }
    public Double getRefundedAmount() { return refundedAmount; }
    public Double getEstimatedProcessingFees() { return estimatedProcessingFees; }
    public Double getNetCashFlow() { return netCashFlow; }
    public Double getOutstandingReceivables() { return outstandingReceivables; }
    public Double getVatRate() { return vatRate; }
    public Double getRevenueExcludingVat() { return revenueExcludingVat; }
    public Double getVatIncluded() { return vatIncluded; }
    public Integer getTransactionCount() { return transactionCount; }
}
