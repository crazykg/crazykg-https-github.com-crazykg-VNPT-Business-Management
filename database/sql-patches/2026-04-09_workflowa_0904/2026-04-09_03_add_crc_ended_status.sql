SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-09_03_add_crc_ended_status.sql
-- Mục tiêu: bổ sung trạng thái "Kết thúc" (ended) và transition closed -> ended
-- ============================================================================

SET @workflow_id := 1;

-- 1) Insert/re-activate status `ended`
INSERT INTO customer_request_status_catalogs (
  workflow_definition_id,
  status_code,
  status_name_vi,
  group_code,
  group_label,
  table_name,
  handler_field,
  list_columns_json,
  form_fields_json,
  ui_meta_json,
  storage_mode,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  @workflow_id,
  'ended',
  'Kết thúc',
  'closure',
  'Đóng/Kết thúc',
  'customer_request_closed',
  'closed_by_user_id',
  JSON_ARRAY(
    JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
    JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
    JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
    JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
    JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
    JSON_OBJECT('key', 'closed_by_user_id', 'label', 'Người đóng'),
    JSON_OBJECT('key', 'closed_at', 'label', 'Ngày đóng')
  ),
  JSON_ARRAY(
    JSON_OBJECT('name', 'received_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'completed_at', 'label', 'Ngày kết thúc', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'extended_at', 'label', 'Ngày gia hạn', 'type', 'datetime', 'required', FALSE),
    JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ phần trăm', 'type', 'number', 'required', TRUE),
    JSON_OBJECT('name', 'from_user_id', 'label', 'Người chuyển', 'type', 'user_select', 'required', FALSE),
    JSON_OBJECT('name', 'to_user_id', 'label', 'Người nhận', 'type', 'user_select', 'required', TRUE),
    JSON_OBJECT('name', 'notes', 'label', 'Ghi chú', 'type', 'textarea', 'required', TRUE)
  ),
  JSON_OBJECT('is_terminal', TRUE),
  'detail',
  66,
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_request_status_catalogs
  WHERE workflow_definition_id = @workflow_id
    AND status_code = 'ended'
);

UPDATE customer_request_status_catalogs
SET is_active = 1,
    status_name_vi = 'Kết thúc',
    group_code = 'closure',
    group_label = 'Đóng/Kết thúc',
    table_name = 'customer_request_closed',
    storage_mode = 'detail',
    sort_order = 66,
    updated_at = NOW()
WHERE workflow_definition_id = @workflow_id
  AND status_code = 'ended';

-- 2) Ensure transition closed -> ended
INSERT INTO customer_request_status_transitions (
  workflow_definition_id,
  from_status_code,
  to_status_code,
  process_name_vi,
  allowed_roles,
  transition_config,
  direction,
  is_default,
  is_active,
  sort_order,
  notes,
  transition_meta_json,
  created_at,
  updated_at
)
SELECT
  @workflow_id,
  'closed',
  'ended',
  'Kết thúc',
  JSON_ARRAY('all'),
  NULL,
  'forward',
  1,
  1,
  5,
  '0904:add-ended',
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'closed'
    AND to_status_code = 'ended'
);

UPDATE customer_request_status_transitions
SET is_active = 1,
    process_name_vi = 'Kết thúc',
    allowed_roles = JSON_ARRAY('all'),
    sort_order = 5,
    updated_at = NOW(),
    notes = '0904:reactivate-ended'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'closed'
  AND to_status_code = 'ended';

COMMIT;

-- Verify
SELECT id, status_code, status_name_vi, is_active, sort_order
FROM customer_request_status_catalogs
WHERE workflow_definition_id = @workflow_id
  AND status_code IN ('closed', 'ended')
ORDER BY sort_order, id;

SELECT id, from_status_code, to_status_code, process_name_vi, is_active, sort_order
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'closed'
ORDER BY is_active DESC, sort_order, id;
