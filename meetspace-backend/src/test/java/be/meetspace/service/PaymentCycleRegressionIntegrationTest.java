package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.StripeWebhookController;
import com.stripe.Stripe;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DataJpaTest(showSql = false, properties = {
        "spring.datasource.url=jdbc:h2:mem:payment-cycle;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000",
        "spring.flyway.enabled=false", "app.mail.enabled=false", "stripe.secret-key=",
        "stripe.public-key=", "spring.jpa.properties.hibernate.format_sql=false"
})
@ActiveProfiles("test")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({PaymentLifecycleService.class, BookingHoldExpiryService.class, PaymentCycleRegressionIntegrationTest.Config.class})
class PaymentCycleRegressionIntegrationTest {
    private static final String SECRET = "whsec_payment_cycle_fixture";
    @Autowired PaymentLifecycleService service;
    @Autowired BookingHoldExpiryService expiry;
    @Autowired PaymentRecordRepository payments;
    @Autowired PaymentRefundRepository refunds;
    @Autowired BookingHoldRepository holds;
    @Autowired UserRepository users;
    @Autowired StubStripe stripe;
    @Autowired PlatformTransactionManager manager;
    @MockBean BookingHoldService holdService;
    TransactionTemplate tx;
    MockMvc mvc;
    User user;
    String pi;

    @TestConfiguration static class Config {
        @Bean StubStripe paymentVerifier() { return new StubStripe(); }
    }

    @BeforeEach void setup() {
        tx = new TransactionTemplate(manager);
        refunds.deleteAll(); payments.deleteAll(); holds.deleteAll(); users.deleteAll();
        stripe.reset();
        user = new User(); user.setFirstName("Payment"); user.setLastName("Fixture");
        user.setEmail(UUID.randomUUID() + "@example.test"); user.setPasswordHash("not-a-real-password"); user.setRole(Role.MEMBER);
        user = users.saveAndFlush(user);
        pi = "pi_" + UUID.randomUUID().toString().replace("-", "");
        mvc = MockMvcBuilders.standaloneSetup(new StripeWebhookController(service, SECRET)).build();
        when(holdService.consume(anyString(), any(), any(), anyLong())).thenAnswer(call -> {
            BookingHold hold = holds.findByTokenForUpdate(call.getArgument(0)).orElseThrow();
            if (hold.getStatus() != BookingHoldStatus.ACTIVE || !hold.getExpiresAt().isAfter(LocalDateTime.now())) {
                throw new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Hold expired");
            }
            hold.setStatus(BookingHoldStatus.CONSUMED);
            return hold;
        });
    }

    @Test void lostResponseThenRetryRefundsOnce() {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.loseResponse = true;
        assertThrows(IllegalStateException.class, () -> service.refund(pi, 5000L));
        assertEquals(0L, record().getRefundedAmountCents());
        assertEquals("unknown", refunds.findAll().get(0).getStatus());
        service.refund(pi, 5000L);
        service.refund(pi, 5000L);
        assertEquals(1, stripe.createCalls.get());
        assertEquals(5000L, stripe.providerTotal());
        assertEquals(5000L, record().getRefundedAmountCents());
        assertEquals(PaymentStatus.PARTIALLY_REFUNDED, record().getStatus());
    }

    @Test void unknownOutcomeRetriesWithSameKeyAndOriginalAmount() {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.failBeforeAcceptance = true;
        assertThrows(IllegalStateException.class, () -> service.refund(pi, 5000L));
        String key = refunds.findAll().get(0).getOperationKey();
        stripe.failBeforeAcceptance = false;
        service.refund(pi, 10000L);
        assertEquals(List.of(key, key), stripe.usedKeys);
        assertEquals(5000L, stripe.providerTotal(), "Original operation amount must survive a changed cancellation policy");
    }

    @Test void refundJournalSurvivesBookingRollback() {
        fixture(PaymentStatus.CONSUMED, true, false);
        assertThrows(IllegalStateException.class, () -> tx.executeWithoutResult(s -> {
            service.refund(pi, 5000L);
            throw new IllegalStateException("Booking transaction failed after provider acceptance");
        }));
        assertEquals(0L, record().getRefundedAmountCents());
        assertEquals("succeeded", refunds.findAll().get(0).getStatus());
        service.refund(pi, 5000L);
        assertEquals(1, stripe.createCalls.get());
        assertEquals(5000L, record().getRefundedAmountCents());
    }

    @Test void pendingRefundCountsOnlyAfterSignedRepeatedWebhook() throws Exception {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.newRefundStatus = "pending";
        service.refund(pi, 10000L);
        assertEquals(0L, record().getRefundedAmountCents());
        assertEquals(PaymentStatus.REFUND_PENDING, record().getStatus());
        String refundId = stripe.firstRefundId();
        stripe.changeRefund(refundId, "succeeded");
        webhook("refund.updated", "refund", refundId, true);
        webhook("refund.updated", "refund", refundId, true);
        assertEquals(10000L, record().getRefundedAmountCents());
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(1, refunds.count());
        assertEquals(1, stripe.createCalls.get());
    }

    @Test void failedRefundNeverBecomesFinancialConfirmation() throws Exception {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.newRefundStatus = "pending";
        service.refund(pi, 10000L);
        String refundId = stripe.firstRefundId();
        stripe.changeRefund(refundId, "failed");
        webhook("refund.failed", "refund", refundId, true);
        webhook("refund.failed", "refund", refundId, true);
        expiry.expireOldHolds();
        assertEquals(0L, record().getRefundedAmountCents());
        assertEquals(PaymentStatus.REFUND_PENDING, record().getStatus());
        assertEquals("failed", refunds.findAll().get(0).getStatus());
        assertEquals(1, stripe.createCalls.get());
    }

    @Test void externalDashboardRefundIsCountedOnce() throws Exception {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.provider.put("external", new PaymentVerifier.RefundSnapshot("re_external", pi, 3500L, "eur", "succeeded", null));
        webhook("refund.created", "refund", "re_external", true);
        webhook("refund.updated", "refund", "re_external", true);
        assertEquals(3500L, record().getRefundedAmountCents());
        assertEquals(1, refunds.count());
        assertEquals(0, stripe.createCalls.get());
    }

    @Test void forgedWebhookCannotChangeCounters() throws Exception {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.provider.put("external", new PaymentVerifier.RefundSnapshot("re_forged", pi, 10000L, "eur", "succeeded", null));
        webhook("refund.updated", "refund", "re_forged", false);
        assertEquals(0L, record().getRefundedAmountCents());
        assertEquals(0, refunds.count());
    }

    @Test void missingSignatureIsRejected() throws Exception {
        mvc.perform(post("/api/payments/webhook").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test void navigationAbandonedWithMissingWebhookIsCompensatedByScheduler() {
        fixture(PaymentStatus.PENDING, false, true);
        expiry.expireOldHolds(); expiry.expireOldHolds();
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(10000L, record().getRefundedAmountCents());
        assertEquals(1, stripe.createCalls.get());
    }

    @Test void expiredHoldWithSignedRepeatedSuccessIsCompensated() throws Exception {
        fixture(PaymentStatus.PENDING, false, true);
        webhook("payment_intent.succeeded", "payment_intent", pi, true);
        webhook("payment_intent.succeeded", "payment_intent", pi, true);
        expiry.expireOldHolds();
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(1, stripe.createCalls.get());
        assertThrows(ResponseStatusException.class, () -> service.consume(pi, user, PaymentType.SPACE, 10000L, 42L));
    }

    @Test void resourceConflictRollbackEventuallyCompensatesPayment() {
        fixture(PaymentStatus.SUCCEEDED, false, false);
        assertThrows(IllegalStateException.class, () -> tx.executeWithoutResult(s -> {
            service.consume(pi, user, PaymentType.SPACE, 10000L, 42L);
            throw new IllegalStateException("Resource became unavailable before booking commit");
        }));
        assertEquals(PaymentStatus.SUCCEEDED, record().getStatus());
        expireFixtureHold();
        expiry.expireOldHolds();
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(1, stripe.createCalls.get());
    }

    @Test void activeHoldAllowsOneAtomicBookingBeforeExpiration() throws Exception {
        fixture(PaymentStatus.PENDING, false, false);
        webhook("payment_intent.succeeded", "payment_intent", pi, true);
        assertEquals(0, stripe.createCalls.get());
        tx.executeWithoutResult(s -> {
            service.consume(pi, user, PaymentType.SPACE, 10000L, 42L);
            service.bindToBooking(pi, 101L);
        });
        expireFixtureHold();
        webhook("payment_intent.succeeded", "payment_intent", pi, true);
        expiry.expireOldHolds();
        assertEquals(PaymentStatus.CONSUMED, record().getStatus());
        assertEquals(101L, record().getBookingEntityId());
        assertEquals(0, stripe.createCalls.get());
        assertThrows(ResponseStatusException.class, () -> service.consume(pi, user, PaymentType.SPACE, 10000L, 42L));
        assertThrows(ResponseStatusException.class, () -> service.bindToBooking(pi, 102L));
    }

    @Test void consumedOrganizerChargeIsBoundWithoutChangingItsCaller() {
        fixture(PaymentStatus.SUCCEEDED, false, false);
        tx.executeWithoutResult(s -> {
            PaymentRecord p = payments.findByPaymentIntentIdForUpdate(pi).orElseThrow();
            p.setType(PaymentType.EVENT_DEPOSIT);
        });
        stripe.paymentType = PaymentType.EVENT_DEPOSIT;
        service.consume(pi, user, PaymentType.EVENT_DEPOSIT, 10000L, 42L);
        expireFixtureHold();
        expiry.expireOldHolds();
        assertEquals(42L, record().getBookingEntityId());
        assertEquals(PaymentStatus.CONSUMED, record().getStatus());
        assertEquals(0, stripe.createCalls.get());
    }

    @Test void delayedFailureWebhookUsesCurrentStripeSuccess() throws Exception {
        fixture(PaymentStatus.PENDING, false, false);
        webhook("payment_intent.payment_failed", "payment_intent", pi, true);
        assertEquals(PaymentStatus.SUCCEEDED, record().getStatus());
        verify(holdService, never()).cancel(any());
    }

    @Test void invalidProviderPaymentMetadataCannotConfirmOrCompensate() throws Exception {
        fixture(PaymentStatus.PENDING, false, true);
        stripe.metadataUser = "different-user";
        expiry.expireOldHolds();
        assertEquals(PaymentStatus.PENDING, record().getStatus());
        assertEquals(0, stripe.createCalls.get());
        assertThrows(ResponseStatusException.class, () -> service.markSucceededFromWebhook(pi));
    }

    @Test void unknownOutcomeBeyondStripeWindowIsReconciledWithoutNewSubmission() {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.failBeforeAcceptance = true;
        assertThrows(IllegalStateException.class, () -> service.refund(pi, 5000L));
        tx.executeWithoutResult(s -> refunds.findAll().forEach(r -> r.setFirstAttemptAt(LocalDateTime.now().minusHours(25))));
        stripe.failBeforeAcceptance = false;
        expiry.expireOldHolds();
        assertEquals(1, stripe.createCalls.get());
        assertEquals("unknown", refunds.findAll().get(0).getStatus());
        assertEquals(PaymentStatus.REFUND_PENDING, record().getStatus());
        assertEquals(0L, record().getRefundedAmountCents());
    }

    @Test void durableUnknownRefundBlocksConsumptionAfterRollback() {
        fixture(PaymentStatus.SUCCEEDED, false, false);
        stripe.failBeforeAcceptance = true;
        assertThrows(IllegalStateException.class, () -> service.refund(pi, 10000L, "orphan-compensation"));
        assertThrows(ResponseStatusException.class, () -> service.consume(pi, user, PaymentType.SPACE, 10000L, 42L));
        verify(holdService, never()).consume(anyString(), any(), any(), anyLong());
    }

    @Test void concurrentSchedulerAndWebhookCreateOnlyOneCompensation() throws Exception {
        fixture(PaymentStatus.PENDING, false, true);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            Future<?> scheduler = executor.submit(() -> { await(go); expiry.expireOldHolds(); });
            Future<?> webhook = executor.submit(() -> { await(go); service.markSucceededFromWebhook(pi); });
            go.countDown();
            scheduler.get(10, TimeUnit.SECONDS); webhook.get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
        assertEquals(1, stripe.createCalls.get());
        assertEquals(2, refunds.count());
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
    }

    @Test void providerCancellationRefundsFullRemainingAfterCustomerHalfRefund() {
        fixture(PaymentStatus.CONSUMED, true, false);
        service.refundBookingPayment(pi, 5000L, 10000L, user, PaymentType.SPACE, 42L, 101L);
        service.refundFullBookingPayment(pi, 10000L, user, PaymentType.SPACE, 42L, 101L);
        service.refundFullBookingPayment(pi, 10000L, user, PaymentType.SPACE, 42L, 101L);
        assertEquals(10000L, stripe.providerTotal());
        assertEquals(10000L, record().getRefundedAmountCents());
        assertEquals(PaymentStatus.REFUNDED, record().getStatus());
        assertEquals(2, stripe.createCalls.get());
    }

    @Test void providerCancellationKeepsFullTargetIfPriorPendingCustomerRefundFails() throws Exception {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.newRefundStatus = "pending";
        service.refund(pi, 5000L);
        String customerRefund = stripe.firstRefundId();
        stripe.newRefundStatus = "succeeded";
        service.refundFullBookingPayment(pi, 10000L, user, PaymentType.SPACE, 42L, 101L);
        assertEquals(5000L, record().getRefundedAmountCents());
        stripe.changeRefund(customerRefund, "failed");
        webhook("refund.failed", "refund", customerRefund, true);
        expiry.expireOldHolds();
        assertEquals(10000L, stripe.providerTotal());
        assertEquals(10000L, record().getRefundedAmountCents());
        assertEquals(3, stripe.createCalls.get());
    }

    @Test void fullRefundTargetSurvivesProviderCancellationRollback() {
        fixture(PaymentStatus.CONSUMED, true, false);
        stripe.loseResponse = true;
        assertThrows(IllegalStateException.class,
                () -> service.refundFullBookingPayment(pi, 10000L, user, PaymentType.SPACE, 42L, 101L));
        expiry.expireOldHolds();
        expiry.expireOldHolds();
        assertEquals(10000L, stripe.providerTotal());
        assertEquals(10000L, record().getRefundedAmountCents());
        assertEquals(1, stripe.createCalls.get());
    }

    private void fixture(PaymentStatus state, boolean bound, boolean expired) {
        tx.executeWithoutResult(s -> {
            BookingHold hold = new BookingHold(); hold.setToken(UUID.randomUUID().toString());
            hold.setUser(user); hold.setType(PaymentType.SPACE); hold.setResourceId(42L);
            hold.setAmountCents(10000L); hold.setExpiresAt(LocalDateTime.now().plusMinutes(expired ? -1 : 15));
            if (bound) hold.setStatus(BookingHoldStatus.CONSUMED);
            holds.saveAndFlush(hold);
            PaymentRecord record = new PaymentRecord(); record.setPaymentIntentId(pi); record.setUser(user);
            record.setType(PaymentType.SPACE); record.setAmountCents(10000L); record.setResourceId(42L);
            record.setStatus(state); record.setBookingHold(hold);
            if (bound) { record.setBookingEntityId(101L); record.setConsumedAt(LocalDateTime.now()); }
            payments.saveAndFlush(record);
        });
        stripe.pi = pi; stripe.metadataUser = String.valueOf(user.getId());
    }
    private PaymentRecord record() { return payments.findByPaymentIntentId(pi).orElseThrow(); }
    private void expireFixtureHold() {
        tx.executeWithoutResult(s -> holds.findAll().forEach(h -> h.setExpiresAt(LocalDateTime.now().minusMinutes(1))));
    }
    private static void await(CountDownLatch go) {
        try { if (!go.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Barrier timeout"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
    }

    private void webhook(String type, String object, String id, boolean valid) throws Exception {
        String payload = "{\"id\":\"evt_fixture\",\"object\":\"event\",\"type\":\"" + type
                + "\",\"api_version\":\"" + Stripe.API_VERSION + "\",\"data\":{\"object\":{\"id\":\""
                + id + "\",\"object\":\"" + object + "\"}}}";
        long timestamp = Instant.now().getEpochSecond();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String digest = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
        mvc.perform(post("/api/payments/webhook").contentType("application/json").content(payload)
                        .header("Stripe-Signature", "t=" + timestamp + ",v1=" + (valid ? digest : "00")))
                .andExpect(valid ? status().isOk() : status().isBadRequest());
    }

    static class StubStripe extends PaymentVerifier {
        final Map<String, RefundSnapshot> provider = new ConcurrentHashMap<>();
        final List<String> usedKeys = new CopyOnWriteArrayList<>();
        final AtomicInteger createCalls = new AtomicInteger();
        String pi, metadataUser, paymentStatus = "succeeded", newRefundStatus = "succeeded";
        PaymentType paymentType = PaymentType.SPACE;
        boolean loseResponse, failBeforeAcceptance;
        StubStripe() { super(new MockEnvironment()); }
        void reset() {
            provider.clear(); usedKeys.clear(); createCalls.set(0); loseResponse = false; failBeforeAcceptance = false;
            newRefundStatus = "succeeded"; paymentStatus = "succeeded"; paymentType = PaymentType.SPACE;
        }
        @Override public PaymentStateSnapshot inspectPaymentState(String id) {
            return new PaymentStateSnapshot(paymentStatus, 10000L, "eur",
                    Map.of("userId", metadataUser, "reservationType", paymentType.name()), false);
        }
        @Override public RefundSnapshot refund(String id, long amount, String key) {
            createCalls.incrementAndGet(); usedKeys.add(key);
            if (failBeforeAcceptance) throw new IllegalStateException("Provider unavailable before acceptance");
            RefundSnapshot result = provider.computeIfAbsent(key,
                    k -> new RefundSnapshot("re_" + provider.size(), id, amount, "eur", newRefundStatus, k));
            if (loseResponse) { loseResponse = false; throw new IllegalStateException("Response lost after acceptance"); }
            return result;
        }
        @Override public RefundSnapshot inspectRefund(String id) {
            return provider.values().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow();
        }
        @Override public List<RefundSnapshot> listRefunds(String id) { return new ArrayList<>(provider.values()); }
        long providerTotal() { return provider.values().stream().filter(r -> "succeeded".equals(r.status())).mapToLong(RefundSnapshot::amountCents).sum(); }
        String firstRefundId() { return provider.values().iterator().next().id(); }
        void changeRefund(String id, String status) {
            provider.replaceAll((key, r) -> r.id().equals(id)
                    ? new RefundSnapshot(r.id(), r.paymentIntentId(), r.amountCents(), r.currency(), status, r.operationKey()) : r);
        }
    }
}
