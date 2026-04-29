SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_29_120000_create_project_procedure_public_shares_table' AS `migration`, 131 AS `batch`
    UNION ALL
    SELECT '2026_04_29_130000_drop_created_by_foreign_from_project_procedure_public_shares' AS `migration`, 132 AS `batch`
    UNION ALL
    SELECT '2026_04_29_140000_add_access_key_hash_to_project_procedure_public_shares' AS `migration`, 133 AS `batch`
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
