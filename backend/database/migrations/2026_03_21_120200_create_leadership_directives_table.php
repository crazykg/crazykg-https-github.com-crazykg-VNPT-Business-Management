<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leadership_directives', function (Blueprint $table): void {
            $table->id();
            // "DIR-2026-0001"
            $table->string('directive_code', 30)->unique();
            $table->unsignedBigInteger('issued_by_user_id');    // Lãnh đạo ra chỉ đạo
            $table->unsignedBigInteger('assigned_to_user_id');  // PM nhận chỉ đạo
            // [user_id, ...] CC
            $table->json('cc_user_ids')->nullable();

            // resource_transfer | deadline_extension | priority_change | contact_customer | training | other
            $table->string('directive_type', 30);
            $table->text('content');
            // low | medium | high
            $table->string('priority', 10)->default('high');

            // Link nguồn (optional)
            // 'escalation' | 'pain_point' | 'manual'
            $table->string('source_type', 30)->nullable();
            $table->unsignedBigInteger('source_escalation_id')->nullable();
            // [case_id, ...]
            $table->json('linked_case_ids')->nullable();

            $table->date('deadline')->nullable();
            // pending → acknowledged → completed
            $table->string('status', 20)->default('pending');
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('completion_note')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('issued_by_user_id', 'idx_dir_issued');
            $table->index(['assigned_to_user_id', 'status'], 'idx_dir_assigned');
            $table->index(['source_type', 'source_escalation_id'], 'idx_dir_source');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leadership_directives');
    }
};
