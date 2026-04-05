# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-04-03` MySQL delta for CRC receiver workflow runtime, workflow-management permission, and product-unit masters into a replayable forward-only patch set
- Target state: repo migrations through `2026_04_05_180000_create_product_unit_masters_table`
- Validation note: the locked baseline already includes batch `104`, but still misses eight migrations between `2026_03_28_000002_add_workflow_management_permissions` and `2026_04_05_180000_create_product_unit_masters_table`; this patch set closes that gap with a single cumulative release surface
- Data note: only deterministic seed data is included here. Environment-specific runtime rows are intentionally excluded.

## Apply Order

1. `2026-04-05_01_crc_workflow_release_surface.sql`
2. `2026-04-05_02_product_unit_masters_schema.sql`
3. `2026-04-05_03_migration_bookkeeping.sql`

## Notes

- These files are forward-only.
- File `03` should run only after `01` and `02` succeed.
- File `01` is idempotent and covers the schema/data delta equivalent to:
  - `2026_03_28_000002_add_workflow_management_permissions`
  - `2026_03_29_094312_create_customer_request_assigned_to_receiver_table`
  - `2026_03_29_141628_create_customer_request_receiver_in_progress_table`
  - `2026_03_30_220000_add_handler_field_to_customer_request_status_catalogs`
  - `2026_03_30_223000_add_nguoi_xu_ly_id_to_customer_request_cases_table`
  - `2026_03_31_120000_extend_crc_workflow_metadata_schema`
  - `2026_04_01_085224_add_dispatched_at_to_pending_dispatch_table`
  - plus the minimal `workflow_definitions` / default `LUONG_A` bootstrap required to replay the CRC metadata surface from the locked baseline
- File `02` creates and seeds `product_unit_masters`.
- File `03` inserts the missing migration rows with deterministic batch `105`, the next batch after the locked baseline surface.
