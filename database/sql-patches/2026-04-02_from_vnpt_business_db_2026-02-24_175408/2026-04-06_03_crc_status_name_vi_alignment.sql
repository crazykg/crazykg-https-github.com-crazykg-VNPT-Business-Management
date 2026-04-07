SET NAMES utf8mb4;

START TRANSACTION;

UPDATE `customer_request_status_catalogs`
SET `status_name_vi` = CASE `status_code`
    WHEN 'new_intake' THEN 'Tiếp nhận'
    WHEN 'assigned_to_receiver' THEN 'Giao R thực hiện'
    WHEN 'receiver_in_progress' THEN 'R đang thực hiện'
    WHEN 'pending_dispatch' THEN 'Chờ PM điều phối'
    WHEN 'dispatched' THEN 'Đã phân công'
    WHEN 'waiting_customer_feedback' THEN 'Chờ khách hàng cung cấp thông tin'
    WHEN 'in_progress' THEN 'R Đang thực hiện'
    WHEN 'coding' THEN 'Lập trình'
    WHEN 'coding_in_progress' THEN 'Dev đang thực hiện'
    WHEN 'coding_suspended' THEN 'Dev tạm ngưng'
    WHEN 'dms_transfer' THEN 'Chuyển DMS'
    WHEN 'dms_task_created' THEN 'Tạo task'
    WHEN 'dms_in_progress' THEN 'DMS Đang thực hiện'
    WHEN 'dms_suspended' THEN 'DMS tạm ngưng'
    WHEN 'not_executed' THEN 'Không tiếp nhận'
    WHEN 'completed' THEN 'Hoàn thành'
    WHEN 'customer_notified' THEN 'Thông báo khách hàng'
    WHEN 'returned_to_manager' THEN 'Giao PM/Trả YC cho PM'
    WHEN 'analysis' THEN 'Chuyển BA Phân tích'
    WHEN 'analysis_completed' THEN 'Chuyển BA Phân tích hoàn thành'
    WHEN 'analysis_suspended' THEN 'Chuyển BA Phân tích tạm ngưng'
    ELSE `status_name_vi`
END
WHERE `workflow_definition_id` = 1;

COMMIT;
