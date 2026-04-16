SET NAMES utf8mb4;

SET @table_schema := DATABASE();
SET @has_project_items := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
);
SET @has_product_package_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
      AND COLUMN_NAME = 'product_package_id'
);
SET @ddl := IF(
    @has_project_items = 1 AND @has_product_package_id = 0,
    'ALTER TABLE `project_items` ADD COLUMN `product_package_id` bigint unsigned NULL AFTER `product_id`',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_package_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
      AND INDEX_NAME = 'idx_project_items_product_package_id'
);
SET @ddl := IF(
    @has_project_items = 1 AND @has_product_package_idx = 0,
    'ALTER TABLE `project_items` ADD INDEX `idx_project_items_product_package_id` (`product_package_id`)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
