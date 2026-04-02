-- 2026-03-28_05_link_customer_request_cases_to_workflow.sql
-- Thêm column workflow_definition_id vào customer_request_cases
-- Để link mỗi yêu cầu khách hàng với một workflow cụ thể
-- Date: 2026-03-28

-- ============================================================================
-- MỤC ĐÍCH: Link customer_request_cases với workflow_definitions
-- ============================================================================
-- Mỗi customer_request_case sẽ thuộc về một workflow_definition
-- Khi chuyển trạng thái, sẽ query transitions từ workflow_definition_id đó
-- ============================================================================

-- Kiểm tra table tồn tại
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_cases');

-- Nếu table không tồn tại, báo lỗi
SELECT IF(@table_exists = 0, 
    'ERROR: Table customer_request_cases does not exist', 
    'OK: Table customer_request_cases exists') AS status;

-- ============================================================================
-- 1. THÊM COLUMN workflow_definition_id
-- ============================================================================

-- Kiểm tra column có tồn tại chưa
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_cases' 
    AND column_name = 'workflow_definition_id');

-- Thêm column nếu chưa tồn tại
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE customer_request_cases 
     ADD COLUMN workflow_definition_id BIGINT UNSIGNED COMMENT ''FK → workflow_definitions.id'' 
     AFTER current_status_code',
    'SELECT ''Column workflow_definition_id already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 2. THÊM INDEX
-- ============================================================================

-- Kiểm tra index có tồn tại chưa
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_cases' 
    AND index_name = 'idx_workflow_definition');

-- Thêm index nếu chưa tồn tại
SET @sql = IF(@index_exists = 0,
    'ALTER TABLE customer_request_cases 
     ADD INDEX idx_workflow_definition (workflow_definition_id, current_status_code)',
    'SELECT ''Index idx_workflow_definition already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 3. THÊM FOREIGN KEY
-- ============================================================================

-- Kiểm tra FK có tồn tại chưa
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_cases' 
    AND constraint_name = 'fk_crc_workflow_definition');

-- Thêm FK nếu chưa tồn tại
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE customer_request_cases 
     ADD CONSTRAINT fk_crc_workflow_definition 
     FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE SET NULL',
    'SELECT ''Foreign key already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 4. SET DEFAULT WORKFLOW CHO CÁC CASE HIỆN TẠI
-- ============================================================================

-- Lấy ID của workflow LUONG_A (default workflow)
SET @workflow_a_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A' LIMIT 1);

-- Update các case hiện tại để trỏ về LUONG_A
UPDATE customer_request_cases crc
SET crc.workflow_definition_id = @workflow_a_id
WHERE crc.workflow_definition_id IS NULL
  AND @workflow_a_id IS NOT NULL;

-- ============================================================================
-- 5. VERIFY
-- ============================================================================

-- Kiểm tra cấu trúc column
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'customer_request_cases'
  AND COLUMN_NAME = 'workflow_definition_id';

-- Kiểm tra indexes
SHOW INDEX FROM customer_request_cases WHERE Key_name = 'idx_workflow_definition';

-- Kiểm tra foreign keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'customer_request_cases'
  AND REFERENCED_TABLE_NAME = 'workflow_definitions';

-- Kiểm tra số lượng cases đã link với workflow
SELECT 
    COUNT(*) AS total_cases,
    SUM(CASE WHEN workflow_definition_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_cases,
    SUM(CASE WHEN workflow_definition_id IS NULL THEN 1 ELSE 0 END) AS unlinked_cases
FROM customer_request_cases;

-- Kiểm tra distribution theo workflow
SELECT 
    w.code AS workflow_code,
    w.name AS workflow_name,
    COUNT(crc.id) AS case_count
FROM customer_request_cases crc
LEFT JOIN workflow_definitions w ON crc.workflow_definition_id = w.id
GROUP BY crc.workflow_definition_id, w.code, w.name
ORDER BY case_count DESC;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
