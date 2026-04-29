<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedure;
use App\Models\ProjectProcedurePublicShare;
use App\Models\ProjectProcedureStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectProcedurePublicShareService
{
    private const PUBLIC_TTL_DAYS = 7;

    private const PHASE_LABELS = [
        'CO_HOI' => 'Cơ hội',
        'CHUAN_BI' => 'Chuẩn bị',
        'CHUAN_BI_DAU_TU' => 'Chuẩn bị đầu tư',
        'THUC_HIEN_DAU_TU' => 'Thực hiện đầu tư',
        'KET_THUC_DAU_TU' => 'Kết thúc đầu tư',
        'CHUAN_BI_KH_THUE' => 'Chuẩn bị thực hiện KH thuê',
    ];

    private const STATUS_LABELS = [
        'CHUA_THUC_HIEN' => 'Chưa thực hiện',
        'DANG_THUC_HIEN' => 'Đang thực hiện',
        'HOAN_THANH' => 'Hoàn thành',
    ];

    public function __construct(
        private readonly ProjectProcedureAccessService $access,
    ) {}

    public function createShare(Request $request, int $procedureId): JsonResponse
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $token = $this->generateToken();
        $expiresAt = now()->addDays(self::PUBLIC_TTL_DAYS);

        $share = DB::transaction(function () use ($procedure, $request, $token, $expiresAt): ProjectProcedurePublicShare {
            ProjectProcedurePublicShare::query()
                ->where('procedure_id', $procedure->id)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->update(['revoked_at' => now()]);

            return ProjectProcedurePublicShare::query()->create([
                'procedure_id' => $procedure->id,
                'token_hash' => $this->hashToken($token),
                'created_by' => $request->user()?->id,
                'expires_at' => $expiresAt,
            ]);
        });

        return response()->json([
            'data' => [
                'token' => $token,
                'expires_at' => $share->expires_at?->toIso8601String(),
                'ttl_days' => self::PUBLIC_TTL_DAYS,
            ],
        ], 201);
    }

    public function revokeShare(Request $request, int $procedureId): JsonResponse
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $revokedCount = ProjectProcedurePublicShare::query()
            ->where('procedure_id', $procedure->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        return response()->json([
            'data' => [
                'revoked' => true,
                'revoked_count' => $revokedCount,
            ],
        ]);
    }

    public function publicShare(string $token): JsonResponse
    {
        $share = $this->resolveActiveShare($token);
        if (! $share) {
            return $this->publicJson([
                'message' => 'Link public không còn hiệu lực.',
            ], 404);
        }

        $share->update(['last_accessed_at' => now()]);

        $procedure = $share->procedure;
        if (! $procedure) {
            return $this->publicJson([
                'message' => 'Link public không còn hiệu lực.',
            ], 404);
        }

        $payload = $this->buildProcedurePayload($procedure);
        $payload['share'] = [
            'expires_at' => $share->expires_at?->toIso8601String(),
        ];

        return $this->publicJson(['data' => $payload]);
    }

    /**
     * @return array<string, mixed>
     */
    public function buildProcedurePayload(ProjectProcedure $procedure): array
    {
        $procedure->loadMissing('project');

        $steps = ProjectProcedureStep::query()
            ->where('procedure_id', $procedure->id)
            ->orderBy('sort_order')
            ->orderBy('step_number')
            ->orderBy('id')
            ->get();

        $phases = $this->buildPhasePayload($steps);
        $totalSteps = $steps->count();
        $completedSteps = $steps->where('progress_status', 'HOAN_THANH')->count();
        $inProgressSteps = $steps->where('progress_status', 'DANG_THUC_HIEN')->count();
        $overallPercent = $totalSteps > 0
            ? (int) round(($completedSteps / $totalSteps) * 100)
            : 0;

        return [
            'project' => [
                'project_code' => $this->nullableString($procedure->project?->project_code),
                'project_name' => $this->nullableString($procedure->project?->project_name),
            ],
            'procedure' => [
                'procedure_name' => $this->nullableString($procedure->procedure_name) ?? 'Thủ tục dự án',
                'overall_progress' => (float) ($procedure->overall_progress ?? $overallPercent),
            ],
            'summary' => [
                'total_steps' => $totalSteps,
                'completed_steps' => $completedSteps,
                'in_progress_steps' => $inProgressSteps,
                'not_started_steps' => max(0, $totalSteps - $completedSteps - $inProgressSteps),
                'overall_percent' => $overallPercent,
            ],
            'phases' => $phases,
        ];
    }

    private function resolveActiveShare(string $token): ?ProjectProcedurePublicShare
    {
        $normalizedToken = trim($token);
        if ($normalizedToken === '' || strlen($normalizedToken) < 32 || strlen($normalizedToken) > 160) {
            return null;
        }

        return ProjectProcedurePublicShare::query()
            ->with('procedure.project')
            ->where('token_hash', $this->hashToken($normalizedToken))
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    /**
     * @param Collection<int, ProjectProcedureStep> $steps
     * @return array<int, array<string, mixed>>
     */
    private function buildPhasePayload(Collection $steps): array
    {
        $phaseOrder = [];
        $stepsByPhase = [];

        foreach ($steps as $step) {
            $phaseKey = $this->nullableString($step->phase) ?? 'KHAC';
            if (! array_key_exists($phaseKey, $stepsByPhase)) {
                $stepsByPhase[$phaseKey] = [];
                $phaseOrder[] = $phaseKey;
            }
            $stepsByPhase[$phaseKey][] = $step;
        }

        $payload = [];
        foreach ($phaseOrder as $phaseKey) {
            $phaseSteps = collect($stepsByPhase[$phaseKey]);
            $payload[] = [
                'phase_label' => $this->resolvePhaseLabel($phaseKey, $phaseSteps),
                'summary' => [
                    'total_steps' => $phaseSteps->count(),
                    'completed_steps' => $phaseSteps->where('progress_status', 'HOAN_THANH')->count(),
                ],
                'steps' => $this->buildStepPayload($phaseSteps),
            ];
        }

        return $payload;
    }

    /**
     * @param Collection<int, ProjectProcedureStep> $phaseSteps
     * @return array<int, array<string, mixed>>
     */
    private function buildStepPayload(Collection $phaseSteps): array
    {
        $stepIds = $phaseSteps
            ->map(fn (ProjectProcedureStep $step): int => (int) $step->id)
            ->all();
        $stepIdMap = array_fill_keys($stepIds, true);

        $childrenByParent = [];
        foreach ($phaseSteps as $step) {
            $parentId = $step->parent_step_id !== null ? (int) $step->parent_step_id : null;
            if ($parentId !== null && isset($stepIdMap[$parentId])) {
                $childrenByParent[$parentId] ??= [];
                $childrenByParent[$parentId][] = $step;
            }
        }

        $parents = $phaseSteps
            ->filter(function (ProjectProcedureStep $step) use ($stepIdMap): bool {
                $parentId = $step->parent_step_id !== null ? (int) $step->parent_step_id : null;

                return $parentId === null || ! isset($stepIdMap[$parentId]);
            })
            ->sort($this->stepSorter())
            ->values();

        foreach ($childrenByParent as $parentId => $children) {
            $childrenByParent[$parentId] = collect($children)->sort($this->stepSorter())->values();
        }

        $rows = [];
        foreach ($parents as $parentIndex => $parent) {
            $displayNumber = (string) ($parentIndex + 1);
            $rows[] = $this->sanitizeStep($parent, $displayNumber, 0);

            foreach (($childrenByParent[(int) $parent->id] ?? collect()) as $childIndex => $child) {
                $rows[] = $this->sanitizeStep($child, $displayNumber.'.'.($childIndex + 1), 1);
            }
        }

        return $rows;
    }

    /**
     * @return callable(ProjectProcedureStep, ProjectProcedureStep): int
     */
    private function stepSorter(): callable
    {
        return function (ProjectProcedureStep $left, ProjectProcedureStep $right): int {
            $sortDiff = (int) ($left->sort_order ?? 0) <=> (int) ($right->sort_order ?? 0);
            if ($sortDiff !== 0) {
                return $sortDiff;
            }

            $numberDiff = (int) ($left->step_number ?? 0) <=> (int) ($right->step_number ?? 0);
            if ($numberDiff !== 0) {
                return $numberDiff;
            }

            return (int) $left->id <=> (int) $right->id;
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function sanitizeStep(ProjectProcedureStep $step, string $displayNumber, int $level): array
    {
        $status = strtoupper((string) ($step->progress_status ?? 'CHUA_THUC_HIEN'));

        return [
            'display_number' => $displayNumber,
            'level' => $level,
            'step_name' => $this->nullableString($step->step_name) ?? '',
            'step_detail' => $this->nullableString($step->step_detail),
            'lead_unit' => $this->nullableString($step->lead_unit),
            'support_unit' => $this->nullableString($step->support_unit),
            'expected_result' => $this->nullableString($step->expected_result),
            'duration_days' => $step->duration_days !== null ? (int) $step->duration_days : null,
            'progress_status' => $status,
            'progress_status_label' => self::STATUS_LABELS[$status] ?? $status,
            'document_number' => $this->nullableString($step->document_number),
            'document_date' => $this->dateString($step->document_date),
            'actual_start_date' => $this->dateString($step->actual_start_date),
            'actual_end_date' => $this->dateString($step->actual_end_date),
        ];
    }

    /**
     * @param Collection<int, ProjectProcedureStep> $phaseSteps
     */
    private function resolvePhaseLabel(string $phaseKey, Collection $phaseSteps): string
    {
        $customLabel = $phaseSteps
            ->map(fn (ProjectProcedureStep $step): ?string => $this->nullableString($step->phase_label))
            ->filter()
            ->first();

        return $customLabel ?? self::PHASE_LABELS[$phaseKey] ?? $phaseKey;
    }

    private function generateToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized === '' ? null : $normalized;
    }

    private function dateString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value->toDateString();
        }

        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function publicJson(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status, [
            'Cache-Control' => 'no-store, private',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }
}
