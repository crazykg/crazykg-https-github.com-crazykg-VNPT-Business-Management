<?php

namespace App\Services\V5\CustomerRequest;

use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestCaseExecutionService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly CustomerRequestCaseReadQueryService $readQueryService,
        private readonly CustomerRequestCaseReadModelService $readModelService,
        private readonly CustomerRequestCaseWriteService $writeService,
    ) {}

    public function worklogs(CustomerRequestCase $case): JsonResponse
    {
        $rows = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.request_case_id', $case->id)
            ->when(
                $this->support->hasColumn('customer_request_worklogs', 'work_date'),
                fn ($query) => $query->orderByDesc('wl.work_date'),
                fn ($query) => $query->orderByDesc('wl.work_started_at')
            )
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->get()
            ->map(fn (object $row): array => $this->readModelService->serializeWorklogRow($row))
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function estimates(CustomerRequestCase $case): JsonResponse
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return $this->support->missingTable('customer_request_estimates');
        }

        return response()->json([
            'data' => $this->readModelService->loadEstimatesForCase((int) $case->id),
        ]);
    }

    public function storeEstimate(Request $request, CustomerRequestCase $case, ?int $actorId): JsonResponse
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return $this->support->missingTable('customer_request_estimates');
        }

        $estimatedHours = $this->normalizeNullableDecimal($request->input('estimated_hours'));
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return response()->json([
                'message' => 'estimated_hours là bắt buộc và phải lớn hơn 0.',
                'errors' => ['estimated_hours' => ['estimated_hours là bắt buộc và phải lớn hơn 0.']],
            ], 422);
        }

        $estimateScope = $this->support->normalizeNullableString($request->input('estimate_scope')) ?? 'total';
        if (! in_array($estimateScope, ['total', 'remaining', 'phase'], true)) {
            return response()->json([
                'message' => 'estimate_scope không hợp lệ.',
                'errors' => ['estimate_scope' => ['estimate_scope không hợp lệ.']],
            ], 422);
        }

        $estimateType = $this->support->normalizeNullableString($request->input('estimate_type')) ?? 'manual';
        $estimatedAt = $this->readQueryService->normalizeDateTime($request->input('estimated_at')) ?? now()->format('Y-m-d H:i:s');
        $statusInstanceId = $this->support->parseNullableInt($request->input('status_instance_id'))
            ?? $this->support->parseNullableInt($case->current_status_instance_id);
        $statusCode = $this->support->normalizeNullableString($request->input('status_code')) ?? (string) $case->current_status_code;
        $estimatedByUserId = $this->support->parseNullableInt($request->input('estimated_by_user_id')) ?? $actorId;
        $phaseLabel = $this->support->normalizeNullableString($request->input('phase_label'));
        $note = $this->support->normalizeNullableString($request->input('note'));
        $syncMaster = $this->readQueryService->resolveBooleanInput(
            $request->input('sync_master'),
            in_array($estimateScope, ['total', 'remaining'], true)
        );

        $estimateId = DB::transaction(function () use (
            $case,
            $estimatedHours,
            $estimateScope,
            $estimateType,
            $estimatedAt,
            $statusInstanceId,
            $statusCode,
            $estimatedByUserId,
            $phaseLabel,
            $note,
            $actorId,
            $syncMaster
        ): int {
            $estimateId = (int) DB::table('customer_request_estimates')->insertGetId($this->writeService->filterByTableColumns('customer_request_estimates', [
                'request_case_id' => (int) $case->id,
                'status_instance_id' => $statusInstanceId,
                'status_code' => $statusCode,
                'estimated_hours' => $estimatedHours,
                'estimate_type' => $estimateType,
                'estimate_scope' => $estimateScope,
                'phase_label' => $phaseLabel,
                'note' => $note,
                'estimated_by_user_id' => $estimatedByUserId,
                'estimated_at' => $estimatedAt,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            if ($syncMaster) {
                $masterEstimatedHours = $estimateScope === 'remaining'
                    ? round(((float) ($case->total_hours_spent ?? 0)) + $estimatedHours, 2)
                    : $estimatedHours;

                DB::table('customer_request_cases')
                    ->where('id', $case->id)
                    ->update($this->writeService->filterByTableColumns('customer_request_cases', [
                        'estimated_hours' => $masterEstimatedHours,
                        'estimated_by_user_id' => $estimatedByUserId,
                        'estimated_at' => $estimatedAt,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));
            }

            return $estimateId;
        });

        $estimate = $this->readModelService->loadEstimateById($estimateId);
        $freshCase = CustomerRequestCase::query()->find($case->id) ?? $case;

        return response()->json([
            'data' => [
                'estimate' => $estimate,
                'request_case' => $this->readModelService->serializeCaseModel($freshCase),
            ],
        ], 201);
    }

    public function hoursReport(CustomerRequestCase $case): JsonResponse
    {
        return response()->json([
            'data' => $this->readModelService->buildHoursReportPayload($case),
        ]);
    }

    public function storeWorklog(Request $request, CustomerRequestCase $case, ?int $actorId): JsonResponse
    {
        $workContent = $this->support->normalizeNullableString($request->input('work_content'));
        if ($workContent === null) {
            return response()->json(['message' => 'work_content là bắt buộc.'], 422);
        }

        $statusInstanceId = $this->support->parseNullableInt($request->input('status_instance_id'))
            ?? $this->support->parseNullableInt($case->current_status_instance_id);
        if ($statusInstanceId === null) {
            return response()->json(['message' => 'Yêu cầu chưa có trạng thái hiện tại để ghi worklog.'], 422);
        }

        $statusInstance = CustomerRequestStatusInstance::query()
            ->whereKey($statusInstanceId)
            ->where('request_case_id', $case->id)
            ->first();
        if ($statusInstance === null) {
            return response()->json(['message' => 'status_instance_id không hợp lệ.'], 422);
        }

        $startedAt = $this->readQueryService->normalizeDateTime($request->input('work_started_at'));
        $endedAt = $this->readQueryService->normalizeDateTime($request->input('work_ended_at'));
        $hoursSpent = $this->normalizeNullableDecimal($request->input('hours_spent'));
        $workDate = $this->readQueryService->normalizeNullableDate($request->input('work_date'));
        if ($hoursSpent === null && $startedAt !== null && $endedAt !== null) {
            try {
                $hoursSpent = round(Carbon::parse($startedAt)->diffInMinutes(Carbon::parse($endedAt), true) / 60, 2);
            } catch (\Throwable) {
                $hoursSpent = null;
            }
        }
        if ($workDate === null && $startedAt !== null) {
            try {
                $workDate = Carbon::parse($startedAt)->format('Y-m-d');
            } catch (\Throwable) {
                $workDate = null;
            }
        }

        $payload = $this->writeService->filterByTableColumns('customer_request_worklogs', [
            'request_case_id' => (int) $case->id,
            'status_instance_id' => (int) $statusInstance->id,
            'status_code' => (string) $statusInstance->status_code,
            'performed_by_user_id' => $this->support->parseNullableInt($request->input('performed_by_user_id')) ?? $actorId,
            'work_content' => $workContent,
            'work_started_at' => $startedAt,
            'work_ended_at' => $endedAt,
            'work_date' => $workDate,
            'activity_type_code' => $this->support->normalizeNullableString($request->input('activity_type_code')),
            'is_billable' => $this->readQueryService->resolveBooleanInput($request->input('is_billable')),
            'is_auto_transition' => $this->readQueryService->resolveBooleanInput($request->input('is_auto_transition')),
            'transition_id' => $this->support->parseNullableInt($request->input('transition_id')),
            'hours_spent' => $hoursSpent,
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $worklogId = (int) DB::table('customer_request_worklogs')->insertGetId($payload);
        $hoursSummary = $this->recalculateCaseHours((int) $case->id, $actorId);

        // G11: Gán actual_hours vào plan_item phù hợp (weekly ưu tiên hơn monthly)
        if ($hoursSpent !== null && $hoursSpent > 0 && $workDate !== null) {
            $this->attributeWorklogToPlanItem((int) $case->id, $case->performer_user_id, $workDate, $hoursSpent);
        }

        $row = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.id', $worklogId)
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->first();

        return response()->json([
            'data' => $row === null ? null : $this->readModelService->serializeWorklogRow($row),
            'meta' => [
                'hours_report' => $hoursSummary,
            ],
        ], 201);
    }

    public function loadEstimatesForCase(int $caseId): array
    {
        return $this->readModelService->loadEstimatesForCase($caseId);
    }

    public function loadEstimateById(int $estimateId): ?array
    {
        return $this->readModelService->loadEstimateById($estimateId);
    }

    public function buildHoursReportPayload(mixed $case): array
    {
        return $this->readModelService->buildHoursReportPayload($case);
    }

    private function recalculateCaseHours(int $caseId, ?int $actorId): array
    {
        $totalHoursSpent = (float) DB::table('customer_request_worklogs')
            ->where('request_case_id', $caseId)
            ->sum('hours_spent');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update($this->writeService->filterByTableColumns('customer_request_cases', [
                'total_hours_spent' => round($totalHoursSpent, 2),
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]));

        $case = CustomerRequestCase::query()->find($caseId);

        // G7: Kiểm tra và ghi cờ cảnh báo vượt giờ ước lượng (3 mức: 70/90/100%)
        if ($case !== null) {
            $this->checkAndSetOverrunWarnings($case, $totalHoursSpent, $actorId);
        }

        return $case === null
            ? [
                'request_case_id' => $caseId,
                'estimated_hours' => null,
                'total_hours_spent' => round($totalHoursSpent, 2),
            ]
            : $this->readModelService->buildHoursReportPayload($case);
    }

    /**
     * G7: Gửi cảnh báo khi giờ thực tế vượt 70% / 90% / 100% ước lượng.
     * Mỗi mức chỉ cảnh báo 1 lần (dedup bằng boolean flags trên master record).
     * Flags được reset khi estimate được revision (xem CustomerRequestEstimate model).
     */
    private function checkAndSetOverrunWarnings(CustomerRequestCase $case, float $totalHoursSpent, ?int $actorId): void
    {
        $estimatedHours = $case->estimated_hours !== null ? (float) $case->estimated_hours : null;

        // Guard: chỉ cảnh báo khi có estimate hợp lệ
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return;
        }

        $ratio = $totalHoursSpent / $estimatedHours;
        $updates = [];

        if ($ratio >= 1.00 && ! (bool) $case->warn_100_sent) {
            $updates['warn_100_sent'] = true;
            // TODO: gửi notification đến dispatcher + creator khi vượt 100%
        } elseif ($ratio >= 0.90 && ! (bool) $case->warn_90_sent) {
            $updates['warn_90_sent'] = true;
            // TODO: gửi notification đến dispatcher khi vượt 90%
        } elseif ($ratio >= 0.70 && ! (bool) $case->warn_70_sent) {
            $updates['warn_70_sent'] = true;
            // TODO: gửi notification đến performer khi vượt 70%
        }

        if ($updates !== []) {
            DB::table('customer_request_cases')
                ->where('id', $case->id)
                ->update($this->writeService->filterByTableColumns('customer_request_cases', [
                    ...$updates,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]));
        }
    }

    private function normalizeNullableDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    /**
     * G11: Attribution rule — gán hours_spent của worklog vào plan_item phù hợp.
     * - Match theo work_date trong kỳ kế hoạch (period_start..period_end).
     * - Weekly ưu tiên hơn monthly (CASE WHEN explicit, không dùng lexical sort).
     * - Mỗi worklog chỉ gán vào tối đa 1 plan_item → no double-count.
     * - Nếu không match → worklog được lưu bình thường, không mất giờ.
     */
    private function attributeWorklogToPlanItem(int $caseId, mixed $performerUserId, string $workDate, float $hoursSpent): void
    {
        if (! $this->support->hasTable('customer_request_plan_items')
            || ! $this->support->hasTable('customer_request_plans')) {
            return;
        }

        $performerId = $this->support->parseNullableInt($performerUserId);
        if ($performerId === null) {
            return;
        }

        $planItem = DB::table('customer_request_plan_items as pi')
            ->join('customer_request_plans as p', 'pi.plan_id', '=', 'p.id')
            ->where('pi.request_case_id', $caseId)
            ->where('pi.performer_user_id', $performerId)
            ->where('p.period_start', '<=', $workDate)
            ->where('p.period_end', '>=', $workDate)
            ->when(
                $this->support->hasColumn('customer_request_plan_items', 'carried_to_plan_id'),
                fn ($q) => $q->whereNull('pi.carried_to_plan_id')
            )
            // weekly ưu tiên hơn monthly (explicit CASE WHEN, không dùng lexical sort)
            ->orderByRaw("CASE WHEN p.plan_type = 'weekly' THEN 0 ELSE 1 END")
            ->select('pi.id', 'pi.actual_hours')
            ->first();

        if ($planItem !== null) {
            $newActual = round((float) ($planItem->actual_hours ?? 0) + $hoursSpent, 2);
            DB::table('customer_request_plan_items')
                ->where('id', $planItem->id)
                ->update([
                    'actual_hours' => $newActual,
                    'updated_at' => now(),
                ]);
        }
    }
}