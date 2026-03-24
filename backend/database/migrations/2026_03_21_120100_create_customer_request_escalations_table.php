<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_request_escalations', function (Blueprint $table): void {
            $table->id();
            // "ESC-2026-0001"
            $table->string('escalation_code', 30)->unique();
            $table->unsignedBigInteger('request_case_id');
            $table->unsignedBigInteger('raised_by_user_id');
            $table->timestamp('raised_at');

            // Mô tả khó khăn
            // technical | resource | customer | scope_change | dependency | sla_risk
            $table->string('difficulty_type', 30);
            // low | medium | high | critical
            $table->string('severity', 10)->default('medium');
            $table->text('description');
            $table->string('impact_description', 1000)->nullable();
            $table->date('blocked_since')->nullable();

            // Đề xuất xử lý
            $table->text('proposed_action')->nullable();
            $table->unsignedBigInteger('proposed_handler_user_id')->nullable();
            $table->decimal('proposed_additional_hours', 8, 2)->nullable();
            $table->date('proposed_deadline_extension')->nullable();

            // Trạng thái duyệt: pending → reviewing → resolved | rejected | closed
            $table->string('status', 20)->default('pending');
            $table->unsignedBigInteger('reviewed_by_user_id')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            // approve_proposal | reassign | add_resource | extend_deadline | cancel_request | other
            $table->string('resolution_decision', 30)->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('request_case_id', 'idx_esc_case');
            $table->index(['status', 'severity'], 'idx_esc_status');
            $table->index(['raised_by_user_id', 'raised_at'], 'idx_esc_raised');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_escalations');
    }
};
