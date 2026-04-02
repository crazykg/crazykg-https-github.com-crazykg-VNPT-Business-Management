SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_03_31_110000_create_revenue_targets_archive_table' AS `migration`, 103 AS `batch`
    UNION ALL SELECT '2026_04_01_090000_create_product_quotation_default_settings_table', 103
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
