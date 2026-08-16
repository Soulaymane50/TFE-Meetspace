package be.meetspace.web.dto;

import java.time.LocalDate;

public record FinanceTrendPointDto(
        LocalDate date,
        Double platformRevenue,
        Double grossCollected,
        Double refundedAmount,
        Double processingFees,
        Double netCashFlow,
        Integer transactionCount
) {}
