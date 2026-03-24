<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bảng kế hoạch giao việc (tuần/tháng)
        Schema::create('customer_request_plans', function (Blueprint $table): void {
            $table->id();
            // "W2026-W12" cho tuần, "M2026-04" cho tháng
            $table->string('plan_code', 30)->unique();
            // 'weekly' | 'monthly'
            $table->string('plan_type', 20);
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('dispatcher_user_id');
            // 'draft' → 'submitted' → 'approved'
            $table->string('status', 20)->default('draft');
            $table->text('note')->nullable();
            $table->decimal('total_planned_hours', 10, 2)->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['plan_type', 'period_start'], 'idx_plan_period');
            $table->index('dispatcher_user_id', 'idx_plan_dispatcher');
        });

        // Bảng các item yêu cầu trong kế hoạch
        Schema::create('customer_request_plan_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('plan_id');
            $table->unsignedBigInteger('request_case_id');
            $table->unsignedBigInteger('performer_user_id');
            $table->decimal('planned_hours', 8, 2);
            $table->date('planned_start_date')->nullable();
            $table->date('planned_end_date')->nullable();
            $table->smallInteger('priority_order')->default(0);
            $table->string('note', 500)->nullable();
            $table->decimal('actual_hours', 8, 2)->default(0);
            // 'pending' | 'in_progress' | 'completed' | 'carried_over' | 'cancelled'
            $table->string('actual_status', 30)->default('pending');
            // FK tới plan kỳ tiếp khi carry-over
            $table->unsignedBigInteger('carried_to_plan_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->index('plan_id', 'idx_item_plan');
            $table->index(['performer_user_id', 'planned_start_date'], 'idx_item_performer');
            $table->unique(['plan_id', 'request_case_id'], 'uq_plan_case');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_plan_items');
        Schema::dropIfExists('customer_request_plans');
    }
};
