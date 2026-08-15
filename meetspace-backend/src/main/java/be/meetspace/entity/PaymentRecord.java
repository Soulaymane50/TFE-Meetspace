package be.meetspace.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment_record", uniqueConstraints = {
        @UniqueConstraint(name = "uk_payment_record_intent", columnNames = "payment_intent_id")
})
public class PaymentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_intent_id", nullable = false, length = 255)
    private String paymentIntentId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PaymentType type;

    @Column(name = "amount_cents", nullable = false)
    private Long amountCents;

    @Column(nullable = false, length = 3)
    private String currency = "eur";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "resource_id")
    private Long resourceId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_hold_id")
    private BookingHold bookingHold;

    @Column(name = "booking_entity_id")
    private Long bookingEntityId;

    @Column(name = "refunded_amount_cents", nullable = false)
    private Long refundedAmountCents = 0L;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @Column(name = "refunded_at")
    private LocalDateTime refundedAt;

    @Version
    private Long version;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public PaymentType getType() { return type; }
    public void setType(PaymentType type) { this.type = type; }
    public Long getAmountCents() { return amountCents; }
    public void setAmountCents(Long amountCents) { this.amountCents = amountCents; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public Long getResourceId() { return resourceId; }
    public void setResourceId(Long resourceId) { this.resourceId = resourceId; }
    public BookingHold getBookingHold() { return bookingHold; }
    public void setBookingHold(BookingHold bookingHold) { this.bookingHold = bookingHold; }
    public Long getBookingEntityId() { return bookingEntityId; }
    public void setBookingEntityId(Long bookingEntityId) { this.bookingEntityId = bookingEntityId; }
    public Long getRefundedAmountCents() { return refundedAmountCents; }
    public void setRefundedAmountCents(Long refundedAmountCents) { this.refundedAmountCents = refundedAmountCents; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(LocalDateTime consumedAt) { this.consumedAt = consumedAt; }
    public LocalDateTime getRefundedAt() { return refundedAt; }
    public void setRefundedAt(LocalDateTime refundedAt) { this.refundedAt = refundedAt; }
}
