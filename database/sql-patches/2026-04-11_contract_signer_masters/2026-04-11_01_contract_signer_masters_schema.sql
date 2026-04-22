SET NAMES utf8mb4;

-- ============================================================================
-- Contract signer allowlist schema
-- Source parity:
--   - backend/database/migrations/2026_04_11_170000_create_contract_signer_masters_table.php
-- Date: 2026-04-11
-- ============================================================================

SET @table_schema := DATABASE();
SET @has_internal_users := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
);
SET @has_contract_signer_masters := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_signer_masters'
);

SET @ddl := IF(
    @has_contract_signer_masters = 0 AND @has_internal_users = 1,
    'CREATE TABLE `contract_signer_masters` (
        `id` bigint unsigned NOT NULL AUTO_INCREMENT,
        `internal_user_id` bigint unsigned NOT NULL,
        `is_active` tinyint(1) NOT NULL DEFAULT ''1'',
        `created_at` timestamp NULL DEFAULT NULL,
        `created_by` bigint unsigned DEFAULT NULL,
        `updated_at` timestamp NULL DEFAULT NULL,
        `updated_by` bigint unsigned DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_contract_signer_masters_internal_user` (`internal_user_id`),
        KEY `idx_contract_signer_masters_active_user` (`is_active`,`internal_user_id`),
        KEY `fk_contract_signer_masters_created_by` (`created_by`),
        KEY `fk_contract_signer_masters_updated_by` (`updated_by`),
        CONSTRAINT `fk_contract_signer_masters_created_by` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
        CONSTRAINT `fk_contract_signer_masters_internal_user` FOREIGN KEY (`internal_user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE,
        CONSTRAINT `fk_contract_signer_masters_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    IF(
        @has_contract_signer_masters = 0,
        'CREATE TABLE `contract_signer_masters` (
            `id` bigint unsigned NOT NULL AUTO_INCREMENT,
            `internal_user_id` bigint unsigned NOT NULL,
            `is_active` tinyint(1) NOT NULL DEFAULT ''1'',
            `created_at` timestamp NULL DEFAULT NULL,
            `created_by` bigint unsigned DEFAULT NULL,
            `updated_at` timestamp NULL DEFAULT NULL,
            `updated_by` bigint unsigned DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_contract_signer_masters_internal_user` (`internal_user_id`),
            KEY `idx_contract_signer_masters_active_user` (`is_active`,`internal_user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_contract_signer_masters := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_signer_masters'
);

SET @has_fk_internal_user := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE BINARY CONSTRAINT_SCHEMA = BINARY @table_schema
      AND BINARY TABLE_NAME = BINARY 'contract_signer_masters'
      AND BINARY CONSTRAINT_NAME = BINARY 'fk_contract_signer_masters_internal_user'
);
SET @ddl := IF(
    @has_internal_users = 1 AND @has_contract_signer_masters = 1 AND @has_fk_internal_user = 0,
    'ALTER TABLE `contract_signer_masters`
        ADD CONSTRAINT `fk_contract_signer_masters_internal_user`
        FOREIGN KEY (`internal_user_id`) REFERENCES `internal_users` (`id`) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_created_by := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE BINARY CONSTRAINT_SCHEMA = BINARY @table_schema
      AND BINARY TABLE_NAME = BINARY 'contract_signer_masters'
      AND BINARY CONSTRAINT_NAME = BINARY 'fk_contract_signer_masters_created_by'
);
SET @ddl := IF(
    @has_internal_users = 1 AND @has_contract_signer_masters = 1 AND @has_fk_created_by = 0,
    'ALTER TABLE `contract_signer_masters`
        ADD CONSTRAINT `fk_contract_signer_masters_created_by`
        FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_updated_by := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE BINARY CONSTRAINT_SCHEMA = BINARY @table_schema
      AND BINARY TABLE_NAME = BINARY 'contract_signer_masters'
      AND BINARY CONSTRAINT_NAME = BINARY 'fk_contract_signer_masters_updated_by'
);
SET @ddl := IF(
    @has_internal_users = 1 AND @has_contract_signer_masters = 1 AND @has_fk_updated_by = 0,
    'ALTER TABLE `contract_signer_masters`
        ADD CONSTRAINT `fk_contract_signer_masters_updated_by`
        FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
