SET NAMES utf8mb4;

-- ============================================================================
-- 2026-04-18_01_product_quotation_package_and_feature_name_release.sql
-- Mục tiêu:
--   - Đồng bộ release surface của các migration:
--       2026_04_18_090000_add_package_id_to_product_quotation_items_tables
--       2026_04_18_091000_backfill_package_id_for_product_quotation_items
--       2026_04_18_175500_expand_product_feature_name_columns
--   - Thêm package_id + index cho product_quotation_items / version_items
--   - Backfill package_id theo heuristic của migration PHP
--   - Mở rộng feature_name sang TEXT cho product_features / product_package_features
--   - Cập nhật migration bookkeeping
-- ============================================================================

SET @table_schema := DATABASE();

-- ----------------------------------------------------------------------------
-- 1) Add package_id columns + indexes for quotation item tables
-- ----------------------------------------------------------------------------
SET @has_pqi := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_items'
);
SET @has_pqi_package_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_items'
      AND COLUMN_NAME = 'package_id'
);
SET @ddl := IF(
    @has_pqi = 1 AND @has_pqi_package_id = 0,
    'ALTER TABLE `product_quotation_items` ADD COLUMN `package_id` bigint unsigned NULL AFTER `product_id`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pqi_package_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_items'
      AND INDEX_NAME = 'idx_product_quotation_items_package'
);
SET @ddl := IF(
    @has_pqi = 1 AND @has_pqi_package_idx = 0,
    'ALTER TABLE `product_quotation_items` ADD INDEX `idx_product_quotation_items_package` (`package_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pqvi := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_version_items'
);
SET @has_pqvi_package_id := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_version_items'
      AND COLUMN_NAME = 'package_id'
);
SET @ddl := IF(
    @has_pqvi = 1 AND @has_pqvi_package_id = 0,
    'ALTER TABLE `product_quotation_version_items` ADD COLUMN `package_id` bigint unsigned NULL AFTER `product_id`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pqvi_package_idx := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_quotation_version_items'
      AND INDEX_NAME = 'idx_product_quotation_version_items_package'
);
SET @ddl := IF(
    @has_pqvi = 1 AND @has_pqvi_package_idx = 0,
    'ALTER TABLE `product_quotation_version_items` ADD INDEX `idx_product_quotation_version_items_package` (`package_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 2) Build package catalog preference table
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_package_catalog;

SET @has_product_packages := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_packages'
);
SET @has_ppfg := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_feature_groups'
);
SET @has_ppf := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_features'
);

SET @ddl := IF(
    @has_product_packages = 1 AND @has_ppfg = 1 AND @has_ppf = 1,
    'CREATE TEMPORARY TABLE tmp_package_catalog AS
        SELECT
            p.id AS package_id,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM product_package_feature_groups g
                    WHERE g.package_id = p.id
                      AND g.deleted_at IS NULL
                )
                AND EXISTS (
                    SELECT 1
                    FROM product_package_features f
                    WHERE f.package_id = p.id
                      AND f.deleted_at IS NULL
                      AND f.status = ''ACTIVE''
                )
                THEN 1
                ELSE 0
            END AS has_catalog
        FROM product_packages p',
    IF(
        @has_product_packages = 1,
        'CREATE TEMPORARY TABLE tmp_package_catalog AS
            SELECT p.id AS package_id, 0 AS has_catalog
            FROM product_packages p',
        'SELECT 1'
    )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 3) Backfill package_id for product_quotation_items
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_candidates;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_unit_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_unit_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_price_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_price_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_note_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_note_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_selected;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_candidates AS
        SELECT
            q.id AS row_id,
            p.id AS package_id,
            CASE
                WHEN COALESCE(TRIM(q.unit), '''') <> ''''
                 AND COALESCE(TRIM(p.unit), '''') = TRIM(q.unit)
                THEN 1
                ELSE 0
            END AS unit_match,
            CASE
                WHEN COALESCE(q.unit_price, 0) > 0
                 AND ROUND(COALESCE(p.standard_price, 0), 2) = ROUND(COALESCE(q.unit_price, 0), 2)
                THEN 1
                ELSE 0
            END AS price_match,
            CASE
                WHEN COALESCE(TRIM(q.note), '''') <> ''''
                 AND COALESCE(TRIM(p.description), '''') <> ''''
                 AND LOCATE(
                    LOWER(TRIM(REGEXP_REPLACE(p.description, ''[[:space:]]+'', '' ''))),
                    LOWER(TRIM(REGEXP_REPLACE(q.note, ''[[:space:]]+'', '' '')))
                 ) > 0
                THEN 1
                ELSE 0
            END AS note_match,
            COALESCE(pc.has_catalog, 0) AS has_catalog
        FROM product_quotation_items q
        INNER JOIN product_packages p
            ON p.product_id = q.product_id
        LEFT JOIN tmp_package_catalog pc
            ON pc.package_id = p.id
        WHERE q.package_id IS NULL
          AND q.product_id IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_unit_flags AS
        SELECT row_id, MAX(unit_match) AS has_unit_match
        FROM tmp_pqi_candidates
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_unit_pref AS
        SELECT c.*
        FROM tmp_pqi_candidates c
        INNER JOIN tmp_pqi_unit_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_unit_match = 0 OR c.unit_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_price_flags AS
        SELECT row_id, MAX(price_match) AS has_price_match
        FROM tmp_pqi_unit_pref
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_price_pref AS
        SELECT c.*
        FROM tmp_pqi_unit_pref c
        INNER JOIN tmp_pqi_price_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_price_match = 0 OR c.price_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_note_flags AS
        SELECT row_id, MAX(note_match) AS has_note_match
        FROM tmp_pqi_price_pref
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_note_pref AS
        SELECT c.*
        FROM tmp_pqi_price_pref c
        INNER JOIN tmp_pqi_note_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_note_match = 0 OR c.note_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqi_selected AS
        SELECT row_id, package_id
        FROM (
            SELECT
                n.row_id,
                n.package_id,
                n.has_catalog,
                COUNT(*) OVER (PARTITION BY n.row_id) AS remaining_count,
                SUM(n.has_catalog) OVER (PARTITION BY n.row_id) AS catalog_count
            FROM tmp_pqi_note_pref n
        ) ranked
        WHERE remaining_count = 1
           OR (remaining_count > 1 AND catalog_count = 1 AND has_catalog = 1)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqi = 1 AND @has_product_packages = 1,
    'UPDATE product_quotation_items q
        INNER JOIN tmp_pqi_selected s
            ON s.row_id = q.id
        SET q.package_id = s.package_id
      WHERE q.package_id IS NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS tmp_pqi_selected;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_note_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_note_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_price_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_price_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_unit_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_unit_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqi_candidates;

-- ----------------------------------------------------------------------------
-- 4) Backfill package_id for product_quotation_version_items
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_candidates;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_unit_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_unit_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_price_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_price_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_note_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_note_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_selected;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_candidates AS
        SELECT
            q.id AS row_id,
            p.id AS package_id,
            CASE
                WHEN COALESCE(TRIM(q.unit), '''') <> ''''
                 AND COALESCE(TRIM(p.unit), '''') = TRIM(q.unit)
                THEN 1
                ELSE 0
            END AS unit_match,
            CASE
                WHEN COALESCE(q.unit_price, 0) > 0
                 AND ROUND(COALESCE(p.standard_price, 0), 2) = ROUND(COALESCE(q.unit_price, 0), 2)
                THEN 1
                ELSE 0
            END AS price_match,
            CASE
                WHEN COALESCE(TRIM(q.note), '''') <> ''''
                 AND COALESCE(TRIM(p.description), '''') <> ''''
                 AND LOCATE(
                    LOWER(TRIM(REGEXP_REPLACE(p.description, ''[[:space:]]+'', '' ''))),
                    LOWER(TRIM(REGEXP_REPLACE(q.note, ''[[:space:]]+'', '' '')))
                 ) > 0
                THEN 1
                ELSE 0
            END AS note_match,
            COALESCE(pc.has_catalog, 0) AS has_catalog
        FROM product_quotation_version_items q
        INNER JOIN product_packages p
            ON p.product_id = q.product_id
        LEFT JOIN tmp_package_catalog pc
            ON pc.package_id = p.id
        WHERE q.package_id IS NULL
          AND q.product_id IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_unit_flags AS
        SELECT row_id, MAX(unit_match) AS has_unit_match
        FROM tmp_pqvi_candidates
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_unit_pref AS
        SELECT c.*
        FROM tmp_pqvi_candidates c
        INNER JOIN tmp_pqvi_unit_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_unit_match = 0 OR c.unit_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_price_flags AS
        SELECT row_id, MAX(price_match) AS has_price_match
        FROM tmp_pqvi_unit_pref
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_price_pref AS
        SELECT c.*
        FROM tmp_pqvi_unit_pref c
        INNER JOIN tmp_pqvi_price_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_price_match = 0 OR c.price_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_note_flags AS
        SELECT row_id, MAX(note_match) AS has_note_match
        FROM tmp_pqvi_price_pref
        GROUP BY row_id',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_note_pref AS
        SELECT c.*
        FROM tmp_pqvi_price_pref c
        INNER JOIN tmp_pqvi_note_flags flags
            ON flags.row_id = c.row_id
        WHERE flags.has_note_match = 0 OR c.note_match = 1',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'CREATE TEMPORARY TABLE tmp_pqvi_selected AS
        SELECT row_id, package_id
        FROM (
            SELECT
                n.row_id,
                n.package_id,
                n.has_catalog,
                COUNT(*) OVER (PARTITION BY n.row_id) AS remaining_count,
                SUM(n.has_catalog) OVER (PARTITION BY n.row_id) AS catalog_count
            FROM tmp_pqvi_note_pref n
        ) ranked
        WHERE remaining_count = 1
           OR (remaining_count > 1 AND catalog_count = 1 AND has_catalog = 1)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    @has_pqvi = 1 AND @has_product_packages = 1,
    'UPDATE product_quotation_version_items q
        INNER JOIN tmp_pqvi_selected s
            ON s.row_id = q.id
        SET q.package_id = s.package_id
      WHERE q.package_id IS NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_selected;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_note_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_note_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_price_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_price_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_unit_pref;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_unit_flags;
DROP TEMPORARY TABLE IF EXISTS tmp_pqvi_candidates;
DROP TEMPORARY TABLE IF EXISTS tmp_package_catalog;

-- ----------------------------------------------------------------------------
-- 5) Expand feature_name columns to TEXT
-- ----------------------------------------------------------------------------
SET @has_product_features := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_features'
);
SET @product_features_feature_name_type := (
    SELECT COALESCE(DATA_TYPE, '')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_features'
      AND COLUMN_NAME = 'feature_name'
    LIMIT 1
);
SET @ddl := IF(
    @has_product_features = 1 AND @product_features_feature_name_type <> 'text',
    'ALTER TABLE `product_features` MODIFY `feature_name` text NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_product_package_features := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_features'
);
SET @product_package_features_feature_name_type := (
    SELECT COALESCE(DATA_TYPE, '')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @table_schema
      AND TABLE_NAME = 'product_package_features'
      AND COLUMN_NAME = 'feature_name'
    LIMIT 1
);
SET @ddl := IF(
    @has_product_package_features = 1 AND @product_package_features_feature_name_type <> 'text',
    'ALTER TABLE `product_package_features` MODIFY `feature_name` text NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 6) Migration bookkeeping
-- ----------------------------------------------------------------------------
START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT src.migration, src.batch
FROM (
    SELECT '2026_04_18_090000_add_package_id_to_product_quotation_items_tables' AS migration, 121 AS batch
    UNION ALL
    SELECT '2026_04_18_091000_backfill_package_id_for_product_quotation_items', 121
    UNION ALL
    SELECT '2026_04_18_175500_expand_product_feature_name_columns', 122
) AS src
LEFT JOIN `migrations` m
    ON m.migration = src.migration
WHERE m.migration IS NULL;

COMMIT;
