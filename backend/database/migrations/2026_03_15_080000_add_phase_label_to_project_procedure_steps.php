<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->string('phase_label', 255)->nullable()->after('phase')
                ->comment('Tên giai đoạn tuỳ chỉnh theo dự án; fallback về PHASE_LABELS ở FE nếu null');
        });
    }

    public function down(): void
    {
        Schema::table('project_procedure_steps', function (Blueprint $table) {
            $table->dropColumn('phase_label');
        });
    }
};
