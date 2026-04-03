# Forward-Only SQL Patch Set

- Baseline dump: `/Users/pvro86gmail.com/Downloads/QLCV/database/vnpt_business_db_2026-02-24_175408.sql`
- Scope: sync the missing post-`2026-04-02` MySQL delta for custom user avatars into a replayable forward-only patch set
- Target state: repo migrations through `2026_04_03_130000_add_avatar_data_to_internal_users`
- Validation note: the locked dump currently stops before `2026_04_03_130000_add_avatar_data_to_internal_users`, while the validated local MySQL state already includes the two new `internal_users` avatar columns and migration bookkeeping batch `104`
- Data note: local MySQL currently contains runtime avatar data for one user row; that user-specific data is intentionally excluded because it is environment-specific and should not be shipped in release SQL

## Apply Order

1. `2026-04-03_01_internal_user_avatar_schema.sql`
2. `2026-04-03_02_migration_bookkeeping.sql`

## Notes

- These files are forward-only.
- File `02` should run only after `01` succeeds.
- File `01` is idempotent and adds only the two missing avatar columns on `internal_users`.
- File `02` inserts only the missing migration row with batch `104`, which is the next deterministic batch after the previously validated `2026-04-02` release surface.
