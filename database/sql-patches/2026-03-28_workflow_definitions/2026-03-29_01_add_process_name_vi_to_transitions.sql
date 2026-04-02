-- 2026-03-29_01_add_process_name_vi_to_transitions.sql
-- Thêm column process_name_vi để lưu tên tiếng Việt của các transitions
-- Date: 2026-03-29

-- ============================================================================
-- MỤC ĐÍCH: Thêm column process_name_vi vào customer_request_status_transitions
-- ============================================================================
-- Tránh hardcode mapping trong backend
-- Dễ dàng edit tên tiếng Việt trực tiếp trong database
-- ============================================================================

-- 1. Thêm column process_name_vi
ALTER TABLE customer_request_status_transitions 
ADD COLUMN process_name_vi VARCHAR(255) AFTER to_status_code;

-- 2. Update data cho workflow LUONG_A (workflow_definition_id = 4)
UPDATE customer_request_status_transitions 
SET process_name_vi = CASE to_status_code
    WHEN 'assigned_to_receiver' THEN 'Giao R thực hiện'
    WHEN 'pending_dispatch' THEN 'Giao PM/Trả YC cho PM'
    WHEN 'receiver_in_progress' THEN 'R Đang thực hiện'
    WHEN 'not_executed' THEN 'Không tiếp nhận'
    WHEN 'waiting_customer_feedback' THEN 'Chờ khách hàng cung cấp thông tin'
    WHEN 'analysis' THEN 'Chuyển BA Phân tích'
    WHEN 'analysis_completed' THEN 'Chuyển BA Phân tích hoàn thành'
    WHEN 'analysis_suspended' THEN 'Chuyển BA Phân tích tạm ngưng'
    WHEN 'dms_transfer' THEN 'Chuyển DMS'
    WHEN 'dms_task_created' THEN 'Tạo task'
    WHEN 'dms_in_progress' THEN 'DMS Đang thực hiện'
    WHEN 'dms_suspended' THEN 'DMS tạm ngưng'
    WHEN 'coding' THEN 'Lập trình'
    WHEN 'coding_in_progress' THEN 'Dev đang thực hiện'
    WHEN 'coding_suspended' THEN 'Dev tạm ngưng'
    WHEN 'completed' THEN 'Hoàn thành'
    WHEN 'customer_notified' THEN 'Thông báo khách hàng'
    ELSE NULL
END
WHERE workflow_definition_id = 4;

-- 3. Verify
SELECT 
    id,
    workflow_definition_id,
    from_status_code,
    to_status_code,
    process_name_vi,
    allowed_roles
FROM customer_request_status_transitions
WHERE workflow_definition_id = 4
ORDER BY sort_order;
