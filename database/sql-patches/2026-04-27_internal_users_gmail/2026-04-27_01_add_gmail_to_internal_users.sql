SET NAMES utf8mb4;

START TRANSACTION;

SET @table_schema := DATABASE();

SET @has_internal_users := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
);

SET @has_gmail := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'gmail'
);

SET @has_email := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'email'
);

SET @ddl := IF(
    @has_internal_users = 1 AND @has_gmail = 0 AND @has_email = 1,
    'ALTER TABLE `internal_users` ADD COLUMN `gmail` varchar(255) NULL AFTER `email`',
    IF(
        @has_internal_users = 1 AND @has_gmail = 0,
        'ALTER TABLE `internal_users` ADD COLUMN `gmail` varchar(255) NULL',
        'SELECT 1'
    )
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
