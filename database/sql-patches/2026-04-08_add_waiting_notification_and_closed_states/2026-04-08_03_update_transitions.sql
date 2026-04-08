-- 2026-04-08_03_update_transitions.sql
-- Cập nhật transitions cho workflow với 2 trạng thái mới
-- Date: 2026-04-08
-- Author: VNPT Business Management Team

-- ============================================================================
-- MỤC ĐÍCH: Xóa transitions cũ, thêm transitions mới
-- ============================================================================

SET NAMES utf8mb4;

START TRANSACTION;

-- ============================================================================
-- 1. XÓA TRANSITIONS CŨ
-- ============================================================================

-- Xóa: completed → customer_notified (thay bằng completed → waiting_notification)
DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1
  AND `from_status_code` = 'completed'
  AND `to_status_code` = 'customer_notified';

-- Xóa: customer_notified → pending_dispatch (sẽ thêm lại với sort_order mới)
DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1
  AND `from_status_code` = 'customer_notified'
  AND `to_status_code` = 'pending_dispatch';

-- ============================================================================
-- 2. THÊM TRANSITIONS MỚI
-- ============================================================================

INSERT INTO `customer_request_status_transitions` (
  `workflow_definition_id`,
  `from_status_code`,
  `to_status_code`,
  `process_name_vi`,
  `allowed_roles`,
  `transition_config`,
  `direction`,
  `is_default`,
  `is_active`,
  `sort_order`,
  `notes`,
  `created_at`,
  `updated_at`
) VALUES

-- Từ completed → waiting_notification (PRIMARY)
(1, 'completed', 'waiting_notification', 'Chờ thông báo khách hàng', '["all"]', NULL, 'forward', 1, 1, 30,
 'Chuyển sang trạng thái chờ thông báo khách hàng', NOW(), NOW()),

-- Từ completed → pending_dispatch (vẫn giữ để quay lại PM nếu cần)
(1, 'completed', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 35,
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ waiting_notification → customer_notified (PRIMARY)
(1, 'waiting_notification', 'customer_notified', 'Thông báo khách hàng', '["all"]', NULL, 'forward', 1, 1, 10,
 'Đã thông báo khách hàng thành công', NOW(), NOW()),

-- Từ waiting_notification → pending_dispatch (QUAY LẠI PM)
(1, 'waiting_notification', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 20,
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ customer_notified → closed (PRIMARY - MỚI)
(1, 'customer_notified', 'closed', 'Đóng yêu cầu', '["all"]', NULL, 'forward', 1, 1, 10,
 'Đóng yêu cầu sau khi thông báo khách hàng', NOW(), NOW()),

-- Từ customer_notified → pending_dispatch (GIỮ LẠI)
(1, 'customer_notified', 'pending_dispatch', 'Giao PM/Trả YC cho PM', '["all"]', NULL, 'forward', 0, 1, 20,
 'Quay lại người quản lý', NOW(), NOW()),

-- Từ closed → pending_dispatch (MỞ LẠI YÊU CẦU - nếu cần)
(1, 'closed', 'pending_dispatch', 'Mở lại yêu cầu', '["all"]', NULL, 'forward', 0, 1, 10,
 'Mở lại yêu cầu đã đóng', NOW(), NOW());

COMMIT;

-- ============================================================================
-- 3. VERIFY KẾT QUẢ
-- ============================================================================

-- Hiển thị transitions mới theo from_status_code
SELECT
  id,
  from_status_code,
  to_status_code,
  process_name_vi,
  allowed_roles,
  is_default,
  sort_order
FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1
  AND (
    `from_status_code` IN ('completed', 'waiting_notification', 'customer_notified', 'closed')
    OR `to_status_code` IN ('waiting_notification', 'closed')
  )
ORDER BY `from_status_code`, `sort_order`;

-- Đếm số lượng transitions
SELECT
  'Total transitions for workflow 1' AS report,
  COUNT(*) AS total_count
FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
