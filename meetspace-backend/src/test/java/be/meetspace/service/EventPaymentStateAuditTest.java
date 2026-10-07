package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminEventController;
import be.meetspace.web.dto.PaymentRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EventPaymentStateAuditTest {
    private EventRepository events;
    private BookingHoldRepository holds;
    private PaymentLifecycleService payments;
    private EventPlanningService planning;
    private PaymentQuoteService quotes;
    private BookingHoldService holdService;
    private EventBillingService billing;
    private User owner;
    private Event event;

    @BeforeEach
    void setUp() {
        events = mock(EventRepository.class);
        holds = mock(BookingHoldRepository.class);
        payments = mock(PaymentLifecycleService.class);
        planning = mock(EventPlanningService.class);
        var spaces = mock(EspaceRepository.class);
        var reservations = mock(ReservationRepository.class);
        var parking = mock(ParkingSlotRepository.class);
        var registrations = mock(EventRegistrationRepository.class);
        quotes = new PaymentQuoteService(events, spaces, parking, reservations);
        holdService = new BookingHoldService(holds, spaces, events, parking, reservations,
                registrations, mock(ParkingReservationRepository.class), 15L);
        billing = new EventBillingService(events, registrations, quotes, payments, planning, mock(EventSettlementService.class));
        owner = new User();
        owner.setId(1L);
        owner.setRole(Role.ORGANIZER);
        event = new Event();
        event.setId(10L);
        event.setRoomPaymentMode("LEGACY_DEPOSIT");
        event.setCreatedBy(owner);
        event.setTitle("Audit evenement");
        event.setCapacity(20);
        event.setPrice(10D);
        event.setStatus(EventStatus.PUBLISHED);
        event.setStartDateTime(LocalDateTime.now().plusDays(5));
        event.setEndDateTime(event.getStartDateTime().plusHours(2));
        event.setDepositPaidAt(LocalDateTime.now().minusHours(1));
        event.setDepositAmountCents(6000L);
        event.setBalanceDueCents(14000L);
        event.setSettlementDueAt(event.getEndDateTime().plusHours(48));
        Espace space = new Espace();
        space.setId(3L);
        space.setBasePrice(100D);
        event.setSpace(space);
        event.setLocationType(EventLocationType.EXISTING_SPACE);
        when(events.findById(10L)).thenReturn(Optional.of(event));
        when(events.findByIdForUpdate(10L)).thenReturn(Optional.of(event));
        when(events.save(event)).thenReturn(event);
        when(holds.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @ParameterizedTest
    @EnumSource(value = EventStatus.class, names = {"CANCELLED", "REJECTED", "PENDING_APPROVAL", "AWAITING_DEPOSIT"})
    void nonPublishedEventCannotBeQuotedHeldOrChargedForBalance(EventStatus status) {
        event.setStatus(status);
        PaymentRequest request = balanceRequest();
        assertThrows(ResponseStatusException.class, () -> quotes.quote(request, owner));
        assertThrows(ResponseStatusException.class,
                () -> holdService.createHold(request, owner, PaymentType.EVENT_BALANCE, 14000L));
        assertThrows(ResponseStatusException.class,
                () -> billing.payBalance(10L, "unused-audit-id", owner));
        verifyNoInteractions(payments);
        verify(holds, never()).save(any());
    }

    @Test
    void publishedEventBalanceRemainsPayableBeforeDeadline() {
        assertEquals(14000L, quotes.quote(balanceRequest(), owner).amountCents());
        assertNotNull(holdService.createHold(balanceRequest(), owner, PaymentType.EVENT_BALANCE, 14000L));
        assertNotNull(billing.payBalance(10L, "unused-audit-id", owner));
        verify(payments).consume("unused-audit-id", owner, PaymentType.EVENT_BALANCE, 14000L, 10L);
    }

    @Test
    void balanceFinalizationRechecksCancellationAfterQuote() {
        assertEquals(14000L, quotes.quote(balanceRequest(), owner).amountCents());
        event.setStatus(EventStatus.CANCELLED);
        assertThrows(ResponseStatusException.class, () -> billing.payBalance(10L, "unused-audit-id", owner));
        verifyNoInteractions(payments);
    }

    @ParameterizedTest
    @EnumSource(value = EventStatus.class, names = {"AWAITING_DEPOSIT", "PENDING_APPROVAL", "REJECTED"})
    void adminStatusCannotBypassOrganizerDeposit(EventStatus status) {
        event.setStatus(status);
        event.setDepositPaidAt(null);
        var error = assertThrows(ResponseStatusException.class, () -> publishAsAdmin());
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals(status, event.getStatus());
        verify(planning, never()).activateParkingForPublication(any());
    }

    @Test
    void paidOrganizerEventCanBePublished() {
        event.setStatus(EventStatus.AWAITING_DEPOSIT);
        assertDoesNotThrow(this::publishAsAdmin);
        assertEquals(EventStatus.PUBLISHED, event.getStatus());
    }

    @Test
    void internalAdminEventKeepsItsExistingPublicationRule() {
        owner.setRole(Role.ADMIN);
        event.setStatus(EventStatus.PENDING_APPROVAL);
        event.setDepositPaidAt(null);
        assertDoesNotThrow(this::publishAsAdmin);
        assertEquals(EventStatus.PUBLISHED, event.getStatus());
    }

    @Test
    void approvalRequestsFullRoomPaymentBeforePublication() {
        event.setStatus(EventStatus.PENDING_APPROVAL);
        event.setDepositPaidAt(null);
        billing.prepareAfterApproval(event);
        assertEquals(event.getEndDateTime(), event.getSettlementDueAt());
        assertEquals("FULL", event.getRoomPaymentMode());
        assertEquals(20000L, event.getRoomCostCents());
        assertEquals(20000L, event.getDepositAmountCents());
        assertEquals(0L, event.getBalanceDueCents());
        assertEquals(EventStatus.AWAITING_DEPOSIT, event.getStatus());
        assertThrows(ResponseStatusException.class, () -> billing.validatePaymentForPublication(event));
        PaymentRequest request = new PaymentRequest();
        request.setEventId(10L);
        request.setReservationType("EVENT_DEPOSIT");
        assertEquals(20000L, quotes.quote(request, owner).amountCents());
        billing.payDeposit(10L, "full-room-payment", owner);
        verify(payments).consume("full-room-payment", owner, PaymentType.EVENT_DEPOSIT, 20000L, 10L);
        assertEquals(EventStatus.PUBLISHED, event.getStatus());
        assertNotNull(event.getBalancePaidAt());
        assertEquals(0L, event.getBalanceDueCents());
        assertDoesNotThrow(() -> billing.validatePaymentForPublication(event));
        assertThrows(ResponseStatusException.class, () -> billing.payDeposit(10L, "full-room-payment", owner));
        verify(payments, times(1)).consume(anyString(), any(), any(), anyLong(), anyLong());
        assertThrows(ResponseStatusException.class, () -> billing.payBalance(10L, "second-charge", owner));
    }

    @Test
    void endedEventCannotQuoteHoldOrFinalizeLegacyBalanceWithOldDeadline() {
        assertEquals(14000L, quotes.quote(balanceRequest(), owner).amountCents());
        event.setEndDateTime(LocalDateTime.now().minusSeconds(1));
        event.setSettlementDueAt(LocalDateTime.now().plusHours(47));
        assertBalanceClosed();
    }

    @Test
    void recordedPayoutPreventsSeparateBalanceEvenIfEventDateChanges() {
        event.setSettlementStatus("PAID");
        assertBalanceClosed();
    }

    @Test
    void balanceClosesExactlyAtEventEnd() {
        LocalDateTime boundary = event.getEndDateTime();
        assertTrue(event.canPayRoomBalanceAt(boundary.minusNanos(1)));
        assertFalse(event.canPayRoomBalanceAt(boundary));
        assertFalse(event.canPayRoomBalanceAt(boundary.plusNanos(1)));
    }

    private void assertBalanceClosed() {
        assertThrows(ResponseStatusException.class, () -> quotes.quote(balanceRequest(), owner));
        assertThrows(ResponseStatusException.class,
                () -> holdService.createHold(balanceRequest(), owner, PaymentType.EVENT_BALANCE, 14000L));
        assertThrows(ResponseStatusException.class, () -> billing.payBalance(10L, "late-balance", owner));
        verifyNoInteractions(payments);
        verify(holds, never()).save(any());
    }

    private void publishAsAdmin() {
        User admin = new User();
        admin.setId(2L);
        admin.setRole(Role.ADMIN);
        var users = mock(UserRepository.class);
        when(users.findByEmail("audit-admin@meetspace.test")).thenReturn(Optional.of(admin));
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("audit-admin@meetspace.test");
        var controller = new AdminEventController(events, mock(EventRegistrationRepository.class),
                mock(ParkingReservationRepository.class), users, planning, billing,
                mock(AuditService.class), mock(NotificationService.class));
        controller.updateStatus(10L, "PUBLISHED", authentication, new MockHttpServletRequest());
    }

    private PaymentRequest balanceRequest() {
        PaymentRequest request = new PaymentRequest();
        request.setReservationType("EVENT_BALANCE");
        request.setEventId(10L);
        return request;
    }
}
