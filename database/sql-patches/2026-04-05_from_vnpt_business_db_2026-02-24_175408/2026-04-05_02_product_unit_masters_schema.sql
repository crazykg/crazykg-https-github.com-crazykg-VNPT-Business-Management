SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `product_unit_masters` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `unit_code` varchar(50) NOT NULL,
  `unit_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_unit_masters_code` (`unit_code`),
  UNIQUE KEY `uq_product_unit_masters_name` (`unit_name`),
  KEY `idx_product_unit_masters_active_name` (`is_active`,`unit_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `product_unit_masters` (
  `unit_code`,
  `unit_name`,
  `description`,
  `is_active`,
  `created_at`,
  `updated_at`
)
VALUES
  ('LICENSE', 'License', NULL, 1, NOW(), NOW()),
  ('THANG', 'Tháng', NULL, 1, NOW(), NOW()),
  ('GOI', 'Gói', NULL, 1, NOW(), NOW()),
  ('BO', 'Bộ', NULL, 1, NOW(), NOW()),
  ('CAI', 'Cái', NULL, 1, NOW(), NOW()),
  ('THIET_BI', 'Thiết bị', NULL, 1, NOW(), NOW()),
  ('USER', 'User', NULL, 1, NOW(), NOW()),
  ('MODULE', 'Module', NULL, 1, NOW(), NOW()),
  ('GIUONG_BENH', 'Giường bệnh', NULL, 1, NOW(), NOW()),
  ('CA_CHUP', 'Ca chụp', NULL, 1, NOW(), NOW()),
  ('BENH_AN', 'Bệnh án', NULL, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `unit_name` = VALUES(`unit_name`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = VALUES(`updated_at`);
