<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Table 1: project_procedure_templates
        Schema::create('project_procedure_templates', function (Blueprint $table) {
            $table->id();
            $table->string('template_code', 50)->unique();
            $table->string('template_name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->index('template_code', 'idx_template_code');
        });

        // Table 2: project_procedure_template_steps
        Schema::create('project_procedure_template_steps', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('template_id');
            $table->integer('step_number');
            $table->unsignedBigInteger('parent_step_id')->nullable();
            $table->string('phase', 100)->nullable();
            $table->string('step_name', 500);
            $table->text('step_detail')->nullable();
            $table->string('lead_unit', 500)->nullable();
            $table->string('support_unit', 500)->nullable();
            $table->text('expected_result')->nullable();
            $table->integer('default_duration_days')->nullable()->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('template_id')->references('id')->on('project_procedure_templates')->onDelete('cascade');
            $table->foreign('parent_step_id')->references('id')->on('project_procedure_template_steps')->onDelete('set null');
            $table->index(['template_id', 'sort_order'], 'idx_template_sort');
        });

        // Table 3: project_procedures
        Schema::create('project_procedures', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('template_id');
            $table->string('procedure_name', 255);
            $table->decimal('overall_progress', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->foreign('template_id')->references('id')->on('project_procedure_templates');
            $table->index('project_id', 'idx_project');
        });

        // Table 4: project_procedure_steps
        Schema::create('project_procedure_steps', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('template_step_id')->nullable();
            $table->integer('step_number');
            $table->unsignedBigInteger('parent_step_id')->nullable();
            $table->string('phase', 100)->nullable();
            $table->string('step_name', 500);
            $table->text('step_detail')->nullable();
            $table->string('lead_unit', 500)->nullable();
            $table->string('support_unit', 500)->nullable();
            $table->text('expected_result')->nullable();
            $table->integer('duration_days')->nullable()->default(0);
            $table->enum('progress_status', ['CHUA_THUC_HIEN', 'DANG_THUC_HIEN', 'HOAN_THANH'])->default('CHUA_THUC_HIEN');
            $table->string('document_number', 255)->nullable();
            $table->date('document_date')->nullable();
            $table->date('actual_start_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->text('step_notes')->nullable();
            $table->integer('sort_order')->default(0);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('procedure_id')->references('id')->on('project_procedures')->onDelete('cascade');
            $table->foreign('template_step_id')->references('id')->on('project_procedure_template_steps')->onDelete('set null');
            $table->foreign('parent_step_id')->references('id')->on('project_procedure_steps')->onDelete('set null');
            $table->index(['procedure_id', 'sort_order'], 'idx_procedure_sort');
            $table->index(['procedure_id', 'progress_status'], 'idx_progress');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_procedure_steps');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('project_procedure_template_steps');
        Schema::dropIfExists('project_procedure_templates');
    }
};
