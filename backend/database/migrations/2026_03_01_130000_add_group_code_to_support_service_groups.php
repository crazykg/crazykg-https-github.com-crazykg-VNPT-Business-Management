<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_service_groups')) {
            return;
        }

        if (! Schema::hasColumn('support_service_groups', 'group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->string('group_code', 50)->nullable()->after('group_name');
            });
        }

        $this->backfillSupportServiceGroupCodes();
        $this->enforceSupportServiceGroupCodeNotNull();

        if (! $this->indexExists('support_service_groups', 'uq_support_service_groups_group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->unique('group_code', 'uq_support_service_groups_group_code');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_service_groups')) {
            return;
        }

        if ($this->indexExists('support_service_groups', 'uq_support_service_groups_group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropUnique('uq_support_service_groups_group_code');
            });
        }

        if (Schema::hasColumn('support_service_groups', 'group_code')) {
            Schema::table('support_service_groups', function (Blueprint $table): void {
                $table->dropColumn('group_code');
            });
        }
    }

    private function backfillSupportServiceGroupCodes(): void
    {
        if (
            ! Schema::hasColumn('support_service_groups', 'id')
            || ! Schema::hasColumn('support_service_groups', 'group_name')
            || ! Schema::hasColumn('support_service_groups', 'group_code')
        ) {
            return;
        }

        $rows = DB::table('support_service_groups')
            ->select(['id', 'group_name', 'group_code'])
            ->orderBy('id')
            ->get();

        $usedCodes = [];

        foreach ($rows as $row) {
            $id = (int) ($row->id ?? 0);
            if ($id <= 0) {
                continue;
            }

            $existingCode = $this->sanitizeGroupCode((string) ($row->group_code ?? ''));
            $generatedFromName = $this->sanitizeGroupCode((string) ($row->group_name ?? ''));
            $baseCode = $existingCode !== '' ? $existingCode : $generatedFromName;
            if ($baseCode === '') {
                $baseCode = 'GROUP_'.$id;
            }

            $resolvedCode = $this->resolveUniqueGroupCode($baseCode, $usedCodes, $id);
            DB::table('support_service_groups')
                ->where('id', $id)
                ->update(['group_code' => $resolvedCode]);
        }
    }

    private function enforceSupportServiceGroupCodeNotNull(): void
    {
        if (! Schema::hasColumn('support_service_groups', 'group_code')) {
            return;
        }

        DB::statement("
            UPDATE support_service_groups
            SET group_code = CONCAT('GROUP_', id)
            WHERE group_code IS NULL OR TRIM(group_code) = ''
        ");

        DB::statement("
            ALTER TABLE support_service_groups
            MODIFY group_code VARCHAR(50)
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
            NOT NULL COMMENT 'Mã nhóm chuẩn hóa UPPER_SNAKE_CASE'
        ");
    }

    private function sanitizeGroupCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    /**
     * @param array<string, true> $usedCodes
     */
    private function resolveUniqueGroupCode(string $baseCode, array &$usedCodes, int $id): string
    {
        $base = $this->sanitizeGroupCode($baseCode);
        if ($base === '') {
            $base = $this->sanitizeGroupCode('GROUP_'.$id);
        }
        if ($base === '') {
            $base = 'GROUP';
        }

        $candidate = $base;
        $counter = 1;

        while (isset($usedCodes[$candidate])) {
            $counter++;
            $suffix = '_'.$counter;
            $prefixLength = 50 - strlen($suffix);
            $prefix = substr($base, 0, max(1, $prefixLength));
            $candidate = $prefix.$suffix;
        }

        $usedCodes[$candidate] = true;
        return $candidate;
    }

    private function indexExists(string $table, string $indexName): bool
    {
        if (! Schema::hasTable($table) || DB::getDriverName() !== 'mysql') {
            return false;
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }
};
