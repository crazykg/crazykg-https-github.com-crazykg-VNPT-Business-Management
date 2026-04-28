SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_26_174500_add_unit_to_project_items_table' AS `migration`, 128 AS `batch`
    UNION ALL
    SELECT '2026_04_26_190000_add_expected_range_to_payment_schedules', 129
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
