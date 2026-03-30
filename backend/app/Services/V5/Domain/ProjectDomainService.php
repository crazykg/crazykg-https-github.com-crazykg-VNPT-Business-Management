<?php

namespace App\Services\V5\Domain;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Models\Project;
use App\Services\V5\CacheService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectDomainService
{
    use ResolvesValidatedInput;

    private const CACHE_TAG = 'projects';

    private const LIST_CACHE_TTL = 120;

    private const DEFAULT_PROJECT_STATUS = 'CHUAN_BI';

    private const RENTAL_DEFAULT_PROJECT_STATUS = 'CHUAN_BI_KH_THUE';

    /**
     * @var array<int, string>
     */
    private const SPECIAL_PROJECT_STATUSES = ['TAM_NGUNG', 'HUY'];

    private const STATUS_REASON_MAX_LENGTH = 2000;

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
        'CO_HOI',
    ];

    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    /**
     * @var array<int, string>
     */
    private const RACI_ROLES = ['R', 'A', 'C', 'I'];

    /**
     * @var array<int, string>|null
     */
    private ?array $supportedProjectInvestmentModes = null;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CacheService $cache,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('projects')) {
            return $this->support->missingTable('projects');
        }

        $payload = $this->cache->rememberList(
            self::CACHE_TAG,
            $this->buildListCacheKey($request),
            self::LIST_CACHE_TTL,
            fn (): array => $this->buildIndexPayload($request),
        );

        return response()->json($payload);
    }

    public function flushListCache(): void
    {
        $this->cache->flushTags([self::CACHE_TAG]);
    }

    /**
     * @return array{data: \Illuminate\Support\Collection<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    private function buildIndexPayload(Request $request): array
    {
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
                'status_reason',
                'payment_cycle',
                'estimated_value',
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

        $status = trim((string) ($this->support->readFilterParam($request, 'status', '') ?? ''));
        if ($status !== '' && $this->support->hasColumn('projects', 'status')) {
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

                return [
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ];
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Project $project): array => $this->support->serializeProject($project))
                ->values();

            return [
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ];
        }

        $rows = $query
            ->get()
            ->map(fn (Project $project): array => $this->support->serializeProject($project))
            ->values();

        return [
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ];
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
            'status' => ['nullable', 'string', 'max:100'],
            'status_reason' => ['nullable', 'string', 'max:'.self::STATUS_REASON_MAX_LENGTH],
            'investment_mode' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date'],
            'actual_end_date' => ['nullable', 'date'],
            'payment_cycle' => ['nullable', 'string', Rule::in(self::PAYMENT_CYCLES)],
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

        $validated = $this->validatedInput($request);
        $validated['investment_mode'] = $this->normalizeSubmittedInvestmentMode($validated['investment_mode'] ?? null) ?? 'DAU_TU';
        $paymentCycleError = $this->validateRequiredProjectPaymentCycle(
            $validated['investment_mode'],
            $validated['payment_cycle'] ?? null
        );
        if ($paymentCycleError instanceof JsonResponse) {
            return $paymentCycleError;
        }
        $resolvedStatus = $this->resolveSubmittedProjectStatus(
            $validated['status'] ?? null,
            $validated['investment_mode'] ?? null
        );
        $resolvedStatusReason = $this->resolveProjectStatusReason(
            $resolvedStatus,
            $validated['status_reason'] ?? null
        );

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

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $scopeError = $this->accessAudit->authorizeMutationByScope(
            $request,
            'dự án',
            null,
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
            $resolvedStatus,
            $resolvedStatusReason,
            $customerId,
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
            $this->support->setAttributeIfColumn($project, 'projects', 'status', $resolvedStatus);
            $this->support->setAttributeIfColumn($project, 'projects', 'status_reason', $resolvedStatusReason);
            $this->support->setAttributeIfColumn($project, 'projects', 'opportunity_id', null);
            $this->support->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode'] ?? 'DAU_TU');
            $this->support->setAttributeIfColumn($project, 'projects', 'payment_cycle', $validated['payment_cycle'] ?? null);

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
                    null
                );
            }

            if ($actorId !== null) {
                $this->support->setAttributeIfColumn($project, 'projects', 'created_by', $actorId);
                $this->support->setAttributeIfColumn($project, 'projects', 'updated_by', $actorId);
            }

            $project->save();

            if ($syncItems) {
                $this->syncProjectItems((int) $project->getKey(), $resolvedItems, $actorId);
                $this->syncProjectEstimatedValue((int) $project->getKey());
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
        $this->flushListCache();

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
            'status' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status_reason' => ['sometimes', 'nullable', 'string', 'max:'.self::STATUS_REASON_MAX_LENGTH],
            'investment_mode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'expected_end_date' => ['sometimes', 'nullable', 'date'],
            'actual_end_date' => ['sometimes', 'nullable', 'date'],
            'payment_cycle' => ['sometimes', 'nullable', 'string', Rule::in(self::PAYMENT_CYCLES)],
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

        $validated = $this->validatedInput($request);
        if (array_key_exists('investment_mode', $validated)) {
            $validated['investment_mode'] = $this->normalizeSubmittedInvestmentMode(
                $validated['investment_mode'],
                (string) ($project->getAttribute('investment_mode') ?? '')
            );
        }
        $paymentCycleError = $this->validateRequiredProjectPaymentCycle(
            array_key_exists('investment_mode', $validated)
                ? $validated['investment_mode']
                : $project->getAttribute('investment_mode'),
            array_key_exists('payment_cycle', $validated)
                ? $validated['payment_cycle']
                : $project->getAttribute('payment_cycle')
        );
        if ($paymentCycleError instanceof JsonResponse) {
            return $paymentCycleError;
        }
        $resolvedStatus = $this->resolveUpdatedProjectStatus($project, $validated);
        $resolvedStatusReason = $this->resolveProjectStatusReason(
            $resolvedStatus,
            array_key_exists('status_reason', $validated)
                ? $validated['status_reason']
                : $project->getAttribute('status_reason')
        );

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

        if (array_key_exists('project_code', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
        }
        if (array_key_exists('project_name', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
        }
        if (array_key_exists('status', $validated) || array_key_exists('status_reason', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'status', $resolvedStatus);
            $this->support->setAttributeIfColumn($project, 'projects', 'status_reason', $resolvedStatusReason);
        }
        if (array_key_exists('investment_mode', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode']);
        }
        if (array_key_exists('payment_cycle', $validated)) {
            $this->support->setAttributeIfColumn($project, 'projects', 'payment_cycle', $validated['payment_cycle']);
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
                $this->syncProjectEstimatedValue((int) $project->getKey());
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
        $this->flushListCache();

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
        $response = $this->accessAudit->deleteModel($request, $project, 'Project');
        if ($response->getStatusCode() < 400) {
            $this->flushListCache();
        }

        return $response;
    }

    private function buildListCacheKey(Request $request): string
    {
        $payload = [
            'user_id' => $this->accessAudit->resolveAuthenticatedUserId($request) ?? 0,
            'query' => $this->normalizeCachePayload($request->query()),
            'paginate' => $this->support->shouldPaginate($request),
            'simple' => $this->support->shouldUseSimplePagination($request),
        ];

        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return 'projects:list:' . sha1($encoded ?: 'projects:list');
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizeCachePayload(array $payload): array
    {
        ksort($payload);

        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = $this->normalizeCachePayload($value);
            }
        }

        return $payload;
    }

    public function projectItems(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('project_items')) {
            return $this->support->missingTable('project_items');
        }

        $query = $this->buildProjectItemsQuery($request);

        return $this->respondWithProjectItemsQuery($request, $query);
    }

    public function projectTypes(Request $request): JsonResponse
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $definitions = $this->projectTypeDefinitions($includeInactive);
        $usageByCode = $this->projectTypeUsageSummaryByCode();

        return response()->json([
            'data' => array_values(array_map(
                fn (array $row): array => $this->appendProjectTypeUsageMetadata($row, $usageByCode),
                $definitions
            )),
        ]);
    }

    public function storeProjectType(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('project_types')) {
            return $this->support->missingTable('project_types');
        }

        $validated = $request->validate([
            'type_code' => ['required', 'string', 'max:100'],
            'type_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $typeCode = $this->sanitizeProjectTypeCode((string) ($validated['type_code'] ?? ''));
        if ($typeCode === '') {
            return response()->json(['message' => 'type_code is invalid.'], 422);
        }

        $typeName = trim((string) ($validated['type_name'] ?? ''));
        if ($typeName === '') {
            return response()->json(['message' => 'type_name is required.'], 422);
        }

        if ($this->support->hasColumn('project_types', 'type_code')) {
            $exists = DB::table('project_types')
                ->whereRaw('UPPER(TRIM(type_code)) = ?', [$typeCode])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'type_code has already been taken.'], 422);
            }
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('project_types', [
            'type_code' => $typeCode,
            'type_name' => $typeName,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->support->hasColumn('project_types', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('project_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('project_types')->insertGetId($payload);
        $record = $this->loadProjectTypeById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Project type created but cannot be reloaded.'], 500);
        }

        $record = $this->appendProjectTypeUsageMetadata(
            $record,
            $this->projectTypeUsageSummaryByCode()
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateProjectType(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('project_types')) {
            return $this->support->missingTable('project_types');
        }

        $current = DB::table('project_types')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Project type not found.'], 404);
        }

        $validated = $request->validate([
            'type_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'type_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeProjectTypeCode((string) ($current->type_code ?? ''));
        $nextCode = array_key_exists('type_code', $validated)
            ? $this->sanitizeProjectTypeCode((string) ($validated['type_code'] ?? ''))
            : $currentCode;

        if ($nextCode === '') {
            return response()->json(['message' => 'type_code is invalid.'], 422);
        }

        $typeName = trim((string) ($validated['type_name'] ?? ''));
        if ($typeName === '') {
            return response()->json(['message' => 'type_name is required.'], 422);
        }

        if ($nextCode !== $currentCode) {
            $usageByCode = $this->projectTypeUsageSummaryByCode();
            $usage = $usageByCode[$currentCode] ?? 0;
            if ((int) $usage > 0) {
                return response()->json(['message' => 'Không thể đổi mã loại dự án đã phát sinh dữ liệu.'], 422);
            }
        }

        if ($this->support->hasColumn('project_types', 'type_code')) {
            $exists = DB::table('project_types')
                ->whereRaw('UPPER(TRIM(type_code)) = ?', [$nextCode])
                ->where('id', '<>', $id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'type_code has already been taken.'], 422);
            }
        }

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'type_code' => $nextCode,
            'type_name' => $typeName,
        ];

        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('project_types', $payload);
        if ($this->support->hasColumn('project_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('project_types')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadProjectTypeById($id);
        if ($record === null) {
            return response()->json(['message' => 'Project type not found.'], 404);
        }

        $record = $this->appendProjectTypeUsageMetadata(
            $record,
            $this->projectTypeUsageSummaryByCode()
        );

        return response()->json(['data' => $record]);
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
     * Recompute estimated_value from project items (SUM of quantity × unit_price).
     */
    private function syncProjectEstimatedValue(int $projectId): void
    {
        if (! $this->support->hasColumn('projects', 'estimated_value')) {
            return;
        }

        $total = DB::table('project_items')
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->selectRaw('COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 0) as total')
            ->value('total');

        DB::table('projects')
            ->where('id', $projectId)
            ->update(['estimated_value' => round((float) $total, 2)]);
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

    private function buildProjectItemsQuery(Request $request)
    {
        $query = DB::table('project_items as pi');
        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as p', 'pi.project_id', '=', 'p.id');
        }
        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as c', 'p.customer_id', '=', 'c.id');
        }
        if ($this->support->hasTable('products')) {
            $query->leftJoin('products as pr', 'pi.product_id', '=', 'pr.id');
        }

        if ($this->support->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                $builder->orWhere('pi.id', 'like', $like);

                if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'project_code')) {
                    $builder->orWhere('p.project_code', 'like', $like);
                }
                if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'project_name')) {
                    $builder->orWhere('p.project_name', 'like', $like);
                }
                if ($this->support->hasTable('products') && $this->support->hasColumn('products', 'product_code')) {
                    $builder->orWhere('pr.product_code', 'like', $like);
                }
                if ($this->support->hasTable('products') && $this->support->hasColumn('products', 'product_name')) {
                    $builder->orWhere('pr.product_name', 'like', $like);
                }
                if ($this->support->hasTable('customers') && $this->support->hasColumn('customers', 'customer_name')) {
                    $builder->orWhere('c.customer_name', 'like', $like);
                }
            });
        }

        return $query
            ->select($this->projectItemSelectColumns())
            ->orderByDesc('pi.id');
    }

    private function respondWithProjectItemsQuery(Request $request, mixed $query): JsonResponse
    {
        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    private function projectItemSelectColumns(): array
    {
        $selects = [];

        foreach ([
            'id',
            'project_id',
            'product_id',
            'quantity',
            'unit_price',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
            'deleted_at',
        ] as $column) {
            if ($this->support->hasColumn('project_items', $column)) {
                $selects[] = "pi.{$column} as {$column}";
            }
        }

        if ($this->support->hasTable('projects')) {
            if ($this->support->hasColumn('projects', 'project_code')) {
                $selects[] = 'p.project_code as project_code';
            }
            if ($this->support->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
            if ($this->support->hasColumn('projects', 'customer_id')) {
                $selects[] = 'p.customer_id as customer_id';
            }
        }

        if ($this->support->hasTable('customers')) {
            if ($this->support->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->support->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
            if ($this->support->hasColumn('customers', 'company_name')) {
                $selects[] = 'c.company_name as customer_company_name';
            }
        }

        if ($this->support->hasTable('products')) {
            if ($this->support->hasColumn('products', 'product_code')) {
                $selects[] = 'pr.product_code as product_code';
            }
            if ($this->support->hasColumn('products', 'product_name')) {
                $selects[] = 'pr.product_name as product_name';
            }
            if ($this->support->hasColumn('products', 'unit')) {
                $selects[] = 'pr.unit as unit';
            }
        }

        return $selects;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function projectTypeDefinitions(bool $includeInactive = false): array
    {
        if (
            $this->support->hasTable('project_types')
            && $this->support->hasColumn('project_types', 'type_code')
            && $this->support->hasColumn('project_types', 'type_name')
        ) {
            $this->ensureDefaultProjectTypesExist();

            $query = DB::table('project_types')
                ->select($this->support->selectColumns('project_types', [
                    'id',
                    'type_code',
                    'type_name',
                    'description',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->support->hasColumn('project_types', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->support->hasColumn('project_types', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->support->hasColumn('project_types', 'type_name')) {
                $query->orderBy('type_name');
            } elseif ($this->support->hasColumn('project_types', 'type_code')) {
                $query->orderBy('type_code');
            }
            if ($this->support->hasColumn('project_types', 'id')) {
                $query->orderBy('id');
            }

            $rows = $query->get()->map(function (object $item): array {
                return $this->serializeProjectTypeRecord((array) $item);
            })->filter(fn (array $record): bool => ((string) ($record['type_code'] ?? '')) !== '')
                ->values()
                ->all();

            if ($rows !== []) {
                return $rows;
            }
        }

        return array_map(fn (array $row): array => $this->serializeProjectTypeRecord($row), [
            ['type_code' => 'DAU_TU', 'type_name' => 'Đầu tư', 'is_active' => true, 'sort_order' => 10],
            ['type_code' => 'THUE_DICH_VU_DACTHU', 'type_name' => 'Thuê dịch vụ CNTT đặc thù', 'is_active' => true, 'sort_order' => 20],
            ['type_code' => 'THUE_DICH_VU_COSAN', 'type_name' => 'Thuê dịch vụ CNTT có sẵn', 'is_active' => true, 'sort_order' => 30],
        ]);
    }

    private function ensureDefaultProjectTypesExist(): void
    {
        if (
            ! $this->support->hasTable('project_types')
            || ! $this->support->hasColumn('project_types', 'type_code')
            || ! $this->support->hasColumn('project_types', 'type_name')
        ) {
            return;
        }

        $now = now();
        foreach ([
            ['type_code' => 'DAU_TU', 'type_name' => 'Đầu tư', 'sort_order' => 10],
            ['type_code' => 'THUE_DICH_VU_DACTHU', 'type_name' => 'Thuê dịch vụ CNTT đặc thù', 'sort_order' => 20],
            ['type_code' => 'THUE_DICH_VU_COSAN', 'type_name' => 'Thuê dịch vụ CNTT có sẵn', 'sort_order' => 30],
        ] as $row) {
            $payload = $this->support->filterPayloadByTableColumns('project_types', [
                'type_code' => $row['type_code'],
                'type_name' => $row['type_name'],
                'description' => null,
                'is_active' => true,
                'sort_order' => $row['sort_order'],
            ]);

            if ($this->support->hasColumn('project_types', 'created_at')) {
                $payload['created_at'] = $now;
            }
            if ($this->support->hasColumn('project_types', 'updated_at')) {
                $payload['updated_at'] = $now;
            }

            DB::table('project_types')->updateOrInsert(
                ['type_code' => $row['type_code']],
                $payload
            );
        }
    }

    private function loadProjectTypeById(int $id): ?array
    {
        if (! $this->support->hasTable('project_types')) {
            return null;
        }

        $record = DB::table('project_types')
            ->select($this->support->selectColumns('project_types', [
                'id',
                'type_code',
                'type_name',
                'description',
                'is_active',
                'sort_order',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        return $record !== null ? $this->serializeProjectTypeRecord((array) $record) : null;
    }

    /**
     * @return array<string, int>
     */
    private function projectTypeUsageSummaryByCode(): array
    {
        $usageByCode = [];

        if (! $this->support->hasTable('projects') || ! $this->support->hasColumn('projects', 'investment_mode')) {
            return $usageByCode;
        }

        $query = DB::table('projects')
            ->selectRaw('UPPER(TRIM(investment_mode)) as type_code, COUNT(*) as total')
            ->whereNotNull('investment_mode')
            ->whereRaw('TRIM(investment_mode) <> ?', [''])
            ->groupBy('type_code');

        if ($this->support->hasColumn('projects', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        foreach ($query->get() as $row) {
            $typeCode = $this->sanitizeProjectTypeCode((string) ($row->type_code ?? ''));
            if ($typeCode === '') {
                continue;
            }

            if (! isset($usageByCode[$typeCode])) {
                $usageByCode[$typeCode] = 0;
            }
            $usageByCode[$typeCode] += (int) ($row->total ?? 0);
        }

        return $usageByCode;
    }

    /**
     * @param array<string, int> $usageByCode
     * @return array<string, mixed>
     */
    private function appendProjectTypeUsageMetadata(array $record, array $usageByCode): array
    {
        $typeCode = $this->sanitizeProjectTypeCode((string) ($record['type_code'] ?? ''));
        $usedInProjects = (int) ($usageByCode[$typeCode] ?? 0);

        $record['used_in_projects'] = $usedInProjects;
        $record['is_code_editable'] = $usedInProjects === 0;

        return $record;
    }

    private function serializeProjectItemRecord(array $record): array
    {
        $projectId = $this->support->parseNullableInt($record['project_id'] ?? null);
        $productId = $this->support->parseNullableInt($record['product_id'] ?? null);
        $customerId = $this->support->parseNullableInt($record['customer_id'] ?? null);
        $projectCode = $this->support->firstNonEmpty($record, ['project_code']);
        $projectName = $this->support->firstNonEmpty($record, ['project_name']);
        $productCode = $this->support->firstNonEmpty($record, ['product_code']);
        $productName = $this->support->firstNonEmpty($record, ['product_name']);

        $projectCodeText = (string) ($projectCode ?? '');
        $projectNameText = (string) ($projectName ?? '');
        $productCodeText = (string) ($productCode ?? '');
        $productNameText = (string) ($productName ?? '');

        $projectPart = trim(($projectCodeText !== '' ? $projectCodeText.' - ' : '').$projectNameText);
        $productPart = trim(($productCodeText !== '' ? $productCodeText.' - ' : '').$productNameText);
        $displayName = trim($projectPart.($projectPart !== '' && $productPart !== '' ? ' | ' : '').$productPart);

        return [
            'id' => $this->support->parseNullableInt($record['id'] ?? null),
            'project_id' => $projectId,
            'project_code' => $projectCode,
            'project_name' => $projectName,
            'customer_id' => $customerId,
            'customer_code' => $record['customer_code'] ?? null,
            'customer_name' => $this->support->firstNonEmpty($record, ['customer_name', 'customer_company_name']),
            'product_id' => $productId,
            'product_code' => $productCode,
            'product_name' => $productName,
            'unit' => $record['unit'] ?? null,
            'quantity' => isset($record['quantity']) ? (float) $record['quantity'] : null,
            'unit_price' => isset($record['unit_price']) ? (float) $record['unit_price'] : null,
            'display_name' => $displayName !== '' ? $displayName : ('Hạng mục #'.($record['id'] ?? '--')),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'deleted_at' => $record['deleted_at'] ?? null,
        ];
    }

    private function serializeProjectTypeRecord(array $record): array
    {
        $typeCode = $this->sanitizeProjectTypeCode((string) ($record['type_code'] ?? ''));
        $typeName = trim((string) ($record['type_name'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'type_code' => $typeCode !== '' ? $typeCode : 'DAU_TU',
            'type_name' => $typeName !== '' ? $typeName : ($typeCode !== '' ? $typeCode : 'DAU_TU'),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'used_in_projects' => isset($record['used_in_projects']) ? (int) $record['used_in_projects'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function sanitizeProjectTypeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);

        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 100);
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

    private function resolveSubmittedProjectStatus(mixed $statusInput, mixed $investmentModeInput): string
    {
        $rawStatus = trim((string) ($statusInput ?? ''));
        if ($rawStatus !== '') {
            return $this->support->toProjectStorageStatus($rawStatus);
        }

        return $this->defaultProjectStatusForInvestmentMode((string) ($investmentModeInput ?? ''));
    }

    /**
     * @param array<string, mixed> $validated
     */
    private function resolveUpdatedProjectStatus(Project $project, array $validated): string
    {
        if (array_key_exists('status', $validated)) {
            return $this->resolveSubmittedProjectStatus(
                $validated['status'],
                $validated['investment_mode'] ?? $project->getAttribute('investment_mode')
            );
        }

        $currentStatus = trim((string) ($project->getAttribute('status') ?? ''));
        if ($currentStatus !== '') {
            return $this->support->toProjectStorageStatus($currentStatus);
        }

        $investmentMode = array_key_exists('investment_mode', $validated)
            ? (string) ($validated['investment_mode'] ?? '')
            : (string) ($project->getAttribute('investment_mode') ?? '');

        return $this->defaultProjectStatusForInvestmentMode($investmentMode);
    }

    private function defaultProjectStatusForInvestmentMode(string $investmentMode): string
    {
        $normalizedMode = strtoupper(trim((string) ($this->normalizeSubmittedInvestmentMode($investmentMode) ?? $investmentMode)));

        return in_array($normalizedMode, ['THUE_DICH_VU', 'THUE_DICH_VU_DACTHU', 'THUE_DICH_VU_CO_SAN', 'THUE_DICH_VU_COSAN'], true)
            ? self::RENTAL_DEFAULT_PROJECT_STATUS
            : self::DEFAULT_PROJECT_STATUS;
    }

    private function requiresProjectPaymentCycle(mixed $investmentMode): bool
    {
        $normalizedMode = strtoupper(trim((string) ($this->normalizeSubmittedInvestmentMode($investmentMode) ?? $investmentMode)));

        return in_array($normalizedMode, ['DAU_TU', 'THUE_DICH_VU_CO_SAN', 'THUE_DICH_VU_COSAN'], true);
    }

    private function validateRequiredProjectPaymentCycle(mixed $investmentMode, mixed $paymentCycle): ?JsonResponse
    {
        if (! $this->requiresProjectPaymentCycle($investmentMode)) {
            return null;
        }

        if (trim((string) ($paymentCycle ?? '')) !== '') {
            return null;
        }

        return response()->json([
            'message' => 'payment_cycle is required for the selected investment_mode.',
            'errors' => [
                'payment_cycle' => ['Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.'],
            ],
        ], 422);
    }

    private function normalizeSubmittedInvestmentMode(mixed $input, ?string $currentStoredValue = null): ?string
    {
        $raw = trim((string) ($input ?? ''));
        if ($raw === '') {
            return null;
        }

        $token = strtoupper(preg_replace('/[^A-Z0-9]+/', '', Str::ascii(str_replace(['đ', 'Đ'], 'd', $raw))) ?? '');
        if ($token === '') {
            return null;
        }

        $canonical = match (true) {
            $token === 'DAUTU' => 'DAU_TU',
            in_array($token, ['THUEDICHVUDACTHU', 'THUEDICHVUCNTTDACTHU', 'THUEDICHVU', 'THUE'], true) => 'THUE_DICH_VU_DACTHU',
            in_array($token, ['THUEDICHVUCOSAN', 'THUEDICHVUCNTTCOSAN'], true) => 'THUE_DICH_VU_COSAN',
            default => strtoupper($raw),
        };

        $supportedModes = $this->resolveSupportedProjectInvestmentModes();
        $currentStored = strtoupper(trim($currentStoredValue ?? ''));

        $candidates = match ($canonical) {
            'DAU_TU' => ['DAU_TU'],
            'THUE_DICH_VU_DACTHU' => ['THUE_DICH_VU_DACTHU', 'THUE_DICH_VU'],
            'THUE_DICH_VU_COSAN' => ['THUE_DICH_VU_COSAN', 'THUE_DICH_VU_CO_SAN', 'THUE_DICH_VU'],
            default => [$canonical],
        };

        foreach ($candidates as $candidate) {
            if (in_array($candidate, $supportedModes, true)) {
                return $candidate;
            }
        }

        if ($currentStored !== '' && in_array($currentStored, $supportedModes, true)) {
            return $currentStored;
        }

        return $canonical;
    }

    /**
     * @return array<int, string>
     */
    private function resolveSupportedProjectInvestmentModes(): array
    {
        if ($this->supportedProjectInvestmentModes !== null) {
            return $this->supportedProjectInvestmentModes;
        }

        $fallback = ['DAU_TU', 'THUE_DICH_VU', 'THUE_DICH_VU_DACTHU', 'THUE_DICH_VU_CO_SAN', 'THUE_DICH_VU_COSAN'];
        if (! $this->support->hasTable('projects') || ! $this->support->hasColumn('projects', 'investment_mode')) {
            return $this->supportedProjectInvestmentModes = $fallback;
        }

        try {
            $columns = DB::select("SHOW COLUMNS FROM projects LIKE 'investment_mode'");
            $type = (string) ($columns[0]->Type ?? '');
            if (! str_starts_with(strtolower($type), 'enum(')) {
                return $this->supportedProjectInvestmentModes = $fallback;
            }

            preg_match_all("/'([^']+)'/", $type, $matches);
            $modes = array_values(array_filter(array_map(
                fn ($value): string => strtoupper(trim((string) $value)),
                $matches[1] ?? []
            )));

            return $this->supportedProjectInvestmentModes = $modes !== [] ? $modes : $fallback;
        } catch (\Throwable) {
            return $this->supportedProjectInvestmentModes = $fallback;
        }
    }

    private function isSpecialProjectStatus(string $status): bool
    {
        return in_array(strtoupper(trim($status)), self::SPECIAL_PROJECT_STATUSES, true);
    }

    private function resolveProjectStatusReason(string $status, mixed $reasonInput): ?string
    {
        if (! $this->isSpecialProjectStatus($status)) {
            return null;
        }

        $reason = trim((string) ($reasonInput ?? ''));
        if ($reason === '') {
            $label = strtoupper(trim($status)) === 'HUY' ? 'Lý do huỷ' : 'Lý do tạm ngưng';

            throw ValidationException::withMessages([
                'status_reason' => ["{$label} là bắt buộc khi chọn trạng thái này."],
            ]);
        }

        return $reason;
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
