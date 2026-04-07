SET NAMES utf8mb4;

START TRANSACTION;

SET @has_smtp_recipient_emails := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'integration_settings'
    AND COLUMN_NAME = 'smtp_recipient_emails'
);

SET @smtp_recipient_emails_sql := IF(
  @has_smtp_recipient_emails = 0,
  'ALTER TABLE `integration_settings` ADD COLUMN `smtp_recipient_emails` VARCHAR(1000) NULL AFTER `smtp_username`',
  'SELECT 1'
);

PREPARE smtp_recipient_emails_stmt FROM @smtp_recipient_emails_sql;
EXECUTE smtp_recipient_emails_stmt;
DEALLOCATE PREPARE smtp_recipient_emails_stmt;

COMMIT;
