<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedureStepWorklog;
use App\Models\SharedIssue;
use App\Models\SharedTimesheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureWorklogService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access
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

        $validator = Validator::make($request->all(), [
            'content'              => 'required|string|max:2000',
            'hours_spent'          => 'nullable|numeric|min:0.01|max:24',
            'work_date'            => 'nullable|date',
            'activity_description' => 'nullable|string|max:1000',
            'difficulty'           => 'nullable|string|max:2000',
            'proposal'             => 'nullable|string|max:2000',
            'issue_status'         => 'nullable|string|in:JUST_ENCOUNTERED,IN_PROGRESS,RESOLVED',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;

        $log = DB::transaction(function () use ($request, $step, $userId) {
            $log = ProjectProcedureStepWorklog::create([
                'step_id'      => $step->id,
                'procedure_id' => $step->procedure_id,
                'log_type'     => 'NOTE',
                'content'      => $request->input('content'),
                'created_by'   => $userId,
            ]);

            if ($request->filled('hours_spent')) {
                SharedTimesheet::create([
                    'procedure_step_worklog_id' => $log->id,
                    'hours_spent'               => $request->input('hours_spent'),
                    'work_date'                 => $request->input('work_date', now()->toDateString()),
                    'activity_description'      => $request->input('activity_description'),
                    'created_by'                => $userId,
                    'updated_by'                => $userId,
                ]);
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

        $validator = Validator::make($request->all(), [
            'content'              => 'required|string|max:2000',
            'hours_spent'          => 'nullable|numeric|min:0.01|max:24',
            'work_date'            => 'nullable|date',
            'activity_description' => 'nullable|string|max:1000',
            'difficulty'           => 'nullable|string|max:2000',
            'proposal'             => 'nullable|string|max:2000',
            'issue_status'         => 'nullable|string|in:JUST_ENCOUNTERED,IN_PROGRESS,RESOLVED',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;

        DB::transaction(function () use ($request, $log, $userId) {
            $log->update(['content' => $request->input('content')]);

            if ($request->filled('hours_spent')) {
                $ts = SharedTimesheet::firstOrNew(
                    ['procedure_step_worklog_id' => $log->id]
                );
                $ts->hours_spent = $request->input('hours_spent');
                $ts->work_date = $request->input('work_date', now()->toDateString());
                $ts->activity_description = $request->input('activity_description');
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
}
