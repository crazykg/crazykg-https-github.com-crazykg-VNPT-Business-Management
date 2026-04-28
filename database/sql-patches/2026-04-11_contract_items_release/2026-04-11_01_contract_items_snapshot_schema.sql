SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_contract_items := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
);

SET @has_product_name := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND COLUMN_NAME = 'product_name'
);
SET @ddl := IF(
    @has_contract_items = 1 AND @has_product_name = 0,
    'ALTER TABLE `contract_items` ADD COLUMN `product_name` varchar(500) NULL AFTER `product_id`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_unit := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND COLUMN_NAME = 'unit'
);
SET @has_product_name := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND COLUMN_NAME = 'product_name'
);
SET @ddl := IF(
    @has_contract_items = 1 AND @has_unit = 0 AND @has_product_name = 1,
    'ALTER TABLE `contract_items` ADD COLUMN `unit` varchar(100) NULL AFTER `product_name`',
    IF(
        @has_contract_items = 1 AND @has_unit = 0,
        'ALTER TABLE `contract_items` ADD COLUMN `unit` varchar(100) NULL AFTER `product_id`',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_package_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND COLUMN_NAME = 'product_package_id'
);
SET @ddl := IF(
    @has_contract_items = 1 AND @has_product_package_id = 0,
    'ALTER TABLE `contract_items` ADD COLUMN `product_package_id` bigint unsigned NULL AFTER `product_id`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_package_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND INDEX_NAME = 'idx_contract_items_product_package'
);
SET @ddl := IF(
    @has_contract_items = 1 AND @has_package_idx = 0,
    'ALTER TABLE `contract_items` ADD INDEX `idx_contract_items_product_package` (`product_package_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_old_unique := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
      AND INDEX_NAME = 'uq_ci_contract_product'
);
SET @ddl := IF(
    @has_contract_items = 1 AND @has_old_unique > 0,
    'ALTER TABLE `contract_items` DROP INDEX `uq_ci_contract_product`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
