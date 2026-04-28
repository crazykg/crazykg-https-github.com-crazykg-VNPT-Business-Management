SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-19_01_add_telegram_integration_and_employee_telechatbot.sql
-- Mục tiêu:
--   - Bổ sung các cột Telegram cho integration_settings
--   - Seed provider TELEGRAM nếu chưa có
--   - Bổ sung cột telechatbot cho internal_users
--   - Forward-only, idempotent cho MySQL 8
-- ============================================================================

SET @table_schema := DATABASE();

-- ----------------------------------------------------------------------------
-- 1) integration_settings: add Telegram columns if missing
-- ----------------------------------------------------------------------------
SET @has_integration_settings := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
);

SET @has_telegram_enabled := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_enabled'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_enabled = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_enabled` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_enabled`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_telegram_bot_username := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_bot_username'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_bot_username = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_bot_username` varchar(255) NULL AFTER `telegram_enabled`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_telegram_bot_token_encrypted := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_bot_token_encrypted'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_bot_token_encrypted = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_bot_token_encrypted` longtext NULL AFTER `telegram_bot_username`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_telegram_last_test_status := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_last_test_status'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_last_test_status = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_last_test_status` varchar(50) NULL AFTER `telegram_bot_token_encrypted`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_telegram_last_test_message := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_last_test_message'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_last_test_message = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_last_test_message` text NULL AFTER `telegram_last_test_status`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_telegram_last_test_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'telegram_last_test_at'
);
SET @ddl := IF(
    @has_integration_settings = 1 AND @has_telegram_last_test_at = 0,
    'ALTER TABLE `integration_settings` ADD COLUMN `telegram_last_test_at` datetime NULL AFTER `telegram_last_test_message`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure one provider row exists for TELEGRAM
SET @has_provider := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'provider'
);
SET @has_created_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'created_at'
);
SET @has_updated_at := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'integration_settings'
      AND COLUMN_NAME = 'updated_at'
);

SET @ddl := IF(
    @has_integration_settings = 1 AND @has_provider = 1 AND @has_created_at = 1 AND @has_updated_at = 1,
    'INSERT INTO `integration_settings` (`provider`, `is_enabled`, `telegram_enabled`, `created_at`, `updated_at`)
     SELECT ''TELEGRAM'', 0, 0, NOW(), NOW()
     FROM DUAL
     WHERE NOT EXISTS (
       SELECT 1 FROM `integration_settings` WHERE `provider` = ''TELEGRAM''
     )',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_integration_settings = 1,
    'UPDATE `integration_settings`
     SET `telegram_enabled` = COALESCE(`telegram_enabled`, 0),
         `updated_at` = COALESCE(`updated_at`, NOW())
     WHERE `provider` = ''TELEGRAM''',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 2) internal_users: add telechatbot if missing
-- ----------------------------------------------------------------------------
SET @has_internal_users := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
);

SET @has_telechatbot := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'telechatbot'
);

SET @has_mobile := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'mobile'
);

SET @has_phone := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'internal_users'
      AND COLUMN_NAME = 'phone'
);

SET @ddl := IF(
    @has_internal_users = 1 AND @has_telechatbot = 0 AND @has_mobile = 1,
    'ALTER TABLE `internal_users` ADD COLUMN `telechatbot` varchar(255) NULL AFTER `mobile`',
    IF(
        @has_internal_users = 1 AND @has_telechatbot = 0 AND @has_phone = 1,
        'ALTER TABLE `internal_users` ADD COLUMN `telechatbot` varchar(255) NULL AFTER `phone`',
        IF(
            @has_internal_users = 1 AND @has_telechatbot = 0,
            'ALTER TABLE `internal_users` ADD COLUMN `telechatbot` varchar(255) NULL',
            'SELECT 1'
        )
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;

-- ----------------------------------------------------------------------------
-- 3) Verify
-- ----------------------------------------------------------------------------
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'integration_settings'
  AND COLUMN_NAME IN (
      'telegram_enabled',
      'telegram_bot_username',
      'telegram_bot_token_encrypted',
      'telegram_last_test_status',
      'telegram_last_test_message',
      'telegram_last_test_at'
  )
ORDER BY FIELD(
  COLUMN_NAME,
  'telegram_enabled',
  'telegram_bot_username',
  'telegram_bot_token_encrypted',
  'telegram_last_test_status',
  'telegram_last_test_message',
  'telegram_last_test_at'
);

SELECT id, provider, is_enabled, telegram_enabled, updated_at
FROM integration_settings
WHERE provider = 'TELEGRAM';

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'internal_users'
  AND COLUMN_NAME = 'telechatbot';

-- ----------------------------------------------------------------------------
-- 4) Migration bookkeeping
-- ----------------------------------------------------------------------------
START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_19_100000_add_telegram_settings_to_integration_settings' AS `migration`, 125 AS `batch`
    UNION ALL
    SELECT '2026_04_19_100100_add_telechatbot_to_internal_users_table', 125
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
