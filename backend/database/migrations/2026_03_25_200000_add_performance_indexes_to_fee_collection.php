<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Performance indexes for fee collection / revenue management.
 *
 * R1 — Overdue covering index (5+ query locations)
 * R2 — Customer+status composite (aging/debtor GROUP BY)
 * R3 — Unique invoice_code (data integrity)
 * R4 — Receipt reconciliation covering index
 * R5 — Unique receipt_code (data integrity)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Invoices ────────────────────────────────────────────────

        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table) {
                // R1: Overdue covering — WHERE status NOT IN (...) AND due_date < CURDATE()
                //     AND deleted_at IS NULL AND (total_amount - paid_amount) > 0
                $table->index(
                    ['status', 'deleted_at', 'due_date', 'total_amount', 'paid_amount'],
                    'idx_inv_overdue_cover'
                );

                // R2: Customer + status composite — aging, debtor GROUP BY, debt-by-customer
                $table->index(
                    ['customer_id', 'status', 'deleted_at'],
                    'idx_inv_cust_status'
                );

                // R3: Unique invoice_code for non-deleted rows.
                // MySQL: unique(invoice_code) — app-level guard ensures soft-deleted
                // codes are freed before re-use (CRC code-gen avoids collisions).
                // Drop existing non-unique index first, then add unique.
                $table->dropIndex('idx_inv_code');
                $table->unique('invoice_code', 'uq_inv_code');
            });
        }

        // ── Receipts ────────────────────────────────────────────────

        if (Schema::hasTable('receipts')) {
            Schema::table('receipts', function (Blueprint $table) {
                // R4: Reconciliation covering — SUM(amount) WHERE invoice_id=? AND status='CONFIRMED'
                $table->index(
                    ['invoice_id', 'status', 'deleted_at', 'amount'],
                    'idx_rcp_reconcile'
                );

                // R5: Unique receipt_code — same pattern as invoices.
                $table->dropIndex('idx_rcp_code');
                $table->unique('receipt_code', 'uq_rcp_code');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropIndex('idx_inv_overdue_cover');
                $table->dropIndex('idx_inv_cust_status');

                // Restore original non-unique index
                $table->dropUnique('uq_inv_code');
                $table->index('invoice_code', 'idx_inv_code');
            });
        }

        if (Schema::hasTable('receipts')) {
            Schema::table('receipts', function (Blueprint $table) {
                $table->dropIndex('idx_rcp_reconcile');

                // Restore original non-unique index
                $table->dropUnique('uq_rcp_code');
                $table->index('receipt_code', 'idx_rcp_code');
            });
        }
    }
};
