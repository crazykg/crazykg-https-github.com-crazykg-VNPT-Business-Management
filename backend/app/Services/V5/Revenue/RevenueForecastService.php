<?php

namespace App\Services\V5\Revenue;

use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RevenueForecastService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    /**
     * Revenue forecast — upcoming expected revenue from payment_schedules.
     * Optionally enriched with invoice data when fee collection is active.
     *
     * Horizon: 3, 6, or 12 months from today.
     */
    public function forecast(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return $this->support->missingTable('payment_schedules');
        }

        $validated = $request->validate([
            'horizon_months' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'dept_id'        => ['sometimes', 'integer', 'min:0'],
        ]);

        $horizonMonths = (int) ($validated['horizon_months'] ?? 6);
        $deptId = isset($validated['dept_id']) ? (int) $validated['dept_id'] : null;

        $today = now()->toDateString();
        $endDate = now()->addMonths($horizonMonths)->endOfMonth()->toDateString();

        $monthKeyExpr = $this->monthKeyExpression('ps.expected_date');

        // ── Upcoming schedules by month ──────────────────────────────
        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $today)
            ->where('ps.expected_date', '<=', $endDate);

        if ($deptId !== null && $deptId > 0) {
            $query->where('c.dept_id', $deptId);
        }

        $byMonth = (clone $query)
            ->selectRaw("
                {$monthKeyExpr} as month_key,
                COALESCE(SUM(ps.expected_amount), 0) as expected,
                COALESCE(SUM(CASE WHEN ps.status IN ('PAID', 'PARTIAL') THEN ps.actual_paid_amount ELSE 0 END), 0) as confirmed,
                COUNT(ps.id) as schedule_count,
                COUNT(DISTINCT ps.contract_id) as contract_count
            ")
            ->groupBy('month_key')
            ->orderBy('month_key')
            ->get()
            ->map(function ($r) {
                $parts = explode('-', $r->month_key);
                $month = count($parts) === 2 ? ltrim($parts[1], '0') : '?';
                $year  = $parts[0] ?? '?';
                return [
                    'month_key'      => $r->month_key,
                    'month_label'    => 'T' . $month . '/' . $year,
                    'expected'       => round((float) $r->expected, 2),
                    'confirmed'      => round((float) $r->confirmed, 2),
                    'pending'        => round(max((float) $r->expected - (float) $r->confirmed, 0), 2),
                    'schedule_count' => (int) $r->schedule_count,
                    'contract_count' => (int) $r->contract_count,
                ];
            })->values();

        // ── KPIs ─────────────────────────────────────────────────────
        $totalExpected = $byMonth->sum('expected');
        $totalConfirmed = $byMonth->sum('confirmed');
        $totalPending = $byMonth->sum('pending');

        // ── Risk buckets: contracts expiring within horizon ──────────
        $expiringContracts = 0;
        $expiringValue = 0.0;
        if ($this->support->hasColumn('contracts', 'end_date')) {
            $expiring = DB::table('contracts')
                ->whereNull('deleted_at')
                ->where('end_date', '>=', $today)
                ->where('end_date', '<=', $endDate)
                ->whereNotIn('status', ['CANCELLED', 'TERMINATED'])
                ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(contract_value), 0) as val')
                ->first();
            $expiringContracts = (int) ($expiring->cnt ?? 0);
            $expiringValue = round((float) ($expiring->val ?? 0), 2);
        }

        // ── By contract status breakdown ─────────────────────────────
        $byContractStatus = (clone $query)
            ->selectRaw("
                c.status as contract_status,
                COALESCE(SUM(ps.expected_amount), 0) as expected,
                COUNT(DISTINCT c.id) as contract_count
            ")
            ->groupBy('c.status')
            ->orderByDesc('expected')
            ->get()
            ->map(fn ($r) => [
                'contract_status' => $r->contract_status,
                'expected'        => round((float) $r->expected, 2),
                'contract_count'  => (int) $r->contract_count,
                'percentage'      => $totalExpected > 0
                    ? round((float) $r->expected / $totalExpected * 100, 1)
                    : 0.0,
            ])->values();

        return response()->json([
            'data' => [
                'kpis' => [
                    'total_expected'      => round($totalExpected, 2),
                    'total_confirmed'     => round($totalConfirmed, 2),
                    'total_pending'       => round($totalPending, 2),
                    'confirmation_rate'   => $totalExpected > 0
                        ? round($totalConfirmed / $totalExpected * 100, 1)
                        : 0.0,
                    'expiring_contracts'  => $expiringContracts,
                    'expiring_value'      => $expiringValue,
                    'horizon_months'      => $horizonMonths,
                ],
                'by_month'           => $byMonth,
                'by_contract_status' => $byContractStatus,
            ],
        ]);
    }

    private function monthKeyExpression(string $column): string
    {
        return DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', {$column})"
            : "DATE_FORMAT({$column}, '%Y-%m')";
    }
}
