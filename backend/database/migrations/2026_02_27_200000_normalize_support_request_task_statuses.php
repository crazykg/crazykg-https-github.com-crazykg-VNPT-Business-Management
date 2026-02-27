<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_request_tasks') || ! Schema::hasColumn('support_request_tasks', 'status')) {
            return;
        }

        DB::table('support_request_tasks')
            ->select(['id', 'status'])
            ->orderBy('id')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    $rawStatus = is_string($row->status) ? $row->status : null;
                    $normalizedStatus = $this->normalizeTaskStatus($rawStatus);

                    if ($rawStatus === $normalizedStatus) {
                        continue;
                    }

                    DB::table('support_request_tasks')
                        ->where('id', $row->id)
                        ->update(['status' => $normalizedStatus]);
                }
            });
    }

    public function down(): void
    {
        // No-op: data normalization is intentionally not reversible.
    }

    private function normalizeTaskStatus(?string $status): string
    {
        $normalized = strtoupper(trim((string) $status));
        if ($normalized === '') {
            return 'TODO';
        }

        if (in_array($normalized, [
            'TODO',
            'VUA TAO',
            'VUA_TAO',
            'VỪA TẠO',
            'VỪA_TẠO',
        ], true)) {
            return 'TODO';
        }

        if (in_array($normalized, [
            'IN_PROGRESS',
            'DANG THUC HIEN',
            'DANG_THUC_HIEN',
            'ĐANG THỰC HIỆN',
            'ĐANG_THỰC_HIỆN',
        ], true)) {
            return 'IN_PROGRESS';
        }

        if (in_array($normalized, [
            'DONE',
            'DA HOAN THANH',
            'DA_HOAN_THANH',
            'ĐÃ HOÀN THÀNH',
            'ĐÃ_HOÀN_THÀNH',
        ], true)) {
            return 'DONE';
        }

        if (in_array($normalized, [
            'CANCELLED',
            'HUY',
            'HUỶ',
        ], true)) {
            return 'CANCELLED';
        }

        if (in_array($normalized, [
            'BLOCKED',
            'CHUYEN SANG TASK KHAC',
            'CHUYEN_SANG_TASK_KHAC',
            'CHUYỂN SANG TASK KHÁC',
            'CHUYỂN_SANG_TASK_KHÁC',
        ], true)) {
            return 'BLOCKED';
        }

        return 'TODO';
    }
};
