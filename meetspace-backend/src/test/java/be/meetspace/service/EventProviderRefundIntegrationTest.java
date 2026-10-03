package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"spring.flyway.enabled=false", "app.mail.enabled=false"})
@ActiveProfiles("test")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({EventPlanningService.class, PaymentLifecycleService.class, NotificationService.class,
        EventProviderRefundIntegrationTest.Config.class})
class EventProviderRefundIntegrationTest {
    @Autowired EventPlanningService planning;
    @Autowired PaymentLifecycleService payments;
    @Autowired EventRepository events;
    @Autowired EventRegistrationRepository registrations;
    @Autowired ParkingReservationRepository parkings;
    @Autowired PaymentRecordRepository records;
    @Autowired PaymentRefundRepository refunds;
    @Autowired UserRepository users;
    @Autowired UserNotificationRepository notifications;
    @Autowired PlatformTransactionManager manager;
    @Autowired ProviderStub provider;
    @MockBean BookingHoldService holds;
    @MockBean ParkingCapacityService capacity;
    @MockBean ParkingAccessService accesses;
    TransactionTemplate tx;
    Event event;
    EventRegistration ticket;
    ParkingReservation parking;
    User user;
    String pi;

    @TestConfiguration static class Config {
        @Bean ProviderStub paymentVerifier() { return new ProviderStub(); }
    }
    @BeforeEach void fixture() {
        tx = new TransactionTemplate(manager); provider.reset();
        user = new User(); user.setFirstName("Refund"); user.setLastName("Event");
        user.setEmail(UUID.randomUUID() + "@example.test"); user.setPasswordHash("test-fixture"); user.setRole(Role.MEMBER);
        user = users.saveAndFlush(user);
        event = new Event(); event.setTitle("Contrat annulé"); event.setCapacity(20); event.setPrice(999D);
        event.setStartDateTime(LocalDateTime.now().plusDays(10)); event.setEndDateTime(event.getStartDateTime().plusHours(2));
        event.setStatus(EventStatus.PUBLISHED); event.setCreatedBy(user); event.setLocationType(EventLocationType.EXTERNAL);
        ParkingSlot slot = new ParkingSlot(); slot.setTitle("Parking contrat"); slot.setDescription("Fixture restitution"); slot.setCapacity(20); slot.setParkingRate(12D);
        slot.setSessionDate(event.getStartDateTime().toLocalDate()); slot.setStartTime(event.getStartDateTime().toLocalTime());
        slot.setEndTime(event.getEndDateTime().toLocalTime()); slot.setStatus(ParkingSlotStatus.OPEN); slot.setEvent(event);
        event.setParkingSlot(slot); event = events.saveAndFlush(event);
        pi = "pi_event_audit_" + UUID.randomUUID().toString().replace("-", "");
        ticket = new EventRegistration(); ticket.setUser(user); ticket.setEvent(event); ticket.setNumberOfParticipants(2);
        ticket.setTotalPrice(100D); ticket.setPaymentIntentId(pi); ticket = registrations.saveAndFlush(ticket);
        parking = new ParkingReservation(); parking.setUser(user); parking.setParkingSlot(event.getParkingSlot());
        parking.setEventRegistration(ticket); parking.setReservedSpaces(1); parking.setTotalPrice(12D);
        parking.setPaymentIntentId(pi); parking = parkings.saveAndFlush(parking);
        PaymentRecord record = new PaymentRecord(); record.setPaymentIntentId(pi); record.setUser(user);
        record.setType(PaymentType.EVENT); record.setAmountCents(11200L); record.setResourceId(event.getId());
        record.setBookingEntityId(ticket.getId()); record.setConsumedAt(LocalDateTime.now()); record.setStatus(PaymentStatus.CONSUMED);
        records.saveAndFlush(record);
    }
    @Test void providerCancellationRestitutesRemainderOfCombinedPaymentOnlyOnce() {
        payments.refundBookingPayment(pi, 5600L, 11200L, user, PaymentType.EVENT, event.getId(), ticket.getId());
        assertEquals(5600L, record().getRefundedAmountCents());
        tx.executeWithoutResult(s -> {
            var cancelled = registrations.findByIdForUpdate(ticket.getId()).orElseThrow();
            cancelled.setStatus(EventRegistrationStatus.CANCELLED);
            parkings.findByIdForUpdate(parking.getId()).orElseThrow().setStatus(ParkingReservationStatus.CANCELLED);
        });
        cancelProvider();
        assertCancelledAccess();
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(11200L, record().getRefundedAmountCents());
        assertEquals(11200L, provider.total());
        assertEquals(2, provider.creates);
        var retry = retryClientRefund();
        assertEquals(0L, retry.refundedNowCents()); assertEquals(11200L, retry.refundedTotalCents());
        assertEquals(2, provider.creates);
        assertTrue(notifications.findAll().stream().anyMatch(n -> n.getUser().getId().equals(user.getId())
                && n.getMessage().contains("intégrale")));
    }
    @Test void pendingRefundPreservesFullFinancialRightUntilConfirmation() {
        provider.pending = true;
        cancelProvider(); assertCancelledAccess();
        assertEquals(PaymentStatus.REFUND_PENDING, record().getStatus());
        assertEquals(0L, record().getRefundedAmountCents());
        assertTrue(refunds.findByPaymentIntentId(pi).stream().anyMatch(r -> r.getStatus().equals("full_requested")));
        assertTrue(notifications.findAll().stream().anyMatch(n -> n.getUser().getId().equals(user.getId())
                && n.getMessage().contains("conservez le droit")));
        provider.confirmAll();
        var retry = retryClientRefund();
        assertEquals(PaymentStatus.REFUNDED, retry.status());
        assertEquals(11200L, record().getRefundedAmountCents()); assertEquals(1, provider.creates);
    }
    @Test void lostProviderResponseKeepsDurableRefundAndRetryDoesNotDoubleDebit() {
        provider.loseOnce = true;
        assertThrows(IllegalStateException.class, this::cancelProvider);
        assertEquals(EventStatus.PUBLISHED, events.findById(event.getId()).orElseThrow().getStatus());
        assertEquals(EventRegistrationStatus.CONFIRMED, registrations.findById(ticket.getId()).orElseThrow().getStatus());
        assertTrue(refunds.findByPaymentIntentId(pi).stream().anyMatch(r -> r.getStatus().equals("unknown")));
        assertEquals(11200L, provider.total());
        cancelProvider(); assertCancelledAccess();
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(11200L, record().getRefundedAmountCents()); assertEquals(1, provider.creates);
    }
    void cancelProvider() {
        tx.executeWithoutResult(s -> {
            planning.lockParkingInventory();
            Event current = events.findByIdForUpdate(event.getId()).orElseThrow();
            current.setStatus(EventStatus.CANCELLED); planning.syncParkingStatus(current);
        });
    }
    PaymentLifecycleService.RefundResult retryClientRefund() {
        return tx.execute(s -> {
            planning.lockParkingInventory();
            return planning.refundProviderCancelledRegistration(registrations.findByIdForUpdate(ticket.getId()).orElseThrow());
        });
    }
    void assertCancelledAccess() {
        assertEquals(EventStatus.CANCELLED, events.findById(event.getId()).orElseThrow().getStatus());
        assertEquals(EventRegistrationStatus.CANCELLED, registrations.findById(ticket.getId()).orElseThrow().getStatus());
        assertEquals(ParkingReservationStatus.CANCELLED, parkings.findById(parking.getId()).orElseThrow().getStatus());
        verify(accesses).cancelPasses(any());
    }
    PaymentRecord record() { return records.findByPaymentIntentId(pi).orElseThrow(); }
    static class ProviderStub extends PaymentVerifier {
        final Map<String, RefundSnapshot> stored = new LinkedHashMap<>();
        boolean pending, loseOnce; int creates;
        ProviderStub() { super(new MockEnvironment()); }
        void reset() { stored.clear(); pending = false; loseOnce = false; creates = 0; }
        @Override public List<RefundSnapshot> listRefunds(String pi) { return stored.values().stream().filter(r -> r.paymentIntentId().equals(pi)).toList(); }
        @Override public RefundSnapshot inspectRefund(String id) { return stored.values().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow(); }
        @Override public RefundSnapshot refund(String pi, long amount, String key) {
            RefundSnapshot result = stored.get(key);
            if (result == null) {
                result = new RefundSnapshot("re_" + UUID.randomUUID(), pi, amount, "eur", pending ? "pending" : "succeeded", key);
                stored.put(key, result); creates++;
            }
            if (loseOnce) { loseOnce = false; throw new IllegalStateException("Provider response lost"); }
            return result;
        }
        long total() { return stored.values().stream().mapToLong(RefundSnapshot::amountCents).sum(); }
        void confirmAll() { stored.replaceAll((key, r) -> new RefundSnapshot(r.id(), r.paymentIntentId(), r.amountCents(), r.currency(), "succeeded", r.operationKey())); }
    }
}