SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_products := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
);
SET @has_package_name := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'package_name'
);
SET @has_has_product_packages := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'has_product_packages'
);

SET @ddl := IF(
    @has_products = 1 AND @has_has_product_packages = 0 AND @has_package_name > 0,
    'ALTER TABLE `products` ADD COLUMN `has_product_packages` tinyint(1) NOT NULL DEFAULT 0 AFTER `package_name`',
    IF(
        @has_products = 1 AND @has_has_product_packages = 0,
        'ALTER TABLE `products` ADD COLUMN `has_product_packages` tinyint(1) NOT NULL DEFAULT 0 AFTER `product_name`',
        'SELECT 1'
    )
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_packages := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
);

SET @ddl := IF(
    @has_product_packages = 0,
    'CREATE TABLE `product_packages` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `product_id` bigint unsigned NOT NULL,
        `package_code` varchar(100) NOT NULL,
        `package_name` varchar(255) NOT NULL,
        `standard_price` decimal(15,2) NOT NULL DEFAULT ''0.00'',
        `unit` varchar(50) DEFAULT NULL,
        `description` text,
        `is_active` tinyint(1) NOT NULL DEFAULT ''1'',
        `created_by` bigint unsigned DEFAULT NULL,
        `updated_by` bigint unsigned DEFAULT NULL,
        `deleted_at` timestamp NULL DEFAULT NULL,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_product_packages_package_code` (`package_code`),
        KEY `idx_product_packages_product_id` (`product_id`),
        KEY `idx_product_packages_deleted_at` (`deleted_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_packages_product_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
      AND INDEX_NAME = 'idx_product_packages_product_id'
);
SET @ddl := IF(
    @has_product_packages = 1 AND @has_product_packages_product_idx = 0,
    'ALTER TABLE `product_packages` ADD INDEX `idx_product_packages_product_id` (`product_id`)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_packages_deleted_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
      AND INDEX_NAME = 'idx_product_packages_deleted_at'
);
SET @ddl := IF(
    @has_product_packages = 1 AND @has_product_packages_deleted_idx = 0,
    'ALTER TABLE `product_packages` ADD INDEX `idx_product_packages_deleted_at` (`deleted_at`)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_packages_code_uq := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
      AND INDEX_NAME = 'uq_product_packages_package_code'
);
SET @ddl := IF(
    @has_product_packages = 1 AND @has_product_packages_code_uq = 0,
    'ALTER TABLE `product_packages` ADD UNIQUE KEY `uq_product_packages_package_code` (`package_code`)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_attachments_reference_type := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'attachments'
      AND COLUMN_NAME = 'reference_type'
);
SET @has_product_package_enum := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'attachments'
      AND COLUMN_NAME = 'reference_type'
      AND COLUMN_TYPE LIKE '%''PRODUCT_PACKAGE''%'
);

SET @ddl := IF(
    @has_attachments_reference_type = 1 AND @has_product_package_enum = 0,
    'ALTER TABLE `attachments`
        MODIFY COLUMN `reference_type` enum(''DOCUMENT'',''CONTRACT'',''PROJECT'',''CUSTOMER'',''OPPORTUNITY'',''TRANSITION'',''WORKLOG'',''CUSTOMER_REQUEST'',''PROCEDURE_STEP'',''FEEDBACK_REQUEST'',''PAYMENT_SCHEDULE'',''PRODUCT'',''PRODUCT_PACKAGE'')
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        NOT NULL
        COMMENT ''Bảng cha của file đính kèm''',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
