SET NAMES utf8mb4;

SET @table_schema := DATABASE();
SET @has_unit := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'unit'
);

SET @ddl := IF(
    @has_unit > 0,
    'ALTER TABLE `products` DROP COLUMN `unit`',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
