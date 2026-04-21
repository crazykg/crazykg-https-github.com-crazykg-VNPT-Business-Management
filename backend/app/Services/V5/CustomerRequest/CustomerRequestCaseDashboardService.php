<?php

namespace App\Services\V5\CustomerRequest;

use App\Services\V5\CacheService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerRequestCaseDashboardService
{
    private const CACHE_TAG = 'customer-request-cases';

    private const CACHE_TTL = 120;

    private const COMPLETED_STATUS_CODES = ['completed', 'customer_notified', 'closed'];

    private const EXCLUDED_OPERATIONAL_STATUS_CODES = ['not_executed'];

    private const PROGRAMMING_STATUS_CODES = ['coding', 'coding_in_progress', 'coding_suspended'];

    public function __construct(
        private readonly CustomerRequestCaseReadQueryService $readQuery,
        private readonly UserAccessService $userAccess,
        private readonly CacheService $cache,
    ) {}

    public function dashboardCreator(Request $request, callable $serializeCaseRow): JsonResponse
    {
        return $this->dashboardByRole($request, 'creator', $serializeCaseRow);
    }

    public function dashboardDispatcher(Request $request, callable $serializeCaseRow): JsonResponse
    {
        return $this->dashboardByRole($request, 'dispatcher', $serializeCaseRow);
    }

    public function dashboardPerformer(Request $request, callable $serializeCaseRow): JsonResponse
    {
        return $this->dashboardByRole($request, 'performer', $serializeCaseRow);
    }

    public function performerWeeklyTimesheet(Request $request, callable $serializeWorklogRow): JsonResponse
    {
        if (($missing = $this->readQuery->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->readQuery->resolveActorId($request);
        if ($actorId === null) {
            return response()->json(['message' => 'Không xác định được người thực hiện hiện tại.'], 422);
        }

        $startDate = $this->readQuery->normalizeNullableDate($request->query('start_date'))
            ?? Carbon::now()->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
        $endDate = $this->readQuery->normalizeNullableDate($request->query('end_date'))
            ?? Carbon::parse($startDate)->addDays(6)->format('Y-m-d');

        if ($startDate > $endDate) {
            return response()->json(['message' => 'Khoảng thời gian không hợp lệ.'], 422);
        }

        $accessibleCaseIds = $this->readQuery->baseCaseQuery($actorId)
            ->pluck('crc.id')
            ->map(fn ($value): int => (int) $value)
            ->values()
            ->all();

        if ($accessibleCaseIds === []) {
            return response()->json([
                'data' => $this->emptyPerformerWeeklyTimesheetPayload($startDate, $endDate, $actorId),
            ]);
        }

        $rows = DB::table('customer_request_worklogs as wl')
            ->join('customer_request_cases as crc', 'crc.id', '=', 'wl.request_case_id')
            ->leftJoin('customers as customer', 'customer.id', '=', 'crc.customer_id')
            ->leftJoin('projects as project', 'project.id', '=', 'crc.project_id')
            ->leftJoin('customer_request_status_catalogs as status_catalog', 'status_catalog.status_code', '=', 'crc.current_status_code')
            ->whereIn('wl.request_case_id', $accessibleCaseIds)
            ->where('wl.performed_by_user_id', $actorId)
            ->whereRaw('DATE(COALESCE(wl.work_date, wl.work_started_at, wl.created_at)) between ? and ?', [$startDate, $endDate])
            ->orderByDesc(DB::raw('COALESCE(wl.work_date, wl.work_started_at, wl.created_at)'))
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'crc.request_code',
                'crc.summary',
                DB::raw('customer.customer_name as customer_name'),
                DB::raw('project.project_name as project_name'),
                'crc.current_status_code',
                DB::raw('status_catalog.status_name_vi as current_status_name_vi'),
                DB::raw('DATE(COALESCE(wl.work_date, wl.work_started_at, wl.created_at)) as worked_on'),
            ])
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'data' => $this->emptyPerformerWeeklyTimesheetPayload($startDate, $endDate, $actorId),
            ]);
        }

        $days = collect($this->buildDateRange($startDate, $endDate))
            ->map(function (string $date) use ($rows): array {
                $dayRows = $rows->filter(fn (object $row): bool => (string) ($row->worked_on ?? '') === $date);
                $billableHours = round((float) $dayRows
                    ->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
                    ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);
                $totalHours = round((float) $dayRows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'date' => $date,
                    'hours_spent' => $totalHours,
                    'billable_hours' => $billableHours,
                    'non_billable_hours' => round(max($totalHours - $billableHours, 0), 2),
                    'entry_count' => $dayRows->count(),
                ];
            })
            ->values()
            ->all();

        $topCases = $rows
            ->groupBy(fn (object $row): string => (string) $row->request_case_id)
            ->map(function ($caseRows, string $caseId): array {
                $first = $caseRows->first();
                $hours = round((float) $caseRows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'request_case_id' => (int) $caseId,
                    'request_code' => $this->normalizeNullableString($first->request_code ?? null),
                    'summary' => $this->normalizeNullableString($first->summary ?? null),
                    'customer_name' => $this->normalizeNullableString($first->customer_name ?? null),
                    'project_name' => $this->normalizeNullableString($first->project_name ?? null),
                    'status_code' => $this->normalizeNullableString($first->current_status_code ?? null),
                    'status_name_vi' => $this->normalizeNullableString($first->current_status_name_vi ?? null),
                    'hours_spent' => $hours,
                    'entry_count' => $caseRows->count(),
                    'last_worked_at' => $this->normalizeNullableString($first->work_started_at ?? $first->created_at ?? null),
                ];
            })
            ->sortByDesc('hours_spent')
            ->take(5)
            ->values()
            ->all();

        $recentEntries = $rows
            ->take(10)
            ->map(function (object $row) use ($serializeWorklogRow): array {
                return [
                    ...$serializeWorklogRow($row),
                    'request_code' => $this->normalizeNullableString($row->request_code ?? null),
                    'summary' => $this->normalizeNullableString($row->summary ?? null),
                    'customer_name' => $this->normalizeNullableString($row->customer_name ?? null),
                    'project_name' => $this->normalizeNullableString($row->project_name ?? null),
                    'current_status_code' => $this->normalizeNullableString($row->current_status_code ?? null),
                    'current_status_name_vi' => $this->normalizeNullableString($row->current_status_name_vi ?? null),
                    'worked_on' => $this->normalizeNullableString($row->worked_on ?? null),
                ];
            })
            ->values()
            ->all();

        $totalHours = round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);
        $billableHours = round((float) $rows
            ->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
            ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

        return response()->json([
            'data' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'performer_user_id' => $actorId,
                'total_hours' => $totalHours,
                'billable_hours' => $billableHours,
                'non_billable_hours' => round(max($totalHours - $billableHours, 0), 2),
                'worklog_count' => $rows->count(),
                'days' => $days,
                'top_cases' => $topCases,
                'recent_entries' => $recentEntries,
            ],
        ]);
    }

    public function dashboardOverview(Request $request, callable $serializeCaseRow): JsonResponse
    {
        if (($missing = $this->readQuery->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->readQuery->resolveActorId($request);
        $payload = $this->cache->rememberTagged(
            [self::CACHE_TAG],
            $this->buildDashboardCacheKey('overview', $request, $actorId),
            self::CACHE_TTL,
            fn (): array => [
                'data' => $this->buildDashboardPayload(
                    'overview',
                    $this->loadDashboardRows($request, $actorId, $this->readQuery->normalizeNullableString($request->query('my_role'))),
                    $serializeCaseRow
                ),
            ],
        );

        return response()->json($payload);
    }

    private function dashboardByRole(Request $request, string $role, callable $serializeCaseRow): JsonResponse
    {
        if (($missing = $this->readQuery->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->readQuery->resolveActorId($request);
        return response()->json([
            'data' => $this->buildDashboardPayload(
                $role,
                $this->loadDashboardRows($request, $actorId, $role),
                $serializeCaseRow
            ),
        ]);
    }

    private function loadDashboardRows(Request $request, ?int $actorId, ?string $role): \Illuminate\Support\Collection
    {
        $query = $this->readQuery->baseCaseQuery($actorId);

        $statusValuesRaw = $request->query('status_code');
        $statusValues = is_array($statusValuesRaw) ? $statusValuesRaw : [$statusValuesRaw];
        $normalizedStatusValues = array_values(array_filter(
            array_map(fn ($value): ?string => $this->readQuery->normalizeNullableString($value), $statusValues),
            fn (?string $value): bool => $value !== null
        ));

        if (count($normalizedStatusValues) === 1) {
            $query->where('crc.current_status_code', $normalizedStatusValues[0]);
        } elseif (count($normalizedStatusValues) > 1) {
            $query->whereIn('crc.current_status_code', $normalizedStatusValues);
        }

        foreach ([
            'customer_id',
            'project_id',
            'project_item_id',
            'support_service_group_id',
            'dispatcher_user_id',
            'performer_user_id',
            'created_by',
            'received_by_user_id',
            'priority',
        ] as $column) {
            $rawValues = $request->query($column);
            $normalizedValues = is_array($rawValues) ? $rawValues : [$rawValues];
            $values = [];

            foreach ($normalizedValues as $rawValue) {
                $parsed = $column === 'priority'
                    ? $this->readQuery->normalizeNullableString($rawValue)
                    : $this->parseNullableInt($rawValue);
                if ($parsed !== null) {
                    $values[] = $parsed;
                }
            }

            $values = array_values(array_unique($values));

            if ($values === []) {
                continue;
            }

            if (count($values) === 1) {
                $query->where("crc.{$column}", $values[0]);
                continue;
            }

            $query->whereIn("crc.{$column}", $values);
        }

        if ($actorId !== null && $role !== null) {
            match ($role) {
                'creator' => $query->where('crc.created_by', $actorId),
                'dispatcher' => $query->where(function (QueryBuilder $builder) use ($actorId): void {
                    $builder
                        ->where('crc.dispatcher_user_id', $actorId)
                        ->orWhere('crc.received_by_user_id', $actorId);
                }),
                'performer' => $query->where('crc.performer_user_id', $actorId),
                'receiver' => $query->where('crc.received_by_user_id', $actorId),
                'handler' => $query->whereIn('crc.project_id', $this->readQuery->projectIdsForUserByRaciRoles($actorId)),
                default => null,
            };
        }

        return $query
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id')
            ->get();
    }

    private function buildDashboardCacheKey(string $role, Request $request, ?int $actorId): string
    {
        return 'dashboard:'.md5(json_encode([
            'role' => $role,
            'actor_id' => $actorId,
            'query' => $request->query(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: $role);
    }

    private function buildDashboardPayload(string $role, \Illuminate\Support\Collection $rows, callable $serializeCaseRow): array
    {
        $dashboardRows = $this->enrichDashboardRows($rows);
        $operationalRows = $this->filterOperationalRows($dashboardRows);
        $unitMetrics = $this->collectUnitMetrics($operationalRows);

        return [
            'role' => $role,
            'summary' => [
                'total_cases' => $rows->count(),
                'status_counts' => $this->collectStatusCounts($dashboardRows),
                'alert_counts' => [
                    'over_estimate' => $this->countOverEstimate($dashboardRows),
                    'missing_estimate' => $this->countMissingEstimate($dashboardRows),
                    'sla_risk' => $this->countSlaRisk($dashboardRows),
                ],
                'operational' => $this->collectOperationalSummary($dashboardRows),
            ],
            'top_customers' => $this->collectTopCustomers($dashboardRows),
            'top_projects' => $this->collectTopProjects($dashboardRows),
            'top_performers' => $this->collectTopPerformers($operationalRows, 10),
            'unit_chart' => $unitMetrics,
            'top_backlog_units' => $this->collectTopBacklogUnits($unitMetrics),
            'attention_cases' => $this->collectAttentionCases($dashboardRows, 10, $serializeCaseRow),
        ];
    }

    private function enrichDashboardRows(\Illuminate\Support\Collection $rows): \Illuminate\Support\Collection
    {
        $programmingCaseIds = $this->collectProgrammingCaseIdSet($rows);
        $performerDepartments = $this->collectPerformerDepartmentLookup($rows);

        return $rows->map(function (object $row) use ($programmingCaseIds, $performerDepartments): object {
            $caseId = $this->parseNullableInt($row->id ?? null);
            $statusCode = (string) ($row->current_status_code ?? '');
            $performerUserId = $this->parseNullableInt($row->performer_user_id ?? null);
            $departmentInfo = $performerUserId !== null ? ($performerDepartments[$performerUserId] ?? []) : [];
            $departmentId = $this->parseNullableInt($departmentInfo['department_id'] ?? null);
            $departmentCode = $this->normalizeNullableString($departmentInfo['department_code'] ?? null);
            $departmentName = $this->normalizeNullableString($departmentInfo['department_name'] ?? null);
            $customerId = $this->parseNullableInt($row->customer_id ?? null);
            $customerName = $this->normalizeNullableString($row->customer_name ?? null);

            if ($customerId !== null) {
                $unitKey = 'customer:'.$customerId;
                $unitName = $customerName ?? ('Khách hàng #'.$customerId);
            } elseif ($customerName !== null) {
                $unitKey = 'customer-name:'.md5($customerName);
                $unitName = $customerName;
            } else {
                $unitKey = 'unknown_customer';
                $unitName = 'Chưa xác định khách hàng';
            }

            $row->dashboard_request_type = (
                in_array($statusCode, self::PROGRAMMING_STATUS_CODES, true)
                || ($caseId !== null && isset($programmingCaseIds[$caseId]))
            ) ? 'programming' : 'support';
            $row->dashboard_unit_key = $unitKey;
            $row->dashboard_customer_id = $customerId;
            $row->dashboard_customer_code = null;
            $row->dashboard_customer_name = $unitName;
            $row->performer_department_id = $departmentId;
            $row->performer_department_code = $departmentCode;
            $row->performer_department_name = $departmentName;

            return $row;
        });
    }

    /**
     * @return array<int, true>
     */
    private function collectProgrammingCaseIdSet(\Illuminate\Support\Collection $rows): array
    {
        $caseIds = $rows
            ->map(fn (object $row): ?int => $this->parseNullableInt($row->id ?? null))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $programmingIds = $rows
            ->filter(fn (object $row): bool => in_array((string) ($row->current_status_code ?? ''), self::PROGRAMMING_STATUS_CODES, true))
            ->map(fn (object $row): ?int => $this->parseNullableInt($row->id ?? null))
            ->filter()
            ->values()
            ->all();

        if (
            $caseIds !== []
            && Schema::hasTable('customer_request_status_instances')
            && Schema::hasColumn('customer_request_status_instances', 'request_case_id')
            && Schema::hasColumn('customer_request_status_instances', 'status_code')
        ) {
            $historyIds = DB::table('customer_request_status_instances')
                ->whereIn('request_case_id', $caseIds)
                ->whereIn('status_code', self::PROGRAMMING_STATUS_CODES)
                ->pluck('request_case_id')
                ->map(fn ($value): int => (int) $value)
                ->all();

            $programmingIds = array_merge($programmingIds, $historyIds);
        }

        return array_fill_keys(array_values(array_unique(array_map('intval', $programmingIds))), true);
    }

    /**
     * @return array<int, array{department_id:int|null, department_code:string|null, department_name:string|null}>
     */
    private function collectPerformerDepartmentLookup(\Illuminate\Support\Collection $rows): array
    {
        $performerIds = $rows
            ->map(fn (object $row): ?int => $this->parseNullableInt($row->performer_user_id ?? null))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($performerIds === [] || ! Schema::hasTable('internal_users')) {
            return [];
        }

        $hasDepartmentId = Schema::hasColumn('internal_users', 'department_id');
        $hasDepartmentsTable = $hasDepartmentId && Schema::hasTable('departments');
        $hasDepartmentCode = $hasDepartmentsTable && Schema::hasColumn('departments', 'dept_code');
        $hasDepartmentName = $hasDepartmentsTable && Schema::hasColumn('departments', 'dept_name');

        $selects = ['iu.id as performer_user_id'];
        $selects[] = $hasDepartmentId ? 'iu.department_id as department_id' : DB::raw('NULL as department_id');

        $query = DB::table('internal_users as iu')->whereIn('iu.id', $performerIds);

        if ($hasDepartmentsTable) {
            $query->leftJoin('departments as dept', 'dept.id', '=', 'iu.department_id');
        }

        $selects[] = $hasDepartmentCode ? 'dept.dept_code as department_code' : DB::raw('NULL as department_code');
        $selects[] = $hasDepartmentName ? 'dept.dept_name as department_name' : DB::raw('NULL as department_name');

        return $query
            ->select($selects)
            ->get()
            ->mapWithKeys(fn (object $row): array => [
                (int) $row->performer_user_id => [
                    'department_id' => $this->parseNullableInt($row->department_id ?? null),
                    'department_code' => $this->normalizeNullableString($row->department_code ?? null),
                    'department_name' => $this->normalizeNullableString($row->department_name ?? null),
                ],
            ])
            ->all();
    }

    private function filterOperationalRows(\Illuminate\Support\Collection $rows): \Illuminate\Support\Collection
    {
        return $rows
            ->reject(fn (object $row): bool => in_array((string) ($row->current_status_code ?? ''), self::EXCLUDED_OPERATIONAL_STATUS_CODES, true))
            ->values();
    }

    private function collectOperationalSummary(\Illuminate\Support\Collection $rows): array
    {
        $operationalRows = $this->filterOperationalRows($rows);

        return [
            ...$this->baseOperationalCounts($operationalRows),
            'by_type' => [
                'support' => $this->baseOperationalCounts($this->filterRowsByDashboardType($operationalRows, 'support')),
                'programming' => $this->baseOperationalCounts($this->filterRowsByDashboardType($operationalRows, 'programming')),
            ],
        ];
    }

    private function filterRowsByDashboardType(\Illuminate\Support\Collection $rows, string $type): \Illuminate\Support\Collection
    {
        return $rows
            ->filter(fn (object $row): bool => (string) ($row->dashboard_request_type ?? 'support') === $type)
            ->values();
    }

    private function baseOperationalCounts(\Illuminate\Support\Collection $rows): array
    {
        $total = $rows->count();
        $completed = $rows->filter(fn (object $row): bool => $this->isCompletedDashboardRow($row))->count();

        return [
            'total_cases' => $total,
            'active_cases' => max($total - $completed, 0),
            'completed_cases' => $completed,
            'waiting_customer_feedback_cases' => $rows
                ->filter(fn (object $row): bool => (string) ($row->current_status_code ?? '') === 'waiting_customer_feedback')
                ->count(),
            'completion_rate' => $this->calculateCompletionRate($total, $completed),
        ];
    }

    private function collectUnitMetrics(\Illuminate\Support\Collection $rows): array
    {
        return $rows
            ->groupBy(fn (object $row): string => (string) ($row->dashboard_unit_key ?? 'unknown_customer'))
            ->map(function (\Illuminate\Support\Collection $group, string $unitKey): array {
                $first = $group->first();
                $counts = $this->baseOperationalCounts($group);

                return [
                    'unit_key' => $unitKey,
                    'customer_id' => $this->parseNullableInt($first->dashboard_customer_id ?? null),
                    'customer_code' => $this->normalizeNullableString($first->dashboard_customer_code ?? null),
                    'customer_name' => $this->normalizeNullableString($first->dashboard_customer_name ?? null) ?? 'Chưa xác định khách hàng',
                    ...$counts,
                    'backlog_cases' => $counts['active_cases'],
                    'support_cases' => $this->filterRowsByDashboardType($group, 'support')->count(),
                    'programming_cases' => $this->filterRowsByDashboardType($group, 'programming')->count(),
                ];
            })
            ->sortBy([
                ['total_cases', 'desc'],
                ['completed_cases', 'desc'],
                ['customer_name', 'asc'],
            ])
            ->values()
            ->all();
    }

    /**
     * @param array<int, array<string, mixed>> $unitMetrics
     */
    private function collectTopBacklogUnits(array $unitMetrics): array
    {
        return collect($unitMetrics)
            ->sortBy([
                ['active_cases', 'desc'],
                ['total_cases', 'desc'],
                ['customer_name', 'asc'],
            ])
            ->take(5)
            ->values()
            ->all();
    }

    private function collectStatusCounts(\Illuminate\Support\Collection $rows): array
    {
        return $rows
            ->groupBy(fn (object $row): string => (string) ($row->current_status_code ?? ''))
            ->map(fn (\Illuminate\Support\Collection $group, string $statusCode): array => [
                'status_code' => $statusCode,
                'count' => $group->count(),
            ])
            ->sortBy('status_code')
            ->values()
            ->all();
    }

    private function countOverEstimate(\Illuminate\Support\Collection $rows): int
    {
        return $rows->filter(function (object $row): bool {
            $estimatedHours = (float) ($row->estimated_hours ?? 0);
            if ($estimatedHours <= 0) {
                return false;
            }

            return (float) ($row->total_hours_spent ?? 0) > $estimatedHours;
        })->count();
    }

    private function countMissingEstimate(\Illuminate\Support\Collection $rows): int
    {
        return $rows->filter(fn (object $row): bool => (float) ($row->estimated_hours ?? 0) <= 0)->count();
    }

    private function countSlaRisk(\Illuminate\Support\Collection $rows): int
    {
        $deadline = now()->addDay();

        return $rows->filter(function (object $row) use ($deadline): bool {
            $statusCode = (string) ($row->current_status_code ?? '');
            if (in_array($statusCode, [...self::COMPLETED_STATUS_CODES, ...self::EXCLUDED_OPERATIONAL_STATUS_CODES], true)) {
                return false;
            }

            $slaDueAt = $this->normalizeNullableString($row->sla_due_at ?? null);
            if ($slaDueAt === null) {
                return false;
            }

            try {
                return Carbon::parse($slaDueAt)->lte($deadline);
            } catch (\Throwable) {
                return false;
            }
        })->count();
    }

    private function collectTopCustomers(\Illuminate\Support\Collection $rows): array
    {
        return $rows
            ->filter(fn (object $row): bool => ! empty($row->customer_id))
            ->groupBy(fn (object $row): string => (string) $row->customer_id)
            ->map(function (\Illuminate\Support\Collection $group, string $customerId): array {
                $first = $group->first();

                return [
                    'customer_id' => (int) $customerId,
                    'customer_name' => $this->normalizeNullableString($first->customer_name ?? null),
                    'count' => $group->count(),
                ];
            })
            ->sortBy([
                ['count', 'desc'],
                ['customer_id', 'asc'],
            ])
            ->take(5)
            ->values()
            ->all();
    }

    private function collectTopProjects(\Illuminate\Support\Collection $rows): array
    {
        return $rows
            ->filter(fn (object $row): bool => ! empty($row->project_id))
            ->groupBy(fn (object $row): string => (string) $row->project_id)
            ->map(function (\Illuminate\Support\Collection $group, string $projectId): array {
                $first = $group->first();

                return [
                    'project_id' => (int) $projectId,
                    'project_name' => $this->normalizeNullableString($first->project_name ?? null),
                    'count' => $group->count(),
                ];
            })
            ->sortBy([
                ['count', 'desc'],
                ['project_id', 'asc'],
            ])
            ->take(5)
            ->values()
            ->all();
    }

    private function collectTopPerformers(\Illuminate\Support\Collection $rows, int $limit = 10): array
    {
        return $rows
            ->filter(fn (object $row): bool => ! empty($row->performer_user_id))
            ->groupBy(fn (object $row): string => (string) $row->performer_user_id)
            ->map(function (\Illuminate\Support\Collection $group, string $performerUserId): array {
                $first = $group->first();
                $counts = $this->baseOperationalCounts($group);

                return [
                    'performer_user_id' => (int) $performerUserId,
                    'performer_name' => $this->normalizeNullableString($first->performer_name ?? null),
                    'department_id' => $this->parseNullableInt($first->performer_department_id ?? null),
                    'department_name' => $this->normalizeNullableString($first->performer_department_name ?? null),
                    'count' => $counts['total_cases'],
                    ...$counts,
                    'support_cases' => $this->filterRowsByDashboardType($group, 'support')->count(),
                    'programming_cases' => $this->filterRowsByDashboardType($group, 'programming')->count(),
                ];
            })
            ->sortBy([
                ['total_cases', 'desc'],
                ['completed_cases', 'desc'],
                ['performer_user_id', 'asc'],
            ])
            ->take($limit)
            ->values()
            ->all();
    }

    private function isCompletedDashboardRow(object $row): bool
    {
        return in_array((string) ($row->current_status_code ?? ''), self::COMPLETED_STATUS_CODES, true);
    }

    private function calculateCompletionRate(int $total, int $completed): float
    {
        if ($total <= 0) {
            return 0.0;
        }

        return round(($completed / $total) * 100, 1);
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function collectAttentionCases(\Illuminate\Support\Collection $rows, int $limit, callable $serializeCaseRow): array
    {
        return $rows
            ->take(max(1, $limit * 4))
            ->map(fn (object $row): array => $serializeCaseRow($row))
            ->filter(function (array $case): bool {
                return (bool) ($case['over_estimate'] ?? false)
                    || (bool) ($case['missing_estimate'] ?? false)
                    || in_array((string) ($case['sla_status'] ?? ''), ['at_risk', 'overdue'], true);
            })
            ->map(function (array $case): array {
                $reasons = [];
                if (($case['over_estimate'] ?? false) === true) {
                    $reasons[] = 'over_estimate';
                }
                if (($case['missing_estimate'] ?? false) === true) {
                    $reasons[] = 'missing_estimate';
                }
                if (in_array((string) ($case['sla_status'] ?? ''), ['at_risk', 'overdue'], true)) {
                    $reasons[] = 'sla_risk';
                }

                return [
                    'request_case' => $case,
                    'reasons' => $reasons,
                ];
            })
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyPerformerWeeklyTimesheetPayload(string $startDate, string $endDate, ?int $actorId): array
    {
        return [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'performer_user_id' => $actorId,
            'total_hours' => 0,
            'billable_hours' => 0,
            'non_billable_hours' => 0,
            'worklog_count' => 0,
            'days' => collect($this->buildDateRange($startDate, $endDate))
                ->map(fn (string $date): array => [
                    'date' => $date,
                    'hours_spent' => 0,
                    'billable_hours' => 0,
                    'non_billable_hours' => 0,
                    'entry_count' => 0,
                ])
                ->values()
                ->all(),
            'top_cases' => [],
            'recent_entries' => [],
        ];
    }

    /**
     * @return array<int, string>
     */
    private function buildDateRange(string $startDate, string $endDate): array
    {
        $dates = [];
        $cursor = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        while ($cursor->lte($end)) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        return $dates;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->readQuery->normalizeNullableString($value);
    }
}
