# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: remove legacy field `products.package_name` now that package management has been moved to the dedicated `product_packages` module and product master data uses `product_code` as the stable identifier.
- Validation note: local MySQL applied migration `2026_04_09_101000_drop_package_name_from_products_table` in batch `116`.

## Apply Order

1. `2026-04-09_01_drop_package_name_from_products.sql`
2. `2026-04-09_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the targeted release surface.
- File `01` only drops `products.package_name` when the column still exists.
- File `02` records the migration row for environments that replay SQL patches outside Laravel migrations.
