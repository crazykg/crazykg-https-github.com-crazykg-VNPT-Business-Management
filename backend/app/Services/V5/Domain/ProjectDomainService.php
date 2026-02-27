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
use Illuminate\Validation\Rule;

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
        ];

        if ($this->support->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code');
        }

        $validated = $request->validate($rules);

        $startDateInput = $validated['start_date'] ?? now()->toDateString();
        $expectedEndDateInput = $validated['expected_end_date'] ?? null;
        if ($this->support->isProjectDateRangeInvalid($startDateInput, $expectedEndDateInput)) {
            return response()->json([
                'message' => 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
                'errors' => [
                    'start_date' => ['Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'],
                    'expected_end_date' => ['Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'],
                ],
            ], 422);
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

        $project = new Project();
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
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            'projects',
            $project->getKey(),
            null,
            $this->accessAudit->toAuditArray($project)
        );

        return response()->json([
            'data' => $this->support->serializeProject(
                $project->fresh()->load(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
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
        if ($this->support->isProjectDateRangeInvalid($resolvedStartDate, $resolvedExpectedEndDate)) {
            return response()->json([
                'message' => 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
                'errors' => [
                    'start_date' => ['Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'],
                    'expected_end_date' => ['Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'],
                ],
            ], 422);
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

        $project->save();
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            'projects',
            $project->getKey(),
            $before,
            $this->accessAudit->toAuditArray($project->fresh() ?? $project)
        );

        return response()->json([
            'data' => $this->support->serializeProject(
                $project->fresh()->load(['customer' => fn ($query) => $query->select($this->support->customerRelationColumns())])
            ),
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
