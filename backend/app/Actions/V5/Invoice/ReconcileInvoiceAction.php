<?php

namespace App\Actions\V5\Invoice;

use App\Models\Invoice;
use App\Models\Receipt;
use App\Services\V5\CacheService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\DB;

class ReconcileInvoiceAction
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly CacheService $cache,
    ) {}

    public function execute(Invoice $invoice): Invoice
    {
        if (! $this->support->hasTable('invoices') || ! $this->support->hasTable('receipts')) {
            return $invoice;
        }

        $paidAmount = (float) Receipt::query()
            ->where('invoice_id', $invoice->id)
            ->where('status', 'CONFIRMED')
            ->when(
                $this->support->hasColumn('receipts', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->sum('amount');

        $paidAmount = round(max(0, $paidAmount), 2);
        $status = $this->determineStatus($invoice, $paidAmount);

        Invoice::query()
            ->whereKey($invoice->id)
            ->update([
                'paid_amount' => $paidAmount,
                'status' => $status,
                'updated_at' => now(),
            ]);

        $this->cascadeToPaymentSchedule((int) $invoice->id, $paidAmount, (float) $invoice->total_amount);
        $this->cache->flushTags(['invoices']);
        $this->cache->flushTags(["invoices:{$invoice->id}"]);

        return $invoice->fresh() ?? $invoice;
    }

    private function determineStatus(Invoice $invoice, float $paidAmount): string
    {
        $status = (string) $invoice->status;

        if (in_array($status, ['CANCELLED', 'VOID', 'DRAFT'], true)) {
            return $status;
        }

        if ($paidAmount >= (float) $invoice->total_amount) {
            return 'PAID';
        }

        return $paidAmount > 0 ? 'PARTIAL' : 'ISSUED';
    }

    private function cascadeToPaymentSchedule(int $invoiceId, float $paidAmount, float $totalAmount): void
    {
        if (! $this->support->hasColumn('payment_schedules', 'invoice_id')) {
            return;
        }

        $scheduleStatus = $paidAmount >= $totalAmount ? 'PAID'
            : ($paidAmount > 0 ? 'PARTIAL' : 'INVOICED');

        $query = DB::table('payment_schedules')->where('invoice_id', $invoiceId);

        if ($this->support->hasColumn('payment_schedules', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $query->update([
            'actual_paid_amount' => $paidAmount,
            'status' => $scheduleStatus,
            'updated_at' => now(),
        ]);
    }
}
