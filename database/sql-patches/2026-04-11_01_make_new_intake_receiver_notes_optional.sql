SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-11_01_make_new_intake_receiver_notes_optional.sql
-- Mục tiêu:
--   Cho phép trạng thái `new_intake` cập nhật khi để trống:
--   - to_user_id (Người nhận)
--   - notes (Ghi chú)
-- ============================================================================

UPDATE customer_request_status_catalogs
SET form_fields_json = JSON_ARRAY(
    JSON_OBJECT('name', 'received_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'completed_at', 'label', 'Ngày kết thúc', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'extended_at', 'label', 'Ngày gia hạn', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ phần trăm', 'type', 'number', 'required', FALSE),
    JSON_OBJECT('name', 'from_user_id', 'label', 'Người chuyển', 'type', 'user_select', 'required', FALSE),
    JSON_OBJECT('name', 'to_user_id', 'label', 'Người nhận', 'type', 'user_select', 'required', FALSE),
    JSON_OBJECT('name', 'notes', 'label', 'Ghi chú', 'type', 'textarea', 'required', FALSE)
),
    updated_at = NOW()
WHERE status_code = 'new_intake';

COMMIT;

-- Verify
SELECT
    id,
    workflow_definition_id,
    status_code,
    status_name_vi,
    JSON_PRETTY(form_fields_json) AS form_fields_json
FROM customer_request_status_catalogs
WHERE status_code = 'new_intake'
ORDER BY workflow_definition_id, id;
