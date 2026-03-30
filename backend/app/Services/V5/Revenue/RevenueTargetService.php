<?php

namespace App\Services\V5\Revenue;

use App\Models\RevenueSnapshot;
use App\Models\RevenueTarget;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RevenueTargetService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $auditService
    ) {}

    /**
     * index() — List targets with achievement data.
     *
     * Open periods: actual_amount computed LIVE.
     * Closed periods: from revenue_snapshots, fallback to live.
     */
    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'period_type' => ['sometimes', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'year' => ['sometimes', 'integer', 'min:2020', 'max:2099'],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
        ]);

        $query = RevenueTarget::whereNull('deleted_at');

        if (isset($validated['period_type'])) {
            $query->where('period_type', (string) $validated['period_type']);
        }
        if (isset($validated['year'])) {
            $year = (int) $validated['year'];
            $query->where('period_key', 'LIKE', $year . '%');
        }
        if (isset($validated['dept_id'])) {
            $query->where('dept_id', (int) $validated['dept_id']);
        }

        $targets = $query->orderBy('period_key')->orderBy('dept_id')->get();

        // Batch-load achievement data to avoid N+1 queries
        $today = now()->toDateString();
        $openTargets = $targets->filter(fn (RevenueTarget $t) => $t->period_end >= $today);
        $closedTargets = $targets->filter(fn (RevenueTarget $t) => $t->period_end < $today);

        // Batch compute live actuals for open periods (single query)
        $liveActuals = $this->batchComputeLiveActuals($openTargets);

        // Batch load snapshots for closed periods (single query)
        $snapshots = $this->batchLoadSnapshots($closedTargets);

        // Fallback: closed targets without snapshot need live computation too
        $closedWithoutSnapshot = $closedTargets->filter(
            fn (RevenueTarget $t) => ! isset($snapshots[$this->snapshotKey($t)])
        );
        $fallbackActuals = $this->batchComputeLiveActuals($closedWithoutSnapshot);
        $liveActuals = array_merge($liveActuals, $fallbackActuals);

        $enriched = $targets->map(function (RevenueTarget $target) use ($today, $liveActuals, $snapshots) {
            $row = $target->toArray();
            $targetKey = $this->targetKey($target);
            $snapshotKey = $this->snapshotKey($target);

            if ($target->period_end >= $today) {
                // Open period: use batched live actual
                $actual = $liveActuals[$targetKey] ?? 0.0;
            } else {
                // Closed period: try batched snapshot, fallback to batched live
                $actual = $snapshots[$snapshotKey] ?? $liveActuals[$targetKey] ?? (float) $target->actual_amount;
            }

            $row['actual_amount'] = round($actual, 2);
            $row['achievement_pct'] = $target->target_amount > 0
                ? round($actual / $target->target_amount * 100, 1)
                : 0.0;

            return $row;
        });

        return response()->json(['data' => $enriched->values()]);
    }

    /**
     * store() — Create a revenue target.
     */
    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'period_type' => ['required', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'period_key' => ['required', 'string', 'max:10'],
            'target_amount' => ['required', 'numeric', 'min:0'],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
            'target_type' => ['sometimes', Rule::in(['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'])],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $periodType = (string) $validated['period_type'];
        $periodKey = (string) $validated['period_key'];
        $deptId = (int) ($validated['dept_id'] ?? 0);
        $targetType = (string) ($validated['target_type'] ?? 'TOTAL');

        // Validate period_key format
        $dates = $this->parsePeriodDates($periodType, $periodKey);
        if ($dates === null) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['period_key' => ['Định dạng period_key không hợp lệ cho period_type=' . $periodType]],
            ], 422);
        }

        // App-level unique check (ISSUE-4 R2 fix)
        $existing = RevenueTarget::where('period_type', $periodType)
            ->where('period_key', $periodKey)
            ->where('dept_id', $deptId)
            ->where('target_type', $targetType)
            ->whereNull('deleted_at')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['period_key' => ['Kế hoạch đã tồn tại cho kỳ và phòng ban này.']],
            ], 422);
        }

        // If soft-deleted record exists with same key, forceDelete it
        RevenueTarget::where('period_type', $periodType)
            ->where('period_key', $periodKey)
            ->where('dept_id', $deptId)
            ->where('target_type', $targetType)
            ->whereNotNull('deleted_at')
            ->forceDelete();

        $userId = $this->auditService->resolveAuthenticatedUserId($request);

        $target = RevenueTarget::create([
            'period_type' => $periodType,
            'period_key' => $periodKey,
            'period_start' => $dates['start'],
            'period_end' => $dates['end'],
            'dept_id' => $deptId,
            'target_type' => $targetType,
            'target_amount' => (float) $validated['target_amount'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
        ]);

        $this->auditService->recordAuditEvent(
            $request,
            'INSERT',
            'revenue_targets',
            $target->id,
            [],
            $target->toArray()
        );

        return response()->json(['data' => $target], 201);
    }

    /**
     * update() — Update target amount and metadata.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $target = RevenueTarget::whereNull('deleted_at')->find($id);
        if (! $target) {
            return response()->json(['message' => 'Không tìm thấy kế hoạch doanh thu.'], 404);
        }

        $validated = $request->validate([
            'target_amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $old = $target->toArray();
        $userId = $this->auditService->resolveAuthenticatedUserId($request);

        if (isset($validated['target_amount'])) {
            $target->target_amount = (float) $validated['target_amount'];
        }
        if (array_key_exists('notes', $validated)) {
            $target->notes = $validated['notes'];
        }
        $target->updated_by = $userId;
        $target->save();

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'revenue_targets',
            $target->id,
            $old,
            $target->toArray()
        );

        return response()->json(['data' => $target]);
    }

    /**
     * destroy() — Soft delete a target.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $target = RevenueTarget::whereNull('deleted_at')->find($id);
        if (! $target) {
            return response()->json(['message' => 'Không tìm thấy kế hoạch doanh thu.'], 404);
        }

        $old = $target->toArray();
        $target->delete();

        $this->auditService->recordAuditEvent(
            $request,
            'DELETE',
            'revenue_targets',
            $target->id,
            $old,
            []
        );

        return response()->json(null, 204);
    }

    /**
     * bulkStore() — Create or update targets in bulk.
     */
    public function bulkStore(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'period_type' => ['required', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'target_type' => ['required', Rule::in(['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'])],
            'dept_ids' => ['required', 'array'],
            'dept_ids.*' => ['integer', 'min:0'],
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.period_key' => ['required', 'string', 'max:10'],
            'targets.*.amount' => ['required', 'numeric', 'min:0'],
        ]);

        $periodType = (string) $validated['period_type'];
        $targetType = (string) $validated['target_type'];
        $deptIds = array_map('intval', $validated['dept_ids']);
        $userId = $this->auditService->resolveAuthenticatedUserId($request);
        $created = 0;
        $updated = 0;

        DB::beginTransaction();
        try {
            foreach ($deptIds as $deptId) {
                foreach ($validated['targets'] as $item) {
                    $periodKey = (string) $item['period_key'];
                    $amount = (float) $item['amount'];

                    $dates = $this->parsePeriodDates($periodType, $periodKey);
                    if ($dates === null) {
                        continue;
                    }

                    $existing = RevenueTarget::where('period_type', $periodType)
                        ->where('period_key', $periodKey)
                        ->where('dept_id', $deptId)
                        ->where('target_type', $targetType)
                        ->whereNull('deleted_at')
                        ->first();

                    if ($existing) {
                        $existing->target_amount = $amount;
                        $existing->updated_by = $userId;
                        $existing->save();
                        $updated++;
                    } else {
                        // forceDelete soft-deleted record if exists
                        RevenueTarget::where('period_type', $periodType)
                            ->where('period_key', $periodKey)
                            ->where('dept_id', $deptId)
                            ->where('target_type', $targetType)
                            ->whereNotNull('deleted_at')
                            ->forceDelete();

                        RevenueTarget::create([
                            'period_type' => $periodType,
                            'period_key' => $periodKey,
                            'period_start' => $dates['start'],
                            'period_end' => $dates['end'],
                            'dept_id' => $deptId,
                            'target_type' => $targetType,
                            'target_amount' => $amount,
                            'created_by' => $userId,
                        ]);
                        $created++;
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'data' => [
                'created' => $created,
                'updated' => $updated,
            ],
        ], 201);
    }

    // ───────────────────────────────────────────────────
    // Batch helpers (avoid N+1)
    // ───────────────────────────────────────────────────

    /**
     * Compute live actuals for multiple targets in a single query via UNION ALL.
     *
     * @return array<string, float>  keyed by "{period_key}:{dept_id}"
     */
    private function batchComputeLiveActuals(\Illuminate\Support\Collection $targets): array
    {
        if ($targets->isEmpty() || ! $this->support->hasTable('payment_schedules')) {
            return [];
        }

        // Build a single query that groups by (period_start, period_end, dept_id)
        // Each target maps to a period range; we UNION-select all period ranges at once.
        // Since targets may share period ranges, we deduplicate.
        $ranges = [];
        foreach ($targets as $target) {
            $key = $this->targetKey($target);
            $ranges[$key] = [
                'start' => $target->period_start,
                'end' => $target->period_end,
                'dept_id' => (int) $target->dept_id,
                'period_key' => $target->period_key,
            ];
        }

        // Single query: SUM grouped by period range
        // We use a CASE approach: for each range, sum if expected_date falls within
        $selects = [];
        $bindings = [];
        $idx = 0;
        foreach ($ranges as $key => $r) {
            $alias = "r{$idx}";
            $deptClause = $r['dept_id'] > 0
                ? "AND c.dept_id = ?"
                : "";
            $selects[] = "SELECT ? as target_key, COALESCE(SUM(ps.actual_paid_amount), 0) as total
                FROM payment_schedules ps
                JOIN contracts c ON ps.contract_id = c.id
                WHERE c.deleted_at IS NULL AND ps.deleted_at IS NULL
                AND ps.expected_date >= ? AND ps.expected_date <= ?
                {$deptClause}";

            $bindings[] = $key;
            $bindings[] = $r['start'];
            $bindings[] = $r['end'];
            if ($r['dept_id'] > 0) {
                $bindings[] = $r['dept_id'];
            }
            $idx++;
        }

        if (empty($selects)) {
            return [];
        }

        $sql = implode(' UNION ALL ', $selects);
        $rows = DB::select($sql, $bindings);

        $result = [];
        foreach ($rows as $row) {
            $result[$row->target_key] = (float) $row->total;
        }

        return $result;
    }

    /**
     * Batch-load snapshots for multiple targets in a single query.
     *
     * @return array<string, float>  keyed by "{period_key}:{dimension_type}:{dimension_id}"
     */
    private function batchLoadSnapshots(\Illuminate\Support\Collection $targets): array
    {
        if ($targets->isEmpty() || ! $this->support->hasTable('revenue_snapshots')) {
            return [];
        }

        // Build WHERE conditions for all needed snapshots
        $conditions = [];
        foreach ($targets as $target) {
            $dimType = $target->dept_id > 0 ? 'DEPARTMENT' : 'COMPANY';
            $dimId = (int) $target->dept_id;
            $conditions[] = [
                'period_key' => $target->period_key,
                'dimension_type' => $dimType,
                'dimension_id' => $dimId,
            ];
        }

        // Deduplicate
        $unique = collect($conditions)->unique(fn ($c) => "{$c['period_key']}:{$c['dimension_type']}:{$c['dimension_id']}");

        $query = RevenueSnapshot::query();
        $query->where(function ($q) use ($unique) {
            foreach ($unique as $cond) {
                $q->orWhere(function ($sub) use ($cond) {
                    $sub->where('period_key', $cond['period_key'])
                        ->where('dimension_type', $cond['dimension_type'])
                        ->where('dimension_id', $cond['dimension_id']);
                });
            }
        });

        $result = [];
        foreach ($query->get() as $snap) {
            $key = "{$snap->period_key}:{$snap->dimension_type}:{$snap->dimension_id}";
            $result[$key] = (float) $snap->total_collected;
        }

        return $result;
    }

    private function targetKey(RevenueTarget $target): string
    {
        return "{$target->period_key}:{$target->dept_id}";
    }

    private function snapshotKey(RevenueTarget $target): string
    {
        $dimType = $target->dept_id > 0 ? 'DEPARTMENT' : 'COMPANY';
        return "{$target->period_key}:{$dimType}:{$target->dept_id}";
    }

    // ───────────────────────────────────────────────────
    // Single-target helpers (kept for non-index callers)
    // ───────────────────────────────────────────────────

    private function parsePeriodDates(string $periodType, string $periodKey): ?array
    {
        try {
            return match ($periodType) {
                'MONTHLY' => [
                    'start' => Carbon::createFromFormat('Y-m', $periodKey)->startOfMonth()->toDateString(),
                    'end' => Carbon::createFromFormat('Y-m', $periodKey)->endOfMonth()->toDateString(),
                ],
                'QUARTERLY' => $this->parseQuarterDates($periodKey),
                'YEARLY' => [
                    'start' => Carbon::createFromFormat('Y', $periodKey)->startOfYear()->toDateString(),
                    'end' => Carbon::createFromFormat('Y', $periodKey)->endOfYear()->toDateString(),
                ],
                default => null,
            };
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseQuarterDates(string $periodKey): ?array
    {
        if (! preg_match('/^(\d{4})-Q([1-4])$/', $periodKey, $m)) {
            return null;
        }

        $year = (int) $m[1];
        $quarter = (int) $m[2];
        $startMonth = ($quarter - 1) * 3 + 1;

        $start = Carbon::create($year, $startMonth, 1)->startOfDay();
        $end = $start->copy()->addMonths(2)->endOfMonth();

        return [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
        ];
    }

    private function computeLiveActual(RevenueTarget $target): float
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return 0.0;
        }

        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $target->period_start)
            ->where('ps.expected_date', '<=', $target->period_end);

        if ($target->dept_id > 0) {
            $query->where('c.dept_id', $target->dept_id);
        }

        return (float) $query->selectRaw(
            'COALESCE(SUM(ps.actual_paid_amount), 0) as total'
        )->value('total');
    }

    private function getSnapshotActual(RevenueTarget $target): ?float
    {
        if (! $this->support->hasTable('revenue_snapshots')) {
            return null;
        }

        $dimType = $target->dept_id > 0 ? 'DEPARTMENT' : 'COMPANY';
        $dimId = $target->dept_id;

        $snapshot = RevenueSnapshot::where('period_key', $target->period_key)
            ->where('dimension_type', $dimType)
            ->where('dimension_id', $dimId)
            ->first();

        return $snapshot ? (float) $snapshot->total_collected : null;
    }

    // ───────────────────────────────────────────────────
    // Revenue target suggestion
    // ───────────────────────────────────────────────────

    /**
     * Suggest revenue target amounts per period based on:
     * 1. Contract payment schedules (PENDING/PARTIAL expected in target year)
     * 2. Project revenue schedules (projects with status CO_HOI)
     */
    public function suggest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'period_type' => ['required', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
        ]);

        $year = (int) $validated['year'];
        $periodType = (string) $validated['period_type'];
        $deptId = isset($validated['dept_id']) ? (int) $validated['dept_id'] : 0;

        $yearStart = "{$year}-01-01";
        $yearEnd = "{$year}-12-31";

        $monthKeyExpr = DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', ps.expected_date)"
            : "DATE_FORMAT(ps.expected_date, '%Y-%m')";

        // 1. Contract payment schedules
        $contractMonthly = [];
        $contractCounts = [];

        if ($this->support->hasTable('payment_schedules')) {
            $contractQuery = DB::table('payment_schedules as ps')
                ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
                ->whereNull('c.deleted_at')
                ->whereNull('ps.deleted_at')
                ->where('ps.expected_date', '>=', $yearStart)
                ->where('ps.expected_date', '<=', $yearEnd)
                ->whereIn('ps.status', ['PENDING', 'PARTIAL', 'INVOICED']);

            if ($deptId > 0 && $this->support->hasColumn('contracts', 'dept_id')) {
                $contractQuery->where('c.dept_id', $deptId);
            }

            $rows = $contractQuery
                ->selectRaw("{$monthKeyExpr} as month_key")
                ->selectRaw('COALESCE(SUM(ps.expected_amount - COALESCE(ps.actual_paid_amount, 0)), 0) as outstanding')
                ->selectRaw('COUNT(DISTINCT ps.contract_id) as contract_count')
                ->groupBy('month_key')
                ->orderBy('month_key')
                ->get();

            foreach ($rows as $row) {
                $contractMonthly[$row->month_key] = round(max(0, (float) $row->outstanding), 2);
                $contractCounts[$row->month_key] = (int) $row->contract_count;
            }
        }

        // 2. Project revenue schedules (CO_HOI projects)
        $opportunityMonthly = [];
        $opportunityCounts = [];

        if ($this->support->hasTable('project_revenue_schedules')) {
            $projMonthKeyExpr = DB::getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', prs.expected_date)"
                : "DATE_FORMAT(prs.expected_date, '%Y-%m')";

            $projQuery = DB::table('project_revenue_schedules as prs')
                ->join('projects as p', 'prs.project_id', '=', 'p.id')
                ->where('p.status', 'CO_HOI')
                ->whereNull('p.deleted_at')
                ->where('prs.expected_date', '>=', $yearStart)
                ->where('prs.expected_date', '<=', $yearEnd);

            if ($deptId > 0 && $this->support->hasColumn('projects', 'dept_id')) {
                $projQuery->where('p.dept_id', $deptId);
            }

            $rows = $projQuery
                ->selectRaw("{$projMonthKeyExpr} as month_key")
                ->selectRaw('COALESCE(SUM(prs.expected_amount), 0) as total')
                ->selectRaw('COUNT(DISTINCT prs.project_id) as project_count')
                ->groupBy('month_key')
                ->orderBy('month_key')
                ->get();

            foreach ($rows as $row) {
                $opportunityMonthly[$row->month_key] = round((float) $row->total, 2);
                $opportunityCounts[$row->month_key] = (int) $row->project_count;
            }
        }

        // 3. Merge + aggregate by period_type
        $allMonths = array_unique(array_merge(array_keys($contractMonthly), array_keys($opportunityMonthly)));
        sort($allMonths);

        $periodData = [];
        foreach ($allMonths as $monthKey) {
            $cAmt = $contractMonthly[$monthKey] ?? 0;
            $oAmt = $opportunityMonthly[$monthKey] ?? 0;
            $cCnt = $contractCounts[$monthKey] ?? 0;
            $oCnt = $opportunityCounts[$monthKey] ?? 0;

            $targetPeriodKey = $this->monthKeyToPeriodKey($monthKey, $periodType);

            if (! isset($periodData[$targetPeriodKey])) {
                $periodData[$targetPeriodKey] = [
                    'period_key' => $targetPeriodKey,
                    'contract_amount' => 0,
                    'opportunity_amount' => 0,
                    'suggested_total' => 0,
                    'contract_count' => 0,
                    'opportunity_count' => 0,
                ];
            }

            $periodData[$targetPeriodKey]['contract_amount'] = round($periodData[$targetPeriodKey]['contract_amount'] + $cAmt, 2);
            $periodData[$targetPeriodKey]['opportunity_amount'] = round($periodData[$targetPeriodKey]['opportunity_amount'] + $oAmt, 2);
            $periodData[$targetPeriodKey]['suggested_total'] = round(
                $periodData[$targetPeriodKey]['contract_amount'] + $periodData[$targetPeriodKey]['opportunity_amount'],
                2,
            );
            // Use max across months for count to avoid overcounting (same contract in multiple months)
            $periodData[$targetPeriodKey]['contract_count'] = max($periodData[$targetPeriodKey]['contract_count'], $cCnt);
            $periodData[$targetPeriodKey]['opportunity_count'] = max($periodData[$targetPeriodKey]['opportunity_count'], $oCnt);
        }

        $data = array_values($periodData);
        $totalSuggested = round(array_sum(array_column($data, 'suggested_total')), 2);

        return response()->json([
            'data' => $data,
            'meta' => [
                'year' => $year,
                'period_type' => $periodType,
                'total_suggested' => $totalSuggested,
            ],
        ]);
    }

    /**
     * Convert a month key (2026-01) to the appropriate period key (2026-01, 2026-Q1, or 2026).
     */
    private function monthKeyToPeriodKey(string $monthKey, string $periodType): string
    {
        return match ($periodType) {
            'MONTHLY' => $monthKey,
            'QUARTERLY' => substr($monthKey, 0, 4) . '-Q' . (int) ceil((int) substr($monthKey, 5, 2) / 3),
            'YEARLY' => substr($monthKey, 0, 4),
            default => $monthKey,
        };
    }
}
