SET NAMES utf8mb4;

START TRANSACTION;

SET @has_leave_date := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'internal_users'
    AND COLUMN_NAME = 'leave_date'
);

SET @has_date_of_birth := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'internal_users'
    AND COLUMN_NAME = 'date_of_birth'
);

SET @add_leave_date_sql := IF(
  @has_leave_date = 0,
  IF(
    @has_date_of_birth > 0,
    'ALTER TABLE `internal_users` ADD COLUMN `leave_date` DATE NULL AFTER `date_of_birth`',
    'ALTER TABLE `internal_users` ADD COLUMN `leave_date` DATE NULL'
  ),
  'SELECT 1'
);

PREPARE add_leave_date_stmt FROM @add_leave_date_sql;
EXECUTE add_leave_date_stmt;
DEALLOCATE PREPARE add_leave_date_stmt;

COMMIT;
