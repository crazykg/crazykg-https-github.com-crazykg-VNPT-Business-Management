<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Đổi mã THUE_DICH_VU → THUE_DICH_VU_DACTHU trong:
 *   - project_types.type_code
 *   - projects.investment_mode
 *   - procedure_templates.template_code
 */
return new class extends Migration
{
    private const OLD_CODE = 'THUE_DICH_VU';
    private const NEW_CODE = 'THUE_DICH_VU_DACTHU';

    public function up(): void
    {
        // 1. project_types
        if (Schema::hasTable('project_types') && Schema::hasColumn('project_types', 'type_code')) {
            DB::table('project_types')
                ->where('type_code', self::OLD_CODE)
                ->update([
                    'type_code'  => self::NEW_CODE,
                    'updated_at' => DB::raw('NOW()'),
                ]);
        }

        // 2. projects.investment_mode
        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'investment_mode')) {
            // Nếu cột là ENUM → cần ALTER trước khi UPDATE
            $this->expandEnumIfNeeded('projects', 'investment_mode');

            DB::table('projects')
                ->where('investment_mode', self::OLD_CODE)
                ->update([
                    'investment_mode' => self::NEW_CODE,
                    'updated_at'      => DB::raw('NOW()'),
                ]);
        }

        // 3. procedure_templates
        if (Schema::hasTable('procedure_templates') && Schema::hasColumn('procedure_templates', 'template_code')) {
            DB::table('procedure_templates')
                ->where('template_code', self::OLD_CODE)
                ->update([
                    'template_code' => self::NEW_CODE,
                    'updated_at'    => DB::raw('NOW()'),
                ]);
        }
    }

    public function down(): void
    {
        // Rollback: THUE_DICH_VU_DACTHU → THUE_DICH_VU
        if (Schema::hasTable('project_types') && Schema::hasColumn('project_types', 'type_code')) {
            DB::table('project_types')
                ->where('type_code', self::NEW_CODE)
                ->update(['type_code' => self::OLD_CODE, 'updated_at' => DB::raw('NOW()')]);
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'investment_mode')) {
            DB::table('projects')
                ->where('investment_mode', self::NEW_CODE)
                ->update(['investment_mode' => self::OLD_CODE, 'updated_at' => DB::raw('NOW()')]);
        }

        if (Schema::hasTable('procedure_templates') && Schema::hasColumn('procedure_templates', 'template_code')) {
            DB::table('procedure_templates')
                ->where('template_code', self::NEW_CODE)
                ->update(['template_code' => self::OLD_CODE, 'updated_at' => DB::raw('NOW()')]);
        }
    }

    /**
     * Nếu cột là ENUM chứa OLD_CODE, mở rộng thêm NEW_CODE.
     */
    private function expandEnumIfNeeded(string $table, string $column): void
    {
        $columnType = DB::selectOne(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = ?
               AND COLUMN_NAME  = ?",
            [$table, $column]
        );

        if ($columnType === null) {
            return;
        }

        $type = $columnType->COLUMN_TYPE ?? '';
        if (stripos($type, 'enum') === false) {
            return; // Không phải ENUM → bỏ qua
        }

        // Nếu đã có NEW_CODE thì không cần ALTER
        if (stripos($type, self::NEW_CODE) !== false) {
            return;
        }

        // Nếu chưa có OLD_CODE cũng bỏ qua
        if (stripos($type, self::OLD_CODE) === false) {
            return;
        }

        // Chèn NEW_CODE vào enum values
        // Parse enum values: enum('A','B','C') → thêm NEW_CODE
        $newType = str_replace(
            "'" . self::OLD_CODE . "'",
            "'" . self::OLD_CODE . "','" . self::NEW_CODE . "'",
            $type
        );

        DB::statement("ALTER TABLE `{$table}` MODIFY `{$column}` {$newType} DEFAULT 'DAU_TU'");
    }
};
