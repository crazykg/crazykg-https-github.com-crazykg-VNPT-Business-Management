<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\Project;
use App\Models\ProjectProcedure;
use App\Models\ProjectProcedureRaci;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepRaci;
use App\Models\ProjectProcedureStepWorklog;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectProcedureAccessService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess,
    ) {}

    /**
     * @return array{0: Project|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleProject(int $projectId, Request $request): array
    {
        $project = Project::find($projectId);

        if (! $project) {
            return [null, response()->json(['message' => 'Project not found.'], 404)];
        }

        $user = $request->user();
        if (! $user) {
            return [null, response()->json(['message' => 'Unauthenticated.'], 401)];
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('admin')) {
            return [$project, null];
        }

        $projectDeptId = $this->support->resolveProjectDepartmentIdById($projectId);
        $allowedDeptIds = $this->userAccess->resolveDepartmentIdsForUser((int) $user->id);

        if (
            $projectDeptId !== null
            && $allowedDeptIds !== null
            && ! $this->isProjectDepartmentCoveredByUserScope($projectDeptId, $allowedDeptIds)
        ) {
            $isMember = collect($this->support->fetchProjectRaciAssignmentsByProjectIds([$projectId]))
                ->contains(fn (array $assignment): bool => (int) ($assignment['user_id'] ?? 0) === (int) $user->id);

            if (! $isMember) {
                return [null, response()->json(['message' => 'Access denied. You do not belong to this project.'], 403)];
            }
        }

        return [$project, null];
    }

    /**
     * @return array{0: ProjectProcedure|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleProcedure(int $procedureId, Request $request): array
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
     * @return array{0: ProjectProcedureStep|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleStep(int $stepId, Request $request): array
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

    /**
     * @return array{0: ProjectProcedureStepWorklog|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleWorklog(int $worklogId, Request $request): array
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
     * @return array{0: ProjectProcedureRaci|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleRaci(int $raciId, Request $request): array
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

    /**
     * @return array{0: ProjectProcedureStepRaci|null, 1: JsonResponse|null}
     */
    public function resolveAccessibleStepRaci(int $raciId, Request $request): array
    {
        $raci = ProjectProcedureStepRaci::find($raciId);

        if (! $raci) {
            return [null, response()->json(['message' => 'Step RACI entry not found.'], 404)];
        }

        [, $err] = $this->resolveAccessibleStep((int) $raci->step_id, $request);
        if ($err !== null) {
            return [null, $err];
        }

        return [$raci, null];
    }

    public function canMutateStep(ProjectProcedureStep $step, ?int $userId): bool
    {
        if ($userId === null) {
            return false;
        }

        if ($this->userAccess->isAdmin($userId)) {
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

    public function resolveInsertSortOrder(
        int $procedureId,
        ?ProjectProcedureStep $parentStep,
        ?string $phase,
        ?int $requestedSortOrder
    ): int {
        if ($requestedSortOrder !== null) {
            return max(0, $requestedSortOrder);
        }

        if ($parentStep !== null) {
            return $this->resolveChildInsertSortOrder($procedureId, $parentStep);
        }

        $normalizedPhase = $this->support->normalizeNullableString($phase);
        if ($normalizedPhase !== null) {
            $phaseMaxSort = ProjectProcedureStep::query()
                ->where('procedure_id', $procedureId)
                ->where('phase', $normalizedPhase)
                ->max('sort_order');

            if ($phaseMaxSort !== null) {
                return ((int) $phaseMaxSort) + 1;
            }
        }

        $maxSort = ProjectProcedureStep::query()
            ->where('procedure_id', $procedureId)
            ->max('sort_order');

        return ((int) ($maxSort ?? 0)) + 1;
    }

    public function computeProcedureStepEndDate(?string $startDate, ?int $durationDays, ?string $explicitEndDate): ?string
    {
        if ($startDate !== null && $durationDays !== null && $durationDays > 0) {
            return Carbon::parse($startDate)->startOfDay()->addDays($durationDays - 1)->toDateString();
        }

        return $explicitEndDate;
    }

    /**
     * @return array{0: string|null, 1: string|null}
     */
    public function resolveStepDateBounds(ProjectProcedureStep $step): array
    {
        $startDate = $this->support->normalizeNullableString($step->getRawOriginal('actual_start_date'));
        $explicitEndDate = $this->support->normalizeNullableString($step->getRawOriginal('actual_end_date'));
        $endDate = $this->computeProcedureStepEndDate(
            $startDate,
            $step->duration_days !== null ? (int) $step->duration_days : 0,
            $explicitEndDate
        );

        return [$startDate, $endDate];
    }

    private function resolveChildInsertSortOrder(int $procedureId, ProjectProcedureStep $parentStep): int
    {
        $orderedSteps = ProjectProcedureStep::query()
            ->where('procedure_id', $procedureId)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'parent_step_id', 'sort_order']);

        $parentIndex = $orderedSteps->search(
            fn (ProjectProcedureStep $step): bool => (int) $step->id === (int) $parentStep->id
        );

        if ($parentIndex === false) {
            return ((int) $parentStep->sort_order) + 1;
        }

        $descendantIds = [(int) $parentStep->id => true];
        $lastSortOrder = (int) $parentStep->sort_order;

        for ($index = $parentIndex + 1; $index < $orderedSteps->count(); $index++) {
            /** @var ProjectProcedureStep $candidate */
            $candidate = $orderedSteps[$index];
            $candidateParentId = $candidate->parent_step_id !== null ? (int) $candidate->parent_step_id : null;

            if ($candidateParentId === null || ! isset($descendantIds[$candidateParentId])) {
                break;
            }

            $descendantIds[(int) $candidate->id] = true;
            $lastSortOrder = (int) $candidate->sort_order;
        }

        return $lastSortOrder + 1;
    }

    /**
     * @param array<int, int> $allowedDeptIds
     */
    private function isProjectDepartmentCoveredByUserScope(int $projectDeptId, array $allowedDeptIds): bool
    {
        $normalizedAllowedDeptIds = array_values(array_unique(array_filter(
            array_map(static fn ($deptId): int => (int) $deptId, $allowedDeptIds),
            static fn (int $deptId): bool => $deptId > 0
        )));

        if ($normalizedAllowedDeptIds === []) {
            return false;
        }

        if (in_array($projectDeptId, $normalizedAllowedDeptIds, true)) {
            return true;
        }

        if (! $this->support->hasTable('departments') || ! $this->support->hasColumn('departments', 'parent_id')) {
            return false;
        }

        foreach ($normalizedAllowedDeptIds as $departmentId) {
            $cursorId = $departmentId;
            $visited = [];

            while ($cursorId > 0) {
                if ($cursorId === $projectDeptId) {
                    return true;
                }

                if (isset($visited[$cursorId])) {
                    break;
                }
                $visited[$cursorId] = true;

                $parentId = $this->support->parseNullableInt(
                    DB::table('departments')
                        ->where('id', $cursorId)
                        ->value('parent_id')
                );

                if ($parentId === null) {
                    break;
                }

                $cursorId = $parentId;
            }
        }

        return false;
    }
}
