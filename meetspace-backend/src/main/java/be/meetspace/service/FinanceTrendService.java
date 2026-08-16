package be.meetspace.service;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.PaymentRecord;
import be.meetspace.entity.PaymentStatus;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.PaymentRecordRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.web.dto.FinanceTrendDto;
import be.meetspace.web.dto.FinanceTrendPointDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.NavigableMap;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

@Service
public class FinanceTrendService {

    private final PaymentRecordRepository paymentRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final EventRepository eventRepository;
    private final double processingVariableRate;
    private final long processingFixedFeeCents;

    public FinanceTrendService(
            PaymentRecordRepository paymentRepository,
            ReservationRepository reservationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            EventRepository eventRepository,
            @Value("${app.finance.processing-variable-rate:0.015}") double processingVariableRate,
            @Value("${app.finance.processing-fixed-fee-cents:25}") long processingFixedFeeCents) {
        this.paymentRepository = paymentRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.eventRepository = eventRepository;
        this.processingVariableRate = Math.max(0D, processingVariableRate);
        this.processingFixedFeeCents = Math.max(0L, processingFixedFeeCents);
    }

    @Transactional(readOnly = true)
    public FinanceTrendDto getAdminTrend(LocalDate requestedFrom, LocalDate requestedTo, String requestedGranularity) {
        LocalDate to = requestedTo != null ? requestedTo : LocalDate.now();
        LocalDate from = requestedFrom != null ? requestedFrom : to.minusDays(89);
        validatePeriod(from, to);
        Granularity granularity = Granularity.resolve(requestedGranularity, from, to);
        NavigableMap<LocalDate, Bucket> buckets = createBuckets(from, to, granularity);

        List<PaymentRecord> paymentRecords = paymentRepository.findAll();
        Set<String> recordedIntentIds = paymentRecords.stream()
                .map(PaymentRecord::getPaymentIntentId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> transactionIds = new HashSet<>();

        for (PaymentRecord record : paymentRecords) {
            if (FinanceReportingPolicy.isTechnicalUser(record.getUser())) continue;
            LocalDateTime paidAt = transactionDate(record);
            if (isPaid(record.getStatus()) && inPeriod(paidAt, from, to)) {
                Bucket bucket = bucketFor(buckets, paidAt.toLocalDate(), granularity);
                long amount = safe(record.getAmountCents());
                bucket.grossCollectedCents += amount;
                if (transactionIds.add(record.getPaymentIntentId())) {
                    bucket.processingFeesCents += estimateFee(amount);
                    bucket.transactionCount++;
                }
            }
            if (record.getRefundedAt() != null && inPeriod(record.getRefundedAt(), from, to)) {
                bucketFor(buckets, record.getRefundedAt().toLocalDate(), granularity).refundedCents += safe(record.getRefundedAmountCents());
            }
        }

        List<Reservation> roomReservations = reservationRepository.findAll();
        for (Reservation reservation : roomReservations) {
            if (reservation.getStatus() != ReservationStatus.CONFIRMED
                    || FinanceReportingPolicy.isTechnicalUser(reservation.getUser())
                    || !inPeriod(reservation.getCreatedAt(), from, to)) continue;
            Bucket bucket = bucketFor(buckets, reservation.getCreatedAt().toLocalDate(), granularity);
            long amount = toCents(reservation.getTotalPrice());
            bucket.platformRevenueCents += amount;
            if (isLegacy(reservation.getPaymentIntentId(), recordedIntentIds)) {
                addLegacyPayment(bucket, transactionIds, legacyKey("room", reservation.getId(), reservation.getPaymentIntentId()), amount);
            }
        }

        for (ParkingReservation reservation : parkingReservationRepository.findAll()) {
            if (reservation.getStatus() != ParkingReservationStatus.CONFIRMED
                    || FinanceReportingPolicy.isTechnicalUser(reservation.getUser())
                    || !inPeriod(reservation.getCreatedAt(), from, to)) continue;
            Bucket bucket = bucketFor(buckets, reservation.getCreatedAt().toLocalDate(), granularity);
            long amount = toCents(reservation.getTotalPrice());
            bucket.platformRevenueCents += amount;
            if (isLegacy(reservation.getPaymentIntentId(), recordedIntentIds)) {
                addLegacyPayment(bucket, transactionIds, legacyKey("parking", reservation.getId(), reservation.getPaymentIntentId()), amount);
            }
        }

        for (EventRegistration registration : eventRegistrationRepository.findAll()) {
            if (registration.getStatus() != EventRegistrationStatus.CONFIRMED
                    || FinanceReportingPolicy.isTechnicalUser(registration.getUser())
                    || !inPeriod(registration.getCreatedAt(), from, to)) continue;
            long amount = toCents(registration.getTotalPrice());
            Bucket bucket = bucketFor(buckets, registration.getCreatedAt().toLocalDate(), granularity);
            if (registration.getEvent() != null && registration.getEvent().getStatus() == EventStatus.PUBLISHED) {
                bucket.platformRevenueCents += Math.round(amount * BusinessRules.MEETSPACE_COMMISSION_RATE);
            }
            if (isLegacy(registration.getPaymentIntentId(), recordedIntentIds)) {
                addLegacyPayment(bucket, transactionIds, legacyKey("event", registration.getId(), registration.getPaymentIntentId()), amount);
            }
        }

        for (Event event : eventRepository.findAllByOrderByCreatedAtDesc()) {
            if (event.getStatus() != EventStatus.PUBLISHED || FinanceReportingPolicy.isTechnicalUser(event.getCreatedBy())) continue;
            LocalDateTime recognitionDate = event.getStartDateTime() != null ? event.getStartDateTime() : event.getCreatedAt();
            if (!inPeriod(recognitionDate, from, to)) continue;
            bucketFor(buckets, recognitionDate.toLocalDate(), granularity).platformRevenueCents += eventRoomCostCents(event);
        }

        List<FinanceTrendPointDto> points = buckets.entrySet().stream()
                .map(entry -> entry.getValue().toDto(entry.getKey()))
                .toList();
        return new FinanceTrendDto(from, to, granularity.name(), points);
    }

    private NavigableMap<LocalDate, Bucket> createBuckets(LocalDate from, LocalDate to, Granularity granularity) {
        NavigableMap<LocalDate, Bucket> buckets = new TreeMap<>();
        LocalDate cursor = granularity.bucket(from);
        LocalDate last = granularity.bucket(to);
        while (!cursor.isAfter(last)) {
            buckets.put(cursor, new Bucket());
            cursor = granularity.next(cursor);
        }
        return buckets;
    }

    private Bucket bucketFor(NavigableMap<LocalDate, Bucket> buckets, LocalDate date, Granularity granularity) {
        Bucket bucket = buckets.get(granularity.bucket(date));
        if (bucket == null) {
            throw new IllegalStateException("Point financier hors de la periode demandee.");
        }
        return bucket;
    }

    private void addLegacyPayment(Bucket bucket, Set<String> transactionIds, String key, long amountCents) {
        bucket.grossCollectedCents += amountCents;
        if (transactionIds.add(key)) {
            bucket.processingFeesCents += estimateFee(amountCents);
            bucket.transactionCount++;
        }
    }

    private long eventRoomCostCents(Event event) {
        if (event.getSpace() == null || event.getSpace().getBasePrice() == null
                || event.getStartDateTime() == null || event.getEndDateTime() == null) {
            return 0L;
        }
        long minutes = Math.max(0L, Duration.between(event.getStartDateTime(), event.getEndDateTime()).toMinutes());
        return Math.round(event.getSpace().getBasePrice() * (minutes / 60D) * 100D);
    }

    private long estimateFee(long amountCents) {
        return Math.round(amountCents * processingVariableRate) + processingFixedFeeCents;
    }

    private static LocalDateTime transactionDate(PaymentRecord record) {
        return record.getConsumedAt() != null ? record.getConsumedAt() : record.getCreatedAt();
    }

    private static boolean isPaid(PaymentStatus status) {
        return status == PaymentStatus.SUCCEEDED
                || status == PaymentStatus.CONSUMED
                || status == PaymentStatus.REFUND_PENDING
                || status == PaymentStatus.PARTIALLY_REFUNDED
                || status == PaymentStatus.REFUNDED;
    }

    private static boolean inPeriod(LocalDateTime value, LocalDate from, LocalDate to) {
        if (value == null) return false;
        LocalDate date = value.toLocalDate();
        return !date.isBefore(from) && !date.isAfter(to);
    }

    private static boolean isLegacy(String paymentIntentId, Set<String> recordedIds) {
        return paymentIntentId == null || paymentIntentId.isBlank() || !recordedIds.contains(paymentIntentId);
    }

    private static String legacyKey(String type, Long id, String paymentIntentId) {
        return paymentIntentId == null || paymentIntentId.isBlank() ? type + ":" + id : paymentIntentId;
    }

    private static long safe(Long value) { return value == null ? 0L : Math.max(0L, value); }
    private static long toCents(Double value) { return value == null ? 0L : Math.round(value * 100D); }
    private static double money(long cents) { return Math.round(cents) / 100D; }

    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La periode financiere est invalide.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 731) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La periode financiere est limitee a deux ans.");
        }
    }

    private enum Granularity {
        DAY {
            @Override LocalDate bucket(LocalDate date) { return date; }
            @Override LocalDate next(LocalDate date) { return date.plusDays(1); }
        },
        MONTH {
            @Override LocalDate bucket(LocalDate date) { return date.withDayOfMonth(1); }
            @Override LocalDate next(LocalDate date) { return date.plusMonths(1); }
        };

        abstract LocalDate bucket(LocalDate date);
        abstract LocalDate next(LocalDate date);

        static Granularity resolve(String requested, LocalDate from, LocalDate to) {
            if (requested != null && !requested.isBlank() && !"AUTO".equalsIgnoreCase(requested)) {
                try {
                    return valueOf(requested.toUpperCase(java.util.Locale.ROOT));
                } catch (IllegalArgumentException error) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Granularite financiere invalide.");
                }
            }
            return ChronoUnit.DAYS.between(from, to) > 120 ? MONTH : DAY;
        }
    }

    private static final class Bucket {
        private long platformRevenueCents;
        private long grossCollectedCents;
        private long refundedCents;
        private long processingFeesCents;
        private int transactionCount;

        private FinanceTrendPointDto toDto(LocalDate date) {
            return new FinanceTrendPointDto(
                    date,
                    money(platformRevenueCents),
                    money(grossCollectedCents),
                    money(refundedCents),
                    money(processingFeesCents),
                    money(grossCollectedCents - refundedCents - processingFeesCents),
                    transactionCount
            );
        }
    }
}
