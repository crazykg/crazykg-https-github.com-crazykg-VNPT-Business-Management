SET NAMES utf8mb4;

START TRANSACTION;

SET @has_project_implementation_units := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_implementation_units'
);

SET @has_internal_users := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'internal_users'
);

SET @create_project_implementation_units_sql := IF(
  @has_project_implementation_units = 0,
  IF(
    @has_internal_users > 0,
    'CREATE TABLE `project_implementation_units` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `project_id` BIGINT UNSIGNED NOT NULL,
      `implementation_user_id` BIGINT UNSIGNED NULL,
      `implementation_user_code` VARCHAR(100) NULL,
      `implementation_full_name` VARCHAR(255) NULL,
      `implementation_unit_code` VARCHAR(100) NULL,
      `implementation_unit_name` VARCHAR(255) NULL,
      `created_by` BIGINT UNSIGNED NULL,
      `updated_by` BIGINT UNSIGNED NULL,
      `created_at` TIMESTAMP NULL DEFAULT NULL,
      `updated_at` TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uq_project_implementation_units_project` (`project_id`),
      KEY `idx_project_implementation_units_user` (`implementation_user_id`),
      CONSTRAINT `fk_project_implementation_units_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
      CONSTRAINT `fk_project_implementation_units_user`
        FOREIGN KEY (`implementation_user_id`) REFERENCES `internal_users` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    'CREATE TABLE `project_implementation_units` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `project_id` BIGINT UNSIGNED NOT NULL,
      `implementation_user_id` BIGINT UNSIGNED NULL,
      `implementation_user_code` VARCHAR(100) NULL,
      `implementation_full_name` VARCHAR(255) NULL,
      `implementation_unit_code` VARCHAR(100) NULL,
      `implementation_unit_name` VARCHAR(255) NULL,
      `created_by` BIGINT UNSIGNED NULL,
      `updated_by` BIGINT UNSIGNED NULL,
      `created_at` TIMESTAMP NULL DEFAULT NULL,
      `updated_at` TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uq_project_implementation_units_project` (`project_id`),
      KEY `idx_project_implementation_units_user` (`implementation_user_id`),
      CONSTRAINT `fk_project_implementation_units_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
  ),
  'SELECT 1'
);

PREPARE project_implementation_units_stmt FROM @create_project_implementation_units_sql;
EXECUTE project_implementation_units_stmt;
DEALLOCATE PREPARE project_implementation_units_stmt;

COMMIT;
