<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedureTemplate;
use App\Models\ProjectProcedureTemplateStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureTemplateService
{
    public function templates(): JsonResponse
    {
        $templates = ProjectProcedureTemplate::orderBy('template_code')->get();

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

    public function storeTemplateStep(Request $request, int $templateId): JsonResponse
    {
        $template = ProjectProcedureTemplate::find($templateId);
        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_number'           => 'required|integer|min:1',
            'parent_step_id'        => 'nullable|integer|exists:project_procedure_template_steps,id',
            'phase'                 => 'nullable|string|max:100',
            'step_name'             => 'required|string|max:500',
            'step_detail'           => 'nullable|string|max:1000',
            'lead_unit'             => 'nullable|string|max:200',
            'support_unit'          => 'nullable|string|max:200',
            'expected_result'       => 'nullable|string|max:500',
            'default_duration_days' => 'nullable|integer|min:0',
            'sort_order'            => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $sortOrder = $request->input('sort_order');
        if ($sortOrder === null) {
            $maxSort = ProjectProcedureTemplateStep::where('template_id', $templateId)
                ->max('sort_order') ?? 0;
            $sortOrder = $maxSort + 10;
        }

        $step = ProjectProcedureTemplateStep::create([
            'template_id'           => $templateId,
            'step_number'           => (int) $request->input('step_number'),
            'parent_step_id'        => $request->input('parent_step_id'),
            'phase'                 => $request->input('phase') ? trim($request->input('phase')) : null,
            'step_name'             => trim($request->input('step_name')),
            'step_detail'           => $request->input('step_detail') ? trim($request->input('step_detail')) : null,
            'lead_unit'             => $request->input('lead_unit') ? trim($request->input('lead_unit')) : null,
            'support_unit'          => $request->input('support_unit') ? trim($request->input('support_unit')) : null,
            'expected_result'       => $request->input('expected_result') ? trim($request->input('expected_result')) : null,
            'default_duration_days' => $request->input('default_duration_days'),
            'sort_order'            => (int) $sortOrder,
        ]);

        return response()->json(['data' => $step], 201);
    }

    public function updateTemplateStep(Request $request, int $templateId, int $stepId): JsonResponse
    {
        $step = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('id', $stepId)
            ->first();

        if (! $step) {
            return response()->json(['message' => 'Template step not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_number'           => 'sometimes|integer|min:1',
            'parent_step_id'        => 'nullable|integer',
            'phase'                 => 'nullable|string|max:100',
            'step_name'             => 'sometimes|string|max:500',
            'step_detail'           => 'nullable|string|max:1000',
            'lead_unit'             => 'nullable|string|max:200',
            'support_unit'          => 'nullable|string|max:200',
            'expected_result'       => 'nullable|string|max:500',
            'default_duration_days' => 'nullable|integer|min:0',
            'sort_order'            => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $fillable = [];
        foreach ([
            'step_number',
            'parent_step_id',
            'phase',
            'step_name',
            'step_detail',
            'lead_unit',
            'support_unit',
            'expected_result',
            'default_duration_days',
            'sort_order',
        ] as $field) {
            if ($request->has($field)) {
                $value = $request->input($field);
                $fillable[$field] = is_string($value) && in_array($field, ['phase', 'step_name', 'step_detail', 'lead_unit', 'support_unit', 'expected_result'], true)
                    ? trim($value) ?: null
                    : $value;
            }
        }

        if ($fillable !== []) {
            $step->update($fillable);
        }

        return response()->json(['data' => $step->fresh()]);
    }

    public function deleteTemplateStep(int $templateId, int $stepId): JsonResponse
    {
        $step = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('id', $stepId)
            ->first();

        if (! $step) {
            return response()->json(['message' => 'Template step not found.'], 404);
        }

        ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->where('parent_step_id', $stepId)
            ->delete();

        $step->delete();

        return response()->json(['message' => 'Deleted.'], 200);
    }
}
