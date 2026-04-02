-- 2026-03-29_02_create_customer_request_assigned_to_receiver_table.sql
-- Tạo bảng customer_request_assigned_to_receiver cho trạng thái "Giao R thực hiện"
-- Date: 2026-03-29
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Tạo bảng trạng thái "Giao R thực hiện"
-- ============================================================================
-- Bảng này lưu trữ thông tin khi yêu cầu được giao cho người thực hiện (R)
-- Một yêu cầu có thể được giao nhiều lần (lịch sử giao việc)
-- ============================================================================

-- Xóa bảng nếu tồn tại (cẩn thận: sẽ xóa data cũ)
DROP TABLE IF EXISTS `customer_request_assigned_to_receiver`;

-- Tạo bảng customer_request_assigned_to_receiver
CREATE TABLE `customer_request_assigned_to_receiver` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'Primary key',
    `request_case_id` BIGINT UNSIGNED NOT NULL COMMENT 'FK → customer_request_cases.id - Yêu cầu',
    `receiver_user_id` BIGINT UNSIGNED NULL COMMENT 'FK → internal_users.id - Người thực hiện (R)',
    `accepted_at` DATETIME NULL COMMENT 'Ngày chấp nhận xử lý',
    `started_at` DATETIME NULL COMMENT 'Ngày bắt đầu xử lý',
    `expected_completed_at` DATETIME NULL COMMENT 'Ngày dự kiến hoàn thành',
    `processing_content` TEXT NULL COMMENT 'Nội dung xử lý',
    `notes` TEXT NULL COMMENT 'Ghi chú trạng thái',
    `created_by` BIGINT UNSIGNED NULL COMMENT 'FK → internal_users.id - Người tạo',
    `updated_by` BIGINT UNSIGNED NULL COMMENT 'FK → internal_users.id - Người cập nhật',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
    `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete timestamp',

    -- Indexes
    INDEX `idx_request_case_id` (`request_case_id`),
    INDEX `idx_receiver_user_id` (`receiver_user_id`),
    INDEX `idx_created_by` (`created_by`),
    INDEX `idx_updated_by` (`updated_by`),
    INDEX `idx_deleted_at` (`deleted_at`),

    -- Foreign keys
    CONSTRAINT `fk_crc_assigned_to_receiver_case`
        FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_crc_assigned_to_receiver_receiver`
        FOREIGN KEY (`receiver_user_id`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_crc_assigned_to_receiver_created_by`
        FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_crc_assigned_to_receiver_updated_by`
        FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Trạng thái Giao R thực hiện - yêu cầu khách hàng';

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT
    TABLE_NAME,
    TABLE_COMMENT,
    ENGINE,
    CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'customer_request_assigned_to_receiver';

-- Hiển thị cấu trúc bảng
DESCRIBE customer_request_assigned_to_receiver;

-- Hiển thị foreign keys
SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'customer_request_assigned_to_receiver'
AND REFERENCED_TABLE_NAME IS NOT NULL;
