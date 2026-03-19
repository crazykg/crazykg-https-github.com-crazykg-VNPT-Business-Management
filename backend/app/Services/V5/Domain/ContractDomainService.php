<?php

namespace App\Services\V5\Domain;

use App\Models\Contract;
use App\Models\ContractItem;
use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Project;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ContractDomainService
{
    /**
     * @var array<int, string>
     */
    private const CONTRACT_STATUSES = ['DRAFT', 'SIGNED', 'RENEWED'];

    /**
     * @var array<int, string>
     */
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    /**
     * @var array<int, string>
     */
    private const CONTRACT_TERM_UNITS = ['MONTH', 'DAY'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $query = Contract::query()
            ->with([
                'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
                'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
            ])
            ->select($this->support->selectColumns('contracts', [
                'id',
                'contract_code',
                'contract_number',
                'contract_name',
                'customer_id',
                'project_id',
                'value',
                'total_value',
                'payment_cycle',
                'sign_date',
                'effective_date',
                'expiry_date',
                'term_unit',
                'term_value',
                'expiry_date_manual_override',
                'status',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['contract_code', 'contract_number', 'contract_name'] as $column) {
                    if ($this->support->hasColumn('contracts', $column)) {
                        $builder->orWhere("contracts.{$column}", 'like', $like);
                    }
                }

                $canSearchCustomer = $this->support->hasTable('customers')
                    && ($this->support->hasColumn('customers', 'customer_code') || $this->support->hasColumn('customers', 'customer_name'));
                if ($canSearchCustomer) {
                    $builder->orWhereHas('customer', function ($customerQuery) use ($like): void {
                        $customerQuery->where(function ($customerFilter) use ($like): void {
                            if ($this->support->hasColumn('customers', 'customer_code')) {
                                $customerFilter->orWhere('customer_code', 'like', $like);
                            }
                            if ($this->support->hasColumn('customers', 'customer_name')) {
                                $customerFilter->orWhere('customer_name', 'like', $like);
                            }
                        });
                    });
                }

                $canSearchProject = $this->support->hasTable('projects')
                    && ($this->support->hasColumn('projects', 'project_code') || $this->support->hasColumn('projects', 'project_name'));
                if ($canSearchProject) {
                    $builder->orWhereHas('project', function ($projectQuery) use ($like): void {
                        $projectQuery->where(function ($projectFilter) use ($like): void {
                            if ($this->support->hasColumn('projects', 'project_code')) {
                                $projectFilter->orWhere('project_code', 'like', $like);
                            }
                            if ($this->support->hasColumn('projects', 'project_name')) {
                                $projectFilter->orWhere('project_name', 'like', $like);
                            }
                        });
                    });
                }
            });
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::CONTRACT_STATUSES, true) && $this->support->hasColumn('contracts', 'status')) {
            $query->where('contracts.status', $status);
        }

        $customerId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->support->hasColumn('contracts', 'customer_id')) {
            $query->where('contracts.customer_id', $customerId);
        }

        $projectId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'project_id'));
        if ($projectId !== null && $this->support->hasColumn('contracts', 'project_id')) {
            $query->where('contracts.project_id', $projectId);
        }

        $this->applyReadScope($request, $query);
        $kpis = $this->buildContractKpis($query);

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'contracts.id',
            'contract_code' => 'contracts.contract_code',
            'contract_name' => 'contracts.contract_name',
            'status' => 'contracts.status',
            'value' => 'contracts.value',
            'sign_date' => 'contracts.sign_date',
            'effective_date' => 'contracts.effective_date',
            'expiry_date' => 'contracts.expiry_date',
            'created_at' => 'contracts.created_at',
        ], 'contracts.id');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'contracts.id' && $this->support->hasColumn('contracts', 'id')) {
            $query->orderBy('contracts.id', 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Contract $contract): array => $this->support->serializeContract($contract))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => array_merge(
                        $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                        ['kpis' => $kpis]
                    ),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Contract $contract): array => $this->support->serializeContract($contract))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => array_merge(
                    $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
                    ['kpis' => $kpis]
                ),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Contract $contract): array => $this->support->serializeContract($contract))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => array_merge(
                $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
                ['kpis' => $kpis]
            ),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $query = Contract::query()
            ->with($this->contractRelationsWithItems())
            ->whereKey($id);

        $this->applyReadScope($request, $query);
        $contract = $query->firstOrFail();

        return response()->json([
            'data' => $this->support->serializeContract($contract),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $rules = [
            'contract_code' => ['required', 'string', 'max:100'],
            'contract_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['nullable', 'date'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'term_unit' => ['nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
            'data_scope' => ['nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];

        if ($this->support->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code');
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number');
        }

        $validated = $request->validate($rules);

        $projectId = $this->support->parseNullableInt($validated['project_id'] ?? null);
        if ($projectId !== null && ! Project::query()->whereKey($projectId)->exists()) {
            return response()->json(['message' => 'project_id is invalid.'], 422);
        }

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $resolvedStatus = $this->normalizeContractStatus($validated['status'] ?? 'DRAFT');
        $resolvedSignDate = $validated['sign_date'] ?? null;
        $resolvedEffectiveDate = $validated['effective_date'] ?? null;
        $resolvedExpiryDate = $validated['expiry_date'] ?? null;
        $resolvedTermUnit = $this->normalizeContractTermUnit($validated['term_unit'] ?? null);
        $resolvedTermValue = array_key_exists('term_value', $validated)
            ? $this->parseNullableFloat($validated['term_value'])
            : null;
        $manualExpiryOverride = (bool) ($validated['expiry_date_manual_override'] ?? false);

        $termValidationError = $this->validateContractTermState(
            $resolvedTermUnit,
            $resolvedTermValue,
            $manualExpiryOverride,
            $resolvedExpiryDate
        );
        if ($termValidationError instanceof JsonResponse) {
            return $termValidationError;
        }

        if (! $manualExpiryOverride) {
            $resolvedExpiryDate = $this->resolveContractExpiryDateFromTerm(
                $resolvedTermUnit,
                $resolvedTermValue,
                $resolvedEffectiveDate,
                $resolvedSignDate
            ) ?? $resolvedExpiryDate;
        }

        $requiredDatesValidationError = $this->validateRequiredDatesForStatus($resolvedStatus, $resolvedEffectiveDate, $resolvedExpiryDate);
        if ($requiredDatesValidationError instanceof JsonResponse) {
            return $requiredDatesValidationError;
        }

        $dateValidationError = $this->validateContractDateOrder($resolvedSignDate, $resolvedEffectiveDate, $resolvedExpiryDate);
        if ($dateValidationError instanceof JsonResponse) {
            return $dateValidationError;
        }

        $legacySchemaRequiresProject =
            $this->support->hasColumn('contracts', 'contract_number')
            || $this->support->hasColumn('contracts', 'total_value');
        if ($legacySchemaRequiresProject && $projectId === null) {
            return response()->json(['message' => 'project_id is required by this schema.'], 422);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'hợp đồng',
            $this->support->resolveProjectDepartmentIdById($projectId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $contract = new Contract();
        $this->support->setAttributeByColumns($contract, 'contracts', ['contract_code', 'contract_number'], $validated['contract_code']);
        $this->support->setAttributeIfColumn($contract, 'contracts', 'contract_name', $validated['contract_name']);
        $this->support->setAttributeIfColumn($contract, 'contracts', 'customer_id', $customerId);
        $this->support->setAttributeIfColumn($contract, 'contracts', 'project_id', $projectId);
        $this->support->setAttributeByColumns($contract, 'contracts', ['value', 'total_value'], $validated['value'] ?? 0);
        $this->support->setAttributeIfColumn(
            $contract,
            'contracts',
            'payment_cycle',
            $this->support->normalizePaymentCycle((string) ($validated['payment_cycle'] ?? 'ONCE'))
        );
        $this->support->setAttributeIfColumn($contract, 'contracts', 'status', $this->support->toContractStorageStatus($resolvedStatus));

        if ($this->support->hasColumn('contracts', 'sign_date')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'sign_date', $resolvedSignDate);
        }
        if ($this->support->hasColumn('contracts', 'effective_date')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'effective_date', $resolvedEffectiveDate);
        }
        if ($this->support->hasColumn('contracts', 'expiry_date')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $resolvedExpiryDate);
        }
        if ($this->support->hasColumn('contracts', 'term_unit')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'term_unit', $resolvedTermUnit);
        }
        if ($this->support->hasColumn('contracts', 'term_value')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'term_value', $resolvedTermValue);
        }
        if ($this->support->hasColumn('contracts', 'expiry_date_manual_override')) {
            $this->support->setAttributeIfColumn(
                $contract,
                'contracts',
                'expiry_date_manual_override',
                $manualExpiryOverride ? 1 : 0
            );
        }
        if ($this->support->hasColumn('contracts', 'data_scope')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope'] ?? null);
        }

        if ($this->support->hasColumn('contracts', 'dept_id')) {
            $this->support->setAttributeIfColumn(
                $contract,
                'contracts',
                'dept_id',
                $this->support->resolveProjectDepartmentIdById($projectId)
            );
        }

        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        $contract = DB::transaction(function () use ($request, $validated, $contract, $actorId): Contract {
            $contract->save();

            if (array_key_exists('items', $validated) && is_array($validated['items'])) {
                $this->syncContractItems((int) $contract->getKey(), $validated['items'], $actorId);
            }

            $fresh = Contract::query()->with($this->contractRelationsWithItems())->findOrFail($contract->getKey());

            $this->accessAudit->recordAuditEvent(
                $request,
                'INSERT',
                'contracts',
                $fresh->getKey(),
                null,
                $this->accessAudit->toAuditArray($fresh)
            );

            return $fresh;
        });

        return response()->json([
            'data' => $this->support->serializeContract($contract),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $contract = Contract::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $contract, 'hợp đồng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($contract);

        $rules = [
            'contract_code' => ['sometimes', 'required', 'string', 'max:100'],
            'contract_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'value' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['sometimes', 'nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['sometimes', 'nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['sometimes', 'nullable', 'date'],
            'effective_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
            'term_unit' => ['sometimes', 'nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];

        if ($this->support->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contract->id);
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contract->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('items', $validated)) {
            $hasSchedules = $this->support->hasTable('payment_schedules')
                && DB::table('payment_schedules')->where('contract_id', $contract->getKey())->exists();
            if ($hasSchedules) {
                return response()->json([
                    'message' => 'Không thể sửa hạng mục khi đã có kỳ thanh toán.',
                ], 422);
            }
        }

        $resolvedSignDate = array_key_exists('sign_date', $validated)
            ? $validated['sign_date']
            : ($contract->getAttribute('sign_date') ? (string) $contract->getAttribute('sign_date') : null);
        $resolvedEffectiveDate = array_key_exists('effective_date', $validated)
            ? $validated['effective_date']
            : ($contract->getAttribute('effective_date') ? (string) $contract->getAttribute('effective_date') : null);
        $resolvedExpiryDate = array_key_exists('expiry_date', $validated)
            ? $validated['expiry_date']
            : ($contract->getAttribute('expiry_date') ? (string) $contract->getAttribute('expiry_date') : null);
        $resolvedStatus = array_key_exists('status', $validated)
            ? $this->normalizeContractStatus($validated['status'])
            : $this->support->fromContractStorageStatus((string) ($contract->getAttribute('status') ?? 'DRAFT'));
        $resolvedTermUnit = array_key_exists('term_unit', $validated)
            ? $this->normalizeContractTermUnit($validated['term_unit'])
            : $this->normalizeContractTermUnit($contract->getAttribute('term_unit'));
        $resolvedTermValue = array_key_exists('term_value', $validated)
            ? $this->parseNullableFloat($validated['term_value'])
            : $this->parseNullableFloat($contract->getAttribute('term_value'));
        $manualExpiryOverride = array_key_exists('expiry_date_manual_override', $validated)
            ? (bool) $validated['expiry_date_manual_override']
            : (bool) ($contract->getAttribute('expiry_date_manual_override') ?? false);

        $termValidationError = $this->validateContractTermState(
            $resolvedTermUnit,
            $resolvedTermValue,
            $manualExpiryOverride,
            $resolvedExpiryDate
        );
        if ($termValidationError instanceof JsonResponse) {
            return $termValidationError;
        }

        if (! $manualExpiryOverride) {
            $resolvedExpiryDate = $this->resolveContractExpiryDateFromTerm(
                $resolvedTermUnit,
                $resolvedTermValue,
                $resolvedEffectiveDate,
                $resolvedSignDate
            ) ?? $resolvedExpiryDate;
        }

        $requiredDatesValidationError = $this->validateRequiredDatesForStatus($resolvedStatus, $resolvedEffectiveDate, $resolvedExpiryDate);
        if ($requiredDatesValidationError instanceof JsonResponse) {
            return $requiredDatesValidationError;
        }

        $dateValidationError = $this->validateContractDateOrder($resolvedSignDate, $resolvedEffectiveDate, $resolvedExpiryDate);
        if ($dateValidationError instanceof JsonResponse) {
            return $dateValidationError;
        }

        if (array_key_exists('project_id', $validated)) {
            $projectId = $this->support->parseNullableInt($validated['project_id']);
            if ($projectId !== null && ! Project::query()->whereKey($projectId)->exists()) {
                return response()->json(['message' => 'project_id is invalid.'], 422);
            }

            $legacySchemaRequiresProject =
                $this->support->hasColumn('contracts', 'contract_number')
                || $this->support->hasColumn('contracts', 'total_value');
            if ($legacySchemaRequiresProject && $projectId === null) {
                return response()->json(['message' => 'project_id is required by this schema.'], 422);
            }

            $scopeError = $this->accessAudit->authorizeMutationByScope(
                $request,
                'hợp đồng',
                $this->support->resolveProjectDepartmentIdById($projectId),
                $this->accessAudit->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }

            $this->support->setAttributeIfColumn($contract, 'contracts', 'project_id', $projectId);
            if ($this->support->hasColumn('contracts', 'dept_id')) {
                $this->support->setAttributeIfColumn(
                    $contract,
                    'contracts',
                    'dept_id',
                    $this->support->resolveProjectDepartmentIdById($projectId)
                );
            }
        }

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->support->setAttributeIfColumn($contract, 'contracts', 'customer_id', $customerId);
        }

        if (array_key_exists('contract_code', $validated)) {
            $this->support->setAttributeByColumns($contract, 'contracts', ['contract_code', 'contract_number'], $validated['contract_code']);
        }
        if (array_key_exists('contract_name', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'contract_name', $validated['contract_name']);
        }
        if (array_key_exists('value', $validated)) {
            $this->support->setAttributeByColumns($contract, 'contracts', ['value', 'total_value'], $validated['value'] ?? 0);
        }
        if (array_key_exists('payment_cycle', $validated)) {
            $this->support->setAttributeIfColumn(
                $contract,
                'contracts',
                'payment_cycle',
                $this->support->normalizePaymentCycle((string) ($validated['payment_cycle'] ?? 'ONCE'))
            );
        }
        if (array_key_exists('status', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'status', $this->support->toContractStorageStatus($resolvedStatus));
        }
        if (array_key_exists('sign_date', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'sign_date', $validated['sign_date']);
        }
        if (array_key_exists('effective_date', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'effective_date', $validated['effective_date']);
        }
        if (array_key_exists('expiry_date', $validated) || ! $manualExpiryOverride) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $resolvedExpiryDate);
        }
        if (array_key_exists('term_unit', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'term_unit', $resolvedTermUnit);
        }
        if (array_key_exists('term_value', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'term_value', $resolvedTermValue);
        }
        if (array_key_exists('expiry_date_manual_override', $validated)) {
            $this->support->setAttributeIfColumn(
                $contract,
                'contracts',
                'expiry_date_manual_override',
                $manualExpiryOverride ? 1 : 0
            );
        }
        if ($this->support->hasColumn('contracts', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        $contract = DB::transaction(function () use ($request, $validated, $contract, $actorId, $before): Contract {
            $contract->save();

            if (array_key_exists('items', $validated) && is_array($validated['items'])) {
                $this->syncContractItems((int) $contract->getKey(), $validated['items'], $actorId);
            }

            $fresh = Contract::query()->with($this->contractRelationsWithItems())->findOrFail($contract->getKey());

            $this->accessAudit->recordAuditEvent(
                $request,
                'UPDATE',
                'contracts',
                $fresh->getKey(),
                $before,
                $this->accessAudit->toAuditArray($fresh)
            );

            return $fresh;
        });

        return response()->json([
            'data' => $this->support->serializeContract($contract),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('contracts')) {
            return $this->support->missingTable('contracts');
        }

        $contract = Contract::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $contract, 'Contract');
    }

    private function validateContractDateOrder(?string $signDate, ?string $effectiveDate, ?string $expiryDate): ?JsonResponse
    {
        if ($signDate === null || $signDate === '') {
            return null;
        }

        try {
            $sign = Carbon::parse($signDate)->startOfDay();

            if ($effectiveDate !== null && $effectiveDate !== '') {
                $effective = Carbon::parse($effectiveDate)->startOfDay();
                if ($effective->lt($sign)) {
                    return response()->json([
                        'message' => 'Ngày hiệu lực phải lớn hơn hoặc bằng ngày ký.',
                        'errors' => [
                            'effective_date' => ['Ngày hiệu lực phải lớn hơn hoặc bằng ngày ký.'],
                        ],
                    ], 422);
                }
            }

            if ($expiryDate !== null && $expiryDate !== '') {
                $expiry = Carbon::parse($expiryDate)->startOfDay();
                if ($expiry->lt($sign)) {
                    return response()->json([
                        'message' => 'Ngày hết hiệu lực phải lớn hơn hoặc bằng ngày ký.',
                        'errors' => [
                            'expiry_date' => ['Ngày hết hiệu lực phải lớn hơn hoặc bằng ngày ký.'],
                        ],
                    ], 422);
                }
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function contractRelationsWithItems(): array
    {
        $relations = [
            'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
            'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
        ];

        if ($this->support->hasTable('contract_items')) {
            $productColumns = $this->support->selectColumns('products', ['id', 'product_code', 'product_name', 'unit']);
            $relations['items'] = fn ($query) => $query->with([
                'product' => fn ($productQuery) => $productColumns !== []
                    ? $productQuery->select($productColumns)
                    : $productQuery,
            ]);
        }

        return $relations;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function syncContractItems(int $contractId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('contract_items')) {
            throw ValidationException::withMessages([
                'items' => ['Hệ thống chưa hỗ trợ lưu hạng mục hợp đồng.'],
            ]);
        }

        foreach (['contract_id', 'product_id'] as $requiredColumn) {
            if (! $this->support->hasColumn('contract_items', $requiredColumn)) {
                throw ValidationException::withMessages([
                    'items' => ["Bảng contract_items thiếu cột {$requiredColumn}."],
                ]);
            }
        }

        $normalized = [];
        $seen = [];
        foreach ($items as $index => $item) {
            $productId = $this->support->parseNullableInt($item['product_id'] ?? null);
            if ($productId === null || $productId <= 0) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => ['Mã sản phẩm không hợp lệ.'],
                ]);
            }

            if (isset($seen[$productId])) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => ['Không được chọn trùng sản phẩm trong cùng một hợp đồng.'],
                ]);
            }
            $seen[$productId] = true;

            $quantity = is_numeric($item['quantity'] ?? null) ? (float) $item['quantity'] : 0.0;
            if (! is_finite($quantity) || $quantity <= 0) {
                throw ValidationException::withMessages([
                    "items.{$index}.quantity" => ['Số lượng phải lớn hơn 0.'],
                ]);
            }

            $unitPrice = is_numeric($item['unit_price'] ?? null) ? (float) $item['unit_price'] : 0.0;
            if (! is_finite($unitPrice) || $unitPrice < 0) {
                throw ValidationException::withMessages([
                    "items.{$index}.unit_price" => ['Đơn giá phải lớn hơn hoặc bằng 0.'],
                ]);
            }

            $normalized[] = [
                'product_id' => $productId,
                'quantity' => round($quantity, 2),
                'unit_price' => round($unitPrice, 2),
            ];
        }

        $productIds = collect($normalized)->pluck('product_id')->unique()->values();
        if ($productIds->isNotEmpty()) {
            $existingProductIds = DB::table('products')
                ->whereIn('id', $productIds->all())
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
            $missingProductIds = array_values(array_diff($productIds->all(), $existingProductIds));
            if ($missingProductIds !== []) {
                throw ValidationException::withMessages([
                    'items' => ['Không tìm thấy sản phẩm: '.implode(', ', $missingProductIds).'.'],
                ]);
            }
        }

        ContractItem::query()->where('contract_id', $contractId)->delete();

        if ($normalized === []) {
            return;
        }

        $now = now();
        $rows = [];
        foreach ($normalized as $item) {
            $row = [
                'contract_id' => $contractId,
                'product_id' => $item['product_id'],
            ];

            if ($this->support->hasColumn('contract_items', 'quantity')) {
                $row['quantity'] = $item['quantity'];
            }
            if ($this->support->hasColumn('contract_items', 'unit_price')) {
                $row['unit_price'] = $item['unit_price'];
            }
            if ($this->support->hasColumn('contract_items', 'created_at')) {
                $row['created_at'] = $now;
            }
            if ($this->support->hasColumn('contract_items', 'updated_at')) {
                $row['updated_at'] = $now;
            }
            if ($actorId !== null && $this->support->hasColumn('contract_items', 'created_by')) {
                $row['created_by'] = $actorId;
            }
            if ($actorId !== null && $this->support->hasColumn('contract_items', 'updated_by')) {
                $row['updated_by'] = $actorId;
            }

            $rows[] = $row;
        }

        DB::table('contract_items')->insert($rows);
    }

    private function normalizeContractStatus(mixed $status): string
    {
        $normalized = strtoupper(trim((string) $status));

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
    }

    private function normalizeContractTermUnit(mixed $termUnit): ?string
    {
        $normalized = strtoupper(trim((string) ($termUnit ?? '')));

        return in_array($normalized, self::CONTRACT_TERM_UNITS, true) ? $normalized : null;
    }

    private function parseNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_float($value) || is_int($value)) {
            return (float) $value;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function validateContractTermState(
        ?string $termUnit,
        ?float $termValue,
        bool $manualExpiryOverride,
        ?string $expiryDate
    ): ?JsonResponse {
        if (($termUnit !== null && $termValue === null) || ($termUnit === null && $termValue !== null)) {
            return response()->json([
                'message' => 'term_unit và term_value phải đi cùng nhau.',
                'errors' => [
                    'term_value' => ['term_unit và term_value phải đi cùng nhau.'],
                ],
            ], 422);
        }

        if ($termUnit === 'DAY' && $termValue !== null && floor($termValue) !== $termValue) {
            return response()->json([
                'message' => 'Thời hạn theo ngày phải là số nguyên.',
                'errors' => [
                    'term_value' => ['Thời hạn theo ngày phải là số nguyên.'],
                ],
            ], 422);
        }

        if ($manualExpiryOverride && ($expiryDate === null || trim($expiryDate) === '')) {
            return response()->json([
                'message' => 'Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.',
                'errors' => [
                    'expiry_date' => ['Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.'],
                ],
            ], 422);
        }

        return null;
    }

    private function validateRequiredDatesForStatus(string $status, ?string $effectiveDate, ?string $expiryDate): ?JsonResponse
    {
        if ($status === 'DRAFT') {
            return null;
        }

        $errors = [];
        if ($effectiveDate === null || trim($effectiveDate) === '') {
            $errors['effective_date'] = ['Ngày hiệu lực là bắt buộc khi trạng thái khác Đang soạn.'];
        }
        if ($expiryDate === null || trim($expiryDate) === '') {
            $errors['expiry_date'] = ['Ngày hết hiệu lực là bắt buộc khi trạng thái khác Đang soạn.'];
        }

        if ($errors === []) {
            return null;
        }

        return response()->json([
            'message' => 'Vui lòng nhập đủ ngày hiệu lực và ngày hết hiệu lực cho trạng thái hiện tại.',
            'errors' => $errors,
        ], 422);
    }

    private function resolveContractStartDateForTerm(?string $effectiveDate, ?string $signDate): string
    {
        $normalizedEffectiveDate = trim((string) ($effectiveDate ?? ''));
        if ($normalizedEffectiveDate !== '') {
            return $normalizedEffectiveDate;
        }

        $normalizedSignDate = trim((string) ($signDate ?? ''));
        if ($normalizedSignDate !== '') {
            return $normalizedSignDate;
        }

        return Carbon::now()->subDay()->toDateString();
    }

    private function resolveContractExpiryDateFromTerm(
        ?string $termUnit,
        ?float $termValue,
        ?string $effectiveDate,
        ?string $signDate
    ): ?string {
        if ($termUnit === null || $termValue === null || ! is_finite($termValue) || $termValue <= 0) {
            return null;
        }

        try {
            $start = Carbon::createFromFormat('Y-m-d', $this->resolveContractStartDateForTerm($effectiveDate, $signDate))
                ->startOfDay();
        } catch (\Throwable) {
            return null;
        }

        if ($termUnit === 'DAY') {
            if (floor($termValue) !== $termValue) {
                return null;
            }

            return $start->copy()->addDays((int) $termValue - 1)->toDateString();
        }

        $months = (int) floor($termValue);
        $days = (int) round(($termValue - $months) * 30);
        if ($months === 0 && $days === 0) {
            $days = 1;
        }

        return $start
            ->copy()
            ->addMonthsNoOverflow($months)
            ->addDays($days - 1)
            ->toDateString();
    }

    /**
     * @return array{
     *     total_contracts:int,
     *     signed:int,
     *     draft:int,
     *     renewed:int,
     *     expiring_soon:int,
     *     expiry_warning_days:int,
     *     upcoming_payment_customers:int,
     *     upcoming_payment_contracts:int,
     *     payment_warning_days:int,
     *     status_counts:array{DRAFT:int,SIGNED:int,RENEWED:int}
     * }
     */
    private function buildContractKpis(Builder $baseQuery): array
    {
        $warningDays = $this->support->resolveContractExpiryWarningDays();
        $paymentWarningDays = $this->support->resolveContractPaymentWarningDays();
        $kpiQuery = clone $baseQuery;
        $kpiQuery->setEagerLoads([]);
        $kpiQuery->getQuery()->columns = null;
        $kpiQuery->selectRaw('COUNT(*) as total_rows');

        if ($this->support->hasColumn('contracts', 'status')) {
            $kpiQuery->selectRaw("SUM(CASE WHEN UPPER(contracts.status) IN ('DRAFT', 'PENDING') THEN 1 ELSE 0 END) as draft_rows");
            $kpiQuery->selectRaw("SUM(CASE WHEN UPPER(contracts.status) = 'SIGNED' THEN 1 ELSE 0 END) as signed_rows");
            $kpiQuery->selectRaw("SUM(CASE WHEN UPPER(contracts.status) IN ('RENEWED', 'LIQUIDATED', 'TERMINATED', 'EXPIRED') THEN 1 ELSE 0 END) as renewed_rows");
        }

        if ($this->support->hasColumn('contracts', 'expiry_date')) {
            $today = Carbon::today()->toDateString();
            $deadline = Carbon::today()->addDays($warningDays)->toDateString();
            $statusCondition = $this->support->hasColumn('contracts', 'status')
                ? " AND UPPER(contracts.status) NOT IN ('DRAFT', 'PENDING')"
                : '';

            $kpiQuery->selectRaw(
                "SUM(CASE WHEN contracts.expiry_date IS NOT NULL AND DATE(contracts.expiry_date) >= ? AND DATE(contracts.expiry_date) <= ?{$statusCondition} THEN 1 ELSE 0 END) as expiring_soon_rows",
                [$today, $deadline]
            );
        }

        $aggregate = $kpiQuery->first();
        $total = max(0, (int) ($aggregate?->total_rows ?? 0));
        $draft = max(0, (int) ($aggregate?->draft_rows ?? 0));
        $signed = max(0, (int) ($aggregate?->signed_rows ?? 0));
        $renewed = max(0, (int) ($aggregate?->renewed_rows ?? 0));
        $expiringSoon = max(0, (int) ($aggregate?->expiring_soon_rows ?? 0));
        [$upcomingPaymentCustomers, $upcomingPaymentContracts] = $this->buildUpcomingPaymentKpis($baseQuery, $paymentWarningDays);

        return [
            'total_contracts' => $total,
            'signed' => $signed,
            'draft' => $draft,
            'renewed' => $renewed,
            'expiring_soon' => $expiringSoon,
            'expiry_warning_days' => $warningDays,
            'upcoming_payment_customers' => $upcomingPaymentCustomers,
            'upcoming_payment_contracts' => $upcomingPaymentContracts,
            'payment_warning_days' => $paymentWarningDays,
            'status_counts' => [
                'DRAFT' => $draft,
                'SIGNED' => $signed,
                'RENEWED' => $renewed,
            ],
        ];
    }

    /**
     * @return array{0:int,1:int}
     */
    private function buildUpcomingPaymentKpis(Builder $baseQuery, int $warningDays): array
    {
        if (! $this->support->hasColumn('contracts', 'payment_cycle')) {
            return [0, 0];
        }

        $query = clone $baseQuery;
        $query->setEagerLoads([]);
        $query->getQuery()->orders = null;
        $query->getQuery()->columns = null;
        $query->select($this->support->selectColumns('contracts', [
            'id',
            'customer_id',
            'status',
            'payment_cycle',
            'sign_date',
            'effective_date',
            'expiry_date',
        ]));

        $today = Carbon::today()->startOfDay();
        $deadline = $today->copy()->addDays($warningDays)->endOfDay();
        $uniqueCustomerIds = [];
        $contractCount = 0;

        /** @var Contract $contract */
        foreach ($query->get() as $contract) {
            $cycle = $this->support->normalizePaymentCycle((string) ($contract->getAttribute('payment_cycle') ?? 'ONCE'));
            if ($cycle === 'ONCE') {
                continue;
            }

            $status = $this->support->fromContractStorageStatus((string) ($contract->getAttribute('status') ?? 'DRAFT'));
            if ($status === 'DRAFT') {
                continue;
            }

            $effectiveRaw = trim((string) ($contract->getAttribute('effective_date') ?? ''));
            $signRaw = trim((string) ($contract->getAttribute('sign_date') ?? ''));
            $startRaw = $effectiveRaw !== '' ? $effectiveRaw : $signRaw;
            if ($startRaw === '') {
                continue;
            }

            try {
                $startDate = Carbon::parse($startRaw)->startOfDay();
                $nextPaymentDate = $this->resolveNextPaymentDate($startDate, $cycle, $today);
                if (! $nextPaymentDate instanceof Carbon) {
                    continue;
                }

                $expiryRaw = trim((string) ($contract->getAttribute('expiry_date') ?? ''));
                if ($expiryRaw !== '') {
                    $expiryDate = Carbon::parse($expiryRaw)->endOfDay();
                    if ($nextPaymentDate->gt($expiryDate)) {
                        continue;
                    }
                }

                if ($nextPaymentDate->lt($today) || $nextPaymentDate->gt($deadline)) {
                    continue;
                }
            } catch (\Throwable) {
                continue;
            }

            $contractCount++;
            $customerKey = trim((string) ($contract->getAttribute('customer_id') ?? ''));
            if ($customerKey !== '') {
                $uniqueCustomerIds[$customerKey] = true;
            }
        }

        return [count($uniqueCustomerIds), $contractCount];
    }

    private function resolveNextPaymentDate(Carbon $startDate, string $cycle, Carbon $today): ?Carbon
    {
        $intervalMonths = match (strtoupper($cycle)) {
            'MONTHLY' => 1,
            'QUARTERLY' => 3,
            'HALF_YEARLY' => 6,
            'YEARLY' => 12,
            default => null,
        };

        if ($intervalMonths === null) {
            return null;
        }

        $normalizedStart = $startDate->copy()->startOfDay();
        $normalizedToday = $today->copy()->startOfDay();
        if ($normalizedStart->gte($normalizedToday)) {
            return $normalizedStart;
        }

        $monthsApart = (($normalizedToday->year - $normalizedStart->year) * 12)
            + ($normalizedToday->month - $normalizedStart->month);
        $steps = intdiv(max(0, $monthsApart), $intervalMonths);
        $nextDue = $normalizedStart->copy()->addMonthsNoOverflow($steps * $intervalMonths);

        while ($nextDue->lt($normalizedToday)) {
            $nextDue->addMonthsNoOverflow($intervalMonths);
        }

        return $nextDue;
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
                } elseif (
                    $this->support->hasColumn('projects', 'opportunity_id')
                    && $this->support->hasTable('opportunities')
                    && $this->support->hasColumn('opportunities', 'dept_id')
                ) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_proj.id', 'contracts.project_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
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
