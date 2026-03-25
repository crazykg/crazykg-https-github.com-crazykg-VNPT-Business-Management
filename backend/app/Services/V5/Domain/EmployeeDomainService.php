<?php

namespace App\Services\V5\Domain;

use App\Models\Department;
use App\Models\InternalUser;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeDomainService
{
    private const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    private const EMPLOYEE_INPUT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'TRANSFERRED'];
    private const EMPLOYEE_MIN_AGE_EXCLUSIVE = 20;
    private const EMPLOYEE_MAX_AGE_EXCLUSIVE = 66;

    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $query = $employeeModel::query()
            ->with(['department' => fn ($query) => $query->select($this->support->departmentRelationColumns())])
            ->select($this->support->selectColumns($employeeTable, [
                'id',
                'uuid',
                'username',
                'user_code',
                'full_name',
                'phone',
                'phone_number',
                'mobile',
                'email',
                'status',
                'department_id',
                'dept_id',
                'position_id',
                'job_title_raw',
                'date_of_birth',
                'gender',
                'vpn_status',
                'ip_address',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        if ($this->support->hasTable('positions')) {
            $query->with(['position' => fn ($relationQuery) => $relationQuery->select($this->positionRelationColumns())]);
        }

        $authenticatedUser = $request->user();
        if ($authenticatedUser instanceof InternalUser) {
            $visibility = app(UserAccessService::class)->resolveEmployeeVisibility((int) $authenticatedUser->id);
            if (! $visibility['all']) {
                $query->where(function ($builder) use ($visibility, $employeeTable, $authenticatedUser): void {
                    $hasAnyScope = false;

                    if ($visibility['self_only']) {
                        $builder->where("{$employeeTable}.id", (int) $authenticatedUser->id);
                        $hasAnyScope = true;
                    }

                    $deptIds = $visibility['dept_ids'] ?? [];
                    if ($deptIds !== []) {
                        $departmentColumn = $this->support->hasColumn($employeeTable, 'department_id')
                            ? 'department_id'
                            : ($this->support->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);

                        if ($departmentColumn !== null) {
                            if ($hasAnyScope) {
                                $builder->orWhereIn("{$employeeTable}.{$departmentColumn}", $deptIds);
                            } else {
                                $builder->whereIn("{$employeeTable}.{$departmentColumn}", $deptIds);
                            }
                            $hasAnyScope = true;
                        }
                    }

                    if (! $hasAnyScope) {
                        $builder->whereRaw('1 = 0');
                    }
                });
            }
        }

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($employeeTable, $like): void {
                $builder->whereRaw('1 = 0');

                foreach (['user_code', 'username', 'full_name', 'phone', 'phone_number', 'mobile', 'email', 'job_title_raw'] as $column) {
                    if ($this->support->hasColumn($employeeTable, $column)) {
                        $builder->orWhere("{$employeeTable}.{$column}", 'like', $like);
                    }
                }
            });
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::EMPLOYEE_STATUSES, true) && $this->support->hasColumn($employeeTable, 'status')) {
            $query->where("{$employeeTable}.status", $status);
        }

        $departmentFilter = $this->support->parseNullableInt($this->support->readFilterParam($request, 'department_id'));
        if ($departmentFilter !== null) {
            $departmentColumn = $this->support->hasColumn($employeeTable, 'department_id')
                ? 'department_id'
                : ($this->support->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);
            if ($departmentColumn !== null) {
                $query->where("{$employeeTable}.{$departmentColumn}", $departmentFilter);
            }
        }

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => "{$employeeTable}.id",
            'user_code' => "{$employeeTable}.user_code",
            'username' => "{$employeeTable}.username",
            'full_name' => "{$employeeTable}.full_name",
            'email' => "{$employeeTable}.email",
            'status' => "{$employeeTable}.status",
            'department_id' => "{$employeeTable}.department_id",
            'created_at' => "{$employeeTable}.created_at",
        ], "{$employeeTable}.id");
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== "{$employeeTable}.id" && $this->support->hasColumn($employeeTable, 'id')) {
            $query->orderBy("{$employeeTable}.id", 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:100'],
            'user_code' => ['nullable', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['required', 'integer'],
            'position_id' => ['nullable', 'integer'],
            'job_title_raw' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid');
        }
        if ($this->support->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username');
        }
        if ($this->support->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][0] = 'required';
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code');
        }
        if ($this->support->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email');
        }

        $validated = $request->validate($rules);
        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();

            return response()->json([
                'message' => $message,
                'errors' => [
                    'date_of_birth' => [$message],
                ],
            ], 422);
        }

        $departmentId = $this->support->parseNullableInt($validated['department_id'] ?? null);
        if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
            return response()->json(['message' => 'department_id is invalid.'], 422);
        }

        $employee = new $employeeModel();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $username = (string) ($validated['username'] ?? $validated['user_code'] ?? '');
        $employeeCode = (string) ($validated['user_code'] ?? $validated['username'] ?? '');
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'uuid', $uuid);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'username', $username);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'user_code', $employeeCode);
        $this->support->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->support->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->support->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'status', $this->toEmployeeStorageStatus((string) ($validated['status'] ?? 'ACTIVE')));
        $this->support->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);

        $positionRaw = $validated['position_id'] ?? null;
        $positionId = $this->support->parseNullableInt($positionRaw);
        if ($this->support->hasColumn($employeeTable, 'position_id')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
        } elseif ($this->support->hasColumn($employeeTable, 'job_title_raw')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
        }

        if (array_key_exists('job_title_raw', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        if (array_key_exists('gender', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }
        if ($this->support->hasColumn($employeeTable, 'data_scope')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope'] ?? null);
        }

        $temporaryPassword = null;
        if ($this->support->hasColumn($employeeTable, 'password')) {
            $temporaryPassword = $this->generateTemporaryPassword();
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'password', Hash::make($temporaryPassword));
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'must_change_password', 1);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'password_reset_required_at', now());
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'password_changed_at', null);

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi luu.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        $responsePayload = [
            'data' => $this->serializeEmployee($freshEmployee),
        ];
        if ($temporaryPassword !== null) {
            $responsePayload['provisioning'] = [
                'temporary_password' => $temporaryPassword,
                'must_change_password' => true,
                'delivery' => 'one_time',
            ];
        }

        return response()->json($responsePayload, 201);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/internal-users', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->store($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Khong the tao nhan su.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                $provisioning = is_array($payload['provisioning'] ?? null) ? $payload['provisioning'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Khong the doc phan hoi khi tao nhan su.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                    'provisioning' => $provisioning,
                ];
                $created[] = $record;
            } catch (ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể tạo nhân sự.',
                ];
            }
        }

        $failedCount = count(array_filter(
            $results,
            fn (array $item): bool => ($item['success'] ?? false) !== true
        ));

        return response()->json([
            'data' => [
                'results' => array_values($results),
                'created' => array_values($created),
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);
        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'username' => ['sometimes', 'required', 'string', 'max:100'],
            'user_code' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['sometimes', 'required', 'integer'],
            'position_id' => ['sometimes', 'nullable', 'integer'],
            'job_title_raw' => ['sometimes', 'nullable', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'gender' => ['sometimes', 'nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['sometimes', 'nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['sometimes', 'nullable', 'string', 'max:45'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email')->ignore($employee->id);
        }

        $validated = $request->validate($rules);
        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();

            return response()->json([
                'message' => $message,
                'errors' => [
                    'date_of_birth' => [$message],
                ],
            ], 422);
        }

        if (array_key_exists('department_id', $validated)) {
            $departmentId = $this->support->parseNullableInt($validated['department_id']);
            if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
                return response()->json(['message' => 'department_id is invalid.'], 422);
            }
            $this->support->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);
        } else {
            $currentDepartmentId = $this->support->parseNullableInt((string) $this->support->firstNonEmpty(
                $employee->toArray(),
                ['department_id', 'dept_id']
            ));
            if ($currentDepartmentId === null || ! Department::query()->whereKey($currentDepartmentId)->exists()) {
                return response()->json(['message' => 'department_id is required.'], 422);
            }
        }

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'uuid', $validated['uuid']);
        }
        if (array_key_exists('username', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'username', $validated['username']);
        }
        if (array_key_exists('user_code', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'user_code', $validated['user_code']);
        }
        if (array_key_exists('full_name', $validated)) {
            $this->support->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        }
        if (array_key_exists('email', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        }
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->support->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->support->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
        }
        if (array_key_exists('status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'status', $this->toEmployeeStorageStatus((string) $validated['status']));
        }
        if (array_key_exists('position_id', $validated)) {
            $positionRaw = $validated['position_id'];
            $positionId = $this->support->parseNullableInt($positionRaw);

            if ($this->support->hasColumn($employeeTable, 'position_id')) {
                $this->support->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
            } elseif ($this->support->hasColumn($employeeTable, 'job_title_raw')) {
                $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
            }
        }
        if (array_key_exists('job_title_raw', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        if (array_key_exists('gender', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }
        if ($this->support->hasColumn($employeeTable, 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope']);
        }

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi cap nhat.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);
        try {
            DB::transaction(function () use ($employee): void {
                $employee->delete();
            });

            return response()->json(['message' => 'Employee deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Employee is referenced by other records and cannot be deleted.',
            ], 422);
        }
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }
        if (! $this->support->hasColumn($employeeTable, 'password')) {
            return response()->json(['message' => 'Employee password column is not available.'], 422);
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        /** @var Model $employee */
        $employee = $employeeModel::query()->findOrFail($id);

        $temporaryPassword = $this->generateTemporaryPassword();
        $updates = [
            'password' => Hash::make($temporaryPassword),
        ];
        if ($this->support->hasColumn($employeeTable, 'must_change_password')) {
            $updates['must_change_password'] = 1;
        }
        if ($this->support->hasColumn($employeeTable, 'password_reset_required_at')) {
            $updates['password_reset_required_at'] = now();
        }
        if ($this->support->hasColumn($employeeTable, 'password_changed_at')) {
            $updates['password_changed_at'] = null;
        }

        $updatedById = $request->user() instanceof InternalUser ? (int) $request->user()->id : null;
        if ($updatedById !== null && $this->support->hasColumn($employeeTable, 'updated_by')) {
            $updates['updated_by'] = $updatedById;
        }

        DB::transaction(function () use ($employee, $updates): void {
            foreach ($updates as $column => $value) {
                $employee->setAttribute($column, $value);
            }
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi reset mat khau.');
        }
        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
            'provisioning' => [
                'temporary_password' => $temporaryPassword,
                'must_change_password' => true,
                'delivery' => 'one_time',
            ],
        ]);
    }

    /**
     * @return class-string<Model>
     */
    private function resolveEmployeeModelClass(): string
    {
        return InternalUser::class;
    }

    /**
     * @return array<int, string>
     */
    private function positionRelationColumns(): array
    {
        return $this->support->selectColumns('positions', ['id', 'pos_code', 'pos_name']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEmployee(Model $employee): array
    {
        $relations = [
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ];
        if ($this->support->hasTable('positions')) {
            $relations['position'] = fn ($query) => $query->select($this->positionRelationColumns());
        }
        $employee->loadMissing($relations);

        $data = $employee->toArray();

        $data['username'] = (string) $this->support->firstNonEmpty($data, ['username', 'user_code'], '');
        $data['user_code'] = (string) $this->support->firstNonEmpty($data, ['user_code', 'username'], '');
        $data['employee_code'] = $this->normalizeEmployeeCode($data['user_code'], $data['id'] ?? null);
        $data['full_name'] = (string) $this->support->firstNonEmpty($data, ['full_name'], '');
        $normalizedPhone = $this->support->normalizeNullableString($this->support->firstNonEmpty($data, ['phone_number', 'phone', 'mobile']));
        $data['phone_number'] = $normalizedPhone;
        $data['phone'] = $normalizedPhone;
        $data['department_id'] = $this->support->firstNonEmpty($data, ['department_id', 'dept_id']);
        $data['position_id'] = $this->support->firstNonEmpty($data, ['position_id']);
        $data['status'] = $this->fromEmployeeStorageStatus((string) ($data['status'] ?? 'ACTIVE'));
        $positionCode = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_code'] ?? '')
            : '';
        $positionName = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_name'] ?? '')
            : '';

        if ($positionCode === '') {
            $fallbackCode = strtoupper((string) ($this->support->firstNonEmpty($data, ['position_code']) ?? ''));
            if ($fallbackCode !== '') {
                $positionCode = $fallbackCode;
            }
        }

        if ($positionName === '') {
            $positionName = $this->resolvePositionDisplayName(
                $positionCode !== '' ? $positionCode : ($data['position_id'] ?? null)
            );
        }

        if ($positionName === '') {
            $positionName = $this->resolvePositionDisplayName((string) ($data['job_title_raw'] ?? ''));
        }

        $data['position_code'] = $positionCode !== '' ? $positionCode : null;
        $data['position_name'] = $positionName !== '' ? $positionName : null;

        $jobTitleVi = $this->localizeJobTitle((string) ($data['job_title_vi'] ?? $data['job_title_raw'] ?? ''));
        if ($jobTitleVi === '' && $positionName !== '') {
            $jobTitleVi = $positionName;
        }
        $data['job_title_vi'] = $jobTitleVi !== '' ? $jobTitleVi : null;

        return $data;
    }

    private function toEmployeeStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'ACTIVE' => 'ACTIVE',
            'INACTIVE', 'BANNED' => 'INACTIVE',
            'SUSPENDED', 'TRANSFERRED' => 'SUSPENDED',
            default => 'ACTIVE',
        };
    }

    private function fromEmployeeStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'ACTIVE' => 'ACTIVE',
            'INACTIVE', 'BANNED' => 'INACTIVE',
            'SUSPENDED', 'TRANSFERRED' => 'SUSPENDED',
            default => 'ACTIVE',
        };
    }

    private function isOutOfAllowedEmployeeAgeRange(mixed $dateOfBirth): bool
    {
        $normalized = trim((string) ($dateOfBirth ?? ''));
        if ($normalized === '') {
            return false;
        }

        $birthDate = date_create_immutable($normalized);
        if (! $birthDate instanceof \DateTimeImmutable) {
            return false;
        }

        $today = new \DateTimeImmutable('today');
        if ($birthDate > $today) {
            return true;
        }
        $age = $birthDate->diff($today)->y;

        return $age <= self::EMPLOYEE_MIN_AGE_EXCLUSIVE || $age >= self::EMPLOYEE_MAX_AGE_EXCLUSIVE;
    }

    private function employeeDateOfBirthRangeMessage(): string
    {
        return sprintf(
            'Ngay sinh phai cho so tuoi > %d va < %d.',
            self::EMPLOYEE_MIN_AGE_EXCLUSIVE,
            self::EMPLOYEE_MAX_AGE_EXCLUSIVE
        );
    }

    private function resolvePositionDisplayName(mixed $value): string
    {
        $raw = strtoupper(trim((string) $value));
        if ($raw === '') {
            return '';
        }

        $dictionary = [
            '1' => 'Giam doc',
            '2' => 'Pho giam doc',
            '3' => 'Truong phong',
            '4' => 'Pho phong',
            '5' => 'Chuyen vien',
            'P001' => 'Giam doc',
            'P002' => 'Pho giam doc',
            'P003' => 'Truong phong',
            'P004' => 'Pho phong',
            'P005' => 'Chuyen vien',
            'POS001' => 'Giam doc',
            'POS002' => 'Pho giam doc',
            'POS003' => 'Truong phong',
            'POS004' => 'Pho phong',
            'POS005' => 'Chuyen vien',
        ];

        if (array_key_exists($raw, $dictionary)) {
            return $dictionary[$raw];
        }

        if (preg_match('/^\d+$/', $raw) === 1) {
            $normalizedNumber = (string) ((int) $raw);
            if (array_key_exists($normalizedNumber, $dictionary)) {
                return $dictionary[$normalizedNumber];
            }
        }

        if (preg_match('/^(POS|P)(\d+)$/', $raw, $matches) === 1) {
            $normalizedCode = 'POS'.str_pad($matches[2], 3, '0', STR_PAD_LEFT);
            if (array_key_exists($normalizedCode, $dictionary)) {
                return $dictionary[$normalizedCode];
            }
        }

        return '';
    }

    private function localizeJobTitle(string $jobTitleRaw): string
    {
        $normalized = trim($jobTitleRaw);
        if ($normalized === '') {
            return '';
        }

        $positionName = $this->resolvePositionDisplayName($normalized);
        if ($positionName !== '') {
            return $positionName;
        }

        $lower = strtolower($normalized);

        $dictionary = [
            'system administrator' => 'Quan tri he thong',
            'sales executive' => 'Chuyen vien kinh doanh',
            'automation operator' => 'Van hanh tu dong hoa',
            'director' => 'Giam doc',
            'deputy director' => 'Pho giam doc',
            'manager' => 'Truong phong',
            'assistant manager' => 'Pho phong',
            'specialist' => 'Chuyen vien',
            'engineer' => 'Ky su',
            'developer' => 'Lap trinh vien',
            'operator' => 'Nhan vien van hanh',
            'business analyst' => 'Chuyen vien phan tich nghiep vu',
            'giam doc' => 'Giam doc',
            'pho giam doc' => 'Pho giam doc',
            'truong phong' => 'Truong phong',
            'pho phong' => 'Pho phong',
            'chuyen vien' => 'Chuyen vien',
        ];

        return $dictionary[$lower] ?? $normalized;
    }

    private function normalizeEmployeeCode(string $rawCode, mixed $id): string
    {
        $code = strtoupper(trim($rawCode));
        if ($code !== '' && preg_match('/^(VNPT|CTV)\d{5,}$/', $code) === 1) {
            return $code;
        }

        if (preg_match('/^NV(\d+)$/', $code, $matches) === 1) {
            return 'VNPT'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        if (preg_match('/^CTV(\d+)$/', $code, $matches) === 1) {
            return 'CTV'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        $idDigits = preg_replace('/\D+/', '', (string) $id);
        if ($idDigits !== '') {
            return 'VNPT'.str_pad($idDigits, 6, '0', STR_PAD_LEFT);
        }

        return $code !== '' ? $code : 'VNPT000000';
    }

    private function generateTemporaryPassword(int $length = 16): string
    {
        $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $lower = 'abcdefghijkmnopqrstuvwxyz';
        $digits = '23456789';
        $symbols = '@#$%&*-_=+!?';
        $all = $upper.$lower.$digits.$symbols;

        $passwordChars = [
            $upper[random_int(0, strlen($upper) - 1)],
            $lower[random_int(0, strlen($lower) - 1)],
            $digits[random_int(0, strlen($digits) - 1)],
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];

        for ($index = count($passwordChars); $index < max(12, $length); $index++) {
            $passwordChars[] = $all[random_int(0, strlen($all) - 1)];
        }

        shuffle($passwordChars);

        return implode('', $passwordChars);
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = $payload['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        if (is_array($payload['errors'] ?? null)) {
            foreach ($payload['errors'] as $fieldErrors) {
                if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                    return trim($fieldErrors[0]);
                }
            }
        }

        return $fallback;
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $fieldErrors) {
            if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                return trim($fieldErrors[0]);
            }
        }

        return 'Dữ liệu không hợp lệ.';
    }
}
