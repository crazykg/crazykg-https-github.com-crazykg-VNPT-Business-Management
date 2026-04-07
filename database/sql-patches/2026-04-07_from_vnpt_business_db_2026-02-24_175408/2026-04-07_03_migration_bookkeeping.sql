SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT `src`.`migration`, `src`.`batch`
FROM (
    SELECT '2026_04_06_150000_add_smtp_recipient_emails_to_integration_settings' AS `migration`, 107 AS `batch`
    UNION ALL
    SELECT '2026_04_06_230000_create_project_implementation_units_table' AS `migration`, 108 AS `batch`
) AS `src`
LEFT JOIN `migrations` AS `m`
  ON `m`.`migration` = `src`.`migration`
WHERE `m`.`migration` IS NULL;

COMMIT;
