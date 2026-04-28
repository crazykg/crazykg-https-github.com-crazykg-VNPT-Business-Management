SET NAMES utf8mb4;

SET @table_schema := DATABASE();

SET @has_contracts := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
);
SET @has_contract_items := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contract_items'
);
SET @has_project_items := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'project_items'
);
SET @has_contract_total_value := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'total_value'
);
SET @has_contract_value := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'contracts'
      AND COLUMN_NAME = 'value'
);

SET @dml := IF(
    @has_contracts = 1
      AND @has_contract_items = 1
      AND @has_project_items = 1
      AND (@has_contract_total_value = 1 OR @has_contract_value = 1),
    CONCAT(
        'INSERT INTO `contract_items` (',
        '`contract_id`, `product_id`, `product_package_id`, `product_name`, `unit`, `quantity`, `unit_price`, `vat_rate`, `vat_amount`, `created_by`, `updated_by`, `created_at`, `updated_at`',
        ') ',
        'SELECT c.id, pi.product_id, pi.product_package_id, ',
        'COALESCE(pp.package_name, pr.product_name), ',
        'pp.unit, ',
        'ROUND(pi.quantity, 2), ROUND(pi.unit_price, 2), NULL, NULL, ',
        'c.created_by, COALESCE(c.updated_by, c.created_by), NOW(), NOW() ',
        'FROM contracts c ',
        'JOIN (',
        '  SELECT project_id, ROUND(SUM(ROUND(COALESCE(quantity, 0), 2) * ROUND(COALESCE(unit_price, 0), 2)), 2) AS items_total ',
        '  FROM project_items ',
        '  WHERE deleted_at IS NULL ',
        '  GROUP BY project_id',
        ') pit ON pit.project_id = c.project_id ',
        'JOIN project_items pi ON pi.project_id = c.project_id AND pi.deleted_at IS NULL ',
        'LEFT JOIN product_packages pp ON pp.id = pi.product_package_id ',
        'LEFT JOIN products pr ON pr.id = pi.product_id ',
        'WHERE c.project_id IS NOT NULL ',
        '  AND c.deleted_at IS NULL ',
        '  AND NOT EXISTS (SELECT 1 FROM contract_items ci WHERE ci.contract_id = c.id) ',
        '  AND ABS(pit.items_total - ROUND(',
        IF(@has_contract_total_value = 1, 'c.total_value', 'c.value'),
        ', 2)) <= 0.01 ',
        '  AND pi.product_id IS NOT NULL ',
        '  AND COALESCE(pi.quantity, 0) > 0 ',
        '  AND COALESCE(pi.unit_price, 0) >= 0'
    ),
    'SELECT 1'
);

PREPARE stmt FROM @dml;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
