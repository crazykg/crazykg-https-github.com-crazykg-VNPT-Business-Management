SET NAMES utf8mb4;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `revenue_targets_archive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `source_id` bigint unsigned NOT NULL,
  `period_type` varchar(20) DEFAULT NULL,
  `period_key` varchar(10) DEFAULT NULL,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `dept_id` bigint unsigned NOT NULL DEFAULT '0',
  `target_type` varchar(30) DEFAULT NULL,
  `target_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `actual_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `notes` text,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `data_scope` varchar(50) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `source_created_at` timestamp NULL DEFAULT NULL,
  `source_updated_at` timestamp NULL DEFAULT NULL,
  `source_deleted_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NOT NULL,
  `archive_reason` varchar(50) NOT NULL DEFAULT 'soft_delete_retention',
  `payload` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `revenue_targets_archive_source_id_unique` (`source_id`),
  KEY `idx_rta_period` (`period_type`,`period_key`),
  KEY `idx_rta_dept` (`dept_id`),
  KEY `idx_rta_deleted_at` (`source_deleted_at`),
  KEY `idx_rta_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_quotation_default_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `scope_summary` text,
  `validity_days` smallint unsigned NOT NULL DEFAULT '90',
  `notes_text` text,
  `contact_line` text,
  `closing_message` text,
  `signatory_title` varchar(255) DEFAULT NULL,
  `signatory_unit` varchar(255) DEFAULT NULL,
  `signatory_name` varchar(255) DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_quotation_default_settings_user_id_unique` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;
