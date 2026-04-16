<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('projects') || Schema::hasTable('project_implementation_units')) {
            return;
        }

        $hasInternalUsersTable = Schema::hasTable('internal_users');

        Schema::create('project_implementation_units', function (Blueprint $table) use ($hasInternalUsersTable): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('implementation_user_id')->nullable();
            $table->string('implementation_user_code', 100)->nullable();
            $table->string('implementation_full_name', 255)->nullable();
            $table->string('implementation_unit_code', 100)->nullable();
            $table->string('implementation_unit_name', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique('project_id', 'uq_project_implementation_units_project');
            $table->index('implementation_user_id', 'idx_project_implementation_units_user');

            $table->foreign('project_id', 'fk_project_implementation_units_project')
                ->references('id')
                ->on('projects')
                ->cascadeOnDelete();

            if ($hasInternalUsersTable) {
                $table->foreign('implementation_user_id', 'fk_project_implementation_units_user')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('project_implementation_units')) {
            return;
        }

        Schema::table('project_implementation_units', function (Blueprint $table): void {
            if (Schema::hasTable('internal_users')) {
                $table->dropForeign('fk_project_implementation_units_user');
            }
            $table->dropForeign('fk_project_implementation_units_project');
            $table->dropUnique('uq_project_implementation_units_project');
            $table->dropIndex('idx_project_implementation_units_user');
        });

        Schema::dropIfExists('project_implementation_units');
    }
};
