<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfExists('support_request_tasks', ['task_code'], 'idx_support_tasks_task_code');
        $this->addIndexIfExists('support_service_groups', ['group_name'], 'idx_support_groups_name');
        $this->backfillSupportRequestLegacyTaskColumns();
    }

    public function down(): void
    {
        $this->dropIndexIfExists('support_request_tasks', 'idx_support_tasks_task_code');
        $this->dropIndexIfExists('support_service_groups', 'idx_support_groups_name');
    }

    private function backfillSupportRequestLegacyTaskColumns(): void
    {
        if (
            ! Schema::hasTable('support_requests')
            || ! Schema::hasTable('support_request_tasks')
            || ! Schema::hasColumn('support_request_tasks', 'request_id')
        ) {
            return;
        }

        $supportsTicketCode = Schema::hasColumn('support_requests', 'ticket_code')
            && Schema::hasColumn('support_request_tasks', 'task_code');
        $supportsTaskLink = Schema::hasColumn('support_requests', 'task_link')
            && Schema::hasColumn('support_request_tasks', 'task_link');

        if (! $supportsTicketCode && ! $supportsTaskLink) {
            return;
        }

        $taskSelects = ['request_id'];
        if ($supportsTicketCode) {
            $taskSelects[] = 'task_code';
        }
        if ($supportsTaskLink) {
            $taskSelects[] = 'task_link';
        }
        if (Schema::hasColumn('support_request_tasks', 'sort_order')) {
            $taskSelects[] = 'sort_order';
        }
        if (Schema::hasColumn('support_request_tasks', 'id')) {
            $taskSelects[] = 'id';
        }

        $taskQuery = DB::table('support_request_tasks')->select($taskSelects);
        if (Schema::hasColumn('support_request_tasks', 'request_id')) {
            $taskQuery->orderBy('request_id');
        }
        if (Schema::hasColumn('support_request_tasks', 'sort_order')) {
            $taskQuery->orderBy('sort_order');
        }
        if (Schema::hasColumn('support_request_tasks', 'id')) {
            $taskQuery->orderBy('id');
        }

        $firstTaskByRequestId = [];
        foreach ($taskQuery->get() as $row) {
            $requestId = (int) ($row->request_id ?? 0);
            if ($requestId <= 0 || isset($firstTaskByRequestId[$requestId])) {
                continue;
            }

            $taskCode = $supportsTicketCode ? $this->normalizeNullableString($row->task_code ?? null) : null;
            $taskLink = $supportsTaskLink ? $this->normalizeNullableString($row->task_link ?? null) : null;

            if ($taskCode === null && $taskLink === null) {
                continue;
            }

            $firstTaskByRequestId[$requestId] = [
                'task_code' => $taskCode,
                'task_link' => $taskLink,
            ];
        }

        if ($firstTaskByRequestId === []) {
            return;
        }

        $requestSelects = ['id'];
        if ($supportsTicketCode) {
            $requestSelects[] = 'ticket_code';
        }
        if ($supportsTaskLink) {
            $requestSelects[] = 'task_link';
        }

        $requestRows = DB::table('support_requests')
            ->select($requestSelects)
            ->whereIn('id', array_keys($firstTaskByRequestId))
            ->get();

        foreach ($requestRows as $requestRow) {
            $requestId = (int) ($requestRow->id ?? 0);
            if ($requestId <= 0 || ! isset($firstTaskByRequestId[$requestId])) {
                continue;
            }

            $firstTask = $firstTaskByRequestId[$requestId];
            $updates = [];

            if (
                $supportsTicketCode
                && $this->normalizeNullableString($requestRow->ticket_code ?? null) === null
                && $firstTask['task_code'] !== null
            ) {
                $updates['ticket_code'] = $firstTask['task_code'];
            }

            if (
                $supportsTaskLink
                && $this->normalizeNullableString($requestRow->task_link ?? null) === null
                && $firstTask['task_link'] !== null
            ) {
                $updates['task_link'] = $firstTask['task_link'];
            }

            if ($updates === []) {
                continue;
            }

            if (Schema::hasColumn('support_requests', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            DB::table('support_requests')
                ->where('id', $requestId)
                ->update($updates);
        }
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }

    /**
     * @param array<int, string> $columns
     */
    private function addIndexIfExists(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        if ($this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName): void {
            $blueprint->index($columns, $indexName);
        });
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
};
