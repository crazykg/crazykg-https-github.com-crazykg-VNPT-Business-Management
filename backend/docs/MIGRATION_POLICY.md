# Zero-Downtime Schema Migration Policy

## Purpose

This document defines the baseline rules for production-safe schema changes in QLCV.
All migrations introduced by the architecture upgrade plan must follow these rules
before being applied to shared or production environments.

## Rules for all production migrations

1. Index operations must use online DDL when MySQL supports it.

```php
if (DB::getDriverName() === 'mysql') {
    DB::statement(
        'CREATE INDEX idx_name ON table_name (col1, col2) ALGORITHM=INPLACE LOCK=NONE'
    );
}
```

Use Laravel's `$table->index()` only for SQLite/test fallback branches.

2. New columns must be backward-compatible on deploy.

```php
Schema::table('example_table', function (Blueprint $table) {
    $table->string('new_column')->nullable()->after('existing_column');
});
```

Prefer nullable columns or explicit defaults so old application code keeps running during rollout.

3. Column drops must be two-phase.

- Phase 1: deploy application code that no longer reads or writes the column.
- Phase 2: run a later migration to drop the column after the old code path is gone.

4. Table renames are not allowed in production rollouts.

- Create a new table.
- Backfill or dual-write as needed.
- Cut traffic over.
- Remove the old table in a later deploy cycle.

5. Large data backfills must be chunked and resumable.

- Process records in batches.
- Avoid loading whole tables into memory.
- Prefer id-based chunking over offset pagination.

6. Every migration must have a rollback strategy.

- Document whether rollback is `down()`, a compensating forward migration, or manual intervention.
- If rollback is unsafe, call that out in the PR description before merge.

7. Test on a staging-like dataset first.

- Run the migration against staging or a production snapshot before shared deployment.
- Capture runtime, locking behavior, and expected post-migration checks.

## Development and test environment

The PHPUnit environment uses SQLite in memory, so MySQL online-DDL clauses are not available there.
Use a driver guard and provide a SQLite-safe fallback:

```php
public function up(): void
{
    if (DB::getDriverName() === 'mysql') {
        DB::statement(
            'CREATE INDEX idx_invoices_customer_status_due ON invoices (customer_id, status, due_date) ALGORITHM=INPLACE LOCK=NONE'
        );
    } else {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['customer_id', 'status', 'due_date'], 'idx_invoices_customer_status_due');
        });
    }
}
```

## Pre-merge checklist

- Migration is backward-compatible with the currently deployed code.
- MySQL-only statements are guarded by `DB::getDriverName() === 'mysql'`.
- Expensive updates use chunking or batched SQL.
- Verification steps are documented in the related plan or PR.
- Rollback strategy is explicit.
