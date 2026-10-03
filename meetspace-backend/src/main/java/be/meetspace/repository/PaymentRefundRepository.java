package be.meetspace.repository;

import be.meetspace.entity.PaymentRefund;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, Long> {
    Optional<PaymentRefund> findByOperationKey(String operationKey);
    Optional<PaymentRefund> findByStripeRefundId(String stripeRefundId);
    List<PaymentRefund> findByPaymentIntentId(String paymentIntentId);
}
