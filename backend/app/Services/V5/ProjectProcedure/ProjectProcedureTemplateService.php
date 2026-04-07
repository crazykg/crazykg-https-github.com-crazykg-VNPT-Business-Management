<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureTemplate;
use App\Models\ProjectProcedureTemplateStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureTemplateService
{
    public function templates(): JsonResponse
    {
        $templates = ProjectProcedureTemplate::withCount(['steps', 'procedures'])
            ->orderBy('template_code')
            ->get();

        $templates->each(fn (ProjectProcedureTemplate $template) => $this->decorateTemplate($template));

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

        return response()->json(['data' => $this->decorateTemplate($template->fresh())], 201);
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

        return response()->json(['data' => $this->decorateTemplate($template->fresh())]);
    }

    public function deleteTemplate(int $id): JsonResponse
    {
        $template = ProjectProcedureTemplate::withCount(['steps', 'procedures'])->find($id);

        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $stepsCount = (int) ($template->steps_count ?? 0);
        $proceduresCount = (int) ($template->procedures_count ?? 0);

        if ($stepsCount > 0 || $proceduresCount > 0) {
            return response()->json([
                'message' => 'Chỉ có thể xóa mẫu khi chưa có bước cấu hình và chưa được áp dụng cho dự án.',
            ], 409);
        }

        $template->delete();

        return response()->json(['message' => 'Deleted.'], 200);
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

        $usedCount = ProjectProcedureStep::where('template_step_id', $step->id)->count();
        if ($usedCount > 0) {
            return response()->json([
                'message' => "Bước này đã được áp dụng cho {$usedCount} dự án và không thể xóa.",
            ], 409);
        }

        $this->deleteTemplateStepTree($templateId, [$step->id]);

        return response()->json(['message' => 'Deleted.'], 200);
    }

    public function deleteTemplateSteps(Request $request, int $templateId): JsonResponse
    {
        $template = ProjectProcedureTemplate::find($templateId);

        if (! $template) {
            return response()->json(['message' => 'Template not found.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'step_ids' => 'required|array|min:1',
            'step_ids.*' => 'integer|distinct',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $requestedStepIds = collect($request->input('step_ids', []))
            ->map(static fn ($stepId) => (int) $stepId)
            ->filter(static fn (int $stepId) => $stepId > 0)
            ->values();

        $steps = ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->whereIn('id', $requestedStepIds)
            ->get(['id', 'parent_step_id']);

        if ($steps->count() !== $requestedStepIds->count()) {
            return response()->json(['message' => 'One or more template steps not found.'], 404);
        }

        $selectedStepIds = array_fill_keys($requestedStepIds->all(), true);
        $rootStepIds = $steps
            ->filter(static fn (ProjectProcedureTemplateStep $step) => ! $step->parent_step_id || ! isset($selectedStepIds[(int) $step->parent_step_id]))
            ->pluck('id')
            ->map(static fn ($stepId) => (int) $stepId)
            ->values()
            ->all();

        // Guard: collect all step IDs in tree and check if any are referenced
        $allTreeIds = $this->collectTreeIds($templateId, $rootStepIds);
        $usedCount = ProjectProcedureStep::whereIn('template_step_id', $allTreeIds)->count();
        if ($usedCount > 0) {
            return response()->json([
                'message' => "Một số bước đã được áp dụng cho {$usedCount} dự án và không thể xóa.",
            ], 409);
        }

        $deletedStepIds = $this->deleteTemplateStepTree($templateId, $rootStepIds);

        return response()->json([
            'message' => 'Deleted.',
            'data' => [
                'deleted_count' => count($deletedStepIds),
            ],
        ], 200);
    }

    /**
     * @param  array<int, int|string>  $rootStepIds
     * @return array<int, int>
     */
    private function deleteTemplateStepTree(int $templateId, array $rootStepIds): array
    {
        $currentLevel = collect($rootStepIds)
            ->map(static fn ($stepId) => (int) $stepId)
            ->filter(static fn (int $stepId) => $stepId > 0)
            ->unique()
            ->values()
            ->all();

        if ($currentLevel === []) {
            return [];
        }

        $levels = [];

        while ($currentLevel !== []) {
            $levels[] = $currentLevel;
            $currentLevel = ProjectProcedureTemplateStep::where('template_id', $templateId)
                ->whereIn('parent_step_id', $currentLevel)
                ->pluck('id')
                ->map(static fn ($stepId) => (int) $stepId)
                ->unique()
                ->values()
                ->all();
        }

        $allStepIds = collect($levels)->flatten()->map(static fn ($id) => (int) $id)->unique()->values()->all();

        DB::transaction(function () use ($templateId, $levels): void {
            for ($index = count($levels) - 1; $index >= 0; $index--) {
                ProjectProcedureTemplateStep::where('template_id', $templateId)
                    ->whereIn('id', $levels[$index])
                    ->delete();
            }
        });

        return collect($levels)
            ->flatten()
            ->map(static fn ($stepId) => (int) $stepId)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Collect all step IDs in the tree rooted at $rootStepIds (used for reference check).
     *
     * @param  array<int, int>  $rootStepIds
     * @return array<int, int>
     */
    private function collectTreeIds(int $templateId, array $rootStepIds): array
    {
        $currentLevel = collect($rootStepIds)
            ->map(static fn ($id) => (int) $id)
            ->filter(static fn (int $id) => $id > 0)
            ->unique()->values()->all();

        $all = $currentLevel;

        while ($currentLevel !== []) {
            $currentLevel = ProjectProcedureTemplateStep::where('template_id', $templateId)
                ->whereIn('parent_step_id', $currentLevel)
                ->pluck('id')
                ->map(static fn ($id) => (int) $id)
                ->unique()->values()->all();
            $all = array_merge($all, $currentLevel);
        }

        return array_values(array_unique($all));
    }

    private function decorateTemplate(ProjectProcedureTemplate $template): ProjectProcedureTemplate
    {
        if (! array_key_exists('steps_count', $template->getAttributes())) {
            $template->loadCount(['steps', 'procedures']);
        }

        $template->setAttribute('phases', $this->resolveTemplatePhases($template->id));
        $template->setAttribute(
            'can_delete',
            ((int) ($template->steps_count ?? 0)) === 0 && ((int) ($template->procedures_count ?? 0)) === 0
        );

        return $template;
    }

    /**
     * @return array<int, string>
     */
    private function resolveTemplatePhases(int $templateId): array
    {
        return ProjectProcedureTemplateStep::where('template_id', $templateId)
            ->whereNotNull('phase')
            ->orderBy('sort_order')
            ->pluck('phase')
            ->unique()
            ->values()
            ->toArray();
    }
}
