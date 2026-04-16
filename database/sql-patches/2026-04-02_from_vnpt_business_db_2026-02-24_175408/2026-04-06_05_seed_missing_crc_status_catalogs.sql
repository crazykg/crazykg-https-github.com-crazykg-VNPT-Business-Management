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
SELECT
  1,
  src.status_code,
  src.status_name_vi,
  src.group_code,
  src.group_label,
  src.table_name,
  src.handler_field,
  src.list_columns_json,
  JSON_ARRAY(
    JSON_OBJECT('name', 'received_at', 'type', 'datetime', 'label', 'Ngày bắt đầu', 'required', FALSE),
    JSON_OBJECT('name', 'completed_at', 'type', 'datetime', 'label', 'Ngày kết thúc', 'required', FALSE),
    JSON_OBJECT('name', 'extended_at', 'type', 'datetime', 'label', 'Ngày gia hạn', 'required', FALSE),
    JSON_OBJECT('name', 'progress_percent', 'type', 'number', 'label', 'Tiến độ phần trăm', 'required', FALSE),
    JSON_OBJECT('name', 'from_user_id', 'type', 'user_select', 'label', 'Người chuyển', 'required', FALSE),
    JSON_OBJECT('name', 'to_user_id', 'type', 'user_select', 'label', 'Người nhận', 'required', FALSE),
    JSON_OBJECT('name', 'notes', 'type', 'textarea', 'label', 'Ghi chú', 'required', FALSE)
  ),
  src.ui_meta_json,
  src.storage_mode,
  src.sort_order,
  1,
  NOW(),
  NOW()
FROM (
  SELECT
    'new_intake' AS status_code,
    'Tiếp nhận' AS status_name_vi,
    'intake' AS group_code,
    'Tiếp nhận' AS group_label,
    'customer_request_cases' AS table_name,
    'to_user_id' AS handler_field,
    JSON_ARRAY() AS list_columns_json,
    JSON_OBJECT('owner_mode', 'receiver', 'bucket_code', 'new', 'color_token', 'sky') AS ui_meta_json,
    'master' AS storage_mode,
    10 AS sort_order

  UNION ALL SELECT
    'assigned_to_receiver',
    'Giao R thực hiện',
    'intake',
    'Tiếp nhận',
    'customer_request_assigned_to_receiver',
    'to_user_id',
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
      JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
      JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'received_at', 'label', 'Ngày tiếp nhận')
    ),
    JSON_OBJECT(
      'owner_mode', 'receiver',
      'bucket_code', 'pending',
      'color_token', 'amber',
      'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'R nhận xử lý')
    ),
    'detail',
    12

  UNION ALL SELECT
    'receiver_in_progress',
    'R đang thực hiện',
    'processing',
    'Xử lý',
    'customer_request_receiver_in_progress',
    'to_user_id',
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành'),
      JSON_OBJECT('key', 'progress_percent', 'label', 'Tiến độ')
    ),
    JSON_OBJECT('owner_mode', 'receiver', 'bucket_code', 'active', 'color_token', 'blue'),
    'detail',
    13

  UNION ALL SELECT
    'pending_dispatch',
    'Chờ PM điều phối',
    'intake',
    'Tiếp nhận',
    'customer_request_pending_dispatch',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'dispatcher', 'bucket_code', 'pending', 'color_token', 'amber'),
    'detail',
    15

  UNION ALL SELECT
    'dispatched',
    'Đã phân công',
    NULL,
    NULL,
    'customer_request_dispatched',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT(),
    'detail',
    18

  UNION ALL SELECT
    'waiting_customer_feedback',
    'Chờ khách hàng cung cấp thông tin',
    'processing',
    'Xử lý',
    'customer_request_waiting_customer_feedbacks',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'receiver', 'bucket_code', 'waiting', 'color_token', 'violet'),
    'detail',
    20

  UNION ALL SELECT
    'in_progress',
    'R Đang thực hiện',
    'processing',
    'Xử lý',
    'customer_request_in_progress',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'active', 'color_token', 'blue'),
    'detail',
    30

  UNION ALL SELECT
    'coding',
    'Lập trình',
    'processing',
    'Xử lý',
    'customer_request_coding',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'active', 'color_token', 'cyan'),
    'detail',
    35

  UNION ALL SELECT
    'coding_in_progress',
    'Dev đang thực hiện',
    'processing',
    'Xử lý',
    'customer_request_coding_in_progress',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'coding_active', 'color_token', 'violet'),
    'detail',
    36

  UNION ALL SELECT
    'coding_suspended',
    'Dev tạm ngưng',
    'processing',
    'Xử lý',
    'customer_request_coding_suspended',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'coding_paused', 'color_token', 'fuchsia'),
    'detail',
    37

  UNION ALL SELECT
    'dms_transfer',
    'Chuyển DMS',
    'processing',
    'Xử lý',
    'customer_request_dms_transfer',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'active', 'color_token', 'indigo'),
    'detail',
    38

  UNION ALL SELECT
    'dms_task_created',
    'Tạo task',
    'processing',
    'Xử lý',
    'customer_request_dms_task_created',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'dispatcher', 'bucket_code', 'dms_task', 'color_token', 'lime'),
    'detail',
    39

  UNION ALL SELECT
    'dms_in_progress',
    'DMS Đang thực hiện',
    'processing',
    'Xử lý',
    'customer_request_dms_in_progress',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'dms_active', 'color_token', 'lime'),
    'detail',
    39

  UNION ALL SELECT
    'dms_suspended',
    'DMS tạm ngưng',
    'processing',
    'Xử lý',
    'customer_request_dms_suspended',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'dms_paused', 'color_token', 'emerald'),
    'detail',
    39

  UNION ALL SELECT
    'not_executed',
    'Không tiếp nhận',
    'closure',
    'Kết thúc',
    'customer_request_not_executed',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('terminal', TRUE, 'owner_mode', 'dispatcher', 'bucket_code', 'done', 'color_token', 'slate'),
    'detail',
    40

  UNION ALL SELECT
    'completed',
    'Hoàn thành',
    'closure',
    'Kết thúc',
    'customer_request_completed',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('terminal', TRUE, 'owner_mode', 'performer', 'bucket_code', 'done', 'color_token', 'emerald'),
    'detail',
    50

  UNION ALL SELECT
    'customer_notified',
    'Thông báo khách hàng',
    'closure',
    'Kết thúc',
    'customer_request_customer_notified',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('terminal', TRUE, 'owner_mode', 'dispatcher', 'bucket_code', 'done', 'color_token', 'green'),
    'detail',
    60

  UNION ALL SELECT
    'returned_to_manager',
    'Giao PM/Trả YC cho PM',
    'analysis',
    'Phân tích',
    'customer_request_returned_to_manager',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'dispatcher', 'bucket_code', 'analysis', 'color_token', 'rose'),
    'detail',
    70

  UNION ALL SELECT
    'analysis',
    'Chuyển BA Phân tích',
    'analysis',
    'Phân tích',
    'customer_request_analysis',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'analysis', 'color_token', 'fuchsia'),
    'detail',
    80

  UNION ALL SELECT
    'analysis_completed',
    'Chuyển BA Phân tích hoàn thành',
    'analysis',
    'Phân tích',
    'customer_request_analysis_completed',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'analysis_done', 'color_token', 'indigo'),
    'detail',
    81

  UNION ALL SELECT
    'analysis_suspended',
    'Chuyển BA Phân tích tạm ngưng',
    'analysis',
    'Phân tích',
    'customer_request_analysis_suspended',
    'to_user_id',
    JSON_ARRAY(),
    JSON_OBJECT('owner_mode', 'performer', 'bucket_code', 'analysis_paused', 'color_token', 'fuchsia'),
    'detail',
    82
) AS src
LEFT JOIN `customer_request_status_catalogs` AS existing
  ON existing.workflow_definition_id = 1
 AND existing.status_code = src.status_code
WHERE existing.id IS NULL;

COMMIT;
