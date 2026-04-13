SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_09_101000_drop_package_name_from_products_table' AS `migration`, 116 AS `batch`
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
