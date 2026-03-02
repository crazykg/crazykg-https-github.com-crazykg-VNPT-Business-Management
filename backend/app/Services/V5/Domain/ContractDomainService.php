<?php

namespace App\Services\V5\Domain;

use App\Models\Contract;
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
use Illuminate\Validation\Rule;

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
            'data_scope' => ['nullable', 'string', 'max:255'],
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

        $contract->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'contracts',
            $contract->getKey(),
            null,
            $this->accessAudit->toAuditArray($contract)
        );

        return response()->json([
            'data' => $this->support->serializeContract(
                $contract->loadMissing([
                    'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
                    'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
                ])
            ),
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
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contract->id);
        }
        if ($this->support->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contract->id);
        }

        $validated = $request->validate($rules);

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
        if (array_key_exists('expiry_date', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $validated['expiry_date']);
        }
        if ($this->support->hasColumn('contracts', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        $contract->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'contracts',
            $contract->getKey(),
            $before,
            $this->accessAudit->toAuditArray($contract)
        );

        return response()->json([
            'data' => $this->support->serializeContract(
                $contract->loadMissing([
                    'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
                    'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
                ])
            ),
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

    private function normalizeContractStatus(mixed $status): string
    {
        $normalized = strtoupper(trim((string) $status));

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
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
