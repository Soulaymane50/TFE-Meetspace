package be.meetspace.service;

import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.web.dto.FinanceSummaryDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialSummaryServiceTest {

    @Mock private EventRepository eventRepository;
    @Mock private EspaceRepository espaceRepository;
    @Mock private EventRegistrationRepository eventRegistrationRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ParkingReservationRepository parkingReservationRepository;
    @Mock private UserRepository userRepository;
    @Mock private FinanceTransactionMetricsService transactionMetricsService;

    @Test
    void filtersRoomAndParkingRevenueBySelectedPeriod() {
        LocalDate from = LocalDate.of(2026, 7, 17);
        LocalDate to = LocalDate.of(2026, 8, 15);

        Reservation recentRoom = roomReservation(180D, LocalDateTime.of(2026, 8, 2, 10, 0));
        Reservation oldRoom = roomReservation(420D, LocalDateTime.of(2026, 6, 2, 10, 0));
        ParkingReservation recentParking = parkingReservation(24D, LocalDateTime.of(2026, 8, 3, 9, 0));
        ParkingReservation oldParking = parkingReservation(48D, LocalDateTime.of(2026, 5, 3, 9, 0));

        when(eventRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(reservationRepository.findAll()).thenReturn(List.of(recentRoom, oldRoom));
        when(parkingReservationRepository.findAll()).thenReturn(List.of(recentParking, oldParking));
        when(transactionMetricsService.forAdmin(from, to)).thenReturn(emptyMetrics(from, to));

        FinanceSummaryDto summary = service().getAdminSummary(from, to);

        assertEquals(180D, summary.getDirectRoomRevenue());
        assertEquals(24D, summary.getParkingRevenue());
        assertEquals(204D, summary.getMeetSpaceEstimatedRevenue());
        assertEquals(from, summary.getPeriodStart());
        assertEquals(to, summary.getPeriodEnd());
    }

    private FinancialSummaryService service() {
        return new FinancialSummaryService(
                eventRepository,
                espaceRepository,
                eventRegistrationRepository,
                reservationRepository,
                parkingReservationRepository,
                userRepository,
                transactionMetricsService);
    }

    private Reservation roomReservation(double amount, LocalDateTime createdAt) {
        Reservation reservation = mock(Reservation.class);
        lenient().when(reservation.getStatus()).thenReturn(ReservationStatus.CONFIRMED);
        lenient().when(reservation.getTotalPrice()).thenReturn(amount);
        when(reservation.getCreatedAt()).thenReturn(createdAt);
        return reservation;
    }

    private ParkingReservation parkingReservation(double amount, LocalDateTime createdAt) {
        ParkingReservation reservation = mock(ParkingReservation.class);
        lenient().when(reservation.getStatus()).thenReturn(ParkingReservationStatus.CONFIRMED);
        lenient().when(reservation.getTotalPrice()).thenReturn(amount);
        when(reservation.getCreatedAt()).thenReturn(createdAt);
        return reservation;
    }

    private FinanceTransactionMetricsService.Metrics emptyMetrics(LocalDate from, LocalDate to) {
        return new FinanceTransactionMetricsService.Metrics(
                from, to, 0D, 0D, 0D, 0D, 0D, 0.21D, 0D, 0D, 0);
    }
}
