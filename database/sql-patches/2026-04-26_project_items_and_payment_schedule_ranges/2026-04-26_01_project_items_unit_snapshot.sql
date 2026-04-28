SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_project_items := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
);
SET @has_project_items_unit := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
      AND COLUMN_NAME = 'unit'
);
SET @has_project_items_product_package_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
      AND COLUMN_NAME = 'product_package_id'
);

SET @ddl := IF(
    @has_project_items = 1 AND @has_project_items_unit = 0 AND @has_project_items_product_package_id = 1,
    'ALTER TABLE `project_items` ADD COLUMN `unit` varchar(100) NULL AFTER `product_package_id`',
    IF(
        @has_project_items = 1 AND @has_project_items_unit = 0,
        'ALTER TABLE `project_items` ADD COLUMN `unit` varchar(100) NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_project_items_unit := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
      AND COLUMN_NAME = 'unit'
);
SET @has_products := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
);
SET @has_product_packages := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
);

SET @dml := IF(
    @has_project_items = 1
      AND @has_project_items_unit = 1
      AND @has_products = 1
      AND @has_product_packages = 1,
    'UPDATE project_items pi
     LEFT JOIN product_packages pp ON pp.id = pi.product_package_id
     SET pi.unit = NULLIF(pp.unit, '''')
     WHERE pi.unit IS NULL
       AND NULLIF(pp.unit, '''') IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @dml;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
