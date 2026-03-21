<?php

namespace App\Console\Commands;

use App\Models\CustomerRequestCase;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackfillCustomerRequestCaseMetrics extends Command
{
    protected $signature = 'customer-request-cases:backfill-metrics {--chunk=100 : Number of cases to process per batch}';

    protected $description = 'Backfill denormalized hours, estimate, and performer fields for customer request cases.';

    /**
     * @var array<string, string>
     */
    private array $performerStatusTables = [
        'customer_request_in_progress' => 'performer_user_id',
        'customer_request_analysis' => 'performer_user_id',
    ];

    public function handle(): int
    {
        if (! $this->hasRequiredSchema()) {
            $this->error('Thiếu bảng hoặc cột cần thiết để backfill metrics cho customer request cases.');

            return self::FAILURE;
        }

        $chunkSize = max(1, (int) $this->option('chunk'));
        $summary = [
            'cases' => 0,
            'updated_cases' => 0,
            'total_hours_updates' => 0,
            'estimate_updates' => 0,
            'performer_updates' => 0,
        ];

        CustomerRequestCase::query()
            ->select([
                'id',
                'current_status_instance_id',
                'performer_user_id',
                'estimated_hours',
                'estimated_by_user_id',
                'estimated_at',
                'total_hours_spent',
            ])
            ->orderBy('id')
            ->chunkById($chunkSize, function ($cases) use (&$summary): void {
                foreach ($cases as $case) {
                    $summary['cases']++;

                    $updates = [];
                    $totalHours = $this->resolveTotalHoursSpent((int) $case->id);
                    $currentTotalHours = $this->normalizeDecimal($case->total_hours_spent);

                    if ($currentTotalHours !== $this->normalizeDecimal($totalHours)) {
                        $updates['total_hours_spent'] = $totalHours;
                        $summary['total_hours_updates']++;
                    }

                    $estimateSnapshot = $this->resolveLatestEstimateSnapshot((int) $case->id);
                    if ($estimateSnapshot !== null) {
                        $currentEstimatedHours = $this->normalizeNullableDecimal($case->estimated_hours);
                        $nextEstimatedHours = $this->normalizeNullableDecimal($estimateSnapshot['estimated_hours']);
                        $currentEstimatedBy = $case->estimated_by_user_id === null ? null : (int) $case->estimated_by_user_id;
                        $currentEstimatedAt = $this->normalizeNullableDateTime($case->estimated_at);
                        $nextEstimatedAt = $this->normalizeNullableDateTime($estimateSnapshot['estimated_at']);
                        $nextEstimatedBy = $estimateSnapshot['estimated_by_user_id'];

                        if ($currentEstimatedHours !== $nextEstimatedHours
                            || $currentEstimatedBy !== $nextEstimatedBy
                            || $currentEstimatedAt !== $nextEstimatedAt
                        ) {
                            $updates['estimated_hours'] = $estimateSnapshot['estimated_hours'];
                            $updates['estimated_by_user_id'] = $estimateSnapshot['estimated_by_user_id'];
                            $updates['estimated_at'] = $estimateSnapshot['estimated_at'];
                            $summary['estimate_updates']++;
                        }
                    }

                    $performerUserId = $this->resolvePerformerUserId((int) $case->id, $case->current_status_instance_id);
                    $currentPerformer = $case->performer_user_id === null ? null : (int) $case->performer_user_id;

                    if ($performerUserId !== null && $currentPerformer !== $performerUserId) {
                        $updates['performer_user_id'] = $performerUserId;
                        $summary['performer_updates']++;
                    }

                    if ($updates === []) {
                        continue;
                    }

                    DB::table('customer_request_cases')
                        ->where('id', $case->id)
                        ->update($updates);

                    $summary['updated_cases']++;
                }
            });

        $this->info(sprintf(
            'Backfilled %d cases (%d updated). total_hours=%d, estimates=%d, performer=%d',
            $summary['cases'],
            $summary['updated_cases'],
            $summary['total_hours_updates'],
            $summary['estimate_updates'],
            $summary['performer_updates']
        ));

        return self::SUCCESS;
    }

    private function hasRequiredSchema(): bool
    {
        if (! Schema::hasTable('customer_request_cases') || ! Schema::hasTable('customer_request_worklogs')) {
            return false;
        }

        foreach ([
            'performer_user_id',
            'estimated_hours',
            'estimated_by_user_id',
            'estimated_at',
            'total_hours_spent',
        ] as $column) {
            if (! Schema::hasColumn('customer_request_cases', $column)) {
                return false;
            }
        }

        return Schema::hasColumn('customer_request_worklogs', 'hours_spent');
    }

    private function resolveTotalHoursSpent(int $caseId): float
    {
        return (float) DB::table('customer_request_worklogs')
            ->where('request_case_id', $caseId)
            ->sum('hours_spent');
    }

    /**
     * @return array{estimated_hours: float, estimated_by_user_id: ?int, estimated_at: ?string}|null
     */
    private function resolveLatestEstimateSnapshot(int $caseId): ?array
    {
        if (! Schema::hasTable('customer_request_estimates')) {
            return null;
        }

        $row = DB::table('customer_request_estimates')
            ->where('request_case_id', $caseId)
            ->whereNotNull('estimated_hours')
            ->orderByRaw('CASE WHEN estimated_at IS NULL THEN 1 ELSE 0 END ASC')
            ->orderByDesc('estimated_at')
            ->orderByDesc('id')
            ->first([
                'estimated_hours',
                'estimated_by_user_id',
                'estimated_at',
            ]);

        if ($row === null) {
            return null;
        }

        return [
            'estimated_hours' => (float) $row->estimated_hours,
            'estimated_by_user_id' => $row->estimated_by_user_id === null ? null : (int) $row->estimated_by_user_id,
            'estimated_at' => $row->estimated_at === null ? null : (string) $row->estimated_at,
        ];
    }

    private function resolvePerformerUserId(int $caseId, $currentStatusInstanceId): ?int
    {
        $fromStatusInstance = $this->resolvePerformerFromCurrentStatusInstance($currentStatusInstanceId);
        if ($fromStatusInstance !== null) {
            return $fromStatusInstance;
        }

        return $this->resolveLatestWorklogPerformer($caseId);
    }

    private function resolvePerformerFromCurrentStatusInstance($currentStatusInstanceId): ?int
    {
        if ($currentStatusInstanceId === null || ! Schema::hasTable('customer_request_status_instances')) {
            return null;
        }

        $instance = DB::table('customer_request_status_instances')
            ->where('id', $currentStatusInstanceId)
            ->first([
                'status_table',
                'status_row_id',
            ]);

        if ($instance === null) {
            return null;
        }

        $statusTable = trim((string) ($instance->status_table ?? ''));
        $statusRowId = (int) ($instance->status_row_id ?? 0);
        $performerColumn = $this->performerStatusTables[$statusTable] ?? null;

        if ($performerColumn === null || $statusRowId <= 0 || ! Schema::hasTable($statusTable) || ! Schema::hasColumn($statusTable, $performerColumn)) {
            return null;
        }

        $userId = DB::table($statusTable)
            ->where('id', $statusRowId)
            ->value($performerColumn);

        return $userId === null ? null : (int) $userId;
    }

    private function resolveLatestWorklogPerformer(int $caseId): ?int
    {
        $query = DB::table('customer_request_worklogs')
            ->where('request_case_id', $caseId)
            ->whereNotNull('performed_by_user_id');

        if (Schema::hasColumn('customer_request_worklogs', 'work_ended_at')) {
            $query->orderByDesc('work_ended_at');
        }

        if (Schema::hasColumn('customer_request_worklogs', 'work_started_at')) {
            $query->orderByDesc('work_started_at');
        }

        $userId = $query
            ->orderByDesc('id')
            ->value('performed_by_user_id');

        return $userId === null ? null : (int) $userId;
    }

    private function normalizeDecimal($value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    private function normalizeNullableDecimal($value): ?string
    {
        if ($value === null) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    private function normalizeNullableDateTime($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }
}
