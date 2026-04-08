SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO migrations (migration, batch)
SELECT src.migration, src.batch
FROM (
  SELECT '2026_04_08_070000_create_missing_crc_status_tables' AS migration, 106 AS batch
  UNION ALL
  SELECT '2026_04_08_071000_crc_catalog_guard_cleanup', 106
) src
LEFT JOIN migrations m ON m.migration = src.migration
WHERE m.migration IS NULL;

COMMIT;
