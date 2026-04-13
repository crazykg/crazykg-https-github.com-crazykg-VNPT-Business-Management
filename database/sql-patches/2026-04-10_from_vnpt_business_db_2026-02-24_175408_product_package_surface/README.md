# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-04-07` MySQL deltas for product packages, package feature catalogs, project item package linkage, `products.product_short_name`, `projects.opportunity_score`, and `user_dept_history.transfer_type` into a replayable forward-only patch set.
- Validation note: local MySQL currently records the related migrations in batches `110`, `112`, `113`, `114`, `115`, `117`, and `119`. The `projects.opportunity_score` release surface was validated from live MySQL because the original Laravel migration file is no longer present in the repo, while `2026_04_07_113000_add_actor_columns_to_user_dept_history_table` is bookkeeping-only because the locked dump already contains those actor columns.

## Apply Order

1. `2026-04-10_01_user_dept_history_transfer_type.sql`
2. `2026-04-10_02_product_package_release_surface.sql`
3. `2026-04-10_03_project_and_product_columns.sql`
4. `2026-04-10_04_product_package_feature_catalogs.sql`
5. `2026-04-10_05_project_item_package_link.sql`
6. `2026-04-10_06_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the targeted release surface.
- This folder intentionally complements the existing patch folders:
  - `database/sql-patches/2026-04-09_remove_product_package_name_from_products/`
  - `database/sql-patches/2026-04-09_remove_product_unit_from_products/`
- File `02` adds `products.has_product_packages`, creates `product_packages` when missing, and extends `attachments.reference_type` with `PRODUCT_PACKAGE`.
- File `03` adds `products.product_short_name` and `projects.opportunity_score` only when those columns are absent.
- File `04` creates the package feature catalog tables only when they are missing.
- File `05` adds `project_items.product_package_id` and its supporting index only when missing.
- File `06` records the related migration rows so replayed SQL environments stay aligned with Laravel migration bookkeeping.
