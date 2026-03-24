<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_targets', function (Blueprint $table) {
            $table->id();

            // Period
            $table->string('period_type', 20)->comment('MONTHLY | QUARTERLY | YEARLY');
            $table->string('period_key', 10)->comment('YYYY-MM | YYYY-QN | YYYY');
            $table->date('period_start');
            $table->date('period_end');

            // Classification
            $table->unsignedBigInteger('dept_id')->default(0)
                ->comment('0 = company-wide, >0 = specific department');
            $table->string('target_type', 30)->default('TOTAL')
                ->comment('TOTAL | NEW_CONTRACT | RENEWAL | RECURRING');

            // Values
            $table->decimal('target_amount', 18, 2)->default(0.00)->comment('Target revenue');
            $table->decimal('actual_amount', 18, 2)->default(0.00)->comment('Actual revenue (snapshot)');

            // Metadata
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Indexes
            $table->unique(
                ['period_type', 'period_key', 'dept_id', 'target_type'],
                'uq_target_period_dept_type'
            );
            $table->index(['period_type', 'period_key'], 'idx_rt_period');
            $table->index('dept_id', 'idx_rt_dept');
            $table->index('deleted_at', 'idx_rt_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_targets');
    }
};
