<?php

namespace App\Services\V5\Revenue;

use App\Models\RevenueSnapshot;
use App\Models\RevenueTarget;
use App\Services\V5\Contract\ContractRevenueAnalyticsService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RevenueOverviewService
{
    private bool $feeCollectionAvailable = false;

    public function __construct(
        private readonly ContractRevenueAnalyticsService $contractRevenue,
        private readonly V5DomainSupportService $support
    ) {
        // Check if fee collection tables exist (graceful degradation)
        $this->feeCollectionAvailable = $this->support->hasTable('invoices')
            && $this->support->hasTable('receipts');
    }

    /**
     * overview() — Main dashboard endpoint
     *
     * Live achievement for open periods, snapshot for closed periods.
     * Reconciliation: invoice supersedes linked payment_schedule when fee collection is active.
     */
    public function overview(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $validated = $request->validate([
            'period_from' => ['required', 'date'],
            'period_to' => ['required', 'date'],
            'grouping' => ['sometimes', Rule::in(['month', 'quarter'])],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
        ]);

        $periodFrom = Carbon::parse((string) $validated['period_from'])->startOfDay();
        $periodTo = Carbon::parse((string) $validated['period_to'])->endOfDay();

        if ($periodTo->lt($periodFrom)) {
            return response()->json([
                'message' => 'period_to phải lớn hơn hoặc bằng period_from.',
                'errors' => ['period_to' => ['period_to phải lớn hơn hoặc bằng period_from.']],
            ], 422);
        }

        $grouping = (string) ($validated['grouping'] ?? 'month');
        $deptId = isset($validated['dept_id']) ? (int) $validated['dept_id'] : null;

        // 1. Build period buckets
        $buckets = $this->buildPeriodBuckets($periodFrom, $periodTo, $grouping);

        // 2. Get contract-based revenue data
        $contractData = $this->getContractRevenue($periodFrom, $periodTo, $deptId);

        // 3. Get targets for the period range
        $targets = $this->getTargets($periodFrom, $periodTo, $grouping, $deptId);

        // 4. Build by_period with reconciled values
        $byPeriod = $this->buildByPeriod($buckets, $contractData, $targets);

        // 5. Compute KPIs
        $kpis = $this->computeKpis($byPeriod, $periodFrom, $periodTo, $deptId);

        // 6. Get by_source breakdown
        $bySource = $this->computeBySource($periodFrom, $periodTo, $deptId);

        // 7. Generate alerts
        $alerts = $this->generateAlerts($kpis, $byPeriod, $periodFrom, $periodTo);

        $dataSources = ['contracts'];
        if ($this->feeCollectionAvailable) {
            $dataSources[] = 'invoices';
        }

        return response()->json([
            'meta' => [
                'fee_collection_available' => $this->feeCollectionAvailable,
                'data_sources' => $dataSources,
            ],
            'data' => [
                'kpis' => $kpis,
                'by_period' => $byPeriod,
                'by_source' => $bySource,
                'alerts' => $alerts,
            ],
        ]);
    }

    // ───────────────────────────────────────────────────
    // Period bucket helpers
    // ───────────────────────────────────────────────────

    private function buildPeriodBuckets(Carbon $from, Carbon $to, string $grouping): array
    {
        $buckets = [];
        $cursor = $from->copy()->startOfMonth();
        $end = $to->copy()->endOfMonth();

        if ($grouping === 'quarter') {
            $cursor = $from->copy()->firstOfQuarter();
            $end = $to->copy()->endOfQuarter();

            while ($cursor->lte($end)) {
                $q = (int) ceil($cursor->month / 3);
                $key = $cursor->year . '-Q' . $q;
                $label = 'Quý ' . $q . '/' . $cursor->year;
                $buckets[$key] = [
                    'period_key' => $key,
                    'period_label' => $label,
                    'period_start' => $cursor->copy()->toDateString(),
                    'period_end' => $cursor->copy()->endOfQuarter()->toDateString(),
                ];
                $cursor->addQuarterNoOverflow();
            }
        } else {
            while ($cursor->lte($end)) {
                $key = $cursor->format('Y-m');
                $label = 'Tháng ' . $cursor->month . '/' . $cursor->year;
                $buckets[$key] = [
                    'period_key' => $key,
                    'period_label' => $label,
                    'period_start' => $cursor->copy()->startOfMonth()->toDateString(),
                    'period_end' => $cursor->copy()->endOfMonth()->toDateString(),
                ];
                $cursor->addMonthNoOverflow();
            }
        }

        return $buckets;
    }

    // ───────────────────────────────────────────────────
    // Contract revenue aggregation
    // ───────────────────────────────────────────────────

    private function getContractRevenue(Carbon $from, Carbon $to, ?int $deptId): array
    {
        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from->toDateString())
            ->where('ps.expected_date', '<=', $to->toDateString());

        if ($deptId !== null && $deptId > 0) {
            $query->where(function ($q) use ($deptId) {
                $q->where('c.dept_id', $deptId);
                if ($this->support->hasColumn('contracts', 'project_id')) {
                    $q->orWhereExists(function ($sub) use ($deptId) {
                        $sub->select(DB::raw(1))
                            ->from('projects')
                            ->whereColumn('projects.id', 'c.project_id')
                            ->where('projects.department_id', $deptId);
                    });
                }
            });
        }

        $rows = $query->select([
            DB::raw("DATE_FORMAT(ps.expected_date, '%Y-%m') as month_key"),
            DB::raw('COALESCE(SUM(ps.expected_amount), 0) as expected'),
            DB::raw('COALESCE(SUM(ps.actual_amount), 0) as actual'),
            DB::raw('COALESCE(SUM(CASE WHEN ps.expected_date < CURDATE() AND (ps.actual_amount IS NULL OR ps.actual_amount < ps.expected_amount) THEN COALESCE(ps.expected_amount, 0) - COALESCE(ps.actual_amount, 0) ELSE 0 END), 0) as overdue'),
        ])->groupBy('month_key')->get();

        $data = [];
        foreach ($rows as $row) {
            $data[(string) $row->month_key] = [
                'expected' => (float) $row->expected,
                'actual' => (float) $row->actual,
                'overdue' => (float) $row->overdue,
            ];
        }

        return $data;
    }

    // ───────────────────────────────────────────────────
    // Targets
    // ───────────────────────────────────────────────────

    private function getTargets(Carbon $from, Carbon $to, string $grouping, ?int $deptId): array
    {
        $periodType = $grouping === 'quarter' ? 'QUARTERLY' : 'MONTHLY';

        $query = RevenueTarget::where('period_type', $periodType)
            ->where('target_type', 'TOTAL')
            ->where('period_start', '>=', $from->toDateString())
            ->where('period_end', '<=', $to->toDateString())
            ->whereNull('deleted_at');

        if ($deptId !== null && $deptId > 0) {
            $query->where('dept_id', $deptId);
        } else {
            $query->where('dept_id', 0);
        }

        $targets = [];
        foreach ($query->get() as $target) {
            $targets[$target->period_key] = (float) $target->target_amount;
        }

        return $targets;
    }

    // ───────────────────────────────────────────────────
    // Build by_period with reconciliation
    // ───────────────────────────────────────────────────

    private function buildByPeriod(array $buckets, array $contractData, array $targets): array
    {
        $result = [];
        $cumTarget = 0.0;
        $cumExpected = 0.0;
        $cumActual = 0.0;

        foreach ($buckets as $key => $bucket) {
            $today = now()->toDateString();
            $periodEnd = $bucket['period_end'];
            $isClosed = $periodEnd < $today;

            // Try snapshot for closed periods
            $contractExpected = 0.0;
            $contractActual = 0.0;
            $invoiceExpected = 0.0;
            $invoiceActual = 0.0;
            $totalExpected = 0.0;
            $totalActual = 0.0;

            if ($isClosed) {
                $snapshot = $this->getSnapshot($key);
                if ($snapshot) {
                    $contractExpected = (float) $snapshot->contract_expected;
                    $contractActual = (float) $snapshot->contract_collected;
                    $invoiceExpected = (float) $snapshot->invoice_issued;
                    $invoiceActual = (float) $snapshot->invoice_collected;
                    $totalExpected = (float) $snapshot->total_expected;
                    $totalActual = (float) $snapshot->total_collected;
                } else {
                    // Fallback to live for closed period without snapshot
                    $live = $this->getLiveForPeriod($key, $contractData);
                    $contractExpected = $live['contract_expected'];
                    $contractActual = $live['contract_actual'];
                    $totalExpected = $live['total_expected'];
                    $totalActual = $live['total_actual'];
                }
            } else {
                // Open period: always live
                $live = $this->getLiveForPeriod($key, $contractData);
                $contractExpected = $live['contract_expected'];
                $contractActual = $live['contract_actual'];
                $totalExpected = $live['total_expected'];
                $totalActual = $live['total_actual'];
            }

            $target = $targets[$key] ?? 0.0;
            $cumTarget += $target;
            $cumExpected += $totalExpected;
            $cumActual += $totalActual;

            $result[] = [
                'period_key' => $key,
                'period_label' => $bucket['period_label'],
                'target' => $target,
                'contract_expected' => round($contractExpected, 2),
                'contract_actual' => round($contractActual, 2),
                'invoice_expected' => round($invoiceExpected, 2),
                'invoice_actual' => round($invoiceActual, 2),
                'total_expected' => round($totalExpected, 2),
                'total_actual' => round($totalActual, 2),
                'cumulative_target' => round($cumTarget, 2),
                'cumulative_expected' => round($cumExpected, 2),
                'cumulative_actual' => round($cumActual, 2),
                'achievement_pct' => $target > 0
                    ? round($totalActual / $target * 100, 1)
                    : 0.0,
            ];
        }

        return $result;
    }

    private function getLiveForPeriod(string $periodKey, array $contractData): array
    {
        $contract = $contractData[$periodKey] ?? ['expected' => 0.0, 'actual' => 0.0];

        // Phase 1: no fee collection yet → total = contract
        // When fee collection available: total = COALESCE(invoice, contract) per payment_schedule
        return [
            'contract_expected' => (float) $contract['expected'],
            'contract_actual' => (float) $contract['actual'],
            'total_expected' => (float) $contract['expected'],
            'total_actual' => (float) $contract['actual'],
        ];
    }

    private function getSnapshot(string $periodKey): ?RevenueSnapshot
    {
        return RevenueSnapshot::where('period_key', $periodKey)
            ->where('dimension_type', 'COMPANY')
            ->where('dimension_id', 0)
            ->first();
    }

    // ───────────────────────────────────────────────────
    // KPIs
    // ───────────────────────────────────────────────────

    private function computeKpis(array $byPeriod, Carbon $from, Carbon $to, ?int $deptId): array
    {
        $totalTarget = 0.0;
        $totalExpected = 0.0;
        $totalActual = 0.0;

        foreach ($byPeriod as $period) {
            $totalTarget += $period['target'];
            $totalExpected += $period['total_expected'];
            $totalActual += $period['total_actual'];
        }

        $outstanding = $totalExpected - $totalActual;

        // Overdue: payment_schedules past due date
        $overdue = $this->computeOverdue($from, $to, $deptId);

        // Growth: compare with previous period of same length
        $growthPct = $this->computeGrowth($from, $to, $totalActual, $deptId);

        return [
            'target_amount' => round($totalTarget, 2),
            'expected_revenue' => round($totalExpected, 2),
            'actual_collected' => round($totalActual, 2),
            'outstanding' => round(max($outstanding, 0), 2),
            'achievement_pct' => $totalTarget > 0
                ? round($totalActual / $totalTarget * 100, 1)
                : 0.0,
            'collection_rate' => $totalExpected > 0
                ? round($totalActual / $totalExpected * 100, 1)
                : 0.0,
            'growth_pct' => $growthPct,
            'overdue_amount' => round($overdue, 2),
        ];
    }

    private function computeOverdue(Carbon $from, Carbon $to, ?int $deptId): float
    {
        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from->toDateString())
            ->where('ps.expected_date', '<', now()->toDateString())
            ->whereRaw('(ps.actual_amount IS NULL OR ps.actual_amount < ps.expected_amount)');

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        return (float) $query->selectRaw(
            'COALESCE(SUM(COALESCE(ps.expected_amount, 0) - COALESCE(ps.actual_amount, 0)), 0) as overdue'
        )->value('overdue');
    }

    private function computeGrowth(Carbon $from, Carbon $to, float $currentActual, ?int $deptId): float
    {
        $periodLength = $from->diffInDays($to);
        $prevFrom = $from->copy()->subDays($periodLength + 1);
        $prevTo = $from->copy()->subDay();

        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $prevFrom->toDateString())
            ->where('ps.expected_date', '<=', $prevTo->toDateString());

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $prevActual = (float) $query->selectRaw(
            'COALESCE(SUM(ps.actual_amount), 0) as total'
        )->value('total');

        if ($prevActual <= 0) {
            return 0.0;
        }

        return round(($currentActual - $prevActual) / $prevActual * 100, 1);
    }

    // ───────────────────────────────────────────────────
    // By source breakdown
    // ───────────────────────────────────────────────────

    private function computeBySource(Carbon $from, Carbon $to, ?int $deptId): array
    {
        if (! $this->support->hasColumn('contracts', 'payment_cycle')) {
            return [];
        }

        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from->toDateString())
            ->where('ps.expected_date', '<=', $to->toDateString());

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $raw = $query->select([
            DB::raw("CASE
                WHEN c.status = 'RENEWED' THEN 'RENEWAL'
                WHEN c.payment_cycle = 'ONCE' THEN 'ONE_TIME'
                WHEN c.payment_cycle IN ('MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY') THEN 'RECURRING'
                ELSE 'NEW_CONTRACT'
            END as source"),
            DB::raw('COALESCE(SUM(ps.actual_amount), 0) as amount'),
        ])->groupBy('source')->get();

        $total = $raw->sum('amount');
        $labels = [
            'NEW_CONTRACT' => 'Hợp đồng mới',
            'RENEWAL' => 'Gia hạn',
            'RECURRING' => 'Thu cước định kỳ',
            'ONE_TIME' => 'Thu một lần',
        ];

        $result = [];
        foreach (['NEW_CONTRACT', 'RENEWAL', 'RECURRING', 'ONE_TIME'] as $src) {
            $row = $raw->firstWhere('source', $src);
            $amount = $row ? (float) $row->amount : 0.0;
            $result[] = [
                'source' => $src,
                'label' => $labels[$src],
                'amount' => round($amount, 2),
                'pct' => $total > 0 ? round($amount / $total * 100, 1) : 0.0,
            ];
        }

        return $result;
    }

    // ───────────────────────────────────────────────────
    // Alert generation
    // ───────────────────────────────────────────────────

    private function generateAlerts(array $kpis, array $byPeriod, Carbon $from, Carbon $to): array
    {
        $alerts = [];
        $today = now();

        // Check current period for under-target
        foreach ($byPeriod as $period) {
            $periodEnd = Carbon::parse($period['period_key'] . '-01')->endOfMonth();
            $periodStart = Carbon::parse($period['period_key'] . '-01')->startOfMonth();

            if ($today->between($periodStart, $periodEnd) && $period['target'] > 0) {
                $daysInPeriod = $periodStart->diffInDays($periodEnd);
                $daysPassed = $periodStart->diffInDays($today);
                $progressPct = $daysInPeriod > 0 ? $daysPassed / $daysInPeriod : 0;
                $daysRemaining = max(0, $periodEnd->diffInDays($today));

                if ($period['achievement_pct'] < 60 && $progressPct >= 0.8) {
                    $alerts[] = [
                        'type' => 'UNDER_TARGET',
                        'severity' => 'CRITICAL',
                        'message' => sprintf(
                            'Doanh thu %s đạt %.0f%% kế hoạch (còn %d ngày)',
                            $period['period_label'],
                            $period['achievement_pct'],
                            $daysRemaining
                        ),
                        'context' => [
                            'period_key' => $period['period_key'],
                            'achievement_pct' => $period['achievement_pct'],
                            'gap_amount' => round($period['target'] - $period['total_actual'], 2),
                            'days_remaining' => $daysRemaining,
                        ],
                    ];
                } elseif ($period['achievement_pct'] < 80 && $progressPct >= 0.7) {
                    $alerts[] = [
                        'type' => 'UNDER_TARGET',
                        'severity' => 'WARNING',
                        'message' => sprintf(
                            'Doanh thu %s đạt %.0f%% kế hoạch (còn %d ngày)',
                            $period['period_label'],
                            $period['achievement_pct'],
                            $daysRemaining
                        ),
                        'context' => [
                            'period_key' => $period['period_key'],
                            'achievement_pct' => $period['achievement_pct'],
                            'gap_amount' => round($period['target'] - $period['total_actual'], 2),
                            'days_remaining' => $daysRemaining,
                        ],
                    ];
                }
            }
        }

        // High overdue
        if ($kpis['overdue_amount'] > 0) {
            $alerts[] = [
                'type' => 'HIGH_OVERDUE',
                'severity' => $kpis['overdue_amount'] > 1_000_000_000 ? 'CRITICAL' : 'WARNING',
                'message' => sprintf(
                    'Tổng nợ quá hạn: %s VND',
                    number_format($kpis['overdue_amount'], 0, ',', '.')
                ),
                'context' => [
                    'overdue_amount' => $kpis['overdue_amount'],
                ],
            ];
        }

        // Expiring contracts (next 30 days)
        $expiringCount = $this->countExpiringContracts(30);
        if ($expiringCount > 0) {
            $alerts[] = [
                'type' => 'CONTRACT_EXPIRING',
                'severity' => 'INFO',
                'message' => sprintf(
                    '%d hợp đồng hết hạn trong 30 ngày tới',
                    $expiringCount
                ),
                'context' => [
                    'contract_count' => $expiringCount,
                    'days_range' => 30,
                ],
            ];
        }

        return $alerts;
    }

    private function countExpiringContracts(int $days): int
    {
        if (! $this->support->hasColumn('contracts', 'expiry_date')) {
            return 0;
        }

        return DB::table('contracts')
            ->whereNull('deleted_at')
            ->where('status', 'SIGNED')
            ->whereBetween('expiry_date', [
                now()->toDateString(),
                now()->addDays($days)->toDateString(),
            ])
            ->count();
    }
}
