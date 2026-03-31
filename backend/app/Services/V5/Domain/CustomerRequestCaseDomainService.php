<?php

namespace App\Services\V5\Domain;

use App\Actions\V5\CustomerRequest\TransitionCaseAction;
use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\CustomerRequest\CustomerRequestCaseDashboardService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseExecutionService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseReadModelService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseReadQueryService;
use App\Services\V5\CustomerRequest\CustomerRequestCaseWriteService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        'waiting_customer_feedback' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'analysis' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'returned_to_manager' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'in_progress' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'coding' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'dms_transfer' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'completed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'customer_notified' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'not_executed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess,
        private readonly CustomerRequestCaseDashboardService $dashboardService,
        private readonly CustomerRequestCaseExecutionService $executionService,
        private readonly CustomerRequestCaseReadQueryService $readQueryService,
        private readonly CustomerRequestCaseReadModelService $readModelService,
        private readonly CustomerRequestCaseWriteService $writeService,
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

        $groups = [];
        foreach (CustomerRequestCaseRegistry::all() as $definition) {
            $statusCode = (string) $definition['status_code'];
            $group = $this->statusGroups[$statusCode] ?? ['group_code' => 'statuses', 'group_label' => 'Trạng thái'];
            $groupKey = $group['group_code'];
            if (! isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'group_code' => $group['group_code'],
                    'group_label' => $group['group_label'],
                    'processes' => [],
                ];
            }

            $groups[$groupKey]['processes'][] = [
                ...$this->serializeStatusMeta($definition),
                'active_count' => (int) ($counts[$statusCode] ?? 0),
            ];
        }

        return response()->json([
            'data' => [
                'master_fields' => CustomerRequestCaseRegistry::masterFields(),
                'groups' => array_values($groups),
                'statuses' => array_values(array_map(
                    fn (array $definition): array => [
                        ...$this->serializeStatusMeta($definition),
                        'active_count' => (int) ($counts[$definition['status_code']] ?? 0),
                    ],
                    CustomerRequestCaseRegistry::catalog()
                )),
            ],
        ]);
    }

    public function statusTransitions(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $rows = DB::table('customer_request_status_transitions')
            ->where('is_active', 1)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'from_status_code' => (string) $row->from_status_code,
                'to_status_code' => (string) $row->to_status_code,
                'direction' => (string) $row->direction,
                'is_default' => (bool) $row->is_default,
                'is_active' => (bool) $row->is_active,
                'sort_order' => (int) $row->sort_order,
                'notes' => $this->normalizeNullableString($row->notes ?? null),
                'from_status' => $this->serializeStatusMeta(CustomerRequestCaseRegistry::find((string) $row->from_status_code) ?? [
                    'status_code' => (string) $row->from_status_code,
                    'status_name_vi' => (string) $row->from_status_code,
                    'table_name' => '',
                    'list_columns' => [],
                    'form_fields' => [],
                ]),
                'to_status' => $this->serializeStatusMeta(CustomerRequestCaseRegistry::find((string) $row->to_status_code) ?? [
                    'status_code' => (string) $row->to_status_code,
                    'status_name_vi' => (string) $row->to_status_code,
                    'table_name' => '',
                    'list_columns' => [],
                    'form_fields' => [],
                ]),
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

        $statusDefinition = CustomerRequestCaseRegistry::find($statusCode);
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
        return $this->dashboardService->dashboardCreator(
            $request,
            fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function dashboardDispatcher(Request $request): JsonResponse
    {
        return $this->dashboardService->dashboardDispatcher(
            $request,
            fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function dashboardPerformer(Request $request): JsonResponse
    {
        return $this->dashboardService->dashboardPerformer(
            $request,
            fn (object|array $row): array => $this->serializeCaseRow($row)
        );
    }

    public function performerWeeklyTimesheet(Request $request): JsonResponse
    {
        return $this->dashboardService->performerWeeklyTimesheet(
            $request,
            fn (object|array $row): array => $this->serializeWorklogRow($row)
        );
    }

    public function dashboardOverview(Request $request): JsonResponse
    {
        return $this->dashboardService->dashboardOverview(
            $request,
            fn (object|array $row): array => $this->serializeCaseRow($row)
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

        if (CustomerRequestCaseRegistry::find($statusCode) === null) {
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
        return $this->transitionCaseAction->execute(
            $request,
            $id,
            fn (CustomerRequestCase $case, string $statusCode, ?int $userId): array => $this->buildStatusDetailData(
                $case,
                $statusCode,
                $userId
            )
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->writeService->destroy($request, $id);
    }

    private function buildStatusDetailData(CustomerRequestCase $case, string $statusCode, ?int $userId): array
    {
        $requestedDefinition = CustomerRequestCaseRegistry::find($statusCode);
        $currentDefinition = CustomerRequestCaseRegistry::find((string) $case->current_status_code);
        $requestedInstance = $statusCode === $case->current_status_code
            ? $this->currentStatusInstance($case)
            : $this->findStatusInstanceForCase((int) $case->id, $statusCode, false);
        $statusRow = $requestedDefinition !== null && $requestedInstance !== null
            ? $this->loadStatusRow((string) $requestedDefinition['table_name'], $requestedInstance->status_row_id)
            : null;
        $serializedCase = $this->serializeCaseModel($case);
        $allowedNext = $currentDefinition === null
            ? []
            : array_values(array_map(
                fn (array $definition): array => $this->serializeTransitionStatusMeta(
                    $definition,
                    $case,
                    (string) $currentDefinition['status_code']
                ),
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

            'current_status' => $currentDefinition === null ? null : $this->serializeStatusMeta($currentDefinition),
            'current_process' => $currentDefinition === null ? null : $this->serializeStatusMeta($currentDefinition),
            'status' => $requestedDefinition === null ? null : $this->serializeStatusMeta($requestedDefinition),
            'process' => $requestedDefinition === null ? null : $this->serializeStatusMeta($requestedDefinition),
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
            'form_fields' => array_values($definition['form_fields'] ?? []),
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
            ...$this->buildDecisionMetadataForTransition($case, $fromStatusCode, (string) $definition['status_code']),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedTransitionRows(string $statusCode, ?string $direction = null): array
    {
        $query = DB::table('customer_request_status_transitions')
            ->where('from_status_code', $statusCode)
            ->where('is_active', 1);

        if ($direction !== null) {
            $query->where('direction', $direction);
        }

        return $query
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedStatusDefinitions(string $statusCode, ?string $direction = null): array
    {
        $definitions = [];
        foreach ($this->allowedTransitionRows($statusCode, $direction) as $row) {
            $definition = CustomerRequestCaseRegistry::find((string) ($row['to_status_code'] ?? ''));
            if ($definition !== null) {
                $definitions[] = $definition;
            }
        }

        return $definitions;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allowedStatusDefinitionsForCase(
        ?CustomerRequestCase $case,
        string $statusCode,
        ?string $direction = null
    ): array {
        $definitions = [];
        foreach ($this->allowedTransitionRowsForCase($case, $statusCode, $direction) as $row) {
            $definition = CustomerRequestCaseRegistry::find((string) ($row['to_status_code'] ?? ''));
            if ($definition !== null) {
                $definitions[] = $definition;
            }
        }

        return $definitions;
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

        return array_values(array_filter(
            $rows,
            static fn (array $row): bool => in_array((string) ($row['to_status_code'] ?? ''), $allowedTargets, true)
        ));
    }

    /**
     * @return array<int, string>|null
     */
    private function resolveXmlAlignedAllowedTargets(?CustomerRequestCase $case, string $statusCode): ?array
    {
        if ($statusCode === 'new_intake') {
            return $case === null ? null : $this->resolveNewIntakeAllowedTargets($case);
        }

        if ($statusCode === 'in_progress') {
            return ['completed'];
        }

        return null;
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
     * @return array<int, string>
     */
    private function resolveNewIntakeAllowedTargets(CustomerRequestCase $case): array
    {
        return $this->resolveNewIntakeLane($case) === 'performer'
            ? ['in_progress', 'returned_to_manager']
            : ['not_executed', 'waiting_customer_feedback', 'in_progress', 'analysis'];
    }

    private function resolveNewIntakeLane(CustomerRequestCase $case): string
    {
        $dispatchRoute = trim((string) ($case->dispatch_route ?? ''));
        $hasPerformer = $this->support->parseNullableInt($case->performer_user_id) !== null;

        if ($dispatchRoute === 'self_handle' || $dispatchRoute === 'assign_direct') {
            return 'performer';
        }

        if ($dispatchRoute === 'assign_pm') {
            return $hasPerformer ? 'performer' : 'dispatcher';
        }

        return $hasPerformer ? 'performer' : 'dispatcher';
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDecisionMetadataForTransition(
        CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): array {
        if (! in_array($toStatusCode, ['waiting_customer_feedback', 'not_executed'], true)) {
            return [];
        }

        $isDispatcherNewIntake = $fromStatusCode === 'new_intake' && $this->resolveNewIntakeLane($case) === 'dispatcher';
        $isReturnedToManagerReview = $fromStatusCode === 'returned_to_manager';

        if (! $isDispatcherNewIntake && ! $isReturnedToManagerReview) {
            return [];
        }

        return [
            'decision_context_code' => self::PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE,
            'decision_outcome_code' => $toStatusCode === 'waiting_customer_feedback'
                ? self::PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO
                : self::PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON,
            'decision_source_status_code' => $fromStatusCode,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildPmMissingCustomerInfoDecisionAction(
        CustomerRequestCase $case,
        string $currentStatusCode,
        bool $enabled
    ): ?array {
        $targets = [];
        foreach (['waiting_customer_feedback', 'not_executed'] as $targetStatusCode) {
            if ($this->buildDecisionMetadataForTransition($case, $currentStatusCode, $targetStatusCode) !== []) {
                $targets[] = $targetStatusCode;
            }
        }

        if ($targets === []) {
            return null;
        }

        return [
            'enabled' => $enabled,
            'context_code' => self::PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE,
            'source_status_code' => $currentStatusCode,
            'target_status_codes' => $targets,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTimelineRow(object $row): array
    {
        $decisionContextCode = $this->normalizeNullableString($row->decision_context_code ?? null);
        $decisionOutcomeCode = $this->normalizeNullableString($row->decision_outcome_code ?? null);

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
            'ly_do' => $this->resolveDecisionReasonLabel($decisionContextCode, $decisionOutcomeCode),
            'thay_doi_luc' => $this->normalizeNullableString($row->entered_at ?? null) ?? $this->normalizeNullableString($row->created_at ?? null),
        ];
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
    private function filterByTableColumns(string $table, array $payload): array
    {
        return $this->writeService->filterByTableColumns($table, $payload);
    }
}
