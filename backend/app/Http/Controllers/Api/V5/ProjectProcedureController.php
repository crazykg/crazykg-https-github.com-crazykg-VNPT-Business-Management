<?php

namespace App\Http\Controllers\Api\V5;

use App\Models\InternalUser;
use App\Models\ProjectProcedure;
use App\Models\ProjectProcedureRaci;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepWorklog;
use App\Models\ProjectProcedureTemplate;
use App\Models\ProjectProcedureTemplateStep;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit
    ) {
        parent::__construct($support, $accessAudit);
    }

    // ────────────────────────────────────────────────────────
    //  TEMPLATES
    // ────────────────────────────────────────────────────────

    public function templates(): JsonResponse
    {
        $templates = ProjectProcedureTemplate::orderBy('template_code')
            ->get();

        return response()->json(['data' => $templates]);
    }

    public function templateSteps(int $templateId): JsonResponse
    {
        $template = ProjectProcedureTemplate::find($templateId);

        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $steps = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $steps]);
    }

    /**
     * POST /api/v5/project-procedure-templates
     * Tạo template mới.
     */
    public function storeTemplate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'template_code' => 'required|string|max:50|unique:project_procedure_templates,template_code',
            'template_name' => 'required|string|max:200',
            'description'   => 'nullable|string|max:500',
            'is_active'     => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $template = ProjectProcedureTemplate::create([
            'template_code' => strtoupper(trim($request->input('template_code'))),
            'template_name' => trim($request->input('template_name')),
            'description'   => $request->input('description') ? trim($request->input('description')) : null,
            'is_active'     => $request->boolean('is_active', true),
            'created_by'    => $request->user()?->id,
            'updated_by'    => $request->user()?->id,
        ]);

        return response()->json(['data' => $template], 201);
    }

    /**
     * PUT /api/v5/project-procedure-templates/{id}
     * Cập nhật template.
     */
    public function updateTemplate(Request $request, int $id): JsonResponse
    {
        $template = ProjectProcedureTemplate::find($id);
        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'template_code' => 'sometimes|string|max:50|unique:project_procedure_templates,template_code,' . $id,
            'template_name' => 'sometimes|string|max:200',
            'description'   => 'nullable|string|max:500',
            'is_active'     => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $fillable = [];
        if ($request->has('template_code')) {
            $fillable['template_code'] = strtoupper(trim($request->input('template_code')));
        }
        if ($request->has('template_name')) {
            $fillable['template_name'] = trim($request->input('template_name'));
        }
        if ($request->has('description')) {
            $fillable['description'] = $request->input('description') ? trim($request->input('description')) : null;
        }
        if ($request->has('is_active')) {
            $fillable['is_active'] = $request->boolean('is_active');
        }
        $fillable['updated_by'] = $request->user()?->id;

        $template->update($fillable);

        return response()->json(['data' => $template->fresh()]);
    }

    /**
     * POST /api/v5/project-procedure-templates/{templateId}/steps
     * Tạo step mới cho template.
     */
    public function storeTemplateStep(Request $request, int $templateId): JsonResponse
    {
        $template = ProjectProcedureTemplate::find($templateId);
        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_number'          => 'required|integer|min:1',
            'parent_step_id'       => 'nullable|integer|exists:project_procedure_template_steps,id',
            'phase'                => 'nullable|string|max:100',
            'step_name'            => 'required|string|max:500',
            'step_detail'          => 'nullable|string|max:1000',
            'lead_unit'            => 'nullable|string|max:200',
            'support_unit'         => 'nullable|string|max:200',
            'expected_result'      => 'nullable|string|max:500',
            'default_duration_days' => 'nullable|integer|min:0',
            'sort_order'           => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        // Tính sort_order tự động nếu không truyền
        $sortOrder = $request->input('sort_order');
        if ($sortOrder === null) {
            $maxSort = ProjectProcedureTemplateStep::where('template_id', $templateId)
                ->max('sort_order') ?? 0;
            $sortOrder = $maxSort + 10;
        }

        $step = ProjectProcedureTemplateStep::create([
            'template_id'          => $templateId,
            'step_number'          => (int) $request->input('step_number'),
            'parent_step_id'       => $request->input('parent_step_id'),
            'phase'                => $request->input('phase') ? trim($request->input('phase')) : null,
            'step_name'            => trim($request->input('step_name')),
            'step_detail'          => $request->input('step_detail') ? trim($request->input('step_detail')) : null,
            'lead_unit'            => $request->input('lead_unit') ? trim($request->input('lead_unit')) : null,
            'support_unit'         => $request->input('support_unit') ? trim($request->input('support_unit')) : null,
            'expected_result'      => $request->input('expected_result') ? trim($request->input('expected_result')) : null,
            'default_duration_days' => $request->input('default_duration_days'),
            'sort_order'           => (int) $sortOrder,
        ]);

        return response()->json(['data' => $step], 201);
    }

    /**
     * PUT /api/v5/project-procedure-templates/{templateId}/steps/{stepId}
     * Cập nhật một step.
     */
    public function updateTemplateStep(Request $request, int $templateId, int $stepId): JsonResponse
    {
        $step = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('id', $stepId)
            ->first();

        if (! $step) {
            return response()->json(['message' => 'Template step not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_number'          => 'sometimes|integer|min:1',
            'parent_step_id'       => 'nullable|integer',
            'phase'                => 'nullable|string|max:100',
            'step_name'            => 'sometimes|string|max:500',
            'step_detail'          => 'nullable|string|max:1000',
            'lead_unit'            => 'nullable|string|max:200',
            'support_unit'         => 'nullable|string|max:200',
            'expected_result'      => 'nullable|string|max:500',
            'default_duration_days' => 'nullable|integer|min:0',
            'sort_order'           => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $fillable = [];
        foreach (['step_number', 'parent_step_id', 'phase', 'step_name', 'step_detail',
            'lead_unit', 'support_unit', 'expected_result', 'default_duration_days', 'sort_order'] as $field) {
            if ($request->has($field)) {
                $value = $request->input($field);
                $fillable[$field] = is_string($value) && in_array($field, ['phase', 'step_name', 'step_detail', 'lead_unit', 'support_unit', 'expected_result'])
                    ? trim($value) ?: null
                    : $value;
            }
        }

        if (! empty($fillable)) {
            $step->update($fillable);
        }

        return response()->json(['data' => $step->fresh()]);
    }

    /**
     * DELETE /api/v5/project-procedure-templates/{templateId}/steps/{stepId}
     * Xoá step (và các children nếu có).
     */
    public function deleteTemplateStep(int $templateId, int $stepId): JsonResponse
    {
        $step = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('id', $stepId)
            ->first();

        if (! $step) {
            return response()->json(['message' => 'Template step not found.'], 404);
        }

        // Xoá children trước
        ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('parent_step_id', $stepId)
            ->delete();

        $step->delete();

        return response()->json(['message' => 'Deleted.'], 200);
    }

    // ────────────────────────────────────────────────────────
    //  PROCEDURES
    // ────────────────────────────────────────────────────────

    public function projectProcedures(int $projectId): JsonResponse
    {
        $procedures = ProjectProcedure::where('project_id', $projectId)
            ->with(['steps' => fn ($q) => $q->orderBy('sort_order')])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $procedures]);
    }

    public function createProcedure(Request $request, int $projectId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'template_id' => 'required|integer|exists:project_procedure_templates,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $template = ProjectProcedureTemplate::findOrFail($request->input('template_id'));

        $procedure = DB::transaction(function () use ($template, $projectId, $request) {
            $procedure = ProjectProcedure::create([
                'project_id'       => $projectId,
                'template_id'      => $template->id,
                'procedure_name'   => $template->template_name,
                'overall_progress' => 0,
                'created_by'       => $request->user()?->id,
                'updated_by'       => $request->user()?->id,
            ]);

            $templateSteps = ProjectProcedureTemplateStep::where('template_id', $template->id)
                ->orderBy('sort_order')
                ->get();

            $templateStepIdToNewStepId = [];

            foreach ($templateSteps as $templateStep) {
                $newParentStepId = null;
                if ($templateStep->parent_step_id !== null) {
                    $newParentStepId = $templateStepIdToNewStepId[$templateStep->parent_step_id] ?? null;
                }

                $newStep = ProjectProcedureStep::create([
                    'procedure_id'     => $procedure->id,
                    'template_step_id' => $templateStep->id,
                    'step_number'      => $templateStep->step_number,
                    'parent_step_id'   => $newParentStepId,
                    'phase'            => $templateStep->phase,
                    'step_name'        => $templateStep->step_name,
                    'step_detail'      => $templateStep->step_detail,
                    'lead_unit'        => $templateStep->lead_unit,
                    'support_unit'     => $templateStep->support_unit,
                    'expected_result'  => $templateStep->expected_result,
                    'duration_days'    => $templateStep->default_duration_days,
                    'progress_status'  => 'CHUA_THUC_HIEN',
                    'sort_order'       => $templateStep->sort_order,
                ]);

                $templateStepIdToNewStepId[$templateStep->id] = $newStep->id;
            }

            return $procedure;
        });

        $procedure->load(['steps' => fn ($q) => $q->orderBy('sort_order')]);

        return response()->json(['data' => $procedure], 201);
    }

    /**
     * POST /api/v5/project-procedures/{procedureId}/resync
     * Xoá toàn bộ steps cũ và tạo lại từ template hiện tại.
     */
    public function resyncProcedure(Request $request, int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);
        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        // Lookup project → investment_mode → tìm đúng template
        $project = \App\Models\Project::find($procedure->project_id);
        $template = null;

        if ($project && $project->investment_mode) {
            $template = ProjectProcedureTemplate::where('template_code', $project->investment_mode)
                ->where('is_active', true)
                ->first();
        }

        // Fallback về template_id hiện tại nếu không tìm được theo investment_mode
        if (! $template) {
            $template = ProjectProcedureTemplate::find($procedure->template_id);
        }

        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $result = DB::transaction(function () use ($procedure, $template, $request) {
            // Xoá worklogs liên quan (cột step_id)
            $stepIds = ProjectProcedureStep::where('procedure_id', $procedure->id)->pluck('id');
            if ($stepIds->isNotEmpty()) {
                ProjectProcedureStepWorklog::whereIn('step_id', $stepIds)->delete();
            }

            // Xoá RACI theo procedure_id
            ProjectProcedureRaci::where('procedure_id', $procedure->id)->delete();

            // Xoá steps cũ
            ProjectProcedureStep::where('procedure_id', $procedure->id)->delete();

            // Tạo lại steps từ template
            $templateSteps = ProjectProcedureTemplateStep::where('template_id', $template->id)
                ->orderBy('sort_order')
                ->get();

            $templateStepIdToNewStepId = [];

            foreach ($templateSteps as $templateStep) {
                $newParentStepId = null;
                if ($templateStep->parent_step_id !== null) {
                    $newParentStepId = $templateStepIdToNewStepId[$templateStep->parent_step_id] ?? null;
                }

                $newStep = ProjectProcedureStep::create([
                    'procedure_id'     => $procedure->id,
                    'template_step_id' => $templateStep->id,
                    'step_number'      => $templateStep->step_number,
                    'parent_step_id'   => $newParentStepId,
                    'phase'            => $templateStep->phase,
                    'step_name'        => $templateStep->step_name,
                    'step_detail'      => $templateStep->step_detail,
                    'lead_unit'        => $templateStep->lead_unit,
                    'support_unit'     => $templateStep->support_unit,
                    'expected_result'  => $templateStep->expected_result,
                    'duration_days'    => $templateStep->default_duration_days,
                    'progress_status'  => 'CHUA_THUC_HIEN',
                    'sort_order'       => $templateStep->sort_order,
                ]);

                $templateStepIdToNewStepId[$templateStep->id] = $newStep->id;
            }

            // Reset overall progress + cập nhật template_id đúng
            $procedure->update([
                'overall_progress' => 0,
                'template_id'      => $template->id,
                'updated_by'       => $request->user()?->id,
            ]);

            return $procedure->fresh(['steps' => fn ($q) => $q->orderBy('sort_order')]);
        });

        return response()->json(['data' => $result]);
    }

    // ────────────────────────────────────────────────────────
    //  STEPS
    // ────────────────────────────────────────────────────────

    public function procedureSteps(int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        $steps = ProjectProcedureStep::where('procedure_id', $procedureId)
            ->withCount('worklogs')
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $steps]);
    }

    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);

        if (! $step) {
            return response()->json(['message' => 'Step not found.'], 404);
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

        // Không cho đổi tên bước khi đã có worklog
        if ($request->has('step_name') && $step->worklogs()->exists()) {
            return response()->json(['message' => 'Không thể đổi tên bước đã có worklog.'], 409);
        }

        $userId = $request->user()?->id;
        $oldStatus = $step->progress_status;

        $step->update(array_merge(
            $request->only(['step_name', 'lead_unit', 'expected_result', 'duration_days', 'progress_status', 'document_number', 'document_date', 'actual_start_date', 'actual_end_date']),
            ['updated_by' => $userId]
        ));

        // Auto worklog if status changed
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
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $stepsData    = $request->input('steps');
        $updatedCount = 0;
        $procedureIds = [];
        $userId       = $request->user()?->id;

        $statusLabels = [
            'CHUA_THUC_HIEN' => 'Chưa thực hiện',
            'DANG_THUC_HIEN' => 'Đang thực hiện',
            'HOAN_THANH'     => 'Hoàn thành',
        ];

        DB::transaction(function () use ($stepsData, $userId, $statusLabels, &$updatedCount, &$procedureIds) {
            foreach ($stepsData as $stepData) {
                $step = ProjectProcedureStep::find($stepData['id']);
                if (! $step) {
                    continue;
                }

                $updateFields = array_filter([
                    'progress_status' => $stepData['progress_status'] ?? null,
                    'document_number' => array_key_exists('document_number', $stepData) ? $stepData['document_number'] : null,
                    'document_date'   => array_key_exists('document_date', $stepData) ? $stepData['document_date'] : null,
                ], fn ($v, $k) => array_key_exists($k, $stepData), ARRAY_FILTER_USE_BOTH);

                if (! empty($updateFields)) {
                    $oldStatus = $step->progress_status;

                    $updateFields['updated_by'] = $userId;
                    $step->update($updateFields);
                    $updatedCount++;

                    // Auto worklog for status changes
                    if (
                        isset($stepData['progress_status'])
                        && $stepData['progress_status'] !== $oldStatus
                    ) {
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

                    // Auto worklog for document added
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

        $overallProgress = [];
        foreach (array_keys($procedureIds) as $procedureId) {
            $proc = ProjectProcedure::find($procedureId);
            if ($proc) {
                $overallProgress[$procedureId] = $proc->overall_progress;
            }
        }

        return response()->json([
            'data' => [
                'updated_count'    => $updatedCount,
                'overall_progress' => $overallProgress,
            ],
        ]);
    }

    public function addCustomStep(Request $request, int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_name'     => 'required|string|max:500',
            'phase'         => 'sometimes|nullable|string|max:255',
            'lead_unit'     => 'sometimes|nullable|string|max:255',
            'duration_days' => 'sometimes|nullable|integer|min:0',
            'sort_order'    => 'sometimes|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $sortOrder = $request->input('sort_order');
        if ($sortOrder === null) {
            $maxSort   = ProjectProcedureStep::where('procedure_id', $procedureId)->max('sort_order');
            $sortOrder = ($maxSort ?? 0) + 1;
        }

        $maxStepNum = ProjectProcedureStep::where('procedure_id', $procedureId)->max('step_number');

        $step = ProjectProcedureStep::create([
            'procedure_id'    => $procedureId,
            'template_step_id'=> null,
            'step_number'     => ($maxStepNum ?? 0) + 1,
            'phase'           => $request->input('phase'),
            'step_name'       => $request->input('step_name'),
            'lead_unit'       => $request->input('lead_unit'),
            'duration_days'   => $request->input('duration_days', 0),
            'progress_status' => 'CHUA_THUC_HIEN',
            'sort_order'      => $sortOrder,
        ]);

        // Worklog
        ProjectProcedureStepWorklog::create([
            'step_id'      => $step->id,
            'procedure_id' => $procedureId,
            'log_type'     => 'CUSTOM',
            'content'      => 'Bước tùy chỉnh được thêm: ' . $step->step_name,
            'created_by'   => $request->user()?->id,
        ]);

        $procedure->recalculateProgress();

        return response()->json(['data' => $step], 201);
    }

    public function deleteStep(int $stepId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);

        if (! $step) {
            return response()->json(['message' => 'Step not found.'], 404);
        }

        if ($step->template_step_id !== null) {
            return response()->json(['message' => 'Cannot delete a template-based step.'], 403);
        }

        if ($step->worklogs()->exists()) {
            return response()->json(['message' => 'Không thể xóa bước đã có worklog.'], 409);
        }

        $procedure = $step->procedure;
        $step->delete();
        $procedure->recalculateProgress();

        return response()->json(['message' => 'Step deleted successfully.']);
    }

    // ────────────────────────────────────────────────────────
    //  PHASE LABEL
    // ────────────────────────────────────────────────────────

    /**
     * PUT /project-procedures/{procedureId}/phase-label
     * Body: { phase: string, phase_label: string }
     * Batch-update phase_label cho tất cả steps cùng procedure_id + phase.
     */
    public function updatePhaseLabel(Request $request, int $procedureId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phase'       => 'required|string|max:100',
            'phase_label' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $updated = ProjectProcedureStep::where('procedure_id', $procedureId)
            ->where('phase', $request->input('phase'))
            ->update(['phase_label' => trim($request->input('phase_label'))]);

        return response()->json([
            'message'     => 'Phase label updated.',
            'rows_updated' => $updated,
            'phase'       => $request->input('phase'),
            'phase_label' => trim($request->input('phase_label')),
        ]);
    }

    // ────────────────────────────────────────────────────────
    //  WORKLOG
    // ────────────────────────────────────────────────────────

    /**
     * GET /project-procedure-steps/{stepId}/worklogs
     */
    public function stepWorklogs(int $stepId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);

        if (! $step) {
            return response()->json(['message' => 'Step not found.'], 404);
        }

        $logs = ProjectProcedureStepWorklog::where('step_id', $stepId)
            ->with(['creator:id,full_name,user_code'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    /**
     * POST /project-procedure-steps/{stepId}/worklogs
     */
    public function addWorklog(Request $request, int $stepId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);

        if (! $step) {
            return response()->json(['message' => 'Step not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'content' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $log = ProjectProcedureStepWorklog::create([
            'step_id'      => $step->id,
            'procedure_id' => $step->procedure_id,
            'log_type'     => 'NOTE',
            'content'      => $request->input('content'),
            'created_by'   => $request->user()?->id,
        ]);

        $log->load('creator:id,full_name,user_code');

        return response()->json(['data' => $log], 201);
    }

    /**
     * GET /project-procedures/{procedureId}/worklogs
     * Full worklog feed for the whole procedure
     */
    public function procedureWorklogs(int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        $logs = ProjectProcedureStepWorklog::where('procedure_id', $procedureId)
            ->with([
                'creator:id,full_name,user_code',
                'step:id,step_name,step_number',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json(['data' => $logs]);
    }

    // ────────────────────────────────────────────────────────
    //  RACI
    // ────────────────────────────────────────────────────────

    /**
     * GET /project-procedures/{procedureId}/raci
     */
    public function getRaci(int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        $raci = ProjectProcedureRaci::where('procedure_id', $procedureId)
            ->with(['user:id,full_name,user_code,username'])
            ->orderBy('raci_role')
            ->get()
            ->map(function ($row) {
                return [
                    'id'          => $row->id,
                    'procedure_id'=> $row->procedure_id,
                    'user_id'     => $row->user_id,
                    'raci_role'   => $row->raci_role,
                    'note'        => $row->note,
                    'full_name'   => $row->user?->full_name,
                    'user_code'   => $row->user?->user_code,
                    'username'    => $row->user?->username,
                    'created_at'  => $row->created_at,
                ];
            });

        return response()->json(['data' => $raci]);
    }

    /**
     * POST /project-procedures/{procedureId}/raci
     */
    public function addRaci(Request $request, int $procedureId): JsonResponse
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return response()->json(['message' => 'Procedure not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'user_id'   => 'required|integer|exists:internal_users,id',
            'raci_role' => 'required|string|in:R,A,C,I',
            'note'      => 'sometimes|nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        // Upsert: one user can only have one role per procedure
        $row = ProjectProcedureRaci::updateOrCreate(
            [
                'procedure_id' => $procedureId,
                'user_id'      => $request->input('user_id'),
                'raci_role'    => $request->input('raci_role'),
            ],
            [
                'note'       => $request->input('note'),
                'created_by' => $request->user()?->id,
            ]
        );

        $row->load('user:id,full_name,user_code,username');

        return response()->json([
            'data' => [
                'id'           => $row->id,
                'procedure_id' => $row->procedure_id,
                'user_id'      => $row->user_id,
                'raci_role'    => $row->raci_role,
                'note'         => $row->note,
                'full_name'    => $row->user?->full_name,
                'user_code'    => $row->user?->user_code,
                'username'     => $row->user?->username,
            ],
        ], 201);
    }

    /**
     * DELETE /project-procedure-raci/{raciId}
     */
    public function removeRaci(int $raciId): JsonResponse
    {
        $row = ProjectProcedureRaci::find($raciId);

        if (! $row) {
            return response()->json(['message' => 'RACI entry not found.'], 404);
        }

        $row->delete();

        return response()->json(['message' => 'RACI entry removed.']);
    }
}
