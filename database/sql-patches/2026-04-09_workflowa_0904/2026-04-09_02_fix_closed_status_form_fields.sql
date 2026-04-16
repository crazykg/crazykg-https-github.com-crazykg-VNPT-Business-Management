SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-09_02_fix_closed_status_form_fields.sql
-- Mục tiêu:
--   Đồng bộ form_fields cho trạng thái `closed` theo flow transition modal hiện tại,
--   chỉ tập trung validate: progress_percent, to_user_id, notes.
-- ============================================================================

UPDATE customer_request_status_catalogs
SET form_fields_json = JSON_ARRAY(
    JSON_OBJECT('name', 'received_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'completed_at', 'label', 'Ngày kết thúc', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'extended_at', 'label', 'Ngày gia hạn', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ phần trăm', 'type', 'number', 'required', TRUE),
    JSON_OBJECT('name', 'from_user_id', 'label', 'Người chuyển', 'type', 'user_select', 'required', FALSE),
    JSON_OBJECT('name', 'to_user_id', 'label', 'Người nhận', 'type', 'user_select', 'required', TRUE),
    JSON_OBJECT('name', 'notes', 'label', 'Ghi chú', 'type', 'textarea', 'required', TRUE)
),
    updated_at = NOW()
WHERE workflow_definition_id = 1
  AND status_code = 'closed';

COMMIT;

-- Verify
SELECT id, status_code, status_name_vi, JSON_PRETTY(form_fields_json) AS form_fields_json
FROM customer_request_status_catalogs
WHERE workflow_definition_id = 1
  AND status_code = 'closed';
