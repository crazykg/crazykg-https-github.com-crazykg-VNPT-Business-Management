SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_29_150000_add_datetime_range_to_shared_timesheets' AS `migration`, 134 AS `batch`
    UNION ALL
    SELECT '2026_04_29_170000_add_performed_by_to_shared_timesheets', 135
    UNION ALL
    SELECT '2026_04_29_171000_create_workload_summary_foundation', 136
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
