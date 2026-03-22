<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\Project;
use App\Models\ProjectProcedure;
use App\Models\ProjectProcedureRaci;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepRaci;
use App\Models\ProjectProcedureStepWorklog;
use App\Models\ProjectProcedureTemplate;
use App\Models\ProjectProcedureTemplateStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureLifecycleService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access
    ) {}

    public function projectProcedures(int $projectId, Request $request): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProject($projectId, $request);
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
        [, $err] = $this->access->resolveAccessibleProject($projectId, $request);
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

        $existing = ProjectProcedure::where('project_id', $projectId)
            ->where('template_id', $template->id)
            ->first();

        if ($existing) {
            $existing->load(['steps' => fn ($q) => $q->orderBy('sort_order')]);
            return response()->json(['data' => $existing], 200);
        }

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

    public function resyncProcedure(Request $request, int $procedureId): JsonResponse
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $project = Project::find($procedure->project_id);
        $template = null;

        if ($project && $project->investment_mode) {
            $template = ProjectProcedureTemplate::where('template_code', $project->investment_mode)
                ->where('is_active', true)
                ->first();
        }

        if (! $template) {
            $template = ProjectProcedureTemplate::find($procedure->template_id);
        }

        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $result = DB::transaction(function () use ($procedure, $template, $request) {
            $stepIds = ProjectProcedureStep::where('procedure_id', $procedure->id)->pluck('id');
            if ($stepIds->isNotEmpty()) {
                ProjectProcedureStepWorklog::whereIn('step_id', $stepIds)->delete();
                ProjectProcedureStepRaci::whereIn('step_id', $stepIds)->delete();
            }

            ProjectProcedureRaci::where('procedure_id', $procedure->id)->delete();
            ProjectProcedureStep::where('procedure_id', $procedure->id)->delete();

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

            $procedure->update([
                'overall_progress' => 0,
                'template_id'      => $template->id,
                'updated_by'       => $request->user()?->id,
            ]);

            return $procedure->fresh(['steps' => fn ($q) => $q->orderBy('sort_order')]);
        });

        return response()->json(['data' => $result]);
    }

    public function updatePhaseLabel(Request $request, int $procedureId): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
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
            'message'      => 'Phase label updated.',
            'rows_updated' => $updated,
            'phase'        => $request->input('phase'),
            'phase_label'  => trim($request->input('phase_label')),
        ]);
    }
}
