<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CONTRACT_PROJECT_TYPE_CODE = 'THUE_DICH_VU_COSAN';

    public function up(): void
    {
        if (Schema::hasTable('contracts') && ! Schema::hasColumn('contracts', 'project_type_code')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->string('project_type_code', 100)->nullable()->after('project_id');
                $table->index('project_type_code', 'idx_contracts_project_type_code');
            });
        }

        if (Schema::hasTable('project_types')) {
            DB::table('project_types')->updateOrInsert(
                ['type_code' => self::CONTRACT_PROJECT_TYPE_CODE],
                [
                    'type_name' => 'Thuê dịch vụ CNTT có sẵn',
                    'description' => null,
                    'is_active' => true,
                    'sort_order' => 30,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_types')) {
            DB::table('project_types')
                ->where('type_code', self::CONTRACT_PROJECT_TYPE_CODE)
                ->delete();
        }

        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'project_type_code')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->dropIndex('idx_contracts_project_type_code');
                $table->dropColumn('project_type_code');
            });
        }
    }
};
