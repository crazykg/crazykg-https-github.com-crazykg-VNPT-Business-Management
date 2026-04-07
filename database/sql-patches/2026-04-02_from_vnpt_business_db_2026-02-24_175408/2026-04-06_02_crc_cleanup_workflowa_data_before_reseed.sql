SET NAMES utf8mb4;

START TRANSACTION;

-- Cleanup toàn bộ dữ liệu CRC liên quan trước khi reseed.
-- Bao gồm dữ liệu nghiệp vụ và 2 bảng quy trình:
--   - customer_request_status_transitions
--   - customer_request_status_catalogs

DROP PROCEDURE IF EXISTS `sp_crc_delete_all_if_exists`;
DELIMITER $$
CREATE PROCEDURE `sp_crc_delete_all_if_exists`(IN p_table VARCHAR(128))
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = p_table
  ) THEN
    SET @sql = CONCAT('DELETE FROM `', p_table, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- Tắt FK check để cleanup an toàn theo nhiều môi trường schema khác nhau.
SET @prev_foreign_key_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- Child/bản liên quan
CALL `sp_crc_delete_all_if_exists`('customer_request_it360_tasks');
CALL `sp_crc_delete_all_if_exists`('customer_request_ref_tasks');
CALL `sp_crc_delete_all_if_exists`('customer_request_status_instances');

-- Các bảng trạng thái CRC
CALL `sp_crc_delete_all_if_exists`('customer_request_assigned_to_receiver');
CALL `sp_crc_delete_all_if_exists`('customer_request_receiver_in_progress');
CALL `sp_crc_delete_all_if_exists`('customer_request_pending_dispatch');
CALL `sp_crc_delete_all_if_exists`('customer_request_dispatched');
CALL `sp_crc_delete_all_if_exists`('customer_request_waiting_customer_feedbacks');
CALL `sp_crc_delete_all_if_exists`('customer_request_in_progress');
CALL `sp_crc_delete_all_if_exists`('customer_request_coding');
CALL `sp_crc_delete_all_if_exists`('customer_request_coding_in_progress');
CALL `sp_crc_delete_all_if_exists`('customer_request_coding_suspended');
CALL `sp_crc_delete_all_if_exists`('customer_request_dms_transfer');
CALL `sp_crc_delete_all_if_exists`('customer_request_dms_task_created');
CALL `sp_crc_delete_all_if_exists`('customer_request_dms_in_progress');
CALL `sp_crc_delete_all_if_exists`('customer_request_dms_suspended');
CALL `sp_crc_delete_all_if_exists`('customer_request_not_executed');
CALL `sp_crc_delete_all_if_exists`('customer_request_completed');
CALL `sp_crc_delete_all_if_exists`('customer_request_customer_notified');
CALL `sp_crc_delete_all_if_exists`('customer_request_returned_to_manager');
CALL `sp_crc_delete_all_if_exists`('customer_request_analysis');
CALL `sp_crc_delete_all_if_exists`('customer_request_analysis_completed');
CALL `sp_crc_delete_all_if_exists`('customer_request_analysis_suspended');

-- Bảng master case CRC
CALL `sp_crc_delete_all_if_exists`('customer_request_cases');

-- 2 bảng quy trình (workflow_definition_id = 1)
DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1;

DELETE FROM `customer_request_status_catalogs`
WHERE `workflow_definition_id` = 1;

SET FOREIGN_KEY_CHECKS = @prev_foreign_key_checks;

DROP PROCEDURE IF EXISTS `sp_crc_delete_all_if_exists`;

COMMIT;
