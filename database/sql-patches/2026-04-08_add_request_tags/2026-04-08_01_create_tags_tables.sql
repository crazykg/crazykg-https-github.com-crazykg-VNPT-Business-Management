-- 2026-04-08_01_create_tags_tables.sql
-- Tạo bảng tags và customer_request_case_tags
-- Date: 2026-04-08
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Tạo hệ thống tag cho yêu cầu khách hàng
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Bảng tags - Danh mục tag có thể tái sử dụng
CREATE TABLE IF NOT EXISTS `tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID tag',
  `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tên tag (duy nhất)',
  `color` VARCHAR(20) DEFAULT 'blue' COMMENT 'Mã màu: blue, red, green, yellow, purple, pink, orange, teal, gray',
  `description` VARCHAR(255) DEFAULT NULL COMMENT 'Mô tả tag',
  `usage_count` INT UNSIGNED DEFAULT 0 COMMENT 'Số lần tag được sử dụng',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người tạo tag',
  `updated_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người cập nhật tag',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
  `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete',
  
  INDEX `idx_tags_name` (`name`),
  INDEX `idx_tags_color` (`color`),
  INDEX `idx_tags_usage` (`usage_count`),
  
  CONSTRAINT `fk_tags_created_by` 
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tags_updated_by` 
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Danh mục tag cho yêu cầu khách hàng';

-- 2. Bảng pivot - Liên kết tag với yêu cầu
CREATE TABLE IF NOT EXISTS `customer_request_case_tags` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID liên kết',
  `request_case_id` BIGINT UNSIGNED NOT NULL COMMENT 'Yêu cầu',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT 'Tag',
  `attached_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người gắn tag',
  `attached_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gắn tag',
  
  UNIQUE KEY `uq_case_tag` (`request_case_id`, `tag_id`),
  INDEX `idx_case_tags_case` (`request_case_id`),
  INDEX `idx_case_tags_tag` (`tag_id`),
  
  CONSTRAINT `fk_case_tags_case` 
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_tag` 
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_tags_attached_by` 
    FOREIGN KEY (`attached_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Liên kết tag với yêu cầu khách hàng';

-- 3. Seed một số tag mẫu
INSERT INTO `tags` (`name`, `color`, `description`, `created_at`, `updated_at`) VALUES
('bug', 'red', 'Lỗi phần mềm', NOW(), NOW()),
('feature', 'blue', 'Tính năng mới', NOW(), NOW()),
('enhancement', 'green', 'Cải tiến tính năng', NOW(), NOW()),
('urgent', 'orange', 'Yêu cầu khẩn cấp', NOW(), NOW()),
('ui-ux', 'purple', 'Giao diện người dùng', NOW(), NOW()),
('performance', 'teal', 'Vấn đề hiệu năng', NOW(), NOW()),
('security', 'pink', 'Bảo mật', NOW(), NOW()),
('data', 'yellow', 'Liên quan dữ liệu', NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = `name`;

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT 'Tags tables created successfully' AS status;

-- Kiểm tra bảng đã tạo
SHOW TABLES LIKE 'tags';
SHOW TABLES LIKE 'customer_request_case_tags';

-- Kiểm tra cấu trúc bảng
DESCRIBE tags;
DESCRIBE customer_request_case_tags;

-- Kiểm tra tag mẫu
SELECT id, name, color, description FROM tags ORDER BY id;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
