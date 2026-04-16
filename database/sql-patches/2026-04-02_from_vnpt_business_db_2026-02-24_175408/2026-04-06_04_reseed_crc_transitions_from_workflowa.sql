SET NAMES utf8mb4;

START TRANSACTION;

-- Reseed CRC transitions for Workflow A (id = 1)
-- Source of truth: current database transition graph

DELETE FROM `customer_request_status_transitions`
WHERE `workflow_definition_id` = 1;

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
  `transition_meta_json`,
  `created_at`,
  `updated_at`
)
VALUES
  (1, 'analysis', 'analysis_completed', 'Chuyển BA Phân tích hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis', 'analysis_suspended', 'Chuyển BA Phân tích tạm ngưng', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'analysis_completed', 'dms_transfer', 'Chuyển DMS', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis_completed', 'coding', 'Lập trình', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis_completed', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'analysis_suspended', 'analysis', 'Chuyển BA Phân tích', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis_suspended', 'analysis_completed', 'Chuyển BA Phân tích hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'analysis_suspended', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'assigned_to_receiver', 'in_progress', 'R Đang thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'assigned_to_receiver', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'coding', 'coding_in_progress', 'Dev đang thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'coding', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'coding_in_progress', 'completed', 'Hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'coding_in_progress', 'coding_suspended', 'Dev tạm ngưng', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'coding_in_progress', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'coding_suspended', 'coding_in_progress', 'Dev đang thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'coding_suspended', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'completed', 'assigned_to_receiver', 'Giao R thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'completed', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'completed', 'customer_notified', 'Thông báo khách hàng', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'customer_notified', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),

  (1, 'dms_in_progress', 'completed', 'Hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'dms_in_progress', 'dms_suspended', 'DMS tạm ngưng', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'dms_in_progress', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),

  (1, 'dms_suspended', 'dms_in_progress', 'DMS Đang thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'dms_suspended', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'dms_task_created', 'dms_in_progress', 'DMS Đang thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'dms_task_created', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'dms_transfer', 'dms_task_created', 'Tạo task', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'dms_transfer', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'in_progress', 'completed', 'Hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'in_progress', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'new_intake', 'assigned_to_receiver', 'Giao R thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'new_intake', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'not_executed', 'customer_notified', 'Thông báo khách hàng', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'not_executed', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),

  (1, 'returned_to_manager', 'not_executed', 'Không tiếp nhận', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'waiting_customer_feedback', 'Chờ khách hàng cung cấp thông tin', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'assigned_to_receiver', 'Giao R thực hiện', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 30, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'analysis', 'Chuyển BA Phân tích', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 40, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'dms_transfer', 'Chuyển DMS', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 50, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'coding', 'Lập trình', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 60, 'db-synced', NULL, NOW(), NOW()),
  (1, 'returned_to_manager', 'completed', 'Hoàn thành', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 70, 'db-synced', NULL, NOW(), NOW()),

  (1, 'waiting_customer_feedback', 'assigned_to_receiver', 'Giao R thực hiện', JSON_ARRAY('all'), NULL, 'forward', 1, 1, 10, 'db-synced', NULL, NOW(), NOW()),
  (1, 'waiting_customer_feedback', 'returned_to_manager', 'Giao PM/Trả YC cho PM', JSON_ARRAY('all'), NULL, 'forward', 0, 1, 20, 'db-synced', NULL, NOW(), NOW());

COMMIT;
