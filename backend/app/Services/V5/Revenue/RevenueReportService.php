<?php

namespace App\Services\V5\Revenue;

use App\Services\V5\Support\ReadReplicaConnectionResolver;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RevenueReportService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly ReadReplicaConnectionResolver $readReplica,
    ) {}

    /**
     * Multi-dimension revenue report.
     * Dimensions: department, customer, product, time.
     */
    public function report(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $validated = $request->validate([
            'period_from' => ['required', 'date'],
            'period_to'   => ['required', 'date', 'after_or_equal:period_from'],
            'dimension'   => ['required', Rule::in(['department', 'customer', 'product', 'time'])],
            'dept_id'     => ['sometimes', 'integer', 'min:0'],
        ]);

        $from    = (string) $validated['period_from'];
        $to      = (string) $validated['period_to'];
        $dimension = (string) $validated['dimension'];
        $deptId  = isset($validated['dept_id']) ? (int) $validated['dept_id'] : null;

        $data = match ($dimension) {
            'department' => $this->byDepartment($from, $to),
            'customer'   => $this->byCustomer($from, $to, $deptId),
            'product'    => $this->byProduct($from, $to, $deptId),
            'time'       => $this->byTime($from, $to, $deptId),
        };

        return response()->json(['data' => $data]);
    }

    // ── By Department ───────────────────────────────────────────────

    private function byDepartment(string $from, string $to): array
    {
        $query = $this->readReplica->table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->leftJoin('departments as d', 'd.id', '=', 'c.dept_id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from)
            ->where('ps.expected_date', '<=', $to)
            ->groupBy('c.dept_id', 'd.department_name')
            ->selectRaw('
                c.dept_id as department_id,
                COALESCE(d.department_name, ?) as department_name,
                COALESCE(SUM(ps.expected_amount), 0) as expected,
                COALESCE(SUM(ps.actual_paid_amount), 0) as collected,
                COUNT(DISTINCT c.id) as contract_count,
                COUNT(ps.id) as schedule_count
            ', ['Chung'])
            ->orderByDesc('expected')
            ->get();

        $totalExpected = $query->sum('expected');

        $rows = $query->map(fn ($r) => [
            'department_id'   => (int) $r->department_id,
            'department_name' => $r->department_name,
            'expected'        => round((float) $r->expected, 2),
            'collected'       => round((float) $r->collected, 2),
            'outstanding'     => round(max((float) $r->expected - (float) $r->collected, 0), 2),
            'collection_rate' => (float) $r->expected > 0
                ? round((float) $r->collected / (float) $r->expected * 100, 1)
                : 0.0,
            'contract_count'  => (int) $r->contract_count,
            'share_pct'       => $totalExpected > 0
                ? round((float) $r->expected / $totalExpected * 100, 1)
                : 0.0,
        ])->values();

        return [
            'dimension' => 'department',
            'rows'      => $rows,
            'totals'    => $this->computeTotals($rows),
        ];
    }

    // ── By Customer ─────────────────────────────────────────────────

    private function byCustomer(string $from, string $to, ?int $deptId): array
    {
        $query = $this->readReplica->table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->join('customers as cu', 'cu.id', '=', 'c.customer_id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->whereNull('cu.deleted_at')
            ->where('ps.expected_date', '>=', $from)
            ->where('ps.expected_date', '<=', $to);

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $results = $query->groupBy('cu.id', 'cu.customer_name')
            ->selectRaw('
                cu.id as customer_id,
                cu.customer_name,
                COALESCE(SUM(ps.expected_amount), 0) as expected,
                COALESCE(SUM(ps.actual_paid_amount), 0) as collected,
                COUNT(DISTINCT c.id) as contract_count
            ')
            ->orderByDesc('expected')
            ->limit(50)
            ->get();

        $totalExpected = $results->sum('expected');

        $rows = $results->map(fn ($r) => [
            'customer_id'     => (int) $r->customer_id,
            'customer_name'   => $r->customer_name,
            'expected'        => round((float) $r->expected, 2),
            'collected'       => round((float) $r->collected, 2),
            'outstanding'     => round(max((float) $r->expected - (float) $r->collected, 0), 2),
            'collection_rate' => (float) $r->expected > 0
                ? round((float) $r->collected / (float) $r->expected * 100, 1)
                : 0.0,
            'contract_count'  => (int) $r->contract_count,
            'share_pct'       => $totalExpected > 0
                ? round((float) $r->expected / $totalExpected * 100, 1)
                : 0.0,
        ])->values();

        return [
            'dimension' => 'customer',
            'rows'      => $rows,
            'totals'    => $this->computeTotals($rows),
        ];
    }

    // ── By Product ──────────────────────────────────────────────────

    private function byProduct(string $from, string $to, ?int $deptId): array
    {
        if (! $this->support->hasTable('contract_items') || ! $this->support->hasTable('products')) {
            return ['dimension' => 'product', 'rows' => [], 'totals' => $this->emptyTotals()];
        }

        $query = $this->readReplica->table('contract_items as ci')
            ->join('contracts as c', 'c.id', '=', 'ci.contract_id')
            ->join('products as p', 'p.id', '=', 'ci.product_id')
            ->whereNull('c.deleted_at')
            ->where('c.start_date', '<=', $to)
            ->where(function ($q) use ($to) {
                $q->whereNull('c.end_date')->orWhere('c.end_date', '>=', $to);
            });

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $results = $query->groupBy('p.id', 'p.product_name')
            ->selectRaw('
                p.id as product_id,
                p.product_name,
                COALESCE(SUM(ci.quantity * ci.unit_price), 0) as contract_value,
                COUNT(DISTINCT c.id) as contract_count
            ')
            ->orderByDesc('contract_value')
            ->limit(50)
            ->get();

        $total = $results->sum('contract_value');

        $rows = $results->map(fn ($r) => [
            'product_id'      => (int) $r->product_id,
            'product_name'    => $r->product_name,
            'contract_value'  => round((float) $r->contract_value, 2),
            'contract_count'  => (int) $r->contract_count,
            'share_pct'       => $total > 0
                ? round((float) $r->contract_value / $total * 100, 1)
                : 0.0,
        ])->values();

        return [
            'dimension' => 'product',
            'rows'      => $rows,
            'totals'    => ['total_value' => round($total, 2), 'contract_count' => $results->sum('contract_count')],
        ];
    }

    // ── By Time (monthly breakdown) ─────────────────────────────────

    private function byTime(string $from, string $to, ?int $deptId): array
    {
        $monthKeyExpr = $this->monthKeyExpression('ps.expected_date');

        $query = $this->readReplica->table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $from)
            ->where('ps.expected_date', '<=', $to);

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $results = $query->selectRaw("
                {$monthKeyExpr} as month_key,
                COALESCE(SUM(ps.expected_amount), 0) as expected,
                COALESCE(SUM(ps.actual_paid_amount), 0) as collected,
                COUNT(DISTINCT c.id) as contract_count,
                COUNT(ps.id) as schedule_count
            ")
            ->groupBy('month_key')
            ->orderBy('month_key')
            ->get();

        $cumExpected = 0.0;
        $cumCollected = 0.0;

        $rows = $results->map(function ($r) use (&$cumExpected, &$cumCollected) {
            $parts = explode('-', $r->month_key);
            $month = count($parts) === 2 ? ltrim($parts[1], '0') : '?';
            $year  = $parts[0] ?? '?';

            $expected = (float) $r->expected;
            $collected = (float) $r->collected;
            $cumExpected += $expected;
            $cumCollected += $collected;

            return [
                'month_key'            => $r->month_key,
                'month_label'          => 'T' . $month . '/' . $year,
                'expected'             => round($expected, 2),
                'collected'            => round($collected, 2),
                'outstanding'          => round(max($expected - $collected, 0), 2),
                'cumulative_expected'  => round($cumExpected, 2),
                'cumulative_collected' => round($cumCollected, 2),
                'collection_rate'      => $expected > 0
                    ? round($collected / $expected * 100, 1)
                    : 0.0,
                'contract_count'       => (int) $r->contract_count,
            ];
        })->values();

        return [
            'dimension' => 'time',
            'rows'      => $rows,
            'totals'    => [
                'total_expected'  => round($cumExpected, 2),
                'total_collected' => round($cumCollected, 2),
                'total_outstanding' => round(max($cumExpected - $cumCollected, 0), 2),
                'collection_rate' => $cumExpected > 0
                    ? round($cumCollected / $cumExpected * 100, 1)
                    : 0.0,
            ],
        ];
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private function computeTotals($rows): array
    {
        $e = $rows->sum('expected');
        $c = $rows->sum('collected');
        return [
            'total_expected'    => round($e, 2),
            'total_collected'   => round($c, 2),
            'total_outstanding' => round(max($e - $c, 0), 2),
            'collection_rate'   => $e > 0 ? round($c / $e * 100, 1) : 0.0,
        ];
    }

    private function emptyTotals(): array
    {
        return ['total_expected' => 0, 'total_collected' => 0, 'total_outstanding' => 0, 'collection_rate' => 0];
    }

    private function monthKeyExpression(string $column): string
    {
        return $this->readReplica->driverName() === 'sqlite'
            ? "strftime('%Y-%m', {$column})"
            : "DATE_FORMAT({$column}, '%Y-%m')";
    }
}
