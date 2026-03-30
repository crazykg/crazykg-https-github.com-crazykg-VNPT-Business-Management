<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Performance indexes for fee collection / revenue management.
 *
 * R1 — Overdue covering index for invoices (used in 5+ query locations)
 * R2 — Customer+status composite for aging / debtor GROUP BY queries
 * R3 — Reconciliation covering index for receipts (used on every receipt create/reverse)
 *
 * See plan-code/Doanh_thu_codex_plan_review.md §5 for full rationale.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── invoices ────────────────────────────────────────────────────────────
        if (Schema::hasTable('invoices')) {
            if (! $this->indexExists('invoices', 'idx_inv_overdue_cover')) {
                $this->createIndex(
                    'invoices',
                    ['status', 'due_date', 'deleted_at', 'total_amount', 'paid_amount'],
                    'idx_inv_overdue_cover'
                );
            }

            if (! $this->indexExists('invoices', 'idx_inv_cust_status')) {
                $this->createIndex(
                    'invoices',
                    ['customer_id', 'status', 'deleted_at'],
                    'idx_inv_cust_status'
                );
            }
        }

        // ── receipts ────────────────────────────────────────────────────────────
        if (Schema::hasTable('receipts')) {
            if (! $this->indexExists('receipts', 'idx_rcp_reconcile')) {
                $this->createIndex(
                    'receipts',
                    ['invoice_id', 'status', 'deleted_at', 'amount'],
                    'idx_rcp_reconcile'
                );
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('invoices') && $this->indexExists('invoices', 'idx_inv_overdue_cover')) {
            $this->dropIndexByName('invoices', 'idx_inv_overdue_cover');
        }

        if (Schema::hasTable('invoices') && $this->indexExists('invoices', 'idx_inv_cust_status')) {
            $this->dropIndexByName('invoices', 'idx_inv_cust_status');
        }

        if (Schema::hasTable('receipts') && $this->indexExists('receipts', 'idx_rcp_reconcile')) {
            $this->dropIndexByName('receipts', 'idx_rcp_reconcile');
        }
    }

    private function indexExists(string $tableName, string $indexName): bool
    {
        if (! Schema::hasTable($tableName)) {
            return false;
        }

        if (! $this->usingMysql()) {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $tableName)
            ->where('index_name', $indexName)
            ->exists();
    }

    /**
     * @param array<int, string> $columns
     */
    private function createIndex(string $tableName, array $columns, string $indexName): void
    {
        if ($this->usingMysql()) {
            $quotedColumns = implode(', ', array_map(
                static fn (string $column): string => sprintf('`%s`', $column),
                $columns
            ));

            DB::statement(sprintf(
                'CREATE INDEX `%s` ON `%s` (%s) ALGORITHM=INPLACE LOCK=NONE',
                $indexName,
                $tableName,
                $quotedColumns
            ));

            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName): void {
            $table->index($columns, $indexName);
        });
    }

    private function dropIndexByName(string $tableName, string $indexName): void
    {
        if ($this->usingMysql()) {
            DB::statement(sprintf(
                'ALTER TABLE `%s` DROP INDEX `%s`, ALGORITHM=INPLACE, LOCK=NONE',
                $tableName,
                $indexName
            ));

            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($indexName): void {
            $table->dropIndex($indexName);
        });
    }

    private function usingMysql(): bool
    {
        return DB::getDriverName() === 'mysql';
    }
};
