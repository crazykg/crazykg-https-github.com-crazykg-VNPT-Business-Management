SET NAMES utf8mb4;

SET @has_shared_timesheets := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
);
SET @has_work_date := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'work_date'
);
SET @has_work_started_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'work_started_at'
);

SET @ddl := IF(
    @has_shared_timesheets = 1 AND @has_work_started_at = 0 AND @has_work_date = 1,
    'ALTER TABLE `shared_timesheets` ADD COLUMN `work_started_at` datetime NULL AFTER `work_date`',
    IF(
        @has_shared_timesheets = 1 AND @has_work_started_at = 0,
        'ALTER TABLE `shared_timesheets` ADD COLUMN `work_started_at` datetime NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_work_started_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'work_started_at'
);
SET @has_work_ended_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'work_ended_at'
);

SET @ddl := IF(
    @has_shared_timesheets = 1 AND @has_work_ended_at = 0 AND @has_work_started_at = 1,
    'ALTER TABLE `shared_timesheets` ADD COLUMN `work_ended_at` datetime NULL AFTER `work_started_at`',
    IF(
        @has_shared_timesheets = 1 AND @has_work_ended_at = 0,
        'ALTER TABLE `shared_timesheets` ADD COLUMN `work_ended_at` datetime NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_procedure_step_worklog_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'procedure_step_worklog_id'
);
SET @has_performed_by_user_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'performed_by_user_id'
);

SET @ddl := IF(
    @has_shared_timesheets = 1 AND @has_performed_by_user_id = 0 AND @has_procedure_step_worklog_id = 1,
    'ALTER TABLE `shared_timesheets` ADD COLUMN `performed_by_user_id` bigint unsigned NULL AFTER `procedure_step_worklog_id`',
    IF(
        @has_shared_timesheets = 1 AND @has_performed_by_user_id = 0,
        'ALTER TABLE `shared_timesheets` ADD COLUMN `performed_by_user_id` bigint unsigned NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_created_by := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'created_by'
);
SET @has_performed_by_user_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND COLUMN_NAME = 'performed_by_user_id'
);

SET @dml := IF(
    @has_shared_timesheets = 1 AND @has_performed_by_user_id = 1 AND @has_created_by = 1,
    'UPDATE `shared_timesheets`
     SET `performed_by_user_id` = `created_by`
     WHERE `performed_by_user_id` IS NULL
       AND `created_by` IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @dml;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_ts_date_performer := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND INDEX_NAME = 'idx_ts_date_performer'
);
SET @ddl := IF(
    @has_shared_timesheets = 1
      AND @has_work_date = 1
      AND @has_performed_by_user_id = 1
      AND @has_idx_ts_date_performer = 0,
    'ALTER TABLE `shared_timesheets` ADD INDEX `idx_ts_date_performer` (`work_date`, `performed_by_user_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_ts_performer := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND INDEX_NAME = 'idx_ts_performer'
);
SET @ddl := IF(
    @has_shared_timesheets = 1
      AND @has_performed_by_user_id = 1
      AND @has_idx_ts_performer = 0,
    'ALTER TABLE `shared_timesheets` ADD INDEX `idx_ts_performer` (`performed_by_user_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_internal_users := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'internal_users'
);
SET @has_fk_shared_timesheets_performer := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'shared_timesheets'
      AND CONSTRAINT_NAME = 'fk_shared_timesheets_performer'
);
SET @orphan_performed_by_user_id := IF(
    @has_shared_timesheets = 1 AND @has_internal_users = 1 AND @has_performed_by_user_id = 1,
    (
        SELECT COUNT(*)
        FROM `shared_timesheets` AS `st`
        LEFT JOIN `internal_users` AS `iu`
          ON `iu`.`id` = `st`.`performed_by_user_id`
        WHERE `st`.`performed_by_user_id` IS NOT NULL
          AND `iu`.`id` IS NULL
    ),
    0
);

SET @ddl := IF(
    @has_shared_timesheets = 1
      AND @has_internal_users = 1
      AND @has_performed_by_user_id = 1
      AND @has_fk_shared_timesheets_performer = 0
      AND @orphan_performed_by_user_id = 0,
    'ALTER TABLE `shared_timesheets`
       ADD CONSTRAINT `fk_shared_timesheets_performer`
       FOREIGN KEY (`performed_by_user_id`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
