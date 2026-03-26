<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectRevenueScheduleDomainService
{
    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    /**
     * List revenue schedules for a given project.
     */
    public function index(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['data' => []]);
        }

        $rows = DB::table('project_revenue_schedules as prs')
            ->where('prs.project_id', $projectId)
            ->orderBy('prs.cycle_number')
            ->select([
                'prs.id',
                'prs.project_id',
                'prs.cycle_number',
                'prs.expected_date',
                'prs.expected_amount',
                'prs.notes',
                'prs.created_at',
                'prs.updated_at',
            ])
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'project_id' => (int) $row->project_id,
                'cycle_number' => (int) $row->cycle_number,
                'expected_date' => $row->expected_date,
                'expected_amount' => round((float) $row->expected_amount, 2),
                'notes' => $row->notes,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ])
            ->all();

        return response()->json(['data' => $rows]);
    }

    /**
     * Sync revenue schedules for a project (upsert + delete removed rows).
     * Payload: { schedules: [ { expected_date, expected_amount, notes? }, ... ] }
     */
    public function sync(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['message' => 'Bảng project_revenue_schedules chưa tồn tại.'], 422);
        }

        if (! $this->support->hasTable('projects') || ! DB::table('projects')->where('id', $projectId)->exists()) {
            return response()->json(['message' => 'Dự án không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'schedules' => ['required', 'array', 'max:120'],
            'schedules.*' => ['required', 'array'],
            'schedules.*.expected_date' => ['required', 'date'],
            'schedules.*.expected_amount' => ['required', 'numeric', 'min:0'],
            'schedules.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $schedules = $validated['schedules'];
        $now = now();
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);

        DB::transaction(function () use ($projectId, $schedules, $now, $actorId): void {
            DB::table('project_revenue_schedules')
                ->where('project_id', $projectId)
                ->delete();

            if ($schedules === []) {
                return;
            }

            $rows = [];
            foreach ($schedules as $index => $schedule) {
                $rows[] = [
                    'project_id' => $projectId,
                    'cycle_number' => $index + 1,
                    'expected_date' => $schedule['expected_date'],
                    'expected_amount' => round((float) $schedule['expected_amount'], 2),
                    'notes' => $schedule['notes'] ?? null,
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('project_revenue_schedules')->insert($chunk);
            }
        });

        return $this->index($request, $projectId);
    }

    /**
     * Auto-generate revenue schedules based on project items, payment_cycle,
     * start_date, and expected_end_date.
     */
    public function generate(Request $request, int $projectId): JsonResponse
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return response()->json(['message' => 'Bảng project_revenue_schedules chưa tồn tại.'], 422);
        }

        $project = DB::table('projects')->where('id', $projectId)->first();
        if (! $project) {
            return response()->json(['message' => 'Dự án không tồn tại.'], 404);
        }

        $paymentCycle = $project->payment_cycle ?? null;
        if (! $paymentCycle || ! in_array($paymentCycle, self::PAYMENT_CYCLES, true)) {
            return response()->json([
                'message' => 'Vui lòng cập nhật Chu kỳ thanh toán trước khi tạo phân kỳ tự động.',
            ], 422);
        }

        $startDate = $project->start_date ?? null;
        $endDate = $project->expected_end_date ?? null;
        if (! $startDate || ! $endDate) {
            return response()->json([
                'message' => 'Vui lòng cập nhật ngày bắt đầu và ngày kết thúc trước khi tạo phân kỳ tự động.',
            ], 422);
        }

        $estimatedValue = (float) ($project->estimated_value ?? 0);
        if ($estimatedValue <= 0) {
            // Calculate from project items
            $estimatedValue = (float) DB::table('project_items')
                ->where('project_id', $projectId)
                ->whereNull('deleted_at')
                ->selectRaw('COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(unit_price, 0)), 0) as total')
                ->value('total');

            if ($estimatedValue <= 0) {
                return response()->json([
                    'message' => 'Giá trị dự kiến = 0. Vui lòng thêm hạng mục dự án trước.',
                ], 422);
            }
        }

        $intervalMonths = match ($paymentCycle) {
            'ONCE' => 0,
            'MONTHLY' => 1,
            'QUARTERLY' => 3,
            'HALF_YEARLY' => 6,
            'YEARLY' => 12,
            default => 1,
        };

        $startCarbon = \Carbon\Carbon::parse($startDate);
        $endCarbon = \Carbon\Carbon::parse($endDate);

        if ($paymentCycle === 'ONCE') {
            $schedules = [
                ['expected_date' => $endCarbon->format('Y-m-d'), 'expected_amount' => $estimatedValue],
            ];
        } else {
            $totalMonths = max(1, $startCarbon->diffInMonths($endCarbon));
            $cycleCount = max(1, (int) ceil($totalMonths / $intervalMonths));
            $baseAmount = round($estimatedValue / $cycleCount, 2);

            $schedules = [];
            $cursor = $startCarbon->copy();
            for ($i = 0; $i < $cycleCount; $i++) {
                $scheduleDate = $cursor->copy()->addMonths($intervalMonths);
                if ($scheduleDate->greaterThan($endCarbon)) {
                    $scheduleDate = $endCarbon->copy();
                }

                $amount = ($i === $cycleCount - 1)
                    ? round($estimatedValue - $baseAmount * ($cycleCount - 1), 2)
                    : $baseAmount;

                $schedules[] = [
                    'expected_date' => $scheduleDate->format('Y-m-d'),
                    'expected_amount' => max(0, $amount),
                ];

                $cursor = $scheduleDate;
            }
        }

        // Delegate to sync
        $request->merge(['schedules' => $schedules]);

        return $this->sync($request, $projectId);
    }

    /**
     * Aggregate project revenue schedules by period for revenue target suggestion.
     * Used by RevenueTargetService::suggest().
     *
     * @return array<string, float> period_key => total_expected_amount
     */
    public function aggregateByPeriod(int $year, string $periodType, ?int $deptId = null): array
    {
        if (! $this->support->hasTable('project_revenue_schedules')) {
            return [];
        }

        $query = DB::table('project_revenue_schedules as prs')
            ->join('projects as p', 'prs.project_id', '=', 'p.id')
            ->where('p.status', 'CO_HOI')
            ->whereNull('p.deleted_at')
            ->whereYear('prs.expected_date', $year);

        if ($deptId !== null && $deptId > 0 && $this->support->hasColumn('projects', 'dept_id')) {
            $query->where('p.dept_id', $deptId);
        }

        $monthKeyExpr = DB::getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', prs.expected_date)"
            : "DATE_FORMAT(prs.expected_date, '%Y-%m')";

        $rows = $query
            ->selectRaw("{$monthKeyExpr} as month_key, COALESCE(SUM(prs.expected_amount), 0) as total")
            ->groupBy('month_key')
            ->orderBy('month_key')
            ->get();

        $monthlyData = [];
        foreach ($rows as $row) {
            $monthlyData[$row->month_key] = round((float) $row->total, 2);
        }

        if ($periodType === 'MONTHLY') {
            return $monthlyData;
        }

        // Aggregate into QUARTERLY or YEARLY
        $result = [];
        foreach ($monthlyData as $monthKey => $amount) {
            $month = (int) substr($monthKey, 5, 2);
            $periodKey = match ($periodType) {
                'QUARTERLY' => $year.'-Q'.ceil($month / 3),
                'YEARLY' => (string) $year,
                default => $monthKey,
            };
            $result[$periodKey] = round(($result[$periodKey] ?? 0) + $amount, 2);
        }

        return $result;
    }
}
