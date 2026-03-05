<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Opportunity;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OpportunityDomainService
{
    /**
     * @var array<int, string>
     */
    private const RACI_ROLES = ['R', 'A', 'C', 'I'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $query = Opportunity::query()
            ->with(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ->select($this->support->selectColumns('opportunities', [
                'id',
                'opp_name',
                'customer_id',
                'amount',
                'expected_value',
                'stage',
                'probability',
                'owner_id',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id');

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function (Builder $builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->support->hasColumn('opportunities', 'opp_name')) {
                    $builder->orWhere('opportunities.opp_name', 'like', $like);
                }

                if (
                    $this->support->hasTable('customers')
                    && ($this->support->hasColumn('customers', 'customer_code') || $this->support->hasColumn('customers', 'customer_name'))
                ) {
                    $builder->orWhereHas('customer', function (Builder $customerQuery) use ($like): void {
                        $customerQuery->where(function (Builder $customerFilter) use ($like): void {
                            if ($this->support->hasColumn('customers', 'customer_code')) {
                                $customerFilter->orWhere('customer_code', 'like', $like);
                            }
                            if ($this->support->hasColumn('customers', 'customer_name')) {
                                $customerFilter->orWhere('customer_name', 'like', $like);
                            }
                        });
                    });
                }
            });
        }

        $this->applyReadScope($request, $query);

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Opportunity $opportunity): array => $this->support->serializeOpportunity($opportunity))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Opportunity $opportunity): array => $this->support->serializeOpportunity($opportunity))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Opportunity $opportunity): array => $this->support->serializeOpportunity($opportunity))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function raciAssignments(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $opportunityIds = $this->parseOpportunityIdsFilter(
            $request->query('opportunity_ids', $request->query('opportunity_ids[]'))
        );
        if ($opportunityIds === []) {
            return response()->json(['data' => []]);
        }

        $allowedOpportunityQuery = Opportunity::query()
            ->select(['id'])
            ->whereIn('id', $opportunityIds);
        $this->applyReadScope($request, $allowedOpportunityQuery);

        $allowedOpportunityIds = $allowedOpportunityQuery
            ->pluck('id')
            ->map(fn ($value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        if ($allowedOpportunityIds === []) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $this->support->fetchOpportunityRaciAssignmentsByOpportunityIds($allowedOpportunityIds),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $rules = [
            'opp_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'integer'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'stage' => ['nullable', 'string', 'max:120'],
            'owner_id' => ['nullable', 'integer'],
            'data_scope' => ['nullable', 'string', 'max:255'],
            'sync_raci' => ['sometimes', 'boolean'],
            'raci' => ['sometimes', 'array', 'max:500'],
            'raci.*' => ['required', 'array'],
            'raci.*.user_id' => ['required', 'integer'],
            'raci.*.raci_role' => ['required', Rule::in(self::RACI_ROLES)],
        ];

        $validated = $request->validate($rules);
        $syncRaci = $this->shouldSyncCollection($validated, 'sync_raci', 'raci');
        $resolvedRaci = $syncRaci ? $this->resolveOpportunityRaciPayload($validated['raci'] ?? []) : [];

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $resolvedStage = $this->support->normalizeOpportunityStage((string) ($validated['stage'] ?? 'NEW'), false);
        if ($resolvedStage === null) {
            return response()->json(['message' => 'stage is invalid or inactive.'], 422);
        }

        $opportunity = new Opportunity();
        $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        $this->support->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        $this->support->setAttributeIfColumn(
            $opportunity,
            'opportunities',
            'stage',
            $this->support->toOpportunityStorageStage($resolvedStage)
        );

        if ($this->support->hasColumn('opportunities', 'owner_id')) {
            $requestedOwnerId = $this->support->parseNullableInt($validated['owner_id'] ?? null);
            $ownerId = $requestedOwnerId ?? $this->support->resolveDefaultOwnerId();

            if ($ownerId === null) {
                return response()->json(['message' => 'owner_id is required. Seed internal_users before creating opportunities.'], 422);
            }

            if (! $this->support->ownerExists($ownerId)) {
                $message = $requestedOwnerId !== null
                    ? 'owner_id is invalid.'
                    : 'owner_id is required. Seed internal_users before creating opportunities.';

                return response()->json(['message' => $message], 422);
            }

            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);

            if ($this->support->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->support->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }
        }

        if ($this->support->hasColumn('opportunities', 'data_scope')) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope'] ?? null);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'cơ hội',
            $this->support->extractIntFromRecord($this->accessAudit->toAuditArray($opportunity), ['dept_id', 'department_id']),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'created_by', $actorId);
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        DB::transaction(function () use ($opportunity, $syncRaci, $resolvedRaci, $actorId): void {
            $opportunity->save();

            if ($syncRaci) {
                $this->syncOpportunityRaci((int) $opportunity->getKey(), $resolvedRaci, $actorId);
            }
        });

        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'opportunities',
            $opportunity->getKey(),
            null,
            $this->accessAudit->toAuditArray($opportunity)
        );

        return response()->json([
            'data' => $this->support->serializeOpportunity(
                $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $opportunity, 'cơ hội');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($opportunity);

        $rules = [
            'opp_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'stage' => ['sometimes', 'nullable', 'string', 'max:120'],
            'owner_id' => ['sometimes', 'nullable', 'integer'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sync_raci' => ['sometimes', 'boolean'],
            'raci' => ['sometimes', 'array', 'max:500'],
            'raci.*' => ['required', 'array'],
            'raci.*.user_id' => ['required', 'integer'],
            'raci.*.raci_role' => ['required', Rule::in(self::RACI_ROLES)],
        ];

        $validated = $request->validate($rules);
        $syncRaci = $this->shouldSyncCollection($validated, 'sync_raci', 'raci');
        $resolvedRaci = $syncRaci ? $this->resolveOpportunityRaciPayload($validated['raci'] ?? []) : [];

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        }

        if (array_key_exists('opp_name', $validated)) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        }
        if (array_key_exists('amount', $validated)) {
            $this->support->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        }
        if (array_key_exists('stage', $validated)) {
            $resolvedStage = $this->support->normalizeOpportunityStage((string) ($validated['stage'] ?? ''), false);
            if ($resolvedStage === null) {
                return response()->json(['message' => 'stage is invalid or inactive.'], 422);
            }
            $this->support->setAttributeIfColumn(
                $opportunity,
                'opportunities',
                'stage',
                $this->support->toOpportunityStorageStage($resolvedStage)
            );
        }
        if (array_key_exists('owner_id', $validated) && $this->support->hasColumn('opportunities', 'owner_id')) {
            $ownerId = $this->support->parseNullableInt($validated['owner_id']);
            if ($ownerId === null || ! $this->support->ownerExists($ownerId)) {
                return response()->json(['message' => 'owner_id is invalid.'], 422);
            }

            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);
            $ownerDeptId = null;
            if ($this->support->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->support->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }

            $scopeError = $this->accessAudit->authorizeMutationByScope(
                $request,
                'cơ hội',
                $ownerDeptId,
                $this->accessAudit->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }
        if ($this->support->hasColumn('opportunities', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        DB::transaction(function () use ($opportunity, $syncRaci, $resolvedRaci, $actorId): void {
            $opportunity->save();

            if ($syncRaci) {
                $this->syncOpportunityRaci((int) $opportunity->getKey(), $resolvedRaci, $actorId);
            }
        });

        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'opportunities',
            $opportunity->getKey(),
            $before,
            $this->accessAudit->toAuditArray($opportunity)
        );

        return response()->json([
            'data' => $this->support->serializeOpportunity(
                $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('opportunities')) {
            return $this->support->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $opportunity, 'Opportunity');
    }

    /**
     * @param mixed $rawValue
     * @return array<int, int>
     */
    private function parseOpportunityIdsFilter(mixed $rawValue): array
    {
        $tokens = [];

        if (is_string($rawValue)) {
            $tokens = preg_split('/[\s,;]+/', $rawValue) ?: [];
        } elseif (is_array($rawValue)) {
            foreach ($rawValue as $token) {
                if (is_array($token)) {
                    foreach ($token as $child) {
                        $tokens[] = (string) $child;
                    }

                    continue;
                }

                $tokens[] = (string) $token;
            }
        } elseif ($rawValue !== null) {
            $tokens[] = (string) $rawValue;
        }

        $ids = [];
        foreach ($tokens as $token) {
            $id = $this->support->parseNullableInt($token);
            if ($id === null || $id <= 0) {
                continue;
            }
            $ids[] = $id;
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param array<string, mixed> $validated
     */
    private function shouldSyncCollection(array $validated, string $syncFlagKey, string $payloadKey): bool
    {
        if (array_key_exists($syncFlagKey, $validated) && filter_var($validated[$syncFlagKey], FILTER_VALIDATE_BOOL)) {
            return true;
        }

        return array_key_exists($payloadKey, $validated);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{user_id:int, raci_role:string}>
     */
    private function resolveOpportunityRaciPayload(array $rows): array
    {
        $normalized = [];
        $seenRole = [];
        $seenIdentity = [];

        foreach ($rows as $index => $row) {
            $userId = $this->support->parseNullableInt($row['user_id'] ?? null);
            if ($userId === null || $userId <= 0) {
                throw ValidationException::withMessages([
                    "raci.{$index}.user_id" => ['Nhân sự không hợp lệ.'],
                ]);
            }

            $role = strtoupper(trim((string) ($row['raci_role'] ?? '')));
            if (! in_array($role, self::RACI_ROLES, true)) {
                throw ValidationException::withMessages([
                    "raci.{$index}.raci_role" => ['Vai trò RACI không hợp lệ (chỉ nhận R/A/C/I).'],
                ]);
            }

            if (isset($seenRole[$role])) {
                throw ValidationException::withMessages([
                    "raci.{$index}.raci_role" => ["Vai trò {$role} đã được gán cho một nhân sự khác trong cơ hội này."],
                ]);
            }
            $seenRole[$role] = true;

            $identity = "{$userId}|{$role}";
            if (isset($seenIdentity[$identity])) {
                throw ValidationException::withMessages([
                    "raci.{$index}" => ['Nhân sự đã được gán cùng vai trò RACI trong cơ hội này.'],
                ]);
            }
            $seenIdentity[$identity] = true;

            $normalized[] = [
                'user_id' => $userId,
                'raci_role' => $role,
            ];
        }

        $userIds = collect($normalized)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($userIds->isEmpty()) {
            return $normalized;
        }

        if (! $this->support->hasTable('internal_users') || ! $this->support->hasColumn('internal_users', 'id')) {
            throw ValidationException::withMessages([
                'raci' => ['Không thể kiểm tra nhân sự do bảng internal_users chưa sẵn sàng.'],
            ]);
        }

        $existingUserIds = DB::table('internal_users')
            ->whereIn('id', $userIds->all())
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        $missingUserIds = array_values(array_diff($userIds->all(), $existingUserIds));
        if ($missingUserIds !== []) {
            throw ValidationException::withMessages([
                'raci' => ['Không tìm thấy nhân sự: '.implode(', ', $missingUserIds).'.'],
            ]);
        }

        return $normalized;
    }

    /**
     * @param array<int, array{user_id:int, raci_role:string}> $rows
     */
    private function syncOpportunityRaci(int $opportunityId, array $rows, ?int $actorId): void
    {
        if (! $this->support->hasTable('opportunity_raci_assignments')) {
            throw ValidationException::withMessages([
                'raci' => ['Hệ thống chưa hỗ trợ lưu phân công RACI cơ hội.'],
            ]);
        }

        foreach (['opportunity_id', 'user_id', 'raci_role'] as $requiredColumn) {
            if (! $this->support->hasColumn('opportunity_raci_assignments', $requiredColumn)) {
                throw ValidationException::withMessages([
                    'raci' => ["Bảng opportunity_raci_assignments thiếu cột {$requiredColumn}."],
                ]);
            }
        }

        DB::table('opportunity_raci_assignments')
            ->where('opportunity_id', $opportunityId)
            ->delete();

        if ($rows === []) {
            return;
        }

        $now = now();
        $insertRows = [];

        foreach ($rows as $row) {
            $insert = [
                'opportunity_id' => $opportunityId,
                'user_id' => $row['user_id'],
                'raci_role' => $row['raci_role'],
            ];

            if ($this->support->hasColumn('opportunity_raci_assignments', 'created_at')) {
                $insert['created_at'] = $now;
            }
            if ($this->support->hasColumn('opportunity_raci_assignments', 'updated_at')) {
                $insert['updated_at'] = $now;
            }
            if ($actorId !== null && $this->support->hasColumn('opportunity_raci_assignments', 'created_by')) {
                $insert['created_by'] = $actorId;
            }
            if ($actorId !== null && $this->support->hasColumn('opportunity_raci_assignments', 'updated_by')) {
                $insert['updated_by'] = $actorId;
            }

            $insertRows[] = $insert;
        }

        DB::table('opportunity_raci_assignments')->insert($insertRows);
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

            if ($this->support->hasColumn('opportunities', 'dept_id')) {
                $scope->whereIn('opportunities.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('opportunities', 'department_id')) {
                $scope->whereIn('opportunities.department_id', $allowedDeptIds);
                $applied = true;
            } elseif (
                $this->support->hasColumn('opportunities', 'owner_id')
                && $this->support->hasTable('internal_users')
                && $this->support->hasColumn('internal_users', 'department_id')
            ) {
                $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                    $subQuery->selectRaw('1')
                        ->from('internal_users as scope_iu')
                        ->whereColumn('scope_iu.id', 'opportunities.owner_id')
                        ->whereIn('scope_iu.department_id', $allowedDeptIds);
                });
                $applied = true;
            }

            if ($this->support->hasColumn('opportunities', 'created_by')) {
                if ($applied) {
                    $scope->orWhere('opportunities.created_by', $userId);
                } else {
                    $scope->where('opportunities.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }
}
