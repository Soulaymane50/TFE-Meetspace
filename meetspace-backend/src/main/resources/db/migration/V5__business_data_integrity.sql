ALTER TABLE espace
    ADD CONSTRAINT ck_espace_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
    ADD CONSTRAINT ck_espace_base_price_non_negative CHECK (base_price >= 0);

ALTER TABLE event
    ADD CONSTRAINT ck_event_time_window CHECK (end_date_time > start_date_time),
    ADD CONSTRAINT ck_event_capacity_positive CHECK (capacity > 0),
    ADD CONSTRAINT ck_event_price_non_negative CHECK (price IS NULL OR price >= 0),
    ADD INDEX idx_event_created_status (created_at, status);

ALTER TABLE parking_slot
    ADD CONSTRAINT ck_parking_slot_time_window CHECK (end_time > start_time),
    ADD CONSTRAINT ck_parking_slot_capacity_positive CHECK (capacity > 0),
    ADD CONSTRAINT ck_parking_slot_rate_non_negative CHECK (parking_rate >= 0);

ALTER TABLE espace_reservation
    ADD CONSTRAINT ck_room_reservation_time_window CHECK (end_date_time > start_date_time),
    ADD CONSTRAINT ck_room_reservation_total_non_negative CHECK (total_price >= 0);

ALTER TABLE event_registration
    ADD CONSTRAINT ck_event_registration_participants_positive CHECK (number_of_participants > 0),
    ADD CONSTRAINT ck_event_registration_total_non_negative CHECK (total_price >= 0);

ALTER TABLE parking_reservation
    ADD CONSTRAINT ck_parking_reservation_spaces_positive CHECK (reserved_spaces > 0),
    ADD CONSTRAINT ck_parking_reservation_total_non_negative CHECK (total_price >= 0);

ALTER TABLE booking_hold
    ADD CONSTRAINT ck_booking_hold_quantity_positive CHECK (quantity > 0),
    ADD CONSTRAINT ck_booking_hold_secondary_quantity_non_negative CHECK (secondary_quantity >= 0),
    ADD CONSTRAINT ck_booking_hold_amount_non_negative CHECK (amount_cents >= 0),
    ADD CONSTRAINT ck_booking_hold_time_window CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);

ALTER TABLE payment_record
    ADD CONSTRAINT ck_payment_amount_non_negative CHECK (amount_cents >= 0),
    ADD CONSTRAINT ck_payment_refund_range CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents),
    ADD INDEX idx_payment_status_consumed (status, consumed_at),
    ADD INDEX idx_payment_refunded_at (refunded_at);
