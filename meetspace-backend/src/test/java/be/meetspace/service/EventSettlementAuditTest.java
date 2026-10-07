package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class EventSettlementAuditTest {
    EventRepository events; EventRegistrationRepository registrations; PaymentRecordRepository payments;
    PaymentRefundRepository refunds; EventPayoutRepository payouts; UserRepository users;
    AuditService audit; NotificationService notifications; EventSettlementService service;
    Event event; User owner, admin, customer; EventRegistration ticket; PaymentRecord payment;

    @BeforeEach void setup() {
        events=mock(EventRepository.class); registrations=mock(EventRegistrationRepository.class);
        payments=mock(PaymentRecordRepository.class); refunds=mock(PaymentRefundRepository.class);
        payouts=mock(EventPayoutRepository.class); users=mock(UserRepository.class);
        audit=mock(AuditService.class); notifications=mock(NotificationService.class);
        service=new EventSettlementService(events,registrations,payments,refunds,payouts,users,audit,notifications,mock(ParkingCapacityService.class));
        owner=user(1L,Role.ORGANIZER); admin=user(2L,Role.ADMIN); customer=user(3L,Role.MEMBER);
        event=new Event(); event.setId(10L); event.setTitle("Atelier"); event.setCreatedBy(owner);
        event.setStatus(EventStatus.PUBLISHED); event.setRoomPaymentMode("LEGACY_DEPOSIT");
        event.setEndDateTime(LocalDateTime.now().minusDays(3));
        event.setSettlementDueAt(event.getEndDateTime().plusHours(48));
        event.setBalancePaidAt(LocalDateTime.now().minusDays(1)); event.setPrice(999D);
        ticket=new EventRegistration(); ticket.setId(50L); ticket.setEvent(event); ticket.setUser(customer);
        ticket.setNumberOfParticipants(2); ticket.setTotalPrice(100D); ticket.setStatus(EventRegistrationStatus.CONFIRMED);
        ticket.setPaymentIntentId("pi_ticket");
        payment=new PaymentRecord(); payment.setPaymentIntentId("pi_ticket"); payment.setType(PaymentType.EVENT);
        payment.setResourceId(10L); payment.setBookingEntityId(50L); payment.setUser(customer);
        payment.setConsumedAt(LocalDateTime.now().minusDays(4)); payment.setAmountCents(10000L); payment.setStatus(PaymentStatus.CONSUMED);
        when(events.findByIdForUpdate(10L)).thenReturn(Optional.of(event));
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        when(registrations.findByEventId(10L)).thenReturn(List.of(ticket));
        when(payments.findByResourceIdAndType(10L,PaymentType.EVENT)).thenReturn(List.of(payment));
        when(payouts.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test void actualTicketTotalsAreNotMultipliedOrRepricedAndPaidRoomIsNotDeductedAgain() {
        event.setRoomCostCents(100000L);
        var result=service.preview(event);
        assertEquals(10000L,result.ticketRevenueCents()); assertEquals(1000L,result.commissionCents());
        assertEquals(9000L,result.amountCents()); assertEquals("READY_FOR_PAYOUT",result.status());
    }
    @Test void parkingRevenueIsExcluded() {
        payment.setAmountCents(11600L);
        assertEquals(9000L,service.preview(event).amountCents());
    }
    @Test void retainedHalfOfCancelledTicketsStillBelongsInRevenue() {
        ticket.setStatus(EventRegistrationStatus.CANCELLED); confirmedRefund(5000L);
        var result=service.preview(event); assertEquals(5000L,result.ticketRevenueCents()); assertEquals(4500L,result.amountCents());
    }
    @Test void standardCombinedRefundAllocatesOnlyTicketShare() {
        payment.setAmountCents(11600L); ticket.setStatus(EventRegistrationStatus.CANCELLED); confirmedRefund(5800L);
        assertEquals(4500L,service.preview(event).amountCents());
    }
    @Test void fullRefundLeavesNothingToPay() {
        payment.setAmountCents(11600L); ticket.setStatus(EventRegistrationStatus.CANCELLED); confirmedRefund(11600L);
        assertEquals(0L,service.preview(event).amountCents()); assertEquals("NOTHING_TO_PAY",service.preview(event).status());
    }
    @Test void ambiguousExternalCombinedRefundRequiresReview() {
        payment.setAmountCents(11600L); confirmedRefund(1000L);
        assertEquals("REVIEW_REQUIRED",service.preview(event).status());
    }
    @Test void pendingRefundBlocksRecording() {
        payment.setStatus(PaymentStatus.REFUND_PENDING);
        assertEquals("REFUND_PENDING",service.preview(event).status()); rejectRecord();
    }
    @Test void missingPaymentDoesNotTurnHistoricalEstimateIntoPayout() {
        when(payments.findByResourceIdAndType(10L,PaymentType.EVENT)).thenReturn(List.of());
        assertEquals("REVIEW_REQUIRED",service.preview(event).status()); rejectRecord();
    }
    @Test void unpaidLegacyBalanceIsDeductedWithoutLateFee() {
        event.setBalancePaidAt(null); event.setBalanceDueCents(1000L);
        assertEquals(8000L,service.preview(event).amountCents());
        event.setBalanceDueCents(10000L); assertEquals("BALANCE_OUTSTANDING",service.preview(event).status()); rejectRecord();
    }
    @Test void eventMustEndButNoAdditionalDelayIsRequired() {
        event.setEndDateTime(LocalDateTime.now().plusDays(1)); rejectRecord();
        event.setEndDateTime(LocalDateTime.now().minusSeconds(1));
        // An old persisted deadline must not postpone the new payout rule.
        event.setSettlementDueAt(LocalDateTime.now().plusHours(47));
        assertEquals(event.getEndDateTime(), service.preview(event).dueAt());
        assertEquals("READY_FOR_PAYOUT", service.preview(event).status());
        assertEquals("PAID", record(9000L).status());
    }
    @Test void cancelledEventCannotBeRecorded() { event.setStatus(EventStatus.CANCELLED); rejectRecord(); }
    @Test void aNonAdminCannotRecordAndAStaleAmountCannotBeAccepted() {
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(owner));
        assertEquals(HttpStatus.FORBIDDEN,assertThrows(ResponseStatusException.class,() -> record(9000L)).getStatusCode());
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(admin));
        assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,() -> record(8999L)).getStatusCode());
        verify(payouts,never()).saveAndFlush(any());
    }
    @Test void recordingIsAuditedAndAnIdenticalRetryDoesNotPayTwice() {
        var result=record(9000L); assertEquals("PAID",result.status()); assertEquals("BANK-2026-1",result.transferReference());
        var saved=org.mockito.ArgumentCaptor.forClass(EventPayout.class);
        verify(payouts).saveAndFlush(saved.capture()); when(payouts.findByEventId(10L)).thenReturn(Optional.of(saved.getValue()));
        assertEquals("PAID",record(9000L).status());
        verify(payouts,times(1)).saveAndFlush(any()); verify(audit,times(1)).log(eq(AuditAction.EVENT_PAYOUT_RECORDED),anyString(),eq(10L),anyString(),anyString());
        assertThrows(ResponseStatusException.class,() -> service.record(10L,new RecordEventPayoutRequest("OTHER",9000L),"admin@example.test","local"));
    }
    @Test void referenceCannotBeReusedAcrossEvents() { when(payouts.existsByTransferReference("BANK-2026-1")).thenReturn(true); rejectRecord(); }
    @Test void fullRoomPaymentMustBeBackedByAnActualConsumedRecord() {
        event.setRoomPaymentMode("FULL"); event.setRoomCostCents(100000L); event.setDepositPaidAt(LocalDateTime.now());
        assertEquals("REVIEW_REQUIRED",service.preview(event).status()); rejectRecord();
    }
    @Test void fullRoomAlreadyPaidIsNotDeductedAndAnUnrelatedRoomPaymentBlocksPayout() {
        event.setRoomPaymentMode("FULL"); event.setRoomCostCents(20000L);
        event.setDepositPaymentIntentId("pi_room");
        PaymentRecord room = new PaymentRecord(); room.setPaymentIntentId("pi_room");
        room.setUser(owner); room.setType(PaymentType.EVENT_DEPOSIT); room.setResourceId(10L);
        room.setBookingEntityId(10L); room.setAmountCents(20000L); room.setConsumedAt(LocalDateTime.now().minusDays(4));
        room.setStatus(PaymentStatus.CONSUMED);
        when(payments.findByPaymentIntentId("pi_room")).thenReturn(Optional.of(room));
        assertEquals("READY_FOR_PAYOUT", service.preview(event).status());
        assertEquals(9000L, service.preview(event).amountCents());
        PaymentRefund unresolved = new PaymentRefund(); unresolved.setStatus("unknown");
        when(refunds.findByPaymentIntentId("pi_room")).thenReturn(List.of(unresolved));
        assertEquals("REFUND_PENDING", service.preview(event).status());
        assertThrows(ResponseStatusException.class, () -> record(9000L));
        when(refunds.findByPaymentIntentId("pi_room")).thenReturn(List.of());
        room.setUser(customer);
        assertEquals("REVIEW_REQUIRED", service.preview(event).status()); rejectRecord();
    }
    @Test void aPaymentInAnotherCurrencyCannotBeTreatedAsEuroRevenue() {
        payment.setCurrency("usd");
        assertEquals("REVIEW_REQUIRED", service.preview(event).status()); rejectRecord();
    }

    @Test void unfinishedTicketPaymentBlocksPayoutUntilItIsResolved() {
        PaymentRecord unfinished = new PaymentRecord(); unfinished.setPaymentIntentId("pi_unfinished");
        unfinished.setStatus(PaymentStatus.SUCCEEDED);
        when(payments.findByResourceIdAndType(10L, PaymentType.EVENT)).thenReturn(List.of(payment, unfinished));
        assertEquals("PAYMENT_PENDING", service.preview(event).status()); rejectRecord();
        unfinished.setStatus(PaymentStatus.PENDING);
        assertEquals("PAYMENT_PENDING", service.preview(event).status());
        unfinished.setStatus(PaymentStatus.FAILED);
        assertEquals("READY_FOR_PAYOUT", service.preview(event).status());
        unfinished.setStatus(PaymentStatus.REFUNDED);
        assertEquals("READY_FOR_PAYOUT", service.preview(event).status());
    }

    @Test void unfinishedLegacyBalanceAndItsRefundBlockPayout() {
        PaymentRecord balance = new PaymentRecord(); balance.setPaymentIntentId("pi_balance");
        balance.setStatus(PaymentStatus.SUCCEEDED);
        when(payments.findByResourceIdAndType(10L, PaymentType.EVENT_BALANCE)).thenReturn(List.of(balance));
        assertEquals("PAYMENT_PENDING", service.preview(event).status()); rejectRecord();
        balance.setStatus(PaymentStatus.REFUND_PENDING);
        assertEquals("REFUND_PENDING", service.preview(event).status());
    }

    @Test void promotionToAdminDoesNotEraseAnOrganizersPaidRoomClaim() {
        owner.setRole(Role.ADMIN); event.setDepositPaidAt(LocalDateTime.now().minusDays(3));
        when(events.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(event));
        assertEquals(1, service.list("admin@example.test", true).size());
        assertEquals("PAID", record(9000L).status());
    }

    @Test void unavailableBeneficiaryIsVisibleButCannotBePaid() {
        owner.setStatus(UserStatus.BANNED);
        assertEquals("BENEFICIARY_UNAVAILABLE", service.preview(event).status());
        rejectRecord();
    }

    private void confirmedRefund(long amount) {
        payment.setRefundedAmountCents(amount); payment.setStatus(amount==payment.getAmountCents()?PaymentStatus.REFUNDED:PaymentStatus.PARTIALLY_REFUNDED);
        PaymentRefund r=new PaymentRefund(); r.setAmountCents(amount); r.setStatus("succeeded");
        r.setOperationKey(PaymentVerifier.operationKey("pi_ticket","booking-cancellation"));
        when(refunds.findByPaymentIntentId("pi_ticket")).thenReturn(List.of(r));
    }
    private EventSettlementDto record(long amount) { return service.record(10L,new RecordEventPayoutRequest("bank-2026-1",amount),"admin@example.test","local"); }
    private void rejectRecord() { assertThrows(ResponseStatusException.class,() -> record(9000L)); verify(payouts,never()).saveAndFlush(any()); }
    private User user(Long id,Role role) { User u=new User();u.setId(id);u.setRole(role);u.setEmail("person"+id+"@example.test");u.setFirstName("Test");u.setLastName("Account");return u; }
}
