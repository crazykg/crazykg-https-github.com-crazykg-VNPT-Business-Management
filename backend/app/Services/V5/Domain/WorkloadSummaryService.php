<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class WorkloadSummaryService
{
    private const DEFAULT_DAILY_CAPACITY = 8.0;
    private const SESSION_CAPACITY = 4.0;
    private const MAX_RANGE_DAYS = 366;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $accessService,
    ) {}

    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        $capacityRows = $this->buildCapacityRows($request, $rows, $from, $to);

        $totalHours = round(array_sum(array_column($rows, 'hours_spent')), 2);
        $capacityHours = round(array_sum(array_column($capacityRows, 'capacity_hours')), 2);
        $planned = $this->buildPlannedActualPayload($request, $rows, $from, $to);
        $alerts = $this->buildWeeklyAlerts($capacityRows);

        return response()->json([
            'data' => [
                'kpis' => [
                    'total_hours' => $totalHours,
                    'capacity_hours' => $capacityHours,
                    'utilization_percent' => $capacityHours > 0 ? round($totalHours / $capacityHours * 100, 2) : 0,
                    'planned_hours' => $planned['totals']['planned_hours'],
                    'actual_hours' => $planned['totals']['actual_hours'],
                    'variance_hours' => $planned['totals']['variance_hours'],
                    'entry_count' => count($rows),
                    'user_count' => count(array_unique(array_filter(array_column($rows, 'user_id')))),
                    'project_count' => count(array_unique(array_filter(array_column($rows, 'project_id')))),
                    'alert_count' => count($alerts),
                ],
                'by_source' => $this->groupRows($rows, 'source'),
                'by_day' => $this->groupRows($rows, 'work_date'),
                'by_user' => $this->groupRows($rows, 'user_id', ['user_name', 'department_name']),
                'alerts_preview' => array_slice($alerts, 0, 8),
            ],
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function dailySeries(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        $series = $this->dateKeys($from, $to);
        $actualByDate = [];

        foreach ($rows as $row) {
            $date = (string) $row['work_date'];
            $actualByDate[$date] = ($actualByDate[$date] ?? 0) + (float) $row['hours_spent'];
        }

        return response()->json([
            'data' => array_map(fn (string $date): array => [
                'date' => $date,
                'hours' => round((float) ($actualByDate[$date] ?? 0), 2),
            ], $series),
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function dailyComparison(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        $dates = $this->dateKeys($from, $to);
        $users = [];
        $hours = [];

        foreach ($rows as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }
            $date = (string) $row['work_date'];
            $users[$userId] = [
                'user_id' => $userId,
                'user_name' => $row['user_name'] ?? "User #{$userId}",
                'department_name' => $row['department_name'] ?? null,
            ];
            $hours[$date][$userId] = ($hours[$date][$userId] ?? 0) + (float) $row['hours_spent'];
        }

        return response()->json([
            'data' => [
                'users' => array_values($users),
                'series' => array_map(function (string $date) use ($users, $hours): array {
                    $row = ['date' => $date];
                    foreach (array_keys($users) as $userId) {
                        $row[(string) $userId] = round((float) ($hours[$date][$userId] ?? 0), 2);
                    }
                    return $row;
                }, $dates),
            ],
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function projectSummary(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        $grouped = [];

        foreach ($rows as $row) {
            $projectId = (int) ($row['project_id'] ?? 0);
            $key = $projectId > 0 ? (string) $projectId : 'none';
            $grouped[$key] ??= [
                'project_id' => $projectId > 0 ? $projectId : null,
                'project_name' => $row['project_name'] ?? 'Chua gan du an',
                'total_hours' => 0.0,
                'crc_hours' => 0.0,
                'project_hours' => 0.0,
                'entry_count' => 0,
                'user_count' => [],
            ];
            $grouped[$key]['total_hours'] += (float) $row['hours_spent'];
            $grouped[$key][$row['source'] === 'crc' ? 'crc_hours' : 'project_hours'] += (float) $row['hours_spent'];
            $grouped[$key]['entry_count']++;
            if ((int) ($row['user_id'] ?? 0) > 0) {
                $grouped[$key]['user_count'][(int) $row['user_id']] = true;
            }
        }

        $data = array_values(array_map(function (array $row): array {
            $row['total_hours'] = round((float) $row['total_hours'], 2);
            $row['crc_hours'] = round((float) $row['crc_hours'], 2);
            $row['project_hours'] = round((float) $row['project_hours'], 2);
            $row['user_count'] = count($row['user_count']);
            return $row;
        }, $grouped));

        usort($data, fn (array $a, array $b): int => $b['total_hours'] <=> $a['total_hours']);

        return response()->json([
            'data' => $data,
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function capacity(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);

        return response()->json([
            'data' => $this->buildCapacityRows($request, $rows, $from, $to),
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function weeklyAlerts(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        $capacityRows = $this->buildCapacityRows($request, $rows, $from, $to);

        return response()->json([
            'data' => $this->buildWeeklyAlerts($capacityRows),
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function plannedActual(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);

        return response()->json([
            'data' => $this->buildPlannedActualPayload($request, $rows, $from, $to),
            'meta' => $this->meta($request, $from, $to),
        ]);
    }

    public function entries(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);
        usort($rows, fn (array $a, array $b): int => strcmp((string) $b['work_date'], (string) $a['work_date']));

        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(200, max(1, (int) $request->query('per_page', 50)));
        $total = count($rows);
        $offset = ($page - 1) * $perPage;

        return response()->json([
            'data' => array_slice($rows, $offset, $perPage),
            'meta' => array_merge($this->meta($request, $from, $to), $this->support->buildPaginationMeta($page, $perPage, $total)),
        ]);
    }

    public function export(Request $request): Response
    {
        [$from, $to] = $this->resolveDateRange($request);
        $rows = $this->collectRows($request, $from, $to);

        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, [
            'Ngay',
            'Nguon',
            'Nguoi thuc hien',
            'Phong ban',
            'Du an',
            'Khach hang',
            'Ma/doi tuong',
            'Noi dung',
            'Gio',
        ]);

        foreach ($rows as $row) {
            fputcsv($handle, [
                $row['work_date'],
                $row['source_label'],
                $row['user_name'],
                $row['department_name'],
                $row['project_name'],
                $row['customer_name'],
                $row['reference_code'],
                $row['description'],
                $row['hours_spent'],
            ]);
        }

        rewind($handle);
        $csv = "\xEF\xBB\xBF" . stream_get_contents($handle);
        fclose($handle);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="workload_%s_%s.csv"', $from, $to),
        ]);
    }

    /**
     * @return array{0:string,1:string}
     */
    private function resolveDateRange(Request $request): array
    {
        $today = Carbon::now();
        $from = $this->normalizeDate($request->query('from')) ?? $today->copy()->startOfMonth()->toDateString();
        $to = $this->normalizeDate($request->query('to')) ?? $today->copy()->endOfMonth()->toDateString();

        if (Carbon::parse($from)->greaterThan(Carbon::parse($to))) {
            [$from, $to] = [$to, $from];
        }

        if (Carbon::parse($from)->diffInDays(Carbon::parse($to)) > self::MAX_RANGE_DAYS) {
            $to = Carbon::parse($from)->addDays(self::MAX_RANGE_DAYS)->toDateString();
        }

        return [$from, $to];
    }

    private function normalizeDate(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }

        try {
            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function collectRows(Request $request, string $from, string $to): array
    {
        $rows = [];
        $source = strtolower(trim((string) $request->query('source', 'all')));

        if ($source !== 'project' && $this->support->hasTable('customer_request_worklogs')) {
            $rows = array_merge($rows, $this->collectCustomerRequestRows($from, $to));
        }

        if ($source !== 'crc' && $this->support->hasTable('shared_timesheets')) {
            $rows = array_merge($rows, $this->collectProjectRows($from, $to));
        }

        return $this->filterRows($request, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function collectCustomerRequestRows(string $from, string $to): array
    {
        if (! $this->support->hasTable('customer_request_cases')) {
            return [];
        }

        $query = DB::table('customer_request_worklogs as wl')
            ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
            ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
            ->leftJoin('departments as dept', 'iu.department_id', '=', 'dept.id')
            ->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id')
            ->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id')
            ->whereBetween('wl.work_date', [$from, $to])
            ->select([
                'wl.id as worklog_id',
                'wl.work_date',
                'wl.performed_by_user_id as user_id',
                'iu.full_name as user_name',
                'iu.user_code as user_code',
                'iu.department_id as department_id',
                'dept.dept_name as department_name',
                'dept.dept_code as department_code',
                'crc.project_id as project_id',
                'pj.project_name as project_name',
                'crc.customer_id as customer_id',
                'cu.customer_name as customer_name',
                'crc.id as reference_id',
                'crc.request_code as reference_code',
                'wl.activity_type_code',
                'wl.hours_spent',
                'wl.is_billable',
            ]);

        if ($this->support->hasColumn('customer_request_worklogs', 'activity_description')) {
            $query->addSelect('wl.activity_description as description');
        } else {
            $query->addSelect(DB::raw('NULL as description'));
        }

        return $query->get()->map(fn (object $row): array => [
            'source' => 'crc',
            'source_label' => 'CRC',
            'worklog_id' => (int) $row->worklog_id,
            'work_date' => (string) $row->work_date,
            'user_id' => $this->intOrNull($row->user_id ?? null),
            'user_name' => $this->textOrNull($row->user_name ?? null),
            'user_code' => $this->textOrNull($row->user_code ?? null),
            'department_id' => $this->intOrNull($row->department_id ?? null),
            'department_name' => $this->textOrNull($row->department_name ?? null),
            'department_code' => $this->textOrNull($row->department_code ?? null),
            'project_id' => $this->intOrNull($row->project_id ?? null),
            'project_name' => $this->textOrNull($row->project_name ?? null),
            'customer_id' => $this->intOrNull($row->customer_id ?? null),
            'customer_name' => $this->textOrNull($row->customer_name ?? null),
            'reference_id' => $this->intOrNull($row->reference_id ?? null),
            'reference_code' => $this->textOrNull($row->reference_code ?? null),
            'activity_type_code' => $this->textOrNull($row->activity_type_code ?? null),
            'description' => $this->textOrNull($row->description ?? null),
            'hours_spent' => round((float) ($row->hours_spent ?? 0), 2),
            'is_billable' => (bool) ($row->is_billable ?? false),
        ])->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function collectProjectRows(string $from, string $to): array
    {
        if (! $this->support->hasTable('project_procedure_step_worklogs') || ! $this->support->hasTable('project_procedures')) {
            return [];
        }

        $performerExpr = $this->support->hasColumn('shared_timesheets', 'performed_by_user_id')
            ? 'COALESCE(ts.performed_by_user_id, ts.created_by)'
            : 'ts.created_by';

        $query = DB::table('shared_timesheets as ts')
            ->leftJoin('project_procedure_step_worklogs as wl', 'ts.procedure_step_worklog_id', '=', 'wl.id')
            ->leftJoin('project_procedures as pp', 'wl.procedure_id', '=', 'pp.id')
            ->leftJoin('projects as pj', 'pp.project_id', '=', 'pj.id')
            ->leftJoin('internal_users as iu', function ($join) use ($performerExpr): void {
                $join->on(DB::raw($performerExpr), '=', 'iu.id');
            })
            ->leftJoin('departments as dept', 'iu.department_id', '=', 'dept.id')
            ->whereBetween('ts.work_date', [$from, $to])
            ->select([
                'ts.id as worklog_id',
                'ts.work_date',
                DB::raw("{$performerExpr} as user_id"),
                'iu.full_name as user_name',
                'iu.user_code as user_code',
                'iu.department_id as department_id',
                'dept.dept_name as department_name',
                'dept.dept_code as department_code',
                'pp.project_id as project_id',
                'pj.project_name as project_name',
                'pp.id as reference_id',
                'pp.procedure_name as reference_code',
                'ts.activity_description as description',
                'ts.hours_spent',
            ]);

        return $query->get()->map(fn (object $row): array => [
            'source' => 'project',
            'source_label' => 'Projects',
            'worklog_id' => (int) $row->worklog_id,
            'work_date' => (string) $row->work_date,
            'user_id' => $this->intOrNull($row->user_id ?? null),
            'user_name' => $this->textOrNull($row->user_name ?? null),
            'user_code' => $this->textOrNull($row->user_code ?? null),
            'department_id' => $this->intOrNull($row->department_id ?? null),
            'department_name' => $this->textOrNull($row->department_name ?? null),
            'department_code' => $this->textOrNull($row->department_code ?? null),
            'project_id' => $this->intOrNull($row->project_id ?? null),
            'project_name' => $this->textOrNull($row->project_name ?? null),
            'customer_id' => null,
            'customer_name' => null,
            'reference_id' => $this->intOrNull($row->reference_id ?? null),
            'reference_code' => $this->textOrNull($row->reference_code ?? null),
            'activity_type_code' => null,
            'description' => $this->textOrNull($row->description ?? null),
            'hours_spent' => round((float) ($row->hours_spent ?? 0), 2),
            'is_billable' => null,
        ])->all();
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function filterRows(Request $request, array $rows): array
    {
        $userIds = $this->intList($request->query('user_ids') ?? $request->query('user_id'));
        $departmentId = $this->support->parseNullableInt($request->query('department_id'));
        $projectId = $this->support->parseNullableInt($request->query('project_id'));
        $visibility = $this->visibilityScope($request);

        return array_values(array_filter($rows, function (array $row) use ($userIds, $departmentId, $projectId, $visibility): bool {
            $rowUserId = $this->intOrNull($row['user_id'] ?? null);
            $rowDepartmentId = $this->intOrNull($row['department_id'] ?? null);
            $rowProjectId = $this->intOrNull($row['project_id'] ?? null);

            if ($userIds !== [] && ($rowUserId === null || ! in_array($rowUserId, $userIds, true))) {
                return false;
            }
            if ($departmentId !== null && $rowDepartmentId !== $departmentId) {
                return false;
            }
            if ($projectId !== null && $rowProjectId !== $projectId) {
                return false;
            }
            if ($visibility['all']) {
                return true;
            }
            if ($visibility['user_id'] !== null) {
                return $rowUserId === $visibility['user_id'];
            }
            if ($visibility['dept_ids'] !== []) {
                return $rowDepartmentId !== null && in_array($rowDepartmentId, $visibility['dept_ids'], true);
            }

            return false;
        }));
    }

    /**
     * @return array{all:bool,user_id:?int,dept_ids:array<int,int>}
     */
    private function visibilityScope(Request $request): array
    {
        $userId = (int) ($request->user()?->id ?? 0);
        if ($userId <= 0) {
            return ['all' => false, 'user_id' => null, 'dept_ids' => []];
        }

        $isWide = $this->accessService->isAdmin($userId)
            || $this->accessService->hasPermission($userId, 'workload.manage')
            || $this->accessService->hasPermission($userId, 'workload.approve');

        if ($isWide) {
            return ['all' => true, 'user_id' => null, 'dept_ids' => []];
        }

        $visibility = $this->accessService->resolveEmployeeVisibility($userId);
        if ($visibility['all']) {
            return ['all' => true, 'user_id' => null, 'dept_ids' => []];
        }

        $deptIds = array_values(array_map('intval', $visibility['dept_ids'] ?? []));
        if ($deptIds !== []) {
            return ['all' => false, 'user_id' => null, 'dept_ids' => $deptIds];
        }

        return ['all' => false, 'user_id' => $userId, 'dept_ids' => []];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function buildCapacityRows(Request $request, array $rows, string $from, string $to): array
    {
        $users = $this->resolveCapacityUsers($request, $rows);
        $dates = $this->dateKeys($from, $to);
        $workingDayMap = $this->workingDayMap($dates);
        $scheduleMap = $this->scheduleSessionMap(array_keys($users), $from, $to);
        $actualMap = [];

        foreach ($rows as $row) {
            $userId = (int) ($row['user_id'] ?? 0);
            if ($userId <= 0) {
                continue;
            }
            $date = (string) $row['work_date'];
            $actualMap[$userId][$date] = ($actualMap[$userId][$date] ?? 0) + (float) $row['hours_spent'];
        }

        $capacityRows = [];
        foreach ($users as $userId => $user) {
            foreach ($dates as $date) {
                $sessionCount = count($scheduleMap[$userId][$date] ?? []);
                $baseCapacity = ($workingDayMap[$date] ?? false) ? self::DEFAULT_DAILY_CAPACITY : 0.0;
                $capacity = $sessionCount > 0 ? $sessionCount * self::SESSION_CAPACITY : $baseCapacity;
                $actual = round((float) ($actualMap[$userId][$date] ?? 0), 2);
                $status = 'normal';
                if ($capacity > 0 && $actual <= 0) {
                    $status = 'missing';
                }
                if ($capacity > 0 && $actual > $capacity) {
                    $status = 'overloaded';
                }
                if ($capacity <= 0 && $actual > 0) {
                    $status = 'non_working_day_work';
                }

                $capacityRows[] = [
                    'date' => $date,
                    'user_id' => $userId,
                    'user_name' => $user['user_name'],
                    'department_id' => $user['department_id'],
                    'department_name' => $user['department_name'],
                    'capacity_hours' => round($capacity, 2),
                    'actual_hours' => $actual,
                    'utilization_percent' => $capacity > 0 ? round($actual / $capacity * 100, 2) : 0,
                    'status' => $status,
                    'status_label' => match ($status) {
                        'missing' => 'Thieu ghi gio',
                        'overloaded' => 'Vuot chuan ngay',
                        'non_working_day_work' => 'Co gio ngoai lich',
                        default => 'Binh thuong',
                    },
                ];
            }
        }

        return $capacityRows;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{user_name:?string,department_id:?int,department_name:?string}>
     */
    private function resolveCapacityUsers(Request $request, array $rows): array
    {
        $userIds = $this->intList($request->query('user_ids') ?? $request->query('user_id'));
        foreach ($rows as $row) {
            $userId = $this->intOrNull($row['user_id'] ?? null);
            if ($userId !== null) {
                $userIds[] = $userId;
            }
        }

        $departmentId = $this->support->parseNullableInt($request->query('department_id'));
        $query = DB::table('internal_users as iu')
            ->leftJoin('departments as dept', 'iu.department_id', '=', 'dept.id')
            ->select(['iu.id', 'iu.full_name', 'iu.department_id', 'dept.dept_name']);

        if ($userIds !== []) {
            $query->whereIn('iu.id', array_values(array_unique($userIds)));
        } elseif ($departmentId !== null) {
            $query->where('iu.department_id', $departmentId);
        } elseif (($request->user()?->id ?? null) !== null) {
            $query->where('iu.id', (int) $request->user()->id);
        }

        $users = [];
        foreach ($query->limit(200)->get() as $row) {
            $users[(int) $row->id] = [
                'user_name' => $this->textOrNull($row->full_name ?? null),
                'department_id' => $this->intOrNull($row->department_id ?? null),
                'department_name' => $this->textOrNull($row->dept_name ?? null),
            ];
        }

        foreach ($rows as $row) {
            $userId = $this->intOrNull($row['user_id'] ?? null);
            if ($userId !== null && ! isset($users[$userId])) {
                $users[$userId] = [
                    'user_name' => $this->textOrNull($row['user_name'] ?? null),
                    'department_id' => $this->intOrNull($row['department_id'] ?? null),
                    'department_name' => $this->textOrNull($row['department_name'] ?? null),
                ];
            }
        }

        return $users;
    }

    /**
     * @param array<int, string> $dates
     * @return array<string, bool>
     */
    private function workingDayMap(array $dates): array
    {
        $map = [];
        if ($this->support->hasTable('monthly_calendars')) {
            $rows = DB::table('monthly_calendars')
                ->whereIn('date', $dates)
                ->select(['date', 'is_working_day'])
                ->get();

            foreach ($rows as $row) {
                $map[(string) $row->date] = (bool) $row->is_working_day;
            }
        }

        foreach ($dates as $date) {
            $map[$date] ??= Carbon::parse($date)->dayOfWeekIso <= 5;
        }

        return $map;
    }

    /**
     * @param array<int, int> $userIds
     * @return array<int, array<string, array<string, true>>>
     */
    private function scheduleSessionMap(array $userIds, string $from, string $to): array
    {
        if (
            $userIds === []
            || ! $this->support->hasTable('department_weekly_schedule_entries')
            || ! $this->support->hasTable('department_weekly_schedule_entry_participants')
        ) {
            return [];
        }

        $rows = DB::table('department_weekly_schedule_entries as e')
            ->join('department_weekly_schedule_entry_participants as p', 'p.entry_id', '=', 'e.id')
            ->whereIn('p.user_id', $userIds)
            ->whereBetween('e.calendar_date', [$from, $to])
            ->select(['p.user_id', 'e.calendar_date', 'e.session'])
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $userId = (int) $row->user_id;
            $date = (string) $row->calendar_date;
            $session = (string) $row->session;
            $map[$userId][$date][$session] = true;
        }

        return $map;
    }

    /**
     * @param array<int, array<string, mixed>> $capacityRows
     * @return array<int, array<string, mixed>>
     */
    private function buildWeeklyAlerts(array $capacityRows): array
    {
        $weekly = [];
        foreach ($capacityRows as $row) {
            $weekStart = Carbon::parse((string) $row['date'])->startOfWeek(Carbon::MONDAY)->toDateString();
            $userId = (int) $row['user_id'];
            $key = "{$weekStart}|{$userId}";
            $weekly[$key] ??= [
                'week_start' => $weekStart,
                'user_id' => $userId,
                'user_name' => $row['user_name'],
                'department_name' => $row['department_name'],
                'actual_hours' => 0.0,
                'capacity_hours' => 0.0,
                'missing_day_count' => 0,
                'overload_day_count' => 0,
            ];
            $weekly[$key]['actual_hours'] += (float) $row['actual_hours'];
            $weekly[$key]['capacity_hours'] += (float) $row['capacity_hours'];
            if ($row['status'] === 'missing') {
                $weekly[$key]['missing_day_count']++;
            }
            if ($row['status'] === 'overloaded') {
                $weekly[$key]['overload_day_count']++;
            }
        }

        $alerts = [];
        foreach ($weekly as $row) {
            $actual = round((float) $row['actual_hours'], 2);
            $capacity = round((float) $row['capacity_hours'], 2);
            $severity = null;
            $label = null;

            if ($capacity > 0 && ($actual > $capacity * 1.25 || $actual >= 48)) {
                $severity = 'CRITICAL';
                $label = 'Vuot chuan tuan nghiem trong';
            } elseif ($capacity > 0 && $actual > $capacity * 1.1) {
                $severity = 'WARNING';
                $label = 'Vuot chuan tuan';
            } elseif (($row['overload_day_count'] ?? 0) > 0) {
                $severity = 'WARNING';
                $label = 'Vuot chuan ngay';
            } elseif (($row['missing_day_count'] ?? 0) > 0) {
                $severity = 'INFO';
                $label = 'Thieu ghi gio';
            }

            if ($severity === null) {
                continue;
            }

            $alerts[] = array_merge($row, [
                'actual_hours' => $actual,
                'capacity_hours' => $capacity,
                'utilization_percent' => $capacity > 0 ? round($actual / $capacity * 100, 2) : 0,
                'severity' => $severity,
                'label' => $label,
            ]);
        }

        usort($alerts, function (array $a, array $b): int {
            $rank = ['CRITICAL' => 3, 'WARNING' => 2, 'INFO' => 1];
            return ($rank[$b['severity']] ?? 0) <=> ($rank[$a['severity']] ?? 0)
                ?: strcmp((string) $b['week_start'], (string) $a['week_start']);
        });

        return $alerts;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    private function buildPlannedActualPayload(Request $request, array $rows, string $from, string $to): array
    {
        $plannedByUser = [];
        $plannedByProject = [];

        if ($this->support->hasTable('customer_request_plan_items')) {
            $plannedRows = DB::table('customer_request_plan_items as item')
                ->leftJoin('customer_request_cases as crc', 'item.request_case_id', '=', 'crc.id')
                ->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id')
                ->leftJoin('internal_users as iu', 'item.performer_user_id', '=', 'iu.id')
                ->where(function ($query) use ($from, $to): void {
                    $query->whereNull('item.planned_start_date')->orWhere('item.planned_start_date', '<=', $to);
                })
                ->where(function ($query) use ($from): void {
                    $query->whereNull('item.planned_end_date')->orWhere('item.planned_end_date', '>=', $from);
                })
                ->select([
                    'item.performer_user_id',
                    'item.planned_hours',
                    'crc.project_id',
                    'pj.project_name',
                    'iu.full_name as user_name',
                ])
                ->get();

            foreach ($plannedRows as $row) {
                $userId = (int) ($row->performer_user_id ?? 0);
                $projectId = (int) ($row->project_id ?? 0);
                $hours = (float) ($row->planned_hours ?? 0);
                if ($userId > 0) {
                    $plannedByUser[$userId] ??= ['user_id' => $userId, 'user_name' => $row->user_name, 'planned_hours' => 0.0, 'actual_hours' => 0.0];
                    $plannedByUser[$userId]['planned_hours'] += $hours;
                }
                if ($projectId > 0) {
                    $plannedByProject[$projectId] ??= ['project_id' => $projectId, 'project_name' => $row->project_name, 'planned_hours' => 0.0, 'actual_hours' => 0.0];
                    $plannedByProject[$projectId]['planned_hours'] += $hours;
                }
            }
        }

        foreach ($rows as $row) {
            $hours = (float) $row['hours_spent'];
            $userId = (int) ($row['user_id'] ?? 0);
            $projectId = (int) ($row['project_id'] ?? 0);
            if ($userId > 0) {
                $plannedByUser[$userId] ??= ['user_id' => $userId, 'user_name' => $row['user_name'], 'planned_hours' => 0.0, 'actual_hours' => 0.0];
                $plannedByUser[$userId]['actual_hours'] += $hours;
            }
            if ($projectId > 0) {
                $plannedByProject[$projectId] ??= ['project_id' => $projectId, 'project_name' => $row['project_name'], 'planned_hours' => 0.0, 'actual_hours' => 0.0];
                $plannedByProject[$projectId]['actual_hours'] += $hours;
            }
        }

        $normalize = static function (array $item): array {
            $planned = round((float) $item['planned_hours'], 2);
            $actual = round((float) $item['actual_hours'], 2);
            $item['planned_hours'] = $planned;
            $item['actual_hours'] = $actual;
            $item['variance_hours'] = round($actual - $planned, 2);
            $item['status'] = $planned <= 0 ? 'NO_PLAN' : ($actual > $planned ? 'OVER_PLAN' : 'UNDER_OR_ON_PLAN');
            return $item;
        };

        $byUser = array_values(array_map($normalize, $plannedByUser));
        $byProject = array_values(array_map($normalize, $plannedByProject));
        $totalPlanned = round(array_sum(array_column($byUser, 'planned_hours')), 2);
        $totalActual = round(array_sum(array_column($byUser, 'actual_hours')), 2);

        return [
            'totals' => [
                'planned_hours' => $totalPlanned,
                'actual_hours' => $totalActual,
                'variance_hours' => round($totalActual - $totalPlanned, 2),
            ],
            'by_user' => $byUser,
            'by_project' => $byProject,
            'notes' => [
                'projects_without_planned_hours' => 'Project procedure actual hours are included; project planned hours require an explicit planned_hours field before exact comparison.',
            ],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array<int, string> $labelFields
     * @return array<int, array<string, mixed>>
     */
    private function groupRows(array $rows, string $keyField, array $labelFields = []): array
    {
        $grouped = [];
        foreach ($rows as $row) {
            $key = (string) ($row[$keyField] ?? 'none');
            $grouped[$key] ??= [
                $keyField => $row[$keyField] ?? null,
                'total_hours' => 0.0,
                'entry_count' => 0,
            ];
            foreach ($labelFields as $field) {
                $grouped[$key][$field] ??= $row[$field] ?? null;
            }
            if ($keyField === 'source') {
                $grouped[$key]['source_label'] = $row['source_label'] ?? $key;
            }
            $grouped[$key]['total_hours'] += (float) $row['hours_spent'];
            $grouped[$key]['entry_count']++;
        }

        return array_values(array_map(function (array $row): array {
            $row['total_hours'] = round((float) $row['total_hours'], 2);
            return $row;
        }, $grouped));
    }

    /**
     * @return array<int, string>
     */
    private function dateKeys(string $from, string $to): array
    {
        $dates = [];
        $cursor = Carbon::parse($from);
        $end = Carbon::parse($to);
        while ($cursor->lessThanOrEqualTo($end)) {
            $dates[] = $cursor->toDateString();
            $cursor->addDay();
        }

        return $dates;
    }

    /**
     * @return array<int, int>
     */
    private function intList(mixed $value): array
    {
        if (is_array($value)) {
            $parts = $value;
        } else {
            $parts = preg_split('/[,|]/', (string) ($value ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn (mixed $part): int => (int) trim((string) $part),
            $parts
        ), fn (int $id): bool => $id > 0)));
    }

    private function intOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $int = (int) $value;
        return $int > 0 ? $int : null;
    }

    private function textOrNull(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        return $text === '' ? null : $text;
    }

    /**
     * @return array<string, mixed>
     */
    private function meta(Request $request, string $from, string $to): array
    {
        return [
            'from' => $from,
            'to' => $to,
            'source' => strtolower(trim((string) $request->query('source', 'all'))) ?: 'all',
            'generated_at' => now()->toIso8601String(),
            'range_days_cap' => self::MAX_RANGE_DAYS,
        ];
    }
}
