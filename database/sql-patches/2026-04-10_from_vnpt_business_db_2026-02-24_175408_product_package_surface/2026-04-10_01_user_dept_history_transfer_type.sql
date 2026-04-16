SET NAMES utf8mb4;

SET @table_schema := DATABASE();
SET @has_user_dept_history := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'user_dept_history'
);
SET @has_transfer_type := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'user_dept_history'
      AND COLUMN_NAME = 'transfer_type'
);

SET @ddl := IF(
    @has_user_dept_history = 1 AND @has_transfer_type = 0,
    'ALTER TABLE `user_dept_history` ADD COLUMN `transfer_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''LUAN_CHUYEN'' AFTER `decision_number`',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
