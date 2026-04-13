CREATE TABLE IF NOT EXISTS `product_unit_masters` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `unit_code` varchar(50) NOT NULL,
  `unit_name` varchar(120) NOT NULL,
  `description` varchar(255) NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT TRUE,
  `created_at` timestamp NULL,
  `created_by` bigint unsigned NULL,
  `updated_at` timestamp NULL,
  `updated_by` bigint unsigned NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_unit_masters_code` (`unit_code`),
  UNIQUE KEY `uq_product_unit_masters_name` (`unit_name`),
  INDEX `idx_product_unit_masters_active_name` (`is_active`, `unit_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default units
INSERT IGNORE INTO `product_unit_masters` (`unit_code`, `unit_name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
('LICENSE', 'License', NULL, TRUE, NOW(), NOW()),
('THANG', 'Tháng', NULL, TRUE, NOW(), NOW()),
('GOI', 'Gói', NULL, TRUE, NOW(), NOW()),
('BO', 'Bộ', NULL, TRUE, NOW(), NOW()),
('CAI', 'Cái', NULL, TRUE, NOW(), NOW()),
('THIET_BI', 'Thiết bị', NULL, TRUE, NOW(), NOW()),
('USER', 'User', NULL, TRUE, NOW(), NOW()),
('MODULE', 'Module', NULL, TRUE, NOW(), NOW()),
('GIUONG_BENH', 'Giường bệnh', NULL, TRUE, NOW(), NOW()),
('CA_CHUP', 'Ca chụp', NULL, TRUE, NOW(), NOW()),
('BENH_AN', 'Bệnh án', NULL, TRUE, NOW(), NOW());