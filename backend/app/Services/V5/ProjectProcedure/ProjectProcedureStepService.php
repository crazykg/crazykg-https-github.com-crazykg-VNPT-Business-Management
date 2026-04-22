<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedure;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepWorklog;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureStepService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access,
        private readonly V5DomainSupportService $support,
    ) {}

    public function procedureSteps(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $countableWorklogs = fn ($query) => $query
            ->where('log_type', '!=', 'CUSTOM')
            ->whereNotNull('content')
            ->whereRaw("TRIM(content) <> ''");

        $steps = ProjectProcedureStep::where('procedure_id', $procedureId)
            ->withCount([
                'worklogs as worklogs_count' => $countableWorklogs,
            ])
            ->withCount([
                'worklogs as blocking_worklogs_count' => $countableWorklogs,
            ])
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $steps]);
    }

    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'step_name'         => 'sometimes|string|max:500',
            'lead_unit'         => 'sometimes|nullable|string|max:255',
            'expected_result'   => 'sometimes|nullable|string|max:1000',
            'duration_days'     => 'sometimes|nullable|integer|min:0',
            'progress_status'   => 'sometimes|string|max:50',
            'document_number'   => 'sometimes|nullable|string|max:255',
            'document_date'     => 'sometimes|nullable|date',
            'actual_start_date' => 'sometimes|nullable|date',
            'actual_end_date'   => 'sometimes|nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;
        $hasBlockingWorklogs = $step->worklogs()
            ->where('log_type', '!=', 'CUSTOM')
            ->whereNotNull('content')
            ->whereRaw("TRIM(content) <> ''")
            ->exists();

        if ($request->has('step_name') && $hasBlockingWorklogs) {
            return response()->json(['message' => 'Không thể đổi tên bước đã có worklog.'], 409);
        }

        $mutableFields = ['step_name', 'lead_unit', 'expected_result', 'duration_days'];
        $hasMutableChange = collect($mutableFields)->contains(fn ($f) => $request->has($f));
        if ($hasMutableChange) {
            if ($hasBlockingWorklogs) {
                return response()->json([
                    'message' => 'Chỉ có thể sửa bước chưa có worklog nghiệp vụ.',
                ], 409);
            }

            if (! $this->access->canMutateStep($step, $userId !== null ? (int) $userId : null)) {
                return response()->json([
                    'message' => 'Chỉ admin, người Accountable (A) hoặc người tạo bước tự thêm mới được sửa bước chưa có worklog.',
                ], 403);
            }
        }

        $oldStatus = $step->progress_status;

        $step->update(array_merge(
            $request->only([
                'step_name',
                'lead_unit',
                'expected_result',
                'duration_days',
                'progress_status',
                'document_number',
                'document_date',
                'actual_start_date',
                'actual_end_date',
            ]),
            ['updated_by' => $userId]
        ));

        if ($request->has('progress_status') && $request->input('progress_status') !== $oldStatus) {
            $statusLabels = [
                'CHUA_THUC_HIEN' => 'Chưa thực hiện',
                'DANG_THUC_HIEN' => 'Đang thực hiện',
                'HOAN_THANH'     => 'Hoàn thành',
            ];
            ProjectProcedureStepWorklog::create([
                'step_id'      => $step->id,
                'procedure_id' => $step->procedure_id,
                'log_type'     => 'STATUS_CHANGE',
                'content'      => 'Tiến độ thay đổi: '
                    . ($statusLabels[$oldStatus] ?? $oldStatus)
                    . ' → '
                    . ($statusLabels[$request->input('progress_status')] ?? $request->input('progress_status')),
                'old_value'    => $oldStatus,
                'new_value'    => $request->input('progress_status'),
                'created_by'   => $userId,
            ]);
        }

        $procedure = $step->procedure;
        $procedure->recalculateProgress();

        return response()->json([
            'data'             => $step->fresh(),
            'overall_progress' => $procedure->fresh()->overall_progress,
        ]);
    }

    public function batchUpdateSteps(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'steps'                     => 'required|array|min:1',
            'steps.*.id'                => 'required|integer|exists:project_procedure_steps,id',
            'steps.*.progress_status'   => 'sometimes|string|max:50',
            'steps.*.document_number'   => 'sometimes|nullable|string|max:255',
            'steps.*.document_date'     => 'sometimes|nullable|date',
            'steps.*.actual_start_date' => 'sometimes|nullable|date',
            'steps.*.actual_end_date'   => 'sometimes|nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $stepsData = $request->input('steps');
        $updatedCount = 0;
        $procedureIds = [];
        $userId = $request->user()?->id;

        $stepIds = array_column($stepsData, 'id');
        $stepsMap = ProjectProcedureStep::whereIn('id', $stepIds)->get()->keyBy('id');

        $procedureIdSet = $stepsMap->pluck('procedure_id')->unique()->values();
        $projectIdSet = ProjectProcedure::whereIn('id', $procedureIdSet)->pluck('project_id')->unique()->values();

        foreach ($projectIdSet as $pid) {
            [, $err] = $this->access->resolveAccessibleProject((int) $pid, $request);
            if ($err !== null) {
                return $err;
            }
        }

        $statusLabels = [
            'CHUA_THUC_HIEN' => 'Chưa thực hiện',
            'DANG_THUC_HIEN' => 'Đang thực hiện',
            'HOAN_THANH'     => 'Hoàn thành',
        ];

        DB::transaction(function () use ($stepsData, $stepsMap, $userId, $statusLabels, &$updatedCount, &$procedureIds) {
            foreach ($stepsData as $stepData) {
                $step = $stepsMap->get($stepData['id']);
                if (! $step) {
                    continue;
                }

                $updateFields = array_filter([
                    'progress_status'   => $stepData['progress_status'] ?? null,
                    'document_number'   => array_key_exists('document_number', $stepData) ? $stepData['document_number'] : null,
                    'document_date'     => array_key_exists('document_date', $stepData) ? $stepData['document_date'] : null,
                    'actual_start_date' => array_key_exists('actual_start_date', $stepData) ? $stepData['actual_start_date'] : null,
                    'actual_end_date'   => array_key_exists('actual_end_date', $stepData) ? $stepData['actual_end_date'] : null,
                ], fn ($v, $k) => array_key_exists($k, $stepData), ARRAY_FILTER_USE_BOTH);

                if ($updateFields !== []) {
                    $oldStatus = $step->progress_status;
                    $updateFields['updated_by'] = $userId;
                    $step->update($updateFields);
                    $updatedCount++;

                    if (isset($stepData['progress_status']) && $stepData['progress_status'] !== $oldStatus) {
                        ProjectProcedureStepWorklog::create([
                            'step_id'      => $step->id,
                            'procedure_id' => $step->procedure_id,
                            'log_type'     => 'STATUS_CHANGE',
                            'content'      => 'Tiến độ thay đổi: '
                                . ($statusLabels[$oldStatus] ?? $oldStatus)
                                . ' → '
                                . ($statusLabels[$stepData['progress_status']] ?? $stepData['progress_status']),
                            'old_value'    => $oldStatus,
                            'new_value'    => $stepData['progress_status'],
                            'created_by'   => $userId,
                        ]);
                    }

                    if (isset($stepData['document_number']) && $stepData['document_number']) {
                        ProjectProcedureStepWorklog::create([
                            'step_id'      => $step->id,
                            'procedure_id' => $step->procedure_id,
                            'log_type'     => 'DOCUMENT_ADDED',
                            'content'      => 'Số văn bản: ' . $stepData['document_number'],
                            'new_value'    => $stepData['document_number'],
                            'created_by'   => $userId,
                        ]);
                    }
                }

                $procedureIds[$step->procedure_id] = true;
            }

            foreach (array_keys($procedureIds) as $procedureId) {
                ProjectProcedure::find($procedureId)?->recalculateProgress();
            }
        });

        $overallProgress = ProjectProcedure::whereIn('id', array_keys($procedureIds))
            ->pluck('overall_progress', 'id')
            ->toArray();

        return response()->json([
            'data' => [
                'updated_count'    => $updatedCount,
                'overall_progress' => $overallProgress,
            ],
        ]);
    }

    public function addCustomStep(Request $request, int $procedureId): JsonResponse
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'step_name'         => 'required|string|max:500',
            'phase'             => 'sometimes|nullable|string|max:255',
            'lead_unit'         => 'sometimes|nullable|string|max:255',
            'expected_result'   => 'sometimes|nullable|string|max:1000',
            'duration_days'     => 'sometimes|nullable|integer|min:0',
            'actual_start_date' => 'sometimes|nullable|date',
            'actual_end_date'   => 'sometimes|nullable|date|after_or_equal:actual_start_date',
            'progress_status'   => 'sometimes|nullable|in:CHUA_THUC_HIEN,DANG_THUC_HIEN,HOAN_THANH',
            'sort_order'        => 'sometimes|integer|min:0',
            'parent_step_id'    => 'sometimes|nullable|integer|exists:project_procedure_steps,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $parentStepId = $request->input('parent_step_id');
        $parentStepId = $parentStepId !== null && $parentStepId !== '' ? (int) $parentStepId : null;
        $parentStep = null;

        if ($parentStepId !== null) {
            $parentStep = ProjectProcedureStep::query()
                ->where('id', $parentStepId)
                ->where('procedure_id', $procedureId)
                ->first();

            if (! $parentStep) {
                return response()->json([
                    'message' => 'parent_step_id phải thuộc cùng thủ tục.',
                ], 422);
            }

            [$parentStartDate, $parentEndDate] = $this->access->resolveStepDateBounds($parentStep);
            $childStartDate = $request->input('actual_start_date');
            $childStartDate = $childStartDate !== null && trim((string) $childStartDate) !== '' ? trim((string) $childStartDate) : null;
            $childExplicitEndDate = $request->input('actual_end_date');
            $childExplicitEndDate = $childExplicitEndDate !== null && trim((string) $childExplicitEndDate) !== '' ? trim((string) $childExplicitEndDate) : null;
            $childDurationDays = $request->filled('duration_days')
                ? (int) $request->input('duration_days')
                : 0;
            $childEndDate = $this->access->computeProcedureStepEndDate($childStartDate, $childDurationDays, $childExplicitEndDate);

            $dateErrors = [];
            if ($childStartDate !== null && $parentStartDate !== null && $childStartDate < $parentStartDate) {
                $dateErrors['actual_start_date'][] = 'Từ ngày bước con không được trước Từ ngày bước cha.';
            }
            if ($childStartDate !== null && $parentEndDate !== null && $childStartDate > $parentEndDate) {
                $dateErrors['actual_start_date'][] = 'Từ ngày bước con không được sau Đến ngày bước cha.';
            }
            if ($childEndDate !== null && $parentStartDate !== null && $childEndDate < $parentStartDate) {
                $dateErrors['actual_end_date'][] = 'Đến ngày bước con không được trước Từ ngày bước cha.';
            }
            if ($childEndDate !== null && $parentEndDate !== null && $childEndDate > $parentEndDate) {
                $dateErrors['actual_end_date'][] = 'Đến ngày bước con không được sau Đến ngày bước cha.';
            }

            if ($dateErrors !== []) {
                return response()->json([
                    'message' => 'Validation failed.',
                    'errors' => $dateErrors,
                ], 422);
            }
        }

        $requestedSortOrder = $request->filled('sort_order')
            ? (int) $request->input('sort_order')
            : null;

        $step = DB::transaction(function () use ($procedure, $procedureId, $request, $parentStep, $parentStepId, $requestedSortOrder): ProjectProcedureStep {
            $sortOrder = $this->access->resolveInsertSortOrder(
                $procedureId,
                $parentStep,
                $request->input('phase'),
                $requestedSortOrder
            );

            ProjectProcedureStep::query()
                ->where('procedure_id', $procedureId)
                ->where('sort_order', '>=', $sortOrder)
                ->increment('sort_order');

            $maxStepNum = ProjectProcedureStep::query()
                ->where('procedure_id', $procedureId)
                ->max('step_number');

            $step = ProjectProcedureStep::create([
                'procedure_id'       => $procedureId,
                'template_step_id'   => null,
                'step_number'        => ($maxStepNum ?? 0) + 1,
                'phase'              => $request->input('phase'),
                'parent_step_id'     => $parentStepId,
                'step_name'          => $request->input('step_name'),
                'lead_unit'          => $request->input('lead_unit'),
                'expected_result'    => $request->input('expected_result'),
                'duration_days'      => $request->input('duration_days', 0),
                'actual_start_date'  => $request->input('actual_start_date'),
                'actual_end_date'    => $request->input('actual_end_date'),
                'progress_status'    => $request->input('progress_status', 'CHUA_THUC_HIEN'),
                'sort_order'         => $sortOrder,
                'created_by'         => $request->user()?->id,
            ]);

            ProjectProcedureStepWorklog::create([
                'step_id'      => $step->id,
                'procedure_id' => $procedureId,
                'log_type'     => 'CUSTOM',
                'content'      => 'Bước tùy chỉnh được thêm: ' . $step->step_name,
                'created_by'   => $request->user()?->id,
            ]);

            $procedure->recalculateProgress();

            return $step;
        });

        return response()->json(['data' => $step], 201);
    }

    public function deleteStep(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $hasBlockingWorklogs = $step->worklogs()
            ->where('log_type', '!=', 'CUSTOM')
            ->whereNotNull('content')
            ->whereRaw("TRIM(content) <> ''")
            ->exists();

        if ($hasBlockingWorklogs) {
            return response()->json(['message' => 'Không thể xóa bước đã có worklog.'], 409);
        }

        $hasChildren = ProjectProcedureStep::query()
            ->where('parent_step_id', $step->id)
            ->exists();

        if ($hasChildren) {
            return response()->json([
                'message' => 'Không thể xóa bước đang có bước con.',
            ], 409);
        }

        $userId = $request->user()?->id;
        if (! $this->access->canMutateStep($step, $userId !== null ? (int) $userId : null)) {
            return response()->json([
                'message' => 'Chỉ admin, người Accountable (A) hoặc người tạo bước tự thêm mới được xóa bước không có worklog nghiệp vụ và không có bước con.',
            ], 403);
        }

        $procedure = $step->procedure;

        if ($this->support->hasTable('attachments')) {
            DB::table('attachments')
                ->where('reference_type', 'PROCEDURE_STEP')
                ->where('reference_id', $step->id)
                ->delete();
        }

        $step->delete();
        $procedure->recalculateProgress();

        return response()->json(['message' => 'Step deleted successfully.']);
    }

    public function reorderSteps(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'steps'              => 'required|array|min:1|max:100',
            'steps.*.id'         => 'required|integer|exists:project_procedure_steps,id',
            'steps.*.sort_order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $stepIds = array_column($request->input('steps'), 'id');
        $procedureIds = ProjectProcedureStep::whereIn('id', $stepIds)->pluck('procedure_id')->unique();
        $projectIds = ProjectProcedure::whereIn('id', $procedureIds)->pluck('project_id')->unique();
        foreach ($projectIds as $pid) {
            [, $err] = $this->access->resolveAccessibleProject((int) $pid, $request);
            if ($err !== null) {
                return $err;
            }
        }

        DB::transaction(function () use ($request) {
            foreach ($request->input('steps') as $item) {
                ProjectProcedureStep::where('id', $item['id'])
                    ->update(['sort_order' => (int) $item['sort_order']]);
            }
        });

        return response()->json(['message' => 'Steps reordered.']);
    }
}
