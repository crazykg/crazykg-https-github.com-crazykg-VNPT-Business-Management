SET NAMES utf8mb4;

START TRANSACTION;

SET @has_customers_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'idx_customers_deleted_name'
);
SET @sql := IF(
  @has_customers_idx = 0,
  'ALTER TABLE customers ADD INDEX idx_customers_deleted_name (deleted_at, customer_name)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_projects_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
    AND INDEX_NAME = 'idx_projects_deleted_name'
);
SET @sql := IF(
  @has_projects_idx = 0,
  'ALTER TABLE projects ADD INDEX idx_projects_deleted_name (deleted_at, project_name)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_products_deleted_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'deleted_at'
);
SET @has_products_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND INDEX_NAME = 'idx_products_deleted_name'
);
SET @sql := IF(
  @has_products_idx = 0 AND @has_products_deleted_at > 0,
  'ALTER TABLE products ADD INDEX idx_products_deleted_name (deleted_at, product_name)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;
