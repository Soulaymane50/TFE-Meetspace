package be.meetspace.config;

import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.RefundListParams;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaymentVerifierRegressionTest {
    PaymentVerifier verifier = new PaymentVerifier(new MockEnvironment());

    @Test void stripeRefundUsesStableOperationKeyAndMetadata() throws Exception {
        String key = PaymentVerifier.operationKey("pi_fixture", "booking-cancellation");
        Refund refund = refund("re_pending", "pending", 5000L);
        refund.setMetadata(Map.of("meetspaceOperation", key));
        try (MockedStatic<Refund> provider = mockStatic(Refund.class)) {
            provider.when(() -> Refund.create(any(RefundCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        RefundCreateParams params = call.getArgument(0);
                        RequestOptions options = call.getArgument(1);
                        assertEquals("pi_fixture", params.getPaymentIntent());
                        assertEquals(5000L, params.getAmount());
                        assertEquals(key, ((Map<?, ?>) params.getMetadata()).get("meetspaceOperation"));
                        assertEquals(key, options.getIdempotencyKey());
                        return refund;
                    });
            var first = verifier.refund("pi_fixture", 5000L, key);
            var repeated = verifier.refund("pi_fixture", 5000L, key);
            assertEquals("re_pending", first.id());
            assertEquals("pending", repeated.status());
        }
    }

    @Test void compatibleVoidRefundAlsoUsesStableKey() throws Exception {
        String key = PaymentVerifier.operationKey("pi_fixture", "booking-cancellation");
        try (MockedStatic<Refund> provider = mockStatic(Refund.class)) {
            provider.when(() -> Refund.create(any(RefundCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        assertEquals(key, ((RequestOptions) call.getArgument(1)).getIdempotencyKey());
                        return refund("re_fixture", "succeeded", 5000L);
                    });
            verifier.refund("pi_fixture", 5000L);
            verifier.refund("pi_fixture", 5000L);
        }
    }

    @Test void providerFailureDoesNotInventRefundConfirmation() throws Exception {
        try (MockedStatic<Refund> provider = mockStatic(Refund.class)) {
            provider.when(() -> Refund.create(any(RefundCreateParams.class), any(RequestOptions.class)))
                    .thenThrow(mock(StripeException.class));
            var failure = assertThrows(ResponseStatusException.class,
                    () -> verifier.refund("pi_fixture", 5000L, "stable-fixture"));
            assertEquals(502, failure.getStatusCode().value());
        }
    }

    @Test void refundHistoryUsesAllPagesInsteadOfOnlyFirstPage() throws Exception {
        RefundCollection collection = mock(RefundCollection.class);
        when(collection.autoPagingIterable()).thenReturn(List.of(
                refund("re_first", "succeeded", 3000L), refund("re_second", "pending", 2000L)));
        try (MockedStatic<Refund> provider = mockStatic(Refund.class)) {
            provider.when(() -> Refund.list(any(RefundListParams.class))).thenReturn(collection);
            var history = verifier.listRefunds("pi_fixture");
            assertEquals(2, history.size());
            assertEquals("pending", history.get(1).status());
            verify(collection).autoPagingIterable();
        }
    }

    @Test void paymentStateIsFetchedAndPendingIsRefusedForConsumption() throws Exception {
        PaymentIntent intent = new PaymentIntent();
        intent.setStatus("processing"); intent.setAmount(10000L); intent.setCurrency("eur");
        intent.setMetadata(Map.of("userId", "7", "reservationType", "SPACE"));
        try (MockedStatic<PaymentIntent> provider = mockStatic(PaymentIntent.class)) {
            provider.when(() -> PaymentIntent.retrieve("pi_fixture")).thenReturn(intent);
            assertEquals("processing", verifier.inspectPaymentState("pi_fixture").status());
            assertThrows(ResponseStatusException.class, () -> verifier.inspectPayment("pi_fixture"));
            intent.setStatus("succeeded");
            assertEquals(10000L, verifier.inspectPayment("pi_fixture").amountCents());
        }
    }

    @Test void fakePaymentAndRefundRemainForbiddenWithoutExplicitLocalFlag() {
        assertThrows(ResponseStatusException.class, () -> verifier.inspectPaymentState("test_fixture"));
        assertThrows(ResponseStatusException.class, () -> verifier.refund("test_fixture", 10000L, "fixture"));
        assertThrows(ResponseStatusException.class, () -> verifier.listRefunds("test_fixture"));
    }

    private Refund refund(String id, String status, long amount) {
        Refund refund = new Refund(); refund.setId(id); refund.setStatus(status);
        refund.setPaymentIntent("pi_fixture"); refund.setCurrency("eur"); refund.setAmount(amount);
        return refund;
    }
}
