<?php

namespace App\Services\V5\FeeCollection;

use App\Models\Contract;
use App\Models\ContractItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvoiceDomainService
{
    private const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED', 'VOID'];
    private const TERMINAL_STATUSES = ['PAID', 'CANCELLED', 'VOID'];
    private const SORT_MAP = [
        'invoice_code'  => 'invoices.invoice_code',
        'invoice_date'  => 'invoices.invoice_date',
        'due_date'      => 'invoices.due_date',
        'total_amount'  => 'invoices.total_amount',
        'paid_amount'   => 'invoices.paid_amount',
        'status'        => 'invoices.status',
        'created_at'    => 'invoices.created_at',
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    // ── Public scope (shared with dashboard/aging services) ───────────────────

    /**
     * Overdue scope: query-time evaluation, NEVER persisted as status.
     * Use this consistently across ALL endpoints that need overdue filtering.
     */
    public static function overdueScope(Builder $query): Builder
    {
        return $query->where('invoices.due_date', '<', now()->toDateString())
                     ->whereRaw('invoices.total_amount - invoices.paid_amount > 0')
                     ->whereNotIn('invoices.status', ['PAID', 'CANCELLED', 'VOID', 'DRAFT']);
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $query = Invoice::query()
            ->select($this->support->selectColumns('invoices', [
                'id', 'invoice_code', 'invoice_series', 'contract_id', 'customer_id',
                'invoice_date', 'due_date', 'period_from', 'period_to',
                'subtotal', 'vat_rate', 'vat_amount', 'total_amount', 'paid_amount',
                'status', 'notes', 'created_at', 'created_by', 'updated_at',
            ]))
            ->with([
                'customer' => fn ($q) => $q->select($this->support->customerRelationColumns()),
                'contract' => fn ($q) => $q->select(
                    $this->support->selectColumns('contracts', ['id', 'contract_code', 'contract_name'])
                ),
            ]);

        // Search
        if ($q = $request->input('q')) {
            $like = '%' . $q . '%';
            $query->where(function (Builder $sub) use ($like) {
                $sub->where('invoices.invoice_code', 'like', $like)
                    ->orWhereHas('customer', fn ($c) => $c->where('customer_name', 'like', $like))
                    ->orWhereHas('contract', fn ($c) => $c->where('contract_code', 'like', $like));
            });
        }

        // Filters
        if ($status = $request->input('status')) {
            if (in_array($status, self::INVOICE_STATUSES, true)) {
                $query->where('invoices.status', $status);
            }
        }

        if ($customerId = $this->support->parseNullableInt($request->input('customer_id'))) {
            $query->where('invoices.customer_id', $customerId);
        }

        if ($contractId = $this->support->parseNullableInt($request->input('contract_id'))) {
            $query->where('invoices.contract_id', $contractId);
        }

        if ($request->boolean('filter_overdue')) {
            self::overdueScope($query);
        }

        // Date filters — validate format before binding (reject non-date strings)
        $request->validate([
            'invoice_date_from' => ['nullable', 'date'],
            'invoice_date_to'   => ['nullable', 'date'],
            'due_date_from'     => ['nullable', 'date'],
            'due_date_to'       => ['nullable', 'date'],
        ]);

        if ($from = $request->input('invoice_date_from')) {
            $query->where('invoices.invoice_date', '>=', $from);
        }
        if ($to = $request->input('invoice_date_to')) {
            $query->where('invoices.invoice_date', '<=', $to);
        }
        if ($from = $request->input('due_date_from')) {
            $query->where('invoices.due_date', '>=', $from);
        }
        if ($to = $request->input('due_date_to')) {
            $query->where('invoices.due_date', '<=', $to);
        }

        // KPIs (computed on filtered query before pagination)
        $kpis = $this->buildListKpis(clone $query);

        // Sort
        $sortCol = $this->support->resolveSortColumn($request, self::SORT_MAP, 'invoice_date');
        $sortDir = $this->support->resolveSortDirection($request);
        $query->orderBy($sortCol, $sortDir)->orderBy('invoices.id', 'desc');

        // Paginate
        [$page, $perPage] = $this->support->resolvePaginationParams($request);
        $total = (clone $query)->count();
        $rows  = $query->forPage($page, $perPage)->get();

        $data = $rows->map(fn (Invoice $inv) => $this->serializeInvoice($inv))->values();

        return response()->json([
            'data' => $data,
            'meta' => array_merge(
                $this->support->buildPaginationMeta($page, $perPage, $total),
                ['kpis' => $kpis]
            ),
        ]);
    }

    // ── show ──────────────────────────────────────────────────────────────────

    public function show(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $invoice = Invoice::with(['customer', 'contract', 'items.product', 'dunningLogs'])
            ->find($id);

        if (! $invoice) {
            return response()->json(['message' => 'Hóa đơn không tồn tại.'], 404);
        }

        return response()->json(['data' => $this->serializeInvoice($invoice, true)]);
    }

    // ── store ─────────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $data = $request->validate([
            'contract_id'  => ['required', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'customer_id'  => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id'   => ['nullable', 'integer'],
            'invoice_date' => ['required', 'date'],
            'due_date'     => ['required', 'date', 'after_or_equal:invoice_date'],
            'period_from'  => ['nullable', 'date'],
            'period_to'    => ['nullable', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20'],
            'vat_rate'     => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes'        => ['nullable', 'string', 'max:2000'],
            'items'        => ['required', 'array', 'min:1'],
            'items.*.description'        => ['required', 'string', 'max:500'],
            'items.*.quantity'           => ['required', 'numeric', 'min:0'],
            'items.*.unit_price'         => ['required', 'numeric', 'min:0'],
            'items.*.unit'               => ['nullable', 'string', 'max:50'],
            'items.*.vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.product_id'         => ['nullable', 'integer'],
            'items.*.payment_schedule_id'=> ['nullable', 'integer'],
            'items.*.sort_order'         => ['nullable', 'integer'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $invoice = DB::transaction(function () use ($data, $userId, $request) {
            // Generate code
            $code = $this->generateCode('INV');

            // Compute amounts
            ['subtotal' => $subtotal, 'vat_amount' => $vatAmount, 'total' => $total] =
                $this->computeAmounts($data['items'], $data['vat_rate'] ?? null);

            $invoice = Invoice::create([
                'invoice_code'   => $code,
                'invoice_series' => $data['invoice_series'] ?? null,
                'contract_id'    => $data['contract_id'],
                'customer_id'    => $data['customer_id'],
                'project_id'     => $data['project_id'] ?? null,
                'invoice_date'   => $data['invoice_date'],
                'due_date'       => $data['due_date'],
                'period_from'    => $data['period_from'] ?? null,
                'period_to'      => $data['period_to'] ?? null,
                'subtotal'       => $subtotal,
                'vat_rate'       => $data['vat_rate'] ?? null,
                'vat_amount'     => $vatAmount,
                'total_amount'   => $total,
                'paid_amount'    => 0,
                'status'         => 'DRAFT',
                'notes'          => $data['notes'] ?? null,
                'created_by'     => $userId,
                'updated_by'     => $userId,
            ]);

            $this->syncItems($invoice, $data['items'], $userId);

            // Link payment_schedules if provided in items
            $this->linkPaymentSchedules($invoice, $data['items']);

            $this->accessAudit->recordAuditEvent(
                $request, 'INSERT', 'invoices', $invoice->id,
                null, $invoice->getAttributes()
            );

            return $invoice;
        });

        return response()->json(
            ['data' => $this->serializeInvoice($invoice->fresh(['customer', 'contract', 'items']))],
            201
        );
    }

    // ── update ────────────────────────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $invoice = Invoice::find($id);
        if (! $invoice) {
            return response()->json(['message' => 'Hóa đơn không tồn tại.'], 404);
        }

        if (in_array($invoice->status, ['PAID', 'VOID'], true)) {
            return response()->json(['message' => 'Không thể sửa hóa đơn đã thanh toán hoặc đã hủy bỏ.'], 422);
        }

        $data = $request->validate([
            'invoice_date' => ['sometimes', 'date'],
            'due_date'     => ['sometimes', 'date'],
            'period_from'  => ['nullable', 'date'],
            'period_to'    => ['nullable', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20'],
            'vat_rate'     => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes'        => ['nullable', 'string', 'max:2000'],
            'status'       => ['sometimes', 'string', Rule::in(self::INVOICE_STATUSES)],
            'items'        => ['sometimes', 'array', 'min:1'],
            'items.*.description'        => ['required_with:items', 'string', 'max:500'],
            'items.*.quantity'           => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price'         => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit'               => ['nullable', 'string', 'max:50'],
            'items.*.vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.product_id'         => ['nullable', 'integer'],
            'items.*.payment_schedule_id'=> ['nullable', 'integer'],
            'items.*.sort_order'         => ['nullable', 'integer'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $before = $invoice->getAttributes();

        DB::transaction(function () use ($invoice, $data, $userId, $request, $before) {
            if (isset($data['items'])) {
                ['subtotal' => $subtotal, 'vat_amount' => $vatAmount, 'total' => $total] =
                    $this->computeAmounts($data['items'], $data['vat_rate'] ?? $invoice->vat_rate);
                $invoice->subtotal     = $subtotal;
                $invoice->vat_amount   = $vatAmount;
                $invoice->total_amount = $total;
                $this->syncItems($invoice, $data['items'], $userId);
                $this->linkPaymentSchedules($invoice, $data['items']);
            }

            foreach (['invoice_date', 'due_date', 'period_from', 'period_to',
                      'invoice_series', 'vat_rate', 'notes', 'status'] as $field) {
                if (array_key_exists($field, $data)) {
                    $invoice->$field = $data[$field];
                }
            }
            $invoice->updated_by = $userId;
            $invoice->save();

            $this->accessAudit->recordAuditEvent(
                $request, 'UPDATE', 'invoices', $invoice->id,
                $before, $invoice->getAttributes()
            );
        });

        return response()->json(
            ['data' => $this->serializeInvoice($invoice->fresh(['customer', 'contract', 'items']))]
        );
    }

    // ── destroy ───────────────────────────────────────────────────────────────

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $invoice = Invoice::find($id);
        if (! $invoice) {
            return response()->json(['message' => 'Hóa đơn không tồn tại.'], 404);
        }

        if ($invoice->status !== 'DRAFT') {
            return response()->json(['message' => 'Chỉ có thể xóa hóa đơn ở trạng thái DRAFT.'], 422);
        }

        $before = $invoice->getAttributes();

        DB::transaction(function () use ($invoice, $request, $before) {
            $invoice->delete();
            $this->accessAudit->recordAuditEvent(
                $request, 'DELETE', 'invoices', $invoice->id,
                $before, null
            );
        });

        return response()->json(['message' => 'Đã xóa hóa đơn.']);
    }

    // ── bulkGenerate ──────────────────────────────────────────────────────────

    public function bulkGenerate(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('invoices')) {
            return $this->support->missingTable('invoices');
        }

        $data = $request->validate([
            'period_from'    => ['required', 'date'],
            'period_to'      => ['required', 'date', 'after_or_equal:period_from'],
            'contract_ids'   => ['nullable', 'array'],
            'contract_ids.*' => ['integer'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        // Query eligible payment schedules (1 invoice per schedule)
        $schedulesQuery = DB::table('payment_schedules')
            ->join('contracts', 'contracts.id', '=', 'payment_schedules.contract_id')
            ->where('payment_schedules.status', 'PENDING')
            ->whereBetween('payment_schedules.expected_date', [$data['period_from'], $data['period_to']])
            ->whereNull('contracts.deleted_at')
            ->where('contracts.status', 'SIGNED')
            ->select([
                'payment_schedules.id as schedule_id',
                'payment_schedules.contract_id',
                'payment_schedules.expected_date',
                'payment_schedules.expected_amount',
                'payment_schedules.milestone_name',
                'contracts.customer_id',
                'contracts.value as contract_value',
            ]);

        if ($this->support->hasColumn('payment_schedules', 'deleted_at')) {
            $schedulesQuery->whereNull('payment_schedules.deleted_at');
        }

        // Filter by invoice_id IS NULL only if column exists
        if ($this->support->hasColumn('payment_schedules', 'invoice_id')) {
            $schedulesQuery->whereNull('payment_schedules.invoice_id');
        }

        if (! empty($data['contract_ids'])) {
            $schedulesQuery->whereIn('payment_schedules.contract_id', $data['contract_ids']);
        }

        $schedules = $schedulesQuery->get();

        if ($schedules->isEmpty()) {
            return response()->json([
                'data' => ['created_count' => 0, 'invoices' => []],
                'message' => 'Không tìm thấy kỳ thanh toán phù hợp.',
            ]);
        }

        $created = [];

        // Pre-load contract items + products to avoid N+1 inside loop
        $contractIds = $schedules->pluck('contract_id')->unique()->values()->all();
        $allContractItems = ContractItem::with('product')
            ->whereIn('contract_id', $contractIds)
            ->get()
            ->groupBy('contract_id');

        DB::transaction(function () use ($schedules, $userId, $request, &$created, $allContractItems) {
            foreach ($schedules as $schedule) {
                // Use pre-loaded contract items (avoids N+1)
                $contractItems = $allContractItems->get($schedule->contract_id) ?? collect();

                $code = $this->generateCode('INV');

                // Build invoice items from contract items
                $itemsData = $contractItems->map(fn ($ci) => [
                    'product_id'          => $ci->product_id,
                    'description'         => optional($ci->product)->product_name ?? 'Dịch vụ',
                    'unit'                => optional($ci->product)->unit ?? null,
                    'quantity'            => $ci->quantity,
                    'unit_price'          => $ci->unit_price,
                    'vat_rate'            => $ci->vat_rate ?? null,
                    'payment_schedule_id' => $schedule->schedule_id,
                    'sort_order'          => 0,
                ])->toArray();

                // If no contract items, create a single summary line
                if (empty($itemsData)) {
                    $itemsData = [[
                        'product_id'          => null,
                        'description'         => $schedule->milestone_name ?? 'Phí dịch vụ',
                        'unit'                => null,
                        'quantity'            => 1,
                        'unit_price'          => $schedule->expected_amount,
                        'vat_rate'            => null,
                        'payment_schedule_id' => $schedule->schedule_id,
                        'sort_order'          => 0,
                    ]];
                }

                ['subtotal' => $subtotal, 'vat_amount' => $vatAmount, 'total' => $total] =
                    $this->computeAmounts($itemsData, null);

                $invoice = Invoice::create([
                    'invoice_code'  => $code,
                    'contract_id'   => $schedule->contract_id,
                    'customer_id'   => $schedule->customer_id,
                    'invoice_date'  => now()->toDateString(),
                    'due_date'      => $schedule->expected_date,
                    'subtotal'      => $subtotal,
                    'vat_amount'    => $vatAmount,
                    'total_amount'  => $total,
                    'paid_amount'   => 0,
                    'status'        => 'DRAFT',
                    'notes'         => $schedule->milestone_name,
                    'created_by'    => $userId,
                    'updated_by'    => $userId,
                ]);

                $this->syncItems($invoice, $itemsData, $userId);

                // Update schedule: set invoice_id + status = INVOICED
                if ($this->support->hasColumn('payment_schedules', 'invoice_id')) {
                    DB::table('payment_schedules')
                        ->where('id', $schedule->schedule_id)
                        ->update([
                            'invoice_id' => $invoice->id,
                            'status'     => 'INVOICED',
                            'updated_at' => now(),
                        ]);
                } else {
                    DB::table('payment_schedules')
                        ->where('id', $schedule->schedule_id)
                        ->update(['status' => 'INVOICED', 'updated_at' => now()]);
                }

                $this->accessAudit->recordAuditEvent(
                    $request, 'INSERT', 'invoices', $invoice->id,
                    null, $invoice->getAttributes()
                );

                $created[] = $this->serializeInvoice($invoice);
            }
        });

        return response()->json([
            'data' => [
                'created_count' => count($created),
                'invoices'      => $created,
            ],
        ], 201);
    }

    // ── Dunning ───────────────────────────────────────────────────────────────

    public function dunningLogIndex(Request $request, int $invoiceId): JsonResponse
    {
        if (! $this->support->hasTable('dunning_logs')) {
            return response()->json(['data' => []]);
        }

        $invoice = Invoice::find($invoiceId);
        if (! $invoice) {
            return response()->json(['message' => 'Hóa đơn không tồn tại.'], 404);
        }

        $logs = $invoice->dunningLogs()->get()->map(fn ($log) => [
            'id'            => $log->id,
            'invoice_id'    => $log->invoice_id,
            'customer_id'   => $log->customer_id,
            'dunning_level' => $log->dunning_level,
            'sent_at'       => $log->sent_at?->toDateTimeString(),
            'sent_via'      => $log->sent_via,
            'message'       => $log->message,
            'response_note' => $log->response_note,
        ]);

        return response()->json(['data' => $logs]);
    }

    public function dunningLogStore(Request $request, int $invoiceId): JsonResponse
    {
        if (! $this->support->hasTable('dunning_logs')) {
            return response()->json(['message' => 'Tính năng nhắc nợ chưa được cài đặt.'], 503);
        }

        $invoice = Invoice::find($invoiceId);
        if (! $invoice) {
            return response()->json(['message' => 'Hóa đơn không tồn tại.'], 404);
        }

        $data = $request->validate([
            'dunning_level' => ['required', 'integer', 'min:1', 'max:3'],
            'sent_via'      => ['required', Rule::in(['SYSTEM', 'EMAIL', 'MANUAL'])],
            'message'       => ['nullable', 'string', 'max:2000'],
        ]);

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);

        $log = \App\Models\DunningLog::create([
            'invoice_id'    => $invoiceId,
            'customer_id'   => $invoice->customer_id,
            'dunning_level' => $data['dunning_level'],
            'sent_at'       => now(),
            'sent_via'      => $data['sent_via'],
            'message'       => $data['message'] ?? null,
            'created_by'    => $userId,
        ]);

        $this->accessAudit->recordAuditEvent(
            $request, 'INSERT', 'dunning_logs', $log->id,
            null, $log->getAttributes()
        );

        return response()->json(['data' => $log], 201);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Generate unique code with retry on race condition.
     * Pattern: INV-YYYYMM-NNNN or RCP-YYYYMM-NNNN
     */
    public function generateCode(string $prefix): string
    {
        $month = now()->format('Ym');
        $pattern = $prefix . '-' . $month . '-%';
        $table = $prefix === 'INV' ? 'invoices' : 'receipts';
        $codeCol = $prefix === 'INV' ? 'invoice_code' : 'receipt_code';

        $attempts = 0;
        while ($attempts < 3) {
            try {
                return DB::transaction(function () use ($prefix, $month, $pattern, $table, $codeCol) {
                    $query = DB::table($table)
                        ->where($codeCol, 'like', $pattern)
                        ->orderByDesc('id');

                    if (DB::getDriverName() !== 'sqlite') {
                        $query->lockForUpdate();
                    }

                    $lastCode = $query->value($codeCol);
                    $seq = 1;
                    if (is_string($lastCode) && $lastCode !== '') {
                        $parts = explode('-', $lastCode);
                        $seq = ((int) end($parts)) + 1;
                    }

                    return sprintf('%s-%s-%04d', $prefix, $month, $seq);
                });
            } catch (\Exception) {
                $attempts++;
                usleep(50000); // 50ms
            }
        }

        // Fallback: timestamp-based unique code
        return sprintf('%s-%s-%s', $prefix, $month, substr((string) microtime(true), -6, 6));
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array{subtotal: float, vat_amount: float, total: float}
     */
    private function computeAmounts(array $items, ?float $invoiceVatRate): array
    {
        $subtotal  = 0.0;
        $vatAmount = 0.0;

        foreach ($items as $item) {
            $qty   = (float) ($item['quantity'] ?? 1);
            $price = (float) ($item['unit_price'] ?? 0);
            $line  = $qty * $price;
            $vat   = $invoiceVatRate ?? (float) ($item['vat_rate'] ?? 0);
            $subtotal  += $line;
            $vatAmount += $line * $vat / 100;
        }

        return [
            'subtotal'  => round($subtotal, 2),
            'vat_amount' => round($vatAmount, 2),
            'total'     => round($subtotal + $vatAmount, 2),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function syncItems(Invoice $invoice, array $items, ?int $userId): void
    {
        // Hard-delete + re-insert (same pattern as contract_items)
        InvoiceItem::where('invoice_id', $invoice->id)->delete();

        foreach ($items as $idx => $item) {
            InvoiceItem::create([
                'invoice_id'          => $invoice->id,
                'product_id'          => $this->support->parseNullableInt($item['product_id'] ?? null),
                'description'         => $item['description'],
                'unit'                => $item['unit'] ?? null,
                'quantity'            => (float) ($item['quantity'] ?? 1),
                'unit_price'          => (float) ($item['unit_price'] ?? 0),
                'vat_rate'            => isset($item['vat_rate']) ? (float) $item['vat_rate'] : null,
                'payment_schedule_id' => $this->support->parseNullableInt($item['payment_schedule_id'] ?? null),
                'sort_order'          => (int) ($item['sort_order'] ?? $idx),
            ]);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function linkPaymentSchedules(Invoice $invoice, array $items): void
    {
        if (! $this->support->hasColumn('payment_schedules', 'invoice_id')) {
            return;
        }

        $scheduleIds = array_filter(array_column($items, 'payment_schedule_id'));
        if (empty($scheduleIds)) {
            return;
        }

        DB::table('payment_schedules')
            ->whereIn('id', array_unique($scheduleIds))
            ->when(
                $this->support->hasColumn('payment_schedules', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->update(['invoice_id' => $invoice->id, 'status' => 'INVOICED', 'updated_at' => now()]);
    }

    /**
     * @param array<string, mixed> $kpis
     */
    private function buildListKpis(Builder $query): array
    {
        $totals = (clone $query)->selectRaw(
            'COUNT(*) as total_invoices,
             COALESCE(SUM(total_amount),0) as total_amount,
             COALESCE(SUM(paid_amount),0) as total_paid,
             COALESCE(SUM(total_amount - paid_amount),0) as total_outstanding'
        )->first();

        $overdueQuery = (clone $query);
        self::overdueScope($overdueQuery);
        $overdue = $overdueQuery->selectRaw(
            'COUNT(*) as overdue_count, COALESCE(SUM(total_amount - paid_amount),0) as overdue_amount'
        )->first();

        return [
            'total_invoices'    => (int) ($totals->total_invoices ?? 0),
            'total_amount'      => round((float) ($totals->total_amount ?? 0), 2),
            'total_paid'        => round((float) ($totals->total_paid ?? 0), 2),
            'total_outstanding' => round((float) ($totals->total_outstanding ?? 0), 2),
            'overdue_count'     => (int) ($overdue->overdue_count ?? 0),
            'overdue_amount'    => round((float) ($overdue->overdue_amount ?? 0), 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeInvoice(Invoice $invoice, bool $withItems = false): array
    {
        $outstanding = round(($invoice->total_amount ?? 0) - ($invoice->paid_amount ?? 0), 2);
        $isOverdue = ! in_array($invoice->status, self::TERMINAL_STATUSES + ['DRAFT'], true)
            && $invoice->due_date !== null
            && $invoice->due_date < now()->startOfDay()
            && $outstanding > 0;

        $result = [
            'id'             => $invoice->id,
            'invoice_code'   => $invoice->invoice_code,
            'invoice_series' => $invoice->invoice_series,
            'contract_id'    => $invoice->contract_id,
            'customer_id'    => $invoice->customer_id,
            'project_id'     => $invoice->project_id,
            'invoice_date'   => $invoice->invoice_date?->toDateString(),
            'due_date'       => $invoice->due_date?->toDateString(),
            'period_from'    => $invoice->period_from?->toDateString(),
            'period_to'      => $invoice->period_to?->toDateString(),
            'subtotal'       => $invoice->subtotal,
            'vat_rate'       => $invoice->vat_rate,
            'vat_amount'     => $invoice->vat_amount,
            'total_amount'   => $invoice->total_amount,
            'paid_amount'    => $invoice->paid_amount,
            'outstanding'    => $outstanding,
            'status'         => $invoice->status,
            'is_overdue'     => $isOverdue,
            'notes'          => $invoice->notes,
            'created_at'     => $invoice->created_at?->toDateTimeString(),
            'updated_at'     => $invoice->updated_at?->toDateTimeString(),
            'created_by'     => $invoice->created_by,
            'customer_name'  => $invoice->relationLoaded('customer') ? optional($invoice->customer)->customer_name : null,
            'contract_code'  => $invoice->relationLoaded('contract') ? optional($invoice->contract)->contract_code : null,
        ];

        if ($withItems && $invoice->relationLoaded('items')) {
            $result['items'] = $invoice->items->map(fn (InvoiceItem $item) => [
                'id'                  => $item->id,
                'product_id'          => $item->product_id,
                'description'         => $item->description,
                'unit'                => $item->unit,
                'quantity'            => $item->quantity,
                'unit_price'          => $item->unit_price,
                'vat_rate'            => $item->vat_rate,
                'line_total'          => $item->line_total,
                'vat_amount'          => $item->vat_amount,
                'payment_schedule_id' => $item->payment_schedule_id,
                'sort_order'          => $item->sort_order,
                'product_name'        => optional($item->product)->product_name,
            ])->values();
        }

        if ($withItems && $invoice->relationLoaded('dunningLogs')) {
            $result['dunning_logs'] = $invoice->dunningLogs->map(fn ($log) => [
                'id'            => $log->id,
                'dunning_level' => $log->dunning_level,
                'sent_at'       => $log->sent_at?->toDateTimeString(),
                'sent_via'      => $log->sent_via,
                'message'       => $log->message,
                'response_note' => $log->response_note,
            ])->values();
        }

        return $result;
    }
}
