# Forward-Only SQL Patch Set

- Scope: bổ sung ngày giờ worklog dự án trên `shared_timesheets`, người thực hiện giờ công và nền tảng tổng hợp giờ công.
- Source parity:
  - `backend/database/migrations/2026_04_29_150000_add_datetime_range_to_shared_timesheets.php`
  - `backend/database/migrations/2026_04_29_170000_add_performed_by_to_shared_timesheets.php`
  - `backend/database/migrations/2026_04_29_171000_create_workload_summary_foundation.php`

## Apply Order

1. `2026-04-29_01_shared_timesheets_worklog_datetime.sql`
2. `2026-04-29_02_workload_summary_foundation.sql`
3. `2026-04-29_03_migration_bookkeeping.sql`

## Notes

- Patch forward-only cho MySQL 8.
- `work_started_at` và `work_ended_at` nullable để setting ngày giờ Worklog dự án mặc định vẫn tắt.
- `performed_by_user_id` được backfill từ `created_by` khi có dữ liệu, rồi thêm index phục vụ dashboard tổng hợp giờ công.
- Nền tảng workload tạo bảng snapshot/tháng chốt công và seed quyền `workload.*` cho role `ADMIN`.
