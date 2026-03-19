<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->date('actual_start_date')->nullable()->after('document_date');
            $table->date('actual_end_date')->nullable()->after('actual_start_date');
        });
    }

    public function down(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->dropColumn(['actual_start_date', 'actual_end_date']);
        });
    }
};
