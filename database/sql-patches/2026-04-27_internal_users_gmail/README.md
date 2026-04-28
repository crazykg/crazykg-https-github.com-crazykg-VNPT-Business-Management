# Forward-Only SQL Patch Set

- Scope: bổ sung cột `gmail` cho `internal_users`, dùng cho màn quản lý nhân sự khi tách `email` hiện hữu thành VNPT Mail và lưu thêm Gmail cá nhân.
- Source parity:
  - `backend/database/migrations/2026_04_27_090000_add_gmail_to_internal_users_table.php`

## Apply Order

1. `2026-04-27_01_add_gmail_to_internal_users.sql`
2. `2026-04-27_02_migration_bookkeeping.sql`

## Notes

- Patch idempotent cho MySQL 8, chỉ thêm cột nullable, không đổi dữ liệu hiện hữu.
- `email` hiện hữu giữ nguyên contract backend và được hiển thị trên FE là `VNPT Mail`.
