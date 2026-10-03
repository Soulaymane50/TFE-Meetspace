package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.service.*;
import be.meetspace.web.controller.AdminEventController;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventStatusTransitionAuditTest {
    EventRepository events;
    EventPlanningService planning;
    EventBillingService billing;
    AdminEventController controller;
    Event event;
    @BeforeEach void setUp() {
        events = mock(EventRepository.class); planning = mock(EventPlanningService.class);
        billing = mock(EventBillingService.class);
        User admin = new User(); admin.setId(1L); admin.setRole(Role.ADMIN);
        UserRepository users = mock(UserRepository.class);
        when(users.findByEmail("admin@test.local")).thenReturn(Optional.of(admin));
        event = new Event(); event.setId(10L); event.setTitle("Transitions");
        event.setCapacity(20); event.setPrice(10D); event.setStatus(EventStatus.PUBLISHED);
        event.setDepositPaidAt(LocalDateTime.now());
        when(events.findByIdForUpdate(10L)).thenReturn(Optional.of(event));
        when(events.save(any())).thenAnswer(call -> call.getArgument(0));
        controller = new AdminEventController(events, mock(EventRegistrationRepository.class),
                mock(ParkingReservationRepository.class), users, planning, billing,
                mock(AuditService.class), mock(NotificationService.class));
    }
    @ParameterizedTest
    @CsvSource({"CANCELLED,PUBLISHED", "CANCELLED,PENDING_APPROVAL", "REJECTED,PUBLISHED",
                "PUBLISHED,REJECTED", "PUBLISHED,AWAITING_DEPOSIT", "PUBLISHED,PENDING_APPROVAL"})
    void terminalAndBackwardTransitionsAreRejected(String from, String to) {
        event.setStatus(EventStatus.valueOf(from));
        var error = assertThrows(ResponseStatusException.class, () -> change(to));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals(EventStatus.valueOf(from), event.getStatus());
        verify(events, never()).save(any());
    }
    @Test void repeatedCancellationDoesNotRefundOrNotifyAgain() {
        event.setStatus(EventStatus.CANCELLED);
        change("CANCELLED");
        verify(planning, never()).syncParkingStatus(any());
        verify(events, never()).save(any());
    }
    @Test void inventoryIsLockedBeforeEventAndDepositGuardRemainsActive() {
        event.setStatus(EventStatus.AWAITING_DEPOSIT);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Acompte requis"))
                .when(billing).validatePaymentForPublication(event);
        assertThrows(ResponseStatusException.class, () -> change("PUBLISHED"));
        var order = inOrder(planning, events, billing);
        order.verify(planning).lockParkingInventory();
        order.verify(events).findByIdForUpdate(10L);
        order.verify(billing).validatePaymentForPublication(event);
    }
    @Test void putStatusCancellationUsesCommonTransitionAndSynchronizesContracts() throws Exception {
        var dto = new com.fasterxml.jackson.databind.ObjectMapper().readValue("{\"status\":\"CANCELLED\"}", be.meetspace.web.dto.EventRequestDto.class);
        assertEquals(EventStatus.CANCELLED, dto.getStatus());
        controller.updateEvent(10L, dto, auth(), new MockHttpServletRequest());
        assertEquals(EventStatus.CANCELLED, event.getStatus());
        verify(planning).syncParkingStatus(event);
    }
    @Test void absentOrUnchangedPutStatusRemainsCompatible() {
        var dto = new be.meetspace.web.dto.EventRequestDto();
        assertDoesNotThrow(() -> controller.updateEvent(10L, dto, auth(), new MockHttpServletRequest()));
        assertEquals(EventStatus.PUBLISHED, event.getStatus());
    }
    @ParameterizedTest @org.junit.jupiter.params.provider.EnumSource(value = EventStatus.class, names = {"PENDING_APPROVAL", "CANCELLED"})
    void adminCreationHonorsExplicitStatus(EventStatus status) {
        var dto = new be.meetspace.web.dto.EventRequestDto(); dto.setStatus(status);
        var result = controller.createEvent(dto, auth(), new MockHttpServletRequest());
        assertEquals(status.name(), result.getStatus());
        verify(planning).syncParkingStatus(any());
        verify(planning, never()).activateParkingForPublication(any());
    }
    @Test void adminCreationWithoutStatusKeepsPublishedCompatibility() {
        var result = controller.createEvent(new be.meetspace.web.dto.EventRequestDto(), auth(), new MockHttpServletRequest());
        assertEquals(EventStatus.PUBLISHED.name(), result.getStatus());
        verify(billing).validatePaymentForPublication(any());
        verify(planning).activateParkingForPublication(any());
    }
    @Test void putCannotReopenACancelledEvent() {
        event.setStatus(EventStatus.CANCELLED);
        var dto = new be.meetspace.web.dto.EventRequestDto(); dto.setStatus(EventStatus.PUBLISHED);
        assertThrows(ResponseStatusException.class, () -> controller.updateEvent(10L, dto, auth(), new MockHttpServletRequest()));
        assertEquals(EventStatus.CANCELLED, event.getStatus());
        verify(planning, never()).applyAndValidate(any(), any(), any());
    }
    @Test void putPublicationChecksExistingDepositBeforeDataChanges() {
        event.setStatus(EventStatus.AWAITING_DEPOSIT);
        var dto = new be.meetspace.web.dto.EventRequestDto(); dto.setStatus(EventStatus.PUBLISHED);
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Acompte requis")).when(billing).validatePaymentForPublication(event);
        assertThrows(ResponseStatusException.class, () -> controller.updateEvent(10L, dto, auth(), new MockHttpServletRequest()));
        verify(planning, never()).applyAndValidate(any(), any(), any());
    }
    private UsernamePasswordAuthenticationToken auth() { return new UsernamePasswordAuthenticationToken("admin@test.local", null); }
    private void change(String status) {
        controller.updateStatus(10L, status,
                new UsernamePasswordAuthenticationToken("admin@test.local", null), new MockHttpServletRequest());
    }
}