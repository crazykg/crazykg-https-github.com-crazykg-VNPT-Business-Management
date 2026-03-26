SET NAMES utf8mb4;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
      AND COLUMN_NAME = 'payment_cycle'
  ),
  'SELECT 1',
  'ALTER TABLE `projects` ADD COLUMN `payment_cycle` VARCHAR(20) NULL AFTER `status_reason`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
      AND COLUMN_NAME = 'estimated_value'
  ),
  'SELECT 1',
  'ALTER TABLE `projects` ADD COLUMN `estimated_value` DECIMAL(18,2) NULL AFTER `payment_cycle`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `project_revenue_schedules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_id` bigint unsigned NOT NULL,
  `cycle_number` int unsigned NOT NULL DEFAULT '1',
  `expected_date` date DEFAULT NULL,
  `expected_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `notes` text,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prs_project` (`project_id`),
  KEY `idx_prs_expected_date` (`expected_date`),
  CONSTRAINT `project_revenue_schedules_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
