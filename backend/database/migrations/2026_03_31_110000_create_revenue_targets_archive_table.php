<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('revenue_targets_archive')) {
            return;
        }

        Schema::create('revenue_targets_archive', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('source_id')->unique();

            $table->string('period_type', 20)->nullable();
            $table->string('period_key', 10)->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->unsignedBigInteger('dept_id')->default(0);
            $table->string('target_type', 30)->nullable();
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamp('source_created_at')->nullable();
            $table->timestamp('source_updated_at')->nullable();
            $table->timestamp('source_deleted_at')->nullable();
            $table->timestamp('archived_at');
            $table->string('archive_reason', 50)->default('soft_delete_retention');
            $table->json('payload')->nullable();

            $table->index(['period_type', 'period_key'], 'idx_rta_period');
            $table->index('dept_id', 'idx_rta_dept');
            $table->index('source_deleted_at', 'idx_rta_deleted_at');
            $table->index('archived_at', 'idx_rta_archived_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_targets_archive');
    }
};
