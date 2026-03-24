<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_hours_snapshots', function (Blueprint $table): void {
            $table->id();
            // "2026-03" — năm-tháng
            $table->char('snapshot_month', 7);
            $table->unsignedBigInteger('user_id');
            $table->string('user_name', 100)->nullable();
            // NULL = tổng toàn bộ DA của user
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('project_name', 200)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('customer_name', 200)->nullable();

            $table->decimal('total_hours', 10, 2)->default(0);
            $table->decimal('billable_hours', 10, 2)->default(0);
            $table->decimal('non_billable_hours', 10, 2)->default(0);
            $table->decimal('estimated_hours', 10, 2)->default(0);
            $table->unsignedInteger('request_count')->default(0);
            $table->unsignedInteger('completed_count')->default(0);
            // {"CODING":40,"TESTING":12,...}
            $table->json('hours_by_activity')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index('snapshot_month', 'idx_snap_month');
            $table->index(['user_id', 'snapshot_month'], 'idx_snap_user');
            $table->index(['project_id', 'snapshot_month'], 'idx_snap_project');
            // SQLite-safe unique: skip COALESCE, use composite nullable
            $table->unique(['snapshot_month', 'user_id', 'project_id'], 'uq_snap');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_hours_snapshots');
    }
};
