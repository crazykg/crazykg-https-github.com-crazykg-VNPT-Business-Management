<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
            Schema::table('invoices', function (Blueprint $table) {
                // R1: Overdue covering — overdueScope(), buildKpis(), buildTopDebtors(),
                //     buildUrgentOverdue(), buildAgingRows() all use:
                //     WHERE status NOT IN (...) AND due_date < ? AND deleted_at IS NULL
                //           AND (total_amount - paid_amount) > 0
                $table->index(
                    ['status', 'due_date', 'deleted_at', 'total_amount', 'paid_amount'],
                    'idx_inv_overdue_cover'
                );

                // R2: Customer+status composite — debtByCustomer(), buildTopDebtors(),
                //     buildAgingRows() GROUP BY customer_id with status + deleted_at filter
                $table->index(
                    ['customer_id', 'status', 'deleted_at'],
                    'idx_inv_cust_status'
                );
            });
        }

        // ── receipts ────────────────────────────────────────────────────────────
        if (Schema::hasTable('receipts')) {
            Schema::table('receipts', function (Blueprint $table) {
                // R3: Reconciliation covering — reconcileInvoice() runs:
                //     SUM(amount) WHERE invoice_id = ? AND status = 'CONFIRMED' AND deleted_at IS NULL
                $table->index(
                    ['invoice_id', 'status', 'deleted_at', 'amount'],
                    'idx_rcp_reconcile'
                );
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropIndex('idx_inv_overdue_cover');
                $table->dropIndex('idx_inv_cust_status');
            });
        }

        if (Schema::hasTable('receipts')) {
            Schema::table('receipts', function (Blueprint $table) {
                $table->dropIndex('idx_rcp_reconcile');
            });
        }
    }
};
