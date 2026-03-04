<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'customer_personnel';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, 'position_type')) {
            return;
        }

        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement(
            "ALTER TABLE `" . self::TABLE . "` MODIFY `position_type` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
        );
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, 'position_type')) {
            return;
        }

        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::table(self::TABLE)
            ->whereNotIn('position_type', ['GIAM_DOC', 'TRUONG_PHONG', 'DAU_MOI'])
            ->update(['position_type' => 'DAU_MOI']);

        DB::statement(
            "ALTER TABLE `" . self::TABLE . "` MODIFY `position_type` ENUM('GIAM_DOC','TRUONG_PHONG','DAU_MOI') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
        );
    }
};
