<?php

namespace App\Services\V5\Domain;

use App\Jobs\RecomputeChildRenewalMetaJob;
use App\Models\Contract;
use App\Models\ContractItem;
use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Project;
use App\Services\V5\Contract\ContractPaymentService;
use App\Services\V5\Contract\ContractRenewalService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Support\Http\ResolvesValidatedInput;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ContractDomainService
{
    use ResolvesValidatedInput;

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

    /**
     * @var array<int, string>
     */
    private const DEFAULT_PROJECT_TYPE_CODES = ['DAU_TU', 'THUE_DICH_VU_DACTHU', 'THUE_DICH_VU_COSAN'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly ContractPaymentService $contractPaymentService,
        private readonly ContractRenewalService $renewalService,
        private readonly CustomerInsightService $insightService,
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
                'signer' => fn ($query) => $query->select($this->support->employeeRelationColumns()),
                'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
            ])
            ->select($this->support->selectColumns('contracts', [
                'id',
                'contract_code',
                'contract_number',
                'contract_name',
                'customer_id',
                'project_id',
                'dept_id',
                'signer_user_id',
                'project_type_code',
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

        $signDateFrom = trim((string) ($this->support->readFilterParam($request, 'sign_date_from', '') ?? ''));
        $signDateTo   = trim((string) ($this->support->readFilterParam($request, 'sign_date_to', '') ?? ''));
        if ($signDateFrom !== '' && $this->support->hasColumn('contracts', 'sign_date')) {
            try {
                $query->where('contracts.sign_date', '>=', Carbon::parse($signDateFrom)->toDateString());
            } catch (\Throwable) {
                // invalid date — ignore
            }
        }
        if ($signDateTo !== '' && $this->support->hasColumn('contracts', 'sign_date')) {
            try {
                $query->where('contracts.sign_date', '<=', Carbon::parse($signDateTo)->toDateString());
            } catch (\Throwable) {
                // invalid date — ignore
            }
        }

        $this->applyReadScope($request, $query);
        $kpis = $this->buildContractKpis($query, $signDateFrom, $signDateTo);

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

    public function signerOptions(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('internal_users')) {
            return $this->support->missingTable('internal_users');
        }
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $userId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($userId === null) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $allowedDepartmentIds = app(UserAccessService::class)->resolveDepartmentIdsForUser($userId);

        $query = DB::table('internal_users as signer')
            ->join('departments as dept', 'dept.id', '=', 'signer.department_id');

        if ($this->support->hasColumn('internal_users', 'deleted_at')) {
            $query->whereNull('signer.deleted_at');
        }
        if ($this->support->hasColumn('departments', 'deleted_at')) {
            $query->whereNull('dept.deleted_at');
        }
        if ($allowedDepartmentIds !== null) {
            $query->whereIn('signer.department_id', $allowedDepartmentIds);
        }

        $selects = [];
        $selects[] = $this->support->hasColumn('internal_users', 'id')
            ? 'signer.id as id'
            : DB::raw('NULL as id');
        $selects[] = $this->support->hasColumn('internal_users', 'user_code')
            ? 'signer.user_code as user_code'
            : DB::raw('NULL as user_code');
        $selects[] = $this->support->hasColumn('internal_users', 'full_name')
            ? 'signer.full_name as full_name'
            : DB::raw('NULL as full_name');
        $selects[] = $this->support->hasColumn('internal_users', 'department_id')
            ? 'signer.department_id as department_id'
            : DB::raw('NULL as department_id');
        $selects[] = $this->support->hasColumn('departments', 'dept_code')
            ? 'dept.dept_code as dept_code'
            : DB::raw('NULL as dept_code');
        $selects[] = $this->support->hasColumn('departments', 'dept_name')
            ? 'dept.dept_name as dept_name'
            : DB::raw('NULL as dept_name');

        $rows = $query
            ->select($selects)
            ->orderBy('dept.dept_name')
            ->orderBy('signer.full_name')
            ->get()
            ->map(function (object $row): array {
                return [
                    'id' => $this->support->parseNullableInt($row->id ?? null),
                    'user_code' => $this->support->normalizeNullableString($row->user_code ?? null),
                    'full_name' => $this->support->normalizeNullableString($row->full_name ?? null),
                    'department_id' => $this->support->parseNullableInt($row->department_id ?? null),
                    'dept_code' => $this->support->normalizeNullableString($row->dept_code ?? null),
                    'dept_name' => $this->support->normalizeNullableString($row->dept_name ?? null),
                ];
            })
            ->filter(fn (array $row): bool => $row['id'] !== null && $row['department_id'] !== null)
            ->values();

        return response()->json([
            'data' => $rows,
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
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'project_type_code' => ['nullable', 'string', 'max:100', Rule::in($this->resolveAvailableProjectTypeCodes())],
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
            'items.*.vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'parent_contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
            'addendum_type' => ['nullable', Rule::in(ContractRenewalService::addendumTypes())],
        ];

        if ($this->support->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code');
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number');
        }

        $validated = $this->validatedInput($request);

        // --- Renewal chain validation ---
        $parentContractId = $this->support->parseNullableInt($validated['parent_contract_id'] ?? null);
        $parentContract = null;
        if ($parentContractId !== null && $this->support->hasColumn('contracts', 'parent_contract_id')) {
            $parentContract = Contract::withTrashed()->find($parentContractId);
            if ($parentContract === null) {
                return response()->json(['message' => 'parent_contract_id is invalid.'], 422);
            }
            $this->renewalService->validateChainDepthForCreate($parentContractId);
        }

        $linkage = $this->resolveContractLinkageState($validated);
        if ($linkage instanceof JsonResponse) {
            return $linkage;
        }

        $signerContext = $this->resolveContractSignerContext($validated);
        if ($signerContext instanceof JsonResponse) {
            return $signerContext;
        }

        $projectId = $linkage['project_id'];
        $customerId = $linkage['customer_id'];
        $projectTypeCode = $linkage['project_type_code'];

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

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'hợp đồng',
            $signerContext['department_id'],
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
        $this->support->setAttributeIfColumn($contract, 'contracts', 'signer_user_id', $signerContext['signer_user_id']);
        $this->support->setAttributeIfColumn($contract, 'contracts', 'project_type_code', $projectTypeCode);
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
                $signerContext['department_id']
            );
        }

        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        // --- Addendum / renewal fields ---
        if ($parentContractId !== null && $this->support->hasColumn('contracts', 'parent_contract_id')) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'parent_contract_id', $parentContractId);
            $addendumType = strtoupper(trim((string) ($validated['addendum_type'] ?? 'EXTENSION')));
            $this->support->setAttributeIfColumn($contract, 'contracts', 'addendum_type', $addendumType);
            $this->renewalService->applyRenewalMetaToContract($contract, $parentContract, $resolvedEffectiveDate);
        }

        $contract = DB::transaction(function () use ($request, $validated, $contract, $actorId, $parentContract): Contract {
            $contract->save();

            // Auto-promote parent contract SIGNED → RENEWED when an EXTENSION addendum is saved
            if ($parentContract !== null) {
                $addendumType = strtoupper(trim((string) ($validated['addendum_type'] ?? 'EXTENSION')));
                $parentUpdated = $this->renewalService->markParentAsRenewed($parentContract, $addendumType);
                if ($parentUpdated) {
                    $this->support->setAttributeIfColumn($parentContract, 'contracts', 'updated_by', $actorId);
                    $parentOldValues = $this->accessAudit->toAuditArray($parentContract->getOriginal() ? $parentContract : $parentContract);
                    $parentContract->save();
                    $this->accessAudit->recordAuditEvent(
                        $request,
                        'UPDATE',
                        'contracts',
                        $parentContract->getKey(),
                        ['status' => $parentContract->getOriginal('status') ?? 'SIGNED'],
                        ['status' => 'RENEWED'],
                    );
                }
            }

            if (array_key_exists('items', $validated) && is_array($validated['items'])) {
                $this->syncContractItems((int) $contract->getKey(), $validated['items'], $actorId);
                $this->syncContractStoredAmountFromItems($contract, $validated['items']);
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

        $customerId = $this->support->parseNullableInt($contract->getAttribute('customer_id'));
        if ($customerId !== null) {
            $this->insightService->invalidateCustomerCaches($customerId);
        }

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
        $originalCustomerId = $this->support->parseNullableInt($contract->getAttribute('customer_id'));

        $rules = [
            'contract_code' => ['sometimes', 'required', 'string', 'max:100'],
            'contract_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'project_type_code' => ['sometimes', 'nullable', 'string', 'max:100', Rule::in($this->resolveAvailableProjectTypeCodes())],
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
            'items.*.vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'parent_contract_id' => ['sometimes', 'nullable', 'integer', 'exists:contracts,id'],
            'addendum_type' => ['sometimes', 'nullable', Rule::in(ContractRenewalService::addendumTypes())],
        ];

        if ($this->support->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contract->id);
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contract->id);
        }

        $validated = $this->validatedInput($request);

        $linkage = $this->resolveContractLinkageState($validated, $contract);
        if ($linkage instanceof JsonResponse) {
            return $linkage;
        }

        $signerContext = $this->resolveContractSignerContext($validated, $contract);
        if ($signerContext instanceof JsonResponse) {
            return $signerContext;
        }

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

        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'hợp đồng',
            $signerContext['department_id'],
            $this->accessAudit->resolveAuthenticatedUserId($request)
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if (array_key_exists('project_id', $validated)
            || array_key_exists('customer_id', $validated)
            || array_key_exists('project_type_code', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'project_id', $linkage['project_id']);
            $this->support->setAttributeIfColumn($contract, 'contracts', 'customer_id', $linkage['customer_id']);
            $this->support->setAttributeIfColumn($contract, 'contracts', 'project_type_code', $linkage['project_type_code']);
        }

        $this->support->setAttributeIfColumn($contract, 'contracts', 'signer_user_id', $signerContext['signer_user_id']);
        if ($this->support->hasColumn('contracts', 'dept_id')) {
            $this->support->setAttributeIfColumn(
                $contract,
                'contracts',
                'dept_id',
                $signerContext['department_id']
            );
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

        // --- Addendum / renewal recompute ---
        $renewalColsExist = $this->support->hasColumn('contracts', 'parent_contract_id');
        if ($renewalColsExist) {
            if (array_key_exists('parent_contract_id', $validated)) {
                $newParentId = $this->support->parseNullableInt($validated['parent_contract_id']);
                if ($newParentId !== null) {
                    $this->renewalService->validateNoCircularParent((int) $contract->getKey(), $newParentId);
                    $this->renewalService->validateChainDepthForCreate($newParentId);
                }
                $this->support->setAttributeIfColumn($contract, 'contracts', 'parent_contract_id', $newParentId);
            }
            if (array_key_exists('addendum_type', $validated)) {
                $this->support->setAttributeIfColumn(
                    $contract, 'contracts', 'addendum_type',
                    $validated['addendum_type'] !== null
                        ? strtoupper(trim((string) $validated['addendum_type']))
                        : null
                );
            }
            // Recompute gap/continuity/penalty whenever effective_date or parent changes
            $parentIdForMeta = $this->support->parseNullableInt($contract->getAttribute('parent_contract_id'));
            $parentForMeta = $parentIdForMeta !== null ? Contract::withTrashed()->find($parentIdForMeta) : null;
            $this->renewalService->applyRenewalMetaToContract($contract, $parentForMeta, $resolvedEffectiveDate);
        }

        $expiryDateBefore = (string) ($contract->getAttribute('expiry_date') ?? '');

        $contract = DB::transaction(function () use ($request, $validated, $contract, $actorId, $before): Contract {
            $contract->save();

            if (array_key_exists('items', $validated) && is_array($validated['items'])) {
                $this->syncContractItems((int) $contract->getKey(), $validated['items'], $actorId);
                $this->syncContractStoredAmountFromItems($contract, $validated['items']);
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

        // Re-cascade renewal meta to children when expiry_date changed
        $expiryDateAfter = (string) ($contract->getAttribute('expiry_date') ?? '');
        if ($expiryDateAfter !== $expiryDateBefore
            && $this->support->hasColumn('contracts', 'parent_contract_id')) {
            RecomputeChildRenewalMetaJob::dispatch((int) $contract->getKey());
        }

        $customerIdsToInvalidate = collect([
            $originalCustomerId,
            $this->support->parseNullableInt($contract->getAttribute('customer_id')),
        ])
            ->filter(fn (?int $customerId): bool => $customerId !== null)
            ->unique()
            ->values()
            ->all();

        foreach ($customerIdsToInvalidate as $customerId) {
            $this->insightService->invalidateCustomerCaches($customerId);
        }

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

        // Orphan child addenda — reset their renewal meta so they read as STANDALONE
        if ($this->support->hasColumn('contracts', 'parent_contract_id')) {
            DB::transaction(function () use ($id): void {
                $children = Contract::query()
                    ->where('parent_contract_id', $id)
                    ->whereNull('deleted_at')
                    ->get();
                foreach ($children as $child) {
                    $this->renewalService->applyRenewalMetaToContract($child, null);
                    $child->save();
                }
            });
        }
        $customerId = $this->support->parseNullableInt($contract->getAttribute('customer_id'));
        $response = $this->accessAudit->deleteModel($request, $contract, 'Contract');

        if ($response->getStatusCode() < 400 && $customerId !== null) {
            $this->insightService->invalidateCustomerCaches($customerId);
        }

        return $response;
    }

    public function generatePayments(Request $request, int $id): JsonResponse
    {
        return $this->contractPaymentService->generateContractPayments($request, $id);
    }

    public function paymentSchedules(Request $request): JsonResponse
    {
        return $this->contractPaymentService->paymentSchedules($request);
    }

    public function updatePaymentSchedule(Request $request, int $id): JsonResponse
    {
        return $this->contractPaymentService->updatePaymentSchedule($request, $id);
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
            'signer' => fn ($query) => $query->select($this->support->employeeRelationColumns()),
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
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
                'vat_rate' => array_key_exists('vat_rate', $item) && is_numeric($item['vat_rate'] ?? null)
                    ? round(max(0, min(100, (float) $item['vat_rate'])), 2)
                    : null,
                'vat_amount' => array_key_exists('vat_amount', $item) && is_numeric($item['vat_amount'] ?? null)
                    ? round(max(0, (float) $item['vat_amount']), 2)
                    : null,
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
            if ($this->support->hasColumn('contract_items', 'vat_rate')) {
                $row['vat_rate'] = $item['vat_rate'];
            }
            if ($this->support->hasColumn('contract_items', 'vat_amount')) {
                $row['vat_amount'] = $item['vat_amount'];
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

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function syncContractStoredAmountFromItems(Contract $contract, array $items): void
    {
        $itemsTotal = collect($items)->sum(function (array $item): float {
            $quantity = is_numeric($item['quantity'] ?? null) ? (float) $item['quantity'] : 0.0;
            $unitPrice = is_numeric($item['unit_price'] ?? null) ? (float) $item['unit_price'] : 0.0;
            return max(0, round($quantity, 2) * round($unitPrice, 2));
        });

        if ($itemsTotal <= 0) {
            return;
        }

        $normalizedAmount = round($itemsTotal, 2);
        $dirty = false;

        if ($this->support->hasColumn('contracts', 'value') && (float) ($contract->getAttribute('value') ?? 0) !== $normalizedAmount) {
            $contract->setAttribute('value', $normalizedAmount);
            $dirty = true;
        }

        if ($this->support->hasColumn('contracts', 'total_value') && (float) ($contract->getAttribute('total_value') ?? 0) !== $normalizedAmount) {
            $contract->setAttribute('total_value', $normalizedAmount);
            $dirty = true;
        }

        if ($dirty) {
            $contract->save();
        }
    }

    /**
     * @param array<string, mixed> $validated
     * @return array{signer_user_id:int,department_id:int}|JsonResponse
     */
    private function resolveContractSignerContext(array $validated, ?Contract $existingContract = null): array|JsonResponse
    {
        $signerUserId = array_key_exists('signer_user_id', $validated)
            ? $this->support->parseNullableInt($validated['signer_user_id'])
            : $this->support->parseNullableInt($existingContract?->getAttribute('signer_user_id'));

        if ($signerUserId === null) {
            return $this->invalidSignerResponse('Vui lòng chọn người ký hợp đồng.');
        }

        $query = InternalUser::query()->select(['id', 'department_id']);
        if ($this->support->hasColumn('internal_users', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $signer = $query->find($signerUserId);
        if (! $signer instanceof InternalUser) {
            return $this->invalidSignerResponse('Người ký hợp đồng không hợp lệ.');
        }

        $departmentId = $this->support->parseNullableInt($signer->getAttribute('department_id'));
        if ($departmentId === null) {
            return $this->invalidSignerResponse('Người ký hợp đồng chưa được gán phòng ban hợp lệ.');
        }

        $departmentExists = $this->support->hasTable('departments')
            && DB::table('departments')
                ->where('id', $departmentId)
                ->when(
                    $this->support->hasColumn('departments', 'deleted_at'),
                    fn ($query) => $query->whereNull('deleted_at')
                )
                ->exists();
        if (! $departmentExists) {
            return $this->invalidSignerResponse('Người ký hợp đồng chưa được gán phòng ban hợp lệ.');
        }

        return [
            'signer_user_id' => $signerUserId,
            'department_id' => $departmentId,
        ];
    }

    /**
     * @return array{project_id:?int,customer_id:int,project_type_code:?string,scope_department_id:?int}|JsonResponse
     */
    private function resolveContractLinkageState(array $validated, ?Contract $existingContract = null): array|JsonResponse
    {
        $existingProjectId = $this->support->parseNullableInt($existingContract?->getAttribute('project_id'));
        $projectId = array_key_exists('project_id', $validated)
            ? $this->support->parseNullableInt($validated['project_id'])
            : $existingProjectId;
        $projectTypeCode = array_key_exists('project_type_code', $validated)
            ? $this->normalizeProjectTypeCode($validated['project_type_code'])
            : $this->normalizeProjectTypeCode($existingContract?->getAttribute('project_type_code'));
        $projectIdWasExplicitlyCleared = array_key_exists('project_id', $validated) && $projectId === null;

        if ($projectId !== null) {
            $project = Project::query()->find($projectId);
            if ($project === null) {
                return response()->json(['message' => 'project_id is invalid.'], 422);
            }

            if ($projectTypeCode !== null) {
                return response()->json([
                    'message' => 'Không thể chọn loại dự án đầu kỳ khi hợp đồng đã liên kết dự án.',
                    'errors' => [
                        'project_type_code' => ['Không thể chọn loại dự án đầu kỳ khi hợp đồng đã liên kết dự án.'],
                    ],
                ], 422);
            }

            $customerId = $this->support->parseNullableInt($project->getAttribute('customer_id'));
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json([
                    'message' => 'Dự án liên kết chưa có khách hàng hợp lệ.',
                    'errors' => [
                        'project_id' => ['Dự án liên kết chưa có khách hàng hợp lệ.'],
                    ],
                ], 422);
            }

            return [
                'project_id' => $projectId,
                'customer_id' => $customerId,
                'project_type_code' => null,
                'scope_department_id' => $this->support->resolveProjectDepartmentIdById($projectId),
            ];
        }

        if ($projectIdWasExplicitlyCleared || $existingProjectId === null) {
            if ($projectIdWasExplicitlyCleared) {
                if (! array_key_exists('customer_id', $validated)) {
                    return response()->json([
                        'message' => 'customer_id is required when project_id is empty.',
                        'errors' => [
                            'customer_id' => ['Vui lòng chọn khách hàng cho hợp đồng đầu kỳ.'],
                        ],
                    ], 422);
                }
                if (! array_key_exists('project_type_code', $validated)) {
                    return response()->json([
                        'message' => 'project_type_code is required when project_id is empty.',
                        'errors' => [
                            'project_type_code' => ['Vui lòng chọn loại dự án cho hợp đồng đầu kỳ.'],
                        ],
                    ], 422);
                }
            }

            $customerId = array_key_exists('customer_id', $validated)
                ? $this->support->parseNullableInt($validated['customer_id'])
                : $this->support->parseNullableInt($existingContract?->getAttribute('customer_id'));

            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }

            if ($projectTypeCode === null || ! in_array($projectTypeCode, $this->resolveAvailableProjectTypeCodes(), true)) {
                return response()->json([
                    'message' => 'project_type_code is invalid.',
                    'errors' => [
                        'project_type_code' => ['Vui lòng chọn loại dự án hợp lệ cho hợp đồng đầu kỳ.'],
                    ],
                ], 422);
            }

            return [
                'project_id' => null,
                'customer_id' => $customerId,
                'project_type_code' => $projectTypeCode,
                'scope_department_id' => null,
            ];
        }

        $customerId = $this->support->parseNullableInt($existingContract?->getAttribute('customer_id'));
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        return [
            'project_id' => null,
            'customer_id' => $customerId,
            'project_type_code' => $projectTypeCode,
            'scope_department_id' => null,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function resolveAvailableProjectTypeCodes(): array
    {
        $codes = self::DEFAULT_PROJECT_TYPE_CODES;

        if ($this->support->hasTable('project_types') && $this->support->hasColumn('project_types', 'type_code')) {
            $projectTypeCodes = DB::table('project_types')
                ->pluck('type_code')
                ->map(fn ($code): ?string => $this->normalizeProjectTypeCode($code))
                ->filter(fn (?string $code): bool => $code !== null)
                ->values()
                ->all();

            $codes = array_merge($codes, $projectTypeCodes);
        }

        return array_values(array_unique($codes));
    }

    private function invalidSignerResponse(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'errors' => [
                'signer_user_id' => [$message],
            ],
        ], 422);
    }

    private function normalizeProjectTypeCode(mixed $projectTypeCode): ?string
    {
        $normalized = strtoupper(trim((string) ($projectTypeCode ?? '')));

        return $normalized !== '' ? $normalized : null;
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
     *     status_counts:array{DRAFT:int,SIGNED:int,RENEWED:int},
     *     new_signed_count:int,
     *     new_signed_value:float,
     *     total_pipeline_value:float,
     *     overdue_payment_amount:float,
     *     collection_rate:int,
     *     actual_collected_value:float
     * }
     */
    private function buildContractKpis(Builder $baseQuery, string $signDateFrom = '', string $signDateTo = ''): array
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

        if ($this->support->hasColumn('contracts', 'value')) {
            $valueExpr = $this->support->hasColumn('contracts', 'total_value')
                ? 'COALESCE(contracts.value, contracts.total_value, 0)'
                : 'COALESCE(contracts.value, 0)';
            $kpiQuery->selectRaw(
                "SUM(CASE WHEN UPPER(contracts.status) = 'SIGNED' THEN {$valueExpr} ELSE 0 END) as new_signed_value_sum"
            );
            $kpiQuery->selectRaw(
                "SUM(CASE WHEN UPPER(contracts.status) IN ('SIGNED','RENEWED') THEN {$valueExpr} ELSE 0 END) as total_pipeline_value_sum"
            );
        }

        $aggregate = $kpiQuery->first();
        $total = max(0, (int) ($aggregate?->total_rows ?? 0));
        $draft = max(0, (int) ($aggregate?->draft_rows ?? 0));
        $signed = max(0, (int) ($aggregate?->signed_rows ?? 0));
        $renewed = max(0, (int) ($aggregate?->renewed_rows ?? 0));
        $expiringSoon = max(0, (int) ($aggregate?->expiring_soon_rows ?? 0));
        $newSignedValue = (float) ($aggregate?->new_signed_value_sum ?? 0);
        $totalPipelineValue = (float) ($aggregate?->total_pipeline_value_sum ?? 0);
        [$upcomingPaymentCustomers, $upcomingPaymentContracts] = $this->buildUpcomingPaymentKpis($baseQuery, $paymentWarningDays);

        // --- Payment schedule KPIs ---
        $overduePaymentAmount = 0.0;
        $collectionRate = 0;
        $actualCollectedValue = 0.0;

        if ($this->support->hasTable('payment_schedules')
            && $this->support->hasColumn('payment_schedules', 'contract_id')
            && $this->support->hasColumn('payment_schedules', 'expected_amount')
            && $this->support->hasColumn('payment_schedules', 'status')) {
            $idSubQuery = clone $baseQuery;
            $idSubQuery->setEagerLoads([]);
            $idSubQuery->getQuery()->columns = null;
            $idSubQuery->getQuery()->orders = null;
            $idSubQuery->select('contracts.id');

            $payKpis = DB::table('payment_schedules')
                ->whereIn('contract_id', $idSubQuery)
                ->selectRaw(
                    "COALESCE(SUM(CASE WHEN UPPER(status)='OVERDUE' THEN expected_amount ELSE 0 END),0) as overdue_amt,
                     COALESCE(SUM(expected_amount),0) as total_expected,
                     COALESCE(SUM(CASE WHEN UPPER(status)='PAID' THEN actual_paid_amount ELSE 0 END),0) as total_collected"
                )
                ->first();

            $overduePaymentAmount = (float) ($payKpis?->overdue_amt ?? 0);
            $totalExpected = (float) ($payKpis?->total_expected ?? 0);
            $actualCollectedValue = (float) ($payKpis?->total_collected ?? 0);

            // If a date range is active, scope actual collected to actual_paid_date within period
            if (($signDateFrom !== '' || $signDateTo !== '')
                && $this->support->hasColumn('payment_schedules', 'actual_paid_date')) {
                $periodQ = DB::table('payment_schedules')
                    ->whereIn('contract_id', $idSubQuery)
                    ->where('status', 'PAID');
                if ($signDateFrom !== '') {
                    $periodQ->where('actual_paid_date', '>=', $signDateFrom);
                }
                if ($signDateTo !== '') {
                    $periodQ->where('actual_paid_date', '<=', $signDateTo);
                }
                $actualCollectedValue = (float) $periodQ->sum('actual_paid_amount');
            }

            $collectionRate = $totalExpected > 0
                ? max(0, min(100, (int) round($actualCollectedValue / $totalExpected * 100)))
                : 0;
        }

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
            'new_signed_count' => $signed,
            'new_signed_value' => $newSignedValue,
            'total_pipeline_value' => $totalPipelineValue,
            'overdue_payment_amount' => $overduePaymentAmount,
            'collection_rate' => $collectionRate,
            'actual_collected_value' => $actualCollectedValue,
            'addendum_count' => (function () use ($baseQuery): int {
                if (! $this->support->hasColumn('contracts', 'parent_contract_id')) {
                    return 0;
                }
                $q = clone $baseQuery;
                $q->setEagerLoads([]);
                $q->getQuery()->columns = null;
                $q->whereNotNull('contracts.parent_contract_id');

                return (int) $q->count();
            })(),
            'gap_count' => (function () use ($baseQuery): int {
                if (! $this->support->hasColumn('contracts', 'continuity_status')) {
                    return 0;
                }
                $q = clone $baseQuery;
                $q->setEagerLoads([]);
                $q->getQuery()->columns = null;
                $q->whereNotNull('contracts.parent_contract_id')
                    ->whereRaw("UPPER(contracts.continuity_status) = 'GAP'");

                return (int) $q->count();
            })(),
            'continuity_rate' => (function () use ($baseQuery): ?int {
                if (! $this->support->hasColumn('contracts', 'continuity_status') ||
                    ! $this->support->hasColumn('contracts', 'parent_contract_id')) {
                    return null;
                }
                $q = clone $baseQuery;
                $q->setEagerLoads([]);
                $q->getQuery()->columns = null;
                $q->whereNotNull('contracts.parent_contract_id')
                    ->selectRaw(
                        "SUM(CASE WHEN UPPER(contracts.continuity_status) = 'CONTINUOUS' THEN 1 ELSE 0 END) as cnt_continuous,
                         SUM(CASE WHEN UPPER(contracts.continuity_status) = 'GAP'        THEN 1 ELSE 0 END) as cnt_gap"
                    );
                $row = $q->first();
                $continuous = max(0, (int) ($row?->cnt_continuous ?? 0));
                $gap = max(0, (int) ($row?->cnt_gap ?? 0));
                $denom = $continuous + $gap;

                return $denom > 0
                    ? max(0, min(100, (int) round($continuous / $denom * 100)))
                    : null;
            })(),
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
