<?php

namespace App\Services\V5\Domain;

use App\Models\CustomerRequestCase;
use App\Models\CustomerRequestStatusInstance;
use App\Models\CustomerRequestWorklog;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CustomerRequestCaseDomainService
{
    /**
     * @var array<string, array<int, string>>
     */
    private array $tableColumns = [];

    /**
     * @var array<string, string|null>
     */
    private array $lookupCache = [];

    /**
     * @var array<string, array<int, int>>
     */
    private array $projectScopeCache = [];

    /**
     * @var array<string, array{group_code:string,group_label:string}>
     */
    private array $statusGroups = [
        'new_intake' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'waiting_customer_feedback' => ['group_code' => 'intake', 'group_label' => 'Tiếp nhận'],
        'analysis' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'returned_to_manager' => ['group_code' => 'analysis', 'group_label' => 'Phân tích'],
        'in_progress' => ['group_code' => 'processing', 'group_label' => 'Xử lý'],
        'completed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'customer_notified' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
        'not_executed' => ['group_code' => 'closure', 'group_label' => 'Kết quả'],
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess
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
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        [$masterPayload, $masterErrors] = $this->normalizeMasterPayload($request, true);
        if ($masterErrors !== []) {
            return response()->json(['message' => 'Dữ liệu yêu cầu không hợp lệ.', 'errors' => $masterErrors], 422);
        }

        $statusDefinition = CustomerRequestCaseRegistry::find('new_intake');
        if ($statusDefinition === null) {
            return response()->json(['message' => 'Thiếu cấu hình trạng thái mở đầu.'], 500);
        }

        $actorId = $this->resolveActorId($request);
        $statusSource = $this->extractStatusPayload($request);
        [$statusPayload, $statusErrors] = $this->normalizeStatusPayload($statusDefinition, $statusSource, null, $actorId);
        if ($statusErrors !== []) {
            return response()->json(['message' => 'Dữ liệu trạng thái không hợp lệ.', 'errors' => $statusErrors], 422);
        }

        $createdCase = DB::transaction(function () use ($masterPayload, $statusDefinition, $statusPayload, $actorId, $request): CustomerRequestCase {
            $receivedAt = now()->format('Y-m-d H:i:s');
            $receivedByUserId = $actorId;
            $requestCase = new CustomerRequestCase();
            $requestCase->fill([
                ...$masterPayload,
                'request_code' => $this->generateRequestCode(),
                'current_status_code' => (string) $statusDefinition['status_code'],
                'received_at' => $receivedAt,
                'received_by_user_id' => $receivedByUserId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'current_status_changed_at' => now()->format('Y-m-d H:i:s'),
            ]);
            $requestCase->requester_name_snapshot = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($requestCase->customer_personnel_id),
                $masterPayload['requester_name_snapshot'] ?? null
            );
            $requestCase->save();

            $transition = $this->createStatusInstanceAndRow(
                $requestCase,
                $statusDefinition,
                $statusPayload,
                $actorId,
                null
            );

            $this->syncCaseCurrentStatus($requestCase, $statusDefinition, $transition['instance_id'], $statusPayload, $actorId);
            $this->syncCurrentStatusRelations(
                (int) $requestCase->id,
                $transition['instance_id'],
                $request,
                $actorId
            );
            $requestCase->save();
            $this->appendAuditLog(
                'INSERT',
                'customer_request_cases',
                (int) $requestCase->id,
                null,
                $this->serializeCaseModel($requestCase),
                $actorId
            );

            return $requestCase->fresh() ?? $requestCase;
        });

        $detail = $this->buildStatusDetailData(
            $createdCase,
            (string) $createdCase->current_status_code,
            $this->resolveActorId($request)
        );

        return response()->json(['data' => $detail], 201);
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
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'request_case_id' => (int) $row->request_case_id,
                'status_code' => (string) $row->status_code,
                'status_name_vi' => $this->normalizeNullableString($row->status_name_vi) ?? (string) $row->status_code,
                'status_table' => (string) $row->status_table,
                'status_row_id' => $this->support->parseNullableInt($row->status_row_id),
                'previous_instance_id' => $this->support->parseNullableInt($row->previous_instance_id),
                'next_instance_id' => $this->support->parseNullableInt($row->next_instance_id),
                'entered_at' => $this->normalizeNullableString($row->entered_at),
                'exited_at' => $this->normalizeNullableString($row->exited_at),
                'is_current' => (bool) $row->is_current,
                'created_by' => $this->support->parseNullableInt($row->created_by),
                'updated_by' => $this->support->parseNullableInt($row->updated_by),
                'changed_by_name' => $this->normalizeNullableString($row->changed_by_name),
                'changed_by_code' => $this->normalizeNullableString($row->changed_by_code),
                'previous_status_name_vi' => $this->normalizeNullableString($row->previous_status_name_vi),
                'tien_trinh' => (string) $row->status_code,
                'tien_trinh_id' => $this->support->parseNullableInt($row->status_row_id),
                'trang_thai_cu' => $this->normalizeNullableString($row->previous_status_name_vi),
                'trang_thai_moi' => $this->normalizeNullableString($row->status_name_vi) ?? (string) $row->status_code,
                'nguoi_thay_doi_id' => $this->support->parseNullableInt($row->created_by),
                'nguoi_thay_doi_name' => $this->normalizeNullableString($row->changed_by_name),
                'nguoi_thay_doi_code' => $this->normalizeNullableString($row->changed_by_code),
                'ly_do' => null,
                'thay_doi_luc' => $this->normalizeNullableString($row->entered_at) ?? $this->normalizeNullableString($row->created_at),
            ])
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

        $rows = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.request_case_id', $case->id)
            ->when(
                $this->support->hasColumn('customer_request_worklogs', 'work_date'),
                fn (QueryBuilder $query) => $query->orderByDesc('wl.work_date'),
                fn (QueryBuilder $query) => $query->orderByDesc('wl.work_started_at')
            )
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->get()
            ->map(fn (object $row): array => $this->serializeWorklogRow($row))
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
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

        if (! $this->support->hasTable('customer_request_estimates')) {
            return $this->support->missingTable('customer_request_estimates');
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        return response()->json([
            'data' => $this->loadEstimatesForCase((int) $case->id),
        ]);
    }

    public function storeEstimate(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        if (! $this->support->hasTable('customer_request_estimates')) {
            return $this->support->missingTable('customer_request_estimates');
        }

        $actorId = $this->resolveActorId($request);
        $case = $this->findAccessibleCaseModel($id, $actorId);
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền cập nhật estimate cho yêu cầu này.'], 403);
        }

        $estimatedHours = $this->normalizeNullableDecimal($request->input('estimated_hours'));
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return response()->json([
                'message' => 'estimated_hours là bắt buộc và phải lớn hơn 0.',
                'errors' => ['estimated_hours' => ['estimated_hours là bắt buộc và phải lớn hơn 0.']],
            ], 422);
        }

        $estimateScope = $this->normalizeNullableString($request->input('estimate_scope')) ?? 'total';
        if (! in_array($estimateScope, ['total', 'remaining', 'phase'], true)) {
            return response()->json([
                'message' => 'estimate_scope không hợp lệ.',
                'errors' => ['estimate_scope' => ['estimate_scope không hợp lệ.']],
            ], 422);
        }

        $estimateType = $this->normalizeNullableString($request->input('estimate_type')) ?? 'manual';
        $estimatedAt = $this->normalizeDateTime($request->input('estimated_at')) ?? now()->format('Y-m-d H:i:s');
        $statusInstanceId = $this->support->parseNullableInt($request->input('status_instance_id'))
            ?? $this->support->parseNullableInt($case->current_status_instance_id);
        $statusCode = $this->normalizeNullableString($request->input('status_code')) ?? (string) $case->current_status_code;
        $estimatedByUserId = $this->support->parseNullableInt($request->input('estimated_by_user_id')) ?? $actorId;
        $phaseLabel = $this->normalizeNullableString($request->input('phase_label'));
        $note = $this->normalizeNullableString($request->input('note'));
        $syncMaster = $this->resolveBooleanInput(
            $request->input('sync_master'),
            in_array($estimateScope, ['total', 'remaining'], true)
        );

        $estimateId = DB::transaction(function () use (
            $case,
            $estimatedHours,
            $estimateScope,
            $estimateType,
            $estimatedAt,
            $statusInstanceId,
            $statusCode,
            $estimatedByUserId,
            $phaseLabel,
            $note,
            $actorId,
            $syncMaster
        ): int {
            $estimateId = (int) DB::table('customer_request_estimates')->insertGetId($this->filterByTableColumns('customer_request_estimates', [
                'request_case_id' => (int) $case->id,
                'status_instance_id' => $statusInstanceId,
                'status_code' => $statusCode,
                'estimated_hours' => $estimatedHours,
                'estimate_type' => $estimateType,
                'estimate_scope' => $estimateScope,
                'phase_label' => $phaseLabel,
                'note' => $note,
                'estimated_by_user_id' => $estimatedByUserId,
                'estimated_at' => $estimatedAt,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            if ($syncMaster) {
                $masterEstimatedHours = $estimateScope === 'remaining'
                    ? round(((float) ($case->total_hours_spent ?? 0)) + $estimatedHours, 2)
                    : $estimatedHours;

                DB::table('customer_request_cases')
                    ->where('id', $case->id)
                    ->update($this->filterByTableColumns('customer_request_cases', [
                        'estimated_hours' => $masterEstimatedHours,
                        'estimated_by_user_id' => $estimatedByUserId,
                        'estimated_at' => $estimatedAt,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));
            }

            return $estimateId;
        });

        $estimate = $this->loadEstimateById($estimateId);
        $freshCase = CustomerRequestCase::query()->find($case->id) ?? $case;

        return response()->json([
            'data' => [
                'estimate' => $estimate,
                'request_case' => $this->serializeCaseModel($freshCase),
            ],
        ], 201);
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

        return response()->json([
            'data' => $this->buildHoursReportPayload($case),
        ]);
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
        return $this->dashboardByRole($request, 'creator');
    }

    public function dashboardDispatcher(Request $request): JsonResponse
    {
        return $this->dashboardByRole($request, 'dispatcher');
    }

    public function dashboardPerformer(Request $request): JsonResponse
    {
        return $this->dashboardByRole($request, 'performer');
    }

    public function performerWeeklyTimesheet(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        if ($actorId === null) {
            return response()->json(['message' => 'Không xác định được người thực hiện hiện tại.'], 422);
        }

        $startDate = $this->normalizeNullableDate($request->query('start_date'))
            ?? Carbon::now()->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
        $endDate = $this->normalizeNullableDate($request->query('end_date'))
            ?? Carbon::parse($startDate)->addDays(6)->format('Y-m-d');

        if ($startDate > $endDate) {
            return response()->json(['message' => 'Khoảng thời gian không hợp lệ.'], 422);
        }

        $accessibleCaseIds = $this->baseCaseQuery($actorId)
            ->pluck('crc.id')
            ->map(fn ($value): int => (int) $value)
            ->values()
            ->all();

        if ($accessibleCaseIds === []) {
            return response()->json([
                'data' => $this->emptyPerformerWeeklyTimesheetPayload($startDate, $endDate, $actorId),
            ]);
        }

        $rows = DB::table('customer_request_worklogs as wl')
            ->join('customer_request_cases as crc', 'crc.id', '=', 'wl.request_case_id')
            ->leftJoin('customers as customer', 'customer.id', '=', 'crc.customer_id')
            ->leftJoin('projects as project', 'project.id', '=', 'crc.project_id')
            ->leftJoin('customer_request_status_catalogs as status_catalog', 'status_catalog.status_code', '=', 'crc.current_status_code')
            ->whereIn('wl.request_case_id', $accessibleCaseIds)
            ->where('wl.performed_by_user_id', $actorId)
            ->whereRaw('DATE(COALESCE(wl.work_date, wl.work_started_at, wl.created_at)) between ? and ?', [$startDate, $endDate])
            ->orderByDesc(DB::raw('COALESCE(wl.work_date, wl.work_started_at, wl.created_at)'))
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'crc.request_code',
                'crc.summary',
                DB::raw('customer.customer_name as customer_name'),
                DB::raw('project.project_name as project_name'),
                'crc.current_status_code',
                DB::raw('status_catalog.status_name_vi as current_status_name_vi'),
                DB::raw('DATE(COALESCE(wl.work_date, wl.work_started_at, wl.created_at)) as worked_on'),
            ])
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'data' => $this->emptyPerformerWeeklyTimesheetPayload($startDate, $endDate, $actorId),
            ]);
        }

        $days = collect($this->buildDateRange($startDate, $endDate))
            ->map(function (string $date) use ($rows): array {
                $dayRows = $rows->filter(fn (object $row): bool => (string) ($row->worked_on ?? '') === $date);
                $billableHours = round((float) $dayRows
                    ->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
                    ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);
                $totalHours = round((float) $dayRows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'date' => $date,
                    'hours_spent' => $totalHours,
                    'billable_hours' => $billableHours,
                    'non_billable_hours' => round(max($totalHours - $billableHours, 0), 2),
                    'entry_count' => $dayRows->count(),
                ];
            })
            ->values()
            ->all();

        $topCases = $rows
            ->groupBy(fn (object $row): string => (string) $row->request_case_id)
            ->map(function ($caseRows, string $caseId): array {
                $first = $caseRows->first();
                $hours = round((float) $caseRows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'request_case_id' => (int) $caseId,
                    'request_code' => $this->normalizeNullableString($first->request_code ?? null),
                    'summary' => $this->normalizeNullableString($first->summary ?? null),
                    'customer_name' => $this->normalizeNullableString($first->customer_name ?? null),
                    'project_name' => $this->normalizeNullableString($first->project_name ?? null),
                    'status_code' => $this->normalizeNullableString($first->current_status_code ?? null),
                    'status_name_vi' => $this->normalizeNullableString($first->current_status_name_vi ?? null),
                    'hours_spent' => $hours,
                    'entry_count' => $caseRows->count(),
                    'last_worked_at' => $this->normalizeNullableString($first->work_started_at ?? $first->created_at ?? null),
                ];
            })
            ->sortByDesc('hours_spent')
            ->take(5)
            ->values()
            ->all();

        $recentEntries = $rows
            ->take(10)
            ->map(function (object $row): array {
                return [
                    ...$this->serializeWorklogRow($row),
                    'request_code' => $this->normalizeNullableString($row->request_code ?? null),
                    'summary' => $this->normalizeNullableString($row->summary ?? null),
                    'customer_name' => $this->normalizeNullableString($row->customer_name ?? null),
                    'project_name' => $this->normalizeNullableString($row->project_name ?? null),
                    'current_status_code' => $this->normalizeNullableString($row->current_status_code ?? null),
                    'current_status_name_vi' => $this->normalizeNullableString($row->current_status_name_vi ?? null),
                    'worked_on' => $this->normalizeNullableString($row->worked_on ?? null),
                ];
            })
            ->values()
            ->all();

        $totalHours = round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);
        $billableHours = round((float) $rows
            ->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
            ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

        return response()->json([
            'data' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'performer_user_id' => $actorId,
                'total_hours' => $totalHours,
                'billable_hours' => $billableHours,
                'non_billable_hours' => round(max($totalHours - $billableHours, 0), 2),
                'worklog_count' => $rows->count(),
                'days' => $days,
                'top_cases' => $topCases,
                'recent_entries' => $recentEntries,
            ],
        ]);
    }

    public function dashboardOverview(Request $request): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        $query = $this->baseCaseQuery($actorId);
        $this->applyCaseFilters($query, $request, $actorId, false);

        return response()->json([
            'data' => [
                'role' => 'overview',
                'summary' => [
                    'total_cases' => (clone $query)->count(),
                    'status_counts' => $this->collectStatusCounts(clone $query),
                    'alert_counts' => [
                        'over_estimate' => $this->countOverEstimate(clone $query),
                        'missing_estimate' => $this->countMissingEstimate(clone $query),
                        'sla_risk' => $this->countSlaRisk(clone $query),
                    ],
                ],
                'top_customers' => $this->collectTopCustomers(clone $query),
                'top_projects' => $this->collectTopProjects(clone $query),
                'top_performers' => $this->collectTopPerformers(clone $query),
                'attention_cases' => $this->collectAttentionCases(clone $query, 10),
            ],
        ]);
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

        $workContent = $this->normalizeNullableString($request->input('work_content'));
        if ($workContent === null) {
            return response()->json(['message' => 'work_content là bắt buộc.'], 422);
        }

        $statusInstanceId = $this->support->parseNullableInt($request->input('status_instance_id'))
            ?? $this->support->parseNullableInt($case->current_status_instance_id);
        if ($statusInstanceId === null) {
            return response()->json(['message' => 'Yêu cầu chưa có trạng thái hiện tại để ghi worklog.'], 422);
        }

        $statusInstance = CustomerRequestStatusInstance::query()
            ->whereKey($statusInstanceId)
            ->where('request_case_id', $case->id)
            ->first();
        if ($statusInstance === null) {
            return response()->json(['message' => 'status_instance_id không hợp lệ.'], 422);
        }

        $startedAt = $this->normalizeDateTime($request->input('work_started_at'));
        $endedAt = $this->normalizeDateTime($request->input('work_ended_at'));
        $hoursSpent = $this->normalizeNullableDecimal($request->input('hours_spent'));
        $workDate = $this->normalizeNullableDate($request->input('work_date'));
        if ($hoursSpent === null && $startedAt !== null && $endedAt !== null) {
            try {
                $hoursSpent = round(Carbon::parse($startedAt)->diffInMinutes(Carbon::parse($endedAt), true) / 60, 2);
            } catch (\Throwable) {
                $hoursSpent = null;
            }
        }
        if ($workDate === null && $startedAt !== null) {
            try {
                $workDate = Carbon::parse($startedAt)->format('Y-m-d');
            } catch (\Throwable) {
                $workDate = null;
            }
        }

        $payload = $this->filterByTableColumns('customer_request_worklogs', [
            'request_case_id' => (int) $case->id,
            'status_instance_id' => (int) $statusInstance->id,
            'status_code' => (string) $statusInstance->status_code,
            'performed_by_user_id' => $this->support->parseNullableInt($request->input('performed_by_user_id')) ?? $actorId,
            'work_content' => $workContent,
            'work_started_at' => $startedAt,
            'work_ended_at' => $endedAt,
            'work_date' => $workDate,
            'activity_type_code' => $this->normalizeNullableString($request->input('activity_type_code')),
            'is_billable' => $this->resolveBooleanInput($request->input('is_billable')),
            'is_auto_transition' => $this->resolveBooleanInput($request->input('is_auto_transition')),
            'transition_id' => $this->support->parseNullableInt($request->input('transition_id')),
            'hours_spent' => $hoursSpent,
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $worklogId = (int) DB::table('customer_request_worklogs')->insertGetId($payload);
        $hoursSummary = $this->recalculateCaseHours((int) $case->id, $actorId);

        $row = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.id', $worklogId)
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->first();

        return response()->json([
            'data' => $row === null ? null : $this->serializeWorklogRow($row),
            'meta' => [
                'hours_report' => $hoursSummary,
            ],
        ], 201);
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
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $statusDefinition = CustomerRequestCaseRegistry::find($statusCode);
        if ($statusDefinition === null) {
            return response()->json(['message' => 'Trạng thái không tồn tại.'], 404);
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->resolveActorId($request);
        if (! $this->canWriteCase($case, $actorId)) {
            return response()->json(['message' => 'Bạn không có quyền thao tác yêu cầu này.'], 403);
        }

        [$masterPatch, $masterErrors] = $this->normalizeMasterPayload($request, false);
        if ($masterErrors !== []) {
            return response()->json(['message' => 'Dữ liệu yêu cầu không hợp lệ.', 'errors' => $masterErrors], 422);
        }

        $statusSource = $this->extractStatusPayload($request);
        [$statusPayload, $statusErrors] = $this->normalizeStatusPayload($statusDefinition, $statusSource, $case, $actorId);
        if ($statusErrors !== []) {
            return response()->json(['message' => 'Dữ liệu trạng thái không hợp lệ.', 'errors' => $statusErrors], 422);
        }

        $targetStatusCode = (string) $statusDefinition['status_code'];
        $currentStatusCode = (string) $case->current_status_code;

        if ($targetStatusCode !== $currentStatusCode) {
            try {
                $this->assertTransitionAllowed($currentStatusCode, $targetStatusCode);
            } catch (\RuntimeException $exception) {
                return response()->json([
                    'message' => $exception->getMessage(),
                    'errors' => [
                        'to_status_code' => [$exception->getMessage()],
                    ],
                ], 422);
            }
        }

        $updatedCase = DB::transaction(function () use ($case, $masterPatch, $statusDefinition, $statusPayload, $actorId, $request, $currentStatusCode, $targetStatusCode): CustomerRequestCase {
            $before = $this->serializeCaseModel($case);

            if ($masterPatch !== []) {
                $case->fill($masterPatch);
            }
            $case->requester_name_snapshot = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($case->customer_personnel_id),
                $case->requester_name_snapshot
            );

            if ($targetStatusCode === $currentStatusCode) {
                $currentInstance = $this->currentStatusInstance($case);
                if ($currentInstance === null) {
                    throw new \RuntimeException('Thiếu trạng thái hiện tại.');
                }

                $rowId = $this->upsertStatusRow(
                    $statusDefinition,
                    (int) $case->id,
                    (int) $currentInstance->id,
                    $statusPayload,
                    $actorId,
                    $this->support->parseNullableInt($currentInstance->status_row_id)
                );

                DB::table('customer_request_status_instances')
                    ->where('id', $currentInstance->id)
                    ->update($this->filterByTableColumns('customer_request_status_instances', [
                        'status_row_id' => $rowId,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));

                $this->syncCaseCurrentStatus($case, $statusDefinition, (int) $currentInstance->id, $statusPayload, $actorId);
                $this->syncCurrentStatusRelations((int) $case->id, (int) $currentInstance->id, $request, $actorId);
            } else {
                $transition = $this->createStatusInstanceAndRow(
                    $case,
                    $statusDefinition,
                    $statusPayload,
                    $actorId,
                    $this->currentStatusInstance($case)
                );

                $this->syncCaseCurrentStatus($case, $statusDefinition, $transition['instance_id'], $statusPayload, $actorId);
                $this->syncCurrentStatusRelations((int) $case->id, $transition['instance_id'], $request, $actorId);
            }

            $case->save();
            $fresh = $case->fresh() ?? $case;

            $this->appendAuditLog(
                'UPDATE',
                'customer_request_cases',
                (int) $fresh->id,
                $before,
                $this->serializeCaseModel($fresh),
                $actorId
            );

            return $fresh;
        });

        return response()->json([
            'data' => $this->buildStatusDetailData($updatedCase, (string) $updatedCase->current_status_code, $actorId),
        ]);
    }

    public function transition(Request $request, int $id): JsonResponse
    {
        $targetStatusCode = $this->normalizeNullableString(
            $request->input('to_status_code', $request->input('status_code'))
        );
        if ($targetStatusCode === null) {
            return response()->json(['message' => 'to_status_code là bắt buộc.'], 422);
        }

        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        $case = $this->findAccessibleCaseModel($id, $actorId);
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        if ((string) $case->current_status_code === $targetStatusCode) {
            return response()->json([
                'message' => 'Không thể chuyển sang chính trạng thái hiện tại.',
                'errors' => [
                    'to_status_code' => ['Không thể chuyển sang chính trạng thái hiện tại.'],
                ],
            ], 422);
        }

        return $this->saveStatus($request, $id, $targetStatusCode);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $case = $this->findAccessibleCaseModel($id, $this->resolveActorId($request));
        if ($case === null) {
            return response()->json(['message' => 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.'], 404);
        }

        $actorId = $this->resolveActorId($request);
        if ($actorId === null || ! $this->userAccess->isAdmin($actorId)) {
            return response()->json(['message' => 'Bạn không có quyền xóa yêu cầu này.'], 403);
        }

        DB::transaction(function () use ($case, $actorId): void {
            $before = $this->serializeCaseModel($case);
            $timestamp = now()->format('Y-m-d H:i:s');

            DB::table('customer_request_cases')
                ->where('id', $case->id)
                ->update($this->filterByTableColumns('customer_request_cases', [
                    'deleted_at' => $timestamp,
                    'updated_by' => $actorId,
                    'updated_at' => $timestamp,
                ]));

            $this->appendAuditLog(
                'DELETE',
                'customer_request_cases',
                (int) $case->id,
                $before,
                null,
                $actorId
            );
        });

        return response()->json(['message' => 'Đã xóa yêu cầu thành công.']);
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
                fn (array $definition): array => $this->serializeStatusMeta($definition),
                $this->allowedStatusDefinitions((string) $currentDefinition['status_code'], 'forward')
            ));
        $allowedPrevious = $currentDefinition === null
            ? []
            : array_values(array_map(
                fn (array $definition): array => $this->serializeStatusMeta($definition),
                $this->allowedStatusDefinitions((string) $currentDefinition['status_code'], 'backward')
            ));

        return [
            ...$serializedCase,
            'request_case' => $serializedCase,
            'yeu_cau' => $serializedCase,
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
            'transition_allowed' => $statusCode === $case->current_status_code || $this->isTransitionAllowed((string) $case->current_status_code, $statusCode),
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
     * @return array{0:array<string,mixed>,1:array<string,array<int,string>>}
     */
    private function normalizeMasterPayload(Request $request, bool $requireRequiredFields): array
    {
        $source = $this->extractMasterPayload($request);
        $normalized = [];
        $errors = [];

        foreach (CustomerRequestCaseRegistry::masterFields() as $field) {
            $name = (string) $field['name'];
            $hasValue = array_key_exists($name, $source) || $request->exists($name);
            if (! $requireRequiredFields && ! $hasValue) {
                continue;
            }

            $value = array_key_exists($name, $source) ? $source[$name] : $request->input($name);
            $normalized[$name] = $this->normalizeFieldValue($field, $value);

            if (($field['required'] ?? false) && $requireRequiredFields && ($normalized[$name] === null || $normalized[$name] === '')) {
                $errors[$name][] = "{$field['label']} là bắt buộc.";
            }
        }

        foreach (['dispatcher_user_id', 'performer_user_id'] as $extraUserField) {
            $hasValue = array_key_exists($extraUserField, $source) || $request->exists($extraUserField);
            if (! $requireRequiredFields && ! $hasValue) {
                continue;
            }

            $value = array_key_exists($extraUserField, $source) ? $source[$extraUserField] : $request->input($extraUserField);
            $normalized[$extraUserField] = $this->support->parseNullableInt($value);
        }

        if ($requireRequiredFields && ($normalized['priority'] ?? null) === null) {
            $normalized['priority'] = 2;
        }

        if (array_key_exists('priority', $normalized) && ! in_array((int) $normalized['priority'], [1, 2, 3, 4], true)) {
            $errors['priority'][] = 'Độ ưu tiên không hợp lệ.';
        }

        foreach ([
            'customer_id' => 'customers',
            'customer_personnel_id' => 'customer_personnel',
            'support_service_group_id' => 'support_service_groups',
            'project_id' => 'projects',
            'project_item_id' => 'project_items',
            'product_id' => 'products',
        ] as $column => $table) {
            $id = $this->support->parseNullableInt($normalized[$column] ?? null);
            if ($id !== null && $this->support->hasTable($table) && ! DB::table($table)->where('id', $id)->exists()) {
                $errors[$column][] = "{$column} không hợp lệ.";
            }
        }

        foreach (['dispatcher_user_id', 'performer_user_id'] as $extraUserField) {
            $id = $this->support->parseNullableInt($normalized[$extraUserField] ?? null);
            if ($id !== null && $this->support->hasTable('internal_users') && ! DB::table('internal_users')->where('id', $id)->exists()) {
                $errors[$extraUserField][] = "{$extraUserField} không hợp lệ.";
            }
        }

        if ($requireRequiredFields || array_key_exists('customer_personnel_id', $normalized) || $request->exists('requester_name_snapshot')) {
            $normalized['requester_name_snapshot'] = $this->resolveRequesterSnapshot(
                $this->support->parseNullableInt($normalized['customer_personnel_id'] ?? null),
                $request->input('requester_name_snapshot')
            );
        }

        return [$this->filterByTableColumns('customer_request_cases', $normalized), $errors];
    }

    /**
     * @param array<string, mixed> $source
     * @return array{0:array<string,mixed>,1:array<string,array<int,string>>}
     */
    private function normalizeStatusPayload(array $definition, array $source, ?CustomerRequestCase $case, ?int $actorId): array
    {
        $normalized = [];
        $errors = [];
        $existingRow = null;

        if ($case !== null && (string) $case->current_status_code === (string) $definition['status_code']) {
            $currentInstance = $this->currentStatusInstance($case);
            if ($currentInstance !== null) {
                $existingRow = $this->loadStatusRow((string) $definition['table_name'], $currentInstance->status_row_id);
            }
        }

        foreach ($definition['form_fields'] as $field) {
            $name = (string) $field['name'];
            $value = $source[$name] ?? ($existingRow[$name] ?? null);
            $normalized[$name] = $this->normalizeFieldValue($field, $value);
            if (($field['required'] ?? false) && ($normalized[$name] === null || $normalized[$name] === '')) {
                $errors[$name][] = "{$field['label']} là bắt buộc.";
            }
        }

        $this->applyStatusDefaults((string) $definition['status_code'], $normalized, $case, $actorId);

        foreach ($definition['form_fields'] as $field) {
            $name = (string) $field['name'];
            $type = (string) ($field['type'] ?? 'text');
            $value = $normalized[$name] ?? null;

            if (in_array($type, ['user_select', 'customer_select', 'customer_personnel_select', 'support_group_select'], true) && $value !== null) {
                $table = match ($type) {
                    'user_select' => 'internal_users',
                    'customer_select' => 'customers',
                    'customer_personnel_select' => 'customer_personnel',
                    'support_group_select' => 'support_service_groups',
                    default => null,
                };
                if ($table !== null && $this->support->hasTable($table) && ! DB::table($table)->where('id', (int) $value)->exists()) {
                    $errors[$name][] = "{$field['label']} không hợp lệ.";
                }
            }
        }

        return [$this->filterByTableColumns((string) $definition['table_name'], $normalized), $errors];
    }

    /**
     * @param array<string, mixed> $normalized
     */
    private function applyStatusDefaults(string $statusCode, array &$normalized, ?CustomerRequestCase $case, ?int $actorId): void
    {
        switch ($statusCode) {
            case 'new_intake':
                $normalized['received_by_user_id'] = $this->support->parseNullableInt($case?->received_by_user_id)
                    ?? $actorId;
                $normalized['received_at'] = $this->normalizeDateTime($case?->received_at)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'waiting_customer_feedback':
                $normalized['feedback_requested_at'] = $this->normalizeDateTime($normalized['feedback_requested_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'in_progress':
                $normalized['performer_user_id'] = $this->support->parseNullableInt($normalized['performer_user_id'] ?? null)
                    ?? $this->support->parseNullableInt($case?->received_by_user_id)
                    ?? $actorId;
                $normalized['started_at'] = $this->normalizeDateTime($normalized['started_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                $normalized['progress_percent'] = max(0, min(100, (int) ($normalized['progress_percent'] ?? 0)));
                break;
            case 'not_executed':
                $normalized['decision_by_user_id'] = $this->support->parseNullableInt($normalized['decision_by_user_id'] ?? null)
                    ?? $actorId;
                $normalized['decision_at'] = $this->normalizeDateTime($normalized['decision_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'completed':
                $normalized['completed_by_user_id'] = $this->support->parseNullableInt($normalized['completed_by_user_id'] ?? null)
                    ?? $this->support->parseNullableInt($case?->received_by_user_id)
                    ?? $actorId;
                $normalized['completed_at'] = $this->normalizeDateTime($normalized['completed_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'customer_notified':
                // Ưu tiên: input → nguoi_xu_ly (RACI 'A' của dự án) → người tiếp nhận → actorId
                $handlerUserId = null;
                $caseProjectId = $this->support->parseNullableInt($case?->project_id);
                if ($caseProjectId !== null) {
                    $raciRows = $this->support->fetchProjectRaciAssignmentsByProjectIds([$caseProjectId]);
                    $accountable = collect($raciRows)->first(
                        static fn (array $row): bool =>
                            (int) ($row['project_id'] ?? 0) === $caseProjectId
                            && (string) ($row['raci_role'] ?? '') === 'A'
                    );
                    $handlerUserId = $this->support->parseNullableInt($accountable['user_id'] ?? null);
                }
                $normalized['notified_by_user_id'] = $this->support->parseNullableInt($normalized['notified_by_user_id'] ?? null)
                    ?? $handlerUserId
                    ?? $this->support->parseNullableInt($case?->received_by_user_id)
                    ?? $actorId;
                $normalized['notified_at'] = $this->normalizeDateTime($normalized['notified_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'returned_to_manager':
                $normalized['returned_by_user_id'] = $this->support->parseNullableInt($normalized['returned_by_user_id'] ?? null)
                    ?? $actorId;
                $normalized['returned_at'] = $this->normalizeDateTime($normalized['returned_at'] ?? null)
                    ?? now()->format('Y-m-d H:i:s');
                break;
            case 'analysis':
                $normalized['performer_user_id'] = $this->support->parseNullableInt($normalized['performer_user_id'] ?? null)
                    ?? $this->support->parseNullableInt($case?->received_by_user_id)
                    ?? $actorId;
                break;
        }
    }

    /**
     * @return array{instance_id:int,row_id:int}
     */
    private function createStatusInstanceAndRow(
        CustomerRequestCase $case,
        array $statusDefinition,
        array $statusPayload,
        ?int $actorId,
        ?CustomerRequestStatusInstance $previousInstance
    ): array {
        $enteredAt = $this->resolveStatusEnteredAt((string) $statusDefinition['status_code'], $statusPayload, $case);
        $now = now();

        if ($previousInstance !== null) {
            DB::table('customer_request_status_instances')
                ->where('id', $previousInstance->id)
                ->update($this->filterByTableColumns('customer_request_status_instances', [
                    'is_current' => 0,
                    'exited_at' => $enteredAt,
                    'updated_by' => $actorId,
                    'updated_at' => $now,
                ]));
        }

        $instanceId = (int) DB::table('customer_request_status_instances')->insertGetId(
            $this->filterByTableColumns('customer_request_status_instances', [
                'request_case_id' => (int) $case->id,
                'status_code' => (string) $statusDefinition['status_code'],
                'status_table' => (string) $statusDefinition['table_name'],
                'status_row_id' => null,
                'previous_instance_id' => $previousInstance?->id,
                'next_instance_id' => null,
                'entered_at' => $enteredAt,
                'exited_at' => null,
                'is_current' => 1,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => $now,
                'updated_at' => $now,
            ])
        );

        $rowId = $this->upsertStatusRow($statusDefinition, (int) $case->id, $instanceId, $statusPayload, $actorId, null);

        DB::table('customer_request_status_instances')
            ->where('id', $instanceId)
            ->update($this->filterByTableColumns('customer_request_status_instances', [
                'status_row_id' => $rowId,
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]));

        if ($previousInstance !== null) {
            DB::table('customer_request_status_instances')
                ->where('id', $previousInstance->id)
                ->update($this->filterByTableColumns('customer_request_status_instances', [
                    'next_instance_id' => $instanceId,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]));
        }

        return [
            'instance_id' => $instanceId,
            'row_id' => $rowId,
        ];
    }

    private function upsertStatusRow(
        array $statusDefinition,
        int $caseId,
        int $instanceId,
        array $payload,
        ?int $actorId,
        ?int $existingRowId
    ): int {
        $table = (string) $statusDefinition['table_name'];
        if ($this->isMasterBackedStatus($statusDefinition)) {
            return $caseId;
        }

        $filteredPayload = $this->filterByTableColumns($table, [
            ...$payload,
            'request_case_id' => $caseId,
            'status_instance_id' => $instanceId,
            'updated_by' => $actorId,
            'updated_at' => now(),
        ]);

        if ($existingRowId !== null) {
            DB::table($table)
                ->where('id', $existingRowId)
                ->update($filteredPayload);

            return $existingRowId;
        }

        return (int) DB::table($table)->insertGetId($this->filterByTableColumns($table, [
            ...$filteredPayload,
            'created_by' => $actorId,
            'created_at' => now(),
        ]));
    }

    private function syncCaseCurrentStatus(
        CustomerRequestCase $case,
        array $statusDefinition,
        int $statusInstanceId,
        array $statusPayload,
        ?int $actorId
    ): void {
        $case->current_status_code = (string) $statusDefinition['status_code'];
        $case->current_status_instance_id = $statusInstanceId;
        $case->current_status_changed_at = now()->format('Y-m-d H:i:s');
        $case->updated_by = $actorId;

        if (array_key_exists('performer_user_id', $statusPayload) && $statusPayload['performer_user_id'] !== null) {
            $case->performer_user_id = $statusPayload['performer_user_id'];
        }

        switch ((string) $statusDefinition['status_code']) {
            case 'new_intake':
                if ($case->received_by_user_id === null && array_key_exists('received_by_user_id', $statusPayload)) {
                    $case->received_by_user_id = $statusPayload['received_by_user_id'];
                }
                if ($case->received_at === null && array_key_exists('received_at', $statusPayload)) {
                    $case->received_at = $statusPayload['received_at'];
                }
                break;
            case 'completed':
                $case->completed_at = $statusPayload['completed_at'] ?? $case->completed_at;
                break;
            case 'customer_notified':
                $case->reported_to_customer_at = $statusPayload['notified_at'] ?? $case->reported_to_customer_at;
                break;
        }
    }

    private function syncCurrentStatusRelations(int $caseId, int $statusInstanceId, Request $request, ?int $actorId): void
    {
        // Frontend gửi ref_tasks/attachments bên trong status_payload → fallback đọc từ đó
        $statusPayload = is_array($request->input('status_payload')) ? $request->input('status_payload') : [];

        $refTasks = $request->exists('ref_tasks')
            ? $request->input('ref_tasks')
            : ($statusPayload['ref_tasks'] ?? null);

        if ($refTasks !== null) {
            $items = is_array($refTasks) ? $refTasks : [];
            $this->syncRefTasks($caseId, $statusInstanceId, $items, $actorId);
        }

        $attachments = $request->exists('attachments')
            ? $request->input('attachments')
            : ($statusPayload['attachments'] ?? null);

        if ($attachments !== null) {
            $items = is_array($attachments) ? $attachments : [];
            $this->syncAttachments($caseId, $statusInstanceId, $items, $actorId);
        }
    }

    /**
     * @param array<int, mixed> $items
     */
    private function syncRefTasks(int $caseId, int $statusInstanceId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_ref_tasks')) {
            return;
        }

        DB::table('customer_request_status_ref_tasks')
            ->where('request_case_id', $caseId)
            ->where('status_instance_id', $statusInstanceId)
            ->delete();

        if (! $this->support->hasTable('request_ref_tasks')) {
            return;
        }

        // Lấy request_code từ customer_request_cases để điền vào request_ref_tasks
        $requestCode = (string) DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->value('request_code');

        $rows = [];
        $seen = [];
        foreach ($items as $index => $item) {
            if (! is_array($item) && ! is_numeric($item)) {
                continue;
            }
            $refTaskId = is_array($item)
                ? $this->resolveRefTaskIdFromPayload($item, $actorId, (int) $index, $requestCode, $caseId)
                : $this->support->parseNullableInt($item);
            if ($refTaskId === null || isset($seen[$refTaskId])) {
                continue;
            }
            if (! DB::table('request_ref_tasks')->where('id', $refTaskId)->exists()) {
                continue;
            }
            $seen[$refTaskId] = true;
            $rows[] = $this->filterByTableColumns('customer_request_status_ref_tasks', [
                'request_case_id' => $caseId,
                'status_instance_id' => $statusInstanceId,
                'ref_task_id' => $refTaskId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($rows !== []) {
            DB::table('customer_request_status_ref_tasks')->insert($rows);
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function resolveRefTaskIdFromPayload(array $payload, ?int $actorId, int $index, string $requestCode = '', int $caseId = 0): ?int
    {
        $refTaskId = $this->support->parseNullableInt($payload['id'] ?? ($payload['ref_task_id'] ?? null));
        $taskSource = strtoupper($this->normalizeNullableString($payload['task_source'] ?? null) ?? 'IT360');
        $taskCode = $this->normalizeNullableString($payload['task_code'] ?? null);
        $taskLink = $this->normalizeNullableString($payload['task_link'] ?? null);
        $taskStatus = $this->normalizeNullableString($payload['task_status'] ?? ($payload['status'] ?? null));
        $taskNote = $this->normalizeNullableString($payload['task_note'] ?? null);
        $sortOrder = $this->support->parseNullableInt($payload['sort_order'] ?? null) ?? $index;

        if ($refTaskId !== null && DB::table('request_ref_tasks')->where('id', $refTaskId)->exists()) {
            if ($taskSource === 'IT360') {
                DB::table('request_ref_tasks')
                    ->where('id', $refTaskId)
                    ->update($this->filterByTableColumns('request_ref_tasks', [
                        'task_source' => $taskSource,
                        'task_code' => $taskCode,
                        'task_link' => $taskLink,
                        'task_status' => $taskStatus,
                        'task_note' => $taskNote,
                        'sort_order' => $sortOrder,
                        'updated_by' => $actorId,
                        'updated_at' => now(),
                    ]));
            }

            return $refTaskId;
        }

        if ($taskCode === null && $taskLink === null) {
            return null;
        }

        // Bỏ qua khi task_code rỗng — là trường bắt buộc (NOT NULL trong DB).
        // Trường hợp hay gặp: frontend gửi row mới chưa điền, task_link có giá trị
        // placeholder trùng task_source (ví dụ task_link = 'IT360').
        if ($taskCode === null) {
            return null;
        }

        // Lọc task_link nếu trùng với task_source (placeholder stale từ frontend)
        if ($taskLink !== null && strtoupper($taskLink) === strtoupper($taskSource)) {
            $taskLink = null;
        }

        if ($taskSource === 'REFERENCE' && $taskCode !== null) {
            $existingReferenceId = $this->support->parseNullableInt(
                DB::table('request_ref_tasks')->where('task_code', $taskCode)->value('id')
            );
            if ($existingReferenceId !== null) {
                return $existingReferenceId;
            }
        }

        $existingIt360Id = null;
        if ($taskSource === 'IT360' && ($taskCode !== null || $taskLink !== null)) {
            $query = DB::table('request_ref_tasks');
            if ($taskCode !== null) {
                $query->where('task_code', $taskCode);
            } else {
                $query->whereNull('task_code');
            }
            if ($taskLink !== null) {
                $query->where('task_link', $taskLink);
            } else {
                $query->whereNull('task_link');
            }
            if ($this->support->hasColumn('request_ref_tasks', 'task_source')) {
                $query->where('task_source', 'IT360');
            }
            $existingIt360Id = $this->support->parseNullableInt($query->value('id'));
        }

        if ($existingIt360Id !== null) {
            DB::table('request_ref_tasks')
                ->where('id', $existingIt360Id)
                ->update($this->filterByTableColumns('request_ref_tasks', [
                    'task_source' => $taskSource,
                    'task_code' => $taskCode,
                    'task_link' => $taskLink,
                    'task_status' => $taskStatus,
                    'task_note' => $taskNote,
                    'sort_order' => $sortOrder,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]));

            return $existingIt360Id;
        }

        return (int) DB::table('request_ref_tasks')->insertGetId($this->filterByTableColumns('request_ref_tasks', [
            'source_type' => 'CASE',
            'source_id'   => $caseId > 0 ? $caseId : null,
            'request_code' => $requestCode !== '' ? $requestCode : null,
            'task_source' => $taskSource,
            'task_code' => $taskCode,
            'task_link' => $taskLink,
            'task_status' => $taskStatus,
            'task_note' => $taskNote,
            'sort_order' => $sortOrder,
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'created_at' => now(),
            'updated_at' => now(),
        ]));
    }

    /**
     * @param array<int, mixed> $items
     */
    private function syncAttachments(int $caseId, int $statusInstanceId, array $items, ?int $actorId): void
    {
        if (! $this->support->hasTable('customer_request_status_attachments')) {
            return;
        }

        DB::table('customer_request_status_attachments')
            ->where('request_case_id', $caseId)
            ->where('status_instance_id', $statusInstanceId)
            ->delete();

        if (! $this->support->hasTable('attachments')) {
            return;
        }

        $rows = [];
        $seen = [];
        foreach ($items as $item) {
            if (! is_array($item) && ! is_numeric($item)) {
                continue;
            }
            $attachmentId = is_array($item)
                ? ($this->support->parseNullableInt($item['id'] ?? ($item['attachment_id'] ?? null)))
                : $this->support->parseNullableInt($item);
            if ($attachmentId === null || isset($seen[$attachmentId])) {
                continue;
            }
            if (! DB::table('attachments')->where('id', $attachmentId)->exists()) {
                continue;
            }
            $seen[$attachmentId] = true;
            $rows[] = $this->filterByTableColumns('customer_request_status_attachments', [
                'request_case_id' => $caseId,
                'status_instance_id' => $statusInstanceId,
                'attachment_id' => $attachmentId,
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($rows !== []) {
            DB::table('customer_request_status_attachments')->insert($rows);
        }
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
        return DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.status_instance_id', $statusInstanceId)
            ->orderByDesc('wl.work_started_at')
            ->orderByDesc('wl.id')
            ->select([
                'wl.*',
                'performer.full_name as performed_by_name',
                'performer.user_code as performed_by_code',
            ])
            ->get()
            ->map(fn (object $row): array => $this->serializeWorklogRow($row))
            ->values()
            ->all();
    }

    private function resolveActorId(Request $request): ?int
    {
        $authId = $this->support->parseNullableInt($request->user()?->id ?? null);
        if ($authId !== null) {
            return $authId;
        }

        foreach ([
            'updated_by',
            'created_by',
            'performed_by_user_id',
        ] as $key) {
            $value = $this->support->parseNullableInt($request->input($key));
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyPerformerWeeklyTimesheetPayload(string $startDate, string $endDate, ?int $actorId): array
    {
        return [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'performer_user_id' => $actorId,
            'total_hours' => 0,
            'billable_hours' => 0,
            'non_billable_hours' => 0,
            'worklog_count' => 0,
            'days' => collect($this->buildDateRange($startDate, $endDate))
                ->map(fn (string $date): array => [
                    'date' => $date,
                    'hours_spent' => 0,
                    'billable_hours' => 0,
                    'non_billable_hours' => 0,
                    'entry_count' => 0,
                ])
                ->values()
                ->all(),
            'top_cases' => [],
            'recent_entries' => [],
        ];
    }

    /**
     * @return array<int, string>
     */
    private function buildDateRange(string $startDate, string $endDate): array
    {
        $dates = [];
        $cursor = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        while ($cursor->lte($end)) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        return $dates;
    }

    /**
     * @return array<string, mixed>
     */
    private function extractMasterPayload(Request $request): array
    {
        return is_array($request->input('master_payload'))
            ? $request->input('master_payload')
            : $request->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function extractStatusPayload(Request $request): array
    {
        if (is_array($request->input('status_payload'))) {
            return $request->input('status_payload');
        }

        if (is_array($request->input('process_payload'))) {
            return $request->input('process_payload');
        }

        return [];
    }

    /**
     * @param array<string, mixed> $field
     */
    private function normalizeFieldValue(array $field, mixed $value): mixed
    {
        $type = (string) ($field['type'] ?? 'text');

        return match ($type) {
            'number', 'priority', 'user_select', 'customer_select', 'customer_personnel_select', 'support_group_select'
                => $this->support->parseNullableInt($value),
            'datetime' => $this->normalizeDateTime($value),
            default => $this->normalizeNullableString($value),
        };
    }

    private function normalizeDateTime(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return Carbon::parse(str_replace('T', ' ', $normalized))->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return $normalized;
        }
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

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    private function resolveRequesterSnapshot(?int $customerPersonnelId, mixed $fallback = null): ?string
    {
        if (
            $customerPersonnelId !== null
            && $this->support->hasTable('customer_personnel')
            && $this->support->hasColumn('customer_personnel', 'full_name')
        ) {
            $name = DB::table('customer_personnel')
                ->where('id', $customerPersonnelId)
                ->when($this->support->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
                ->value('full_name');
            if (is_string($name) && trim($name) !== '') {
                return trim($name);
            }
        }

        return $this->normalizeNullableString($fallback);
    }

    private function resolveStatusEnteredAt(string $statusCode, array $statusPayload, CustomerRequestCase $case): string
    {
        $candidates = match ($statusCode) {
            'new_intake' => [$statusPayload['received_at'] ?? null, $case->received_at, $case->created_at],
            'waiting_customer_feedback' => [$statusPayload['feedback_requested_at'] ?? null, $case->received_at],
            'in_progress' => [$statusPayload['started_at'] ?? null, $case->received_at],
            'not_executed' => [$statusPayload['decision_at'] ?? null, now()],
            'completed' => [$statusPayload['completed_at'] ?? null, now()],
            'customer_notified' => [$statusPayload['notified_at'] ?? null, now()],
            'returned_to_manager' => [$statusPayload['returned_at'] ?? null, now()],
            default => [now()],
        };

        foreach ($candidates as $candidate) {
            $normalized = $this->normalizeDateTime($candidate);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return now()->format('Y-m-d H:i:s');
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
        $resolvedRowId = $this->support->parseNullableInt($rowId);
        if ($resolvedRowId === null || ! $this->support->hasTable($table)) {
            return null;
        }

        $row = DB::table($table)
            ->where('id', $resolvedRowId)
            ->first();

        return $row === null ? null : (array) $row;
    }

    /**
     * @param array<string, mixed> $statusDefinition
     * @param array<string, mixed> $statusRow
     * @return array<string, mixed>
     */
    private function serializeStatusRow(array $statusDefinition, array $statusRow): array
    {
        $data = [];
        foreach ($statusRow as $key => $value) {
            $data[$key] = $value;
        }

        foreach ($statusDefinition['form_fields'] as $field) {
            $fieldName = (string) $field['name'];
            $fieldType = (string) ($field['type'] ?? 'text');
            $fieldValue = $data[$fieldName] ?? null;
            if ($fieldValue === null) {
                continue;
            }

            $resolvedName = match ($fieldType) {
                'user_select' => $this->lookupName('internal_users', (int) $fieldValue, 'full_name'),
                'customer_select' => $this->lookupName('customers', (int) $fieldValue, 'customer_name'),
                'customer_personnel_select' => $this->lookupName('customer_personnel', (int) $fieldValue, 'full_name'),
                'support_group_select' => $this->lookupName('support_service_groups', (int) $fieldValue, 'group_name'),
                default => null,
            };

            if ($resolvedName !== null) {
                $data["{$fieldName}_name"] = $resolvedName;
            }
        }

        return [
            'status_code' => (string) $statusDefinition['status_code'],
            'process_code' => (string) $statusDefinition['status_code'],
            'process_label' => (string) $statusDefinition['status_name_vi'],
            'table_name' => (string) $statusDefinition['table_name'],
            'data' => $data,
        ];
    }

    /**
     * @param array<string, mixed> $case
     * @param array<string, mixed>|null $statusRow
     * @return array<string, mixed>
     */
    private function buildListValues(array $statusDefinition, array $case, ?array $statusRow): array
    {
        $values = [];
        $statusRowData = $statusRow === null ? [] : ($this->serializeStatusRow($statusDefinition, $statusRow)['data'] ?? []);

        foreach ($statusDefinition['list_columns'] as $column) {
            $key = (string) ($column['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $values[$key] = $statusRowData[$key] ?? $case[$key] ?? null;
        }

        return $values;
    }

    private function lookupName(string $table, int $id, string $column): ?string
    {
        $cacheKey = "{$table}:{$column}:{$id}";
        if (array_key_exists($cacheKey, $this->lookupCache)) {
            return $this->lookupCache[$cacheKey];
        }

        if (! $this->support->hasTable($table) || ! $this->support->hasColumn($table, $column)) {
            return $this->lookupCache[$cacheKey] = null;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $this->lookupCache[$cacheKey] = $this->normalizeNullableString($query->value($column));
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeCaseRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;
        $requestCode = (string) ($record['request_code'] ?? '');
        $statusCode = (string) ($record['current_status_code'] ?? '');
        $statusName = $this->normalizeNullableString($record['current_status_name_vi'] ?? null)
            ?? ($statusCode !== '' ? (CustomerRequestCaseRegistry::find($statusCode)['status_name_vi'] ?? $statusCode) : null);
        $ketQua = match ($statusCode) {
            'completed', 'customer_notified' => 'hoan_thanh',
            'not_executed' => 'khong_tiep_nhan',
            default => 'dang_xu_ly',
        };
        $estimatedHours = $this->normalizeNullableDecimal($record['estimated_hours'] ?? null);
        $totalHoursSpent = $this->normalizeNullableDecimal($record['total_hours_spent'] ?? null) ?? 0.0;
        $hoursUsagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent);
        $warningLevel = $this->resolveWarningLevel($estimatedHours, $totalHoursSpent);
        $dispatcherUserId = $this->support->parseNullableInt($record['dispatcher_user_id'] ?? null);
        $performerUserId = $this->support->parseNullableInt($record['performer_user_id'] ?? null);

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_code' => $requestCode,
            'ma_yc' => $requestCode,
            'legacy_customer_request_id' => $this->support->parseNullableInt($record['legacy_customer_request_id'] ?? null),
            'customer_id' => $this->support->parseNullableInt($record['customer_id'] ?? null),
            'khach_hang_id' => $this->support->parseNullableInt($record['customer_id'] ?? null),
            'customer_name' => $this->normalizeNullableString($record['customer_name'] ?? null),
            'khach_hang_name' => $this->normalizeNullableString($record['customer_name'] ?? null),
            'project_id' => $this->support->parseNullableInt($record['project_id'] ?? null),
            'project_item_id' => $this->support->parseNullableInt($record['project_item_id'] ?? null),
            'product_id' => $this->support->parseNullableInt($record['product_id'] ?? null),
            'customer_personnel_id' => $this->support->parseNullableInt($record['customer_personnel_id'] ?? null),
            'requester_name' => $this->normalizeNullableString($record['requester_name'] ?? null)
                ?? $this->normalizeNullableString($record['requester_name_snapshot'] ?? null),
            'support_service_group_id' => $this->support->parseNullableInt($record['support_service_group_id'] ?? null),
            'support_service_group_name' => $this->normalizeNullableString($record['support_service_group_name'] ?? null),
            'received_by_user_id' => $this->support->parseNullableInt($record['received_by_user_id'] ?? null),
            'received_by_name' => $this->normalizeNullableString($record['received_by_name'] ?? null),
            'dispatcher_user_id' => $dispatcherUserId,
            'dispatcher_name' => $this->normalizeNullableString($record['dispatcher_name'] ?? null),
            'performer_user_id' => $performerUserId,
            'performer_name' => $this->normalizeNullableString($record['performer_name'] ?? null),
            'received_at' => $this->normalizeNullableString($record['received_at'] ?? null),
            'summary' => (string) ($record['summary'] ?? ''),
            'tieu_de' => (string) ($record['summary'] ?? ''),
            'description' => $this->normalizeNullableString($record['description'] ?? null),
            'mo_ta' => $this->normalizeNullableString($record['description'] ?? null),
            'priority' => (int) ($record['priority'] ?? 2),
            'do_uu_tien' => (int) ($record['priority'] ?? 2),
            'source_channel' => $this->normalizeNullableString($record['source_channel'] ?? null),
            'kenh_tiep_nhan' => $this->normalizeNullableString($record['support_service_group_name'] ?? null),
            'kenh_khac' => $this->normalizeNullableString($record['source_channel'] ?? null),
            'current_status_code' => $statusCode !== '' ? $statusCode : null,
            'current_status_name_vi' => $statusName,
            'current_process_label' => $statusName,
            'trang_thai' => $statusCode !== '' ? $statusCode : null,
            'tien_trinh_hien_tai' => $statusCode !== '' ? $statusCode : null,
            'ket_qua' => $ketQua,
            'completed_at' => $this->normalizeNullableString($record['completed_at'] ?? null),
            'reported_to_customer_at' => $this->normalizeNullableString($record['reported_to_customer_at'] ?? null),
            'estimated_hours' => $estimatedHours,
            'estimated_by_user_id' => $this->support->parseNullableInt($record['estimated_by_user_id'] ?? null),
            'estimated_at' => $this->normalizeNullableString($record['estimated_at'] ?? null),
            'total_hours_spent' => round($totalHoursSpent, 2),
            'hours_usage_pct' => $hoursUsagePct,
            'warning_level' => $warningLevel,
            'over_estimate' => $warningLevel === 'hard',
            'missing_estimate' => $estimatedHours === null || $estimatedHours <= 0,
            'project_name' => $this->normalizeNullableString($record['project_name'] ?? null),
            'customer_personnel_name' => $this->normalizeNullableString($record['requester_name'] ?? null)
                ?? $this->normalizeNullableString($record['requester_name_snapshot'] ?? null),
            'sla_due_at' => $this->normalizeNullableString($record['sla_due_at'] ?? null),
            'sla_status' => $this->buildSlaStatus($record['sla_due_at'] ?? null, $statusCode),
            'current_status_instance_id' => $this->support->parseNullableInt($record['current_status_instance_id'] ?? null),
            'created_by' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'nguoi_tao_id' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'created_by_name' => $this->normalizeNullableString($record['created_by_name'] ?? null),
            'nguoi_tao_name' => $this->normalizeNullableString($record['created_by_name'] ?? null),
            'updated_by' => $this->support->parseNullableInt($record['updated_by'] ?? null),
            'updated_by_name' => $this->normalizeNullableString($record['updated_by_name'] ?? null),
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildRelatedPeople(CustomerRequestCase $case): array
    {
        $people = [];
        $seen = [];

        foreach ([
            [
                'user_id' => $this->support->parseNullableInt($case->created_by),
                'vai_tro' => 'nguoi_nhap',
                'trang_thai_bat_dau' => 'new_intake',
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->received_by_user_id),
                'vai_tro' => 'nguoi_tiep_nhan',
                'trang_thai_bat_dau' => 'new_intake',
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->dispatcher_user_id),
                'vai_tro' => 'nguoi_dieu_phoi',
                'trang_thai_bat_dau' => (string) ($case->current_status_code ?? 'new_intake'),
            ],
            [
                'user_id' => $this->support->parseNullableInt($case->performer_user_id),
                'vai_tro' => 'nguoi_thuc_hien',
                'trang_thai_bat_dau' => (string) ($case->current_status_code ?? 'new_intake'),
            ],
        ] as $index => $definition) {
            $userId = $definition['user_id'];
            if ($userId === null) {
                continue;
            }

            $key = $userId . ':' . $definition['vai_tro'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $people[] = [
                'id' => $index + 1,
                'yeu_cau_id' => (int) $case->id,
                'user_id' => $userId,
                'user_name' => $this->lookupName('internal_users', $userId, 'full_name'),
                'user_code' => $this->lookupName('internal_users', $userId, 'user_code'),
                'vai_tro' => $definition['vai_tro'],
                'trang_thai_bat_dau' => $definition['trang_thai_bat_dau'],
                'cap_quyen_luc' => $this->normalizeNullableString($case->created_at),
                'thu_hoi_luc' => null,
                'cap_boi_id' => $this->support->parseNullableInt($case->created_by),
                'cap_boi_name' => $this->lookupName('internal_users', (int) ($case->created_by ?? 0), 'full_name'),
                'is_active' => true,
            ];
        }

        $projectId = $this->support->parseNullableInt($case->project_id);
        $processor = null;
        if ($projectId !== null) {
            $processor = collect($this->support->fetchProjectRaciAssignmentsByProjectIds([$projectId]))
                ->first(static fn (array $row): bool => (int) ($row['project_id'] ?? 0) === $projectId && (string) ($row['raci_role'] ?? '') === 'A');
        }

        $processorUserId = $this->support->parseNullableInt($processor['user_id'] ?? null);
        if ($processorUserId !== null) {
            $key = $processorUserId . ':nguoi_xu_ly';
            if (! isset($seen[$key])) {
                $people[] = [
                    'id' => count($people) + 1,
                    'yeu_cau_id' => (int) $case->id,
                    'user_id' => $processorUserId,
                    'user_name' => $this->normalizeNullableString($processor['full_name'] ?? null)
                        ?? $this->lookupName('internal_users', $processorUserId, 'full_name'),
                    'user_code' => $this->normalizeNullableString($processor['user_code'] ?? null)
                        ?? $this->lookupName('internal_users', $processorUserId, 'user_code'),
                    'vai_tro' => 'nguoi_xu_ly',
                    'trang_thai_bat_dau' => 'new_intake',
                    'cap_quyen_luc' => $this->normalizeNullableString($case->created_at),
                    'thu_hoi_luc' => null,
                    'cap_boi_id' => $this->support->parseNullableInt($case->created_by),
                    'cap_boi_name' => $this->lookupName('internal_users', (int) ($case->created_by ?? 0), 'full_name'),
                    'is_active' => true,
                ];
            }
        }

        return $people;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCaseModel(CustomerRequestCase $case): array
    {
        $row = $this->baseCaseQuery(null)
            ->where('crc.id', $case->id)
            ->first();

        return $row === null ? $this->serializeCaseRow($case->toArray()) : $this->serializeCaseRow($row);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStatusInstance(CustomerRequestStatusInstance $instance): array
    {
        return [
            'id' => (int) $instance->id,
            'request_case_id' => (int) $instance->request_case_id,
            'status_code' => (string) $instance->status_code,
            'status_table' => (string) $instance->status_table,
            'status_row_id' => $this->support->parseNullableInt($instance->status_row_id),
            'previous_instance_id' => $this->support->parseNullableInt($instance->previous_instance_id),
            'next_instance_id' => $this->support->parseNullableInt($instance->next_instance_id),
            'entered_at' => $this->normalizeNullableString($instance->entered_at),
            'exited_at' => $this->normalizeNullableString($instance->exited_at),
            'is_current' => (bool) $instance->is_current,
            'created_by' => $this->support->parseNullableInt($instance->created_by),
            'updated_by' => $this->support->parseNullableInt($instance->updated_by),
            'created_at' => $this->normalizeNullableString($instance->created_at),
            'updated_at' => $this->normalizeNullableString($instance->updated_at),
        ];
    }

    /**
     * @param object|array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function serializeWorklogRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_case_id' => $this->support->parseNullableInt($record['request_case_id'] ?? null),
            'status_instance_id' => $this->support->parseNullableInt($record['status_instance_id'] ?? null),
            'status_code' => $this->normalizeNullableString($record['status_code'] ?? null),
            'performed_by_user_id' => $this->support->parseNullableInt($record['performed_by_user_id'] ?? null),
            'performed_by_name' => $this->normalizeNullableString($record['performed_by_name'] ?? null),
            'performed_by_code' => $this->normalizeNullableString($record['performed_by_code'] ?? null),
            'work_content' => $this->normalizeNullableString($record['work_content'] ?? null),
            'work_date' => $this->normalizeNullableString($record['work_date'] ?? null),
            'activity_type_code' => $this->normalizeNullableString($record['activity_type_code'] ?? null),
            'is_billable' => array_key_exists('is_billable', $record) ? ($record['is_billable'] === null ? null : (bool) $record['is_billable']) : null,
            'is_auto_transition' => array_key_exists('is_auto_transition', $record) ? ($record['is_auto_transition'] === null ? null : (bool) $record['is_auto_transition']) : null,
            'transition_id' => $this->support->parseNullableInt($record['transition_id'] ?? null),
            'work_started_at' => $this->normalizeNullableString($record['work_started_at'] ?? null),
            'work_ended_at' => $this->normalizeNullableString($record['work_ended_at'] ?? null),
            'hours_spent' => isset($record['hours_spent']) ? (float) $record['hours_spent'] : null,
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    private function applyCaseFilters(QueryBuilder $query, Request $request, ?int $actorId, bool $skipStatusFilter): void
    {
        if (! $skipStatusFilter) {
            $statusCode = $this->normalizeNullableString($request->query('status_code'));
            if ($statusCode !== null) {
                $query->where('crc.current_status_code', $statusCode);
            }
        }

        foreach ([
            'customer_id',
            'project_id',
            'project_item_id',
            'support_service_group_id',
            'dispatcher_user_id',
            'performer_user_id',
            'created_by',
            'received_by_user_id',
            'priority',
        ] as $column) {
            $value = $this->support->parseNullableInt($request->query($column));
            if ($value !== null) {
                $query->where("crc.{$column}", $value);
            }
        }

        $keyword = $this->normalizeNullableString($request->query('q', $request->query('search')));
        if ($keyword !== null) {
            $this->applyKeywordSearch($query, $keyword);
        }

        $myRole = $this->normalizeNullableString($request->query('my_role'));
        if ($actorId !== null && $myRole !== null) {
            match ($myRole) {
                'creator' => $query->where('crc.created_by', $actorId),
                'dispatcher' => $query->where(function (QueryBuilder $builder) use ($actorId): void {
                    $builder
                        ->where('crc.dispatcher_user_id', $actorId)
                        ->orWhere('crc.received_by_user_id', $actorId);
                }),
                'performer' => $query->where('crc.performer_user_id', $actorId),
                'receiver' => $query->where('crc.received_by_user_id', $actorId),
                'handler' => $query->whereIn('crc.project_id', $this->projectIdsForUserByRaciRoles($actorId)),
                default => null,
            };
        }

        $createdFrom = $this->normalizeDateTime($request->query('created_from'));
        if ($createdFrom !== null) {
            $query->where('crc.created_at', '>=', $createdFrom);
        }

        $createdTo = $this->normalizeDateTime($request->query('created_to'));
        if ($createdTo !== null) {
            $query->where('crc.created_at', '<=', $createdTo);
        }

        $updatedFrom = $this->normalizeDateTime($request->query('updated_from'));
        if ($updatedFrom !== null) {
            $query->where('crc.updated_at', '>=', $updatedFrom);
        }

        $updatedTo = $this->normalizeDateTime($request->query('updated_to'));
        if ($updatedTo !== null) {
            $query->where('crc.updated_at', '<=', $updatedTo);
        }

        $receivedFrom = $this->normalizeDateTime($request->query('received_from'));
        if ($receivedFrom !== null) {
            $query->where('crc.received_at', '>=', $receivedFrom);
        }

        $receivedTo = $this->normalizeDateTime($request->query('received_to'));
        if ($receivedTo !== null) {
            $query->where('crc.received_at', '<=', $receivedTo);
        }

        $overEstimate = $this->resolveBooleanInput($request->query('over_estimate'));
        if ($overEstimate === true) {
            $query
                ->whereNotNull('crc.estimated_hours')
                ->where('crc.estimated_hours', '>', 0)
                ->whereColumn('crc.total_hours_spent', '>', 'crc.estimated_hours');
        } elseif ($overEstimate === false) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereNull('crc.estimated_hours')
                    ->orWhere('crc.estimated_hours', '<=', 0)
                    ->orWhereColumn('crc.total_hours_spent', '<=', 'crc.estimated_hours');
            });
        }

        $missingEstimate = $this->resolveBooleanInput($request->query('missing_estimate'));
        if ($missingEstimate === true) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereNull('crc.estimated_hours')
                    ->orWhere('crc.estimated_hours', '<=', 0);
            });
        } elseif ($missingEstimate === false) {
            $query->whereNotNull('crc.estimated_hours')->where('crc.estimated_hours', '>', 0);
        }

        $slaRisk = $this->resolveBooleanInput($request->query('sla_risk'));
        if ($slaRisk === true) {
            $query
                ->whereNotIn('crc.current_status_code', ['completed', 'customer_notified', 'not_executed'])
                ->whereRaw($this->slaDueAtExpression().' IS NOT NULL')
                ->whereRaw($this->slaDueAtExpression().' <= ?', [now()->addDay()->format('Y-m-d H:i:s')]);
        } elseif ($slaRisk === false) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereIn('crc.current_status_code', ['completed', 'customer_notified', 'not_executed'])
                    ->orWhereRaw($this->slaDueAtExpression().' IS NULL')
                    ->orWhereRaw($this->slaDueAtExpression().' > ?', [now()->addDay()->format('Y-m-d H:i:s')]);
            });
        }
    }

    private function applyKeywordSearch(QueryBuilder $query, string $keyword): void
    {
        $normalizedKeyword = trim($keyword);
        if ($normalizedKeyword === '') {
            return;
        }

        $like = '%'.$normalizedKeyword.'%';
        $query->where(function (QueryBuilder $builder) use ($normalizedKeyword, $like): void {
            $builder
                ->where('crc.request_code', $normalizedKeyword)
                ->orWhere('crc.request_code', 'like', $like)
                ->orWhere('crc.summary', 'like', $like);

            if ($this->support->hasColumn('customer_request_cases', 'description')) {
                $builder->orWhere('crc.description', 'like', $like);
            }

            if ($this->support->hasTable('customers') && $this->support->hasColumn('customers', 'customer_name')) {
                $builder->orWhere('c.customer_name', 'like', $like);
            }

            if ($this->support->hasTable('customer_personnel') && $this->support->hasColumn('customer_personnel', 'full_name')) {
                $builder->orWhere('cp.full_name', 'like', $like);
            }

            if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'project_name')) {
                $builder->orWhere('p.project_name', 'like', $like);
            }

            if ($this->support->hasTable('internal_users') && $this->support->hasColumn('internal_users', 'full_name')) {
                $builder
                    ->orWhere('dispatcher.full_name', 'like', $like)
                    ->orWhere('performer_owner.full_name', 'like', $like)
                    ->orWhere('creator.full_name', 'like', $like)
                    ->orWhere('intake_receiver.full_name', 'like', $like);
            }
        });
    }

    private function resolveBooleanInput(mixed $value, ?bool $default = null): ?bool
    {
        if ($value === null || $value === '') {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        $normalized = Str::lower(trim((string) $value));

        if (in_array($normalized, ['1', 'true', 'yes', 'y', 'on'], true)) {
            return true;
        }

        if (in_array($normalized, ['0', 'false', 'no', 'n', 'off'], true)) {
            return false;
        }

        return $default;
    }

    private function normalizeNullableDate(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return Carbon::parse(str_replace('T', ' ', $normalized))->format('Y-m-d');
        } catch (\Throwable) {
            return $normalized;
        }
    }

    private function loadEstimatesForCase(int $caseId): array
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return [];
        }

        return DB::table('customer_request_estimates as estimate')
            ->leftJoin('internal_users as estimator', 'estimator.id', '=', 'estimate.estimated_by_user_id')
            ->where('estimate.request_case_id', $caseId)
            ->orderByDesc('estimate.estimated_at')
            ->orderByDesc('estimate.id')
            ->select([
                'estimate.*',
                DB::raw('estimator.full_name as estimated_by_name'),
                DB::raw('estimator.user_code as estimated_by_code'),
            ])
            ->get()
            ->map(fn (object $row): array => $this->serializeEstimateRow($row))
            ->values()
            ->all();
    }

    private function loadEstimateById(int $estimateId): ?array
    {
        if (! $this->support->hasTable('customer_request_estimates')) {
            return null;
        }

        $row = DB::table('customer_request_estimates as estimate')
            ->leftJoin('internal_users as estimator', 'estimator.id', '=', 'estimate.estimated_by_user_id')
            ->where('estimate.id', $estimateId)
            ->select([
                'estimate.*',
                DB::raw('estimator.full_name as estimated_by_name'),
                DB::raw('estimator.user_code as estimated_by_code'),
            ])
            ->first();

        return $row === null ? null : $this->serializeEstimateRow($row);
    }

    private function serializeEstimateRow(object|array $row): array
    {
        $record = is_object($row) ? (array) $row : $row;

        return [
            'id' => (int) ($record['id'] ?? 0),
            'request_case_id' => $this->support->parseNullableInt($record['request_case_id'] ?? null),
            'status_instance_id' => $this->support->parseNullableInt($record['status_instance_id'] ?? null),
            'status_code' => $this->normalizeNullableString($record['status_code'] ?? null),
            'estimated_hours' => $this->normalizeNullableDecimal($record['estimated_hours'] ?? null),
            'estimate_type' => $this->normalizeNullableString($record['estimate_type'] ?? null),
            'estimate_scope' => $this->normalizeNullableString($record['estimate_scope'] ?? null),
            'phase_label' => $this->normalizeNullableString($record['phase_label'] ?? null),
            'note' => $this->normalizeNullableString($record['note'] ?? null),
            'estimated_by_user_id' => $this->support->parseNullableInt($record['estimated_by_user_id'] ?? null),
            'estimated_by_name' => $this->normalizeNullableString($record['estimated_by_name'] ?? null),
            'estimated_by_code' => $this->normalizeNullableString($record['estimated_by_code'] ?? null),
            'estimated_at' => $this->normalizeNullableString($record['estimated_at'] ?? null),
            'created_at' => $this->normalizeNullableString($record['created_at'] ?? null),
            'updated_at' => $this->normalizeNullableString($record['updated_at'] ?? null),
        ];
    }

    private function buildHoursReportPayload(mixed $case): array
    {
        $record = $case instanceof CustomerRequestCase ? $case->toArray() : (is_object($case) ? (array) $case : $case);
        $caseId = $this->support->parseNullableInt($record['id'] ?? null) ?? 0;
        $estimatedHours = $this->normalizeNullableDecimal($record['estimated_hours'] ?? null);
        $totalHoursSpent = $this->normalizeNullableDecimal($record['total_hours_spent'] ?? null) ?? 0.0;
        $hoursUsagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent);
        $warningLevel = $this->resolveWarningLevel($estimatedHours, $totalHoursSpent);

        $worklogQuery = DB::table('customer_request_worklogs as wl')
            ->leftJoin('internal_users as performer', 'performer.id', '=', 'wl.performed_by_user_id')
            ->where('wl.request_case_id', $caseId);

        $worklogs = $worklogQuery
            ->select([
                'wl.*',
                DB::raw('performer.full_name as performed_by_name'),
            ])
            ->get();

        $byPerformer = $worklogs
            ->groupBy(fn (object $row): string => (string) ($row->performed_by_user_id ?? 0))
            ->map(function ($rows, string $performerId): array {
                $first = $rows->first();
                $hours = round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

                return [
                    'performed_by_user_id' => $performerId === '0' ? null : (int) $performerId,
                    'performed_by_name' => $this->normalizeNullableString($first->performed_by_name ?? null),
                    'hours_spent' => $hours,
                    'worklog_count' => $rows->count(),
                ];
            })
            ->values()
            ->all();

        $byActivity = $worklogs
            ->groupBy(fn (object $row): string => trim((string) ($row->activity_type_code ?? 'uncategorized')) ?: 'uncategorized')
            ->map(fn ($rows, string $activityCode): array => [
                'activity_type_code' => $activityCode,
                'hours_spent' => round((float) $rows->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2),
                'worklog_count' => $rows->count(),
            ])
            ->values()
            ->all();

        $billableHours = round((float) $worklogs->filter(fn (object $row): bool => (bool) ($row->is_billable ?? false))
            ->sum(fn (object $row): float => (float) ($row->hours_spent ?? 0)), 2);

        return [
            'request_case_id' => $caseId,
            'estimated_hours' => $estimatedHours,
            'total_hours_spent' => round($totalHoursSpent, 2),
            'remaining_hours' => $estimatedHours === null ? null : round($estimatedHours - $totalHoursSpent, 2),
            'hours_usage_pct' => $hoursUsagePct,
            'warning_level' => $warningLevel,
            'over_estimate' => $warningLevel === 'hard',
            'missing_estimate' => $estimatedHours === null || $estimatedHours <= 0,
            'latest_estimate' => $caseId > 0 ? ($this->loadEstimatesForCase($caseId)[0] ?? null) : null,
            'worklog_count' => $worklogs->count(),
            'billable_hours' => $billableHours,
            'non_billable_hours' => round($totalHoursSpent - $billableHours, 2),
            'by_performer' => $byPerformer,
            'by_activity' => $byActivity,
        ];
    }

    private function loadAttachmentAggregateForCase(int $caseId): array
    {
        if (! $this->support->hasTable('customer_request_status_attachments') || ! $this->support->hasTable('attachments')) {
            return [
                'count' => 0,
                'items' => [],
            ];
        }

        $query = DB::table('customer_request_status_attachments as pivot')
            ->join('customer_request_status_instances as instance', 'instance.id', '=', 'pivot.status_instance_id')
            ->join('attachments as a', 'a.id', '=', 'pivot.attachment_id')
            ->where('pivot.request_case_id', $caseId)
            ->orderByDesc('pivot.id');

        if ($this->support->hasColumn('attachments', 'deleted_at')) {
            $query->whereNull('a.deleted_at');
        }

        $items = $query
            ->select(array_values(array_filter([
                'pivot.id as pivot_id',
                'pivot.status_instance_id',
                'instance.status_code',
                'a.id',
                $this->support->hasColumn('attachments', 'file_name') ? 'a.file_name' : null,
                $this->support->hasColumn('attachments', 'file_url') ? 'a.file_url' : null,
                $this->support->hasColumn('attachments', 'mime_type') ? 'a.mime_type' : null,
                $this->support->hasColumn('attachments', 'file_size') ? 'a.file_size' : null,
                $this->support->hasColumn('attachments', 'created_at') ? 'a.created_at' : null,
            ])))
            ->get()
            ->map(fn (object $row): array => [
                'pivot_id' => (int) ($row->pivot_id ?? 0),
                'status_instance_id' => $this->support->parseNullableInt($row->status_instance_id ?? null),
                'status_code' => $this->normalizeNullableString($row->status_code ?? null),
                'id' => (string) ($row->id ?? ''),
                'fileName' => $this->normalizeNullableString($row->file_name ?? null),
                'fileUrl' => $this->normalizeNullableString($row->file_url ?? null),
                'mimeType' => $this->normalizeNullableString($row->mime_type ?? null),
                'fileSize' => isset($row->file_size) ? (int) $row->file_size : null,
                'createdAt' => $this->normalizeNullableString($row->created_at ?? null),
            ])
            ->values()
            ->all();

        return [
            'count' => count($items),
            'items' => $items,
        ];
    }

    private function buildSearchItem(array $case): array
    {
        return [
            'id' => (int) ($case['id'] ?? 0),
            'request_case_id' => (int) ($case['id'] ?? 0),
            'request_code' => $case['request_code'] ?? null,
            'label' => trim((string) (($case['request_code'] ?? '').' - '.($case['summary'] ?? ''))),
            'summary' => $case['summary'] ?? null,
            'customer_name' => $case['customer_name'] ?? null,
            'project_name' => $case['project_name'] ?? null,
            'dispatcher_name' => $case['dispatcher_name'] ?? null,
            'performer_name' => $case['performer_name'] ?? null,
            'current_status_code' => $case['current_status_code'] ?? null,
            'current_status_name_vi' => $case['current_status_name_vi'] ?? null,
            'updated_at' => $case['updated_at'] ?? null,
        ];
    }

    private function dashboardByRole(Request $request, string $role): JsonResponse
    {
        if (($missing = $this->missingTablesResponse()) !== null) {
            return $missing;
        }

        $actorId = $this->resolveActorId($request);
        $query = $this->baseCaseQuery($actorId);
        $this->applyCaseFilters($query, $request, $actorId, false);

        if ($actorId !== null) {
            match ($role) {
                'creator' => $query->where('crc.created_by', $actorId),
                'dispatcher' => $query->where(function (QueryBuilder $builder) use ($actorId): void {
                    $builder
                        ->where('crc.dispatcher_user_id', $actorId)
                        ->orWhere('crc.received_by_user_id', $actorId);
                }),
                'performer' => $query->where('crc.performer_user_id', $actorId),
                default => null,
            };
        }

        return response()->json([
            'data' => [
                'role' => $role,
                'summary' => [
                    'total_cases' => (clone $query)->count(),
                    'status_counts' => $this->collectStatusCounts(clone $query),
                    'alert_counts' => [
                        'over_estimate' => $this->countOverEstimate(clone $query),
                        'missing_estimate' => $this->countMissingEstimate(clone $query),
                        'sla_risk' => $this->countSlaRisk(clone $query),
                    ],
                ],
                'top_customers' => $this->collectTopCustomers(clone $query),
                'top_projects' => $this->collectTopProjects(clone $query),
                'top_performers' => $this->collectTopPerformers(clone $query),
                'attention_cases' => $this->collectAttentionCases(clone $query, 10),
            ],
        ]);
    }

    private function collectStatusCounts(QueryBuilder $query): array
    {
        return (clone $query)
            ->select([
                'crc.current_status_code',
                DB::raw('COUNT(*) as aggregate'),
            ])
            ->groupBy('crc.current_status_code')
            ->orderBy('crc.current_status_code')
            ->get()
            ->map(fn (object $row): array => [
                'status_code' => (string) $row->current_status_code,
                'count' => (int) $row->aggregate,
            ])
            ->values()
            ->all();
    }

    private function countOverEstimate(QueryBuilder $query): int
    {
        return (clone $query)
            ->whereNotNull('crc.estimated_hours')
            ->where('crc.estimated_hours', '>', 0)
            ->whereColumn('crc.total_hours_spent', '>', 'crc.estimated_hours')
            ->count();
    }

    private function countMissingEstimate(QueryBuilder $query): int
    {
        return (clone $query)
            ->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereNull('crc.estimated_hours')
                    ->orWhere('crc.estimated_hours', '<=', 0);
            })
            ->count();
    }

    private function countSlaRisk(QueryBuilder $query): int
    {
        return (clone $query)
            ->whereNotIn('crc.current_status_code', ['completed', 'customer_notified', 'not_executed'])
            ->whereRaw($this->slaDueAtExpression().' IS NOT NULL')
            ->whereRaw($this->slaDueAtExpression().' <= ?', [now()->addDay()->format('Y-m-d H:i:s')])
            ->count();
    }

    private function collectTopCustomers(QueryBuilder $query): array
    {
        return (clone $query)
            ->whereNotNull('crc.customer_id')
            ->select([
                'crc.customer_id',
                DB::raw('MAX(c.customer_name) as customer_name'),
                DB::raw('COUNT(*) as aggregate'),
            ])
            ->groupBy('crc.customer_id')
            ->orderByDesc('aggregate')
            ->orderBy('crc.customer_id')
            ->limit(5)
            ->get()
            ->map(fn (object $row): array => [
                'customer_id' => (int) $row->customer_id,
                'customer_name' => $this->normalizeNullableString($row->customer_name ?? null),
                'count' => (int) $row->aggregate,
            ])
            ->values()
            ->all();
    }

    private function collectTopProjects(QueryBuilder $query): array
    {
        return (clone $query)
            ->whereNotNull('crc.project_id')
            ->select([
                'crc.project_id',
                DB::raw('MAX(p.project_name) as project_name'),
                DB::raw('COUNT(*) as aggregate'),
            ])
            ->groupBy('crc.project_id')
            ->orderByDesc('aggregate')
            ->orderBy('crc.project_id')
            ->limit(5)
            ->get()
            ->map(fn (object $row): array => [
                'project_id' => (int) $row->project_id,
                'project_name' => $this->normalizeNullableString($row->project_name ?? null),
                'count' => (int) $row->aggregate,
            ])
            ->values()
            ->all();
    }

    private function collectTopPerformers(QueryBuilder $query): array
    {
        return (clone $query)
            ->whereNotNull('crc.performer_user_id')
            ->select([
                'crc.performer_user_id',
                DB::raw('MAX(performer_owner.full_name) as performer_name'),
                DB::raw('COUNT(*) as aggregate'),
            ])
            ->groupBy('crc.performer_user_id')
            ->orderByDesc('aggregate')
            ->orderBy('crc.performer_user_id')
            ->limit(5)
            ->get()
            ->map(fn (object $row): array => [
                'performer_user_id' => (int) $row->performer_user_id,
                'performer_name' => $this->normalizeNullableString($row->performer_name ?? null),
                'count' => (int) $row->aggregate,
            ])
            ->values()
            ->all();
    }

    private function collectAttentionCases(QueryBuilder $query, int $limit): array
    {
        return (clone $query)
            ->orderByDesc('crc.updated_at')
            ->orderByDesc('crc.id')
            ->limit(max(1, $limit * 4))
            ->get()
            ->map(fn (object $row): array => $this->serializeCaseRow($row))
            ->filter(function (array $case): bool {
                return (bool) ($case['over_estimate'] ?? false)
                    || (bool) ($case['missing_estimate'] ?? false)
                    || in_array((string) ($case['sla_status'] ?? ''), ['at_risk', 'overdue'], true);
            })
            ->map(function (array $case): array {
                $reasons = [];
                if (($case['over_estimate'] ?? false) === true) {
                    $reasons[] = 'over_estimate';
                }
                if (($case['missing_estimate'] ?? false) === true) {
                    $reasons[] = 'missing_estimate';
                }
                if (in_array((string) ($case['sla_status'] ?? ''), ['at_risk', 'overdue'], true)) {
                    $reasons[] = 'sla_risk';
                }

                return [
                    'request_case' => $case,
                    'reasons' => $reasons,
                ];
            })
            ->take($limit)
            ->values()
            ->all();
    }

    private function recalculateCaseHours(int $caseId, ?int $actorId): array
    {
        $totalHoursSpent = (float) DB::table('customer_request_worklogs')
            ->where('request_case_id', $caseId)
            ->sum('hours_spent');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update($this->filterByTableColumns('customer_request_cases', [
                'total_hours_spent' => round($totalHoursSpent, 2),
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]));

        $case = CustomerRequestCase::query()->find($caseId);

        return $case === null
            ? [
                'request_case_id' => $caseId,
                'estimated_hours' => null,
                'total_hours_spent' => round($totalHoursSpent, 2),
            ]
            : $this->buildHoursReportPayload($case);
    }

    private function buildAvailableActions(CustomerRequestCase $case, ?int $userId): array
    {
        $canWrite = $this->canWriteCase($case, $userId);
        $currentStatusCode = (string) ($case->current_status_code ?? '');

        return [
            'can_write' => $canWrite,
            'can_transition' => $canWrite && $currentStatusCode !== '',
            'can_transition_backward' => $canWrite && $this->allowedStatusDefinitions($currentStatusCode, 'backward') !== [],
            'can_transition_forward' => $canWrite && $this->allowedStatusDefinitions($currentStatusCode, 'forward') !== [],
            'can_add_worklog' => $canWrite,
            'can_add_estimate' => $canWrite,
            'can_delete' => $userId === null ? true : $this->userAccess->isAdmin($userId),
        ];
    }

    private function calculateHoursUsagePct(?float $estimatedHours, float $totalHoursSpent): ?float
    {
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return null;
        }

        return round(($totalHoursSpent / $estimatedHours) * 100, 2);
    }

    private function resolveWarningLevel(?float $estimatedHours, float $totalHoursSpent): string
    {
        if ($estimatedHours === null || $estimatedHours <= 0) {
            return 'missing';
        }

        $usagePct = $this->calculateHoursUsagePct($estimatedHours, $totalHoursSpent) ?? 0.0;
        if ($usagePct >= 100) {
            return 'hard';
        }

        if ($usagePct >= 80) {
            return 'soft';
        }

        return 'normal';
    }

    private function buildSlaStatus(mixed $dueAt, string $statusCode): ?string
    {
        if (in_array($statusCode, ['completed', 'customer_notified', 'not_executed'], true)) {
            return 'closed';
        }

        $normalizedDueAt = $this->normalizeDateTime($dueAt);
        if ($normalizedDueAt === null) {
            return null;
        }

        try {
            $due = Carbon::parse($normalizedDueAt);
        } catch (\Throwable) {
            return null;
        }

        if ($due->isPast()) {
            return 'overdue';
        }

        if ($due->lessThanOrEqualTo(now()->addDay())) {
            return 'at_risk';
        }

        return 'on_track';
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

    private function baseCaseQuery(?int $userId)
    {
        $query = DB::table('customer_request_cases as crc')->whereNull('crc.deleted_at');
        $selects = ['crc.*'];

        if ($this->support->hasTable('customer_request_status_catalogs')) {
            $query->leftJoin('customer_request_status_catalogs as status_catalog', 'status_catalog.status_code', '=', 'crc.current_status_code');
            $selects[] = 'status_catalog.status_name_vi as current_status_name_vi';
        }

        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as c', 'c.id', '=', 'crc.customer_id');
            if ($this->support->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
        }

        if ($this->support->hasTable('customer_personnel')) {
            $query->leftJoin('customer_personnel as cp', 'cp.id', '=', 'crc.customer_personnel_id');
            if ($this->support->hasColumn('customer_personnel', 'full_name')) {
                $selects[] = 'cp.full_name as requester_name';
            }
        }

        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as p', 'p.id', '=', 'crc.project_id');
            if ($this->support->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
        }

        if ($this->support->hasTable('support_service_groups')) {
            $query->leftJoin('support_service_groups as ssg', 'ssg.id', '=', 'crc.support_service_group_id');
            if ($this->support->hasColumn('support_service_groups', 'group_name')) {
                $selects[] = 'ssg.group_name as support_service_group_name';
            }
        }

        if ($this->support->hasTable('internal_users')) {
            $query
                ->leftJoin('internal_users as creator', 'creator.id', '=', 'crc.created_by')
                ->leftJoin('internal_users as updater', 'updater.id', '=', 'crc.updated_by');

            if ($this->support->hasColumn('customer_request_cases', 'received_by_user_id')) {
                $query->leftJoin('internal_users as intake_receiver', 'intake_receiver.id', '=', 'crc.received_by_user_id');
            }

            if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                $query->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crc.dispatcher_user_id');
            }

            if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                $query->leftJoin('internal_users as performer_owner', 'performer_owner.id', '=', 'crc.performer_user_id');
            }

            if ($this->support->hasColumn('internal_users', 'full_name')) {
                if ($this->support->hasColumn('customer_request_cases', 'received_by_user_id')) {
                    $selects[] = 'intake_receiver.full_name as received_by_name';
                }
                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $selects[] = 'dispatcher.full_name as dispatcher_name';
                }
                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $selects[] = 'performer_owner.full_name as performer_name';
                }
                $selects[] = 'creator.full_name as created_by_name';
                $selects[] = 'updater.full_name as updated_by_name';
            }
        }

        if ($this->support->hasTable('customer_request_in_progress')) {
            $query->leftJoin('customer_request_in_progress as in_progress_status', 'in_progress_status.status_instance_id', '=', 'crc.current_status_instance_id');
        }

        if ($this->support->hasTable('customer_request_waiting_customer_feedbacks')) {
            $query->leftJoin('customer_request_waiting_customer_feedbacks as waiting_feedback_status', 'waiting_feedback_status.status_instance_id', '=', 'crc.current_status_instance_id');
        }

        $selects[] = DB::raw($this->slaDueAtExpression().' as sla_due_at');

        $query->select($selects);

        if ($userId !== null && ! $this->userAccess->isAdmin($userId)) {
            $projectIds = $this->projectIdsForUserByRaciRoles($userId);
            $query->where(function (QueryBuilder $builder) use ($userId, $projectIds): void {
                $builder
                    ->where('crc.created_by', $userId)
                    ->orWhere('crc.received_by_user_id', $userId);

                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $builder->orWhere('crc.dispatcher_user_id', $userId);
                }

                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $builder->orWhere('crc.performer_user_id', $userId);
                }

                if ($projectIds !== []) {
                    $builder->orWhereIn('crc.project_id', $projectIds);
                }
            });
        }

        return $query;
    }

    private function projectIdsForUserByRaciRoles(int $userId, array $roles = ['A', 'R']): array
    {
        $normalizedRoles = array_values(array_unique(array_filter(array_map(
            static fn (string $role): string => strtoupper(trim($role)),
            $roles
        ))));
        $cacheKey = $userId.':'.implode(',', $normalizedRoles);

        if (array_key_exists($cacheKey, $this->projectScopeCache)) {
            return $this->projectScopeCache[$cacheKey];
        }

        if (
            ! $this->support->hasTable('raci_assignments')
            || ! $this->support->hasColumn('raci_assignments', 'entity_type')
            || ! $this->support->hasColumn('raci_assignments', 'entity_id')
            || ! $this->support->hasColumn('raci_assignments', 'user_id')
            || ! $this->support->hasColumn('raci_assignments', 'raci_role')
        ) {
            return $this->projectScopeCache[$cacheKey] = [];
        }

        return $this->projectScopeCache[$cacheKey] = DB::table('raci_assignments')
            ->whereRaw('LOWER(entity_type) = ?', ['project'])
            ->where('user_id', $userId)
            ->whereIn('raci_role', $normalizedRoles)
            ->pluck('entity_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function slaDueAtExpression(): string
    {
        $expressions = [];

        if ($this->support->hasTable('customer_request_in_progress') && $this->support->hasColumn('customer_request_in_progress', 'expected_completed_at')) {
            $expressions[] = 'in_progress_status.expected_completed_at';
        }

        if (
            $this->support->hasTable('customer_request_waiting_customer_feedbacks')
            && $this->support->hasColumn('customer_request_waiting_customer_feedbacks', 'customer_due_at')
        ) {
            $expressions[] = 'waiting_feedback_status.customer_due_at';
        }

        if ($expressions === []) {
            return 'NULL';
        }

        if (count($expressions) === 1) {
            return $expressions[0];
        }

        return 'COALESCE('.implode(', ', $expressions).')';
    }

    private function missingTablesResponse(): ?JsonResponse
    {
        foreach ($this->requiredTables() as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
        }

        return null;
    }

    /**
     * @return array<int, string>
     */
    private function requiredTables(): array
    {
        return [
            'customer_request_cases',
            'customer_request_status_catalogs',
            'customer_request_status_transitions',
            'customer_request_status_instances',
            'customer_request_worklogs',
            'customer_request_status_ref_tasks',
            'customer_request_status_attachments',
            ...CustomerRequestCaseRegistry::tables(),
        ];
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
        $allowedColumns = array_flip($this->tableColumns($table));
        $filtered = [];
        foreach ($payload as $key => $value) {
            if (isset($allowedColumns[$key])) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    /**
     * @return array<int, string>
     */
    private function tableColumns(string $table): array
    {
        if (! isset($this->tableColumns[$table])) {
            $this->tableColumns[$table] = Schema::hasTable($table)
                ? Schema::getColumnListing($table)
                : [];
        }

        return $this->tableColumns[$table];
    }

    private function generateRequestCode(): string
    {
        $prefix = 'CRC-'.now()->format('Ym').'-';
        $latest = DB::table('customer_request_cases')
            ->where('request_code', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->value('request_code');

        $sequence = 1;
        if (is_string($latest) && preg_match('/(\d+)$/', $latest, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return sprintf('%s%04d', $prefix, $sequence);
    }

    /**
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function appendAuditLog(string $event, string $auditableType, int $auditableId, ?array $oldValues, ?array $newValues, ?int $actorId): void
    {
        if (! $this->support->hasTable('audit_logs')) {
            return;
        }

        try {
            $payload = $this->filterByTableColumns('audit_logs', [
                'uuid' => (string) Str::uuid(),
                'event' => $event,
                'auditable_type' => $auditableType,
                'auditable_id' => $auditableId,
                'old_values' => $oldValues === null ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'new_values' => $newValues === null ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'created_by' => $actorId,
                'created_at' => now(),
            ]);

            if ($payload !== []) {
                DB::table('audit_logs')->insert($payload);
            }
        } catch (\Throwable) {
            // Không chặn luồng chính nếu audit không ghi được.
        }
    }
}
