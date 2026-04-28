<?php

namespace App\Services\V5;

use App\Models\Contract;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Project;
use App\Models\Vendor;
use App\Services\V5\Support\LifecycleSupport;
use App\Services\V5\Support\OwnershipResolver;
use App\Services\V5\Support\PayloadMutationSupport;
use App\Services\V5\Support\QueryRequestSupport;
use App\Services\V5\Support\SchemaCapabilityService;
use App\Services\V5\Support\SettingsResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class V5DomainSupportService
{
    private const ROOT_DEPARTMENT_CODE = 'BGĐVT';
    private const MAX_DEPARTMENT_LEVEL = 2;
    private const SOLUTION_DEPARTMENT_CODE_PREFIX = 'PGP';
    private const SOLUTION_SUMMARY_TEAM_CODE = 'TTH';
    private const SOLUTION_CENTER_CODE_TOKENS = ['TTKDGIAIPHAP', 'TTKDGP', 'TTGP'];
    private const SOLUTION_CENTER_NAME_TOKEN = 'trungtamkinhdoanhgiaiphap';
    public function __construct(
        private readonly SchemaCapabilityService $schema,
        private readonly QueryRequestSupport $querySupport,
        private readonly PayloadMutationSupport $payloadSupport,
        private readonly SettingsResolver $settingsResolver,
        private readonly OwnershipResolver $ownershipResolver,
        private readonly LifecycleSupport $lifecycleSupport,
    ) {}
    public function missingTable(string $table): JsonResponse
    {
        return response()->json([
            'message' => "Table {$table} is not available. Run enterprise v5 migrations first.",
            'data' => [],
        ], 503);
    }
    public function hasTable(string $table): bool
    {
        return $this->schema->hasTable($table);
    }
    public function hasColumn(string $table, string $column): bool
    {
        return $this->schema->hasColumn($table, $column);
    }

    /**
     * @param array<int, string> $columns
     * @return array<int, string>
     */
    public function selectColumns(string $table, array $columns): array
    {
        return $this->schema->selectColumns($table, $columns);
    }
    public function shouldPaginate(Request $request): bool
    {
        return $this->querySupport->shouldPaginate($request);
    }
    public function shouldUseSimplePagination(Request $request): bool
    {
        return $this->querySupport->shouldUseSimplePagination($request);
    }
    /**
     * @return array{0:int,1:int}
     */
    public function resolvePaginationParams(Request $request, int $defaultPerPage = 20, int $maxPerPage = 200): array
    {
        return $this->querySupport->resolvePaginationParams($request, $defaultPerPage, $maxPerPage);
    }
    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    public function buildPaginationMeta(int $page, int $perPage, int $total): array
    {
        return $this->querySupport->buildPaginationMeta($page, $perPage, $total);
    }
    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    public function buildSimplePaginationMeta(int $page, int $perPage, int $currentItemCount, bool $hasMorePages): array
    {
        return $this->querySupport->buildSimplePaginationMeta($page, $perPage, $currentItemCount, $hasMorePages);
    }
    public function resolveSortDirection(Request $request): string
    {
        return $this->querySupport->resolveSortDirection($request);
    }
    /**
     * @param array<string, string> $allowed
     */
    public function resolveSortColumn(Request $request, array $allowed, string $fallback): string
    {
        return $this->querySupport->resolveSortColumn($request, $allowed, $fallback);
    }
    public function readFilterParam(Request $request, string $key, mixed $default = null): mixed
    {
        return $this->querySupport->readFilterParam($request, $key, $default);
    }
    public function parseNullableInt(mixed $value): ?int
    {
        return $this->payloadSupport->parseNullableInt($value);
    }
    public function normalizeNullableString(mixed $value): ?string
    {
        return $this->payloadSupport->normalizeNullableString($value);
    }
    public function resolveContractExpiryWarningDays(): int
    {
        return $this->settingsResolver->resolveContractExpiryWarningDays();
    }
    public function resolveContractPaymentWarningDays(): int
    {
        return $this->settingsResolver->resolveContractPaymentWarningDays();
    }
    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function filterPayloadByTableColumns(string $table, array $payload): array
    {
        return $this->payloadSupport->filterPayloadByTableColumns($table, $payload);
    }
    public function setAttributeIfColumn(Model $model, string $table, string $column, mixed $value): void
    {
        $this->payloadSupport->setAttributeIfColumn($model, $table, $column, $value);
    }

    /**
     * @param array<int, string> $columns
     */
    public function setAttributeByColumns(Model $model, string $table, array $columns, mixed $value): void
    {
        $this->payloadSupport->setAttributeByColumns($model, $table, $columns, $value);
    }

    /**
     * @param array<string, mixed> $data
     * @param array<int, string> $keys
     */
    public function firstNonEmpty(array $data, array $keys, mixed $default = null): mixed
    {
        return $this->payloadSupport->firstNonEmpty($data, $keys, $default);
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
     * @return array{id:int,dept_code:?string,dept_name:?string}|null
     */
    public function resolveOwnershipDepartmentById(?int $departmentId): ?array
    {
        if ($departmentId === null || ! $this->hasTable('departments')) {
            return null;
        }

        $department = Department::query()
            ->select(['id', 'dept_code', 'dept_name', 'parent_id'])
            ->when(
                $this->hasColumn('departments', 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->find($departmentId);

        if (! $department instanceof Department) {
            return null;
        }

        $ownershipDepartment = $department;
        $parentDepartmentId = $this->parseNullableInt($department->parent_id);
        if ($parentDepartmentId !== null) {
            $parentDepartment = Department::query()
                ->select(['id', 'dept_code', 'dept_name', 'parent_id'])
                ->when(
                    $this->hasColumn('departments', 'deleted_at'),
                    fn ($query) => $query->whereNull('deleted_at')
                )
                ->find($parentDepartmentId);

            if ($this->isSolutionCenterDepartment($parentDepartment)) {
                $ownershipDepartment = $parentDepartment;
            }
        }

        return [
            'id' => (int) $ownershipDepartment->id,
            'dept_code' => $this->normalizeNullableString($ownershipDepartment->dept_code),
            'dept_name' => $this->normalizeNullableString($ownershipDepartment->dept_name),
        ];
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
        return $this->ownershipResolver->resolveEmployeeTable();
    }
    public function resolveEmployeeDepartmentColumn(?string $employeeTable): ?string
    {
        return $this->ownershipResolver->resolveEmployeeDepartmentColumn($employeeTable);
    }
    public function countEmployeesByDepartment(int $departmentId, string $employeeTable, string $departmentColumn): int
    {
        return $this->ownershipResolver->countEmployeesByDepartment($departmentId, $employeeTable, $departmentColumn);
    }
    public function isProjectDateRangeInvalid(?string $startDate, ?string $endDate): bool
    {
        return $this->lifecycleSupport->isProjectDateRangeInvalid($startDate, $endDate);
    }
    public function normalizePaymentCycle(string $cycle): string
    {
        return $this->lifecycleSupport->normalizePaymentCycle($cycle);
    }
    public function toProjectStorageStatus(string $status): string
    {
        return $this->lifecycleSupport->toProjectStorageStatus($status);
    }
    public function fromProjectStorageStatus(string $status): string
    {
        return $this->lifecycleSupport->fromProjectStorageStatus($status);
    }
    public function toContractStorageStatus(string $status): string
    {
        return $this->lifecycleSupport->toContractStorageStatus($status);
    }
    public function fromContractStorageStatus(string $status): string
    {
        return $this->lifecycleSupport->fromContractStorageStatus($status);
    }
    public function toOpportunityStorageStage(string $stage): string
    {
        return $this->lifecycleSupport->toOpportunityStorageStage($stage);
    }
    public function fromOpportunityStorageStage(string $stage): string
    {
        return $this->lifecycleSupport->fromOpportunityStorageStage($stage);
    }
    public function sanitizeOpportunityStageCode(string $stageCode): string
    {
        return $this->lifecycleSupport->sanitizeOpportunityStageCode($stageCode);
    }
    public function normalizeOpportunityStage(string $stage, bool $includeInactive = false): ?string
    {
        return $this->lifecycleSupport->normalizeOpportunityStage($stage, $includeInactive);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function opportunityStageDefinitions(bool $includeInactive = false): array
    {
        return $this->lifecycleSupport->opportunityStageDefinitions($includeInactive);
    }
    public function resolveDefaultOwnerId(): ?int
    {
        return $this->ownershipResolver->resolveDefaultOwnerId();
    }
    public function ownerExists(int $ownerId): bool
    {
        return $this->ownershipResolver->ownerExists($ownerId);
    }

    /**
     * @param array<string, mixed> $record
     * @param array<int, string> $keys
     */
    public function extractIntFromRecord(array $record, array $keys): ?int
    {
        return $this->ownershipResolver->extractIntFromRecord($record, $keys);
    }
    public function resolveOpportunityDepartmentIdById(?int $opportunityId): ?int
    {
        return $this->ownershipResolver->resolveOpportunityDepartmentIdById($opportunityId);
    }
    public function resolveProjectDepartmentIdById(?int $projectId): ?int
    {
        return $this->ownershipResolver->resolveProjectDepartmentIdById($projectId);
    }

    /**
     * @param array<string, mixed> $record
     */
    public function resolveDepartmentIdForTableRecord(string $table, array $record): ?int
    {
        return $this->ownershipResolver->resolveDepartmentIdForTableRecord($table, $record);
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
        return $this->selectColumns('projects', ['id', 'project_code', 'project_name', 'customer_id', 'investment_mode']);
    }

    /**
     * @return array<int, string>
     */
    public function employeeRelationColumns(): array
    {
        return $this->selectColumns('internal_users', ['id', 'user_code', 'username', 'full_name', 'department_id']);
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
        $data['customer_code'] = $this->normalizeNullableString($data['customer_code'] ?? null);
        $data['customer_name'] = (string) $this->firstNonEmpty($data, ['customer_name', 'company_name'], '');
        if (array_key_exists('customer_code_auto_generated', $data)) {
            $data['customer_code_auto_generated'] = (bool) $data['customer_code_auto_generated'];
        }

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
        $relations = [
            'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
        ];
        if ($this->hasTable('project_implementation_units')) {
            $relations['implementationUnit'] = fn ($query) => $query;
        }
        $project->loadMissing($relations);
        $data = $project->toArray();

        $data['status'] = $this->fromProjectStorageStatus((string) ($data['status'] ?? 'TRIAL'));
        $data['status_reason'] = $this->normalizeNullableString($data['status_reason'] ?? null);

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        // Flatten department info for frontend convenience
        if (isset($data['department']) && is_array($data['department'])) {
            $data['department_name'] = (string) $this->firstNonEmpty($data['department'], ['department_name', 'dept_name'], '');
            $data['department_code'] = (string) $this->firstNonEmpty($data['department'], ['department_code', 'dept_code'], '');
        } else {
            $data['department_name'] = $data['department_name'] ?? null;
            $data['department_code'] = $data['department_code'] ?? null;
        }
        unset($data['department']);

        if (isset($data['implementation_unit']) && is_array($data['implementation_unit'])) {
            $data['implementation_user_id'] = $this->parseNullableInt($data['implementation_unit']['implementation_user_id'] ?? null);
            $data['implementation_user_code'] = $this->normalizeNullableString($data['implementation_unit']['implementation_user_code'] ?? null);
            $data['implementation_full_name'] = $this->normalizeNullableString($data['implementation_unit']['implementation_full_name'] ?? null);
            $data['implementation_unit_code'] = $this->normalizeNullableString($data['implementation_unit']['implementation_unit_code'] ?? null);
            $data['implementation_unit_name'] = $this->normalizeNullableString($data['implementation_unit']['implementation_unit_name'] ?? null);
        } else {
            $data['implementation_user_id'] = $data['implementation_user_id'] ?? null;
            $data['implementation_user_code'] = $data['implementation_user_code'] ?? null;
            $data['implementation_full_name'] = $data['implementation_full_name'] ?? null;
            $data['implementation_unit_code'] = $data['implementation_unit_code'] ?? null;
            $data['implementation_unit_name'] = $data['implementation_unit_name'] ?? null;
        }
        unset($data['implementation_unit']);

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeProjectDetail(Project $project): array
    {
        $data = $this->serializeProject($project);
        $projectId = $this->parseNullableInt($data['id'] ?? $project->getKey());

        if ($projectId === null || $projectId <= 0) {
            $data['items'] = [];
            $data['raci'] = [];

            return $data;
        }

        $items = $this->fetchProjectItemsByProjectIds([$projectId]);
        $data['items'] = collect($items)
            ->map(function (array $item): array {
                $productId = $this->parseNullableInt($item['product_id'] ?? null);
                $productPackageId = $this->parseNullableInt($item['product_package_id'] ?? null);
                $quantity = (float) ($item['quantity'] ?? 0);
                $unitPrice = (float) ($item['unit_price'] ?? 0);
                $lineTotal = round($quantity * $unitPrice, 2);
                $productCode = $this->normalizeNullableString($item['product_code'] ?? null);
                $productName = $this->normalizeNullableString($item['product_name'] ?? null);
                $unit = $this->normalizeNullableString($item['unit'] ?? null);

                return [
                    'id' => (string) ($item['id'] ?? uniqid('ITEM_', true)),
                    'productId' => $productId !== null ? (string) $productId : '',
                    'product_id' => $productId,
                    'productPackageId' => $productPackageId !== null ? (string) $productPackageId : null,
                    'product_package_id' => $productPackageId,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                    'unit_price' => $unitPrice,
                    'discountPercent' => 0,
                    'discountAmount' => 0,
                    'lineTotal' => $lineTotal,
                    'line_total' => $lineTotal,
                    'product_code' => $productCode,
                    'product_name' => $productName,
                    'unit' => $unit,
                ];
            })
            ->values()
            ->all();

        $raciRows = $this->fetchProjectRaciAssignmentsByProjectIds([$projectId]);
        $data['raci'] = collect($raciRows)
            ->map(function (array $row): array {
                $assignmentId = $row['id'] ?? null;
                $userId = $this->parseNullableInt($row['user_id'] ?? null);
                $role = strtoupper((string) ($row['raci_role'] ?? 'R'));
                $fallbackId = sprintf(
                    'RACI_%s_%s_%s',
                    (string) ($row['project_id'] ?? '0'),
                    (string) ($userId ?? '0'),
                    $role
                );

                return [
                    'id' => $assignmentId !== null ? (string) $assignmentId : $fallbackId,
                    'userId' => $userId !== null ? (string) $userId : '',
                    'user_id' => $userId,
                    'roleType' => $role,
                    'raci_role' => $role,
                    'assignedDate' => (string) ($row['assigned_date'] ?? ''),
                    'assigned_date' => $row['assigned_date'] ?? null,
                    'user_code' => $row['user_code'] ?? null,
                    'username' => $row['username'] ?? null,
                    'full_name' => $row['full_name'] ?? null,
                ];
            })
            ->values()
            ->all();

        return $data;
    }

    /**
     * @param array<int, int> $projectIds
     * @return array<int, array<string, mixed>>
     */
    public function fetchProjectRaciAssignmentsByProjectIds(array $projectIds): array
    {
        if (
            ! $this->hasTable('raci_assignments')
            || ! $this->hasColumn('raci_assignments', 'entity_type')
            || ! $this->hasColumn('raci_assignments', 'entity_id')
            || ! $this->hasColumn('raci_assignments', 'user_id')
            || ! $this->hasColumn('raci_assignments', 'raci_role')
        ) {
            return [];
        }

        $normalizedProjectIds = collect($projectIds)
            ->map(fn ($id): ?int => $this->parseNullableInt($id))
            ->filter(fn (?int $id): bool => $id !== null && $id > 0)
            ->map(fn (?int $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($normalizedProjectIds === []) {
            return [];
        }

        $hasInternalUsers = $this->hasTable('internal_users') && $this->hasColumn('internal_users', 'id');
        $query = DB::table('raci_assignments as ra')
            ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
            ->whereIn('ra.entity_id', $normalizedProjectIds)
            ->whereIn('ra.raci_role', ['A', 'R', 'C', 'I']);

        if ($hasInternalUsers) {
            $query->leftJoin('internal_users as iu', 'ra.user_id', '=', 'iu.id');
            if ($this->hasColumn('internal_users', 'status')) {
                $query->whereIn('iu.status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
            }
        }

        $selects = ['ra.entity_id as project_id', 'ra.user_id as user_id', 'ra.raci_role as raci_role'];
        if ($this->hasColumn('raci_assignments', 'id')) {
            $selects[] = 'ra.id as id';
        }
        if ($this->hasColumn('raci_assignments', 'assigned_date')) {
            $selects[] = 'ra.assigned_date as assigned_at';
        } elseif ($this->hasColumn('raci_assignments', 'created_at')) {
            $selects[] = 'ra.created_at as assigned_at';
        } else {
            $selects[] = DB::raw('NULL as assigned_at');
        }

        if ($hasInternalUsers && $this->hasColumn('internal_users', 'user_code')) {
            $selects[] = 'iu.user_code as user_code';
        } else {
            $selects[] = DB::raw('NULL as user_code');
        }
        if ($hasInternalUsers && $this->hasColumn('internal_users', 'username')) {
            $selects[] = 'iu.username as username';
        } else {
            $selects[] = DB::raw('NULL as username');
        }
        if ($hasInternalUsers && $this->hasColumn('internal_users', 'full_name')) {
            $selects[] = 'iu.full_name as full_name';
        } else {
            $selects[] = DB::raw('NULL as full_name');
        }

        $rows = $query
            ->select($selects)
            ->orderBy('ra.entity_id')
            ->orderByRaw("CASE ra.raci_role WHEN 'A' THEN 0 WHEN 'R' THEN 1 WHEN 'C' THEN 2 WHEN 'I' THEN 3 ELSE 4 END")
            ->when($hasInternalUsers && $this->hasColumn('internal_users', 'full_name'), function ($builder): void {
                $builder->orderBy('iu.full_name');
            }, function ($builder): void {
                $builder->orderBy('ra.user_id');
            })
            ->get();

        $result = [];
        $seen = [];
        foreach ($rows as $item) {
            $row = (array) $item;
            $projectId = $this->parseNullableInt($row['project_id'] ?? null);
            $userId = $this->parseNullableInt($row['user_id'] ?? null);
            $role = strtoupper(trim((string) ($row['raci_role'] ?? '')));

            if ($projectId === null || $userId === null || ! in_array($role, ['A', 'R', 'C', 'I'], true)) {
                continue;
            }

            $identity = "{$projectId}|{$userId}|{$role}";
            if (isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;

            $result[] = [
                'id' => $this->parseNullableInt($row['id'] ?? null),
                'project_id' => $projectId,
                'user_id' => $userId,
                'raci_role' => $role,
                'user_code' => $this->normalizeNullableString($row['user_code'] ?? null),
                'username' => $this->normalizeNullableString($row['username'] ?? null),
                'full_name' => $this->normalizeNullableString($row['full_name'] ?? null),
                'assigned_date' => $this->normalizeDatePortion($row['assigned_at'] ?? null),
            ];
        }

        return $result;
    }

    /**
     * @param array<int, int> $opportunityIds
     * @return array<int, array<string, mixed>>
     */
    public function fetchOpportunityRaciAssignmentsByOpportunityIds(array $opportunityIds): array
    {
        if (
            ! $this->hasTable('opportunity_raci_assignments')
            || ! $this->hasColumn('opportunity_raci_assignments', 'opportunity_id')
            || ! $this->hasColumn('opportunity_raci_assignments', 'user_id')
            || ! $this->hasColumn('opportunity_raci_assignments', 'raci_role')
        ) {
            return [];
        }

        $normalizedOpportunityIds = collect($opportunityIds)
            ->map(fn ($id): ?int => $this->parseNullableInt($id))
            ->filter(fn (?int $id): bool => $id !== null && $id > 0)
            ->map(fn (?int $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($normalizedOpportunityIds === []) {
            return [];
        }

        $hasInternalUsers = $this->hasTable('internal_users') && $this->hasColumn('internal_users', 'id');
        $query = DB::table('opportunity_raci_assignments as ora')
            ->whereIn('ora.opportunity_id', $normalizedOpportunityIds)
            ->whereIn('ora.raci_role', ['A', 'R', 'C', 'I']);

        if ($hasInternalUsers) {
            $query->leftJoin('internal_users as iu', 'ora.user_id', '=', 'iu.id');
            if ($this->hasColumn('internal_users', 'status')) {
                $query->whereIn('iu.status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
            }
        }

        $selects = [
            'ora.opportunity_id as opportunity_id',
            'ora.user_id as user_id',
            'ora.raci_role as raci_role',
        ];
        if ($this->hasColumn('opportunity_raci_assignments', 'id')) {
            $selects[] = 'ora.id as id';
        } else {
            $selects[] = DB::raw('NULL as id');
        }
        if ($this->hasColumn('opportunity_raci_assignments', 'created_at')) {
            $selects[] = 'ora.created_at as assigned_at';
        } else {
            $selects[] = DB::raw('NULL as assigned_at');
        }

        if ($hasInternalUsers && $this->hasColumn('internal_users', 'user_code')) {
            $selects[] = 'iu.user_code as user_code';
        } else {
            $selects[] = DB::raw('NULL as user_code');
        }
        if ($hasInternalUsers && $this->hasColumn('internal_users', 'username')) {
            $selects[] = 'iu.username as username';
        } else {
            $selects[] = DB::raw('NULL as username');
        }
        if ($hasInternalUsers && $this->hasColumn('internal_users', 'full_name')) {
            $selects[] = 'iu.full_name as full_name';
        } else {
            $selects[] = DB::raw('NULL as full_name');
        }

        $rows = $query
            ->select($selects)
            ->orderBy('ora.opportunity_id')
            ->orderByRaw("CASE ora.raci_role WHEN 'A' THEN 0 WHEN 'R' THEN 1 WHEN 'C' THEN 2 WHEN 'I' THEN 3 ELSE 4 END")
            ->when($hasInternalUsers && $this->hasColumn('internal_users', 'full_name'), function ($builder): void {
                $builder->orderBy('iu.full_name');
            }, function ($builder): void {
                $builder->orderBy('ora.user_id');
            })
            ->get();

        $result = [];
        $seen = [];
        foreach ($rows as $item) {
            $row = (array) $item;
            $opportunityId = $this->parseNullableInt($row['opportunity_id'] ?? null);
            $userId = $this->parseNullableInt($row['user_id'] ?? null);
            $role = strtoupper(trim((string) ($row['raci_role'] ?? '')));

            if ($opportunityId === null || $userId === null || ! in_array($role, ['A', 'R', 'C', 'I'], true)) {
                continue;
            }

            $identity = "{$opportunityId}|{$userId}|{$role}";
            if (isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;

            $result[] = [
                'id' => $this->parseNullableInt($row['id'] ?? null),
                'opportunity_id' => $opportunityId,
                'user_id' => $userId,
                'raci_role' => $role,
                'user_code' => $this->normalizeNullableString($row['user_code'] ?? null),
                'username' => $this->normalizeNullableString($row['username'] ?? null),
                'full_name' => $this->normalizeNullableString($row['full_name'] ?? null),
                'assigned_date' => $this->normalizeDatePortion($row['assigned_at'] ?? null),
            ];
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeContract(Contract $contract): array
    {
        $contract->loadMissing([
            'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
            'project' => fn ($query) => $query->select($this->projectRelationColumns()),
            'signer' => fn ($query) => $query->select($this->employeeRelationColumns()),
            'department' => fn ($query) => $query->select($this->departmentRelationColumns()),
        ]);

        $data = $contract->toArray();

        $data['contract_code'] = (string) $this->firstNonEmpty($data, ['contract_code', 'contract_number'], '');
        $data['value'] = (float) $this->firstNonEmpty($data, ['value', 'total_value'], 0);
        $data['payment_cycle'] = $this->normalizePaymentCycle((string) $this->firstNonEmpty($data, ['payment_cycle'], 'ONCE'));
        $data['status'] = $this->fromContractStorageStatus((string) ($data['status'] ?? 'DRAFT'));
        $data['project_type_code'] = isset($data['project_type_code']) && trim((string) $data['project_type_code']) !== ''
            ? strtoupper(trim((string) $data['project_type_code']))
            : null;

        if ($this->firstNonEmpty($data, ['customer_id']) === null && isset($data['project']['customer_id'])) {
            $data['customer_id'] = $data['project']['customer_id'];
        }

        $data['signer_user_id'] = $this->parseNullableInt($data['signer_user_id'] ?? ($data['signer']['id'] ?? null));
        $data['signer_user_code'] = $this->normalizeNullableString($data['signer']['user_code'] ?? null);
        $data['signer_full_name'] = $this->normalizeNullableString(
            $data['signer']['full_name'] ?? ($data['signer']['username'] ?? null)
        );

        $data['dept_id'] = $this->parseNullableInt($data['dept_id'] ?? ($data['signer']['department_id'] ?? null));
        $data['dept_code'] = $this->normalizeNullableString($data['department']['dept_code'] ?? null);
        $data['dept_name'] = $this->normalizeNullableString($data['department']['dept_name'] ?? null);

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        if ($contract->relationLoaded('items')) {
            $data['items'] = $contract->items
                ->map(function ($item): array {
                    $productPackageId = $this->hasColumn('contract_items', 'product_package_id')
                        ? $this->parseNullableInt($item->getAttribute('product_package_id'))
                        : null;
                    $snapshotProductName = $this->hasColumn('contract_items', 'product_name')
                        ? $this->normalizeNullableString($item->getAttribute('product_name'))
                        : null;
                    $snapshotUnit = $this->hasColumn('contract_items', 'unit')
                        ? $this->normalizeNullableString($item->getAttribute('unit'))
                        : null;

                    return [
                        'id' => $item->id,
                        'contract_id' => $item->contract_id,
                        'product_id' => $item->product_id,
                        'productPackageId' => $productPackageId !== null ? (string) $productPackageId : null,
                        'product_package_id' => $productPackageId,
                        'product_code' => $item->productPackage?->package_code ?? $item->product?->product_code,
                        'product_name' => $snapshotProductName ?? $item->productPackage?->package_name ?? $item->productPackage?->product_name ?? $item->product?->product_name,
                        'unit' => $snapshotUnit ?? $item->productPackage?->unit ?? $item->product?->unit,
                        'quantity' => (float) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'vat_rate' => $item->vat_rate !== null ? (float) $item->vat_rate : null,
                        'vat_amount' => $item->vat_amount !== null ? (float) $item->vat_amount : null,
                    ];
                })
                ->values()
                ->all();

            $itemsTotal = collect($data['items'])
                ->sum(fn (array $item): float => (float) ($item['quantity'] ?? 0) * (float) ($item['unit_price'] ?? 0));
            if ($itemsTotal > 0) {
                $data['value'] = (float) $itemsTotal;
                if (array_key_exists('total_value', $data)) {
                    $data['total_value'] = (float) $itemsTotal;
                }
            }
        }

        // --- Renewal / addendum summary ---
        if ($this->hasColumn('contracts', 'parent_contract_id')) {
            $data['parent_contract_id'] = $this->parseNullableInt($data['parent_contract_id'] ?? null);
            $data['addendum_type'] = isset($data['addendum_type'])
                ? strtoupper((string) $data['addendum_type'])
                : null;
            $data['gap_days'] = isset($data['gap_days']) ? (int) $data['gap_days'] : null;
            $data['continuity_status'] = $data['continuity_status'] ?? null;
            $data['penalty_rate'] = isset($data['penalty_rate'])
                ? (float) $data['penalty_rate']
                : null;

            // Attach a compact parent summary (code + name) if parent is set
            if ($data['parent_contract_id'] !== null) {
                $parentSummary = \App\Models\Contract::withTrashed()
                    ->select(['id', 'contract_code', 'contract_number', 'contract_name', 'expiry_date'])
                    ->find($data['parent_contract_id']);
                $data['parent_contract'] = $parentSummary !== null ? [
                    'id' => $parentSummary->getKey(),
                    'contract_code' => (string) $this->firstNonEmpty($parentSummary->toArray(), ['contract_code', 'contract_number'], ''),
                    'contract_name' => (string) ($parentSummary->getAttribute('contract_name') ?? ''),
                    'expiry_date' => $parentSummary->getAttribute('expiry_date')
                        ? (string) $parentSummary->getAttribute('expiry_date')
                        : null,
                ] : null;
            } else {
                $data['parent_contract'] = null;
            }
        }

        unset($data['signer'], $data['department']);

        return $data;
    }

    /**
     * @param array<int, int> $projectIds
     * @return array<int, array<string, mixed>>
     */
    private function fetchProjectItemsByProjectIds(array $projectIds): array
    {
        if (
            ! $this->hasTable('project_items')
            || ! $this->hasColumn('project_items', 'project_id')
            || ! $this->hasColumn('project_items', 'product_id')
        ) {
            return [];
        }

        $normalizedProjectIds = collect($projectIds)
            ->map(fn ($id): ?int => $this->parseNullableInt($id))
            ->filter(fn (?int $id): bool => $id !== null && $id > 0)
            ->map(fn (?int $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($normalizedProjectIds === []) {
            return [];
        }

        $query = DB::table('project_items as pi')
            ->whereIn('pi.project_id', $normalizedProjectIds);

        if ($this->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $hasProductPackages = $this->hasTable('product_packages')
            && $this->hasColumn('project_items', 'product_package_id');
        if ($hasProductPackages) {
            $query->leftJoin('product_packages as pp', 'pi.product_package_id', '=', 'pp.id');
        }

        $hasProducts = $this->hasTable('products');
        if ($hasProducts) {
            $query->leftJoin('products as pr', 'pi.product_id', '=', 'pr.id');
        }

        $selects = ['pi.project_id as project_id', 'pi.product_id as product_id'];
        if ($this->hasColumn('project_items', 'product_package_id')) {
            $selects[] = 'pi.product_package_id as product_package_id';
        } else {
            $selects[] = DB::raw('NULL as product_package_id');
        }
        if ($this->hasColumn('project_items', 'id')) {
            $selects[] = 'pi.id as id';
        } else {
            $selects[] = DB::raw('NULL as id');
        }
        if ($this->hasColumn('project_items', 'quantity')) {
            $selects[] = 'pi.quantity as quantity';
        } else {
            $selects[] = DB::raw('1 as quantity');
        }
        if ($this->hasColumn('project_items', 'unit_price')) {
            $selects[] = 'pi.unit_price as unit_price';
        } else {
            $selects[] = DB::raw('0 as unit_price');
        }
        if ($this->hasColumn('project_items', 'unit')) {
            $selects[] = 'pi.unit as snapshot_unit';
        } else {
            $selects[] = DB::raw('NULL as snapshot_unit');
        }
        if ($hasProductPackages && $this->hasColumn('product_packages', 'package_code')) {
            $selects[] = 'pp.package_code as package_code';
        } else {
            $selects[] = DB::raw('NULL as package_code');
        }
        if ($hasProductPackages && $this->hasColumn('product_packages', 'package_name')) {
            $selects[] = 'pp.package_name as package_name';
        } else {
            $selects[] = DB::raw('NULL as package_name');
        }
        if ($hasProductPackages && $this->hasColumn('product_packages', 'unit')) {
            $selects[] = 'pp.unit as package_unit';
        } else {
            $selects[] = DB::raw('NULL as package_unit');
        }
        if ($hasProducts && $this->hasColumn('products', 'product_code')) {
            $selects[] = 'pr.product_code as product_code';
        } else {
            $selects[] = DB::raw('NULL as product_code');
        }
        if ($hasProducts && $this->hasColumn('products', 'product_name')) {
            $selects[] = 'pr.product_name as product_name';
        } else {
            $selects[] = DB::raw('NULL as product_name');
        }
        if ($hasProducts && $this->hasColumn('products', 'unit')) {
            $selects[] = 'pr.unit as product_unit';
        } else {
            $selects[] = DB::raw('NULL as product_unit');
        }

        $rows = $query
            ->select($selects)
            ->orderBy('pi.project_id')
            ->when($this->hasColumn('project_items', 'id'), function ($builder): void {
                $builder->orderBy('pi.id');
            }, function ($builder): void {
                $builder->orderBy('pi.product_id');
            })
            ->get();

        return $rows
            ->map(function ($item): array {
                $row = (array) $item;

                return [
                    'id' => $this->parseNullableInt($row['id'] ?? null),
                    'project_id' => $this->parseNullableInt($row['project_id'] ?? null),
                    'product_id' => $this->parseNullableInt($row['product_id'] ?? null),
                    'product_package_id' => $this->parseNullableInt($row['product_package_id'] ?? null),
                    'quantity' => is_numeric($row['quantity'] ?? null) ? (float) $row['quantity'] : 0.0,
                    'unit_price' => is_numeric($row['unit_price'] ?? null) ? (float) $row['unit_price'] : 0.0,
                    'product_code' => $this->normalizeNullableString($row['package_code'] ?? $row['product_code'] ?? null),
                    'product_name' => $this->normalizeNullableString($row['package_name'] ?? $row['product_name'] ?? null),
                    'unit' => $this->normalizeNullableString(
                        $row['snapshot_unit'] ?? $row['package_unit'] ?? $row['product_unit'] ?? null
                    ),
                ];
            })
            ->values()
            ->all();
    }
    private function normalizeDatePortion(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $normalized) === 1) {
            return $normalized;
        }

        $timestamp = strtotime($normalized);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d', $timestamp);
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
    private function isSolutionCenterDepartment(?Department $department): bool
    {
        if (! $department instanceof Department) {
            return false;
        }

        $codeToken = $this->normalizeDepartmentCodeToken((string) $department->dept_code);
        if (in_array($codeToken, self::SOLUTION_CENTER_CODE_TOKENS, true)) {
            return true;
        }

        $nameToken = $this->normalizeDepartmentNameToken((string) ($department->dept_name ?? ''));
        return str_contains($nameToken, self::SOLUTION_CENTER_NAME_TOKEN);
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

}
