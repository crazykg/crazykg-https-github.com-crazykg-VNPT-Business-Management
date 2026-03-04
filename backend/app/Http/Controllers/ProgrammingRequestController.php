<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProgrammingRequestRequest;
use App\Http\Requests\StoreWorklogRequest;
use App\Http\Requests\UpdateProgrammingRequestRequest;
use App\Http\Requests\UpdateWorklogRequest;
use App\Models\ProgrammingRequest;
use App\Models\ProgrammingRequestWorklog;
use App\Services\V5\Workflow\StatusDrivenSlaResolver;
use App\Services\V5\Workflow\WorkflowFlowResolver;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgrammingRequestController extends Controller
{
    private const REQUEST_CODE_PREFIX = 'YC';

    public function index(Request $request): JsonResponse
    {
        if (! Schema::hasTable('programming_requests')) {
            return response()->json([
                'message' => 'Table programming_requests is not available.',
                'data' => [],
                'meta' => [
                    'page' => 1,
                    'per_page' => 10,
                    'total' => 0,
                    'total_pages' => 1,
                ],
            ], 503);
        }

        $baseQuery = ProgrammingRequest::query();
        $this->applyFilters($baseQuery, $request);

        $query = (clone $baseQuery)
            ->with([
                'coder:id,user_code,full_name,username',
                'customer:id,customer_code,customer_name',
                'project:id,project_code,project_name',
                'product:id,product_code,product_name',
                'referenceRequest:id,req_code,req_name,status',
            ]);

        $sortBy = (string) $request->query('sort_by', 'id');
        $sortDir = strtolower((string) $request->query('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSortColumns = [
            'id',
            'req_code',
            'req_name',
            'status',
            'priority',
            'requested_date',
            'code_progress',
            'overall_progress',
            'created_at',
            'updated_at',
        ];
        if (! in_array($sortBy, $allowedSortColumns, true)) {
            $sortBy = 'id';
        }

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'id') {
            $query->orderBy('id', 'desc');
        }

        $page = max((int) $request->query('page', 1), 1);
        $perPage = max(min((int) $request->query('per_page', 10), 100), 1);

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $aggregate = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_requests')
            ->selectRaw("SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as new_count")
            ->selectRaw("SUM(CASE WHEN status = 'ANALYZING' THEN 1 ELSE 0 END) as analyzing_count")
            ->selectRaw("SUM(CASE WHEN status = 'CODING' THEN 1 ELSE 0 END) as coding_count")
            ->selectRaw("SUM(CASE WHEN status = 'PENDING_UPCODE' THEN 1 ELSE 0 END) as pending_upcode_count")
            ->selectRaw("SUM(CASE WHEN status IN ('UPCODED', 'NOTIFIED', 'CLOSED') THEN 1 ELSE 0 END) as completed_count")
            ->first();

        $statusCounts = (clone $baseQuery)
            ->select(['status', DB::raw('COUNT(*) as total')])
            ->groupBy('status')
            ->get()
            ->reduce(function (array $carry, object $row): array {
                $status = strtoupper(trim((string) ($row->status ?? '')));
                if ($status === '') {
                    return $carry;
                }

                $carry[$status] = (int) ($row->total ?? 0);
                return $carry;
            }, []);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (ProgrammingRequest $item): array => $this->serializeProgrammingRequest($item))->values(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'total_pages' => $paginator->lastPage(),
                'kpis' => [
                    'total_requests' => (int) ($aggregate->total_requests ?? 0),
                    'new_count' => (int) ($aggregate->new_count ?? 0),
                    'analyzing_count' => (int) ($aggregate->analyzing_count ?? 0),
                    'coding_count' => (int) ($aggregate->coding_count ?? 0),
                    'pending_upcode_count' => (int) ($aggregate->pending_upcode_count ?? 0),
                    'completed_count' => (int) ($aggregate->completed_count ?? 0),
                    'status_counts' => $statusCounts,
                ],
            ],
        ]);
    }

    public function nextCode(): JsonResponse
    {
        if (! Schema::hasTable('programming_requests')) {
            return response()->json([
                'message' => 'Table programming_requests is not available.',
                'data' => [
                    'req_code' => null,
                ],
            ], 503);
        }

        $nextId = $this->resolveNextProgrammingRequestId();

        return response()->json([
            'data' => [
                'req_code' => $this->generateReqCodeFromId($nextId),
            ],
        ]);
    }

    public function referenceSearch(Request $request): JsonResponse
    {
        if (! Schema::hasTable('programming_requests')) {
            return response()->json(['data' => []]);
        }

        $queryText = trim((string) ($request->query('q', '') ?? ''));
        $excludeId = $this->parseNullableInt($request->query('exclude_id'));
        $limit = (int) ($request->query('limit', 20) ?? 20);
        $limit = max(1, min(50, $limit));

        $query = ProgrammingRequest::query()
            ->select([
                'id',
                'req_code',
                'req_name',
                'status',
                'requested_date',
                'depth',
            ]);

        if ($excludeId !== null) {
            $query->where('id', '<>', $excludeId);
        }

        if ($queryText !== '') {
            $like = '%'.$queryText.'%';
            $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

            $query->where(function (Builder $builder) use ($like, $compact): void {
                $builder
                    ->where('req_code', 'like', $like)
                    ->orWhere('req_name', 'like', $like);

                if ($compact !== '') {
                    $builder->orWhereRaw(
                        "REPLACE(REPLACE(REPLACE(UPPER(req_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                        ['%'.strtoupper($compact).'%']
                    );
                }
            });

            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
            $query->orderByRaw(
                "CASE
                    WHEN UPPER(req_code) = UPPER(?) THEN 0
                    WHEN UPPER(req_code) LIKE UPPER(?) THEN 1
                    WHEN UPPER(req_code) LIKE UPPER(?) THEN 2
                    WHEN UPPER(req_name) LIKE UPPER(?) THEN 3
                    ELSE 4
                 END",
                [$queryText, $escaped.'%', '%'.$escaped.'%', '%'.$escaped.'%']
            );
        }

        $rows = $query
            ->orderByDesc('requested_date')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (ProgrammingRequest $item): array => [
                'id' => (int) $item->id,
                'req_code' => (string) $item->req_code,
                'req_name' => (string) $item->req_name,
                'status' => (string) $item->status,
                'requested_date' => optional($item->requested_date)->format('Y-m-d'),
                'depth' => (int) $item->depth,
            ])
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filename = 'programming_requests_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $output = fopen('php://output', 'wb');
            if (! is_resource($output)) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'Mã YC',
                'Tên YC',
                'Sản phẩm',
                'Khách hàng',
                'Loại',
                'Trạng thái',
                'Tiến độ (%)',
                'Hạn phân tích',
                'Hạn code',
                'Ngày TBKH',
                'Dev',
                'Ngày nhận yêu cầu',
            ]);

            $page = 1;
            $perPage = 100;
            while (true) {
                $pageRequest = Request::create('/api/v5/programming-requests', 'GET', array_merge(
                    $request->query(),
                    [
                        'page' => $page,
                        'per_page' => $perPage,
                    ]
                ));
                $pageRequest->setUserResolver($request->getUserResolver());

                /** @var JsonResponse $response */
                $response = $this->index($pageRequest);
                $payload = $response->getData(true);
                $rows = is_array($payload['data'] ?? null) ? $payload['data'] : [];
                if ($rows === []) {
                    break;
                }

                foreach ($rows as $row) {
                    if (! is_array($row)) {
                        continue;
                    }

                    fputcsv($output, [
                        (string) ($row['req_code'] ?? ''),
                        (string) ($row['req_name'] ?? ''),
                        (string) ($row['product_name'] ?? ''),
                        (string) ($row['customer_name'] ?? ''),
                        (string) ($row['req_type'] ?? ''),
                        (string) ($row['status'] ?? ''),
                        (string) ($row['overall_progress'] ?? ''),
                        (string) ($row['analyze_end_date'] ?? ''),
                        (string) ($row['code_end_date'] ?? ''),
                        (string) ($row['noti_date'] ?? ''),
                        (string) ($row['coder_name'] ?? ''),
                        (string) ($row['requested_date'] ?? ''),
                    ]);
                }

                if (count($rows) < $perPage) {
                    break;
                }
                $page++;
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }

    public function store(StoreProgrammingRequestRequest $request): JsonResponse
    {
        $payload = $request->validated();
        unset($payload['req_code']);
        $payload = $this->enrichPayloadWithProjectItem($payload);
        $this->touchWorkflowResolversForProgramming(
            (string) ($payload['status'] ?? 'NEW'),
            $this->resolveProgrammingSubStatusFromStatus((string) ($payload['status'] ?? 'NEW')),
            isset($payload['priority']) ? (int) $payload['priority'] : null
        );
        $actorId = $this->resolveActorId($request);

        if ($actorId !== null) {
            $payload['created_by'] = $actorId;
            $payload['updated_by'] = $actorId;
        }

        $created = $this->createWithGeneratedReqCode($payload);

        return response()->json([
            'data' => $this->serializeProgrammingRequest($created->load([
                'coder:id,user_code,full_name,username',
                'customer:id,customer_code,customer_name',
                'project:id,project_code,project_name',
                'product:id,product_code,product_name',
                'referenceRequest:id,req_code,req_name,status',
            ])),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $item = ProgrammingRequest::query()
            ->with([
                'parent:id,req_code,req_name,status',
                'referenceRequest:id,req_code,req_name,status',
                'coder:id,user_code,full_name,username',
                'customer:id,customer_code,customer_name',
                'project:id,project_code,project_name',
                'product:id,product_code,product_name',
                'worklogs' => fn ($query) => $query
                    ->with(['createdBy:id,user_code,full_name,username'])
                    ->orderByDesc('logged_date')
                    ->orderByDesc('id'),
            ])
            ->findOrFail($id);

        return response()->json([
            'data' => $this->serializeProgrammingRequest($item, true),
        ]);
    }

    public function update(UpdateProgrammingRequestRequest $request, int $id): JsonResponse
    {
        $item = ProgrammingRequest::query()->findOrFail($id);
        $payload = $request->validated();
        unset($payload['req_code']);
        $payload = $this->enrichPayloadWithProjectItem($payload, $item);
        $status = (string) ($payload['status'] ?? $item->status ?? 'NEW');
        $priority = array_key_exists('priority', $payload)
            ? $this->parseNullableInt($payload['priority'])
            : ($item->priority === null ? null : (int) $item->priority);
        $this->touchWorkflowResolversForProgramming(
            $status,
            $this->resolveProgrammingSubStatusFromStatus($status),
            $priority
        );
        $actorId = $this->resolveActorId($request);

        if ($actorId !== null) {
            $payload['updated_by'] = $actorId;
        }

        $item->fill($payload);
        $item->save();

        return response()->json([
            'data' => $this->serializeProgrammingRequest($item->loadMissing([
                'coder:id,user_code,full_name,username',
                'customer:id,customer_code,customer_name',
                'project:id,project_code,project_name',
                'product:id,product_code,product_name',
                'referenceRequest:id,req_code,req_name,status',
            ])),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $item = ProgrammingRequest::query()->findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function worklogIndex(Request $request, int $id): JsonResponse
    {
        $programmingRequest = ProgrammingRequest::query()->findOrFail($id);

        $perPage = max(min((int) $request->query('per_page', 50), 200), 1);
        $page = max((int) $request->query('page', 1), 1);

        $worklogs = ProgrammingRequestWorklog::query()
            ->where('programming_request_id', $programmingRequest->id)
            ->with([
                'createdBy:id,user_code,full_name,username',
                'updatedBy:id,user_code,full_name,username',
            ])
            ->orderByDesc('logged_date')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        $summary = ProgrammingRequestWorklog::query()
            ->select([
                'phase',
                DB::raw('COALESCE(SUM(hours_spent), 0) as hours_spent_sum'),
                DB::raw('COALESCE(SUM(hours_estimated), 0) as hours_estimated_sum'),
            ])
            ->where('programming_request_id', $programmingRequest->id)
            ->groupBy('phase')
            ->orderBy('phase')
            ->get()
            ->map(fn ($row): array => [
                'phase' => (string) $row->phase,
                'hours_spent_sum' => (float) $row->hours_spent_sum,
                'hours_estimated_sum' => (float) $row->hours_estimated_sum,
            ])
            ->values();

        return response()->json([
            'data' => collect($worklogs->items())->map(fn (ProgrammingRequestWorklog $worklog): array => $this->serializeWorklog($worklog))->values(),
            'summary' => $summary,
            'meta' => [
                'page' => $worklogs->currentPage(),
                'per_page' => $worklogs->perPage(),
                'total' => $worklogs->total(),
                'total_pages' => $worklogs->lastPage(),
            ],
        ]);
    }

    public function worklogStore(StoreWorklogRequest $request, int $id): JsonResponse
    {
        $programmingRequest = ProgrammingRequest::query()->findOrFail($id);
        $payload = $request->validated();
        $payload['programming_request_id'] = $programmingRequest->id;

        $actorId = $this->resolveActorId($request);
        if ($actorId !== null) {
            $payload['created_by'] = $actorId;
            $payload['updated_by'] = $actorId;
        }

        $worklog = ProgrammingRequestWorklog::query()->create($payload);

        return response()->json([
            'data' => $this->serializeWorklog($worklog->loadMissing([
                'createdBy:id,user_code,full_name,username',
                'updatedBy:id,user_code,full_name,username',
            ])),
        ], 201);
    }

    public function worklogUpdate(UpdateWorklogRequest $request, int $id, int $worklogId): JsonResponse
    {
        ProgrammingRequest::query()->findOrFail($id);
        $worklog = ProgrammingRequestWorklog::query()
            ->withTrashed()
            ->where('programming_request_id', $id)
            ->whereKey($worklogId)
            ->firstOrFail();

        if ($worklog->deleted_at !== null) {
            return response()->json(['message' => 'Cannot modify a deleted worklog.'], 403);
        }

        $payload = $request->validated();
        $actorId = $this->resolveActorId($request);
        if ($actorId !== null) {
            $payload['updated_by'] = $actorId;
        }

        $worklog->fill($payload);
        $worklog->save();

        return response()->json([
            'data' => $this->serializeWorklog($worklog->loadMissing([
                'createdBy:id,user_code,full_name,username',
                'updatedBy:id,user_code,full_name,username',
            ])),
        ]);
    }

    public function worklogDestroy(Request $request, int $id, int $worklogId): JsonResponse
    {
        ProgrammingRequest::query()->findOrFail($id);
        $worklog = ProgrammingRequestWorklog::query()
            ->withTrashed()
            ->where('programming_request_id', $id)
            ->whereKey($worklogId)
            ->firstOrFail();

        if ($worklog->deleted_at !== null) {
            return response()->json(['message' => 'Cannot modify a deleted worklog.'], 403);
        }

        $actorId = $this->resolveActorId($request);
        if ($actorId !== null) {
            $worklog->updated_by = $actorId;
            $worklog->save();
        }

        $worklog->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        $statusParam = $request->query('status', $request->query('filters.status'));
        $statuses = $this->normalizeListFilter($statusParam);
        if (count($statuses) > 0) {
            $query->whereIn('status', $statuses);
        }

        $reqType = trim((string) ($request->query('req_type', $request->query('filters.req_type', ''))));
        if ($reqType !== '') {
            $query->where('req_type', strtoupper($reqType));
        }

        $coderId = $this->parseNullableInt($request->query('coder_id', $request->query('filters.coder_id')));
        if ($coderId !== null) {
            $query->where('coder_id', $coderId);
        }

        $customerId = $this->parseNullableInt($request->query('customer_id', $request->query('filters.customer_id')));
        if ($customerId !== null) {
            $query->where('customer_id', $customerId);
        }

        $projectId = $this->parseNullableInt($request->query('project_id', $request->query('filters.project_id')));
        if ($projectId !== null) {
            $query->where('project_id', $projectId);
        }

        $requestedDateFrom = trim((string) $request->query('requested_date_from', $request->query('filters.requested_date_from', '')));
        $requestedDateTo = trim((string) $request->query('requested_date_to', $request->query('filters.requested_date_to', '')));
        $fromTimestamp = $requestedDateFrom !== '' ? strtotime($requestedDateFrom) : false;
        $toTimestamp = $requestedDateTo !== '' ? strtotime($requestedDateTo) : false;
        if ($requestedDateFrom !== '' && $requestedDateTo !== '' && $fromTimestamp !== false && $toTimestamp !== false) {
            if ($fromTimestamp !== false && $toTimestamp !== false && $fromTimestamp > $toTimestamp) {
                $query->whereRaw('1 = 0');

                return;
            }
        }
        if ($requestedDateFrom !== '' && $fromTimestamp !== false) {
            $query->whereDate('requested_date', '>=', $requestedDateFrom);
        }
        if ($requestedDateTo !== '' && $toTimestamp !== false) {
            $query->whereDate('requested_date', '<=', $requestedDateTo);
        }

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $query->where(function (Builder $builder) use ($keyword): void {
                $like = '%'.$keyword.'%';
                $builder
                    ->where('req_code', 'like', $like)
                    ->orWhere('req_name', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('ticket_code', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhereHas('customer', function (Builder $relationQuery) use ($like): void {
                        $relationQuery
                            ->where('customer_name', 'like', $like)
                            ->orWhere('customer_code', 'like', $like);
                    })
                    ->orWhereHas('product', function (Builder $relationQuery) use ($like): void {
                        $relationQuery
                            ->where('product_name', 'like', $like)
                            ->orWhere('product_code', 'like', $like);
                    })
                    ->orWhereHas('coder', function (Builder $relationQuery) use ($like): void {
                        $relationQuery
                            ->where('full_name', 'like', $like)
                            ->orWhere('user_code', 'like', $like)
                            ->orWhere('username', 'like', $like);
                    });
            });
        }
    }

    private function serializeProgrammingRequest(ProgrammingRequest $item, bool $includeWorklogs = false): array
    {
        $payload = [
            'id' => $item->id,
            'uuid' => (string) $item->uuid,
            'req_code' => (string) $item->req_code,
            'req_name' => (string) $item->req_name,
            'ticket_code' => $item->ticket_code,
            'task_link' => $item->task_link,
            'parent_id' => $item->parent_id,
            'depth' => (int) $item->depth,
            'reference_request_id' => $item->reference_request_id,
            'source_type' => (string) $item->source_type,
            'req_type' => (string) $item->req_type,
            'service_group_id' => $item->service_group_id,
            'support_request_id' => $item->support_request_id,
            'priority' => $item->priority === null ? null : (int) $item->priority,
            'overall_progress' => $item->overall_progress === null ? null : (int) $item->overall_progress,
            'status' => (string) $item->status,
            'description' => $item->description,
            'doc_link' => $item->doc_link,
            'customer_id' => $item->customer_id,
            'requested_date' => optional($item->requested_date)->format('Y-m-d'),
            'reporter_name' => $item->reporter_name,
            'reporter_contact_id' => $item->reporter_contact_id,
            'receiver_id' => $item->receiver_id,
            'project_id' => $item->project_id,
            'product_id' => $item->product_id,
            'project_item_id' => $item->project_item_id,
            'analyze_estimated_hours' => $item->analyze_estimated_hours === null ? null : (float) $item->analyze_estimated_hours,
            'analyze_start_date' => optional($item->analyze_start_date)->format('Y-m-d'),
            'analyze_end_date' => optional($item->analyze_end_date)->format('Y-m-d'),
            'analyze_extend_date' => optional($item->analyze_extend_date)->format('Y-m-d'),
            'analyzer_id' => $item->analyzer_id,
            'analyze_progress' => $item->analyze_progress === null ? null : (int) $item->analyze_progress,
            'code_estimated_hours' => $item->code_estimated_hours === null ? null : (float) $item->code_estimated_hours,
            'code_start_date' => optional($item->code_start_date)->format('Y-m-d'),
            'code_end_date' => optional($item->code_end_date)->format('Y-m-d'),
            'code_extend_date' => optional($item->code_extend_date)->format('Y-m-d'),
            'code_actual_date' => optional($item->code_actual_date)->format('Y-m-d'),
            'coder_id' => $item->coder_id,
            'code_progress' => $item->code_progress === null ? null : (int) $item->code_progress,
            'upcode_status' => $item->upcode_status,
            'upcode_date' => optional($item->upcode_date)->format('Y-m-d'),
            'upcoder_id' => $item->upcoder_id,
            'noti_status' => $item->noti_status,
            'noti_date' => optional($item->noti_date)->format('Y-m-d'),
            'notifier_id' => $item->notifier_id,
            'notified_internal_id' => $item->notified_internal_id,
            'notified_customer_id' => $item->notified_customer_id,
            'noti_doc_link' => $item->noti_doc_link,
            'created_at' => optional($item->created_at)->toDateTimeString(),
            'created_by' => $item->created_by,
            'updated_at' => optional($item->updated_at)->toDateTimeString(),
            'updated_by' => $item->updated_by,
            'deleted_at' => optional($item->deleted_at)->toDateTimeString(),
            'coder_name' => $item->coder?->full_name,
            'customer_name' => $item->customer?->customer_name,
            'project_name' => $item->project?->project_name,
            'product_name' => $item->product?->product_name,
            'reference_req_code' => $item->referenceRequest?->req_code,
            'reference_req_name' => $item->referenceRequest?->req_name,
            'reference_status' => $item->referenceRequest?->status,
        ];

        if ($includeWorklogs) {
            $payload['worklogs'] = $item->worklogs
                ->map(fn (ProgrammingRequestWorklog $worklog): array => $this->serializeWorklog($worklog))
                ->values();
        }

        return $payload;
    }

    private function serializeWorklog(ProgrammingRequestWorklog $worklog): array
    {
        return [
            'id' => $worklog->id,
            'programming_request_id' => (int) $worklog->programming_request_id,
            'phase' => (string) $worklog->phase,
            'content' => (string) $worklog->content,
            'logged_date' => optional($worklog->logged_date)->format('Y-m-d'),
            'hours_estimated' => $worklog->hours_estimated === null ? null : (float) $worklog->hours_estimated,
            'hours_spent' => (float) $worklog->hours_spent,
            'created_at' => optional($worklog->created_at)->toDateTimeString(),
            'created_by' => (int) $worklog->created_by,
            'updated_at' => optional($worklog->updated_at)->toDateTimeString(),
            'updated_by' => $worklog->updated_by,
            'deleted_at' => optional($worklog->deleted_at)->toDateTimeString(),
            'created_by_name' => $worklog->createdBy?->full_name,
            'updated_by_name' => $worklog->updatedBy?->full_name,
        ];
    }

    private function normalizeListFilter(mixed $value): array
    {
        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item) => strtoupper(trim((string) $item)))
                ->filter(fn ($item) => $item !== '')
                ->values()
                ->all();
        }

        if (! is_string($value)) {
            return [];
        }

        return collect(explode(',', $value))
            ->map(fn ($item) => strtoupper(trim($item)))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function resolveActorId(Request $request): ?int
    {
        $userId = $request->user()?->id;

        return is_numeric($userId) ? (int) $userId : null;
    }

    private function enrichPayloadWithProjectItem(array $payload, ?ProgrammingRequest $existing = null): array
    {
        $effectiveProjectItemId = array_key_exists('project_item_id', $payload)
            ? $this->parseNullableInt($payload['project_item_id'])
            : $existing?->project_item_id;

        if ($effectiveProjectItemId === null) {
            return $payload;
        }

        $context = $this->resolveProjectItemContext($effectiveProjectItemId);
        if ($context === null) {
            throw ValidationException::withMessages([
                'project_item_id' => ['project_item_id không tồn tại hoặc đã bị xóa.'],
            ]);
        }

        $payload['project_item_id'] = $context['project_item_id'];
        $payload['project_id'] = $context['project_id'];
        $payload['product_id'] = $context['product_id'];

        if ($context['customer_id'] !== null) {
            $payload['customer_id'] = $context['customer_id'];
        }

        return $payload;
    }

    private function resolveProjectItemContext(int $projectItemId): ?array
    {
        $query = DB::table('project_items as pi')
            ->leftJoin('projects as p', 'pi.project_id', '=', 'p.id')
            ->where('pi.id', $projectItemId)
            ->select([
                'pi.id as project_item_id',
                'pi.project_id',
                'pi.product_id',
                'p.customer_id as customer_id',
            ]);

        if (Schema::hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $item = $query->first();
        if (! $item) {
            return null;
        }

        return [
            'project_item_id' => $this->parseNullableInt($item->project_item_id),
            'project_id' => $this->parseNullableInt($item->project_id),
            'product_id' => $this->parseNullableInt($item->product_id),
            'customer_id' => $this->parseNullableInt($item->customer_id),
        ];
    }

    private function generateReqCodeFromId(int $id, ?CarbonInterface $time = null): string
    {
        if ($id < 1) {
            throw ValidationException::withMessages([
                'req_code' => ['Không thể sinh mã yêu cầu với id không hợp lệ.'],
            ]);
        }

        $moment = $time ?? now();
        return sprintf(
            '%s%s%s%d',
            self::REQUEST_CODE_PREFIX,
            $moment->format('m'),
            $moment->format('d'),
            $id
        );
    }

    private function createWithGeneratedReqCode(array $payload): ProgrammingRequest
    {
        $maxAttempts = 5;
        $lastDuplicateException = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                return DB::transaction(function () use ($payload): ProgrammingRequest {
                    $nextId = $this->resolveNextProgrammingRequestId();
                    $createPayload = $payload;
                    $createPayload['req_code'] = $this->generateReqCodeFromId($nextId, now());

                    return ProgrammingRequest::query()->create($createPayload);
                });
            } catch (QueryException $exception) {
                if (! $this->isDuplicateReqCodeException($exception)) {
                    throw $exception;
                }

                $lastDuplicateException = $exception;
                usleep(100000);
            }
        }

        throw $lastDuplicateException ?? ValidationException::withMessages([
            'req_code' => ['Không thể sinh mã yêu cầu. Vui lòng thử lại.'],
        ]);
    }

    private function resolveNextProgrammingRequestId(): int
    {
        $nextAutoIncrement = DB::table('information_schema.tables')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', 'programming_requests')
            ->value('AUTO_INCREMENT');

        if (is_numeric($nextAutoIncrement)) {
            return max((int) $nextAutoIncrement, 1);
        }

        return max(((int) DB::table('programming_requests')->max('id')) + 1, 1);
    }

    private function isDuplicateReqCodeException(QueryException $exception): bool
    {
        $message = strtolower((string) $exception->getMessage());

        return str_contains($message, 'duplicate entry')
            && str_contains($message, 'req_code');
    }

    private function workflowFlowResolver(): WorkflowFlowResolver
    {
        return app(WorkflowFlowResolver::class);
    }

    private function statusDrivenSlaResolver(): StatusDrivenSlaResolver
    {
        return app(StatusDrivenSlaResolver::class);
    }

    private function resolveProgrammingSubStatusFromStatus(string $status): ?string
    {
        $normalizedStatus = strtoupper(trim($status));
        return match ($normalizedStatus) {
            'CODING' => 'DANG_THUC_HIEN',
            'PENDING_UPCODE' => 'UPCODE',
            'UPCODED' => 'HOAN_THANH',
            default => null,
        };
    }

    private function touchWorkflowResolversForProgramming(string $status, ?string $subStatus, ?int $priority): void
    {
        $this->workflowFlowResolver()->resolve($status, $subStatus);
        $priorityLabel = match ((int) ($priority ?? 3)) {
            1 => 'URGENT',
            2 => 'HIGH',
            3 => 'MEDIUM',
            4 => 'LOW',
            default => 'MEDIUM',
        };
        $this->statusDrivenSlaResolver()->resolve($status, $subStatus, $priorityLabel, null);
    }
}
