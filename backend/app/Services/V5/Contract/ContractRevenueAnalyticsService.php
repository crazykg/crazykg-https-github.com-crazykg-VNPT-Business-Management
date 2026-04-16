<?php

namespace App\Services\V5\Contract;

use App\Models\Contract;
use App\Models\InternalUser;
use App\Support\Auth\UserAccessService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ContractRevenueAnalyticsService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function analytics(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $validated = $request->validate([
            'period_from' => ['required', 'date'],
            'period_to' => ['required', 'date'],
            'grouping' => ['sometimes', Rule::in(['month', 'quarter'])],
            'contract_id' => ['sometimes', 'integer'],
            'source_mode' => ['sometimes', Rule::in(['PROJECT', 'INITIAL'])],
        ]);

        $periodFrom = Carbon::parse((string) $validated['period_from'])->startOfDay();
        $periodTo = Carbon::parse((string) $validated['period_to'])->startOfDay();
        if ($periodTo->lt($periodFrom)) {
            return response()->json([
                'message' => 'period_to phải lớn hơn hoặc bằng period_from.',
                'errors' => [
                    'period_to' => ['period_to phải lớn hơn hoặc bằng period_from.'],
                ],
            ], 422);
        }

        $grouping = (string) ($validated['grouping'] ?? 'month');
        $contractId = array_key_exists('contract_id', $validated)
            ? $this->support->parseNullableInt($validated['contract_id'])
            : null;
        $sourceMode = array_key_exists('source_mode', $validated)
            ? strtoupper(trim((string) $validated['source_mode']))
            : null;

        $buckets = $this->buildPeriodBuckets($periodFrom, $periodTo, $grouping);
        $empty = [
            'kpis' => [
                'expected_revenue' => 0.0,
                'actual_collected' => 0.0,
                'outstanding' => 0.0,
                'overdue_amount' => 0.0,
                'overdue_count' => 0,
                'carry_over_from_previous' => 0.0,
                'cumulative_collected' => 0.0,
                'collection_rate' => 0,
                'avg_days_to_collect' => 0.0,
                'on_time_rate' => 0,
            ],
            'by_period' => array_values($buckets),
            'by_cycle' => [],
            'by_contract' => [],
            'by_item' => $contractId !== null ? [] : null,
            'overdue_details' => [],
        ];

        if (! $this->hasPaymentScheduleAnalyticsSchema()) {
            if ($contractId !== null) {
                $empty['by_item'] = $this->buildByItem($request, $contractId, 0.0, 0.0, 0.0, $sourceMode);
            }

            return response()->json(['data' => $empty]);
        }

        $periodSchedules = $this->fetchSchedulesInRange($request, $periodFrom, $periodTo, $contractId, $sourceMode);
        $carryOverBeforePeriod = $this->calculateCarryOverBeforePeriod($request, $periodFrom, $contractId, $sourceMode);
        $cumulativeCollected = $this->calculateCumulativeCollectedToDate($request, $periodTo, $contractId, $sourceMode);

        $contracts = [];
        $cycles = [];
        $expectedRevenue = 0.0;
        $actualCollected = 0.0;
        $outstanding = 0.0;
        $overdueAmount = 0.0;
        $overdueCount = 0;
        $daysToCollect = [];
        $onTimeCount = 0;
        $collectableCount = 0;
        $overdueDetails = [];

        foreach ($periodSchedules as $row) {
            $expectedAmount = $this->normalizeMoney($row['expected_amount'] ?? 0);
            $actualAmount = $this->normalizeMoney($row['actual_paid_amount'] ?? 0);
            $remainingAmount = max(0.0, $expectedAmount - $actualAmount);
            $status = strtoupper(trim((string) ($row['status'] ?? 'PENDING')));
            if ($status === 'CANCELLED') {
                continue;
            }

            $periodKey = $this->periodKeyForDate((string) ($row['expected_date'] ?? ''), $grouping);
            if ($periodKey === null || ! array_key_exists($periodKey, $buckets)) {
                continue;
            }

            $buckets[$periodKey]['expected'] += $expectedAmount;
            $buckets[$periodKey]['actual'] += $actualAmount;
            $buckets[$periodKey]['schedule_count'] += 1;
            if ($this->isCollectedSchedule($status, $actualAmount)) {
                $buckets[$periodKey]['paid_count'] += 1;
            }
            if ($status === 'OVERDUE') {
                $buckets[$periodKey]['overdue'] += $remainingAmount;
                $overdueAmount += $remainingAmount;
                $overdueCount += 1;
                $overdueDetails[] = [
                    'schedule_id' => (int) ($row['schedule_id'] ?? 0),
                    'contract_id' => (int) ($row['contract_id'] ?? 0),
                    'contract_code' => (string) ($row['contract_code'] ?? ''),
                    'customer_name' => (string) ($row['customer_name'] ?? ''),
                    'milestone_name' => (string) ($row['milestone_name'] ?? ''),
                    'expected_date' => (string) ($row['expected_date'] ?? ''),
                    'expected_amount' => $expectedAmount,
                    'days_overdue' => $this->calculateDaysOverdue((string) ($row['expected_date'] ?? '')),
                ];
            }

            $expectedRevenue += $expectedAmount;
            $actualCollected += $actualAmount;
            $outstanding += $remainingAmount;

            if ($this->isCollectedSchedule($status, $actualAmount)) {
                $collectableCount += 1;
                $actualPaidDate = trim((string) ($row['actual_paid_date'] ?? ''));
                $expectedDate = trim((string) ($row['expected_date'] ?? ''));
                if ($actualPaidDate !== '' && $expectedDate !== '') {
                    $daysToCollect[] = $this->calculateDateDiffInDays($actualPaidDate, $expectedDate);
                    if ($actualPaidDate <= $expectedDate) {
                        $onTimeCount += 1;
                    }
                }
            }

            $rowContractId = (int) ($row['contract_id'] ?? 0);
            if (! isset($contracts[$rowContractId])) {
                $contracts[$rowContractId] = [
                    'contract_id' => $rowContractId,
                    'contract_code' => (string) ($row['contract_code'] ?? ''),
                    'contract_name' => (string) ($row['contract_name'] ?? ''),
                    'customer_name' => (string) ($row['customer_name'] ?? ''),
                    'payment_cycle' => (string) ($row['payment_cycle'] ?? 'ONCE'),
                    'contract_value' => $this->normalizeMoney($row['contract_value'] ?? 0),
                    'expected_in_period' => 0.0,
                    'actual_in_period' => 0.0,
                    'outstanding' => 0.0,
                    'items' => null,
                ];
            }
            $contracts[$rowContractId]['expected_in_period'] += $expectedAmount;
            $contracts[$rowContractId]['actual_in_period'] += $actualAmount;
            $contracts[$rowContractId]['outstanding'] += $remainingAmount;

            $cycle = strtoupper(trim((string) ($row['payment_cycle'] ?? 'ONCE')));
            if (! isset($cycles[$cycle])) {
                $cycles[$cycle] = [
                    'cycle' => $cycle,
                    'cycle_label' => $this->paymentCycleLabel($cycle),
                    'contract_ids' => [],
                    'expected' => 0.0,
                    'actual' => 0.0,
                ];
            }
            $cycles[$cycle]['contract_ids'][$rowContractId] = true;
            $cycles[$cycle]['expected'] += $expectedAmount;
            $cycles[$cycle]['actual'] += $actualAmount;
        }

        $runningExpected = 0.0;
        $runningActual = 0.0;
        $runningCarryOver = $carryOverBeforePeriod;
        foreach ($buckets as &$bucket) {
            $bucket['expected'] = $this->normalizeMoney($bucket['expected']);
            $bucket['actual'] = $this->normalizeMoney($bucket['actual']);
            $bucket['overdue'] = $this->normalizeMoney($bucket['overdue']);
            $bucket['carry_over'] = $this->normalizeMoney($runningCarryOver);
            $runningExpected += $bucket['expected'];
            $runningActual += $bucket['actual'];
            $bucket['cumulative_expected'] = $this->normalizeMoney($carryOverBeforePeriod + $runningExpected);
            $bucket['cumulative_actual'] = $this->normalizeMoney($runningActual);
            $runningCarryOver = max(0.0, $bucket['cumulative_expected'] - $bucket['cumulative_actual']);
        }
        unset($bucket);

        $byContract = array_values($contracts);
        usort($byContract, function (array $left, array $right): int {
            $outstandingCompare = $right['outstanding'] <=> $left['outstanding'];
            if ($outstandingCompare !== 0) {
                return $outstandingCompare;
            }

            return strcmp((string) $left['contract_code'], (string) $right['contract_code']);
        });

        $byCycle = array_map(function (array $row) use ($expectedRevenue): array {
            return [
                'cycle' => $row['cycle'],
                'cycle_label' => $row['cycle_label'],
                'contract_count' => count($row['contract_ids']),
                'expected' => $this->normalizeMoney($row['expected']),
                'actual' => $this->normalizeMoney($row['actual']),
                'percentage_of_total' => $expectedRevenue > 0
                    ? round(($row['expected'] / $expectedRevenue) * 100, 1)
                    : 0.0,
            ];
        }, array_values($cycles));
        usort($byCycle, fn (array $left, array $right): int => $right['expected'] <=> $left['expected']);

        usort($overdueDetails, fn (array $left, array $right): int => $right['days_overdue'] <=> $left['days_overdue']);

        $contractSummary = null;
        if ($contractId !== null) {
            foreach ($byContract as $row) {
                if ((int) $row['contract_id'] === $contractId) {
                    $contractSummary = $row;
                    break;
                }
            }
        }

        return response()->json([
            'data' => [
                'kpis' => [
                    'expected_revenue' => $this->normalizeMoney($expectedRevenue),
                    'actual_collected' => $this->normalizeMoney($actualCollected),
                    'outstanding' => $this->normalizeMoney($outstanding),
                    'overdue_amount' => $this->normalizeMoney($overdueAmount),
                    'overdue_count' => $overdueCount,
                    'carry_over_from_previous' => $this->normalizeMoney($carryOverBeforePeriod),
                    'cumulative_collected' => $this->normalizeMoney($cumulativeCollected),
                    'collection_rate' => $expectedRevenue > 0
                        ? max(0, min(100, (int) round(($actualCollected / $expectedRevenue) * 100)))
                        : 0,
                    'avg_days_to_collect' => $daysToCollect !== []
                        ? round(array_sum($daysToCollect) / count($daysToCollect), 1)
                        : 0.0,
                    'on_time_rate' => $collectableCount > 0
                        ? max(0, min(100, (int) round(($onTimeCount / $collectableCount) * 100)))
                        : 0,
                ],
                'by_period' => array_values($buckets),
                'by_cycle' => $byCycle,
                'by_contract' => $byContract,
                'by_item' => $contractId !== null
                    ? $this->buildByItem(
                        $request,
                        $contractId,
                        (float) ($contractSummary['expected_in_period'] ?? 0.0),
                        (float) ($contractSummary['actual_in_period'] ?? 0.0),
                        (float) ($contractSummary['outstanding'] ?? 0.0),
                        $sourceMode
                    )
                    : null,
                'overdue_details' => $overdueDetails,
            ],
        ]);
    }

    private function hasPaymentScheduleAnalyticsSchema(): bool
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return false;
        }

        foreach (['contract_id', 'expected_date', 'expected_amount', 'actual_paid_amount', 'status'] as $column) {
            if (! $this->support->hasColumn('payment_schedules', $column)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<string, array{
     *   period_key:string,
     *   period_label:string,
     *   expected:float,
     *   actual:float,
     *   overdue:float,
     *   cumulative_expected:float,
     *   cumulative_actual:float,
     *   carry_over:float,
     *   schedule_count:int,
     *   paid_count:int
     * }>
     */
    private function buildPeriodBuckets(Carbon $periodFrom, Carbon $periodTo, string $grouping): array
    {
        $buckets = [];

        if ($grouping === 'quarter') {
            $cursor = $periodFrom->copy()->firstOfQuarter()->startOfDay();
            $end = $periodTo->copy()->firstOfQuarter()->startOfDay();

            while ($cursor->lte($end)) {
                $periodKey = $this->quarterPeriodKey($cursor);
                $buckets[$periodKey] = [
                    'period_key' => $periodKey,
                    'period_label' => $this->quarterPeriodLabel($cursor),
                    'expected' => 0.0,
                    'actual' => 0.0,
                    'overdue' => 0.0,
                    'cumulative_expected' => 0.0,
                    'cumulative_actual' => 0.0,
                    'carry_over' => 0.0,
                    'schedule_count' => 0,
                    'paid_count' => 0,
                ];

                $cursor->addMonthsNoOverflow(3)->firstOfQuarter()->startOfDay();
            }

            return $buckets;
        }

        $cursor = $periodFrom->copy()->startOfMonth()->startOfDay();
        $end = $periodTo->copy()->startOfMonth()->startOfDay();

        while ($cursor->lte($end)) {
            $periodKey = $cursor->format('Y-m');
            $buckets[$periodKey] = [
                'period_key' => $periodKey,
                'period_label' => sprintf('Tháng %d/%s', (int) $cursor->format('n'), $cursor->format('Y')),
                'expected' => 0.0,
                'actual' => 0.0,
                'overdue' => 0.0,
                'cumulative_expected' => 0.0,
                'cumulative_actual' => 0.0,
                'carry_over' => 0.0,
                'schedule_count' => 0,
                'paid_count' => 0,
            ];

            $cursor->addMonthNoOverflow()->startOfMonth()->startOfDay();
        }

        return $buckets;
    }

    private function periodKeyForDate(string $value, string $grouping): ?string
    {
        try {
            $date = Carbon::parse($value)->startOfDay();
        } catch (\Throwable) {
            return null;
        }

        return $grouping === 'quarter'
            ? $this->quarterPeriodKey($date)
            : $date->format('Y-m');
    }

    private function quarterPeriodKey(Carbon $date): string
    {
        $quarter = intdiv(((int) $date->format('n')) - 1, 3) + 1;

        return $date->format('Y').'-Q'.$quarter;
    }

    private function quarterPeriodLabel(Carbon $date): string
    {
        $quarter = intdiv(((int) $date->format('n')) - 1, 3) + 1;

        return 'Q'.$quarter.'/'.$date->format('Y');
    }

    private function contractCodeExpression(string $alias): string
    {
        if ($this->support->hasColumn('contracts', 'contract_code') && $this->support->hasColumn('contracts', 'contract_number')) {
            return "COALESCE({$alias}.contract_code, {$alias}.contract_number, '')";
        }
        if ($this->support->hasColumn('contracts', 'contract_code')) {
            return "COALESCE({$alias}.contract_code, '')";
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            return "COALESCE({$alias}.contract_number, '')";
        }

        return "''";
    }

    private function contractValueExpression(string $alias): string
    {
        if ($this->support->hasColumn('contracts', 'value') && $this->support->hasColumn('contracts', 'total_value')) {
            return "COALESCE({$alias}.value, {$alias}.total_value, 0)";
        }
        if ($this->support->hasColumn('contracts', 'value')) {
            return "COALESCE({$alias}.value, 0)";
        }
        if ($this->support->hasColumn('contracts', 'total_value')) {
            return "COALESCE({$alias}.total_value, 0)";
        }

        return '0';
    }

    private function scopedContractIdQuery(Request $request, ?int $contractId = null, ?string $sourceMode = null): QueryBuilder
    {
        $query = Contract::query()->select('contracts.id');
        if ($contractId !== null) {
            $query->whereKey($contractId);
        }
        if ($sourceMode === 'PROJECT' && $this->support->hasColumn('contracts', 'project_id')) {
            $query->whereNotNull('contracts.project_id');
        } elseif ($sourceMode === 'INITIAL' && $this->support->hasColumn('contracts', 'project_id')) {
            $query->whereNull('contracts.project_id');
        }
        $this->applyReadScope($request, $query);
        $query->getQuery()->orders = null;

        return $query->toBase();
    }

    private function fetchSchedulesInRange(Request $request, Carbon $periodFrom, Carbon $periodTo, ?int $contractId, ?string $sourceMode): array
    {
        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'c.id', '=', 'ps.contract_id')
            ->whereIn('ps.contract_id', $this->scopedContractIdQuery($request, $contractId, $sourceMode))
            ->whereDate('ps.expected_date', '>=', $periodFrom->toDateString())
            ->whereDate('ps.expected_date', '<=', $periodTo->toDateString())
            ->orderBy('ps.expected_date')
            ->orderBy('ps.id')
            ->select([
                'ps.id as schedule_id',
                'ps.contract_id',
                'ps.milestone_name',
                'ps.expected_date',
                'ps.expected_amount',
                'ps.actual_paid_date',
                'ps.actual_paid_amount',
                'ps.status',
                DB::raw($this->contractCodeExpression('c').' as contract_code'),
                DB::raw($this->support->hasColumn('contracts', 'contract_name') ? "COALESCE(c.contract_name, '') as contract_name" : "'' as contract_name"),
                DB::raw($this->support->hasColumn('contracts', 'payment_cycle') ? "COALESCE(c.payment_cycle, 'ONCE') as payment_cycle" : "'ONCE' as payment_cycle"),
                DB::raw($this->contractValueExpression('c').' as contract_value'),
            ]);

        if ($this->support->hasTable('customers') && $this->support->hasColumn('contracts', 'customer_id')) {
            $query->leftJoin('customers as cust', 'cust.id', '=', 'c.customer_id');
            $query->addSelect(DB::raw(
                $this->support->hasColumn('customers', 'customer_name')
                    ? "COALESCE(cust.customer_name, '') as customer_name"
                    : "'' as customer_name"
            ));
        } else {
            $query->addSelect(DB::raw("'' as customer_name"));
        }

        return $query->get()->map(fn (object $row): array => (array) $row)->all();
    }

    private function calculateCarryOverBeforePeriod(Request $request, Carbon $periodFrom, ?int $contractId, ?string $sourceMode): float
    {
        $query = DB::table('payment_schedules as ps')
            ->whereIn('ps.contract_id', $this->scopedContractIdQuery($request, $contractId, $sourceMode))
            ->whereDate('ps.expected_date', '<', $periodFrom->toDateString())
            ->select(['ps.expected_amount', 'ps.actual_paid_amount', 'ps.status']);

        $carryOver = 0.0;
        foreach ($query->get() as $row) {
            $status = strtoupper(trim((string) ($row->status ?? 'PENDING')));
            if ($status === 'PAID' || $status === 'CANCELLED') {
                continue;
            }
            $expectedAmount = $this->normalizeMoney($row->expected_amount ?? 0);
            $actualAmount = $this->normalizeMoney($row->actual_paid_amount ?? 0);
            $carryOver += max(0.0, $expectedAmount - $actualAmount);
        }

        return $this->normalizeMoney($carryOver);
    }

    private function calculateCumulativeCollectedToDate(Request $request, Carbon $periodTo, ?int $contractId, ?string $sourceMode): float
    {
        if (! $this->support->hasColumn('payment_schedules', 'actual_paid_date')) {
            return 0.0;
        }

        $query = DB::table('payment_schedules as ps')
            ->whereIn('ps.contract_id', $this->scopedContractIdQuery($request, $contractId, $sourceMode))
            ->whereNotNull('ps.actual_paid_date')
            ->whereDate('ps.actual_paid_date', '<=', $periodTo->toDateString())
            ->select(['ps.actual_paid_amount', 'ps.status']);

        $total = 0.0;
        foreach ($query->get() as $row) {
            $status = strtoupper(trim((string) ($row->status ?? 'PENDING')));
            $actualAmount = $this->normalizeMoney($row->actual_paid_amount ?? 0);
            if (! $this->isCollectedSchedule($status, $actualAmount)) {
                continue;
            }
            $total += $actualAmount;
        }

        return $this->normalizeMoney($total);
    }

    /**
     * @return array<int, array<string, float|int|string|null>>
     */
    private function buildByItem(
        Request $request,
        int $contractId,
        float $expectedInPeriod,
        float $actualInPeriod,
        float $outstandingInPeriod,
        ?string $sourceMode = null
    ): array {
        $items = $this->fetchAllocationItems($request, $contractId, $sourceMode);

        if ($items === []) {
            return [];
        }

        $denominator = array_reduce($items, fn (float $carry, array $item): float => $carry + (float) $item['line_total'], 0.0);
        $denominator = max($denominator, 1.0);

        $allocatedExpected = 0.0;
        $allocatedActual = 0.0;
        $allocatedOutstanding = 0.0;

        foreach ($items as $index => $item) {
            $proportion = ((float) $item['line_total']) / $denominator;
            $items[$index]['proportion'] = round($proportion * 100, 1);
            $items[$index]['allocated_expected'] = $this->normalizeMoney(round($expectedInPeriod * $proportion, 0));
            $items[$index]['allocated_actual'] = $this->normalizeMoney(round($actualInPeriod * $proportion, 0));
            $items[$index]['allocated_outstanding'] = $this->normalizeMoney(round($outstandingInPeriod * $proportion, 0));

            $allocatedExpected += (float) $items[$index]['allocated_expected'];
            $allocatedActual += (float) $items[$index]['allocated_actual'];
            $allocatedOutstanding += (float) $items[$index]['allocated_outstanding'];
        }

        $items[0]['allocated_expected'] = $this->normalizeMoney((float) $items[0]['allocated_expected'] + ($expectedInPeriod - $allocatedExpected));
        $items[0]['allocated_actual'] = $this->normalizeMoney((float) $items[0]['allocated_actual'] + ($actualInPeriod - $allocatedActual));
        $items[0]['allocated_outstanding'] = $this->normalizeMoney((float) $items[0]['allocated_outstanding'] + ($outstandingInPeriod - $allocatedOutstanding));

        return $items;
    }

    /**
     * Legacy contracts may not have contract_items yet. For analytics only, fall back to
     * the linked project's project_items so item allocation still renders while data is backfilled.
     *
     * @return array<int, array<string, float|int|string|null>>
     */
    private function fetchAllocationItems(Request $request, int $contractId, ?string $sourceMode = null): array
    {
        $items = $this->fetchContractAllocationItems($request, $contractId, $sourceMode);
        if ($items !== []) {
            return $items;
        }

        return $this->fetchProjectAllocationItems($request, $contractId, $sourceMode);
    }

    /**
     * @return array<int, array<string, float|int|string|null>>
     */
    private function fetchContractAllocationItems(Request $request, int $contractId, ?string $sourceMode = null): array
    {
        if (! $this->support->hasTable('contract_items')) {
            return [];
        }

        foreach (['contract_id', 'product_id'] as $column) {
            if (! $this->support->hasColumn('contract_items', $column)) {
                return [];
            }
        }

        $query = DB::table('contract_items as ci')
            ->where('ci.contract_id', $contractId)
            ->whereIn('ci.contract_id', $this->scopedContractIdQuery($request, $contractId, $sourceMode))
            ->select([
                'ci.product_id',
                DB::raw($this->support->hasColumn('contract_items', 'quantity') ? 'COALESCE(ci.quantity, 0) as quantity' : '0 as quantity'),
                DB::raw($this->support->hasColumn('contract_items', 'unit_price') ? 'COALESCE(ci.unit_price, 0) as unit_price' : '0 as unit_price'),
            ]);

        return $this->mapAllocationRowsWithProducts($query, 'ci');
    }

    /**
     * @return array<int, array<string, float|int|string|null>>
     */
    private function fetchProjectAllocationItems(Request $request, int $contractId, ?string $sourceMode = null): array
    {
        if (! $this->support->hasTable('project_items') || ! $this->support->hasColumn('contracts', 'project_id')) {
            return [];
        }

        foreach (['project_id', 'product_id'] as $column) {
            if (! $this->support->hasColumn('project_items', $column)) {
                return [];
            }
        }

        $projectId = Contract::query()
            ->whereIn('contracts.id', $this->scopedContractIdQuery($request, $contractId, $sourceMode))
            ->whereKey($contractId)
            ->value('project_id');

        $projectId = $this->support->parseNullableInt($projectId);
        if ($projectId === null) {
            return [];
        }

        $query = DB::table('project_items as pi')
            ->where('pi.project_id', $projectId)
            ->select([
                'pi.product_id',
                DB::raw($this->support->hasColumn('project_items', 'quantity') ? 'COALESCE(pi.quantity, 0) as quantity' : '0 as quantity'),
                DB::raw($this->support->hasColumn('project_items', 'unit_price') ? 'COALESCE(pi.unit_price, 0) as unit_price' : '0 as unit_price'),
            ]);

        if ($this->support->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        return $this->mapAllocationRowsWithProducts($query, 'pi');
    }

    /**
     * @return array<int, array<string, float|int|string|null>>
     */
    private function mapAllocationRowsWithProducts(QueryBuilder $query, string $itemAlias): array
    {
        if ($this->support->hasTable('products')) {
            $query->leftJoin('products as p', 'p.id', '=', "{$itemAlias}.product_id");
            $query->addSelect([
                DB::raw($this->support->hasColumn('products', 'product_code') ? "COALESCE(p.product_code, '') as product_code" : "'' as product_code"),
                DB::raw($this->support->hasColumn('products', 'product_name') ? "COALESCE(p.product_name, '') as product_name" : "'' as product_name"),
                DB::raw($this->support->hasColumn('products', 'unit') ? 'p.unit as unit' : 'NULL as unit'),
            ]);
        } else {
            $query->addSelect([DB::raw("'' as product_code"), DB::raw("'' as product_name"), DB::raw('NULL as unit')]);
        }

        return $query
            ->get()
            ->map(function (object $row): array {
                $quantity = $this->normalizeMoney($row->quantity ?? 0);
                $unitPrice = $this->normalizeMoney($row->unit_price ?? 0);

                return [
                    'product_id' => (int) ($row->product_id ?? 0),
                    'product_code' => (string) ($row->product_code ?? ''),
                    'product_name' => (string) ($row->product_name ?? ''),
                    'unit' => $row->unit !== null ? (string) $row->unit : null,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $this->normalizeMoney($quantity * $unitPrice),
                    'proportion' => 0.0,
                    'allocated_expected' => 0.0,
                    'allocated_actual' => 0.0,
                    'allocated_outstanding' => 0.0,
                ];
            })
            ->sortByDesc('line_total')
            ->values()
            ->all();
    }

    private function normalizeMoney(mixed $value): float
    {
        $numeric = is_numeric($value) ? (float) $value : 0.0;
        if (! is_finite($numeric)) {
            return 0.0;
        }

        return round($numeric, 2);
    }

    private function isCollectedSchedule(string $status, float $actualAmount): bool
    {
        return in_array($status, ['PAID', 'PARTIAL'], true) || $actualAmount > 0;
    }

    private function calculateDateDiffInDays(string $dateA, string $dateB): int
    {
        try {
            $actualDate = Carbon::parse($dateA)->startOfDay();
            $expectedDate = Carbon::parse($dateB)->startOfDay();
        } catch (\Throwable) {
            return 0;
        }

        return $expectedDate->diffInDays($actualDate, false);
    }

    private function calculateDaysOverdue(string $expectedDate): int
    {
        try {
            return max(0, Carbon::parse($expectedDate)->startOfDay()->diffInDays(Carbon::today(), false));
        } catch (\Throwable) {
            return 0;
        }
    }

    private function paymentCycleLabel(string $cycle): string
    {
        return match (strtoupper($cycle)) {
            'MONTHLY' => 'Hàng tháng',
            'QUARTERLY' => 'Hàng quý',
            'HALF_YEARLY' => '6 tháng/lần',
            'YEARLY' => 'Hàng năm',
            default => 'Một lần',
        };
    }

    private function applyReadScope(Request $request, Builder $query): void
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof InternalUser) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) $authenticatedUser->id;
        $allowedDeptIds = app(UserAccessService::class)->resolveDepartmentIdsForUser($userId);
        if ($allowedDeptIds === null) {
            return;
        }

        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where(function (Builder $scope) use ($allowedDeptIds, $userId): void {
            $applied = false;

            if ($this->support->hasColumn('contracts', 'dept_id')) {
                $scope->whereIn('contracts.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('contracts', 'department_id')) {
                $scope->whereIn('contracts.department_id', $allowedDeptIds);
                $applied = true;
            } elseif (
                $this->support->hasColumn('contracts', 'project_id')
                && $this->support->hasTable('projects')
            ) {
                if ($this->support->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'contracts.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->support->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'contracts.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if ($this->support->hasColumn('contracts', 'created_by')) {
                if ($applied) {
                    $scope->orWhere('contracts.created_by', $userId);
                } else {
                    $scope->where('contracts.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }
}
