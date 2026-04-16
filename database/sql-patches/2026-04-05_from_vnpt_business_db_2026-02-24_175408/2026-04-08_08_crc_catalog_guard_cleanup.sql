SET NAMES utf8mb4;

/* Chỉ deactivate các status trỏ vào bảng không có (nếu còn tồn tại) */
UPDATE customer_request_status_catalogs c
LEFT JOIN information_schema.tables t
  ON t.table_schema = DATABASE()
 AND t.table_name = c.table_name
SET c.is_active = 0,
    c.updated_at = NOW()
WHERE c.is_active = 1
  AND c.table_name IS NOT NULL
  AND c.table_name <> ''
  AND t.table_name IS NULL;

/* Verify: phải trả về 0 rows */
SELECT c.id, c.workflow_definition_id, c.status_code, c.table_name
FROM customer_request_status_catalogs c
LEFT JOIN information_schema.tables t
  ON t.table_schema = DATABASE()
 AND t.table_name = c.table_name
WHERE c.is_active = 1
  AND c.table_name IS NOT NULL
  AND c.table_name <> ''
  AND t.table_name IS NULL;
