<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Opportunity;
use App\Models\Project;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectDomainService
{
    /**
     * @var array<int, string>
     */
    private const PROJECT_STATUSES = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];

    /**
     * @var array<int, string>
     */
    private const PROJECT_INPUT_STATUSES = [
        'TRIAL',
        'ONGOING',
        'WARRANTY',
        'COMPLETED',
        'CANCELLED',
        'PLANNING',
        'ACTIVE',
        'TERMINATED',
        'SUSPENDED',
        'EXPIRED',
    ];

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
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $query = Project::query()
            ->with(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ->select($this->support->selectColumns('projects', [
                'id',
                'project_code',
                'project_name',
                'customer_id',
                'opportunity_id',
                'investment_mode',
                'start_date',
                'expected_end_date',
                'actual_end_date',
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
                foreach (['project_code', 'project_name'] as $column) {
                    if ($this->support->hasColumn('projects', $column)) {
                        $builder->orWhere("projects.{$column}", 'like', $like);
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
            });
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::PROJECT_STATUSES, true) && $this->support->hasColumn('projects', 'status')) {
            $query->where('projects.status', $status);
        }

        $customerId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->support->hasColumn('projects', 'customer_id')) {
            $query->where('projects.customer_id', $customerId);
        }

        $this->applyReadScope($request, $query);

        $sortBy = $this->support->resolveSortColumn($request, [
            'id' => 'projects.id',
            'project_code' => 'projects.project_code',
            'project_name' => 'projects.project_name',
            'status' => 'projects.status',
            'start_date' => 'projects.start_date',
            'expected_end_date' => 'projects.expected_end_date',
            'created_at' => 'projects.created_at',
        ], 'projects.id');
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'projects.id' && $this->support->hasColumn('projects', 'id')) {
            $query->orderBy('projects.id', 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Project $project): array => $this->support->serializeProject($project))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Project $project): array => $this->support->serializeProject($project))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Project $project): array => $this->support->serializeProject($project))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $query = Project::query()
            ->with(['customer' => fn ($builder) => $builder->select($this->support->customerRelationColumns())])
            ->whereKey($id);

        $this->applyReadScope($request, $query);

        $project = $query->firstOrFail();

        return response()->json([
            'data' => $this->support->serializeProjectDetail($project),
        ]);
    }

    public function raciAssignments(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $projectIds = $this->parseProjectIdsFilter($request->query('project_ids', $request->query('project_ids[]')));
        if ($projectIds === []) {
            return response()->json(['data' => []]);
        }

        $allowedProjectQuery = Project::query()->select(['id'])->whereIn('id', $projectIds);
        $this->applyReadScope($request, $allowedProjectQuery);

        $allowedProjectIds = $allowedProjectQuery
            ->pluck('id')
            ->map(fn ($value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        if ($allowedProjectIds === []) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $this->support->fetchProjectRaciAssignmentsByProjectIds($allowedProjectIds),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $rules = [
            'project_code' => ['required', 'string', 'max:100'],
            'project_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(self::PROJECT_INPUT_STATUSES)],
            'opportunity_id' => ['nullable', 'integer'],
            'investment_mode' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date'],
            'actual_end_date' => ['nullable', 'date'],
            'data_scope' => ['nullable', 'string', 'max:255'],
            'sync_items' => ['sometimes', 'boolean'],
            'sync_raci' => ['sometimes', 'boolean'],
            'items' => ['sometimes', 'array', 'max:500'],
            'items.*' => ['required', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['nullable', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'raci' => ['sometimes', 'array', 'max:500'],
            'raci.*' => ['required', 'array'],
            'raci.*.user_id' => ['required', 'integer'],
            'raci.*.raci_role' => ['required', Rule::in(self::RACI_ROLES)],
            'raci.*.assigned_date' => ['sometimes', 'nullable', 'date'],
        ];

        if ($this->support->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code');
        }

        $validated = $request->validate($rules);

        $startDateInput = $validated['start_date'] ?? now()->toDateString();
        $expectedEndDateInput = $validated['expected_end_date'] ?? null;
        $actualEndDateInput = $validated['actual_end_date'] ?? null;
        $timelineError = $this->validateProjectTimeline($startDateInput, $expectedEndDateInput, $actualEndDateInput);
        if ($timelineError instanceof JsonResponse) {
            return $timelineError;
        }

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $opportunityId = $this->support->parseNullableInt($validated['opportunity_id'] ?? null);
        if ($opportunityId !== null && $this->support->hasTable('opportunities') && ! Opportunity::query()->whereKey($opportunityId)->exists()) {
            return response()->json(['message' => 'opportunity_id is invalid.'], 422);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'dự án',
            $this->support->resolveOpportunityDepartmentIdById($opportunityId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $syncItems = $this->shouldSyncCollection($validated, 'sync_items', 'items');
        $syncRaci = $this->shouldSyncCollection($validated, 'sync_raci', 'raci');
        $resolvedItems = $syncItems ? $this->resolveProjectItemsPayload($validated['items'] ?? []) : [];
        $resolvedRaci = $syncRaci ? $this->resolveProjectRaciPayload($validated['raci'] ?? []) : [];

        $project = new Project();

        DB::transaction(function () use (
            $project,
            $validated,
            $customerId,
            $opportunityId,
            $startDateInput,
            $syncItems,
            $resolvedItems,
            $syncRaci,
            $resolvedRaci,
            $actorId
        ): void {
            $this->support->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
            $this->support->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
            $this->support->setAttributeIfColumn($project, 'projects', 'customer_id', $customerId);
            $this->support->setAttributeIfColumn($project, 'projects', 'status', $this->support->toProjectStorageStatus((string) ($validated['status'] ?? 'TRIAL')));
            $this->support->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
            $this->support->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode'] ?? 'DAU_TU');

            if ($this->support->hasColumn('projects', 'start_date')) {
                $this->support->setAttributeIfColumn($project, 'projects', 'start_date', $startDateInput);
            }
            if (array_key_exists('expected_end_date', $validated)) {
                $this->support->setAttributeIfColumn($project, 'projects', 'expected_end_date', $validated['expected_end_date']);
            }
            if (array_key_exists('actual_end_date', $validated)) {
                $this->support->setAttributeIfColumn($project, 'projects', 'actual_end_date', $validated['actual_end_date']);
            }
            if ($this->support->hasColumn('projects', 'data_scope')) {
                $this->support->setAttributeIfColumn($project, 'projects', 'data_scope', $validated['data_scope'] ?? null);
            }

            if ($this->support->hasColumn('projects', 'dept_id')) {
                $this->support->setAttributeIfColumn(
                    $project,
                    'projects',
                    'dept_id',
                    $this->support->resolveOpportunityDepartmentIdById($opportunityId)
                );
            }

            if ($actorId !== null) {
                $this->support->setAttributeIfColumn($project, 'projects', 'created_by', $actorId);
                $this->support->setAttributeIfColumn($project, 'projects', 'updated_by', $actorId);
            }

            $project->save();

            if ($syncItems) {
                $this->syncProjectItems((int) $project->getKey(), $resolvedItems, $actorId);
            }

            if ($syncRaci) {
                $this->syncProjectRaci((int) $project->getKey(), $resolvedRaci, $actorId);
            }
        });

        $freshProject = Project::query()->with(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])->findOrFail($project->getKey());
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'projects',
            $freshProject->getKey(),
            null,
            $this->accessAudit->toAuditArray($freshProject)
        );

        return response()->json([
            'data' => $this->support->serializeProjectDetail($freshProject),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);
        $scopeError = $this->accessAudit->assertModelMutationAccess($request, $project, 'dự án');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->accessAudit->toAuditArray($project);

        $rules = [
            'project_code' => ['sometimes', 'required', 'string', 'max:100'],
            'project_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::in(self::PROJECT_INPUT_STATUSES)],
            'opportunity_id' => ['sometimes', 'nullable', 'integer'],
            'investment_mode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'expected_end_date' => ['sometimes', 'nullable', 'date'],
            'actual_end_date' => ['sometimes', 'nullable', 'date'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sync_items' => ['sometimes', 'boolean'],
            'sync_raci' => ['sometimes', 'boolean'],
            'items' => ['sometimes', 'array', 'max:500'],
            'items.*' => ['required', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['nullable', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'raci' => ['sometimes', 'array', 'max:500'],
            'raci.*' => ['required', 'array'],
            'raci.*.user_id' => ['required', 'integer'],
            'raci.*.raci_role' => ['required', Rule::in(self::RACI_ROLES)],
            'raci.*.assigned_date' => ['sometimes', 'nullable', 'date'],
        ];

        if ($this->support->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code')->ignore($project->id);
        }

        $validated = $request->validate($rules);

        $resolvedStartDate = array_key_exists('start_date', $validated)
            ? $validated['start_date']
            : ($project->getAttribute('start_date') ? (string) $project->getAttribute('start_date') : null);
        $resolvedExpectedEndDate = array_key_exists('expected_end_date', $validated)
            ? $validated['expected_end_date']
            : ($project->getAttribute('expected_end_date') ? (string) $project->getAttribute('expected_end_date') : null);
        $resolvedActualEndDate = array_key_exists('actual_end_date', $validated)
            ? $validated['actual_end_date']
            : ($project->getAttribute('actual_end_date') ? (string) $project->getAttribute('actual_end_date') : null);
        $timelineError = $this->validateProjectTimeline($resolvedStartDate, $resolvedExpectedEndDate, $resolvedActualEndDate);
        if ($timelineError instanceof JsonResponse) {
            return $timelineError;
        }

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->support->parseNullableInt($validated['customer_id']);
            if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->support->setAttributeIfColumn($project, 'projects', 'customer_id', $customerId);
        }

        if (array_key_exists('opportunity_id', $validated)) {
            $opportunityId = $this->support->parseNullableInt($validated['opportunity_id']);
            if ($opportunityId !== null && $this->support->hasTable('opportunities') && ! Opportunity::query()->whereKey($opportunityId)->exists()) {
                return response()->json(['message' => 'opportunity_id is invalid.'], 422);
            }
            $scopeError = $this->accessAudit->authorizeMutationByScope(
                $request,
                'dự án',
                $this->support->resolveOpportunityDepartmentIdById($opportunityId),
                $this->accessAudit->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }

            $this->support->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
            if ($this->support->hasColumn('projects', 'dept_id')) {
                $this->support->setAttributeIfColumn(
                    $project,
                    'projects',
                    'dept_id',
                    $this->support->resolveOpportunityDepartmentIdById($opportunityId)
                );
            }
        }

        if (array_key_exists('project_code', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
        }
        if (array_key_exists('project_name', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
        }
        if (array_key_exists('status', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'status', $this->support->toProjectStorageStatus((string) $validated['status']));
        }
        if (array_key_exists('investment_mode', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode']);
        }
        if (array_key_exists('start_date', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'start_date', $validated['start_date']);
        }
        if (array_key_exists('expected_end_date', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'expected_end_date', $validated['expected_end_date']);
        }
        if (array_key_exists('actual_end_date', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'actual_end_date', $validated['actual_end_date']);
        }
        if ($this->support->hasColumn('projects', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->support->setAttributeIfColumn($project, 'projects', 'updated_by', $actorId);
        }

        $syncItems = $this->shouldSyncCollection($validated, 'sync_items', 'items');
        $syncRaci = $this->shouldSyncCollection($validated, 'sync_raci', 'raci');
        $resolvedItems = $syncItems ? $this->resolveProjectItemsPayload($validated['items'] ?? []) : [];
        $resolvedRaci = $syncRaci ? $this->resolveProjectRaciPayload($validated['raci'] ?? []) : [];

        DB::transaction(function () use ($project, $syncItems, $resolvedItems, $syncRaci, $resolvedRaci, $actorId): void {
            $project->save();

            if ($syncItems) {
                $this->syncProjectItems((int) $project->getKey(), $resolvedItems, $actorId);
            }

            if ($syncRaci) {
                $this->syncProjectRaci((int) $project->getKey(), $resolvedRaci, $actorId);
            }
        });

        $freshProject = Project::query()->with(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])->findOrFail($project->getKey());
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'projects',
            $freshProject->getKey(),
            $before,
            $this->accessAudit->toAuditArray($freshProject)
        );

        return response()->json([
            'data' => $this->support->serializeProjectDetail($freshProject),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);

        return $this->accessAudit->deleteModel($request, $project, 'Project');
    }

    /**
     * @param mixed $rawValue
     * @return array<int, int>
     */
    private function parseProjectIdsFilter(mixed $rawValue): array
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
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array{product_id:int, quantity:float, unit_price:float}>
     */
    private function resolveProjectItemsPayload(array $items): array
    {
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
                    "items.{$index}.product_id" => ['Không được chọn trùng sản phẩm trong cùng một dự án.'],
                ]);
            }
            $seen[$productId] = true;

            $quantity = is_numeric($item['quantity'] ?? null) ? (float) $item['quantity'] : 1.0;
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
            ];
        }

        return $normalized;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{user_id:int, raci_role:string, assigned_date:?string}>
     */
    private function resolveProjectRaciPayload(array $rows): array
    {
        $normalized = [];
        $seen = [];

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

            $identity = "{$userId}|{$role}";
            if (isset($seen[$identity])) {
                throw ValidationException::withMessages([
                    "raci.{$index}" => ['Nhân sự đã được gán cùng vai trò RACI trong dự án này.'],
                ]);
            }
            $seen[$identity] = true;

            $assignedDateInput = $row['assigned_date'] ?? null;
            $assignedDate = $this->normalizeDatePortion($assignedDateInput);
            if (
                $assignedDate === null
                && $assignedDateInput !== null
                && trim((string) $assignedDateInput) !== ''
            ) {
                throw ValidationException::withMessages([
                    "raci.{$index}.assigned_date" => ['Ngày phân công không hợp lệ.'],
                ]);
            }

            $normalized[] = [
                'user_id' => $userId,
                'raci_role' => $role,
                'assigned_date' => $assignedDate,
            ];
        }

        return $normalized;
    }

    /**
     * @param array<int, array{product_id:int, quantity:float, unit_price:float}> $items
     */
    private function syncProjectItems(int $projectId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('project_items')) {
            throw ValidationException::withMessages([
                'items' => ['Hệ thống chưa hỗ trợ lưu hạng mục dự án.'],
            ]);
        }

        foreach (['project_id', 'product_id'] as $requiredColumn) {
            if (! $this->support->hasColumn('project_items', $requiredColumn)) {
                throw ValidationException::withMessages([
                    'items' => ["Bảng project_items thiếu cột {$requiredColumn}."],
                ]);
            }
        }

        $productIds = collect($items)
            ->pluck('product_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

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

        DB::table('project_items')->where('project_id', $projectId)->delete();

        if ($items === []) {
            return;
        }

        $now = now();
        $rows = [];
        foreach ($items as $item) {
            $row = [
                'project_id' => $projectId,
                'product_id' => $item['product_id'],
            ];

            if ($this->support->hasColumn('project_items', 'quantity')) {
                $row['quantity'] = $item['quantity'];
            }
            if ($this->support->hasColumn('project_items', 'unit_price')) {
                $row['unit_price'] = $item['unit_price'];
            }
            if ($this->support->hasColumn('project_items', 'created_at')) {
                $row['created_at'] = $now;
            }
            if ($this->support->hasColumn('project_items', 'updated_at')) {
                $row['updated_at'] = $now;
            }
            if ($actorId !== null && $this->support->hasColumn('project_items', 'created_by')) {
                $row['created_by'] = $actorId;
            }
            if ($actorId !== null && $this->support->hasColumn('project_items', 'updated_by')) {
                $row['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn('project_items', 'deleted_at')) {
                $row['deleted_at'] = null;
            }

            $rows[] = $row;
        }

        DB::table('project_items')->insert($rows);
    }

    /**
     * @param array<int, array{user_id:int, raci_role:string, assigned_date:?string}> $rows
     */
    private function syncProjectRaci(int $projectId, array $rows, ?int $actorId): void
    {
        if (! $this->support->hasTable('raci_assignments')) {
            throw ValidationException::withMessages([
                'raci' => ['Hệ thống chưa hỗ trợ lưu phân công RACI.'],
            ]);
        }

        foreach (['entity_type', 'entity_id', 'user_id', 'raci_role'] as $requiredColumn) {
            if (! $this->support->hasColumn('raci_assignments', $requiredColumn)) {
                throw ValidationException::withMessages([
                    'raci' => ["Bảng raci_assignments thiếu cột {$requiredColumn}."],
                ]);
            }
        }

        $userIds = collect($rows)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();

        if ($userIds->isNotEmpty()) {
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
        }

        DB::table('raci_assignments')
            ->where('entity_id', $projectId)
            ->whereRaw('LOWER(entity_type) = ?', ['project'])
            ->delete();

        if ($rows === []) {
            return;
        }

        $now = now();
        $insertRows = [];
        foreach ($rows as $row) {
            $assignedAt = ! empty($row['assigned_date'])
                ? Carbon::parse((string) $row['assigned_date'])->startOfDay()
                : $now;
            $insert = [
                'entity_type' => 'project',
                'entity_id' => $projectId,
                'user_id' => $row['user_id'],
                'raci_role' => $row['raci_role'],
            ];

            if ($this->support->hasColumn('raci_assignments', 'assigned_date')) {
                $insert['assigned_date'] = $row['assigned_date'];
            }
            if ($this->support->hasColumn('raci_assignments', 'created_at')) {
                $insert['created_at'] = $assignedAt;
            }
            if ($this->support->hasColumn('raci_assignments', 'updated_at')) {
                $insert['updated_at'] = $now;
            }
            if ($actorId !== null && $this->support->hasColumn('raci_assignments', 'created_by')) {
                $insert['created_by'] = $actorId;
            }
            if ($actorId !== null && $this->support->hasColumn('raci_assignments', 'updated_by')) {
                $insert['updated_by'] = $actorId;
            }

            $insertRows[] = $insert;
        }

        DB::table('raci_assignments')->insert($insertRows);
    }

    private function normalizeDatePortion(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
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

    private function validateProjectTimeline(?string $startDate, ?string $expectedEndDate, ?string $actualEndDate): ?JsonResponse
    {
        $startTimestamp = $startDate ? strtotime($startDate) : false;
        $expectedEndTimestamp = $expectedEndDate ? strtotime($expectedEndDate) : false;
        $actualEndTimestamp = $actualEndDate ? strtotime($actualEndDate) : false;

        if ($startTimestamp !== false && $expectedEndTimestamp !== false && $startTimestamp >= $expectedEndTimestamp) {
            return response()->json([
                'message' => 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc dự án.',
                'errors' => [
                    'start_date' => ['Ngày bắt đầu phải nhỏ hơn ngày kết thúc dự án.'],
                    'expected_end_date' => ['Ngày kết thúc dự án phải lớn hơn ngày bắt đầu.'],
                ],
            ], 422);
        }

        if ($expectedEndTimestamp !== false && $actualEndTimestamp !== false && $expectedEndTimestamp > $actualEndTimestamp) {
            return response()->json([
                'message' => 'Ngày kết thúc dự án phải nhỏ hơn hoặc bằng ngày kết thúc thực tế.',
                'errors' => [
                    'expected_end_date' => ['Ngày kết thúc dự án phải nhỏ hơn hoặc bằng ngày kết thúc thực tế.'],
                    'actual_end_date' => ['Ngày kết thúc thực tế phải lớn hơn hoặc bằng ngày kết thúc dự án.'],
                ],
            ], 422);
        }

        return null;
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

            if ($this->support->hasColumn('projects', 'dept_id')) {
                $scope->whereIn('projects.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('projects', 'department_id')) {
                $scope->whereIn('projects.department_id', $allowedDeptIds);
                $applied = true;
            } elseif (
                $this->support->hasColumn('projects', 'opportunity_id')
                && $this->support->hasTable('opportunities')
            ) {
                $opportunityDeptColumn = null;
                if ($this->support->hasColumn('opportunities', 'dept_id')) {
                    $opportunityDeptColumn = 'dept_id';
                } elseif ($this->support->hasColumn('opportunities', 'department_id')) {
                    $opportunityDeptColumn = 'department_id';
                }

                if ($opportunityDeptColumn !== null) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $opportunityDeptColumn): void {
                        $subQuery->selectRaw('1')
                            ->from('opportunities as scope_opp')
                            ->whereColumn('scope_opp.id', 'projects.opportunity_id')
                            ->whereIn("scope_opp.{$opportunityDeptColumn}", $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if ($this->support->hasColumn('projects', 'created_by')) {
                if ($applied) {
                    $scope->orWhere('projects.created_by', $userId);
                } else {
                    $scope->where('projects.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }
}
