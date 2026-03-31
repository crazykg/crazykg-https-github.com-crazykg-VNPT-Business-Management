<?php

namespace App\Services\V5\Revenue;

use App\Models\RevenueSnapshot;
use App\Models\RevenueTarget;
use App\Services\V5\CacheService;
use App\Services\V5\Realtime\DashboardRealtimeNotifier;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RevenueTargetService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $auditService,
        private readonly CacheService $cache,
        private readonly DashboardRealtimeNotifier $realtimeNotifier,
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

        $this->flushOverviewCaches($userId, 'revenue-target.created');

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

        $this->flushOverviewCaches($userId, 'revenue-target.updated');

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

        $actorId = $this->auditService->resolveAuthenticatedUserId($request);
        $this->flushOverviewCaches($actorId, 'revenue-target.deleted');

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

        $this->flushOverviewCaches($userId, 'revenue-target.bulk-upserted');

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

        $contractDeletedAtClause = $this->support->hasColumn('contracts', 'deleted_at')
            ? 'c.deleted_at IS NULL'
            : '1 = 1';
        $paymentScheduleDeletedAtClause = $this->support->hasColumn('payment_schedules', 'deleted_at')
            ? ' AND ps.deleted_at IS NULL'
            : '';
        $actualCollectedColumn = $this->resolvePaymentScheduleCollectedAmountColumn();

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
            $deptClause = $r['dept_id'] > 0 && $this->support->hasColumn('contracts', 'dept_id')
                ? "AND c.dept_id = ?"
                : "";
            $selects[] = "SELECT ? as target_key, COALESCE(SUM({$actualCollectedColumn}), 0) as total
                FROM payment_schedules ps
                JOIN contracts c ON ps.contract_id = c.id
                WHERE {$contractDeletedAtClause}{$paymentScheduleDeletedAtClause}
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

    private function flushOverviewCaches(?int $actorId = null, string $reason = 'revenue-target.updated'): void
    {
        $this->cache->flushTags(['revenue-targets']);
        $this->cache->flushTags(['revenue-overview']);
        $this->realtimeNotifier->notify(['revenue'], $actorId, $reason);
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
            ->where('ps.expected_date', '>=', $target->period_start)
            ->where('ps.expected_date', '<=', $target->period_end);

        if ($this->support->hasColumn('contracts', 'deleted_at')) {
            $query->whereNull('c.deleted_at');
        }
        if ($this->support->hasColumn('payment_schedules', 'deleted_at')) {
            $query->whereNull('ps.deleted_at');
        }

        if ($target->dept_id > 0 && $this->support->hasColumn('contracts', 'dept_id')) {
            $query->where('c.dept_id', $target->dept_id);
        }

        $actualCollectedColumn = $this->resolvePaymentScheduleCollectedAmountColumn();

        return (float) $query->selectRaw("COALESCE(SUM({$actualCollectedColumn}), 0) as total")
            ->value('total');
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
            'include_breakdown' => ['sometimes', 'boolean'],
        ]);

        $year = (int) $validated['year'];
        $periodType = (string) $validated['period_type'];
        $deptId = isset($validated['dept_id']) ? (int) $validated['dept_id'] : 0;
        $includeBreakdown = (bool) ($validated['include_breakdown'] ?? false);

        $yearStart = "{$year}-01-01";
        $yearEnd = "{$year}-12-31";

        $monthKeyExpr = DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', ps.expected_date)"
            : "DATE_FORMAT(ps.expected_date, '%Y-%m')";
        $actualPaidColumn = $this->resolvePaymentScheduleCollectedAmountColumn();
        $nonNegativeOutstandingExpr = $this->buildNonNegativeDifferenceExpression(
            'ps.expected_amount',
            "COALESCE({$actualPaidColumn}, 0)",
        );

        // 1. Contract payment schedules
        $contractMonthly = [];
        $contractCounts = [];
        $contractPreviewRows = [];

        if ($this->support->hasTable('payment_schedules')) {
            $contractQuery = DB::table('payment_schedules as ps')
                ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
                ->where('ps.expected_date', '>=', $yearStart)
                ->where('ps.expected_date', '<=', $yearEnd)
                ->whereIn('ps.status', ['PENDING', 'PARTIAL', 'INVOICED']);

            if ($this->support->hasColumn('contracts', 'deleted_at')) {
                $contractQuery->whereNull('c.deleted_at');
            }
            if ($this->support->hasColumn('payment_schedules', 'deleted_at')) {
                $contractQuery->whereNull('ps.deleted_at');
            }

            if ($deptId > 0 && $this->support->hasColumn('contracts', 'dept_id')) {
                $contractQuery->where('c.dept_id', $deptId);
            }

            $rows = (clone $contractQuery)
                ->selectRaw("{$monthKeyExpr} as month_key")
                ->selectRaw("COALESCE(SUM(ps.expected_amount - COALESCE({$actualPaidColumn}, 0)), 0) as outstanding")
                ->selectRaw('COUNT(DISTINCT ps.contract_id) as contract_count')
                ->groupBy('month_key')
                ->orderBy('month_key')
                ->get();

            foreach ($rows as $row) {
                $contractMonthly[$row->month_key] = round(max(0, (float) $row->outstanding), 2);
                $contractCounts[$row->month_key] = (int) $row->contract_count;
            }

            if ($includeBreakdown) {
                $contractPreviewQuery = clone $contractQuery;
                $hasProjectsTable = $this->support->hasTable('projects');
                $hasContractCode = $this->support->hasColumn('contracts', 'contract_code');
                $hasContractName = $this->support->hasColumn('contracts', 'contract_name');
                $hasProjectCode = $hasProjectsTable && $this->support->hasColumn('projects', 'project_code');
                $hasProjectName = $hasProjectsTable && $this->support->hasColumn('projects', 'project_name');

                if ($hasProjectsTable) {
                    $contractPreviewQuery->leftJoin('projects as p', 'c.project_id', '=', 'p.id');
                }

                $contractPreviewRows = $contractPreviewQuery
                    ->selectRaw('c.id as contract_id')
                    ->selectRaw($hasContractCode ? 'COALESCE(c.contract_code, "") as contract_code' : '"" as contract_code')
                    ->selectRaw($hasContractName ? 'COALESCE(c.contract_name, "") as contract_name' : '"" as contract_name')
                    ->selectRaw('c.project_id as project_id')
                    ->selectRaw($hasProjectCode ? 'COALESCE(p.project_code, "") as project_code' : '"" as project_code')
                    ->selectRaw($hasProjectName ? 'COALESCE(p.project_name, "") as project_name' : '"" as project_name')
                    ->selectRaw('ps.expected_date as expected_date')
                    ->selectRaw('ps.expected_amount as expected_amount')
                    ->selectRaw("COALESCE({$actualPaidColumn}, 0) as actual_paid_amount")
                    ->selectRaw("{$nonNegativeOutstandingExpr} as outstanding_amount")
                    ->selectRaw('ps.status as schedule_status')
                    ->orderBy('ps.expected_date')
                    ->orderBy('c.id')
                    ->get();
            }
        }

        // 2. Project revenue schedules
        // Include phased project revenue when the project is still active and
        // there is no contract cashflow for the same project in the target year.
        // This keeps the "Đề xuất từ dữ liệu" button useful for phased projects
        // outside CO_HOI while avoiding obvious double counting with contracts.
        $opportunityMonthly = [];
        $opportunityCounts = [];
        $projectPreviewRows = [];

        if ($this->support->hasTable('project_revenue_schedules')) {
            $projMonthKeyExpr = DB::getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', prs.expected_date)"
                : "DATE_FORMAT(prs.expected_date, '%Y-%m')";

            $projQuery = DB::table('project_revenue_schedules as prs')
                ->join('projects as p', 'prs.project_id', '=', 'p.id')
                ->whereNull('p.deleted_at')
                ->where('prs.expected_date', '>=', $yearStart)
                ->where('prs.expected_date', '<=', $yearEnd);

            if ($this->support->hasColumn('projects', 'status')) {
                $projQuery->whereNotIn('p.status', ['HUY', 'TAM_NGUNG']);
            }

            $canCheckContractCashflowByProject = $this->support->hasTable('contracts')
                && $this->support->hasTable('payment_schedules')
                && $this->support->hasColumn('contracts', 'project_id');

            if ($canCheckContractCashflowByProject) {
                $projQuery->where(function ($query) use ($yearStart, $yearEnd): void {
                    $query->where('p.status', 'CO_HOI')
                        ->orWhereNotExists(function ($subQuery) use ($yearStart, $yearEnd): void {
                            $subQuery->select(DB::raw(1))
                                ->from('contracts as linked_contract')
                                ->join('payment_schedules as linked_schedule', 'linked_schedule.contract_id', '=', 'linked_contract.id')
                                ->whereColumn('linked_contract.project_id', 'p.id')
                                ->where('linked_schedule.expected_date', '>=', $yearStart)
                                ->where('linked_schedule.expected_date', '<=', $yearEnd)
                                ->whereIn('linked_schedule.status', ['PENDING', 'PARTIAL', 'INVOICED']);

                            if ($this->support->hasColumn('contracts', 'deleted_at')) {
                                $subQuery->whereNull('linked_contract.deleted_at');
                            }
                            if ($this->support->hasColumn('payment_schedules', 'deleted_at')) {
                                $subQuery->whereNull('linked_schedule.deleted_at');
                            }
                        });
                });
            }

            if ($deptId > 0 && $this->support->hasColumn('projects', 'dept_id')) {
                $projQuery->where('p.dept_id', $deptId);
            }

            $rows = (clone $projQuery)
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

            if ($includeBreakdown) {
                $hasProjectCode = $this->support->hasColumn('projects', 'project_code');
                $hasProjectName = $this->support->hasColumn('projects', 'project_name');
                $hasInvestmentMode = $this->support->hasColumn('projects', 'investment_mode');
                $hasProjectStatus = $this->support->hasColumn('projects', 'status');

                $projectPreviewRows = (clone $projQuery)
                    ->selectRaw('p.id as project_id')
                    ->selectRaw($hasProjectCode ? 'COALESCE(p.project_code, "") as project_code' : '"" as project_code')
                    ->selectRaw($hasProjectName ? 'COALESCE(p.project_name, "") as project_name' : '"" as project_name')
                    ->selectRaw($hasInvestmentMode ? 'COALESCE(p.investment_mode, "") as investment_mode' : '"" as investment_mode')
                    ->selectRaw($hasProjectStatus ? 'COALESCE(p.status, "") as project_status' : '"" as project_status')
                    ->selectRaw('prs.cycle_number as cycle_number')
                    ->selectRaw('prs.expected_date as expected_date')
                    ->selectRaw('prs.expected_amount as expected_amount')
                    ->orderBy($hasProjectCode ? 'p.project_code' : 'p.id')
                    ->orderBy('prs.expected_date')
                    ->orderBy('prs.cycle_number')
                    ->get();
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

        $response = [
            'data' => $data,
            'meta' => [
                'year' => $year,
                'period_type' => $periodType,
                'total_suggested' => $totalSuggested,
            ],
        ];

        if ($includeBreakdown) {
            $projectPreview = $this->buildProjectSuggestionPreview($projectPreviewRows, $periodType);
            $contractPreview = $this->buildContractSuggestionPreview($contractPreviewRows, $periodType);

            $response['preview'] = [
                'project_total' => round(array_sum(array_column($projectPreview, 'total_amount')), 2),
                'contract_total' => round(array_sum(array_column($contractPreview, 'outstanding_amount')), 2),
                'project_sources' => $projectPreview,
                'contract_sources' => $contractPreview,
            ];
        }

        return response()->json($response);
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

    private function resolvePaymentScheduleCollectedAmountColumn(string $alias = 'ps'): string
    {
        if ($this->support->hasColumn('payment_schedules', 'actual_paid_amount')) {
            return "{$alias}.actual_paid_amount";
        }

        if ($this->support->hasColumn('payment_schedules', 'actual_amount')) {
            return "{$alias}.actual_amount";
        }

        return '0';
    }

    private function buildNonNegativeDifferenceExpression(string $leftExpression, string $rightExpression): string
    {
        $difference = "{$leftExpression} - {$rightExpression}";

        return DB::getDriverName() === 'sqlite'
            ? "MAX({$difference}, 0)"
            : "GREATEST({$difference}, 0)";
    }

    /**
     * @param \Illuminate\Support\Collection<int, object>|array<int, object> $rows
     * @return array<int, array<string, mixed>>
     */
    private function buildProjectSuggestionPreview(Collection|array $rows, string $periodType): array
    {
        $collection = $rows instanceof Collection ? $rows : collect($rows);
        if ($collection->isEmpty()) {
            return [];
        }

        $projectIds = $collection
            ->pluck('project_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->values()
            ->all();

        $accountableByProject = [];
        foreach ($this->support->fetchProjectRaciAssignmentsByProjectIds($projectIds) as $assignment) {
            $projectId = (int) ($assignment['project_id'] ?? 0);
            $role = strtoupper(trim((string) ($assignment['raci_role'] ?? '')));
            if ($projectId <= 0 || $role !== 'A' || isset($accountableByProject[$projectId])) {
                continue;
            }

            $accountableByProject[$projectId] = [
                'user_id' => isset($assignment['user_id']) ? (int) $assignment['user_id'] : null,
                'user_code' => $assignment['user_code'] ?? null,
                'full_name' => $assignment['full_name'] ?? null,
            ];
        }

        $grouped = [];
        foreach ($collection as $row) {
            $projectId = (int) ($row->project_id ?? 0);
            if ($projectId <= 0) {
                continue;
            }

            if (! isset($grouped[$projectId])) {
                $accountable = $accountableByProject[$projectId] ?? null;
                $grouped[$projectId] = [
                    'project_id' => $projectId,
                    'project_code' => (string) ($row->project_code ?? ''),
                    'project_name' => (string) ($row->project_name ?? ''),
                    'investment_mode' => (string) ($row->investment_mode ?? ''),
                    'project_status' => (string) ($row->project_status ?? ''),
                    'accountable_user_id' => $accountable['user_id'] ?? null,
                    'accountable_user_code' => $accountable['user_code'] ?? null,
                    'accountable_full_name' => $accountable['full_name'] ?? null,
                    'schedule_count' => 0,
                    'total_amount' => 0,
                    'periods' => [],
                ];
            }

            $expectedDate = (string) ($row->expected_date ?? '');
            $monthKey = preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDate) === 1
                ? substr($expectedDate, 0, 7)
                : '';
            $amount = round((float) ($row->expected_amount ?? 0), 2);

            $grouped[$projectId]['schedule_count']++;
            $grouped[$projectId]['total_amount'] = round($grouped[$projectId]['total_amount'] + $amount, 2);
            $grouped[$projectId]['periods'][] = [
                'cycle_number' => (int) ($row->cycle_number ?? 0),
                'expected_date' => $expectedDate !== '' ? $expectedDate : null,
                'expected_amount' => $amount,
                'period_key' => $monthKey !== '' ? $this->monthKeyToPeriodKey($monthKey, $periodType) : null,
            ];
        }

        return array_values($grouped);
    }

    /**
     * @param \Illuminate\Support\Collection<int, object>|array<int, object> $rows
     * @return array<int, array<string, mixed>>
     */
    private function buildContractSuggestionPreview(Collection|array $rows, string $periodType): array
    {
        $collection = $rows instanceof Collection ? $rows : collect($rows);
        if ($collection->isEmpty()) {
            return [];
        }

        $result = [];
        foreach ($collection as $row) {
            $expectedDate = (string) ($row->expected_date ?? '');
            $monthKey = preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDate) === 1
                ? substr($expectedDate, 0, 7)
                : '';
            $result[] = [
                'contract_id' => (int) ($row->contract_id ?? 0),
                'contract_code' => (string) ($row->contract_code ?? ''),
                'contract_name' => (string) ($row->contract_name ?? ''),
                'project_id' => isset($row->project_id) ? (int) $row->project_id : null,
                'project_code' => (string) ($row->project_code ?? ''),
                'project_name' => (string) ($row->project_name ?? ''),
                'expected_date' => $expectedDate !== '' ? $expectedDate : null,
                'period_key' => $monthKey !== '' ? $this->monthKeyToPeriodKey($monthKey, $periodType) : null,
                'expected_amount' => round((float) ($row->expected_amount ?? 0), 2),
                'actual_paid_amount' => round((float) ($row->actual_paid_amount ?? 0), 2),
                'outstanding_amount' => round((float) ($row->outstanding_amount ?? 0), 2),
                'schedule_status' => (string) ($row->schedule_status ?? ''),
            ];
        }

        return $result;
    }
}
