<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GenerateMonthlyHoursSnapshot extends Command
{
    protected $signature = 'crc:snapshot-hours {month? : Format YYYY-MM, default previous month}';

    protected $description = 'Generate monthly hours snapshot for CustomerRequestWorklogs';

    public function handle(): int
    {
        if (! Schema::hasTable('customer_request_worklogs')) {
            $this->error('Bảng customer_request_worklogs không tồn tại. Chạy migration trước.');

            return self::FAILURE;
        }

        if (! Schema::hasTable('monthly_hours_snapshots')) {
            $this->error('Bảng monthly_hours_snapshots không tồn tại. Chạy migration trước.');

            return self::FAILURE;
        }

        $monthArg = $this->argument('month');
        if ($monthArg !== null && ! preg_match('/^\d{4}-\d{2}$/', $monthArg)) {
            $this->error('Tham số month phải có định dạng YYYY-MM (ví dụ: 2026-03).');

            return self::FAILURE;
        }

        $month = $monthArg ?? Carbon::now()->subMonth()->format('Y-m');

        $this->info("Đang tạo snapshot cho tháng {$month}...");

        $startDate = $month . '-01';
        $endDate   = Carbon::parse($startDate)->endOfMonth()->format('Y-m-d');

        // Delete existing snapshots for this month
        $deleted = DB::table('monthly_hours_snapshots')
            ->where('snapshot_month', $month)
            ->delete();

        if ($deleted > 0) {
            $this->line("  Đã xoá {$deleted} bản snapshot cũ cho tháng {$month}.");
        }

        $hasIU         = Schema::hasTable('internal_users');
        $hasCases      = Schema::hasTable('customer_request_cases');
        $hasProjects   = Schema::hasTable('projects');
        $hasCustomers  = Schema::hasTable('customers');
        $hasIsBill     = Schema::hasColumn('customer_request_worklogs', 'is_billable');
        $hasActType    = Schema::hasColumn('customer_request_worklogs', 'activity_type_code');
        $hasProjectId  = $hasCases && Schema::hasColumn('customer_request_cases', 'project_id');
        $hasCustomerId = $hasCases && Schema::hasColumn('customer_request_cases', 'customer_id');
        $hasEstHours   = $hasCases && Schema::hasColumn('customer_request_cases', 'estimated_hours');
        $hasCurStatus  = $hasCases && Schema::hasColumn('customer_request_cases', 'current_status_code');

        $billExpr = $hasIsBill
            ? 'SUM(CASE WHEN wl.is_billable = 1 THEN wl.hours_spent ELSE 0 END)'
            : '0';

        $nonBillExpr = $hasIsBill
            ? 'SUM(CASE WHEN wl.is_billable != 1 THEN wl.hours_spent ELSE 0 END)'
            : '0';

        $closedStatuses = ['completed', 'customer_notified', 'not_executed'];

        // Build the aggregation query
        $query = DB::table('customer_request_worklogs as wl')
            ->whereBetween('wl.work_date', [$startDate, $endDate]);

        if ($hasCases) {
            $query->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id');
        }

        if ($hasIU) {
            $query->leftJoin('internal_users as iu', 'wl.performed_by_user_id', '=', 'iu.id');
        }

        if ($hasProjectId && $hasProjects) {
            $query->leftJoin('projects as pj', 'crc.project_id', '=', 'pj.id');
        }

        if ($hasCustomerId && $hasCustomers) {
            $query->leftJoin('customers as cu', 'crc.customer_id', '=', 'cu.id');
        }

        $projectIdExpr   = $hasProjectId ? 'crc.project_id' : 'NULL';
        $projectNameExpr = ($hasProjectId && $hasProjects) ? 'MAX(pj.project_name)' : 'NULL';
        $customerIdExpr  = $hasCustomerId ? 'crc.customer_id' : 'NULL';
        $customerNameExpr = ($hasCustomerId && $hasCustomers) ? 'MAX(cu.customer_name)' : 'NULL';
        $userNameExpr    = $hasIU ? 'MAX(iu.full_name)' : 'NULL';
        $estExpr         = $hasEstHours ? 'MAX(crc.estimated_hours)' : '0';
        $completedExpr   = $hasCurStatus
            ? "SUM(CASE WHEN crc.current_status_code IN ('" . implode("','", $closedStatuses) . "') THEN 1 ELSE 0 END)"
            : '0';

        $groupByCols = ['wl.performed_by_user_id'];
        if ($hasProjectId) {
            $groupByCols[] = 'crc.project_id';
        }
        if ($hasCustomerId) {
            $groupByCols[] = 'crc.customer_id';
        }

        $rows = $query->selectRaw("
                wl.performed_by_user_id as user_id,
                {$userNameExpr} as user_name,
                {$projectIdExpr} as project_id,
                {$projectNameExpr} as project_name,
                {$customerIdExpr} as customer_id,
                {$customerNameExpr} as customer_name,
                SUM(wl.hours_spent) as total_hours,
                {$billExpr} as billable_hours,
                {$nonBillExpr} as non_billable_hours,
                {$estExpr} as estimated_hours,
                COUNT(DISTINCT wl.request_case_id) as request_count,
                {$completedExpr} as completed_count
            ")
            ->groupBy($groupByCols)
            ->get();

        if ($rows->isEmpty()) {
            $this->warn("Không có dữ liệu worklog cho tháng {$month}.");

            return self::SUCCESS;
        }

        // For each row, build hours_by_activity if column exists
        $activityMap = [];
        if ($hasActType) {
            $actRaw = DB::table('customer_request_worklogs as wl')
                ->whereBetween('wl.work_date', [$startDate, $endDate]);

            if ($hasCases) {
                $actRaw->leftJoin('customer_request_cases as crc', 'wl.request_case_id', '=', 'crc.id');
            }

            $groupByCols2 = array_merge(['wl.performed_by_user_id', 'wl.activity_type_code'], array_diff($groupByCols, ['wl.performed_by_user_id']));
            $projectIdForAct   = $hasProjectId ? 'crc.project_id' : 'NULL';
            $actRows = $actRaw->selectRaw("
                    wl.performed_by_user_id,
                    wl.activity_type_code,
                    {$projectIdForAct} as project_id,
                    SUM(wl.hours_spent) as act_hours
                ")
                ->groupBy($groupByCols2)
                ->get();

            foreach ($actRows as $ar) {
                $uid      = (string) $ar->performed_by_user_id;
                $pid      = isset($ar->project_id) ? (string) $ar->project_id : 'null';
                $mapKey   = "{$uid}_{$pid}";
                $actCode  = (string) ($ar->activity_type_code ?? 'OTHER');
                $activityMap[$mapKey][$actCode] = ((float) ($activityMap[$mapKey][$actCode] ?? 0)) + (float) $ar->act_hours;
            }
        }

        $inserts  = [];
        $now      = now()->toDateTimeString();

        foreach ($rows as $row) {
            $uid    = (string) ($row->user_id ?? '');
            $pid    = isset($row->project_id) ? (string) $row->project_id : 'null';
            $mapKey = "{$uid}_{$pid}";

            $inserts[] = [
                'snapshot_month'   => $month,
                'user_id'          => $row->user_id ?? 0,
                'user_name'        => $row->user_name,
                'project_id'       => isset($row->project_id) ? (int) $row->project_id : null,
                'project_name'     => $row->project_name ?? null,
                'customer_id'      => isset($row->customer_id) ? (int) $row->customer_id : null,
                'customer_name'    => $row->customer_name ?? null,
                'total_hours'      => (float) ($row->total_hours ?? 0),
                'billable_hours'   => (float) ($row->billable_hours ?? 0),
                'non_billable_hours' => (float) ($row->non_billable_hours ?? 0),
                'estimated_hours'  => (float) ($row->estimated_hours ?? 0),
                'request_count'    => (int) ($row->request_count ?? 0),
                'completed_count'  => (int) ($row->completed_count ?? 0),
                'hours_by_activity'=> isset($activityMap[$mapKey]) ? json_encode($activityMap[$mapKey]) : null,
                'created_at'       => $now,
            ];
        }

        // Bulk insert in chunks of 200
        $count = 0;
        foreach (array_chunk($inserts, 200) as $chunk) {
            DB::table('monthly_hours_snapshots')->insert($chunk);
            $count += count($chunk);
        }

        $this->info("Snapshot created for {$month}: {$count} rows");

        return self::SUCCESS;
    }
}
