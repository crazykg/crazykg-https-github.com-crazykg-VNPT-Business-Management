<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->ensureSupportRequestStatusTransferDevColumn();
        $this->normalizeSupportMasterTextData();
        $this->deduplicateSupportServiceGroups();

        $this->dropIndexIfExists('support_service_groups', 'idx_support_groups_name');
        $this->addUniqueIndexIfMissing('support_service_groups', ['group_name'], 'uq_support_service_groups_group_name');
        $this->addIndexIfMissing('support_service_groups', ['is_active', 'group_name'], 'idx_support_groups_active_name');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('support_service_groups', 'idx_support_groups_active_name');
        $this->dropIndexIfExists('support_service_groups', 'uq_support_service_groups_group_name');

        // NOTE: Dedupe and data normalization are irreversible by design.
        $this->addIndexIfMissing('support_service_groups', ['group_name'], 'idx_support_groups_name');
    }

    private function ensureSupportRequestStatusTransferDevColumn(): void
    {
        if (! Schema::hasTable('support_request_statuses')) {
            return;
        }

        if (! Schema::hasColumn('support_request_statuses', 'is_transfer_dev')) {
            Schema::table('support_request_statuses', function (Blueprint $table): void {
                $table->boolean('is_transfer_dev')->default(false)->after('is_terminal');
            });
        }

        if (! Schema::hasColumn('support_request_statuses', 'status_code')) {
            return;
        }

        $updates = ['is_transfer_dev' => 1];
        if (Schema::hasColumn('support_request_statuses', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::table('support_request_statuses')
            ->whereRaw('UPPER(TRIM(status_code)) = ?', ['TRANSFER_DEV'])
            ->update($updates);
    }

    private function normalizeSupportMasterTextData(): void
    {
        if (Schema::hasTable('support_service_groups') && Schema::hasColumn('support_service_groups', 'group_name')) {
            DB::table('support_service_groups')
                ->whereRaw('group_name <> TRIM(group_name)')
                ->update(['group_name' => DB::raw('TRIM(group_name)')]);
        }

        if (Schema::hasTable('support_request_statuses')) {
            if (Schema::hasColumn('support_request_statuses', 'status_code')) {
                DB::table('support_request_statuses')
                    ->whereRaw('status_code <> UPPER(TRIM(status_code))')
                    ->update(['status_code' => DB::raw('UPPER(TRIM(status_code))')]);
            }

            if (Schema::hasColumn('support_request_statuses', 'status_name')) {
                DB::table('support_request_statuses')
                    ->whereRaw('status_name <> TRIM(status_name)')
                    ->update(['status_name' => DB::raw('TRIM(status_name)')]);
            }
        }
    }

    private function deduplicateSupportServiceGroups(): void
    {
        if (
            ! Schema::hasTable('support_service_groups')
            || ! Schema::hasColumn('support_service_groups', 'id')
            || ! Schema::hasColumn('support_service_groups', 'group_name')
        ) {
            return;
        }

        $rows = DB::table('support_service_groups')
            ->select(['id', 'group_name', 'is_active'])
            ->orderByRaw('LOWER(TRIM(group_name))')
            ->orderByRaw('CASE WHEN is_active = 1 THEN 0 ELSE 1 END')
            ->orderBy('id')
            ->get();

        $canonicalByKey = [];
        $duplicateMap = [];

        foreach ($rows as $row) {
            $key = $this->normalizeGroupKey((string) ($row->group_name ?? ''));
            if ($key === '') {
                continue;
            }

            $id = (int) ($row->id ?? 0);
            if ($id <= 0) {
                continue;
            }

            if (! isset($canonicalByKey[$key])) {
                $canonicalByKey[$key] = $id;
                continue;
            }

            $duplicateMap[$id] = $canonicalByKey[$key];
        }

        if ($duplicateMap === []) {
            return;
        }

        DB::transaction(function () use ($duplicateMap): void {
            $referenceColumns = $this->resolveSupportServiceGroupReferenceColumns();
            foreach ($duplicateMap as $duplicateId => $canonicalId) {
                foreach ($referenceColumns as $reference) {
                    DB::table($reference['table'])
                        ->where($reference['column'], $duplicateId)
                        ->update([$reference['column'] => $canonicalId]);
                }
            }

            DB::table('support_service_groups')
                ->whereIn('id', array_keys($duplicateMap))
                ->delete();
        });
    }

    /**
     * @return array<int, array{table:string,column:string}>
     */
    private function resolveSupportServiceGroupReferenceColumns(): array
    {
        if (DB::getDriverName() !== 'mysql') {
            return $this->fallbackSupportServiceGroupReferenceColumns();
        }

        $database = DB::getDatabaseName();
        if (! is_string($database) || $database === '') {
            return $this->fallbackSupportServiceGroupReferenceColumns();
        }

        $rows = DB::table('information_schema.key_column_usage')
            ->select(['table_name', 'column_name'])
            ->where('constraint_schema', $database)
            ->where('referenced_table_name', 'support_service_groups')
            ->where('referenced_column_name', 'id')
            ->get();

        $references = [];
        foreach ($rows as $row) {
            $table = (string) ($row->table_name ?? '');
            $column = (string) ($row->column_name ?? '');
            if ($table === '' || $column === '' || $table === 'support_service_groups') {
                continue;
            }
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }
            $references[] = ['table' => $table, 'column' => $column];
        }

        if ($references !== []) {
            return $references;
        }

        return $this->fallbackSupportServiceGroupReferenceColumns();
    }

    /**
     * @return array<int, array{table:string,column:string}>
     */
    private function fallbackSupportServiceGroupReferenceColumns(): array
    {
        $fallback = [
            ['table' => 'support_requests', 'column' => 'service_group_id'],
            ['table' => 'programming_requests', 'column' => 'service_group_id'],
        ];

        return array_values(array_filter($fallback, function (array $reference): bool {
            return Schema::hasTable($reference['table']) && Schema::hasColumn($reference['table'], $reference['column']);
        }));
    }

    /**
     * @param array<int, string> $columns
     */
    private function addIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! $this->canCreateIndex($table, $columns) || $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->index($columns, $indexName);
        });
    }

    /**
     * @param array<int, string> $columns
     */
    private function addUniqueIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! $this->canCreateIndex($table, $columns) || $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->unique($columns, $indexName);
        });
    }

    private function canCreateIndex(string $table, array $columns): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return false;
            }
        }

        return true;
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($indexName): void {
            $blueprint->dropIndex($indexName);
        });
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

    private function normalizeGroupKey(string $groupName): string
    {
        $trimmed = trim($groupName);

        if ($trimmed === '') {
            return '';
        }

        return function_exists('mb_strtolower')
            ? mb_strtolower($trimmed, 'UTF-8')
            : strtolower($trimmed);
    }
};
