package be.meetspace.entity;

public enum PaymentStatus {
    PENDING,
    SUCCEEDED,
    CONSUMED,
    REFUND_PENDING,
    PARTIALLY_REFUNDED,
    REFUNDED,
    FAILED
}
