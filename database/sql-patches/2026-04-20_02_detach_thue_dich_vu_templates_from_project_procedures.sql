SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-20_02_detach_thue_dich_vu_templates_from_project_procedures.sql
-- Mục tiêu:
--   - Đảm bảo project_procedures.template_id cho phép NULL
--   - Gỡ liên kết procedure đang dùng 2 template:
--       + THUE_DICH_VU
--       + THUE_DICH_VU_DACTHU
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

-- 2) Resolve template IDs theo template_code
SET @tpl_thue_dich_vu := (
  SELECT id
  FROM project_procedure_templates
  WHERE template_code = 'THUE_DICH_VU'
  LIMIT 1
);

SET @tpl_thue_dich_vu_dacthu := (
  SELECT id
  FROM project_procedure_templates
  WHERE template_code = 'THUE_DICH_VU_DACTHU'
  LIMIT 1
);

-- 3) Gỡ liên kết template khỏi project_procedures
UPDATE project_procedures
SET template_id = NULL,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND template_id IN (@tpl_thue_dich_vu, @tpl_thue_dich_vu_dacthu);

COMMIT;

-- 4) Verify usage count của 2 template
SELECT t.id, t.template_code, t.template_name,
       COUNT(DISTINCT p.id) AS procedures_count,
       COUNT(DISTINCT s.id) AS steps_count
FROM project_procedure_templates t
LEFT JOIN project_procedures p
  ON p.template_id = t.id
 AND p.deleted_at IS NULL
LEFT JOIN project_procedure_template_steps s
  ON s.template_id = t.id
WHERE t.template_code IN ('THUE_DICH_VU', 'THUE_DICH_VU_DACTHU')
GROUP BY t.id, t.template_code, t.template_name
ORDER BY t.id;

-- 5) Verify các procedure đã detach
SELECT id, project_id, template_id, procedure_name, updated_at
FROM project_procedures
WHERE id IN (9, 10, 15, 16)
ORDER BY id;
