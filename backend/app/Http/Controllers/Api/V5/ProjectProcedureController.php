<?php

namespace App\Http\Controllers\Api\V5;

use App\Models\InternalUser;
use App\Models\Project;
use App\Models\ProjectProcedure;
use App\Models\ProjectProcedureRaci;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepWorklog;
use App\Models\ProjectProcedureTemplate;
use App\Models\ProjectProcedureTemplateStep;
use App\Models\SharedIssue;
use App\Models\SharedTimesheet;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
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
    //  OWNERSHIP HELPERS  (Problem 1 fix)
    // ────────────────────────────────────────────────────────

    /**
     * Resolve và kiểm tra quyền truy cập project theo ID.
     * Trả về [Project, null] nếu hợp lệ, hoặc [null, JsonResponse 403/404] nếu không.
     *
     * @return array{0: Project|null, 1: JsonResponse|null}
     */
    private function resolveAccessibleProject(int $projectId, Request $request): array
    {
        $project = Project::find($projectId);

        if (! $project) {
            return [null, response()->json(['message' => 'Project not found.'], 404)];
        }

        $user = $request->user();
        if (! $user) {
            return [null, response()->json(['message' => 'Unauthenticated.'], 401)];
        }

        // Admin / superuser bypass
        if (method_exists($user, 'hasRole') && $user->hasRole('admin')) {
            return [$project, null];
        }

        // Resolve dept_id của project (hỗ trợ cả schema cũ dept_id và mới department_id)
        $projectDeptId = $this->support->resolveProjectDepartmentIdById($projectId);

        // Resolve dept_id của user (hỗ trợ cả schema cũ dept_id và mới department_id)
        $userDeptCols = array_filter(
            ['dept_id', 'department_id'],
            fn (string $col) => $this->support->hasColumn('internal_users', $col)
        );
        $userDeptId = empty($userDeptCols)
            ? null
            : $this->support->extractIntFromRecord(
                (array) DB::table('internal_users')
                    ->select(array_values($userDeptCols))
                    ->where('id', $user->id)
                    ->first(),
                ['dept_id', 'department_id']
            );

        if ($projectDeptId !== null && $userDeptId !== null && $projectDeptId !== $userDeptId) {
            // Kiểm tra thêm: user có phải là PM / member trực tiếp của project không
            $isMember = DB::table('project_raci')
                ->where('project_id', $projectId)
                ->where('user_id', $user->id)
                ->exists();

            if (! $isMember) {
                return [null, response()->json(['message' => 'Access denied. You do not belong to this project.'], 403)];
            }
        }

        return [$project, null];
    }

    /**
     * Resolve Procedure và kiểm tra nó thuộc project mà user có quyền truy cập.
     *
     * @return array{0: ProjectProcedure|null, 1: JsonResponse|null}
     */
    private function resolveAccessibleProcedure(int $procedureId, Request $request): array
    {
        $procedure = ProjectProcedure::find($procedureId);

        if (! $procedure) {
            return [null, response()->json(['message' => 'Procedure not found.'], 404)];
        }

        [, $err] = $this->resolveAccessibleProject($procedure->project_id, $request);
        if ($err !== null) {
            return [null, $err];
        }

        return [$procedure, null];
    }

    /**
     * Resolve Step và kiểm tra nó thuộc procedure → project mà user có quyền.
     *
     * @return array{0: ProjectProcedureStep|null, 1: JsonResponse|null}
     */
    private function resolveAccessibleStep(int $stepId, Request $request): array
    {
        $step = ProjectProcedureStep::find($stepId);

        if (! $step) {
            return [null, response()->json(['message' => 'Step not found.'], 404)];
        }

        [, $err] = $this->resolveAccessibleProcedure($step->procedure_id, $request);
        if ($err !== null) {
            return [null, $err];
        }

        return [$step, null];
    }

    private function canMutateStep(ProjectProcedureStep $step, ?int $userId): bool
    {
        if ($userId === null) {
            return false;
        }

        $isAdmin = app(UserAccessService::class)->isAdmin($userId);
        if ($isAdmin) {
            return true;
        }

        $isRaciA = ProjectProcedureRaci::where('procedure_id', $step->procedure_id)
            ->where('user_id', $userId)
            ->where('raci_role', 'A')
            ->exists();

        if ($isRaciA) {
            return true;
        }

        $isCustom = $step->template_step_id === null;

        return $isCustom
            && $step->created_by !== null
            && (int) $step->created_by === $userId;
    }

    /**
     * Resolve Worklog và kiểm tra ownership qua step → procedure → project.
     *
     * @return array{0: ProjectProcedureStepWorklog|null, 1: JsonResponse|null}
     */
    private function resolveAccessibleWorklog(int $worklogId, Request $request): array
    {
        $worklog = ProjectProcedureStepWorklog::find($worklogId);

        if (! $worklog) {
            return [null, response()->json(['message' => 'Worklog not found.'], 404)];
        }

        [, $err] = $this->resolveAccessibleStep($worklog->step_id, $request);
        if ($err !== null) {
            return [null, $err];
        }

        return [$worklog, null];
    }

    /**
     * Resolve RACI và kiểm tra ownership qua procedure → project.
     *
     * @return array{0: ProjectProcedureRaci|null, 1: JsonResponse|null}
     */
    private function resolveAccessibleRaci(int $raciId, Request $request): array
    {
        $raci = ProjectProcedureRaci::find($raciId);

        if (! $raci) {
            return [null, response()->json(['message' => 'RACI entry not found.'], 404)];
        }

        [, $err] = $this->resolveAccessibleProcedure($raci->procedure_id, $request);
        if ($err !== null) {
            return [null, $err];
        }

        return [$raci, null];
    }

    // ────────────────────────────────────────────────────────
    //  TEMPLATES
    // ────────────────────────────────────────────────────────

    public function templates(): JsonResponse
    {
        $templates = ProjectProcedureTemplate::orderBy('template_code')->get();

        // Bổ sung distinct phase codes từ template steps cho mỗi template
        $templates->each(function ($tpl) {
            $phases = ProjectProcedureTemplateStep::where('template_id', $tpl->id)
                ->whereNotNull('phase')
                ->orderBy('sort_order')
                ->pluck('phase')
                ->unique()
                ->values()
                ->toArray();
            $tpl->setAttribute('phases', $phases);
        });

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

    public function projectProcedures(int $projectId, Request $request): JsonResponse
    {
        [, $err] = $this->resolveAccessibleProject($projectId, $request);
        if ($err !== null) {
            return $err;
        }

        $procedures = ProjectProcedure::where('project_id', $projectId)
            ->with(['steps' => fn ($q) => $q->orderBy('sort_order')])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $procedures]);
    }

    public function createProcedure(Request $request, int $projectId): JsonResponse
    {
        [, $err] = $this->resolveAccessibleProject($projectId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'template_id' => 'required|integer|exists:project_procedure_templates,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $template = ProjectProcedureTemplate::findOrFail($request->input('template_id'));

        // ── Idempotent guard: nếu đã tồn tại thì trả về luôn (HTTP 200) ──
        $existing = ProjectProcedure::where('project_id', $projectId)
            ->where('template_id', $template->id)
            ->first();

        if ($existing) {
            $existing->load(['steps' => fn ($q) => $q->orderBy('sort_order')]);
            return response()->json(['data' => $existing], 200);
        }
        // ─────────────────────────────────────────────────────────────────

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
        [$procedure, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        // Lookup project → investment_mode → tìm đúng template
        $project = Project::find($procedure->project_id);
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

    public function procedureSteps(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $steps = ProjectProcedureStep::where('procedure_id', $procedureId)
            ->withCount('worklogs')
            ->withCount([
                'worklogs as blocking_worklogs_count' => fn ($query) => $query->where('log_type', '!=', 'CUSTOM'),
            ])
            ->orderBy('sort_order')
            ->get();

        return response()->json(['data' => $steps]);
    }

    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->resolveAccessibleStep($stepId, $request);
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
            ->exists();

        // Không cho đổi tên bước khi đã có worklog nghiệp vụ
        if ($request->has('step_name') && $hasBlockingWorklogs) {
            return response()->json(['message' => 'Không thể đổi tên bước đã có worklog.'], 409);
        }

        // Chỉ cho sửa nội dung bước khi chưa có worklog nghiệp vụ.
        // A trong RACI checklist hoặc admin sửa được mọi bước;
        // riêng bước tự thêm thì người tạo cũng sửa được.
        $mutableFields = ['step_name', 'lead_unit', 'expected_result', 'duration_days'];
        $hasMutableChange = collect($mutableFields)->contains(fn ($f) => $request->has($f));
        if ($hasMutableChange) {
            if ($hasBlockingWorklogs) {
                return response()->json([
                    'message' => 'Chỉ có thể sửa bước chưa có worklog nghiệp vụ.',
                ], 409);
            }

            if (! $this->canMutateStep($step, $userId !== null ? (int) $userId : null)) {
                return response()->json([
                    'message' => 'Chỉ admin, người Accountable (A) hoặc người tạo bước tự thêm mới được sửa bước chưa có worklog.',
                ], 403);
            }
        }

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
            'steps.*.actual_start_date' => 'sometimes|nullable|date',
            'steps.*.actual_end_date'   => 'sometimes|nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $stepsData    = $request->input('steps');
        $updatedCount = 0;
        $procedureIds = [];
        $userId       = $request->user()?->id;

        // Load tất cả steps bằng 1 query whereIn
        $stepIds  = array_column($stepsData, 'id');
        $stepsMap = ProjectProcedureStep::whereIn('id', $stepIds)->get()->keyBy('id');

        // ── Ownership guard: kiểm tra toàn bộ step thuộc project user có quyền ──
        $procedureIdSet = $stepsMap->pluck('procedure_id')->unique()->values();
        $projectIdSet   = ProjectProcedure::whereIn('id', $procedureIdSet)->pluck('project_id')->unique()->values();

        foreach ($projectIdSet as $pid) {
            [, $err] = $this->resolveAccessibleProject((int) $pid, $request);
            if ($err !== null) {
                return $err;  // 403 / 404 ngay nếu bất kỳ project nào không hợp lệ
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

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
                    'actual_end_date'   => array_key_exists('actual_end_date', $stepData)   ? $stepData['actual_end_date']   : null,
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

        // Fix 3: load lại progress bằng 1 query whereIn thay vì P lần find()
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
        [$procedure, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'step_name'       => 'required|string|max:500',
            'phase'           => 'sometimes|nullable|string|max:255',
            'lead_unit'       => 'sometimes|nullable|string|max:255',
            'expected_result' => 'sometimes|nullable|string|max:1000',
            'duration_days'   => 'sometimes|nullable|integer|min:0',
            'sort_order'      => 'sometimes|integer|min:0',
            'parent_step_id'  => 'sometimes|nullable|integer|exists:project_procedure_steps,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $parentStepId = $request->integer('parent_step_id');
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
            'parent_step_id'  => $parentStepId,
            'step_name'       => $request->input('step_name'),
            'lead_unit'       => $request->input('lead_unit'),
            'expected_result' => $request->input('expected_result'),
            'duration_days'   => $request->input('duration_days', 0),
            'progress_status' => 'CHUA_THUC_HIEN',
            'sort_order'      => $sortOrder,
            'created_by'      => $request->user()?->id,
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

    public function deleteStep(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        if ($step->template_step_id !== null) {
            return response()->json([
                'message' => 'Không thể xóa bước thuộc mẫu thủ tục.',
            ], 403);
        }

        $hasBlockingWorklogs = $step->worklogs()
            ->where('log_type', '!=', 'CUSTOM')
            ->exists();

        if ($hasBlockingWorklogs) {
            return response()->json(['message' => 'Không thể xóa bước đã có worklog.'], 409);
        }

        $userId = $request->user()?->id;
        if (! $this->canMutateStep($step, $userId !== null ? (int) $userId : null)) {
            return response()->json([
                'message' => 'Chỉ admin, người Accountable (A) hoặc người tạo bước tự thêm mới được xóa bước chưa có worklog.',
            ], 403);
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
        [, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

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
    public function stepWorklogs(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $logs = ProjectProcedureStepWorklog::where('step_id', $stepId)
            ->with(['creator:id,full_name,user_code', 'timesheet', 'issue'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    /**
     * POST /project-procedure-steps/{stepId}/worklogs
     */
    public function addWorklog(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->resolveAccessibleStep($stepId, $request);
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

    /**
     * PATCH /project-procedure-worklogs/{logId}
     * Chỉ cho phép sửa NOTE type — cập nhật content, hours_spent, difficulty, proposal, issue_status
     */
    public function updateWorklog(Request $request, int $logId): JsonResponse
    {
        [$log, $err] = $this->resolveAccessibleWorklog($logId, $request);
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
            // Cập nhật nội dung worklog
            $log->update(['content' => $request->input('content')]);

            // ── SharedTimesheet ──────────────────────────────────────────────
            // hours_spent NOT NULL trong DB → không thể null hoá.
            // Khi bỏ trống: giữ nguyên record cũ (preserve history), không xoá.
            // Khi có giá trị: tạo mới nếu chưa tồn tại, cập nhật nếu đã có.
            if ($request->filled('hours_spent')) {
                $ts = SharedTimesheet::firstOrNew(
                    ['procedure_step_worklog_id' => $log->id]
                );
                $ts->hours_spent          = $request->input('hours_spent');
                $ts->work_date            = $request->input('work_date', now()->toDateString());
                $ts->activity_description = $request->input('activity_description');
                $ts->updated_by           = $userId;
                if (! $ts->exists) {
                    // Chỉ gán created_by lần đầu tạo — không đè khi update
                    $ts->created_by = $userId;
                }
                $ts->save();
            }
            // Bỏ trống hours_spent → không làm gì — giữ nguyên bản ghi cũ

            // ── SharedIssue ──────────────────────────────────────────────────
            // Khi bỏ trống difficulty: soft delete thay vì hard delete
            // → lịch sử vẫn còn trong DB, có thể khôi phục nếu cần.
            if ($request->filled('difficulty')) {
                $issue = SharedIssue::withTrashed()
                    ->where('procedure_step_worklog_id', $log->id)
                    ->first();

                if ($issue) {
                    // Khôi phục nếu đang soft-deleted, rồi cập nhật
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
                    // Tạo mới lần đầu — gán created_by
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
                // Bỏ trống difficulty → soft delete (giữ lịch sử, không hard delete)
                SharedIssue::where('procedure_step_worklog_id', $log->id)
                    ->whereNull('deleted_at')
                    ->update(['updated_by' => $userId]);
                SharedIssue::where('procedure_step_worklog_id', $log->id)->delete();
            }
        });

        $log->load(['creator:id,full_name,user_code', 'timesheet', 'issue']);

        return response()->json(['data' => $log->fresh(['creator', 'timesheet', 'issue'])]);
    }

    /**
     * POST /api/v5/project-procedure-steps/reorder
     * Body: { steps: [{id: int, sort_order: int}, ...] }
     * Bulk-cập nhật sort_order (tối đa 100 bước/lần).
     */
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

        // Ownership: verify all steps belong to accessible project
        $stepIds      = array_column($request->input('steps'), 'id');
        $procedureIds = ProjectProcedureStep::whereIn('id', $stepIds)->pluck('procedure_id')->unique();
        $projectIds   = ProjectProcedure::whereIn('id', $procedureIds)->pluck('project_id')->unique();
        foreach ($projectIds as $pid) {
            [, $err] = $this->resolveAccessibleProject((int) $pid, $request);
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

    /**
     * GET /project-procedures/{procedureId}/worklogs
     * Full worklog feed for the whole procedure
     */
    public function procedureWorklogs(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
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

    // ────────────────────────────────────────────────────────
    //  SHARED ISSUES
    // ────────────────────────────────────────────────────────

    /**
     * PATCH /api/v5/shared-issues/{issueId}/status
     */
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

    // ────────────────────────────────────────────────────────
    //  RACI
    // ────────────────────────────────────────────────────────

    /**
     * GET /project-procedures/{procedureId}/raci
     */
    public function getRaci(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
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
        [, $err] = $this->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'user_id'   => 'required|integer|exists:internal_users,id',
            'raci_role' => 'required|string|in:R,A,C,I',
            'note'      => 'sometimes|nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()?->id;

        // Upsert: one user can only have one role per procedure
        // created_by chỉ gán lúc tạo mới — không đè khi update (audit safety)
        $row = ProjectProcedureRaci::updateOrCreate(
            [
                'procedure_id' => $procedureId,
                'user_id'      => $request->input('user_id'),
                'raci_role'    => $request->input('raci_role'),
            ],
            [
                'note'       => $request->input('note'),
                'updated_by' => $userId,
            ]
        );

        if ($row->wasRecentlyCreated) {
            $row->update(['created_by' => $userId]);
        }

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
    public function removeRaci(int $raciId, Request $request): JsonResponse
    {
        [$row, $err] = $this->resolveAccessibleRaci($raciId, $request);
        if ($err !== null) {
            return $err;
        }

        $row->delete();

        return response()->json(['message' => 'RACI entry removed.']);
    }

    // =========================================================
    // STEP ATTACHMENTS
    // =========================================================

    /**
     * GET /project-procedure-steps/{stepId}/attachments
     */
    public function stepAttachments(int $stepId, Request $request): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);
        if (! $step) {
            return response()->json(['message' => 'Bước không tồn tại.'], 404);
        }

        [$proc, $err] = $this->resolveAccessibleProcedure($step->procedure_id, $request);
        if ($err !== null) {
            return $err;
        }

        $rows = DB::table('attachments')
            ->where('reference_type', 'PROCEDURE_STEP')
            ->where('reference_id', $stepId)
            ->orderByDesc('created_at')
            ->get()
            ->map(function (object $a): array {
                $creatorName = null;
                if (($a->created_by ?? null) !== null) {
                    $u = DB::table('internal_users')->where('id', $a->created_by)->first();
                    $creatorName = $u ? trim(($u->last_name ?? '').' '.($u->first_name ?? '')) : null;
                }

                return [
                    'id'               => $a->id,
                    'fileName'         => $a->file_name,
                    'fileUrl'          => $a->file_url,
                    'fileSize'         => $a->file_size,
                    'mimeType'         => $a->mime_type,
                    'driveFileId'      => $a->drive_file_id ?? null,
                    'storageDisk'      => $a->storage_disk ?? null,
                    'storagePath'      => $a->storage_path ?? null,
                    'storageVisibility'=> $a->storage_visibility ?? null,
                    'createdAt'        => $a->created_at,
                    'createdBy'        => $a->created_by,
                    'createdByName'    => $creatorName,
                ];
            });

        return response()->json(['data' => $rows]);
    }

    /**
     * POST /project-procedure-steps/{stepId}/attachments
     * Body: { fileName, fileUrl, fileSize?, mimeType?, driveFileId?, storageDisk?, storagePath?, storageVisibility? }
     * (file đã upload qua /documents/upload-attachment trước)
     */
    public function linkStepAttachment(Request $request, int $stepId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);
        if (! $step) {
            return response()->json(['message' => 'Bước không tồn tại.'], 404);
        }

        [$proc, $err] = $this->resolveAccessibleProcedure($step->procedure_id, $request);
        if ($err !== null) {
            return $err;
        }

        $validated = Validator::make($request->all(), [
            'fileName'          => ['required', 'string', 'max:500'],
            'fileUrl'           => ['required', 'string', 'max:2048'],
            'fileSize'          => ['nullable', 'integer'],
            'mimeType'          => ['nullable', 'string', 'max:100'],
            'driveFileId'       => ['nullable', 'string', 'max:255'],
            'storageDisk'       => ['nullable', 'string', 'max:50'],
            'storagePath'       => ['nullable', 'string', 'max:1024'],
            'storageVisibility' => ['nullable', 'string', 'max:20'],
        ])->validate();

        $userId = $request->user()?->id;

        $id = DB::table('attachments')->insertGetId([
            'reference_type'    => 'PROCEDURE_STEP',
            'reference_id'      => $stepId,
            'file_name'         => $validated['fileName'],
            'file_url'          => $validated['fileUrl'],
            'file_size'         => $validated['fileSize'] ?? 0,
            'mime_type'         => $validated['mimeType'] ?? null,
            'drive_file_id'     => $validated['driveFileId'] ?? null,
            'storage_disk'      => $validated['storageDisk'] ?? null,
            'storage_path'      => $validated['storagePath'] ?? null,
            'storage_visibility'=> $validated['storageVisibility'] ?? null,
            'is_primary'        => 0,
            'created_by'        => $userId,
            'updated_by'        => $userId,
            'created_at'        => DB::raw('NOW()'),
            'updated_at'        => DB::raw('NOW()'),
        ]);

        return response()->json([
            'data' => [
                'id'          => $id,
                'fileName'    => $validated['fileName'],
                'fileUrl'     => $validated['fileUrl'],
                'fileSize'    => $validated['fileSize'] ?? 0,
                'mimeType'    => $validated['mimeType'] ?? null,
                'createdAt'   => now()->toDateTimeString(),
                'createdBy'   => $userId,
            ],
        ], 201);
    }

    /**
     * DELETE /project-procedure-steps/{stepId}/attachments/{attachmentId}
     */
    public function deleteStepAttachment(Request $request, int $stepId, int $attachmentId): JsonResponse
    {
        $step = ProjectProcedureStep::find($stepId);
        if (! $step) {
            return response()->json(['message' => 'Bước không tồn tại.'], 404);
        }

        [$proc, $err] = $this->resolveAccessibleProcedure($step->procedure_id, $request);
        if ($err !== null) {
            return $err;
        }

        $deleted = DB::table('attachments')
            ->where('id', $attachmentId)
            ->where('reference_type', 'PROCEDURE_STEP')
            ->where('reference_id', $stepId)
            ->delete();

        if (! $deleted) {
            return response()->json(['message' => 'File đính kèm không tồn tại.'], 404);
        }

        return response()->json(['message' => 'File đã xóa.']);
    }
}
