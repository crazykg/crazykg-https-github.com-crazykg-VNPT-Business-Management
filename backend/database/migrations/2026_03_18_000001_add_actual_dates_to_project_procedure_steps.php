<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('project_procedure_steps')) {
            return;
        }

        $hasActualStartDate = Schema::hasColumn('project_procedure_steps', 'actual_start_date');
        $hasActualEndDate = Schema::hasColumn('project_procedure_steps', 'actual_end_date');

        if ($hasActualStartDate && $hasActualEndDate) {
            return;
        }

        Schema::table('project_procedure_steps', function (Blueprint $table) use ($hasActualStartDate, $hasActualEndDate) {
            if (! $hasActualStartDate) {
                $table->date('actual_start_date')->nullable()->after('document_date');
            }

            if (! $hasActualEndDate) {
                $table->date('actual_end_date')->nullable()->after('actual_start_date');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('project_procedure_steps')) {
            return;
        }

        $columnsToDrop = [];

        if (Schema::hasColumn('project_procedure_steps', 'actual_start_date')) {
            $columnsToDrop[] = 'actual_start_date';
        }

        if (Schema::hasColumn('project_procedure_steps', 'actual_end_date')) {
            $columnsToDrop[] = 'actual_end_date';
        }

        if ($columnsToDrop !== []) {
            Schema::table('project_procedure_steps', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }
    }
};
