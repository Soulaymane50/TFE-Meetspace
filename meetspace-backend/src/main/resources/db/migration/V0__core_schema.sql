-- Core MeetSpace schema. Demo data lives outside Flyway migrations.
-- Existing installations are baselined at version 0 and keep their data;
-- a new empty database applies this migration before V1 and later changes.

CREATE TABLE utilisateur (
    id BIGINT NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NULL,
    password_reset_token_hash VARCHAR(64) NULL,
    password_reset_expires_at DATETIME(6) NULL,
    account_deletion_token_hash VARCHAR(64) NULL,
    account_deletion_expires_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_user_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE espace (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(20) NOT NULL,
    capacity INT NULL,
    base_price DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_date_time DATETIME(6) NOT NULL,
    end_date_time DATETIME(6) NOT NULL,
    location VARCHAR(255) NULL,
    location_type VARCHAR(30) NOT NULL DEFAULT 'EXTERNAL',
    space_id BIGINT NULL,
    external_address VARCHAR(255) NULL,
    capacity INT NOT NULL,
    price DOUBLE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    version BIGINT NULL DEFAULT 0,
    created_by BIGINT NULL,
    created_at DATETIME(6) NULL,
    approved_at DATETIME(6) NULL,
    approved_by BIGINT NULL,
    rejection_reason VARCHAR(255) NULL,
    parking_required BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    INDEX idx_event_space (space_id),
    INDEX idx_event_creator (created_by),
    INDEX idx_event_approver (approved_by),
    INDEX idx_event_status_start (status, start_date_time),
    CONSTRAINT fk_event_space FOREIGN KEY (space_id) REFERENCES espace (id),
    CONSTRAINT fk_event_creator FOREIGN KEY (created_by) REFERENCES utilisateur (id),
    CONSTRAINT fk_event_approver FOREIGN KEY (approved_by) REFERENCES utilisateur (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parking_slot (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(500) NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT NOT NULL,
    parking_rate DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    version BIGINT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    event_id BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_parking_slot_event UNIQUE (event_id),
    INDEX idx_parking_slot_date_status (session_date, status),
    CONSTRAINT fk_parking_slot_event FOREIGN KEY (event_id) REFERENCES event (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE espace_reservation (
    id BIGINT NOT NULL AUTO_INCREMENT,
    utilisateur_id BIGINT NOT NULL,
    espace_id BIGINT NOT NULL,
    start_date_time DATETIME(6) NOT NULL,
    end_date_time DATETIME(6) NOT NULL,
    total_price DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL,
    version BIGINT NULL DEFAULT 0,
    payment_intent_id VARCHAR(255) NULL,
    justification VARCHAR(1000) NULL,
    rejection_reason VARCHAR(500) NULL,
    approved_by BIGINT NULL,
    approved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_room_reservation_user (utilisateur_id),
    INDEX idx_room_reservation_space_period (espace_id, start_date_time, end_date_time),
    INDEX idx_room_reservation_status_created (status, created_at),
    INDEX idx_room_reservation_approver (approved_by),
    CONSTRAINT fk_room_reservation_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id),
    CONSTRAINT fk_room_reservation_space FOREIGN KEY (espace_id) REFERENCES espace (id),
    CONSTRAINT fk_room_reservation_approver FOREIGN KEY (approved_by) REFERENCES utilisateur (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_registration (
    id BIGINT NOT NULL AUTO_INCREMENT,
    utilisateur_id BIGINT NOT NULL,
    event_id BIGINT NOT NULL,
    number_of_participants INT NOT NULL DEFAULT 1,
    total_price DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL,
    version BIGINT NULL DEFAULT 0,
    payment_intent_id VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_event_registration_user (utilisateur_id),
    INDEX idx_event_registration_event_status (event_id, status),
    INDEX idx_event_registration_created (created_at),
    CONSTRAINT fk_event_registration_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id),
    CONSTRAINT fk_event_registration_event FOREIGN KEY (event_id) REFERENCES event (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parking_reservation (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    parking_slot_id BIGINT NOT NULL,
    reserved_spaces INT NOT NULL,
    total_price DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    version BIGINT NULL DEFAULT 0,
    payment_intent_id VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_parking_reservation_user (user_id),
    INDEX idx_parking_reservation_slot_status (parking_slot_id, status),
    INDEX idx_parking_reservation_created (created_at),
    CONSTRAINT fk_parking_reservation_user FOREIGN KEY (user_id) REFERENCES utilisateur (id),
    CONSTRAINT fk_parking_reservation_slot FOREIGN KEY (parking_slot_id) REFERENCES parking_slot (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NULL,
    details TEXT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    ip_address VARCHAR(45) NULL,
    timestamp DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type),
    INDEX idx_audit_timestamp (timestamp),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES utilisateur (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
