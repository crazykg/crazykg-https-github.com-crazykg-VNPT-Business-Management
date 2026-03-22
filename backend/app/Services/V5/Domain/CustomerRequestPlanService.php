<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerRequestPlanService
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
        foreach (['customer_request_plans', 'customer_request_plan_items'] as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
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

    private function generatePlanCode(string $planType, string $periodStart): string
    {
        $date = Carbon::parse($periodStart);

        if ($planType === 'weekly') {
            $year = $date->format('Y');
            $week = $date->format('W');
            $base = "W{$year}-W{$week}";
        } else {
            // monthly
            $base = 'M'.$date->format('Y').'-'.$date->format('m');
        }

        // Guarantee uniqueness
        $code = $base;
        $suffix = 2;
        while (DB::table('customer_request_plans')->where('plan_code', $code)->exists()) {
            $code = "{$base}-{$suffix}";
            $suffix++;
        }

        return $code;
    }

    private function recalculatePlanHours(int $planId): void
    {
        DB::table('customer_request_plans')
            ->where('id', $planId)
            ->update([
                'total_planned_hours' => DB::raw(
                    '(SELECT COALESCE(SUM(planned_hours), 0) FROM customer_request_plan_items WHERE plan_id = '.(int) $planId.')'
                ),
                'updated_at' => now(),
            ]);
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializePlanRow(object|array $row): array
    {
        $r = is_object($row) ? (array) $row : $row;

        return [
            'id'                  => (int) ($r['id'] ?? 0),
            'plan_code'           => (string) ($r['plan_code'] ?? ''),
            'plan_type'           => (string) ($r['plan_type'] ?? ''),
            'period_start'        => $this->normalizeNullableString($r['period_start'] ?? null),
            'period_end'          => $this->normalizeNullableString($r['period_end'] ?? null),
            'status'              => (string) ($r['status'] ?? 'draft'),
            'dispatcher_user_id'  => $this->support->parseNullableInt($r['dispatcher_user_id'] ?? null),
            'dispatcher_name'     => $this->normalizeNullableString($r['dispatcher_name'] ?? null),
            'dispatcher_code'     => $this->normalizeNullableString($r['dispatcher_code'] ?? null),
            'total_planned_hours' => (float) ($r['total_planned_hours'] ?? 0),
            'note'                => $this->normalizeNullableString($r['note'] ?? null),
            'item_count'          => isset($r['item_count']) ? (int) $r['item_count'] : null,
            'created_by'          => $this->support->parseNullableInt($r['created_by'] ?? null),
            'updated_by'          => $this->support->parseNullableInt($r['updated_by'] ?? null),
            'created_at'          => $this->normalizeNullableString($r['created_at'] ?? null),
            'updated_at'          => $this->normalizeNullableString($r['updated_at'] ?? null),
        ];
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeItemRow(object|array $row): array
    {
        $r = is_object($row) ? (array) $row : $row;

        return [
            'id'                 => (int) ($r['id'] ?? 0),
            'plan_id'            => (int) ($r['plan_id'] ?? 0),
            'request_case_id'    => (int) ($r['request_case_id'] ?? 0),
            'request_code'       => $this->normalizeNullableString($r['request_code'] ?? null),
            'summary'            => $this->normalizeNullableString($r['summary'] ?? null),
            'current_status_code'=> $this->normalizeNullableString($r['current_status_code'] ?? null),
            'performer_user_id'  => $this->support->parseNullableInt($r['performer_user_id'] ?? null),
            'performer_name'     => $this->normalizeNullableString($r['performer_name'] ?? null),
            'performer_code'     => $this->normalizeNullableString($r['performer_code'] ?? null),
            'planned_hours'      => (float) ($r['planned_hours'] ?? 0),
            'planned_start_date' => $this->normalizeNullableString($r['planned_start_date'] ?? null),
            'planned_end_date'   => $this->normalizeNullableString($r['planned_end_date'] ?? null),
            'priority_order'     => (int) ($r['priority_order'] ?? 0),
            'note'               => $this->normalizeNullableString($r['note'] ?? null),
            'actual_hours'       => (float) ($r['actual_hours'] ?? 0),
            'actual_status'      => (string) ($r['actual_status'] ?? 'pending'),
            'carried_to_plan_id' => $this->support->parseNullableInt($r['carried_to_plan_id'] ?? null),
            'created_by'         => $this->support->parseNullableInt($r['created_by'] ?? null),
            'updated_by'         => $this->support->parseNullableInt($r['updated_by'] ?? null),
            'created_at'         => $this->normalizeNullableString($r['created_at'] ?? null),
            'updated_at'         => $this->normalizeNullableString($r['updated_at'] ?? null),
        ];
    }

    // -------------------------------------------------------------------------
    // Public API methods
    // -------------------------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 100);

        $query = DB::table('customer_request_plans as crp')
            ->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crp.dispatcher_user_id')
            ->selectRaw(
                'crp.id, crp.plan_code, crp.plan_type, crp.period_start, crp.period_end,
                 crp.status, crp.dispatcher_user_id, crp.total_planned_hours, crp.note,
                 crp.created_by, crp.updated_by, crp.created_at, crp.updated_at,
                 dispatcher.full_name as dispatcher_name, dispatcher.user_code as dispatcher_code,
                 (SELECT COUNT(*) FROM customer_request_plan_items WHERE plan_id = crp.id) as item_count'
            )
            ->whereNull('crp.deleted_at');

        // Filters
        $planType = $this->normalizeNullableString($request->query('plan_type'));
        if ($planType !== null) {
            $query->where('crp.plan_type', $planType);
        }

        $status = $this->normalizeNullableString($request->query('status'));
        if ($status !== null) {
            $query->where('crp.status', $status);
        }

        $dispatcherId = $this->support->parseNullableInt($request->query('dispatcher_user_id'));
        if ($dispatcherId !== null) {
            $query->where('crp.dispatcher_user_id', $dispatcherId);
        }

        $periodFrom = $this->normalizeNullableString($request->query('period_from'));
        if ($periodFrom !== null) {
            $query->where('crp.period_start', '>=', $periodFrom);
        }

        $periodTo = $this->normalizeNullableString($request->query('period_to'));
        if ($periodTo !== null) {
            $query->where('crp.period_end', '<=', $periodTo);
        }

        $total = (clone $query)->count();

        $rows = $query
            ->orderByDesc('crp.period_start')
            ->orderByDesc('crp.id')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn (object $row): array => $this->serializePlanRow($row))
            ->values()
            ->all();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $planRow = DB::table('customer_request_plans as crp')
            ->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crp.dispatcher_user_id')
            ->selectRaw(
                'crp.id, crp.plan_code, crp.plan_type, crp.period_start, crp.period_end,
                 crp.status, crp.dispatcher_user_id, crp.total_planned_hours, crp.note,
                 crp.created_by, crp.updated_by, crp.created_at, crp.updated_at,
                 dispatcher.full_name as dispatcher_name, dispatcher.user_code as dispatcher_code'
            )
            ->where('crp.id', $id)
            ->whereNull('crp.deleted_at')
            ->first();

        if ($planRow === null) {
            return response()->json(['message' => 'Kế hoạch không tồn tại.'], 404);
        }

        $itemsQuery = DB::table('customer_request_plan_items as crpi');

        if ($this->support->hasTable('customer_request_cases')) {
            $itemsQuery
                ->leftJoin('customer_request_cases as crc', 'crc.id', '=', 'crpi.request_case_id')
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     crc.request_code, crc.summary, crc.current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        } else {
            $itemsQuery
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     NULL as request_code, NULL as summary, NULL as current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        }

        $items = $itemsQuery
            ->where('crpi.plan_id', $id)
            ->orderBy('crpi.priority_order')
            ->orderBy('crpi.id')
            ->get()
            ->map(fn (object $row): array => $this->serializeItemRow($row))
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'plan'  => $this->serializePlanRow($planRow),
                'items' => $items,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $validated = $request->validate([
            'plan_type'           => 'required|in:weekly,monthly',
            'period_start'        => 'required|date',
            'period_end'          => 'required|date|after_or_equal:period_start',
            'dispatcher_user_id'  => 'required|integer|min:1',
            'note'                => 'nullable|string|max:5000',
        ]);

        $actorId = $this->resolveActorId($request);
        $planCode = $this->generatePlanCode($validated['plan_type'], $validated['period_start']);

        $now = now()->format('Y-m-d H:i:s');
        $insertData = [
            'plan_code'           => $planCode,
            'plan_type'           => $validated['plan_type'],
            'period_start'        => $validated['period_start'],
            'period_end'          => $validated['period_end'],
            'dispatcher_user_id'  => (int) $validated['dispatcher_user_id'],
            'status'              => 'draft',
            'note'                => $this->normalizeNullableString($validated['note'] ?? null),
            'total_planned_hours' => 0,
            'created_by'          => $actorId,
            'updated_by'          => $actorId,
            'created_at'          => $now,
            'updated_at'          => $now,
        ];

        $planId = DB::table('customer_request_plans')->insertGetId(
            $this->support->filterPayloadByTableColumns('customer_request_plans', $insertData)
        );

        $this->auditService->recordAuditEvent($request, 'INSERT', 'customer_request_plans', $planId, null, $insertData);

        $plan = DB::table('customer_request_plans as crp')
            ->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crp.dispatcher_user_id')
            ->selectRaw(
                'crp.id, crp.plan_code, crp.plan_type, crp.period_start, crp.period_end,
                 crp.status, crp.dispatcher_user_id, crp.total_planned_hours, crp.note,
                 crp.created_by, crp.updated_by, crp.created_at, crp.updated_at,
                 dispatcher.full_name as dispatcher_name, dispatcher.user_code as dispatcher_code'
            )
            ->where('crp.id', $planId)
            ->first();

        return response()->json(['data' => $this->serializePlanRow($plan)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $plan = DB::table('customer_request_plans')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($plan === null) {
            return response()->json(['message' => 'Kế hoạch không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'period_start'        => 'sometimes|required|date',
            'period_end'          => 'sometimes|required|date',
            'dispatcher_user_id'  => 'sometimes|required|integer|min:1',
            'note'                => 'nullable|string|max:5000',
            'status'              => 'sometimes|required|in:draft,submitted,approved',
        ]);

        $actorId = $this->resolveActorId($request);
        $oldValues = (array) $plan;

        $updateData = ['updated_by' => $actorId, 'updated_at' => now()->format('Y-m-d H:i:s')];

        if (isset($validated['period_start'])) {
            $updateData['period_start'] = $validated['period_start'];
        }
        if (isset($validated['period_end'])) {
            $updateData['period_end'] = $validated['period_end'];
        }
        if (isset($validated['dispatcher_user_id'])) {
            $updateData['dispatcher_user_id'] = (int) $validated['dispatcher_user_id'];
        }
        if (array_key_exists('note', $validated)) {
            $updateData['note'] = $this->normalizeNullableString($validated['note']);
        }
        if (isset($validated['status'])) {
            $updateData['status'] = $validated['status'];
        }

        DB::table('customer_request_plans')->where('id', $id)->update(
            $this->support->filterPayloadByTableColumns('customer_request_plans', $updateData)
        );

        $this->recalculatePlanHours($id);
        $this->auditService->recordAuditEvent($request, 'UPDATE', 'customer_request_plans', $id, $oldValues, $updateData);

        $updated = DB::table('customer_request_plans as crp')
            ->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crp.dispatcher_user_id')
            ->selectRaw(
                'crp.id, crp.plan_code, crp.plan_type, crp.period_start, crp.period_end,
                 crp.status, crp.dispatcher_user_id, crp.total_planned_hours, crp.note,
                 crp.created_by, crp.updated_by, crp.created_at, crp.updated_at,
                 dispatcher.full_name as dispatcher_name, dispatcher.user_code as dispatcher_code'
            )
            ->where('crp.id', $id)
            ->first();

        return response()->json(['data' => $this->serializePlanRow($updated)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $plan = DB::table('customer_request_plans')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if ($plan === null) {
            return response()->json(['message' => 'Kế hoạch không tồn tại.'], 404);
        }

        // Only admin or creator can delete
        $actorId = $this->resolveActorId($request);
        $createdBy = $this->support->parseNullableInt($plan->created_by ?? null);
        $isAdmin = $request->user()?->hasRole('admin') ?? false;

        if (! $isAdmin && $actorId !== $createdBy) {
            return response()->json(['message' => 'Bạn không có quyền xóa kế hoạch này.'], 403);
        }

        $oldValues = (array) $plan;

        DB::table('customer_request_plans')
            ->where('id', $id)
            ->update([
                'deleted_at' => now()->format('Y-m-d H:i:s'),
                'updated_by' => $actorId,
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);

        $this->auditService->recordAuditEvent($request, 'DELETE', 'customer_request_plans', $id, $oldValues, null);

        return response()->json(['message' => 'Đã xóa kế hoạch.']);
    }

    public function storeItem(Request $request, int $planId): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $plan = DB::table('customer_request_plans')
            ->where('id', $planId)
            ->whereNull('deleted_at')
            ->first();

        if ($plan === null) {
            return response()->json(['message' => 'Kế hoạch không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'request_case_id'    => 'required|integer|min:1',
            'performer_user_id'  => 'required|integer|min:1',
            'planned_hours'      => 'required|numeric|min:0.5',
            'planned_start_date' => 'nullable|date',
            'planned_end_date'   => 'nullable|date',
            'priority_order'     => 'nullable|integer',
            'note'               => 'nullable|string|max:500',
        ]);

        // Check request_case_id exists
        if ($this->support->hasTable('customer_request_cases')) {
            $caseExists = DB::table('customer_request_cases')
                ->where('id', $validated['request_case_id'])
                ->whereNull('deleted_at')
                ->exists();

            if (! $caseExists) {
                return response()->json(['message' => 'Yêu cầu không tồn tại.', 'errors' => ['request_case_id' => ['Yêu cầu không tồn tại.']]], 422);
            }
        }

        // Check performer_user_id exists
        if ($this->support->hasTable('internal_users')) {
            $performerExists = DB::table('internal_users')
                ->where('id', $validated['performer_user_id'])
                ->exists();

            if (! $performerExists) {
                return response()->json(['message' => 'Người thực hiện không tồn tại.', 'errors' => ['performer_user_id' => ['Người thực hiện không tồn tại.']]], 422);
            }
        }

        // Check uniqueness (plan_id, request_case_id)
        $duplicate = DB::table('customer_request_plan_items')
            ->where('plan_id', $planId)
            ->where('request_case_id', $validated['request_case_id'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'Yêu cầu này đã tồn tại trong kế hoạch.',
                'errors'  => ['request_case_id' => ['Yêu cầu này đã tồn tại trong kế hoạch.']],
            ], 422);
        }

        $actorId = $this->resolveActorId($request);
        $now = now()->format('Y-m-d H:i:s');

        $insertData = [
            'plan_id'            => $planId,
            'request_case_id'    => (int) $validated['request_case_id'],
            'performer_user_id'  => (int) $validated['performer_user_id'],
            'planned_hours'      => (float) $validated['planned_hours'],
            'planned_start_date' => $this->normalizeNullableString($validated['planned_start_date'] ?? null),
            'planned_end_date'   => $this->normalizeNullableString($validated['planned_end_date'] ?? null),
            'priority_order'     => (int) ($validated['priority_order'] ?? 0),
            'note'               => $this->normalizeNullableString($validated['note'] ?? null),
            'actual_hours'       => 0,
            'actual_status'      => 'pending',
            'created_by'         => $actorId,
            'updated_by'         => $actorId,
            'created_at'         => $now,
            'updated_at'         => $now,
        ];

        $itemId = DB::table('customer_request_plan_items')->insertGetId(
            $this->support->filterPayloadByTableColumns('customer_request_plan_items', $insertData)
        );

        $this->recalculatePlanHours($planId);

        // Load item with joins
        $itemQuery = DB::table('customer_request_plan_items as crpi');

        if ($this->support->hasTable('customer_request_cases')) {
            $itemQuery
                ->leftJoin('customer_request_cases as crc', 'crc.id', '=', 'crpi.request_case_id')
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     crc.request_code, crc.summary, crc.current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        } else {
            $itemQuery
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     NULL as request_code, NULL as summary, NULL as current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        }

        $item = $itemQuery->where('crpi.id', $itemId)->first();

        return response()->json(['data' => $this->serializeItemRow($item)], 201);
    }

    public function updateItem(Request $request, int $planId, int $itemId): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $item = DB::table('customer_request_plan_items')
            ->where('id', $itemId)
            ->where('plan_id', $planId)
            ->first();

        if ($item === null) {
            return response()->json(['message' => 'Mục kế hoạch không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'performer_user_id'  => 'sometimes|required|integer|min:1',
            'planned_hours'      => 'sometimes|required|numeric|min:0.5',
            'planned_start_date' => 'nullable|date',
            'planned_end_date'   => 'nullable|date',
            'priority_order'     => 'nullable|integer',
            'note'               => 'nullable|string|max:500',
            'actual_hours'       => 'nullable|numeric|min:0',
            'actual_status'      => 'nullable|in:pending,in_progress,completed,carried_over,cancelled',
        ]);

        $actorId = $this->resolveActorId($request);
        $oldValues = (array) $item;
        $updateData = ['updated_by' => $actorId, 'updated_at' => now()->format('Y-m-d H:i:s')];

        $fields = ['performer_user_id', 'planned_hours', 'planned_start_date', 'planned_end_date', 'priority_order', 'note', 'actual_hours', 'actual_status'];
        foreach ($fields as $field) {
            if (array_key_exists($field, $validated)) {
                $updateData[$field] = $validated[$field];
            }
        }

        DB::table('customer_request_plan_items')->where('id', $itemId)->update(
            $this->support->filterPayloadByTableColumns('customer_request_plan_items', $updateData)
        );

        $this->recalculatePlanHours($planId);

        $itemQuery = DB::table('customer_request_plan_items as crpi');

        if ($this->support->hasTable('customer_request_cases')) {
            $itemQuery
                ->leftJoin('customer_request_cases as crc', 'crc.id', '=', 'crpi.request_case_id')
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     crc.request_code, crc.summary, crc.current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        } else {
            $itemQuery
                ->leftJoin('internal_users as performer', 'performer.id', '=', 'crpi.performer_user_id')
                ->selectRaw(
                    'crpi.id, crpi.plan_id, crpi.request_case_id, crpi.performer_user_id,
                     crpi.planned_hours, crpi.planned_start_date, crpi.planned_end_date,
                     crpi.priority_order, crpi.note, crpi.actual_hours, crpi.actual_status,
                     crpi.carried_to_plan_id, crpi.created_by, crpi.updated_by, crpi.created_at, crpi.updated_at,
                     NULL as request_code, NULL as summary, NULL as current_status_code,
                     performer.full_name as performer_name, performer.user_code as performer_code'
                );
        }

        $updatedItem = $itemQuery->where('crpi.id', $itemId)->first();

        return response()->json(['data' => $this->serializeItemRow($updatedItem)]);
    }

    public function destroyItem(Request $request, int $planId, int $itemId): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $item = DB::table('customer_request_plan_items')
            ->where('id', $itemId)
            ->where('plan_id', $planId)
            ->first();

        if ($item === null) {
            return response()->json(['message' => 'Mục kế hoạch không tồn tại.'], 404);
        }

        DB::table('customer_request_plan_items')->where('id', $itemId)->delete();

        $this->recalculatePlanHours($planId);

        return response()->json(['message' => 'Đã xóa mục kế hoạch.']);
    }

    public function carryOver(Request $request, int $planId): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $sourcePlan = DB::table('customer_request_plans')
            ->where('id', $planId)
            ->whereNull('deleted_at')
            ->first();

        if ($sourcePlan === null) {
            return response()->json(['message' => 'Kế hoạch nguồn không tồn tại.'], 404);
        }

        $validated = $request->validate([
            'target_plan_id' => 'required|integer|min:1|different:' . $planId,
        ]);

        $targetPlanId = (int) $validated['target_plan_id'];

        $targetPlan = DB::table('customer_request_plans')
            ->where('id', $targetPlanId)
            ->whereNull('deleted_at')
            ->first();

        if ($targetPlan === null) {
            return response()->json(['message' => 'Kế hoạch đích không tồn tại.', 'errors' => ['target_plan_id' => ['Kế hoạch đích không tồn tại.']]], 422);
        }

        $actorId = $this->resolveActorId($request);
        $now = now()->format('Y-m-d H:i:s');

        // Get pending items from source plan
        $pendingItems = DB::table('customer_request_plan_items')
            ->where('plan_id', $planId)
            ->where('actual_status', 'pending')
            ->get();

        $carriedCount = 0;

        DB::transaction(function () use ($pendingItems, $planId, $targetPlanId, $actorId, $now, &$carriedCount): void {
            foreach ($pendingItems as $item) {
                // Skip if already exists in target plan
                $duplicate = DB::table('customer_request_plan_items')
                    ->where('plan_id', $targetPlanId)
                    ->where('request_case_id', $item->request_case_id)
                    ->exists();

                if ($duplicate) {
                    continue;
                }

                // Insert into target plan
                $newItemData = [
                    'plan_id'            => $targetPlanId,
                    'request_case_id'    => (int) $item->request_case_id,
                    'performer_user_id'  => (int) $item->performer_user_id,
                    'planned_hours'      => (float) $item->planned_hours,
                    'planned_start_date' => $item->planned_start_date,
                    'planned_end_date'   => $item->planned_end_date,
                    'priority_order'     => (int) $item->priority_order,
                    'note'               => $item->note,
                    'actual_hours'       => 0,
                    'actual_status'      => 'pending',
                    'carried_to_plan_id' => null,
                    'created_by'         => $actorId,
                    'updated_by'         => $actorId,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ];

                DB::table('customer_request_plan_items')->insert(
                    $this->support->filterPayloadByTableColumns('customer_request_plan_items', $newItemData)
                );

                // Mark original as carried_over
                DB::table('customer_request_plan_items')
                    ->where('id', $item->id)
                    ->update([
                        'actual_status'      => 'carried_over',
                        'carried_to_plan_id' => $targetPlanId,
                        'updated_by'         => $actorId,
                        'updated_at'         => $now,
                    ]);

                $carriedCount++;
            }
        });

        // Recalculate hours for both plans
        $this->recalculatePlanHours($planId);
        $this->recalculatePlanHours($targetPlanId);

        return response()->json([
            'data' => [
                'carried_count'  => $carriedCount,
                'target_plan_id' => $targetPlanId,
            ],
        ]);
    }

    public function backlog(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        if (! $this->support->hasTable('customer_request_cases')) {
            return response()->json(['data' => []]);
        }

        $closedStatuses = ['completed', 'customer_notified', 'not_executed'];

        $query = DB::table('customer_request_cases as crc')
            ->whereNull('crc.deleted_at')
            ->whereNotIn('crc.current_status_code', $closedStatuses)
            ->whereNotIn('crc.id', function ($sub): void {
                $sub->select('request_case_id')
                    ->from('customer_request_plan_items');
            });

        // Join customers
        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as cust', 'cust.id', '=', 'crc.customer_id');
        }

        // Join projects
        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as proj', 'proj.id', '=', 'crc.project_id');
        }

        // Join performer
        if ($this->support->hasTable('internal_users')) {
            $query->leftJoin('internal_users as performer', 'performer.id', '=', 'crc.performer_user_id');
        }

        $hasCust = $this->support->hasTable('customers');
        $hasProj = $this->support->hasTable('projects');
        $hasUsers = $this->support->hasTable('internal_users');

        $selectParts = [
            'crc.id',
            'crc.request_code',
            'crc.summary',
            'crc.current_status_code',
            'crc.priority',
            'crc.customer_id',
            'crc.project_id',
            'crc.performer_user_id',
            'crc.updated_at',
        ];

        // Optional metrics columns (may not exist in all environments)
        if ($this->support->hasColumn('customer_request_cases', 'total_hours_spent')) {
            $selectParts[] = 'crc.total_hours_spent';
        } else {
            $selectParts[] = '0 as total_hours_spent';
        }
        if ($this->support->hasColumn('customer_request_cases', 'estimated_hours')) {
            $selectParts[] = 'crc.estimated_hours';
        } else {
            $selectParts[] = 'NULL as estimated_hours';
        }

        if ($hasCust) {
            $selectParts[] = 'cust.customer_name';
        } else {
            $selectParts[] = 'NULL as customer_name';
        }

        if ($hasProj) {
            $selectParts[] = 'proj.project_name';
        } else {
            $selectParts[] = 'NULL as project_name';
        }

        if ($hasUsers) {
            $selectParts[] = 'performer.full_name as performer_name';
        } else {
            $selectParts[] = 'NULL as performer_name';
        }

        $rows = $query
            ->selectRaw(implode(', ', $selectParts))
            ->orderByDesc('crc.priority')
            ->orderByDesc('crc.updated_at')
            ->limit(50)
            ->get()
            ->map(fn (object $row): array => [
                'id'                  => (int) $row->id,
                'request_code'        => (string) ($row->request_code ?? ''),
                'summary'             => $this->normalizeNullableString($row->summary ?? null),
                'current_status_code' => $this->normalizeNullableString($row->current_status_code ?? null),
                'priority'            => $this->support->parseNullableInt($row->priority ?? null),
                'customer_id'         => $this->support->parseNullableInt($row->customer_id ?? null),
                'customer_name'       => $this->normalizeNullableString($row->customer_name ?? null),
                'project_id'          => $this->support->parseNullableInt($row->project_id ?? null),
                'project_name'        => $this->normalizeNullableString($row->project_name ?? null),
                'performer_user_id'   => $this->support->parseNullableInt($row->performer_user_id ?? null),
                'performer_name'      => $this->normalizeNullableString($row->performer_name ?? null),
                'total_hours_spent'   => (float) ($row->total_hours_spent ?? 0),
                'estimated_hours'     => isset($row->estimated_hours) ? (float) $row->estimated_hours : null,
                'updated_at'          => $this->normalizeNullableString($row->updated_at ?? null),
            ])
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }
}
