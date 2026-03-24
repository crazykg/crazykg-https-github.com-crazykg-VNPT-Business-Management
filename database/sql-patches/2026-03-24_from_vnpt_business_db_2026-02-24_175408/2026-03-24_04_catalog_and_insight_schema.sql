SET NAMES utf8mb4;

-- Covering indexes for customer insight queries.
ALTER TABLE `contracts`
    ADD INDEX `idx_cont_cust_del` (`customer_id`, `deleted_at`),
    ADD INDEX `idx_cont_cust_insight` (`customer_id`, `deleted_at`, `status`, `total_value`);

ALTER TABLE `contract_items`
    ADD INDEX `idx_ci_product_contract` (`product_id`, `contract_id`);

ALTER TABLE `opportunities`
    ADD COLUMN `priority` TINYINT UNSIGNED NOT NULL DEFAULT '2' COMMENT '1=Thấp 2=TB 3=Cao 4=Khẩn' AFTER `stage`,
    ADD INDEX `idx_opp_insight` (`customer_id`, `deleted_at`, `stage`, `expected_value`),
    ADD INDEX `idx_opp_priority` (`priority`);

ALTER TABLE `customer_request_cases`
    ADD INDEX `idx_crc_cust_insight` (`customer_id`, `deleted_at`, `current_status_code`);

-- Business and master-data supporting fields.
ALTER TABLE `business_domains`
    ADD COLUMN `focal_point_name` VARCHAR(255) NULL AFTER `domain_name`,
    ADD COLUMN `focal_point_phone` VARCHAR(50) NULL AFTER `focal_point_name`,
    ADD COLUMN `focal_point_email` VARCHAR(255) NULL AFTER `focal_point_phone`;

ALTER TABLE `products`
    ADD COLUMN `package_name` VARCHAR(255) NULL AFTER `product_name`;

ALTER TABLE `projects`
    ADD COLUMN `status_reason` TEXT NULL AFTER `status`;
