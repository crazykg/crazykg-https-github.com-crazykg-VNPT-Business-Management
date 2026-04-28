# Forward-Only SQL Patch Set

- Scope: mở rộng `contract_items` để lưu snapshot tên sản phẩm, đơn vị tính, gói sản phẩm và backfill dòng hợp đồng từ `project_items` khi tổng giá trị dự án khớp hợp đồng.
- Source parity:
  - `backend/database/migrations/2026_04_11_210000_allow_duplicate_contract_items_and_store_snapshots.php`
  - `backend/database/migrations/2026_04_11_220000_add_product_package_id_to_contract_items.php`
  - `backend/database/migrations/2026_04_12_090000_backfill_contract_items_from_project_items.php`

## Apply Order

1. `2026-04-11_01_contract_items_snapshot_schema.sql`
2. `2026-04-12_02_backfill_contract_items_from_project_items.sql`
3. `2026-04-12_03_migration_bookkeeping.sql`

## Notes

- Patch idempotent cho MySQL 8.
- Backfill chỉ insert cho hợp đồng chưa có dòng `contract_items` và tổng tiền `project_items` khớp giá trị hợp đồng, cùng điều kiện với migration Laravel.
- Không rollback dữ liệu backfill trong release SQL.
