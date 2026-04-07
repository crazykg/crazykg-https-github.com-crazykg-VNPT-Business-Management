# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: replay the missing delta currently present in local MySQL but absent from the locked dump for:
  - `2026_04_07_090000_add_leave_date_to_internal_users_table`
- Validation note: importing the locked dump into scratch DBs shows schema/bookkeeping through `2026_04_06_230000_create_project_implementation_units_table`; local MySQL already contains `internal_users.leave_date` and the migration bookkeeping row for `2026_04_07_090000_add_leave_date_to_internal_users_table`

## Apply Order

1. `2026-04-07_01_internal_users_leave_date_schema.sql`
2. `2026-04-07_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the targeted release surface.
- File `01` only adds `internal_users.leave_date` when the column is missing.
- File `02` records the missing migration row using the current local MySQL batch `109`.
