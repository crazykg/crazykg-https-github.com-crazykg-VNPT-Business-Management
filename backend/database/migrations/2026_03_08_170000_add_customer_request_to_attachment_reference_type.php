<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('attachments') || ! Schema::hasColumn('attachments', 'reference_type')) {
            return;
        }

        $column = DB::selectOne(
            "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attachments' AND COLUMN_NAME = 'reference_type'"
        );

        if (! is_object($column) || ! is_string($column->COLUMN_TYPE ?? null)) {
            return;
        }

        $enumValues = $this->parseEnumValues($column->COLUMN_TYPE);
        foreach (['CUSTOMER_REQUEST', 'TRANSITION', 'WORKLOG'] as $requiredValue) {
            if (! in_array($requiredValue, $enumValues, true)) {
                $enumValues[] = $requiredValue;
            }
        }

        $enumSql = implode(',', array_map(
            static fn (string $value): string => "'".str_replace("'", "''", $value)."'",
            $enumValues
        ));

        DB::statement("ALTER TABLE `attachments` MODIFY COLUMN `reference_type` enum({$enumSql}) NOT NULL COMMENT 'Bảng cha của file đính kèm'");
    }

    public function down(): void
    {
        // no-op: giữ nguyên enum để tránh làm hỏng dữ liệu file đính kèm đã lưu.
    }

    /**
     * @return array<int, string>
     */
    private function parseEnumValues(string $columnType): array
    {
        if (! preg_match('/^enum\((.*)\)$/i', trim($columnType), $matches)) {
            return [];
        }

        $rawValues = str_getcsv($matches[1], ',', "'", '\\');

        return array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $rawValues
        ), static fn (string $value): bool => $value !== ''));
    }
};
