<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ATTACHMENT_REFERENCE_TYPE = 'PAYMENT_SCHEDULE';

    public function up(): void
    {
        if (Schema::hasTable('payment_schedules')) {
            Schema::table('payment_schedules', function (Blueprint $table): void {
                if (! Schema::hasColumn('payment_schedules', 'confirmed_by')) {
                    $table->unsignedBigInteger('confirmed_by')->nullable()->after('notes');
                }

                if (! Schema::hasColumn('payment_schedules', 'confirmed_at')) {
                    $table->timestamp('confirmed_at')->nullable()->after('confirmed_by');
                }
            });
        }

        $this->modifyAttachmentReferenceType(static fn (array $values): array => (
            in_array(self::ATTACHMENT_REFERENCE_TYPE, $values, true)
                ? $values
                : [...$values, self::ATTACHMENT_REFERENCE_TYPE]
        ));
    }

    public function down(): void
    {
        if (Schema::hasTable('attachments')) {
            DB::table('attachments')
                ->where('reference_type', self::ATTACHMENT_REFERENCE_TYPE)
                ->delete();
        }

        $this->modifyAttachmentReferenceType(static fn (array $values): array => (
            array_values(array_filter(
                $values,
                static fn (string $value): bool => $value !== self::ATTACHMENT_REFERENCE_TYPE
            ))
        ));

        if (Schema::hasTable('payment_schedules')) {
            Schema::table('payment_schedules', function (Blueprint $table): void {
                if (Schema::hasColumn('payment_schedules', 'confirmed_at')) {
                    $table->dropColumn('confirmed_at');
                }

                if (Schema::hasColumn('payment_schedules', 'confirmed_by')) {
                    $table->dropColumn('confirmed_by');
                }
            });
        }
    }

    /**
     * @param callable(array<int, string>): array<int, string> $transform
     */
    private function modifyAttachmentReferenceType(callable $transform): void
    {
        if (! Schema::hasTable('attachments') || ! Schema::hasColumn('attachments', 'reference_type')) {
            return;
        }

        $meta = DB::selectOne(
            "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'attachments'
               AND COLUMN_NAME = 'reference_type'"
        );

        if (! is_object($meta) || ! is_string($meta->COLUMN_TYPE ?? null)) {
            return;
        }

        $values = $transform($this->parseEnumValues($meta->COLUMN_TYPE));
        if ($values === []) {
            return;
        }

        $enumSql = implode(', ', array_map(
            static fn (string $value): string => "'" . str_replace("'", "''", $value) . "'",
            $values
        ));

        $nullable = strtoupper((string) ($meta->IS_NULLABLE ?? 'NO')) === 'YES' ? 'NULL' : 'NOT NULL';
        $default = $meta->COLUMN_DEFAULT !== null
            ? "DEFAULT '" . str_replace("'", "''", (string) $meta->COLUMN_DEFAULT) . "'"
            : '';
        $comment = ($meta->COLUMN_COMMENT ?? null) !== null && $meta->COLUMN_COMMENT !== ''
            ? "COMMENT '" . str_replace("'", "''", (string) $meta->COLUMN_COMMENT) . "'"
            : '';

        DB::statement(
            "ALTER TABLE `attachments`
             MODIFY COLUMN `reference_type` enum({$enumSql}) {$nullable} {$default} {$comment}"
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
            array_map(static fn (mixed $value): string => trim((string) $value), $rawValues),
            static fn (string $value): bool => $value !== ''
        ));
    }
};
