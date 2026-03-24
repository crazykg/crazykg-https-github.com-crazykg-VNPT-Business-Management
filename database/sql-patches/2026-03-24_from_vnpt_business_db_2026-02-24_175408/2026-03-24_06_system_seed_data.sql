SET NAMES utf8mb4;

START TRANSACTION;

-- Renewal settings stored in the validated target schema.
INSERT INTO `integration_settings` (`provider`, `is_enabled`, `created_at`, `updated_at`)
VALUES
    ('contract_renewal_grace_days', 1, NOW(), NOW()),
    ('contract_renewal_penalty_rate_per_day', 1, NOW(), NOW()),
    ('contract_renewal_max_penalty_rate', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
    `is_enabled` = VALUES(`is_enabled`),
    `updated_at` = NOW();

-- Revenue permissions.
INSERT INTO `permissions` (`perm_key`, `perm_name`, `perm_group`, `is_active`, `created_at`, `updated_at`)
VALUES
    ('revenue.read', 'Xem doanh thu', 'Doanh thu', 1, NOW(), NOW()),
    ('revenue.targets', 'Quản lý kế hoạch doanh thu', 'Doanh thu', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
    `perm_name` = VALUES(`perm_name`),
    `perm_group` = VALUES(`perm_group`),
    `is_active` = VALUES(`is_active`),
    `updated_at` = NOW();

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT `r`.`id`, `p`.`id`
FROM `roles` AS `r`
JOIN `permissions` AS `p`
  ON `p`.`perm_key` IN ('revenue.read', 'revenue.targets')
WHERE `r`.`role_code` = 'ADMIN';

COMMIT;
