<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerDomainService
{
    private const CUSTOMER_SECTOR_HEALTHCARE = 'HEALTHCARE';
    private const CUSTOMER_SECTOR_GOVERNMENT = 'GOVERNMENT';
    private const CUSTOMER_SECTOR_INDIVIDUAL = 'INDIVIDUAL';
    private const CUSTOMER_SECTOR_OTHER = 'OTHER';
    private const HEALTHCARE_FACILITY_HOSPITAL_TTYT = 'HOSPITAL_TTYT';
    private const HEALTHCARE_FACILITY_TYT_CLINIC = 'TYT_CLINIC';
    private const HEALTHCARE_FACILITY_OTHER = 'OTHER';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $query = Customer::query()
            ->select($this->support->selectColumns('customers', [
                'id',
                'uuid',
                'customer_code',
                'customer_name',
                'company_name',
                'tax_code',
                'address',
                'customer_sector',
                'healthcare_facility_type',
                'bed_capacity',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['customer_code', 'customer_name', 'company_name', 'tax_code', 'address'] as $column) {
                    if ($this->support->hasColumn('customers', $column)) {
                        $builder->orWhere("customers.{$column}", 'like', $like);
                    }
                }
            });
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'customers.id',
            'customer_code' => 'customers.customer_code',
            'customer_name' => 'customers.customer_name',
            'tax_code' => 'customers.tax_code',
            'created_at' => 'customers.created_at',
        ], 'customers.id');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'customers.id' && $this->support->hasColumn('customers', 'id')) {
            $query->orderBy('customers.id', 'asc');
        }

        $this->applyReadScope($request, $query);

        $kpis = $this->buildCustomerKpis($query);

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Customer $customer): array => $this->support->serializeCustomer($customer))
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
                ->map(fn (Customer $customer): array => $this->support->serializeCustomer($customer))
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
            ->map(fn (Customer $customer): array => $this->support->serializeCustomer($customer))
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
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'customer_code' => ['required', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_sector' => ['nullable', 'string', Rule::in([
                self::CUSTOMER_SECTOR_HEALTHCARE,
                self::CUSTOMER_SECTOR_GOVERNMENT,
                self::CUSTOMER_SECTOR_INDIVIDUAL,
                self::CUSTOMER_SECTOR_OTHER,
            ])],
            'healthcare_facility_type' => ['nullable', 'string', Rule::in([
                self::HEALTHCARE_FACILITY_HOSPITAL_TTYT,
                self::HEALTHCARE_FACILITY_TYT_CLINIC,
                self::HEALTHCARE_FACILITY_OTHER,
            ])],
            'bed_capacity' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('customers', 'uuid')) {
            $uniqueRule = Rule::unique('customers', 'uuid');
            if ($this->support->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support->hasColumn('customers', 'customer_code')) {
            $uniqueRule = Rule::unique('customers', 'customer_code');
            if ($this->support->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['customer_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);
        [$customerSector, $facilityType, $bedCapacity] = $this->normalizeHealthcareAttributes($validated);

        $customer = new Customer();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $uuid);
        $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        $this->support->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        $this->support->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code'] ?? null);
        $this->support->setAttributeIfColumn($customer, 'customers', 'address', $validated['address'] ?? null);
        $this->support->setAttributeIfColumn($customer, 'customers', 'customer_sector', $customerSector);
        $this->support->setAttributeIfColumn($customer, 'customers', 'healthcare_facility_type', $facilityType);
        $this->support->setAttributeIfColumn($customer, 'customers', 'bed_capacity', $bedCapacity);

        if ($this->support->hasColumn('customers', 'data_scope')) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope'] ?? null);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'customers',
            $customer->getKey(),
            null,
            $this->accessAudit->toAuditArray($customer)
        );

        return response()->json(['data' => $this->support->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $customer, 'khách hàng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($customer);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_code' => ['sometimes', 'required', 'string', 'max:100'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'customer_sector' => ['sometimes', 'nullable', 'string', Rule::in([
                self::CUSTOMER_SECTOR_HEALTHCARE,
                self::CUSTOMER_SECTOR_GOVERNMENT,
                self::CUSTOMER_SECTOR_INDIVIDUAL,
                self::CUSTOMER_SECTOR_OTHER,
            ])],
            'healthcare_facility_type' => ['sometimes', 'nullable', 'string', Rule::in([
                self::HEALTHCARE_FACILITY_HOSPITAL_TTYT,
                self::HEALTHCARE_FACILITY_TYT_CLINIC,
                self::HEALTHCARE_FACILITY_OTHER,
            ])],
            'bed_capacity' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:1000000'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn('customers', 'uuid')) {
            $uniqueRule = Rule::unique('customers', 'uuid')->ignore($customer->id);
            if ($this->support->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['uuid'][] = $uniqueRule;
        }
        if ($this->support->hasColumn('customers', 'customer_code')) {
            $uniqueRule = Rule::unique('customers', 'customer_code')->ignore($customer->id);
            if ($this->support->hasColumn('customers', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['customer_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);
        $validated = $this->mergeExistingHealthcareAttributes($customer, $validated);
        [$customerSector, $facilityType, $bedCapacity] = $this->normalizeHealthcareAttributes($validated);

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('customer_code', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        }
        if (array_key_exists('customer_name', $validated)) {
            $this->support->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        }
        if (array_key_exists('tax_code', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code']);
        }
        if (array_key_exists('address', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'address', $validated['address']);
        }
        if ($this->support->hasColumn('customers', 'customer_sector')) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'customer_sector', $customerSector);
        }
        if ($this->support->hasColumn('customers', 'healthcare_facility_type')) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'healthcare_facility_type', $facilityType);
        }
        if ($this->support->hasColumn('customers', 'bed_capacity')) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'bed_capacity', $bedCapacity);
        }
        if ($this->support->hasColumn('customers', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'customers',
            $customer->getKey(),
            $before,
            $this->accessAudit->toAuditArray($customer->fresh() ?? $customer)
        );

        return response()->json(['data' => $this->support->serializeCustomer($customer)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('customers')) {
            return $this->support->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $customer, 'Customer');
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{0: string, 1: ?string, 2: ?int}
     */
    private function normalizeHealthcareAttributes(array $payload): array
    {
        $customerSector = $this->normalizeCustomerSector($payload['customer_sector'] ?? null);
        $facilityType = $this->normalizeHealthcareFacilityType($payload['healthcare_facility_type'] ?? null);
        $bedCapacity = array_key_exists('bed_capacity', $payload) && $payload['bed_capacity'] !== null
            ? (int) $payload['bed_capacity']
            : null;

        if ($customerSector === self::CUSTOMER_SECTOR_HEALTHCARE && $facilityType === null) {
            throw ValidationException::withMessages([
                'healthcare_facility_type' => ['Vui lòng chọn loại hình cơ sở y tế.'],
            ]);
        }

        if ($customerSector !== self::CUSTOMER_SECTOR_HEALTHCARE) {
            return [self::CUSTOMER_SECTOR_OTHER, null, null];
        }

        if ($facilityType !== self::HEALTHCARE_FACILITY_HOSPITAL_TTYT) {
            $bedCapacity = null;
        }

        return [$customerSector, $facilityType, $bedCapacity];
    }

    private function normalizeCustomerSector(mixed $value): string
    {
        $normalized = strtoupper(trim((string) $value));

        return match ($normalized) {
            self::CUSTOMER_SECTOR_HEALTHCARE => self::CUSTOMER_SECTOR_HEALTHCARE,
            self::CUSTOMER_SECTOR_GOVERNMENT => self::CUSTOMER_SECTOR_GOVERNMENT,
            self::CUSTOMER_SECTOR_INDIVIDUAL => self::CUSTOMER_SECTOR_INDIVIDUAL,
            default => self::CUSTOMER_SECTOR_OTHER,
        };
    }

    private function normalizeHealthcareFacilityType(mixed $value): ?string
    {
        $normalized = strtoupper(trim((string) $value));

        return match ($normalized) {
            self::HEALTHCARE_FACILITY_HOSPITAL_TTYT => self::HEALTHCARE_FACILITY_HOSPITAL_TTYT,
            self::HEALTHCARE_FACILITY_TYT_CLINIC => self::HEALTHCARE_FACILITY_TYT_CLINIC,
            self::HEALTHCARE_FACILITY_OTHER => self::HEALTHCARE_FACILITY_OTHER,
            default => null,
        };
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function mergeExistingHealthcareAttributes(Customer $customer, array $validated): array
    {
        $existing = $customer->toArray();

        if (! array_key_exists('customer_sector', $validated)) {
            $validated['customer_sector'] = $existing['customer_sector'] ?? null;
        }
        if (! array_key_exists('healthcare_facility_type', $validated)) {
            $validated['healthcare_facility_type'] = $existing['healthcare_facility_type'] ?? null;
        }
        if (! array_key_exists('bed_capacity', $validated)) {
            $validated['bed_capacity'] = $existing['bed_capacity'] ?? null;
        }

        return $validated;
    }

    private function applyReadScope(Request $request, Builder $query): void
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof \App\Models\InternalUser) {
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

            if (
                $this->support->hasTable('contracts')
                && $this->support->hasColumn('contracts', 'customer_id')
                && $this->support->hasColumn('contracts', 'dept_id')
            ) {
                $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                    $subQuery->selectRaw('1')
                        ->from('contracts as scope_contracts')
                        ->whereColumn('scope_contracts.customer_id', 'customers.id')
                        ->whereIn('scope_contracts.dept_id', $allowedDeptIds);
                });
                $applied = true;
            }

            if (
                $this->support->hasTable('projects')
                && $this->support->hasColumn('projects', 'customer_id')
                && $this->support->hasColumn('projects', 'dept_id')
            ) {
                if ($applied) {
                    $scope->orWhereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_projects')
                            ->whereColumn('scope_projects.customer_id', 'customers.id')
                            ->whereIn('scope_projects.dept_id', $allowedDeptIds);
                    });
                } else {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_projects')
                            ->whereColumn('scope_projects.customer_id', 'customers.id')
                            ->whereIn('scope_projects.dept_id', $allowedDeptIds);
                    });
                }
                $applied = true;
            }

            if ($this->support->hasColumn('customers', 'created_by')) {
                if ($applied) {
                    $scope->orWhere('customers.created_by', $userId);
                } else {
                    $scope->where('customers.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    // ── KPI aggregation ───────────────────────────────────────────────────────

    private function buildCustomerKpis(Builder $baseQuery): array
    {
        // Subquery of scoped customer IDs (mirrors ContractDomainService pattern)
        $idSub = clone $baseQuery;
        $idSub->setEagerLoads([]);
        $idSub->getQuery()->columns = null;
        $idSub->getQuery()->orders  = null;
        $idSub->select('customers.id');

        // ── 1. Khách hàng mới trong tháng hiện tại ──────────────────────────
        $newThisMonth = 0;
        if ($this->support->hasColumn('customers', 'created_at')) {
            $newThisMonth = (int) (clone $baseQuery)
                ->whereYear('customers.created_at', now()->year)
                ->whereMonth('customers.created_at', now()->month)
                ->count();
        }

        // ── 2. Khách hàng đang có HĐ (SIGNED / RENEWED) + tổng GT ───────────
        $customersWithActiveContracts = 0;
        $totalActiveContractValue     = 0.0;
        if ($this->support->hasTable('contracts')
            && $this->support->hasColumn('contracts', 'customer_id')
            && $this->support->hasColumn('contracts', 'status')) {

            $customersWithActiveContracts = (int) DB::table('contracts')
                ->whereIn('customer_id', $idSub)
                ->whereRaw("UPPER(status) IN ('SIGNED', 'RENEWED')")
                ->distinct('customer_id')
                ->count('customer_id');

            if ($this->support->hasColumn('contracts', 'value')) {
                $valueExpr = $this->support->hasColumn('contracts', 'total_value')
                    ? 'COALESCE(value, total_value, 0)'
                    : 'COALESCE(value, 0)';
                $totalActiveContractValue = (float) DB::table('contracts')
                    ->whereIn('customer_id', $idSub)
                    ->whereRaw("UPPER(status) IN ('SIGNED', 'RENEWED')")
                    ->sum(DB::raw($valueExpr));
            }
        }

        // ── 3. Khách hàng chưa có HĐ nào ────────────────────────────────────
        $customersWithoutContracts = 0;
        if ($this->support->hasTable('contracts')
            && $this->support->hasColumn('contracts', 'customer_id')) {

            $withContractIds = DB::table('contracts')
                ->whereIn('customer_id', $idSub)
                ->distinct()
                ->pluck('customer_id');

            $customersWithoutContracts = (int) (clone $baseQuery)
                ->whereNotIn('customers.id', $withContractIds)
                ->count();
        }

        // ── 4. Khách hàng có cơ hội đang mở (removed — opportunity module retired) ───────
        $customersWithOpenOpps = 0;
        $openOppValue          = 0.0;

        // ── 5. Khách hàng đang có YC chưa đóng ─────────────────────────────
        $customersWithOpenCrc = 0;
        if ($this->support->hasTable('customer_request_cases')
            && $this->support->hasColumn('customer_request_cases', 'customer_id')
            && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {

            $closedStatuses = ['completed', 'customer_notified', 'not_executed'];
            $customersWithOpenCrc = (int) DB::table('customer_request_cases')
                ->whereIn('customer_id', $idSub)
                ->whereNull('deleted_at')
                ->whereNotIn('current_status_code', $closedStatuses)
                ->distinct('customer_id')
                ->count('customer_id');
        }

        return [
            'new_this_month'                    => $newThisMonth,
            'customers_with_active_contracts'   => $customersWithActiveContracts,
            'total_active_contract_value'       => $totalActiveContractValue,
            'customers_without_contracts'       => $customersWithoutContracts,
            'customers_with_open_opportunities' => $customersWithOpenOpps,
            'open_opp_value'                    => $openOppValue,
            'customers_with_open_crc'           => $customersWithOpenCrc,
        ];
    }
}
