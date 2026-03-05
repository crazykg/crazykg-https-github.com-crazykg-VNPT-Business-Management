<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('request_ref_tasks') || ! Schema::hasTable('customer_requests')) {
            return;
        }

        $requiredColumns = [
            'id',
            'request_code',
            'source_type',
            'source_id',
            'task_source',
            'task_code',
            'task_link',
            'task_status',
            'task_note',
            'sort_order',
            'deleted_at',
        ];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('request_ref_tasks', $column)) {
                return;
            }
        }

        if (! Schema::hasColumn('customer_requests', 'request_code')) {
            return;
        }

        $hasUpdatedAt = Schema::hasColumn('request_ref_tasks', 'updated_at');

        $rows = DB::table('request_ref_tasks as rft')
            ->join('customer_requests as cr', 'cr.request_code', '=', 'rft.request_code')
            ->whereNull('rft.deleted_at')
            ->select([
                'rft.id',
                'rft.request_code',
                'rft.source_type',
                'rft.source_id',
                'rft.task_source',
                'rft.task_code',
                'rft.task_link',
                'rft.task_status',
                'rft.task_note',
                'rft.sort_order',
            ])
            ->orderBy('rft.id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        if ($rows === []) {
            return;
        }

        $seenSignatures = [];
        $duplicateIds = [];

        foreach ($rows as $row) {
            $rowId = (int) ($row['id'] ?? 0);
            if ($rowId <= 0) {
                continue;
            }

            $signature = $this->buildSignature($row);
            if ($signature === '') {
                continue;
            }

            if (isset($seenSignatures[$signature])) {
                $duplicateIds[] = $rowId;
                continue;
            }

            $seenSignatures[$signature] = $rowId;
        }

        if ($duplicateIds === []) {
            return;
        }

        $now = now();
        foreach (array_chunk($duplicateIds, 500) as $chunkIds) {
            $payload = ['deleted_at' => $now];
            if ($hasUpdatedAt) {
                $payload['updated_at'] = $now;
            }

            DB::table('request_ref_tasks')
                ->whereIn('id', $chunkIds)
                ->whereNull('deleted_at')
                ->update($payload);
        }
    }

    public function down(): void
    {
        // no-op: cleanup migration only soft-deletes duplicate task references.
    }

    /**
     * @param array<string, mixed> $row
     */
    private function buildSignature(array $row): string
    {
        $requestCode = trim((string) ($row['request_code'] ?? ''));
        $sourceType = strtoupper(trim((string) ($row['source_type'] ?? '')));
        $sourceId = (int) ($row['source_id'] ?? 0);
        $taskSource = $this->normalizeLooseToken((string) ($row['task_source'] ?? ''));
        $taskCode = mb_strtolower(trim((string) ($row['task_code'] ?? '')));
        $taskLink = trim((string) ($row['task_link'] ?? ''));
        $taskStatus = $this->normalizeLooseToken((string) ($row['task_status'] ?? ''));
        $taskNote = trim((string) ($row['task_note'] ?? ''));
        $sortOrder = (int) ($row['sort_order'] ?? 0);

        if ($requestCode === '' || $sourceType === '' || $sourceId <= 0) {
            return '';
        }

        return implode('|', [
            $requestCode,
            $sourceType,
            (string) $sourceId,
            $taskSource,
            $taskCode,
            $taskLink,
            $taskStatus,
            $taskNote,
            (string) $sortOrder,
        ]);
    }

    private function normalizeLooseToken(string $value): string
    {
        $normalized = trim(mb_strtolower($value));
        $normalized = str_replace(['đ', 'Đ'], 'd', $normalized);
        $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized) ?: $normalized;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($normalized)) ?: '';
    }
};
