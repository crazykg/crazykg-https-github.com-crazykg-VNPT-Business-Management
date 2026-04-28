# Forward-Only SQL Patch Set

- Scope: bổ sung snapshot `unit` cho `project_items` và khoảng dự kiến thanh toán cho `payment_schedules`.
- Source parity:
  - `backend/database/migrations/2026_04_26_174500_add_unit_to_project_items_table.php`
  - `backend/database/migrations/2026_04_26_190000_add_expected_range_to_payment_schedules.php`

## Apply Order

1. `2026-04-26_01_project_items_unit_snapshot.sql`
2. `2026-04-26_02_payment_schedule_expected_range.sql`
3. `2026-04-26_03_migration_bookkeeping.sql`

## Notes

- Patch idempotent cho MySQL 8.
- Backfill `project_items.unit` từ `product_packages.unit`; môi trường hiện tại đã loại bỏ snapshot `products.unit`.
- Hai cột `payment_schedules.expected_start_date` và `expected_end_date` nullable để không thay đổi lịch thanh toán hiện hữu.
