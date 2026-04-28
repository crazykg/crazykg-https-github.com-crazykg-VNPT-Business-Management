# Forward-Only SQL Patch Set

- Scope: bổ sung index lookup cho bộ lọc `Khách hàng / Dự án / Sản phẩm` của CRC để các endpoint filter-options mới tìm kiếm nhẹ hơn trên môi trường deploy bằng `database/sql-patches/`.
- Source parity:
  - `backend/database/migrations/2026_04_24_090000_add_lookup_indexes_for_customer_request_filter_options.php`

## Apply Order

1. `2026-04-24_01_crc_filter_option_lookup_indexes.sql`
2. `2026-04-24_02_migration_bookkeeping.sql`

## Notes

- Patch này chỉ thêm index, không thay đổi dữ liệu nghiệp vụ.
- Tất cả câu lệnh đều theo hướng idempotent để có thể replay an toàn trên môi trường đã có một phần surface.
