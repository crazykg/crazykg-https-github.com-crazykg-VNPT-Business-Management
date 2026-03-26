SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_03_23_000001_add_email_smtp_settings_to_integration_settings' AS `migration`, 91 AS `batch`
    UNION ALL SELECT '2026_03_24_000001_create_customer_request_pending_dispatch_table', 91
    UNION ALL SELECT '2026_03_24_000002_create_customer_request_dispatched_table', 91
    UNION ALL SELECT '2026_03_24_000003_create_customer_request_coding_table', 91
    UNION ALL SELECT '2026_03_24_000004_create_customer_request_dms_transfer_table', 91
    UNION ALL SELECT '2026_03_24_000005_add_missing_columns_to_customer_request_cases_table', 91
    UNION ALL SELECT '2026_03_24_000006_add_work_date_to_customer_request_worklogs_table', 91
    UNION ALL SELECT '2026_03_25_100000_align_in_progress_transitions_with_xml', 92
    UNION ALL SELECT '2026_03_25_130400_create_product_quotation_tables', 92
    UNION ALL SELECT '2026_03_25_150000_add_healthcare_classification_to_customers_table', 92
    UNION ALL SELECT '2026_03_25_160000_create_product_feature_catalog_tables', 92
    UNION ALL SELECT '2026_03_25_210000_add_payment_cycle_and_estimated_value_to_projects', 92
    UNION ALL SELECT '2026_03_25_210100_create_project_revenue_schedules_table', 92
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
