-- ================================================================================
-- ADD WORKFLOW TRACKING FIELDS TO customer_request_cases
-- Date: 2026-04-01
-- Purpose: Thêm trường theo dõi workflow trực tiếp vào bảng master
--          Để UI có thể lấy nhanh không cần join nhiều bảng
-- MySQL 8 compatible script
-- ================================================================================

USE vnpt_business_db;

-- Backup trước khi chạy (uncomment nếu cần)
-- CREATE TABLE customer_request_cases_backup_20260401 AS SELECT * FROM customer_request_cases;

-- ================================================================================
-- PHẦN 1: THÊM CỘT VÀO customer_request_cases
-- ================================================================================

DROP PROCEDURE IF EXISTS sp_add_crc_tracking_columns;
DELIMITER $$
CREATE PROCEDURE sp_add_crc_tracking_columns()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_entered_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_entered_at DATETIME NULL COMMENT 'Thời điểm vào trạng thái hiện tại'
        AFTER current_status_instance_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_exited_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_exited_at DATETIME NULL COMMENT 'Thời điểm rời trạng thái hiện tại (null nếu đang ở)'
        AFTER current_entered_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'previous_status_instance_id'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN previous_status_instance_id BIGINT UNSIGNED NULL COMMENT 'ID instance trạng thái trước đó'
        AFTER current_exited_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'next_status_instance_id'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN next_status_instance_id BIGINT UNSIGNED NULL COMMENT 'ID instance trạng thái kế tiếp (dùng cho linked list)'
        AFTER previous_status_instance_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_started_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_started_at DATETIME NULL COMMENT 'Ngày bắt đầu xử lý (sync từ status row)'
        AFTER next_status_instance_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_expected_completed_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_expected_completed_at DATETIME NULL COMMENT 'Ngày dự kiến hoàn thành (sync từ status row)'
        AFTER current_started_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_completed_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_completed_at DATETIME NULL COMMENT 'Ngày hoàn thành thực tế (sync từ status row)'
        AFTER current_expected_completed_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_status_notes'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_status_notes TEXT NULL COMMENT 'Ghi chú trạng thái hiện tại (sync từ status row)'
        AFTER current_completed_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND COLUMN_NAME = 'current_progress_percent'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD COLUMN current_progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tiến độ % (sync từ status row)'
        AFTER current_status_notes;
    END IF;
END$$
DELIMITER ;

CALL sp_add_crc_tracking_columns();
DROP PROCEDURE IF EXISTS sp_add_crc_tracking_columns;

-- ================================================================================
-- PHẦN 1B: THÊM INDEX
-- ================================================================================

DROP PROCEDURE IF EXISTS sp_add_crc_tracking_indexes;
DELIMITER $$
CREATE PROCEDURE sp_add_crc_tracking_indexes()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND INDEX_NAME = 'idx_crc_prev_instance'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD INDEX idx_crc_prev_instance (previous_status_instance_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND INDEX_NAME = 'idx_crc_next_instance'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD INDEX idx_crc_next_instance (next_status_instance_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND INDEX_NAME = 'idx_crc_started_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD INDEX idx_crc_started_at (current_started_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'customer_request_cases'
          AND INDEX_NAME = 'idx_crc_expected_completed_at'
    ) THEN
        ALTER TABLE customer_request_cases
        ADD INDEX idx_crc_expected_completed_at (current_expected_completed_at);
    END IF;
END$$
DELIMITER ;

CALL sp_add_crc_tracking_indexes();
DROP PROCEDURE IF EXISTS sp_add_crc_tracking_indexes;

-- ================================================================================
-- PHẦN 2: POPULATE DỮ LIỆU TỪ customer_request_status_instances
-- ================================================================================

UPDATE customer_request_cases crc
INNER JOIN customer_request_status_instances crsi ON crsi.id = crc.current_status_instance_id
SET
    crc.current_entered_at = crsi.entered_at,
    crc.current_exited_at = crsi.exited_at,
    crc.previous_status_instance_id = crsi.previous_instance_id,
    crc.next_status_instance_id = crsi.next_instance_id
WHERE crc.current_status_instance_id IS NOT NULL
  AND crc.deleted_at IS NULL;

UPDATE customer_request_cases crc
LEFT JOIN customer_request_assigned_to_receiver s ON s.request_case_id = crc.id AND crc.current_status_code = 'assigned_to_receiver'
LEFT JOIN customer_request_pending_dispatch pd ON pd.request_case_id = crc.id AND crc.current_status_code = 'pending_dispatch'
LEFT JOIN customer_request_receiver_in_progress rip ON rip.request_case_id = crc.id AND crc.current_status_code = 'receiver_in_progress'
LEFT JOIN customer_request_waiting_customer_feedbacks wcf ON wcf.request_case_id = crc.id AND crc.current_status_code = 'waiting_customer_feedback'
LEFT JOIN customer_request_in_progress ip ON ip.request_case_id = crc.id AND crc.current_status_code = 'in_progress'
LEFT JOIN customer_request_not_executed ne ON ne.request_case_id = crc.id AND crc.current_status_code = 'not_executed'
LEFT JOIN customer_request_completed c ON c.request_case_id = crc.id AND crc.current_status_code = 'completed'
LEFT JOIN customer_request_customer_notified cn ON cn.request_case_id = crc.id AND crc.current_status_code = 'customer_notified'
LEFT JOIN customer_request_returned_to_manager rm ON rm.request_case_id = crc.id AND crc.current_status_code = 'returned_to_manager'
LEFT JOIN customer_request_analysis a ON a.request_case_id = crc.id AND crc.current_status_code = 'analysis'
LEFT JOIN customer_request_coding cd ON cd.request_case_id = crc.id AND crc.current_status_code = 'coding'
LEFT JOIN customer_request_dms_transfer dms ON dms.request_case_id = crc.id AND crc.current_status_code = 'dms_transfer'
SET
    crc.current_started_at = CASE
        WHEN crc.current_status_code = 'assigned_to_receiver' THEN s.started_at
        WHEN crc.current_status_code = 'receiver_in_progress' THEN rip.started_at
        WHEN crc.current_status_code = 'in_progress' THEN ip.started_at
        WHEN crc.current_status_code = 'coding' THEN cd.coding_started_at
        WHEN crc.current_status_code = 'dms_transfer' THEN dms.dms_started_at
        ELSE NULL
    END,
    crc.current_expected_completed_at = CASE
        WHEN crc.current_status_code = 'assigned_to_receiver' THEN s.expected_completed_at
        WHEN crc.current_status_code = 'receiver_in_progress' THEN rip.expected_completed_at
        WHEN crc.current_status_code = 'in_progress' THEN ip.expected_completed_at
        ELSE NULL
    END,
    crc.current_completed_at = CASE
        WHEN crc.current_status_code = 'analysis' THEN a.analysis_completed_at
        WHEN crc.current_status_code = 'completed' THEN c.completed_at
        WHEN crc.current_status_code = 'coding' THEN cd.coding_completed_at
        WHEN crc.current_status_code = 'dms_transfer' THEN dms.dms_completed_at
        WHEN crc.current_status_code = 'customer_notified' THEN cn.notified_at
        WHEN crc.current_status_code = 'not_executed' THEN ne.decision_at
        WHEN crc.current_status_code = 'returned_to_manager' THEN rm.returned_at
        ELSE NULL
    END,
    crc.current_status_notes = CASE
        WHEN crc.current_status_code = 'assigned_to_receiver' THEN s.notes
        WHEN crc.current_status_code = 'pending_dispatch' THEN pd.notes
        WHEN crc.current_status_code = 'receiver_in_progress' THEN rip.notes
        WHEN crc.current_status_code = 'waiting_customer_feedback' THEN wcf.notes
        WHEN crc.current_status_code = 'in_progress' THEN ip.notes
        WHEN crc.current_status_code = 'not_executed' THEN ne.notes
        WHEN crc.current_status_code = 'completed' THEN c.notes
        WHEN crc.current_status_code = 'customer_notified' THEN cn.notes
        WHEN crc.current_status_code = 'returned_to_manager' THEN rm.notes
        WHEN crc.current_status_code = 'analysis' THEN a.notes
        WHEN crc.current_status_code = 'coding' THEN cd.notes
        WHEN crc.current_status_code = 'dms_transfer' THEN dms.notes
        ELSE NULL
    END,
    crc.current_progress_percent = CASE
        WHEN crc.current_status_code = 'receiver_in_progress' THEN COALESCE(rip.progress_percent, 0)
        WHEN crc.current_status_code = 'in_progress' THEN COALESCE(ip.progress_percent, 0)
        ELSE 0
    END
WHERE crc.deleted_at IS NULL;

-- ================================================================================
-- PHẦN 3: TẠO VIEW ĐỂ TRA CỨU LỊCH SỬ WORKFLOW
-- ================================================================================

DROP VIEW IF EXISTS v_customer_request_workflow_history;
CREATE VIEW v_customer_request_workflow_history AS
SELECT
    crc.id AS case_id,
    crc.request_code,
    crsi.id AS instance_id,
    crsi.status_code,
    crsi.status_table,
    crsi.previous_instance_id,
    crsi.next_instance_id,
    crsi.entered_at,
    crsi.exited_at,
    crsi.is_current,
    COALESCE(u_prev.full_name, 'N/A') AS previous_handler_name,
    COALESCE(u_curr.full_name, 'N/A') AS current_handler_name,
    TIMESTAMPDIFF(MINUTE, crsi.entered_at, COALESCE(crsi.exited_at, NOW())) AS duration_minutes
FROM customer_request_cases crc
INNER JOIN customer_request_status_instances crsi ON crsi.request_case_id = crc.id
LEFT JOIN internal_users u_prev ON u_prev.id = crsi.created_by
LEFT JOIN internal_users u_curr ON u_curr.id = crsi.updated_by
WHERE crc.deleted_at IS NULL;

-- ================================================================================
-- PHẦN 4: TẠO STORED PROCEDURE ĐỂ CẬP NHẬT KHI CHUYỂN TRẠNG THÁI
-- ================================================================================

DROP PROCEDURE IF EXISTS sp_update_case_workflow_tracking;
DELIMITER $$
CREATE PROCEDURE sp_update_case_workflow_tracking(
    IN p_case_id BIGINT,
    IN p_new_status_instance_id BIGINT,
    IN p_old_status_instance_id BIGINT,
    IN p_entered_at DATETIME,
    IN p_exited_at DATETIME,
    IN p_current_started_at DATETIME,
    IN p_current_expected_completed_at DATETIME,
    IN p_current_completed_at DATETIME,
    IN p_current_status_notes TEXT,
    IN p_current_progress_percent TINYINT
)
BEGIN
    UPDATE customer_request_cases
    SET
        current_status_instance_id = p_new_status_instance_id,
        current_entered_at = p_entered_at,
        current_exited_at = p_exited_at,
        previous_status_instance_id = p_old_status_instance_id,
        next_status_instance_id = NULL,
        current_started_at = p_current_started_at,
        current_expected_completed_at = p_current_expected_completed_at,
        current_completed_at = p_current_completed_at,
        current_status_notes = p_current_status_notes,
        current_progress_percent = COALESCE(p_current_progress_percent, 0),
        updated_at = NOW()
    WHERE id = p_case_id;

    IF p_old_status_instance_id IS NOT NULL THEN
        UPDATE customer_request_status_instances
        SET next_instance_id = p_new_status_instance_id,
            updated_at = NOW()
        WHERE id = p_old_status_instance_id;
    END IF;
END$$
DELIMITER ;

-- ================================================================================
-- VERIFY SAU KHI CHẠY
-- ================================================================================

SELECT 'Cấu trúc customer_request_cases sau khi thêm cột:' AS info;
DESCRIBE customer_request_cases;

SELECT
    'Dữ liệu mẫu sau khi update:' AS info,
    COUNT(*) AS total_cases,
    COUNT(current_status_instance_id) AS cases_with_instance,
    COUNT(current_entered_at) AS cases_with_entered_at
FROM customer_request_cases
WHERE deleted_at IS NULL;

SELECT
    id,
    request_code,
    current_status_code,
    current_status_instance_id,
    current_entered_at,
    current_exited_at,
    previous_status_instance_id,
    next_status_instance_id,
    current_started_at,
    current_expected_completed_at,
    current_completed_at,
    current_progress_percent,
    updated_at
FROM customer_request_cases
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 5;

SELECT * FROM v_customer_request_workflow_history LIMIT 10;
