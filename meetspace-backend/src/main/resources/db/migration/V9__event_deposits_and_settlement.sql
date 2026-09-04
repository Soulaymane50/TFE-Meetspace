ALTER TABLE event
    ADD COLUMN room_cost_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN deposit_amount_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN deposit_payment_intent_id VARCHAR(255) NULL,
    ADD COLUMN deposit_due_at DATETIME(6) NULL,
    ADD COLUMN deposit_paid_at DATETIME(6) NULL,
    ADD COLUMN balance_due_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN balance_payment_intent_id VARCHAR(255) NULL,
    ADD COLUMN balance_paid_at DATETIME(6) NULL,
    ADD COLUMN settlement_due_at DATETIME(6) NULL,
    ADD COLUMN late_fee_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN payout_amount_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN settlement_status VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE';

CREATE INDEX idx_event_settlement_due ON event (settlement_status, settlement_due_at);
