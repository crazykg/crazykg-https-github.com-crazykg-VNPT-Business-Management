<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_procedure_step_raci', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('step_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('raci_role', ['R', 'A', 'C', 'I']);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('step_id')
                ->references('id')
                ->on('project_procedure_steps')
                ->onDelete('cascade');

            $table->unique(['step_id', 'user_id', 'raci_role'], 'uq_proc_step_raci_user_role');
            $table->index('step_id', 'idx_proc_step_raci_step');
            $table->index('user_id', 'idx_proc_step_raci_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_procedure_step_raci');
    }
};
