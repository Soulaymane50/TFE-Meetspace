CREATE TABLE IF NOT EXISTS booking_hold (
    id BIGINT NOT NULL AUTO_INCREMENT,
    token VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    type VARCHAR(24) NOT NULL,
    resource_id BIGINT NOT NULL,
    secondary_resource_id BIGINT NULL,
    quantity INT NOT NULL DEFAULT 1,
    secondary_quantity INT NOT NULL DEFAULT 0,
    start_at DATETIME(6) NULL,
    end_at DATETIME(6) NULL,
    amount_cents BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    version BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_booking_hold_token UNIQUE (token),
    CONSTRAINT fk_booking_hold_user FOREIGN KEY (user_id) REFERENCES utilisateur (id),
    INDEX idx_booking_hold_resource (type, resource_id, status, expires_at),
    INDEX idx_booking_hold_secondary (secondary_resource_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_record (
    id BIGINT NOT NULL AUTO_INCREMENT,
    payment_intent_id VARCHAR(255) NOT NULL,
    user_id BIGINT NOT NULL,
    type VARCHAR(24) NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'eur',
    status VARCHAR(24) NOT NULL,
    resource_id BIGINT NULL,
    booking_hold_id BIGINT NULL,
    booking_entity_id BIGINT NULL,
    refunded_amount_cents BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    consumed_at DATETIME(6) NULL,
    refunded_at DATETIME(6) NULL,
    version BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_payment_record_intent UNIQUE (payment_intent_id),
    CONSTRAINT fk_payment_record_user FOREIGN KEY (user_id) REFERENCES utilisateur (id),
    CONSTRAINT fk_payment_record_hold FOREIGN KEY (booking_hold_id) REFERENCES booking_hold (id),
    INDEX idx_payment_record_user_status (user_id, status),
    INDEX idx_payment_record_booking (type, booking_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @event_registration_column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'parking_reservation'
      AND COLUMN_NAME = 'event_registration_id'
);
SET @event_registration_column_sql = IF(
    @event_registration_column_exists = 0,
    'ALTER TABLE parking_reservation ADD COLUMN event_registration_id BIGINT NULL',
    'SELECT 1'
);
PREPARE event_registration_column_stmt FROM @event_registration_column_sql;
EXECUTE event_registration_column_stmt;
DEALLOCATE PREPARE event_registration_column_stmt;

SET @event_registration_fk_exists = (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'parking_reservation'
      AND COLUMN_NAME = 'event_registration_id'
      AND REFERENCED_TABLE_NAME = 'event_registration'
      AND REFERENCED_COLUMN_NAME = 'id'
);
SET @event_registration_fk_sql = IF(
    @event_registration_fk_exists = 0,
    'ALTER TABLE parking_reservation ADD CONSTRAINT fk_parking_reservation_event_registration FOREIGN KEY (event_registration_id) REFERENCES event_registration(id)',
    'SELECT 1'
);
PREPARE event_registration_fk_stmt FROM @event_registration_fk_sql;
EXECUTE event_registration_fk_stmt;
DEALLOCATE PREPARE event_registration_fk_stmt;

SET @payment_due_column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'espace_reservation'
      AND COLUMN_NAME = 'payment_due_at'
);
SET @payment_due_column_sql = IF(
    @payment_due_column_exists = 0,
    'ALTER TABLE espace_reservation ADD COLUMN payment_due_at DATETIME(6) NULL',
    'SELECT 1'
);
PREPARE payment_due_column_stmt FROM @payment_due_column_sql;
EXECUTE payment_due_column_stmt;
DEALLOCATE PREPARE payment_due_column_stmt;
