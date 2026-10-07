-- Durable terms preserve the first cancellation deadline across interrupted refunds.
CREATE TABLE event_room_cancellation (
    event_id BIGINT NOT NULL PRIMARY KEY,
    refund_percent INT NOT NULL,
    by_provider BOOLEAN NOT NULL,
    requested_at DATETIME(6) NOT NULL,
    CONSTRAINT chk_event_room_cancellation_percent CHECK (refund_percent IN (0, 50, 100))
);
