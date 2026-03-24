<?php

namespace App\Services\V5\Revenue;

use App\Models\RevenueSnapshot;
use App\Models\RevenueTarget;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RevenueTargetService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $auditService
    ) {}

    /**
     * index() — List targets with achievement data.
     *
     * Open periods: actual_amount computed LIVE.
     * Closed periods: from revenue_snapshots, fallback to live.
     */
    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'period_type' => ['sometimes', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'year' => ['sometimes', 'integer', 'min:2020', 'max:2099'],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
        ]);

        $query = RevenueTarget::whereNull('deleted_at');

        if (isset($validated['period_type'])) {
            $query->where('period_type', (string) $validated['period_type']);
        }
        if (isset($validated['year'])) {
            $year = (int) $validated['year'];
            $query->where('period_key', 'LIKE', $year . '%');
        }
        if (isset($validated['dept_id'])) {
            $query->where('dept_id', (int) $validated['dept_id']);
        }

        $targets = $query->orderBy('period_key')->orderBy('dept_id')->get();

        // Enrich with live achievement for open periods
        $today = now()->toDateString();
        $enriched = $targets->map(function (RevenueTarget $target) use ($today) {
            $row = $target->toArray();

            if ($target->period_end >= $today) {
                // Open period: compute LIVE
                $liveActual = $this->computeLiveActual($target);
                $row['actual_amount'] = round($liveActual, 2);
                $row['achievement_pct'] = $target->target_amount > 0
                    ? round($liveActual / $target->target_amount * 100, 1)
                    : 0.0;
            } else {
                // Closed period: try snapshot, fallback to stored actual_amount
                $snapshot = $this->getSnapshotActual($target);
                if ($snapshot !== null) {
                    $row['actual_amount'] = round($snapshot, 2);
                    $row['achievement_pct'] = $target->target_amount > 0
                        ? round($snapshot / $target->target_amount * 100, 1)
                        : 0.0;
                } else {
                    // Fallback to live even for closed
                    $liveActual = $this->computeLiveActual($target);
                    $row['actual_amount'] = round($liveActual, 2);
                    $row['achievement_pct'] = $target->target_amount > 0
                        ? round($liveActual / $target->target_amount * 100, 1)
                        : 0.0;
                }
            }

            return $row;
        });

        return response()->json(['data' => $enriched->values()]);
    }

    /**
     * store() — Create a revenue target.
     */
    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'period_type' => ['required', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'period_key' => ['required', 'string', 'max:10'],
            'target_amount' => ['required', 'numeric', 'min:0'],
            'dept_id' => ['sometimes', 'integer', 'min:0'],
            'target_type' => ['sometimes', Rule::in(['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'])],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $periodType = (string) $validated['period_type'];
        $periodKey = (string) $validated['period_key'];
        $deptId = (int) ($validated['dept_id'] ?? 0);
        $targetType = (string) ($validated['target_type'] ?? 'TOTAL');

        // Validate period_key format
        $dates = $this->parsePeriodDates($periodType, $periodKey);
        if ($dates === null) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['period_key' => ['Định dạng period_key không hợp lệ cho period_type=' . $periodType]],
            ], 422);
        }

        // App-level unique check (ISSUE-4 R2 fix)
        $existing = RevenueTarget::where('period_type', $periodType)
            ->where('period_key', $periodKey)
            ->where('dept_id', $deptId)
            ->where('target_type', $targetType)
            ->whereNull('deleted_at')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['period_key' => ['Kế hoạch đã tồn tại cho kỳ và phòng ban này.']],
            ], 422);
        }

        // If soft-deleted record exists with same key, forceDelete it
        RevenueTarget::where('period_type', $periodType)
            ->where('period_key', $periodKey)
            ->where('dept_id', $deptId)
            ->where('target_type', $targetType)
            ->whereNotNull('deleted_at')
            ->forceDelete();

        $userId = $this->auditService->resolveAuthenticatedUserId($request);

        $target = RevenueTarget::create([
            'period_type' => $periodType,
            'period_key' => $periodKey,
            'period_start' => $dates['start'],
            'period_end' => $dates['end'],
            'dept_id' => $deptId,
            'target_type' => $targetType,
            'target_amount' => (float) $validated['target_amount'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => $userId,
        ]);

        $this->auditService->recordAuditEvent(
            $request,
            'INSERT',
            'revenue_targets',
            $target->id,
            [],
            $target->toArray()
        );

        return response()->json(['data' => $target], 201);
    }

    /**
     * update() — Update target amount and metadata.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $target = RevenueTarget::whereNull('deleted_at')->find($id);
        if (! $target) {
            return response()->json(['message' => 'Không tìm thấy kế hoạch doanh thu.'], 404);
        }

        $validated = $request->validate([
            'target_amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $old = $target->toArray();
        $userId = $this->auditService->resolveAuthenticatedUserId($request);

        if (isset($validated['target_amount'])) {
            $target->target_amount = (float) $validated['target_amount'];
        }
        if (array_key_exists('notes', $validated)) {
            $target->notes = $validated['notes'];
        }
        $target->updated_by = $userId;
        $target->save();

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'revenue_targets',
            $target->id,
            $old,
            $target->toArray()
        );

        return response()->json(['data' => $target]);
    }

    /**
     * destroy() — Soft delete a target.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $target = RevenueTarget::whereNull('deleted_at')->find($id);
        if (! $target) {
            return response()->json(['message' => 'Không tìm thấy kế hoạch doanh thu.'], 404);
        }

        $old = $target->toArray();
        $target->delete();

        $this->auditService->recordAuditEvent(
            $request,
            'DELETE',
            'revenue_targets',
            $target->id,
            $old,
            []
        );

        return response()->json(null, 204);
    }

    /**
     * bulkStore() — Create or update targets in bulk.
     */
    public function bulkStore(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('revenue_targets')) {
            return $this->support->missingTable('revenue_targets');
        }

        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'period_type' => ['required', Rule::in(['MONTHLY', 'QUARTERLY', 'YEARLY'])],
            'target_type' => ['required', Rule::in(['TOTAL', 'NEW_CONTRACT', 'RENEWAL', 'RECURRING'])],
            'dept_ids' => ['required', 'array'],
            'dept_ids.*' => ['integer', 'min:0'],
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.period_key' => ['required', 'string', 'max:10'],
            'targets.*.amount' => ['required', 'numeric', 'min:0'],
        ]);

        $periodType = (string) $validated['period_type'];
        $targetType = (string) $validated['target_type'];
        $deptIds = array_map('intval', $validated['dept_ids']);
        $userId = $this->auditService->resolveAuthenticatedUserId($request);
        $created = 0;
        $updated = 0;

        DB::beginTransaction();
        try {
            foreach ($deptIds as $deptId) {
                foreach ($validated['targets'] as $item) {
                    $periodKey = (string) $item['period_key'];
                    $amount = (float) $item['amount'];

                    $dates = $this->parsePeriodDates($periodType, $periodKey);
                    if ($dates === null) {
                        continue;
                    }

                    $existing = RevenueTarget::where('period_type', $periodType)
                        ->where('period_key', $periodKey)
                        ->where('dept_id', $deptId)
                        ->where('target_type', $targetType)
                        ->whereNull('deleted_at')
                        ->first();

                    if ($existing) {
                        $existing->target_amount = $amount;
                        $existing->updated_by = $userId;
                        $existing->save();
                        $updated++;
                    } else {
                        // forceDelete soft-deleted record if exists
                        RevenueTarget::where('period_type', $periodType)
                            ->where('period_key', $periodKey)
                            ->where('dept_id', $deptId)
                            ->where('target_type', $targetType)
                            ->whereNotNull('deleted_at')
                            ->forceDelete();

                        RevenueTarget::create([
                            'period_type' => $periodType,
                            'period_key' => $periodKey,
                            'period_start' => $dates['start'],
                            'period_end' => $dates['end'],
                            'dept_id' => $deptId,
                            'target_type' => $targetType,
                            'target_amount' => $amount,
                            'created_by' => $userId,
                        ]);
                        $created++;
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'data' => [
                'created' => $created,
                'updated' => $updated,
            ],
        ], 201);
    }

    // ───────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────

    private function parsePeriodDates(string $periodType, string $periodKey): ?array
    {
        try {
            return match ($periodType) {
                'MONTHLY' => [
                    'start' => Carbon::createFromFormat('Y-m', $periodKey)->startOfMonth()->toDateString(),
                    'end' => Carbon::createFromFormat('Y-m', $periodKey)->endOfMonth()->toDateString(),
                ],
                'QUARTERLY' => $this->parseQuarterDates($periodKey),
                'YEARLY' => [
                    'start' => Carbon::createFromFormat('Y', $periodKey)->startOfYear()->toDateString(),
                    'end' => Carbon::createFromFormat('Y', $periodKey)->endOfYear()->toDateString(),
                ],
                default => null,
            };
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseQuarterDates(string $periodKey): ?array
    {
        if (! preg_match('/^(\d{4})-Q([1-4])$/', $periodKey, $m)) {
            return null;
        }

        $year = (int) $m[1];
        $quarter = (int) $m[2];
        $startMonth = ($quarter - 1) * 3 + 1;

        $start = Carbon::create($year, $startMonth, 1)->startOfDay();
        $end = $start->copy()->addMonths(2)->endOfMonth();

        return [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
        ];
    }

    private function computeLiveActual(RevenueTarget $target): float
    {
        if (! $this->support->hasTable('payment_schedules')) {
            return 0.0;
        }

        $query = DB::table('payment_schedules as ps')
            ->join('contracts as c', 'ps.contract_id', '=', 'c.id')
            ->whereNull('c.deleted_at')
            ->whereNull('ps.deleted_at')
            ->where('ps.expected_date', '>=', $target->period_start)
            ->where('ps.expected_date', '<=', $target->period_end);

        if ($target->dept_id > 0) {
            $query->where('c.dept_id', $target->dept_id);
        }

        return (float) $query->selectRaw(
            'COALESCE(SUM(ps.actual_amount), 0) as total'
        )->value('total');
    }

    private function getSnapshotActual(RevenueTarget $target): ?float
    {
        if (! $this->support->hasTable('revenue_snapshots')) {
            return null;
        }

        $dimType = $target->dept_id > 0 ? 'DEPARTMENT' : 'COMPANY';
        $dimId = $target->dept_id;

        $snapshot = RevenueSnapshot::where('period_key', $target->period_key)
            ->where('dimension_type', $dimType)
            ->where('dimension_id', $dimId)
            ->first();

        return $snapshot ? (float) $snapshot->total_collected : null;
    }
}
