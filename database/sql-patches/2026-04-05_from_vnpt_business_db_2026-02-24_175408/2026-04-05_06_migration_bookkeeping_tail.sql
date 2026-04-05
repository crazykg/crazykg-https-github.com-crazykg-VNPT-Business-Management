SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_05_143140_remove_duplicate_project_type_co_san' AS `migration`, 105 AS `batch`
    UNION ALL
    SELECT '2026_04_05_190000_add_commission_policy_text_to_documents', 105
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
