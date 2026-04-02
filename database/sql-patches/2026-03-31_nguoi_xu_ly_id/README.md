# CRC owner + workflow metadata SQL patch set

- **Date:** 2026-03-31
- **Purpose:** Đồng bộ 3 migration CRC sang SQL forward-only patch files
- **Equivalent migrations:**
  1. `2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs`
  2. `2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table`
  3. `2026_03_31_120000_extend_crc_workflow_metadata_schema`

## Apply order

1. `2026-03-31_01_add_nguoi_xu_ly_id_to_customer_request_cases.sql`
2. `2026-03-31_02_extend_crc_workflow_metadata_schema.sql`
3. `2026-03-31_03_migration_bookkeeping.sql`

## Notes

- Patch `01` gộp phần thêm `handler_field` và `nguoi_xu_ly_id` kèm backfill dữ liệu.
- Patch `02` mở rộng schema metadata động cho CRC, seed workflow metadata, seed/bổ sung status metadata, transition metadata, và tạo index tối ưu truy vấn.
- Patch `03` chỉ ghi nhận vào bảng `migrations`; chạy sau khi `01` và `02` thành công.
- Các file là **forward-only**.
- Patch `02` giả định đã có ít nhất một `workflow_definitions` cho `process_type = 'customer_request'` và ưu tiên row `is_default = 1`, nếu không sẽ fallback sang `is_active = 1`.

## Quick apply

```bash
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-31_nguoi_xu_ly_id/2026-03-31_01_add_nguoi_xu_ly_id_to_customer_request_cases.sql
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-31_nguoi_xu_ly_id/2026-03-31_02_extend_crc_workflow_metadata_schema.sql
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-31_nguoi_xu_ly_id/2026-03-31_03_migration_bookkeeping.sql
```

## Verify

```sql
SHOW COLUMNS FROM customer_request_cases LIKE 'nguoi_xu_ly_id';
SHOW COLUMNS FROM customer_request_status_catalogs LIKE 'workflow_definition_id';
SHOW INDEX FROM customer_request_status_catalogs;
SHOW INDEX FROM customer_request_status_transitions;
SELECT migration, batch
FROM migrations
WHERE migration IN (
  '2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs',
  '2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table',
  '2026_03_31_120000_extend_crc_workflow_metadata_schema'
)
ORDER BY migration;
```
