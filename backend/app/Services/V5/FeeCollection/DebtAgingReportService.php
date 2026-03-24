<?php

namespace App\Services\V5\FeeCollection;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DebtAgingReportService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    // ── Aging Report ──────────────────────────────────────────────────────────

    public function agingReport(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $customerId = $this->support->parseNullableInt($request->input('customer_id'));

        $rows = $this->buildAgingRows($customerId);
        $totals = $this->buildAgingTotals($rows);

        return response()->json([
            'data' => [
                'rows'   => $rows,
                'totals' => $totals,
            ],
        ]);
    }

    // ── Debt By Customer (paginated) ──────────────────────────────────────────

    public function debtByCustomer(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $query = DB::table('invoices')
            ->join('customers', 'customers.id', '=', 'invoices.customer_id')
            ->whereNotIn('invoices.status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('invoices.deleted_at')
            ->whereNull('customers.deleted_at')
            ->whereRaw('invoices.total_amount - invoices.paid_amount > 0')
            ->groupBy('invoices.customer_id', 'customers.customer_name')
            ->selectRaw("
                invoices.customer_id,
                customers.customer_name,
                COUNT(*) as invoice_count,
                COALESCE(SUM(invoices.total_amount - invoices.paid_amount), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN invoices.due_date < CURDATE() AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as overdue_amount
            ");

        if ($q = $request->input('q')) {
            $query->where('customers.customer_name', 'like', '%' . $q . '%');
        }

        [$page, $perPage] = $this->support->resolvePaginationParams($request);
        $total = DB::table(DB::raw("({$query->toSql()}) as sub"))
            ->mergeBindings($query)
            ->count();

        $rows = $query->orderByDesc('total_outstanding')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get()
            ->map(fn ($r) => [
                'customer_id'       => $r->customer_id,
                'customer_name'     => $r->customer_name,
                'invoice_count'     => (int) $r->invoice_count,
                'total_outstanding' => round((float) $r->total_outstanding, 2),
                'overdue_amount'    => round((float) $r->overdue_amount, 2),
            ])->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    // ── Debt Trend ────────────────────────────────────────────────────────────

    public function debtTrend(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $months = max(1, min(24, (int) ($request->input('months') ?? 6)));
        $monthKeyExpr = $this->monthKeyExpression('invoice_date');
        $currentDateExpr = $this->currentDateExpression();

        // For each of the last N months: take all non-terminal invoices as of that month-end
        // Approximation: outstanding = invoices issued up to month-end minus paid in period
        // This is an efficient approach that reads from current DB state grouped by period

        $rows = DB::table('invoices')
            ->whereNotIn('status', ['CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('deleted_at')
            ->selectRaw("
                {$monthKeyExpr} as month_key,
                COALESCE(SUM(total_amount - paid_amount), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN due_date < {$currentDateExpr} AND (total_amount - paid_amount) > 0
                               THEN total_amount - paid_amount ELSE 0 END), 0) as total_overdue
            ")
            ->where('invoice_date', '>=', now()->subMonths($months)->startOfMonth()->toDateString())
            ->groupBy('month_key')
            ->orderBy('month_key')
            ->get();

        $result = $rows->map(function ($r) {
            [$year, $month] = explode('-', $r->month_key);
            return [
                'month_key'         => $r->month_key,
                'month_label'       => 'T' . ltrim($month, '0') . '/' . $year,
                'total_outstanding' => round((float) $r->total_outstanding, 2),
                'total_overdue'     => round((float) $r->total_overdue, 2),
            ];
        })->values();

        return response()->json(['data' => $result]);
    }

    // ── Private: Build aging rows ─────────────────────────────────────────────

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildAgingRows(?int $customerId): array
    {
        $today = now()->toDateString();
        $daysPastDueExpr = $this->dateDiffExpression("'{$today}'", 'invoices.due_date');

        $query = DB::table('invoices')
            ->join('customers', 'customers.id', '=', 'invoices.customer_id')
            ->whereNotIn('invoices.status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('invoices.deleted_at')
            ->whereNull('customers.deleted_at')
            ->whereRaw('invoices.total_amount - invoices.paid_amount > 0')
            ->groupBy('invoices.customer_id', 'customers.customer_name')
            ->selectRaw("
                invoices.customer_id,
                customers.customer_name,
                COALESCE(SUM(CASE WHEN invoices.due_date >= '{$today}' OR (invoices.total_amount - invoices.paid_amount) = 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as current_bucket,
                COALESCE(SUM(CASE WHEN {$daysPastDueExpr} BETWEEN 1  AND 30
                               AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as bucket_1_30,
                COALESCE(SUM(CASE WHEN {$daysPastDueExpr} BETWEEN 31 AND 60
                               AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as bucket_31_60,
                COALESCE(SUM(CASE WHEN {$daysPastDueExpr} BETWEEN 61 AND 90
                               AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as bucket_61_90,
                COALESCE(SUM(CASE WHEN {$daysPastDueExpr} > 90
                               AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as bucket_over_90,
                COALESCE(SUM(invoices.total_amount - invoices.paid_amount), 0) as total_outstanding
            ")
            ->orderByDesc('total_outstanding');

        if ($customerId) {
            $query->where('invoices.customer_id', $customerId);
        }

        return $query->get()->map(fn ($r) => [
            'customer_id'       => $r->customer_id,
            'customer_name'     => $r->customer_name,
            'current_bucket'    => round((float) $r->current_bucket, 2),
            'bucket_1_30'       => round((float) $r->bucket_1_30, 2),
            'bucket_31_60'      => round((float) $r->bucket_31_60, 2),
            'bucket_61_90'      => round((float) $r->bucket_61_90, 2),
            'bucket_over_90'    => round((float) $r->bucket_over_90, 2),
            'total_outstanding' => round((float) $r->total_outstanding, 2),
        ])->values()->toArray();
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, float>
     */
    private function buildAgingTotals(array $rows): array
    {
        $totals = [
            'current'   => 0.0,
            'd1_30'     => 0.0,
            'd31_60'    => 0.0,
            'd61_90'    => 0.0,
            'over_90'   => 0.0,
            'total'     => 0.0,
        ];

        foreach ($rows as $row) {
            $totals['current'] += $row['current_bucket'];
            $totals['d1_30']   += $row['bucket_1_30'];
            $totals['d31_60']  += $row['bucket_31_60'];
            $totals['d61_90']  += $row['bucket_61_90'];
            $totals['over_90'] += $row['bucket_over_90'];
            $totals['total']   += $row['total_outstanding'];
        }

        return array_map(fn ($v) => round($v, 2), $totals);
    }

    private function currentDateExpression(): string
    {
        return DB::getDriverName() === 'sqlite' ? "date('now')" : 'CURDATE()';
    }

    private function monthKeyExpression(string $column): string
    {
        return DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', {$column})"
            : "DATE_FORMAT({$column}, '%Y-%m')";
    }

    private function dateDiffExpression(string $left, string $right): string
    {
        return DB::getDriverName() === 'sqlite'
            ? "CAST(julianday({$left}) - julianday({$right}) AS INTEGER)"
            : "DATEDIFF({$left}, {$right})";
    }
}
