<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->unsignedBigInteger('created_by')->nullable()->after('updated_by');
        });
    }

    public function down(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->dropColumn('created_by');
        });
    }
};
