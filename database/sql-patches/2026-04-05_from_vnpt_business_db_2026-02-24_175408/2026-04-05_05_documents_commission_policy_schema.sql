SET NAMES utf8mb4;

SET @has_commission_policy_text := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'commission_policy_text'
);

SET @sql := IF(
  @has_commission_policy_text = 0,
  "ALTER TABLE `documents`
   ADD COLUMN `commission_policy_text` TEXT NULL
   AFTER `document_name`",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
