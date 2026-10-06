package be.meetspace.web;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.controller.AdminParkingController;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AdminParkingBatchReadTest {
    final ParkingSlotRepository slots = mock(ParkingSlotRepository.class);
    final ParkingReservationRepository reservations = mock(ParkingReservationRepository.class);
    final ParkingCapacityService capacities = mock(ParkingCapacityService.class);
    final AdminParkingController controller = new AdminParkingController(slots, reservations, null, capacities);

    @Test
    void preservesSharedCapacityAndReservationsOnClosedSessionsWithoutPerRowQueries() {
        ParkingSlot open = new ParkingSlot(); open.setId(1L); open.setCapacity(100); open.setStatus(ParkingSlotStatus.OPEN);
        ParkingSlot closed = new ParkingSlot(); closed.setId(2L); closed.setCapacity(50); closed.setStatus(ParkingSlotStatus.FULL);
        var source = List.of(open, closed);
        when(slots.findAll()).thenReturn(source);
        when(capacities.snapshots(source)).thenReturn(Map.of(1L,
                new ParkingCapacityService.CapacitySnapshot(150, 90, 12, 20, 78, 130)));
        var first = mock(ParkingReservationRepository.ReservedSpacesBySlot.class);
        when(first.getSlotId()).thenReturn(1L); when(first.getReservedSpaces()).thenReturn(12L);
        var second = mock(ParkingReservationRepository.ReservedSpacesBySlot.class);
        when(second.getSlotId()).thenReturn(2L); when(second.getReservedSpaces()).thenReturn(50L);
        when(reservations.sumReservedSpacesByParkingSlotIds(List.of(1L, 2L))).thenReturn(List.of(first, second));
        var result = controller.listSessions();
        assertThat(result).extracting(r -> r.getRegisteredSpaces()).containsExactly(12, 50);
        assertThat(result).extracting(r -> r.getAvailableSpaces()).containsExactly(78, 0);
        assertThat(result).extracting(r -> r.getParkingCapacity()).containsExactly(90, 0);
        assertThat(result).extracting(r -> r.getPhysicalCapacity()).containsExactly(150, 150);
        assertThat(result).extracting(r -> r.getGlobalRemainingSpaces()).containsExactly(130, 0);
        verify(capacities).snapshots(source);
        verify(capacities, never()).snapshot(any());
        verify(reservations).sumReservedSpacesByParkingSlotIds(List.of(1L, 2L));
        verify(reservations, never()).countReservedSpacesByParkingSlotId(anyLong());
    }

    @Test
    void anEmptySessionListDoesNotReadReservationsOrInventory() {
        assertThat(controller.listSessions()).isEmpty();
        verifyNoInteractions(reservations, capacities);
    }
}
