SET NAMES utf8mb4;

START TRANSACTION;

DELETE FROM `customer_request_status_transitions`
WHERE `from_status_code` = 'in_progress'
  AND `direction` = 'forward'
  AND `to_status_code` IN (
    'waiting_customer_feedback',
    'analysis',
    'returned_to_manager',
    'not_executed'
  );

UPDATE `customer_request_status_transitions`
SET `is_default` = 1,
    `is_active` = 1,
    `sort_order` = 10,
    `notes` = 'Người thực hiện xác nhận hoàn thành yêu cầu',
    `updated_at` = NOW()
WHERE `from_status_code` = 'in_progress'
  AND `to_status_code` = 'completed'
  AND `direction` = 'forward';

INSERT INTO `customer_request_status_transitions`
    (`from_status_code`, `to_status_code`, `direction`, `is_default`, `is_active`, `sort_order`, `notes`, `created_at`, `updated_at`)
SELECT
    'in_progress',
    'completed',
    'forward',
    1,
    1,
    10,
    'Người thực hiện xác nhận hoàn thành yêu cầu',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM `customer_request_status_transitions`
    WHERE `from_status_code` = 'in_progress'
      AND `to_status_code` = 'completed'
      AND `direction` = 'forward'
);

COMMIT;
