<?php

namespace App\Services\V5\FeeCollection;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeeCollectionDashboardService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $request->validate([
            'period_from' => ['required', 'date'],
            'period_to'   => ['required', 'date', 'after_or_equal:period_from'],
        ]);

        $from = $request->input('period_from');
        $to   = $request->input('period_to');

        $kpis        = $this->buildKpis($from, $to);
        $byMonth     = $this->buildByMonth($from, $to);
        $topDebtors  = $this->buildTopDebtors();
        $urgentOverdue = $this->buildUrgentOverdue();

        return response()->json([
            'data' => [
                'kpis'          => $kpis,
                'by_month'      => $byMonth,
                'top_debtors'   => $topDebtors,
                'urgent_overdue'=> $urgentOverdue,
            ],
        ]);
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function buildKpis(string $from, string $to): array
    {
        $currentDateExpr = $this->currentDateExpression();
        $receiptToInvoiceDaysExpr = $this->dateDiffExpression('receipts.receipt_date', 'invoices.invoice_date');

        // === Period-Flow KPIs ===
        // Invoices issued in period
        $periodInvoiced = (float) DB::table('invoices')
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNotIn('status', ['CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('deleted_at')
            ->sum('total_amount');

        // Receipts confirmed in period
        $periodCollected = (float) DB::table('receipts')
            ->whereBetween('receipt_date', [$from, $to])
            ->where('status', 'CONFIRMED')
            ->whereNull('deleted_at')
            ->sum('amount');

        $periodCollected = max(0, $periodCollected); // guard against net-negative from reversals

        $collectionRate = $periodInvoiced > 0
            ? min(100, (int) round($periodCollected / $periodInvoiced * 100))
            : 0;

        // Average days to collect (invoice_date → receipt_date)
        $avgDays = DB::table('receipts')
            ->join('invoices', 'invoices.id', '=', 'receipts.invoice_id')
            ->whereBetween('receipts.receipt_date', [$from, $to])
            ->where('receipts.status', 'CONFIRMED')
            ->whereNull('receipts.deleted_at')
            ->whereNull('invoices.deleted_at')
            ->whereNotNull('receipts.invoice_id')
            ->selectRaw("AVG({$receiptToInvoiceDaysExpr}) as avg_days")
            ->value('avg_days');

        // === Balance KPIs (point-in-time) ===
        $outstandingRow = DB::table('invoices')
            ->whereNotIn('status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('deleted_at')
            ->selectRaw('
                COALESCE(SUM(total_amount - paid_amount), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN due_date < '.$currentDateExpr.' AND (total_amount - paid_amount) > 0 THEN (total_amount - paid_amount) ELSE 0 END), 0) as total_overdue,
                COUNT(CASE WHEN due_date < '.$currentDateExpr.' AND (total_amount - paid_amount) > 0 THEN 1 END) as overdue_count
            ')
            ->first();

        return [
            'expected_revenue'     => round($periodInvoiced, 2),
            'actual_collected'     => round($periodCollected, 2),
            'collection_rate'      => $collectionRate,
            'avg_days_to_collect'  => round((float) ($avgDays ?? 0), 1),
            'outstanding'          => round((float) ($outstandingRow->total_outstanding ?? 0), 2),
            'overdue_amount'       => round((float) ($outstandingRow->total_overdue ?? 0), 2),
            'overdue_count'        => (int) ($outstandingRow->overdue_count ?? 0),
        ];
    }

    // ── By Month ──────────────────────────────────────────────────────────────

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildByMonth(string $from, string $to): array
    {
        $invoiceMonthExpr = $this->monthKeyExpression('invoice_date');
        $receiptMonthExpr = $this->monthKeyExpression('receipt_date');

        // Build list of months in range
        $months   = [];
        $current  = \Carbon\Carbon::parse($from)->startOfMonth();
        $end      = \Carbon\Carbon::parse($to)->startOfMonth();
        while ($current->lte($end)) {
            $months[] = $current->format('Y-m');
            $current->addMonth();
        }

        // Invoiced per month
        $invoicedRows = DB::table('invoices')
            ->whereBetween('invoice_date', [$from, $to])
            ->whereNotIn('status', ['CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('deleted_at')
            ->selectRaw("{$invoiceMonthExpr} as month_key, SUM(total_amount) as invoiced")
            ->groupBy('month_key')
            ->pluck('invoiced', 'month_key');

        // Collected per month
        $collectedRows = DB::table('receipts')
            ->whereBetween('receipt_date', [$from, $to])
            ->where('status', 'CONFIRMED')
            ->whereNull('deleted_at')
            ->selectRaw("{$receiptMonthExpr} as month_key, SUM(amount) as collected")
            ->groupBy('month_key')
            ->pluck('collected', 'month_key');

        // Build result with cumulative totals
        $result             = [];
        $cumulativeInvoiced = 0.0;
        $cumulativeCollected= 0.0;

        foreach ($months as $monthKey) {
            $invoiced  = round((float) ($invoicedRows[$monthKey] ?? 0), 2);
            $collected = round(max(0, (float) ($collectedRows[$monthKey] ?? 0)), 2);

            $cumulativeInvoiced  += $invoiced;
            $cumulativeCollected += $collected;

            [$year, $month] = explode('-', $monthKey);
            $result[] = [
                'month_key'           => $monthKey,
                'month_label'         => 'T' . ltrim($month, '0') . '/' . $year,
                'invoiced'            => $invoiced,
                'collected'           => $collected,
                'outstanding_eom'     => max(0, round($cumulativeInvoiced - $cumulativeCollected, 2)),
                'cumulative_invoiced'  => round($cumulativeInvoiced, 2),
                'cumulative_collected' => round($cumulativeCollected, 2),
            ];
        }

        return $result;
    }

    // ── Top Debtors ───────────────────────────────────────────────────────────

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildTopDebtors(): array
    {
        if (! $this->support->hasTable('customers')) {
            return [];
        }

        $currentDateExpr = $this->currentDateExpression();
        $daysOverdueExpr = $this->dateDiffExpression($currentDateExpr, 'invoices.due_date');

        $rows = DB::table('invoices')
            ->join('customers', 'customers.id', '=', 'invoices.customer_id')
            ->whereNotIn('invoices.status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('invoices.deleted_at')
            ->whereNull('customers.deleted_at')
            ->whereRaw('invoices.total_amount - invoices.paid_amount > 0')
            ->groupBy('invoices.customer_id', 'customers.customer_name')
            ->selectRaw("
                invoices.customer_id,
                customers.customer_name,
                COALESCE(SUM(invoices.total_amount - invoices.paid_amount), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN invoices.due_date < {$currentDateExpr} AND (invoices.total_amount - invoices.paid_amount) > 0
                               THEN invoices.total_amount - invoices.paid_amount ELSE 0 END), 0) as overdue_amount,
                COUNT(*) as invoice_count,
                MAX(CASE WHEN invoices.due_date < {$currentDateExpr} THEN {$daysOverdueExpr} ELSE 0 END) as oldest_overdue_days
            ")
            ->orderByDesc('total_outstanding')
            ->limit(5)
            ->get();

        return $rows->map(fn ($r) => [
            'customer_id'        => $r->customer_id,
            'customer_name'      => $r->customer_name,
            'total_outstanding'  => round((float) $r->total_outstanding, 2),
            'overdue_amount'     => round((float) $r->overdue_amount, 2),
            'invoice_count'      => (int) $r->invoice_count,
            'oldest_overdue_days'=> (int) $r->oldest_overdue_days,
        ])->values()->toArray();
    }

    // ── Urgent Overdue ────────────────────────────────────────────────────────

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildUrgentOverdue(): array
    {
        $currentDateExpr = $this->currentDateExpression();
        $daysOverdueExpr = $this->dateDiffExpression($currentDateExpr, 'invoices.due_date');

        $rows = DB::table('invoices')
            ->join('customers', 'customers.id', '=', 'invoices.customer_id')
            ->whereNotIn('invoices.status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT'])
            ->whereNull('invoices.deleted_at')
            ->whereNull('customers.deleted_at')
            ->where('invoices.due_date', '<', now()->toDateString())
            ->whereRaw('invoices.total_amount - invoices.paid_amount > 0')
            ->selectRaw("
                invoices.id as invoice_id,
                invoices.invoice_code,
                invoices.customer_id,
                customers.customer_name,
                invoices.contract_id,
                invoices.due_date,
                invoices.total_amount - invoices.paid_amount as outstanding,
                {$daysOverdueExpr} as days_overdue
            ")
            ->orderByDesc('days_overdue')
            ->limit(5)
            ->get();

        return $rows->map(fn ($r) => [
            'invoice_id'    => $r->invoice_id,
            'invoice_code'  => $r->invoice_code,
            'customer_id'   => $r->customer_id,
            'customer_name' => $r->customer_name,
            'contract_id'   => $r->contract_id,
            'due_date'      => $r->due_date,
            'outstanding'   => round((float) $r->outstanding, 2),
            'days_overdue'  => (int) $r->days_overdue,
        ])->values()->toArray();
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
