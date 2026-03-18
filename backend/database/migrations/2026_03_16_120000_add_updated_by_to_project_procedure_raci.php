<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_procedure_raci', function (Blueprint $table) {
            $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');

            $table->foreign('updated_by')
                  ->references('id')->on('internal_users')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_procedure_raci', function (Blueprint $table) {
            $table->dropForeign(['updated_by']);
            $table->dropColumn('updated_by');
        });
    }
};
