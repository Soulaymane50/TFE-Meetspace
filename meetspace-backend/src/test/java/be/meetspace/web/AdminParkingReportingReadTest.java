package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminReservationsController;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AdminParkingReportingReadTest {
    @Test
    void bothParkingHistoryViewsUseTheReadWithoutQrPasses() {
        var parking = mock(ParkingReservationRepository.class);
        var controller = new AdminReservationsController(mock(ReservationRepository.class),
                mock(EventRegistrationRepository.class), parking, null, null, null);
        User user = new User(); user.setId(1L); user.setFirstName("Alice"); user.setLastName("Mertens"); user.setEmail("alice@example.invalid");
        ParkingSlot slot = new ParkingSlot(); slot.setId(2L); slot.setTitle("Parking conférence");
        slot.setSessionDate(java.time.LocalDate.of(2026, 11, 20));
        slot.setStartTime(java.time.LocalTime.of(9,0)); slot.setEndTime(java.time.LocalTime.of(11,0));
        ParkingReservation reservation = new ParkingReservation(); reservation.setId(3L); reservation.setUser(user);
        reservation.setParkingSlot(slot); reservation.setReservedSpaces(2); reservation.setTotalPrice(16D);
        when(parking.findAllForReporting()).thenReturn(List.of(reservation));
        var detailed = controller.getParkingReservationsDetailed();
        assertThat(detailed).hasSize(1);
        assertThat(detailed.get(0).getReservedSpaces()).isEqualTo(2);
        var summary = controller.getParkingReservations();
        assertThat(summary).hasSize(1);
        assertThat(summary.get(0).getQuantity()).isEqualTo(2);
        verify(parking, times(2)).findAllForReporting();
        verify(parking, never()).findAll();
    }
}
