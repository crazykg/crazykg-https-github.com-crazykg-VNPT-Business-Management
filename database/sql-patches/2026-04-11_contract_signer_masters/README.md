# Forward-Only SQL Patch Set

- Scope: sync the contract signer allowlist release surface into replayable SQL for environments that deploy from `database/sql-patches/` instead of running Laravel migrations directly.
- Source parity:
  - `backend/database/migrations/2026_04_11_170000_create_contract_signer_masters_table.php`
  - `backend/database/migrations/2026_04_11_170100_backfill_contract_signer_masters_from_contracts.php`
- Validation note: this patch set is validated against the current local MySQL target by replaying it onto a scratch clone with the `contract_signer_masters` surface removed first, then comparing schema, seeded signer rows, and migration bookkeeping.

## Apply Order

1. `2026-04-11_01_contract_signer_masters_schema.sql`
2. `2026-04-11_02_contract_signer_masters_backfill.sql`
3. `2026-04-11_03_migration_bookkeeping.sql`

## Pending Migration Audit On Current Repo State

Already covered by existing SQL patch sets:

- `2026_04_09_210000_add_detail_status_and_worklog_fields_for_crc`
  - `database/sql-patches/2026-04-10_crc_detail_status_worklog/2026-04-10_01_add_detail_status_and_worklog_fields_for_crc.sql`
- `2026_04_13_133559_create_product_packages_table`
- `2026_04_13_163842_fix_product_package_foreign_key_constraint`
- `2026_04_13_225500_add_product_package_id_to_project_items_table`
  - `database/sql-patches/2026-04-10_from_vnpt_business_db_2026-02-24_175408_product_package_surface/`

Still pending locally but outside this signer-master patch scope:

- `2026_04_06_160000_align_workflowa_and_fixed_status_fields`
- `2026_04_06_183000_realign_workflowa_transition_graph_runtime`

These two CRC workflow migrations need a separate release audit instead of being mixed into the signer-master patch.

## Notes

- The files are forward-only and idempotent on the targeted release surface.
- File `01` creates `contract_signer_masters` and restores its foreign keys when the target DB is missing that table.
- File `02` backfills signer allowlist rows from existing `contracts.signer_user_id` values.
- File `03` records the related migration rows so SQL-replayed environments stay aligned with Laravel migration bookkeeping.
