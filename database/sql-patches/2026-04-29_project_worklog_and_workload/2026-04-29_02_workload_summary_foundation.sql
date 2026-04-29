SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `workload_monthly_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `snapshot_month` char(7) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `project_id` bigint unsigned DEFAULT NULL,
  `source_type` varchar(20) NOT NULL DEFAULT 'ALL',
  `total_hours` decimal(10,2) NOT NULL DEFAULT 0.00,
  `capacity_hours` decimal(10,2) NOT NULL DEFAULT 0.00,
  `planned_hours` decimal(10,2) NOT NULL DEFAULT 0.00,
  `utilization_percent` decimal(6,2) NOT NULL DEFAULT 0.00,
  `overload_day_count` int unsigned NOT NULL DEFAULT 0,
  `missing_day_count` int unsigned NOT NULL DEFAULT 0,
  `payload` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workload_snap_scope` (`snapshot_month`, `user_id`, `department_id`, `project_id`, `source_type`),
  KEY `idx_workload_snap_user` (`snapshot_month`, `user_id`),
  KEY `idx_workload_snap_dept` (`snapshot_month`, `department_id`),
  KEY `idx_workload_snap_project` (`snapshot_month`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `workload_month_closes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `close_month` char(7) NOT NULL,
  `scope_type` enum('USER','DEPARTMENT','PROJECT','ALL') NOT NULL DEFAULT 'USER',
  `scope_id` bigint unsigned DEFAULT NULL,
  `status` enum('OPEN','SUBMITTED','APPROVED','REOPENED') NOT NULL DEFAULT 'OPEN',
  `submitted_by` bigint unsigned DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `reopened_by` bigint unsigned DEFAULT NULL,
  `reopened_at` timestamp NULL DEFAULT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workload_month_close_scope` (`close_month`, `scope_type`, `scope_id`),
  KEY `idx_workload_month_close_status` (`close_month`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `permissions` (`perm_key`, `perm_name`, `perm_group`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('workload.read', 'Xem tong hop gio cong', 'Gio cong', 1, NOW(), NOW()),
  ('workload.manage', 'Quan ly tong hop gio cong', 'Gio cong', 1, NOW(), NOW()),
  ('workload.export', 'Xuat tong hop gio cong', 'Gio cong', 1, NOW(), NOW()),
  ('workload.close', 'Chot cong ca nhan', 'Gio cong', 1, NOW(), NOW()),
  ('workload.approve', 'Duyet chot cong', 'Gio cong', 1, NOW(), NOW()),
  ('workload.reopen', 'Mo lai ky chot cong', 'Gio cong', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `perm_name` = VALUES(`perm_name`),
  `perm_group` = VALUES(`perm_group`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = VALUES(`updated_at`);

INSERT INTO `role_permission` (`role_id`, `permission_id`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions`
  ON `permissions`.`perm_key` IN (
      'workload.read',
      'workload.manage',
      'workload.export',
      'workload.close',
      'workload.approve',
      'workload.reopen'
  )
LEFT JOIN `role_permission`
  ON `role_permission`.`role_id` = `roles`.`id`
 AND `role_permission`.`permission_id` = `permissions`.`id`
WHERE `roles`.`role_code` = 'ADMIN'
  AND `role_permission`.`role_id` IS NULL;
