-- ============================================================================
-- Add dispatched_at column to customer_request_pending_dispatch table
-- Tương đương migration: 2026_04_01_085224_add_dispatched_at_to_pending_dispatch_table.php
-- Forward-only, idempotent cho MySQL 8
-- ============================================================================

-- 1) Thêm cột dispatched_at nếu chưa tồn tại
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_pending_dispatch'
    AND COLUMN_NAME = 'dispatched_at'
);

SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_pending_dispatch ADD COLUMN dispatched_at DATETIME NULL COMMENT 'Ngày điều phối' AFTER dispatch_note",
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Verify
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'customer_request_pending_dispatch'
ORDER BY ORDINAL_POSITION;
