<?php

namespace App\Services\V5\CustomerRequest;

use App\Support\Auth\UserAccessService;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestCaseDashboardService
{
    public function __construct(
        private readonly CustomerRequestCaseReadQueryService $readQuery,
        private readonly UserAccessService $userAccess,
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
        $query = DB::table('customer_request_cases as crc')
            ->whereNull('crc.deleted_at');

        $statusCode = $this->readQuery->normalizeNullableString($request->query('status_code'));
        if ($statusCode !== null) {
            $query->where('crc.current_status_code', $statusCode);
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
            $value = $request->query($column);
            if ($value !== null && $value !== '') {
                $query->where("crc.{$column}", $value);
            }
        }

        $myRole = $this->readQuery->normalizeNullableString($request->query('my_role'));
        if ($actorId !== null && $myRole !== null) {
            match ($myRole) {
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

        if ($actorId !== null && ! $this->userAccess->isAdmin($actorId)) {
            $projectIds = $this->readQuery->projectIdsForUserByRaciRoles($actorId);
            $query->where(function (QueryBuilder $builder) use ($actorId, $projectIds): void {
                $builder
                    ->where('crc.created_by', $actorId)
                    ->orWhere('crc.received_by_user_id', $actorId)
                    ->orWhere('crc.dispatcher_user_id', $actorId)
                    ->orWhere('crc.performer_user_id', $actorId);

                if ($projectIds !== []) {
                    $builder->orWhereIn('crc.project_id', $projectIds);
                }
            });
        }

        $statusCounts = (clone $query)
            ->select(['crc.current_status_code', DB::raw('COUNT(*) as count')])
            ->groupBy('crc.current_status_code')
            ->orderBy('crc.current_status_code')
            ->get()
            ->map(fn (object $row): array => [
                'status_code' => (string) ($row->current_status_code ?? ''),
                'count' => (int) ($row->count ?? 0),
            ])
            ->all();

        return response()->json([
            'data' => [
                'role' => 'overview',
                'summary' => [
                    'total_cases' => (int) (clone $query)->count(),
                    'status_counts' => $statusCounts,
                    'alert_counts' => [
                        'over_estimate' => 0,
                        'missing_estimate' => 0,
                        'sla_risk' => 0,
                    ],
                ],
                'top_customers' => [],
                'top_projects' => [],
                'top_performers' => [],
                'attention_cases' => [],
            ],
        ]);
    }

    private function dashboardByRole(Request $request, string $role, callable $serializeCaseRow): JsonResponse
    {
        if (($missing = $this->readQuery->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->readQuery->resolveActorId($request);
        $query = DB::table('customer_request_cases as crc')
            ->whereNull('crc.deleted_at');

        $statusCode = $this->readQuery->normalizeNullableString($request->query('status_code'));
        if ($statusCode !== null) {
            $query->where('crc.current_status_code', $statusCode);
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
            $value = $request->query($column);
            if ($value !== null && $value !== '') {
                $query->where("crc.{$column}", $value);
            }
        }

        if ($actorId !== null) {
            match ($role) {
                'creator' => $query->where('crc.created_by', $actorId),
                'dispatcher' => $query->where(function (QueryBuilder $builder) use ($actorId): void {
                    $builder
                        ->where('crc.dispatcher_user_id', $actorId)
                        ->orWhere('crc.received_by_user_id', $actorId);
                }),
                'performer' => $query->where('crc.performer_user_id', $actorId),
                default => null,
            };
        }

        if ($actorId !== null && ! $this->userAccess->isAdmin($actorId)) {
            $projectIds = $this->readQuery->projectIdsForUserByRaciRoles($actorId);
            $query->where(function (QueryBuilder $builder) use ($actorId, $projectIds): void {
                $builder
                    ->where('crc.created_by', $actorId)
                    ->orWhere('crc.received_by_user_id', $actorId)
                    ->orWhere('crc.dispatcher_user_id', $actorId)
                    ->orWhere('crc.performer_user_id', $actorId);

                if ($projectIds !== []) {
                    $builder->orWhereIn('crc.project_id', $projectIds);
                }
            });
        }

        $statusCounts = (clone $query)
            ->select(['crc.current_status_code', DB::raw('COUNT(*) as count')])
            ->groupBy('crc.current_status_code')
            ->orderBy('crc.current_status_code')
            ->get()
            ->map(fn (object $row): array => [
                'status_code' => (string) ($row->current_status_code ?? ''),
                'count' => (int) ($row->count ?? 0),
            ])
            ->all();

        return response()->json([
            'data' => [
                'role' => $role,
                'summary' => [
                    'total_cases' => (int) (clone $query)->count(),
                    'status_counts' => $statusCounts,
                    'alert_counts' => [
                        'over_estimate' => 0,
                        'missing_estimate' => 0,
                        'sla_risk' => 0,
                    ],
                ],
                'top_customers' => [],
                'top_projects' => [],
                'top_performers' => [],
                'attention_cases' => [],
            ],
        ]);
    }

    private function buildDashboardPayload(string $role, \Illuminate\Support\Collection $rows, callable $serializeCaseRow): array
    {
        return [
            'role' => $role,
            'summary' => [
                'total_cases' => $rows->count(),
                'status_counts' => $this->collectStatusCounts($rows),
                'alert_counts' => [
                    'over_estimate' => $this->countOverEstimate($rows),
                    'missing_estimate' => $this->countMissingEstimate($rows),
                    'sla_risk' => $this->countSlaRisk($rows),
                ],
            ],
            'top_customers' => $this->collectTopCustomers($rows),
            'top_projects' => $this->collectTopProjects($rows),
            'top_performers' => $this->collectTopPerformers($rows),
            'attention_cases' => $this->collectAttentionCases($rows, 10, $serializeCaseRow),
        ];
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
            if (in_array($statusCode, ['completed', 'customer_notified', 'not_executed'], true)) {
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
            ->sortByDesc('count')
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
            ->sortByDesc('count')
            ->take(5)
            ->values()
            ->all();
    }

    private function collectTopPerformers(\Illuminate\Support\Collection $rows): array
    {
        return $rows
            ->filter(fn (object $row): bool => ! empty($row->performer_user_id))
            ->groupBy(fn (object $row): string => (string) $row->performer_user_id)
            ->map(function (\Illuminate\Support\Collection $group, string $performerUserId): array {
                $first = $group->first();

                return [
                    'performer_user_id' => (int) $performerUserId,
                    'performer_name' => $this->normalizeNullableString($first->performer_name ?? null),
                    'count' => $group->count(),
                ];
            })
            ->sortByDesc('count')
            ->take(5)
            ->values()
            ->all();
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
