# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-03-31` MySQL deltas for revenue target archival and product quotation default settings into a replayable forward-only patch set
- Target state: repo migrations through `2026_04_01_090000_create_product_quotation_default_settings_table`
- Validation note: the locked baseline currently stops before `2026_03_31_110000_create_revenue_targets_archive_table` and `2026_04_01_090000_create_product_quotation_default_settings_table`, so this patch adds only the missing schema plus migration bookkeeping rows
- Data note: local MySQL currently contains 1 user-specific row in `product_quotation_default_settings`; that row is intentionally excluded because it is environment-specific runtime data, not release seed data

## Apply Order

1. `2026-04-02_01_revenue_product_quotation_schema.sql`
2. `2026-04-02_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only.
- File `02` should run only after `01` succeeds.
- File `01` is idempotent and creates only the two missing tables confirmed by scratch validation from the locked baseline.
- File `02` inserts only the missing migration rows with batch `103`, which is the next deterministic batch after the locked baseline dump.
