<?php

namespace App\Services\V5\FeeCollection;

use App\Actions\V5\Invoice\ReconcileInvoiceAction;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Receipt;
use App\Services\V5\CacheService;
use App\Services\V5\Realtime\DashboardRealtimeNotifier;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReceiptDomainService
{
    use ResolvesValidatedInput;

    private const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'ONLINE', 'OFFSET', 'OTHER'];
    private const SORT_MAP = [
        'receipt_code'  => 'receipts.receipt_code',
        'receipt_date'  => 'receipts.receipt_date',
        'amount'        => 'receipts.amount',
        'status'        => 'receipts.status',
        'created_at'    => 'receipts.created_at',
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CacheService $cache,
        private readonly InvoiceDomainService $invoiceService,
        private readonly ReconcileInvoiceAction $reconcileInvoiceAction,
        private readonly DashboardRealtimeNotifier $realtimeNotifier,
    ) {}

    private function flushRelatedDashboardCaches(?int $actorId = null, string $reason = 'receipt.updated'): void
    {
        $this->cache->flushTags(['fee-collection-dashboard']);
        $this->cache->flushTags(['revenue-overview']);
        $this->realtimeNotifier->notify(['fee_collection', 'revenue'], $actorId, $reason);
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $query = Receipt::query()
            ->select($this->support->selectColumns('receipts', [
                'id', 'receipt_code', 'invoice_id', 'contract_id', 'customer_id',
                'receipt_date', 'amount', 'payment_method', 'bank_name', 'bank_account',
                'transaction_ref', 'status', 'is_reversed', 'is_reversal_offset',
                'original_receipt_id', 'notes', 'confirmed_by', 'confirmed_at',
                'created_at', 'created_by',
            ]))
            ->with([
                'customer' => fn ($q) => $q->select($this->support->customerRelationColumns()),
                'invoice'  => fn ($q) => $q->select(
                    $this->support->selectColumns('invoices', ['id', 'invoice_code'])
                ),
                'contract' => fn ($q) => $q->select(
                    $this->support->selectColumns('contracts', ['id', 'contract_code'])
                ),
            ]);

        // Search
        if ($q = $request->input('q')) {
            $like = '%' . $q . '%';
            $query->where(function (Builder $sub) use ($like) {
                $sub->where('receipts.receipt_code', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('customer_name', 'like', $like))
                    ->orWhere('receipts.transaction_ref', 'like', $like);
            });
        }

        // Filters
        if ($invoiceId = $this->support->parseNullableInt($request->input('invoice_id'))) {
            $query->where('receipts.invoice_id', $invoiceId);
        }
        if ($customerId = $this->support->parseNullableInt($request->input('customer_id'))) {
            $query->where('receipts.customer_id', $customerId);
        }
        if ($method = $request->input('payment_method')) {
            if (in_array($method, self::PAYMENT_METHODS, true)) {
                $query->where('receipts.payment_method', $method);
            }
        }
        // Date filters — validate format before binding
        $request->validate([
            'receipt_date_from' => ['nullable', 'date'],
            'receipt_date_to'   => ['nullable', 'date'],
        ]);

        if ($from = $request->input('receipt_date_from')) {
            $query->where('receipts.receipt_date', '>=', $from);
        }
        if ($to = $request->input('receipt_date_to')) {
            $query->where('receipts.receipt_date', '<=', $to);
        }

        // Sort + paginate
        $sortCol = $this->support->resolveSortColumn($request, self::SORT_MAP, 'receipt_date');
        $sortDir = $this->support->resolveSortDirection($request);
        $query->orderBy($sortCol, $sortDir)->orderBy('receipts.id', 'desc');

        [$page, $perPage] = $this->support->resolvePaginationParams($request);
        $total = (clone $query)->count();
        $rows  = $query->forPage($page, $perPage)->get();

        $data = $rows->map(fn (Receipt $r) => $this->serializeReceipt($r))->values();

        return response()->json([
            'data' => $data,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    // ── show ──────────────────────────────────────────────────────────────────

    public function show(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $receipt = Receipt::with(['customer', 'invoice', 'contract', 'confirmedBy'])->find($id);
        if (! $receipt) {
            return response()->json(['message' => 'Phiếu thu không tồn tại.'], 404);
        }

        return response()->json(['data' => $this->serializeReceipt($receipt)]);
    }

    // ── store ─────────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $data = $this->validatedInput($request);
        $scopeError = $this->authorizeReceiptLinkageScope(
            $request,
            $this->support->parseNullableInt($data['invoice_id'] ?? null),
            $this->support->parseNullableInt($data['contract_id'] ?? null),
            'phiếu thu'
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $receipt = DB::transaction(function () use ($data, $userId, $request) {
            $code = $this->invoiceService->generateCode('RCP');

            $receipt = Receipt::create([
                'receipt_code'    => $code,
                'invoice_id'      => $this->support->parseNullableInt($data['invoice_id'] ?? null),
                'contract_id'     => $data['contract_id'],
                'customer_id'     => $data['customer_id'],
                'receipt_date'    => $data['receipt_date'],
                'amount'          => (float) $data['amount'],
                'payment_method'  => $data['payment_method'],
                'bank_name'       => $data['bank_name'] ?? null,
                'bank_account'    => $data['bank_account'] ?? null,
                'transaction_ref' => $data['transaction_ref'] ?? null,
                'status'          => $data['status'] ?? 'CONFIRMED',
                'notes'           => $data['notes'] ?? null,
                'confirmed_by'    => $userId,
                'confirmed_at'    => now(),
                'created_by'      => $userId,
                'updated_by'      => $userId,
            ]);

            // Reconcile invoice if linked
            if ($receipt->invoice_id) {
                $this->reconcileInvoice((int) $receipt->invoice_id);
            }

            $this->accessAudit->recordAuditEvent(
                $request, 'INSERT', 'receipts', $receipt->id,
                null, $receipt->getAttributes()
            );

            return $receipt;
        });

        $this->invoiceService->flushListCache();
        $this->flushRelatedDashboardCaches($userId, 'receipt.created');

        return response()->json(
            ['data' => $this->serializeReceipt($receipt->fresh(['customer', 'invoice', 'contract']))],
            201
        );
    }

    // ── update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $receipt = Receipt::find($id);
        if (! $receipt) {
            return response()->json(['message' => 'Phiếu thu không tồn tại.'], 404);
        }

        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $receipt, 'phiếu thu');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($receipt->status === 'REJECTED') {
            return response()->json(['message' => 'Không thể sửa phiếu thu đã bị từ chối.'], 422);
        }

        $data = $this->validatedInput($request);
        if (array_key_exists('invoice_id', $data)) {
            $scopeError = $this->authorizeReceiptLinkageScope(
                $request,
                $this->support->parseNullableInt($data['invoice_id']),
                $this->support->parseNullableInt($receipt->contract_id),
                'phiếu thu'
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }

        $userId       = $this->accessAudit->resolveAuthenticatedUserId($request);
        $before       = $receipt->getAttributes();
        $oldInvoiceId = $receipt->invoice_id;

        DB::transaction(function () use ($receipt, $data, $userId, $request, $before, $oldInvoiceId) {
            foreach (['receipt_date', 'amount', 'payment_method', 'bank_name', 'bank_account',
                      'transaction_ref', 'notes', 'status'] as $field) {
                if (array_key_exists($field, $data)) {
                    $receipt->$field = $data[$field];
                }
            }

            if (array_key_exists('invoice_id', $data)) {
                $receipt->invoice_id = $this->support->parseNullableInt($data['invoice_id']);
            }

            $receipt->updated_by = $userId;
            $receipt->save();

            // Reconcile old invoice if invoice_id changed
            if ($oldInvoiceId && $oldInvoiceId !== $receipt->invoice_id) {
                $this->reconcileInvoice((int) $oldInvoiceId);
            }
            // Reconcile new invoice
            if ($receipt->invoice_id) {
                $this->reconcileInvoice((int) $receipt->invoice_id);
            }

            $this->accessAudit->recordAuditEvent(
                $request, 'UPDATE', 'receipts', $receipt->id,
                $before, $receipt->getAttributes()
            );
        });

        $this->invoiceService->flushListCache();
        $this->flushRelatedDashboardCaches($userId, 'receipt.updated');

        return response()->json(
            ['data' => $this->serializeReceipt($receipt->fresh(['customer', 'invoice', 'contract']))]
        );
    }

    // ── destroy ───────────────────────────────────────────────────────────────

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $receipt = Receipt::find($id);
        if (! $receipt) {
            return response()->json(['message' => 'Phiếu thu không tồn tại.'], 404);
        }

        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $receipt, 'phiếu thu');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $before    = $receipt->getAttributes();
        $invoiceId = $receipt->invoice_id;

        DB::transaction(function () use ($receipt, $request, $before, $invoiceId) {
            $receipt->delete();

            // Reconcile invoice: deleted receipt excluded from SUM (WHERE deleted_at IS NULL)
            if ($invoiceId) {
                $this->reconcileInvoice((int) $invoiceId);
            }

            $this->accessAudit->recordAuditEvent(
                $request, 'DELETE', 'receipts', $receipt->id,
                $before, null
            );
        });

        $this->invoiceService->flushListCache();
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $this->flushRelatedDashboardCaches($actorId, 'receipt.deleted');

        return response()->json(['message' => 'Đã xóa phiếu thu.']);
    }

    // ── reverse ───────────────────────────────────────────────────────────────

    public function reverse(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('receipts')) {
            return $this->support->missingTable('receipts');
        }

        $receipt = Receipt::find($id);
        if (! $receipt) {
            return response()->json(['message' => 'Phiếu thu không tồn tại.'], 404);
        }

        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $receipt, 'phiếu thu');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($receipt->status !== 'CONFIRMED') {
            return response()->json(['message' => 'Chỉ có thể đảo phiếu thu đã được xác nhận.'], 422);
        }
        if ($receipt->is_reversed) {
            return response()->json(['message' => 'Phiếu thu này đã bị đảo trước đó.'], 422);
        }

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $offsetReceipt = DB::transaction(function () use ($receipt, $userId, $request) {
            // Mark original as reversed (status stays CONFIRMED)
            $receipt->is_reversed = true;
            $receipt->save();

            // Create negative offset entry
            $code = $this->invoiceService->generateCode('RCP');
            $offset = Receipt::create([
                'receipt_code'       => $code,
                'invoice_id'         => $receipt->invoice_id,
                'contract_id'        => $receipt->contract_id,
                'customer_id'        => $receipt->customer_id,
                'receipt_date'       => now()->toDateString(),
                'amount'             => -abs($receipt->amount), // negative amount
                'payment_method'     => $receipt->payment_method,
                'status'             => 'CONFIRMED',
                'notes'              => 'Đảo phiếu ' . $receipt->receipt_code,
                'is_reversal_offset' => true,
                'original_receipt_id'=> $receipt->id,
                'confirmed_by'       => $userId,
                'confirmed_at'       => now(),
                'created_by'         => $userId,
                'updated_by'         => $userId,
            ]);

            // Reconcile invoice: (+amount) + (-amount) = net 0
            if ($receipt->invoice_id) {
                $this->reconcileInvoice((int) $receipt->invoice_id);
            }

            $this->accessAudit->recordAuditEvent(
                $request, 'UPDATE', 'receipts', $receipt->id,
                ['is_reversed' => false], ['is_reversed' => true]
            );
            $this->accessAudit->recordAuditEvent(
                $request, 'INSERT', 'receipts', $offset->id,
                null, $offset->getAttributes()
            );

            return $offset;
        });

        $this->invoiceService->flushListCache();
        $this->flushRelatedDashboardCaches($userId, 'receipt.reversed');

        return response()->json(
            ['data' => $this->serializeReceipt($offsetReceipt->fresh(['customer', 'invoice', 'contract']))],
            201
        );
    }

    // ── reconcileInvoice ──────────────────────────────────────────────────────

    /**
     * Recalculate invoice.paid_amount from SUM of CONFIRMED receipts.
     * Source of truth: always recalculate (never increment/decrement) → idempotent.
     *
     * Status set by this method: PAID | PARTIAL | ISSUED (never OVERDUE — that is query-time only)
     */
    public function reconcileInvoice(int $invoiceId): void
    {
        if (! $this->support->hasTable('invoices') || ! $this->support->hasTable('receipts')) {
            return;
        }

        $invoice = Invoice::find($invoiceId);
        if (! $invoice) {
            return;
        }

        $this->reconcileInvoiceAction->execute($invoice);
    }

    // ── batchReconcileInvoices ────────────────────────────────────────────────

    /**
     * Reconcile multiple invoices, deduplicating IDs first.
     * Use instead of calling reconcileInvoice() in a loop when processing
     * multiple receipts (e.g. bulk import, batch operations) to avoid
     * O(n) redundant reconciliations for the same invoice.
     *
     * @param array<int> $invoiceIds
     */
    public function batchReconcileInvoices(array $invoiceIds): void
    {
        $uniqueIds = array_values(array_unique(array_filter($invoiceIds)));
        foreach ($uniqueIds as $id) {
            $this->reconcileInvoice((int) $id);
        }
    }

    // ── Serializer ────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function serializeReceipt(Receipt $r): array
    {
        return [
            'id'                  => $r->id,
            'receipt_code'        => $r->receipt_code,
            'invoice_id'          => $r->invoice_id,
            'contract_id'         => $r->contract_id,
            'customer_id'         => $r->customer_id,
            'receipt_date'        => $r->receipt_date?->toDateString(),
            'amount'              => $r->amount,
            'payment_method'      => $r->payment_method,
            'bank_name'           => $r->bank_name,
            'bank_account'        => $r->bank_account,
            'transaction_ref'     => $r->transaction_ref,
            'status'              => $r->status,
            'is_reversed'         => (bool) $r->is_reversed,
            'is_reversal_offset'  => (bool) $r->is_reversal_offset,
            'original_receipt_id' => $r->original_receipt_id,
            'notes'               => $r->notes,
            'confirmed_at'        => $r->confirmed_at?->toDateTimeString(),
            'confirmed_by'        => $r->confirmed_by,
            'created_at'          => $r->created_at?->toDateTimeString(),
            'created_by'          => $r->created_by,
            'invoice_code'        => $r->relationLoaded('invoice') ? optional($r->invoice)->invoice_code : null,
            'contract_code'       => $r->relationLoaded('contract') ? optional($r->contract)->contract_code : null,
            'customer_name'       => $r->relationLoaded('customer') ? optional($r->customer)->customer_name : null,
        ];
    }

    private function authorizeReceiptLinkageScope(Request $request, ?int $invoiceId, ?int $contractId, string $resource): ?JsonResponse
    {
        if ($invoiceId !== null) {
            $invoice = Invoice::query()->find($invoiceId);
            if ($invoice instanceof Invoice) {
                return $this->accessAudit->assertModelMutationAccess($request, $invoice, $resource);
            }
        }

        if ($contractId !== null) {
            $contract = Contract::query()->find($contractId);
            if ($contract instanceof Contract) {
                return $this->accessAudit->authorizeTableMutationAccess(
                    $request,
                    $resource,
                    'contracts',
                    $contract->getAttributes()
                );
            }
        }

        return null;
    }
}
