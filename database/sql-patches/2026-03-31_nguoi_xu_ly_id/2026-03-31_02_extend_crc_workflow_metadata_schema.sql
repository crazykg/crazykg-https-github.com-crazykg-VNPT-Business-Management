-- ============================================================================
-- CRC workflow metadata schema patch
-- Tương đương migration:
--   - 2026_03_31_120000_extend_crc_workflow_metadata_schema.php
-- Forward-only, idempotent ở mức hợp lý cho MySQL 8
-- ============================================================================

-- 1) customer_request_cases.workflow_definition_id
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_cases ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL AFTER nguoi_xu_ly_id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND INDEX_NAME = 'idx_crc_workflow_definition_id'
);
SET @sql := IF(
  @has_idx = 0,
  "ALTER TABLE customer_request_cases ADD INDEX idx_crc_workflow_definition_id (workflow_definition_id)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Mở rộng customer_request_status_catalogs
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL AFTER id",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'group_code'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN group_code VARCHAR(80) NULL AFTER status_name_vi",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'group_label'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN group_label VARCHAR(255) NULL AFTER group_code",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'list_columns_json'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN list_columns_json JSON NULL AFTER handler_field",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'form_fields_json'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN form_fields_json JSON NULL AFTER list_columns_json",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'ui_meta_json'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN ui_meta_json JSON NULL AFTER form_fields_json",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_catalogs' AND COLUMN_NAME = 'storage_mode'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN storage_mode VARCHAR(40) NULL AFTER ui_meta_json",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Mở rộng customer_request_status_transitions
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_transitions' AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_transitions ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL FIRST",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_request_status_transitions' AND COLUMN_NAME = 'transition_meta_json'
);
SET @sql := IF(@has_col = 0,
  "ALTER TABLE customer_request_status_transitions ADD COLUMN transition_meta_json JSON NULL AFTER notes",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Tạo bảng customer_request_workflow_metadata
CREATE TABLE IF NOT EXISTS customer_request_workflow_metadata (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  workflow_definition_id BIGINT UNSIGNED NOT NULL,
  master_fields_json JSON NULL,
  catalog_ui_meta_json JSON NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crc_workflow_metadata_workflow_id (workflow_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Metadata runtime cap workflow cho CRC';

-- 5) Resolve workflow_definition_id mặc định cho process_type = customer_request
SET @default_workflow_id := (
  SELECT id
  FROM workflow_definitions
  WHERE process_type = 'customer_request'
    AND deleted_at IS NULL
    AND is_default = 1
  ORDER BY id DESC
  LIMIT 1
);

SET @active_workflow_id := (
  SELECT id
  FROM workflow_definitions
  WHERE process_type = 'customer_request'
    AND deleted_at IS NULL
    AND is_active = 1
  ORDER BY id DESC
  LIMIT 1
);

SET @workflow_id := COALESCE(@default_workflow_id, @active_workflow_id);

-- 6) Backfill workflow_definition_id
UPDATE customer_request_cases
SET workflow_definition_id = @workflow_id,
    updated_at = NOW()
WHERE @workflow_id IS NOT NULL
  AND workflow_definition_id IS NULL;

UPDATE customer_request_status_catalogs
SET workflow_definition_id = @workflow_id,
    updated_at = NOW()
WHERE @workflow_id IS NOT NULL
  AND workflow_definition_id IS NULL;

UPDATE customer_request_status_transitions
SET workflow_definition_id = @workflow_id,
    updated_at = NOW()
WHERE @workflow_id IS NOT NULL
  AND workflow_definition_id IS NULL;

-- 7) Seed customer_request_workflow_metadata từ registry hiện hành
INSERT INTO customer_request_workflow_metadata (
  workflow_definition_id,
  master_fields_json,
  catalog_ui_meta_json,
  created_at,
  updated_at
)
SELECT
  @workflow_id,
  JSON_ARRAY(
    JSON_OBJECT('name', 'project_item_id', 'label', 'Khách hàng | Dự án | Sản phẩm', 'type', 'project_item_select', 'required', FALSE),
    JSON_OBJECT('name', 'summary', 'label', 'Nội dung yêu cầu', 'type', 'text', 'required', TRUE),
    JSON_OBJECT('name', 'project_id', 'label', 'Dự án', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'product_id', 'label', 'Sản phẩm', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'customer_id', 'label', 'Khách hàng', 'type', 'customer_select', 'required', FALSE),
    JSON_OBJECT('name', 'customer_personnel_id', 'label', 'Người yêu cầu', 'type', 'customer_personnel_select', 'required', FALSE),
    JSON_OBJECT('name', 'support_service_group_id', 'label', 'Kênh tiếp nhận', 'type', 'support_group_select', 'required', FALSE),
    JSON_OBJECT('name', 'source_channel', 'label', 'Kênh khác', 'type', 'text', 'required', FALSE),
    JSON_OBJECT('name', 'priority', 'label', 'Độ ưu tiên', 'type', 'priority', 'required', FALSE),
    JSON_OBJECT('name', 'description', 'label', 'Mô tả chi tiết', 'type', 'textarea', 'required', FALSE)
  ),
  JSON_OBJECT(
    'groups', JSON_ARRAY(
      JSON_OBJECT('group_code', 'intake', 'group_label', 'Tiếp nhận'),
      JSON_OBJECT('group_code', 'processing', 'group_label', 'Xử lý'),
      JSON_OBJECT('group_code', 'analysis', 'group_label', 'Phân tích'),
      JSON_OBJECT('group_code', 'closure', 'group_label', 'Kết thúc')
    )
  ),
  NOW(),
  NOW()
WHERE @workflow_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  master_fields_json = VALUES(master_fields_json),
  catalog_ui_meta_json = VALUES(catalog_ui_meta_json),
  updated_at = VALUES(updated_at);

-- 8) Seed / update metadata cho status catalog
UPDATE customer_request_status_catalogs
SET
  group_code = CASE status_code
    WHEN 'new_intake' THEN 'intake'
    WHEN 'pending_dispatch' THEN 'intake'
    WHEN 'assigned_to_receiver' THEN 'intake'
    WHEN 'receiver_in_progress' THEN 'processing'
    WHEN 'waiting_customer_feedback' THEN 'processing'
    WHEN 'analysis' THEN 'analysis'
    WHEN 'returned_to_manager' THEN 'analysis'
    WHEN 'in_progress' THEN 'processing'
    WHEN 'coding' THEN 'processing'
    WHEN 'dms_transfer' THEN 'processing'
    WHEN 'completed' THEN 'closure'
    WHEN 'customer_notified' THEN 'closure'
    WHEN 'not_executed' THEN 'closure'
    ELSE group_code
  END,
  group_label = CASE status_code
    WHEN 'new_intake' THEN 'Tiếp nhận'
    WHEN 'pending_dispatch' THEN 'Tiếp nhận'
    WHEN 'assigned_to_receiver' THEN 'Tiếp nhận'
    WHEN 'receiver_in_progress' THEN 'Xử lý'
    WHEN 'waiting_customer_feedback' THEN 'Xử lý'
    WHEN 'analysis' THEN 'Phân tích'
    WHEN 'returned_to_manager' THEN 'Phân tích'
    WHEN 'in_progress' THEN 'Xử lý'
    WHEN 'coding' THEN 'Xử lý'
    WHEN 'dms_transfer' THEN 'Xử lý'
    WHEN 'completed' THEN 'Kết thúc'
    WHEN 'customer_notified' THEN 'Kết thúc'
    WHEN 'not_executed' THEN 'Kết thúc'
    ELSE group_label
  END,
  storage_mode = CASE
    WHEN table_name = 'customer_request_cases' THEN 'master'
    ELSE 'detail'
  END,
  workflow_definition_id = COALESCE(workflow_definition_id, @workflow_id),
  updated_at = NOW()
WHERE @workflow_id IS NULL OR workflow_definition_id = @workflow_id OR workflow_definition_id IS NULL;

UPDATE customer_request_status_catalogs
SET
  list_columns_json = CASE status_code
    WHEN 'assigned_to_receiver' THEN JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
      JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
      JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'received_at', 'label', 'Ngày tiếp nhận')
    )
    WHEN 'receiver_in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành'),
      JSON_OBJECT('key', 'progress_percent', 'label', 'Tiến độ')
    )
    ELSE COALESCE(list_columns_json, JSON_ARRAY())
  END,
  form_fields_json = CASE status_code
    WHEN 'assigned_to_receiver' THEN JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    )
    WHEN 'receiver_in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ', 'type', 'number', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    )
    ELSE COALESCE(form_fields_json, JSON_ARRAY())
  END,
  ui_meta_json = CASE status_code
    WHEN 'new_intake' THEN JSON_OBJECT('color_token', 'sky', 'bucket_code', 'new', 'owner_mode', 'receiver')
    WHEN 'pending_dispatch' THEN JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'dispatcher')
    WHEN 'assigned_to_receiver' THEN JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'receiver', 'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'R nhận xử lý'))
    WHEN 'receiver_in_progress' THEN JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'receiver')
    WHEN 'waiting_customer_feedback' THEN JSON_OBJECT('color_token', 'violet', 'bucket_code', 'waiting', 'owner_mode', 'receiver')
    WHEN 'analysis' THEN JSON_OBJECT('color_token', 'fuchsia', 'bucket_code', 'analysis', 'owner_mode', 'performer')
    WHEN 'returned_to_manager' THEN JSON_OBJECT('color_token', 'rose', 'bucket_code', 'analysis', 'owner_mode', 'dispatcher')
    WHEN 'in_progress' THEN JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'coding' THEN JSON_OBJECT('color_token', 'cyan', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'dms_transfer' THEN JSON_OBJECT('color_token', 'indigo', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'completed' THEN JSON_OBJECT('color_token', 'emerald', 'bucket_code', 'done', 'owner_mode', 'performer', 'terminal', TRUE)
    WHEN 'customer_notified' THEN JSON_OBJECT('color_token', 'green', 'bucket_code', 'done', 'owner_mode', 'dispatcher', 'terminal', TRUE)
    WHEN 'not_executed' THEN JSON_OBJECT('color_token', 'slate', 'bucket_code', 'done', 'owner_mode', 'dispatcher', 'terminal', TRUE)
    ELSE COALESCE(ui_meta_json, JSON_OBJECT())
  END,
  updated_at = NOW()
WHERE @workflow_id IS NULL OR workflow_definition_id = @workflow_id OR workflow_definition_id IS NULL;

-- 9) Seed status rows còn thiếu cho workflow hiện tại
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
  seed.status_code,
  seed.status_name_vi,
  seed.group_code,
  seed.group_label,
  seed.table_name,
  seed.handler_field,
  seed.list_columns_json,
  seed.form_fields_json,
  seed.ui_meta_json,
  seed.storage_mode,
  seed.sort_order,
  1,
  NOW(),
  NOW()
FROM (
  SELECT
    'assigned_to_receiver' AS status_code,
    'Giao R thực hiện' AS status_name_vi,
    'intake' AS group_code,
    'Tiếp nhận' AS group_label,
    'customer_request_assigned_to_receiver' AS table_name,
    'receiver_user_id' AS handler_field,
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
      JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
      JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'received_at', 'label', 'Ngày tiếp nhận')
    ) AS list_columns_json,
    JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    ) AS form_fields_json,
    JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'receiver', 'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'R nhận xử lý')) AS ui_meta_json,
    'detail' AS storage_mode,
    12 AS sort_order

    UNION ALL

    SELECT
      'receiver_in_progress',
      'R đang thực hiện',
      'processing',
      'Xử lý',
      'customer_request_receiver_in_progress',
      'receiver_user_id',
      JSON_ARRAY(
        JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
        JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
        JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
        JSON_OBJECT('key', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành'),
        JSON_OBJECT('key', 'progress_percent', 'label', 'Tiến độ')
      ),
      JSON_ARRAY(
        JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
        JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ', 'type', 'number', 'required', FALSE),
        JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
      ),
      JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'receiver'),
      'detail',
      13
) AS seed
LEFT JOIN customer_request_status_catalogs c
  ON c.status_code = seed.status_code
 AND ((@workflow_id IS NULL AND c.workflow_definition_id IS NULL) OR c.workflow_definition_id = @workflow_id)
WHERE @workflow_id IS NOT NULL
  AND c.id IS NULL;

-- 10) Seed transition_meta_json tối thiểu cho workflow hiện tại
UPDATE customer_request_status_transitions
SET transition_meta_json = CASE
    WHEN from_status_code = 'assigned_to_receiver' AND to_status_code = 'receiver_in_progress' AND direction = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_accept', 'decision_outcome_code', 'accept')
    WHEN from_status_code = 'receiver_in_progress' AND to_status_code = 'analysis' AND direction = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_route', 'decision_outcome_code', 'need_analysis')
    WHEN from_status_code = 'receiver_in_progress' AND to_status_code = 'in_progress' AND direction = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_route', 'decision_outcome_code', 'direct_execute')
    WHEN from_status_code = 'analysis' AND to_status_code = 'returned_to_manager' AND direction = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'analysis_review', 'decision_outcome_code', 'return_manager')
    WHEN from_status_code = 'analysis' AND to_status_code = 'in_progress' AND direction = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'analysis_review', 'decision_outcome_code', 'approve_execute')
    ELSE COALESCE(transition_meta_json, JSON_OBJECT())
  END,
  updated_at = NOW()
WHERE @workflow_id IS NULL OR workflow_definition_id = @workflow_id OR workflow_definition_id IS NULL;

-- 11) Chuẩn hoá indexes
SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'customer_request_status_catalogs_status_code_unique'
);
SET @sql := IF(@has_old_idx > 0,
  "ALTER TABLE customer_request_status_catalogs DROP INDEX customer_request_status_catalogs_status_code_unique",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'uq_customer_request_status_catalogs_workflow_status'
);
SET @sql := IF(@has_idx = 0,
  "CREATE UNIQUE INDEX uq_customer_request_status_catalogs_workflow_status ON customer_request_status_catalogs (workflow_definition_id, status_code)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'idx_crc_status_catalogs_workflow_group'
);
SET @sql := IF(@has_idx = 0,
  "CREATE INDEX idx_crc_status_catalogs_workflow_group ON customer_request_status_catalogs (workflow_definition_id, group_code, sort_order)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'uq_customer_request_status_transitions'
);
SET @sql := IF(@has_old_idx > 0,
  "ALTER TABLE customer_request_status_transitions DROP INDEX uq_customer_request_status_transitions",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'uq_crc_status_transitions_workflow'
);
SET @sql := IF(@has_idx = 0,
  "CREATE UNIQUE INDEX uq_crc_status_transitions_workflow ON customer_request_status_transitions (workflow_definition_id, from_status_code, to_status_code, direction)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'idx_customer_request_status_transitions_from'
);
SET @sql := IF(@has_old_idx > 0,
  "ALTER TABLE customer_request_status_transitions DROP INDEX idx_customer_request_status_transitions_from",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'idx_customer_request_status_transitions_workflow_from'
);
SET @sql := IF(@has_idx = 0,
  "CREATE INDEX idx_customer_request_status_transitions_workflow_from ON customer_request_status_transitions (workflow_definition_id, from_status_code, is_active, sort_order)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 12) Verify nhanh
SELECT id, code, is_default, is_active
FROM workflow_definitions
WHERE process_type = 'customer_request'
ORDER BY id DESC;

SHOW COLUMNS FROM customer_request_status_catalogs LIKE 'workflow_definition_id';
SHOW COLUMNS FROM customer_request_status_transitions LIKE 'transition_meta_json';
SHOW INDEX FROM customer_request_status_catalogs;
SHOW INDEX FROM customer_request_status_transitions;
