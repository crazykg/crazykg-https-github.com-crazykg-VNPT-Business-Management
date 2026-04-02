-- 2026-03-28_02_workflow_transitions_update.sql
-- Cập nhật bảng customer_request_status_transitions để thêm FK workflow_definition_id
-- Date: 2026-03-28
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Thêm column workflow_definition_id vào customer_request_status_transitions
-- ============================================================================
-- Tạo relationship 1-nhiều: workflow_definitions → customer_request_status_transitions
-- Cập nhật indexes và foreign keys
-- ============================================================================

-- Kiểm tra table tồn tại
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions');

-- Nếu table không tồn tại, tạo table mới
SET @sql = IF(@table_exists = 0,
    'CREATE TABLE customer_request_status_transitions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        from_status_code VARCHAR(80) NOT NULL,
        to_status_code VARCHAR(80) NOT NULL,
        direction VARCHAR(20) DEFAULT ''forward'',
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order SMALLINT UNSIGNED DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_from_status (from_status_code),
        INDEX idx_to_status (to_status_code),
        INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT ''Table customer_request_status_transitions already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- THÊM COLUMN workflow_definition_id
-- ============================================================================

-- Kiểm tra column có tồn tại chưa
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions' 
    AND column_name = 'workflow_definition_id');

-- Thêm column nếu chưa tồn tại
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE customer_request_status_transitions 
     ADD COLUMN workflow_definition_id BIGINT UNSIGNED COMMENT ''FK → workflow_definitions.id'' 
     AFTER id',
    'SELECT ''Column workflow_definition_id already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- THÊM INDEXES
-- ============================================================================

-- Kiểm tra index có tồn tại chưa
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions' 
    AND index_name = 'idx_workflow_transitions');

-- Thêm index nếu chưa tồn tại
SET @sql = IF(@index_exists = 0,
    'ALTER TABLE customer_request_status_transitions 
     ADD INDEX idx_workflow_transitions (workflow_definition_id, from_status_code, is_active)',
    'SELECT ''Index idx_workflow_transitions already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- THÊM FOREIGN KEY
-- ============================================================================

-- Kiểm tra FK có tồn tại chưa
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions' 
    AND constraint_name = 'fk_workflow_transitions_workflow');

-- Thêm FK nếu chưa tồn tại
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE customer_request_status_transitions 
     ADD CONSTRAINT fk_workflow_transitions_workflow 
     FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE',
    'SELECT ''Foreign key already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- THÊM CÁC COLUMNS MỚI (nếu cần)
-- ============================================================================

-- Thêm column allowed_roles (JSON)
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions' 
    AND column_name = 'allowed_roles');

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE customer_request_status_transitions 
     ADD COLUMN allowed_roles JSON COMMENT ''["all"], ["R"], ["A"]'' 
     AFTER to_status_code',
    'SELECT ''Column allowed_roles already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Thêm column transition_config (JSON)
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'customer_request_status_transitions' 
    AND column_name = 'transition_config');

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE customer_request_status_transitions 
     ADD COLUMN transition_config JSON COMMENT ''Cấu hình bổ sung'' 
     AFTER allowed_roles',
    'SELECT ''Column transition_config already exists'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- VERIFY
-- ============================================================================

-- Kiểm tra cấu trúc bảng
DESCRIBE customer_request_status_transitions;

-- Kiểm tra indexes
SHOW INDEX FROM customer_request_status_transitions;

-- Kiểm tra foreign keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'customer_request_status_transitions'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Kiểm tra số lượng rows
SELECT COUNT(*) AS transition_count FROM customer_request_status_transitions;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
