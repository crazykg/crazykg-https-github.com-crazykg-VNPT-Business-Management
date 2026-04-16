SET NAMES utf8mb4;

START TRANSACTION;

SET @has_department_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'department_id'
);

SET @department_id_sql := IF(
  @has_department_id = 0,
  'ALTER TABLE `projects` ADD COLUMN `department_id` BIGINT UNSIGNED NULL AFTER `customer_id`',
  'SELECT 1'
);

PREPARE department_id_stmt FROM @department_id_sql;
EXECUTE department_id_stmt;
DEALLOCATE PREPARE department_id_stmt;

SET @has_actual_end_date := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'actual_end_date'
);

SET @actual_end_date_sql := IF(
  @has_actual_end_date = 0,
  'ALTER TABLE `projects` ADD COLUMN `actual_end_date` DATE NULL AFTER `expected_end_date`',
  'SELECT 1'
);

PREPARE actual_end_date_stmt FROM @actual_end_date_sql;
EXECUTE actual_end_date_stmt;
DEALLOCATE PREPARE actual_end_date_stmt;

COMMIT;
