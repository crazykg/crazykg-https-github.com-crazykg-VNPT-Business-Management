SET NAMES utf8mb4;

START TRANSACTION;

SET @has_avatar_data_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'internal_users'
    AND COLUMN_NAME = 'avatar_data_url'
);

SET @avatar_data_url_sql := IF(
  @has_avatar_data_url = 0,
  'ALTER TABLE `internal_users` ADD COLUMN `avatar_data_url` LONGTEXT COLLATE utf8mb4_unicode_ci NULL AFTER `email`',
  'SELECT 1'
);

PREPARE avatar_data_url_stmt FROM @avatar_data_url_sql;
EXECUTE avatar_data_url_stmt;
DEALLOCATE PREPARE avatar_data_url_stmt;

SET @has_avatar_updated_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'internal_users'
    AND COLUMN_NAME = 'avatar_updated_at'
);

SET @avatar_updated_at_sql := IF(
  @has_avatar_updated_at = 0,
  'ALTER TABLE `internal_users` ADD COLUMN `avatar_updated_at` TIMESTAMP NULL DEFAULT NULL AFTER `avatar_data_url`',
  'SELECT 1'
);

PREPARE avatar_updated_at_stmt FROM @avatar_updated_at_sql;
EXECUTE avatar_updated_at_stmt;
DEALLOCATE PREPARE avatar_updated_at_stmt;

COMMIT;
