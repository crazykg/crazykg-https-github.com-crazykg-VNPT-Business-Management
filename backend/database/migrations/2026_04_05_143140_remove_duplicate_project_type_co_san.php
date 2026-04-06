<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->tableExists()) {
            return;
        }

        // Migrate any projects still using the legacy code (safety net)
        if ($this->columnExists('projects', 'investment_mode')) {
            DB::table('projects')
                ->where('investment_mode', 'THUE_DICH_VU_CO_SAN')
                ->update(['investment_mode' => 'THUE_DICH_VU_COSAN']);
        }

        // Remove the legacy duplicate row (THUE_DICH_VU_CO_SAN was the old code,
        // THUE_DICH_VU_COSAN is the canonical one used by ensureDefaultProjectTypesExist)
        DB::table('project_types')
            ->where('type_code', 'THUE_DICH_VU_CO_SAN')
            ->delete();
    }

    public function down(): void
    {
        if (! $this->tableExists()) {
            return;
        }

        // Restore the legacy row only if it doesn't already exist
        $exists = DB::table('project_types')
            ->where('type_code', 'THUE_DICH_VU_CO_SAN')
            ->exists();

        if (! $exists) {
            DB::table('project_types')->insert([
                'type_code' => 'THUE_DICH_VU_CO_SAN',
                'type_name' => 'Thuê dịch vụ CNTT có sẵn',
                'is_active' => true,
                'sort_order' => 30,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function tableExists(): bool
    {
        return DB::getSchemaBuilder()->hasTable('project_types');
    }

    private function columnExists(string $table, string $column): bool
    {
        return DB::getSchemaBuilder()->hasColumn($table, $column);
    }
};
