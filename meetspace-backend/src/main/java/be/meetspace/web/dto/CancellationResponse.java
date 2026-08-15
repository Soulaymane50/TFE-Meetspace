package be.meetspace.web.dto;

public record CancellationResponse(
        String status,
        long refundedAmountCents,
        int refundPercent,
        String message
) {}
