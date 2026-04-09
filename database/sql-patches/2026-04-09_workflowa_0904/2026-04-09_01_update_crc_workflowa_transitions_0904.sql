SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 2026-04-09_01_update_crc_workflowa_transitions_0904.sql
-- Mục tiêu:
--   - Áp dụng thay đổi transition theo file workflowa (1).xlsx (kế hoạch 0904)
--   - Giữ nguyên 2 dòng có dấu * nhưng action trống:
--       waiting_notification -> returned_to_manager
--       waiting_notification -> customer_notified
--   - Không tạo status mới "Kết thúc" (chưa chốt status_code)
-- ============================================================================

SET @workflow_id := 1;

-- ============================================================================
-- A) DISABLE transitions theo cột F = "Xoá"
-- ============================================================================

UPDATE customer_request_status_transitions
SET is_active = 0,
    updated_at = NOW(),
    notes = CONCAT(IFNULL(notes, ''), IF(IFNULL(notes, '') = '', '', ' | '), '0904:disable')
WHERE workflow_definition_id = @workflow_id
  AND (
    (from_status_code = 'assigned_to_receiver' AND to_status_code = 'in_progress') OR
    (from_status_code = 'completed' AND to_status_code = 'assigned_to_receiver') OR
    (from_status_code = 'completed' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'completed' AND to_status_code = 'waiting_notification') OR
    (from_status_code = 'completed' AND to_status_code = 'customer_notified') OR
    (from_status_code = 'in_progress' AND to_status_code = 'completed') OR
    (from_status_code = 'in_progress' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'analysis' AND to_status_code = 'analysis_completed') OR
    (from_status_code = 'analysis' AND to_status_code = 'analysis_suspended') OR
    (from_status_code = 'analysis_completed' AND to_status_code = 'dms_transfer') OR
    (from_status_code = 'analysis_completed' AND to_status_code = 'coding') OR
    (from_status_code = 'analysis_completed' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'analysis_suspended' AND to_status_code = 'analysis') OR
    (from_status_code = 'analysis_suspended' AND to_status_code = 'analysis_completed') OR
    (from_status_code = 'analysis_suspended' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'dms_transfer' AND to_status_code = 'dms_task_created') OR
    (from_status_code = 'dms_task_created' AND to_status_code = 'dms_in_progress') OR
    (from_status_code = 'dms_task_created' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'dms_in_progress' AND to_status_code = 'completed') OR
    (from_status_code = 'dms_in_progress' AND to_status_code = 'dms_suspended') OR
    (from_status_code = 'dms_in_progress' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'dms_suspended' AND to_status_code = 'dms_in_progress') OR
    (from_status_code = 'dms_suspended' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'coding' AND to_status_code = 'coding_in_progress') OR
    (from_status_code = 'coding_in_progress' AND to_status_code = 'completed') OR
    (from_status_code = 'coding_in_progress' AND to_status_code = 'coding_suspended') OR
    (from_status_code = 'coding_in_progress' AND to_status_code = 'returned_to_manager') OR
    (from_status_code = 'coding_suspended' AND to_status_code = 'coding_in_progress') OR
    (from_status_code = 'coding_suspended' AND to_status_code = 'returned_to_manager')
  );

-- ============================================================================
-- B) INSERT/REACTIVATE transitions theo cột F = "Thêm"
-- ============================================================================

-- Helper pattern: nếu đã có row thì bật lại is_active=1, nếu chưa có thì insert mới.

-- 1) assigned_to_receiver -> waiting_notification (actor R)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'assigned_to_receiver', 'waiting_notification', 'Chờ thông báo khách hàng',
       JSON_ARRAY('R'), NULL, 'forward', 0, 1, 30, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'assigned_to_receiver'
    AND to_status_code = 'waiting_notification'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'assigned_to_receiver'
  AND to_status_code = 'waiting_notification';

-- 2) assigned_to_receiver -> customer_notified (actor R)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'assigned_to_receiver', 'customer_notified', 'Thông báo khách hàng',
       JSON_ARRAY('R'), NULL, 'forward', 0, 1, 40, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'assigned_to_receiver'
    AND to_status_code = 'customer_notified'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'assigned_to_receiver'
  AND to_status_code = 'customer_notified';

-- 3) returned_to_manager -> closed (actor A)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'returned_to_manager', 'closed', 'Đóng yêu cầu',
       JSON_ARRAY('A'), NULL, 'forward', 0, 1, 80, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'returned_to_manager'
    AND to_status_code = 'closed'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'returned_to_manager'
  AND to_status_code = 'closed';

-- 4) returned_to_manager -> customer_notified (actor A)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'returned_to_manager', 'customer_notified', 'Thông báo khách hàng',
       JSON_ARRAY('A'), NULL, 'forward', 0, 1, 90, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'returned_to_manager'
    AND to_status_code = 'customer_notified'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'returned_to_manager'
  AND to_status_code = 'customer_notified';

-- 5) not_executed -> waiting_notification (actor all)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'not_executed', 'waiting_notification', 'Chờ thông báo khách hàng',
       JSON_ARRAY('all'), NULL, 'forward', 0, 1, 15, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'not_executed'
    AND to_status_code = 'waiting_notification'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'not_executed'
  AND to_status_code = 'waiting_notification';

-- 6) not_executed -> closed (actor all)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'not_executed', 'closed', 'Đóng yêu cầu',
       JSON_ARRAY('all'), NULL, 'forward', 0, 1, 25, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'not_executed'
    AND to_status_code = 'closed'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'not_executed'
  AND to_status_code = 'closed';

-- 7) dms_transfer -> waiting_notification (actor all)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'dms_transfer', 'waiting_notification', 'Chờ thông báo khách hàng',
       JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'dms_transfer'
    AND to_status_code = 'waiting_notification'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'dms_transfer'
  AND to_status_code = 'waiting_notification';

-- 8) dms_transfer -> customer_notified (actor all)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'dms_transfer', 'customer_notified', 'Thông báo khách hàng',
       JSON_ARRAY('all'), NULL, 'forward', 0, 1, 40, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'dms_transfer'
    AND to_status_code = 'customer_notified'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'dms_transfer'
  AND to_status_code = 'customer_notified';

-- 9) coding -> waiting_notification (actor R)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'coding', 'waiting_notification', 'Chờ thông báo khách hàng',
       JSON_ARRAY('R'), NULL, 'forward', 0, 1, 30, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'coding'
    AND to_status_code = 'waiting_notification'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'coding'
  AND to_status_code = 'waiting_notification';

-- 10) coding -> customer_notified (actor R)
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, transition_config, direction, is_default, is_active, sort_order, notes, transition_meta_json, created_at, updated_at
)
SELECT @workflow_id, 'coding', 'customer_notified', 'Thông báo khách hàng',
       JSON_ARRAY('R'), NULL, 'forward', 0, 1, 40, '0904:add', NULL, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'coding'
    AND to_status_code = 'customer_notified'
);

UPDATE customer_request_status_transitions
SET is_active = 1, updated_at = NOW(), notes = '0904:reactivate'
WHERE workflow_definition_id = @workflow_id
  AND from_status_code = 'coding'
  AND to_status_code = 'customer_notified';

COMMIT;

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT 'active_transition_count' AS metric, COUNT(*) AS value
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_id
  AND is_active = 1;

SELECT from_status_code,
       GROUP_CONCAT(to_status_code ORDER BY sort_order, id SEPARATOR ' -> ') AS active_targets
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_id
  AND is_active = 1
GROUP BY from_status_code
ORDER BY from_status_code;
