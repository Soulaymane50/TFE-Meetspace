CREATE TABLE parking_inventory (
    id BIGINT NOT NULL,
    capacity INT NOT NULL,
    version BIGINT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT ck_parking_inventory_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO parking_inventory (id, capacity, version) VALUES (1, 150, 0);

ALTER TABLE parking_reservation
    ADD COLUMN complimentary BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE parking_access_pass (
    id BIGINT NOT NULL AUTO_INCREMENT,
    parking_reservation_id BIGINT NOT NULL,
    token VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    checked_in_at DATETIME(6) NULL,
    checked_in_by BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    version BIGINT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_parking_access_pass_token UNIQUE (token),
    INDEX idx_parking_access_pass_reservation (parking_reservation_id),
    INDEX idx_parking_access_pass_status (status),
    CONSTRAINT fk_parking_access_pass_reservation
        FOREIGN KEY (parking_reservation_id) REFERENCES parking_reservation (id) ON DELETE CASCADE,
    CONSTRAINT fk_parking_access_pass_checked_in_by
        FOREIGN KEY (checked_in_by) REFERENCES utilisateur (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE event SET parking_required = TRUE WHERE location_type = 'EXISTING_SPACE';

INSERT INTO parking_slot (
    title, description, session_date, start_time, end_time, capacity,
    parking_rate, status, version, created_at, event_id
)
SELECT
    CONCAT('Parking — ', e.title),
    'Parking MeetSpace partagé automatiquement selon les événements qui se chevauchent.',
    DATE(e.start_date_time), TIME(e.start_date_time), TIME(e.end_date_time), LEAST(e.capacity, 150),
    CASE
        WHEN TIMESTAMPDIFF(MINUTE, e.start_date_time, e.end_date_time) >= 420 AND es.capacity >= 300 THEN 15
        WHEN TIMESTAMPDIFF(MINUTE, e.start_date_time, e.end_date_time) >= 240 OR es.capacity >= 300 THEN 12
        ELSE 8
    END,
    CASE WHEN e.status = 'PUBLISHED' THEN 'OPEN' ELSE 'CANCELLED' END,
    0, COALESCE(e.created_at, CURRENT_TIMESTAMP(6)), e.id
FROM event e
JOIN espace es ON es.id = e.space_id
LEFT JOIN parking_slot ps ON ps.event_id = e.id
WHERE e.location_type = 'EXISTING_SPACE' AND ps.id IS NULL;

UPDATE parking_slot ps
JOIN event e ON e.id = ps.event_id
SET ps.capacity = LEAST(e.capacity, 150),
    ps.status = CASE WHEN e.status = 'PUBLISHED' THEN 'OPEN' ELSE 'CANCELLED' END,
    ps.description = 'Parking MeetSpace partagé automatiquement selon les événements qui se chevauchent.';

-- Every published on-site event starts with one free vehicle pass for its organizer or team.
INSERT INTO parking_reservation (
    user_id, parking_slot_id, reserved_spaces, total_price, status, version, created_at, complimentary
)
SELECT e.created_by, ps.id, 1, 0, 'CONFIRMED', 0,
       COALESCE(e.created_at, CURRENT_TIMESTAMP(6)), TRUE
FROM event e
JOIN parking_slot ps ON ps.event_id = e.id
LEFT JOIN parking_reservation pr
    ON pr.parking_slot_id = ps.id
    AND pr.complimentary = TRUE
WHERE e.location_type = 'EXISTING_SPACE'
  AND e.status = 'PUBLISHED'
  AND e.created_by IS NOT NULL
  AND pr.id IS NULL;

INSERT INTO parking_access_pass (parking_reservation_id, token, status, created_at, version)
SELECT pr.id, REPLACE(UUID(), '-', ''),
       CASE WHEN pr.status = 'CANCELLED' THEN 'CANCELLED' ELSE 'ACTIVE' END,
       COALESCE(pr.created_at, CURRENT_TIMESTAMP(6)), 0
FROM parking_reservation pr;
