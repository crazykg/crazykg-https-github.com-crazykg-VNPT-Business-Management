<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_snapshots', function (Blueprint $table) {
            $table->id();

            // Snapshot period
            $table->string('period_type', 20)->comment('MONTHLY | QUARTERLY | YEARLY');
            $table->string('period_key', 10)->comment('YYYY-MM | YYYY-QN | YYYY');

            // Dimension
            $table->string('dimension_type', 30)->default('COMPANY')
                ->comment('COMPANY | DEPARTMENT | CUSTOMER | PRODUCT');
            $table->unsignedBigInteger('dimension_id')->default(0)
                ->comment('0 when dimension=COMPANY');
            $table->string('dimension_label', 255)->nullable()
                ->comment('Denormalized: dept/customer/product name');

            // Contract-based revenue (payment_schedules)
            $table->decimal('contract_expected', 18, 2)->default(0.00);
            $table->decimal('contract_collected', 18, 2)->default(0.00);
            $table->decimal('contract_outstanding', 18, 2)->default(0.00);
            $table->unsignedInteger('contract_count')->default(0);

            // Invoice-based revenue (invoices + receipts)
            $table->decimal('invoice_issued', 18, 2)->default(0.00);
            $table->decimal('invoice_collected', 18, 2)->default(0.00);
            $table->decimal('invoice_outstanding', 18, 2)->default(0.00);
            $table->unsignedInteger('invoice_count')->default(0);

            // Reconciled totals (NOT additive — see reconciliation model)
            $table->decimal('total_expected', 18, 2)->default(0.00)
                ->comment('Reconciled expected');
            $table->decimal('total_collected', 18, 2)->default(0.00)
                ->comment('Reconciled collected');
            $table->decimal('total_outstanding', 18, 2)->default(0.00)
                ->comment('Reconciled outstanding');

            // Target snapshot
            $table->decimal('target_amount', 18, 2)->default(0.00);
            $table->decimal('achievement_pct', 5, 1)->default(0.0);

            // Metadata
            $table->timestamp('snapshot_at')->nullable();
            $table->timestamps();

            // Indexes
            $table->unique(
                ['period_type', 'period_key', 'dimension_type', 'dimension_id'],
                'uq_snapshot_period_dimension'
            );
            $table->index(['period_type', 'period_key'], 'idx_rs_period');
            $table->index(['dimension_type', 'dimension_id'], 'idx_rs_dimension');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_snapshots');
    }
};
