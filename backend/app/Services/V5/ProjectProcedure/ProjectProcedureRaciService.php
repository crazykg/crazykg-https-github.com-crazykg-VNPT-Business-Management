<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedureRaci;
use App\Models\ProjectProcedureStep;
use App\Models\ProjectProcedureStepRaci;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectProcedureRaciService
{
    public function __construct(
        private readonly ProjectProcedureAccessService $access
    ) {}

    public function getRaci(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $raci = ProjectProcedureRaci::where('procedure_id', $procedureId)
            ->with(['user:id,full_name,user_code,username'])
            ->orderBy('raci_role')
            ->get()
            ->map(function ($row) {
                return [
                    'id'           => $row->id,
                    'procedure_id' => $row->procedure_id,
                    'user_id'      => $row->user_id,
                    'raci_role'    => $row->raci_role,
                    'note'         => $row->note,
                    'full_name'    => $row->user?->full_name,
                    'user_code'    => $row->user?->user_code,
                    'username'     => $row->user?->username,
                    'created_at'   => $row->created_at,
                ];
            });

        return response()->json(['data' => $raci]);
    }

    public function addRaci(Request $request, int $procedureId): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
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

        $actorId = $request->user()?->id;
        $targetUserId = (int) $request->input('user_id');
        $role = (string) $request->input('raci_role');
        $row = DB::transaction(function () use ($actorId, $procedureId, $request, $role, $targetUserId): ProjectProcedureRaci {
            $replacedAccountableUserIds = collect();

            if ($role === 'A') {
                $replacedAccountableUserIds = ProjectProcedureRaci::query()
                    ->where('procedure_id', $procedureId)
                    ->where('raci_role', 'A')
                    ->where('user_id', '!=', $targetUserId)
                    ->pluck('user_id')
                    ->map(fn ($id): int => (int) $id)
                    ->unique()
                    ->values();

                if ($replacedAccountableUserIds->isNotEmpty()) {
                    ProjectProcedureRaci::query()
                        ->where('procedure_id', $procedureId)
                        ->where('raci_role', 'A')
                        ->where('user_id', '!=', $targetUserId)
                        ->delete();
                }
            }

            $row = ProjectProcedureRaci::updateOrCreate(
                [
                    'procedure_id' => $procedureId,
                    'user_id'      => $targetUserId,
                    'raci_role'    => $role,
                ],
                [
                    'note'       => $request->input('note'),
                    'updated_by' => $actorId,
                ]
            );

            if ($row->wasRecentlyCreated) {
                $row->update(['created_by' => $actorId]);
            }

            $this->removeStepRaciForOrphanedUsers($procedureId, $replacedAccountableUserIds);

            return $row;
        });

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

    public function removeRaci(int $raciId, Request $request): JsonResponse
    {
        [$row, $err] = $this->access->resolveAccessibleRaci($raciId, $request);
        if ($err !== null) {
            return $err;
        }

        DB::transaction(function () use ($row): void {
            $stepIds = ProjectProcedureStep::query()
                ->where('procedure_id', $row->procedure_id)
                ->pluck('id');

            if ($stepIds->isNotEmpty()) {
                ProjectProcedureStepRaci::query()
                    ->whereIn('step_id', $stepIds)
                    ->where('user_id', $row->user_id)
                    ->delete();
            }

            $row->delete();
        });

        return response()->json(['message' => 'RACI entry removed.']);
    }

    public function getStepRaciBulk(int $procedureId, Request $request): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $stepIds = ProjectProcedureStep::query()
            ->where('procedure_id', $procedureId)
            ->pluck('id');

        if ($stepIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $rows = $this->sortStepRaciRows(
            ProjectProcedureStepRaci::query()
                ->whereIn('step_id', $stepIds)
                ->with(['user:id,full_name,user_code,username'])
                ->get()
                ->map(fn (ProjectProcedureStepRaci $row): array => $this->formatStepRaciRow($row))
        );

        return response()->json(['data' => $rows]);
    }

    public function getStepRaci(int $stepId, Request $request): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        $rows = $this->sortStepRaciRows(
            ProjectProcedureStepRaci::query()
                ->where('step_id', $step->id)
                ->with(['user:id,full_name,user_code,username'])
                ->get()
                ->map(fn (ProjectProcedureStepRaci $row): array => $this->formatStepRaciRow($row))
        );

        return response()->json(['data' => $rows]);
    }

    public function setStepRaci(Request $request, int $stepId): JsonResponse
    {
        [$step, $err] = $this->access->resolveAccessibleStep($stepId, $request);
        if ($err !== null) {
            return $err;
        }

        if ($step->parent_step_id !== null) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['step_id' => ['Chỉ bước cha mới được phân công RACI riêng.']],
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|integer|exists:internal_users,id',
            'raci_role' => 'required|string|in:R,A,C,I',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $userId = (int) $request->input('user_id');
        $isProcedureMember = ProjectProcedureRaci::query()
            ->where('procedure_id', $step->procedure_id)
            ->where('user_id', $userId)
            ->exists();

        if (! $isProcedureMember) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['user_id' => ['Người dùng chưa được phân công ở tab RACI của thủ tục.']],
            ], 422);
        }

        $actorId = $request->user()?->id;
        $role = (string) $request->input('raci_role');
        $row = DB::transaction(function () use ($step, $userId, $role, $actorId): ProjectProcedureStepRaci {
            if ($role === 'A') {
                ProjectProcedureStepRaci::query()
                    ->where('step_id', $step->id)
                    ->where('raci_role', 'A')
                    ->where('user_id', '!=', $userId)
                    ->delete();
            }

            return ProjectProcedureStepRaci::firstOrCreate(
                [
                    'step_id' => $step->id,
                    'user_id' => $userId,
                    'raci_role' => $role,
                ],
                [
                    'created_by' => $actorId,
                ]
            );
        });

        $row->load('user:id,full_name,user_code,username');

        return response()->json([
            'data' => $this->formatStepRaciRow($row),
        ], $row->wasRecentlyCreated ? 201 : 200);
    }

    public function batchSetStepRaci(Request $request, int $procedureId): JsonResponse
    {
        [, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $validator = Validator::make($request->all(), [
            'mode' => 'sometimes|string|in:overwrite,merge',
            'assignments' => 'required|array|min:1',
            'assignments.*.step_id' => 'required|integer',
            'assignments.*.user_id' => 'required|integer|exists:internal_users,id',
            'assignments.*.raci_role' => 'required|string|in:R,A,C,I',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $mode = (string) $request->input('mode', 'overwrite');
        $assignments = collect($request->input('assignments', []))
            ->map(fn (array $row): array => [
                'step_id' => (int) $row['step_id'],
                'user_id' => (int) $row['user_id'],
                'raci_role' => (string) $row['raci_role'],
            ])
            ->values();

        $targetStepIds = $assignments->pluck('step_id')->unique()->values();
        $steps = ProjectProcedureStep::query()
            ->whereIn('id', $targetStepIds)
            ->where('procedure_id', $procedureId)
            ->get(['id', 'parent_step_id']);

        if ($steps->count() !== $targetStepIds->count()) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['step_id' => ['Có bước không thuộc thủ tục hiện tại.']],
            ], 422);
        }

        if ($steps->contains(fn (ProjectProcedureStep $step): bool => $step->parent_step_id !== null)) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['step_id' => ['Chỉ bước cha mới được phân công RACI riêng.']],
            ], 422);
        }

        $allowedUserIds = ProjectProcedureRaci::query()
            ->where('procedure_id', $procedureId)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->flip();

        $hasForeignUser = $assignments->contains(
            fn (array $row): bool => ! $allowedUserIds->has((int) $row['user_id'])
        );

        if ($hasForeignUser) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['user_id' => ['Có người dùng chưa được phân công ở tab RACI của thủ tục.']],
            ], 422);
        }

        $actorId = $request->user()?->id;
        DB::transaction(function () use ($assignments, $targetStepIds, $mode, $actorId): void {
            $existingByStep = [];

            if ($mode === 'merge') {
                $existingRows = ProjectProcedureStepRaci::query()
                    ->whereIn('step_id', $targetStepIds)
                    ->get(['step_id', 'user_id', 'raci_role']);

                foreach ($existingRows as $row) {
                    $stepKey = (string) $row->step_id;
                    $entryKey = (string) $row->user_id . ':' . $row->raci_role;
                    $existingByStep[$stepKey][$entryKey] = [
                        'step_id' => (int) $row->step_id,
                        'user_id' => (int) $row->user_id,
                        'raci_role' => (string) $row->raci_role,
                        'created_by' => $actorId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            foreach ($targetStepIds as $stepId) {
                $stepKey = (string) $stepId;
                $existingByStep[$stepKey] = $existingByStep[$stepKey] ?? [];
            }

            foreach ($assignments as $assignment) {
                $stepKey = (string) $assignment['step_id'];
                $entryKey = $assignment['user_id'] . ':' . $assignment['raci_role'];

                if ($assignment['raci_role'] === 'A') {
                    foreach (array_keys($existingByStep[$stepKey]) as $key) {
                        if (str_ends_with($key, ':A')) {
                            unset($existingByStep[$stepKey][$key]);
                        }
                    }
                }

                $existingByStep[$stepKey][$entryKey] = [
                    'step_id' => $assignment['step_id'],
                    'user_id' => $assignment['user_id'],
                    'raci_role' => $assignment['raci_role'],
                    'created_by' => $actorId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            ProjectProcedureStepRaci::query()
                ->whereIn('step_id', $targetStepIds)
                ->delete();

            $insertRows = collect($existingByStep)
                ->flatMap(fn (array $rows): array => array_values($rows))
                ->values()
                ->all();

            if ($insertRows !== []) {
                ProjectProcedureStepRaci::query()->insert($insertRows);
            }
        });

        return response()->json([
            'data' => $this->fetchProcedureStepRaciPayload($procedureId)->values(),
        ]);
    }

    public function removeStepRaci(int $raciId, Request $request): JsonResponse
    {
        [$row, $err] = $this->access->resolveAccessibleStepRaci($raciId, $request);
        if ($err !== null) {
            return $err;
        }

        $row->delete();

        return response()->json(['message' => 'Step RACI entry removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatStepRaciRow(ProjectProcedureStepRaci $row): array
    {
        return [
            'id'         => $row->id,
            'step_id'    => $row->step_id,
            'user_id'    => $row->user_id,
            'raci_role'  => $row->raci_role,
            'full_name'  => $row->user?->full_name,
            'user_code'  => $row->user?->user_code,
            'username'   => $row->user?->username,
            'created_at' => $row->created_at,
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fetchProcedureStepRaciPayload(int $procedureId): Collection
    {
        $stepIds = ProjectProcedureStep::query()
            ->where('procedure_id', $procedureId)
            ->pluck('id');

        if ($stepIds->isEmpty()) {
            return collect();
        }

        return $this->sortStepRaciRows(
            ProjectProcedureStepRaci::query()
                ->whereIn('step_id', $stepIds)
                ->with(['user:id,full_name,user_code,username'])
                ->orderBy('step_id')
                ->get()
                ->map(fn (ProjectProcedureStepRaci $row): array => $this->formatStepRaciRow($row))
        );
    }

    /**
     * @param Collection<int, array<string, mixed>> $rows
     * @return Collection<int, array<string, mixed>>
     */
    private function sortStepRaciRows(Collection $rows): Collection
    {
        $roleOrder = ['A' => 0, 'R' => 1, 'C' => 2, 'I' => 3];

        return $rows
            ->sort(function (array $left, array $right) use ($roleOrder): int {
                $stepCompare = ((int) ($left['step_id'] ?? 0)) <=> ((int) ($right['step_id'] ?? 0));
                if ($stepCompare !== 0) {
                    return $stepCompare;
                }

                $leftRole = $roleOrder[(string) ($left['raci_role'] ?? '')] ?? 99;
                $rightRole = $roleOrder[(string) ($right['raci_role'] ?? '')] ?? 99;
                if ($leftRole !== $rightRole) {
                    return $leftRole <=> $rightRole;
                }

                return strcmp(
                    mb_strtolower((string) ($left['full_name'] ?? $left['user_code'] ?? $left['username'] ?? $left['user_id'] ?? '')),
                    mb_strtolower((string) ($right['full_name'] ?? $right['user_code'] ?? $right['username'] ?? $right['user_id'] ?? ''))
                );
            })
            ->values();
    }

    /**
     * @param Collection<int, int> $candidateUserIds
     */
    private function removeStepRaciForOrphanedUsers(int $procedureId, Collection $candidateUserIds): void
    {
        if ($candidateUserIds->isEmpty()) {
            return;
        }

        $remainingProcedureMemberIds = ProjectProcedureRaci::query()
            ->where('procedure_id', $procedureId)
            ->whereIn('user_id', $candidateUserIds)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->unique();

        $orphanedUserIds = $candidateUserIds->diff($remainingProcedureMemberIds)->values();
        if ($orphanedUserIds->isEmpty()) {
            return;
        }

        $stepIds = ProjectProcedureStep::query()
            ->where('procedure_id', $procedureId)
            ->pluck('id');

        if ($stepIds->isEmpty()) {
            return;
        }

        ProjectProcedureStepRaci::query()
            ->whereIn('step_id', $stepIds)
            ->whereIn('user_id', $orphanedUserIds)
            ->delete();
    }
}
