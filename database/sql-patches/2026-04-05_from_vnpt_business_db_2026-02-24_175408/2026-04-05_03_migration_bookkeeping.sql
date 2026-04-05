SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_03_28_000002_add_workflow_management_permissions' AS `migration`, 105 AS `batch`
    UNION ALL
    SELECT '2026_03_29_094312_create_customer_request_assigned_to_receiver_table', 105
    UNION ALL
    SELECT '2026_03_29_141628_create_customer_request_receiver_in_progress_table', 105
    UNION ALL
    SELECT '2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs', 105
    UNION ALL
    SELECT '2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table', 105
    UNION ALL
    SELECT '2026_03_31_120000_extend_crc_workflow_metadata_schema', 105
    UNION ALL
    SELECT '2026_04_01_085224_add_dispatched_at_to_pending_dispatch_table', 105
    UNION ALL
    SELECT '2026_04_05_180000_create_product_unit_masters_table', 105
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
