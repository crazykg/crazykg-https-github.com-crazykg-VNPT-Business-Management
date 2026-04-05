SET NAMES utf8mb4;

SET @has_projects_investment_mode := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'investment_mode'
);

SET @sql := IF(
  @has_projects_investment_mode > 0,
  "UPDATE `projects`
   SET `investment_mode` = 'THUE_DICH_VU_COSAN'
   WHERE `investment_mode` = 'THUE_DICH_VU_CO_SAN'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_project_types := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'project_types'
);

SET @sql := IF(
  @has_project_types > 0,
  "DELETE FROM `project_types`
   WHERE `type_code` = 'THUE_DICH_VU_CO_SAN'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
