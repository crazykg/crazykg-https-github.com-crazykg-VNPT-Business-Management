SET NAMES utf8mb4;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'project_type_code'
  ),
  'SELECT 1',
  'ALTER TABLE `contracts` ADD COLUMN `project_type_code` VARCHAR(100) NULL AFTER `project_id`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND INDEX_NAME = 'idx_contracts_project_type_code'
  ),
  'SELECT 1',
  'ALTER TABLE `contracts` ADD INDEX `idx_contracts_project_type_code` (`project_type_code`)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `project_types` (
  `type_code`,
  `type_name`,
  `description`,
  `is_active`,
  `sort_order`,
  `created_at`,
  `updated_at`
)
SELECT
  'THUE_DICH_VU_COSAN',
  'Thuê dịch vụ CNTT có sẵn',
  NULL,
  1,
  30,
  NOW(),
  NOW()
FROM DUAL
WHERE EXISTS (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_types'
)
ON DUPLICATE KEY UPDATE
  `type_name` = VALUES(`type_name`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`),
  `sort_order` = VALUES(`sort_order`),
  `updated_at` = VALUES(`updated_at`);

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND CONSTRAINT_NAME = 'fk_cont_proj_link'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ),
  'ALTER TABLE `contracts` DROP FOREIGN KEY `fk_cont_proj_link`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'project_id'
      AND IS_NULLABLE = 'NO'
  ),
  'ALTER TABLE `contracts` MODIFY `project_id` BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'project_id'
  )
  AND EXISTS(
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
  )
  AND NOT EXISTS(
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contracts'
      AND CONSTRAINT_NAME = 'fk_cont_proj_link'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ),
  'ALTER TABLE `contracts` ADD CONSTRAINT `fk_cont_proj_link` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payment_schedules'
      AND CONSTRAINT_NAME = 'fk_ps_project'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ),
  'ALTER TABLE `payment_schedules` DROP FOREIGN KEY `fk_ps_project`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'project_id'
      AND IS_NULLABLE = 'NO'
  ),
  'ALTER TABLE `payment_schedules` MODIFY `project_id` BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payment_schedules'
      AND COLUMN_NAME = 'project_id'
  )
  AND EXISTS(
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'projects'
  )
  AND NOT EXISTS(
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'payment_schedules'
      AND CONSTRAINT_NAME = 'fk_ps_project'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ),
  'ALTER TABLE `payment_schedules` ADD CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE',
  'SELECT 1'
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
      AND COLUMN_NAME = 'customer_code_auto_generated'
  ),
  'SELECT 1',
  'ALTER TABLE `customers` ADD COLUMN `customer_code_auto_generated` TINYINT(1) NOT NULL DEFAULT ''0'' AFTER `customer_code`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `customers`
SET `customer_code_auto_generated` = 0
WHERE `customer_code` IS NOT NULL
  AND TRIM(`customer_code`) <> '';

CREATE TABLE IF NOT EXISTS `employee_party_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` bigint unsigned NOT NULL,
  `ethnicity` varchar(120) DEFAULT NULL,
  `religion` varchar(120) DEFAULT NULL,
  `hometown` varchar(255) DEFAULT NULL,
  `professional_qualification` varchar(255) DEFAULT NULL,
  `political_theory_level` varchar(255) DEFAULT NULL,
  `party_card_number` varchar(120) DEFAULT NULL,
  `notes` text,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_party_profiles_employee_id_unique` (`employee_id`),
  UNIQUE KEY `employee_party_profiles_party_card_number_unique` (`party_card_number`),
  CONSTRAINT `employee_party_profiles_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `permissions` (
  `perm_key`,
  `perm_name`,
  `perm_group`,
  `is_active`,
  `created_at`,
  `updated_at`
)
SELECT
  `src`.`perm_key`,
  `src`.`perm_name`,
  `src`.`perm_group`,
  1,
  NOW(),
  NOW()
FROM (
  SELECT 'employee_party.read' AS `perm_key`, 'Xem hồ sơ đảng viên' AS `perm_name`, 'Nhân sự' AS `perm_group`
  UNION ALL SELECT 'employee_party.write', 'Quản lý hồ sơ đảng viên', 'Nhân sự'
  UNION ALL SELECT 'employee_party.import', 'Nhập hồ sơ đảng viên', 'Nhân sự'
) AS `src`
WHERE EXISTS (
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'permissions'
)
ON DUPLICATE KEY UPDATE
  `perm_name` = VALUES(`perm_name`),
  `perm_group` = VALUES(`perm_group`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `role_permission` (`role_id`, `permission_id`)
SELECT `r`.`id`, `p`.`id`
FROM `roles` AS `r`
INNER JOIN `permissions` AS `p`
  ON `p`.`perm_key` IN ('employee_party.read', 'employee_party.write', 'employee_party.import')
LEFT JOIN `role_permission` AS `rp`
  ON `rp`.`role_id` = `r`.`id`
 AND `rp`.`permission_id` = `p`.`id`
WHERE `r`.`role_code` = 'ADMIN'
  AND `rp`.`role_id` IS NULL;
