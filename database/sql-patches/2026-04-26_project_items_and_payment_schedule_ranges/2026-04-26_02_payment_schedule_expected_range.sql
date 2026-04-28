SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_payment_schedules := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'payment_schedules'
);
SET @has_expected_date := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'expected_date'
);
SET @has_expected_start_date := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'expected_start_date'
);
SET @ddl := IF(
    @has_payment_schedules = 1 AND @has_expected_start_date = 0 AND @has_expected_date = 1,
    'ALTER TABLE `payment_schedules` ADD COLUMN `expected_start_date` date NULL AFTER `expected_date`',
    IF(
        @has_payment_schedules = 1 AND @has_expected_start_date = 0,
        'ALTER TABLE `payment_schedules` ADD COLUMN `expected_start_date` date NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_expected_start_date := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'expected_start_date'
);
SET @has_expected_end_date := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'expected_end_date'
);
SET @ddl := IF(
    @has_payment_schedules = 1 AND @has_expected_end_date = 0 AND @has_expected_start_date = 1,
    'ALTER TABLE `payment_schedules` ADD COLUMN `expected_end_date` date NULL AFTER `expected_start_date`',
    IF(
        @has_payment_schedules = 1 AND @has_expected_end_date = 0,
        'ALTER TABLE `payment_schedules` ADD COLUMN `expected_end_date` date NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
