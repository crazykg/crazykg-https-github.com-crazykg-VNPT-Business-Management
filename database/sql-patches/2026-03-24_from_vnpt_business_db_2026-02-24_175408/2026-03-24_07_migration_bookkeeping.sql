SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, 82
FROM (
    SELECT '2026_03_23_100000_fix_workflow_align_xml_remove_dispatched' AS `migration`
    UNION ALL SELECT '2026_03_23_100100_add_soft_deletes_to_contracts'
    UNION ALL SELECT '2026_03_23_110000_add_covering_indexes_for_customer_insight'
    UNION ALL SELECT '2026_03_23_110000_add_vat_rate_to_contract_items'
    UNION ALL SELECT '2026_03_23_111000_add_vat_amount_to_contract_items'
    UNION ALL SELECT '2026_03_23_120000_add_focal_point_fields_to_business_domains_table'
    UNION ALL SELECT '2026_03_23_120000_add_priority_to_opportunities'
    UNION ALL SELECT '2026_03_23_150000_add_addendum_columns_to_contracts'
    UNION ALL SELECT '2026_03_23_150100_add_penalty_columns_to_payment_schedules'
    UNION ALL SELECT '2026_03_23_150200_add_renewal_settings_to_integration_settings'
    UNION ALL SELECT '2026_03_24_090000_add_package_name_to_products_table'
    UNION ALL SELECT '2026_03_24_090000_add_pm_decision_metadata_to_customer_request_status_instances'
    UNION ALL SELECT '2026_03_24_100000_create_revenue_targets_table'
    UNION ALL SELECT '2026_03_24_100100_create_revenue_snapshots_table'
    UNION ALL SELECT '2026_03_24_110000_add_revenue_management_permissions'
    UNION ALL SELECT '2026_03_24_130000_add_status_reason_to_projects'
    UNION ALL SELECT '2026_03_25_100000_create_invoices_table'
    UNION ALL SELECT '2026_03_25_100100_create_invoice_items_table'
    UNION ALL SELECT '2026_03_25_100200_create_receipts_table'
    UNION ALL SELECT '2026_03_25_100300_create_dunning_logs_table'
    UNION ALL SELECT '2026_03_25_100400_add_invoice_id_to_payment_schedules'
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
