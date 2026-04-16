<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectRevenueScheduleDomainService
{
    private const SYNC_AMOUNT_TOLERANCE = 0.5;
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    /**
     * List revenue schedules for a given project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['data' => []]);
        }

        $hasCreatedBy = $this->support->hasColumn('project_revenue_schedules', 'created_by');
        $hasUpdatedBy = $this->support->hasColumn('project_revenue_schedules', 'updated_by');
        $hasCreatedAt = $this->support->hasColumn('project_revenue_schedules', 'created_at');
        $hasUpdatedAt = $this->support->hasColumn('project_revenue_schedules', 'updated_at');
        $hasInternalUsersTable = $hasCreatedBy && $this->support->hasTable('internal_users');
        $hasInternalUserFullName = $hasInternalUsersTable && $this->support->hasColumn('internal_users', 'full_name');
        $hasInternalUserUsername = $hasInternalUsersTable && $this->support->hasColumn('internal_users', 'username');

        $query = DB::table('project_revenue_schedules as prs')
            ->where('prs.project_id', $projectId)
            ->orderBy('prs.cycle_number');

        if ($hasInternalUsersTable) {
            $query->leftJoin('internal_users as creator', 'prs.created_by', '=', 'creator.id');
        }

        $selects = [
            'prs.id',
            'prs.project_id',
            'prs.cycle_number',
            'prs.expected_date',
            'prs.expected_amount',
            'prs.notes',
        ];

        if ($hasCreatedBy) {
            $selects[] = 'prs.created_by';
        }
        if ($hasUpdatedBy) {
            $selects[] = 'prs.updated_by';
        }
        if ($hasCreatedAt) {
            $selects[] = 'prs.created_at';
        }
        if ($hasUpdatedAt) {
            $selects[] = 'prs.updated_at';
        }

        if ($hasInternalUsersTable && $hasInternalUserFullName && $hasInternalUserUsername) {
            $selects[] = DB::raw("COALESCE(NULLIF(TRIM(creator.full_name), ''), creator.username) as created_by_name");
        } elseif ($hasInternalUsersTable && $hasInternalUserFullName) {
            $selects[] = 'creator.full_name as created_by_name';
        } elseif ($hasInternalUsersTable && $hasInternalUserUsername) {
            $selects[] = 'creator.username as created_by_name';
        } else {
            $selects[] = DB::raw('NULL as created_by_name');
        }

        $rows = $query
            ->select($selects)
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'project_id' => (int) $row->project_id,
                'cycle_number' => (int) $row->cycle_number,
                'expected_date' => $row->expected_date,
                'expected_amount' => round((float) $row->expected_amount, 2),
                'notes' => $row->notes,
                'created_by' => $hasCreatedBy ? $this->support->parseNullableInt($row->created_by ?? null) : null,
                'updated_by' => $hasUpdatedBy ? $this->support->parseNullableInt($row->updated_by ?? null) : null,
                'created_by_name' => $this->support->normalizeNullableString($row->created_by_name ?? null),
                'created_at' => $hasCreatedAt ? $row->created_at : null,
                'updated_at' => $hasUpdatedAt ? $row->updated_at : null,
            ])
            ->all();

        return response()->json(['data' => $rows]);
    }

    /**
     * Sync revenue schedules for a project (upsert + delete removed rows).
     * Payload: { schedules: [ { expected_date, expected_amount, notes? }, ... ] }
     */
    public function sync(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['message' => 'Bảng project_revenue_schedules chưa tồn tại.'], 422);
        }

        if (! $this->support->hasTable('projects') || ! DB::table('projects')->where('id', $projectId)->exists()) {
            return response()->json(['message' => 'Dự án không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'schedules' => ['present', 'array', 'max:120'],
            'schedules.*' => ['required', 'array'],
            'schedules.*.id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'schedules.*.expected_date' => ['required', 'date'],
            'schedules.*.expected_amount' => ['required', 'numeric', 'min:0'],
            'schedules.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $schedules = $validated['schedules'];
        $project = DB::table('projects')->where('id', $projectId)->first();
        if (! $project) {
            return response()->json(['message' => 'Dự án không tồn tại.'], 404);
        }

        $existingSchedules = DB::table('project_revenue_schedules')
            ->where('project_id', $projectId)
            ->orderBy('cycle_number')
            ->get();
        $existingScheduleMap = $existingSchedules
            ->keyBy(fn (object $row): string => (string) $row->id)
            ->all();

        $this->validateScheduleSyncPayload($project, $projectId, $schedules, $existingSchedules->sum('expected_amount'), $existingScheduleMap);

        $now = now();
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);

        DB::transaction(function () use ($projectId, $schedules, $now, $actorId, $existingScheduleMap): void {
            $incomingIds = collect($schedules)
                ->map(fn (array $schedule): ?int => $this->support->parseNullableInt($schedule['id'] ?? null))
                ->filter(fn (?int $id): bool => $id !== null)
                ->values()
                ->all();

            $deleteQuery = DB::table('project_revenue_schedules')->where('project_id', $projectId);
            if ($incomingIds === []) {
                $deleteQuery->delete();
            } else {
                $deleteQuery->whereNotIn('id', $incomingIds)->delete();
            }

            foreach ($schedules as $index => $schedule) {
                $payload = [
                    'cycle_number' => $index + 1,
                    'expected_date' => $schedule['expected_date'],
                    'expected_amount' => round((float) $schedule['expected_amount'], 2),
                    'notes' => $schedule['notes'] ?? null,
                ];

                if ($this->support->hasColumn('project_revenue_schedules', 'updated_by')) {
                    $payload['updated_by'] = $actorId;
                }
                if ($this->support->hasColumn('project_revenue_schedules', 'updated_at')) {
                    $payload['updated_at'] = $now;
                }

                $scheduleId = $this->support->parseNullableInt($schedule['id'] ?? null);
                if ($scheduleId !== null && isset($existingScheduleMap[(string) $scheduleId])) {
                    DB::table('project_revenue_schedules')
                        ->where('id', $scheduleId)
                        ->where('project_id', $projectId)
                        ->update($payload);

                    continue;
                }

                $insertPayload = [
                    'project_id' => $projectId,
                    'cycle_number' => $payload['cycle_number'],
                    'expected_date' => $payload['expected_date'],
                    'expected_amount' => $payload['expected_amount'],
                    'notes' => $payload['notes'],
                ];

                if ($this->support->hasColumn('project_revenue_schedules', 'created_by')) {
                    $insertPayload['created_by'] = $actorId;
                }
                if ($this->support->hasColumn('project_revenue_schedules', 'updated_by')) {
                    $insertPayload['updated_by'] = $actorId;
                }
                if ($this->support->hasColumn('project_revenue_schedules', 'created_at')) {
                    $insertPayload['created_at'] = $now;
                }
                if ($this->support->hasColumn('project_revenue_schedules', 'updated_at')) {
                    $insertPayload['updated_at'] = $now;
                }

                DB::table('project_revenue_schedules')->insert($insertPayload);
            }
        });

        return $this->index($request, $projectId);
    }

    /**
     * Auto-generate revenue schedules based on project items, payment_cycle,
     * start_date, and expected_end_date.
     */
    public function generate(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['message' => 'Bảng project_revenue_schedules chưa tồn tại.'], 422);
        }

        $project = DB::table('projects')->where('id', $projectId)->first();
        if (! $project) {
            return response()->json(['message' => 'Dự án không tồn tại.'], 404);
        }

        $paymentCycle = $project->payment_cycle ?? null;
        if (! $paymentCycle || ! in_array($paymentCycle, self::PAYMENT_CYCLES, true)) {
            return response()->json([
                'message' => 'Vui lòng cập nhật Chu kỳ thanh toán trước khi tạo phân kỳ tự động.',
            ], 422);
        }

        $startDate = $project->start_date ?? null;
        $endDate = $project->expected_end_date ?? null;
        if (! $startDate || ! $endDate) {
            return response()->json([
                'message' => 'Vui lòng cập nhật ngày bắt đầu và ngày kết thúc trước khi tạo phân kỳ tự động.',
            ], 422);
        }

        $estimatedValue = (float) ($project->estimated_value ?? 0);
        if ($estimatedValue <= 0) {
            // Calculate from project items
            $estimatedValue = (float) DB::table('project_items')
                ->where('project_id', $projectId)
                ->whereNull('deleted_at')
                ->selectRaw('COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 0) as total')
                ->value('total');

            if ($estimatedValue <= 0) {
                return response()->json([
                    'message' => 'Giá trị dự kiến = 0. Vui lòng thêm hạng mục dự án trước.',
                ], 422);
            }
        }

        $intervalMonths = match ($paymentCycle) {
            'ONCE' => 0,
            'MONTHLY' => 1,
            'QUARTERLY' => 3,
            'HALF_YEARLY' => 6,
            'YEARLY' => 12,
            default => 1,
        };

        $startCarbon = \Carbon\Carbon::parse($startDate);
        $endCarbon = \Carbon\Carbon::parse($endDate);

        if ($paymentCycle === 'ONCE') {
            $schedules = [
                ['expected_date' => $endCarbon->format('Y-m-d'), 'expected_amount' => $estimatedValue],
            ];
        } else {
            $totalMonths = max(1, $startCarbon->diffInMonths($endCarbon));
            $cycleCount = max(1, (int) ceil($totalMonths / $intervalMonths));
            $baseAmount = round($estimatedValue / $cycleCount, 2);

            $schedules = [];
            $cursor = $startCarbon->copy();
            for ($i = 0; $i < $cycleCount; $i++) {
                $scheduleDate = $cursor->copy()->addMonths($intervalMonths);
                if ($scheduleDate->greaterThan($endCarbon)) {
                    $scheduleDate = $endCarbon->copy();
                }

                $amount = ($i === $cycleCount - 1)
                    ? round($estimatedValue - $baseAmount * ($cycleCount - 1), 2)
                    : $baseAmount;

                $schedules[] = [
                    'expected_date' => $scheduleDate->format('Y-m-d'),
                    'expected_amount' => max(0, $amount),
                ];

                $cursor = $scheduleDate;
            }
        }

        // Delegate to sync
        $request->merge(['schedules' => $schedules]);

        return $this->sync($request, $projectId);
    }

    /**
     * @param array<int, array<string, mixed>> $schedules
     * @param array<string, object> $existingScheduleMap
     */
    private function validateScheduleSyncPayload(
        object $project,
        int $projectId,
        array $schedules,
        float $currentScheduleTotal,
        array $existingScheduleMap
    ): void {
        if ($schedules === []) {
            return;
        }

        $projectStartDate = $this->support->normalizeNullableString(
            $project->start_date ?? null
        );
        $projectEndDate = $this->support->normalizeNullableString(
            $project->expected_end_date ?? null
        );

        $errors = [];

        if ($projectStartDate === null || $projectEndDate === null) {
            $errors['schedules'][] = 'Dự án phải có ngày bắt đầu và ngày kết thúc để chỉnh phân kỳ doanh thu.';
        }

        $startDate = $projectStartDate !== null ? Carbon::parse($projectStartDate)->startOfDay() : null;
        $endDate = $projectEndDate !== null ? Carbon::parse($projectEndDate)->startOfDay() : null;
        if ($startDate !== null && $endDate !== null && $startDate->greaterThan($endDate)) {
            $errors['schedules'][] = 'Khoảng thời gian dự án không hợp lệ.';
        }

        $expectedTotal = $this->resolveProjectRevenueTotal($project, $projectId);
        if ($expectedTotal <= 0 && $currentScheduleTotal > 0) {
            $expectedTotal = round($currentScheduleTotal, 2);
        }

        $payloadTotal = 0.0;
        $previousDate = null;
        foreach ($schedules as $index => $schedule) {
            $scheduleId = $this->support->parseNullableInt($schedule['id'] ?? null);
            if ($scheduleId !== null && ! isset($existingScheduleMap[(string) $scheduleId])) {
                $errors["schedules.{$index}.id"][] = 'Kỳ doanh thu không thuộc dự án hiện tại.';
            }

            $payloadTotal += round((float) ($schedule['expected_amount'] ?? 0), 2);

            $currentDate = Carbon::parse((string) $schedule['expected_date'])->startOfDay();
            if ($startDate !== null && $currentDate->lessThan($startDate)) {
                $errors["schedules.{$index}.expected_date"][] = sprintf(
                    'Ngày dự kiến kỳ %d phải từ %s trở đi.',
                    $index + 1,
                    $startDate->format('d/m/Y')
                );
            }

            if ($endDate !== null && $currentDate->greaterThan($endDate)) {
                $errors["schedules.{$index}.expected_date"][] = sprintf(
                    'Ngày dự kiến kỳ %d không được vượt quá %s.',
                    $index + 1,
                    $endDate->format('d/m/Y')
                );
            }

            if ($previousDate !== null && $currentDate->lessThanOrEqualTo($previousDate)) {
                $errors["schedules.{$index}.expected_date"][] = sprintf(
                    'Ngày dự kiến kỳ %d phải sau kỳ %d.',
                    $index + 1,
                    $index
                );
            }

            $previousDate = $currentDate;
        }

        if (abs(round($payloadTotal, 2) - round($expectedTotal, 2)) > self::SYNC_AMOUNT_TOLERANCE) {
            $errors['schedules'][] = sprintf(
                'Tổng phân kỳ phải giữ nguyên %s.',
                number_format($expectedTotal, 0, ',', '.').' đ'
            );
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function resolveProjectRevenueTotal(object $project, int $projectId): float
    {
        if ($this->support->hasColumn('projects', 'estimated_value')) {
            $estimatedValue = round((float) ($project->estimated_value ?? 0), 2);
            if ($estimatedValue > 0) {
                return $estimatedValue;
            }
        }

        if (
            ! $this->support->hasTable('project_items')
            || ! $this->support->hasColumn('project_items', 'project_id')
            || ! $this->support->hasColumn('project_items', 'quantity')
            || ! $this->support->hasColumn('project_items', 'unit_price')
        ) {
            return 0.0;
        }

        $query = DB::table('project_items')->where('project_id', $projectId);
        if ($this->support->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return round((float) $query
            ->selectRaw('COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 0) as total')
            ->value('total'), 2);
    }

    /**
     * Aggregate project revenue schedules by period for revenue target suggestion.
     * Used by RevenueTargetService::suggest().
     *
     * @return array<string, float> period_key => total_expected_amount
     */
    public function aggregateByPeriod(int $year, string $periodType, ?int $deptId = null): array
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return [];
        }

        $query = DB::table('project_revenue_schedules as prs')
            ->join('projects as p', 'prs.project_id', '=', 'p.id')
            ->where('p.status', 'CO_HOI')
            ->whereNull('p.deleted_at')
            ->whereYear('prs.expected_date', $year);

        if ($deptId !== null && $deptId > 0 && $this->support->hasColumn('projects', 'dept_id')) {
            $query->where('p.dept_id', $deptId);
        }

        $monthKeyExpr = DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', prs.expected_date)"
            : "DATE_FORMAT(prs.expected_date, '%Y-%m')";

        $rows = $query
            ->selectRaw("{$monthKeyExpr} as month_key, COALESCE(SUM(prs.expected_amount), 0) as total")
            ->groupBy('month_key')
            ->orderBy('month_key')
            ->get();

        $monthlyData = [];
        foreach ($rows as $row) {
            $monthlyData[$row->month_key] = round((float) $row->total, 2);
        }

        if ($periodType === 'MONTHLY') {
            return $monthlyData;
        }

        // Aggregate into QUARTERLY or YEARLY
        $result = [];
        foreach ($monthlyData as $monthKey => $amount) {
            $month = (int) substr($monthKey, 5, 2);
            $periodKey = match ($periodType) {
                'QUARTERLY' => $year.'-Q'.ceil($month / 3),
                'YEARLY' => (string) $year,
                default => $monthKey,
            };
            $result[$periodKey] = round(($result[$periodKey] ?? 0) + $amount, 2);
        }

        return $result;
    }
}
