SET NAMES utf8mb4;

SET @table_schema := DATABASE();
SET @has_product_packages := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
);
SET @has_feature_groups := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_feature_groups'
);
SET @has_features := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_features'
);

SET @ddl := IF(
    @has_product_packages = 1 AND @has_feature_groups = 0,
    'CREATE TABLE `product_package_feature_groups` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `uuid` char(36) DEFAULT NULL,
        `package_id` bigint unsigned NOT NULL,
        `group_name` varchar(255) NOT NULL,
        `display_order` int unsigned NOT NULL DEFAULT ''1'',
        `notes` text,
        `created_by` bigint unsigned DEFAULT NULL,
        `updated_by` bigint unsigned DEFAULT NULL,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        `deleted_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `product_package_feature_groups_uuid_unique` (`uuid`),
        KEY `ppfg_package_order_idx` (`package_id`, `display_order`),
        CONSTRAINT `product_package_feature_groups_package_id_foreign` FOREIGN KEY (`package_id`) REFERENCES `product_packages` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_product_packages = 1 AND @has_features = 0,
    'CREATE TABLE `product_package_features` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `uuid` char(36) DEFAULT NULL,
        `package_id` bigint unsigned NOT NULL,
        `group_id` bigint unsigned NOT NULL,
        `feature_name` varchar(255) NOT NULL,
        `detail_description` longtext,
        `status` varchar(20) NOT NULL DEFAULT ''ACTIVE'',
        `display_order` int unsigned NOT NULL DEFAULT ''1'',
        `created_by` bigint unsigned DEFAULT NULL,
        `updated_by` bigint unsigned DEFAULT NULL,
        `created_at` timestamp NULL DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        `deleted_at` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `product_package_features_uuid_unique` (`uuid`),
        KEY `product_package_features_group_id_foreign` (`group_id`),
        KEY `ppf_package_group_order_idx` (`package_id`, `group_id`, `display_order`),
        KEY `ppf_package_status_idx` (`package_id`, `status`),
        CONSTRAINT `product_package_features_group_id_foreign` FOREIGN KEY (`group_id`) REFERENCES `product_package_feature_groups` (`id`) ON DELETE CASCADE,
        CONSTRAINT `product_package_features_package_id_foreign` FOREIGN KEY (`package_id`) REFERENCES `product_packages` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
