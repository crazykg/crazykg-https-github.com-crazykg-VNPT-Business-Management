# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: replay the missing project schema delta for `2026_04_06_100000_add_department_and_dates_to_projects` from the locked baseline
- Target state: repo migrations through `2026_04_06_100000_add_department_and_dates_to_projects`
- Validation note: the locked baseline already contains `projects.start_date` and `projects.expected_end_date`, so the effective release delta is limited to `projects.department_id`, `projects.actual_end_date`, and the matching migration bookkeeping row

## Apply Order

1. `2026-04-06_01_projects_department_dates_schema.sql`
2. `2026-04-06_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only.
- File `01` is idempotent and only adds the columns that are missing from the locked baseline.
- File `02` should run only after `01` succeeds.
- File `02` records `2026_04_06_100000_add_department_and_dates_to_projects` in deterministic batch `105`, matching the next batch after the locked baseline surface.
