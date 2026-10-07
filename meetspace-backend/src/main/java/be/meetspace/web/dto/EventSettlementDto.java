package be.meetspace.web.dto;
import java.time.LocalDateTime;
public record EventSettlementDto(Long eventId, String eventTitle, String organizerName, String organizerEmail,
        LocalDateTime eventEndsAt, LocalDateTime dueAt, long ticketRevenueCents,
        long commissionCents, long roomBalanceDeductedCents, long amountCents,
        String status, LocalDateTime recordedAt, String transferReference) {}
