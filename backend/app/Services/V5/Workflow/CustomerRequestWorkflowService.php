<?php

namespace App\Services\V5\Workflow;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CustomerRequestWorkflowService
{
    /**
     * @var array<string, bool>
     */
    private array $tableCache = [];

    /**
     * @var array<string, bool>
     */
    private array $columnCache = [];

    public function __construct(
        private readonly WorkflowFlowResolver $flowResolver,
        private readonly StatusDrivenSlaResolver $slaResolver
    ) {
    }

    /**
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(Request $request): array
    {
        $this->assertTable('customer_requests');

        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(200, max(1, (int) $request->query('per_page', 20)));
        $q = trim((string) $request->query('q', ''));
        $status = $this->normalizeToken($request->query('status'));
        $subStatus = $this->normalizeToken($request->query('sub_status'));

        $query = DB::table('customer_requests as cr')
            ->leftJoin('customers as c', 'cr.customer_id', '=', 'c.id')
            ->leftJoin('support_service_groups as ssg', 'cr.service_group_id', '=', 'ssg.id')
            ->leftJoin('internal_users as iu_assignee', 'cr.assignee_id', '=', 'iu_assignee.id')
            ->leftJoin('internal_users as iu_receiver', 'cr.receiver_user_id', '=', 'iu_receiver.id')
            ->leftJoin('workflow_status_catalogs as wsc', 'cr.status_catalog_id', '=', 'wsc.id')
            ->whereNull('cr.deleted_at');

        $hasReporterContactJoin = $this->hasTable('customer_personnel')
            && $this->hasColumn('customer_requests', 'reporter_contact_id');
        if ($hasReporterContactJoin) {
            $query->leftJoin('customer_personnel as cp', 'cr.reporter_contact_id', '=', 'cp.id');
        }

        if ($q !== '') {
            $like = '%'.$q.'%';
            $query->where(function ($builder) use ($like): void {
                $builder
                    ->where('cr.request_code', 'like', $like)
                    ->orWhere('cr.summary', 'like', $like)
                    ->orWhere('cr.status', 'like', $like)
                    ->orWhere('cr.sub_status', 'like', $like)
                    ->orWhere('cr.notes', 'like', $like)
                    ->orWhere('c.customer_name', 'like', $like)
                    ->orWhere('iu_assignee.full_name', 'like', $like)
                    ->orWhere('iu_receiver.full_name', 'like', $like);
            });
        }

        if ($status !== '') {
            $query->whereRaw('UPPER(TRIM(cr.status)) = ?', [$status]);
        }

        if ($subStatus !== '') {
            $query->whereRaw('UPPER(TRIM(COALESCE(cr.sub_status, ""))) = ?', [$subStatus]);
        }

        $total = (clone $query)->count('cr.id');
        $selects = [
            'cr.id',
            'cr.uuid',
            'cr.request_code',
            'cr.status_catalog_id',
            'cr.summary',
            'cr.project_item_id',
            'cr.customer_id',
            'cr.project_id',
            'cr.product_id',
            'c.customer_name',
            'cr.requester_name',
            'cr.reporter_contact_id',
            'cr.service_group_id',
            'ssg.group_name as service_group_name',
            'cr.receiver_user_id',
            'iu_receiver.full_name as receiver_name',
            'cr.assignee_id',
            'iu_assignee.full_name as assignee_name',
            'cr.reference_ticket_code',
            'cr.reference_request_id',
            'cr.status',
            'cr.sub_status',
            'cr.priority',
            'cr.requested_date',
            'cr.latest_transition_id',
            'cr.notes',
            'cr.transition_metadata',
            'cr.created_at',
            'cr.created_by',
            'cr.updated_at',
            'cr.updated_by',
            'wsc.status_name as status_name',
            'wsc.flow_step as status_flow_step',
            'wsc.form_key as status_form_key',
        ];
        if ($hasReporterContactJoin) {
            if ($this->hasColumn('customer_personnel', 'full_name')) {
                $selects[] = 'cp.full_name as reporter_contact_name';
            }
            if ($this->hasColumn('customer_personnel', 'phone_number')) {
                $selects[] = 'cp.phone_number as reporter_contact_phone';
            } elseif ($this->hasColumn('customer_personnel', 'phone')) {
                $selects[] = 'cp.phone as reporter_contact_phone';
            }
            if ($this->hasColumn('customer_personnel', 'email')) {
                $selects[] = 'cp.email as reporter_contact_email';
            }
        }

        $rows = $query
            ->select($selects)
            ->orderByDesc('cr.requested_date')
            ->orderByDesc('cr.id')
            ->forPage($page, $perPage)
            ->get();

        $data = $rows
            ->map(fn (object $row): array => $this->serializeCustomerRequestRow((array) $row))
            ->values()
            ->all();

        return [
            'data' => $data,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $perPage > 0 ? (int) ceil(((int) $total) / $perPage) : 1,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function create(array $payload, ?int $actorId): array
    {
        $this->assertTable('customer_requests');
        $payload = $this->canonicalizeCustomerRequestPayload($payload);

        [$status, $subStatus, $statusCatalogId] = $this->resolveStatusValuesFromPayload($payload);
        $priority = $this->normalizePriority((string) ($payload['priority'] ?? 'MEDIUM'));
        $now = now();

        return DB::transaction(function () use ($payload, $actorId, $status, $subStatus, $priority, $statusCatalogId, $now): array {
            $insertPayload = $this->filterPayloadByTable('customer_requests', [
                'uuid' => $this->generateUuid(),
                'request_code' => 'TMP'.now()->format('YmdHis').str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT),
                'status_catalog_id' => $statusCatalogId,
                'summary' => $this->toNullableText($payload['summary'] ?? null) ?? 'N/A',
                'project_item_id' => $this->parseNullableInt($payload['project_item_id'] ?? null),
                'customer_id' => $this->parseNullableInt($payload['customer_id'] ?? null),
                'project_id' => $this->parseNullableInt($payload['project_id'] ?? null),
                'product_id' => $this->parseNullableInt($payload['product_id'] ?? null),
                'requester_name' => $this->toNullableText($payload['requester_name'] ?? null),
                'reporter_contact_id' => $this->parseNullableInt($payload['reporter_contact_id'] ?? null),
                'service_group_id' => $this->parseNullableInt($payload['service_group_id'] ?? null),
                'receiver_user_id' => $this->parseNullableInt($payload['receiver_user_id'] ?? null),
                'assignee_id' => $this->parseNullableInt($payload['assignee_id'] ?? null),
                'status' => $status,
                'sub_status' => $subStatus,
                'priority' => $priority,
                'requested_date' => $this->normalizeDate($payload['requested_date'] ?? null) ?? now()->toDateString(),
                'latest_transition_id' => null,
                'reference_ticket_code' => $this->toNullableText($payload['reference_ticket_code'] ?? null),
                'reference_request_id' => $this->parseNullableInt($payload['reference_request_id'] ?? null),
                'notes' => $this->toNullableText($payload['notes'] ?? null),
                'transition_metadata' => $this->encodeJson($payload['transition_metadata'] ?? null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_at' => $now,
                'updated_by' => $actorId,
                'deleted_at' => null,
            ]);

            $insertId = (int) DB::table('customer_requests')->insertGetId($insertPayload);
            $requestCode = $this->buildRequestCode($insertId, $now);
            DB::table('customer_requests')->where('id', $insertId)->update(['request_code' => $requestCode]);

            $transitionId = $this->appendTransition([
                'request_code' => $requestCode,
                'request_summary' => $insertPayload['summary'] ?? null,
                'customer_id' => $insertPayload['customer_id'] ?? null,
                'project_id' => $insertPayload['project_id'] ?? null,
                'project_item_id' => $insertPayload['project_item_id'] ?? null,
                'from_status' => null,
                'to_status' => $status,
                'sub_status' => $subStatus,
                'new_assignee_id' => $insertPayload['assignee_id'] ?? null,
                'hours_estimated' => $this->parseNullableFloat($payload['hours_estimated'] ?? null),
                'transition_metadata' => Arr::wrap($payload['transition_metadata'] ?? []),
                'transition_note' => $this->toNullableText($payload['transition_note'] ?? $payload['notes'] ?? null),
                'internal_note' => $this->toNullableText($payload['internal_note'] ?? null),
                'priority' => $priority,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if ($transitionId !== null) {
                DB::table('customer_requests')->where('id', $insertId)->update(['latest_transition_id' => $transitionId]);
            }

            $this->appendTransitionRefTasks($requestCode, $transitionId, $payload, $actorId);
            $this->appendWorklogs($requestCode, $status, $subStatus, $payload, $actorId);

            return $this->getById($insertId);
        });
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function update(int $id, array $payload, ?int $actorId): array
    {
        $this->assertTable('customer_requests');
        $payload = $this->canonicalizeCustomerRequestPayload($payload);

        $current = DB::table('customer_requests')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $current) {
            throw new \RuntimeException('Không tìm thấy yêu cầu khách hàng.');
        }

        [$status, $subStatus, $statusCatalogId] = $this->resolveStatusValuesFromPayload(
            array_merge((array) $current, $payload)
        );
        $priority = $this->normalizePriority((string) ($payload['priority'] ?? $current->priority ?? 'MEDIUM'));

        return DB::transaction(function () use ($id, $payload, $actorId, $current, $status, $subStatus, $statusCatalogId, $priority): array {
            $updatePayload = $this->filterPayloadByTable('customer_requests', [
                'status_catalog_id' => $statusCatalogId,
                'summary' => $this->toNullableText($payload['summary'] ?? null) ?? $current->summary,
                'project_item_id' => array_key_exists('project_item_id', $payload)
                    ? $this->parseNullableInt($payload['project_item_id'])
                    : $current->project_item_id,
                'customer_id' => array_key_exists('customer_id', $payload)
                    ? $this->parseNullableInt($payload['customer_id'])
                    : $current->customer_id,
                'project_id' => array_key_exists('project_id', $payload)
                    ? $this->parseNullableInt($payload['project_id'])
                    : $current->project_id,
                'product_id' => array_key_exists('product_id', $payload)
                    ? $this->parseNullableInt($payload['product_id'])
                    : $current->product_id,
                'requester_name' => array_key_exists('requester_name', $payload)
                    ? $this->toNullableText($payload['requester_name'])
                    : $current->requester_name,
                'reporter_contact_id' => array_key_exists('reporter_contact_id', $payload)
                    ? $this->parseNullableInt($payload['reporter_contact_id'])
                    : $current->reporter_contact_id,
                'service_group_id' => array_key_exists('service_group_id', $payload)
                    ? $this->parseNullableInt($payload['service_group_id'])
                    : $current->service_group_id,
                'receiver_user_id' => array_key_exists('receiver_user_id', $payload)
                    ? $this->parseNullableInt($payload['receiver_user_id'])
                    : $current->receiver_user_id,
                'assignee_id' => array_key_exists('assignee_id', $payload)
                    ? $this->parseNullableInt($payload['assignee_id'])
                    : $current->assignee_id,
                'status' => $status,
                'sub_status' => $subStatus,
                'priority' => $priority,
                'requested_date' => array_key_exists('requested_date', $payload)
                    ? ($this->normalizeDate($payload['requested_date']) ?? $current->requested_date)
                    : $current->requested_date,
                'reference_ticket_code' => array_key_exists('reference_ticket_code', $payload)
                    ? $this->toNullableText($payload['reference_ticket_code'])
                    : $current->reference_ticket_code,
                'reference_request_id' => array_key_exists('reference_request_id', $payload)
                    ? $this->parseNullableInt($payload['reference_request_id'])
                    : $current->reference_request_id,
                'notes' => array_key_exists('notes', $payload)
                    ? $this->toNullableText($payload['notes'])
                    : $current->notes,
                'transition_metadata' => array_key_exists('transition_metadata', $payload)
                    ? $this->encodeJson($payload['transition_metadata'])
                    : $current->transition_metadata,
                'updated_at' => now(),
                'updated_by' => $actorId,
            ]);

            DB::table('customer_requests')->where('id', $id)->update($updatePayload);

            $shouldAppendTransition = $this->normalizeToken($current->status) !== $status
                || $this->normalizeToken($current->sub_status) !== $this->normalizeToken($subStatus)
                || array_key_exists('transition_metadata', $payload)
                || array_key_exists('transition_note', $payload)
                || ! empty($payload['worklogs'])
                || ! empty($payload['ref_tasks'])
                || ! empty($payload['tasks']);

            if ($shouldAppendTransition && ! empty($current->request_code)) {
                $transitionId = $this->appendTransition([
                    'request_code' => (string) $current->request_code,
                    'request_summary' => $updatePayload['summary'] ?? $current->summary,
                    'customer_id' => $updatePayload['customer_id'] ?? $current->customer_id,
                    'project_id' => $updatePayload['project_id'] ?? $current->project_id,
                    'project_item_id' => $updatePayload['project_item_id'] ?? $current->project_item_id,
                    'from_status' => (string) $current->status,
                    'to_status' => $status,
                    'sub_status' => $subStatus,
                    'new_assignee_id' => $updatePayload['assignee_id'] ?? $current->assignee_id,
                    'hours_estimated' => $this->parseNullableFloat($payload['hours_estimated'] ?? null),
                    'transition_metadata' => Arr::wrap($payload['transition_metadata'] ?? []),
                    'transition_note' => $this->toNullableText($payload['transition_note'] ?? $payload['notes'] ?? null),
                    'internal_note' => $this->toNullableText($payload['internal_note'] ?? null),
                    'priority' => $priority,
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);

                if ($transitionId !== null) {
                    DB::table('customer_requests')->where('id', $id)->update(['latest_transition_id' => $transitionId]);
                }

                $this->appendTransitionRefTasks((string) $current->request_code, $transitionId, $payload, $actorId);
                $this->appendWorklogs((string) $current->request_code, $status, $subStatus, $payload, $actorId);
            }

            return $this->getById($id);
        });
    }

    public function delete(int $id, ?int $actorId): void
    {
        $this->assertTable('customer_requests');

        DB::table('customer_requests')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => now(),
                'updated_at' => now(),
                'updated_by' => $actorId,
            ]);
    }

    /**
     * @return array<string,mixed>
     */
    public function history(int $id): array
    {
        $this->assertTable('customer_requests');

        $request = $this->getById($id);
        $requestCode = (string) ($request['request_code'] ?? '');

        $transitions = $this->hasTable('request_transitions')
            ? DB::table('request_transitions')
                ->where('request_code', $requestCode)
                ->whereNull('deleted_at')
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (object $row): array => (array) $row)
                ->values()
                ->all()
            : [];

        $worklogs = $this->hasTable('request_worklogs')
            ? DB::table('request_worklogs')
                ->where('request_code', $requestCode)
                ->whereNull('deleted_at')
                ->orderByDesc('report_date')
                ->orderByDesc('id')
                ->get()
                ->map(fn (object $row): array => (array) $row)
                ->values()
                ->all()
            : [];

        $refTasks = $this->hasTable('request_ref_tasks')
            ? DB::table('request_ref_tasks')
                ->where('request_code', $requestCode)
                ->whereNull('deleted_at')
                ->orderBy('source_type')
                ->orderBy('source_id')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(fn (object $row): array => (array) $row)
                ->values()
                ->all()
            : [];

        return [
            'request' => $request,
            'transitions' => $transitions,
            'worklogs' => $worklogs,
            'ref_tasks' => $refTasks,
        ];
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function histories(?int $requestId = null, int $limit = 200): array
    {
        $this->assertTable('customer_requests');
        $limit = max(1, min(1000, $limit));

        $requestQuery = DB::table('customer_requests as cr')
            ->select(['cr.id', 'cr.request_code', 'cr.summary'])
            ->whereNull('cr.deleted_at');

        if ($requestId !== null) {
            $requestQuery->where('cr.id', $requestId);
        }

        $requestRows = $requestQuery
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        if ($requestRows === []) {
            return [];
        }

        $requestByCode = [];
        foreach ($requestRows as $row) {
            $requestCode = $this->toNullableText($row['request_code'] ?? null);
            if ($requestCode === null) {
                continue;
            }
            $requestByCode[$requestCode] = [
                'request_id' => (int) ($row['id'] ?? 0),
                'request_code' => $requestCode,
                'request_summary' => $this->toNullableText($row['summary'] ?? null),
            ];
        }

        $requestCodes = array_keys($requestByCode);
        if ($requestCodes === []) {
            return [];
        }

        $joinUsers = $this->hasTable('internal_users');
        $selectActorColumns = [];
        if ($joinUsers) {
            if ($this->hasColumn('internal_users', 'full_name')) {
                $selectActorColumns[] = 'iu.full_name as actor_full_name';
            }
            if ($this->hasColumn('internal_users', 'username')) {
                $selectActorColumns[] = 'iu.username as actor_username';
            }
            if ($this->hasColumn('internal_users', 'user_code')) {
                $selectActorColumns[] = 'iu.user_code as actor_user_code';
            }
        }

        $feed = [];

        if ($this->hasTable('request_transitions')) {
            $transitionQuery = DB::table('request_transitions as rt')
                ->whereIn('rt.request_code', $requestCodes);
            $hasTransitionMetadata = $this->hasColumn('request_transitions', 'transition_metadata');

            if ($this->hasColumn('request_transitions', 'deleted_at')) {
                $transitionQuery->whereNull('rt.deleted_at');
            }
            if ($joinUsers) {
                $transitionQuery->leftJoin('internal_users as iu', 'rt.created_by', '=', 'iu.id');
            }

            $transitionSelects = [
                'rt.id',
                'rt.request_code',
                'rt.from_status',
                'rt.to_status',
                'rt.sub_status',
                'rt.transition_note',
                'rt.internal_note',
                'rt.created_at',
                'rt.created_by',
            ];
            if ($this->hasColumn('request_transitions', 'request_summary')) {
                $transitionSelects[] = 'rt.request_summary';
            }
            if ($hasTransitionMetadata) {
                $transitionSelects[] = 'rt.transition_metadata';
            }
            $transitionSelects = array_values(array_filter([...$transitionSelects, ...$selectActorColumns]));

            $transitionRows = $transitionQuery
                ->select($transitionSelects)
                ->orderByDesc('rt.created_at')
                ->orderByDesc('rt.id')
                ->get();

            foreach ($transitionRows as $row) {
                $requestCode = $this->toNullableText($row->request_code ?? null);
                if ($requestCode === null || ! isset($requestByCode[$requestCode])) {
                    continue;
                }
                $requestMeta = $requestByCode[$requestCode];
                $transitionMetadata = $this->decodeTransitionMetadata($row->transition_metadata ?? null);
                $pauseReason = $this->extractTransitionMetadataText($transitionMetadata, [
                    'pause_reason',
                    'noidungtamngung',
                ]);
                $upcodeStatus = $this->extractTransitionMetadataStatus($transitionMetadata, [
                    'upcode_status',
                    'trangthaiupcode',
                ]);
                $progress = $this->extractTransitionMetadataProgress($transitionMetadata, [
                    'progress',
                    'progress_percent',
                    'processing_progress',
                    'tiendo',
                ]);

                $feed[] = [
                    'source_type' => 'TRANSITION',
                    'request_id' => (int) ($requestMeta['request_id'] ?? 0),
                    'request_code' => $requestMeta['request_code'] ?? $requestCode,
                    'request_summary' => $this->toNullableText($row->request_summary ?? null)
                        ?? ($requestMeta['request_summary'] ?? null),
                    'task_code' => null,
                    'old_status' => $this->normalizeNullableStatus($row->from_status ?? null),
                    'new_status' => $this->normalizeNullableStatus($row->to_status ?? null),
                    'sub_status' => $this->normalizeNullableStatus($row->sub_status ?? null),
                    'note' => $this->toNullableText($row->transition_note ?? null)
                        ?? $this->toNullableText($row->internal_note ?? null),
                    'transition_metadata' => $transitionMetadata,
                    'pause_reason' => $pauseReason,
                    'upcode_status' => $upcodeStatus,
                    'progress' => $progress,
                    'actor_name' => $this->resolveHistoryActorName((array) $row),
                    'occurred_at' => $this->toNullableText($row->created_at ?? null),
                ];
            }
        }

        if ($this->hasTable('request_worklogs')) {
            $worklogQuery = DB::table('request_worklogs as wl')
                ->whereIn('wl.request_code', $requestCodes);

            if ($this->hasColumn('request_worklogs', 'deleted_at')) {
                $worklogQuery->whereNull('wl.deleted_at');
            }
            if ($joinUsers) {
                $worklogQuery->leftJoin('internal_users as iu', 'wl.created_by', '=', 'iu.id');
            }

            $worklogSelects = [
                'wl.id',
                'wl.request_code',
                'wl.phase',
                'wl.worklog_note',
                'wl.internal_note',
                'wl.report_date',
                'wl.created_at',
                'wl.created_by',
            ];
            if ($this->hasColumn('request_worklogs', 'request_summary')) {
                $worklogSelects[] = 'wl.request_summary';
            }
            $worklogSelects = array_values(array_filter([...$worklogSelects, ...$selectActorColumns]));

            $worklogRows = $worklogQuery
                ->select($worklogSelects)
                ->orderByDesc('wl.created_at')
                ->orderByDesc('wl.id')
                ->get();

            foreach ($worklogRows as $row) {
                $requestCode = $this->toNullableText($row->request_code ?? null);
                if ($requestCode === null || ! isset($requestByCode[$requestCode])) {
                    continue;
                }
                $requestMeta = $requestByCode[$requestCode];

                $feed[] = [
                    'source_type' => 'WORKLOG',
                    'request_id' => (int) ($requestMeta['request_id'] ?? 0),
                    'request_code' => $requestMeta['request_code'] ?? $requestCode,
                    'request_summary' => $this->toNullableText($row->request_summary ?? null)
                        ?? ($requestMeta['request_summary'] ?? null),
                    'task_code' => null,
                    'old_status' => null,
                    'new_status' => $this->normalizeNullableStatus($row->phase ?? null),
                    'sub_status' => null,
                    'note' => $this->toNullableText($row->worklog_note ?? null)
                        ?? $this->toNullableText($row->internal_note ?? null),
                    'actor_name' => $this->resolveHistoryActorName((array) $row),
                    'occurred_at' => $this->toNullableText($row->created_at ?? null)
                        ?? $this->toNullableText($row->report_date ?? null),
                ];
            }
        }

        if ($this->hasTable('request_ref_tasks')) {
            $refTaskQuery = DB::table('request_ref_tasks as rft')
                ->whereIn('rft.request_code', $requestCodes);

            if ($this->hasColumn('request_ref_tasks', 'deleted_at')) {
                $refTaskQuery->whereNull('rft.deleted_at');
            }
            if ($joinUsers) {
                $refTaskQuery->leftJoin('internal_users as iu', 'rft.created_by', '=', 'iu.id');
            }

            $refTaskSelects = [
                'rft.id',
                'rft.request_code',
                'rft.task_code',
                'rft.task_status',
                'rft.task_note',
                'rft.task_link',
                'rft.created_at',
                'rft.created_by',
            ];
            $refTaskSelects = array_values(array_filter([...$refTaskSelects, ...$selectActorColumns]));

            $refTaskRows = $refTaskQuery
                ->select($refTaskSelects)
                ->orderByDesc('rft.created_at')
                ->orderByDesc('rft.id')
                ->get();

            foreach ($refTaskRows as $row) {
                $requestCode = $this->toNullableText($row->request_code ?? null);
                if ($requestCode === null || ! isset($requestByCode[$requestCode])) {
                    continue;
                }
                $requestMeta = $requestByCode[$requestCode];

                $feed[] = [
                    'source_type' => 'REF_TASK',
                    'request_id' => (int) ($requestMeta['request_id'] ?? 0),
                    'request_code' => $requestMeta['request_code'] ?? $requestCode,
                    'request_summary' => $requestMeta['request_summary'] ?? null,
                    'task_code' => $this->toNullableText($row->task_code ?? null),
                    'old_status' => null,
                    'new_status' => $this->normalizeNullableStatus($row->task_status ?? null),
                    'sub_status' => null,
                    'note' => $this->toNullableText($row->task_note ?? null)
                        ?? $this->toNullableText($row->task_link ?? null),
                    'actor_name' => $this->resolveHistoryActorName((array) $row),
                    'occurred_at' => $this->toNullableText($row->created_at ?? null),
                ];
            }
        }

        usort($feed, static function (array $left, array $right): int {
            $leftTime = strtotime((string) ($left['occurred_at'] ?? '')) ?: 0;
            $rightTime = strtotime((string) ($right['occurred_at'] ?? '')) ?: 0;
            if ($leftTime === $rightTime) {
                $leftId = (int) ($left['request_id'] ?? 0);
                $rightId = (int) ($right['request_id'] ?? 0);
                if ($leftId === $rightId) {
                    return 0;
                }

                return $rightId <=> $leftId;
            }

            return $rightTime <=> $leftTime;
        });

        return array_slice($feed, 0, $limit);
    }

    public function hasIncomingProgressInMetadata(?array $metadata): bool
    {
        if (! is_array($metadata) || $metadata === []) {
            return false;
        }

        $keys = [
            'progress',
            'progress_percent',
            'processing_progress',
            'tiendo',
            'pause_progress',
            'upcode_progress',
            'dms_progress',
            'pauseprogress',
            'upcodeprogress',
            'dmsprogress',
        ];
        $targetTokens = array_values(array_unique(array_filter(array_map(
            fn (string $key): string => $this->normalizeLooseToken($key),
            $keys
        ))));
        if ($targetTokens === []) {
            return false;
        }

        foreach ($metadata as $metadataKey => $metadataValue) {
            $token = $this->normalizeLooseToken((string) $metadataKey);
            if ($token === '' || ! in_array($token, $targetTokens, true)) {
                continue;
            }
            if ($metadataValue === null) {
                continue;
            }

            return true;
        }

        return false;
    }

    public function extractIncomingProgressFromMetadata(?array $metadata): ?float
    {
        return $this->extractTransitionMetadataProgress($metadata, [
            'progress',
            'progress_percent',
            'processing_progress',
            'tiendo',
            'pause_progress',
            'upcode_progress',
            'dms_progress',
            'pauseprogress',
            'upcodeprogress',
            'dmsprogress',
        ]);
    }

    public function resolveLatestProgressByRequestCode(string $requestCode): ?float
    {
        $requestCode = trim($requestCode);
        if ($requestCode === '' || ! $this->hasTable('request_transitions')) {
            return null;
        }
        if (! $this->hasColumn('request_transitions', 'transition_metadata')) {
            return null;
        }

        $query = DB::table('request_transitions')
            ->select(['transition_metadata'])
            ->where('request_code', $requestCode);
        if ($this->hasColumn('request_transitions', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->hasColumn('request_transitions', 'created_at')) {
            $query->orderByDesc('created_at');
        }
        if ($this->hasColumn('request_transitions', 'id')) {
            $query->orderByDesc('id');
        }

        foreach ($query->limit(500)->get() as $row) {
            $metadata = $this->decodeTransitionMetadata($row->transition_metadata ?? null);
            $progress = $this->extractIncomingProgressFromMetadata($metadata);
            if ($progress !== null) {
                return $progress;
            }
        }

        return null;
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed>|null $current
     */
    public function requiresProgressForPayload(array $payload, ?array $current = null): bool
    {
        $resolvedPayload = $current !== null ? array_merge($current, $payload) : $payload;
        [$status, $subStatus] = $this->resolveStatusValuesFromPayload($resolvedPayload);

        return $this->requiresProgressForStatus($status, $subStatus);
    }

    public function requiresProgressForStatus(?string $status, ?string $subStatus): bool
    {
        $statusToken = $this->normalizeLooseToken((string) ($status ?? ''));
        $subStatusToken = $this->normalizeLooseToken((string) ($subStatus ?? ''));
        if ($statusToken === '') {
            return false;
        }

        if ($statusToken === 'dangxuly') {
            return true;
        }

        if ($subStatusToken === '') {
            return false;
        }

        if (
            $statusToken === 'laptrinh'
            && in_array($subStatusToken, ['dangthuchien', 'upcode', 'tamngung'], true)
        ) {
            return true;
        }

        return $statusToken === 'chuyendms' && $subStatusToken === 'traodoi';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     * @return array<string,mixed>
     */
    public function import(array $items, ?int $actorId): array
    {
        $results = [];
        $created = 0;
        $updated = 0;

        foreach ($items as $index => $item) {
            try {
                $normalized = $this->normalizeImportRow($item);
                $requestCode = $normalized['request_code'];

                if (is_string($requestCode) && trim($requestCode) !== '') {
                    $existingId = DB::table('customer_requests')
                        ->where('request_code', trim($requestCode))
                        ->whereNull('deleted_at')
                        ->value('id');
                    if ($existingId !== null) {
                        $record = $this->update((int) $existingId, $normalized, $actorId);
                        $updated++;
                        $results[] = ['index' => $index, 'success' => true, 'action' => 'updated', 'data' => $record];
                        continue;
                    }
                }

                $record = $this->create($normalized, $actorId);
                $created++;
                $results[] = ['index' => $index, 'success' => true, 'action' => 'created', 'data' => $record];
            } catch (\Throwable $e) {
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Không thể nhập dòng dữ liệu.',
                ];
            }
        }

        $failed = count(array_filter($results, static fn (array $item): bool => ($item['success'] ?? false) !== true));

        return [
            'results' => $results,
            'created_count' => $created,
            'updated_count' => $updated,
            'failed_count' => $failed,
        ];
    }

    public function export(Request $request): StreamedResponse
    {
        $payload = $this->list($request);
        $rows = $payload['data'] ?? [];

        $fileName = 'customer_requests_'.now()->format('Ymd_His').'.csv';
        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, [
                'Mã YC',
                'Nội dung',
                'Trạng thái',
                'Trạng thái con',
                'Flow step',
                'Khách hàng',
                'Người yêu cầu',
                'Nhóm hỗ trợ',
                'Người tiếp nhận',
                'Người xử lý',
                'Mức ưu tiên',
                'Ngày nhận',
                'Ghi chú',
            ]);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['request_code'] ?? '',
                    $row['summary'] ?? '',
                    $row['status'] ?? '',
                    $row['sub_status'] ?? '',
                    $row['flow_step'] ?? '',
                    $row['customer_name'] ?? '',
                    $row['requester_name'] ?? '',
                    $row['service_group_name'] ?? '',
                    $row['receiver_name'] ?? '',
                    $row['assignee_name'] ?? '',
                    $row['priority'] ?? '',
                    $row['requested_date'] ?? '',
                    $row['notes'] ?? '',
                ]);
            }

            fclose($handle);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listWorkflowStatusCatalogs(bool $includeInactive = false): array
    {
        $this->assertTable('workflow_status_catalogs');

        $query = DB::table('workflow_status_catalogs as wsc')
            ->leftJoin('workflow_status_catalogs as parent', 'wsc.parent_id', '=', 'parent.id')
            ->select([
                'wsc.id',
                'wsc.level',
                'wsc.status_code',
                'wsc.status_name',
                'wsc.parent_id',
                'parent.status_name as parent_name',
                'wsc.canonical_status',
                'wsc.canonical_sub_status',
                'wsc.flow_step',
                'wsc.form_key',
                'wsc.is_leaf',
                'wsc.sort_order',
                'wsc.is_active',
                'wsc.created_at',
                'wsc.created_by',
                'wsc.updated_at',
                'wsc.updated_by',
            ]);

        if (! $includeInactive) {
            $query->where('wsc.is_active', 1);
        }

        return $query
            ->orderBy('wsc.level')
            ->orderBy('wsc.sort_order')
            ->orderBy('wsc.id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function storeWorkflowStatusCatalog(array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_status_catalogs');

        $insert = $this->filterPayloadByTable('workflow_status_catalogs', [
            'level' => max(1, min(3, (int) ($payload['level'] ?? 1))),
            'status_code' => $this->sanitizeStatusCode((string) ($payload['status_code'] ?? '')),
            'status_name' => trim((string) ($payload['status_name'] ?? '')),
            'parent_id' => $this->parseNullableInt($payload['parent_id'] ?? null),
            'canonical_status' => $this->normalizeNullableStatus($payload['canonical_status'] ?? null),
            'canonical_sub_status' => $this->normalizeNullableStatus($payload['canonical_sub_status'] ?? null),
            'flow_step' => $this->toNullableText($payload['flow_step'] ?? null),
            'form_key' => $this->toNullableText($payload['form_key'] ?? null),
            'is_leaf' => ! empty($payload['is_leaf']) ? 1 : 0,
            'sort_order' => max(0, (int) ($payload['sort_order'] ?? 0)),
            'is_active' => array_key_exists('is_active', $payload) ? (! empty($payload['is_active']) ? 1 : 0) : 1,
            'created_at' => now(),
            'created_by' => $actorId,
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        if (($insert['status_code'] ?? '') === '' || ($insert['status_name'] ?? '') === '') {
            throw new \RuntimeException('Thiếu status_code hoặc status_name.');
        }

        $id = (int) DB::table('workflow_status_catalogs')->insertGetId($insert);
        return (array) DB::table('workflow_status_catalogs')->where('id', $id)->first();
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function updateWorkflowStatusCatalog(int $id, array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_status_catalogs');

        $current = DB::table('workflow_status_catalogs')->where('id', $id)->first();
        if (! $current) {
            throw new \RuntimeException('Không tìm thấy cấu hình trạng thái workflow.');
        }

        $update = $this->filterPayloadByTable('workflow_status_catalogs', [
            'level' => array_key_exists('level', $payload) ? max(1, min(3, (int) $payload['level'])) : $current->level,
            'status_code' => array_key_exists('status_code', $payload)
                ? $this->sanitizeStatusCode((string) ($payload['status_code'] ?? ''))
                : $current->status_code,
            'status_name' => array_key_exists('status_name', $payload)
                ? trim((string) ($payload['status_name'] ?? ''))
                : $current->status_name,
            'parent_id' => array_key_exists('parent_id', $payload)
                ? $this->parseNullableInt($payload['parent_id'])
                : $current->parent_id,
            'canonical_status' => array_key_exists('canonical_status', $payload)
                ? $this->normalizeNullableStatus($payload['canonical_status'])
                : $current->canonical_status,
            'canonical_sub_status' => array_key_exists('canonical_sub_status', $payload)
                ? $this->normalizeNullableStatus($payload['canonical_sub_status'])
                : $current->canonical_sub_status,
            'flow_step' => array_key_exists('flow_step', $payload)
                ? $this->toNullableText($payload['flow_step'])
                : $current->flow_step,
            'form_key' => array_key_exists('form_key', $payload)
                ? $this->toNullableText($payload['form_key'])
                : $current->form_key,
            'is_leaf' => array_key_exists('is_leaf', $payload)
                ? (! empty($payload['is_leaf']) ? 1 : 0)
                : $current->is_leaf,
            'sort_order' => array_key_exists('sort_order', $payload)
                ? max(0, (int) $payload['sort_order'])
                : $current->sort_order,
            'is_active' => array_key_exists('is_active', $payload)
                ? (! empty($payload['is_active']) ? 1 : 0)
                : $current->is_active,
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        DB::table('workflow_status_catalogs')->where('id', $id)->update($update);
        return (array) DB::table('workflow_status_catalogs')->where('id', $id)->first();
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listWorkflowFormFieldConfigs(?int $statusCatalogId = null, bool $includeInactive = false): array
    {
        $this->assertTable('workflow_form_field_configs');

        $query = DB::table('workflow_form_field_configs as f')
            ->leftJoin('workflow_status_catalogs as s', 'f.status_catalog_id', '=', 's.id')
            ->select([
                'f.id',
                'f.status_catalog_id',
                's.status_name as status_name',
                'f.field_key',
                'f.field_label',
                'f.field_type',
                'f.required',
                'f.sort_order',
                'f.excel_column',
                'f.options_json',
                'f.is_active',
                'f.created_at',
                'f.created_by',
                'f.updated_at',
                'f.updated_by',
            ]);

        if ($statusCatalogId !== null) {
            $query->where('f.status_catalog_id', $statusCatalogId);
        }

        if (! $includeInactive) {
            $query->where('f.is_active', 1);
        }

        return $query
            ->orderBy('f.status_catalog_id')
            ->orderBy('f.sort_order')
            ->orderBy('f.id')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;
                $decoded = null;
                if (isset($data['options_json']) && is_string($data['options_json']) && trim($data['options_json']) !== '') {
                    $decoded = json_decode($data['options_json'], true);
                }
                $data['options_json'] = is_array($decoded) ? $decoded : null;

                return $data;
            })
            ->values()
            ->all();
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function storeWorkflowFormFieldConfig(array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_form_field_configs');

        $insert = $this->filterPayloadByTable('workflow_form_field_configs', [
            'status_catalog_id' => $this->parseNullableInt($payload['status_catalog_id'] ?? null),
            'field_key' => $this->sanitizeStatusCode((string) ($payload['field_key'] ?? '')),
            'field_label' => trim((string) ($payload['field_label'] ?? '')),
            'field_type' => $this->toNullableText($payload['field_type'] ?? null) ?? 'text',
            'required' => ! empty($payload['required']) ? 1 : 0,
            'sort_order' => max(0, (int) ($payload['sort_order'] ?? 0)),
            'excel_column' => $this->toNullableText($payload['excel_column'] ?? null),
            'options_json' => $this->encodeJson($payload['options_json'] ?? null),
            'is_active' => array_key_exists('is_active', $payload) ? (! empty($payload['is_active']) ? 1 : 0) : 1,
            'created_at' => now(),
            'created_by' => $actorId,
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        if (! isset($insert['status_catalog_id']) || (int) $insert['status_catalog_id'] <= 0) {
            throw new \RuntimeException('status_catalog_id không hợp lệ.');
        }
        if (($insert['field_key'] ?? '') === '' || ($insert['field_label'] ?? '') === '') {
            throw new \RuntimeException('Thiếu field_key hoặc field_label.');
        }

        $id = (int) DB::table('workflow_form_field_configs')->insertGetId($insert);
        return (array) DB::table('workflow_form_field_configs')->where('id', $id)->first();
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function updateWorkflowFormFieldConfig(int $id, array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_form_field_configs');

        $current = DB::table('workflow_form_field_configs')->where('id', $id)->first();
        if (! $current) {
            throw new \RuntimeException('Không tìm thấy field config workflow.');
        }

        $update = $this->filterPayloadByTable('workflow_form_field_configs', [
            'status_catalog_id' => array_key_exists('status_catalog_id', $payload)
                ? $this->parseNullableInt($payload['status_catalog_id'])
                : $current->status_catalog_id,
            'field_key' => array_key_exists('field_key', $payload)
                ? $this->sanitizeStatusCode((string) ($payload['field_key'] ?? ''))
                : $current->field_key,
            'field_label' => array_key_exists('field_label', $payload)
                ? trim((string) ($payload['field_label'] ?? ''))
                : $current->field_label,
            'field_type' => array_key_exists('field_type', $payload)
                ? ($this->toNullableText($payload['field_type']) ?? 'text')
                : $current->field_type,
            'required' => array_key_exists('required', $payload)
                ? (! empty($payload['required']) ? 1 : 0)
                : $current->required,
            'sort_order' => array_key_exists('sort_order', $payload)
                ? max(0, (int) $payload['sort_order'])
                : $current->sort_order,
            'excel_column' => array_key_exists('excel_column', $payload)
                ? $this->toNullableText($payload['excel_column'])
                : $current->excel_column,
            'options_json' => array_key_exists('options_json', $payload)
                ? $this->encodeJson($payload['options_json'])
                : $current->options_json,
            'is_active' => array_key_exists('is_active', $payload)
                ? (! empty($payload['is_active']) ? 1 : 0)
                : $current->is_active,
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        DB::table('workflow_form_field_configs')->where('id', $id)->update($update);
        return (array) DB::table('workflow_form_field_configs')->where('id', $id)->first();
    }

    /**
     * @return array{0:string,1:?string,2:?int}
     */
    private function resolveStatusValuesFromPayload(array $payload): array
    {
        $statusCatalogId = $this->parseNullableInt($payload['status_catalog_id'] ?? null);
        if ($statusCatalogId !== null && $this->hasTable('workflow_status_catalogs')) {
            $catalog = DB::table('workflow_status_catalogs')->where('id', $statusCatalogId)->first();
            if ($catalog) {
                $status = $this->normalizeToken($catalog->canonical_status ?: $catalog->status_code);
                $subStatus = $this->normalizeNullableStatus($catalog->canonical_sub_status);
                return [$status !== '' ? $status : 'MOI_TIEP_NHAN', $subStatus, $statusCatalogId];
            }
        }

        $status = $this->normalizeToken($payload['status'] ?? 'MOI_TIEP_NHAN');
        $subStatus = $this->normalizeNullableStatus($payload['sub_status'] ?? null);

        return [$status !== '' ? $status : 'MOI_TIEP_NHAN', $subStatus, $statusCatalogId];
    }

    /**
     * @param array<string,mixed> $raw
     * @return array<string,mixed>
     */
    private function normalizeImportRow(array $raw): array
    {
        $normalizedMap = $this->normalizeInputMap($raw);

        $level1 = $normalizedMap['trangthaicap1'] ?? $normalizedMap['b'] ?? $normalizedMap['trangthai1'] ?? null;
        $level2 = $normalizedMap['trangthaicap2'] ?? $normalizedMap['c'] ?? $normalizedMap['trangthai2'] ?? null;
        $level3 = $normalizedMap['trangthaicap3'] ?? $normalizedMap['d'] ?? $normalizedMap['trangthai3'] ?? null;

        $statusCatalogId = $this->resolveStatusCatalogIdByLabels($level1, $level2, $level3);
        [$status, $subStatus] = $this->resolveCanonicalStatusByCatalog($statusCatalogId);

        $requestCode = $normalizedMap['idyeucau'] ?? $normalizedMap['mayc'] ?? $normalizedMap['requestcode'] ?? null;

        $customerId = $this->resolveCustomerId($normalizedMap['donvi'] ?? null);
        $serviceGroupId = $this->resolveSupportGroupId($normalizedMap['nhomhotro'] ?? null);
        $receiverId = $this->resolveInternalUserId($normalizedMap['nguoitiepnhan'] ?? null);
        $assigneeId = $this->resolveInternalUserId($normalizedMap['nguoixuly'] ?? null);

        $transitionMetadata = [];
        $taskCode = $normalizedMap['mataskthamchieu'] ?? $normalizedMap['matask'] ?? null;
        if (is_string($normalizedMap['ngaytraodoilaivoikhachhang'] ?? null)) {
            $transitionMetadata['exchange_date'] = $this->normalizeDate($normalizedMap['ngaytraodoilaivoikhachhang']);
        }
        if (is_string($normalizedMap['noidungtraodoi'] ?? null)) {
            $transitionMetadata['exchange_content'] = $this->toNullableText($normalizedMap['noidungtraodoi']);
        }
        if (is_string($normalizedMap['ngaykhachhangphanhoi'] ?? null)) {
            $transitionMetadata['customer_feedback_date'] = $this->normalizeDate($normalizedMap['ngaykhachhangphanhoi']);
        }
        if (is_string($normalizedMap['noidungkhachhangphanhoi'] ?? null)) {
            $transitionMetadata['customer_feedback_content'] = $this->toNullableText($normalizedMap['noidungkhachhangphanhoi']);
        }
        if (is_string($normalizedMap['nguyennhankhongthuchien'] ?? null)) {
            $transitionMetadata['cancel_reason'] = $this->toNullableText($normalizedMap['nguyennhankhongthuchien']);
        }
        if (is_string($normalizedMap['ngayhoanthanthucte'] ?? null)) {
            $transitionMetadata['actual_completion_date'] = $this->normalizeDate($normalizedMap['ngayhoanthanthucte']);
        }

        $worklogs = [];
        $worklogText = $normalizedMap['worklogxuly'] ?? $normalizedMap['worklog'] ?? null;
        if (is_string($worklogText) && trim($worklogText) !== '') {
            $worklogs[] = [
                'phase' => $this->inferWorklogPhase($status, $subStatus),
                'logged_date' => $this->normalizeDate($normalizedMap['ngayxuly'] ?? $normalizedMap['ngayupcode'] ?? null) ?? now()->toDateString(),
                'hours_spent' => 1,
                'content' => trim($worklogText),
            ];
        }

        $refTasks = [];
        if (is_string($taskCode) && trim($taskCode) !== '') {
            $refTasks[] = [
                'task_source' => 'IT360',
                'task_code' => trim($taskCode),
                'task_link' => null,
                'task_note' => null,
                'task_status' => null,
                'sort_order' => 0,
            ];
        }

        $taskList = $normalizedMap['listtask'] ?? null;
        if (is_string($taskList) && trim($taskList) !== '') {
            $lines = preg_split('/\r\n|\r|\n|;|,/', $taskList);
            $lines = array_values(array_filter(array_map(static fn (string $line): string => trim($line), $lines ?: []), static fn (string $line): bool => $line !== ''));
            foreach ($lines as $idx => $line) {
                $refTasks[] = [
                    'task_source' => 'IT360',
                    'task_code' => $line,
                    'task_link' => null,
                    'task_note' => null,
                    'task_status' => null,
                    'sort_order' => $idx,
                ];
            }
        }

        return [
            'request_code' => $this->toNullableText($requestCode),
            'status_catalog_id' => $statusCatalogId,
            'status' => $status,
            'sub_status' => $subStatus,
            'summary' => $this->toNullableText($normalizedMap['noidung'] ?? null) ?? 'N/A',
            'customer_id' => $customerId,
            'requester_name' => $this->toNullableText($normalizedMap['nguoiyeucau'] ?? null),
            'service_group_id' => $serviceGroupId,
            'receiver_user_id' => $receiverId,
            'assignee_id' => $assigneeId,
            'requested_date' => $this->normalizeDate($normalizedMap['ngaytiepnhan'] ?? null) ?? now()->toDateString(),
            'notes' => $this->toNullableText($normalizedMap['ghichu'] ?? null),
            'transition_metadata' => $transitionMetadata,
            'worklogs' => $worklogs,
            'ref_tasks' => $refTasks,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function appendTransitionRefTasks(string $requestCode, ?int $transitionId, array $payload, ?int $actorId): void
    {
        if ($transitionId === null || ! $this->hasTable('request_ref_tasks')) {
            return;
        }

        $rows = [];
        $seenSignatures = [];
        $refTaskItems = isset($payload['ref_tasks']) && is_array($payload['ref_tasks'])
            ? array_values($payload['ref_tasks'])
            : [];
        $legacyTaskItems = isset($payload['tasks']) && is_array($payload['tasks'])
            ? array_values($payload['tasks'])
            : [];
        $taskItems = $refTaskItems !== [] ? $refTaskItems : $legacyTaskItems;
        $now = now();

        if ($taskItems !== []) {
            foreach ($taskItems as $index => $task) {
                if (! is_array($task)) {
                    continue;
                }
                $taskCode = $this->toNullableText($task['task_code'] ?? null);
                $taskLink = $this->toNullableText($task['task_link'] ?? null);
                if ($taskCode === null && $taskLink === null) {
                    continue;
                }

                $taskSource = strtoupper($this->toNullableText($task['task_source'] ?? null) ?? 'IT360');
                $taskNote = $this->toNullableText($task['task_note'] ?? null);
                $taskStatus = $this->toNullableText($task['task_status'] ?? $task['status'] ?? null);
                $sortOrder = max(0, (int) ($task['sort_order'] ?? $index));
                $signature = $this->buildTransitionRefTaskSignature(
                    $requestCode,
                    $transitionId,
                    $taskSource,
                    $taskCode,
                    $taskLink,
                    $taskStatus,
                    $taskNote,
                    $sortOrder
                );
                if (isset($seenSignatures[$signature])) {
                    continue;
                }
                $seenSignatures[$signature] = true;

                $rows[] = $this->filterPayloadByTable('request_ref_tasks', [
                    'source_type' => 'TRANSITION',
                    'source_id' => $transitionId,
                    'request_code' => $requestCode,
                    'task_source' => $taskSource,
                    'task_code' => $taskCode,
                    'task_link' => $taskLink,
                    'task_note' => $taskNote,
                    'task_status' => $taskStatus,
                    'sort_order' => $sortOrder,
                    'created_at' => $now,
                    'created_by' => $actorId,
                    'updated_at' => $now,
                    'updated_by' => $actorId,
                    'deleted_at' => null,
                ]);
            }
        }

        if ($rows !== []) {
            DB::table('request_ref_tasks')->insert($rows);
        }
    }

    private function buildTransitionRefTaskSignature(
        string $requestCode,
        int $transitionId,
        string $taskSource,
        ?string $taskCode,
        ?string $taskLink,
        ?string $taskStatus,
        ?string $taskNote,
        int $sortOrder
    ): string {
        $taskCodeToken = $taskCode !== null ? mb_strtolower(trim($taskCode)) : '';
        $taskLinkToken = $taskLink !== null ? trim($taskLink) : '';
        $taskStatusToken = $taskStatus !== null ? $this->normalizeLooseToken($taskStatus) : '';
        $taskNoteToken = $taskNote !== null ? trim($taskNote) : '';

        return implode('|', [
            $requestCode,
            'TRANSITION',
            (string) $transitionId,
            $this->normalizeLooseToken($taskSource),
            $taskCodeToken,
            $taskLinkToken,
            $taskStatusToken,
            $taskNoteToken,
            (string) $sortOrder,
        ]);
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function appendWorklogs(string $requestCode, string $status, ?string $subStatus, array $payload, ?int $actorId): void
    {
        if (! $this->hasTable('request_worklogs')) {
            return;
        }

        $rows = [];
        if (isset($payload['worklogs']) && is_array($payload['worklogs'])) {
            foreach ($payload['worklogs'] as $worklog) {
                if (! is_array($worklog)) {
                    continue;
                }

                $content = $this->toNullableText($worklog['content'] ?? $worklog['worklog_note'] ?? null);
                if ($content === null) {
                    continue;
                }

                $phase = $this->normalizeWorklogPhase($worklog['phase'] ?? $this->inferWorklogPhase($status, $subStatus));
                $hoursSpent = max(0, (float) ($worklog['hours_spent'] ?? 0));

                $row = [
                    'uuid' => $this->generateUuid(),
                    'request_code' => $requestCode,
                    'request_summary' => $this->toNullableText($payload['summary'] ?? null),
                    'parent_request_code' => null,
                    'phase' => $phase,
                    'customer_id' => $this->parseNullableInt($payload['customer_id'] ?? null),
                    'project_id' => $this->parseNullableInt($payload['project_id'] ?? null),
                    'project_item_id' => $this->parseNullableInt($payload['project_item_id'] ?? null),
                    'report_date' => $this->normalizeDate($worklog['logged_date'] ?? $worklog['report_date'] ?? null) ?? now()->toDateString(),
                    'hours_estimated' => $this->parseNullableFloat($worklog['hours_estimated'] ?? null),
                    'hours_spent' => $hoursSpent,
                    'progress_percent' => $this->parseNullableInt($worklog['progress_percent'] ?? null),
                    'doc_link' => $this->toNullableText($worklog['doc_link'] ?? null),
                    'drive_file_id' => $this->toNullableText($worklog['drive_file_id'] ?? null),
                    'worklog_note' => $content,
                    'internal_note' => $this->toNullableText($worklog['internal_note'] ?? null),
                    'created_at' => now(),
                    'created_by' => $actorId,
                    'updated_at' => now(),
                    'updated_by' => $actorId,
                    'deleted_at' => null,
                ];

                if ($this->hasColumn('request_worklogs', 'activity_type_id')) {
                    $row['activity_type_id'] = $this->parseNullableInt($worklog['activity_type_id'] ?? null);
                }
                if ($this->hasColumn('request_worklogs', 'activity_type')) {
                    $row['activity_type'] = $this->normalizeWorklogActivity($worklog['activity_type'] ?? null);
                }
                if ($this->hasColumn('request_worklogs', 'is_billable')) {
                    $row['is_billable'] = array_key_exists('is_billable', $worklog) ? (! empty($worklog['is_billable']) ? 1 : 0) : 1;
                }

                $rows[] = $this->filterPayloadByTable('request_worklogs', $row);
            }
        }

        if ($rows !== []) {
            DB::table('request_worklogs')->insert($rows);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function appendTransition(array $payload): ?int
    {
        if (! $this->hasTable('request_transitions')) {
            return null;
        }

        $now = now();
        $priority = $this->normalizePriority((string) ($payload['priority'] ?? 'MEDIUM'));
        $toStatus = $this->normalizeToken($payload['to_status'] ?? null);
        $subStatus = $this->normalizeNullableStatus($payload['sub_status'] ?? null);

        $slaRule = $this->slaResolver->resolve($toStatus, $subStatus, $priority, null);
        $slaHours = $this->parseNullableFloat($slaRule['sla_hours'] ?? $slaRule['resolution_hours'] ?? null);
        $slaDueTime = $slaHours !== null ? $now->copy()->addMinutes((int) round($slaHours * 60)) : null;

        $insert = [
            'uuid' => $this->generateUuid(),
            'request_code' => $payload['request_code'] ?? null,
            'request_summary' => $payload['request_summary'] ?? null,
            'parent_request_code' => null,
            'customer_id' => $payload['customer_id'] ?? null,
            'project_id' => $payload['project_id'] ?? null,
            'project_item_id' => $payload['project_item_id'] ?? null,
            'from_status' => $payload['from_status'] ?? null,
            'to_status' => $toStatus,
            'sub_status' => $subStatus,
            'new_assignee_id' => $payload['new_assignee_id'] ?? null,
            'hours_estimated' => $payload['hours_estimated'] ?? null,
            'transition_metadata' => $this->encodeJson($payload['transition_metadata'] ?? null),
            'doc_link' => $this->toNullableText($payload['doc_link'] ?? null),
            'drive_file_id' => $this->toNullableText($payload['drive_file_id'] ?? null),
            'transition_note' => $this->toNullableText($payload['transition_note'] ?? null),
            'internal_note' => $this->toNullableText($payload['internal_note'] ?? null),
            'created_at' => $now,
            'created_by' => $payload['created_by'] ?? null,
            'updated_at' => $now,
            'updated_by' => $payload['updated_by'] ?? null,
            'deleted_at' => null,
            'sla_due_time' => $slaDueTime,
            'is_sla_breached' => 0,
        ];

        $insert = $this->filterPayloadByTable('request_transitions', $insert);
        return (int) DB::table('request_transitions')->insertGetId($insert);
    }

    /**
     * @return array<string,mixed>
     */
    private function getById(int $id): array
    {
        $row = DB::table('customer_requests as cr')
            ->leftJoin('customers as c', 'cr.customer_id', '=', 'c.id')
            ->leftJoin('support_service_groups as ssg', 'cr.service_group_id', '=', 'ssg.id')
            ->leftJoin('internal_users as iu_assignee', 'cr.assignee_id', '=', 'iu_assignee.id')
            ->leftJoin('internal_users as iu_receiver', 'cr.receiver_user_id', '=', 'iu_receiver.id')
            ->leftJoin('workflow_status_catalogs as wsc', 'cr.status_catalog_id', '=', 'wsc.id')
            ->where('cr.id', $id)
            ->when(
                $this->hasTable('customer_personnel') && $this->hasColumn('customer_requests', 'reporter_contact_id'),
                fn ($query) => $query->leftJoin('customer_personnel as cp', 'cr.reporter_contact_id', '=', 'cp.id')
            )
            ->select(array_filter([
                'cr.id',
                'cr.uuid',
                'cr.request_code',
                'cr.status_catalog_id',
                'cr.summary',
                'cr.project_item_id',
                'cr.customer_id',
                'cr.project_id',
                'cr.product_id',
                'c.customer_name',
                'cr.requester_name',
                'cr.reporter_contact_id',
                'cr.service_group_id',
                'ssg.group_name as service_group_name',
                'cr.receiver_user_id',
                'iu_receiver.full_name as receiver_name',
                'cr.assignee_id',
                'iu_assignee.full_name as assignee_name',
                'cr.reference_ticket_code',
                'cr.reference_request_id',
                'cr.status',
                'cr.sub_status',
                'cr.priority',
                'cr.requested_date',
                'cr.latest_transition_id',
                'cr.notes',
                'cr.transition_metadata',
                'cr.created_at',
                'cr.created_by',
                'cr.updated_at',
                'cr.updated_by',
                'wsc.status_name as status_name',
                'wsc.flow_step as status_flow_step',
                'wsc.form_key as status_form_key',
                $this->hasColumn('customer_personnel', 'full_name') ? 'cp.full_name as reporter_contact_name' : null,
                $this->hasColumn('customer_personnel', 'phone_number')
                    ? 'cp.phone_number as reporter_contact_phone'
                    : ($this->hasColumn('customer_personnel', 'phone') ? 'cp.phone as reporter_contact_phone' : null),
                $this->hasColumn('customer_personnel', 'email') ? 'cp.email as reporter_contact_email' : null,
            ]))
            ->first();

        if (! $row) {
            throw new \RuntimeException('Không tìm thấy yêu cầu khách hàng.');
        }

        return $this->serializeCustomerRequestRow((array) $row);
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function serializeCustomerRequestRow(array $row): array
    {
        $status = $this->normalizeToken($row['status'] ?? null);
        $subStatus = $this->normalizeNullableStatus($row['sub_status'] ?? null);
        $flow = $this->flowResolver->resolve($status, $subStatus);

        $metadata = $row['transition_metadata'] ?? null;
        if (is_string($metadata) && trim($metadata) !== '') {
            $decoded = json_decode($metadata, true);
            $metadata = is_array($decoded) ? $decoded : null;
        }

        return [
            'id' => (int) ($row['id'] ?? 0),
            'uuid' => $row['uuid'] ?? null,
            'request_code' => (string) ($row['request_code'] ?? ''),
            'status_catalog_id' => isset($row['status_catalog_id']) ? (int) $row['status_catalog_id'] : null,
            'summary' => (string) ($row['summary'] ?? ''),
            'project_item_id' => isset($row['project_item_id']) ? (int) $row['project_item_id'] : null,
            'customer_id' => isset($row['customer_id']) ? (int) $row['customer_id'] : null,
            'project_id' => isset($row['project_id']) ? (int) $row['project_id'] : null,
            'product_id' => isset($row['product_id']) ? (int) $row['product_id'] : null,
            'customer_name' => $row['customer_name'] ?? null,
            'requester_name' => $row['requester_name'] ?? null,
            'reporter_contact_id' => isset($row['reporter_contact_id']) ? (int) $row['reporter_contact_id'] : null,
            'reporter_contact_name' => $row['reporter_contact_name'] ?? null,
            'reporter_contact_phone' => $row['reporter_contact_phone'] ?? null,
            'reporter_contact_email' => $row['reporter_contact_email'] ?? null,
            'service_group_id' => isset($row['service_group_id']) ? (int) $row['service_group_id'] : null,
            'service_group_name' => $row['service_group_name'] ?? null,
            'receiver_user_id' => isset($row['receiver_user_id']) ? (int) $row['receiver_user_id'] : null,
            'receiver_name' => $row['receiver_name'] ?? null,
            'assignee_id' => isset($row['assignee_id']) ? (int) $row['assignee_id'] : null,
            'assignee_name' => $row['assignee_name'] ?? null,
            'reference_ticket_code' => $row['reference_ticket_code'] ?? null,
            'reference_request_id' => isset($row['reference_request_id']) ? (int) $row['reference_request_id'] : null,
            'status' => $status,
            'sub_status' => $subStatus,
            'status_name' => $row['status_name'] ?? null,
            'priority' => $this->normalizePriority((string) ($row['priority'] ?? 'MEDIUM')),
            'requested_date' => $row['requested_date'] ?? null,
            'latest_transition_id' => isset($row['latest_transition_id']) ? (int) $row['latest_transition_id'] : null,
            'notes' => $row['notes'] ?? null,
            'transition_metadata' => $metadata,
            'flow_step' => $flow['flow_step'],
            'form_key' => $flow['form_key'],
            'created_at' => $row['created_at'] ?? null,
            'created_by' => isset($row['created_by']) ? (int) $row['created_by'] : null,
            'updated_at' => $row['updated_at'] ?? null,
            'updated_by' => isset($row['updated_by']) ? (int) $row['updated_by'] : null,
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function decodeTransitionMetadata(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }

        if (is_string($value) && trim($value) !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private function extractTransitionMetadataValue(?array $metadata, array $keys): mixed
    {
        if (! is_array($metadata) || $metadata === [] || $keys === []) {
            return null;
        }

        $targetTokens = [];
        foreach ($keys as $key) {
            $token = $this->normalizeLooseToken((string) $key);
            if ($token !== '') {
                $targetTokens[] = $token;
            }
        }
        $targetTokens = array_values(array_unique($targetTokens));
        if ($targetTokens === []) {
            return null;
        }

        foreach ($metadata as $metadataKey => $metadataValue) {
            $token = $this->normalizeLooseToken((string) $metadataKey);
            if ($token !== '' && in_array($token, $targetTokens, true)) {
                return $metadataValue;
            }
        }

        return null;
    }

    private function extractTransitionMetadataText(?array $metadata, array $keys): ?string
    {
        $value = $this->extractTransitionMetadataValue($metadata, $keys);
        return $this->toNullableText($value);
    }

    private function extractTransitionMetadataStatus(?array $metadata, array $keys): ?string
    {
        $value = $this->extractTransitionMetadataValue($metadata, $keys);
        return $this->normalizeNullableStatus($value);
    }

    private function extractTransitionMetadataProgress(?array $metadata, array $keys): ?float
    {
        $value = $this->extractTransitionMetadataValue($metadata, $keys);
        if (is_string($value)) {
            $normalized = str_replace(['%', ','], ['', '.'], trim($value));
            if ($normalized === '') {
                return null;
            }
            $value = $normalized;
        }

        return $this->parseNullableFloat($value);
    }

    /**
     * @param array<string,mixed> $row
     */
    private function resolveHistoryActorName(array $row): string
    {
        $candidates = [
            $this->toNullableText($row['actor_full_name'] ?? null),
            $this->toNullableText($row['actor_username'] ?? null),
            $this->toNullableText($row['actor_user_code'] ?? null),
        ];

        foreach ($candidates as $candidate) {
            if ($candidate !== null) {
                return $candidate;
            }
        }

        $createdBy = $this->parseNullableInt($row['created_by'] ?? null);
        if ($createdBy !== null) {
            return 'User #'.$createdBy;
        }

        return 'Hệ thống';
    }

    private function resolveStatusCatalogIdByLabels(?string $level1, ?string $level2, ?string $level3): ?int
    {
        if (! $this->hasTable('workflow_status_catalogs')) {
            return null;
        }

        $l1 = $this->normalizeToken($level1);
        $l2 = $this->normalizeToken($level2);
        $l3 = $this->normalizeToken($level3);

        if ($l1 === '') {
            return null;
        }

        $catalogs = DB::table('workflow_status_catalogs')->where('is_active', 1)->get();
        $byId = [];
        $children = [];
        foreach ($catalogs as $catalog) {
            $byId[(int) $catalog->id] = $catalog;
            $parentId = $catalog->parent_id !== null ? (int) $catalog->parent_id : 0;
            $children[$parentId][] = $catalog;
        }

        $findByName = function (array $nodes, string $needle) {
            foreach ($nodes as $node) {
                $nameToken = strtoupper(trim((string) ($node->status_name ?? '')));
                $codeToken = strtoupper(trim((string) ($node->status_code ?? '')));
                if ($nameToken === $needle || $codeToken === $needle) {
                    return $node;
                }
            }

            return null;
        };

        $root = $findByName($children[0] ?? [], $l1);
        if (! $root) {
            return null;
        }

        if ($l2 === '') {
            return (int) $root->id;
        }

        $level2Node = $findByName($children[(int) $root->id] ?? [], $l2);
        if (! $level2Node) {
            return (int) $root->id;
        }

        if ($l3 === '') {
            return (int) $level2Node->id;
        }

        $level3Node = $findByName($children[(int) $level2Node->id] ?? [], $l3);
        if (! $level3Node) {
            return (int) $level2Node->id;
        }

        return (int) $level3Node->id;
    }

    /**
     * @return array{0:string,1:?string}
     */
    private function resolveCanonicalStatusByCatalog(?int $catalogId): array
    {
        if ($catalogId === null || ! $this->hasTable('workflow_status_catalogs')) {
            return ['MOI_TIEP_NHAN', null];
        }

        $catalog = DB::table('workflow_status_catalogs')->where('id', $catalogId)->first();
        if (! $catalog) {
            return ['MOI_TIEP_NHAN', null];
        }

        $status = $this->normalizeToken($catalog->canonical_status ?: $catalog->status_code);
        $subStatus = $this->normalizeNullableStatus($catalog->canonical_sub_status ?? null);

        return [$status !== '' ? $status : 'MOI_TIEP_NHAN', $subStatus];
    }

    /**
     * @return array<string,string>
     */
    private function normalizeInputMap(array $raw): array
    {
        $map = [];
        foreach ($raw as $key => $value) {
            $token = $this->normalizeLooseToken((string) $key);
            if ($token === '') {
                continue;
            }
            $map[$token] = is_scalar($value) ? trim((string) $value) : '';
        }

        return $map;
    }

    private function resolveCustomerId(?string $value): ?int
    {
        $text = $this->toNullableText($value);
        if ($text === null || ! $this->hasTable('customers')) {
            return null;
        }

        if (is_numeric($text)) {
            $id = (int) $text;
            $exists = DB::table('customers')->where('id', $id)->exists();
            return $exists ? $id : null;
        }

        return $this->parseNullableInt(
            DB::table('customers')->where('customer_name', $text)->value('id')
        );
    }

    private function resolveSupportGroupId(?string $value): ?int
    {
        $text = $this->toNullableText($value);
        if ($text === null || ! $this->hasTable('support_service_groups')) {
            return null;
        }

        if (is_numeric($text)) {
            $id = (int) $text;
            $exists = DB::table('support_service_groups')->where('id', $id)->exists();
            return $exists ? $id : null;
        }

        return $this->parseNullableInt(
            DB::table('support_service_groups')->where('group_name', $text)->value('id')
        );
    }

    private function resolveInternalUserId(?string $value): ?int
    {
        $text = $this->toNullableText($value);
        if ($text === null || ! $this->hasTable('internal_users')) {
            return null;
        }

        if (is_numeric($text)) {
            $id = (int) $text;
            $exists = DB::table('internal_users')->where('id', $id)->exists();
            return $exists ? $id : null;
        }

        $id = DB::table('internal_users')
            ->where('full_name', $text)
            ->orWhere('user_code', $text)
            ->orWhere('username', $text)
            ->value('id');

        return $this->parseNullableInt($id);
    }

    private function inferWorklogPhase(string $status, ?string $subStatus): string
    {
        $status = $this->normalizeToken($status);
        $subStatus = $this->normalizeToken($subStatus);

        if ($status === 'DANG_XU_LY') {
            return 'SUPPORT_HANDLE';
        }
        if ($status === 'PHAN_TICH') {
            return 'ANALYZE';
        }
        if ($status === 'LAP_TRINH' && $subStatus === 'UPCODE') {
            return 'UPCODE';
        }
        if ($status === 'LAP_TRINH') {
            return 'CODE';
        }

        return 'OTHER';
    }

    private function normalizeWorklogPhase(mixed $value): string
    {
        $token = $this->normalizeToken($value);
        $allowed = ['SUPPORT_HANDLE', 'ANALYZE', 'CODE', 'UPCODE', 'OTHER'];
        return in_array($token, $allowed, true) ? $token : 'OTHER';
    }

    private function normalizeWorklogActivity(mixed $value): string
    {
        $token = $this->normalizeToken($value);
        $allowed = ['CODING', 'MEETING', 'TESTING', 'DEPLOYMENT', 'SUPPORT', 'RESEARCH', 'TRAVEL'];
        return in_array($token, $allowed, true) ? $token : 'CODING';
    }

    private function buildRequestCode(int $id, CarbonInterface $time): string
    {
        return 'YC'.$time->format('md').$id;
    }

    private function normalizePriority(string $value): string
    {
        $token = strtoupper(trim($value));
        return in_array($token, ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], true) ? $token : 'MEDIUM';
    }

    private function sanitizeStatusCode(string $value): string
    {
        return strtoupper(trim((string) preg_replace('/[^A-Z0-9_]+/i', '_', $value)));
    }

    private function normalizeToken(mixed $value): string
    {
        return strtoupper(trim((string) ($value ?? '')));
    }

    private function normalizeNullableStatus(mixed $value): ?string
    {
        $token = $this->normalizeToken($value);
        return $token !== '' ? $token : null;
    }

    private function normalizeLooseToken(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = str_replace(['đ', 'Đ'], 'd', $value);
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;

        return preg_replace('/[^a-z0-9]+/', '', strtolower($value)) ?: '';
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function canonicalizeCustomerRequestPayload(array $payload): array
    {
        $rawMetadata = array_key_exists('transition_metadata', $payload)
            ? $payload['transition_metadata']
            : null;
        $canonicalFromMetadata = $this->extractCanonicalFieldsFromTransitionMetadata(
            is_array($rawMetadata) ? $rawMetadata : null
        );

        $metadata = null;
        if (array_key_exists('transition_metadata', $payload)) {
            $metadata = $this->normalizeCustomerRequestTransitionMetadata($rawMetadata);
            $payload['transition_metadata'] = $metadata;
        }

        $summary = $this->toNullableText($payload['summary'] ?? null);
        if ($summary === null) {
            $summary = $canonicalFromMetadata['summary'] ?? null;
        }
        if ($summary !== null) {
            $payload['summary'] = $summary;
        }

        $requesterName = $this->toNullableText($payload['requester_name'] ?? null);
        if ($requesterName === null) {
            $requesterName = $canonicalFromMetadata['requester_name'] ?? null;
        }
        if ($requesterName !== null) {
            $payload['requester_name'] = $requesterName;
        }

        $serviceGroupId = $this->parseNullableInt($payload['service_group_id'] ?? null);
        if ($serviceGroupId === null && isset($canonicalFromMetadata['service_group_id'])) {
            $serviceGroupId = $this->resolveSupportGroupId((string) $canonicalFromMetadata['service_group_id']);
        }
        if ($serviceGroupId !== null) {
            $payload['service_group_id'] = $serviceGroupId;
        }

        return $payload;
    }

    /**
     * @return array{summary?:string,requester_name?:string,service_group_id?:string}
     */
    private function extractCanonicalFieldsFromTransitionMetadata(?array $metadata): array
    {
        if (! is_array($metadata) || $metadata === []) {
            return [];
        }

        $summary = null;
        $requesterName = null;
        $serviceGroup = null;

        foreach ($metadata as $key => $value) {
            $token = $this->normalizeLooseToken((string) $key);
            if ($token === '') {
                continue;
            }
            if (! is_scalar($value) && $value !== null) {
                continue;
            }

            if ($summary === null && in_array($token, ['summary', 'noidung', 'noidungyeucau', 'fieldnidung'], true)) {
                $summary = $this->toNullableText($value);
                continue;
            }

            if ($requesterName === null && in_array($token, ['requestername', 'reportername', 'nguoiyeucau', 'fieldngiyeucu'], true)) {
                $requesterName = $this->toNullableText($value);
                continue;
            }

            if ($serviceGroup === null && in_array($token, ['servicegroupid', 'nhomhotro', 'fieldnhomhtr'], true)) {
                $serviceGroup = $this->toNullableText($value);
            }
        }

        $result = [];
        if ($summary !== null) {
            $result['summary'] = $summary;
        }
        if ($requesterName !== null) {
            $result['requester_name'] = $requesterName;
        }
        if ($serviceGroup !== null) {
            $result['service_group_id'] = $serviceGroup;
        }

        return $result;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function normalizeCustomerRequestTransitionMetadata(mixed $metadata): ?array
    {
        if (! is_array($metadata)) {
            return null;
        }

        $staticAliasTokens = [
            'requestcode',
            'idyeucau',
            'mayeucau',
            'mayc',
            'fieldidyeucu',
            'summary',
            'noidung',
            'noidungyeucau',
            'fieldnidung',
            'customerid',
            'donvi',
            'fielddnv',
            'requestername',
            'reportercontactid',
            'nguoiyeucau',
            'fieldngiyeucu',
            'servicegroupid',
            'nhomhotro',
            'fieldnhomhtr',
            'receiveruserid',
            'nguoitiepnhan',
            'fieldngitipnhn',
            'assigneeid',
            'nguoixuly',
            'fieldngixly',
            'requesteddate',
            'ngaytiepnhan',
            'fieldngaytipnhan',
            'referenceticketcode',
            'mataskthamchieu',
            'fieldmataskthamchiu',
            'referencerequestid',
            'notes',
            'ghichu',
            'projectitemid',
            'projectid',
            'productid',
        ];
        $staticAliasTokenMap = array_flip($staticAliasTokens);

        $cleaned = [];
        foreach ($metadata as $key => $value) {
            $token = $this->normalizeLooseToken((string) $key);
            if ($token !== '' && isset($staticAliasTokenMap[$token])) {
                continue;
            }
            $cleaned[$key] = $value;
        }

        return $cleaned === [] ? null : $cleaned;
    }

    private function normalizeDate(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'];
        foreach ($formats as $format) {
            try {
                $date = Carbon::createFromFormat($format, $text);
                if ($date !== false) {
                    return $date->format('Y-m-d');
                }
            } catch (\Throwable) {
                continue;
            }
        }

        try {
            return Carbon::parse($text)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    private function toNullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        return $text !== '' ? $text : null;
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_numeric($value)) {
            return null;
        }

        return (int) $value;
    }

    private function parseNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }

    private function encodeJson(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed !== '' ? $trimmed : null;
        }
        if (! is_array($value)) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }

    private function generateUuid(): string
    {
        return (string) Str::uuid();
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function filterPayloadByTable(string $table, array $payload): array
    {
        $result = [];
        foreach ($payload as $column => $value) {
            if ($this->hasColumn($table, $column)) {
                $result[$column] = $value;
            }
        }

        if (array_key_exists('uuid', $result) && $result['uuid'] instanceof \Illuminate\Database\Query\Expression) {
            unset($result['uuid']);
        }

        return $result;
    }

    private function assertTable(string $table): void
    {
        if (! $this->hasTable($table)) {
            throw new \RuntimeException("Bảng {$table} chưa sẵn sàng.");
        }
    }

    private function hasTable(string $table): bool
    {
        if (! array_key_exists($table, $this->tableCache)) {
            $this->tableCache[$table] = Schema::hasTable($table);
        }

        return $this->tableCache[$table];
    }

    private function hasColumn(string $table, string $column): bool
    {
        $key = $table.'.'.$column;
        if (! array_key_exists($key, $this->columnCache)) {
            $this->columnCache[$key] = Schema::hasTable($table) && Schema::hasColumn($table, $column);
        }

        return $this->columnCache[$key];
    }
}
