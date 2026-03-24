SET NAMES utf8mb4;

START TRANSACTION;

SET @patch_now := NOW();

-- Align current case status away from legacy dispatched states.
UPDATE `customer_request_cases`
SET
    `current_status_code` = 'new_intake',
    `current_status_changed_at` = @patch_now,
    `updated_at` = @patch_now
WHERE `current_status_code` IN ('pending_dispatch', 'dispatched');

UPDATE `customer_request_status_instances`
SET
    `status_code` = 'new_intake',
    `status_table` = 'customer_request_cases',
    `status_row_id` = `request_case_id`,
    `updated_at` = @patch_now
WHERE `is_current` = 1
  AND `status_code` IN ('pending_dispatch', 'dispatched');

-- Keep legacy catalog rows for history labels, but deactivate them.
UPDATE `customer_request_status_catalogs`
SET
    `is_active` = 0,
    `updated_at` = @patch_now
WHERE `status_code` IN ('pending_dispatch', 'dispatched');

-- Remove transitions that point to legacy dispatched statuses.
DELETE FROM `customer_request_status_transitions`
WHERE `from_status_code` IN ('pending_dispatch', 'dispatched')
   OR `to_status_code` IN ('pending_dispatch', 'dispatched');

-- Ensure the XML-aligned intake transitions are the canonical set.
DELETE FROM `customer_request_status_transitions`
WHERE (`from_status_code` = 'new_intake' AND `to_status_code` = 'not_executed' AND `direction` = 'forward')
   OR (`from_status_code` = 'new_intake' AND `to_status_code` = 'waiting_customer_feedback' AND `direction` = 'forward')
   OR (`from_status_code` = 'new_intake' AND `to_status_code` = 'in_progress' AND `direction` = 'forward')
   OR (`from_status_code` = 'new_intake' AND `to_status_code` = 'analysis' AND `direction` = 'forward')
   OR (`from_status_code` = 'new_intake' AND `to_status_code` = 'returned_to_manager' AND `direction` = 'forward')
   OR (`from_status_code` = 'returned_to_manager' AND `to_status_code` = 'in_progress' AND `direction` = 'forward');

INSERT INTO `customer_request_status_transitions`
    (`from_status_code`, `to_status_code`, `direction`, `is_default`, `is_active`, `sort_order`, `notes`, `updated_at`, `created_at`)
VALUES
    ('new_intake', 'not_executed', 'forward', 0, 1, 20, 'Từ tiếp nhận chuyển không thực hiện', @patch_now, @patch_now),
    ('new_intake', 'waiting_customer_feedback', 'forward', 0, 1, 30, 'Từ tiếp nhận chờ khách hàng bổ sung', @patch_now, @patch_now),
    ('new_intake', 'in_progress', 'forward', 0, 1, 40, 'Performer nhận việc trực tiếp từ tiếp nhận', @patch_now, @patch_now),
    ('new_intake', 'analysis', 'forward', 0, 1, 50, 'Từ tiếp nhận chuyển BA phân tích', @patch_now, @patch_now),
    ('new_intake', 'returned_to_manager', 'forward', 0, 1, 60, 'Performer trả PM trực tiếp từ tiếp nhận', @patch_now, @patch_now),
    ('returned_to_manager', 'in_progress', 'forward', 0, 1, 20, 'PM giao lại performer trực tiếp', @patch_now, @patch_now);

COMMIT;
