package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class FinanceTransactionMetricsService {

    private final PaymentRecordRepository paymentRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final EventRepository eventRepository;
    private final double vatRate;
    private final double processingVariableRate;
    private final long processingFixedFeeCents;

    public FinanceTransactionMetricsService(
            PaymentRecordRepository paymentRepository,
            ReservationRepository reservationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            EventRepository eventRepository,
            @Value("${app.finance.vat-rate:0.21}") double vatRate,
            @Value("${app.finance.processing-variable-rate:0.015}") double processingVariableRate,
            @Value("${app.finance.processing-fixed-fee-cents:25}") long processingFixedFeeCents) {
        this.paymentRepository = paymentRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.eventRepository = eventRepository;
        this.vatRate = Math.max(0D, vatRate);
        this.processingVariableRate = Math.max(0D, processingVariableRate);
        this.processingFixedFeeCents = Math.max(0L, processingFixedFeeCents);
    }

    @Transactional(readOnly = true)
    public Metrics forAdmin(LocalDate from, LocalDate to) {
        return calculate(from, to, null);
    }

    @Transactional(readOnly = true)
    public Metrics forOrganizer(Long organizerId, LocalDate from, LocalDate to) {
        Set<Long> eventIds = eventRepository.findByCreatedByIdOrderByCreatedAtDesc(organizerId).stream()
                .map(Event::getId)
                .collect(java.util.stream.Collectors.toSet());
        return calculate(from, to, eventIds);
    }

    private Metrics calculate(LocalDate from, LocalDate to, Set<Long> organizerEventIds) {
        validatePeriod(from, to);
        List<PaymentRecord> records = paymentRepository.findAll();
        Set<String> recordedIds = records.stream()
                .map(PaymentRecord::getPaymentIntentId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> transactionIds = new HashSet<>();

        long grossCents = 0L;
        long refundCents = 0L;
        long feeCents = 0L;

        for (PaymentRecord record : records) {
            if (FinanceReportingPolicy.isTechnicalUser(record.getUser())) continue;
            if (!belongsToScope(record, organizerEventIds)) continue;
            if (isPaid(record.getStatus()) && inPeriod(transactionDate(record), from, to)) {
                long amount = safe(record.getAmountCents());
                grossCents += amount;
                if (transactionIds.add(record.getPaymentIntentId())) {
                    feeCents += estimateFee(amount);
                }
            }
            if (record.getRefundedAt() != null && inPeriod(record.getRefundedAt(), from, to)) {
                refundCents += safe(record.getRefundedAmountCents());
            }
        }

        if (organizerEventIds == null) {
            for (Reservation reservation : reservationRepository.findAll()) {
                if (reservation.getStatus() == ReservationStatus.CONFIRMED
                        && !FinanceReportingPolicy.isTechnicalUser(reservation.getUser())
                        && inPeriod(reservation.getCreatedAt(), from, to)
                        && isLegacy(reservation.getPaymentIntentId(), recordedIds)) {
                    long amount = toCents(reservation.getTotalPrice());
                    grossCents += amount;
                    feeCents += addLegacyFee(transactionIds, legacyKey("room", reservation.getId(), reservation.getPaymentIntentId()), amount);
                }
            }
            for (ParkingReservation reservation : parkingReservationRepository.findAll()) {
                if (reservation.getStatus() == ParkingReservationStatus.CONFIRMED
                        && !FinanceReportingPolicy.isTechnicalUser(reservation.getUser())
                        && inPeriod(reservation.getCreatedAt(), from, to)
                        && isLegacy(reservation.getPaymentIntentId(), recordedIds)) {
                    long amount = toCents(reservation.getTotalPrice());
                    grossCents += amount;
                    feeCents += addLegacyFee(transactionIds, legacyKey("parking", reservation.getId(), reservation.getPaymentIntentId()), amount);
                }
            }
        }

        for (EventRegistration registration : eventRegistrationRepository.findAll()) {
            if (registration.getStatus() != EventRegistrationStatus.CONFIRMED
                    || FinanceReportingPolicy.isTechnicalUser(registration.getUser())
                    || !inPeriod(registration.getCreatedAt(), from, to)
                    || !isLegacy(registration.getPaymentIntentId(), recordedIds)
                    || (organizerEventIds != null && !organizerEventIds.contains(registration.getEvent().getId()))) {
                continue;
            }
            long amount = toCents(registration.getTotalPrice());
            grossCents += amount;
            feeCents += addLegacyFee(transactionIds,
                    legacyKey("event", registration.getId(), registration.getPaymentIntentId()), amount);
        }

        long receivablesCents = organizerEventIds == null
                ? reservationRepository.findAll().stream()
                    .filter(reservation -> reservation.getStatus() == ReservationStatus.APPROVED)
                    .filter(reservation -> !FinanceReportingPolicy.isTechnicalUser(reservation.getUser()))
                    .filter(reservation -> inPeriod(reservation.getApprovedAt(), from, to))
                    .mapToLong(reservation -> toCents(reservation.getTotalPrice()))
                    .sum()
                : 0L;

        long cashBeforeFeesCents = grossCents - refundCents;
        double vatIncluded = cashBeforeFeesCents > 0 && vatRate > 0
                ? centsToMoney(Math.round(cashBeforeFeesCents * vatRate / (1D + vatRate))) : 0D;
        double cashBeforeFees = centsToMoney(cashBeforeFeesCents);

        return new Metrics(
                from,
                to,
                centsToMoney(grossCents),
                centsToMoney(refundCents),
                centsToMoney(feeCents),
                centsToMoney(cashBeforeFeesCents - feeCents),
                centsToMoney(receivablesCents),
                vatRate,
                roundMoney(cashBeforeFees - vatIncluded),
                vatIncluded,
                transactionIds.size()
        );
    }

    private boolean belongsToScope(PaymentRecord record, Set<Long> organizerEventIds) {
        if (organizerEventIds == null) return true;
        return record.getType() == PaymentType.EVENT
                && record.getResourceId() != null
                && organizerEventIds.contains(record.getResourceId());
    }

    private static boolean isPaid(PaymentStatus status) {
        return status == PaymentStatus.SUCCEEDED
                || status == PaymentStatus.CONSUMED
                || status == PaymentStatus.REFUND_PENDING
                || status == PaymentStatus.PARTIALLY_REFUNDED
                || status == PaymentStatus.REFUNDED;
    }

    private long addLegacyFee(Set<String> ids, String key, long amountCents) {
        return ids.add(key) ? estimateFee(amountCents) : 0L;
    }

    private long estimateFee(long amountCents) {
        return Math.round(amountCents * processingVariableRate) + processingFixedFeeCents;
    }

    private static LocalDateTime transactionDate(PaymentRecord record) {
        return record.getConsumedAt() != null ? record.getConsumedAt() : record.getCreatedAt();
    }

    private static boolean isLegacy(String paymentIntentId, Set<String> recordedIds) {
        return paymentIntentId == null || paymentIntentId.isBlank() || !recordedIds.contains(paymentIntentId);
    }

    private static String legacyKey(String type, Long id, String paymentIntentId) {
        return paymentIntentId == null || paymentIntentId.isBlank() ? type + ":" + id : paymentIntentId;
    }

    private static boolean inPeriod(LocalDateTime value, LocalDate from, LocalDate to) {
        if (value == null) return from == null && to == null;
        LocalDate date = value.toLocalDate();
        return (from == null || !date.isBefore(from)) && (to == null || !date.isAfter(to));
    }

    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "La periode financiere est invalide.");
        }
    }

    private static long safe(Long value) { return value == null ? 0L : Math.max(0L, value); }
    private static long toCents(Double value) { return value == null ? 0L : Math.round(value * 100D); }
    private static double centsToMoney(long cents) { return roundMoney(cents / 100D); }
    private static double roundMoney(double value) { return Math.round(value * 100D) / 100D; }

    public record Metrics(
            LocalDate periodStart,
            LocalDate periodEnd,
            double grossCollected,
            double refundedAmount,
            double estimatedProcessingFees,
            double netCashFlow,
            double outstandingReceivables,
            double vatRate,
            double revenueExcludingVat,
            double vatIncluded,
            int transactionCount
    ) {}
}
