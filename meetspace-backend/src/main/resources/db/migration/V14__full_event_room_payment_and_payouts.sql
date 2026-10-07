ALTER TABLE event ADD COLUMN room_payment_mode VARCHAR(24) NOT NULL DEFAULT 'LEGACY_DEPOSIT';

-- Unpaid approvals adopt full payment; already paid deposits remain untouched.
UPDATE event SET room_payment_mode = 'FULL', deposit_amount_cents = room_cost_cents,
    balance_due_cents = 0, late_fee_cents = 0
WHERE status = 'AWAITING_DEPOSIT' AND deposit_paid_at IS NULL
  AND deposit_payment_intent_id IS NULL;

CREATE TABLE event_payout (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    amount_cents BIGINT NOT NULL,
    ticket_revenue_cents BIGINT NOT NULL,
    commission_cents BIGINT NOT NULL,
    room_balance_deducted_cents BIGINT NOT NULL,
    transfer_reference VARCHAR(120) NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    recorded_by BIGINT NOT NULL,
    CONSTRAINT uk_event_payout_event UNIQUE (event_id),
    CONSTRAINT uk_event_payout_reference UNIQUE (transfer_reference),
    CONSTRAINT fk_event_payout_event FOREIGN KEY (event_id) REFERENCES event(id),
    CONSTRAINT fk_event_payout_recipient FOREIGN KEY (recipient_id) REFERENCES utilisateur(id),
    CONSTRAINT fk_event_payout_admin FOREIGN KEY (recorded_by) REFERENCES utilisateur(id),
    CONSTRAINT ck_event_payout_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
