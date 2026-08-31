package be.meetspace.service;

import be.meetspace.entity.ParkingInventory;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.repository.ParkingInventoryRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParkingCapacityServiceTest {
    @Mock ParkingInventoryRepository inventoryRepository;
    @Mock ParkingSlotRepository slotRepository;
    @Mock ParkingReservationRepository reservationRepository;

    private ParkingCapacityService service;
    private ParkingInventory inventory;

    @BeforeEach
    void setUp() {
        service = new ParkingCapacityService(inventoryRepository, slotRepository, reservationRepository);
        inventory = new ParkingInventory();
        inventory.setId(1L);
        inventory.setCapacity(150);
        when(inventoryRepository.findById(1L)).thenReturn(Optional.of(inventory));
    }

    @Test
    void keepsFiftySpacesInSharedReserveWhileASoleEventIsFarAway() {
        ParkingSlot event = slot(1L, 150, LocalTime.of(9, 0), LocalTime.of(12, 0), 10);
        when(slotRepository.findOpenOverlappingSlots(event.getSessionDate(), event.getStartTime(), event.getEndTime()))
                .thenReturn(List.of(event));
        when(reservationRepository.countReservedSpacesByParkingSlotId(1L)).thenReturn(0);
        when(reservationRepository.countReservedSpacesForWindow(event.getSessionDate(), event.getStartTime(), event.getEndTime()))
                .thenReturn(0);

        ParkingCapacityService.CapacitySnapshot snapshot = service.snapshot(event);

        assertEquals(150, snapshot.physicalCapacity());
        assertEquals(100, snapshot.allocatedSpaces());
        assertEquals(100, snapshot.availableSpaces());
        assertEquals(150, snapshot.globalRemainingSpaces());
    }

    @Test
    void splitsOverlappingEventsProportionallyWithoutExceedingPhysicalCapacity() {
        ParkingSlot largeEvent = slot(1L, 150, LocalTime.of(9, 0), LocalTime.of(14, 0), 10);
        ParkingSlot smallerEvent = slot(2L, 100, LocalTime.of(11, 0), LocalTime.of(15, 0), 10);
        when(slotRepository.findOpenOverlappingSlots(largeEvent.getSessionDate(), largeEvent.getStartTime(), largeEvent.getEndTime()))
                .thenReturn(List.of(largeEvent, smallerEvent));
        when(reservationRepository.countReservedSpacesByParkingSlotId(1L)).thenReturn(0);
        when(reservationRepository.countReservedSpacesForWindow(largeEvent.getSessionDate(), largeEvent.getStartTime(), largeEvent.getEndTime()))
                .thenReturn(0);

        ParkingCapacityService.CapacitySnapshot snapshot = service.snapshot(largeEvent);

        assertEquals(90, snapshot.allocatedSpaces());
        assertEquals(90, snapshot.availableSpaces());
    }

    @Test
    void sequentialEventsCanReuseTheSamePhysicalSpaces() {
        ParkingSlot morning = slot(1L, 150, LocalTime.of(9, 0), LocalTime.of(12, 0), 1);
        ParkingSlot afternoon = slot(2L, 150, LocalTime.of(14, 0), LocalTime.of(18, 0), 1);
        when(slotRepository.findOpenOverlappingSlots(morning.getSessionDate(), morning.getStartTime(), morning.getEndTime()))
                .thenReturn(List.of(morning));
        when(slotRepository.findOpenOverlappingSlots(afternoon.getSessionDate(), afternoon.getStartTime(), afternoon.getEndTime()))
                .thenReturn(List.of(afternoon));
        when(reservationRepository.countReservedSpacesByParkingSlotId(1L)).thenReturn(0);
        when(reservationRepository.countReservedSpacesByParkingSlotId(2L)).thenReturn(0);
        when(reservationRepository.countReservedSpacesForWindow(morning.getSessionDate(), morning.getStartTime(), morning.getEndTime()))
                .thenReturn(0);
        when(reservationRepository.countReservedSpacesForWindow(afternoon.getSessionDate(), afternoon.getStartTime(), afternoon.getEndTime()))
                .thenReturn(0);

        assertEquals(150, service.snapshot(morning).availableSpaces());
        assertEquals(150, service.snapshot(afternoon).availableSpaces());
    }

    @Test
    void paidReservationsRemainProtectedWhenTheFairShareChanges() {
        ParkingSlot first = slot(1L, 150, LocalTime.of(9, 0), LocalTime.of(14, 0), 10);
        ParkingSlot second = slot(2L, 150, LocalTime.of(10, 0), LocalTime.of(13, 0), 10);
        when(slotRepository.findOpenOverlappingSlots(first.getSessionDate(), first.getStartTime(), first.getEndTime()))
                .thenReturn(List.of(first, second));
        when(reservationRepository.countReservedSpacesByParkingSlotId(1L)).thenReturn(100);
        when(reservationRepository.countReservedSpacesForWindow(first.getSessionDate(), first.getStartTime(), first.getEndTime()))
                .thenReturn(100);

        ParkingCapacityService.CapacitySnapshot snapshot = service.snapshot(first);

        assertEquals(75, snapshot.allocatedSpaces());
        assertEquals(100, snapshot.reservedForSlot());
        assertEquals(0, snapshot.availableSpaces());
        assertEquals(50, snapshot.globalRemainingSpaces());
    }

    @Test
    void calculatesThePublicCatalogWithOneGroupedReservationQuery() {
        ParkingSlot largeEvent = slot(1L, 150, LocalTime.of(9, 0), LocalTime.of(14, 0), 10);
        ParkingSlot smallerEvent = slot(2L, 100, LocalTime.of(11, 0), LocalTime.of(15, 0), 10);
        List<Long> slotIds = List.of(1L, 2L);
        when(reservationRepository.sumReservedSpacesByParkingSlotIds(slotIds))
                .thenReturn(List.of(reservedSpaces(1L, 12L), reservedSpaces(2L, 4L)));

        Map<Long, ParkingCapacityService.CapacitySnapshot> snapshots =
                service.snapshots(List.of(largeEvent, smallerEvent));

        assertEquals(78, snapshots.get(1L).availableSpaces());
        assertEquals(56, snapshots.get(2L).availableSpaces());
        assertEquals(134, snapshots.get(1L).globalRemainingSpaces());
        verify(reservationRepository, times(1)).sumReservedSpacesByParkingSlotIds(slotIds);
        verify(slotRepository, never()).findOpenOverlappingSlots(
                largeEvent.getSessionDate(), largeEvent.getStartTime(), largeEvent.getEndTime());
    }

    private ParkingReservationRepository.ReservedSpacesBySlot reservedSpaces(Long slotId, Long spaces) {
        return new ParkingReservationRepository.ReservedSpacesBySlot() {
            @Override public Long getSlotId() { return slotId; }
            @Override public Long getReservedSpaces() { return spaces; }
        };
    }

    private ParkingSlot slot(Long id, int capacity, LocalTime start, LocalTime end, int daysFromNow) {
        ParkingSlot slot = new ParkingSlot();
        slot.setId(id);
        slot.setTitle("Parking test");
        slot.setDescription("Créneau partagé");
        slot.setSessionDate(LocalDate.now().plusDays(daysFromNow));
        slot.setStartTime(start);
        slot.setEndTime(end);
        slot.setCapacity(capacity);
        slot.setParkingRate(12D);
        slot.setStatus(ParkingSlotStatus.OPEN);
        return slot;
    }
}
