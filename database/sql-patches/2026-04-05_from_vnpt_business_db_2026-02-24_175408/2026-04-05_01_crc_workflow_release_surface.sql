SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- 2026_03_28_000002_add_workflow_management_permissions
-- ----------------------------------------------------------------------------
INSERT INTO `permissions` (
  `perm_key`,
  `perm_name`,
  `perm_group`,
  `is_active`,
  `created_at`,
  `updated_at`
)
SELECT
  'workflow.manage',
  'Quản lý luồng công việc',
  'workflow',
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM `permissions`
  WHERE `perm_key` = 'workflow.manage'
);

INSERT INTO `role_permission` (
  `role_id`,
  `permission_id`,
  `created_at`,
  `updated_at`
)
SELECT
  `r`.`id`,
  `p`.`id`,
  NOW(),
  NOW()
FROM `roles` AS `r`
JOIN `permissions` AS `p`
  ON `p`.`perm_key` = 'workflow.manage'
LEFT JOIN `role_permission` AS `rp`
  ON `rp`.`role_id` = `r`.`id`
 AND `rp`.`permission_id` = `p`.`id`
WHERE `r`.`role_code` = 'ADMIN'
  AND `rp`.`role_id` IS NULL;

-- ----------------------------------------------------------------------------
-- workflow_definitions bootstrap required by CRC workflow metadata sync
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workflow_definitions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã luồng: LUONG_A, LUONG_B',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên luồng: Luồng xử lý A',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Mô tả luồng',
  `process_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer_request' COMMENT 'Loại quy trình: customer_request, project_procedure',
  `is_active` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Chỉ 1 luồng active tại thời điểm',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Luồng mặc định khi tạo mới',
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0' COMMENT 'Version luồng',
  `config` json DEFAULT NULL COMMENT 'Cấu hình bổ sung: notification, escalation rules',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'User tạo workflow',
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'User cập nhật workflow',
  `activated_at` timestamp NULL DEFAULT NULL COMMENT 'Thời điểm activate',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_workflow_code` (`code`),
  KEY `idx_workflow_process_type` (`process_type`),
  KEY `idx_workflow_active` (`process_type`,`is_active`),
  KEY `idx_workflow_default` (`process_type`,`is_default`),
  KEY `idx_workflow_deleted` (`deleted_at`),
  KEY `fk_workflow_created_by` (`created_by`),
  KEY `fk_workflow_updated_by` (`updated_by`),
  CONSTRAINT `fk_workflow_created_by` FOREIGN KEY (`created_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_workflow_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Định nghĩa luồng workflow';

INSERT INTO `workflow_definitions` (
  `code`,
  `name`,
  `description`,
  `process_type`,
  `is_active`,
  `is_default`,
  `version`,
  `config`,
  `activated_at`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
VALUES (
  'LUONG_A',
  'Luồng xử lý A',
  'Luồng xử lý yêu cầu khách hàng mặc định - Hệ thống VNPT Business Management',
  'customer_request',
  1,
  1,
  '1.0',
  JSON_OBJECT(
    'notification_enabled', TRUE,
    'sla_enabled', TRUE,
    'auto_escalation', FALSE,
    'allow_backward_transition', TRUE
  ),
  NOW(),
  NOW(),
  NOW(),
  NULL
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `process_type` = VALUES(`process_type`),
  `is_active` = VALUES(`is_active`),
  `is_default` = VALUES(`is_default`),
  `version` = VALUES(`version`),
  `config` = VALUES(`config`),
  `activated_at` = COALESCE(`workflow_definitions`.`activated_at`, VALUES(`activated_at`)),
  `updated_at` = VALUES(`updated_at`),
  `deleted_at` = NULL;

-- ----------------------------------------------------------------------------
-- 2026_03_29_094312_create_customer_request_assigned_to_receiver_table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_request_assigned_to_receiver` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned NOT NULL COMMENT 'Yêu cầu',
  `receiver_user_id` bigint unsigned DEFAULT NULL COMMENT 'Người thực hiện (R)',
  `accepted_at` datetime DEFAULT NULL COMMENT 'Ngày chấp nhận xử lý',
  `started_at` datetime DEFAULT NULL COMMENT 'Ngày bắt đầu xử lý',
  `expected_completed_at` datetime DEFAULT NULL COMMENT 'Ngày dự kiến hoàn thành',
  `processing_content` text COMMENT 'Nội dung xử lý',
  `notes` text COMMENT 'Ghi chú trạng thái',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'Người tạo',
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'Người cập nhật',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_request_assigned_to_receiver_request_case_id_index` (`request_case_id`),
  KEY `customer_request_assigned_to_receiver_receiver_user_id_index` (`receiver_user_id`),
  KEY `customer_request_assigned_to_receiver_created_by_index` (`created_by`),
  KEY `customer_request_assigned_to_receiver_updated_by_index` (`updated_by`),
  CONSTRAINT `fk_crc_assigned_to_receiver_case` FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Trạng thái Giao R thực hiện - yêu cầu khách hàng';

-- ----------------------------------------------------------------------------
-- 2026_03_29_141628_create_customer_request_receiver_in_progress_table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_request_receiver_in_progress` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_case_id` bigint unsigned NOT NULL COMMENT 'Yêu cầu',
  `receiver_user_id` bigint unsigned DEFAULT NULL COMMENT 'Người thực hiện (R)',
  `accepted_at` datetime DEFAULT NULL COMMENT 'Ngày chấp nhận xử lý',
  `started_at` datetime DEFAULT NULL COMMENT 'Ngày bắt đầu xử lý',
  `expected_completed_at` datetime DEFAULT NULL COMMENT 'Ngày dự kiến hoàn thành',
  `progress_percent` tinyint unsigned NOT NULL DEFAULT '0' COMMENT 'Tiến độ %',
  `processing_content` text COMMENT 'Nội dung xử lý',
  `notes` text COMMENT 'Ghi chú trạng thái',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'Người tạo',
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'Người cập nhật',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_request_receiver_in_progress_request_case_id_index` (`request_case_id`),
  KEY `customer_request_receiver_in_progress_receiver_user_id_index` (`receiver_user_id`),
  KEY `customer_request_receiver_in_progress_created_by_index` (`created_by`),
  KEY `customer_request_receiver_in_progress_updated_by_index` (`updated_by`),
  CONSTRAINT `fk_crc_receiver_in_progress_case` FOREIGN KEY (`request_case_id`) REFERENCES `customer_request_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Trạng thái R Đang thực hiện - yêu cầu khách hàng';

-- ----------------------------------------------------------------------------
-- 2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs
-- ----------------------------------------------------------------------------
SET @has_handler_field := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'handler_field'
);
SET @sql := IF(
  @has_handler_field = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN handler_field VARCHAR(120) NULL COMMENT 'Tên field user đại diện người xử lý hiện tại' AFTER table_name",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `customer_request_status_catalogs`
SET `handler_field` = CASE `status_code`
  WHEN 'new_intake' THEN 'received_by_user_id'
  WHEN 'pending_dispatch' THEN 'dispatcher_user_id'
  WHEN 'assigned_to_receiver' THEN 'receiver_user_id'
  WHEN 'receiver_in_progress' THEN 'receiver_user_id'
  WHEN 'in_progress' THEN 'performer_user_id'
  WHEN 'analysis' THEN 'performer_user_id'
  WHEN 'coding' THEN 'developer_user_id'
  WHEN 'dms_transfer' THEN 'dms_contact_user_id'
  WHEN 'completed' THEN 'completed_by_user_id'
  WHEN 'customer_notified' THEN 'notified_by_user_id'
  WHEN 'returned_to_manager' THEN 'returned_by_user_id'
  WHEN 'not_executed' THEN 'decision_by_user_id'
  ELSE `handler_field`
END,
`updated_at` = NOW()
WHERE `status_code` IN (
  'new_intake',
  'pending_dispatch',
  'assigned_to_receiver',
  'receiver_in_progress',
  'in_progress',
  'analysis',
  'coding',
  'dms_transfer',
  'completed',
  'customer_notified',
  'returned_to_manager',
  'not_executed'
);

-- ----------------------------------------------------------------------------
-- 2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table
-- ----------------------------------------------------------------------------
SET @has_nguoi_xu_ly_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND COLUMN_NAME = 'nguoi_xu_ly_id'
);
SET @sql := IF(
  @has_nguoi_xu_ly_id = 0,
  "ALTER TABLE customer_request_cases ADD COLUMN nguoi_xu_ly_id BIGINT UNSIGNED NULL COMMENT 'Người xử lý hiện tại của yêu cầu' AFTER performer_user_id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `customer_request_cases` AS `crc`
LEFT JOIN `customer_request_status_instances` AS `si`
  ON `si`.`request_case_id` = `crc`.`id`
 AND `si`.`is_current` = 1
LEFT JOIN `customer_request_assigned_to_receiver` AS `ar`
  ON `ar`.`request_case_id` = `crc`.`id`
LEFT JOIN `customer_request_receiver_in_progress` AS `rip`
  ON `rip`.`request_case_id` = `crc`.`id`
LEFT JOIN `customer_request_coding` AS `coding`
  ON `coding`.`status_instance_id` = `si`.`id`
LEFT JOIN `customer_request_dms_transfer` AS `dms`
  ON `dms`.`status_instance_id` = `si`.`id`
LEFT JOIN `customer_request_completed` AS `completed`
  ON `completed`.`status_instance_id` = `si`.`id`
LEFT JOIN `customer_request_customer_notified` AS `notified`
  ON `notified`.`status_instance_id` = `si`.`id`
LEFT JOIN `customer_request_returned_to_manager` AS `returned`
  ON `returned`.`status_instance_id` = `si`.`id`
LEFT JOIN `customer_request_not_executed` AS `ne`
  ON `ne`.`status_instance_id` = `si`.`id`
SET `crc`.`nguoi_xu_ly_id` = CASE
  WHEN `crc`.`current_status_code` = 'new_intake' THEN `crc`.`received_by_user_id`
  WHEN `crc`.`current_status_code` = 'pending_dispatch' THEN `crc`.`dispatcher_user_id`
  WHEN `crc`.`current_status_code` IN ('assigned_to_receiver', 'receiver_in_progress') THEN COALESCE(`rip`.`receiver_user_id`, `ar`.`receiver_user_id`, `crc`.`performer_user_id`, `crc`.`received_by_user_id`)
  WHEN `crc`.`current_status_code` IN ('in_progress', 'analysis') THEN `crc`.`performer_user_id`
  WHEN `crc`.`current_status_code` = 'coding' THEN COALESCE(`coding`.`developer_user_id`, `crc`.`performer_user_id`)
  WHEN `crc`.`current_status_code` = 'dms_transfer' THEN `dms`.`dms_contact_user_id`
  WHEN `crc`.`current_status_code` = 'completed' THEN COALESCE(`completed`.`completed_by_user_id`, `crc`.`performer_user_id`)
  WHEN `crc`.`current_status_code` = 'customer_notified' THEN `notified`.`notified_by_user_id`
  WHEN `crc`.`current_status_code` = 'returned_to_manager' THEN `returned`.`returned_by_user_id`
  WHEN `crc`.`current_status_code` = 'not_executed' THEN `ne`.`decision_by_user_id`
  ELSE COALESCE(`crc`.`performer_user_id`, `crc`.`dispatcher_user_id`, `crc`.`received_by_user_id`)
END;

-- ----------------------------------------------------------------------------
-- 2026_03_31_120000_extend_crc_workflow_metadata_schema
-- ----------------------------------------------------------------------------
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_cases ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL AFTER nguoi_xu_ly_id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_cases'
    AND INDEX_NAME = 'idx_crc_workflow_definition_id'
);
SET @sql := IF(
  @has_idx = 0,
  "ALTER TABLE customer_request_cases ADD INDEX idx_crc_workflow_definition_id (workflow_definition_id)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL AFTER id",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'group_code'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN group_code VARCHAR(80) NULL AFTER status_name_vi",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'group_label'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN group_label VARCHAR(255) NULL AFTER group_code",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'list_columns_json'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN list_columns_json JSON NULL AFTER handler_field",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'form_fields_json'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN form_fields_json JSON NULL AFTER list_columns_json",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'ui_meta_json'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN ui_meta_json JSON NULL AFTER form_fields_json",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND COLUMN_NAME = 'storage_mode'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_catalogs ADD COLUMN storage_mode VARCHAR(40) NULL AFTER ui_meta_json",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND COLUMN_NAME = 'workflow_definition_id'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_transitions ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL FIRST",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND COLUMN_NAME = 'transition_meta_json'
);
SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE customer_request_status_transitions ADD COLUMN transition_meta_json JSON NULL AFTER notes",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `customer_request_workflow_metadata` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workflow_definition_id` bigint unsigned NOT NULL,
  `master_fields_json` json DEFAULT NULL,
  `catalog_ui_meta_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crc_workflow_metadata_workflow_id` (`workflow_definition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Metadata runtime cấp workflow cho CRC';

SET @default_workflow_id := (
  SELECT `id`
  FROM `workflow_definitions`
  WHERE `process_type` = 'customer_request'
    AND `deleted_at` IS NULL
    AND `is_default` = 1
  ORDER BY `id` DESC
  LIMIT 1
);

SET @active_workflow_id := (
  SELECT `id`
  FROM `workflow_definitions`
  WHERE `process_type` = 'customer_request'
    AND `deleted_at` IS NULL
    AND `is_active` = 1
  ORDER BY `id` DESC
  LIMIT 1
);

SET @workflow_id := COALESCE(@default_workflow_id, @active_workflow_id);

UPDATE `customer_request_cases`
SET `workflow_definition_id` = @workflow_id,
    `updated_at` = NOW()
WHERE @workflow_id IS NOT NULL
  AND `workflow_definition_id` IS NULL;

UPDATE `customer_request_status_catalogs`
SET `workflow_definition_id` = @workflow_id,
    `updated_at` = NOW()
WHERE @workflow_id IS NOT NULL
  AND `workflow_definition_id` IS NULL;

UPDATE `customer_request_status_transitions`
SET `workflow_definition_id` = @workflow_id,
    `updated_at` = NOW()
WHERE @workflow_id IS NOT NULL
  AND `workflow_definition_id` IS NULL;

INSERT INTO `customer_request_workflow_metadata` (
  `workflow_definition_id`,
  `master_fields_json`,
  `catalog_ui_meta_json`,
  `created_at`,
  `updated_at`
)
SELECT
  @workflow_id,
  JSON_ARRAY(
    JSON_OBJECT('name', 'project_item_id', 'label', 'Khách hàng | Dự án | Sản phẩm', 'type', 'project_item_select', 'required', FALSE),
    JSON_OBJECT('name', 'summary', 'label', 'Nội dung yêu cầu', 'type', 'text', 'required', TRUE),
    JSON_OBJECT('name', 'project_id', 'label', 'Dự án', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'product_id', 'label', 'Sản phẩm', 'type', 'hidden', 'required', FALSE),
    JSON_OBJECT('name', 'customer_id', 'label', 'Khách hàng', 'type', 'customer_select', 'required', FALSE),
    JSON_OBJECT('name', 'customer_personnel_id', 'label', 'Người yêu cầu', 'type', 'customer_personnel_select', 'required', FALSE),
    JSON_OBJECT('name', 'support_service_group_id', 'label', 'Kênh tiếp nhận', 'type', 'support_group_select', 'required', FALSE),
    JSON_OBJECT('name', 'source_channel', 'label', 'Kênh khác', 'type', 'text', 'required', FALSE),
    JSON_OBJECT('name', 'priority', 'label', 'Độ ưu tiên', 'type', 'priority', 'required', FALSE),
    JSON_OBJECT('name', 'description', 'label', 'Mô tả chi tiết', 'type', 'textarea', 'required', FALSE)
  ),
  JSON_OBJECT(
    'groups', JSON_ARRAY(
      JSON_OBJECT('group_code', 'intake', 'group_label', 'Tiếp nhận'),
      JSON_OBJECT('group_code', 'processing', 'group_label', 'Xử lý'),
      JSON_OBJECT('group_code', 'analysis', 'group_label', 'Phân tích'),
      JSON_OBJECT('group_code', 'closure', 'group_label', 'Kết thúc')
    )
  ),
  NOW(),
  NOW()
WHERE @workflow_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  `master_fields_json` = VALUES(`master_fields_json`),
  `catalog_ui_meta_json` = VALUES(`catalog_ui_meta_json`),
  `updated_at` = VALUES(`updated_at`);

UPDATE `customer_request_status_catalogs`
SET
  `group_code` = CASE `status_code`
    WHEN 'new_intake' THEN 'intake'
    WHEN 'pending_dispatch' THEN 'intake'
    WHEN 'assigned_to_receiver' THEN 'intake'
    WHEN 'receiver_in_progress' THEN 'processing'
    WHEN 'waiting_customer_feedback' THEN 'processing'
    WHEN 'analysis' THEN 'analysis'
    WHEN 'returned_to_manager' THEN 'analysis'
    WHEN 'in_progress' THEN 'processing'
    WHEN 'coding' THEN 'processing'
    WHEN 'dms_transfer' THEN 'processing'
    WHEN 'completed' THEN 'closure'
    WHEN 'customer_notified' THEN 'closure'
    WHEN 'not_executed' THEN 'closure'
    ELSE `group_code`
  END,
  `group_label` = CASE `status_code`
    WHEN 'new_intake' THEN 'Tiếp nhận'
    WHEN 'pending_dispatch' THEN 'Tiếp nhận'
    WHEN 'assigned_to_receiver' THEN 'Tiếp nhận'
    WHEN 'receiver_in_progress' THEN 'Xử lý'
    WHEN 'waiting_customer_feedback' THEN 'Xử lý'
    WHEN 'analysis' THEN 'Phân tích'
    WHEN 'returned_to_manager' THEN 'Phân tích'
    WHEN 'in_progress' THEN 'Xử lý'
    WHEN 'coding' THEN 'Xử lý'
    WHEN 'dms_transfer' THEN 'Xử lý'
    WHEN 'completed' THEN 'Kết thúc'
    WHEN 'customer_notified' THEN 'Kết thúc'
    WHEN 'not_executed' THEN 'Kết thúc'
    ELSE `group_label`
  END,
  `storage_mode` = CASE
    WHEN `table_name` = 'customer_request_cases' THEN 'master'
    ELSE 'detail'
  END,
  `workflow_definition_id` = COALESCE(`workflow_definition_id`, @workflow_id),
  `updated_at` = NOW()
WHERE @workflow_id IS NULL
   OR `workflow_definition_id` = @workflow_id
   OR `workflow_definition_id` IS NULL;

UPDATE `customer_request_status_catalogs`
SET
  `list_columns_json` = CASE `status_code`
    WHEN 'assigned_to_receiver' THEN JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
      JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
      JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'received_at', 'label', 'Ngày tiếp nhận')
    )
    WHEN 'receiver_in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành'),
      JSON_OBJECT('key', 'progress_percent', 'label', 'Tiến độ')
    )
    ELSE COALESCE(`list_columns_json`, JSON_ARRAY())
  END,
  `form_fields_json` = CASE `status_code`
    WHEN 'assigned_to_receiver' THEN JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    )
    WHEN 'receiver_in_progress' THEN JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ', 'type', 'number', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    )
    ELSE COALESCE(`form_fields_json`, JSON_ARRAY())
  END,
  `ui_meta_json` = CASE `status_code`
    WHEN 'new_intake' THEN JSON_OBJECT('color_token', 'sky', 'bucket_code', 'new', 'owner_mode', 'receiver')
    WHEN 'pending_dispatch' THEN JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'dispatcher')
    WHEN 'assigned_to_receiver' THEN JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'receiver', 'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'R nhận xử lý'))
    WHEN 'receiver_in_progress' THEN JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'receiver')
    WHEN 'waiting_customer_feedback' THEN JSON_OBJECT('color_token', 'violet', 'bucket_code', 'waiting', 'owner_mode', 'receiver')
    WHEN 'analysis' THEN JSON_OBJECT('color_token', 'fuchsia', 'bucket_code', 'analysis', 'owner_mode', 'performer')
    WHEN 'returned_to_manager' THEN JSON_OBJECT('color_token', 'rose', 'bucket_code', 'analysis', 'owner_mode', 'dispatcher')
    WHEN 'in_progress' THEN JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'coding' THEN JSON_OBJECT('color_token', 'cyan', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'dms_transfer' THEN JSON_OBJECT('color_token', 'indigo', 'bucket_code', 'active', 'owner_mode', 'performer')
    WHEN 'completed' THEN JSON_OBJECT('color_token', 'emerald', 'bucket_code', 'done', 'owner_mode', 'performer', 'terminal', TRUE)
    WHEN 'customer_notified' THEN JSON_OBJECT('color_token', 'green', 'bucket_code', 'done', 'owner_mode', 'dispatcher', 'terminal', TRUE)
    WHEN 'not_executed' THEN JSON_OBJECT('color_token', 'slate', 'bucket_code', 'done', 'owner_mode', 'dispatcher', 'terminal', TRUE)
    ELSE COALESCE(`ui_meta_json`, JSON_OBJECT())
  END,
  `updated_at` = NOW()
WHERE @workflow_id IS NULL
   OR `workflow_definition_id` = @workflow_id
   OR `workflow_definition_id` IS NULL;

INSERT INTO `customer_request_status_catalogs` (
  `workflow_definition_id`,
  `status_code`,
  `status_name_vi`,
  `group_code`,
  `group_label`,
  `table_name`,
  `handler_field`,
  `list_columns_json`,
  `form_fields_json`,
  `ui_meta_json`,
  `storage_mode`,
  `sort_order`,
  `is_active`,
  `created_at`,
  `updated_at`
)
SELECT
  @workflow_id,
  `seed`.`status_code`,
  `seed`.`status_name_vi`,
  `seed`.`group_code`,
  `seed`.`group_label`,
  `seed`.`table_name`,
  `seed`.`handler_field`,
  `seed`.`list_columns_json`,
  `seed`.`form_fields_json`,
  `seed`.`ui_meta_json`,
  `seed`.`storage_mode`,
  `seed`.`sort_order`,
  1,
  NOW(),
  NOW()
FROM (
  SELECT
    'assigned_to_receiver' AS `status_code`,
    'Giao R thực hiện' AS `status_name_vi`,
    'intake' AS `group_code`,
    'Tiếp nhận' AS `group_label`,
    'customer_request_assigned_to_receiver' AS `table_name`,
    'receiver_user_id' AS `handler_field`,
    JSON_ARRAY(
      JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
      JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
      JSON_OBJECT('key', 'requester_name', 'label', 'Người yêu cầu'),
      JSON_OBJECT('key', 'support_service_group_name', 'label', 'Kênh tiếp nhận'),
      JSON_OBJECT('key', 'received_by_name', 'label', 'Người tiếp nhận'),
      JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
      JSON_OBJECT('key', 'received_at', 'label', 'Ngày tiếp nhận')
    ) AS `list_columns_json`,
    JSON_ARRAY(
      JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
      JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
      JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
    ) AS `form_fields_json`,
    JSON_OBJECT('color_token', 'amber', 'bucket_code', 'pending', 'owner_mode', 'receiver', 'primary_action', JSON_OBJECT('kind', 'transition', 'label', 'R nhận xử lý')) AS `ui_meta_json`,
    'detail' AS `storage_mode`,
    12 AS `sort_order`

    UNION ALL

    SELECT
      'receiver_in_progress',
      'R đang thực hiện',
      'processing',
      'Xử lý',
      'customer_request_receiver_in_progress',
      'receiver_user_id',
      JSON_ARRAY(
        JSON_OBJECT('key', 'request_code', 'label', 'ID yêu cầu'),
        JSON_OBJECT('key', 'summary', 'label', 'Nội dung'),
        JSON_OBJECT('key', 'receiver_user_id', 'label', 'Người thực hiện'),
        JSON_OBJECT('key', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành'),
        JSON_OBJECT('key', 'progress_percent', 'label', 'Tiến độ')
      ),
      JSON_ARRAY(
        JSON_OBJECT('name', 'receiver_user_id', 'label', 'Người thực hiện', 'type', 'user_select', 'required', FALSE),
        JSON_OBJECT('name', 'accepted_at', 'label', 'Ngày chấp nhận', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'started_at', 'label', 'Ngày bắt đầu', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'expected_completed_at', 'label', 'Ngày dự kiến hoàn thành', 'type', 'datetime', 'required', FALSE),
        JSON_OBJECT('name', 'progress_percent', 'label', 'Tiến độ', 'type', 'number', 'required', FALSE),
        JSON_OBJECT('name', 'processing_content', 'label', 'Nội dung xử lý', 'type', 'textarea', 'required', FALSE)
      ),
      JSON_OBJECT('color_token', 'blue', 'bucket_code', 'active', 'owner_mode', 'receiver'),
      'detail',
      13
) AS `seed`
LEFT JOIN `customer_request_status_catalogs` AS `c`
  ON `c`.`status_code` = `seed`.`status_code`
 AND ((@workflow_id IS NULL AND `c`.`workflow_definition_id` IS NULL) OR `c`.`workflow_definition_id` = @workflow_id)
WHERE @workflow_id IS NOT NULL
  AND `c`.`id` IS NULL;

UPDATE `customer_request_status_transitions`
SET `transition_meta_json` = CASE
    WHEN `from_status_code` = 'assigned_to_receiver' AND `to_status_code` = 'receiver_in_progress' AND `direction` = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_accept', 'decision_outcome_code', 'accept')
    WHEN `from_status_code` = 'receiver_in_progress' AND `to_status_code` = 'analysis' AND `direction` = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_route', 'decision_outcome_code', 'need_analysis')
    WHEN `from_status_code` = 'receiver_in_progress' AND `to_status_code` = 'in_progress' AND `direction` = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'receiver_route', 'decision_outcome_code', 'direct_execute')
    WHEN `from_status_code` = 'analysis' AND `to_status_code` = 'returned_to_manager' AND `direction` = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'analysis_review', 'decision_outcome_code', 'return_manager')
    WHEN `from_status_code` = 'analysis' AND `to_status_code` = 'in_progress' AND `direction` = 'forward'
      THEN JSON_OBJECT('decision_context_code', 'analysis_review', 'decision_outcome_code', 'approve_execute')
    ELSE COALESCE(`transition_meta_json`, JSON_OBJECT())
  END,
  `updated_at` = NOW()
WHERE @workflow_id IS NULL
   OR `workflow_definition_id` = @workflow_id
   OR `workflow_definition_id` IS NULL;

SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'customer_request_status_catalogs_status_code_unique'
);
SET @sql := IF(
  @has_old_idx > 0,
  "ALTER TABLE customer_request_status_catalogs DROP INDEX customer_request_status_catalogs_status_code_unique",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'uq_customer_request_status_catalogs_workflow_status'
);
SET @sql := IF(
  @has_idx = 0,
  "CREATE UNIQUE INDEX uq_customer_request_status_catalogs_workflow_status ON customer_request_status_catalogs (workflow_definition_id, status_code)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_catalogs'
    AND INDEX_NAME = 'idx_crc_status_catalogs_workflow_group'
);
SET @sql := IF(
  @has_idx = 0,
  "CREATE INDEX idx_crc_status_catalogs_workflow_group ON customer_request_status_catalogs (workflow_definition_id, group_code, sort_order)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'uq_customer_request_status_transitions'
);
SET @sql := IF(
  @has_old_idx > 0,
  "ALTER TABLE customer_request_status_transitions DROP INDEX uq_customer_request_status_transitions",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'uq_crc_status_transitions_workflow'
);
SET @sql := IF(
  @has_idx = 0,
  "CREATE UNIQUE INDEX uq_crc_status_transitions_workflow ON customer_request_status_transitions (workflow_definition_id, from_status_code, to_status_code, direction)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_old_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'idx_customer_request_status_transitions_from'
);
SET @sql := IF(
  @has_old_idx > 0,
  "ALTER TABLE customer_request_status_transitions DROP INDEX idx_customer_request_status_transitions_from",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_status_transitions'
    AND INDEX_NAME = 'idx_customer_request_status_transitions_workflow_from'
);
SET @sql := IF(
  @has_idx = 0,
  "CREATE INDEX idx_customer_request_status_transitions_workflow_from ON customer_request_status_transitions (workflow_definition_id, from_status_code, is_active, sort_order)",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 2026_04_01_085224_add_dispatched_at_to_pending_dispatch_table
-- ----------------------------------------------------------------------------
SET @has_dispatched_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_request_pending_dispatch'
    AND COLUMN_NAME = 'dispatched_at'
);
SET @sql := IF(
  @has_dispatched_at = 0,
  "ALTER TABLE customer_request_pending_dispatch ADD COLUMN dispatched_at DATETIME NULL AFTER dispatch_note",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
