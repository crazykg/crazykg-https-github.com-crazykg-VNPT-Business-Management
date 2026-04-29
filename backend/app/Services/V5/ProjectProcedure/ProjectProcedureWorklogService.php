<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedureStepWorklog;
use App\Models\SharedIssue;
use App\Models\SharedTimesheet;
use App\Services\V5\SupportConfig\SupportProjectWorklogDatetimePolicyService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureWorklogService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access,
        private readonly SupportProjectWorklogDatetimePolicyService $datetimePolicy,
    ) {}

    public function stepWorklogs(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $logs = ProjectProcedureStepWorklog::where('step_id', $step->id)
            ->with(['creator:id,full_name,user_code', 'timesheet', 'issue'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function addWorklog(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $datetimeEnabled = $this->datetimePolicy->isEnabled();

        $validator = Validator::make($request->all(), $this->validationRules($datetimeEnabled));

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;
        [$timesheetPayload, $timesheetError] = $this->resolveTimesheetPayload($request, $datetimeEnabled, $userId);
        if ($timesheetError !== null) {
            return $timesheetError;
        }

        $log = DB::transaction(function () use ($request, $step, $userId, $timesheetPayload) {
            $log = ProjectProcedureStepWorklog::create([
                'step_id'      => $step->id,
                'procedure_id' => $step->procedure_id,
                'log_type'     => 'NOTE',
                'content'      => $request->input('content'),
                'created_by'   => $userId,
            ]);

            if ($timesheetPayload !== null) {
                SharedTimesheet::create(array_merge(
                    $timesheetPayload,
                    [
                        'procedure_step_worklog_id' => $log->id,
                    ],
                ));
            }

            if ($request->filled('difficulty')) {
                SharedIssue::create([
                    'procedure_step_worklog_id' => $log->id,
                    'issue_content'             => $request->input('difficulty'),
                    'proposal_content'          => $request->input('proposal'),
                    'issue_status'              => $request->input('issue_status', 'JUST_ENCOUNTERED'),
                    'created_by'                => $userId,
                    'updated_by'                => $userId,
                ]);
            }

            return $log;
        });

        $log->load(['creator:id,full_name,user_code', 'timesheet', 'issue']);

        return response()->json(['data' => $log], 201);
    }

    public function updateWorklog(Request $request, int $logId): JsonResponse
    {
        [$log, $err] = $this->access->resolveAccessibleWorklog($logId, $request);
        if ($err !== null) {
            return $err;
        }

        if ($log->log_type !== 'NOTE') {
            return response()->json(['message' => 'Chỉ có thể chỉnh sửa worklog loại NOTE.'], 422);
        }

        $datetimeEnabled = $this->datetimePolicy->isEnabled();

        $validator = Validator::make($request->all(), $this->validationRules($datetimeEnabled));

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;
        [$timesheetPayload, $timesheetError] = $this->resolveTimesheetPayload($request, $datetimeEnabled, $userId);
        if ($timesheetError !== null) {
            return $timesheetError;
        }

        DB::transaction(function () use ($request, $log, $userId, $timesheetPayload) {
            $log->update(['content' => $request->input('content')]);

            if ($timesheetPayload !== null) {
                $ts = SharedTimesheet::firstOrNew(
                    ['procedure_step_worklog_id' => $log->id]
                );
                $ts->hours_spent = $timesheetPayload['hours_spent'];
                if (array_key_exists('performed_by_user_id', $timesheetPayload)) {
                    $ts->performed_by_user_id = $timesheetPayload['performed_by_user_id'];
                }
                $ts->work_date = $timesheetPayload['work_date'];
                $ts->work_started_at = $timesheetPayload['work_started_at'] ?? null;
                $ts->work_ended_at = $timesheetPayload['work_ended_at'] ?? null;
                $ts->activity_description = $timesheetPayload['activity_description'];
                $ts->updated_by = $userId;
                if (! $ts->exists) {
                    $ts->created_by = $userId;
                }
                $ts->save();
            }

            if ($request->filled('difficulty')) {
                $issue = SharedIssue::withTrashed()
                    ->where('procedure_step_worklog_id', $log->id)
                    ->first();

                if ($issue) {
                    if ($issue->trashed()) {
                        $issue->restore();
                    }
                    $issue->update([
                        'issue_content'    => $request->input('difficulty'),
                        'proposal_content' => $request->input('proposal'),
                        'issue_status'     => $request->input('issue_status', 'JUST_ENCOUNTERED'),
                        'updated_by'       => $userId,
                    ]);
                } else {
                    SharedIssue::create([
                        'procedure_step_worklog_id' => $log->id,
                        'issue_content'             => $request->input('difficulty'),
                        'proposal_content'          => $request->input('proposal'),
                        'issue_status'              => $request->input('issue_status', 'JUST_ENCOUNTERED'),
                        'created_by'                => $userId,
                        'updated_by'                => $userId,
                    ]);
                }
            } else {
                SharedIssue::where('procedure_step_worklog_id', $log->id)
                    ->whereNull('deleted_at')
                    ->update(['updated_by' => $userId]);
                SharedIssue::where('procedure_step_worklog_id', $log->id)->delete();
            }
        });

        return response()->json(['data' => $log->fresh(['creator', 'timesheet', 'issue'])]);
    }

    public function deleteWorklog(Request $request, int $logId): JsonResponse
    {
        [$log, $err] = $this->access->resolveAccessibleWorklog($logId, $request);
        if ($err !== null) {
            return $err;
        }

        if ($log->log_type !== 'NOTE') {
            return response()->json(['message' => 'Chỉ có thể xóa worklog loại NOTE.'], 422);
        }

        $userId = $request->user()?->id;
        if (! $this->access->canMutateWorklog($log, $userId)) {
            return response()->json(['message' => 'Bạn không có quyền xóa worklog này.'], 403);
        }

        DB::transaction(function () use ($log): void {
            $log->delete();
        });

        return response()->json(['message' => 'Đã xoá worklog.']);
    }

    public function procedureWorklogs(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $logs = ProjectProcedureStepWorklog::where('procedure_id', $procedureId)
            ->with([
                'creator:id,full_name,user_code',
                'step:id,step_name,step_number',
                'timesheet',
                'issue',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function updateIssueStatus(Request $request, int $issueId): JsonResponse
    {
        $issue = SharedIssue::find($issueId);

        if (! $issue) {
            return response()->json(['message' => 'Issue not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'issue_status' => 'required|string|in:JUST_ENCOUNTERED,IN_PROGRESS,RESOLVED',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $issue->update([
            'issue_status' => $request->input('issue_status'),
            'updated_by'   => $request->user()?->id,
        ]);

        return response()->json(['data' => $issue->fresh()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validationRules(bool $datetimeEnabled): array
    {
        return [
            'content'              => 'required|string|max:2000',
            'hours_spent'          => 'nullable|numeric|min:0|max:24',
            'work_date'            => 'nullable|date',
            'work_started_at'      => [$datetimeEnabled ? 'required' : 'nullable', 'date'],
            'work_ended_at'        => [$datetimeEnabled ? 'required' : 'nullable', 'date'],
            'activity_description' => 'nullable|string|max:1000',
            'difficulty'           => 'nullable|string|max:2000',
            'proposal'             => 'nullable|string|max:2000',
            'issue_status'         => 'nullable|string|in:JUST_ENCOUNTERED,IN_PROGRESS,RESOLVED',
        ];
    }

    /**
     * @return array{0: array<string, mixed>|null, 1: JsonResponse|null}
     */
    private function resolveTimesheetPayload(Request $request, bool $datetimeEnabled, ?int $userId): array
    {
        $startedAt = $this->normalizeDateTime($request->input('work_started_at'));
        $endedAt = $this->normalizeDateTime($request->input('work_ended_at'));
        if (! $datetimeEnabled) {
            $startedAt = null;
            $endedAt = null;
        }

        if ($datetimeEnabled && ($startedAt === null || $endedAt === null)) {
            return [
                null,
                response()->json([
                    'message' => 'Validation failed.',
                    'errors' => [
                        'work_started_at' => ['Từ ngày giờ là bắt buộc khi bật cấu hình ngày giờ worklog dự án.'],
                        'work_ended_at' => ['Đến ngày giờ là bắt buộc khi bật cấu hình ngày giờ worklog dự án.'],
                    ],
                ], 422),
            ];
        }

        if ($startedAt !== null && $endedAt !== null) {
            $start = Carbon::parse($startedAt);
            $end = Carbon::parse($endedAt);

            if ($start->greaterThan($end)) {
                return [
                    null,
                    response()->json([
                        'message' => 'Validation failed.',
                        'errors' => [
                            'work_ended_at' => ['Đến ngày giờ phải lớn hơn hoặc bằng Từ ngày giờ.'],
                        ],
                    ], 422),
                ];
            }
        }

        $hasManualHours = $request->filled('hours_spent');
        if (! $hasManualHours && $startedAt === null && $endedAt === null) {
            return [null, null];
        }

        $hoursSpent = $hasManualHours
            ? round((float) $request->input('hours_spent'), 2)
            : 0.0;

        if (! $hasManualHours && $startedAt !== null && $endedAt !== null) {
            $hoursSpent = round(Carbon::parse($startedAt)->diffInMinutes(Carbon::parse($endedAt)) / 60, 2);
        }

        if ($hoursSpent < 0 || $hoursSpent > 24) {
            return [
                null,
                response()->json([
                    'message' => 'Validation failed.',
                    'errors' => [
                        'hours_spent' => ['Số giờ phải nằm trong khoảng 0 đến 24.'],
                    ],
                ], 422),
            ];
        }

        $workDate = $request->input('work_date');
        if (! $workDate && $startedAt !== null) {
            $workDate = Carbon::parse($startedAt)->toDateString();
        }

        $payload = [
            'hours_spent' => $hoursSpent,
            'work_date' => $workDate ?: now()->toDateString(),
            'work_started_at' => $startedAt,
            'work_ended_at' => $endedAt,
            'activity_description' => $request->input('activity_description'),
            'created_by' => $userId,
            'updated_by' => $userId,
        ];

        if ($this->sharedTimesheetSupportsPerformer()) {
            $payload['performed_by_user_id'] = $userId;
        }

        return [$payload, null];
    }

    private function normalizeDateTime(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
            return null;
        }

        return Carbon::parse(str_replace('T', ' ', $normalized))->format('Y-m-d H:i:00');
    }

    private function sharedTimesheetSupportsPerformer(): bool
    {
        static $supports = null;

        if ($supports === null) {
            $supports = Schema::hasColumn('shared_timesheets', 'performed_by_user_id');
        }

        return $supports;
    }
}
