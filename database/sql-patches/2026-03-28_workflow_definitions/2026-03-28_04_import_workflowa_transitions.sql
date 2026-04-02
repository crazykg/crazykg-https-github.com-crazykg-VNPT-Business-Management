-- 2026-03-28_04_import_workflowa_transitions.sql
-- Import 46 transitions từ file workflowa.xlsx
-- Date: 2026-03-28
-- Author: VNPT Business Management Team
-- Source: plan-code/Dieu_chinh_ql_yc_khach_hang/workflowa.xlsx

-- ============================================================================
-- MỤC ĐÍCH: Import 46 transitions từ Excel vào database cho workflow LUONG_A
-- ============================================================================
-- Mapping:
--   - Task hiện tại (Tiếng Việt) → from_status_code (English)
--   - Task tiếp theo (Tiếng Việt) → to_status_code (English)
--   - Tác nhân (Tất cả/R/A) → allowed_roles (JSON)
-- ============================================================================

-- ============================================================================
-- 1. LẤY WORKFLOW_ID CỦA LUONG_A
-- ============================================================================

SET @workflow_a_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A' LIMIT 1);

-- Kiểm tra workflow tồn tại
SELECT 
    'Workflow LUONG_A found' AS status,
    @workflow_a_id AS workflow_id;

-- ============================================================================
-- 2. XÓA TRANSITIONS CŨ (ĐỂ TRÁNH DUPLICATE)
-- ============================================================================

DELETE FROM customer_request_status_transitions 
WHERE workflow_definition_id = @workflow_a_id;

-- ============================================================================
-- 3. INSERT 46 TRANSITIONS TỪ WORKFLOWA.XLSX
-- ============================================================================

INSERT INTO customer_request_status_transitions (
    workflow_definition_id,
    from_status_code,
    to_status_code,
    process_name_vi,
    allowed_roles,
    sort_order,
    is_active,
    created_at,
    updated_at
) VALUES
    -- ========================================================================
    -- BẮT ĐẦU: Từ trạng thái Tiếp nhận (new_intake)
    -- ========================================================================

    -- Row 2: Bắt đầu | Tất cả | Tiếp nhận | Giao R thực hiện
    (@workflow_a_id, 'new_intake', 'assigned_to_receiver', 'Giao R thực hiện', '["R"]', 1, TRUE, NOW(), NOW()),

    -- Row 3: Bắt đầu | Tất cả | Tiếp nhận | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'new_intake', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 2, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Giao R thực hiện (assigned_to_receiver)
    -- ========================================================================

    -- Row 4: R | Giao R thực hiện | R Đang thực hiện
    (@workflow_a_id, 'assigned_to_receiver', 'receiver_in_progress', 'R Đang thực hiện', '["R"]', 3, TRUE, NOW(), NOW()),

    -- Row 5: R | Giao R thực hiện | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'assigned_to_receiver', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 4, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Giao PM/Trả YC cho PM (pending_dispatch)
    -- ========================================================================

    -- Row 6: A | Giao PM/Trả YC cho PM | Không tiếp nhận
    (@workflow_a_id, 'pending_dispatch', 'not_executed', 'Không tiếp nhận', '["A"]', 5, TRUE, NOW(), NOW()),

    -- Row 7: A | Giao PM/Trả YC cho PM | Chờ khách hàng cung cấp thông tin
    (@workflow_a_id, 'pending_dispatch', 'waiting_customer_feedback', 'Chờ khách hàng cung cấp thông tin', '["A"]', 6, TRUE, NOW(), NOW()),

    -- Row 8: A | Giao PM/Trả YC cho PM | Giao R thực hiện
    (@workflow_a_id, 'pending_dispatch', 'assigned_to_receiver', 'Giao R thực hiện', '["A"]', 7, TRUE, NOW(), NOW()),

    -- Row 9: A | Giao PM/Trả YC cho PM | Chuyển BA Phân tích
    (@workflow_a_id, 'pending_dispatch', 'analysis', 'Chuyển BA Phân tích', '["A"]', 8, TRUE, NOW(), NOW()),

    -- Row 10: A | Giao PM/Trả YC cho PM | Chuyển DMS
    (@workflow_a_id, 'pending_dispatch', 'dms_transfer', 'Chuyển DMS', '["A"]', 9, TRUE, NOW(), NOW()),

    -- Row 11: A | Giao PM/Trả YC cho PM | Lập trình
    (@workflow_a_id, 'pending_dispatch', 'coding', 'Lập trình', '["A"]', 10, TRUE, NOW(), NOW()),

    -- Row 12: A | Giao PM/Trả YC cho PM | Hoàn thành
    (@workflow_a_id, 'pending_dispatch', 'completed', 'Hoàn thành', '["A"]', 11, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Hoàn thành (completed)
    -- ========================================================================

    -- Row 13: A | Hoàn thành | Giao R thực hiện
    (@workflow_a_id, 'completed', 'assigned_to_receiver', 'Giao R thực hiện', '["A"]', 12, TRUE, NOW(), NOW()),

    -- Row 14: Tất cả | Hoàn thành | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'completed', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 13, TRUE, NOW(), NOW()),

    -- Row 15: Tất cả | Hoàn thành | Thông báo khách hàng
    (@workflow_a_id, 'completed', 'customer_notified', 'Thông báo khách hàng', '["all"]', 14, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: R Đang thực hiện (receiver_in_progress)
    -- ========================================================================

    -- Row 16: R | R Đang thực hiện | Hoàn thành
    (@workflow_a_id, 'receiver_in_progress', 'completed', 'Hoàn thành', '["R"]', 15, TRUE, NOW(), NOW()),

    -- Row 17: R | R Đang thực hiện | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'receiver_in_progress', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 16, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Không tiếp nhận (not_executed)
    -- ========================================================================

    -- Row 18: Tất cả | Không tiếp nhận | Thông báo khách hàng
    (@workflow_a_id, 'not_executed', 'customer_notified', 'Thông báo khách hàng', '["all"]', 17, TRUE, NOW(), NOW()),

    -- Row 19: Tất cả | Không tiếp nhận | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'not_executed', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 18, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Chờ khách hàng cung cấp thông tin (waiting_customer_feedback)
    -- ========================================================================

    -- Row 20: Tất cả | Chờ khách hàng cung cấp thông tin | Giao R thực hiện
    (@workflow_a_id, 'waiting_customer_feedback', 'receiver_in_progress', 'Giao R thực hiện', '["all"]', 19, TRUE, NOW(), NOW()),

    -- Row 21: Tất cả | Chờ khách hàng cung cấp thông tin | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'waiting_customer_feedback', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 20, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Chuyển BA Phân tích (analysis)
    -- ========================================================================

    -- Row 22: R | Chuyển BA Phân tích | Chuyển BA Phân tích hoàn thành
    (@workflow_a_id, 'analysis', 'analysis_completed', 'Chuyển BA Phân tích hoàn thành', '["R"]', 21, TRUE, NOW(), NOW()),

    -- Row 23: R | Chuyển BA Phân tích | Chuyển BA Phân tích tạm ngưng
    (@workflow_a_id, 'analysis', 'analysis_suspended', 'Chuyển BA Phân tích tạm ngưng', '["R"]', 22, TRUE, NOW(), NOW()),

    -- Row 24: R | Chuyển BA Phân tích | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'analysis', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 23, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Chuyển BA Phân tích hoàn thành (analysis_completed)
    -- ========================================================================

    -- Row 25: Tất cả | Chuyển BA Phân tích hoàn thành | Chuyển DMS
    (@workflow_a_id, 'analysis_completed', 'dms_transfer', 'Chuyển DMS', '["all"]', 24, TRUE, NOW(), NOW()),

    -- Row 26: Tất cả | Chuyển BA Phân tích hoàn thành | Lập trình
    (@workflow_a_id, 'analysis_completed', 'coding', 'Lập trình', '["all"]', 25, TRUE, NOW(), NOW()),

    -- Row 27: R | Chuyển BA Phân tích hoàn thành | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'analysis_completed', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 26, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Chuyển BA Phân tích tạm ngưng (analysis_suspended)
    -- ========================================================================

    -- Row 28: Tất cả | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích
    (@workflow_a_id, 'analysis_suspended', 'analysis', 'Chuyển BA Phân tích', '["all"]', 27, TRUE, NOW(), NOW()),

    -- Row 29: R | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích hoàn thành
    (@workflow_a_id, 'analysis_suspended', 'analysis_completed', 'Chuyển BA Phân tích hoàn thành', '["R"]', 28, TRUE, NOW(), NOW()),

    -- Row 30: R | Chuyển BA Phân tích tạm ngưng | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'analysis_suspended', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 29, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Chuyển DMS (dms_transfer)
    -- ========================================================================

    -- Row 31: Tất cả | Chuyển DMS | Tạo task
    (@workflow_a_id, 'dms_transfer', 'dms_task_created', 'Tạo task', '["all"]', 30, TRUE, NOW(), NOW()),

    -- Row 32: Tất cả | Chuyển DMS | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'dms_transfer', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 31, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Tạo task (dms_task_created)
    -- ========================================================================

    -- Row 33: Tất cả | Tạo task | DMS Đang thực hiện
    (@workflow_a_id, 'dms_task_created', 'dms_in_progress', 'DMS Đang thực hiện', '["all"]', 32, TRUE, NOW(), NOW()),

    -- Row 34: Tất cả | Tạo task | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'dms_task_created', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 33, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: DMS Đang thực hiện (dms_in_progress)
    -- ========================================================================

    -- Row 35: Tất cả | DMS Đang thực hiện | Hoàn thành
    (@workflow_a_id, 'dms_in_progress', 'completed', 'Hoàn thành', '["all"]', 34, TRUE, NOW(), NOW()),

    -- Row 36: Tất cả | DMS Đang thực hiện | DMS tạm ngưng
    (@workflow_a_id, 'dms_in_progress', 'dms_suspended', 'DMS tạm ngưng', '["all"]', 35, TRUE, NOW(), NOW()),

    -- Row 37: Tất cả | DMS Đang thực hiện | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'dms_in_progress', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 36, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: DMS tạm ngưng (dms_suspended)
    -- ========================================================================

    -- Row 38: Tất cả | DMS tạm ngưng | DMS Đang thực hiện
    (@workflow_a_id, 'dms_suspended', 'dms_in_progress', 'DMS Đang thực hiện', '["all"]', 37, TRUE, NOW(), NOW()),

    -- Row 39: Tất cả | DMS tạm ngưng | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'dms_suspended', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 38, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Lập trình (coding)
    -- ========================================================================

    -- Row 40: R | Lập trình | Dev đang thực hiện
    (@workflow_a_id, 'coding', 'coding_in_progress', 'Dev đang thực hiện', '["R"]', 39, TRUE, NOW(), NOW()),

    -- Row 41: R | Lập trình | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'coding', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 40, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Dev đang thực hiện (coding_in_progress)
    -- ========================================================================

    -- Row 42: R | Dev đang thực hiện | Hoàn thành
    (@workflow_a_id, 'coding_in_progress', 'completed', 'Hoàn thành', '["R"]', 41, TRUE, NOW(), NOW()),

    -- Row 43: R | Dev đang thực hiện | Dev tạm ngưng
    (@workflow_a_id, 'coding_in_progress', 'coding_suspended', 'Dev tạm ngưng', '["R"]', 42, TRUE, NOW(), NOW()),

    -- Row 44: R | Dev đang thực hiện | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'coding_in_progress', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 43, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- TỪ: Dev tạm ngưng (coding_suspended)
    -- ========================================================================

    -- Row 45: R | Dev tạm ngưng | Dev đang thực hiện
    (@workflow_a_id, 'coding_suspended', 'coding_in_progress', 'Dev đang thực hiện', '["R"]', 44, TRUE, NOW(), NOW()),

    -- Row 46: R | Dev tạm ngưng | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'coding_suspended', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["R"]', 45, TRUE, NOW(), NOW()),

    -- ========================================================================
    -- KẾT THÚC: Từ Thông báo khách hàng (customer_notified)
    -- ========================================================================

    -- Row 47: Kết thúc | Tất cả | Thông báo khách hàng | Giao PM/Trả YC cho PM
    (@workflow_a_id, 'customer_notified', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', 46, TRUE, NOW(), NOW());

-- ============================================================================
-- 4. VERIFY KẾT QUẢ
-- ============================================================================

-- Đếm số lượng transitions
SELECT 
    'Import completed' AS status,
    COUNT(*) AS transition_count
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_a_id;

-- Hiển thị chi tiết transitions theo sort_order
SELECT
    t.sort_order,
    t.from_status_code,
    t.to_status_code,
    t.process_name_vi,
    t.allowed_roles,
    t.is_active
FROM customer_request_status_transitions t
WHERE t.workflow_definition_id = @workflow_a_id
ORDER BY t.sort_order;

-- Kiểm tra transitions theo from_status_code
SELECT 
    from_status_code,
    GROUP_CONCAT(to_status_code ORDER BY sort_order SEPARATOR ' → ') AS transitions
FROM customer_request_status_transitions
WHERE workflow_definition_id = @workflow_a_id
GROUP BY from_status_code
ORDER BY MIN(sort_order);

-- ============================================================================
-- 5. SUMMARY
-- ============================================================================

SELECT 
    '=== IMPORT SUMMARY ===' AS report,
    w.code AS workflow_code,
    w.name AS workflow_name,
    w.is_active,
    COUNT(t.id) AS total_transitions,
    SUM(CASE WHEN t.allowed_roles = '["all"]' THEN 1 ELSE 0 END) AS all_roles,
    SUM(CASE WHEN t.allowed_roles = '["R"]' THEN 1 ELSE 0 END) AS r_roles,
    SUM(CASE WHEN t.allowed_roles = '["A"]' THEN 1 ELSE 0 END) AS a_roles
FROM workflow_definitions w
LEFT JOIN customer_request_status_transitions t ON w.id = t.workflow_definition_id
WHERE w.code = 'LUONG_A'
GROUP BY w.id, w.code, w.name, w.is_active;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
