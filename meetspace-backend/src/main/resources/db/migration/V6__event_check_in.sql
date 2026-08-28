ALTER TABLE event_registration
    ADD COLUMN ticket_token VARCHAR(64) NULL,
    ADD COLUMN checked_in_at DATETIME NULL,
    ADD COLUMN checked_in_by BIGINT NULL;

UPDATE event_registration
SET ticket_token = LOWER(HEX(RANDOM_BYTES(24)))
WHERE ticket_token IS NULL;

ALTER TABLE event_registration
    MODIFY COLUMN ticket_token VARCHAR(64) NOT NULL,
    ADD CONSTRAINT uk_event_registration_ticket UNIQUE (ticket_token),
    ADD CONSTRAINT fk_event_registration_checked_in_by
        FOREIGN KEY (checked_in_by) REFERENCES utilisateur (id) ON DELETE SET NULL,
    ADD INDEX idx_event_registration_event_check_in (event_id, checked_in_at);
