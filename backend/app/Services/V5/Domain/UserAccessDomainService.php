<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserAccessDomainService
{
    /**
     * @var array<int, string>
     */
    private const USER_DEPT_SCOPE_TYPES = ['SELF_ONLY', 'DEPT_ONLY', 'DEPT_AND_CHILDREN', 'ALL'];

    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function roles(): JsonResponse
    {
        if (! $this->support->hasTable('roles')) {
            return $this->support->missingTable('roles');
        }

        $rows = DB::table('roles')
            ->select($this->support->selectColumns('roles', [
                'id',
                'role_code',
                'role_name',
                'description',
                'is_system',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;

                return [
                    'id' => isset($data['id']) ? (int) $data['id'] : null,
                    'role_code' => (string) ($data['role_code'] ?? ''),
                    'role_name' => (string) ($data['role_name'] ?? ''),
                    'description' => $data['description'] ?? null,
                    'is_system' => (bool) ($data['is_system'] ?? false),
                    'created_at' => $data['created_at'] ?? null,
                    'updated_at' => $data['updated_at'] ?? null,
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function permissions(): JsonResponse
    {
        if (! $this->support->hasTable('permissions')) {
            return $this->support->missingTable('permissions');
        }

        $rows = DB::table('permissions')
            ->select($this->support->selectColumns('permissions', [
                'id',
                'perm_key',
                'perm_name',
                'perm_group',
                'is_active',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('perm_group')
            ->orderBy('perm_key')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;

                return [
                    'id' => isset($data['id']) ? (int) $data['id'] : null,
                    'perm_key' => (string) ($data['perm_key'] ?? ''),
                    'perm_name' => (string) ($data['perm_name'] ?? ''),
                    'perm_group' => (string) ($data['perm_group'] ?? ''),
                    'is_active' => (bool) ($data['is_active'] ?? true),
                    'created_at' => $data['created_at'] ?? null,
                    'updated_at' => $data['updated_at'] ?? null,
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function userAccess(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('internal_users')) {
            return $this->support->missingTable('internal_users');
        }

        $search = trim((string) $request->query('search', ''));
        $rows = $this->buildUserAccessRows(
            userIds: [],
            search: $search !== '' ? $search : null
        );

        return response()->json(['data' => $rows]);
    }

    public function updateUserRoles(Request $request, int $userId): JsonResponse
    {
        if (! $this->support->hasTable('internal_users') || ! $this->support->hasTable('user_roles') || ! $this->support->hasTable('roles')) {
            return response()->json(['message' => 'Bang phan quyen chua san sang.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Khong tim thay nguoi dung.'], 404);
        }

        $validated = $request->validate([
            'role_ids' => ['required', 'array'],
            'role_ids.*' => ['integer'],
        ]);

        $rawRoleIds = is_array($validated['role_ids'] ?? null) ? $validated['role_ids'] : [];
        $normalizedRoleIds = [];
        $invalidRoleIds = [];
        $roleIdCounters = [];

        foreach ($rawRoleIds as $rawRoleId) {
            $roleId = (int) $rawRoleId;
            if ($roleId <= 0) {
                $invalidRoleIds[] = $rawRoleId;
                continue;
            }

            $normalizedRoleIds[] = $roleId;
            $roleIdCounters[$roleId] = ($roleIdCounters[$roleId] ?? 0) + 1;
        }

        if ($invalidRoleIds !== []) {
            return response()->json([
                'message' => 'role_ids chua gia tri khong hop le.',
                'errors' => [
                    'role_ids' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidRoleIds))),
                ],
            ], 422);
        }

        $duplicateRoleIds = array_values(array_map(
            'intval',
            array_keys(array_filter($roleIdCounters, static fn (int $count): bool => $count > 1))
        ));

        if ($duplicateRoleIds !== []) {
            return response()->json([
                'message' => 'role_ids bi trung.',
                'errors' => [
                    'duplicate_role_ids' => $duplicateRoleIds,
                ],
            ], 422);
        }

        $roleIds = array_values(array_unique($normalizedRoleIds));
        if ($roleIds === []) {
            return response()->json(['message' => 'role_ids la bat buoc.'], 422);
        }

        $validRoleCount = DB::table('roles')->whereIn('id', $roleIds)->count();
        if ($validRoleCount !== count($roleIds)) {
            return response()->json(['message' => 'role_ids chua gia tri khong hop le.'], 422);
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $roleIds, $actorId, $now): void {
            DB::table('user_roles')->where('user_id', $userId)->delete();

            $records = [];
            foreach ($roleIds as $roleId) {
                $record = [
                    'user_id' => $userId,
                    'role_id' => $roleId,
                ];

                if ($this->support->hasColumn('user_roles', 'is_active')) {
                    $record['is_active'] = 1;
                }
                if ($this->support->hasColumn('user_roles', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->support->hasColumn('user_roles', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            if ($records !== []) {
                DB::table('user_roles')->insert($records);
            }
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Khong the tai du lieu sau khi cap nhat.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    public function updateUserPermissions(Request $request, int $userId): JsonResponse
    {
        if (! $this->support->hasTable('internal_users') || ! $this->support->hasTable('user_permissions') || ! $this->support->hasTable('permissions')) {
            return response()->json(['message' => 'Bang phan quyen chua san sang.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Khong tim thay nguoi dung.'], 404);
        }

        $validated = $request->validate([
            'overrides' => ['nullable', 'array'],
            'overrides.*.permission_id' => ['required', 'integer'],
            'overrides.*.type' => ['required', Rule::in(['GRANT', 'DENY'])],
            'overrides.*.reason' => ['nullable', 'string', 'max:500'],
            'overrides.*.expires_at' => ['nullable', 'date'],
        ]);

        $rawOverrides = is_array($validated['overrides'] ?? null) ? $validated['overrides'] : [];
        $normalizedOverrides = [];
        $invalidPermissionIds = [];
        $permissionIdCounters = [];

        foreach ($rawOverrides as $override) {
            if (! is_array($override)) {
                continue;
            }

            $permissionId = (int) ($override['permission_id'] ?? 0);
            if ($permissionId <= 0) {
                $invalidPermissionIds[] = $override['permission_id'] ?? null;
                continue;
            }

            $permissionIdCounters[$permissionId] = ($permissionIdCounters[$permissionId] ?? 0) + 1;
            $normalizedOverrides[] = [
                'permission_id' => $permissionId,
                'type' => strtoupper((string) ($override['type'] ?? 'GRANT')) === 'DENY' ? 'DENY' : 'GRANT',
                'reason' => trim((string) ($override['reason'] ?? 'Phan quyen cap nhat tu giao dien')),
                'expires_at' => $override['expires_at'] ?? null,
            ];
        }

        if ($invalidPermissionIds !== []) {
            return response()->json([
                'message' => 'permission_id chua gia tri khong hop le.',
                'errors' => [
                    'permission_id' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidPermissionIds))),
                ],
            ], 422);
        }

        $duplicatePermissionIds = array_values(array_map(
            'intval',
            array_keys(array_filter($permissionIdCounters, static fn (int $count): bool => $count > 1))
        ));
        if ($duplicatePermissionIds !== []) {
            return response()->json([
                'message' => 'overrides bi trung permission_id.',
                'errors' => [
                    'duplicate_permission_ids' => $duplicatePermissionIds,
                ],
            ], 422);
        }

        $overrides = $normalizedOverrides;
        $permissionIds = array_values(array_unique(array_map(
            fn (array $item): int => (int) ($item['permission_id'] ?? 0),
            $overrides
        )));

        if ($permissionIds !== []) {
            $validPermissionCount = DB::table('permissions')->whereIn('id', $permissionIds)->count();
            if ($validPermissionCount !== count($permissionIds)) {
                return response()->json(['message' => 'permission_id chua gia tri khong hop le.'], 422);
            }
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $overrides, $actorId, $now): void {
            DB::table('user_permissions')->where('user_id', $userId)->delete();

            if ($overrides === []) {
                return;
            }

            $records = [];
            foreach ($overrides as $override) {
                $record = [
                    'user_id' => $userId,
                    'permission_id' => (int) $override['permission_id'],
                    'type' => strtoupper((string) ($override['type'] ?? 'GRANT')),
                    'reason' => trim((string) ($override['reason'] ?? 'Phan quyen cap nhat tu giao dien')),
                ];

                if ($this->support->hasColumn('user_permissions', 'expires_at')) {
                    $record['expires_at'] = $override['expires_at'] ?? null;
                }
                if ($this->support->hasColumn('user_permissions', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->support->hasColumn('user_permissions', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            DB::table('user_permissions')->insert($records);
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Khong the tai du lieu sau khi cap nhat.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    public function updateUserDeptScopes(Request $request, int $userId): JsonResponse
    {
        if (! $this->support->hasTable('internal_users') || ! $this->support->hasTable('user_dept_scopes') || ! $this->support->hasTable('departments')) {
            return response()->json(['message' => 'Bang phan quyen pham vi chua san sang.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Khong tim thay nguoi dung.'], 404);
        }

        $validated = $request->validate([
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*.dept_id' => ['required', 'integer'],
            'scopes.*.scope_type' => ['required', Rule::in(self::USER_DEPT_SCOPE_TYPES)],
        ]);

        $rawScopes = is_array($validated['scopes'] ?? null) ? $validated['scopes'] : [];
        $normalizedScopes = [];
        $invalidDeptIds = [];
        $duplicateScopeKeys = [];
        $scopeKeyCounters = [];

        foreach ($rawScopes as $scope) {
            if (! is_array($scope)) {
                continue;
            }

            $deptId = (int) ($scope['dept_id'] ?? 0);
            if ($deptId <= 0) {
                $invalidDeptIds[] = $scope['dept_id'] ?? null;
                continue;
            }

            $scopeType = strtoupper((string) ($scope['scope_type'] ?? ''));
            if (! in_array($scopeType, self::USER_DEPT_SCOPE_TYPES, true)) {
                continue;
            }

            $key = $deptId.'|'.$scopeType;
            $scopeKeyCounters[$key] = ($scopeKeyCounters[$key] ?? 0) + 1;
            if ($scopeKeyCounters[$key] > 1) {
                $duplicateScopeKeys[] = $key;
                continue;
            }

            $normalizedScopes[] = [
                'dept_id' => $deptId,
                'scope_type' => $scopeType,
            ];
        }

        if ($invalidDeptIds !== []) {
            return response()->json([
                'message' => 'dept_id chua gia tri khong hop le.',
                'errors' => [
                    'dept_id' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidDeptIds))),
                ],
            ], 422);
        }

        if ($duplicateScopeKeys !== []) {
            return response()->json([
                'message' => 'scopes bi trung (dept_id + scope_type).',
                'errors' => [
                    'duplicate_scopes' => array_values(array_unique($duplicateScopeKeys)),
                ],
            ], 422);
        }

        $scopes = $normalizedScopes;
        if ($scopes === []) {
            return response()->json(['message' => 'scopes la bat buoc.'], 422);
        }

        $deptIds = array_values(array_unique(array_map(
            fn (array $scope): int => (int) ($scope['dept_id'] ?? 0),
            $scopes
        )));

        $validDeptCount = DB::table('departments')->whereIn('id', $deptIds)->count();
        if ($validDeptCount !== count($deptIds)) {
            return response()->json(['message' => 'dept_id chua gia tri khong hop le.'], 422);
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $scopes, $actorId, $now): void {
            DB::table('user_dept_scopes')->where('user_id', $userId)->delete();

            $records = [];
            foreach ($scopes as $scope) {
                $record = [
                    'user_id' => $userId,
                    'dept_id' => (int) $scope['dept_id'],
                    'scope_type' => strtoupper((string) $scope['scope_type']),
                ];

                if ($this->support->hasColumn('user_dept_scopes', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->support->hasColumn('user_dept_scopes', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            DB::table('user_dept_scopes')->insert($records);
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Khong the tai du lieu sau khi cap nhat.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    /**
     * @param array<int, int> $userIds
     * @return array<int, array<string, mixed>>
     */
    public function buildUserAccessRows(array $userIds, ?string $search): array
    {
        $query = DB::table('internal_users as iu');
        if ($this->support->hasTable('departments')) {
            $query->leftJoin('departments as d', 'iu.department_id', '=', 'd.id');
        }

        $query->select($this->resolveUserAccessBaseSelectColumns());

        if ($userIds !== []) {
            $query->whereIn('iu.id', $userIds);
        }

        if ($search !== null && $search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                $builder->orWhere('iu.username', 'like', $like);
                if ($this->support->hasColumn('internal_users', 'user_code')) {
                    $builder->orWhere('iu.user_code', 'like', $like);
                }
                if ($this->support->hasColumn('internal_users', 'full_name')) {
                    $builder->orWhere('iu.full_name', 'like', $like);
                }
                if ($this->support->hasColumn('internal_users', 'email')) {
                    $builder->orWhere('iu.email', 'like', $like);
                }
                if ($this->support->hasTable('departments') && $this->support->hasColumn('departments', 'dept_name')) {
                    $builder->orWhere('d.dept_name', 'like', $like);
                }
            });
        }

        $users = $query
            ->orderBy('iu.id')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;
                $id = isset($data['id']) ? (int) $data['id'] : 0;

                return [
                    'id' => $id,
                    'user_code' => (string) ($data['user_code'] ?? ''),
                    'username' => (string) ($data['username'] ?? ''),
                    'full_name' => (string) ($data['full_name'] ?? ''),
                    'email' => (string) ($data['email'] ?? ''),
                    'status' => (string) ($data['status'] ?? ''),
                    'department_id' => $data['department_id'] ?? null,
                    'department_code' => $data['department_code'] ?? null,
                    'department_name' => $data['department_name'] ?? null,
                ];
            })
            ->filter(fn (array $item): bool => $item['id'] > 0)
            ->values()
            ->all();

        $targetUserIds = array_values(array_unique(array_map(fn (array $user): int => $user['id'], $users)));
        if ($targetUserIds === []) {
            return [];
        }

        $rolesByUser = [];
        if ($this->support->hasTable('user_roles') && $this->support->hasTable('roles')) {
            $now = now();
            DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->whereIn('ur.user_id', $targetUserIds)
                ->when($this->support->hasColumn('user_roles', 'is_active'), fn ($query) => $query->where('ur.is_active', 1))
                ->when(
                    $this->support->hasColumn('user_roles', 'expires_at'),
                    fn ($query) => $query->where(function ($builder) use ($now): void {
                        $builder->whereNull('ur.expires_at')->orWhere('ur.expires_at', '>', $now);
                    })
                )
                ->select([
                    'ur.user_id',
                    'r.id as role_id',
                    'r.role_code',
                    'r.role_name',
                ])
                ->orderBy('r.role_code')
                ->get()
                ->each(function (object $row) use (&$rolesByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $rolesByUser[$userId] ??= [];
                    $rolesByUser[$userId][] = [
                        'role_id' => (int) ($row->role_id ?? 0),
                        'role_code' => (string) ($row->role_code ?? ''),
                        'role_name' => (string) ($row->role_name ?? ''),
                    ];
                });
        }

        $permissionsByUser = [];
        if ($this->support->hasTable('user_permissions') && $this->support->hasTable('permissions')) {
            $now = now();
            DB::table('user_permissions as up')
                ->join('permissions as p', 'up.permission_id', '=', 'p.id')
                ->whereIn('up.user_id', $targetUserIds)
                ->when(
                    $this->support->hasColumn('user_permissions', 'expires_at'),
                    fn ($query) => $query->where(function ($builder) use ($now): void {
                        $builder->whereNull('up.expires_at')->orWhere('up.expires_at', '>', $now);
                    })
                )
                ->select([
                    'up.user_id',
                    'up.permission_id',
                    'up.type',
                    'up.reason',
                    'up.expires_at',
                    'p.perm_key',
                    'p.perm_name',
                    'p.perm_group',
                ])
                ->orderBy('p.perm_group')
                ->orderBy('p.perm_key')
                ->get()
                ->each(function (object $row) use (&$permissionsByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $permissionsByUser[$userId] ??= [];
                    $permissionsByUser[$userId][] = [
                        'permission_id' => (int) ($row->permission_id ?? 0),
                        'perm_key' => (string) ($row->perm_key ?? ''),
                        'perm_name' => (string) ($row->perm_name ?? ''),
                        'perm_group' => (string) ($row->perm_group ?? ''),
                        'type' => strtoupper((string) ($row->type ?? 'GRANT')),
                        'reason' => $row->reason ?? null,
                        'expires_at' => $row->expires_at ?? null,
                    ];
                });
        }

        $scopesByUser = [];
        if ($this->support->hasTable('user_dept_scopes')) {
            $scopeQuery = DB::table('user_dept_scopes as uds')
                ->whereIn('uds.user_id', $targetUserIds);

            if ($this->support->hasTable('departments')) {
                $scopeQuery->leftJoin('departments as ds', 'uds.dept_id', '=', 'ds.id');
            }

            $scopeSelects = ['uds.user_id', 'uds.id as scope_id', 'uds.dept_id', 'uds.scope_type'];
            if ($this->support->hasTable('departments') && $this->support->hasColumn('departments', 'dept_code')) {
                $scopeSelects[] = 'ds.dept_code as dept_code';
            }
            if ($this->support->hasTable('departments') && $this->support->hasColumn('departments', 'dept_name')) {
                $scopeSelects[] = 'ds.dept_name as dept_name';
            }

            $scopeQuery
                ->select($scopeSelects)
                ->orderBy('uds.id')
                ->get()
                ->each(function (object $row) use (&$scopesByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $scopesByUser[$userId] ??= [];
                    $scopesByUser[$userId][] = [
                        'id' => (int) ($row->scope_id ?? 0),
                        'dept_id' => (int) ($row->dept_id ?? 0),
                        'dept_code' => $row->dept_code ?? null,
                        'dept_name' => $row->dept_name ?? null,
                        'scope_type' => strtoupper((string) ($row->scope_type ?? 'DEPT_ONLY')),
                    ];
                });
        }

        return array_map(function (array $user) use ($rolesByUser, $permissionsByUser, $scopesByUser): array {
            $userId = (int) $user['id'];
            return [
                'user' => $user,
                'roles' => $rolesByUser[$userId] ?? [],
                'permissions' => $permissionsByUser[$userId] ?? [],
                'dept_scopes' => $scopesByUser[$userId] ?? [],
            ];
        }, $users);
    }

    /**
     * @return array<int, string>
     */
    private function resolveUserAccessBaseSelectColumns(): array
    {
        $selects = ['iu.id as id'];
        foreach (['user_code', 'username', 'full_name', 'email', 'status', 'department_id'] as $column) {
            if ($this->support->hasColumn('internal_users', $column)) {
                $selects[] = "iu.{$column} as {$column}";
            }
        }

        if ($this->support->hasTable('departments') && $this->support->hasColumn('departments', 'dept_code')) {
            $selects[] = 'd.dept_code as department_code';
        }
        if ($this->support->hasTable('departments') && $this->support->hasColumn('departments', 'dept_name')) {
            $selects[] = 'd.dept_name as department_name';
        }

        return $selects;
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table)) {
            return false;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }
}
