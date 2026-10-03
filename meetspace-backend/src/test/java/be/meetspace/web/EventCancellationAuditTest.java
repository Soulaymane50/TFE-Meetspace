package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.service.*;
import be.meetspace.web.controller.EventRegistrationController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EventCancellationAuditTest {
    private EventRegistrationRepository registrations;
    private PaymentLifecycleService payments;
    private EventRegistrationController controller;
    private EventPlanningService planning;
    private EventRegistration registration;
    private User member;

    @BeforeEach
    void setUp() {
        registrations = mock(EventRegistrationRepository.class);
        payments = mock(PaymentLifecycleService.class);
        planning = mock(EventPlanningService.class);
        when(payments.refundBookingPayment(anyString(), anyLong(), anyLong(), any(), any(), anyLong(), anyLong()))
                .thenReturn(new PaymentLifecycleService.RefundResult(5000L, 5000L, PaymentStatus.PARTIALLY_REFUNDED));
        UserRepository users = mock(UserRepository.class);
        member = new User();
        member.setId(1L);
        member.setEmail("cancel-audit@meetspace.test");
        member.setRole(Role.MEMBER);
        Event event = new Event();
        event.setId(10L);
        event.setTitle("Annulation test");
        event.setStatus(EventStatus.PUBLISHED);
        event.setStartDateTime(LocalDateTime.now().plusHours(36));
        registration = new EventRegistration();
        registration.setId(20L);
        registration.setEvent(event);
        registration.setUser(member);
        registration.setTotalPrice(100D);
        registration.setPaymentIntentId("pi_audit_not_remote");
        when(users.findByEmail(member.getEmail())).thenReturn(Optional.of(member));
        when(registrations.findByIdForUpdate(20L)).thenReturn(Optional.of(registration));
        controller = new EventRegistrationController(registrations, mock(EventRepository.class), users,
                mock(ParkingReservationRepository.class), payments, new CancellationPolicyService(),
                mock(AuditService.class), mock(EmailService.class), mock(NotificationService.class),
                mock(EventWaitlistService.class), mock(ParkingCapacityService.class), mock(ParkingAccessService.class), planning);
    }

    @Test
    void repeatingAPartialCancellationCannotRefundTwice() {
        var auth = new UsernamePasswordAuthenticationToken(member.getEmail(), null);
        var first = controller.cancelRegistration(20L, auth, new MockHttpServletRequest());
        assertEquals(5000L, first.refundedAmountCents());
        assertEquals(EventRegistrationStatus.CANCELLED, registration.getStatus());
        var error = assertThrows(ResponseStatusException.class,
                () -> controller.cancelRegistration(20L, auth, new MockHttpServletRequest()));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(registrations, times(2)).findByIdForUpdate(20L);
        verify(payments, times(1)).refundBookingPayment("pi_audit_not_remote", 5000L, 10000L,
                member, PaymentType.EVENT, 10L, 20L);
    }

    @Test
    void alreadyCancelledRegistrationCannotStartARefund() {
        registration.setStatus(EventRegistrationStatus.CANCELLED);
        var error = assertThrows(ResponseStatusException.class, () -> controller.cancelRegistration(20L,
                new UsernamePasswordAuthenticationToken(member.getEmail(), null), new MockHttpServletRequest()));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verifyNoInteractions(payments);
    }

    @Test
    void providerCancellationKeepsClientRefundRetryRightsAfterEventStart() {
        registration.getEvent().setStatus(EventStatus.CANCELLED);
        registration.getEvent().setStartDateTime(LocalDateTime.now().minusDays(1));
        registration.setStatus(EventRegistrationStatus.CANCELLED);
        when(planning.refundProviderCancelledRegistration(registration))
                .thenReturn(new PaymentLifecycleService.RefundResult(5000L, 10000L, PaymentStatus.REFUNDED));
        var result = controller.cancelRegistration(20L,
                new UsernamePasswordAuthenticationToken(member.getEmail(), null), new MockHttpServletRequest());
        assertEquals(100, result.refundPercent()); assertEquals(10000L, result.refundedAmountCents());
        assertEquals("REFUNDED", result.status()); verifyNoInteractions(payments);
    }

    @Test
    void voluntaryPendingRefundDoesNotClaimAnUnconfirmedAmount() {
        when(payments.refundBookingPayment(anyString(), anyLong(), anyLong(), any(), any(), anyLong(), anyLong()))
                .thenReturn(new PaymentLifecycleService.RefundResult(0L, 0L, PaymentStatus.REFUND_PENDING));
        var result = controller.cancelRegistration(20L,
                new UsernamePasswordAuthenticationToken(member.getEmail(), null), new MockHttpServletRequest());
        assertEquals(0L, result.refundedAmountCents());
        assertTrue(result.message().contains("en cours"));
        assertEquals(EventRegistrationStatus.CANCELLED, registration.getStatus());
    }

    @Test
    void cancellationOfSomeoneElsesRegistrationRemainsForbidden() {
        User other = new User();
        other.setId(99L);
        registration.setUser(other);
        var error = assertThrows(ResponseStatusException.class, () -> controller.cancelRegistration(20L,
                new UsernamePasswordAuthenticationToken(member.getEmail(), null), new MockHttpServletRequest()));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verifyNoInteractions(payments);
    }
}
