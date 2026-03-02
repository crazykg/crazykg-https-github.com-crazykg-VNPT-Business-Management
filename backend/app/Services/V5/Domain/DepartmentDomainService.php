<?php

namespace App\Services\V5\Domain;

use App\Models\Department;
use App\Models\InternalUser;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DepartmentDomainService
{
    private const DEPARTMENTS_CACHE_KEY = 'v5:departments:list:v1';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $rows = collect(Cache::remember(self::DEPARTMENTS_CACHE_KEY, now()->addMinutes(30), function (): array {
            return Department::query()
                ->with(['parent' => fn ($query) => $query->select($this->support->departmentRelationColumns())])
                ->select($this->support->selectColumns('departments', [
                    'id',
                    'dept_code',
                    'dept_name',
                    'parent_id',
                    'dept_path',
                    'is_active',
                    'status',
                    'data_scope',
                    'created_at',
                    'updated_at',
                ]))
                ->orderBy('id')
                ->get()
                ->map(fn (Department $department): array => $this->support->serializeDepartment($department))
                ->values()
                ->all();
        }));

        $authenticatedUser = $request->user();
        if ($authenticatedUser instanceof InternalUser) {
            $allowedDeptIds = app(UserAccessService::class)->resolveDepartmentIdsForUser((int) $authenticatedUser->id);
            if ($allowedDeptIds !== null) {
                $allowedMap = array_fill_keys(array_map('strval', $allowedDeptIds), true);
                $rows = $rows
                    ->filter(fn (array $row): bool => isset($allowedMap[(string) ($row['id'] ?? '')]))
                    ->values();
            }
        }

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $supportsIsActive = $this->support->hasColumn('departments', 'is_active');
        $supportsStatus = $this->support->hasColumn('departments', 'status');
        $supportsDataScope = $this->support->hasColumn('departments', 'data_scope');
        $supportsDeptPath = $this->support->hasColumn('departments', 'dept_path');

        $rules = [
            'dept_code' => ['required', 'string', 'max:100'],
            'dept_name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer'],
        ];
        if ($supportsIsActive || $supportsStatus) {
            $rules['is_active'] = ['nullable', 'boolean'];
        }
        if ($supportsDataScope) {
            $rules['data_scope'] = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        $deptCode = $this->support->canonicalDepartmentCode((string) $validated['dept_code']);
        if (Department::query()->where('dept_code', $deptCode)->exists()) {
            return response()->json(['message' => 'Mã phòng ban đã tồn tại.'], 422);
        }

        $parentId = $this->support->parseNullableInt($validated['parent_id'] ?? null);
        if ($parentId !== null && ! Department::query()->whereKey($parentId)->exists()) {
            return response()->json(['message' => 'parent_id is invalid.'], 422);
        }

        [$resolvedParentId, $parentValidationError] = $this->support->resolveDepartmentParentIdForWrite(
            $deptCode,
            $parentId,
            null
        );
        if ($parentValidationError !== null) {
            return response()->json(['message' => $parentValidationError], 422);
        }

        $department = new Department();
        $department->dept_code = $deptCode;
        $department->dept_name = $validated['dept_name'];
        $department->parent_id = $resolvedParentId;

        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;
        if ($supportsIsActive) {
            $department->setAttribute('is_active', $isActive);
        }
        if ($supportsStatus) {
            $department->setAttribute('status', $isActive ? 'ACTIVE' : 'INACTIVE');
        }
        if ($supportsDataScope) {
            $department->setAttribute('data_scope', $validated['data_scope'] ?? null);
        }
        if ($supportsDeptPath) {
            // Ensure insert passes when dept_path is NOT NULL without default.
            $department->setAttribute('dept_path', '0/');
        }

        $department->save();

        if ($supportsDeptPath) {
            $department->dept_path = $this->support->buildDeptPath($department);
            $department->save();
        }
        Cache::forget(self::DEPARTMENTS_CACHE_KEY);

        return response()->json([
            'data' => $this->support->serializeDepartment(
                $department->loadMissing(['parent' => fn ($query) => $query->select($this->support->departmentRelationColumns())])
            ),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $department = Department::query()->findOrFail($id);

        $supportsIsActive = $this->support->hasColumn('departments', 'is_active');
        $supportsStatus = $this->support->hasColumn('departments', 'status');
        $supportsDataScope = $this->support->hasColumn('departments', 'data_scope');
        $supportsDeptPath = $this->support->hasColumn('departments', 'dept_path');

        $rules = [
            'dept_code' => ['sometimes', 'required', 'string', 'max:100'],
            'dept_name' => ['sometimes', 'required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer'],
        ];
        if ($supportsIsActive || $supportsStatus) {
            $rules['is_active'] = ['nullable', 'boolean'];
        }
        if ($supportsDataScope) {
            $rules['data_scope'] = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        $targetDeptCode = $this->support->canonicalDepartmentCode((string) ($validated['dept_code'] ?? $department->dept_code));
        if ($this->support->isRootDepartmentCode((string) $department->dept_code) && ! $this->support->isRootDepartmentCode($targetDeptCode)) {
            return response()->json(['message' => 'Phòng ban gốc phải giữ mã BGĐVT.'], 422);
        }

        if (Department::query()
            ->where('dept_code', $targetDeptCode)
            ->where('id', '!=', $department->id)
            ->exists()) {
            return response()->json(['message' => 'Mã phòng ban đã tồn tại.'], 422);
        }

        $requestedParentId = array_key_exists('parent_id', $validated)
            ? $this->support->parseNullableInt($validated['parent_id'])
            : $this->support->parseNullableInt($department->parent_id);

        if ($requestedParentId !== null && $requestedParentId === (int) $department->id) {
            return response()->json(['message' => 'parent_id cannot be self.'], 422);
        }

        if ($requestedParentId !== null && ! Department::query()->whereKey($requestedParentId)->exists()) {
            return response()->json(['message' => 'parent_id is invalid.'], 422);
        }

        [$resolvedParentId, $parentValidationError] = $this->support->resolveDepartmentParentIdForWrite(
            $targetDeptCode,
            $requestedParentId,
            (int) $department->id
        );
        if ($parentValidationError !== null) {
            return response()->json(['message' => $parentValidationError], 422);
        }

        if (array_key_exists('dept_code', $validated)) {
            $department->dept_code = $targetDeptCode;
        }
        if (array_key_exists('dept_name', $validated)) {
            $department->dept_name = $validated['dept_name'];
        }

        $parentChanged = (int) ($department->parent_id ?? 0) !== (int) ($resolvedParentId ?? 0);
        $department->parent_id = $resolvedParentId;

        if (array_key_exists('is_active', $validated)) {
            $isActive = (bool) $validated['is_active'];
            if ($supportsIsActive) {
                $department->setAttribute('is_active', $isActive);
            }
            if ($supportsStatus) {
                $department->setAttribute('status', $isActive ? 'ACTIVE' : 'INACTIVE');
            }
        }

        if ($supportsDataScope && array_key_exists('data_scope', $validated)) {
            $department->setAttribute('data_scope', $validated['data_scope']);
        }

        $department->save();

        if ($parentChanged && $supportsDeptPath) {
            $department->dept_path = $this->support->buildDeptPath($department);
            $department->save();
        }
        Cache::forget(self::DEPARTMENTS_CACHE_KEY);

        return response()->json([
            'data' => $this->support->serializeDepartment(
                $department->loadMissing(['parent' => fn ($query) => $query->select($this->support->departmentRelationColumns())])
            ),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $department = Department::query()->findOrFail($id);
        if ($this->support->isRootDepartmentCode((string) $department->dept_code)) {
            return response()->json([
                'message' => 'Không thể xóa phòng ban gốc BGĐVT.',
            ], 422);
        }

        $employeeTable = $this->support->resolveEmployeeTable();
        $employeeDepartmentColumn = $this->support->resolveEmployeeDepartmentColumn($employeeTable);
        if ($employeeTable !== null && $employeeDepartmentColumn !== null) {
            $employeeCount = $this->support->countEmployeesByDepartment((int) $department->id, $employeeTable, $employeeDepartmentColumn);
            if ($employeeCount > 0) {
                return response()->json([
                    'message' => 'Không thể xóa phòng ban đang có nhân sự. Vui lòng điều chuyển nhân sự trước.',
                ], 422);
            }
        }

        $response = $this->accessAudit->deleteModel($request, $department, 'Department');
        if ($response->status() < 400) {
            Cache::forget(self::DEPARTMENTS_CACHE_KEY);
        }

        return $response;
    }
}
