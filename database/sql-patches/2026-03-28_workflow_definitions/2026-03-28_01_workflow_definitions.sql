-- 2026-03-28_01_workflow_definitions.sql
-- Tạo bảng workflow_definitions để hỗ trợ multi-workflow configuration
-- Date: 2026-03-28
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Tạo bảng workflow_definitions
-- ============================================================================
-- Bảng này lưu trữ các định nghĩa workflow (luồng xử lý)
-- Mỗi workflow có nhiều transitions (1-nhiều)
-- Chỉ 1 workflow active tại một thời điểm cho mỗi process_type
-- ============================================================================

-- Xóa bảng nếu tồn tại (cẩn thận: sẽ xóa data cũ)
DROP TABLE IF EXISTS `workflow_definitions`;

-- Tạo bảng workflow_definitions
CREATE TABLE `workflow_definitions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT 'Primary key',
    `code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã luồng: LUONG_A, LUONG_B',
    `name` VARCHAR(255) NOT NULL COMMENT 'Tên luồng: Luồng xử lý A',
    `description` TEXT COMMENT 'Mô tả luồng',
    `process_type` VARCHAR(50) NOT NULL DEFAULT 'customer_request' COMMENT 'Loại quy trình: customer_request, project_procedure',
    `is_active` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Chỉ 1 luồng active tại thời điểm',
    `is_default` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Luồng mặc định khi tạo mới',
    `version` VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT 'Version luồng',
    `config` JSON COMMENT 'Cấu hình bổ sung: notification, escalation rules',
    `created_by` BIGINT UNSIGNED COMMENT 'User tạo workflow',
    `updated_by` BIGINT UNSIGNED COMMENT 'User cập nhật workflow',
    `activated_at` TIMESTAMP NULL COMMENT 'Thời điểm activate',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
    `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete timestamp',
    
    -- Indexes
    INDEX `idx_workflow_code` (`code`),
    INDEX `idx_workflow_process_type` (`process_type`),
    INDEX `idx_workflow_active` (`process_type`, `is_active`),
    INDEX `idx_workflow_default` (`process_type`, `is_default`),
    INDEX `idx_workflow_deleted` (`deleted_at`),
    
    -- Foreign keys
    CONSTRAINT `fk_workflow_created_by` 
        FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_workflow_updated_by` 
        FOREIGN KEY (`updated_by`) REFERENCES `internal_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Định nghĩa luồng workflow';

-- ============================================================================
-- VERIFY
-- ============================================================================

-- Kiểm tra bảng đã tạo
SELECT 'workflow_definitions table created' AS status;

-- Kiểm tra cấu trúc bảng
DESCRIBE workflow_definitions;

-- Kiểm tra số lượng rows (phải = 0 sau khi tạo mới)
SELECT COUNT(*) AS row_count FROM workflow_definitions;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
