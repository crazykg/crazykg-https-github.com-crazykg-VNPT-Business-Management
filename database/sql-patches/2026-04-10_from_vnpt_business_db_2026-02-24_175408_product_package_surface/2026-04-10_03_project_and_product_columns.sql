SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_product_short_name := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'product_short_name'
);
SET @ddl := IF(
    @has_product_short_name = 0,
    'ALTER TABLE `products` ADD COLUMN `product_short_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER `product_name`',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_projects := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'projects'
);
SET @has_payment_cycle := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'projects'
      AND COLUMN_NAME = 'payment_cycle'
);
SET @has_opportunity_score := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'projects'
      AND COLUMN_NAME = 'opportunity_score'
);

SET @ddl := IF(
    @has_projects = 1 AND @has_opportunity_score = 0 AND @has_payment_cycle = 1,
    'ALTER TABLE `projects` ADD COLUMN `opportunity_score` tinyint unsigned NOT NULL DEFAULT 0 AFTER `payment_cycle`',
    IF(
        @has_projects = 1 AND @has_opportunity_score = 0,
        'ALTER TABLE `projects` ADD COLUMN `opportunity_score` tinyint unsigned NOT NULL DEFAULT 0 AFTER `status_reason`',
        'SELECT 1'
    )
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
