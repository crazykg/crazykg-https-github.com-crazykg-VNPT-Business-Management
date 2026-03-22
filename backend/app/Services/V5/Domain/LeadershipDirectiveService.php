<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LeadershipDirectiveService
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
        if (! $this->support->hasTable('leadership_directives')) {
            return $this->support->missingTable('leadership_directives');
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

    private function generateDirectiveCode(): string
    {
        $year = Carbon::now()->format('Y');
        $base = "DIR-{$year}-";

        $last = DB::table('leadership_directives')
            ->where('directive_code', 'like', "{$base}%")
            ->orderByDesc('id')
            ->value('directive_code');

        $seq = 1;
        if ($last !== null) {
            $parts = explode('-', $last);
            $seq   = (int) end($parts) + 1;
        }

        $code   = $base . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
        $suffix = $seq + 1;
        while (DB::table('leadership_directives')->where('directive_code', $code)->exists()) {
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

        $ccUserIds    = $r['cc_user_ids'] ?? null;
        $linkedCaseIds = $r['linked_case_ids'] ?? null;

        if (is_string($ccUserIds)) {
            $ccUserIds = json_decode($ccUserIds, true) ?? null;
        }
        if (is_string($linkedCaseIds)) {
            $linkedCaseIds = json_decode($linkedCaseIds, true) ?? null;
        }

        return [
            'id'                    => (int) ($r['id'] ?? 0),
            'directive_code'        => (string) ($r['directive_code'] ?? ''),
            'issued_by_user_id'     => (int) ($r['issued_by_user_id'] ?? 0),
            'issuer_name'           => $this->normalizeNullableString($r['issuer_name'] ?? null),
            'assigned_to_user_id'   => (int) ($r['assigned_to_user_id'] ?? 0),
            'assignee_name'         => $this->normalizeNullableString($r['assignee_name'] ?? null),
            'cc_user_ids'           => is_array($ccUserIds) ? $ccUserIds : null,
            'directive_type'        => (string) ($r['directive_type'] ?? ''),
            'content'               => (string) ($r['content'] ?? ''),
            'priority'              => (string) ($r['priority'] ?? 'high'),
            'source_type'           => $this->normalizeNullableString($r['source_type'] ?? null),
            'source_escalation_id'  => $this->support->parseNullableInt($r['source_escalation_id'] ?? null),
            'linked_case_ids'       => is_array($linkedCaseIds) ? $linkedCaseIds : null,
            'deadline'              => $this->normalizeNullableString($r['deadline'] ?? null),
            'status'                => (string) ($r['status'] ?? 'pending'),
            'acknowledged_at'       => $this->normalizeNullableString($r['acknowledged_at'] ?? null),
            'completed_at'          => $this->normalizeNullableString($r['completed_at'] ?? null),
            'completion_note'       => $this->normalizeNullableString($r['completion_note'] ?? null),
            'created_by'            => $this->support->parseNullableInt($r['created_by'] ?? null),
            'updated_by'            => $this->support->parseNullableInt($r['updated_by'] ?? null),
            'created_at'            => $this->normalizeNullableString($r['created_at'] ?? null),
            'updated_at'            => $this->normalizeNullableString($r['updated_at'] ?? null),
        ];
    }

    private function buildBaseQuery(): \Illuminate\Database\Query\Builder
    {
        $q = DB::table('leadership_directives as dir');

        $hasIU = $this->support->hasTable('internal_users');

        if ($hasIU) {
            $q->leftJoin('internal_users as issuer', 'dir.issued_by_user_id', '=', 'issuer.id')
              ->leftJoin('internal_users as assignee', 'dir.assigned_to_user_id', '=', 'assignee.id');
        }

        $q->select([
            'dir.id',
            'dir.directive_code',
            'dir.issued_by_user_id',
            'dir.assigned_to_user_id',
            'dir.cc_user_ids',
            'dir.directive_type',
            'dir.content',
            'dir.priority',
            'dir.source_type',
            'dir.source_escalation_id',
            'dir.linked_case_ids',
            'dir.deadline',
            'dir.status',
            'dir.acknowledged_at',
            'dir.completed_at',
            'dir.completion_note',
            'dir.created_by',
            'dir.updated_by',
            'dir.created_at',
            'dir.updated_at',
        ]);

        if ($hasIU) {
            $q->addSelect([
                DB::raw('issuer.full_name as issuer_name'),
                DB::raw('assignee.full_name as assignee_name'),
            ]);
        }

        $q->whereNull('dir.deleted_at');

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
            $q->where('dir.status', $status);
        }

        $type = $this->normalizeNullableString($request->query('directive_type'));
        if ($type !== null) {
            $q->where('dir.directive_type', $type);
        }

        $assignedTo = $this->support->parseNullableInt($request->query('assigned_to_user_id'));
        if ($assignedTo !== null) {
            $q->where('dir.assigned_to_user_id', $assignedTo);
        }

        $total = (clone $q)->count();
        $rows  = $q->orderByDesc('dir.created_at')->offset($offset)->limit($perPage)->get();

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

        $row = $this->buildBaseQuery()->where('dir.id', $id)->first();

        if ($row === null) {
            return response()->json(['message' => 'Directive not found.'], 404);
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
            'assigned_to_user_id'  => 'required|integer',
            'directive_type'       => 'required|string|in:resource_transfer,deadline_extension,priority_change,contact_customer,training,other',
            'content'              => 'required|string',
            'priority'             => 'sometimes|string|in:low,medium,high',
            'source_type'          => 'nullable|string|in:escalation,pain_point,manual',
            'source_escalation_id' => 'nullable|integer',
            'linked_case_ids'      => 'nullable|array',
            'linked_case_ids.*'    => 'integer',
            'cc_user_ids'          => 'nullable|array',
            'cc_user_ids.*'        => 'integer',
            'deadline'             => 'nullable|date',
        ]);

        $now     = Carbon::now();
        $actorId = $this->resolveActorId($request);
        $code    = $this->generateDirectiveCode();

        $insertData = [
            'directive_code'       => $code,
            'issued_by_user_id'    => $actorId ?? 0,
            'assigned_to_user_id'  => (int) $validated['assigned_to_user_id'],
            'cc_user_ids'          => isset($validated['cc_user_ids']) ? json_encode($validated['cc_user_ids']) : null,
            'directive_type'       => $validated['directive_type'],
            'content'              => $validated['content'],
            'priority'             => $validated['priority'] ?? 'high',
            'source_type'          => $this->normalizeNullableString($validated['source_type'] ?? null),
            'source_escalation_id' => $this->support->parseNullableInt($validated['source_escalation_id'] ?? null),
            'linked_case_ids'      => isset($validated['linked_case_ids']) ? json_encode($validated['linked_case_ids']) : null,
            'deadline'             => $this->normalizeNullableString($validated['deadline'] ?? null),
            'status'               => 'pending',
            'created_by'           => $actorId,
            'updated_by'           => $actorId,
            'created_at'           => $now,
            'updated_at'           => $now,
        ];

        $id  = DB::table('leadership_directives')->insertGetId($insertData);
        $row = $this->buildBaseQuery()->where('dir.id', $id)->first();

        $this->auditService->recordAuditEvent(
            $request,
            'INSERT',
            'leadership_directives',
            $id,
            null,
            $insertData
        );

        return response()->json(['data' => $this->serializeRow($row)], 201);
    }

    public function acknowledge(Request $request, int $id): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $row = DB::table('leadership_directives')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($row === null) {
            return response()->json(['message' => 'Directive not found.'], 404);
        }

        $actorId    = $this->resolveActorId($request);
        $assigneeId = (int) $row->assigned_to_user_id;

        if ($actorId !== null && $actorId !== $assigneeId) {
            return response()->json(['message' => 'Chỉ người được giao mới có thể xác nhận chỉ đạo này.'], 403);
        }

        $now  = Carbon::now();
        $old  = (array) $row;

        $updates = [
            'status'          => 'acknowledged',
            'acknowledged_at' => $now,
            'updated_by'      => $actorId,
            'updated_at'      => $now,
        ];

        DB::table('leadership_directives')->where('id', $id)->update($updates);

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'leadership_directives',
            $id,
            $old,
            $updates
        );

        $updated = $this->buildBaseQuery()->where('dir.id', $id)->first();

        return response()->json(['data' => $this->serializeRow($updated)]);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        $missing = $this->missingTablesResponse();
        if ($missing !== null) {
            return $missing;
        }

        $row = DB::table('leadership_directives')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($row === null) {
            return response()->json(['message' => 'Directive not found.'], 404);
        }

        $validated = $request->validate([
            'completion_note' => 'nullable|string',
        ]);

        $now     = Carbon::now();
        $actorId = $this->resolveActorId($request);
        $old     = (array) $row;

        $updates = [
            'status'          => 'completed',
            'completed_at'    => $now,
            'completion_note' => $this->normalizeNullableString($validated['completion_note'] ?? null),
            'updated_by'      => $actorId,
            'updated_at'      => $now,
        ];

        DB::table('leadership_directives')->where('id', $id)->update($updates);

        $this->auditService->recordAuditEvent(
            $request,
            'UPDATE',
            'leadership_directives',
            $id,
            $old,
            $updates
        );

        $updated = $this->buildBaseQuery()->where('dir.id', $id)->first();

        return response()->json(['data' => $this->serializeRow($updated)]);
    }
}
