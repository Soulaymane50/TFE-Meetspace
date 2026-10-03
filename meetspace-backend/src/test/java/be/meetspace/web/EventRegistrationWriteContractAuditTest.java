package be.meetspace.web;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.service.*;
import be.meetspace.web.controller.EventRegistrationController;
import be.meetspace.web.dto.EventRegistrationRequest;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class EventRegistrationWriteContractAuditTest {
    EventRegistrationRepository registrations; EventRepository events; UserRepository users;
    PaymentLifecycleService payments; ParkingCapacityService capacity;
    EventRegistrationController controller; User user; Event event; ParkingSlot slot; EventRegistration written;
    @BeforeEach void setUp() {
        registrations = mock(EventRegistrationRepository.class); events = mock(EventRepository.class); users = mock(UserRepository.class);
        payments = mock(PaymentLifecycleService.class); capacity = mock(ParkingCapacityService.class);
        user = new User(); user.setId(1L); user.setRole(Role.MEMBER); user.setEmail("contract@test.local");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        event = new Event(); event.setId(10L); event.setTitle("Contrat hold"); event.setStatus(EventStatus.PUBLISHED);
        event.setStartDateTime(LocalDateTime.now().plusDays(10)); event.setEndDateTime(event.getStartDateTime().plusHours(2));
        event.setCapacity(20); event.setPrice(10D);
        slot = new ParkingSlot(); slot.setId(30L); slot.setStatus(ParkingSlotStatus.OPEN); slot.setParkingRate(2D); event.setParkingSlot(slot);
        when(events.findByIdForUpdate(10L)).thenReturn(Optional.of(event));
        when(registrations.save(any())).thenAnswer(c -> { written = c.getArgument(0); written.setId(20L); return written; });
        var parkings = mock(ParkingReservationRepository.class);
        when(parkings.save(any())).thenAnswer(c -> { ParkingReservation p = c.getArgument(0); p.setId(40L); return p; });
        controller = new EventRegistrationController(registrations, events, users, parkings, payments, new CancellationPolicyService(),
                mock(AuditService.class), mock(EmailService.class), mock(NotificationService.class), mock(EventWaitlistService.class),
                capacity, mock(ParkingAccessService.class), mock(EventPlanningService.class));
    }
    @Test void paidFinalizationUsesOnlyOwnValidatedHoldAndLocksBeforeUserRead() {
        controller.register(request(), auth(), new MockHttpServletRequest());
        var order = inOrder(capacity, users, events);
        order.verify(capacity).lockInventory(); order.verify(users).findByEmail(user.getEmail());
        order.verify(events).findByIdForUpdate(10L);
        order.verify(capacity).lockAndAssertAvailable(slot, 1, "pi_client", user);
        verify(payments).consume("pi_client", user, PaymentType.EVENT, 1200L, 10L);
        verify(payments).bindToBooking("pi_client", 20L);
    }
    @Test void roundedFreeBookingCannotUsePaymentIdToExcludeAHold() {
        event.setPrice(0D); slot.setParkingRate(0.001D);
        controller.register(request(), auth(), new MockHttpServletRequest());
        verify(capacity).lockAndAssertAvailable(slot, 1, null, user);
        verifyNoInteractions(payments); assertNull(written.getPaymentIntentId());
    }
    @Test void cancellationLocksBeforeUserReadAndRegistrationLock() {
        EventRegistration existing = new EventRegistration(); existing.setId(20L); existing.setUser(user); existing.setEvent(event);
        existing.setStatus(EventRegistrationStatus.CANCELLED);
        when(registrations.findByIdForUpdate(20L)).thenReturn(Optional.of(existing));
        assertThrows(ResponseStatusException.class, () -> controller.cancelRegistration(20L, auth(), new MockHttpServletRequest()));
        var order = inOrder(capacity, users, registrations);
        order.verify(capacity).lockInventory(); order.verify(users).findByEmail(user.getEmail());
        order.verify(registrations).findByIdForUpdate(20L);
    }
    UsernamePasswordAuthenticationToken auth() { return new UsernamePasswordAuthenticationToken(user.getEmail(), null); }
    EventRegistrationRequest request() {
        EventRegistrationRequest request = new EventRegistrationRequest(); request.setEventId(10L);
        request.setNumberOfParticipants(1); request.setAddParking(true); request.setReservedSpaces(1); request.setPaymentIntentId("pi_client");
        return request;
    }
}