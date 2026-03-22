<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestReportService
{
    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function missingTablesResponse(): ?JsonResponse
    {
        if (! $this->support->hasTable('customer_request_worklogs')) {
            return $this->support->missingTable('customer_request_worklogs');
        }

        return null;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function buildParamsSuffix(array $params): string
    {
        $filtered = array_filter($params, fn ($v) => $v !== null && $v !== '');
        if (empty($filtered)) {
            return '';
        }

        return '?' . http_build_query(array_map('strval', $filtered));
    }

    /**
     * Parse month param, default to current month "YYYY-MM".
     */
    private function resolveMonth(?string $param): string
    {
        if ($param !== null && preg_match('/^\d{4}-\d{2}$/', $param)) {
            return $param;
        }

        return Carbon::now()->format('Y-m');
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public function monthlyHours(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $month   = $this->resolveMonth($request->query('month'));
        $groupBy = in_array($request->query('group_by'), ['user', 'project', 'customer', 'activity'], true)
            ? $request->query('group_by')
            : 'user';
        $userId    = $this->support->parseNullableInt($request->query('user_id'));
        $projectId = $this->support->parseNullableInt($request->query('project_id'));

        // Try snapshot first
        $source = 'live';
        if ($this->support->hasTable('monthly_hours_snapshots')) {
            $snapshotExists = DB::table('monthly_hours_snapshots')
                ->where('snapshot_month', $month)
                ->exists();

            if ($snapshotExists) {
                $snapshotQuery = DB::table('monthly_hours_snapshots')
                    ->where('snapshot_month', $month);

                if ($userId !== null) {
                    $snapshotQuery->where('user_id', $userId);
                }
                if ($projectId !== null) {
                    $snapshotQuery->where('project_id', $projectId);
                }

                $rows = $snapshotQuery->get()->map(function ($row) {
                    $r = (array) $row;

                    return [
                        'user_id'            => $this->support->parseNullableInt($r['user_id'] ?? null),
                        'user_name'          => $this->normalizeNullableString($r['user_name'] ?? null),
                        'project_id'         => $this->support->parseNullableInt($r['project_id'] ?? null),
                        'project_name'       => $this->normalizeNullableString($r['project_name'] ?? null),
                        'customer_id'        => $this->support->parseNullableInt($r['customer_id'] ?? null),
                        'customer_name'      => $this->normalizeNullableString($r['customer_name'] ?? null),
                        'total_hours'        => (float) ($r['total_hours'] ?? 0),
                        'billable_hours'     => (float) ($r['billable_hours'] ?? 0),
                        'non_billable_hours' => (float) ($r['non_billable_hours'] ?? 0),
                        'estimated_hours'    => (float) ($r['estimated_hours'] ?? 0),
                        'request_count'      => (int) ($r['request_count'] ?? 0),
                        'completed_count'    => (int) ($r['completed_count'] ?? 0),
                        'hours_by_activity'  => null,
                    ];
                })->toArray();

                return response()->json([
                    'data' => $rows,
                    'meta' => [
                        'month'    => $month,
                        'group_by' => $groupBy,
                        'source'   => 'snapshot',
                    ],
                ]);
            }
        }

        // Live computation
        $startDate = $month . '-01';
        $endDate   = Carbon::parse($startDate)->endOfMonth()->format('Y-m-d');

        $query = DB::table('customer_request_worklogs as wl')
            ->whereBetween('wl.work_date', [$startDate, $endDate]);

        if ($userId !== null) {
            $query->where('wl.performed_by_user_id', $userId);
        }
        if ($projectId !== null && $this->support->hasColumn('customer_request_cases', 'project_id')) {
            $query->where('crc.project_id', $projectId);
        }

        if ($this->support->hasTable('customer_request_cases')) {
            $query->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id');
        }

        if ($this->support->hasTable('internal_users')) {
            $query->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id');
        }

        switch ($groupBy) {
            case 'project':
                $selectCols = [
                    'crc.project_id as project_id',
                    DB::raw("MAX(crc.project_id) as project_id_val"),
                ];
                if ($this->support->hasTable('projects') && $this->support->hasColumn('customer_request_cases', 'project_id')) {
                    $query->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id');
                    $rows = DB::table('customer_request_worklogs as wl')
                        ->whereBetween('wl.work_date', [$startDate, $endDate])
                        ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                        ->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id')
                        ->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id')
                        ->selectRaw('
                            crc.project_id,
                            MAX(pj.project_name) as project_name,
                            crc.customer_id,
                            MAX(cu.customer_name) as customer_name,
                            SUM(wl.hours_spent) as total_hours,
                            SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END) as billable_hours,
                            SUM(CASE WHEN wl.is_billable != 1 THEN wl.hours_spent ELSE 0 END) as non_billable_hours,
                            0 as estimated_hours,
                            COUNT(DISTINCT wl.request_case_id) as request_count,
                            0 as completed_count
                        ')
                        ->groupBy('crc.project_id', 'crc.customer_id')
                        ->get();
                } else {
                    $rows = collect();
                }
                break;

            case 'customer':
                if ($this->support->hasTable('customers') && $this->support->hasColumn('customer_request_cases', 'customer_id')) {
                    $rows = DB::table('customer_request_worklogs as wl')
                        ->whereBetween('wl.work_date', [$startDate, $endDate])
                        ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                        ->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id')
                        ->selectRaw('
                            crc.customer_id,
                            MAX(cu.customer_name) as customer_name,
                            SUM(wl.hours_spent) as total_hours,
                            SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END) as billable_hours,
                            SUM(CASE WHEN wl.is_billable != 1 THEN wl.hours_spent ELSE 0 END) as non_billable_hours,
                            0 as estimated_hours,
                            COUNT(DISTINCT wl.request_case_id) as request_count,
                            0 as completed_count
                        ')
                        ->groupBy('crc.customer_id')
                        ->get();
                } else {
                    $rows = collect();
                }
                break;

            case 'activity':
                $actCol = $this->support->hasColumn('customer_request_worklogs', 'activity_type_code')
                    ? 'wl.activity_type_code'
                    : 'NULL';
                $rows = DB::table('customer_request_worklogs as wl')
                    ->whereBetween('wl.work_date', [$startDate, $endDate])
                    ->selectRaw("
                        {$actCol} as activity_type_code,
                        SUM(wl.hours_spent) as total_hours,
                        SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END) as billable_hours,
                        SUM(CASE WHEN wl.is_billable != 1 THEN wl.hours_spent ELSE 0 END) as non_billable_hours,
                        0 as estimated_hours,
                        COUNT(DISTINCT wl.request_case_id) as request_count,
                        0 as completed_count
                    ")
                    ->groupBy(DB::raw($actCol))
                    ->get();
                break;

            default: // user
                $userNameExpr = $this->support->hasTable('internal_users')
                    ? 'MAX(iu.full_name)'
                    : 'NULL';
                $rows = DB::table('customer_request_worklogs as wl')
                    ->whereBetween('wl.work_date', [$startDate, $endDate])
                    ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                    ->when($userId !== null, fn ($q) => $q->where('wl.performed_by_user_id', $userId))
                    ->selectRaw("
                        wl.performed_by_user_id as user_id,
                        MAX(iu.full_name) as user_name,
                        SUM(wl.hours_spent) as total_hours,
                        SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END) as billable_hours,
                        SUM(CASE WHEN wl.is_billable != 1 THEN wl.hours_spent ELSE 0 END) as non_billable_hours,
                        0 as estimated_hours,
                        COUNT(DISTINCT wl.request_case_id) as request_count,
                        0 as completed_count
                    ")
                    ->groupBy('wl.performed_by_user_id')
                    ->orderByDesc('total_hours')
                    ->get();
                break;
        }

        $data = $rows->map(function ($row) use ($groupBy) {
            $r = (array) $row;
            $total    = (float) ($r['total_hours'] ?? 0);
            $billable = (float) ($r['billable_hours'] ?? 0);

            return [
                'user_id'            => $groupBy === 'user' ? $this->support->parseNullableInt($r['user_id'] ?? null) : null,
                'user_name'          => $groupBy === 'user' ? $this->normalizeNullableString($r['user_name'] ?? null) : null,
                'project_id'         => in_array($groupBy, ['project']) ? $this->support->parseNullableInt($r['project_id'] ?? null) : null,
                'project_name'       => in_array($groupBy, ['project']) ? $this->normalizeNullableString($r['project_name'] ?? null) : null,
                'customer_id'        => in_array($groupBy, ['customer', 'project']) ? $this->support->parseNullableInt($r['customer_id'] ?? null) : null,
                'customer_name'      => in_array($groupBy, ['customer', 'project']) ? $this->normalizeNullableString($r['customer_name'] ?? null) : null,
                'activity_type_code' => $groupBy === 'activity' ? $this->normalizeNullableString($r['activity_type_code'] ?? null) : null,
                'total_hours'        => $total,
                'billable_hours'     => $billable,
                'non_billable_hours' => (float) ($r['non_billable_hours'] ?? 0),
                'estimated_hours'    => (float) ($r['estimated_hours'] ?? 0),
                'request_count'      => (int) ($r['request_count'] ?? 0),
                'completed_count'    => (int) ($r['completed_count'] ?? 0),
                'billable_percent'   => $total > 0 ? round($billable / $total * 100, 1) : 0,
                'hours_by_activity'  => null,
            ];
        })->toArray();

        return response()->json([
            'data' => $data,
            'meta' => [
                'month'    => $month,
                'group_by' => $groupBy,
                'source'   => 'live',
            ],
        ]);
    }

    public function painPoints(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $month     = $this->resolveMonth($request->query('month'));
        $startDate = $month . '-01';
        $endDate   = Carbon::parse($startDate)->endOfMonth()->format('Y-m-d');

        $hasCases   = $this->support->hasTable('customer_request_cases');
        $hasIU      = $this->support->hasTable('internal_users');
        $hasActType = $this->support->hasColumn('customer_request_worklogs', 'activity_type_code');
        $hasIsBill  = $this->support->hasColumn('customer_request_worklogs', 'is_billable');

        // 1. Overloaded users: weekly hours > 38 in >= 2 consecutive weeks
        $overloadedUsers = [];
        if ($hasIU) {
            $weeklyRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('wl.performed_by_user_id as user_id, MAX(iu.full_name) as user_name, strftime(\'%Y-%W\', wl.work_date) as yw, SUM(wl.hours_spent) as week_hours')
                ->groupBy('wl.performed_by_user_id', DB::raw('strftime(\'%Y-%W\', wl.work_date)'))
                ->get();

            $byUser = [];
            foreach ($weeklyRaw as $row) {
                $uid = (int) $row->user_id;
                $byUser[$uid]['user_name'] = $row->user_name;
                $byUser[$uid]['weeks'][]   = (float) $row->week_hours;
            }
            foreach ($byUser as $uid => $info) {
                $weeks      = $info['weeks'];
                $overCount  = 0;
                $consecutive = 0;
                $maxConsec   = 0;
                foreach ($weeks as $wh) {
                    if ($wh > 38) {
                        $consecutive++;
                        $maxConsec = max($maxConsec, $consecutive);
                    } else {
                        $consecutive = 0;
                    }
                }
                if ($maxConsec >= 2) {
                    $overloadedUsers[] = [
                        'user_id'          => $uid,
                        'user_name'        => $info['user_name'],
                        'max_weekly_hours' => max($weeks),
                    ];
                }
            }
        }

        // 2. Low billable users: billable% < 70% AND total_hours > 10
        $lowBillableUsers = [];
        if ($hasIsBill && $hasIU) {
            $billRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('
                    wl.performed_by_user_id as user_id,
                    MAX(iu.full_name) as user_name,
                    SUM(wl.hours_spent) as total_hours,
                    SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END) as billable_hours
                ')
                ->groupBy('wl.performed_by_user_id')
                ->get();

            foreach ($billRaw as $row) {
                $total    = (float) $row->total_hours;
                $billable = (float) $row->billable_hours;
                if ($total > 10 && ($total > 0 ? $billable / $total : 0) < 0.7) {
                    $lowBillableUsers[] = [
                        'user_id'         => (int) $row->user_id,
                        'user_name'       => $row->user_name,
                        'total_hours'     => $total,
                        'billable_hours'  => $billable,
                        'billable_percent'=> $total > 0 ? round($billable / $total * 100, 1) : 0,
                    ];
                }
            }
        }

        // 3. Estimate variance: |actual - estimated| / estimated > 30%
        $estimateVariance = [];
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'estimated_hours')) {
            $estRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->join('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                ->whereNotNull('crc.estimated_hours')
                ->where('crc.estimated_hours', '>', 0)
                ->selectRaw('
                    wl.request_case_id,
                    MAX(crc.request_code) as request_code,
                    MAX(crc.estimated_hours) as estimated_hours,
                    SUM(wl.hours_spent) as actual_hours
                ')
                ->groupBy('wl.request_case_id')
                ->get();

            foreach ($estRaw as $row) {
                $est    = (float) $row->estimated_hours;
                $actual = (float) $row->actual_hours;
                if ($est > 0 && abs($actual - $est) / $est > 0.3) {
                    $estimateVariance[] = [
                        'request_case_id' => (int) $row->request_case_id,
                        'request_code'    => $row->request_code,
                        'estimated_hours' => $est,
                        'actual_hours'    => $actual,
                        'variance_pct'    => round(abs($actual - $est) / $est * 100, 1),
                    ];
                }
            }
        }

        // 4. Long-running cases: > 14 days open
        $longRunningCases = [];
        $closedStatuses   = ['completed', 'customer_notified', 'not_executed'];
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $lrRaw = DB::table('customer_request_cases')
                ->whereNotIn('current_status_code', $closedStatuses)
                ->whereNull('deleted_at')
                ->whereNotNull('received_at')
                ->selectRaw("id, request_code, current_status_code, received_at,
                    CAST((julianday('now') - julianday(received_at)) AS INTEGER) as days_open")
                ->whereRaw("CAST((julianday('now') - julianday(received_at)) AS INTEGER) > 14")
                ->limit(50)
                ->get();

            foreach ($lrRaw as $row) {
                $longRunningCases[] = [
                    'id'                  => (int) $row->id,
                    'request_code'        => $row->request_code,
                    'current_status_code' => $row->current_status_code,
                    'days_open'           => (int) $row->days_open,
                    'received_at'         => $row->received_at,
                ];
            }
        }

        // 5. Status stuck: same status > 5 days with no worklogs in last 5 days
        $statusStuck = [];
        if ($hasCases && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
            $fiveDaysAgo = Carbon::now()->subDays(5)->format('Y-m-d H:i:s');
            $stuckRaw    = DB::table('customer_request_cases as crc')
                ->whereNotIn('crc.current_status_code', $closedStatuses)
                ->whereNull('crc.deleted_at')
                ->whereNotExists(function ($sub) use ($fiveDaysAgo) {
                    $sub->from('customer_request_worklogs as wl2')
                        ->whereColumn('wl2.request_case_id', 'crc.id')
                        ->where('wl2.work_date', '>=', substr($fiveDaysAgo, 0, 10));
                })
                ->selectRaw("crc.id, crc.request_code, crc.current_status_code, crc.updated_at,
                    CAST((julianday('now') - julianday(crc.updated_at)) AS INTEGER) as days_since_update")
                ->whereRaw("CAST((julianday('now') - julianday(crc.updated_at)) AS INTEGER) > 5")
                ->limit(50)
                ->get();

            foreach ($stuckRaw as $row) {
                $statusStuck[] = [
                    'id'                  => (int) $row->id,
                    'request_code'        => $row->request_code,
                    'current_status_code' => $row->current_status_code,
                    'days_since_update'   => (int) $row->days_since_update,
                ];
            }
        }

        // 6. Meeting heavy: MEETING activity > 15% of user's hours
        $meetingHeavy = [];
        if ($hasActType && $hasIU) {
            $meetRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id')
                ->selectRaw('
                    wl.performed_by_user_id as user_id,
                    MAX(iu.full_name) as user_name,
                    SUM(wl.hours_spent) as total_hours,
                    SUM(CASE WHEN wl.activity_type_code = \'MEETING\' THEN wl.hours_spent ELSE 0 END) as meeting_hours
                ')
                ->groupBy('wl.performed_by_user_id')
                ->get();

            foreach ($meetRaw as $row) {
                $total   = (float) $row->total_hours;
                $meeting = (float) $row->meeting_hours;
                if ($total > 0 && $meeting / $total > 0.15) {
                    $meetingHeavy[] = [
                        'user_id'        => (int) $row->user_id,
                        'user_name'      => $row->user_name,
                        'total_hours'    => $total,
                        'meeting_hours'  => $meeting,
                        'meeting_pct'    => round($meeting / $total * 100, 1),
                    ];
                }
            }
        }

        // 7. Top customer load: top 5 customers by total hours
        $topCustomerLoad = [];
        if ($hasCases && $this->support->hasTable('customers') && $this->support->hasColumn('customer_request_cases', 'customer_id')) {
            $topRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate])
                ->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                ->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id')
                ->selectRaw('crc.customer_id, MAX(cu.customer_name) as customer_name, SUM(wl.hours_spent) as total_hours, COUNT(DISTINCT wl.request_case_id) as case_count')
                ->groupBy('crc.customer_id')
                ->orderByDesc('total_hours')
                ->limit(5)
                ->get();

            foreach ($topRaw as $row) {
                $topCustomerLoad[] = [
                    'customer_id'   => $this->support->parseNullableInt($row->customer_id),
                    'customer_name' => $row->customer_name,
                    'total_hours'   => (float) $row->total_hours,
                    'case_count'    => (int) $row->case_count,
                ];
            }
        }

        return response()->json([
            'data' => [
                'overloaded_users'  => $overloadedUsers,
                'low_billable_users'=> $lowBillableUsers,
                'estimate_variance' => $estimateVariance,
                'long_running_cases'=> $longRunningCases,
                'status_stuck'      => $statusStuck,
                'meeting_heavy'     => $meetingHeavy,
                'top_customer_load' => $topCustomerLoad,
            ],
            'meta' => ['month' => $month],
        ]);
    }

    public function weeklyHours(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $userId  = $this->support->parseNullableInt($request->query('user_id'));
        $from    = $request->query('from');
        if (! $from) {
            $from = Carbon::now()->startOfWeek()->format('Y-m-d');
        }
        $fromCarbon = Carbon::parse($from)->startOfWeek();
        $toCarbon   = Carbon::parse($request->query('to', $fromCarbon->copy()->addWeeks(5)->format('Y-m-d')))->endOfWeek();

        $hasIU = $this->support->hasTable('internal_users');

        $query = DB::table('customer_request_worklogs as wl')
            ->whereBetween('wl.work_date', [$fromCarbon->format('Y-m-d'), $toCarbon->format('Y-m-d')]);

        if ($userId !== null) {
            $query->where('wl.performed_by_user_id', $userId);
        }

        $hasIsBill = $this->support->hasColumn('customer_request_worklogs', 'is_billable');
        $billExpr  = $hasIsBill
            ? 'SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END)'
            : '0';

        if ($hasIU) {
            $query->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id');
        }

        $rows = $query->selectRaw("
                wl.performed_by_user_id as user_id,
                " . ($hasIU ? "MAX(iu.full_name) as user_name," : "NULL as user_name,") . "
                strftime('%Y-%W', wl.work_date) as yw,
                MIN(wl.work_date) as week_start,
                SUM(wl.hours_spent) as total_hours,
                {$billExpr} as billable_hours
            ")
            ->groupBy('wl.performed_by_user_id', DB::raw("strftime('%Y-%W', wl.work_date)"))
            ->orderBy('wl.performed_by_user_id')
            ->orderBy(DB::raw("strftime('%Y-%W', wl.work_date)"))
            ->get();

        // Group by user
        $byUser = [];
        foreach ($rows as $row) {
            $uid = (int) $row->user_id;
            if (! isset($byUser[$uid])) {
                $byUser[$uid] = [
                    'user_id'   => $uid,
                    'user_name' => $row->user_name,
                    'weeks'     => [],
                ];
            }
            $ws    = Carbon::parse($row->week_start)->startOfWeek();
            $we    = $ws->copy()->endOfWeek();
            $label = 'W' . $ws->weekOfYear . ' (' . $ws->format('d/m') . '-' . $we->format('d/m') . ')';
            $byUser[$uid]['weeks'][] = [
                'yw'            => (string) $row->yw,
                'week_label'    => $label,
                'total_hours'   => (float) $row->total_hours,
                'billable_hours'=> (float) $row->billable_hours,
            ];
        }

        return response()->json([
            'data' => array_values($byUser),
            'meta' => [
                'from' => $fromCarbon->format('Y-m-d'),
                'to'   => $toCarbon->format('Y-m-d'),
            ],
        ]);
    }

    public function trend(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $months = max(1, min(12, (int) ($request->query('months', 3))));
        $hasIsBill = $this->support->hasColumn('customer_request_worklogs', 'is_billable');
        $hasCases  = $this->support->hasTable('customer_request_cases');
        $hasSnap   = $this->support->hasTable('monthly_hours_snapshots');

        $data = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $monthCarbon = Carbon::now()->subMonths($i);
            $month       = $monthCarbon->format('Y-m');
            $startDate   = $month . '-01';
            $endDate     = $monthCarbon->endOfMonth()->format('Y-m-d');

            $totalHours    = 0.0;
            $billableHours = 0.0;

            // Try snapshot
            if ($hasSnap) {
                $snap = DB::table('monthly_hours_snapshots')
                    ->where('snapshot_month', $month)
                    ->selectRaw('SUM(total_hours) as th, SUM(billable_hours) as bh')
                    ->first();
                if ($snap && $snap->th !== null) {
                    $totalHours    = (float) $snap->th;
                    $billableHours = (float) $snap->bh;
                } else {
                    $live = DB::table('customer_request_worklogs')
                        ->whereBetween('work_date', [$startDate, $endDate])
                        ->selectRaw('SUM(hours_spent) as th' . ($hasIsBill ? ', SUM(CASE WHEN is_billable=1 THEN hours_spent ELSE 0 END) as bh' : ', 0 as bh'))
                        ->first();
                    $totalHours    = (float) ($live->th ?? 0);
                    $billableHours = (float) ($live->bh ?? 0);
                }
            } else {
                $live = DB::table('customer_request_worklogs')
                    ->whereBetween('work_date', [$startDate, $endDate])
                    ->selectRaw('SUM(hours_spent) as th' . ($hasIsBill ? ', SUM(CASE WHEN is_billable=1 THEN hours_spent ELSE 0 END) as bh' : ', 0 as bh'))
                    ->first();
                $totalHours    = (float) ($live->th ?? 0);
                $billableHours = (float) ($live->bh ?? 0);
            }

            $billablePercent = $totalHours > 0 ? round($billableHours / $totalHours * 100, 1) : 0;

            // Est accuracy
            $estAccuracy = 1.0;
            if ($hasCases && $this->support->hasColumn('customer_request_cases', 'estimated_hours')) {
                $estRaw = DB::table('customer_request_worklogs as wl')
                    ->whereBetween('wl.work_date', [$startDate, $endDate])
                    ->join('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id')
                    ->whereNotNull('crc.estimated_hours')
                    ->where('crc.estimated_hours', '>', 0)
                    ->selectRaw('wl.request_case_id, MAX(crc.estimated_hours) as est, SUM(wl.hours_spent) as actual')
                    ->groupBy('wl.request_case_id')
                    ->get();

                if ($estRaw->isNotEmpty()) {
                    $totalVariance = $estRaw->sum(fn ($r) => abs((float) $r->actual - (float) $r->est) / (float) $r->est);
                    $estAccuracy   = max(0, 1 - $totalVariance / $estRaw->count());
                }
            }

            // SLA breach count
            $slaBreachCount = 0;
            if ($hasCases && $this->support->hasColumn('customer_request_cases', 'sla_due_date')) {
                $slaBreachCount = (int) DB::table('customer_request_cases')
                    ->whereNotNull('sla_due_date')
                    ->where('sla_due_date', '<', $endDate)
                    ->whereNull('deleted_at')
                    ->count();
            }

            // Backlog count
            $backlogCount = 0;
            if ($hasCases && $this->support->hasColumn('customer_request_cases', 'current_status_code')) {
                $closedStatuses = ['completed', 'customer_notified', 'not_executed'];
                $backlogCount   = (int) DB::table('customer_request_cases')
                    ->whereNotIn('current_status_code', $closedStatuses)
                    ->whereNull('deleted_at')
                    ->count();
            }

            $data[] = [
                'month'             => $month,
                'total_hours'       => $totalHours,
                'billable_percent'  => $billablePercent,
                'est_accuracy'      => round($estAccuracy * 100, 1),
                'sla_breach_count'  => $slaBreachCount,
                'backlog_count'     => $backlogCount,
            ];
        }

        return response()->json([
            'data' => $data,
            'meta' => ['months' => $months],
        ]);
    }
}
