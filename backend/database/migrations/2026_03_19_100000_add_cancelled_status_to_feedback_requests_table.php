<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NEW_VALUE = 'CANCELLED';
    private const TABLE     = 'feedback_requests';
    private const COLUMN    = 'status';

    public function up(): void
    {
        $this->modifyEnum(static fn (array $values): array => (
            in_array(self::NEW_VALUE, $values, true) ? $values : [...$values, self::NEW_VALUE]
        ));
    }

    public function down(): void
    {
        // Chuyển các bản ghi CANCELLED → CLOSED trước khi xoá giá trị khỏi enum
        if (Schema::hasTable(self::TABLE) && Schema::hasColumn(self::TABLE, self::COLUMN)) {
            DB::table(self::TABLE)
                ->where(self::COLUMN, self::NEW_VALUE)
                ->update([self::COLUMN => 'CLOSED']);
        }

        $this->modifyEnum(static fn (array $values): array => (
            array_values(array_filter($values, static fn (string $v): bool => $v !== self::NEW_VALUE))
        ));
    }

    /**
     * @param callable(array<int, string>): array<int, string> $transform
     */
    private function modifyEnum(callable $transform): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        $meta = DB::selectOne(
            "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = ?
               AND COLUMN_NAME  = ?",
            [self::TABLE, self::COLUMN]
        );

        if (! is_object($meta) || ! is_string($meta->COLUMN_TYPE ?? null)) {
            return;
        }

        $values = $transform($this->parseEnumValues($meta->COLUMN_TYPE));
        if ($values === []) {
            return;
        }

        $enumSql  = implode(', ', array_map(
            static fn (string $v): string => "'" . str_replace("'", "''", $v) . "'",
            $values
        ));
        $nullable = strtoupper((string) ($meta->IS_NULLABLE ?? 'NO')) === 'YES' ? 'NULL' : 'NOT NULL';
        $default  = $meta->COLUMN_DEFAULT !== null
            ? "DEFAULT '" . str_replace("'", "''", (string) $meta->COLUMN_DEFAULT) . "'"
            : '';
        $comment  = ($meta->COLUMN_COMMENT ?? '') !== ''
            ? "COMMENT '" . str_replace("'", "''", (string) $meta->COLUMN_COMMENT) . "'"
            : '';

        DB::statement(
            "ALTER TABLE `" . self::TABLE . "`
             MODIFY COLUMN `" . self::COLUMN . "` enum({$enumSql}) {$nullable} {$default} {$comment}"
        );
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

        return array_values(array_filter(
            array_map(static fn (mixed $v): string => trim((string) $v), $rawValues),
            static fn (string $v): bool => $v !== ''
        ));
    }
};
