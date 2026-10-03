-- Financial operations survive a rollback of their associated booking transaction.
-- Deliberately no FK to payment_record: historical records can be created on cancellation.
CREATE TABLE payment_refund (
    id BIGINT NOT NULL AUTO_INCREMENT,
    operation_key VARCHAR(160) NOT NULL,
    payment_intent_id VARCHAR(255) NOT NULL,
    stripe_refund_id VARCHAR(255) NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'requested',
    first_attempt_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    version BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_payment_refund_operation UNIQUE (operation_key),
    CONSTRAINT uk_payment_refund_stripe UNIQUE (stripe_refund_id),
    INDEX idx_payment_refund_intent (payment_intent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
