<?php

namespace App\Services\V5\Workflow;

use App\Support\Auth\UserAccessService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CustomerRequestWorkflowService
{
    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;

    /**
     * @var array<string, bool>
     */
    private array $tableCache = [];

    /**
     * @var array<string, bool>
     */
    private array $columnCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $transitionConfigCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $viewRuleCache = [];

    /**
     * @var array<int, bool>
     */
    private array $adminRoleCache = [];

    /**
     * @var array<int, array<int, int>>
     */
    private array $projectRaciAIdsCache = [];

    /**
     * @var array<int>|null
     */
    private ?array $adminUserIdsCache = null;

    /**
     * @var array<int, string|null>
     */
    private array $statusNameCache = [];

    /**
     * @var array<string, int|null>
     */
    private array $runtimeStatusCatalogIdCache = [];

    /**
     * @var array<int, array<string, mixed>|null>
     */
    private array $supportServiceGroupWorkflowBindingCache = [];

    /**
     * @var array<int, array<string, mixed>>|null
     */
    private ?array $workflowStatusCatalogLookupCache = null;

    public function __construct(
        private readonly WorkflowFlowResolver $flowResolver,
        private readonly StatusDrivenSlaResolver $slaResolver,
        private readonly UserAccessService $userAccessService
    ) {
    }

    /**
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    public function list(Request $request): array
    {
        $this->assertTable('customer_requests');

        $viewerUserId = $this->parseNullableInt($request->user()?->id ?? null);
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(200, max(1, (int) $request->query('per_page', 20)));
        $q = trim((string) $request->query('q', ''));
        $filters = is_array($request->query('filters')) ? $request->query('filters') : [];
        $status = $this->normalizeToken($filters['status'] ?? $request->query('status'));
        $subStatus = $this->normalizeToken($filters['sub_status'] ?? $request->query('sub_status'));
        $serviceGroupId = $this->parseNullableInt($filters['service_group_id'] ?? null);
        $workflowActionCode = $this->normalizeToken($filters['workflow_action_code'] ?? null);
        $toStatusCatalogId = $this->parseNullableInt($filters['to_status_catalog_id'] ?? null);

        $query = DB::table('customer_requests as cr')
            ->leftJoin('customers as c', 'cr.customer_id', '=', 'c.id')
            ->leftJoin('support_service_groups as ssg', 'cr.service_group_id', '=', 'ssg.id')
            ->leftJoin('internal_users as iu_assignee', 'cr.assignee_id', '=', 'iu_assignee.id')
            ->leftJoin('internal_users as iu_receiver', 'cr.receiver_user_id', '=', 'iu_receiver.id')
            ->leftJoin('workflow_status_catalogs as wsc', 'cr.status_catalog_id', '=', 'wsc.id')
            ->whereNull('cr.deleted_at');
        $hasLatestTransitionJoin = $this->hasTable('request_transitions')
            && $this->hasColumn('customer_requests', 'latest_transition_id')
            && $this->hasColumn('request_transitions', 'id');
        if ($hasLatestTransitionJoin) {
            $query->leftJoin('request_transitions as rt_latest', function ($join): void {
                $join->on('cr.latest_transition_id', '=', 'rt_latest.id');
                if ($this->hasColumn('request_transitions', 'deleted_at')) {
                    $join->whereNull('rt_latest.deleted_at');
                }
            });
        }

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

        if ($serviceGroupId !== null) {
            $query->where('cr.service_group_id', $serviceGroupId);
        }

        if ($workflowActionCode !== '') {
            if ($hasLatestTransitionJoin && $this->hasColumn('request_transitions', 'workflow_action_code')) {
                $query->whereRaw('UPPER(TRIM(COALESCE(rt_latest.workflow_action_code, ""))) = ?', [$workflowActionCode]);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($toStatusCatalogId !== null) {
            if ($hasLatestTransitionJoin && $this->hasColumn('request_transitions', 'to_status_catalog_id')) {
                $query->where('rt_latest.to_status_catalog_id', $toStatusCatalogId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $this->applyCustomerRequestVisibilityScope($query, $viewerUserId, 'cr');

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
            $this->hasColumn('customer_requests', 'assigned_date') ? 'cr.assigned_date' : null,
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
            $hasLatestTransitionJoin && $this->hasColumn('request_transitions', 'hours_estimated')
                ? 'rt_latest.hours_estimated as latest_hours_estimated'
                : null,
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
            ->map(fn (object $row): array => $this->serializeCustomerRequestRow((array) $row, $viewerUserId))
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
                'assigned_date' => $this->normalizeDate($payload['assigned_date'] ?? null),
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
                'request_id' => $insertId,
                'request_code' => $requestCode,
                'request_summary' => $insertPayload['summary'] ?? null,
                'customer_id' => $insertPayload['customer_id'] ?? null,
                'project_id' => $insertPayload['project_id'] ?? null,
                'project_item_id' => $insertPayload['project_item_id'] ?? null,
                'service_group_id' => $insertPayload['service_group_id'] ?? null,
                'request_owner_id' => $insertPayload['created_by'] ?? $actorId,
                'receiver_user_id' => $insertPayload['receiver_user_id'] ?? null,
                'assignee_id' => $insertPayload['assignee_id'] ?? null,
                'from_status_catalog_id' => null,
                'to_status_catalog_id' => $statusCatalogId,
                'workflow_action_code' => $payload['workflow_action_code'] ?? null,
                'workflow_reason' => $payload['workflow_reason'] ?? null,
                'viewer_role_context' => $this->resolveViewerWorkflowRoleContext([
                    'created_by' => $insertPayload['created_by'] ?? $actorId,
                    'receiver_user_id' => $insertPayload['receiver_user_id'] ?? null,
                    'assignee_id' => $insertPayload['assignee_id'] ?? null,
                    'status_catalog_id' => $statusCatalogId,
                    'status' => $status,
                    'sub_status' => $subStatus,
                ], $actorId),
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
            $this->syncCustomerRequestAttachments(
                $insertId,
                is_array($payload['attachments'] ?? null) ? $payload['attachments'] : [],
                $actorId
            );

            return $this->getById($insertId, $actorId);
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
            $viewerRoleContext = $this->resolveViewerWorkflowRoleContext(array_merge(
                (array) $current,
                Arr::only($payload, ['receiver_user_id', 'assignee_id'])
            ), $actorId);
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
                'assigned_date' => array_key_exists('assigned_date', $payload)
                    ? $this->normalizeDate($payload['assigned_date'])
                    : (($this->hasColumn('customer_requests', 'assigned_date') ? ($current->assigned_date ?? null) : null)),
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
                    'request_id' => $id,
                    'request_code' => (string) $current->request_code,
                    'request_summary' => $updatePayload['summary'] ?? $current->summary,
                    'customer_id' => $updatePayload['customer_id'] ?? $current->customer_id,
                    'project_id' => $updatePayload['project_id'] ?? $current->project_id,
                    'project_item_id' => $updatePayload['project_item_id'] ?? $current->project_item_id,
                    'service_group_id' => $updatePayload['service_group_id'] ?? $current->service_group_id,
                    'request_owner_id' => $current->created_by ?? null,
                    'receiver_user_id' => $updatePayload['receiver_user_id'] ?? $current->receiver_user_id,
                    'assignee_id' => $updatePayload['assignee_id'] ?? $current->assignee_id,
                    'from_status_catalog_id' => $this->parseNullableInt($current->status_catalog_id),
                    'to_status_catalog_id' => $statusCatalogId,
                    'workflow_action_code' => $payload['workflow_action_code'] ?? null,
                    'workflow_reason' => $payload['workflow_reason'] ?? null,
                    'viewer_role_context' => $viewerRoleContext,
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

            if (array_key_exists('attachments', $payload)) {
                $this->syncCustomerRequestAttachments(
                    $id,
                    is_array($payload['attachments'] ?? null) ? $payload['attachments'] : [],
                    $actorId
                );
            }

            return $this->getById($id, $actorId);
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
    public function history(int $id, ?int $viewerUserId = null): array
    {
        $this->assertTable('customer_requests');

        $request = $this->getById($id, $viewerUserId);
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
        if ($transitions !== []) {
            $notificationSummaryMap = $this->loadWorkflowNotificationSummaryMapByTransitionIds(
                array_map(fn (array $row): int => (int) ($row['id'] ?? 0), $transitions)
            );
            $transitions = array_map(
                fn (array $row): array => $this->enrichTransitionAuditRow($row, $notificationSummaryMap),
                $transitions
            );
        }

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
    public function histories(?int $requestId = null, int $limit = 200, array $filters = [], ?int $viewerUserId = null): array
    {
        $this->assertTable('customer_requests');
        $limit = max(1, min(1000, $limit));
        $filters = $this->normalizeCustomerRequestHistoryFilters($filters);
        $isDashboardHistoryScope = $this->hasCustomerRequestDashboardHistoryScope($filters);

        $requestQuery = DB::table('customer_requests as cr')
            ->select(['cr.id', 'cr.request_code', 'cr.summary'])
            ->whereNull('cr.deleted_at');

        if ($requestId !== null) {
            $requestQuery->where('cr.id', $requestId);
        }
        if ($filters['service_group_id'] !== null && $this->hasColumn('customer_requests', 'service_group_id')) {
            $requestQuery->where('cr.service_group_id', $filters['service_group_id']);
        }

        $this->applyCustomerRequestVisibilityScope($requestQuery, $viewerUserId, 'cr');

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
            $hasTransitionHoursEstimated = $this->hasColumn('request_transitions', 'hours_estimated');
            $hasFromStatusCatalogId = $this->hasColumn('request_transitions', 'from_status_catalog_id');
            $hasToStatusCatalogId = $this->hasColumn('request_transitions', 'to_status_catalog_id');
            $hasWorkflowActionCode = $this->hasColumn('request_transitions', 'workflow_action_code');
            $hasWorkflowReason = $this->hasColumn('request_transitions', 'workflow_reason');
            $hasViewerRoleContextJson = $this->hasColumn('request_transitions', 'viewer_role_context_json');

            if ($this->hasColumn('request_transitions', 'deleted_at')) {
                $transitionQuery->whereNull('rt.deleted_at');
            }
            if ($filters['workflow_action_code'] !== null && $hasWorkflowActionCode) {
                $transitionQuery->whereRaw('UPPER(TRIM(COALESCE(rt.workflow_action_code, ""))) = ?', [$filters['workflow_action_code']]);
            }
            if ($filters['to_status_catalog_id'] !== null && $hasToStatusCatalogId) {
                $transitionQuery->where('rt.to_status_catalog_id', $filters['to_status_catalog_id']);
            }
            if ($filters['date_from'] !== null && $this->hasColumn('request_transitions', 'created_at')) {
                $transitionQuery->whereDate('rt.created_at', '>=', $filters['date_from']);
            }
            if ($filters['date_to'] !== null && $this->hasColumn('request_transitions', 'created_at')) {
                $transitionQuery->whereDate('rt.created_at', '<=', $filters['date_to']);
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
            if ($hasTransitionHoursEstimated) {
                $transitionSelects[] = 'rt.hours_estimated';
            }
            if ($hasFromStatusCatalogId) {
                $transitionSelects[] = 'rt.from_status_catalog_id';
            }
            if ($hasToStatusCatalogId) {
                $transitionSelects[] = 'rt.to_status_catalog_id';
            }
            if ($hasWorkflowActionCode) {
                $transitionSelects[] = 'rt.workflow_action_code';
            }
            if ($hasWorkflowReason) {
                $transitionSelects[] = 'rt.workflow_reason';
            }
            if ($hasViewerRoleContextJson) {
                $transitionSelects[] = 'rt.viewer_role_context_json';
            }
            $transitionSelects = array_values(array_filter([...$transitionSelects, ...$selectActorColumns]));

            $transitionRows = $transitionQuery
                ->select($transitionSelects)
                ->orderByDesc('rt.created_at')
                ->orderByDesc('rt.id')
                ->get();
            $notificationSummaryMap = $this->loadWorkflowNotificationSummaryMapByTransitionIds(
                $transitionRows
                    ->map(fn (object $row): int => (int) ($row->id ?? 0))
                    ->filter(fn (int $id): bool => $id > 0)
                    ->values()
                    ->all()
            );

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
                    'from_status_catalog_id' => $this->parseNullableInt($row->from_status_catalog_id ?? null),
                    'to_status_catalog_id' => $this->parseNullableInt($row->to_status_catalog_id ?? null),
                    'workflow_action_code' => $this->toNullableText($row->workflow_action_code ?? null),
                    'workflow_reason' => $this->toNullableText($row->workflow_reason ?? null)
                        ?? $this->toNullableText($row->transition_note ?? null)
                        ?? $this->toNullableText($row->internal_note ?? null),
                    'viewer_role_context' => $this->decodeTransitionMetadata($row->viewer_role_context_json ?? null),
                    'notification_summary' => $notificationSummaryMap[(int) ($row->id ?? 0)] ?? $this->emptyWorkflowNotificationSummary(),
                    'hours_estimated' => $this->parseNullableFloat($row->hours_estimated ?? null),
                    'pause_reason' => $pauseReason,
                    'upcode_status' => $upcodeStatus,
                    'progress' => $progress,
                    'actor_name' => $this->resolveHistoryActorName((array) $row),
                    'occurred_at' => $this->toNullableText($row->created_at ?? null),
                ];
            }
        }

        if (! $isDashboardHistoryScope && $this->hasTable('request_worklogs')) {
            $worklogQuery = DB::table('request_worklogs as wl')
                ->whereIn('wl.request_code', $requestCodes);

            if ($this->hasColumn('request_worklogs', 'deleted_at')) {
                $worklogQuery->whereNull('wl.deleted_at');
            }
            if ($filters['date_from'] !== null && $this->hasColumn('request_worklogs', 'created_at')) {
                $worklogQuery->whereDate('wl.created_at', '>=', $filters['date_from']);
            }
            if ($filters['date_to'] !== null && $this->hasColumn('request_worklogs', 'created_at')) {
                $worklogQuery->whereDate('wl.created_at', '<=', $filters['date_to']);
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

        if (! $isDashboardHistoryScope && $this->hasTable('request_ref_tasks')) {
            $refTaskQuery = DB::table('request_ref_tasks as rft')
                ->whereIn('rft.request_code', $requestCodes);

            if ($this->hasColumn('request_ref_tasks', 'deleted_at')) {
                $refTaskQuery->whereNull('rft.deleted_at');
            }
            if ($filters['date_from'] !== null && $this->hasColumn('request_ref_tasks', 'created_at')) {
                $refTaskQuery->whereDate('rft.created_at', '>=', $filters['date_from']);
            }
            if ($filters['date_to'] !== null && $this->hasColumn('request_ref_tasks', 'created_at')) {
                $refTaskQuery->whereDate('rft.created_at', '<=', $filters['date_to']);
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

    /**
     * @param array<string,mixed> $filters
     * @return array{service_group_id:?int,workflow_action_code:?string,to_status_catalog_id:?int,date_from:?string,date_to:?string}
     */
    private function normalizeCustomerRequestHistoryFilters(array $filters): array
    {
        $workflowActionCode = $this->normalizeToken($filters['workflow_action_code'] ?? null);

        return [
            'service_group_id' => $this->parseNullableInt($filters['service_group_id'] ?? null),
            'workflow_action_code' => $workflowActionCode !== '' ? $workflowActionCode : null,
            'to_status_catalog_id' => $this->parseNullableInt($filters['to_status_catalog_id'] ?? null),
            'date_from' => $this->normalizeDate($filters['date_from'] ?? null),
            'date_to' => $this->normalizeDate($filters['date_to'] ?? null),
        ];
    }

    /**
     * @param array{service_group_id:?int,workflow_action_code:?string,to_status_catalog_id:?int,date_from:?string,date_to:?string} $filters
     */
    private function hasCustomerRequestDashboardHistoryScope(array $filters): bool
    {
        return $filters['service_group_id'] !== null
            || $filters['workflow_action_code'] !== null
            || $filters['to_status_catalog_id'] !== null
            || $filters['date_from'] !== null
            || $filters['date_to'] !== null;
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
     * @return array{status:string,sub_status:?string,status_catalog_id:?int}
     */
    public function resolveStatusSnapshotForPayload(array $payload, ?array $current = null): array
    {
        $resolvedPayload = $current !== null ? array_merge($current, $payload) : $payload;
        [$status, $subStatus, $statusCatalogId] = $this->resolveStatusValuesFromPayload($resolvedPayload);

        return [
            'status' => $status,
            'sub_status' => $subStatus,
            'status_catalog_id' => $statusCatalogId,
        ];
    }

    public function isAnalysisStatus(?string $status, ?string $subStatus = null): bool
    {
        return $this->normalizeLooseToken((string) ($status ?? '')) === 'phantich'
            && $this->normalizeLooseToken((string) ($subStatus ?? '')) === '';
    }

    public function isProcessingStatus(?string $status, ?string $subStatus = null): bool
    {
        return $this->normalizeToken($status) === 'DANG_XU_LY'
            && $this->normalizeToken($subStatus) === '';
    }

    public function isWaitingCustomerFeedbackStatus(?string $status, ?string $subStatus = null): bool
    {
        return $this->normalizeToken($status) === 'DOI_PHAN_HOI_KH'
            && $this->normalizeToken($subStatus) === '';
    }

    public function hasIncomingAnalysisProgressInMetadata(?array $metadata): bool
    {
        if (! is_array($metadata) || $metadata === []) {
            return false;
        }

        foreach ($metadata as $metadataKey => $metadataValue) {
            $token = $this->normalizeLooseToken((string) $metadataKey);
            if (! in_array($token, ['analysisprogress'], true)) {
                continue;
            }

            return $metadataValue !== null;
        }

        return false;
    }

    public function extractIncomingAnalysisProgressFromMetadata(?array $metadata): ?float
    {
        return $this->extractTransitionMetadataProgress($metadata, [
            'analysis_progress',
            'analysisprogress',
        ]);
    }

    /**
     * @return array{progress:?float,hours_estimated:?float,transition_metadata:?array<string,mixed>}
     */
    public function resolveLatestAnalysisSnapshotByRequestCode(string $requestCode): array
    {
        $requestCode = trim($requestCode);
        if ($requestCode === '' || ! $this->hasTable('request_transitions')) {
            return ['progress' => null, 'hours_estimated' => null, 'transition_metadata' => null];
        }

        $selects = ['to_status', 'sub_status'];
        if ($this->hasColumn('request_transitions', 'hours_estimated')) {
            $selects[] = 'hours_estimated';
        }
        if ($this->hasColumn('request_transitions', 'transition_metadata')) {
            $selects[] = 'transition_metadata';
        }

        $query = DB::table('request_transitions')
            ->select($selects)
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
            if (! $this->isAnalysisStatus($row->to_status ?? null, $row->sub_status ?? null)) {
                continue;
            }

            $metadata = $this->decodeTransitionMetadata($row->transition_metadata ?? null);

            return [
                'progress' => $this->extractIncomingAnalysisProgressFromMetadata($metadata),
                'hours_estimated' => $this->parseNullableFloat($row->hours_estimated ?? null),
                'transition_metadata' => $metadata,
            ];
        }

        return ['progress' => null, 'hours_estimated' => null, 'transition_metadata' => null];
    }

    /**
     * @return array{hours_estimated:?float,transition_metadata:?array<string,mixed>}
     */
    public function resolveLatestProcessingSnapshotByRequestCode(string $requestCode): array
    {
        $requestCode = trim($requestCode);
        if ($requestCode === '' || ! $this->hasTable('request_transitions')) {
            return ['hours_estimated' => null, 'transition_metadata' => null];
        }

        $selects = ['to_status', 'sub_status'];
        if ($this->hasColumn('request_transitions', 'hours_estimated')) {
            $selects[] = 'hours_estimated';
        }
        if ($this->hasColumn('request_transitions', 'transition_metadata')) {
            $selects[] = 'transition_metadata';
        }

        $query = DB::table('request_transitions')
            ->select($selects)
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
            if (! $this->isProcessingStatus($row->to_status ?? null, $row->sub_status ?? null)) {
                continue;
            }

            return [
                'hours_estimated' => $this->parseNullableFloat($row->hours_estimated ?? null),
                'transition_metadata' => $this->decodeTransitionMetadata($row->transition_metadata ?? null),
            ];
        }

        return ['hours_estimated' => null, 'transition_metadata' => null];
    }

    /**
     * @return array{transition_metadata:?array<string,mixed>}
     */
    public function resolveLatestWaitingCustomerFeedbackSnapshotByRequestCode(string $requestCode): array
    {
        $requestCode = trim($requestCode);
        if ($requestCode === '' || ! $this->hasTable('request_transitions')) {
            return ['transition_metadata' => null];
        }

        $selects = ['to_status', 'sub_status'];
        if ($this->hasColumn('request_transitions', 'transition_metadata')) {
            $selects[] = 'transition_metadata';
        }

        $query = DB::table('request_transitions')
            ->select($selects)
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
            if (! $this->isWaitingCustomerFeedbackStatus($row->to_status ?? null, $row->sub_status ?? null)) {
                continue;
            }

            return [
                'transition_metadata' => $this->decodeTransitionMetadata($row->transition_metadata ?? null),
            ];
        }

        return ['transition_metadata' => null];
    }

    public function isAnalysisRootCatalogId(?int $statusCatalogId): bool
    {
        if ($statusCatalogId === null || ! $this->hasTable('workflow_status_catalogs')) {
            return false;
        }

        $catalog = DB::table('workflow_status_catalogs')->where('id', $statusCatalogId)->first();
        if (! $catalog) {
            return false;
        }

        return $this->isAnalysisCatalogRecord($catalog) && $this->parseNullableInt($catalog->parent_id ?? null) === null;
    }

    public function isAnalysisDescendantCatalogId(?int $statusCatalogId): bool
    {
        if ($statusCatalogId === null || ! $this->hasTable('workflow_status_catalogs')) {
            return false;
        }

        $originalCatalogId = $statusCatalogId;
        $visited = [];
        while ($statusCatalogId !== null && ! isset($visited[$statusCatalogId])) {
            $visited[$statusCatalogId] = true;
            $catalog = DB::table('workflow_status_catalogs')->where('id', $statusCatalogId)->first();
            if (! $catalog) {
                return false;
            }

            if ($this->isAnalysisCatalogRecord($catalog)) {
                return $originalCatalogId !== (int) $catalog->id;
            }

            $statusCatalogId = $this->parseNullableInt($catalog->parent_id ?? null);
        }

        return false;
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

    /**
     * @return array<string,mixed>
     */
    public function dashboardSummary(Request $request): array
    {
        $this->assertTable('customer_requests');

        $filters = $this->normalizeCustomerRequestDashboardFilters($request);
        $viewerUserId = $this->parseNullableInt($request->user()?->id ?? null);
        if (! $this->hasTable('request_transitions')) {
            return [
                'generated_at' => now()->toIso8601String(),
                'filters' => $filters,
                'summary' => [
                    'totals' => $this->emptyCustomerRequestDashboardMetricTotals(),
                    'by_action' => [],
                    'by_service_group' => [],
                    'by_target_status' => [],
                    'notifications' => [
                        'total_logs' => 0,
                        'resolved_count' => 0,
                        'skipped_count' => 0,
                    ],
                    'sla' => [
                        'tracked_count' => 0,
                        'breached_count' => 0,
                        'on_time_count' => 0,
                    ],
                ],
                'dataset' => [],
            ];
        }

        $dataset = $this->buildCustomerRequestDashboardDataset(
            $this->buildCustomerRequestDashboardBaseQuery($filters, $viewerUserId)
        );
        $totals = $this->summarizeCustomerRequestDashboardTotals($dataset);

        return [
            'generated_at' => now()->toIso8601String(),
            'filters' => $filters,
            'summary' => [
                'totals' => $totals,
                'by_action' => $this->aggregateCustomerRequestDashboardDataset($dataset, 'workflow_action_code'),
                'by_service_group' => $this->aggregateCustomerRequestDashboardDataset($dataset, 'service_group_id'),
                'by_target_status' => $this->aggregateCustomerRequestDashboardDataset($dataset, 'to_status_catalog_id'),
                'notifications' => [
                    'total_logs' => $totals['notification_total'],
                    'resolved_count' => $totals['notification_resolved'],
                    'skipped_count' => $totals['notification_skipped'],
                ],
                'sla' => [
                    'tracked_count' => $totals['sla_tracked_count'],
                    'breached_count' => $totals['sla_breached_count'],
                    'on_time_count' => $totals['sla_on_time_count'],
                ],
            ],
            'dataset' => $dataset,
        ];
    }

    public function exportDashboardSummary(Request $request): StreamedResponse
    {
        $payload = $this->dashboardSummary($request);
        $rows = $payload['dataset'] ?? [];

        $fileName = 'customer_request_dashboard_summary_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, [
                'Action code',
                'Tên hành động',
                'Nhóm hỗ trợ ID',
                'Nhóm hỗ trợ',
                'Trạng thái đích ID',
                'Trạng thái đích',
                'Số transition',
                'Theo dõi SLA',
                'SLA breach',
                'SLA đúng hạn',
                'Notification total',
                'Notification resolved',
                'Notification skipped',
            ]);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['workflow_action_code'] ?? '',
                    $row['action_name'] ?? '',
                    $row['service_group_id'] ?? '',
                    $row['service_group_name'] ?? '',
                    $row['to_status_catalog_id'] ?? '',
                    $row['to_status_name'] ?? '',
                    $row['transition_count'] ?? 0,
                    $row['sla_tracked_count'] ?? 0,
                    $row['sla_breached_count'] ?? 0,
                    $row['sla_on_time_count'] ?? 0,
                    $row['notification_total'] ?? 0,
                    $row['notification_resolved'] ?? 0,
                    $row['notification_skipped'] ?? 0,
                ]);
            }

            fclose($handle);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
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
                $this->hasColumn('workflow_status_catalogs', 'allow_pending_selection')
                    ? 'wsc.allow_pending_selection'
                    : DB::raw('0 as allow_pending_selection'),
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

        $level = max(1, min(3, (int) ($payload['level'] ?? 1)));
        $isLeaf = ! empty($payload['is_leaf']) ? 1 : 0;
        $allowPendingSelection = (
            $this->hasColumn('workflow_status_catalogs', 'allow_pending_selection')
            && $level === 2
            && $isLeaf === 0
            && ! empty($payload['allow_pending_selection'])
        ) ? 1 : 0;

        $insert = $this->filterPayloadByTable('workflow_status_catalogs', [
            'level' => $level,
            'status_code' => $this->sanitizeStatusCode((string) ($payload['status_code'] ?? '')),
            'status_name' => trim((string) ($payload['status_name'] ?? '')),
            'parent_id' => $this->parseNullableInt($payload['parent_id'] ?? null),
            'canonical_status' => $this->normalizeNullableStatus($payload['canonical_status'] ?? null),
            'canonical_sub_status' => $this->normalizeNullableStatus($payload['canonical_sub_status'] ?? null),
            'flow_step' => $this->toNullableText($payload['flow_step'] ?? null),
            'form_key' => $this->toNullableText($payload['form_key'] ?? null),
            'is_leaf' => $isLeaf,
            'allow_pending_selection' => $allowPendingSelection,
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
        $this->flushWorkflowConfigCaches();
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

        $level = array_key_exists('level', $payload)
            ? max(1, min(3, (int) $payload['level']))
            : (int) $current->level;
        $isLeaf = array_key_exists('is_leaf', $payload)
            ? (! empty($payload['is_leaf']) ? 1 : 0)
            : (int) $current->is_leaf;
        $allowPendingSelection = (
            $this->hasColumn('workflow_status_catalogs', 'allow_pending_selection')
            && $level === 2
            && $isLeaf === 0
            && ! empty($payload['allow_pending_selection'])
        ) ? 1 : 0;

        $update = $this->filterPayloadByTable('workflow_status_catalogs', [
            'level' => $level,
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
            'is_leaf' => $isLeaf,
            'allow_pending_selection' => array_key_exists('allow_pending_selection', $payload)
                ? $allowPendingSelection
                : ($this->hasColumn('workflow_status_catalogs', 'allow_pending_selection') ? ($current->allow_pending_selection ?? 0) : 0),
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
        $this->flushWorkflowConfigCaches();
        return (array) DB::table('workflow_status_catalogs')->where('id', $id)->first();
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listWorkflowStatusTransitions(?int $fromStatusCatalogId = null, bool $includeInactive = false): array
    {
        $this->assertTable('workflow_status_transitions');

        $cacheKey = ($includeInactive ? 'all' : 'active').':'.($fromStatusCatalogId ?? 'all');
        if (array_key_exists($cacheKey, $this->transitionConfigCache)) {
            return $this->transitionConfigCache[$cacheKey];
        }

        $query = DB::table('workflow_status_transitions as t')
            ->leftJoin('workflow_status_catalogs as from_status', 't.from_status_catalog_id', '=', 'from_status.id')
            ->leftJoin('workflow_status_catalogs as to_status', 't.to_status_catalog_id', '=', 'to_status.id')
            ->select(array_values(array_filter([
                't.id',
                't.from_status_catalog_id',
                'from_status.status_name as from_status_name',
                't.to_status_catalog_id',
                'to_status.status_name as to_status_name',
                't.action_code',
                't.action_name',
                't.required_role',
                't.condition_json',
                't.notify_targets_json',
                't.sort_order',
                't.is_active',
                $this->hasColumn('workflow_status_transitions', 'created_at') ? 't.created_at' : null,
                $this->hasColumn('workflow_status_transitions', 'created_by') ? 't.created_by' : null,
                $this->hasColumn('workflow_status_transitions', 'updated_at') ? 't.updated_at' : null,
                $this->hasColumn('workflow_status_transitions', 'updated_by') ? 't.updated_by' : null,
            ])));

        if ($fromStatusCatalogId !== null) {
            $query->where('t.from_status_catalog_id', $fromStatusCatalogId);
        }

        if (! $includeInactive) {
            $query->where('t.is_active', 1);
        }

        $rows = $query
            ->orderBy('t.from_status_catalog_id')
            ->orderBy('t.sort_order')
            ->orderBy('t.id')
            ->get()
            ->map(fn (object $row): array => $this->decodeWorkflowStatusTransitionRow((array) $row))
            ->values()
            ->all();

        $this->transitionConfigCache[$cacheKey] = $rows;

        return $rows;
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function storeWorkflowStatusTransition(array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_status_transitions');

        $fromStatusCatalogId = $this->parseNullableInt($payload['from_status_catalog_id'] ?? null);
        $toStatusCatalogId = $this->parseNullableInt($payload['to_status_catalog_id'] ?? null);
        $actionCode = $this->sanitizeStatusCode((string) ($payload['action_code'] ?? ''));
        $actionName = trim((string) ($payload['action_name'] ?? ''));

        if ($fromStatusCatalogId === null || $toStatusCatalogId === null) {
            throw new \RuntimeException('Thiếu trạng thái nguồn hoặc trạng thái đích.');
        }
        if ($fromStatusCatalogId === $toStatusCatalogId) {
            throw new \RuntimeException('Trạng thái nguồn và đích không được trùng nhau.');
        }
        if (($actionCode === '') || ($actionName === '')) {
            throw new \RuntimeException('Thiếu action_code hoặc action_name.');
        }

        $insert = $this->filterPayloadByTable('workflow_status_transitions', [
            'from_status_catalog_id' => $fromStatusCatalogId,
            'to_status_catalog_id' => $toStatusCatalogId,
            'action_code' => $actionCode,
            'action_name' => $actionName,
            'required_role' => $this->normalizeWorkflowActorRole($payload['required_role'] ?? null),
            'condition_json' => $this->encodeJson($payload['condition_json'] ?? null),
            'notify_targets_json' => $this->encodeJson($this->normalizeWorkflowActorRoleList($payload['notify_targets_json'] ?? null)),
            'sort_order' => max(0, (int) ($payload['sort_order'] ?? 0)),
            'is_active' => array_key_exists('is_active', $payload) ? (! empty($payload['is_active']) ? 1 : 0) : 1,
            'created_at' => now(),
            'created_by' => $actorId,
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        $id = (int) DB::table('workflow_status_transitions')->insertGetId($insert);
        $this->flushWorkflowConfigCaches();

        return $this->loadWorkflowStatusTransitionById($id);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function updateWorkflowStatusTransition(int $id, array $payload, ?int $actorId): array
    {
        $this->assertTable('workflow_status_transitions');

        $current = DB::table('workflow_status_transitions')->where('id', $id)->first();
        if (! $current) {
            throw new \RuntimeException('Không tìm thấy cấu hình transition workflow.');
        }

        $fromStatusCatalogId = array_key_exists('from_status_catalog_id', $payload)
            ? $this->parseNullableInt($payload['from_status_catalog_id'])
            : (int) $current->from_status_catalog_id;
        $toStatusCatalogId = array_key_exists('to_status_catalog_id', $payload)
            ? $this->parseNullableInt($payload['to_status_catalog_id'])
            : (int) $current->to_status_catalog_id;
        $actionCode = array_key_exists('action_code', $payload)
            ? $this->sanitizeStatusCode((string) ($payload['action_code'] ?? ''))
            : (string) $current->action_code;
        $actionName = array_key_exists('action_name', $payload)
            ? trim((string) ($payload['action_name'] ?? ''))
            : (string) $current->action_name;

        if ($fromStatusCatalogId === null || $toStatusCatalogId === null) {
            throw new \RuntimeException('Thiếu trạng thái nguồn hoặc trạng thái đích.');
        }
        if ($fromStatusCatalogId === $toStatusCatalogId) {
            throw new \RuntimeException('Trạng thái nguồn và đích không được trùng nhau.');
        }
        if (($actionCode === '') || ($actionName === '')) {
            throw new \RuntimeException('Thiếu action_code hoặc action_name.');
        }

        $update = $this->filterPayloadByTable('workflow_status_transitions', [
            'from_status_catalog_id' => $fromStatusCatalogId,
            'to_status_catalog_id' => $toStatusCatalogId,
            'action_code' => $actionCode,
            'action_name' => $actionName,
            'required_role' => array_key_exists('required_role', $payload)
                ? $this->normalizeWorkflowActorRole($payload['required_role'])
                : $this->normalizeWorkflowActorRole($current->required_role ?? null),
            'condition_json' => array_key_exists('condition_json', $payload)
                ? $this->encodeJson($payload['condition_json'] ?? null)
                : ($current->condition_json ?? null),
            'notify_targets_json' => array_key_exists('notify_targets_json', $payload)
                ? $this->encodeJson($this->normalizeWorkflowActorRoleList($payload['notify_targets_json'] ?? null))
                : ($current->notify_targets_json ?? null),
            'sort_order' => array_key_exists('sort_order', $payload)
                ? max(0, (int) ($payload['sort_order'] ?? 0))
                : (int) ($current->sort_order ?? 0),
            'is_active' => array_key_exists('is_active', $payload)
                ? (! empty($payload['is_active']) ? 1 : 0)
                : (int) ($current->is_active ?? 1),
            'updated_at' => now(),
            'updated_by' => $actorId,
        ]);

        DB::table('workflow_status_transitions')->where('id', $id)->update($update);
        $this->flushWorkflowConfigCaches();

        return $this->loadWorkflowStatusTransitionById($id);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listWorkflowStatusViewRules(?int $statusCatalogId = null, bool $includeInactive = false): array
    {
        $this->assertTable('workflow_status_view_rules');

        $cacheKey = ($includeInactive ? 'all' : 'active').':'.($statusCatalogId ?? 'all');
        if (array_key_exists($cacheKey, $this->viewRuleCache)) {
            return $this->viewRuleCache[$cacheKey];
        }

        $query = DB::table('workflow_status_view_rules as r')
            ->leftJoin('workflow_status_catalogs as status', 'r.status_catalog_id', '=', 'status.id')
            ->select([
                'r.id',
                'r.status_catalog_id',
                'status.status_name as status_name',
                'r.viewer_role',
                'r.can_view',
                'r.sort_order',
                'r.is_active',
                'r.created_at',
                'r.created_by',
                'r.updated_at',
                'r.updated_by',
            ]);

        if ($statusCatalogId !== null) {
            $query->where('r.status_catalog_id', $statusCatalogId);
        }

        if (! $includeInactive) {
            $query->where('r.is_active', 1);
        }

        $rows = $query
            ->orderBy('r.status_catalog_id')
            ->orderBy('r.sort_order')
            ->orderBy('r.id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        $this->viewRuleCache[$cacheKey] = $rows;

        return $rows;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function resolveConfiguredAvailableActions(?int $fromStatusCatalogId, string|array|null $viewerRole = null): array
    {
        if ($fromStatusCatalogId === null || ! $this->hasTable('workflow_status_transitions')) {
            return [];
        }

        $normalizedViewerRoles = [];
        if (is_array($viewerRole)) {
            foreach ($viewerRole as $role) {
                $normalizedRole = $this->normalizeWorkflowActorRole($role);
                if ($normalizedRole !== null) {
                    $normalizedViewerRoles[] = $normalizedRole;
                }
            }
        } else {
            $normalizedRole = $this->normalizeWorkflowActorRole($viewerRole);
            if ($normalizedRole !== null) {
                $normalizedViewerRoles[] = $normalizedRole;
            }
        }
        $normalizedViewerRoles = array_values(array_unique($normalizedViewerRoles));

        return collect($this->listWorkflowStatusTransitions($fromStatusCatalogId))
            ->filter(function (array $transition) use ($normalizedViewerRoles): bool {
                $requiredRole = $this->normalizeWorkflowActorRole($transition['required_role'] ?? null);
                if ($requiredRole === null) {
                    return true;
                }

                if ($normalizedViewerRoles === []) {
                    return false;
                }

                return $requiredRole === 'ANY' || in_array($requiredRole, $normalizedViewerRoles, true);
            })
            ->values()
            ->all();
    }

    /**
     * @param array<string,mixed> $currentRow
     */
    public function validateConfiguredTransitionChange(array $currentRow, ?int $targetStatusCatalogId, ?int $viewerUserId): ?string
    {
        $currentStatusCatalogId = $this->resolveEffectiveStatusCatalogIdFromRow($currentRow);
        if ($currentStatusCatalogId === null || $targetStatusCatalogId === null || $currentStatusCatalogId === $targetStatusCatalogId) {
            return null;
        }

        $configuredTransitions = $this->listWorkflowStatusTransitions($currentStatusCatalogId);
        if ($configuredTransitions === []) {
            return null;
        }

        $viewerRoleContext = $this->resolveViewerWorkflowRoleContext($currentRow, $viewerUserId);
        $availableActions = $this->resolveConfiguredAvailableActions($currentStatusCatalogId, $viewerRoleContext['roles']);

        foreach ($availableActions as $transition) {
            if ((int) ($transition['to_status_catalog_id'] ?? 0) === $targetStatusCatalogId) {
                return null;
            }
        }

        if ($availableActions === []) {
            return 'Bạn không có quyền chuyển trạng thái ở bước hiện tại.';
        }

        $targetStatusName = $this->resolveWorkflowStatusCatalogNameById($targetStatusCatalogId) ?? 'trạng thái đã chọn';
        $availableActionNames = array_values(array_unique(array_filter(
            array_map(
                fn (array $transition): ?string => $this->toNullableText($transition['action_name'] ?? null),
                $availableActions
            )
        )));

        if ($availableActionNames === []) {
            return sprintf('Không thể chuyển trạng thái sang "%s" ở bước hiện tại.', $targetStatusName);
        }

        return sprintf(
            'Không thể chuyển trạng thái sang "%s". Thao tác hợp lệ hiện tại: %s.',
            $targetStatusName,
            implode(', ', $availableActionNames)
        );
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

        $status = $this->normalizeToken($payload['status'] ?? null);
        $subStatus = $this->normalizeNullableStatus($payload['sub_status'] ?? null);
        if ($status === '') {
            $serviceGroupBinding = $this->resolveSupportServiceGroupWorkflowBinding(
                $this->parseNullableInt($payload['service_group_id'] ?? null)
            );
            $boundStatusCatalogId = $this->parseNullableInt($serviceGroupBinding['workflow_status_catalog_id'] ?? null);
            if ($boundStatusCatalogId !== null && $this->toNullableText($serviceGroupBinding['workflow_status_code'] ?? null) !== null) {
                [$status, $subStatus] = $this->resolveCanonicalStatusByCatalog($boundStatusCatalogId);
                $statusCatalogId = $boundStatusCatalogId;
            }
        }

        if ($status === '') {
            $status = 'MOI_TIEP_NHAN';
        }

        if ($statusCatalogId === null) {
            $statusCatalogId = $this->resolveStatusCatalogIdByRuntimeStatus($status, $subStatus);
        }

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
        $serviceGroupId = $this->parseNullableInt($payload['service_group_id'] ?? null);
        $fromStatusCatalogId = $this->parseNullableInt($payload['from_status_catalog_id'] ?? null);
        $toStatusCatalogId = $this->parseNullableInt($payload['to_status_catalog_id'] ?? null);
        $transitionConfig = $this->resolveTransitionConfigForChange(
            $fromStatusCatalogId,
            $toStatusCatalogId,
            $payload['workflow_action_code'] ?? null
        );
        $workflowActionCode = $this->sanitizeStatusCode((string) ($transitionConfig['action_code'] ?? ''));
        $workflowActionCode = $workflowActionCode !== '' ? $workflowActionCode : null;
        $viewerRoleContext = is_array($payload['viewer_role_context'] ?? null) ? $payload['viewer_role_context'] : null;
        $workflowReason = $this->resolveWorkflowTransitionReason($payload);
        $transitionMetadata = $this->enrichTransitionMetadataForAudit(
            is_array($payload['transition_metadata'] ?? null) ? $payload['transition_metadata'] : null,
            $fromStatusCatalogId,
            $toStatusCatalogId,
            $workflowActionCode,
            $workflowReason,
            $viewerRoleContext
        );

        $slaRule = $this->slaResolver->resolve(
            $toStatus,
            $subStatus,
            $priority,
            null,
            $serviceGroupId,
            $workflowActionCode
        );
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
            'from_status_catalog_id' => $fromStatusCatalogId,
            'to_status_catalog_id' => $toStatusCatalogId,
            'from_status' => $payload['from_status'] ?? null,
            'to_status' => $toStatus,
            'sub_status' => $subStatus,
            'workflow_action_code' => $workflowActionCode,
            'workflow_reason' => $workflowReason,
            'viewer_role_context_json' => $this->encodeJson($viewerRoleContext),
            'new_assignee_id' => $payload['new_assignee_id'] ?? null,
            'hours_estimated' => $payload['hours_estimated'] ?? null,
            'transition_metadata' => $this->encodeJson($transitionMetadata),
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
        $transitionId = (int) DB::table('request_transitions')->insertGetId($insert);

        $notificationSummary = $this->appendWorkflowNotificationLogs(
            $transitionId,
            $payload,
            $workflowActionCode,
            $this->normalizeWorkflowActorRoleList($transitionConfig['notify_targets_json'] ?? null),
            $toStatus,
            $subStatus
        );

        $this->appendWorkflowTransitionAuditLog(
            $transitionId,
            $payload,
            $fromStatusCatalogId,
            $toStatusCatalogId,
            $workflowActionCode,
            $workflowReason,
            $viewerRoleContext,
            $notificationSummary,
            $toStatus,
            $subStatus
        );

        return $transitionId;
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveTransitionConfigForChange(
        ?int $fromStatusCatalogId,
        ?int $toStatusCatalogId,
        mixed $explicitActionCode = null
    ): array {
        $explicit = $this->sanitizeStatusCode((string) ($explicitActionCode ?? ''));
        if ($fromStatusCatalogId === null || $toStatusCatalogId === null || ! $this->hasTable('workflow_status_transitions')) {
            return $explicit !== '' ? ['action_code' => $explicit] : [];
        }

        $matchedByTarget = [];
        foreach ($this->listWorkflowStatusTransitions($fromStatusCatalogId) as $transition) {
            if ((int) ($transition['to_status_catalog_id'] ?? 0) !== $toStatusCatalogId) {
                continue;
            }

            $matchedByTarget[] = $transition;
            if ($explicit === '') {
                continue;
            }

            $transitionActionCode = $this->sanitizeStatusCode((string) ($transition['action_code'] ?? ''));
            if ($transitionActionCode === $explicit) {
                return $transition;
            }
        }

        if ($matchedByTarget !== []) {
            return $matchedByTarget[0];
        }

        return $explicit !== '' ? ['action_code' => $explicit] : [];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<int,string>|null $notifyTargets
     * @return array<string,mixed>
     */
    private function appendWorkflowNotificationLogs(
        int $transitionId,
        array $payload,
        ?string $workflowActionCode,
        ?array $notifyTargets,
        string $toStatus,
        ?string $subStatus
    ): array {
        $summary = $this->emptyWorkflowNotificationSummary();
        if (! $this->hasTable('workflow_notification_logs') || $notifyTargets === null || $notifyTargets === []) {
            return $summary;
        }

        $requestId = $this->parseNullableInt($payload['request_id'] ?? null);
        $requestCode = $this->toNullableText($payload['request_code'] ?? null);
        $actorId = $this->parseNullableInt($payload['updated_by'] ?? ($payload['created_by'] ?? null));
        $now = now();
        $rows = [];

        foreach ($notifyTargets as $targetRole) {
            $summary['target_roles'][] = $targetRole;
            $recipientIds = $this->resolveNotificationRecipientUserIds($targetRole, $payload);
            if ($recipientIds === []) {
                $rows[] = $this->filterPayloadByTable('workflow_notification_logs', [
                    'customer_request_id' => $requestId,
                    'request_transition_id' => $transitionId,
                    'request_code' => $requestCode,
                    'action_code' => $workflowActionCode,
                    'target_role' => $targetRole,
                    'recipient_user_id' => null,
                    'channel' => 'IN_APP',
                    'delivery_status' => 'SKIPPED',
                    'payload_json' => $this->encodeJson([
                        'reason' => 'recipient_not_resolved',
                        'to_status' => $toStatus,
                        'sub_status' => $subStatus,
                    ]),
                    'created_at' => $now,
                    'created_by' => $actorId,
                    'updated_at' => $now,
                    'updated_by' => $actorId,
                ]);
                $summary['total']++;
                $summary['skipped']++;
                continue;
            }

            foreach ($recipientIds as $recipientUserId) {
                $rows[] = $this->filterPayloadByTable('workflow_notification_logs', [
                    'customer_request_id' => $requestId,
                    'request_transition_id' => $transitionId,
                    'request_code' => $requestCode,
                    'action_code' => $workflowActionCode,
                    'target_role' => $targetRole,
                    'recipient_user_id' => $recipientUserId,
                    'channel' => 'IN_APP',
                    'delivery_status' => 'RESOLVED',
                    'payload_json' => $this->encodeJson([
                        'to_status' => $toStatus,
                        'sub_status' => $subStatus,
                    ]),
                    'created_at' => $now,
                    'created_by' => $actorId,
                    'updated_at' => $now,
                    'updated_by' => $actorId,
                ]);
                $summary['total']++;
                $summary['resolved']++;
                $summary['recipient_user_ids'][] = $recipientUserId;
            }
        }

        $summary['target_roles'] = array_values(array_unique($summary['target_roles']));
        $summary['recipient_user_ids'] = array_values(array_unique($summary['recipient_user_ids']));
        if ($rows === []) {
            return $summary;
        }

        DB::table('workflow_notification_logs')->insert($rows);

        return $summary;
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<int,int>
     */
    private function resolveNotificationRecipientUserIds(string $targetRole, array $payload): array
    {
        $normalizedRole = $this->normalizeWorkflowActorRole($targetRole);
        if ($normalizedRole === null) {
            return [];
        }

        $recipientIds = match ($normalizedRole) {
            'CREATOR' => [$this->parseNullableInt($payload['request_owner_id'] ?? null)],
            'PM', 'ASSIGNER', 'INITIAL_RECEIVER' => [$this->parseNullableInt($payload['receiver_user_id'] ?? null)],
            'EXECUTOR', 'WORKER' => [$this->parseNullableInt($payload['assignee_id'] ?? null)],
            'ADMIN' => $this->resolveAdminUserIds(),
            default => [],
        };

        return array_values(array_unique(array_filter(
            array_map(fn ($value): ?int => $this->parseNullableInt($value), $recipientIds),
            fn ($value): bool => $value !== null
        )));
    }

    /**
     * @return array<int,int>
     */
    private function resolveAdminUserIds(): array
    {
        if ($this->adminUserIdsCache !== null) {
            return $this->adminUserIdsCache;
        }

        if (
            ! $this->hasTable('user_roles')
            || ! $this->hasTable('roles')
            || ! $this->hasColumn('user_roles', 'user_id')
            || ! $this->hasColumn('user_roles', 'role_id')
            || ! $this->hasColumn('roles', 'id')
            || ! $this->hasColumn('roles', 'role_code')
        ) {
            $this->adminUserIdsCache = [];
            return $this->adminUserIdsCache;
        }

        $roleIds = DB::table('roles')
            ->whereRaw('UPPER(TRIM(role_code)) = ?', ['ADMIN'])
            ->pluck('id')
            ->map(fn ($value): int => (int) $value)
            ->all();

        if ($roleIds === []) {
            $this->adminUserIdsCache = [];
            return $this->adminUserIdsCache;
        }

        $query = DB::table('user_roles')
            ->whereIn('role_id', $roleIds);

        if ($this->hasColumn('user_roles', 'is_active')) {
            $query->where('is_active', 1);
        }
        if ($this->hasColumn('user_roles', 'expires_at')) {
            $now = now();
            $query->where(function ($builder) use ($now): void {
                $builder->whereNull('expires_at')->orWhere('expires_at', '>', $now);
            });
        }

        $this->adminUserIdsCache = $query
            ->pluck('user_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->values()
            ->all();

        return $this->adminUserIdsCache;
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function resolveWorkflowTransitionReason(array $payload): ?string
    {
        $reason = $this->toNullableText($payload['workflow_reason'] ?? null);
        if ($reason !== null) {
            return $reason;
        }

        if (is_array($payload['transition_metadata'] ?? null)) {
            $reason = $this->extractTransitionMetadataText($payload['transition_metadata'], [
                'workflow_reason',
                'reason',
                'lydo',
            ]);
            if ($reason !== null) {
                return $reason;
            }
        }

        return $this->toNullableText($payload['transition_note'] ?? null)
            ?? $this->toNullableText($payload['internal_note'] ?? null)
            ?? $this->toNullableText($payload['notes'] ?? null);
    }

    /**
     * @param array<string,mixed>|null $transitionMetadata
     * @param array<string,mixed>|null $viewerRoleContext
     * @return array<string,mixed>|null
     */
    private function enrichTransitionMetadataForAudit(
        ?array $transitionMetadata,
        ?int $fromStatusCatalogId,
        ?int $toStatusCatalogId,
        ?string $workflowActionCode,
        ?string $workflowReason,
        ?array $viewerRoleContext
    ): ?array {
        $metadata = is_array($transitionMetadata) ? $transitionMetadata : [];

        if ($fromStatusCatalogId !== null) {
            $metadata['from_status_catalog_id'] = $fromStatusCatalogId;
        }
        if ($toStatusCatalogId !== null) {
            $metadata['to_status_catalog_id'] = $toStatusCatalogId;
        }
        if ($workflowActionCode !== null) {
            $metadata['workflow_action_code'] = $workflowActionCode;
        }
        if ($workflowReason !== null) {
            $metadata['workflow_reason'] = $workflowReason;
        }
        if ($viewerRoleContext !== null && $viewerRoleContext !== []) {
            $metadata['viewer_role_context'] = $viewerRoleContext;
        }

        return $metadata === [] ? null : $metadata;
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed>|null $viewerRoleContext
     * @param array<string,mixed> $notificationSummary
     */
    private function appendWorkflowTransitionAuditLog(
        int $transitionId,
        array $payload,
        ?int $fromStatusCatalogId,
        ?int $toStatusCatalogId,
        ?string $workflowActionCode,
        ?string $workflowReason,
        ?array $viewerRoleContext,
        array $notificationSummary,
        string $toStatus,
        ?string $subStatus
    ): void {
        if (! $this->hasTable('audit_logs')) {
            return;
        }

        try {
            $actorId = $this->parseNullableInt($payload['updated_by'] ?? ($payload['created_by'] ?? null));
            $auditPayload = $this->filterPayloadByTable('audit_logs', [
                'uuid' => (string) Str::uuid(),
                'event' => 'INSERT',
                'auditable_type' => 'request_transitions',
                'auditable_id' => $transitionId,
                'old_values' => $this->encodeJson([
                    'from_status_catalog_id' => $fromStatusCatalogId,
                    'from_status' => $this->normalizeNullableStatus($payload['from_status'] ?? null),
                ]),
                'new_values' => $this->encodeJson([
                    'customer_request_id' => $this->parseNullableInt($payload['request_id'] ?? null),
                    'request_code' => $this->toNullableText($payload['request_code'] ?? null),
                    'to_status_catalog_id' => $toStatusCatalogId,
                    'to_status' => $toStatus,
                    'sub_status' => $subStatus,
                    'workflow_action_code' => $workflowActionCode,
                    'workflow_reason' => $workflowReason,
                    'viewer_role_context' => $viewerRoleContext,
                    'notification_summary' => $notificationSummary,
                ]),
                'created_at' => now(),
                'created_by' => $actorId,
            ]);

            if ($auditPayload === []) {
                return;
            }

            DB::table('audit_logs')->insert($auditPayload);
        } catch (\Throwable) {
            // Không để lỗi audit workflow làm gián đoạn luồng nghiệp vụ.
        }
    }

    /**
     * @param array<string,mixed> $row
     * @param array<int,array<string,mixed>>|null $notificationSummaryMap
     * @return array<string,mixed>
     */
    private function enrichTransitionAuditRow(array $row, ?array $notificationSummaryMap = null): array
    {
        if (array_key_exists('viewer_role_context_json', $row)) {
            $row['viewer_role_context'] = $this->decodeTransitionMetadata($row['viewer_role_context_json']);
        }

        $transitionId = (int) ($row['id'] ?? 0);
        $notificationSummaryMap ??= $transitionId > 0
            ? $this->loadWorkflowNotificationSummaryMapByTransitionIds([$transitionId])
            : [];
        $row['notification_summary'] = $transitionId > 0
            ? ($notificationSummaryMap[$transitionId] ?? $this->emptyWorkflowNotificationSummary())
            : $this->emptyWorkflowNotificationSummary();

        return $row;
    }

    /**
     * @param array<int,int> $transitionIds
     * @return array<int,array<string,mixed>>
     */
    private function loadWorkflowNotificationSummaryMapByTransitionIds(array $transitionIds): array
    {
        $transitionIds = array_values(array_unique(array_filter(
            array_map(fn ($value): ?int => $this->parseNullableInt($value), $transitionIds),
            fn ($value): bool => $value !== null && $value > 0
        )));
        if ($transitionIds === [] || ! $this->hasTable('workflow_notification_logs')) {
            return [];
        }

        $rows = DB::table('workflow_notification_logs')
            ->select(['request_transition_id', 'target_role', 'recipient_user_id', 'delivery_status'])
            ->whereIn('request_transition_id', $transitionIds)
            ->orderBy('id')
            ->get();

        $summaryMap = [];
        foreach ($transitionIds as $transitionId) {
            $summaryMap[$transitionId] = $this->emptyWorkflowNotificationSummary();
        }

        foreach ($rows as $row) {
            $transitionId = (int) ($row->request_transition_id ?? 0);
            if (! isset($summaryMap[$transitionId])) {
                $summaryMap[$transitionId] = $this->emptyWorkflowNotificationSummary();
            }

            $summaryMap[$transitionId]['total']++;
            $deliveryStatus = $this->normalizeToken($row->delivery_status ?? null);
            if ($deliveryStatus === 'SKIPPED') {
                $summaryMap[$transitionId]['skipped']++;
            } else {
                $summaryMap[$transitionId]['resolved']++;
            }

            $targetRole = $this->toNullableText($row->target_role ?? null);
            if ($targetRole !== null) {
                $summaryMap[$transitionId]['target_roles'][] = $targetRole;
            }

            $recipientUserId = $this->parseNullableInt($row->recipient_user_id ?? null);
            if ($recipientUserId !== null) {
                $summaryMap[$transitionId]['recipient_user_ids'][] = $recipientUserId;
            }
        }

        foreach ($summaryMap as &$summary) {
            $summary['target_roles'] = array_values(array_unique($summary['target_roles']));
            $summary['recipient_user_ids'] = array_values(array_unique($summary['recipient_user_ids']));
        }
        unset($summary);

        return $summaryMap;
    }

    /**
     * @return array<string,mixed>
     */
    private function emptyWorkflowNotificationSummary(): array
    {
        return [
            'total' => 0,
            'resolved' => 0,
            'skipped' => 0,
            'target_roles' => [],
            'recipient_user_ids' => [],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function viewerCanAccessCustomerRequestRow(array $row, ?int $viewerUserId = null): bool
    {
        if ($viewerUserId === null || $this->isAdminUserId($viewerUserId)) {
            return true;
        }

        if ($this->normalizeToken($row['status'] ?? null) === 'MOI_TIEP_NHAN') {
            return true;
        }

        $projectId = $this->parseNullableInt($row['project_id'] ?? null);
        if ($projectId !== null && in_array($projectId, $this->listProjectIdsWhereViewerIsRaciA($viewerUserId), true)) {
            return true;
        }

        $assigneeUserId = $this->parseNullableInt($row['assignee_id'] ?? null);
        if ($assigneeUserId !== null && $assigneeUserId === $viewerUserId) {
            return true;
        }

        $receiverUserId = $this->parseNullableInt($row['receiver_user_id'] ?? null);
        if ($receiverUserId !== null && $receiverUserId === $viewerUserId) {
            return true;
        }

        $creatorUserId = $this->parseNullableInt($row['created_by'] ?? null);

        return $creatorUserId !== null && $creatorUserId === $viewerUserId;
    }

    private function getById(int $id, ?int $viewerUserId = null): array
    {
        $query = DB::table('customer_requests as cr')
            ->leftJoin('customers as c', 'cr.customer_id', '=', 'c.id')
            ->leftJoin('support_service_groups as ssg', 'cr.service_group_id', '=', 'ssg.id')
            ->leftJoin('internal_users as iu_assignee', 'cr.assignee_id', '=', 'iu_assignee.id')
            ->leftJoin('internal_users as iu_receiver', 'cr.receiver_user_id', '=', 'iu_receiver.id')
            ->leftJoin('workflow_status_catalogs as wsc', 'cr.status_catalog_id', '=', 'wsc.id')
            ->when(
                $this->hasTable('request_transitions')
                    && $this->hasColumn('customer_requests', 'latest_transition_id')
                    && $this->hasColumn('request_transitions', 'id'),
                function ($query) {
                    $query->leftJoin('request_transitions as rt_latest', function ($join): void {
                        $join->on('cr.latest_transition_id', '=', 'rt_latest.id');
                        if ($this->hasColumn('request_transitions', 'deleted_at')) {
                            $join->whereNull('rt_latest.deleted_at');
                        }
                    });
                }
            );

        $this->applyCustomerRequestVisibilityScope($query, $viewerUserId, 'cr');

        $row = $query
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
                $this->hasColumn('customer_requests', 'assigned_date') ? 'cr.assigned_date' : null,
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
                $this->hasTable('request_transitions') && $this->hasColumn('request_transitions', 'hours_estimated')
                    ? 'rt_latest.hours_estimated as latest_hours_estimated'
                    : null,
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

        $payload = (array) $row;
        $attachmentMap = $this->loadCustomerRequestAttachmentMap([$id]);
        $payload['attachments'] = $attachmentMap[(string) $id] ?? [];

        return $this->serializeCustomerRequestRow($payload, $viewerUserId);
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function serializeCustomerRequestRow(array $row, ?int $viewerUserId = null): array
    {
        $status = $this->normalizeToken($row['status'] ?? null);
        $subStatus = $this->normalizeNullableStatus($row['sub_status'] ?? null);
        $flow = $this->flowResolver->resolve($status, $subStatus);
        $viewerExecutionContext = $this->resolveViewerExecutionContext($row, $status, $subStatus, $viewerUserId);
        $viewerWorkflowContext = $this->resolveViewerWorkflowRoleContext($row, $viewerUserId);
        $effectiveStatusCatalogId = $this->resolveEffectiveStatusCatalogIdFromRow($row);
        $serviceGroupWorkflowBinding = $this->resolveSupportServiceGroupWorkflowBinding(
            $this->parseNullableInt($row['service_group_id'] ?? null)
        );
        if (
            $effectiveStatusCatalogId !== null
            && $effectiveStatusCatalogId === $this->parseNullableInt($serviceGroupWorkflowBinding['workflow_status_catalog_id'] ?? null)
        ) {
            $boundFormKey = $this->toNullableText($serviceGroupWorkflowBinding['workflow_form_key'] ?? null);
            if ($boundFormKey !== null) {
                $flow['form_key'] = $boundFormKey;
            }
        }
        $configuredTransitions = $this->hasTable('workflow_status_transitions')
            ? $this->listWorkflowStatusTransitions(
                $effectiveStatusCatalogId
            )
            : [];
        $availableActions = $this->resolveConfiguredAvailableActions(
            $effectiveStatusCatalogId,
            $viewerWorkflowContext['roles']
        );

        $metadata = $row['transition_metadata'] ?? null;
        if (is_string($metadata) && trim($metadata) !== '') {
            $decoded = json_decode($metadata, true);
            $metadata = is_array($decoded) ? $decoded : null;
        }

        return [
            'id' => (int) ($row['id'] ?? 0),
            'uuid' => $row['uuid'] ?? null,
            'request_code' => (string) ($row['request_code'] ?? ''),
            'status_catalog_id' => $effectiveStatusCatalogId,
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
            'service_group_workflow_status_catalog_id' => $this->parseNullableInt($serviceGroupWorkflowBinding['workflow_status_catalog_id'] ?? null),
            'service_group_workflow_status_code' => $serviceGroupWorkflowBinding['workflow_status_code'] ?? null,
            'service_group_workflow_status_name' => $serviceGroupWorkflowBinding['workflow_status_name'] ?? null,
            'service_group_workflow_form_key' => $serviceGroupWorkflowBinding['workflow_form_key'] ?? null,
            'receiver_user_id' => isset($row['receiver_user_id']) ? (int) $row['receiver_user_id'] : null,
            'receiver_name' => $row['receiver_name'] ?? null,
            'assignee_id' => isset($row['assignee_id']) ? (int) $row['assignee_id'] : null,
            'assignee_name' => $row['assignee_name'] ?? null,
            'viewer_execution_role' => $viewerExecutionContext['role'],
            'viewer_is_assignee' => $viewerExecutionContext['is_assignee'],
            'viewer_is_receiver' => $viewerExecutionContext['is_receiver'],
            'viewer_is_assigner' => $viewerExecutionContext['is_assigner'],
            'viewer_is_initial_receiver_stage' => $viewerExecutionContext['is_initial_receiver_stage'],
            'viewer_can_view' => $viewerWorkflowContext['can_view'],
            'viewer_role_context' => $viewerWorkflowContext,
            'has_configured_transitions' => $configuredTransitions !== [],
            'available_actions' => $availableActions,
            'reference_ticket_code' => $row['reference_ticket_code'] ?? null,
            'reference_request_id' => isset($row['reference_request_id']) ? (int) $row['reference_request_id'] : null,
            'status' => $status,
            'sub_status' => $subStatus,
            'status_name' => $row['status_name'] ?? null,
            'priority' => $this->normalizePriority((string) ($row['priority'] ?? 'MEDIUM')),
            'requested_date' => $row['requested_date'] ?? null,
            'assigned_date' => $row['assigned_date'] ?? null,
            'latest_transition_id' => isset($row['latest_transition_id']) ? (int) $row['latest_transition_id'] : null,
            'hours_estimated' => ($this->parseNullableFloat($row['latest_hours_estimated'] ?? ($row['hours_estimated'] ?? null))),
            'notes' => $row['notes'] ?? null,
            'attachments' => is_array($row['attachments'] ?? null) ? $row['attachments'] : [],
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
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function decodeWorkflowStatusTransitionRow(array $row): array
    {
        $conditionJson = $row['condition_json'] ?? null;
        if (is_string($conditionJson) && trim($conditionJson) !== '') {
            $decoded = json_decode($conditionJson, true);
            $conditionJson = is_array($decoded) ? $decoded : null;
        }

        $notifyTargetsJson = $row['notify_targets_json'] ?? null;
        if (is_string($notifyTargetsJson) && trim($notifyTargetsJson) !== '') {
            $decoded = json_decode($notifyTargetsJson, true);
            $notifyTargetsJson = is_array($decoded) ? $decoded : null;
        }

        $row['condition_json'] = is_array($conditionJson) ? $conditionJson : null;
        $row['notify_targets_json'] = is_array($notifyTargetsJson) ? $notifyTargetsJson : null;

        return $row;
    }

    /**
     * @param array<string, mixed> $row
     * @return array{
     *   role: ?string,
     *   is_assignee: bool,
     *   is_receiver: bool,
     *   is_assigner: bool,
     *   is_initial_receiver_stage: bool
     * }
     */
    private function resolveViewerExecutionContext(
        array $row,
        string $status,
        ?string $subStatus,
        ?int $viewerUserId
    ): array {
        if ($viewerUserId === null) {
            return [
                'role' => null,
                'is_assignee' => false,
                'is_receiver' => false,
                'is_assigner' => false,
                'is_initial_receiver_stage' => false,
            ];
        }

        $receiverUserId = $this->parseNullableInt($row['receiver_user_id'] ?? null);
        $assigneeUserId = $this->parseNullableInt($row['assignee_id'] ?? null);
        $isAssignee = $assigneeUserId !== null && $assigneeUserId === $viewerUserId;
        $isReceiver = $receiverUserId !== null && $receiverUserId === $viewerUserId;
        $isInitialReceiverStage = $isReceiver
            && $status === 'MOI_TIEP_NHAN'
            && $subStatus === null;

        if ($isAssignee) {
            $role = 'WORKER';
        } elseif ($isInitialReceiverStage) {
            $role = 'INITIAL_RECEIVER';
        } elseif ($isReceiver) {
            $role = 'ASSIGNER';
        } else {
            $role = 'OTHER';
        }

        return [
            'role' => $role,
            'is_assignee' => $isAssignee,
            'is_receiver' => $isReceiver,
            'is_assigner' => $role === 'ASSIGNER' || $role === 'INITIAL_RECEIVER',
            'is_initial_receiver_stage' => $isInitialReceiverStage,
        ];
    }

    private function normalizeWorkflowActorRole(mixed $value): ?string
    {
        $normalized = $this->normalizeToken($value);
        if ($normalized === '') {
            return null;
        }

        return $normalized;
    }

    /**
     * @return array<int,string>|null
     */
    private function normalizeWorkflowActorRoleList(mixed $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        $items = is_array($value) ? $value : [$value];
        $normalized = [];
        foreach ($items as $item) {
            $role = $this->normalizeWorkflowActorRole($item);
            if ($role !== null) {
                $normalized[] = $role;
            }
        }

        $normalized = array_values(array_unique($normalized));

        return $normalized === [] ? null : $normalized;
    }

    /**
     * @param array<string,mixed> $row
     * @return array{primary_role:?string,roles:array<int,string>,can_view:bool,is_admin:bool,is_creator:bool,is_pm:bool,is_executor:bool}
     */
    private function resolveViewerWorkflowRoleContext(array $row, ?int $viewerUserId): array
    {
        if ($viewerUserId === null) {
            return [
                'primary_role' => null,
                'roles' => [],
                'can_view' => true,
                'is_admin' => false,
                'is_creator' => false,
                'is_pm' => false,
                'is_executor' => false,
            ];
        }

        $creatorUserId = $this->parseNullableInt($row['created_by'] ?? null);
        $receiverUserId = $this->parseNullableInt($row['receiver_user_id'] ?? null);
        $assigneeUserId = $this->parseNullableInt($row['assignee_id'] ?? null);

        $isAdmin = $this->isAdminUserId($viewerUserId);
        $isCreator = $creatorUserId !== null && $creatorUserId === $viewerUserId;
        $isPm = $receiverUserId !== null && $receiverUserId === $viewerUserId;
        $isExecutor = $assigneeUserId !== null && $assigneeUserId === $viewerUserId;

        $roles = [];
        if ($isAdmin) {
            $roles[] = 'ADMIN';
        }
        if ($isPm) {
            $roles[] = 'PM';
        }
        if ($isExecutor) {
            $roles[] = 'EXECUTOR';
        }
        if ($isCreator) {
            $roles[] = 'CREATOR';
        }

        $roles = array_values(array_unique(array_filter($roles)));
        $primaryRole = $roles[0] ?? 'OTHER';

        return [
            'primary_role' => $primaryRole,
            'roles' => $roles,
            'can_view' => $this->resolveConfiguredViewPermission(
                $this->resolveEffectiveStatusCatalogIdFromRow($row),
                $roles
            ),
            'is_admin' => $isAdmin,
            'is_creator' => $isCreator,
            'is_pm' => $isPm,
            'is_executor' => $isExecutor,
        ];
    }

    /**
     * @param array<string,mixed> $row
     */
    private function resolveEffectiveStatusCatalogIdFromRow(array $row): ?int
    {
        $statusCatalogId = $this->parseNullableInt($row['status_catalog_id'] ?? null);
        if ($statusCatalogId !== null) {
            return $statusCatalogId;
        }

        return $this->resolveStatusCatalogIdByRuntimeStatus(
            $this->toNullableText($row['status'] ?? null),
            $this->toNullableText($row['sub_status'] ?? null)
        );
    }

    private function resolveStatusCatalogIdByRuntimeStatus(?string $status, ?string $subStatus): ?int
    {
        if (! $this->hasTable('workflow_status_catalogs')) {
            return null;
        }

        $normalizedStatus = $this->normalizeToken($status);
        $normalizedSubStatus = $this->normalizeNullableStatus($subStatus);
        if ($normalizedStatus === '') {
            return null;
        }

        $cacheKey = $normalizedStatus.'|'.($normalizedSubStatus ?? '');
        if (array_key_exists($cacheKey, $this->runtimeStatusCatalogIdCache)) {
            return $this->runtimeStatusCatalogIdCache[$cacheKey];
        }

        $catalogs = $this->loadWorkflowStatusCatalogLookupRows();
        $resolvedId = null;

        foreach ($catalogs as $catalog) {
            $catalogStatus = $this->normalizeToken($catalog['canonical_status'] ?? $catalog['status_code'] ?? null);
            $catalogSubStatus = $this->normalizeNullableStatus($catalog['canonical_sub_status'] ?? null);
            if ($catalogStatus === $normalizedStatus && $catalogSubStatus === $normalizedSubStatus) {
                $resolvedId = (int) ($catalog['id'] ?? 0);
                break;
            }
        }

        if ($resolvedId === null && $normalizedSubStatus === null) {
            foreach ($catalogs as $catalog) {
                $catalogStatus = $this->normalizeToken($catalog['status_code'] ?? null);
                $catalogSubStatus = $this->normalizeNullableStatus($catalog['canonical_sub_status'] ?? null);
                if ($catalogStatus === $normalizedStatus && $catalogSubStatus === null) {
                    $resolvedId = (int) ($catalog['id'] ?? 0);
                    break;
                }
            }
        }

        if ($resolvedId === null && $normalizedSubStatus !== null) {
            foreach ($catalogs as $catalog) {
                $catalogStatus = $this->normalizeToken($catalog['canonical_status'] ?? $catalog['status_code'] ?? null);
                $catalogSubStatus = $this->normalizeNullableStatus($catalog['canonical_sub_status'] ?? null);
                if ($catalogStatus === $normalizedStatus && $catalogSubStatus === null) {
                    $resolvedId = (int) ($catalog['id'] ?? 0);
                    break;
                }
            }
        }

        $this->runtimeStatusCatalogIdCache[$cacheKey] = $resolvedId;

        return $resolvedId;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function resolveSupportServiceGroupWorkflowBinding(?int $serviceGroupId): ?array
    {
        if ($serviceGroupId === null || ! $this->hasTable('support_service_groups')) {
            return null;
        }

        if (array_key_exists($serviceGroupId, $this->supportServiceGroupWorkflowBindingCache)) {
            return $this->supportServiceGroupWorkflowBindingCache[$serviceGroupId];
        }

        $hasWorkflowStatusCatalogId = $this->hasColumn('support_service_groups', 'workflow_status_catalog_id');
        $hasWorkflowFormKey = $this->hasColumn('support_service_groups', 'workflow_form_key');
        if (! $hasWorkflowStatusCatalogId && ! $hasWorkflowFormKey) {
            $this->supportServiceGroupWorkflowBindingCache[$serviceGroupId] = null;

            return null;
        }

        $query = DB::table('support_service_groups as ssg')
            ->where('ssg.id', $serviceGroupId)
            ->select(array_values(array_filter([
                $hasWorkflowStatusCatalogId ? 'ssg.workflow_status_catalog_id' : null,
                $hasWorkflowFormKey ? 'ssg.workflow_form_key' : null,
            ])));

        if ($hasWorkflowStatusCatalogId && $this->hasTable('workflow_status_catalogs')) {
            $query
                ->leftJoin('workflow_status_catalogs as wsc_bind', 'ssg.workflow_status_catalog_id', '=', 'wsc_bind.id')
                ->addSelect([
                    'wsc_bind.status_code as workflow_status_code',
                    'wsc_bind.status_name as workflow_status_name',
                    'wsc_bind.form_key as workflow_status_catalog_form_key',
                ]);
        }

        $binding = $query->first();
        if (! $binding) {
            $this->supportServiceGroupWorkflowBindingCache[$serviceGroupId] = null;

            return null;
        }

        $bindingRow = (array) $binding;
        $resolved = [
            'workflow_status_catalog_id' => $this->parseNullableInt($bindingRow['workflow_status_catalog_id'] ?? null),
            'workflow_status_code' => $this->toNullableText($bindingRow['workflow_status_code'] ?? null),
            'workflow_status_name' => $this->toNullableText($bindingRow['workflow_status_name'] ?? null),
            'workflow_form_key' => $this->toNullableText($bindingRow['workflow_form_key'] ?? null)
                ?? $this->toNullableText($bindingRow['workflow_status_catalog_form_key'] ?? null),
        ];

        if (
            $resolved['workflow_status_catalog_id'] === null
            && $resolved['workflow_status_code'] === null
            && $resolved['workflow_status_name'] === null
            && $resolved['workflow_form_key'] === null
        ) {
            $this->supportServiceGroupWorkflowBindingCache[$serviceGroupId] = null;

            return null;
        }

        $this->supportServiceGroupWorkflowBindingCache[$serviceGroupId] = $resolved;

        return $resolved;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function loadWorkflowStatusCatalogLookupRows(): array
    {
        if ($this->workflowStatusCatalogLookupCache !== null) {
            return $this->workflowStatusCatalogLookupCache;
        }

        $this->workflowStatusCatalogLookupCache = $this->listWorkflowStatusCatalogs(true);

        return $this->workflowStatusCatalogLookupCache;
    }

    /**
     * @return array{q:string,status:?string,sub_status:?string,service_group_id:?int,workflow_action_code:?string,to_status_catalog_id:?int,date_from:?string,date_to:?string}
     */
    private function normalizeCustomerRequestDashboardFilters(Request $request): array
    {
        $filters = $request->query('filters');
        $filters = is_array($filters) ? $filters : [];

        $status = $this->normalizeToken($filters['status'] ?? null);
        $subStatus = $this->normalizeToken($filters['sub_status'] ?? null);
        $workflowActionCode = $this->normalizeToken($filters['workflow_action_code'] ?? null);

        return [
            'q' => trim((string) $request->query('q', '')),
            'status' => $status !== '' ? $status : null,
            'sub_status' => $subStatus !== '' ? $subStatus : null,
            'service_group_id' => $this->parseNullableInt($filters['service_group_id'] ?? null),
            'workflow_action_code' => $workflowActionCode !== '' ? $workflowActionCode : null,
            'to_status_catalog_id' => $this->parseNullableInt($filters['to_status_catalog_id'] ?? null),
            'date_from' => $this->normalizeDate($filters['date_from'] ?? null),
            'date_to' => $this->normalizeDate($filters['date_to'] ?? null),
        ];
    }

    /**
     * @param array{q:string,status:?string,sub_status:?string,service_group_id:?int,workflow_action_code:?string,to_status_catalog_id:?int,date_from:?string,date_to:?string} $filters
     */
    private function buildCustomerRequestDashboardBaseQuery(array $filters, ?int $viewerUserId = null): Builder
    {
        $query = DB::table('request_transitions as rt');
        if ($this->usesMysqlConnection()) {
            $leftRequestCodeExpression = $this->dashboardCollatedTextExpression('rt.request_code');
            $rightRequestCodeExpression = $this->dashboardCollatedTextExpression('cr.request_code');
            $query->join('customer_requests as cr', function ($join) use ($leftRequestCodeExpression, $rightRequestCodeExpression): void {
                $join->whereRaw($leftRequestCodeExpression.' = '.$rightRequestCodeExpression);
            });
        } else {
            $query->join('customer_requests as cr', 'rt.request_code', '=', 'cr.request_code');
        }

        if ($this->hasColumn('request_transitions', 'deleted_at')) {
            $query->whereNull('rt.deleted_at');
        }
        if ($this->hasColumn('customer_requests', 'deleted_at')) {
            $query->whereNull('cr.deleted_at');
        }

        $joinCustomers = $this->hasTable('customers');
        $joinServiceGroups = $this->hasTable('support_service_groups');
        $joinUsers = $this->hasTable('internal_users');
        $joinTargetStatusCatalog = $this->hasTable('workflow_status_catalogs')
            && $this->hasColumn('request_transitions', 'to_status_catalog_id');

        if ($joinCustomers) {
            $query->leftJoin('customers as c', 'cr.customer_id', '=', 'c.id');
        }
        if ($joinServiceGroups) {
            $query->leftJoin('support_service_groups as ssg', 'cr.service_group_id', '=', 'ssg.id');
        }
        if ($joinUsers) {
            $query->leftJoin('internal_users as iu_assignee', 'cr.assignee_id', '=', 'iu_assignee.id');
            $query->leftJoin('internal_users as iu_receiver', 'cr.receiver_user_id', '=', 'iu_receiver.id');
        }
        if ($joinTargetStatusCatalog) {
            $query->leftJoin('workflow_status_catalogs as wsc_to', 'rt.to_status_catalog_id', '=', 'wsc_to.id');
        }

        $notificationMetricsSubquery = $this->buildWorkflowNotificationMetricsSubquery();
        if ($notificationMetricsSubquery !== null) {
            $query->leftJoinSub($notificationMetricsSubquery, 'wnl_metrics', function ($join): void {
                $join->on('rt.id', '=', 'wnl_metrics.request_transition_id');
            });
        }

        $this->applyCustomerRequestDashboardFilters($query, $filters, [
            'join_customers' => $joinCustomers,
            'join_service_groups' => $joinServiceGroups,
            'join_users' => $joinUsers,
        ]);
        $this->applyCustomerRequestVisibilityScope($query, $viewerUserId, 'cr');

        return $query;
    }

    private function applyCustomerRequestVisibilityScope(Builder $query, ?int $viewerUserId, string $requestAlias = 'cr'): void
    {
        if ($viewerUserId === null || $this->isAdminUserId($viewerUserId)) {
            return;
        }

        $projectIds = $this->listProjectIdsWhereViewerIsRaciA($viewerUserId);
        $hasAssigneeColumn = $this->hasColumn('customer_requests', 'assignee_id');
        $hasReceiverColumn = $this->hasColumn('customer_requests', 'receiver_user_id');
        $hasCreatorColumn = $this->hasColumn('customer_requests', 'created_by');
        $hasStatusColumn = $this->hasColumn('customer_requests', 'status');
        $hasProjectColumn = $this->hasColumn('customer_requests', 'project_id');

        $query->where(function (Builder $visibility) use (
            $viewerUserId,
            $projectIds,
            $requestAlias,
            $hasAssigneeColumn,
            $hasReceiverColumn,
            $hasCreatorColumn,
            $hasStatusColumn,
            $hasProjectColumn
        ): void {
            $seeded = false;

            if ($hasAssigneeColumn) {
                $visibility->where($requestAlias.'.assignee_id', $viewerUserId);
                $seeded = true;
            }

            if ($hasReceiverColumn) {
                if ($seeded) {
                    $visibility->orWhere($requestAlias.'.receiver_user_id', $viewerUserId);
                } else {
                    $visibility->where($requestAlias.'.receiver_user_id', $viewerUserId);
                    $seeded = true;
                }
            }

            if ($hasCreatorColumn) {
                if ($seeded) {
                    $visibility->orWhere($requestAlias.'.created_by', $viewerUserId);
                } else {
                    $visibility->where($requestAlias.'.created_by', $viewerUserId);
                    $seeded = true;
                }
            }

            if ($hasStatusColumn) {
                $statusSql = 'UPPER(TRIM(COALESCE('.$requestAlias.'.status, ""))) = ?';
                if ($seeded) {
                    $visibility->orWhereRaw($statusSql, ['MOI_TIEP_NHAN']);
                } else {
                    $visibility->whereRaw($statusSql, ['MOI_TIEP_NHAN']);
                    $seeded = true;
                }
            }

            if ($hasProjectColumn && $projectIds !== []) {
                if ($seeded) {
                    $visibility->orWhereIn($requestAlias.'.project_id', $projectIds);
                } else {
                    $visibility->whereIn($requestAlias.'.project_id', $projectIds);
                    $seeded = true;
                }
            }

            if (! $seeded) {
                $visibility->whereRaw('1 = 0');
            }
        });
    }

    /**
     * @return array<int, int>
     */
    private function listProjectIdsWhereViewerIsRaciA(int $viewerUserId): array
    {
        if (array_key_exists($viewerUserId, $this->projectRaciAIdsCache)) {
            return $this->projectRaciAIdsCache[$viewerUserId];
        }

        if (
            ! $this->hasTable('raci_assignments')
            || ! $this->hasColumn('raci_assignments', 'entity_type')
            || ! $this->hasColumn('raci_assignments', 'entity_id')
            || ! $this->hasColumn('raci_assignments', 'user_id')
            || ! $this->hasColumn('raci_assignments', 'raci_role')
        ) {
            $this->projectRaciAIdsCache[$viewerUserId] = [];

            return [];
        }

        $projectIds = DB::table('raci_assignments as ra')
            ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
            ->where('ra.user_id', $viewerUserId)
            ->where('ra.raci_role', 'A')
            ->pluck('ra.entity_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->values()
            ->all();

        $this->projectRaciAIdsCache[$viewerUserId] = $projectIds;

        return $projectIds;
    }

    /**
     * @param array{q:string,status:?string,sub_status:?string,service_group_id:?int,workflow_action_code:?string,to_status_catalog_id:?int,date_from:?string,date_to:?string} $filters
     * @param array{join_customers:bool,join_service_groups:bool,join_users:bool} $context
     */
    private function applyCustomerRequestDashboardFilters(Builder $query, array $filters, array $context): void
    {
        if ($filters['q'] !== '') {
            $like = '%'.$filters['q'].'%';
            $hasRequestSummary = $this->hasColumn('request_transitions', 'request_summary');
            $query->where(function ($builder) use ($like, $context, $hasRequestSummary): void {
                $builder
                    ->where('rt.request_code', 'like', $like)
                    ->orWhere('cr.summary', 'like', $like);

                if ($hasRequestSummary) {
                    $builder->orWhere('rt.request_summary', 'like', $like);
                }

                if ($context['join_customers']) {
                    $builder->orWhere('c.customer_name', 'like', $like);
                }
                if ($context['join_service_groups']) {
                    $builder->orWhere('ssg.group_name', 'like', $like);
                }
                if ($context['join_users']) {
                    $builder
                        ->orWhere('iu_assignee.full_name', 'like', $like)
                        ->orWhere('iu_receiver.full_name', 'like', $like);
                }
            });
        }

        if ($filters['status'] !== null) {
            $query->whereRaw('UPPER(TRIM(cr.status)) = ?', [$filters['status']]);
        }

        if ($filters['sub_status'] !== null) {
            $query->whereRaw('UPPER(TRIM(COALESCE(cr.sub_status, ""))) = ?', [$filters['sub_status']]);
        }

        if ($filters['service_group_id'] !== null) {
            $query->where('cr.service_group_id', $filters['service_group_id']);
        }

        if ($filters['workflow_action_code'] !== null && $this->hasColumn('request_transitions', 'workflow_action_code')) {
            $query->whereRaw('UPPER(TRIM(COALESCE(rt.workflow_action_code, ""))) = ?', [$filters['workflow_action_code']]);
        }

        if ($filters['to_status_catalog_id'] !== null && $this->hasColumn('request_transitions', 'to_status_catalog_id')) {
            $query->where('rt.to_status_catalog_id', $filters['to_status_catalog_id']);
        }

        if ($filters['date_from'] !== null && $this->hasColumn('request_transitions', 'created_at')) {
            $query->whereDate('rt.created_at', '>=', $filters['date_from']);
        }

        if ($filters['date_to'] !== null && $this->hasColumn('request_transitions', 'created_at')) {
            $query->whereDate('rt.created_at', '<=', $filters['date_to']);
        }
    }

    private function buildWorkflowNotificationMetricsSubquery(): ?Builder
    {
        if (
            ! $this->hasTable('workflow_notification_logs')
            || ! $this->hasColumn('workflow_notification_logs', 'request_transition_id')
        ) {
            return null;
        }

        return DB::table('workflow_notification_logs as wnl')
            ->select('wnl.request_transition_id')
            ->selectRaw('COUNT(*) as notification_total')
            ->selectRaw("SUM(CASE WHEN UPPER(COALESCE(wnl.delivery_status, '')) = 'RESOLVED' THEN 1 ELSE 0 END) as notification_resolved")
            ->selectRaw("SUM(CASE WHEN UPPER(COALESCE(wnl.delivery_status, '')) = 'SKIPPED' THEN 1 ELSE 0 END) as notification_skipped")
            ->groupBy('wnl.request_transition_id');
    }

    /**
     * @param Builder $query
     * @return array<int,array<string,mixed>>
     */
    private function buildCustomerRequestDashboardDataset(Builder $query): array
    {
        $hasWorkflowActionCode = $this->hasColumn('request_transitions', 'workflow_action_code');
        $hasToStatusCatalogId = $this->hasColumn('request_transitions', 'to_status_catalog_id');
        $hasToStatus = $this->hasColumn('request_transitions', 'to_status');
        $hasSlaDueTime = $this->hasColumn('request_transitions', 'sla_due_time');
        $hasIsSlaBreached = $this->hasColumn('request_transitions', 'is_sla_breached');
        $hasNotificationMetrics = $this->hasTable('workflow_notification_logs')
            && $this->hasColumn('workflow_notification_logs', 'request_transition_id');

        $emptyLiteral = $this->dashboardCollatedLiteral('');
        $unknownLiteral = $this->dashboardCollatedLiteral('UNKNOWN');
        $unassignedServiceGroupLiteral = $this->dashboardCollatedLiteral('Chưa gắn nhóm hỗ trợ');
        $actionExpression = $hasWorkflowActionCode
            ? 'COALESCE('
                .'NULLIF('.$this->dashboardCollatedTextExpression('TRIM(rt.workflow_action_code)').', '.$emptyLiteral.')'
                .', '.$unknownLiteral
                .')'
            : $unknownLiteral;
        $toStatusNameExpression = $hasToStatusCatalogId && $this->hasTable('workflow_status_catalogs')
            ? 'COALESCE('
                .'NULLIF('.$this->dashboardCollatedTextExpression('TRIM(wsc_to.status_name)').', '.$emptyLiteral.')'
                .', NULLIF('.$this->dashboardCollatedTextExpression('TRIM(rt.to_status)').', '.$emptyLiteral.')'
                .', '.$unknownLiteral
                .')'
            : ($hasToStatus
                ? 'COALESCE('
                    .'NULLIF('.$this->dashboardCollatedTextExpression('TRIM(rt.to_status)').', '.$emptyLiteral.')'
                    .', '.$unknownLiteral
                    .')'
                : $unknownLiteral);
        $serviceGroupNameExpression = $this->hasTable('support_service_groups')
            ? 'COALESCE('
                .'NULLIF('.$this->dashboardCollatedTextExpression('TRIM(ssg.group_name)').', '.$emptyLiteral.')'
                .', '.$unassignedServiceGroupLiteral
                .')'
            : $unassignedServiceGroupLiteral;

        $datasetQuery = clone $query;
        $datasetQuery->selectRaw($actionExpression.' as workflow_action_code');
        $datasetQuery->addSelect('cr.service_group_id');
        $datasetQuery->selectRaw($serviceGroupNameExpression.' as service_group_name');
        if ($hasToStatusCatalogId) {
            $datasetQuery->addSelect('rt.to_status_catalog_id');
        } else {
            $datasetQuery->selectRaw('NULL as to_status_catalog_id');
        }
        $datasetQuery->selectRaw($toStatusNameExpression.' as to_status_name');
        $datasetQuery->selectRaw('COUNT(DISTINCT rt.id) as transition_count');
        $datasetQuery->selectRaw($hasSlaDueTime
            ? 'SUM(CASE WHEN rt.sla_due_time IS NOT NULL THEN 1 ELSE 0 END) as sla_tracked_count'
            : '0 as sla_tracked_count');
        $datasetQuery->selectRaw($hasIsSlaBreached
            ? 'SUM(CASE WHEN rt.is_sla_breached = 1 THEN 1 ELSE 0 END) as sla_breached_count'
            : '0 as sla_breached_count');
        $datasetQuery->selectRaw($hasNotificationMetrics
            ? 'SUM(COALESCE(wnl_metrics.notification_total, 0)) as notification_total'
            : '0 as notification_total');
        $datasetQuery->selectRaw($hasNotificationMetrics
            ? 'SUM(COALESCE(wnl_metrics.notification_resolved, 0)) as notification_resolved'
            : '0 as notification_resolved');
        $datasetQuery->selectRaw($hasNotificationMetrics
            ? 'SUM(COALESCE(wnl_metrics.notification_skipped, 0)) as notification_skipped'
            : '0 as notification_skipped');

        $datasetQuery->groupBy('cr.service_group_id');
        if ($this->hasTable('support_service_groups')) {
            $datasetQuery->groupBy('ssg.group_name');
        }
        if ($hasWorkflowActionCode) {
            $datasetQuery->groupBy('rt.workflow_action_code');
        }
        if ($hasToStatusCatalogId) {
            $datasetQuery->groupBy('rt.to_status_catalog_id');
            if ($this->hasTable('workflow_status_catalogs')) {
                $datasetQuery->groupBy('wsc_to.status_name');
            }
        } elseif ($hasToStatus) {
            $datasetQuery->groupBy('rt.to_status');
        }

        $rows = $datasetQuery
            ->orderByDesc('transition_count')
            ->orderBy('workflow_action_code')
            ->orderBy('service_group_name')
            ->orderBy('to_status_name')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        $actionNameMap = $this->loadWorkflowActionNameMap();

        return array_map(function (array $row) use ($actionNameMap): array {
            $workflowActionCode = $this->normalizeToken($row['workflow_action_code'] ?? null);
            $actionCode = $workflowActionCode !== '' ? $workflowActionCode : 'UNKNOWN';
            $transitionCount = max(0, (int) ($row['transition_count'] ?? 0));
            $slaTrackedCount = max(0, (int) ($row['sla_tracked_count'] ?? 0));
            $slaBreachedCount = max(0, (int) ($row['sla_breached_count'] ?? 0));

            return [
                'workflow_action_code' => $actionCode,
                'action_name' => $actionNameMap[$actionCode] ?? $actionCode,
                'service_group_id' => $this->parseNullableInt($row['service_group_id'] ?? null),
                'service_group_name' => $this->toNullableText($row['service_group_name'] ?? null) ?? 'Chưa gắn nhóm hỗ trợ',
                'to_status_catalog_id' => $this->parseNullableInt($row['to_status_catalog_id'] ?? null),
                'to_status_name' => $this->toNullableText($row['to_status_name'] ?? null) ?? 'UNKNOWN',
                'transition_count' => $transitionCount,
                'sla_tracked_count' => $slaTrackedCount,
                'sla_breached_count' => $slaBreachedCount,
                'sla_on_time_count' => max(0, $slaTrackedCount - $slaBreachedCount),
                'notification_total' => max(0, (int) ($row['notification_total'] ?? 0)),
                'notification_resolved' => max(0, (int) ($row['notification_resolved'] ?? 0)),
                'notification_skipped' => max(0, (int) ($row['notification_skipped'] ?? 0)),
            ];
        }, $rows);
    }

    private function sqlStringLiteral(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    private function dashboardCollatedTextExpression(string $expression): string
    {
        if (! $this->usesMysqlConnection()) {
            return $expression;
        }

        return "CONVERT(($expression) USING utf8mb4) COLLATE utf8mb4_unicode_ci";
    }

    private function dashboardCollatedLiteral(string $value): string
    {
        if (! $this->usesMysqlConnection()) {
            return $this->sqlStringLiteral($value);
        }

        return $this->dashboardCollatedTextExpression($this->sqlStringLiteral($value));
    }

    private function usesMysqlConnection(): bool
    {
        return DB::connection()->getDriverName() === 'mysql';
    }

    /**
     * @return array<string,int>
     */
    private function summarizeCustomerRequestDashboardTotals(array $dataset): array
    {
        $totals = $this->emptyCustomerRequestDashboardMetricTotals();

        foreach ($dataset as $row) {
            $totals['transition_count'] += max(0, (int) ($row['transition_count'] ?? 0));
            $totals['sla_tracked_count'] += max(0, (int) ($row['sla_tracked_count'] ?? 0));
            $totals['sla_breached_count'] += max(0, (int) ($row['sla_breached_count'] ?? 0));
            $totals['notification_total'] += max(0, (int) ($row['notification_total'] ?? 0));
            $totals['notification_resolved'] += max(0, (int) ($row['notification_resolved'] ?? 0));
            $totals['notification_skipped'] += max(0, (int) ($row['notification_skipped'] ?? 0));
        }

        $totals['sla_on_time_count'] = max(0, $totals['sla_tracked_count'] - $totals['sla_breached_count']);

        return $totals;
    }

    /**
     * @param array<int,array<string,mixed>> $dataset
     * @return array<int,array<string,mixed>>
     */
    private function aggregateCustomerRequestDashboardDataset(array $dataset, string $dimension): array
    {
        $grouped = [];

        foreach ($dataset as $row) {
            if ($dimension === 'workflow_action_code') {
                $key = (string) ($row['workflow_action_code'] ?? 'UNKNOWN');
                $seed = [
                    'workflow_action_code' => $row['workflow_action_code'] ?? 'UNKNOWN',
                    'action_name' => $row['action_name'] ?? ($row['workflow_action_code'] ?? 'UNKNOWN'),
                ];
            } elseif ($dimension === 'service_group_id') {
                $serviceGroupId = $this->parseNullableInt($row['service_group_id'] ?? null);
                $key = ($serviceGroupId !== null ? (string) $serviceGroupId : 'null').'|'.($row['service_group_name'] ?? '');
                $seed = [
                    'service_group_id' => $serviceGroupId,
                    'service_group_name' => $row['service_group_name'] ?? 'Chưa gắn nhóm hỗ trợ',
                ];
            } else {
                $toStatusCatalogId = $this->parseNullableInt($row['to_status_catalog_id'] ?? null);
                $key = ($toStatusCatalogId !== null ? (string) $toStatusCatalogId : 'null').'|'.($row['to_status_name'] ?? '');
                $seed = [
                    'to_status_catalog_id' => $toStatusCatalogId,
                    'to_status_name' => $row['to_status_name'] ?? 'UNKNOWN',
                ];
            }

            if (! isset($grouped[$key])) {
                $grouped[$key] = array_merge($seed, $this->emptyCustomerRequestDashboardMetricTotals());
            }

            $grouped[$key]['transition_count'] += max(0, (int) ($row['transition_count'] ?? 0));
            $grouped[$key]['sla_tracked_count'] += max(0, (int) ($row['sla_tracked_count'] ?? 0));
            $grouped[$key]['sla_breached_count'] += max(0, (int) ($row['sla_breached_count'] ?? 0));
            $grouped[$key]['notification_total'] += max(0, (int) ($row['notification_total'] ?? 0));
            $grouped[$key]['notification_resolved'] += max(0, (int) ($row['notification_resolved'] ?? 0));
            $grouped[$key]['notification_skipped'] += max(0, (int) ($row['notification_skipped'] ?? 0));
        }

        $rows = array_values(array_map(function (array $row): array {
            $row['sla_on_time_count'] = max(0, ((int) ($row['sla_tracked_count'] ?? 0)) - ((int) ($row['sla_breached_count'] ?? 0)));

            return $row;
        }, $grouped));

        usort($rows, function (array $left, array $right) use ($dimension): int {
            $countCompare = ((int) ($right['transition_count'] ?? 0)) <=> ((int) ($left['transition_count'] ?? 0));
            if ($countCompare !== 0) {
                return $countCompare;
            }

            if ($dimension === 'workflow_action_code') {
                return strcmp((string) ($left['workflow_action_code'] ?? ''), (string) ($right['workflow_action_code'] ?? ''));
            }
            if ($dimension === 'service_group_id') {
                return strcmp((string) ($left['service_group_name'] ?? ''), (string) ($right['service_group_name'] ?? ''));
            }

            return strcmp((string) ($left['to_status_name'] ?? ''), (string) ($right['to_status_name'] ?? ''));
        });

        return $rows;
    }

    /**
     * @return array{transition_count:int,sla_tracked_count:int,sla_breached_count:int,sla_on_time_count:int,notification_total:int,notification_resolved:int,notification_skipped:int}
     */
    private function emptyCustomerRequestDashboardMetricTotals(): array
    {
        return [
            'transition_count' => 0,
            'sla_tracked_count' => 0,
            'sla_breached_count' => 0,
            'sla_on_time_count' => 0,
            'notification_total' => 0,
            'notification_resolved' => 0,
            'notification_skipped' => 0,
        ];
    }

    /**
     * @return array<string,string>
     */
    private function loadWorkflowActionNameMap(): array
    {
        if (! $this->hasTable('workflow_status_transitions')) {
            return [];
        }

        return DB::table('workflow_status_transitions')
            ->select(['action_code', 'action_name'])
            ->when($this->hasColumn('workflow_status_transitions', 'is_active'), fn ($query) => $query->where('is_active', 1))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->reduce(function (array $carry, object $row): array {
                $actionCode = $this->normalizeToken($row->action_code ?? null);
                $actionName = $this->toNullableText($row->action_name ?? null);
                if ($actionCode !== '' && $actionName !== null && ! isset($carry[$actionCode])) {
                    $carry[$actionCode] = $actionName;
                }

                return $carry;
            }, []);
    }

    /**
     * @param array<int,string> $viewerRoles
     */
    private function resolveConfiguredViewPermission(?int $statusCatalogId, array $viewerRoles): bool
    {
        if ($statusCatalogId === null || ! $this->hasTable('workflow_status_view_rules')) {
            return true;
        }

        if (in_array('ADMIN', $viewerRoles, true)) {
            return true;
        }

        $rules = $this->listWorkflowStatusViewRules($statusCatalogId);
        if ($rules === []) {
            return true;
        }

        $matchedRules = array_values(array_filter($rules, function (array $rule) use ($viewerRoles): bool {
            $viewerRole = $this->normalizeWorkflowActorRole($rule['viewer_role'] ?? null);

            return $viewerRole !== null && in_array($viewerRole, $viewerRoles, true);
        }));

        if ($matchedRules === []) {
            return false;
        }

        foreach ($matchedRules as $rule) {
            if (! empty($rule['can_view'])) {
                return true;
            }
        }

        return false;
    }

    private function isAdminUserId(int $userId): bool
    {
        if (! array_key_exists($userId, $this->adminRoleCache)) {
            $this->adminRoleCache[$userId] = $this->userAccessService->isAdmin($userId);
        }

        return $this->adminRoleCache[$userId];
    }

    private function resolveWorkflowStatusCatalogNameById(int $statusCatalogId): ?string
    {
        if (array_key_exists($statusCatalogId, $this->statusNameCache)) {
            return $this->statusNameCache[$statusCatalogId];
        }

        if (! $this->hasTable('workflow_status_catalogs')) {
            $this->statusNameCache[$statusCatalogId] = null;

            return null;
        }

        $name = DB::table('workflow_status_catalogs')
            ->where('id', $statusCatalogId)
            ->value('status_name');

        $this->statusNameCache[$statusCatalogId] = $this->toNullableText($name);

        return $this->statusNameCache[$statusCatalogId];
    }

    /**
     * @return array<string,mixed>
     */
    private function loadWorkflowStatusTransitionById(int $id): array
    {
        $query = DB::table('workflow_status_transitions as t')
            ->leftJoin('workflow_status_catalogs as from_status', 't.from_status_catalog_id', '=', 'from_status.id')
            ->leftJoin('workflow_status_catalogs as to_status', 't.to_status_catalog_id', '=', 'to_status.id')
            ->select(array_values(array_filter([
                't.id',
                't.from_status_catalog_id',
                'from_status.status_name as from_status_name',
                't.to_status_catalog_id',
                'to_status.status_name as to_status_name',
                't.action_code',
                't.action_name',
                't.required_role',
                't.condition_json',
                't.notify_targets_json',
                't.sort_order',
                't.is_active',
                $this->hasColumn('workflow_status_transitions', 'created_at') ? 't.created_at' : null,
                $this->hasColumn('workflow_status_transitions', 'created_by') ? 't.created_by' : null,
                $this->hasColumn('workflow_status_transitions', 'updated_at') ? 't.updated_at' : null,
                $this->hasColumn('workflow_status_transitions', 'updated_by') ? 't.updated_by' : null,
            ])))
            ->where('t.id', $id)
            ->first();

        if (! $query) {
            throw new \RuntimeException('Không tìm thấy cấu hình transition workflow.');
        }

        return $this->decodeWorkflowStatusTransitionRow((array) $query);
    }

    private function flushWorkflowConfigCaches(): void
    {
        $this->transitionConfigCache = [];
        $this->viewRuleCache = [];
        $this->statusNameCache = [];
        $this->runtimeStatusCatalogIdCache = [];
        $this->supportServiceGroupWorkflowBindingCache = [];
        $this->workflowStatusCatalogLookupCache = null;
    }

    /**
     * @param array<int, int> $requestIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadCustomerRequestAttachmentMap(array $requestIds): array
    {
        if (
            $requestIds === []
            || ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $rows = DB::table('attachments')
            ->select(array_values(array_filter([
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ], fn (string $column): bool => $this->hasColumn('attachments', $column))))
            ->where('reference_type', 'CUSTOMER_REQUEST')
            ->whereIn('reference_id', $requestIds)
            ->when($this->hasColumn('attachments', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }

            $map[$referenceId][] = [
                'id' => (string) ($row['id'] ?? ''),
                'fileName' => (string) ($row['file_name'] ?? ''),
                'mimeType' => (string) ($row['mime_type'] ?? 'application/octet-stream'),
                'fileSize' => (int) ($row['file_size'] ?? 0),
                'fileUrl' => $this->resolveCustomerRequestAttachmentFileUrl($row),
                'driveFileId' => (string) ($row['drive_file_id'] ?? ''),
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'storagePath' => $this->toNullableText($row['storage_path'] ?? null),
                'storageDisk' => $this->toNullableText($row['storage_disk'] ?? null),
                'storageVisibility' => $this->toNullableText($row['storage_visibility'] ?? null),
                'storageProvider' => $this->toNullableText($row['drive_file_id'] ?? null) !== null
                    ? 'GOOGLE_DRIVE'
                    : (($this->toNullableText($row['storage_disk'] ?? null) === 'backblaze_b2') ? 'BACKBLAZE_B2' : 'LOCAL'),
            ];
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncCustomerRequestAttachments(int $requestId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'CUSTOMER_REQUEST')
            ->where('reference_id', $requestId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) ($this->attachmentValue($item, 'fileName', 'file_name') ?? ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->parseNullableInt($this->attachmentValue($item, 'fileSize', 'file_size')) ?? 0;
            $storagePath = $this->toNullableText($this->attachmentValue($item, 'storagePath', 'storage_path'));
            $storageDisk = $this->toNullableText($this->attachmentValue($item, 'storageDisk', 'storage_disk'));
            $storageVisibility = $this->toNullableText($this->attachmentValue($item, 'storageVisibility', 'storage_visibility'));

            $payload = $this->filterPayloadByTable('attachments', [
                'reference_type' => 'CUSTOMER_REQUEST',
                'reference_id' => $requestId,
                'file_name' => $fileName,
                'file_url' => $this->toNullableText($this->attachmentValue($item, 'fileUrl', 'file_url')),
                'drive_file_id' => $this->toNullableText($this->attachmentValue($item, 'driveFileId', 'drive_file_id')),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->toNullableText($this->attachmentValue($item, 'mimeType', 'mime_type')),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function resolveCustomerRequestAttachmentFileUrl(array $attachment): string
    {
        $storedPath = $this->toNullableText($attachment['storage_path'] ?? null);
        if ($storedPath !== null) {
            $attachmentId = $this->parseNullableInt($attachment['id'] ?? null);
            if ($attachmentId !== null) {
                $signedUrl = $this->buildSignedAttachmentDownloadUrl($attachmentId);
                if ($signedUrl !== '') {
                    return $signedUrl;
                }
            }

            $disk = $this->toNullableText($attachment['storage_disk'] ?? null) ?? 'local';
            $name = $this->toNullableText($attachment['file_name'] ?? null) ?? 'attachment';
            $temporaryUrl = $this->buildSignedTempAttachmentDownloadUrl($disk, $storedPath, $name);
            if ($temporaryUrl !== '') {
                return $temporaryUrl;
            }
        }

        return (string) ($attachment['file_url'] ?? '');
    }

    private function buildSignedAttachmentDownloadUrl(int $attachmentId): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.attachments.download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                ['id' => $attachmentId],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function buildSignedTempAttachmentDownloadUrl(string $disk, string $path, string $name): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.temp-download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                [
                    'disk' => $disk,
                    'path' => $path,
                    'name' => $name,
                ],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function attachmentValue(array $item, string ...$keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $item)) {
                return $item[$key];
            }
        }

        return null;
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

    private function isAnalysisCatalogRecord(object $catalog): bool
    {
        $statusCodeToken = $this->normalizeLooseToken((string) ($catalog->status_code ?? ''));
        $canonicalStatusToken = $this->normalizeLooseToken((string) ($catalog->canonical_status ?? ''));

        return in_array('phantich', [$statusCodeToken, $canonicalStatusToken], true);
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
