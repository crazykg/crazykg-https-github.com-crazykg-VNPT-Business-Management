-- ============================================================================
-- CRC Detail Status + Worklog extended fields
-- Source parity: backend/database/migrations/2026_04_09_210000_add_detail_status_and_worklog_fields_for_crc.php
-- Date: 2026-04-10
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Extend customer_request_worklogs (idempotent)
SET @has_difficulty_note := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_worklogs'
    AND COLUMN_NAME = 'difficulty_note'
);
SET @sql := IF(
  @has_difficulty_note = 0,
  'ALTER TABLE customer_request_worklogs ADD COLUMN difficulty_note TEXT NULL AFTER work_content',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_proposal_note := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_worklogs'
    AND COLUMN_NAME = 'proposal_note'
);
SET @sql := IF(
  @has_proposal_note = 0,
  'ALTER TABLE customer_request_worklogs ADD COLUMN proposal_note TEXT NULL AFTER difficulty_note',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_difficulty_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_worklogs'
    AND COLUMN_NAME = 'difficulty_status'
);
SET @sql := IF(
  @has_difficulty_status = 0,
  'ALTER TABLE customer_request_worklogs ADD COLUMN difficulty_status VARCHAR(30) NULL AFTER proposal_note',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_detail_status_action := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_worklogs'
    AND COLUMN_NAME = 'detail_status_action'
);
SET @sql := IF(
  @has_detail_status_action = 0,
  'ALTER TABLE customer_request_worklogs ADD COLUMN detail_status_action VARCHAR(30) NULL AFTER difficulty_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Create detail status state table
CREATE TABLE IF NOT EXISTS customer_request_status_detail_states (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_case_id BIGINT UNSIGNED NOT NULL,
  status_instance_id BIGINT UNSIGNED NOT NULL,
  status_code VARCHAR(80) NULL,
  detail_status VARCHAR(30) NOT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  changed_by BIGINT UNSIGNED NULL,
  note TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_cr_detail_state_case_instance (request_case_id, status_instance_id),
  UNIQUE KEY uq_cr_detail_state_instance (status_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Create detail status log table
CREATE TABLE IF NOT EXISTS customer_request_status_detail_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_case_id BIGINT UNSIGNED NOT NULL,
  status_instance_id BIGINT UNSIGNED NOT NULL,
  status_code VARCHAR(80) NULL,
  from_detail_status VARCHAR(30) NULL,
  to_detail_status VARCHAR(30) NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  source VARCHAR(50) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_cr_detail_log_case_instance (request_case_id, status_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
