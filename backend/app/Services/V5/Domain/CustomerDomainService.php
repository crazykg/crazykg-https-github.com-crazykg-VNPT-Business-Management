<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerDomainService
{
    use ResolvesValidatedInput;

    private const AUTO_CUSTOMER_CODE_MAX_LENGTH = 100;
    private const AUTO_BED_CAPACITY_MIN = 100;
    private const AUTO_BED_CAPACITY_MAX = 500;
    private const CUSTOMER_SECTOR_HEALTHCARE = 'HEALTHCARE';
    private const CUSTOMER_SECTOR_GOVERNMENT = 'GOVERNMENT';
    private const CUSTOMER_SECTOR_INDIVIDUAL = 'INDIVIDUAL';
    private const CUSTOMER_SECTOR_OTHER = 'OTHER';
    private const HEALTHCARE_FACILITY_PUBLIC_HOSPITAL = 'PUBLIC_HOSPITAL';
    private const HEALTHCARE_FACILITY_PRIVATE_HOSPITAL = 'PRIVATE_HOSPITAL';
    private const HEALTHCARE_FACILITY_MEDICAL_CENTER = 'MEDICAL_CENTER';
    private const HEALTHCARE_FACILITY_PRIVATE_CLINIC = 'PRIVATE_CLINIC';
    private const HEALTHCARE_FACILITY_TYT_PKDK = 'TYT_PKDK';
    private const HEALTHCARE_FACILITY_OTHER = 'OTHER';
    private const LEGACY_HEALTHCARE_FACILITY_HOSPITAL_TTYT = 'HOSPITAL_TTYT';
    private const LEGACY_HEALTHCARE_FACILITY_TYT_CLINIC = 'TYT_CLINIC';

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
                'customer_code_auto_generated',
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

        $customerSectorFilter = collect(explode(',', (string) ($this->support->readFilterParam($request, 'customer_sector', '') ?? '')))
            ->map(fn ($value): string => strtoupper(trim((string) $value)))
            ->filter(fn (string $value): bool => in_array($value, [
                self::CUSTOMER_SECTOR_HEALTHCARE,
                self::CUSTOMER_SECTOR_GOVERNMENT,
                self::CUSTOMER_SECTOR_INDIVIDUAL,
                self::CUSTOMER_SECTOR_OTHER,
            ], true))
            ->values()
            ->all();

        if ($customerSectorFilter !== []) {
            $this->applyCustomerSectorFilter($query, $customerSectorFilter);
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'customers.id',
            'customer_code' => 'customers.customer_code',
            'customer_name' => 'customers.customer_name',
            'customer_sector' => 'customers.customer_sector',
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
            'customer_code' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_sector' => ['nullable', 'string', Rule::in([
                self::CUSTOMER_SECTOR_HEALTHCARE,
                self::CUSTOMER_SECTOR_GOVERNMENT,
                self::CUSTOMER_SECTOR_INDIVIDUAL,
                self::CUSTOMER_SECTOR_OTHER,
            ])],
            'healthcare_facility_type' => ['nullable', 'string', Rule::in($this->allowedHealthcareFacilityTypes())],
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
        $validated = $this->validatedInput($request);
        [$customerSector, $facilityType, $bedCapacity] = $this->normalizeHealthcareAttributes(
            $validated,
            $validated['customer_name'] ?? null
        );
        [$customerCode, $customerCodeAutoGenerated] = $this->resolveCustomerCodePayload(
            $validated['customer_code'] ?? null,
            $validated['customer_name'] ?? null,
            null
        );

        $customer = new Customer();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $uuid);
        $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $customerCode);
        $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code_auto_generated', $customerCodeAutoGenerated);
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
            'customer_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'customer_sector' => ['sometimes', 'nullable', 'string', Rule::in([
                self::CUSTOMER_SECTOR_HEALTHCARE,
                self::CUSTOMER_SECTOR_GOVERNMENT,
                self::CUSTOMER_SECTOR_INDIVIDUAL,
                self::CUSTOMER_SECTOR_OTHER,
            ])],
            'healthcare_facility_type' => ['sometimes', 'nullable', 'string', Rule::in($this->allowedHealthcareFacilityTypes())],
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
        $validated = $this->validatedInput($request);
        $validated = $this->mergeExistingHealthcareAttributes($customer, $validated);
        [$customerSector, $facilityType, $bedCapacity] = $this->normalizeHealthcareAttributes(
            $validated,
            $validated['customer_name'] ?? $customer->customer_name ?? $customer->company_name ?? null
        );
        [$customerCode, $customerCodeAutoGenerated] = $this->resolveCustomerCodePayload(
            array_key_exists('customer_code', $validated) ? $validated['customer_code'] : $customer->customer_code,
            $validated['customer_name'] ?? $customer->customer_name ?? $customer->company_name ?? null,
            $customer->id
        );

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('customer_code', $validated)) {
            $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code', $customerCode);
            $this->support->setAttributeIfColumn($customer, 'customers', 'customer_code_auto_generated', $customerCodeAutoGenerated);
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
    private function normalizeHealthcareAttributes(array $payload, ?string $customerName = null): array
    {
        $customerSector = $this->normalizeCustomerSector($payload['customer_sector'] ?? null);
        $facilityType = $this->normalizeHealthcareFacilityType(
            $payload['healthcare_facility_type'] ?? null,
            $customerName
        );
        $bedCapacity = array_key_exists('bed_capacity', $payload) && $payload['bed_capacity'] !== null
            ? (int) $payload['bed_capacity']
            : null;

        if ($customerSector === self::CUSTOMER_SECTOR_HEALTHCARE && $facilityType === null) {
            throw ValidationException::withMessages([
                'healthcare_facility_type' => ['Vui lòng chọn loại hình cơ sở y tế.'],
            ]);
        }

        if ($customerSector !== self::CUSTOMER_SECTOR_HEALTHCARE) {
            return [$customerSector, null, null];
        }

        if (! $this->healthcareFacilitySupportsBedCapacity($facilityType)) {
            $bedCapacity = null;
        } elseif ($bedCapacity === null) {
            $bedCapacity = $this->generateRandomBedCapacity();
        }

        return [$customerSector, $facilityType, $bedCapacity];
    }

    private function generateRandomBedCapacity(): int
    {
        return random_int(self::AUTO_BED_CAPACITY_MIN, self::AUTO_BED_CAPACITY_MAX);
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

    private function normalizeHealthcareFacilityType(mixed $value, ?string $customerName = null): ?string
    {
        $normalized = strtoupper(trim((string) $value));
        $inferred = $this->inferHealthcareFacilityType($customerName);

        return match ($normalized) {
            self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL => self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL,
            self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL => self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL,
            self::HEALTHCARE_FACILITY_MEDICAL_CENTER => self::HEALTHCARE_FACILITY_MEDICAL_CENTER,
            self::HEALTHCARE_FACILITY_PRIVATE_CLINIC => self::HEALTHCARE_FACILITY_PRIVATE_CLINIC,
            self::HEALTHCARE_FACILITY_TYT_PKDK => self::HEALTHCARE_FACILITY_TYT_PKDK,
            self::HEALTHCARE_FACILITY_OTHER => self::HEALTHCARE_FACILITY_OTHER,
            self::LEGACY_HEALTHCARE_FACILITY_HOSPITAL_TTYT => $inferred ?? self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL,
            self::LEGACY_HEALTHCARE_FACILITY_TYT_CLINIC => $inferred ?? self::HEALTHCARE_FACILITY_TYT_PKDK,
            default => null,
        };
    }

    /**
     * @return array<int, string>
     */
    private function allowedHealthcareFacilityTypes(): array
    {
        return [
            self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL,
            self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL,
            self::HEALTHCARE_FACILITY_MEDICAL_CENTER,
            self::HEALTHCARE_FACILITY_PRIVATE_CLINIC,
            self::HEALTHCARE_FACILITY_TYT_PKDK,
            self::HEALTHCARE_FACILITY_OTHER,
            self::LEGACY_HEALTHCARE_FACILITY_HOSPITAL_TTYT,
            self::LEGACY_HEALTHCARE_FACILITY_TYT_CLINIC,
        ];
    }

    private function healthcareFacilitySupportsBedCapacity(?string $facilityType): bool
    {
        return in_array($facilityType, [
            self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL,
            self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL,
            self::HEALTHCARE_FACILITY_MEDICAL_CENTER,
        ], true);
    }

    private function inferHealthcareFacilityType(?string $customerName): ?string
    {
        $normalizedText = $this->normalizeLookupText($customerName);
        $normalizedToken = str_replace(' ', '', $normalizedText);

        if ($normalizedText === '') {
            return null;
        }

        $hasPrivateMarker = str_contains($normalizedText, 'tu nhan')
            || str_contains($normalizedText, 'ngoai cong lap')
            || str_contains($normalizedText, 'private')
            || str_contains($normalizedText, 'quoc te')
            || str_contains($normalizedToken, 'tunhan')
            || str_contains($normalizedToken, 'ngoaiconglap')
            || str_contains($normalizedToken, 'private')
            || str_contains($normalizedToken, 'quocte');

        if (str_contains($normalizedText, 'benh vien') || str_contains($normalizedToken, 'benhvien')) {
            return $hasPrivateMarker
                ? self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL
                : self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL;
        }

        if (
            str_contains($normalizedText, 'trung tam y te')
            || str_contains($normalizedToken, 'trungtamyte')
            || str_contains($normalizedToken, 'ttyt')
        ) {
            return self::HEALTHCARE_FACILITY_MEDICAL_CENTER;
        }

        if (
            str_contains($normalizedText, 'phong kham da khoa')
            || str_contains($normalizedText, 'pkdk')
            || str_contains($normalizedText, 'tram y te')
            || str_contains($normalizedToken, 'phongkhamdakhoa')
            || str_contains($normalizedToken, 'pkdk')
            || str_contains($normalizedToken, 'tramyte')
            || $normalizedToken === 'tyt'
        ) {
            return self::HEALTHCARE_FACILITY_TYT_PKDK;
        }

        if (
            str_contains($normalizedText, 'phong kham')
            || str_contains($normalizedToken, 'phongkham')
            || str_contains($normalizedToken, 'clinic')
        ) {
            return self::HEALTHCARE_FACILITY_PRIVATE_CLINIC;
        }

        return null;
    }

    private function normalizeLookupText(?string $value): string
    {
        $normalized = Str::of((string) ($value ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->trim()
            ->value();

        return preg_replace('/\s+/', ' ', $normalized) ?? '';
    }

    private function normalizeCodeFragment(?string $value): string
    {
        $normalized = Str::of((string) ($value ?? ''))
            ->ascii()
            ->upper()
            ->replaceMatches('/[^A-Z0-9]+/', '_')
            ->trim('_')
            ->value();

        return preg_replace('/_+/', '_', $normalized) ?? '';
    }

    private function normalizeCustomerCodeInput(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized !== '' ? $normalized : null;
    }

    /**
     * @return array{0: string, 1: bool}
     */
    private function resolveCustomerCodePayload(mixed $inputCode, ?string $customerName, ?int $ignoreId): array
    {
        $customerCode = $this->normalizeCustomerCodeInput($inputCode);
        if ($customerCode !== null) {
            if ($this->customerCodeExists($customerCode, $ignoreId)) {
                throw ValidationException::withMessages([
                    'customer_code' => ['Mã khách hàng đã tồn tại.'],
                ]);
            }

            return [$customerCode, false];
        }

        return [$this->generateUniqueCustomerCode($customerName, $ignoreId), true];
    }

    private function customerCodeExists(string $customerCode, ?int $ignoreId = null): bool
    {
        if (
            trim($customerCode) === ''
            || ! $this->support->hasTable('customers')
            || ! $this->support->hasColumn('customers', 'customer_code')
        ) {
            return false;
        }

        $query = Customer::query()
            ->whereNotNull('customer_code')
            ->whereRaw('UPPER(TRIM(customer_code)) = ?', [mb_strtoupper(trim($customerCode), 'UTF-8')]);

        if ($ignoreId !== null) {
            $query->where('id', '<>', $ignoreId);
        }

        if ($this->support->hasColumn('customers', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }

    private function generateUniqueCustomerCode(?string $customerName, ?int $ignoreId = null): string
    {
        $baseCode = $this->buildAutoCustomerCodeBase($customerName);
        $candidate = $baseCode;
        $counter = 1;

        while ($this->customerCodeExists($candidate, $ignoreId)) {
            $counter += 1;
            $suffix = '_'.$counter;
            $prefixLength = self::AUTO_CUSTOMER_CODE_MAX_LENGTH - mb_strlen($suffix, 'UTF-8');
            $candidate = mb_substr($baseCode, 0, max(1, $prefixLength), 'UTF-8').$suffix;
        }

        return $candidate;
    }

    private function buildAutoCustomerCodeBase(?string $customerName): string
    {
        $normalizedName = $this->normalizeCodeFragment($customerName);
        if ($normalizedName === '') {
            return 'KHACH_HANG';
        }

        $prefixRules = [
            ['TRUNG_TAM_Y_TE', 'TTYT'],
            ['TTYT', 'TTYT'],
            ['BENH_VIEN_DA_KHOA', 'BVĐK'],
            ['TRAM_Y_TE', 'TYT'],
            ['PHONG_KHAM_DA_KHOA', 'PKDK'],
            ['PKDK', 'PKDK'],
            ['PHONG_KHAM', 'PK'],
            ['BENH_VIEN', 'BV'],
        ];

        foreach ($prefixRules as [$pattern, $prefix]) {
            if ($normalizedName === $pattern) {
                return $prefix;
            }

            $needle = $pattern.'_';
            if (str_starts_with($normalizedName, $needle)) {
                $tail = trim(substr($normalizedName, strlen($needle)), '_');

                return $tail !== '' ? $prefix.'_'.$tail : $prefix;
            }
        }

        return $normalizedName;
    }

    private function inferCustomerSectorFromName(?string $customerName): string
    {
        $normalized = $this->normalizeLookupText($customerName);
        if ($normalized === '') {
            return self::CUSTOMER_SECTOR_OTHER;
        }

        foreach (['benh vien', 'trung tam y te', 'tram y te', 'phong kham', 'pkdk'] as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return self::CUSTOMER_SECTOR_HEALTHCARE;
            }
        }

        return self::CUSTOMER_SECTOR_OTHER;
    }

    private function resolveCustomerSectorForKpi(mixed $value, ?string $customerName): string
    {
        $normalized = $this->normalizeCustomerSector($value);

        if ($normalized !== self::CUSTOMER_SECTOR_OTHER) {
            return $normalized;
        }

        return $this->inferCustomerSectorFromName($customerName);
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

    /**
     * @param array<int, string> $customerSectorFilter
     */
    private function applyCustomerSectorFilter(Builder $query, array $customerSectorFilter): void
    {
        $hasSectorColumn = $this->support->hasColumn('customers', 'customer_sector');
        $normalizedSectorSql = $hasSectorColumn ? $this->normalizedCustomerSectorSql() : null;

        $query->where(function (Builder $sectorScope) use ($customerSectorFilter, $normalizedSectorSql): void {
            foreach ($customerSectorFilter as $sector) {
                $sectorScope->orWhere(function (Builder $matchedSectorScope) use ($sector, $normalizedSectorSql): void {
                    if ($sector === self::CUSTOMER_SECTOR_HEALTHCARE) {
                        $this->applyHealthcareSectorCondition($matchedSectorScope, $normalizedSectorSql);

                        return;
                    }

                    if ($sector === self::CUSTOMER_SECTOR_OTHER) {
                        $this->applyOtherSectorCondition($matchedSectorScope, $normalizedSectorSql);

                        return;
                    }

                    if ($normalizedSectorSql === null) {
                        $matchedSectorScope->whereRaw('1 = 0');

                        return;
                    }

                    $matchedSectorScope->whereRaw("{$normalizedSectorSql} = ?", [$sector]);
                });
            }
        });
    }

    private function applyHealthcareSectorCondition(Builder $query, ?string $normalizedSectorSql): void
    {
        if ($normalizedSectorSql === null) {
            $this->applyHealthcareNameInferenceCondition($query);

            return;
        }

        $query->where(function (Builder $healthcareScope) use ($normalizedSectorSql): void {
            $healthcareScope->whereRaw("{$normalizedSectorSql} = ?", [self::CUSTOMER_SECTOR_HEALTHCARE])
                ->orWhere(function (Builder $inferredHealthcareScope) use ($normalizedSectorSql): void {
                    $inferredHealthcareScope->whereRaw("{$normalizedSectorSql} = ?", [self::CUSTOMER_SECTOR_OTHER]);
                    $this->applyHealthcareNameInferenceCondition($inferredHealthcareScope);
                });
        });
    }

    private function applyOtherSectorCondition(Builder $query, ?string $normalizedSectorSql): void
    {
        if ($normalizedSectorSql === null) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->whereRaw("{$normalizedSectorSql} = ?", [self::CUSTOMER_SECTOR_OTHER]);
        $this->applyNonHealthcareNameCondition($query);
    }

    private function applyHealthcareNameInferenceCondition(Builder $query): void
    {
        $searchColumns = $this->customerSectorSearchColumns();
        if ($searchColumns === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $keywords = $this->healthcareNameLikeKeywords();
        $query->where(function (Builder $nameScope) use ($searchColumns, $keywords): void {
            foreach ($searchColumns as $column) {
                foreach ($keywords as $keyword) {
                    $nameScope->orWhereRaw("LOWER(COALESCE(customers.{$column}, '')) LIKE ?", [$keyword]);
                }
            }
        });
    }

    private function applyNonHealthcareNameCondition(Builder $query): void
    {
        $searchColumns = $this->customerSectorSearchColumns();
        if ($searchColumns === []) {
            return;
        }

        $keywords = $this->healthcareNameLikeKeywords();
        $query->where(function (Builder $nameScope) use ($searchColumns, $keywords): void {
            foreach ($searchColumns as $column) {
                foreach ($keywords as $keyword) {
                    $nameScope->whereRaw("LOWER(COALESCE(customers.{$column}, '')) NOT LIKE ?", [$keyword]);
                }
            }
        });
    }

    /**
     * @return array<int, string>
     */
    private function customerSectorSearchColumns(): array
    {
        return array_values(array_filter(
            ['customer_name', 'company_name'],
            fn (string $column): bool => $this->support->hasColumn('customers', $column)
        ));
    }

    /**
     * @return array<int, string>
     */
    private function healthcareNameLikeKeywords(): array
    {
        return [
            '%benh vien%',
            '%bệnh viện%',
            '%trung tam y te%',
            '%trung tâm y tế%',
            '%tram y te%',
            '%trạm y tế%',
            '%phong kham%',
            '%phòng khám%',
            '%pkdk%',
        ];
    }

    private function normalizedCustomerSectorSql(): string
    {
        return "CASE UPPER(COALESCE(NULLIF(TRIM(customers.customer_sector), ''), 'OTHER')) "
            ."WHEN 'HEALTHCARE' THEN 'HEALTHCARE' "
            ."WHEN 'GOVERNMENT' THEN 'GOVERNMENT' "
            ."WHEN 'INDIVIDUAL' THEN 'INDIVIDUAL' "
            ."ELSE 'OTHER' END";
    }

    // ── KPI aggregation ───────────────────────────────────────────────────────

    private function buildCustomerKpis(Builder $baseQuery): array
    {
        $kpiQuery = clone $baseQuery;
        $kpiQuery->setEagerLoads([]);
        $kpiQuery->getQuery()->columns = null;
        $kpiQuery->getQuery()->orders = null;
        $kpiQuery->select($this->support->selectColumns('customers', [
            'id',
            'customer_name',
            'company_name',
            'customer_sector',
            'healthcare_facility_type',
        ]));

        $rows = $kpiQuery->get();
        $totalCustomers = 0;
        $healthcareCustomers = 0;
        $governmentCustomers = 0;
        $individualCustomers = 0;
        $healthcareBreakdown = [
            'public_hospital' => 0,
            'private_hospital' => 0,
            'medical_center' => 0,
            'private_clinic' => 0,
            'tyt_pkdk' => 0,
            'other' => 0,
        ];

        foreach ($rows as $customer) {
            $customerName = (string) ($customer->customer_name ?? $customer->company_name ?? '');
            $sector = $this->resolveCustomerSectorForKpi($customer->customer_sector ?? null, $customerName);

            if ($sector === self::CUSTOMER_SECTOR_HEALTHCARE) {
                $healthcareCustomers += 1;

                $facilityType = $this->normalizeHealthcareFacilityType(
                    $customer->healthcare_facility_type ?? null,
                    $customerName
                ) ?? $this->inferHealthcareFacilityType($customerName) ?? self::HEALTHCARE_FACILITY_OTHER;

                $breakdownKey = match ($facilityType) {
                    self::HEALTHCARE_FACILITY_PUBLIC_HOSPITAL => 'public_hospital',
                    self::HEALTHCARE_FACILITY_PRIVATE_HOSPITAL => 'private_hospital',
                    self::HEALTHCARE_FACILITY_MEDICAL_CENTER => 'medical_center',
                    self::HEALTHCARE_FACILITY_PRIVATE_CLINIC => 'private_clinic',
                    self::HEALTHCARE_FACILITY_TYT_PKDK => 'tyt_pkdk',
                    default => 'other',
                };

                $healthcareBreakdown[$breakdownKey] += 1;
                continue;
            }

            if ($sector === self::CUSTOMER_SECTOR_GOVERNMENT) {
                $governmentCustomers += 1;
                continue;
            }

            if ($sector === self::CUSTOMER_SECTOR_INDIVIDUAL) {
                $individualCustomers += 1;
            }
        }

        $totalCustomers = $healthcareCustomers + $governmentCustomers + $individualCustomers;

        return [
            'total_customers' => $totalCustomers,
            'healthcare_customers' => $healthcareCustomers,
            'government_customers' => $governmentCustomers,
            'individual_customers' => $individualCustomers,
            'healthcare_breakdown' => $healthcareBreakdown,
        ];
    }
}
