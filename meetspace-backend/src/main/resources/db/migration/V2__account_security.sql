SET @token_version_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateur' AND COLUMN_NAME = 'token_version'
);
SET @token_version_sql = IF(
    @token_version_exists = 0,
    'ALTER TABLE utilisateur ADD COLUMN token_version INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE token_version_stmt FROM @token_version_sql;
EXECUTE token_version_stmt;
DEALLOCATE PREPARE token_version_stmt;

SET @pending_email_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateur' AND COLUMN_NAME = 'pending_email'
);
SET @pending_email_sql = IF(
    @pending_email_exists = 0,
    'ALTER TABLE utilisateur ADD COLUMN pending_email VARCHAR(120) NULL',
    'SELECT 1'
);
PREPARE pending_email_stmt FROM @pending_email_sql;
EXECUTE pending_email_stmt;
DEALLOCATE PREPARE pending_email_stmt;

SET @email_change_hash_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateur' AND COLUMN_NAME = 'email_change_token_hash'
);
SET @email_change_hash_sql = IF(
    @email_change_hash_exists = 0,
    'ALTER TABLE utilisateur ADD COLUMN email_change_token_hash VARCHAR(64) NULL',
    'SELECT 1'
);
PREPARE email_change_hash_stmt FROM @email_change_hash_sql;
EXECUTE email_change_hash_stmt;
DEALLOCATE PREPARE email_change_hash_stmt;

SET @email_change_expiry_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateur' AND COLUMN_NAME = 'email_change_expires_at'
);
SET @email_change_expiry_sql = IF(
    @email_change_expiry_exists = 0,
    'ALTER TABLE utilisateur ADD COLUMN email_change_expires_at DATETIME(6) NULL',
    'SELECT 1'
);
PREPARE email_change_expiry_stmt FROM @email_change_expiry_sql;
EXECUTE email_change_expiry_stmt;
DEALLOCATE PREPARE email_change_expiry_stmt;

SET @email_change_index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'utilisateur'
      AND INDEX_NAME = 'uk_user_email_change_token'
);
SET @email_change_index_sql = IF(
    @email_change_index_exists = 0,
    'CREATE UNIQUE INDEX uk_user_email_change_token ON utilisateur (email_change_token_hash)',
    'SELECT 1'
);
PREPARE email_change_index_stmt FROM @email_change_index_sql;
EXECUTE email_change_index_stmt;
DEALLOCATE PREPARE email_change_index_stmt;