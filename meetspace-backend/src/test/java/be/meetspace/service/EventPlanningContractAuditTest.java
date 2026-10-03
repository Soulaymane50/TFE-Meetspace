package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventPlanningContractAuditTest {
    private EventPlanningService planning;
    private EventRegistrationRepository registrations;
    private ParkingReservationRepository parkings;
    private ParkingAccessService accesses;
    private PaymentLifecycleService payments;
    private NotificationService notifications;
    private BookingHoldService holds;
    private ParkingCapacityService capacity;
    private EspaceRepository spaces;
    private Event event;
    private Espace room;

    @BeforeEach
    void setUp() {
        registrations = mock(EventRegistrationRepository.class);
        parkings = mock(ParkingReservationRepository.class);
        accesses = mock(ParkingAccessService.class);
        payments = mock(PaymentLifecycleService.class);
        notifications = mock(NotificationService.class);
        when(payments.refundFullBookingPayment(anyString(), anyLong(), any(), any(), anyLong(), anyLong()))
                .thenAnswer(call -> new PaymentLifecycleService.RefundResult(call.getArgument(1), call.getArgument(1), PaymentStatus.REFUNDED));
        spaces = mock(EspaceRepository.class);
        holds = mock(BookingHoldService.class);
        capacity = mock(ParkingCapacityService.class);
        room = new Espace();
        room.setId(3L);
        room.setCapacity(80);
        room.setStatus(EspaceStatus.AVAILABLE);
        room.setBasePrice(100D);
        when(spaces.findByIdForUpdate(3L)).thenReturn(Optional.of(room));
        planning = new EventPlanningService(spaces, mock(ReservationRepository.class), mock(EventRepository.class),
                registrations, parkings, mock(ParkingSlotRepository.class), capacity, accesses, payments, notifications, holds);
        event = new Event();
        event.setId(10L);
        event.setTitle("Contrat initial");
        event.setStartDateTime(LocalDateTime.now().plusDays(30).withHour(9).withMinute(0).withSecond(0).withNano(0));
        event.setEndDateTime(event.getStartDateTime().plusHours(3));
        event.setCapacity(20);
        event.setPrice(25D);
        event.setStatus(EventStatus.PUBLISHED);
        event.setLocationType(EventLocationType.EXISTING_SPACE);
        event.setSpace(room);
        ParkingSlot slot = new ParkingSlot();
        slot.setId(30L);
        slot.setStatus(ParkingSlotStatus.OPEN);
        slot.setSessionDate(event.getStartDateTime().toLocalDate());
        slot.setStartTime(event.getStartDateTime().toLocalTime()); slot.setEndTime(event.getEndDateTime().toLocalTime());
        event.setParkingSlot(slot);
    }

    @ParameterizedTest
    @ValueSource(ints = {17, 32})
    void linkedParkingRejectsOvernightAndMultipleDaysBeforeMutatingTheContract(int hours) {
        LocalDateTime originalEnd = event.getEndDateTime();
        var error = assertThrows(ResponseStatusException.class, () ->
                planning.applyAndValidate(event, data(event.getStartDateTime(), event.getStartDateTime().plusHours(hours),
                        EventLocationType.EXISTING_SPACE), 10L));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertTrue(error.getReason().contains("même jour"));
        assertEquals(originalEnd, event.getEndDateTime());
        assertEquals(ParkingSlotStatus.OPEN, event.getParkingSlot().getStatus());
    }

    @Test
    void sameDayLinkedParkingAndExternalMultidayRemainSupported() {
        assertDoesNotThrow(() -> planning.applyAndValidate(event,
                data(event.getStartDateTime(), event.getEndDateTime(), EventLocationType.EXISTING_SPACE), 10L));
        Event external = new Event();
        assertDoesNotThrow(() -> planning.applyAndValidate(external,
                data(event.getStartDateTime(), event.getStartDateTime().plusDays(2), EventLocationType.EXTERNAL), null));
        assertNull(external.getParkingSlot());
    }

    @Test
    void confirmedAttendeesPreventChangingTheEventWindow() {
        EventRegistration attendee = attendee(EventRegistrationStatus.CONFIRMED);
        when(registrations.findByEventId(10L)).thenReturn(List.of(attendee));
        assertWindowCannotMove();
    }

    @Test
    void confirmedCustomerParkingPreventsChangingTheEventWindow() {
        when(parkings.findByParkingSlotId(30L)).thenReturn(List.of(parking(false)));
        assertWindowCannotMove();
    }

    @Test
    void emptyOrCancelledContractsAndOrganizerCourtesyDoNotBlockReplanning() {
        when(registrations.findByEventId(10L)).thenReturn(List.of(attendee(EventRegistrationStatus.CANCELLED)));
        when(parkings.findByParkingSlotId(30L)).thenReturn(List.of(parking(true)));
        LocalDateTime nextStart = event.getStartDateTime().plusDays(1);
        planning.applyAndValidate(event, data(nextStart, nextStart.plusHours(3), EventLocationType.EXISTING_SPACE), 10L);
        assertEquals(nextStart, event.getStartDateTime());
    }

    @Test
    void soldEventCanStillUpdateItsDescriptionWithoutMovingTheWindow() {
        when(registrations.findByEventId(10L)).thenReturn(List.of(attendee(EventRegistrationStatus.CONFIRMED)));
        planning.applyAndValidate(event, data(event.getStartDateTime(), event.getEndDateTime(),
                EventLocationType.EXISTING_SPACE), 10L);
        assertEquals("Description corrigée", event.getDescription());
    }

    @Test
    void providerCancellationInvalidatesPaidAndCourtesyParkingWithoutErasingPayments() {
        EventRegistration attendee = attendee(EventRegistrationStatus.CONFIRMED);
        attendee.setPaymentIntentId("pi_attendee_history");
        attendee.setTotalPrice(100D);
        attendee.setCheckedInAt(LocalDateTime.now().minusHours(1));
        when(registrations.findByEventId(10L)).thenReturn(List.of(attendee));
        when(registrations.findByIdForUpdate(20L)).thenReturn(Optional.of(attendee));
        ParkingReservation paid = parking(false);
        paid.setId(40L);
        paid.setTotalPrice(12D);
        paid.setPaymentIntentId("pi_parking_history");
        ParkingReservation courtesy = parking(true);
        courtesy.setId(41L);
        when(parkings.findByParkingSlotId(30L)).thenReturn(List.of(paid, courtesy));
        when(parkings.findByIdForUpdate(40L)).thenReturn(Optional.of(paid));
        when(parkings.findByIdForUpdate(41L)).thenReturn(Optional.of(courtesy));
        event.setStatus(EventStatus.CANCELLED);
        planning.syncParkingStatus(event);
        assertEquals(EventRegistrationStatus.CANCELLED, attendee.getStatus());
        assertNotNull(attendee.getCheckedInAt(), "Conserver l'historique de contrôle");
        assertEquals("pi_attendee_history", attendee.getPaymentIntentId());
        assertEquals(100D, attendee.getTotalPrice());
        assertEquals(ParkingSlotStatus.CANCELLED, event.getParkingSlot().getStatus());
        assertEquals(ParkingReservationStatus.CANCELLED, paid.getStatus());
        assertEquals(ParkingReservationStatus.CANCELLED, courtesy.getStatus());
        assertEquals("pi_parking_history", paid.getPaymentIntentId());
        verify(accesses).cancelPasses(paid);
        verify(accesses).cancelPasses(courtesy);
        verify(payments).refundFullBookingPayment("pi_attendee_history", 10000L, attendee.getUser(), PaymentType.EVENT, 10L, 20L);
        verify(payments).refundFullBookingPayment("pi_parking_history", 1200L, paid.getUser(), PaymentType.PARKING, 30L, 40L);
        verify(notifications, times(2)).create(any(), eq(NotificationTone.WARNING), anyString(), contains("intégrale"), anyString(), anyString(), anyLong());
    }

    @Test
    void providerCancellationAlsoInvalidatesTicketsWithoutParking() {
        EventRegistration attendee = attendee(EventRegistrationStatus.CONFIRMED);
        when(registrations.findByEventId(10L)).thenReturn(List.of(attendee));
        when(registrations.findByIdForUpdate(20L)).thenReturn(Optional.of(attendee));
        event.setParkingSlot(null);
        event.setStatus(EventStatus.CANCELLED);
        planning.syncParkingStatus(event);
        assertEquals(EventRegistrationStatus.CANCELLED, attendee.getStatus());
    }

    @Test
    void publicationChecksRoomHoldsUnderRoomLockAfterInventoryLock() {
        planning.validateAvailabilityForPublication(event);
        var order = inOrder(capacity, spaces, holds);
        order.verify(capacity).lockInventory();
        order.verify(spaces).findByIdForUpdate(3L);
        order.verify(holds).assertNoOverlappingSpaceHold(3L, event.getStartDateTime(), event.getEndDateTime(), null);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Salle temporairement bloquée"))
                .when(holds).assertNoOverlappingSpaceHold(anyLong(), any(), any(), isNull());
        assertThrows(ResponseStatusException.class, () -> planning.validateAvailabilityForPublication(event));
    }

    @Test void activeParkingHoldPreventsAllocationCreationAndReplanningBeforeMutation() {
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Paiement en cours"))
                .when(capacity).assertNoActiveHoldsForWindow(any(), any(), any());
        LocalDateTime initial = event.getStartDateTime();
        assertThrows(ResponseStatusException.class, () -> planning.applyAndValidate(event,
                data(initial.plusDays(1), event.getEndDateTime().plusDays(1), EventLocationType.EXISTING_SPACE), 10L));
        assertEquals(initial, event.getStartDateTime());
        assertThrows(ResponseStatusException.class, () -> planning.applyAndValidate(new Event(),
                data(initial, event.getEndDateTime(), EventLocationType.EXISTING_SPACE), null));
        verify(spaces, never()).findByIdForUpdate(anyLong());
    }
    @Test void activeParkingHoldPreventsPublicationBeforeChangingSlotStatus() {
        event.getParkingSlot().setStatus(ParkingSlotStatus.CANCELLED);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Paiement en cours"))
                .when(capacity).assertNoActiveHoldsForWindow(any(), any(), any());
        assertThrows(ResponseStatusException.class, () -> planning.activateParkingForPublication(event));
        assertEquals(ParkingSlotStatus.CANCELLED, event.getParkingSlot().getStatus());
    }
    @Test void activeParkingHoldPreventsCancellationBeforeDurableRefundCalls() {
        event.setStatus(EventStatus.CANCELLED);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Paiement en cours"))
                .when(capacity).assertNoActiveHoldsForWindow(any(), any(), any());
        assertThrows(ResponseStatusException.class, () -> planning.syncParkingStatus(event));
        assertEquals(ParkingSlotStatus.OPEN, event.getParkingSlot().getStatus());
        verifyNoInteractions(payments);
    }
    private void assertWindowCannotMove() {
        LocalDateTime initial = event.getStartDateTime();
        var error = assertThrows(ResponseStatusException.class, () -> planning.applyAndValidate(event,
                data(initial.plusDays(1), event.getEndDateTime().plusDays(1), EventLocationType.EXISTING_SPACE), 10L));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals(initial, event.getStartDateTime());
    }

    private EventRegistration attendee(EventRegistrationStatus status) {
        EventRegistration registration = new EventRegistration();
        registration.setId(20L);
        registration.setEvent(event);
        registration.setStatus(status);
        registration.setTotalPrice(0D);
        User user = new User(); user.setId(1L); registration.setUser(user);
        return registration;
    }

    private ParkingReservation parking(boolean courtesy) {
        ParkingReservation parking = new ParkingReservation();
        parking.setParkingSlot(event.getParkingSlot());
        User user = new User(); user.setId(2L); parking.setUser(user);
        parking.setStatus(ParkingReservationStatus.CONFIRMED);
        parking.setComplimentary(courtesy);
        parking.setReservedSpaces(1);
        parking.setTotalPrice(courtesy ? 0D : 12D);
        return parking;
    }

    private EventPlanningService.EventData data(LocalDateTime start, LocalDateTime end, EventLocationType type) {
        return new EventPlanningService.EventData("Contrat", "Description corrigée", start, end, 20, 25D,
                EventStatus.PUBLISHED, type, type == EventLocationType.EXISTING_SPACE ? 3L : null,
                type == EventLocationType.EXTERNAL ? "Bruxelles" : null, null, true, null, null);
    }
}
