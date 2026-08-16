CREATE TABLE event_waitlist (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    participant_count INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_waitlist_event_user UNIQUE (event_id, user_id),
    CONSTRAINT fk_waitlist_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_waitlist_user FOREIGN KEY (user_id) REFERENCES utilisateur (id) ON DELETE CASCADE,
    INDEX idx_waitlist_event_status (event_id, status, created_at),
    INDEX idx_waitlist_user (user_id, created_at)
);
