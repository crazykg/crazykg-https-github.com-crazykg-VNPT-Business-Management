SET NAMES utf8mb4;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_host'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_host` VARCHAR(255) NULL AFTER `file_prefix`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_port'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_port` INT NULL AFTER `smtp_host`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_encryption'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_encryption` VARCHAR(255) NOT NULL DEFAULT ''tls'' AFTER `smtp_port`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_username'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_username` VARCHAR(255) NULL AFTER `smtp_encryption`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_password'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_password` TEXT NULL AFTER `smtp_username`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_from_address'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_from_address` VARCHAR(255) NULL AFTER `smtp_password`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'smtp_from_name'
  ),
  'SELECT 1',
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_from_name` VARCHAR(255) NULL AFTER `smtp_from_address`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'customer_sector'
  ),
  'SELECT 1',
  'ALTER TABLE `customers` ADD COLUMN `customer_sector` VARCHAR(30) NULL AFTER `address`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'healthcare_facility_type'
  ),
  'SELECT 1',
  'ALTER TABLE `customers` ADD COLUMN `healthcare_facility_type` VARCHAR(50) NULL AFTER `customer_sector`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'bed_capacity'
  ),
  'SELECT 1',
  'ALTER TABLE `customers` ADD COLUMN `bed_capacity` INT UNSIGNED NULL AFTER `healthcare_facility_type`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `product_feature_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) DEFAULT NULL,
  `product_id` bigint unsigned NOT NULL,
  `group_name` varchar(255) NOT NULL,
  `display_order` int unsigned NOT NULL DEFAULT '1',
  `notes` text,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_feature_groups_uuid_unique` (`uuid`),
  KEY `pfg_product_order_idx` (`product_id`,`display_order`),
  CONSTRAINT `product_feature_groups_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_features` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) DEFAULT NULL,
  `product_id` bigint unsigned NOT NULL,
  `group_id` bigint unsigned NOT NULL,
  `feature_name` varchar(255) NOT NULL,
  `detail_description` longtext,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `display_order` int unsigned NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_features_uuid_unique` (`uuid`),
  KEY `product_features_group_id_foreign` (`group_id`),
  KEY `pf_product_group_order_idx` (`product_id`,`group_id`,`display_order`),
  KEY `pf_product_status_idx` (`product_id`,`status`),
  CONSTRAINT `product_features_group_id_foreign` FOREIGN KEY (`group_id`) REFERENCES `product_feature_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_features_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
