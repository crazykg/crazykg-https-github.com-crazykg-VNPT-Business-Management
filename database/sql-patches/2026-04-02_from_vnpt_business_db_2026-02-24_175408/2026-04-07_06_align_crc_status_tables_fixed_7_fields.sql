SET NAMES utf8mb4;

START TRANSACTION;

-- Align all CRC status tables to fixed 7 fields:
-- received_at, completed_at, extended_at, progress_percent, from_user_id, to_user_id, notes
-- MySQL-compatible approach: dynamic ALTER with information_schema guards.

DROP PROCEDURE IF EXISTS `sp_add_crc_column_if_missing`;
DELIMITER $$
CREATE PROCEDURE `sp_add_crc_column_if_missing`(
  IN p_table VARCHAR(128),
  IN p_column VARCHAR(128),
  IN p_definition VARCHAR(255)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = p_table
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- customer_request_assigned_to_receiver
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_assigned_to_receiver', 'notes', 'TEXT NULL');

-- customer_request_receiver_in_progress
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_receiver_in_progress', 'notes', 'TEXT NULL');

-- customer_request_pending_dispatch
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_pending_dispatch', 'notes', 'TEXT NULL');

-- customer_request_dispatched
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dispatched', 'notes', 'TEXT NULL');

-- customer_request_waiting_customer_feedbacks
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_waiting_customer_feedbacks', 'notes', 'TEXT NULL');

-- customer_request_in_progress
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_in_progress', 'notes', 'TEXT NULL');

-- customer_request_coding
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding', 'notes', 'TEXT NULL');

-- customer_request_coding_in_progress
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_in_progress', 'notes', 'TEXT NULL');

-- customer_request_coding_suspended
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_coding_suspended', 'notes', 'TEXT NULL');

-- customer_request_dms_transfer
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_transfer', 'notes', 'TEXT NULL');

-- customer_request_dms_task_created
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_task_created', 'notes', 'TEXT NULL');

-- customer_request_dms_in_progress
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_in_progress', 'notes', 'TEXT NULL');

-- customer_request_dms_suspended
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_dms_suspended', 'notes', 'TEXT NULL');

-- customer_request_not_executed
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_not_executed', 'notes', 'TEXT NULL');

-- customer_request_completed
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_completed', 'notes', 'TEXT NULL');

-- customer_request_customer_notified
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_customer_notified', 'notes', 'TEXT NULL');

-- customer_request_returned_to_manager
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_returned_to_manager', 'notes', 'TEXT NULL');

-- customer_request_analysis
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis', 'notes', 'TEXT NULL');

-- customer_request_analysis_completed
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_completed', 'notes', 'TEXT NULL');

-- customer_request_analysis_suspended
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'received_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'completed_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'extended_at', 'DATETIME NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'progress_percent', 'TINYINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'from_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'to_user_id', 'BIGINT UNSIGNED NULL');
CALL `sp_add_crc_column_if_missing`('customer_request_analysis_suspended', 'notes', 'TEXT NULL');

DROP PROCEDURE IF EXISTS `sp_add_crc_column_if_missing`;

-- Align status catalog form schema to the fixed 7-field model.
UPDATE `customer_request_status_catalogs`
SET `form_fields_json` = JSON_ARRAY(
  JSON_OBJECT('name', 'received_at', 'type', 'datetime', 'label', 'Ngày bắt đầu', 'required', FALSE),
  JSON_OBJECT('name', 'completed_at', 'type', 'datetime', 'label', 'Ngày kết thúc', 'required', FALSE),
  JSON_OBJECT('name', 'extended_at', 'type', 'datetime', 'label', 'Ngày gia hạn', 'required', FALSE),
  JSON_OBJECT('name', 'progress_percent', 'type', 'number', 'label', 'Tiến độ phần trăm', 'required', FALSE),
  JSON_OBJECT('name', 'from_user_id', 'type', 'user_select', 'label', 'Người chuyển', 'required', FALSE),
  JSON_OBJECT('name', 'to_user_id', 'type', 'user_select', 'label', 'Người nhận', 'required', FALSE),
  JSON_OBJECT('name', 'notes', 'type', 'textarea', 'label', 'Ghi chú', 'required', FALSE)
)
WHERE `workflow_definition_id` = 1;

COMMIT;
