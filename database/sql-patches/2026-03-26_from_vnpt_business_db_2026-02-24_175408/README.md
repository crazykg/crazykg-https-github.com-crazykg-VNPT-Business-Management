# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Target state: repo migrations through `2026_03_25_210100_create_project_revenue_schedules_table`
- Validation source of truth: scratch DB `vnpt_business_db_release_target` built from the baseline dump plus `php artisan migrate --force`
- Patch convention used in this folder: `YYYY-MM-DD_NN_module_kind.sql`
- Scope: MySQL forward-only release patch for schema, deterministic system data, and migration bookkeeping required to reach the validated target state above

## Apply Order

1. `2026-03-26_01_catalog_and_product_schema.sql`
2. `2026-03-26_02_customer_request_alignment.sql`
3. `2026-03-26_03_product_quotation_schema.sql`
4. `2026-03-26_04_project_revenue_schema.sql`
5. `2026-03-26_05_migration_bookkeeping.sql`

## Notes

- These files are intentionally forward-only. No rollback SQL is included.
- `05_migration_bookkeeping.sql` must be applied last, and only after files `01` through `04` succeed.
- The baseline dump already contains the `customer_request_pending_dispatch`, `customer_request_dispatched`, `customer_request_coding`, `customer_request_dms_transfer` tables and the related `customer_request_cases` / `customer_request_worklogs` columns, so this patch only books those migrations instead of recreating the schema.
- `02_customer_request_alignment.sql` enforces the XML-aligned `in_progress -> completed` forward transition and removes the outdated forward targets that should no longer exist.
- The patch does not try to hide server drift outside the release surface. If a target server is not close to the locked baseline dump, review the SQL before applying.
