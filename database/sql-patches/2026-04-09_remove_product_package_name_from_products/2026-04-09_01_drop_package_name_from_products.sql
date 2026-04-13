SET NAMES utf8mb4;

SET @table_schema := DATABASE();
SET @has_package_name := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'package_name'
);

SET @ddl := IF(
    @has_package_name > 0,
    'ALTER TABLE `products` DROP COLUMN `package_name`',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
