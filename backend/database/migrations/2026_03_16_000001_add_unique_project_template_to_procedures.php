<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_procedures', function (Blueprint $table) {
            // Một dự án chỉ được có 1 procedure cho mỗi template
            $table->unique(['project_id', 'template_id'], 'uk_project_template_procedure');
        });
    }

    public function down(): void
    {
        Schema::table('project_procedures', function (Blueprint $table) {
            $table->dropUnique('uk_project_template_procedure');
        });
    }
};
