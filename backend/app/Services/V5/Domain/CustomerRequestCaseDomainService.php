<?php

namespace App\Services\V5\Domain;

use App\Actions\V5\CustomerRequest\TransitionCaseAction;
use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\CustomerRequest\CustomerRequestCaseDashboardService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseExecutionService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseMetadataService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseReadModelService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseTransitionEvaluator;
use App\Services\V5\CustomerRequest\CustomerRequestCaseReadQueryService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseIntakeIoService;
use App\Services\V5\CustomerRequest\Write\CaseWriteOrchestrator;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerRequestCaseDomainService
{
    private const PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE = 'pm_missing_customer_info_review';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO = 'customer_missing_info';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON = 'other_reason';

    /**
     * @var array<string, array{group_code:string,group_label:string}>
     */
    private array $statusGroups = [
        'new_intake' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'assigned_to_receiver' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'waiting_customer_feedback' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'analysis' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'analysis_completed' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'analysis_suspended' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'returned_to_manager' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'in_progress' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'coding' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'coding_in_progress' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'coding_suspended' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'dms_transfer' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'dms_task_created' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'dms_in_progress' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'dms_suspended' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'completed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'waiting_notification' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'customer_notified' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'closed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'not_executed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess,
        private readonly CustomerRequestCaseDashboardService $dashboardService,
        private readonly CustomerRequestCaseExecutionService $executionService,
        private readonly CustomerRequestCaseMetadataService $metadataService,
        private readonly CustomerRequestCaseTransitionEvaluator $transitionEvaluator,
        private readonly CustomerRequestCaseReadQueryService $readQueryService,
        private readonly CustomerRequestCaseReadModelService $readModelService,
        private readonly CustomerRequestCaseIntakeIoService $intakeIoService,
        private readonly CaseWriteOrchestrator $writeService,
        private readonly TransitionCaseAction $transitionCaseAction,
    ) {}

    public function statusCatalog(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $counts = DB::table('customer_request_cases')
            ->select(['current_status_code', DB::raw('COUNT(*) as aggregate')])
            ->whereNull('deleted_at')
            ->groupBy('current_status_code')
            ->pluck('aggregate', 'current_status_code');

        $workflowDefinitionId = $this->support->parseNullableInt($request->query('workflow_definition_id'));
        $catalog = $this->metadataService->getStatusCatalog($workflowDefinitionId);

        $groups = [];
        foreach ($catalog as $definition) {
            $statusCode = (string) ($definition['status_code'] ?? '');
            $groupCode = (string) ($definition['group_code'] ?? 'statuses');
            $groupLabel = (string) ($definition['group_label'] ?? 'Trạng thái');
            if (! isset($groups[$groupCode])) {
                $groups[$groupCode] = [
                    'group_code' => $groupCode,
                    'group_label' => $groupLabel,
                    'processes' => [],
                ];
            }

            $groups[$groupCode]['processes'][] = [
                ...$definition,
                'active_count' => (int) ($counts[$statusCode] ?? 0),
            ];
        }

        return response()->json([
            'data' => [
                'master_fields' => $this->metadataService->getMasterFields($workflowDefinitionId),
                'groups' => array_values($groups),
                'statuses' => array_values(array_map(
                    fn (array $definition): array => [
                        ...$definition,
                        'active_count' => (int) ($counts[$definition['status_code']] ?? 0),
                    ],
                    $catalog
                )),
            ],
        ]);
    }

    public function statusTransitions(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        // Get workflow_definition_id from request or case
        $workflowDefinitionId = $request->query('workflow_definition_id');
        $caseId = $request->query('case_id');
        
        // If case_id is provided, get workflow_definition_id from the case
        if ($caseId !== null && $workflowDefinitionId === null) {
            $case = DB::table('customer_request_cases')
                ->where('id', $caseId)
                ->whereNull('deleted_at')
                ->first();
            if ($case) {
                $workflowDefinitionId = $case->workflow_definition_id;
            }
        }
        
        // Build query
        $query = DB::table('customer_request_status_transitions')
            ->where('is_active', 1);
        
        // Filter by workflow_definition_id if provided
        if ($workflowDefinitionId !== null) {
            $query->where('workflow_definition_id', $workflowDefinitionId);
        }
        
        $resolvedWorkflowId = $this->support->parseNullableInt($workflowDefinitionId);
        $fromStatusCode = $this->normalizeNullableString($request->query('from_status_code'));

        if ($fromStatusCode !== null) {
            return response()->json([
                'data' => $this->metadataService->getAllowedTransitions($fromStatusCode, $resolvedWorkflowId),
            ]);
        }

        $rows = $query->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'workflow_definition_id' => $this->support->parseNullableInt($row->workflow_definition_id ?? null),
                'from_status_code' => (string) $row->from_status_code,
                'to_status_code' => (string) $row->to_status_code,
                'direction' => (string) $row->direction,
                'is_default' => (bool) $row->is_default,
                'is_active' => (bool) $row->is_active,
                'sort_order' => (int) $row->sort_order,
                'allowed_roles' => json_decode($row->allowed_roles ?? '["all"]', true),
                'required_fields' => json_decode($row->required_fields ?? '[]', true),
                'transition_meta' => json_decode($row->transition_meta_json ?? '{}', true),
                'notes' => $this->normalizeNullableString($row->notes ?? null),
                'from_status' => $this->metadataService->getStatusMeta((string) $row->from_status_code, $resolvedWorkflowId),
                'to_status' => $this->metadataService->getStatusMeta((string) $row->to_status_code, $resolvedWorkflowId),
            ])
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function index(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $statusCode = $this->normalizeNullableString(
            $request->query('status_code', $request->query('process_code'))
        );
        if ($statusCode !== null) {
            return $this->indexByStatus($request, $statusCode);
        }

        [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 100);
        $actorId = $this->resolveActorId($request);
        $query = $this->baseCaseQuery($actorId);
        $this->applyCaseFilters($query, $request, $actorId, false);

        if ($this->support->shouldUseSimplePagination($request)) {
            $fetchedRows = $query
                ->orderByDesc('crc.updated_at')
                ->orderByDesc('crc.id')
                ->forPage($page, $perPage + 1)
                ->get();

            $hasMorePages = $fetchedRows->count() > $perPage;
            $rows = $fetchedRows
                ->take($perPage)
                ->map(fn (object $row): array => $this->serializeSimpleCaseRow($row))
                ->values()
                ->all();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, count($rows), $hasMorePages),
            ]);
        }

        $total = (clone $query)->count();
        $rows = $query
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn (object $row): array => $this->serializeCaseRow($row))
            ->values()
            ->all();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    public function indexByStatus(Request $request, string $statusCode): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $workflowDefinitionId = $this->support->parseNullableInt($request->query('workflow_definition_id'));
        $statusDefinition = $this->metadataService->getStatusMeta($statusCode, $workflowDefinitionId);
        if ($statusDefinition === null) {
            return response()->json(['message' => 'Trạng thái không tồn tại.'], 404);
        }

        [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 100);
        $actorId = $this->resolveActorId($request);
        $query = $this->baseCaseQuery($actorId)
            ->where('crc.current_status_code', $statusCode);
        $this->applyCaseFilters($query, $request, $actorId, true);

        $total = (clone $query)->count();
        $rows = $query
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id')
            ->forPage($page, $perPage)
            ->get()
            ->map(function (object $row) use ($statusDefinition): array {
                $case = $this->serializeCaseRow($row);
                $instance = $this->findStatusInstanceForCase((int) $row->id, (string) $statusDefinition['status_code'], true);
                $statusRow = $instance === null ? null : $this->loadStatusRow((string) $statusDefinition['table_name'], $instance->status_row_id);

                return [
                    ...$case,
                    'status_row' => $statusRow === null ? null : $this->serializeStatusRow($statusDefinition, $statusRow),
                    'list_values' => $this->buildListValues($statusDefinition, $case, $statusRow),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $total),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->writeService->store(
            $request,
            fn (CustomerRequestCase $case, string $statusCode, ?int $userId): array => $this->buildStatusDetailData(
                $case,
                $statusCode,
                $userId
            )
        );
    }

    public function importIntakeTemplate(Request $request): JsonResponse
    {
        return $this->intakeIoService->importIntakeTemplate($request);
    }

    public function importIntake(Request $request): JsonResponse
    {
        return $this->intakeIoService->importIntake($request);
    }

    public function exportIntake(Request $request): StreamedResponse
    {
        return $this->intakeIoService->exportIntake($request);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return response()->json([
            'data' => $this->serializeCaseModel($case),
        ]);
    }

    public function timeline(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $rows = DB::table('customer_request_status_instances as si')
            ->leftJoin('customer_request_status_catalogs as from_catalog', 'from_catalog.status_code', '=', 'si.status_code')
            ->leftJoin('customer_request_status_instances as prev', 'prev.id', '=', 'si.previous_instance_id')
            ->leftJoin('customer_request_status_catalogs as prev_catalog', 'prev_catalog.status_code', '=', 'prev.status_code')
            ->leftJoin('internal_users as creator', 'creator.id', '=', 'si.created_by')
            ->select([
                'si.id',
                'si.request_case_id',
                'si.status_code',
                'si.status_table',
                'si.status_row_id',
                'si.previous_instance_id',
                'si.next_instance_id',
                'si.decision_context_code',
                'si.decision_outcome_code',
                'si.decision_source_status_code',
                'si.entered_at',
                'si.exited_at',
                'si.is_current',
                'si.created_by',
                'si.updated_by',
                'si.created_at',
                'si.updated_at',
                'from_catalog.status_name_vi as status_name_vi',
                'prev_catalog.status_name_vi as previous_status_name_vi',
                'creator.full_name as changed_by_name',
                'creator.user_code as changed_by_code',
            ])
            ->where('si.request_case_id', $case->id)
            ->orderByDesc('si.created_at')
            ->orderByDesc('si.id')
            ->get()
            ->map(fn (object $row): array => $this->serializeTimelineRow($row))
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function worklogs(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return $this->executionService->worklogs($case);
    }

    public function people(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return response()->json([
            'data' => $this->buildRelatedPeople($case),
        ]);
    }

    public function estimates(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return $this->executionService->estimates($case);
    }

    public function storeEstimate(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        $case = $this->findAccessibleCaseModel($id, $actorId);
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền cập nhật estimate cho yêu cầu này.'], 403);
        }

        $scopeError = $this->authorizeCaseMutationScope($case, $actorId, 'Bạn không có quyền cập nhật estimate cho yêu cầu này.');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        return $this->executionService->storeEstimate($request, $case, $actorId);
    }

    public function hoursReport(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return $this->executionService->hoursReport($case);
    }

    public function attachments(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return response()->json([
            'data' => $this->loadAttachmentAggregateForCase((int) $case->id),
        ]);
    }

    /**
     * Lưu attachments vào customer request status instance
     */
    public function bulkAttachments(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $validated = $request->validate([
            'attachments' => ['required', 'array'],
            'attachments.*.id' => ['required', 'integer'],
        ]);

        $attachments = $validated['attachments'] ?? [];
        $actorId = $this->resolveActorId($request);

        // Get current status instance
        $currentInstance = $this->currentStatusInstance($case);
        if ($currentInstance === null) {
            return response()->json(['message' => 'Không tìm thấy trạng thái hiện tại.'], 404);
        }

        // Sync attachments
        $this->writeService->syncAttachments(
            (int) $case->id,
            (int) $currentInstance->id,
            $attachments,
            $actorId
        );

        return response()->json([
            'data' => $this->loadAttachmentAggregateForCase((int) $case->id),
        ]);
    }

    /**
     * Full detail endpoint — tổng hợp case + 3 roles + timeline + worklogs + estimates + ref_tasks + attachments.
     * Dùng cho trang tra cứu chi tiết (§7).
     */
    public function fullDetail(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $caseId = (int) $case->id;

        // Timeline — toàn bộ status history
        $timeline = DB::table('customer_request_status_instances as si')
            ->leftJoin('customer_request_status_catalogs as cat', 'cat.status_code', '=', 'si.status_code')
            ->leftJoin('customer_request_status_instances as prev', 'prev.id', '=', 'si.previous_instance_id')
            ->leftJoin('customer_request_status_catalogs as prev_cat', 'prev_cat.status_code', '=', 'prev.status_code')
            ->leftJoin('internal_users as actor', 'actor.id', '=', 'si.created_by')
            ->select([
                'si.id', 'si.status_code', 'si.decision_context_code', 'si.decision_outcome_code', 'si.decision_source_status_code', 'si.entered_at', 'si.exited_at', 'si.is_current',
                'cat.status_name_vi',
                'prev_cat.status_name_vi as previous_status_name_vi',
                'actor.full_name as changed_by_name',
                'actor.user_code as changed_by_code',
            ])
            ->where('si.request_case_id', $caseId)
            ->orderByDesc('si.created_at')
            ->orderByDesc('si.id')
            ->get()
            ->map(fn (object $row): array => [
                ...$this->serializeTimelineRow($row),
                'changed_by_name' => $this->normalizeNullableString($row->changed_by_name),
                'changed_by_code' => $this->normalizeNullableString($row->changed_by_code),
                'entered_at' => $this->normalizeNullableString($row->entered_at),
                'exited_at' => $this->normalizeNullableString($row->exited_at),
                'is_current' => (bool) $row->is_current,
            ])
            ->values()
            ->all();

        // Worklogs tóm tắt — tổng giờ theo người
        $worklogSummary = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as u', 'u.id', '=', 'wl.performed_by_user_id')
            ->where('wl.request_case_id', $caseId)
            ->select([
                'wl.performed_by_user_id',
                'u.full_name as performer_name',
                'u.user_code as performer_code',
                DB::raw('COALESCE(SUM(wl.hours_spent), 0) as total_hours'),
                DB::raw('COUNT(*) as entry_count'),
            ])
            ->groupBy('wl.performed_by_user_id', 'u.full_name', 'u.user_code')
            ->orderByDesc('total_hours')
            ->get()
            ->map(fn (object $row): array => [
                'performed_by_user_id' => $this->support->parseNullableInt($row->performed_by_user_id),
                'performer_name' => $this->normalizeNullableString($row->performer_name),
                'performer_code' => $this->normalizeNullableString($row->performer_code),
                'total_hours' => (float) $row->total_hours,
                'entry_count' => (int) $row->entry_count,
            ])
            ->values()
            ->all();

        // Ref tasks
        $refTasks = DB::table('customer_request_status_ref_tasks as rt')
            ->leftJoin('request_ref_tasks as base', 'base.id', '=', 'rt.ref_task_id')
            ->where('rt.request_case_id', $caseId)
            ->select(['rt.*', 'base.request_code', 'base.task_code', 'base.task_link', 'base.task_status', 'base.task_note', 'base.task_source'])
            ->orderBy('rt.id')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'ref_task_id' => $this->support->parseNullableInt($row->ref_task_id),
                'task_code' => $this->normalizeNullableString($row->task_code),
                'task_link' => $this->normalizeNullableString($row->task_link),
                'task_status' => $this->normalizeNullableString($row->task_status),
                'task_source' => $this->normalizeNullableString($row->task_source),
                'task_note' => $this->normalizeNullableString($row->task_note),
            ])
            ->values()
            ->all();

        // Estimates
        $estimates = $this->support->hasTable('customer_request_estimates')
            ? $this->loadEstimatesForCase($caseId)
            : [];

        // Attachments
        $attachments = $this->loadAttachmentAggregateForCase($caseId);

        // Hours report
        $hours = $this->buildHoursReportPayload($case);

        // 3 roles
        $people = $this->buildRelatedPeople($case);

        return response()->json([
            'data' => [
                'request_case' => $this->serializeCaseModel($case),
                'people' => $people,
                'timeline' => $timeline,
                'worklog_summary' => $worklogSummary,
                'estimates' => $estimates,
                'ref_tasks' => $refTasks,
                'attachments' => $attachments,
                'hours' => $hours,
            ],
        ]);
    }

    /**
     * Summary card — compact data cho hover popup / preview panel.
     * Dùng cho §7 HoverCard và search result preview.
     */
    public function summaryCard(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $serialized = $this->serializeCaseModel($case);

        // Đếm nhanh worklogs + estimates
        $totalHoursSpent = (float) DB::table('customer_request_worklogs')
            ->where('request_case_id', $case->id)
            ->sum('hours_spent');

        $latestEstimate = $this->support->hasTable('customer_request_estimates')
            ? DB::table('customer_request_estimates')
                ->where('request_case_id', $case->id)
                ->orderByDesc('created_at')
                ->value('estimated_hours')
            : null;

        // Đếm ref tasks
        $refTaskCount = DB::table('customer_request_status_ref_tasks')
            ->where('request_case_id', $case->id)
            ->count();

        return response()->json([
            'data' => [
                'id' => (int) $case->id,
                'request_code' => $serialized['request_code'] ?? null,
                'summary' => $serialized['summary'] ?? null,
                'current_status_code' => $serialized['current_status_code'] ?? null,
                'current_status_name_vi' => $serialized['current_status_name_vi'] ?? null,
                'priority' => $serialized['priority'] ?? null,
                'customer_name' => $serialized['customer_name'] ?? null,
                'project_name' => $serialized['project_name'] ?? null,
                'receiver_name' => $serialized['receiver_name'] ?? null,
                'dispatcher_name' => $serialized['dispatcher_name'] ?? null,
                'performer_name' => $serialized['performer_name'] ?? null,
                'received_at' => $serialized['received_at'] ?? null,
                'current_status_changed_at' => $serialized['current_status_changed_at'] ?? null,
                'dispatch_route' => $serialized['dispatch_route'] ?? null,
                'total_hours_spent' => $totalHoursSpent,
                'latest_estimate_hours' => $latestEstimate !== null ? (float) $latestEstimate : null,
                'ref_task_count' => $refTaskCount,
                'updated_at' => $serialized['updated_at'] ?? null,
            ],
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $keyword = $this->normalizeNullableString($request->query('q', $request->query('search')));
        if ($keyword === null) {
            return response()->json(['data' => []]);
        }

        $limit = max(1, min(50, (int) $request->integer('limit', 10)));
        $actorId = $this->resolveActorId($request);
        $query = $this->baseCaseQuery($actorId);
        $this->applyKeywordSearch($query, $keyword);

        $rows = $query
            ->orderByRaw('CASE WHEN crc.request_code = ? THEN 0 WHEN crc.request_code LIKE ? THEN 1 ELSE 2 END', [$keyword, $keyword.'%'])
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id')
            ->limit($limit)
            ->get()
            ->map(fn (object $row): array => $this->buildSearchItem($this->serializeCaseRow($row)))
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    public function dashboardCreator(Request $request): JsonResponse
    {
        $useSimpleSerialization = $this->support->shouldUseSimplePagination($request);

        return $this->dashboardService->dashboardCreator(
            $request,
            $useSimpleSerialization
                ? fn (object|array $row): array => $this->serializeSimpleCaseRow($row)
                : fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function dashboardDispatcher(Request $request): JsonResponse
    {
        $useSimpleSerialization = $this->support->shouldUseSimplePagination($request);

        return $this->dashboardService->dashboardDispatcher(
            $request,
            $useSimpleSerialization
                ? fn (object|array $row): array => $this->serializeSimpleCaseRow($row)
                : fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function dashboardPerformer(Request $request): JsonResponse
    {
        $useSimpleSerialization = $this->support->shouldUseSimplePagination($request);

        return $this->dashboardService->dashboardPerformer(
            $request,
            $useSimpleSerialization
                ? fn (object|array $row): array => $this->serializeSimpleCaseRow($row)
                : fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function dashboardOverview(Request $request): JsonResponse
    {
        $useSimpleSerialization = $this->support->shouldUseSimplePagination($request);

        return $this->dashboardService->dashboardOverview(
            $request,
            $useSimpleSerialization
                ? fn (object|array $row): array => $this->serializeSimpleCaseRow($row)
                : fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function performerWeeklyTimesheet(Request $request): JsonResponse
    {
        return $this->dashboardService->performerWeeklyTimesheet(
            $request,
            fn (object|array $row): array => $this->serializeWorklogRow($row)
        );
    }

    public function storeWorklog(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->resolveActorId($request);
        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền ghi worklog cho yêu cầu này.'], 403);
        }

        $scopeError = $this->authorizeCaseMutationScope($case, $actorId, 'Bạn không có quyền ghi worklog cho yêu cầu này.');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        return $this->executionService->storeWorklog($request, $case, $actorId);
    }

    public function storeDetailStatusWorklog(Request $request, int $id): JsonResponse
    {
        try {
            if (($missing = $this->missingTablesResponse()) !== null) {
                return $missing;
            }
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o check missing tables',
                'debug' => $exception->getMessage(),
            ], 500);
        }

        try {
            $this->mergeWorklogFieldsFromNestedPayload($request);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o merge payload worklog',
                'debug' => $exception->getMessage(),
            ], 500);
        }

        try {
            $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o find case',
                'debug' => $exception->getMessage(),
            ], 500);
        }
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        try {
            $actorId = $this->resolveActorId($request);
            if (! $this->canWriteCase($case, $actorId)) {
                return response()->json(['message' => 'Bạn không có quyền thao tác yêu cầu này.'], 403);
            }

            $scopeError = $this->authorizeCaseMutationScope($case, $actorId, 'Bạn không có quyền thao tác yêu cầu này.');
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o check quyen thao tac',
                'debug' => $exception->getMessage(),
            ], 500);
        }

        try {
            if (! $this->support->hasTable('customer_request_status_detail_states')) {
                return response()->json(['message' => 'Thiếu bảng customer_request_status_detail_states.'], 500);
            }
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o check bang customer_request_status_detail_states',
                'debug' => $exception->getMessage(),
            ], 500);
        }

        try {
            $action = $this->normalizeNullableString($request->input('detail_status_action'))
                ?? $this->normalizeNullableString($request->input('action'));
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o doc detail_status_action',
                'debug' => $exception->getMessage(),
            ], 500);
        }
        if (! in_array($action, ['in_progress', 'paused'], true)) {
            return response()->json([
                'message' => 'action không hợp lệ.',
                'errors' => ['action' => ['action phải là in_progress hoặc paused.']],
            ], 422);
        }

        try {
            $currentInstance = $this->currentStatusInstance($case);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o query current status instance',
                'debug' => $exception->getMessage(),
            ], 500);
        }
        if ($currentInstance === null) {
            return response()->json(['message' => 'Yêu cầu chưa có trạng thái hiện tại.'], 422);
        }

        $targetDetailStatus = $action;
        $source = 'button_worklog_submit';

        try {
            $result = DB::transaction(function () use ($request, $case, $actorId, $currentInstance, $targetDetailStatus, $source): array {
                try {
                    $existingState = DB::table('customer_request_status_detail_states')
                        ->where('status_instance_id', (int) $currentInstance->id)
                        ->first();
                } catch (\Throwable $exception) {
                    throw new \RuntimeException('da loi o query customer_request_status_detail_states: '.$exception->getMessage(), 0, $exception);
                }

                $now = now();
                $note = $this->normalizeNullableString($request->input('work_content'));
                $fromDetailStatus = $this->normalizeNullableString($existingState?->detail_status) ?? 'open';

                if ($existingState === null) {
                    try {
                        DB::table('customer_request_status_detail_states')->insert($this->filterDetailStatePayload([
                            'request_case_id' => (int) $case->id,
                            'status_instance_id' => (int) $currentInstance->id,
                            'status_code' => (string) $currentInstance->status_code,
                            'detail_status' => $targetDetailStatus,
                            'started_at' => $now,
                            'completed_at' => null,
                            'changed_by' => $actorId,
                            'note' => $note,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]));
                    } catch (\Throwable $exception) {
                        throw new \RuntimeException('da loi o insert customer_request_status_detail_states: '.$exception->getMessage(), 0, $exception);
                    }
                } elseif ($fromDetailStatus !== $targetDetailStatus) {
                    try {
                        DB::table('customer_request_status_detail_states')
                            ->where('status_instance_id', (int) $currentInstance->id)
                            ->update($this->filterDetailStatePayload([
                                'detail_status' => $targetDetailStatus,
                                'started_at' => $targetDetailStatus === 'in_progress' ? $now : ($existingState->started_at ?? $now),
                                'completed_at' => $targetDetailStatus === 'completed' ? $now : null,
                                'changed_by' => $actorId,
                                'note' => $note,
                                'updated_at' => $now,
                            ]));
                    } catch (\Throwable $exception) {
                        throw new \RuntimeException('da loi o update customer_request_status_detail_states: '.$exception->getMessage(), 0, $exception);
                    }
                }

                if ($this->support->hasTable('customer_request_status_detail_logs')) {
                    try {
                        DB::table('customer_request_status_detail_logs')->insert($this->filterDetailLogPayload([
                            'request_case_id' => (int) $case->id,
                            'status_instance_id' => (int) $currentInstance->id,
                            'status_code' => (string) $currentInstance->status_code,
                            'from_detail_status' => $fromDetailStatus,
                            'to_detail_status' => $targetDetailStatus,
                            'changed_by' => $actorId,
                            'source' => $source,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]));
                    } catch (\Throwable $exception) {
                        throw new \RuntimeException('da loi o insert customer_request_status_detail_logs: '.$exception->getMessage(), 0, $exception);
                    }
                }

                try {
                    $request->merge([
                        'status_instance_id' => (int) $currentInstance->id,
                        'detail_status_action' => $targetDetailStatus,
                    ]);
                } catch (\Throwable $exception) {
                    throw new \RuntimeException('da loi o merge request detail_status_action: '.$exception->getMessage(), 0, $exception);
                }

                try {
                    $worklogResponse = $this->executionService->storeWorklog($request, $case, $actorId);
                    $payload = $worklogResponse->getData(true);
                } catch (\Throwable $exception) {
                    throw new \RuntimeException('da loi o executionService->storeWorklog: '.$exception->getMessage(), 0, $exception);
                }

                return [
                    'worklog_response' => $worklogResponse,
                    'detail_status' => $targetDetailStatus,
                    'worklog_payload' => is_array($payload) ? $payload : [],
                ];
            });
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 500);
        }

        try {
            $baseResponse = $result['worklog_response'];
            $payload = is_array($result['worklog_payload']) ? $result['worklog_payload'] : [];
            $payload['meta'] = [
                ...(is_array($payload['meta'] ?? null) ? $payload['meta'] : []),
                'detail_status' => $result['detail_status'],
            ];

            return response()->json($payload, $baseResponse->getStatusCode());
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'da loi o format response detail status worklog',
                'debug' => $exception->getMessage(),
            ], 500);
        }
    }

    public function updateWorklog(Request $request, int $id, int $worklogId): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->resolveActorId($request);
        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền cập nhật worklog cho yêu cầu này.'], 403);
        }

        $scopeError = $this->authorizeCaseMutationScope($case, $actorId, 'Bạn không có quyền cập nhật worklog cho yêu cầu này.');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $worklog = DB::table('customer_request_worklogs')
            ->where('id', $worklogId)
            ->where('request_case_id', $case->id)
            ->first();
        if ($worklog === null) {
            return response()->json(['message' => 'Worklog không tồn tại.'], 404);
        }

        $difficultyStatus = $this->normalizeNullableString($request->input('difficulty_status'));
        if ($difficultyStatus !== null && ! in_array($difficultyStatus, ['none', 'has_issue', 'resolved'], true)) {
            return response()->json(['message' => 'difficulty_status không hợp lệ.'], 422);
        }

        $startedAt = $this->normalizeDateTime($request->input('work_started_at'));
        $endedAt = $this->normalizeDateTime($request->input('work_ended_at'));
        $hoursSpent = $this->normalizeNullableDecimal($request->input('hours_spent'));
        $workDate = $this->readQueryService->normalizeNullableDate($request->input('work_date'));
        if ($hoursSpent === null && $startedAt !== null && $endedAt !== null) {
            try {
                $hoursSpent = round(\Illuminate\Support\Carbon::parse($startedAt)->diffInMinutes(\Illuminate\Support\Carbon::parse($endedAt), true) / 60, 2);
            } catch (\Throwable) {
                $hoursSpent = null;
            }
        }

        if ($workDate === null && $startedAt !== null) {
            try {
                $workDate = \Illuminate\Support\Carbon::parse($startedAt)->format('Y-m-d');
            } catch (\Throwable) {
                $workDate = null;
            }
        }

        $payload = $this->writeService->filterByTableColumns('customer_request_worklogs', [
            'difficulty_note' => $this->normalizeNullableString($request->input('difficulty_note')),
            'proposal_note' => $this->normalizeNullableString($request->input('proposal_note')),
            'difficulty_status' => $difficultyStatus,
            'work_started_at' => $startedAt,
            'work_ended_at' => $endedAt,
            'work_date' => $workDate,
            'activity_type_code' => $this->normalizeNullableString($request->input('activity_type_code')),
            'is_billable' => $this->readQueryService->resolveBooleanInput($request->input('is_billable')),
            'hours_spent' => $hoursSpent,
            'updated_by' => $actorId,
            'updated_at' => now(),
        ]);

        if ($request->exists('work_content')) {
            $payload['work_content'] = $this->normalizeNullableString($request->input('work_content')) ?? '';
        }

        unset($payload['status_instance_id'], $payload['status_code'], $payload['detail_status_action']);

        DB::table('customer_request_worklogs')
            ->where('id', $worklogId)
            ->where('request_case_id', $case->id)
            ->update($payload);

        $hoursSummary = $this->executionService->buildHoursReportPayload($case->fresh() ?? $case);

        $row = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->leftJoin('customer_request_status_instances as instance', 'instance.id', '=', 'wl.status_instance_id')
            ->leftJoin('customer_request_status_catalogs as catalog', function ($join): void {
                $join->on('catalog.status_code', '=', 'instance.status_code')
                    ->where('catalog.is_active', 1);
            })
            ->where('wl.id', $worklogId)
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
                'catalog.status_name_vi as status_name_vi',
            ])
            ->first();

        return response()->json([
            'data' => $row === null ? null : $this->serializeWorklogRow($row),
            'meta' => [
                'hours_report' => $hoursSummary,
            ],
        ]);
    }

    public function detailStatus(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if (! $this->support->hasTable('customer_request_status_detail_states')) {
            return response()->json(['data' => [
                'detail_status' => 'open',
                'can_transition_main_status' => false,
            ]]);
        }

        $currentInstance = $this->currentStatusInstance($case);
        if ($currentInstance === null) {
            return response()->json(['data' => [
                'detail_status' => 'open',
                'can_transition_main_status' => false,
            ]]);
        }

        $state = DB::table('customer_request_status_detail_states')
            ->where('status_instance_id', (int) $currentInstance->id)
            ->first();

        $detailStatus = $this->normalizeNullableString($state->detail_status ?? null) ?? 'open';

        return response()->json([
            'data' => [
                'status_instance_id' => (int) $currentInstance->id,
                'status_code' => (string) $currentInstance->status_code,
                'detail_status' => $detailStatus,
                'can_transition_main_status' => $detailStatus !== 'open',
                'quick_actions' => [
                    ['action' => 'in_progress', 'label' => 'Đang thực hiện'],
                    ['action' => 'paused', 'label' => 'Tạm ngưng'],
                ],
            ],
        ]);
    }

    private function filterDetailStatePayload(array $payload): array
    {
        return $this->writeService->filterByTableColumns('customer_request_status_detail_states', $payload);
    }

    private function filterDetailLogPayload(array $payload): array
    {
        return $this->writeService->filterByTableColumns('customer_request_status_detail_logs', $payload);
    }


    private function markDetailStatusCompletedForInstance(int $requestCaseId, int $statusInstanceId, string $statusCode, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_detail_states')) {
            return;
        }

        $existing = DB::table('customer_request_status_detail_states')
            ->where('status_instance_id', $statusInstanceId)
            ->first();

        $now = now();
        $fromDetailStatus = $this->normalizeNullableString($existing->detail_status ?? null) ?? 'open';

        if ($existing === null) {
            DB::table('customer_request_status_detail_states')->insert($this->filterDetailStatePayload([
                'request_case_id' => $requestCaseId,
                'status_instance_id' => $statusInstanceId,
                'status_code' => $statusCode,
                'detail_status' => 'completed',
                'started_at' => $now,
                'completed_at' => $now,
                'changed_by' => $actorId,
                'note' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        } elseif ($fromDetailStatus !== 'completed') {
            DB::table('customer_request_status_detail_states')
                ->where('status_instance_id', $statusInstanceId)
                ->update($this->filterDetailStatePayload([
                    'detail_status' => 'completed',
                    'completed_at' => $now,
                    'changed_by' => $actorId,
                    'updated_at' => $now,
                ]));
        }

        if ($this->support->hasTable('customer_request_status_detail_logs')) {
            DB::table('customer_request_status_detail_logs')->insert($this->filterDetailLogPayload([
                'request_case_id' => $requestCaseId,
                'status_instance_id' => $statusInstanceId,
                'status_code' => $statusCode,
                'from_detail_status' => $fromDetailStatus,
                'to_detail_status' => 'completed',
                'changed_by' => $actorId,
                'source' => 'system_transition',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    private function initializeDetailStatusOpenForInstance(int $requestCaseId, int $statusInstanceId, string $statusCode, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_detail_states')) {
            return;
        }

        $exists = DB::table('customer_request_status_detail_states')
            ->where('status_instance_id', $statusInstanceId)
            ->exists();
        if ($exists) {
            return;
        }

        $now = now();
        DB::table('customer_request_status_detail_states')->insert($this->filterDetailStatePayload([
            'request_case_id' => $requestCaseId,
            'status_instance_id' => $statusInstanceId,
            'status_code' => $statusCode,
            'detail_status' => 'open',
            'started_at' => $now,
            'completed_at' => null,
            'changed_by' => $actorId,
            'note' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]));

        if ($this->support->hasTable('customer_request_status_detail_logs')) {
            DB::table('customer_request_status_detail_logs')->insert($this->filterDetailLogPayload([
                'request_case_id' => $requestCaseId,
                'status_instance_id' => $statusInstanceId,
                'status_code' => $statusCode,
                'from_detail_status' => null,
                'to_detail_status' => 'open',
                'changed_by' => $actorId,
                'source' => 'system_transition',
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    private function currentDetailStatusForCase(CustomerRequestCase $case): ?string
    {
        if (! $this->support->hasTable('customer_request_status_detail_states')) {
            return null;
        }

        $currentInstance = $this->currentStatusInstance($case);
        if ($currentInstance === null) {
            return null;
        }

        $state = DB::table('customer_request_status_detail_states')
            ->where('status_instance_id', (int) $currentInstance->id)
            ->first();

        return $this->normalizeNullableString($state->detail_status ?? null);
    }

    private function isTransitionBlockedByDetailStatus(CustomerRequestCase $case): bool
    {
        $detailStatus = $this->currentDetailStatusForCase($case);

        return $detailStatus === 'open';
    }

    private function augmentProcessDetailWithCurrentDetailStatus(array $payload, CustomerRequestCase $case): array
    {
        $detailStatus = $this->currentDetailStatusForCase($case) ?? 'open';

        $payload['current_detail_status'] = $detailStatus;
        $payload['can_transition_main_status'] = $detailStatus !== 'open';

        return $payload;
    }

    private function ensureDetailStatusOpenForCurrentInstance(CustomerRequestCase $case, ?int $actorId): void
    {
        $currentInstance = $this->currentStatusInstance($case);
        if ($currentInstance === null) {
            return;
        }

        $this->initializeDetailStatusOpenForInstance(
            (int) $case->id,
            (int) $currentInstance->id,
            (string) $currentInstance->status_code,
            $actorId
        );
    }

    private function mergeWorklogFieldsFromNestedPayload(Request $request): void
    {
        $worklogPayload = $request->input('worklog');
        if (! is_array($worklogPayload)) {
            return;
        }

        $request->merge([
            'work_content' => $worklogPayload['work_content'] ?? $request->input('work_content'),
            'work_date' => $worklogPayload['work_date'] ?? $request->input('work_date'),
            'activity_type_code' => $worklogPayload['activity_type_code'] ?? $request->input('activity_type_code'),
            'hours_spent' => $worklogPayload['hours_spent'] ?? $request->input('hours_spent'),
            'is_billable' => $worklogPayload['is_billable'] ?? $request->input('is_billable'),
            'difficulty_note' => $worklogPayload['difficulty_note'] ?? $request->input('difficulty_note'),
            'proposal_note' => $worklogPayload['proposal_note'] ?? $request->input('proposal_note'),
            'difficulty_status' => $worklogPayload['difficulty_status'] ?? $request->input('difficulty_status'),
            'work_started_at' => $worklogPayload['work_started_at'] ?? $request->input('work_started_at'),
            'work_ended_at' => $worklogPayload['work_ended_at'] ?? $request->input('work_ended_at'),
        ]);
    }

    /**
     * V4: Update sub-status (coding_phase or dms_phase) without full status transition.
     * PATCH /api/v5/customer-request-cases/{id}/sub-status
     */
    public function updateSubStatus(Request $request, int $id): JsonResponse
    {
        return $this->writeService->updateSubStatus($request, $id);
    }

    public function showStatus(Request $request, int $id, string $statusCode): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if ($this->metadataService->getStatusMeta($statusCode, $case->workflow_definition_id) === null) {
            return response()->json(['message' => 'Trạng thái không tồn tại.'], 404);
        }

        return response()->json([
            'data' => $this->buildStatusDetailData($case, $statusCode, $this->resolveActorId($request)),
        ]);
    }

    public function saveStatus(Request $request, int $id, string $statusCode): JsonResponse
    {
        return $this->writeService->saveStatus(
            $request,
            $id,
            $statusCode,
            fn (CustomerRequestCase $case, string $resolvedStatusCode, ?int $userId): array => $this->buildStatusDetailData(
                $case,
                $resolvedStatusCode,
                $userId
            )
        );
    }

    public function transition(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        $case = $this->findAccessibleCaseModel($id, $actorId);
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if ($this->isTransitionBlockedByDetailStatus($case)) {
            return response()->json([
                'message' => 'Không thể chuyển trạng thái chính khi trạng thái chi tiết đang ở Mở.',
                'errors' => [
                    'detail_status' => ['Không thể chuyển trạng thái chính khi trạng thái chi tiết đang ở Mở.'],
                ],
            ], 422);
        }

        $previousInstance = $this->currentStatusInstance($case);
        $response = $this->transitionCaseAction->execute(
            $request,
            $id,
            fn (CustomerRequestCase $resolvedCase, string $statusCode, ?int $userId): array => $this->augmentProcessDetailWithCurrentDetailStatus(
                $this->buildStatusDetailData($resolvedCase, $statusCode, $userId),
                $resolvedCase
            )
        );

        if ($response->getStatusCode() >= 400) {
            return $response;
        }

        $freshCase = $this->findAccessibleCaseModel($id, $actorId);
        if ($freshCase !== null) {
            if ($previousInstance !== null) {
                $this->markDetailStatusCompletedForInstance(
                    (int) $freshCase->id,
                    (int) $previousInstance->id,
                    (string) $previousInstance->status_code,
                    $actorId
                );
            }

            $currentInstance = $this->currentStatusInstance($freshCase);
            if ($currentInstance !== null) {
                $this->initializeDetailStatusOpenForInstance(
                    (int) $freshCase->id,
                    (int) $currentInstance->id,
                    (string) $currentInstance->status_code,
                    $actorId
                );
            }
        }

        return $response;
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->writeService->destroy($request, $id);
    }

    private function buildStatusDetailData(CustomerRequestCase $case, string $statusCode, ?int $userId): array
    {
        $workflowDefinitionId = $case->workflow_definition_id;
        $requestedDefinition = $this->metadataService->getStatusMeta($statusCode, $workflowDefinitionId);
        $currentDefinition = $this->metadataService->getStatusMeta((string) $case->current_status_code, $workflowDefinitionId);
        $requestedInstance = $statusCode === $case->current_status_code
            ? $this->currentStatusInstance($case)
            : $this->findStatusInstanceForCase((int) $case->id, $statusCode, false);
        $statusRow = $requestedDefinition !== null && $requestedInstance !== null
            ? $this->loadStatusRow((string) $requestedDefinition['table_name'], $requestedInstance->status_row_id)
            : null;
        $serializedCase = $this->augmentProcessDetailWithCurrentDetailStatus(
            $this->serializeCaseModel($case),
            $case
        );

        $allowedNext = $currentDefinition === null
            ? []
            : array_values(array_map(
                fn (array $definition): array => [
                    'process_code' => (string) ($definition['status_code'] ?? ''),
                    'process_name' => (string) ($definition['process_label'] ?? $definition['status_name_vi'] ?? $definition['status_code'] ?? ''),
                    'allowed_roles' => ['all'], // Default role for simple workflows
                    'transition_meta' => [],
                    ...$this->serializeTransitionStatusMeta($definition, $case, (string) $currentDefinition['status_code']),
                ],
                $this->allowedStatusDefinitionsForCase($case, (string) $currentDefinition['status_code'], 'forward')
            ));

        $allowedPrevious = $currentDefinition === null
            ? []
            : array_values(array_map(
                fn (array $definition): array => $this->serializeTransitionStatusMeta(
                    $definition,
                    $case,
                    (string) $currentDefinition['status_code']
                ),
                $this->allowedStatusDefinitionsForCase($case, (string) $currentDefinition['status_code'], 'backward')
            ));

        return [
            ...$serializedCase,
            'request_case' => $serializedCase,

            'current_status' => $currentDefinition,
            'current_process' => $currentDefinition,
            'status' => $requestedDefinition,
            'process' => $requestedDefinition,
            'status_instance' => $requestedInstance === null ? null : $this->serializeStatusInstance($requestedInstance),
            'status_row' => ($requestedDefinition === null || $statusRow === null) ? null : $this->serializeStatusRow($requestedDefinition, $statusRow),
            'process_row' => ($requestedDefinition === null || $statusRow === null) ? null : $this->serializeStatusRow($requestedDefinition, $statusRow),
            'allowed_next_statuses' => $allowedNext,
            'allowed_previous_statuses' => $allowedPrevious,
            'allowed_next_processes' => $allowedNext,
            'transition_allowed' => $statusCode === $case->current_status_code || $this->isTransitionAllowedForCase($case, (string) $case->current_status_code, $statusCode),
            'can_write' => $this->canWriteCase($case, $userId),
            'available_actions' => $this->buildAvailableActions($case, $userId),
            'people' => $this->buildRelatedPeople($case),
            'estimates' => $this->loadEstimatesForCase((int) $case->id),
            'hours_report' => $this->buildHoursReportPayload($case),
            'worklogs' => $requestedInstance === null ? [] : $this->loadWorklogsForInstance((int) $requestedInstance->id),
            'attachments' => $requestedInstance === null ? [] : $this->loadAttachmentsForInstance((int) $requestedInstance->id),
            'ref_tasks' => $requestedInstance === null ? [] : $this->loadRefTasksForInstance((int) $requestedInstance->id),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStatusMeta(array $definition): array
    {
        $statusCode = (string) $definition['status_code'];
        $group = $this->statusGroups[$statusCode] ?? ['group_code' => 'statuses', 'group_label' => 'Trạng thái'];

        return [
            'status_code' => $statusCode,
            'status_name_vi' => (string) $definition['status_name_vi'],
            'process_code' => $statusCode,
            'process_label' => (string) $definition['status_name_vi'],
            'group_code' => $group['group_code'],
            'group_label' => $group['group_label'],
            'table_name' => (string) $definition['table_name'],
            'default_status' => $statusCode,
            'read_roles' => [],
            'write_roles' => [],
            'allowed_next_processes' => array_map(
                static fn (array $row): string => (string) $row['to_status_code'],
                $this->allowedTransitionRows($statusCode, 'forward')
            ),
            'allowed_previous_processes' => array_map(
                static fn (array $row): string => (string) $row['to_status_code'],
                $this->allowedTransitionRows($statusCode, 'backward')
            ),
            'list_columns' => array_values($definition['list_columns'] ?? []),
            'form_fields' => [
                ['name' => 'received_at', 'label' => 'Ngày bắt đầu', 'type' => 'datetime', 'required' => false],
                ['name' => 'completed_at', 'label' => 'Ngày kết thúc', 'type' => 'datetime', 'required' => false],
                ['name' => 'extended_at', 'label' => 'Ngày gia hạn', 'type' => 'datetime', 'required' => false],
                ['name' => 'progress_percent', 'label' => 'Tiến độ phần trăm', 'type' => 'number', 'required' => false],
                ['name' => 'from_user_id', 'label' => 'Người chuyển', 'type' => 'user_select', 'required' => false],
                ['name' => 'to_user_id', 'label' => 'Người nhận', 'type' => 'user_select', 'required' => false],
                ['name' => 'notes', 'label' => 'Ghi chú', 'type' => 'textarea', 'required' => false],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTransitionStatusMeta(
        array $definition,
        ?CustomerRequestCase $case,
        ?string $fromStatusCode
    ): array {
        $meta = $this->serializeStatusMeta($definition);
        if ($case === null || $fromStatusCode === null) {
            return $meta;
        }

        return [
            ...$meta,
            ...$this->transitionEvaluator->buildDecisionMetadataForTransition($case, $fromStatusCode, (string) $definition['status_code']),
        ];
    }

    private function allowedTransitionRows(string $statusCode, ?string $direction = null): array
    {
        return $this->metadataService->getAllowedTransitions($statusCode, null, $direction);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedStatusDefinitions(string $statusCode, ?string $direction = null): array
    {
        return array_values(array_filter(array_map(
            fn (array $row): ?array => $this->metadataService->getStatusMeta(
                (string) ($row['to_status_code'] ?? ''),
                $this->support->parseNullableInt($row['workflow_definition_id'] ?? null)
            ),
            $this->allowedTransitionRows($statusCode, $direction)
        )));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedStatusDefinitionsForCase(
        ?CustomerRequestCase $case,
        string $statusCode,
        ?string $direction = null
    ): array {
        $workflowDefinitionId = $case?->workflow_definition_id;

        return array_values(array_filter(array_map(
            fn (array $row): ?array => $this->metadataService->getStatusMeta(
                (string) ($row['to_status_code'] ?? ''),
                $workflowDefinitionId
            ),
            $this->allowedTransitionRowsForCase($case, $statusCode, $direction)
        )));
    }

    private function assertTransitionAllowed(string $fromStatusCode, string $toStatusCode): void
    {
        if ($fromStatusCode === $toStatusCode) {
            throw new \RuntimeException('Không thể chuyển sang chính trạng thái hiện tại.');
        }

        if (! $this->isTransitionAllowed($fromStatusCode, $toStatusCode)) {
            throw new \RuntimeException('Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');
        }
    }

    private function isTransitionAllowed(string $fromStatusCode, string $toStatusCode): bool
    {
        if ($fromStatusCode === $toStatusCode) {
            return false;
        }

        return DB::table('customer_request_status_transitions')
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->where('is_active', 1)
            ->exists();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedTransitionRowsForCase(
        ?CustomerRequestCase $case,
        string $statusCode,
        ?string $direction = null
    ): array {
        $rows = $this->allowedTransitionRows($statusCode, $direction);

        if ($direction !== 'forward') {
            return $rows;
        }

        $allowedTargets = $this->resolveXmlAlignedAllowedTargets($case, $statusCode);
        if ($allowedTargets === null) {
            return $rows;
        }

        return $this->alignTransitionRowsWithWorkflowTargets($rows, $statusCode, $allowedTargets);
    }

    /**
     * @return array<int, string>|null
     */
    private function resolveXmlAlignedAllowedTargets(?CustomerRequestCase $case, string $statusCode): ?array
    {
        return CustomerRequestCaseRegistry::workflowaAllowedTargets($this->normalizeWorkflowStatusCode($statusCode));
    }

    private function normalizeWorkflowStatusCode(string $statusCode): string
    {
        return match ($statusCode) {
            'pending_dispatch', 'dispatched' => 'new_intake',
            default => $statusCode,
        };
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array<int, string> $allowedTargets
     * @return array<int, array<string, mixed>>
     */
    private function alignTransitionRowsWithWorkflowTargets(array $rows, string $fromStatusCode, array $allowedTargets): array
    {
        $rowsByTarget = [];
        foreach ($rows as $row) {
            $toStatusCode = (string) ($row['to_status_code'] ?? '');
            if ($toStatusCode === '') {
                continue;
            }

            $rowsByTarget[$toStatusCode] = $row;
        }

        $aligned = [];
        foreach ($allowedTargets as $index => $toStatusCode) {
            $existing = $rowsByTarget[$toStatusCode] ?? null;
            if ($existing !== null) {
                $aligned[] = $existing;
                continue;
            }

            $aligned[] = [
                'from_status_code' => $fromStatusCode,
                'to_status_code' => $toStatusCode,
                'direction' => 'forward',
                'is_default' => $index === 0,
                'is_active' => 1,
                'sort_order' => ($index + 1) * 10,
                'notes' => 'WorkflowA fallback target injection',
            ];
        }

        return $aligned;
    }

    private function isTransitionAllowedForCase(
        ?CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): bool {
        if ($fromStatusCode === $toStatusCode) {
            return false;
        }

        foreach ($this->allowedTransitionRowsForCase($case, $fromStatusCode, 'forward') as $row) {
            if ((string) ($row['to_status_code'] ?? '') === $toStatusCode) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDecisionMetadataForTransition(
        CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): array {
        return $this->transitionEvaluator->buildDecisionMetadataForTransition($case, $fromStatusCode, $toStatusCode);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildPmMissingCustomerInfoDecisionAction(
        CustomerRequestCase $case,
        string $currentStatusCode,
        bool $enabled
    ): ?array {
        return $this->transitionEvaluator->buildPmMissingCustomerInfoDecisionAction($case, $currentStatusCode, $enabled);
    }


    /**
     * @return array<string, mixed>
     */
    private function serializeTimelineRow(object $row): array
    {
        $decisionContextCode = $this->normalizeNullableString($row->decision_context_code ?? null);
        $decisionOutcomeCode = $this->normalizeNullableString($row->decision_outcome_code ?? null);
        [$fromUserId, $fromUserName, $ownerUserId, $ownerName] = $this->resolveTimelineTransferSnapshot($row);

        return [
            'id' => (int) $row->id,
            'request_case_id' => isset($row->request_case_id) ? (int) $row->request_case_id : null,
            'status_code' => (string) $row->status_code,
            'status_name_vi' => $this->normalizeNullableString($row->status_name_vi ?? null) ?? (string) $row->status_code,
            'status_table' => $this->normalizeNullableString($row->status_table ?? null),
            'status_row_id' => $this->support->parseNullableInt($row->status_row_id ?? null),
            'previous_instance_id' => $this->support->parseNullableInt($row->previous_instance_id ?? null),
            'next_instance_id' => $this->support->parseNullableInt($row->next_instance_id ?? null),
            'decision_context_code' => $decisionContextCode,
            'decision_outcome_code' => $decisionOutcomeCode,
            'decision_source_status_code' => $this->normalizeNullableString($row->decision_source_status_code ?? null),
            'decision_reason_label' => $this->resolveDecisionReasonLabel($decisionContextCode, $decisionOutcomeCode),
            'entered_at' => $this->normalizeNullableString($row->entered_at ?? null),
            'exited_at' => $this->normalizeNullableString($row->exited_at ?? null),
            'created_at' => $this->normalizeNullableString($row->created_at ?? null),
            'is_current' => isset($row->is_current) ? (bool) $row->is_current : false,
            'created_by' => $this->support->parseNullableInt($row->created_by ?? null),
            'updated_by' => $this->support->parseNullableInt($row->updated_by ?? null),
            'changed_by_name' => $this->normalizeNullableString($row->changed_by_name ?? null),
            'changed_by_code' => $this->normalizeNullableString($row->changed_by_code ?? null),
            'previous_status_name_vi' => $this->normalizeNullableString($row->previous_status_name_vi ?? null),
            'tien_trinh' => (string) $row->status_code,
            'tien_trinh_id' => $this->support->parseNullableInt($row->status_row_id ?? null),
            'trang_thai_cu' => $this->normalizeNullableString($row->previous_status_name_vi ?? null),
            'trang_thai_moi' => $this->normalizeNullableString($row->status_name_vi ?? null) ?? (string) $row->status_code,
            'nguoi_thay_doi_id' => $this->support->parseNullableInt($row->created_by ?? null),
            'nguoi_thay_doi_name' => $this->normalizeNullableString($row->changed_by_name ?? null),
            'nguoi_thay_doi_code' => $this->normalizeNullableString($row->changed_by_code ?? null),
            'nguoi_chuyen_id' => $fromUserId,
            'nguoi_chuyen_name' => $fromUserName,
            'nguoi_xu_ly_id' => $ownerUserId,
            'nguoi_xu_ly_name' => $ownerName,
            'ly_do' => $this->resolveDecisionReasonLabel($decisionContextCode, $decisionOutcomeCode),
            'thay_doi_luc' => $this->normalizeNullableString($row->entered_at ?? null) ?? $this->normalizeNullableString($row->created_at ?? null),
        ];
    }

    /**
     * @return array{0:int|null,1:string|null,2:int|null,3:string|null}
     */
    private function resolveTimelineTransferSnapshot(object $row): array
    {
        $statusTable = $this->normalizeNullableString($row->status_table ?? null);
        $statusRowId = $this->support->parseNullableInt($row->status_row_id ?? null);

        if ($statusTable === null || $statusRowId === null || ! $this->support->hasTable($statusTable)) {
            return [null, null, null, null];
        }

        $statusRow = DB::table($statusTable)
            ->where('id', $statusRowId)
            ->first();

        if ($statusRow === null) {
            return [null, null, null, null];
        }

        $fromUserId = $this->support->parseNullableInt($statusRow->from_user_id ?? null);
        $ownerUserId = $this->support->parseNullableInt($statusRow->to_user_id ?? null)
            ?? $this->support->parseNullableInt($statusRow->performer_user_id ?? null);

        if (! $this->support->hasTable('internal_users')) {
            return [$fromUserId, null, $ownerUserId, null];
        }

        $fromUserName = $fromUserId === null
            ? null
            : $this->normalizeNullableString(DB::table('internal_users')->where('id', $fromUserId)->value('full_name'));

        $ownerName = $ownerUserId === null
            ? null
            : $this->normalizeNullableString(DB::table('internal_users')->where('id', $ownerUserId)->value('full_name'));

        return [$fromUserId, $fromUserName, $ownerUserId, $ownerName];
    }

    private function resolveDecisionReasonLabel(?string $contextCode, ?string $outcomeCode): ?string
    {
        if ($contextCode !== self::PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE) {
            return null;
        }

        return match ($outcomeCode) {
            self::PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO => 'PM xác nhận yêu cầu đang thiếu thông tin từ khách hàng.',
            self::PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON => 'PM xác nhận yêu cầu không thực hiện vì lý do khác, không phải thiếu thông tin từ khách hàng.',
            default => null,
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadRefTasksForInstance(int $statusInstanceId): array
    {
        if (! $this->support->hasTable('customer_request_status_ref_tasks') || ! $this->support->hasTable('request_ref_tasks')) {
            return [];
        }

        $query = DB::table('customer_request_status_ref_tasks as pivot')
            ->join('request_ref_tasks as task', 'task.id', '=', 'pivot.ref_task_id')
            ->where('pivot.status_instance_id', $statusInstanceId)
            ->orderBy('pivot.id');

        if ($this->support->hasColumn('request_ref_tasks', 'deleted_at')) {
            $query->whereNull('task.deleted_at');
        }

        return $query
            ->select(array_values(array_filter([
                'pivot.id as pivot_id',
                'task.id',
                $this->support->hasColumn('request_ref_tasks', 'request_code') ? 'task.request_code' : null,
                $this->support->hasColumn('request_ref_tasks', 'task_code') ? 'task.task_code' : null,
                $this->support->hasColumn('request_ref_tasks', 'task_link') ? 'task.task_link' : null,
                $this->support->hasColumn('request_ref_tasks', 'task_source') ? 'task.task_source' : null,
                $this->support->hasColumn('request_ref_tasks', 'task_status') ? 'task.task_status' : null,
                $this->support->hasColumn('request_ref_tasks', 'task_note') ? 'task.task_note' : null,
                $this->support->hasColumn('request_ref_tasks', 'sort_order') ? 'task.sort_order' : null,
            ])))
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'pivot_id' => (int) $row->pivot_id,
                'request_code' => $this->normalizeNullableString($row->request_code ?? null),
                'task_code' => $this->normalizeNullableString($row->task_code ?? null),
                'task_link' => $this->normalizeNullableString($row->task_link ?? null),
                'task_source' => $this->normalizeNullableString($row->task_source ?? null),
                'task_status' => $this->normalizeNullableString($row->task_status ?? null),
                'task_note' => $this->normalizeNullableString($row->task_note ?? null),
                'sort_order' => isset($row->sort_order) ? (int) $row->sort_order : null,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadAttachmentsForInstance(int $statusInstanceId): array
    {
        if (! $this->support->hasTable('customer_request_status_attachments') || ! $this->support->hasTable('attachments')) {
            return [];
        }

        $query = DB::table('customer_request_status_attachments as pivot')
            ->join('attachments as a', 'a.id', '=', 'pivot.attachment_id')
            ->where('pivot.status_instance_id', $statusInstanceId)
            ->orderBy('pivot.id');

        if ($this->support->hasColumn('attachments', 'deleted_at')) {
            $query->whereNull('a.deleted_at');
        }

        return $query
            ->select(array_values(array_filter([
                'a.id',
                $this->support->hasColumn('attachments', 'file_name') ? 'a.file_name' : null,
                $this->support->hasColumn('attachments', 'file_url') ? 'a.file_url' : null,
                $this->support->hasColumn('attachments', 'drive_file_id') ? 'a.drive_file_id' : null,
                $this->support->hasColumn('attachments', 'file_size') ? 'a.file_size' : null,
                $this->support->hasColumn('attachments', 'mime_type') ? 'a.mime_type' : null,
                $this->support->hasColumn('attachments', 'storage_disk') ? 'a.storage_disk' : null,
                $this->support->hasColumn('attachments', 'storage_path') ? 'a.storage_path' : null,
                $this->support->hasColumn('attachments', 'storage_visibility') ? 'a.storage_visibility' : null,
                $this->support->hasColumn('attachments', 'created_at') ? 'a.created_at' : null,
            ])))
            ->get()
            ->map(fn (object $row): array => [
                'id' => (string) $row->id,
                'fileName' => $this->normalizeNullableString($row->file_name ?? null) ?? '',
                'fileUrl' => $this->normalizeNullableString($row->file_url ?? null),
                'driveFileId' => $this->normalizeNullableString($row->drive_file_id ?? null),
                'fileSize' => isset($row->file_size) ? (int) $row->file_size : 0,
                'mimeType' => $this->normalizeNullableString($row->mime_type ?? null) ?? 'application/octet-stream',
                'storageDisk' => $this->normalizeNullableString($row->storage_disk ?? null),
                'storagePath' => $this->normalizeNullableString($row->storage_path ?? null),
                'storageVisibility' => $this->normalizeNullableString($row->storage_visibility ?? null),
                'createdAt' => $this->normalizeNullableString($row->created_at ?? null),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadWorklogsForInstance(int $statusInstanceId): array
    {
        return $this->readModelService->loadWorklogsForInstance($statusInstanceId);
    }

    private function resolveActorId(Request $request): ?int
    {
        return $this->readQueryService->resolveActorId($request);
    }

    private function normalizeDateTime(mixed $value): ?string
    {
        return $this->readQueryService->normalizeDateTime($value);
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    private function normalizeNullableDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function currentStatusInstance(CustomerRequestCase $case): ?CustomerRequestStatusInstance
    {
        $instanceId = $this->support->parseNullableInt($case->current_status_instance_id);
        if ($instanceId !== null) {
            return CustomerRequestStatusInstance::query()->find($instanceId);
        }

        return CustomerRequestStatusInstance::query()
            ->where('request_case_id', $case->id)
            ->where('is_current', 1)
            ->orderByDesc('id')
            ->first();
    }

    private function findStatusInstanceForCase(int $caseId, string $statusCode, bool $currentOnly): ?CustomerRequestStatusInstance
    {
        $query = CustomerRequestStatusInstance::query()
            ->where('request_case_id', $caseId)
            ->where('status_code', $statusCode);

        if ($currentOnly) {
            $query->where('is_current', 1);
        }

        return $query
            ->orderByDesc('entered_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadStatusRow(string $table, mixed $rowId): ?array
    {
        return $this->readModelService->loadStatusRow($table, $rowId);
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $statusRow
     * @return array<string, mixed>
     */
    private function serializeStatusRow(array $statusDefinition, array $statusRow): array
    {
        return $this->readModelService->serializeStatusRow($statusDefinition, $statusRow);
    }

    /**
     * @param array<string, mixed> $case
     * @param array<string, mixed>|null $statusRow
     * @return array<string, mixed>
     */
    private function buildListValues(array $statusDefinition, array $case, ?array $statusRow): array
    {
        return $this->readModelService->buildListValues($statusDefinition, $case, $statusRow);
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeCaseRow(object|array $row): array
    {
        return $this->readModelService->serializeCaseRow($row);
    }

    private function serializeSimpleCaseRow(object|array $row): array
    {
        $case = $this->serializeCaseRow($row);

        return [
            'id' => $case['id'] ?? 0,
            'request_code' => $case['request_code'] ?? '',
            'ma_yc' => $case['ma_yc'] ?? ($case['request_code'] ?? ''),
            'summary' => $case['summary'] ?? '',
            'tieu_de' => $case['tieu_de'] ?? ($case['summary'] ?? ''),
            'current_status_code' => $case['current_status_code'] ?? null,
            'current_status_name_vi' => $case['current_status_name_vi'] ?? null,
            'current_process_label' => $case['current_process_label'] ?? null,
            'trang_thai' => $case['trang_thai'] ?? null,
            'tien_trinh_hien_tai' => $case['tien_trinh_hien_tai'] ?? null,
            'priority' => $case['priority'] ?? 2,
            'do_uu_tien' => $case['do_uu_tien'] ?? ($case['priority'] ?? 2),
            'project_name' => $case['project_name'] ?? null,
            'customer_name' => $case['customer_name'] ?? null,
            'khach_hang_name' => $case['khach_hang_name'] ?? ($case['customer_name'] ?? null),
            'received_by_name' => $case['received_by_name'] ?? null,
            'dispatcher_name' => $case['dispatcher_name'] ?? null,
            'performer_name' => $case['performer_name'] ?? null,
            'receiver_user_id' => $case['receiver_user_id'] ?? null,
            'receiver_name' => $case['receiver_name'] ?? null,
            'from_user_id_name' => $case['from_user_id_name'] ?? null,
            'to_user_id_name' => $case['to_user_id_name'] ?? null,
            'current_entered_at' => $case['current_entered_at'] ?? null,
            'current_exited_at' => $case['current_exited_at'] ?? null,
            'previous_status_instance_id' => $case['previous_status_instance_id'] ?? null,
            'next_status_instance_id' => $case['next_status_instance_id'] ?? null,
            'current_started_at' => $case['current_started_at'] ?? null,
            'current_expected_completed_at' => $case['current_expected_completed_at'] ?? null,
            'current_completed_at' => $case['current_completed_at'] ?? null,
            'current_status_notes' => $case['current_status_notes'] ?? null,
            'current_progress_percent' => $case['current_progress_percent'] ?? 0,
            'nguoi_xu_ly_id' => $case['nguoi_xu_ly_id'] ?? null,
            'nguoi_xu_ly_name' => $case['nguoi_xu_ly_name'] ?? null,
            'created_by_name' => $case['created_by_name'] ?? null,
            'updated_at' => $case['updated_at'] ?? null,
            'created_at' => $case['created_at'] ?? null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildRelatedPeople(CustomerRequestCase $case): array
    {
        return $this->readModelService->buildRelatedPeople($case);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCaseModel(CustomerRequestCase $case): array
    {
        return $this->readModelService->serializeCaseModel($case);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStatusInstance(CustomerRequestStatusInstance $instance): array
    {
        return $this->readModelService->serializeStatusInstance($instance);
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeWorklogRow(object|array $row): array
    {
        return $this->readModelService->serializeWorklogRow($row);
    }

    private function applyCaseFilters(QueryBuilder $query, Request $request, ?int $actorId, bool $skipStatusFilter): void
    {
        $this->readQueryService->applyCaseFilters($query, $request, $actorId, $skipStatusFilter);
    }

    private function applyKeywordSearch(QueryBuilder $query, string $keyword): void
    {
        $this->readQueryService->applyKeywordSearch($query, $keyword);
    }

    private function resolveBooleanInput(mixed $value, ?bool $default = null): ?bool
    {
        return $this->readQueryService->resolveBooleanInput($value, $default);
    }

    private function normalizeNullableDate(mixed $value): ?string
    {
        return $this->readQueryService->normalizeNullableDate($value);
    }

    private function loadEstimatesForCase(int $caseId): array
    {
        return $this->executionService->loadEstimatesForCase($caseId);
    }

    private function buildHoursReportPayload(mixed $case): array
    {
        return $this->executionService->buildHoursReportPayload($case);
    }

    private function loadAttachmentAggregateForCase(int $caseId): array
    {
        return $this->readModelService->loadAttachmentAggregateForCase($caseId);
    }

    private function buildSearchItem(array $case): array
    {
        return $this->readModelService->buildSearchItem($case);
    }

    private function buildAvailableActions(CustomerRequestCase $case, ?int $userId): array
    {
        $canWrite = $this->canWriteCase($case, $userId);
        $currentStatusCode = (string) ($case->current_status_code ?? '');

        return [
            'can_write' => $canWrite,
            'can_transition' => $canWrite && $currentStatusCode !== '',
            'can_transition_backward' => $canWrite && $this->allowedStatusDefinitionsForCase($case, $currentStatusCode, 'backward') !== [],
            'can_transition_forward' => $canWrite && $this->allowedStatusDefinitionsForCase($case, $currentStatusCode, 'forward') !== [],
            'can_add_worklog' => $canWrite,
            'can_add_estimate' => $canWrite,
            'can_delete' => $userId === null ? true : $this->userAccess->isAdmin($userId),
            'pm_missing_customer_info_decision' => $this->buildPmMissingCustomerInfoDecisionAction(
                $case,
                $currentStatusCode,
                $canWrite
            ),
        ];
    }

    /**
     * @return Builder<\App\Models\CustomerRequestCase>
     */
    private function caseModelQuery(): Builder
    {
        return CustomerRequestCase::query()->whereNull('deleted_at');
    }

    private function findAccessibleCaseModel(int $id, ?int $userId): ?CustomerRequestCase
    {
        $query = $this->caseModelQuery()->whereKey($id);

        if ($userId !== null && ! $this->userAccess->isAdmin($userId)) {
            $projectIds = $this->projectIdsForUserByRaciRoles($userId);
            $query->where(function (Builder $builder) use ($userId, $projectIds): void {
                $builder
                    ->where('created_by', $userId)
                    ->orWhere('received_by_user_id', $userId);

                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $builder->orWhere('dispatcher_user_id', $userId);
                }

                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $builder->orWhere('performer_user_id', $userId);
                }

                if ($projectIds !== []) {
                    $builder->orWhereIn('project_id', $projectIds);
                }
            });
        }

        return $query->first();
    }

    private function canWriteCase(CustomerRequestCase $case, ?int $userId): bool
    {
        if ($userId === null) {
            return true;
        }

        if ($this->userAccess->isAdmin($userId)) {
            return true;
        }

        $allowedUserIds = array_filter([
            $this->support->parseNullableInt($case->created_by),
            $this->support->parseNullableInt($case->received_by_user_id),
            $this->support->parseNullableInt($case->dispatcher_user_id),
            $this->support->parseNullableInt($case->performer_user_id),
        ]);

        if (in_array($userId, $allowedUserIds, true)) {
            return true;
        }

        $projectId = $this->support->parseNullableInt($case->project_id);

        return $projectId !== null && in_array($projectId, $this->projectIdsForUserByRaciRoles($userId), true);
    }

    private function authorizeCaseMutationScope(CustomerRequestCase $case, ?int $actorId, string $message): ?JsonResponse
    {
        if ($actorId === null || $this->userAccess->isAdmin($actorId)) {
            return null;
        }

        $departmentId = $this->support->resolveDepartmentIdForTableRecord('customer_request_cases', [
            'project_id' => $this->support->parseNullableInt($case->project_id),
        ]);
        if ($departmentId === null) {
            return null;
        }

        $allowedDepartmentIds = $this->userAccess->resolveDepartmentIdsForUser($actorId);
        if ($allowedDepartmentIds === null || in_array($departmentId, $allowedDepartmentIds, true)) {
            return null;
        }

        return response()->json(['message' => $message], 403);
    }

    private function baseCaseQuery(?int $userId)
    {
        return $this->readQueryService->baseCaseQuery($userId);
    }

    private function projectIdsForUserByRaciRoles(int $userId, array $roles = ['A', 'R']): array
    {
        return $this->readQueryService->projectIdsForUserByRaciRoles($userId, $roles);
    }

    private function slaDueAtExpression(): string
    {
        return $this->readQueryService->slaDueAtExpression();
    }

    private function missingTablesResponse(): ?JsonResponse
    {
        return $this->readQueryService->missingTablesResponse();
    }

    private function isMasterBackedStatus(array $statusDefinition): bool
    {
        return (string) ($statusDefinition['table_name'] ?? '') === 'customer_request_cases';
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
}
