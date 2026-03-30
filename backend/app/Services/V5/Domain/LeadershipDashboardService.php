<?php

namespace App\Services\V5\Domain;

use App\Services\V5\CacheService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LeadershipDashboardService
{
    private const CACHE_TAG = 'customer-request-cases';
    private const CACHE_TTL = 120;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly CacheService $cache,
    ) {}

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function resolveMonth(?string $param): string
    {
        if ($param !== null && preg_match('/^\d{4}-\d{2}$/', $param)) {
            return $param;
        }

        return Carbon::now()->format('Y-m');
    }

    /**
     * @return array<string, mixed>
     */
    private function computeKpis(string $month): array
    {
        $startDate = $month . '-01';
        $endDate   = Carbon::parse($startDate)->endOfMonth()->format('Y-m-d');
        $hasWL     = $this->support->hasTable('customer_request_worklogs');
        $hasCases  = $this->support->hasTable('customer_request_cases');
        $hasEsc    = $this->support->hasTable('customer_request_escalations');
        $hasIsBill = $hasWL && $this->support->hasColumn('customer_request_worklogs', 'is_billable');

        $closedStatuses = ['completed', 'customer_notified', 'not_executed'];

        // Total active cases
        $totalActiveCases = 0;
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $totalActiveCases = (int) DB::table('customer_request_cases')
                ->whereNotIn('current_status_code', $closedStatuses)
                ->whereNull('deleted_at')
                ->count();
        }

        // Total hours this month
        $totalHours    = 0.0;
        $billableHours = 0.0;
        if ($hasWL) {
            $snap = null;
            if ($this->support->hasTable('monthly_hours_snapshots')) {
                $snap = DB::table('monthly_hours_snapshots')
                    ->where('snapshot_month', $month)
                    ->selectRaw('SUM(total_hours) as th, SUM(billable_hours) as bh')
                    ->first();
            }
            if ($snap && $snap->th !== null) {
                $totalHours    = (float) $snap->th;
                $billableHours = (float) $snap->bh;
            } else {
                $live = DB::table('customer_request_worklogs')
                    ->whereBetween('work_date', [$startDate, $endDate])
                    ->selectRaw('SUM(hours_spent) as th' . ($hasIsBill ? ', SUM(CASE WHEN is_billable=1 THEN hours_spent ELSE 0 END) as bh' : ', 0 as bh'))
                    ->first();
                $totalHours    = (float) ($live->th ?? 0);
                $billableHours = (float) ($live->bh ?? 0);
            }
        }

        $billablePercent = $totalHours > 0 ? round($billableHours / $totalHours * 100, 1) : 0;

        // Est accuracy
        $estAccuracy = null;
        if ($hasCases && $hasWL && $this->support->hasColumn('customer_request_cases', 'estimated_hours')) {
            $estRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->join('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                ->whereNotNull('crc.estimated_hours')
                ->where('crc.estimated_hours', '>', 0)
                ->selectRaw('wl.request_case_id, MAX(crc.estimated_hours) as est, SUM(wl.hours_spent) as actual')
                ->groupBy('wl.request_case_id')
                ->get();

            if ($estRaw->isNotEmpty()) {
                $totalVariance = $estRaw->sum(fn ($r) => abs((float) $r->actual - (float) $r->est) / (float) $r->est);
                $estAccuracy   = round(max(0.0, 1.0 - $totalVariance / $estRaw->count()) * 100, 1);
            }
        }

        // Completion rate
        $completionRate = null;
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $startedCount = (int) DB::table('customer_request_cases')
                ->whereNull('deleted_at')
                ->where('created_at', '>=', $startDate)
                ->where('created_at', '<=', $endDate . ' 23:59:59')
                ->count();
            $completedCount = (int) DB::table('customer_request_cases')
                ->whereNull('deleted_at')
                ->whereIn('current_status_code', $closedStatuses)
                ->where('created_at', '>=', $startDate)
                ->where('created_at', '<=', $endDate . ' 23:59:59')
                ->count();
            $completionRate = $startedCount > 0 ? round($completedCount / $startedCount * 100, 1) : 0;
        }

        // Open escalations
        $openEscalations = 0;
        if ($hasEsc) {
            $openEscalations = (int) DB::table('customer_request_escalations')
                ->whereNull('deleted_at')
                ->whereIn('status', ['pending', 'reviewing'])
                ->count();
        }

        return [
            'total_active_cases'   => $totalActiveCases,
            'total_hours_month'    => $totalHours,
            'billable_percent'     => $billablePercent,
            'est_accuracy'         => $estAccuracy,
            'completion_rate'      => $completionRate,
            'open_escalations'     => $openEscalations,
        ];
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public function dashboard(Request $request): JsonResponse
    {
        $month       = $this->resolveMonth($request->query('month'));
        $compareWith = $this->normalizeNullableString($request->query('compare_with'));
        $startDate   = $month . '-01';
        $endDate     = Carbon::parse($startDate)->endOfMonth()->format('Y-m-d');

        $payload = $this->cache->rememberTagged(
            [self::CACHE_TAG],
            $this->buildCacheKey('dashboard', [
                'month' => $month,
                'compare_with' => $compareWith,
            ]),
            self::CACHE_TTL,
            fn (): array => $this->buildDashboardPayload($month, $compareWith, $startDate, $endDate),
        );

        return response()->json($payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDashboardPayload(string $month, ?string $compareWith, string $startDate, string $endDate): array
    {
        $kpis = $this->computeKpis($month);

        // Team health
        $teamHealth = [];
        if ($this->support->hasTable('customer_request_worklogs') && $this->support->hasTable('internal_users')) {
            $hasIsBill = $this->support->hasColumn('customer_request_worklogs', 'is_billable');
            $teamRaw   = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('
                    wl.performed_by_user_id as user_id,
                    MAX(iu.full_name) as user_name,
                    SUM(wl.hours_spent) as total_hours,
                    ' . ($hasIsBill ? 'SUM(CASE WHEN wl.is_billable=1 THEN wl.hours_spent ELSE 0 END)' : '0') . ' as billable_hours,
                    COUNT(DISTINCT wl.request_case_id) as case_count
                ')
                ->groupBy('wl.performed_by_user_id')
                ->orderByDesc('total_hours')
                ->get();

            foreach ($teamRaw as $row) {
                $th = (float) $row->total_hours;
                $workloadLevel = 'ok';
                if ($th >= 160) {
                    $workloadLevel = 'overloaded';
                } elseif ($th >= 120) {
                    $workloadLevel = 'high';
                }
                $teamHealth[] = [
                    'user_id'         => (int) $row->user_id,
                    'user_name'       => $row->user_name,
                    'total_hours'     => $th,
                    'billable_hours'  => (float) $row->billable_hours,
                    'case_count'      => (int) $row->case_count,
                    'workload_level'  => $workloadLevel,
                ];
            }
        }

        // Comparison
        $comparison = null;
        if ($compareWith === 'previous') {
            $prevMonth  = Carbon::parse($startDate)->subMonth()->format('Y-m');
            $comparison = $this->computeKpis($prevMonth);
            $comparison['period'] = $prevMonth;
        }

        return [
            'data' => [
                'period'      => $month,
                'kpis'        => $kpis,
                'team_health' => $teamHealth,
                'comparison'  => $comparison,
            ],
        ];
    }

    public function risks(Request $request): JsonResponse
    {
        $now        = Carbon::now();
        $hasWL      = $this->support->hasTable('customer_request_worklogs');
        $hasCases   = $this->support->hasTable('customer_request_cases');
        $hasEsc     = $this->support->hasTable('customer_request_escalations');
        $hasIsBill  = $hasWL && $this->support->hasColumn('customer_request_worklogs', 'is_billable');
        $closedStatuses = ['completed', 'customer_notified', 'not_executed'];

        $payload = $this->cache->rememberTagged(
            [self::CACHE_TAG],
            $this->buildCacheKey('risks', ['today' => $now->format('Y-m-d')]),
            self::CACHE_TTL,
            fn (): array => $this->buildRisksPayload($now, $hasWL, $hasCases, $hasEsc, $hasIsBill, $closedStatuses),
        );

        return response()->json($payload);
    }

    /**
     * @param array<int, string> $closedStatuses
     * @return array<string, mixed>
     */
    private function buildRisksPayload(Carbon $now, bool $hasWL, bool $hasCases, bool $hasEsc, bool $hasIsBill, array $closedStatuses): array
    {

        // 1. Personnel overload: users with weekly hours > 38 in current week
        $personnelOverload = [];
        if ($hasWL && $this->support->hasTable('internal_users')) {
            $weekStart = $now->copy()->startOfWeek()->format('Y-m-d');
            $weekEnd   = $now->copy()->endOfWeek()->format('Y-m-d');
            $weekRaw   = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$weekStart, $weekEnd])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('wl.performed_by_user_id as user_id, MAX(iu.full_name) as user_name, SUM(wl.hours_spent) as week_hours')
                ->groupBy('wl.performed_by_user_id')
                ->having('week_hours', '>', 38)
                ->get();

            foreach ($weekRaw as $row) {
                $personnelOverload[] = [
                    'user_id'    => (int) $row->user_id,
                    'user_name'  => $row->user_name,
                    'week_hours' => (float) $row->week_hours,
                ];
            }
        }

        // 2. SLA at risk: sla_due_date < now+3days AND not closed
        $slaAtRisk = [];
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'sla_due_date')
            && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $threshold = $now->copy()->addDays(3)->format('Y-m-d H:i:s');
            $slaRaw    = DB::table('customer_request_cases')
                ->whereNotNull('sla_due_date')
                ->where('sla_due_date', '<=', $threshold)
                ->whereNotIn('current_status_code', $closedStatuses)
                ->whereNull('deleted_at')
                ->select(['id', 'request_code', 'current_status_code', 'sla_due_date'])
                ->limit(20)
                ->get();

            foreach ($slaRaw as $row) {
                $slaAtRisk[] = (array) $row;
            }
        }

        // 3. Stalled cases: no worklog in 5+ days, not closed
        $stalledCases = [];
        if ($hasCases && $hasWL && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $fiveDaysAgo = $now->copy()->subDays(5)->format('Y-m-d');
            $stalledRaw  = DB::table('customer_request_cases as crc')
                ->whereNotIn('crc.current_status_code', $closedStatuses)
                ->whereNull('crc.deleted_at')
                ->whereNotExists(function ($sub) use ($fiveDaysAgo) {
                    $sub->from('customer_request_worklogs as wl')
                        ->whereColumn('wl.request_case_id', 'crc.id')
                        ->where('wl.work_date', '>=', $fiveDaysAgo);
                })
                ->select(['crc.id', 'crc.request_code', 'crc.current_status_code', 'crc.updated_at'])
                ->limit(20)
                ->get();

            foreach ($stalledRaw as $row) {
                $stalledCases[] = (array) $row;
            }
        }

        // 4. Unreviewed escalations pending > 2 days
        $unreviewedEscalations = 0;
        if ($hasEsc) {
            $twoDaysAgo            = $now->copy()->subDays(2)->format('Y-m-d H:i:s');
            $unreviewedEscalations = (int) DB::table('customer_request_escalations')
                ->whereNull('deleted_at')
                ->where('status', 'pending')
                ->where('raised_at', '<=', $twoDaysAgo)
                ->count();
        }

        // 5. Low billable teams: users billable% < 60% this month
        $lowBillableTeams = [];
        if ($hasWL && $hasIsBill && $this->support->hasTable('internal_users')) {
            $monthStart = $now->format('Y-m') . '-01';
            $monthEnd   = $now->endOfMonth()->format('Y-m-d');
            $billRaw    = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$monthStart, $monthEnd])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('
                    wl.performed_by_user_id as user_id,
                    MAX(iu.full_name) as user_name,
                    SUM(wl.hours_spent) as total_hours,
                    SUM(CASE WHEN wl.is_billable=1 THEN wl.hours_spent ELSE 0 END) as billable_hours
                ')
                ->groupBy('wl.performed_by_user_id')
                ->get();

            foreach ($billRaw as $row) {
                $total    = (float) $row->total_hours;
                $billable = (float) $row->billable_hours;
                if ($total > 0 && $billable / $total < 0.6) {
                    $lowBillableTeams[] = [
                        'user_id'         => (int) $row->user_id,
                        'user_name'       => $row->user_name,
                        'billable_percent'=> round($billable / $total * 100, 1),
                    ];
                }
            }
        }

        return [
            'data' => [
                'personnel_overload'     => $personnelOverload,
                'sla_at_risk'            => $slaAtRisk,
                'stalled_cases'          => $stalledCases,
                'unreviewed_escalations' => $unreviewedEscalations,
                'low_billable_teams'     => $lowBillableTeams,
            ],
        ];
    }

    public function teamComparison(Request $request): JsonResponse
    {
        $period  = $this->normalizeNullableString($request->query('period'));
        $groupBy = in_array($request->query('group_by'), ['user', 'project', 'customer'], true)
            ? $request->query('group_by')
            : 'user';

        $payload = $this->cache->rememberTagged(
            [self::CACHE_TAG],
            $this->buildCacheKey('team-comparison', [
                'period' => $period,
                'group_by' => $groupBy,
            ]),
            self::CACHE_TTL,
            fn (): array => $this->buildTeamComparisonPayload($period, $groupBy),
        );

        return response()->json($payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildTeamComparisonPayload(?string $period, string $groupBy): array
    {

        $hasWL    = $this->support->hasTable('customer_request_worklogs');
        $hasCases = $this->support->hasTable('customer_request_cases');

        if (! $hasWL) {
            return ['data' => [], 'meta' => ['period' => $period, 'group_by' => $groupBy]];
        }

        // Resolve date range from period
        [$startDate, $endDate] = $this->resolvePeriodRange($period);

        $hasIsBill = $this->support->hasColumn('customer_request_worklogs', 'is_billable');
        $billExpr  = $hasIsBill
            ? 'SUM(CASE WHEN wl.is_billable=1 THEN wl.hours_spent ELSE 0 END)'
            : '0';

        switch ($groupBy) {
            case 'project':
                if ($hasCases && $this->support->hasColumn('customer_request_cases', 'project_id')
                    && $this->support->hasTable('projects')) {
                    $rows = DB::table('customer_request_worklogs as wl')
                        ->whereBetween('wl.work_date', [$startDate, $endDate])
                        ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                        ->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id')
                        ->selectRaw("
                            crc.project_id as entity_id,
                            MAX(pj.project_name) as entity_name,
                            SUM(wl.hours_spent) as total_hours,
                            {$billExpr} as billable_hours,
                            COUNT(DISTINCT wl.request_case_id) as case_count,
                            0 as completed_count,
                            0 as avg_est_accuracy
                        ")
                        ->groupBy('crc.project_id')
                        ->orderByDesc('total_hours')
                        ->limit(20)
                        ->get();
                } else {
                    $rows = collect();
                }
                break;

            case 'customer':
                if ($hasCases && $this->support->hasColumn('customer_request_cases', 'customer_id')
                    && $this->support->hasTable('customers')) {
                    $rows = DB::table('customer_request_worklogs as wl')
                        ->whereBetween('wl.work_date', [$startDate, $endDate])
                        ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                        ->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id')
                        ->selectRaw("
                            crc.customer_id as entity_id,
                            MAX(cu.customer_name) as entity_name,
                            SUM(wl.hours_spent) as total_hours,
                            {$billExpr} as billable_hours,
                            COUNT(DISTINCT wl.request_case_id) as case_count,
                            0 as completed_count,
                            0 as avg_est_accuracy
                        ")
                        ->groupBy('crc.customer_id')
                        ->orderByDesc('total_hours')
                        ->limit(20)
                        ->get();
                } else {
                    $rows = collect();
                }
                break;

            default: // user
                $rows = DB::table('customer_request_worklogs as wl')
                    ->whereBetween('wl.work_date', [$startDate, $endDate])
                    ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                    ->selectRaw("
                        wl.performed_by_user_id as entity_id,
                        MAX(iu.full_name) as entity_name,
                        SUM(wl.hours_spent) as total_hours,
                        {$billExpr} as billable_hours,
                        COUNT(DISTINCT wl.request_case_id) as case_count,
                        0 as completed_count,
                        0 as avg_est_accuracy
                    ")
                    ->groupBy('wl.performed_by_user_id')
                    ->orderByDesc('total_hours')
                    ->limit(20)
                    ->get();
                break;
        }

        $data = $rows->map(function ($row) {
            $r = (array) $row;
            $th = (float) ($r['total_hours'] ?? 0);
            $bh = (float) ($r['billable_hours'] ?? 0);

            return [
                'entity_id'        => $this->support->parseNullableInt($r['entity_id'] ?? null),
                'entity_name'      => $this->normalizeNullableString($r['entity_name'] ?? null),
                'total_hours'      => $th,
                'billable_hours'   => $bh,
                'case_count'       => (int) ($r['case_count'] ?? 0),
                'completed_count'  => (int) ($r['completed_count'] ?? 0),
                'billable_percent' => $th > 0 ? round($bh / $th * 100, 1) : 0,
                'avg_est_accuracy' => (float) ($r['avg_est_accuracy'] ?? 0),
            ];
        })->toArray();

        return [
            'data' => $data,
            'meta' => [
                'period'   => $period,
                'group_by' => $groupBy,
            ],
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolvePeriodRange(?string $period): array
    {
        if ($period === null) {
            $month = Carbon::now()->format('Y-m');

            return [$month . '-01', Carbon::now()->endOfMonth()->format('Y-m-d')];
        }

        // Quarter e.g. Q1-2026
        if (preg_match('/^Q(\d)-(\d{4})$/', $period, $m)) {
            $quarter    = (int) $m[1];
            $year       = (int) $m[2];
            $startMonth = ($quarter - 1) * 3 + 1;
            $endMonth   = $startMonth + 2;
            $start      = Carbon::create($year, $startMonth, 1)->format('Y-m-d');
            $end        = Carbon::create($year, $endMonth, 1)->endOfMonth()->format('Y-m-d');

            return [$start, $end];
        }

        // Month e.g. 2026-03
        if (preg_match('/^\d{4}-\d{2}$/', $period)) {
            $start = $period . '-01';
            $end   = Carbon::parse($start)->endOfMonth()->format('Y-m-d');

            return [$start, $end];
        }

        // Default: current month
        $month = Carbon::now()->format('Y-m');

        return [$month . '-01', Carbon::now()->endOfMonth()->format('Y-m-d')];
    }

    /**
     * @param array<string, scalar|null> $params
     */
    private function buildCacheKey(string $prefix, array $params): string
    {
        ksort($params);

        return sprintf('v5:leadership:%s:%s', $prefix, http_build_query($params));
    }
}
