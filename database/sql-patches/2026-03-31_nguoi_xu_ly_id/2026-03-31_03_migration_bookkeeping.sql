-- ============================================================================
-- Migration bookkeeping for CRC owner + workflow metadata patches
-- Chỉ chạy sau khi 01 và 02 thành công
-- ============================================================================

INSERT INTO migrations (migration, batch)
SELECT '2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs', COALESCE(MAX(batch), 0) + 1
FROM migrations
WHERE NOT EXISTS (
  SELECT 1 FROM migrations WHERE migration = '2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs'
);

INSERT INTO migrations (migration, batch)
SELECT '2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table', COALESCE(MAX(batch), 0) + 1
FROM migrations
WHERE NOT EXISTS (
  SELECT 1 FROM migrations WHERE migration = '2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table'
);

INSERT INTO migrations (migration, batch)
SELECT '2026_03_31_120000_extend_crc_workflow_metadata_schema', COALESCE(MAX(batch), 0) + 1
FROM migrations
WHERE NOT EXISTS (
  SELECT 1 FROM migrations WHERE migration = '2026_03_31_120000_extend_crc_workflow_metadata_schema'
);

SELECT migration, batch
FROM migrations
WHERE migration IN (
  '2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs',
  '2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table',
  '2026_03_31_120000_extend_crc_workflow_metadata_schema'
)
ORDER BY migration;
