-- ============================================================================
-- CRC owner sync patch
-- Gộp nội dung tương đương 2 migration:
--   - 2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs.php
--   - 2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table.php
-- ============================================================================

-- 1) Thêm customer_request_status_catalogs.handler_field nếu chưa có
SET @has_handler_field := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'handler_field'
);
SET @sql := IF(
  @has_handler_field = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN handler_field VARCHAR(120) NULL COMMENT 'Ten field user dai dien nguoi xu ly hien tai' AFTER table_name",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Seed handler_field theo status
UPDATE customer_request_status_catalogs
SET handler_field = CASE status_code
  WHEN 'new_intake' THEN 'received_by_user_id'
  WHEN 'pending_dispatch' THEN 'dispatcher_user_id'
  WHEN 'assigned_to_receiver' THEN 'receiver_user_id'
  WHEN 'receiver_in_progress' THEN 'receiver_user_id'
  WHEN 'in_progress' THEN 'performer_user_id'
  WHEN 'analysis' THEN 'performer_user_id'
  WHEN 'coding' THEN 'developer_user_id'
  WHEN 'dms_transfer' THEN 'dms_contact_user_id'
  WHEN 'completed' THEN 'completed_by_user_id'
  WHEN 'customer_notified' THEN 'notified_by_user_id'
  WHEN 'returned_to_manager' THEN 'returned_by_user_id'
  WHEN 'not_executed' THEN 'decision_by_user_id'
  ELSE handler_field
END,
updated_at = NOW()
WHERE status_code IN (
  'new_intake',
  'pending_dispatch',
  'assigned_to_receiver',
  'receiver_in_progress',
  'in_progress',
  'analysis',
  'coding',
  'dms_transfer',
  'completed',
  'customer_notified',
  'returned_to_manager',
  'not_executed'
);

-- 3) Thêm customer_request_cases.nguoi_xu_ly_id nếu chưa có
SET @has_nguoi_xu_ly_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND COLUMN_NAME = 'nguoi_xu_ly_id'
);
SET @sql := IF(
  @has_nguoi_xu_ly_id = 0,
  "ALTER TABLE customer_request_cases ADD COLUMN nguoi_xu_ly_id BIGINT UNSIGNED NULL COMMENT 'Nguoi xu ly hien tai cua yeu cau' AFTER performer_user_id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Backfill nguoi_xu_ly_id theo status hiện tại
UPDATE customer_request_cases crc
LEFT JOIN customer_request_status_instances si
  ON si.request_case_id = crc.id
 AND si.is_current = 1
LEFT JOIN customer_request_assigned_to_receiver ar
  ON ar.request_case_id = crc.id
LEFT JOIN customer_request_receiver_in_progress rip
  ON rip.request_case_id = crc.id
LEFT JOIN customer_request_coding coding
  ON coding.status_instance_id = si.id
LEFT JOIN customer_request_dms_transfer dms
  ON dms.status_instance_id = si.id
LEFT JOIN customer_request_completed completed
  ON completed.status_instance_id = si.id
LEFT JOIN customer_request_customer_notified notified
  ON notified.status_instance_id = si.id
LEFT JOIN customer_request_returned_to_manager returned
  ON returned.status_instance_id = si.id
LEFT JOIN customer_request_not_executed ne
  ON ne.status_instance_id = si.id
SET crc.nguoi_xu_ly_id = CASE
  WHEN crc.current_status_code = 'new_intake' THEN crc.received_by_user_id
  WHEN crc.current_status_code = 'pending_dispatch' THEN crc.dispatcher_user_id
  WHEN crc.current_status_code IN ('assigned_to_receiver', 'receiver_in_progress') THEN COALESCE(rip.receiver_user_id, ar.receiver_user_id, crc.performer_user_id, crc.received_by_user_id)
  WHEN crc.current_status_code IN ('in_progress', 'analysis') THEN crc.performer_user_id
  WHEN crc.current_status_code = 'coding' THEN COALESCE(coding.developer_user_id, crc.performer_user_id)
  WHEN crc.current_status_code = 'dms_transfer' THEN dms.dms_contact_user_id
  WHEN crc.current_status_code = 'completed' THEN COALESCE(completed.completed_by_user_id, crc.performer_user_id)
  WHEN crc.current_status_code = 'customer_notified' THEN notified.notified_by_user_id
  WHEN crc.current_status_code = 'returned_to_manager' THEN returned.returned_by_user_id
  WHEN crc.current_status_code = 'not_executed' THEN ne.decision_by_user_id
  ELSE COALESCE(crc.performer_user_id, crc.dispatcher_user_id, crc.received_by_user_id)
END;

-- 5) Verify nhanh
SELECT status_code, handler_field
FROM customer_request_status_catalogs
WHERE status_code IN (
  'new_intake',
  'pending_dispatch',
  'assigned_to_receiver',
  'receiver_in_progress',
  'in_progress',
  'analysis',
  'coding',
  'dms_transfer',
  'completed',
  'customer_notified',
  'returned_to_manager',
  'not_executed'
)
ORDER BY status_code;

SELECT id, current_status_code, nguoi_xu_ly_id
FROM customer_request_cases
WHERE id IN (12, 13)
ORDER BY id;

SHOW COLUMNS FROM customer_request_cases LIKE 'nguoi_xu_ly_id';
SHOW COLUMNS FROM customer_request_status_catalogs LIKE 'handler_field';
