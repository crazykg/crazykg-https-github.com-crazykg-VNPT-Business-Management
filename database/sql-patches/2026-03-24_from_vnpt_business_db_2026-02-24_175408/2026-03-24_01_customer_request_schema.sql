SET NAMES utf8mb4;

-- Add PM decision metadata to customer_request_status_instances.
ALTER TABLE `customer_request_status_instances`
    ADD COLUMN `decision_context_code` VARCHAR(80) NULL COMMENT 'Mã context decision nghiệp vụ' AFTER `next_instance_id`,
    ADD COLUMN `decision_outcome_code` VARCHAR(80) NULL COMMENT 'Kết quả chọn trong decision' AFTER `decision_context_code`,
    ADD COLUMN `decision_source_status_code` VARCHAR(80) NULL COMMENT 'Trạng thái nguồn phát sinh decision' AFTER `decision_outcome_code`;
