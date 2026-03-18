<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Table: shared_timesheets ──────────────────────────────────────
        Schema::create('shared_timesheets', function (Blueprint $table) {
            $table->id();

            // Nguồn hiện tại: procedure step worklog
            $table->unsignedBigInteger('procedure_step_worklog_id')->nullable();

            // Payload
            $table->decimal('hours_spent', 8, 2);
            $table->date('work_date');
            $table->text('activity_description')->nullable();

            // Audit
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            // FK & Indexes
            $table->foreign('procedure_step_worklog_id')
                  ->references('id')->on('project_procedure_step_worklogs')
                  ->cascadeOnDelete();
            $table->foreign('created_by')
                  ->references('id')->on('internal_users')
                  ->nullOnDelete();
            $table->foreign('updated_by')
                  ->references('id')->on('internal_users')
                  ->nullOnDelete();

            $table->index('procedure_step_worklog_id', 'idx_ts_worklog');
            $table->index(['work_date', 'created_by'], 'idx_ts_date_user');
        });

        // ── Table: shared_issues ──────────────────────────────────────────
        Schema::create('shared_issues', function (Blueprint $table) {
            $table->id();

            // Nguồn hiện tại: procedure step worklog
            $table->unsignedBigInteger('procedure_step_worklog_id')->nullable();

            // Payload
            $table->text('issue_content');
            $table->text('proposal_content')->nullable();
            $table->enum('issue_status', ['JUST_ENCOUNTERED', 'IN_PROGRESS', 'RESOLVED'])
                  ->default('JUST_ENCOUNTERED');

            // Audit
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // FK & Indexes
            $table->foreign('procedure_step_worklog_id')
                  ->references('id')->on('project_procedure_step_worklogs')
                  ->cascadeOnDelete();
            $table->foreign('created_by')
                  ->references('id')->on('internal_users')
                  ->nullOnDelete();
            $table->foreign('updated_by')
                  ->references('id')->on('internal_users')
                  ->nullOnDelete();

            $table->index('procedure_step_worklog_id', 'idx_issue_worklog');
            $table->index('issue_status', 'idx_issue_status');
            $table->index('created_by', 'idx_issue_creator');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_issues');
        Schema::dropIfExists('shared_timesheets');
    }
};
