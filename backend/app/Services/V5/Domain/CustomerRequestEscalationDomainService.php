<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestEscalationDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $auditService
    ) {}

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function missingTablesResponse(): ?JsonResponse
    {
        if (! $this->support->hasTable('customer_request_escalations')) {
            return $this->support->missingTable('customer_request_escalations');
        }

        return null;
    }

    private function resolveActorId(Request $request): ?int
    {
        $authId = $this->support->parseNullableInt($request->user()?->id ?? null);
        if ($authId !== null) {
            return $authId;
        }

        foreach (['updated_by', 'created_by'] as $key) {
            $value = $this->support->parseNullableInt($request->input($key));
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function generateEscalationCode(): string
    {
        $year = Carbon::now()->format('Y');
        $base = "ESC-{$year}-";

        $last = DB::table('customer_request_escalations')
            ->where('escalation_code', 'like', "{$base}%")
            ->orderByDesc('id')
            ->value('escalation_code');

        $seq = 1;
        if ($last !== null) {
            $parts = explode('-', $last);
            $seq   = (int) end($parts) + 1;
        }

        $code   = $base . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
        $suffix = $seq + 1;
        while (DB::table('customer_request_escalations')->where('escalation_code', $code)->exists()) {
            $code   = $base . str_pad((string) $suffix, 4, '0', STR_PAD_LEFT);
            $suffix++;
        }

        return $code;
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeRow(object|array $row): array
    {
        $r = is_object($row) ? (array) $row : $row;

        return [
            'id'                          => (int) ($r['id'] ?? 0),
            'escalation_code'             => (string) ($r['escalation_code'] ?? ''),
            'request_case_id'             => (int) ($r['request_case_id'] ?? 0),
            'request_code'                => $this->normalizeNullableString($r['request_code'] ?? null),
            'summary'                     => $this->normalizeNullableString($r['summary'] ?? null),
            'raised_by_user_id'           => (int) ($r['raised_by_user_id'] ?? 0),
            'raiser_name'                 => $this->normalizeNullableString($r['raiser_name'] ?? null),
            'raiser_code'                 => $this->normalizeNullableString($r['raiser_code'] ?? null),
            'raised_at'                   => $this->normalizeNullableString($r['raised_at'] ?? null),
            'difficulty_type'             => (string) ($r['difficulty_type'] ?? ''),
            'severity'                    => (string) ($r['severity'] ?? 'medium'),
            'description'                 => (string) ($r['description'] ?? ''),
            'impact_description'          => $this->normalizeNullableString($r['impact_description'] ?? null),
            'blocked_since'               => $this->normalizeNullableString($r['blocked_since'] ?? null),
            'proposed_action'             => $this->normalizeNullableString($r['proposed_action'] ?? null),
            'proposed_handler_user_id'    => $this->support->parseNullableInt($r['proposed_handler_user_id'] ?? null),
            'proposed_additional_hours'   => isset($r['proposed_additional_hours']) && $r['proposed_additional_hours'] !== null
                ? (float) $r['proposed_additional_hours'] : null,
            'proposed_deadline_extension' => $this->normalizeNullableString($r['proposed_deadline_extension'] ?? null),
            'status'                      => (string) ($r['status'] ?? 'pending'),
            'reviewed_by_user_id'         => $this->support->parseNullableInt($r['reviewed_by_user_id'] ?? null),
            'reviewer_name'               => $this->normalizeNullableString($r['reviewer_name'] ?? null),
            'reviewed_at'                 => $this->normalizeNullableString($r['reviewed_at'] ?? null),
            'resolution_decision'         => $this->normalizeNullableString($r['resolution_decision'] ?? null),
            'resolution_note'             => $this->normalizeNullableString($r['resolution_note'] ?? null),
            'resolved_at'                 => $this->normalizeNullableString($r['resolved_at'] ?? null),
            'created_at'                  => $this->normalizeNullableString($r['created_at'] ?? null),
            'updated_at'                  => $this->normalizeNullableString($r['updated_at'] ?? null),
        ];
    }

    private function buildBaseQuery(): \Illuminate\Database\Query\Builder
    {
        $q = DB::table('customer_request_escalations as esc');

        if ($this->support->hasTable('internal_users')) {
            $q->leftJoin('internal_users as raiser', 'esc.raised_by_user_id', '=', 'raiser.id')
              ->leftJoin('internal_users as reviewer', 'esc.reviewed_by_user_id', '=', 'reviewer.id');
        }

        if ($this->support->hasTable('customer_request_cases')) {
            $q->leftJoin('customer_request_cases as crc', 'esc.request_case_id', '=', 'crc.id');
        }

        $hasIU = $this->support->hasTable('internal_users');
        $hasCRC = $this->support->hasTable('customer_request_cases');

        $q->select([
            'esc.id',
            'esc.escalation_code',
            'esc.request_case_id',
            'esc.raised_by_user_id',
            'esc.raised_at',
            'esc.difficulty_type',
            'esc.severity',
            'esc.description',
            'esc.impact_description',
            'esc.blocked_since',
            'esc.proposed_action',
            'esc.proposed_handler_user_id',
            'esc.proposed_additional_hours',
            'esc.proposed_deadline_extension',
            'esc.status',
            'esc.reviewed_by_user_id',
            'esc.reviewed_at',
            'esc.resolution_decision',
            'esc.resolution_note',
            'esc.resolved_at',
            'esc.created_at',
            'esc.updated_at',
        ]);

        if ($hasIU) {
            $q->addSelect([
                DB::raw('raiser.full_name as raiser_name'),
                DB::raw('raiser.user_code as raiser_code'),
                DB::raw('reviewer.full_name as reviewer_name'),
            ]);
        }

        if ($hasCRC) {
            $q->addSelect([
                DB::raw('crc.request_code as request_code'),
                DB::raw('crc.summary as summary'),
            ]);
        }

        $q->whereNull('esc.deleted_at');

        return $q;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $page    = max(1, (int) ($request->query('page', 1)));
        $perPage = 20;
        $offset  = ($page - 1) * $perPage;

        $q = $this->buildBaseQuery();

        $status = $this->normalizeNullableString($request->query('status'));
        if ($status !== null) {
            $q->where('esc.status', $status);
        }

        $severity = $this->normalizeNullableString($request->query('severity'));
        if ($severity !== null) {
            $q->where('esc.severity', $severity);
        }

        $caseId = $this->support->parseNullableInt($request->query('request_case_id'));
        if ($caseId !== null) {
            $q->where('esc.request_case_id', $caseId);
        }

        $raisedBy = $this->support->parseNullableInt($request->query('raised_by_user_id'));
        if ($raisedBy !== null) {
            $q->where('esc.raised_by_user_id', $raisedBy);
        }

        $total = (clone $q)->count();
        $rows  = $q->orderByDesc('esc.raised_at')->offset($offset)->limit($perPage)->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => $this->serializeRow($r))->toArray(),
            'meta' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total'       => $total,
                'total_pages' => (int) ceil($total / $perPage),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $row = $this->buildBaseQuery()
            ->where('esc.id', $id)
            ->first();

        if ($row === null) {
            return response()->json(['message' => 'Escalation not found.'], 404);
        }

        return response()->json(['data' => $this->serializeRow($row)]);
    }

    public function store(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $validated = $request->validate([
            'request_case_id'             => 'required|integer',
            'difficulty_type'             => 'required|string|in:technical,resource,customer,scope_change,dependency,sla_risk',
            'severity'                    => 'sometimes|string|in:low,medium,high,critical',
            'description'                 => 'required|string',
            'impact_description'          => 'nullable|string|max:1000',
            'blocked_since'               => 'nullable|date',
            'proposed_action'             => 'nullable|string',
            'proposed_handler_user_id'    => 'nullable|integer',
            'proposed_additional_hours'   => 'nullable|numeric|min:0',
            'proposed_deadline_extension' => 'nullable|date',
        ]);

        $now     = Carbon::now();
        $actorId = $this->resolveActorId($request);
        $code    = $this->generateEscalationCode();

        $insertData = [
            'escalation_code'             => $code,
            'request_case_id'             => (int) $validated['request_case_id'],
            'raised_by_user_id'           => $actorId ?? 0,
            'raised_at'                   => $now,
            'difficulty_type'             => $validated['difficulty_type'],
            'severity'                    => $validated['severity'] ?? 'medium',
            'description'                 => $validated['description'],
            'impact_description'          => $this->normalizeNullableString($validated['impact_description'] ?? null),
            'blocked_since'               => $this->normalizeNullableString($validated['blocked_since'] ?? null),
            'proposed_action'             => $this->normalizeNullableString($validated['proposed_action'] ?? null),
            'proposed_handler_user_id'    => $this->support->parseNullableInt($validated['proposed_handler_user_id'] ?? null),
            'proposed_additional_hours'   => isset($validated['proposed_additional_hours']) ? (float) $validated['proposed_additional_hours'] : null,
            'proposed_deadline_extension' => $this->normalizeNullableString($validated['proposed_deadline_extension'] ?? null),
            'status'                      => 'pending',
            'created_at'                  => $now,
            'updated_at'                  => $now,
        ];

        $id  = DB::table('customer_request_escalations')->insertGetId($insertData);
        $row = $this->buildBaseQuery()->where('esc.id', $id)->first();

        $this->auditService->recordAuditEvent(
            $request,
            'INSERT',
            'customer_request_escalations',
            $id,
            null,
            $insertData
        );

        return response()->json(['data' => $this->serializeRow($row)], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $row = DB::table('customer_request_escalations')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($row === null) {
            return response()->json(['message' => 'Escalation not found.'], 404);
        }

        $validated = $request->validate([
            'resolution_decision' => 'nullable|string',
            'resolution_note'     => 'nullable|string',
        ]);

        $now     = Carbon::now();
        $actorId = $this->resolveActorId($request);
        $old     = (array) $row;

        $decision = $this->normalizeNullableString($validated['resolution_decision'] ?? null);
        $status   = ($decision !== null) ? 'resolved' : 'reviewing';

        $updates = [
            'status'              => $status,
            'reviewed_by_user_id' => $actorId,
            'reviewed_at'         => $now,
            'resolution_decision' => $decision,
            'resolution_note'     => $this->normalizeNullableString($validated['resolution_note'] ?? null),
            'resolved_at'         => ($status === 'resolved') ? $now : null,
            'updated_at'          => $now,
        ];

        DB::table('customer_request_escalations')->where('id', $id)->update($updates);

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'customer_request_escalations',
            $id,
            $old,
            $updates
        );

        $updated = $this->buildBaseQuery()->where('esc.id', $id)->first();

        return response()->json(['data' => $this->serializeRow($updated)]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $row = DB::table('customer_request_escalations')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($row === null) {
            return response()->json(['message' => 'Escalation not found.'], 404);
        }

        $validated = $request->validate([
            'resolution_note' => 'nullable|string',
        ]);

        $now  = Carbon::now();
        $old  = (array) $row;

        $updates = [
            'status'          => 'resolved',
            'resolved_at'     => $now,
            'resolution_note' => $this->normalizeNullableString($validated['resolution_note'] ?? null),
            'updated_at'      => $now,
        ];

        DB::table('customer_request_escalations')->where('id', $id)->update($updates);

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'customer_request_escalations',
            $id,
            $old,
            $updates
        );

        $updated = $this->buildBaseQuery()->where('esc.id', $id)->first();

        return response()->json(['data' => $this->serializeRow($updated)]);
    }

    public function stats(Request $request): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $total    = (int) DB::table('customer_request_escalations')->whereNull('deleted_at')->count();
        $byStatus = DB::table('customer_request_escalations')
            ->whereNull('deleted_at')
            ->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')
            ->get()
            ->pluck('cnt', 'status')
            ->map(fn ($v) => (int) $v)
            ->toArray();

        $bySeverity = DB::table('customer_request_escalations')
            ->whereNull('deleted_at')
            ->selectRaw('severity, COUNT(*) as cnt')
            ->groupBy('severity')
            ->get()
            ->pluck('cnt', 'severity')
            ->map(fn ($v) => (int) $v)
            ->toArray();

        $byType = DB::table('customer_request_escalations')
            ->whereNull('deleted_at')
            ->selectRaw('difficulty_type, COUNT(*) as cnt')
            ->groupBy('difficulty_type')
            ->get()
            ->pluck('cnt', 'difficulty_type')
            ->map(fn ($v) => (int) $v)
            ->toArray();

        // Average resolution days
        $avgDays = DB::table('customer_request_escalations')
            ->whereNull('deleted_at')
            ->whereNotNull('resolved_at')
            ->whereNotNull('raised_at')
            ->selectRaw("AVG(julianday(resolved_at) - julianday(raised_at)) as avg_days")
            ->value('avg_days');

        // Recent critical unresolved
        $recentCritical = DB::table('customer_request_escalations as esc')
            ->whereNull('esc.deleted_at')
            ->where('esc.severity', 'critical')
            ->whereNotIn('esc.status', ['resolved', 'rejected', 'closed'])
            ->orderByDesc('esc.raised_at')
            ->limit(5)
            ->get(['esc.id', 'esc.escalation_code', 'esc.request_case_id', 'esc.raised_at', 'esc.description'])
            ->map(fn ($r) => (array) $r)
            ->toArray();

        return response()->json([
            'data' => [
                'total'                => $total,
                'by_status'            => array_merge(['pending' => 0, 'reviewing' => 0, 'resolved' => 0, 'rejected' => 0, 'closed' => 0], $byStatus),
                'by_severity'          => array_merge(['low' => 0, 'medium' => 0, 'high' => 0, 'critical' => 0], $bySeverity),
                'by_type'              => $byType,
                'avg_resolution_days'  => $avgDays !== null ? round((float) $avgDays, 1) : null,
                'recent_critical'      => $recentCritical,
            ],
        ]);
    }
}
