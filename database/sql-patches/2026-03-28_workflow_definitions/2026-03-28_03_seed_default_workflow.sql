-- 2026-03-28_03_seed_default_workflow.sql
-- Seed workflow mặc định LUONG_A (Luồng xử lý A)
-- Date: 2026-03-28
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Tạo workflow mặc định LUONG_A với các transitions cơ bản
-- ============================================================================
-- Workflow này là default cho customer_request process
-- Sẽ có thêm 46 transitions chi tiết từ script 04 (workflowa.xlsx)
-- ============================================================================

-- ============================================================================
-- 1. TẠO WORKFLOW LUONG_A
-- ============================================================================

-- Xóa workflow cũ nếu tồn tại (cẩn thận: sẽ xóa transitions liên quan)
DELETE FROM customer_request_status_transitions WHERE workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE code = 'LUONG_A'
);
DELETE FROM workflow_definitions WHERE code = 'LUONG_A';

-- Insert workflow LUONG_A
INSERT INTO workflow_definitions (
    `code`,
    `name`,
    `description`,
    `process_type`,
    `is_active`,
    `is_default`,
    `version`,
    `config`,
    `created_at`,
    `updated_at`,
    `activated_at`
) VALUES (
    'LUONG_A',
    'Luồng xử lý A',
    'Luồng xử lý yêu cầu khách hàng mặc định - Hệ thống VNPT Business Management',
    'customer_request',
    TRUE,
    TRUE,
    '1.0',
    JSON_OBJECT(
        'notification_enabled', TRUE,
        'sla_enabled', TRUE,
        'auto_escalation', FALSE,
        'allow_backward_transition', TRUE
    ),
    NOW(),
    NOW(),
    NOW()
);

-- ============================================================================
-- 2. VERIFY WORKFLOW VỪA TẠO
-- ============================================================================

SELECT 
    'Workflow LUONG_A created' AS status,
    id,
    code,
    name,
    is_active,
    is_default,
    version
FROM workflow_definitions 
WHERE code = 'LUONG_A';

-- ============================================================================
-- 3. TẠO CÁC TRANSITIONS CƠ BẢN (TỐI THIỂU ĐỂ HỆ THỐNG HOẠT ĐỘNG)
-- ============================================================================

-- Lấy ID của workflow LUONG_A
SET @workflow_a_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A' LIMIT 1);

-- Insert các transitions tối thiểu cho luồng new_intake
INSERT INTO customer_request_status_transitions (
    workflow_definition_id,
    from_status_code,
    to_status_code,
    allowed_roles,
    sort_order,
    is_active,
    created_at,
    updated_at
) VALUES
    -- Từ new_intake có thể chuyển đến:
    (@workflow_a_id, 'new_intake', 'assigned_to_receiver', '["R"]', 1, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'new_intake', 'pending_dispatch', '["all"]', 2, TRUE, NOW(), NOW()),
    
    -- Từ pending_dispatch có thể chuyển đến:
    (@workflow_a_id, 'pending_dispatch', 'assigned_to_receiver', '["A"]', 3, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'pending_dispatch', 'analysis', '["A"]', 4, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'pending_dispatch', 'not_executed', '["A"]', 5, TRUE, NOW(), NOW()),
    
    -- Từ assigned_to_receiver có thể chuyển đến:
    (@workflow_a_id, 'assigned_to_receiver', 'receiver_in_progress', '["R"]', 6, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'assigned_to_receiver', 'pending_dispatch', '["R"]', 7, TRUE, NOW(), NOW()),
    
    -- Từ receiver_in_progress có thể chuyển đến:
    (@workflow_a_id, 'receiver_in_progress', 'completed', '["R"]', 8, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'receiver_in_progress', 'pending_dispatch', '["R"]', 9, TRUE, NOW(), NOW()),
    
    -- Từ completed có thể chuyển đến:
    (@workflow_a_id, 'completed', 'customer_notified', '["all"]', 10, TRUE, NOW(), NOW()),
    (@workflow_a_id, 'completed', 'pending_dispatch', '["all"]', 11, TRUE, NOW(), NOW());

-- ============================================================================
-- 4. VERIFY TRANSITIONS VỪA TẠO
-- ============================================================================

SELECT 
    'Basic transitions created' AS status,
    COUNT(*) AS transition_count
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_a_id;

-- Hiển thị chi tiết transitions
SELECT 
    t.sort_order,
    t.from_status_code,
    t.to_status_code,
    t.allowed_roles,
    t.is_active
FROM customer_request_status_transitions t
WHERE t.workflow_definition_id = @workflow_a_id
ORDER BY t.sort_order;

-- ============================================================================
-- 5. SUMMARY
-- ============================================================================

SELECT 
    'Seed completed' AS status,
    w.code AS workflow_code,
    w.name AS workflow_name,
    w.is_active,
    w.is_default,
    COUNT(t.id) AS transition_count
FROM workflow_definitions w
LEFT JOIN customer_request_status_transitions t ON w.id = t.workflow_definition_id
WHERE w.code = 'LUONG_A'
GROUP BY w.id, w.code, w.name, w.is_active, w.is_default;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
