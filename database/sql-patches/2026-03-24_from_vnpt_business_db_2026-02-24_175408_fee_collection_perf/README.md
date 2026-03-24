# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Target state: repo migrations through `2026_03_25_200000_add_performance_indexes_to_fee_collection`
- Validation source of truth: local DB `vnpt_business_db` after `php artisan migrate --force`
- Patch convention used in this folder: `YYYY-MM-DD_NN_module_kind.sql`
- Scope: MySQL forward-only upcode for servers expected to be close to the baseline dump above

## Apply Order

1. `2026-03-24_01_fee_collection_schema.sql`
2. `2026-03-24_02_migration_bookkeeping.sql`

## Notes

- These files are intentionally forward-only. No rollback SQL is included.
- `2026-03-24_02_migration_bookkeeping.sql` must be applied last, and only after `2026-03-24_01_fee_collection_schema.sql` succeeds.
- This patch only adds performance and uniqueness indexes for `invoices` and `receipts`.
- No DML or demo seed data is required for this migration.
- The patch does not try to hide manual schema drift on the target server. If the server is not close to the baseline dump, review the SQL before applying.
