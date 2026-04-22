SET NAMES utf8mb4;

-- ============================================================================
-- Contract signer allowlist backfill
-- Source parity:
--   - backend/database/migrations/2026_04_11_170100_backfill_contract_signer_masters_from_contracts.php
-- Date: 2026-04-11
-- ============================================================================

SET @table_schema := DATABASE();
SET @has_contract_signer_masters := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_signer_masters'
);
SET @has_contracts := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
);
SET @has_internal_users := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
);
SET @has_signer_user_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'signer_user_id'
);
SET @has_contracts_deleted_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'deleted_at'
);
SET @has_internal_users_deleted_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'deleted_at'
);

SET @ddl := IF(
    @has_contract_signer_masters = 1 AND @has_contracts = 1 AND @has_signer_user_id = 1,
    CONCAT(
        'INSERT INTO `contract_signer_masters` (`internal_user_id`, `is_active`, `created_at`, `updated_at`) ',
        'SELECT DISTINCT `contracts`.`signer_user_id`, 1, NOW(), NOW() ',
        'FROM `contracts` ',
        IF(
            @has_internal_users = 1,
            'INNER JOIN `internal_users` ON `internal_users`.`id` = `contracts`.`signer_user_id` ',
            ''
        ),
        'WHERE `contracts`.`signer_user_id` IS NOT NULL ',
        IF(@has_contracts_deleted_at = 1, 'AND `contracts`.`deleted_at` IS NULL ', ''),
        IF(
            @has_internal_users = 1 AND @has_internal_users_deleted_at = 1,
            'AND `internal_users`.`deleted_at` IS NULL ',
            ''
        ),
        'ON DUPLICATE KEY UPDATE ',
        '`is_active` = VALUES(`is_active`), ',
        '`updated_at` = VALUES(`updated_at`)'
    ),
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
