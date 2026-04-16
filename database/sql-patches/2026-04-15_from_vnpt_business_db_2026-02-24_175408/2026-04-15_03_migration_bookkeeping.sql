SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT
        '2026_04_09_210000_add_detail_status_and_worklog_fields_for_crc' AS `migration`,
        127 AS `batch`,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_status_detail_states'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_status_detail_logs'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_worklogs'
                  AND COLUMN_NAME = 'difficulty_note'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_worklogs'
                  AND COLUMN_NAME = 'proposal_note'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_worklogs'
                  AND COLUMN_NAME = 'difficulty_status'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_request_worklogs'
                  AND COLUMN_NAME = 'detail_status_action'
            )
        ) AS `is_ready`
    UNION ALL
    SELECT
        '2026_04_13_133559_create_product_packages_table',
        127,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'product_packages'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'products'
                  AND COLUMN_NAME = 'has_product_packages'
            )
            AND EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'attachments'
                  AND COLUMN_NAME = 'reference_type'
                  AND COLUMN_TYPE LIKE '%''PRODUCT_PACKAGE''%'
            )
        )
    UNION ALL
    SELECT
        '2026_04_13_163026_modify_product_package_foreign_key_in_project_items',
        127,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'project_items'
            )
        )
    UNION ALL
    SELECT
        '2026_04_13_163842_fix_product_package_foreign_key_constraint',
        127,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'project_items'
            )
        )
    UNION ALL
    SELECT
        '2026_04_13_225500_add_product_package_id_to_project_items_table',
        127,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'project_items'
                  AND COLUMN_NAME = 'product_package_id'
            )
        )
    UNION ALL
    SELECT
        '2026_04_15_090000_add_product_package_id_to_product_quotation_items_table',
        126,
        (
            EXISTS (
                SELECT 1
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'product_quotation_items'
                  AND COLUMN_NAME = 'product_package_id'
            )
        )
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `src`.`is_ready` = 1
  AND `m`.`migration` IS NULL;

COMMIT;
