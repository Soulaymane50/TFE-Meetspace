CREATE TABLE user_notification (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tone VARCHAR(20) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    path VARCHAR(255) NULL,
    source_type VARCHAR(50) NULL,
    source_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    read_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id) REFERENCES utilisateur (id) ON DELETE CASCADE,
    INDEX idx_notification_user_created (user_id, created_at),
    INDEX idx_notification_user_read (user_id, read_at)
);
