SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_11_210000_allow_duplicate_contract_items_and_store_snapshots' AS `migration`, 127 AS `batch`
    UNION ALL
    SELECT '2026_04_11_220000_add_product_package_id_to_contract_items', 127
    UNION ALL
    SELECT '2026_04_12_090000_backfill_contract_items_from_project_items', 127
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

UPDATE `migrations`
SET `batch` = 127
WHERE `migration` IN (
    '2026_04_11_210000_allow_duplicate_contract_items_and_store_snapshots',
    '2026_04_11_220000_add_product_package_id_to_contract_items',
    '2026_04_12_090000_backfill_contract_items_from_project_items'
);

COMMIT;
