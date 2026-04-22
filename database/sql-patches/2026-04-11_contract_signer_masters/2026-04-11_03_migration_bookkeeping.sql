SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_11_170000_create_contract_signer_masters_table' AS `migration`, 123 AS `batch`
    UNION ALL
    SELECT '2026_04_11_170100_backfill_contract_signer_masters_from_contracts', 123
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
