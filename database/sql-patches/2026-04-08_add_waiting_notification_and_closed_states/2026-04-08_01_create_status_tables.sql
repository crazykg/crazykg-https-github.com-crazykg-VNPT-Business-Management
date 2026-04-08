-- 2026-04-08_01_create_status_tables.sql
-- Tạo bảng chi tiết cho 2 trạng thái mới: waiting_notification và closed
-- Date: 2026-04-08
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Tạo bảng detail để lưu thông tin chi tiết của 2 trạng thái mới
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Bảng waiting_notification (Chờ thông báo khách hàng)
CREATE TABLE IF NOT EXISTS `customer_request_waiting_notification` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID chi tiết trạng thái',
  `request_case_id` BIGINT UNSIGNED NOT NULL COMMENT 'Yêu cầu',
  `notified_by_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người phụ trách thông báo',
  `notification_channel` VARCHAR(100) DEFAULT NULL COMMENT 'Kênh: email, phone, sms, portal',
  `notification_content` TEXT COMMENT 'Nội dung dự kiến thông báo',
  `planned_notification_at` DATETIME DEFAULT NULL COMMENT 'Dự kiến ngày thông báo',
  `actual_notification_at` DATETIME DEFAULT NULL COMMENT 'Ngày thông báo thực tế',
  `customer_feedback` TEXT COMMENT 'Phản hồi khách hàng (nếu có)',
  `notes` TEXT COMMENT 'Ghi chú',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người tạo',
  `updated_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người cập nhật',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',

  INDEX `idx_waiting_notification_case` (`request_case_id`),
  INDEX `idx_waiting_notification_handler` (`notified_by_user_id`),

  CONSTRAINT `fk_waiting_notification_case`
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waiting_notification_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_waiting_notification_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Chi tiết trạng thái chờ thông báo khách hàng';

-- 2. Bảng closed (Đóng yêu cầu)
CREATE TABLE IF NOT EXISTS `customer_request_closed` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'ID chi tiết trạng thái',
  `request_case_id` BIGINT UNSIGNED NOT NULL COMMENT 'Yêu cầu',
  `closed_by_user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người đóng yêu cầu',
  `closed_at` DATETIME DEFAULT NULL COMMENT 'Ngày đóng',
  `closure_reason` VARCHAR(100) DEFAULT NULL COMMENT 'Lý do đóng: completed, cancelled, duplicate',
  `closure_notes` TEXT COMMENT 'Ghi chú khi đóng',
  `customer_satisfaction` VARCHAR(50) DEFAULT NULL COMMENT 'Mức độ hài lòng: very_satisfied, satisfied, neutral, dissatisfied',
  `created_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người tạo',
  `updated_by` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người cập nhật',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',

  INDEX `idx_closed_case` (`request_case_id`),
  INDEX `idx_closed_handler` (`closed_by_user_id`),

  CONSTRAINT `fk_closed_case`
    FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_closed_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_closed_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Chi tiết trạng thái đóng yêu cầu';

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT 'Tables created successfully' AS status;

-- Kiểm tra bảng đã tạo
SHOW TABLES LIKE 'customer_request_waiting_notification';
SHOW TABLES LIKE 'customer_request_closed';

-- Kiểm tra cấu trúc bảng
DESCRIBE customer_request_waiting_notification;
DESCRIBE customer_request_closed;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
