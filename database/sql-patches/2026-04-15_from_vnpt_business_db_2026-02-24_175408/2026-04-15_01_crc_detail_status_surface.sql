SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_customer_request_worklogs := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_worklogs'
);

SET @has_difficulty_note := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_worklogs'
      AND COLUMN_NAME = 'difficulty_note'
);
SET @ddl := IF(
    @has_customer_request_worklogs = 1 AND @has_difficulty_note = 0,
    'ALTER TABLE `customer_request_worklogs` ADD COLUMN `difficulty_note` text NULL AFTER `work_content`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_proposal_note := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_worklogs'
      AND COLUMN_NAME = 'proposal_note'
);
SET @ddl := IF(
    @has_customer_request_worklogs = 1 AND @has_proposal_note = 0,
    'ALTER TABLE `customer_request_worklogs` ADD COLUMN `proposal_note` text NULL AFTER `difficulty_note`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_difficulty_status := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_worklogs'
      AND COLUMN_NAME = 'difficulty_status'
);
SET @ddl := IF(
    @has_customer_request_worklogs = 1 AND @has_difficulty_status = 0,
    'ALTER TABLE `customer_request_worklogs` ADD COLUMN `difficulty_status` varchar(30) NULL AFTER `proposal_note`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_detail_status_action := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_worklogs'
      AND COLUMN_NAME = 'detail_status_action'
);
SET @ddl := IF(
    @has_customer_request_worklogs = 1 AND @has_detail_status_action = 0,
    'ALTER TABLE `customer_request_worklogs` ADD COLUMN `detail_status_action` varchar(30) NULL AFTER `difficulty_status`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_detail_states := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_status_detail_states'
);
SET @ddl := IF(
    @has_detail_states = 0,
    'CREATE TABLE `customer_request_status_detail_states` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `request_case_id` bigint unsigned NOT NULL,
        `status_instance_id` bigint unsigned NOT NULL,
        `status_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        `detail_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
        `started_at` datetime DEFAULT NULL,
        `completed_at` datetime DEFAULT NULL,
        `changed_by` bigint unsigned DEFAULT NULL,
        `note` text COLLATE utf8mb4_unicode_ci,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_cr_detail_state_instance` (`status_instance_id`),
        KEY `idx_cr_detail_state_case_instance` (`request_case_id`, `status_instance_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_detail_logs := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'customer_request_status_detail_logs'
);
SET @ddl := IF(
    @has_detail_logs = 0,
    'CREATE TABLE `customer_request_status_detail_logs` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `request_case_id` bigint unsigned NOT NULL,
        `status_instance_id` bigint unsigned NOT NULL,
        `status_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        `from_detail_status` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        `to_detail_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
        `changed_by` bigint unsigned DEFAULT NULL,
        `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_cr_detail_log_case_instance` (`request_case_id`, `status_instance_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
