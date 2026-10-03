package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Durable identity of a financial operation, independent of a booking transaction.
 * No foreign key to payment_record: legacy payments can be registered in a transaction
 * that subsequently rolls back, while Stripe's refund must remain recoverable.
 */
@Entity
@Table(name = "payment_refund", uniqueConstraints = {
        @UniqueConstraint(name = "uk_payment_refund_operation", columnNames = "operation_key"),
        @UniqueConstraint(name = "uk_payment_refund_stripe", columnNames = "stripe_refund_id")
}, indexes = @Index(name = "idx_payment_refund_intent", columnList = "payment_intent_id"))
public class PaymentRefund {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "operation_key", nullable = false, length = 160)
    private String operationKey;
    @Column(name = "payment_intent_id", nullable = false, length = 255)
    private String paymentIntentId;
    @Column(name = "stripe_refund_id", length = 255)
    private String stripeRefundId;
    @Column(name = "amount_cents", nullable = false)
    private Long amountCents;
    @Column(nullable = false, length = 3)
    private String currency;
    @Column(nullable = false, length = 24)
    private String status = "requested";
    @Column(name = "first_attempt_at")
    private LocalDateTime firstAttemptAt;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Version
    private Long version;
    @PrePersist void prePersist() { createdAt = LocalDateTime.now(); }
    public Long getId() { return id; }
    public String getOperationKey() { return operationKey; }
    public void setOperationKey(String value) { operationKey = value; }
    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String value) { paymentIntentId = value; }
    public String getStripeRefundId() { return stripeRefundId; }
    public void setStripeRefundId(String value) { stripeRefundId = value; }
    public Long getAmountCents() { return amountCents; }
    public void setAmountCents(Long value) { amountCents = value; }
    public String getCurrency() { return currency; }
    public void setCurrency(String value) { currency = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public LocalDateTime getFirstAttemptAt() { return firstAttemptAt; }
    public void setFirstAttemptAt(LocalDateTime value) { firstAttemptAt = value; }
}
