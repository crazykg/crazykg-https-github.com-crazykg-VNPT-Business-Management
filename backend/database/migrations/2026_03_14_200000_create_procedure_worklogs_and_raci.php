<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Table 5: project_procedure_step_worklogs
        // Each entry = one log event (status change, manual note, document added…)
        Schema::create('project_procedure_step_worklogs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('step_id');
            $table->unsignedBigInteger('procedure_id');  // denormalised for fast lookup

            // What changed
            $table->enum('log_type', [
                'STATUS_CHANGE',   // tiến độ thay đổi
                'DOCUMENT_ADDED',  // số VB / ngày VB được điền
                'NOTE',            // ghi chú thuần tuỳ
                'CUSTOM',          // bước mới thêm vào / xoá
            ])->default('NOTE');

            $table->text('content');                   // human-readable description
            $table->string('old_value', 100)->nullable();
            $table->string('new_value', 100)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('step_id')->references('id')->on('project_procedure_steps')->onDelete('cascade');
            $table->foreign('procedure_id')->references('id')->on('project_procedures')->onDelete('cascade');
            $table->index(['step_id', 'created_at'], 'idx_worklog_step');
            $table->index(['procedure_id', 'created_at'], 'idx_worklog_proc');
        });

        // Table 6: project_procedure_raci
        // RACI matrix per procedure — user X plays role R/A/C/I in this procedure
        Schema::create('project_procedure_raci', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('raci_role', ['R', 'A', 'C', 'I']);
            $table->string('note', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('procedure_id')->references('id')->on('project_procedures')->onDelete('cascade');
            $table->unique(['procedure_id', 'user_id', 'raci_role'], 'uq_raci_user_role');
            $table->index('procedure_id', 'idx_raci_proc');
            $table->index('user_id',      'idx_raci_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_procedure_raci');
        Schema::dropIfExists('project_procedure_step_worklogs');
    }
};
