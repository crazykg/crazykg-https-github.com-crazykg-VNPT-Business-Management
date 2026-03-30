SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_03_27_210000_add_project_type_code_to_contracts_and_seed_rental_project_type' AS `migration`, 93 AS `batch`
    UNION ALL SELECT '2026_03_28_073500_make_contract_project_id_nullable_for_initial_contracts', 93
    UNION ALL SELECT '2026_03_28_074500_make_payment_schedule_project_id_nullable_for_initial_contracts', 93
    UNION ALL SELECT '2026_03_28_130000_add_customer_code_auto_generated_to_customers', 93
    UNION ALL SELECT '2026_03_28_180000_create_employee_party_profiles_table', 93
    UNION ALL SELECT '2026_03_28_220000_backfill_random_bed_capacity_for_healthcare_customers', 93
    UNION ALL SELECT '2026_03_29_100000_create_product_target_segments_table', 93
    UNION ALL SELECT '2026_03_30_090000_add_facility_types_to_product_target_segments_table', 93
    UNION ALL SELECT '2026_03_30_090000_backfill_healthcare_classification_and_seed_his_non_bed_segments', 93
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
