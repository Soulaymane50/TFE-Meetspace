package be.meetspace.service;

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
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FinanceTrendServiceTest {

    @Test
    void separatesRevenueCollectionAndRefundByActualDate() {
        PaymentRecordRepository paymentRepository = mock(PaymentRecordRepository.class);
        ReservationRepository reservationRepository = mock(ReservationRepository.class);
        EventRegistrationRepository registrationRepository = mock(EventRegistrationRepository.class);
        ParkingReservationRepository parkingRepository = mock(ParkingReservationRepository.class);
        EventRepository eventRepository = mock(EventRepository.class);

        PaymentRecord payment = mock(PaymentRecord.class);
        when(payment.getPaymentIntentId()).thenReturn("pi_room_1");
        when(payment.getStatus()).thenReturn(PaymentStatus.SUCCEEDED);
        when(payment.getAmountCents()).thenReturn(10_000L);
        when(payment.getCreatedAt()).thenReturn(LocalDateTime.of(2026, 8, 1, 10, 0));
        when(payment.getRefundedAt()).thenReturn(LocalDateTime.of(2026, 8, 2, 9, 0));
        when(payment.getRefundedAmountCents()).thenReturn(2_000L);

        Reservation reservation = mock(Reservation.class);
        when(reservation.getStatus()).thenReturn(ReservationStatus.CONFIRMED);
        when(reservation.getCreatedAt()).thenReturn(LocalDateTime.of(2026, 8, 1, 10, 0));
        when(reservation.getTotalPrice()).thenReturn(100D);
        when(reservation.getPaymentIntentId()).thenReturn("pi_room_1");

        when(paymentRepository.findAll()).thenReturn(List.of(payment));
        when(reservationRepository.findAll()).thenReturn(List.of(reservation));
        when(registrationRepository.findAll()).thenReturn(List.of());
        when(parkingRepository.findAll()).thenReturn(List.of());
        when(eventRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());

        FinanceTrendService service = new FinanceTrendService(
                paymentRepository,
                reservationRepository,
                registrationRepository,
                parkingRepository,
                eventRepository,
                0.015D,
                25L);

        FinanceTrendDto trend = service.getAdminTrend(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                "DAY");

        assertEquals(3, trend.points().size());
        FinanceTrendPointDto first = trend.points().get(0);
        assertEquals(100D, first.platformRevenue());
        assertEquals(100D, first.grossCollected());
        assertEquals(1.75D, first.processingFees());
        assertEquals(98.25D, first.netCashFlow());
        assertEquals(1, first.transactionCount());

        FinanceTrendPointDto second = trend.points().get(1);
        assertEquals(20D, second.refundedAmount());
        assertEquals(-20D, second.netCashFlow());
        assertEquals(0D, trend.points().get(2).netCashFlow());
    }
}
