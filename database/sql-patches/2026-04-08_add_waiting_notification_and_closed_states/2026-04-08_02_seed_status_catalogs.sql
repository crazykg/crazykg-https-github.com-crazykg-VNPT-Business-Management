-- 2026-04-08_02_seed_status_catalogs.sql
-- Seed 2 trạng thái mới vào customer_request_status_catalogs
-- Date: 2026-04-08
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Thêm 2 status mới vào catalog
-- ============================================================================

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `customer_request_status_catalogs` (
  `workflow_definition_id`,
  `status_code`,
  `status_name_vi`,
  `group_code`,
  `group_label`,
  `table_name`,
  `handler_field`,
  `list_columns_json`,
  `form_fields_json`,
  `ui_meta_json`,
  `storage_mode`,
  `sort_order`,
  `is_active`,
  `created_at`,
  `updated_at`
)
SELECT src.* FROM (
  SELECT
    1 AS workflow_definition_id,
    'waiting_notification' AS status_code,
    'Chờ thông báo khách hàng' AS status_name_vi,
    'closure' AS group_code,
    'Kết thúc' AS group_label,
    'customer_request_waiting_notification' AS table_name,
    'notified_by_user_id' AS handler_field,
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'notified_by_user_id', 'label', 'Người phụ trách'),
      JSON_OBJECT('key', 'notification_channel', 'label', 'Kênh thông báo'),
      JSON_OBJECT('key', 'planned_notification_at', 'label', 'Dự kiến thông báo')
    ) AS list_columns_json,
    JSON_ARRAY(
      JSON_OBJECT('name', 'notified_by_user_id', 'label', 'Người phụ trách thông báo', 'type', 'user_select', 'required', TRUE),
      JSON_OBJECT('name', 'notification_channel', 'label', 'Kênh thông báo', 'type', 'select', 'required', FALSE),
      JSON_OBJECT('name', 'notification_content', 'label', 'Nội dung thông báo', 'type', 'textarea', 'required', FALSE),
      JSON_OBJECT('name', 'planned_notification_at', 'label', 'Dự kiến ngày thông báo', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'notes', 'label', 'Ghi chú', 'type', 'textarea', 'required', FALSE)
    ) AS form_fields_json,
    JSON_OBJECT(
      'owner_mode', 'dispatcher',
      'bucket_code', 'pending_notification',
      'color_token', 'yellow',
      'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'Thông báo khách hàng')
    ) AS ui_meta_json,
    'detail' AS storage_mode,
    55 AS sort_order,
    1 AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at

  UNION ALL

  SELECT
    1,
    'closed',
    'Đóng yêu cầu',
    'closure',
    'Kết thúc',
    'customer_request_closed',
    'closed_by_user_id',
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'closed_by_user_id', 'label', 'Người đóng'),
      JSON_OBJECT('key', 'closed_at', 'label', 'Ngày đóng'),
      JSON_OBJECT('key', 'customer_satisfaction', 'label', 'Mức độ hài lòng')
    ),
    JSON_ARRAY(
      JSON_OBJECT('name', 'closed_by_user_id', 'label', 'Người đóng yêu cầu', 'type', 'user_select', 'required', TRUE),
      JSON_OBJECT('name', 'closed_at', 'label', 'Ngày đóng', 'type', 'datetime', 'required', TRUE),
      JSON_OBJECT('name', 'closure_reason', 'label', 'Lý do đóng', 'type', 'select', 'required', TRUE),
      JSON_OBJECT('name', 'closure_notes', 'label', 'Ghi chú đóng', 'type', 'textarea', 'required', FALSE),
      JSON_OBJECT('name', 'customer_satisfaction', 'label', 'Mức độ hài lòng', 'type', 'select', 'required', FALSE)
    ),
    JSON_OBJECT(
      'terminal', TRUE,
      'owner_mode', 'dispatcher',
      'bucket_code', 'closed',
      'color_token', 'gray'
    ),
    'detail',
    65,
    1,
    NOW(),
    NOW()
) AS src
LEFT JOIN `customer_request_status_catalogs` AS existing
  ON existing.workflow_definition_id = src.workflow_definition_id
 AND existing.status_code = src.status_code
WHERE existing.id IS NULL;

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT
  id,
  status_code,
  status_name_vi,
  group_code,
  table_name,
  sort_order,
  is_active
FROM `customer_request_status_catalogs`
WHERE status_code IN ('waiting_notification', 'closed')
ORDER BY sort_order;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
