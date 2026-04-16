# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-04-10` MySQL deltas for CRC detail-status tracking, `product_quotation_items.product_package_id`, and the renamed Laravel migration bookkeeping introduced by the current `2026-04-13` / `2026-04-15` code state.
- Target state:
  - repo migration `2026_04_09_210000_add_detail_status_and_worklog_fields_for_crc`
  - repo migrations `2026_04_13_133559_create_product_packages_table`, `2026_04_13_163026_modify_product_package_foreign_key_in_project_items`, `2026_04_13_163842_fix_product_package_foreign_key_constraint`, `2026_04_13_225500_add_product_package_id_to_project_items_table`
  - repo migration `2026_04_15_090000_add_product_package_id_to_product_quotation_items_table`
- Validation note:
  - the locked dump currently lacks the CRC detail-status tables/worklog columns and lacks `product_quotation_items.product_package_id`
  - the locked dump also lacks the newer bookkeeping rows for the `2026-04-13` / `2026-04-15` migration filenames even though the underlying product-package schema release surface already exists in the older patch folder `database/sql-patches/2026-04-10_from_vnpt_business_db_2026-02-24_175408_product_package_surface/`

## Apply Order

1. Ensure the earlier product-package patch folder has been applied when starting from the locked dump:
   - `database/sql-patches/2026-04-10_from_vnpt_business_db_2026-02-24_175408_product_package_surface/`
2. `2026-04-15_01_crc_detail_status_surface.sql`
3. `2026-04-15_02_product_quotation_package_link.sql`
4. `2026-04-15_03_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the intended release surface.
- File `01` creates only the missing CRC detail-status tables and augments `customer_request_worklogs` with the four missing columns.
- File `02` adds `product_quotation_items.product_package_id` and its supporting index only when absent.
- File `03` inserts only the missing migration rows once the corresponding schema surface is present, so it can safely complement the older `2026-04-10` product-package patch set instead of duplicating it.
