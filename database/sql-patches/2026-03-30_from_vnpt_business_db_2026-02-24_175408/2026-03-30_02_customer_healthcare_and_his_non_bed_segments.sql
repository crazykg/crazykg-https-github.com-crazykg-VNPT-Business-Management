SET NAMES utf8mb4;

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

CREATE TABLE IF NOT EXISTS `product_target_segments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `customer_sector` varchar(50) NOT NULL,
  `facility_type` varchar(50) DEFAULT NULL,
  `facility_types` text,
  `bed_capacity_min` int unsigned DEFAULT NULL,
  `bed_capacity_max` int unsigned DEFAULT NULL,
  `priority` tinyint unsigned NOT NULL DEFAULT '1',
  `sales_notes` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_target_segments_uuid_unique` (`uuid`),
  KEY `idx_pts_sector_lookup` (`customer_sector`,`facility_type`,`is_active`,`deleted_at`),
  KEY `idx_pts_product_lookup` (`product_id`,`is_active`,`deleted_at`),
  KEY `product_target_segments_created_by_foreign` (`created_by`),
  KEY `product_target_segments_updated_by_foreign` (`updated_by`),
  CONSTRAINT `product_target_segments_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_target_segments_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_target_segments_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @sql := IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_target_segments'
      AND COLUMN_NAME = 'facility_types'
  ),
  'SELECT 1',
  'ALTER TABLE `product_target_segments` ADD COLUMN `facility_types` TEXT NULL AFTER `facility_type`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `customers`
SET `customer_sector` = 'HEALTHCARE'
WHERE (`customer_sector` IS NULL OR TRIM(`customer_sector`) = '' OR UPPER(TRIM(`customer_sector`)) = 'OTHER')
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%benh vien%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%bệnh viện%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%trung tam y te%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%trung tâm y tế%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%tram y te%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%trạm y tế%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%phong kham%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%phòng khám%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%pkdk%'
  );

UPDATE `customers`
SET `customer_sector` = 'OTHER'
WHERE `customer_sector` IS NULL
   OR TRIM(`customer_sector`) = '';

UPDATE `customers`
SET `healthcare_facility_type` = 'PUBLIC_HOSPITAL'
WHERE UPPER(TRIM(COALESCE(`customer_sector`, ''))) = 'HEALTHCARE'
  AND (`healthcare_facility_type` IS NULL OR TRIM(`healthcare_facility_type`) = '' OR UPPER(TRIM(`healthcare_facility_type`)) IN ('OTHER', 'HOSPITAL_TTYT'))
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%benh vien%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%bệnh viện%'
  )
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%tu nhan%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%tư nhân%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%private%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%ngoai cong lap%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%ngoài công lập%';

UPDATE `customers`
SET `healthcare_facility_type` = 'PRIVATE_HOSPITAL'
WHERE UPPER(TRIM(COALESCE(`customer_sector`, ''))) = 'HEALTHCARE'
  AND (`healthcare_facility_type` IS NULL OR TRIM(`healthcare_facility_type`) = '' OR UPPER(TRIM(`healthcare_facility_type`)) IN ('OTHER', 'HOSPITAL_TTYT'))
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%benh vien%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%bệnh viện%'
  )
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%tu nhan%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%tư nhân%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%private%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%ngoai cong lap%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%ngoài công lập%'
  );

UPDATE `customers`
SET `healthcare_facility_type` = 'MEDICAL_CENTER'
WHERE UPPER(TRIM(COALESCE(`customer_sector`, ''))) = 'HEALTHCARE'
  AND (`healthcare_facility_type` IS NULL OR TRIM(`healthcare_facility_type`) = '' OR UPPER(TRIM(`healthcare_facility_type`)) = 'OTHER')
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%trung tam y te%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%trung tâm y tế%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%ttyt%'
  );

UPDATE `customers`
SET `healthcare_facility_type` = 'TYT_PKDK',
    `bed_capacity` = NULL
WHERE UPPER(TRIM(COALESCE(`customer_sector`, ''))) = 'HEALTHCARE'
  AND (`healthcare_facility_type` IS NULL OR TRIM(`healthcare_facility_type`) = '' OR UPPER(TRIM(`healthcare_facility_type`)) IN ('OTHER', 'TYT_CLINIC'))
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%tram y te%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%trạm y tế%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%phong kham da khoa%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%phòng khám đa khoa%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%pkdk%'
  );

UPDATE `customers`
SET `healthcare_facility_type` = 'PRIVATE_CLINIC',
    `bed_capacity` = NULL
WHERE UPPER(TRIM(COALESCE(`customer_sector`, ''))) = 'HEALTHCARE'
  AND (`healthcare_facility_type` IS NULL OR TRIM(`healthcare_facility_type`) = '' OR UPPER(TRIM(`healthcare_facility_type`)) = 'OTHER')
  AND (
    LOWER(COALESCE(`customer_name`, '')) LIKE '%phong kham%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%phòng khám%'
    OR LOWER(COALESCE(`customer_name`, '')) LIKE '%clinic%'
  )
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%phong kham da khoa%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%phòng khám đa khoa%'
  AND LOWER(COALESCE(`customer_name`, '')) NOT LIKE '%pkdk%';

UPDATE `customers`
SET `bed_capacity` = NULL
WHERE UPPER(TRIM(COALESCE(`healthcare_facility_type`, ''))) IN ('TYT_PKDK', 'PRIVATE_CLINIC', 'OTHER');

UPDATE `customers`
SET `customer_sector` = 'HEALTHCARE',
    `healthcare_facility_type` = 'PRIVATE_HOSPITAL',
    `bed_capacity` = 453
WHERE `id` = 4;

UPDATE `customers`
SET `customer_sector` = 'HEALTHCARE',
    `healthcare_facility_type` = 'PRIVATE_CLINIC',
    `bed_capacity` = NULL
WHERE `id` = 18;

UPDATE `customers`
SET `bed_capacity` = CASE `id`
  WHEN 3 THEN 498
  WHEN 4 THEN 453
  WHEN 5 THEN 495
  WHEN 6 THEN 339
  WHEN 7 THEN 142
  WHEN 8 THEN 300
  WHEN 11 THEN 342
  WHEN 12 THEN 282
  WHEN 13 THEN 349
  WHEN 14 THEN 157
  WHEN 15 THEN 157
  WHEN 19 THEN 244
  ELSE `bed_capacity`
END
WHERE `id` IN (3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 19)
  AND `bed_capacity` IS NULL
  AND UPPER(TRIM(COALESCE(`healthcare_facility_type`, ''))) IN ('PUBLIC_HOSPITAL', 'PRIVATE_HOSPITAL', 'MEDICAL_CENTER');

INSERT INTO `product_target_segments` (
  `uuid`,
  `product_id`,
  `customer_sector`,
  `facility_type`,
  `facility_types`,
  `bed_capacity_min`,
  `bed_capacity_max`,
  `priority`,
  `sales_notes`,
  `is_active`,
  `created_by`,
  `updated_by`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
SELECT
  UUID(),
  `src`.`product_id`,
  `src`.`customer_sector`,
  `src`.`facility_type`,
  `src`.`facility_types`,
  `src`.`bed_capacity_min`,
  `src`.`bed_capacity_max`,
  `src`.`priority`,
  `src`.`sales_notes`,
  1,
  NULL,
  NULL,
  NOW(),
  NOW(),
  NULL
FROM (
  SELECT
    5 AS `product_id`,
    'HEALTHCARE' AS `customer_sector`,
    NULL AS `facility_type`,
    NULL AS `facility_types`,
    100 AS `bed_capacity_min`,
    NULL AS `bed_capacity_max`,
    2 AS `priority`,
    'Benh an dien tu phu hop co so y te tu 100 giuong tro len.' AS `sales_notes`
  UNION ALL
  SELECT
    18,
    'HEALTHCARE',
    'PUBLIC_HOSPITAL',
    NULL,
    200,
    NULL,
    1,
    'Phu hop benh vien cong lap quy mo lon, nhan manh tich hop BHYT.'
  UNION ALL
  SELECT
    19,
    'HEALTHCARE',
    'PRIVATE_CLINIC',
    NULL,
    NULL,
    200,
    1,
    'Gon nhe cho phong kham tu nhan, de trien khai nhanh.'
  UNION ALL
  SELECT
    24,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    25,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    26,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    27,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    28,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    29,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
  UNION ALL
  SELECT
    30,
    'HEALTHCARE',
    'TYT_PKDK',
    NULL,
    NULL,
    NULL,
    1,
    'Phu hop TYT va PKDK khong co giuong, nhan manh quy trinh tiep don va luot kham.'
) AS `src`
INNER JOIN `products` AS `p`
  ON `p`.`id` = `src`.`product_id`
LEFT JOIN `product_target_segments` AS `pts`
  ON `pts`.`product_id` = `src`.`product_id`
 AND `pts`.`customer_sector` = `src`.`customer_sector`
 AND (`pts`.`facility_type` <=> `src`.`facility_type`)
 AND (`pts`.`facility_types` <=> `src`.`facility_types`)
 AND (`pts`.`bed_capacity_min` <=> `src`.`bed_capacity_min`)
 AND (`pts`.`bed_capacity_max` <=> `src`.`bed_capacity_max`)
 AND `pts`.`priority` = `src`.`priority`
 AND (`pts`.`sales_notes` <=> `src`.`sales_notes`)
 AND `pts`.`deleted_at` IS NULL
WHERE `pts`.`id` IS NULL;
