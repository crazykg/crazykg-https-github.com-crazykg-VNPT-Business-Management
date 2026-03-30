-- Clear Customer Request Data (Keep Workflow)
-- Date: 2026-03-29

SET FOREIGN_KEY_CHECKS=0;

-- Xóa table con tr??c
TRUNCATE TABLE customer_request_status_attachments;
TRUNCATE TABLE customer_request_status_ref_tasks;
TRUNCATE TABLE customer_request_worklogs;
TRUNCATE TABLE customer_request_estimates;
TRUNCATE TABLE customer_request_status_instances;

-- Xóa table status-specific
TRUNCATE TABLE customer_request_in_progress;
TRUNCATE TABLE customer_request_analysis;
TRUNCATE TABLE customer_request_coding;
TRUNCATE TABLE customer_request_dms_transfer;
TRUNCATE TABLE customer_request_completed;
TRUNCATE TABLE customer_request_customer_notified;
TRUNCATE TABLE customer_request_not_executed;
TRUNCATE TABLE customer_request_returned_to_manager;
TRUNCATE TABLE customer_request_waiting_customer_feedbacks;

-- Xóa table chính sau cùng
TRUNCATE TABLE customer_request_cases;

SET FOREIGN_KEY_CHECKS=1;

-- Verify
SELECT 'workflow_definitions' AS table_name, COUNT(*) AS row_count FROM workflow_definitions
UNION ALL
SELECT 'customer_request_status_transitions', COUNT(*) FROM customer_request_status_transitions
UNION ALL
SELECT 'customer_request_cases', COUNT(*) FROM customer_request_cases;
