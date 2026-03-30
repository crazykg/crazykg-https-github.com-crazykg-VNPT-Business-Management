# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-03-26` MySQL deltas for contracts, customers, employee party profiles, healthcare customer classification, and `product_target_segments` into a replayable forward-only patch set
- Target state: repo migrations through `2026_03_30_090000_backfill_healthcare_classification_and_seed_his_non_bed_segments`, including the missing schema/data/bookkeeping changes introduced on `2026-03-27` to `2026-03-30`
- Validation note: the locked baseline already has no blank `customer_code`, so `customer_code_auto_generated` is synchronized as schema plus flag normalization without per-row code generation
- Deterministic data note: the original `2026_03_28_220000_backfill_random_bed_capacity_for_healthcare_customers` migration is represented here by explicit row updates copied from the validated local MySQL state so the patch stays reproducible

## Apply Order

1. `2026-03-30_01_contract_customer_employee_schema.sql`
2. `2026-03-30_02_customer_healthcare_and_his_non_bed_segments.sql`
3. `2026-03-30_03_migration_bookkeeping.sql`

## Notes

- These files are forward-only.
- File `03` should run only after `01` and `02` succeed.
- File `01` adds the missing contract/customer/employee-party schema surface and seeds the required `project_types`, `permissions`, and `role_permission` rows.
- File `02` is idempotent: it restores the required healthcare columns when missing, aligns healthcare classification, applies deterministic `bed_capacity` updates for the rows that were already backfilled in MySQL, and conditionally syncs the validated `product_target_segments` rows for product IDs `5`, `18`, `19`, and `24` to `30` when those products exist in the target environment.
- The locked baseline dump currently contains only product `id = 5` from that validated segment set, so scratch validation from the baseline is expected to replay the `EMR` segment plus skip the remaining `VNPT-HIS` / `HIS KG` rows until those products already exist in the target environment.
