SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_07_110000_add_transfer_type_to_user_dept_history_table' AS `migration`, 110 AS `batch`
    UNION ALL
    SELECT '2026_04_07_113000_add_actor_columns_to_user_dept_history_table', 112
    UNION ALL
    SELECT '2026_04_08_090000_create_product_packages_table', 113
    UNION ALL
    SELECT '2026_04_08_090100_add_product_package_to_attachment_reference_type', 113
    UNION ALL
    SELECT '2026_04_08_203000_add_opportunity_score_to_projects_table', 114
    UNION ALL
    SELECT '2026_04_08_193500_add_product_short_name_to_products_table', 115
    UNION ALL
    SELECT '2026_04_09_170000_create_product_package_feature_catalog_tables', 117
    UNION ALL
    SELECT '2026_04_09_190000_add_product_package_id_to_project_items_table', 119
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
