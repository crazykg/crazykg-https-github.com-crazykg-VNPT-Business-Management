# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: remove legacy field `products.unit` because đơn vị tính is no longer managed on the product master surface, including product form, import/export, and CRUD persistence.
- Validation note: local MySQL applied migration `2026_04_09_220000_drop_unit_from_products_table` in batch `118`.

## Apply Order

1. `2026-04-09_01_drop_unit_from_products.sql`
2. `2026-04-09_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only and idempotent on the targeted release surface.
- File `01` only drops `products.unit` when the column still exists.
- File `02` records the migration row for environments that replay SQL patches outside Laravel migrations.
