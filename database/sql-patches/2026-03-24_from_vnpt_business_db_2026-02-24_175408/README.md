# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Target state: repo migrations through `2026_03_25_100400_add_invoice_id_to_payment_schedules`
- Validation source of truth: scratch DB `vnpt_business_db_patch_verify` built from the baseline dump plus `php artisan migrate --force`
- Patch convention used in this folder: `YYYY-MM-DD_NN_module_kind.sql`
- Scope: MySQL forward-only upcode for servers expected to be close to the baseline dump above

## Apply Order

1. `2026-03-24_01_customer_request_schema.sql`
2. `2026-03-24_02_customer_request_data.sql`
3. `2026-03-24_03_contract_and_fee_collection_schema.sql`
4. `2026-03-24_04_catalog_and_insight_schema.sql`
5. `2026-03-24_05_revenue_schema.sql`
6. `2026-03-24_06_system_seed_data.sql`
7. `2026-03-24_07_migration_bookkeeping.sql`

## Notes

- These files are intentionally forward-only. No rollback SQL is included.
- `07_migration_bookkeeping.sql` must be applied last, and only after files `01` through `06` succeed.
- The patch does not try to hide manual schema drift on the target server. If the server is not close to the baseline dump, review the SQL before applying.
- `integration_settings` in the validated target schema does not contain `setting_value`, so the seed patch only persists `provider`, `is_enabled`, `created_at`, and `updated_at` for the renewal settings keys.
