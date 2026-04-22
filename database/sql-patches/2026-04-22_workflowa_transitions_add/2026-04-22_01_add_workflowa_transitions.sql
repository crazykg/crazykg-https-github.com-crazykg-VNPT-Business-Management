-- ============================================================================
-- 2026-04-22_01_add_workflowa_transitions.sql
-- Mục tiêu: Thêm mới 9 transitions theo file workflowa (2).xlsx
-- Ngày: 2026-04-22
-- Tác giả: VNPT Business Management Team
-- Nguồn: workflowa (2).xlsx
-- ============================================================================
-- LƯU Ý: Chỉ thêm mới, KHÔNG vô hiệu hóa các transitions hiện tại
-- ============================================================================

SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 1. LẤY WORKFLOW_ID CỦA LUONG_A (workflow_definition_id = 1)
-- ============================================================================

SET @workflow_id := 1;

-- Kiểm tra workflow tồn tại
SELECT
    'Workflow LUONG_A found' AS status,
    @workflow_id AS workflow_id;

-- ============================================================================
-- 2. THÊM MỚI 9 TRANSITIONS TỪ WORKFLOWA (2).XLSX
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. new_intake → not_executed (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'not_executed', 'Không tiếp nhận',
       JSON_ARRAY('all'), 'forward', 0, 1, 10, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'not_executed'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 2. new_intake → closed (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'closed', 'Đóng yêu cầu',
       JSON_ARRAY('all'), 'forward', 0, 1, 20, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'closed'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 3. new_intake → waiting_customer_feedback (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'waiting_customer_feedback', 'Chờ khách hàng cung cấp thông tin',
       JSON_ARRAY('all'), 'forward', 0, 1, 30, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'waiting_customer_feedback'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 4. new_intake → analysis (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'analysis', 'Chuyển BA Phân tích',
       JSON_ARRAY('all'), 'forward', 0, 1, 40, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'analysis'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 5. new_intake → dms_transfer (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'dms_transfer', 'Chuyển DMS',
       JSON_ARRAY('all'), 'forward', 0, 1, 50, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'dms_transfer'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 6. new_intake → coding (Tất cả)
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'new_intake', 'coding', 'Lập trình',
       JSON_ARRAY('all'), 'forward', 0, 1, 60, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'new_intake'
    AND to_status_code = 'coding'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 7. assigned_to_receiver → assigned_to_receiver (A) - self-loop
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'assigned_to_receiver', 'assigned_to_receiver', 'Giao R thực hiện',
       JSON_ARRAY('A'), 'forward', 0, 1, 70, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'assigned_to_receiver'
    AND to_status_code = 'assigned_to_receiver'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 8. coding → coding (A) - self-loop
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'coding', 'coding', 'Lập trình',
       JSON_ARRAY('A'), 'forward', 0, 1, 80, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'coding'
    AND to_status_code = 'coding'
    AND is_active = 1
);

-- -----------------------------------------------------------------------------
-- 9. analysis → analysis (A) - self-loop
-- -----------------------------------------------------------------------------
INSERT INTO customer_request_status_transitions (
  workflow_definition_id, from_status_code, to_status_code, process_name_vi,
  allowed_roles, direction, is_default, is_active, sort_order, notes, created_at, updated_at
)
SELECT @workflow_id, 'analysis', 'analysis', 'Chuyển BA Phân tích',
       JSON_ARRAY('A'), 'forward', 0, 1, 90, 'workflowa-2026-04-22', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_request_status_transitions
  WHERE workflow_definition_id = @workflow_id
    AND from_status_code = 'analysis'
    AND to_status_code = 'analysis'
    AND is_active = 1
);

-- ============================================================================
-- 3. VERIFY KẾT QUẢ
-- ============================================================================

-- Đếm số lượng transitions active
SELECT
    'Import completed' AS status,
    COUNT(*) AS transition_count
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_id AND is_active = 1;

-- Hiển thị chi tiết transitions theo from_status_code
SELECT
    from_status_code,
    GROUP_CONCAT(to_status_code ORDER BY sort_order, id SEPARATOR ' → ') AS active_targets
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_id AND is_active = 1
GROUP BY from_status_code
ORDER BY from_status_code;

-- ============================================================================
-- 4. SUMMARY
-- ============================================================================

SELECT
    '=== IMPORT SUMMARY ===' AS report,
    w.code AS workflow_code,
    w.name AS workflow_name,
    w.is_active,
    COUNT(t.id) AS total_transitions,
    SUM(CASE WHEN t.allowed_roles = '["all"]' THEN 1 ELSE 0 END) AS all_roles,
    SUM(CASE WHEN t.allowed_roles = '["A"]' THEN 1 ELSE 0 END) AS a_roles,
    SUM(CASE WHEN t.allowed_roles = '["R"]' THEN 1 ELSE 0 END) AS r_roles
FROM workflow_definitions w
LEFT JOIN customer_request_status_transitions t ON w.id = t.workflow_definition_id AND t.is_active = 1
WHERE w.code = 'LUONG_A'
GROUP BY w.id, w.code, w.name, w.is_active;

COMMIT;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
