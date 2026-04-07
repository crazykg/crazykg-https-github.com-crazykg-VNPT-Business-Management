# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: replay the missing delta currently present in local MySQL but absent from the locked dump for:
  - `2026_04_06_150000_add_smtp_recipient_emails_to_integration_settings`
  - `2026_04_06_230000_create_project_implementation_units_table`
- Validation note: importing the locked dump into scratch DBs shows schema/bookkeeping through `2026_04_06_100000_add_department_and_dates_to_projects`; local MySQL already contains the SMTP recipient column and `project_implementation_units`

## Apply Order

1. `2026-04-07_01_integration_settings_smtp_recipients_schema.sql`
2. `2026-04-07_02_project_implementation_units_schema.sql`
3. `2026-04-07_03_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the targeted release surface.
- File `01` only adds `integration_settings.smtp_recipient_emails` when the column is missing.
- File `02` only creates `project_implementation_units` when the table is missing.
- File `03` records the two missing migration rows using the current local MySQL batches `107` and `108`.
- Existing workflow-definition release patches remain in `database/sql-patches/2026-03-28_workflow_definitions/`; this folder does not modify that older surface.
