-- ============================================================================
-- Fix pending_dispatch metadata - dispatch_notes -> dispatch_note
-- Sửa lỗi tên field không khớp với cột DB
-- ============================================================================

-- 1) Cập nhật metadata form_fields_json cho pending_dispatch
UPDATE customer_request_status_catalogs
SET
  form_fields_json = JSON_ARRAY(
    JSON_OBJECT('name', 'dispatcher_user_id', 'label', 'Người điều phối (PM)', 'type', 'user_select', 'required', FALSE),
    JSON_OBJECT('name', 'dispatched_at', 'label', 'Ngày điều phối', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'dispatch_note', 'label', 'Ghi chú điều phối', 'type', 'textarea', 'required', FALSE)
  ),
  updated_at = NOW()
WHERE status_code = 'pending_dispatch';

-- 2) Verify
SELECT status_code, CAST(form_fields_json AS CHAR(4000) CHARACTER SET utf8mb4) AS form_fields_json
FROM customer_request_status_catalogs
WHERE status_code = 'pending_dispatch';
