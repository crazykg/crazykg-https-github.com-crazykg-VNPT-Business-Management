<?php

namespace App\Services\V5;

use App\Models\Contract;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Opportunity;
use App\Models\Project;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class V5DomainSupportService
{
    private const ROOT_DEPARTMENT_CODE = 'BGĐVT';
    private const MAX_DEPARTMENT_LEVEL = 2;
    private const SOLUTION_DEPARTMENT_CODE_PREFIX = 'PGP';
    private const SOLUTION_SUMMARY_TEAM_CODE = 'TTH';
    private const SOLUTION_CENTER_CODE_TOKENS = ['TTKDGIAIPHAP', 'TTKDGP', 'TTGP'];
    private const SOLUTION_CENTER_NAME_TOKEN = 'trungtamkinhdoanhgiaiphap';
    private const CONTRACT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_ALERT';
    private const CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_PAYMENT_ALERT';
    private const DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS = 30;
    private const DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS = 30;
    private const MIN_CONTRACT_EXPIRY_WARNING_DAYS = 1;
    private const MAX_CONTRACT_EXPIRY_WARNING_DAYS = 365;

    /**
     * @var array<int, string>
     */
    private const PROJECT_STATUSES = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];

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
    private const OPPORTUNITY_STAGES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

    public function missingTable(string $table): JsonResponse
    {
        return response()->json([
            'message' => "Table {$table} is not available. Run enterprise v5 migrations first.",
            'data' => [],
        ], 503);
    }

    public function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    public function hasColumn(string $table, string $column): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        try {
            return Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param array<int, string> $columns
     * @return array<int, string>
     */
    public function selectColumns(string $table, array $columns): array
    {
        return array_values(array_filter(
            $columns,
            fn (string $column): bool => $this->hasColumn($table, $column)
        ));
    }

    public function shouldPaginate(Request $request): bool
    {
        return $request->query->has('page') || $request->query->has('per_page');
    }

    public function shouldUseSimplePagination(Request $request): bool
    {
        return filter_var($request->query('simple', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return array{0:int,1:int}
     */
    public function resolvePaginationParams(Request $request, int $defaultPerPage = 20, int $maxPerPage = 200): array
    {
        $page = max(1, (int) $request->integer('page', 1));
        $perPage = max(1, min($maxPerPage, (int) $request->integer('per_page', $defaultPerPage)));

        return [$page, $perPage];
    }

    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    public function buildPaginationMeta(int $page, int $perPage, int $total): array
    {
        $safePage = max(1, $page);
        $safePerPage = max(1, $perPage);
        $totalPages = max(1, (int) ceil($total / $safePerPage));

        return [
            'page' => $safePage,
            'per_page' => $safePerPage,
            'total' => max(0, $total),
            'total_pages' => $totalPages,
        ];
    }

    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    public function buildSimplePaginationMeta(int $page, int $perPage, int $currentItemCount, bool $hasMorePages): array
    {
        $safePage = max(1, $page);
        $safePerPage = max(1, $perPage);
        $safeCount = max(0, $currentItemCount);
        $minimumTotal = (($safePage - 1) * $safePerPage) + $safeCount + ($hasMorePages ? 1 : 0);

        return [
            'page' => $safePage,
            'per_page' => $safePerPage,
            'total' => $minimumTotal,
            'total_pages' => $hasMorePages ? ($safePage + 1) : $safePage,
        ];
    }

    public function resolveSortDirection(Request $request): string
    {
        $raw = strtolower(trim((string) $request->query('sort_dir', 'desc')));

        return $raw === 'asc' ? 'asc' : 'desc';
    }

    /**
     * @param array<string, string> $allowed
     */
    public function resolveSortColumn(Request $request, array $allowed, string $fallback): string
    {
        $raw = trim((string) $request->query('sort_by', ''));
        if ($raw === '') {
            return $fallback;
        }

        return $allowed[$raw] ?? $fallback;
    }

    public function readFilterParam(Request $request, string $key, mixed $default = null): mixed
    {
        $filters = $request->query('filters');
        if (is_array($filters) && array_key_exists($key, $filters)) {
            return $filters[$key];
        }

        return $request->query($key, $default);
    }

    public function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    public function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    public function resolveContractExpiryWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS;
        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_expiry_warning_days')
        ) {
            return $fallback;
        }

        $rawValue = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_ALERT_INTEGRATION_PROVIDER)
            ->value('contract_expiry_warning_days');

        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }

    public function resolveContractPaymentWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS;
        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_payment_warning_days')
        ) {
            return $fallback;
        }

        $rawValue = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER)
            ->value('contract_payment_warning_days');

        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function filterPayloadByTableColumns(string $table, array $payload): array
    {
        $filtered = [];
        foreach ($payload as $column => $value) {
            if ($this->hasColumn($table, $column)) {
                $filtered[$column] = $value;
            }
        }

        return $filtered;
    }

    public function setAttributeIfColumn(Model $model, string $table, string $column, mixed $value): void
    {
        if ($this->hasColumn($table, $column)) {
            $model->setAttribute($column, $value);
        }
    }

    /**
     * @param array<int, string> $columns
     */
    public function setAttributeByColumns(Model $model, string $table, array $columns, mixed $value): void
    {
        foreach ($columns as $column) {
            if ($this->hasColumn($table, $column)) {
                $model->setAttribute($column, $value);

                return;
            }
        }
    }

    /**
     * @param array<string, mixed> $data
     * @param array<int, string> $keys
     */
    public function firstNonEmpty(array $data, array $keys, mixed $default = null): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
                return $data[$key];
            }
        }

        return $default;
    }

    public function canonicalDepartmentCode(string $deptCode): string
    {
        $trimmed = trim($deptCode);
        if ($this->isRootDepartmentCode($trimmed)) {
            return self::ROOT_DEPARTMENT_CODE;
        }

        return $trimmed;
    }

    public function isRootDepartmentCode(string $deptCode): bool
    {
        $normalized = function_exists('mb_strtoupper')
            ? mb_strtoupper(trim($deptCode), 'UTF-8')
            : strtoupper(trim($deptCode));
        $normalized = str_replace([' ', '-', '_'], '', $normalized);

        return in_array($normalized, [self::ROOT_DEPARTMENT_CODE, 'BGDVT'], true);
    }

    /**
     * @return array{0:?int,1:?string}
     */
    public function resolveDepartmentParentIdForWrite(string $deptCode, ?int $parentId, ?int $currentDepartmentId): array
    {
        if ($this->isRootDepartmentCode($deptCode)) {
            if ($parentId !== null) {
                return [null, 'Phòng ban BGĐVT không được có phòng ban cha.'];
            }

            return [null, null];
        }

        $rootDepartment = $this->resolveRootDepartment($currentDepartmentId);
        if (! $rootDepartment instanceof Department) {
            return [null, 'Không tìm thấy phòng ban gốc BGĐVT. Vui lòng tạo phòng ban BGĐVT trước.'];
        }

        $rootId = (int) $rootDepartment->id;
        $requiresSolutionCenterParent = $this->isSolutionDepartmentCode($deptCode)
            || $this->isSolutionSummaryTeamCode($deptCode);

        $solutionCenter = null;
        $solutionCenterId = null;
        if ($requiresSolutionCenterParent) {
            $solutionCenter = $this->resolveSolutionCenterDepartment($currentDepartmentId);
            if (! $solutionCenter instanceof Department) {
                return [null, 'Không tìm thấy Trung tâm Kinh doanh Giải pháp. Vui lòng tạo trước khi thêm PGP/TTH.'];
            }
            $solutionCenterId = (int) $solutionCenter->id;
        }

        if ($parentId === null) {
            $parentId = $requiresSolutionCenterParent ? $solutionCenterId : $rootId;
        }

        if ($parentId === null) {
            return [null, 'parent_id is required.'];
        }

        if ($currentDepartmentId !== null && $parentId === $currentDepartmentId) {
            return [null, 'parent_id cannot be self.'];
        }

        if ($currentDepartmentId !== null && $this->isDescendantDepartment($parentId, $currentDepartmentId)) {
            return [null, 'Phòng ban cha không hợp lệ (không được chọn phòng ban con).'];
        }

        $parentDepartment = Department::query()
            ->select(['id', 'parent_id'])
            ->find($parentId);
        if (! $parentDepartment instanceof Department) {
            return [null, 'parent_id is invalid.'];
        }

        if ($requiresSolutionCenterParent && $parentId !== $solutionCenterId) {
            return [null, 'Phòng ban mã PGP1/PGP2/TTH phải có cha là Trung tâm Kinh doanh Giải pháp.'];
        }

        $parentLevel = $this->resolveDepartmentLevelById((int) $parentDepartment->id);
        if ($parentLevel === null) {
            return [null, 'Không xác định được cấp của phòng ban cha.'];
        }

        $targetLevel = $parentLevel + 1;
        if ($targetLevel > self::MAX_DEPARTMENT_LEVEL) {
            return [null, 'Chỉ cho phép tối đa 3 cấp phòng ban (0,1,2).'];
        }

        $subtreeDepth = $currentDepartmentId !== null
            ? $this->resolveDepartmentSubtreeMaxDepth($currentDepartmentId)
            : 0;
        if (($targetLevel + $subtreeDepth) > self::MAX_DEPARTMENT_LEVEL) {
            return [null, 'Không thể chọn phòng ban cha này vì sẽ vượt quá 3 cấp (0,1,2).'];
        }

        return [$parentId, null];
    }

    public function buildDeptPath(Department $department): string
    {
        if (! $department->parent_id) {
            return $department->id.'/';
        }

        $parent = Department::query()->find($department->parent_id);
        $parentPath = $parent?->dept_path ?: ($department->parent_id.'/');

        return rtrim($parentPath, '/').'/'.$department->id.'/';
    }

    public function resolveEmployeeTable(): ?string
    {
        if ($this->hasTable('internal_users')) {
            return 'internal_users';
        }

        return null;
    }

    public function resolveEmployeeDepartmentColumn(?string $employeeTable): ?string
    {
        if ($employeeTable === null) {
            return null;
        }

        if ($this->hasColumn($employeeTable, 'department_id')) {
            return 'department_id';
        }

        if ($this->hasColumn($employeeTable, 'dept_id')) {
            return 'dept_id';
        }

        return null;
    }

    public function countEmployeesByDepartment(int $departmentId, string $employeeTable, string $departmentColumn): int
    {
        if ($departmentId <= 0 || ! $this->hasTable($employeeTable) || ! $this->hasColumn($employeeTable, $departmentColumn)) {
            return 0;
        }

        return (int) DB::table($employeeTable)
            ->where($departmentColumn, $departmentId)
            ->count();
    }

    public function isProjectDateRangeInvalid(?string $startDate, ?string $endDate): bool
    {
        if ($startDate === null || trim($startDate) === '' || $endDate === null || trim($endDate) === '') {
            return false;
        }

        $startTimestamp = strtotime($startDate);
        $endTimestamp = strtotime($endDate);

        if ($startTimestamp === false || $endTimestamp === false) {
            return false;
        }

        return $startTimestamp > $endTimestamp;
    }

    public function normalizePaymentCycle(string $cycle): string
    {
        $normalized = strtoupper(trim($cycle));

        return in_array($normalized, self::PAYMENT_CYCLES, true) ? $normalized : 'ONCE';
    }

    public function toProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper(trim($status));

        if ($this->usesLegacyProjectSchema()) {
            return match ($normalized) {
                'PLANNING', 'TRIAL', 'ONGOING' => 'ACTIVE',
                'WARRANTY', 'COMPLETED' => 'COMPLETED',
                'CANCELLED' => 'TERMINATED',
                default => 'ACTIVE',
            };
        }

        if ($normalized === 'PLANNING') {
            return 'TRIAL';
        }

        // Defensive mapping for older clients still sending legacy statuses.
        if ($normalized === 'ACTIVE') {
            return 'ONGOING';
        }
        if (in_array($normalized, ['TERMINATED', 'SUSPENDED', 'EXPIRED'], true)) {
            return 'CANCELLED';
        }

        return in_array($normalized, self::PROJECT_STATUSES, true) ? $normalized : 'TRIAL';
    }

    public function fromProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'PLANNING', 'TRIAL' => 'TRIAL',
            'ONGOING', 'ACTIVE' => 'ONGOING',
            'WARRANTY' => 'WARRANTY',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED', 'TERMINATED', 'SUSPENDED', 'EXPIRED' => 'CANCELLED',
            default => 'TRIAL',
        };
    }

    public function toContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        if ($this->usesLegacyContractSchema()) {
            return match ($normalized) {
                'DRAFT', 'PENDING' => 'DRAFT',
                'SIGNED' => 'SIGNED',
                'RENEWED', 'LIQUIDATED', 'EXPIRED', 'TERMINATED' => 'RENEWED',
                default => 'DRAFT',
            };
        }

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
    }

    public function fromContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'DRAFT', 'PENDING' => 'DRAFT',
            'SIGNED' => 'SIGNED',
            'RENEWED', 'EXPIRED', 'TERMINATED', 'LIQUIDATED' => 'RENEWED',
            default => 'DRAFT',
        };
    }

    public function toOpportunityStorageStage(string $stage): string
    {
        $normalized = strtoupper($stage);

        if ($this->usesLegacyOpportunitySchema()) {
            return match ($normalized) {
                'NEW' => 'LEAD',
                'PROPOSAL' => 'PROPOSAL',
                'NEGOTIATION' => 'NEGOTIATION',
                'WON' => 'CLOSED_WON',
                'LOST' => 'CLOSED_LOST',
                default => 'LEAD',
            };
        }

        return in_array($normalized, self::OPPORTUNITY_STAGES, true) ? $normalized : 'NEW';
    }

    public function fromOpportunityStorageStage(string $stage): string
    {
        $normalized = strtoupper($stage);

        return match ($normalized) {
            'LEAD', 'QUALIFIED', 'NEW' => 'NEW',
            'PROPOSAL' => 'PROPOSAL',
            'NEGOTIATION' => 'NEGOTIATION',
            'CLOSED_WON', 'WON' => 'WON',
            'CLOSED_LOST', 'LOST' => 'LOST',
            default => 'NEW',
        };
    }

    public function resolveDefaultOwnerId(): ?int
    {
        if ($this->hasTable('internal_users')) {
            $internalId = DB::table('internal_users')->orderBy('id')->value('id');
            if ($internalId !== null) {
                return (int) $internalId;
            }
        }

        if ($this->hasTable('users')) {
            $userId = DB::table('users')->orderBy('id')->value('id');
            if ($userId !== null) {
                return (int) $userId;
            }
        }

        return null;
    }

    public function ownerExists(int $ownerId): bool
    {
        if ($this->hasTable('internal_users')) {
            return DB::table('internal_users')->where('id', $ownerId)->exists();
        }

        if ($this->hasTable('users')) {
            return DB::table('users')->where('id', $ownerId)->exists();
        }

        return false;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<int, string> $keys
     */
    public function extractIntFromRecord(array $record, array $keys): ?int
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $record)) {
                continue;
            }

            $value = $this->parseNullableInt($record[$key]);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    public function resolveOpportunityDepartmentIdById(?int $opportunityId): ?int
    {
        if ($opportunityId === null || ! $this->hasTable('opportunities')) {
            return null;
        }

        $selects = ['id'];
        if ($this->hasColumn('opportunities', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->hasColumn('opportunities', 'department_id')) {
            $selects[] = 'department_id';
        }

        if (count($selects) <= 1) {
            return null;
        }

        $row = DB::table('opportunities')
            ->select($selects)
            ->where('id', $opportunityId)
            ->first();
        if ($row === null) {
            return null;
        }

        return $this->extractIntFromRecord((array) $row, ['dept_id', 'department_id']);
    }

    public function resolveProjectDepartmentIdById(?int $projectId): ?int
    {
        if ($projectId === null || ! $this->hasTable('projects')) {
            return null;
        }

        $selects = ['id'];
        if ($this->hasColumn('projects', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->hasColumn('projects', 'department_id')) {
            $selects[] = 'department_id';
        }
        if ($this->hasColumn('projects', 'opportunity_id')) {
            $selects[] = 'opportunity_id';
        }

        $row = DB::table('projects')
            ->select($selects)
            ->where('id', $projectId)
            ->first();
        if ($row === null) {
            return null;
        }

        $data = (array) $row;
        $departmentId = $this->extractIntFromRecord($data, ['dept_id', 'department_id']);
        if ($departmentId !== null) {
            return $departmentId;
        }

        $opportunityId = $this->extractIntFromRecord($data, ['opportunity_id']);

        return $this->resolveOpportunityDepartmentIdById($opportunityId);
    }

    /**
     * @param array<string, mixed> $record
     */
    public function resolveDepartmentIdForTableRecord(string $table, array $record): ?int
    {
        $normalizedTable = strtolower($table);
        if ($normalizedTable === 'contracts') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $projectId = $this->extractIntFromRecord($record, ['project_id']);

            return $this->resolveProjectDepartmentIdById($projectId);
        }

        if ($normalizedTable === 'projects') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $opportunityId = $this->extractIntFromRecord($record, ['opportunity_id']);

            return $this->resolveOpportunityDepartmentIdById($opportunityId);
        }

        if ($normalizedTable === 'opportunities') {
            return $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
        }

        if ($normalizedTable === 'documents' || $normalizedTable === 'support_requests') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $projectId = $this->extractIntFromRecord($record, ['project_id']);

            return $this->resolveProjectDepartmentIdById($projectId);
        }

        return $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
    }

    /**
     * @return array<int, string>
     */
    public function departmentRelationColumns(): array
    {
        return $this->selectColumns('departments', ['id', 'dept_code', 'dept_name']);
    }

    /**
     * @return array<int, string>
     */
    public function customerRelationColumns(): array
    {
        return $this->selectColumns('customers', ['id', 'customer_code', 'customer_name', 'company_name']);
    }

    /**
     * @return array<int, string>
     */
    public function projectRelationColumns(): array
    {
        return $this->selectColumns('projects', ['id', 'project_code', 'project_name', 'customer_id']);
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeDepartment(Department $department): array
    {
        $department->loadMissing(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())]);
        $data = $department->toArray();

        if (! array_key_exists('is_active', $data)) {
            $status = strtoupper((string) ($data['status'] ?? 'ACTIVE'));
            $data['is_active'] = $status === 'ACTIVE';
        } else {
            $data['is_active'] = (bool) $data['is_active'];
        }

        if (! array_key_exists('dept_path', $data) || empty($data['dept_path'])) {
            $data['dept_path'] = $this->buildDeptPath($department);
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeCustomer(Customer $customer): array
    {
        $data = $customer->toArray();
        $data['customer_name'] = (string) $this->firstNonEmpty($data, ['customer_name', 'company_name'], '');

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeVendor(Vendor $vendor): array
    {
        return $vendor->toArray();
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeProject(Project $project): array
    {
        $project->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())]);
        $data = $project->toArray();

        $data['status'] = $this->fromProjectStorageStatus((string) ($data['status'] ?? 'TRIAL'));

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeContract(Contract $contract): array
    {
        $contract->loadMissing([
            'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
            'project' => fn ($query) => $query->select($this->projectRelationColumns()),
        ]);

        $data = $contract->toArray();

        $data['contract_code'] = (string) $this->firstNonEmpty($data, ['contract_code', 'contract_number'], '');
        $data['value'] = (float) $this->firstNonEmpty($data, ['value', 'total_value'], 0);
        $data['payment_cycle'] = $this->normalizePaymentCycle((string) $this->firstNonEmpty($data, ['payment_cycle'], 'ONCE'));
        $data['status'] = $this->fromContractStorageStatus((string) ($data['status'] ?? 'DRAFT'));

        if ($this->firstNonEmpty($data, ['customer_id']) === null && isset($data['project']['customer_id'])) {
            $data['customer_id'] = $data['project']['customer_id'];
        }

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeOpportunity(Opportunity $opportunity): array
    {
        $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())]);
        $data = $opportunity->toArray();

        $data['amount'] = (float) $this->firstNonEmpty($data, ['amount', 'expected_value'], 0);
        $data['stage'] = $this->fromOpportunityStorageStage((string) ($data['stage'] ?? 'NEW'));

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    private function resolveRootDepartment(?int $excludeDepartmentId = null): ?Department
    {
        $departments = Department::query()
            ->select(['id', 'dept_code', 'parent_id'])
            ->when($excludeDepartmentId !== null, fn ($query) => $query->where('id', '!=', $excludeDepartmentId))
            ->orderBy('id')
            ->get();

        foreach ($departments as $department) {
            if ($this->isRootDepartmentCode((string) $department->dept_code)) {
                return $department;
            }
        }

        return null;
    }

    private function resolveSolutionCenterDepartment(?int $excludeDepartmentId = null): ?Department
    {
        $departments = Department::query()
            ->select(['id', 'dept_code', 'dept_name', 'parent_id'])
            ->when($excludeDepartmentId !== null, fn ($query) => $query->where('id', '!=', $excludeDepartmentId))
            ->orderBy('id')
            ->get();

        foreach ($departments as $department) {
            $codeToken = $this->normalizeDepartmentCodeToken((string) $department->dept_code);
            if (in_array($codeToken, self::SOLUTION_CENTER_CODE_TOKENS, true)) {
                return $department;
            }
        }

        foreach ($departments as $department) {
            $nameToken = $this->normalizeDepartmentNameToken((string) ($department->dept_name ?? ''));
            if (str_contains($nameToken, self::SOLUTION_CENTER_NAME_TOKEN)) {
                return $department;
            }
        }

        return null;
    }

    private function isSolutionDepartmentCode(string $deptCode): bool
    {
        $token = $this->normalizeDepartmentCodeToken($deptCode);
        if ($token === '') {
            return false;
        }

        return str_starts_with($token, self::SOLUTION_DEPARTMENT_CODE_PREFIX);
    }

    private function isSolutionSummaryTeamCode(string $deptCode): bool
    {
        return $this->normalizeDepartmentCodeToken($deptCode) === self::SOLUTION_SUMMARY_TEAM_CODE;
    }

    private function normalizeDepartmentCodeToken(string $deptCode): string
    {
        $normalized = function_exists('mb_strtoupper')
            ? mb_strtoupper(trim($deptCode), 'UTF-8')
            : strtoupper(trim($deptCode));

        return preg_replace('/[\s\-_]+/u', '', $normalized) ?? '';
    }

    private function normalizeDepartmentNameToken(string $deptName): string
    {
        $ascii = Str::ascii($deptName);
        $normalized = strtolower(trim($ascii));

        return preg_replace('/[^a-z0-9]+/', '', $normalized) ?? '';
    }

    private function resolveDepartmentLevelById(int $departmentId): ?int
    {
        $department = Department::query()
            ->select(['id', 'parent_id'])
            ->find($departmentId);
        if (! $department instanceof Department) {
            return null;
        }

        $level = 0;
        $visited = [];
        $cursor = $department;

        while ($cursor->parent_id !== null) {
            $cursorId = (int) $cursor->id;
            if (isset($visited[$cursorId])) {
                return null;
            }
            $visited[$cursorId] = true;

            $parent = Department::query()
                ->select(['id', 'parent_id'])
                ->find((int) $cursor->parent_id);
            if (! $parent instanceof Department) {
                return null;
            }

            $level++;
            if ($level > 50) {
                return null;
            }

            $cursor = $parent;
        }

        return $level;
    }

    private function isDescendantDepartment(int $candidateParentId, int $departmentId): bool
    {
        $cursorId = $candidateParentId;
        $visited = [];

        while ($cursorId > 0) {
            if ($cursorId === $departmentId) {
                return true;
            }
            if (isset($visited[$cursorId])) {
                return false;
            }
            $visited[$cursorId] = true;

            $parentId = $this->parseNullableInt(Department::query()
                ->whereKey($cursorId)
                ->value('parent_id'));
            if ($parentId === null) {
                return false;
            }

            $cursorId = $parentId;
        }

        return false;
    }

    private function resolveDepartmentSubtreeMaxDepth(int $departmentId): int
    {
        $rows = Department::query()
            ->select(['id', 'parent_id'])
            ->get();

        $childrenByParent = [];
        foreach ($rows as $row) {
            $parentId = $this->parseNullableInt($row->parent_id);
            if ($parentId === null) {
                continue;
            }
            $childrenByParent[$parentId][] = (int) $row->id;
        }

        $maxDepth = 0;
        $stack = [[$departmentId, 0]];
        $visited = [];

        while ($stack !== []) {
            [$currentId, $depth] = array_pop($stack);
            if (isset($visited[$currentId])) {
                continue;
            }
            $visited[$currentId] = true;
            if ($depth > $maxDepth) {
                $maxDepth = $depth;
            }

            foreach ($childrenByParent[$currentId] ?? [] as $childId) {
                $stack[] = [$childId, $depth + 1];
            }
        }

        return $maxDepth;
    }

    private function usesLegacyProjectSchema(): bool
    {
        $statusEnumValues = $this->projectStatusEnumValues();
        if ($statusEnumValues !== null && $statusEnumValues !== []) {
            if (in_array('PLANNING', $statusEnumValues, true) || in_array('ONGOING', $statusEnumValues, true)) {
                return false;
            }

            if (in_array('ACTIVE', $statusEnumValues, true) || in_array('TERMINATED', $statusEnumValues, true)) {
                return true;
            }
        }

        // Default to non-legacy when enum introspection is unavailable to avoid writing invalid values
        // (ACTIVE/TERMINATED) into modern schemas (TRIAL/ONGOING/WARRANTY/COMPLETED/CANCELLED).
        return false;
    }

    /**
     * @return array<int, string>|null
     */
    private function projectStatusEnumValues(): ?array
    {
        if (! $this->hasTable('projects') || ! $this->hasColumn('projects', 'status')) {
            return null;
        }

        try {
            $database = DB::connection()->getDatabaseName();
            if (! is_string($database) || $database === '') {
                return null;
            }

            $columnType = DB::table('information_schema.columns')
                ->where('table_schema', $database)
                ->where('table_name', 'projects')
                ->where('column_name', 'status')
                ->value('column_type');

            if (! is_string($columnType) || ! str_starts_with(strtolower($columnType), 'enum(')) {
                return null;
            }

            preg_match_all("/'([^']+)'/", $columnType, $matches);

            if (! isset($matches[1]) || ! is_array($matches[1])) {
                return null;
            }

            $values = array_values(array_unique(array_map(
                static fn (string $value): string => strtoupper(trim($value)),
                $matches[1]
            )));

            return $values === [] ? null : $values;
        } catch (\Throwable) {
            return null;
        }
    }

    private function usesLegacyContractSchema(): bool
    {
        return $this->hasColumn('contracts', 'contract_number') || $this->hasColumn('contracts', 'total_value');
    }

    private function usesLegacyOpportunitySchema(): bool
    {
        return $this->hasColumn('opportunities', 'expected_value') || $this->hasColumn('opportunities', 'owner_id');
    }
}
