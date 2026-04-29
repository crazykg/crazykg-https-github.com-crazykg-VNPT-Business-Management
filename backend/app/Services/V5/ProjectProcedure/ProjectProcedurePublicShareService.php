<?php

namespace App\Services\V5\ProjectProcedure;

use App\Models\ProjectProcedure;
use App\Models\ProjectProcedurePublicShare;
use App\Models\ProjectProcedureStep;
use App\Services\V5\IntegrationSettings\EmailSmtpIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProjectProcedurePublicShareService
{
    private const PUBLIC_TTL_DAYS = [10, 30, 90];
    private const GENERIC_SERVICE_PROCEDURE_NAME = 'Thủ tục dự án thuê dịch vụ CNTT đặc thù';

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
        private readonly EmailSmtpIntegrationService $emailSmtp,
    ) {}

    public function createShare(Request $request, int $procedureId): JsonResponse
    {
        [$procedure, $err] = $this->access->resolveAccessibleProcedure($procedureId, $request);
        if ($err !== null) {
            return $err;
        }

        $input = $request->all();
        if (array_key_exists('access_key', $input)) {
            $input['access_key'] = trim((string) $input['access_key']);
        }

        $validator = Validator::make($input, [
            'ttl_days' => ['required', 'integer', Rule::in(self::PUBLIC_TTL_DAYS)],
            'access_key' => ['required', 'string', 'min:4', 'max:120'],
        ], [
            'ttl_days.required' => 'Vui lòng chọn thời hạn public.',
            'ttl_days.in' => 'Thời hạn public chỉ được chọn 10, 30 hoặc 90 ngày.',
            'access_key.required' => 'Vui lòng nhập key truy cập.',
            'access_key.min' => 'Key truy cập cần tối thiểu 4 ký tự.',
            'access_key.max' => 'Key truy cập không được vượt quá 120 ký tự.',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        $ttlDays = (int) $validated['ttl_days'];
        $accessKey = (string) $validated['access_key'];
        $token = $this->generateToken();
        $expiresAt = now()->addDays($ttlDays);

        $share = DB::transaction(function () use ($procedure, $request, $token, $accessKey, $expiresAt): ProjectProcedurePublicShare {
            ProjectProcedurePublicShare::query()
                ->where('procedure_id', $procedure->id)
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->update(['revoked_at' => now()]);

            return ProjectProcedurePublicShare::query()->create([
                'procedure_id' => $procedure->id,
                'token_hash' => $this->hashToken($token),
                'access_key_hash' => Hash::make($accessKey),
                'created_by' => $request->user()?->id,
                'expires_at' => $expiresAt,
            ]);
        });

        $publicUrl = $this->buildPublicProcedureUrl($request, $token);
        $emailNotification = $this->sendPublicShareNotification(
            $request,
            $procedure,
            $publicUrl,
            $accessKey,
            $expiresAt
        );

        return response()->json([
            'data' => [
                'token' => $token,
                'public_url' => $publicUrl,
                'expires_at' => $share->expires_at?->toIso8601String(),
                'ttl_days' => $ttlDays,
                'email' => $emailNotification,
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

    public function publicShare(Request $request, string $token): JsonResponse
    {
        $share = $this->resolveActiveShare($token);
        if (! $share) {
            return $this->publicJson([
                'message' => 'Link public không còn hiệu lực.',
            ], 404);
        }

        $requestKey = $request->isMethod('post')
            ? ($request->json()->get('access_key') ?? $request->request->get('access_key') ?? $request->header('X-Procedure-Access-Key'))
            : null;
        $accessKey = trim((string) ($requestKey ?? ''));
        if ($accessKey === '' || ! $share->access_key_hash || ! Hash::check($accessKey, (string) $share->access_key_hash)) {
            return $this->publicJson([
                'message' => 'Key truy cập không đúng hoặc đã bị thiếu.',
            ], 403);
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
                'procedure_name' => $this->resolvePublicProcedureName($procedure),
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

    /**
     * @return array{status: 'SUCCESS'|'FAILED'|'SKIPPED', recipients: array<int, string>, message: string|null}
     */
    private function sendPublicShareNotification(
        Request $request,
        ProjectProcedure $procedure,
        string $publicUrl,
        string $accessKey,
        Carbon $expiresAt
    ): array {
        $recipients = $this->publicShareNotificationRecipients();
        if ($recipients === []) {
            return [
                'status' => 'SKIPPED',
                'recipients' => [],
                'message' => null,
            ];
        }

        $procedure->loadMissing('project');
        $actor = $request->user();
        $actorName = trim((string) ($actor?->full_name ?? $actor?->username ?? 'Không rõ'));
        $actorUsername = trim((string) ($actor?->username ?? ''));
        $actorDisplay = $actorUsername !== ''
            ? sprintf('%s (%s)', $actorName, $actorUsername)
            : $actorName;
        $expiresAtText = $expiresAt->format('d/m/Y H:i:s');

        $messageLines = $this->buildPublicShareEmailLines(
            $procedure,
            $publicUrl,
            $accessKey,
            $expiresAtText,
            $actorDisplay
        );
        $htmlBody = $this->buildPublicShareEmailHtml(
            $procedure,
            $publicUrl,
            $accessKey,
            $expiresAtText,
            $actorDisplay
        );
        $result = $this->emailSmtp->sendHtmlEmail(
            $recipients,
            $this->buildPublicShareEmailSubject($procedure),
            $messageLines,
            $htmlBody
        );

        if (($result['success'] ?? false) === true) {
            return [
                'status' => 'SUCCESS',
                'recipients' => $recipients,
                'message' => 'Đã gửi email public thủ tục.',
            ];
        }

        $message = (string) ($result['message'] ?? 'Không thể gửi email public thủ tục.');
        Log::warning('project_procedure.public_share_email_failed', [
            'procedure_id' => $procedure->getKey(),
            'project_id' => $procedure->project_id ?? null,
            'recipients' => $recipients,
            'message' => $message,
        ]);

        return [
            'status' => 'FAILED',
            'recipients' => $recipients,
            'message' => $message,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function publicShareNotificationRecipients(): array
    {
        return collect(config('audit.project_procedure_public_share_notification_recipients', []))
            ->map(fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values()
            ->all();
    }

    private function buildPublicProcedureUrl(Request $request, string $token): string
    {
        $baseUrl = $this->resolvePublicShareBaseUrl($request);

        return $baseUrl.'/public/project-procedure/'.rawurlencode($token);
    }

    private function resolvePublicShareBaseUrl(Request $request): string
    {
        $candidates = [
            $request->headers->get('Origin'),
            $request->headers->get('Referer'),
            config('app.url', 'http://localhost'),
        ];

        foreach ($candidates as $candidate) {
            $baseUrl = $this->normalizePublicShareBaseUrl(is_string($candidate) ? $candidate : null);
            if ($baseUrl !== null) {
                return $baseUrl;
            }
        }

        return 'http://localhost';
    }

    private function normalizePublicShareBaseUrl(?string $candidate): ?string
    {
        $candidate = trim((string) $candidate);
        if ($candidate === '') {
            return null;
        }

        $parts = parse_url($candidate);
        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = trim((string) ($parts['host'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }

        $port = isset($parts['port']) ? ':'.(int) $parts['port'] : '';

        return $scheme.'://'.$host.$port;
    }

    private function buildPublicShareEmailSubject(ProjectProcedure $procedure): string
    {
        $procedureName = $this->resolvePublicProcedureName($procedure);
        $projectCode = trim((string) ($procedure->project?->project_code ?? ''));
        $label = $projectCode !== ''
            ? $projectCode
            : ($procedureName !== '' ? $procedureName : sprintf('Procedure #%s', (string) $procedure->getKey()));

        return sprintf('[VNPT Business] Public bảng thủ tục - %s', $label);
    }

    /**
     * @return array<int, string>
     */
    private function buildPublicShareEmailLines(
        ProjectProcedure $procedure,
        string $publicUrl,
        string $accessKey,
        string $expiresAtText,
        string $actorDisplay
    ): array {
        $projectCode = trim((string) ($procedure->project?->project_code ?? ''));
        $projectName = trim((string) ($procedure->project?->project_name ?? ''));
        $projectLabel = trim($projectCode.($projectCode !== '' && $projectName !== '' ? ' - ' : '').$projectName);

        return [
            'Hệ thống vừa tạo link public cho bảng thủ tục dự án.',
            '',
            'Dự án: '.($projectLabel !== '' ? $projectLabel : '--'),
            'Thủ tục: '.$this->resolvePublicProcedureName($procedure),
            'Người tạo: '.$actorDisplay,
            'Hết hạn: '.$expiresAtText,
            '',
            'Link public: '.$publicUrl,
            'Key truy cập: '.$accessKey,
        ];
    }

    private function buildPublicShareEmailHtml(
        ProjectProcedure $procedure,
        string $publicUrl,
        string $accessKey,
        string $expiresAtText,
        string $actorDisplay
    ): string {
        $projectCode = trim((string) ($procedure->project?->project_code ?? ''));
        $projectName = trim((string) ($procedure->project?->project_name ?? ''));
        $projectLabel = trim($projectCode.($projectCode !== '' && $projectName !== '' ? ' - ' : '').$projectName);
        $procedureName = $this->resolvePublicProcedureName($procedure);

        return sprintf(
            '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">'
            .'<h2 style="margin:0 0 12px;color:#064a82;font-size:18px">Public bảng thủ tục dự án</h2>'
            .'<p style="margin:0 0 16px">Hệ thống vừa tạo link public cho bảng thủ tục dự án.</p>'
            .'<table style="border-collapse:collapse;width:100%%;max-width:720px">'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700;width:140px">Dự án</td><td style="padding:6px 8px">%s</td></tr>'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700">Thủ tục</td><td style="padding:6px 8px">%s</td></tr>'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700">Người tạo</td><td style="padding:6px 8px">%s</td></tr>'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700">Hết hạn</td><td style="padding:6px 8px">%s</td></tr>'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700">Link public</td><td style="padding:6px 8px"><a href="%s">%s</a></td></tr>'
            .'<tr><td style="padding:6px 8px;color:#475569;font-weight:700">Key truy cập</td><td style="padding:6px 8px"><code style="font-size:14px">%s</code></td></tr>'
            .'</table>'
            .'</div>',
            $this->escapeEmailHtml($projectLabel !== '' ? $projectLabel : '--'),
            $this->escapeEmailHtml($procedureName),
            $this->escapeEmailHtml($actorDisplay),
            $this->escapeEmailHtml($expiresAtText),
            $this->escapeEmailHtml($publicUrl),
            $this->escapeEmailHtml($publicUrl),
            $this->escapeEmailHtml($accessKey)
        );
    }

    private function escapeEmailHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function resolvePublicProcedureName(ProjectProcedure $procedure): string
    {
        $procedureName = $this->nullableString($procedure->procedure_name) ?? 'Thủ tục dự án';
        if ($procedureName !== self::GENERIC_SERVICE_PROCEDURE_NAME) {
            return $procedureName;
        }

        $projectName = $this->nullableString($procedure->project?->project_name);
        if ($projectName === null) {
            return $procedureName;
        }

        return 'Kế hoạch triển khai - '.$projectName;
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
