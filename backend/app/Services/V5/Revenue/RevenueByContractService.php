<?php

namespace App\Services\V5\Revenue;

use App\Services\V5\Support\ReadReplicaConnectionResolver;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class RevenueByContractService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly ReadReplicaConnectionResolver $readReplica,
    ) {}

    /**
     * Paginated revenue by contract — drill-down into payment schedules + invoices.
     */
    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules') || ! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('payment_schedules');
        }

        $validated = $request->validate([
            'period_from' => ['required', 'date'],
            'period_to'   => ['required', 'date', 'after_or_equal:period_from'],
            'dept_id'     => ['sometimes', 'integer', 'min:0'],
            'status'      => ['sometimes', 'string'],
            'q'           => ['sometimes', 'string', 'max:200'],
        ]);

        $from = (string) $validated['period_from'];
        $to   = (string) $validated['period_to'];
        $deptId = isset($validated['dept_id']) ? (int) $validated['dept_id'] : null;
        $actualCollectedColumn = $this->actualPaidColumn();

        // Build contract aggregation from payment_schedules in the period
        $query = $this->readReplica->table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->join('customers as cu', 'cu.id', '=', 'c.customer_id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->whereNull('cu.deleted_at')
            ->where('ps.expected_date', '>=', $from)
            ->where('ps.expected_date', '<=', $to)
            ->groupBy(
                'c.id', 'c.contract_code', 'c.contract_name', 'c.status',
                'cu.id', 'cu.customer_name'
            )
            ->selectRaw('
                c.id as contract_id,
                c.contract_code,
                c.contract_name,
                c.status as contract_status,
                cu.id as customer_id,
                cu.customer_name,
                COUNT(ps.id) as schedule_count,
                COALESCE(SUM(ps.expected_amount), 0) as expected_revenue,
                COALESCE(SUM('.$actualCollectedColumn.'), 0) as actual_collected,
                COALESCE(SUM(ps.expected_amount), 0) - COALESCE(SUM('.$actualCollectedColumn.'), 0) as outstanding
            ');

        // Filters
        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        if (isset($validated['status']) && $validated['status'] !== '') {
            $query->where('c.status', (string) $validated['status']);
        }

        if (isset($validated['q']) && $validated['q'] !== '') {
            $like = '%' . $validated['q'] . '%';
            $query->where(function ($sub) use ($like) {
                $sub->where('c.contract_code', 'like', $like)
                    ->orWhere('c.contract_name', 'like', $like)
                    ->orWhere('cu.customer_name', 'like', $like);
            });
        }

        // KPIs (computed before pagination)
        $kpisQuery = clone $query;
        $kpiRow = $this->readReplica->table(DB::raw("({$kpisQuery->toSql()}) as sub"))
            ->mergeBindings($kpisQuery)
            ->selectRaw('
                COUNT(*) as contract_count,
                COALESCE(SUM(expected_revenue), 0) as total_expected,
                COALESCE(SUM(actual_collected), 0) as total_collected,
                COALESCE(SUM(outstanding), 0) as total_outstanding
            ')
            ->first();

        $totalExpected = (float) ($kpiRow->total_expected ?? 0);
        $totalCollected = (float) ($kpiRow->total_collected ?? 0);

        $kpis = [
            'contract_count'     => (int) ($kpiRow->contract_count ?? 0),
            'total_expected'     => round($totalExpected, 2),
            'total_collected'    => round($totalCollected, 2),
            'total_outstanding'  => round(max((float) ($kpiRow->total_outstanding ?? 0), 0), 2),
            'collection_rate'    => $totalExpected > 0
                ? round($totalCollected / $totalExpected * 100, 1)
                : 0.0,
        ];

        // Pagination
        [$page, $perPage] = $this->support->resolvePaginationParams($request);
        $total = $this->readReplica->table(DB::raw("({$query->toSql()}) as cnt"))
            ->mergeBindings($query)
            ->count();

        $sortCol = $request->input('sort_key', 'outstanding');
        $sortDir = $request->input('sort_dir', 'desc') === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['contract_code', 'customer_name', 'expected_revenue', 'actual_collected', 'outstanding'];
        if (! in_array($sortCol, $allowedSorts, true)) {
            $sortCol = 'outstanding';
        }

        $rows = $query->orderBy($sortCol, $sortDir)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(fn ($r) => [
                'contract_id'      => (int) $r->contract_id,
                'contract_code'    => $r->contract_code,
                'contract_name'    => $r->contract_name,
                'contract_status'  => $r->contract_status,
                'customer_id'      => (int) $r->customer_id,
                'customer_name'    => $r->customer_name,
                'schedule_count'   => (int) $r->schedule_count,
                'expected_revenue' => round((float) $r->expected_revenue, 2),
                'actual_collected' => round((float) $r->actual_collected, 2),
                'outstanding'      => round(max((float) $r->outstanding, 0), 2),
                'collection_rate'  => (float) $r->expected_revenue > 0
                    ? round((float) $r->actual_collected / (float) $r->expected_revenue * 100, 1)
                    : 0.0,
            ])->values();

        return response()->json([
            'data' => $rows,
            'meta' => array_merge(
                $this->support->buildPaginationMeta($page, $perPage, $total),
                ['kpis' => $kpis]
            ),
        ]);
    }

    /**
     * Drill-down: payment schedules + linked invoices for a single contract.
     */
    public function detail(Request $request, int $contractId): JsonResponse
    {
        $validated = $request->validate([
            'period_from' => ['required', 'date'],
            'period_to'   => ['required', 'date', 'after_or_equal:period_from'],
        ]);

        $from = (string) $validated['period_from'];
        $to   = (string) $validated['period_to'];
        $actualCollectedColumn = $this->actualPaidColumn();

        $schedules = $this->readReplica->table('payment_schedules as ps')
            ->leftJoin('invoices as inv', 'inv.id', '=', 'ps.invoice_id')
            ->where('ps.contract_id', $contractId)
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from)
            ->where('ps.expected_date', '<=', $to)
            ->select([
                'ps.id as schedule_id',
                'ps.milestone_name',
                'ps.cycle_number',
                'ps.expected_date',
                'ps.expected_amount',
                DB::raw($actualCollectedColumn.' as actual_paid_amount'),
                'ps.actual_paid_date',
                'ps.status as schedule_status',
                'ps.invoice_id',
                'inv.invoice_code',
                'inv.status as invoice_status',
                'inv.total_amount as invoice_total',
                'inv.paid_amount as invoice_paid',
            ])
            ->orderBy('ps.expected_date')
            ->get()
            ->map(fn ($r) => [
                'schedule_id'     => (int) $r->schedule_id,
                'milestone_name'  => $r->milestone_name,
                'cycle_number'    => $r->cycle_number ? (int) $r->cycle_number : null,
                'expected_date'   => $r->expected_date,
                'expected_amount' => round((float) ($r->expected_amount ?? 0), 2),
                'actual_paid_amount'     => round((float) ($r->actual_paid_amount ?? 0), 2),
                'actual_paid_date'=> $r->actual_paid_date,
                'schedule_status' => $r->schedule_status,
                'invoice_id'      => $r->invoice_id ? (int) $r->invoice_id : null,
                'invoice_code'    => $r->invoice_code,
                'invoice_status'  => $r->invoice_status,
                'invoice_total'   => $r->invoice_total ? round((float) $r->invoice_total, 2) : null,
                'invoice_paid'    => $r->invoice_paid ? round((float) $r->invoice_paid, 2) : null,
            ])->values();

        return response()->json(['data' => $schedules]);
    }

    private function actualPaidColumn(string $alias = 'ps'): string
    {
        $connectionName = $this->readReplica->resolvedConnectionName();
        if (Schema::connection($connectionName)->hasColumn('payment_schedules', 'actual_paid_amount')) {
            return "{$alias}.actual_paid_amount";
        }

        if (Schema::connection($connectionName)->hasColumn('payment_schedules', 'actual_amount')) {
            return "{$alias}.actual_amount";
        }

        return '0';
    }
}
