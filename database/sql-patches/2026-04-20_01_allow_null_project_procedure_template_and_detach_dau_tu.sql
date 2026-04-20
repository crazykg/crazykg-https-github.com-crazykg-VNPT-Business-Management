SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-20_01_allow_null_project_procedure_template_and_detach_dau_tu.sql
-- Mục tiêu:
--   - Cho phép project_procedures.template_id nhận NULL
--   - Gỡ liên kết 4 procedure đang dùng template DAU_TU (id=1)
--   - Forward-only, idempotent cho MySQL 8
-- ============================================================================

SET @table_schema := DATABASE();

-- 1) Cho phép cột template_id nhận NULL nếu hiện đang NOT NULL
SET @is_nullable := (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @table_schema
    AND TABLE_NAME = 'project_procedures'
    AND COLUMN_NAME = 'template_id'
  LIMIT 1
);

SET @ddl := IF(
  @is_nullable = 'NO',
  'ALTER TABLE `project_procedures` MODIFY COLUMN `template_id` bigint unsigned NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Gỡ liên kết template DAU_TU khỏi 4 procedure đã xác nhận
UPDATE project_procedures
SET template_id = NULL,
    updated_at = NOW()
WHERE id IN (11, 12, 13, 14)
  AND deleted_at IS NULL;

COMMIT;

-- 3) Verify schema
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'project_procedures'
  AND COLUMN_NAME = 'template_id';

-- 4) Verify detached procedures
SELECT id, project_id, template_id, procedure_name, updated_at
FROM project_procedures
WHERE id IN (11, 12, 13, 14)
ORDER BY id;

-- 5) Verify DAU_TU usage count
SELECT t.id, t.template_code, t.template_name,
       COUNT(DISTINCT p.id) AS procedures_count,
       COUNT(DISTINCT s.id) AS steps_count
FROM project_procedure_templates t
LEFT JOIN project_procedures p
  ON p.template_id = t.id
 AND p.deleted_at IS NULL
LEFT JOIN project_procedure_template_steps s
  ON s.template_id = t.id
WHERE t.id = 1
GROUP BY t.id, t.template_code, t.template_name;
