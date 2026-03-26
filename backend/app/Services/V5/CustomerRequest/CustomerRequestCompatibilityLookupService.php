<?php

namespace App\Services\V5\CustomerRequest;

use App\Models\InternalUser;
use App\Services\V5\SupportConfig\SupportRequestStatusService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerRequestCompatibilityLookupService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccessService,
        private readonly SupportRequestStatusService $statusService,
    ) {}

    public function referenceSearch(Request $request): JsonResponse
    {
        if ($this->support->hasTable('customer_requests')) {
            return $this->customerRequestReferenceSearch($request);
        }

        return $this->supportRequestReferenceSearch($request);
    }

    public function receivers(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('internal_users')) {
            return $this->support->missingTable('internal_users');
        }

        $projectId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'project_id'));
        $projectItemId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'project_item_id'));

        if ($projectId === null && $projectItemId !== null) {
            $projectItemContext = $this->resolveSupportProjectItemContext($projectItemId);
            $projectId = $projectItemContext['project_id'] ?? null;
        }

        $raciRows = $this->fetchProjectRaciReceiverRows($projectId);
        $defaultReceiverUserId = $this->resolveDefaultReceiverUserIdFromRaciRows($raciRows);

        $options = collect($raciRows)
            ->map(function (array $row) use ($defaultReceiverUserId): array {
                $userId = $this->support->parseNullableInt($row['user_id'] ?? null);

                return [
                    'user_id' => $userId,
                    'user_code' => $row['user_code'] ?? null,
                    'username' => $row['username'] ?? null,
                    'full_name' => $row['full_name'] ?? null,
                    'raci_role' => $row['raci_role'] ?? null,
                    'is_default' => $userId !== null && $defaultReceiverUserId !== null && $userId === $defaultReceiverUserId,
                ];
            })
            ->filter(fn (array $row): bool => $this->support->parseNullableInt($row['user_id'] ?? null) !== null)
            ->values();

        if ($options->isEmpty()) {
            $options = DB::table('internal_users')
                ->select($this->support->selectColumns('internal_users', ['id', 'user_code', 'username', 'full_name', 'status']))
                ->when(
                    $this->support->hasColumn('internal_users', 'status'),
                    fn ($query) => $query->whereIn('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])
                )
                ->when(
                    $this->support->hasColumn('internal_users', 'full_name'),
                    fn ($query) => $query->orderBy('full_name'),
                    fn ($query) => $query->orderBy('id')
                )
                ->limit(1000)
                ->get()
                ->map(function (object $item): array {
                    $row = (array) $item;

                    return [
                        'user_id' => $this->support->parseNullableInt($row['id'] ?? null),
                        'user_code' => $row['user_code'] ?? null,
                        'username' => $row['username'] ?? null,
                        'full_name' => $row['full_name'] ?? null,
                        'raci_role' => null,
                        'is_default' => false,
                    ];
                })
                ->values();
        }

        return response()->json([
            'data' => [
                'project_id' => $projectId,
                'project_item_id' => $projectItemId,
                'default_receiver_user_id' => $defaultReceiverUserId,
                'options' => $options,
            ],
        ]);
    }

    public function projectItems(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('project_items')) {
            return $this->support->missingTable('project_items');
        }

        $userId = $this->support->parseNullableInt($request->user()?->id ?? null);
        if ($userId === null) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $query = $this->buildProjectItemsQuery($request);
        $includeProjectItemId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'include_project_item_id'));
        $canFilterByRaci = $this->support->hasColumn('project_items', 'project_id')
            && $this->support->hasTable('raci_assignments')
            && $this->support->hasColumn('raci_assignments', 'entity_type')
            && $this->support->hasColumn('raci_assignments', 'entity_id')
            && $this->support->hasColumn('raci_assignments', 'user_id')
            && $this->support->hasColumn('raci_assignments', 'raci_role');

        $query->where(function ($builder) use ($canFilterByRaci, $includeProjectItemId, $userId): void {
            if ($canFilterByRaci) {
                $builder->whereExists(function ($exists) use ($userId): void {
                    $exists->selectRaw('1')
                        ->from('raci_assignments as ra')
                        ->whereColumn('ra.entity_id', 'pi.project_id')
                        ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
                        ->where('ra.user_id', $userId)
                        ->whereIn('ra.raci_role', ['A', 'R', 'C', 'I']);
                });
            } else {
                $builder->whereRaw('1 = 0');
            }

            if ($includeProjectItemId !== null) {
                $builder->orWhere('pi.id', $includeProjectItemId);
            }
        });

        return $this->respondWithProjectItemsQuery($request, $query);
    }

    private function supportRequestReferenceSearch(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_requests')) {
            return response()->json(['data' => []]);
        }

        $supportsRequestCode = $this->support->hasColumn('support_requests', 'request_code');
        $supportsLegacyTaskLookup = $this->support->hasTable('support_request_tasks')
            && $this->support->hasColumn('support_request_tasks', 'request_id')
            && $this->support->hasColumn('support_request_tasks', 'task_code');

        if (! $supportsRequestCode && ! $supportsLegacyTaskLookup) {
            return response()->json(['data' => []]);
        }

        $queryText = trim((string) ($request->query('q', '') ?? ''));
        $excludeId = $this->support->parseNullableInt($request->query('exclude_id'));
        $limit = max(1, min(50, (int) ($request->query('limit', 20) ?? 20)));

        $requestCodeRows = [];
        $taskCodeRows = [];

        if ($supportsRequestCode) {
            $requestCodeQuery = DB::table('support_requests as sr')
                ->select([
                    'sr.id as id',
                    'sr.request_code as request_code',
                    'sr.summary as summary',
                    'sr.status as status',
                    'sr.requested_date as requested_date',
                ])
                ->whereNotNull('sr.request_code')
                ->where('sr.request_code', '<>', '');

            $this->applySupportRequestReadScope($request, $requestCodeQuery);

            if ($excludeId !== null) {
                $requestCodeQuery->where('sr.id', '<>', $excludeId);
            }
            if ($this->support->hasColumn('support_requests', 'deleted_at')) {
                $requestCodeQuery->whereNull('sr.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $requestCodeQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('sr.request_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(UPPER(sr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                            ['%'.strtoupper($compact).'%']
                        );
                    }

                    if ($this->support->hasColumn('support_requests', 'summary')) {
                        $builder->orWhere('sr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $requestCodeQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(sr.request_code) = UPPER(?) THEN 0
                        WHEN UPPER(sr.request_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(sr.request_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->support->hasColumn('support_requests', 'requested_date')) {
                $requestCodeQuery->orderBy('sr.requested_date', 'desc');
            }
            if ($this->support->hasColumn('support_requests', 'id')) {
                $requestCodeQuery->orderBy('sr.id', 'desc');
            }

            $requestCodeRows = $requestCodeQuery
                ->limit($limit * 2)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => null,
                        'ticket_code' => null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0)
                ->values()
                ->all();
        }

        if ($supportsLegacyTaskLookup) {
            $legacyQuery = DB::table('support_request_tasks as srt')
                ->join('support_requests as sr', 'srt.request_id', '=', 'sr.id')
                ->select([
                    'sr.id as id',
                    'sr.request_code as request_code',
                    'srt.task_code as task_code',
                    'sr.summary as summary',
                    'sr.status as status',
                    'sr.requested_date as requested_date',
                ])
                ->whereNotNull('srt.task_code')
                ->where('srt.task_code', '<>', '');

            $this->applySupportRequestReadScope($request, $legacyQuery);

            if ($excludeId !== null) {
                $legacyQuery->where('sr.id', '<>', $excludeId);
            }
            if ($this->support->hasColumn('support_requests', 'deleted_at')) {
                $legacyQuery->whereNull('sr.deleted_at');
            }
            if ($this->support->hasColumn('support_request_tasks', 'deleted_at')) {
                $legacyQuery->whereNull('srt.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $legacyQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('srt.task_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(UPPER(srt.task_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                            ['%'.strtoupper($compact).'%']
                        );
                    }

                    if ($this->support->hasColumn('support_requests', 'summary')) {
                        $builder->orWhere('sr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $legacyQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(srt.task_code) = UPPER(?) THEN 0
                        WHEN UPPER(srt.task_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(srt.task_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->support->hasColumn('support_requests', 'requested_date')) {
                $legacyQuery->orderBy('sr.requested_date', 'desc');
            }
            if ($this->support->hasColumn('support_request_tasks', 'id')) {
                $legacyQuery->orderBy('srt.id', 'desc');
            }

            $taskCodeRows = $legacyQuery
                ->limit($limit * 3)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));
                    $taskCode = trim((string) ($row->task_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => $taskCode !== '' ? $taskCode : null,
                        'ticket_code' => $taskCode !== '' ? $taskCode : null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0 && trim((string) ($row['task_code'] ?? '')) !== '')
                ->values()
                ->all();
        }

        $resolvedRows = array_merge($taskCodeRows, $requestCodeRows);
        $requestIds = array_values(array_filter(array_map(
            fn (array $row): int => (int) ($row['id'] ?? 0),
            $resolvedRows
        ), fn (int $id): bool => $id > 0));

        $taskCodeMap = $this->loadSupportRequestPrimaryTaskCodeMap($requestIds);
        $resolvedRows = array_values(array_filter(array_map(function (array $row) use ($taskCodeMap): array {
            $requestId = (int) ($row['id'] ?? 0);
            $taskCode = $this->support->normalizeNullableString($row['task_code'] ?? null);
            $ticketCode = $this->support->normalizeNullableString($row['ticket_code'] ?? null);
            $requestCode = $this->support->normalizeNullableString($row['request_code'] ?? null);

            if ($taskCode === null && isset($taskCodeMap[$requestId])) {
                $taskCode = $taskCodeMap[$requestId];
            }
            if ($taskCode === null) {
                $taskCode = $ticketCode;
            }
            if ($taskCode === null) {
                $taskCode = $requestCode;
            }

            if ($ticketCode === null) {
                $ticketCode = $taskCode;
            }
            if ($ticketCode === null) {
                $ticketCode = $requestCode;
            }

            $row['task_code'] = $taskCode;
            $row['ticket_code'] = $ticketCode;
            $row['request_code'] = $requestCode;

            return $row;
        }, $resolvedRows), fn (array $row): bool => trim((string) ($row['ticket_code'] ?? '')) !== ''));

        return response()->json([
            'data' => array_values(array_slice($this->deduplicateReferenceRows($resolvedRows), 0, $limit)),
        ]);
    }

    private function customerRequestReferenceSearch(Request $request): JsonResponse
    {
        $supportsRequestCode = $this->support->hasColumn('customer_requests', 'request_code');
        $supportsReferenceTaskLookup = $this->support->hasTable('request_ref_tasks')
            && $this->support->hasColumn('request_ref_tasks', 'request_code')
            && $this->support->hasColumn('request_ref_tasks', 'task_code');

        if (! $supportsRequestCode && ! $supportsReferenceTaskLookup) {
            return response()->json(['data' => []]);
        }

        $queryText = trim((string) ($request->query('q', '') ?? ''));
        $excludeId = $this->support->parseNullableInt($request->query('exclude_id'));
        $limit = max(1, min(50, (int) ($request->query('limit', 20) ?? 20)));

        $requestCodeRows = [];
        $taskCodeRows = [];

        if ($supportsRequestCode) {
            $requestCodeQuery = DB::table('customer_requests as cr')
                ->select([
                    'cr.id as id',
                    'cr.request_code as request_code',
                    'cr.summary as summary',
                    'cr.status as status',
                    'cr.requested_date as requested_date',
                ])
                ->whereNotNull('cr.request_code')
                ->where('cr.request_code', '<>', '');

            $this->applyCustomerRequestReadScope($request, $requestCodeQuery);

            if ($excludeId !== null) {
                $requestCodeQuery->where('cr.id', '<>', $excludeId);
            }
            if ($this->support->hasColumn('customer_requests', 'deleted_at')) {
                $requestCodeQuery->whereNull('cr.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $requestCodeQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('cr.request_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(UPPER(cr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                            ['%'.strtoupper($compact).'%']
                        );
                    }

                    if ($this->support->hasColumn('customer_requests', 'summary')) {
                        $builder->orWhere('cr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $requestCodeQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(cr.request_code) = UPPER(?) THEN 0
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->support->hasColumn('customer_requests', 'requested_date')) {
                $requestCodeQuery->orderBy('cr.requested_date', 'desc');
            }
            if ($this->support->hasColumn('customer_requests', 'id')) {
                $requestCodeQuery->orderBy('cr.id', 'desc');
            }

            $requestCodeRows = $requestCodeQuery
                ->limit($limit * 2)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => null,
                        'ticket_code' => null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0)
                ->values()
                ->all();
        }

        if ($supportsReferenceTaskLookup) {
            $referenceQuery = DB::table('request_ref_tasks as rrt')
                ->join('customer_requests as cr', 'rrt.request_code', '=', 'cr.request_code')
                ->select([
                    'cr.id as id',
                    'cr.request_code as request_code',
                    'rrt.task_code as task_code',
                    'cr.summary as summary',
                    'cr.status as status',
                    'cr.requested_date as requested_date',
                ])
                ->whereNotNull('rrt.request_code')
                ->where('rrt.request_code', '<>', '')
                ->whereNotNull('rrt.task_code')
                ->where('rrt.task_code', '<>', '');

            if ($this->support->hasColumn('request_ref_tasks', 'task_source')) {
                $referenceQuery->where('rrt.task_source', 'REFERENCE');
            }

            $this->applyCustomerRequestReadScope($request, $referenceQuery);

            if ($excludeId !== null) {
                $referenceQuery->where('cr.id', '<>', $excludeId);
            }
            if ($this->support->hasColumn('customer_requests', 'deleted_at')) {
                $referenceQuery->whereNull('cr.deleted_at');
            }
            if ($this->support->hasColumn('request_ref_tasks', 'deleted_at')) {
                $referenceQuery->whereNull('rrt.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $referenceQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('rrt.task_code', 'like', $like)
                        ->orWhere('cr.request_code', 'like', $like);

                    if ($compact !== '') {
                        $builder
                            ->orWhereRaw(
                                "REPLACE(REPLACE(REPLACE(UPPER(rrt.task_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                                ['%'.strtoupper($compact).'%']
                            )
                            ->orWhereRaw(
                                "REPLACE(REPLACE(REPLACE(UPPER(cr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?",
                                ['%'.strtoupper($compact).'%']
                            );
                    }

                    if ($this->support->hasColumn('customer_requests', 'summary')) {
                        $builder->orWhere('cr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $referenceQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(rrt.task_code) = UPPER(?) THEN 0
                        WHEN UPPER(rrt.task_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(cr.request_code) = UPPER(?) THEN 2
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 3
                        ELSE 4
                     END",
                    [$queryText, $escaped.'%', $queryText, $escaped.'%']
                );
            }

            if ($this->support->hasColumn('customer_requests', 'requested_date')) {
                $referenceQuery->orderBy('cr.requested_date', 'desc');
            }
            if ($this->support->hasColumn('request_ref_tasks', 'sort_order')) {
                $referenceQuery->orderBy('rrt.sort_order');
            }
            if ($this->support->hasColumn('request_ref_tasks', 'id')) {
                $referenceQuery->orderBy('rrt.id', 'desc');
            }

            $taskCodeRows = $referenceQuery
                ->limit($limit * 3)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));
                    $taskCode = trim((string) ($row->task_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => $taskCode !== '' ? $taskCode : null,
                        'ticket_code' => $taskCode !== '' ? $taskCode : null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0 && trim((string) ($row['task_code'] ?? '')) !== '')
                ->values()
                ->all();
        }

        $resolvedRows = array_merge($taskCodeRows, $requestCodeRows);
        $requestCodes = array_values(array_filter(array_map(
            fn (array $row): ?string => $this->support->normalizeNullableString($row['request_code'] ?? null),
            $resolvedRows
        )));

        $primaryTaskCodeMap = $this->loadCustomerRequestPrimaryReferenceTaskCodeMap($requestCodes);
        $resolvedRows = array_values(array_filter(array_map(function (array $row) use ($primaryTaskCodeMap): array {
            $requestCode = $this->support->normalizeNullableString($row['request_code'] ?? null);
            $taskCode = $this->support->normalizeNullableString($row['task_code'] ?? null);
            $ticketCode = $this->support->normalizeNullableString($row['ticket_code'] ?? null);

            if ($taskCode === null && $requestCode !== null && isset($primaryTaskCodeMap[$requestCode])) {
                $taskCode = $primaryTaskCodeMap[$requestCode];
            }
            if ($taskCode === null) {
                $taskCode = $ticketCode;
            }
            if ($taskCode === null) {
                $taskCode = $requestCode;
            }

            if ($ticketCode === null) {
                $ticketCode = $taskCode;
            }
            if ($ticketCode === null) {
                $ticketCode = $requestCode;
            }

            $row['request_code'] = $requestCode;
            $row['task_code'] = $taskCode;
            $row['ticket_code'] = $ticketCode;

            return $row;
        }, $resolvedRows), fn (array $row): bool => trim((string) ($row['ticket_code'] ?? '')) !== ''));

        return response()->json([
            'data' => array_values(array_slice($this->deduplicateReferenceRows($resolvedRows), 0, $limit)),
        ]);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function deduplicateReferenceRows(array $rows): array
    {
        $rowsByKey = [];
        foreach ($rows as $row) {
            $requestId = (int) ($row['id'] ?? 0);
            $taskCode = $this->support->normalizeNullableString($row['task_code'] ?? null);
            $requestCode = $this->support->normalizeNullableString($row['request_code'] ?? null);
            $rowKey = sprintf(
                'REQ@%d|TASK@%s',
                $requestId,
                strtoupper((string) ($taskCode ?? $requestCode ?? ''))
            );
            if (! isset($rowsByKey[$rowKey])) {
                $rowsByKey[$rowKey] = $row;
            }
        }

        return array_values($rowsByKey);
    }

    private function normalizeSupportRequestStatus(string $status): string
    {
        return $this->statusService->normalizeStatusCode($status);
    }

    /**
     * @param array<int, int> $requestIds
     * @return array<int, string>
     */
    private function loadSupportRequestPrimaryTaskCodeMap(array $requestIds): array
    {
        if (
            $requestIds === []
            || ! $this->support->hasTable('support_request_tasks')
            || ! $this->support->hasColumn('support_request_tasks', 'request_id')
            || ! $this->support->hasColumn('support_request_tasks', 'task_code')
        ) {
            return [];
        }

        $query = DB::table('support_request_tasks')
            ->whereIn('request_id', $requestIds)
            ->whereNotNull('task_code')
            ->where('task_code', '<>', '');

        if ($this->support->hasColumn('support_request_tasks', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->support->hasColumn('support_request_tasks', 'request_id')) {
            $query->orderBy('request_id');
        }
        if ($this->support->hasColumn('support_request_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->support->hasColumn('support_request_tasks', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->select($this->support->selectColumns('support_request_tasks', ['request_id', 'task_code']))
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $record = (array) $row;
            $requestId = $this->support->parseNullableInt($record['request_id'] ?? null);
            $taskCode = $this->support->normalizeNullableString($record['task_code'] ?? null);
            if ($requestId === null || $taskCode === null || isset($map[$requestId])) {
                continue;
            }

            $map[$requestId] = $taskCode;
        }

        return $map;
    }

    /**
     * @param array<int, string> $requestCodes
     * @return array<string, string>
     */
    private function loadCustomerRequestPrimaryReferenceTaskCodeMap(array $requestCodes): array
    {
        $requestCodes = array_values(array_unique(array_filter(array_map(
            fn ($value): ?string => $this->support->normalizeNullableString((string) $value),
            $requestCodes
        ))));

        if (
            $requestCodes === []
            || ! $this->support->hasTable('request_ref_tasks')
            || ! $this->support->hasColumn('request_ref_tasks', 'request_code')
            || ! $this->support->hasColumn('request_ref_tasks', 'task_code')
        ) {
            return [];
        }

        $query = DB::table('request_ref_tasks')
            ->whereIn('request_code', $requestCodes)
            ->whereNotNull('task_code')
            ->where('task_code', '<>', '');

        if ($this->support->hasColumn('request_ref_tasks', 'task_source')) {
            $query->where('task_source', 'REFERENCE');
        }
        if ($this->support->hasColumn('request_ref_tasks', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->support->hasColumn('request_ref_tasks', 'request_code')) {
            $query->orderBy('request_code');
        }
        if ($this->support->hasColumn('request_ref_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->support->hasColumn('request_ref_tasks', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->select($this->support->selectColumns('request_ref_tasks', ['request_code', 'task_code']))
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $record = (array) $row;
            $requestCode = $this->support->normalizeNullableString($record['request_code'] ?? null);
            $taskCode = $this->support->normalizeNullableString($record['task_code'] ?? null);
            if ($requestCode === null || $taskCode === null || isset($map[$requestCode])) {
                continue;
            }

            $map[$requestCode] = $taskCode;
        }

        return $map;
    }

    private function buildProjectItemsQuery(Request $request): mixed
    {
        $query = DB::table('project_items as pi');
        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as p', 'pi.project_id', '=', 'p.id');
        }
        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as c', 'p.customer_id', '=', 'c.id');
        }
        if ($this->support->hasTable('products')) {
            $query->leftJoin('products as pr', 'pi.product_id', '=', 'pr.id');
        }

        if ($this->support->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                $builder->orWhere('pi.id', 'like', $like);

                if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'project_code')) {
                    $builder->orWhere('p.project_code', 'like', $like);
                }
                if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'project_name')) {
                    $builder->orWhere('p.project_name', 'like', $like);
                }
                if ($this->support->hasTable('products') && $this->support->hasColumn('products', 'product_code')) {
                    $builder->orWhere('pr.product_code', 'like', $like);
                }
                if ($this->support->hasTable('products') && $this->support->hasColumn('products', 'product_name')) {
                    $builder->orWhere('pr.product_name', 'like', $like);
                }
                if ($this->support->hasTable('customers') && $this->support->hasColumn('customers', 'customer_name')) {
                    $builder->orWhere('c.customer_name', 'like', $like);
                }
            });
        }

        return $query
            ->select($this->projectItemSelectColumns())
            ->orderByDesc('pi.id');
    }

    private function respondWithProjectItemsQuery(Request $request, mixed $query): JsonResponse
    {
        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    /**
     * @return array<int, string>
     */
    private function projectItemSelectColumns(): array
    {
        $selects = [];

        foreach ([
            'id',
            'project_id',
            'product_id',
            'quantity',
            'unit_price',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
            'deleted_at',
        ] as $column) {
            if ($this->support->hasColumn('project_items', $column)) {
                $selects[] = "pi.{$column} as {$column}";
            }
        }

        if ($this->support->hasTable('projects')) {
            if ($this->support->hasColumn('projects', 'project_code')) {
                $selects[] = 'p.project_code as project_code';
            }
            if ($this->support->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
            if ($this->support->hasColumn('projects', 'customer_id')) {
                $selects[] = 'p.customer_id as customer_id';
            }
        }

        if ($this->support->hasTable('customers')) {
            if ($this->support->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->support->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
            if ($this->support->hasColumn('customers', 'company_name')) {
                $selects[] = 'c.company_name as customer_company_name';
            }
        }

        if ($this->support->hasTable('products')) {
            if ($this->support->hasColumn('products', 'product_code')) {
                $selects[] = 'pr.product_code as product_code';
            }
            if ($this->support->hasColumn('products', 'product_name')) {
                $selects[] = 'pr.product_name as product_name';
            }
            if ($this->support->hasColumn('products', 'unit')) {
                $selects[] = 'pr.unit as unit';
            }
        }

        return $selects;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveSupportProjectItemContext(int $projectItemId): ?array
    {
        if (! $this->support->hasTable('project_items')) {
            return null;
        }

        $query = DB::table('project_items as pi')
            ->where('pi.id', $projectItemId);

        if ($this->support->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as p', 'pi.project_id', '=', 'p.id');
        }

        $selects = [];
        if ($this->support->hasColumn('project_items', 'id')) {
            $selects[] = 'pi.id as project_item_id';
        }
        if ($this->support->hasColumn('project_items', 'project_id')) {
            $selects[] = 'pi.project_id as project_id';
        }
        if ($this->support->hasColumn('project_items', 'product_id')) {
            $selects[] = 'pi.product_id as product_id';
        }
        if ($this->support->hasTable('projects') && $this->support->hasColumn('projects', 'customer_id')) {
            $selects[] = 'p.customer_id as customer_id';
        }

        $record = $query->select($selects)->first();
        if ($record === null) {
            return null;
        }

        $projectId = $this->support->parseNullableInt($record->project_id ?? null);
        $productId = $this->support->parseNullableInt($record->product_id ?? null);
        $customerId = $this->support->parseNullableInt($record->customer_id ?? null);
        if ($projectId === null || $productId === null || $customerId === null) {
            return null;
        }

        return [
            'project_item_id' => $this->support->parseNullableInt($record->project_item_id ?? null),
            'project_id' => $projectId,
            'product_id' => $productId,
            'customer_id' => $customerId,
        ];
    }

    /**
     * @return array<int, array{user_id:int, raci_role:string, user_code:string|null, username:string|null, full_name:string|null}>
     */
    private function fetchProjectRaciReceiverRows(?int $projectId): array
    {
        if (
            $projectId === null
            || ! $this->support->hasTable('raci_assignments')
            || ! $this->support->hasTable('internal_users')
            || ! $this->support->hasColumn('raci_assignments', 'entity_type')
            || ! $this->support->hasColumn('raci_assignments', 'entity_id')
            || ! $this->support->hasColumn('raci_assignments', 'user_id')
            || ! $this->support->hasColumn('raci_assignments', 'raci_role')
            || ! $this->support->hasColumn('internal_users', 'id')
        ) {
            return [];
        }

        $query = DB::table('raci_assignments as ra')
            ->join('internal_users as iu', 'ra.user_id', '=', 'iu.id')
            ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
            ->where('ra.entity_id', $projectId)
            ->whereIn('ra.raci_role', ['A', 'R', 'C', 'I']);

        if ($this->support->hasColumn('internal_users', 'status')) {
            $query->whereIn('iu.status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
        }

        $query->select([
            'ra.user_id as user_id',
            'ra.raci_role as raci_role',
            DB::raw($this->support->hasColumn('internal_users', 'user_code') ? 'iu.user_code as user_code' : 'NULL as user_code'),
            DB::raw($this->support->hasColumn('internal_users', 'username') ? 'iu.username as username' : 'NULL as username'),
            DB::raw($this->support->hasColumn('internal_users', 'full_name') ? 'iu.full_name as full_name' : 'NULL as full_name'),
        ]);

        $query->orderByRaw("CASE WHEN ra.raci_role = 'A' THEN 0 WHEN ra.raci_role = 'R' THEN 1 WHEN ra.raci_role = 'C' THEN 2 WHEN ra.raci_role = 'I' THEN 3 ELSE 4 END");
        if ($this->support->hasColumn('internal_users', 'full_name')) {
            $query->orderBy('iu.full_name');
        } else {
            $query->orderBy('iu.id');
        }

        $uniqueRows = [];
        foreach ($query->get() as $item) {
            $row = (array) $item;
            $userId = $this->support->parseNullableInt($row['user_id'] ?? null);
            if ($userId === null || isset($uniqueRows[$userId])) {
                continue;
            }

            $uniqueRows[$userId] = [
                'user_id' => $userId,
                'raci_role' => strtoupper((string) ($row['raci_role'] ?? '')),
                'user_code' => $this->support->normalizeNullableString($row['user_code'] ?? null),
                'username' => $this->support->normalizeNullableString($row['username'] ?? null),
                'full_name' => $this->support->normalizeNullableString($row['full_name'] ?? null),
            ];
        }

        return array_values($uniqueRows);
    }

    /**
     * @param array<int, array{user_id:int, raci_role:string, user_code:string|null, username:string|null, full_name:string|null}> $raciRows
     */
    private function resolveDefaultReceiverUserIdFromRaciRows(array $raciRows): ?int
    {
        foreach ($raciRows as $row) {
            if (($row['raci_role'] ?? '') === 'A') {
                return $this->support->parseNullableInt($row['user_id'] ?? null);
            }
        }

        foreach ($raciRows as $row) {
            $userId = $this->support->parseNullableInt($row['user_id'] ?? null);
            if ($userId !== null) {
                return $userId;
            }
        }

        return null;
    }

    private function serializeProjectItemRecord(array $record): array
    {
        $projectId = $this->support->parseNullableInt($record['project_id'] ?? null);
        $productId = $this->support->parseNullableInt($record['product_id'] ?? null);
        $customerId = $this->support->parseNullableInt($record['customer_id'] ?? null);
        $projectCode = $this->support->firstNonEmpty($record, ['project_code']);
        $projectName = $this->support->firstNonEmpty($record, ['project_name']);
        $productCode = $this->support->firstNonEmpty($record, ['product_code']);
        $productName = $this->support->firstNonEmpty($record, ['product_name']);

        $projectCodeText = (string) ($projectCode ?? '');
        $projectNameText = (string) ($projectName ?? '');
        $productCodeText = (string) ($productCode ?? '');
        $productNameText = (string) ($productName ?? '');

        $projectPart = trim(($projectCodeText !== '' ? $projectCodeText.' - ' : '').$projectNameText);
        $productPart = trim(($productCodeText !== '' ? $productCodeText.' - ' : '').$productNameText);
        $displayName = trim($projectPart.($projectPart !== '' && $productPart !== '' ? ' | ' : '').$productPart);

        return [
            'id' => $this->support->parseNullableInt($record['id'] ?? null),
            'project_id' => $projectId,
            'project_code' => $projectCode,
            'project_name' => $projectName,
            'customer_id' => $customerId,
            'customer_code' => $record['customer_code'] ?? null,
            'customer_name' => $this->support->firstNonEmpty($record, ['customer_name', 'customer_company_name']),
            'product_id' => $productId,
            'product_code' => $productCode,
            'product_name' => $productName,
            'unit' => $record['unit'] ?? null,
            'quantity' => isset($record['quantity']) ? (float) $record['quantity'] : null,
            'unit_price' => isset($record['unit_price']) ? (float) $record['unit_price'] : null,
            'display_name' => $displayName !== '' ? $displayName : ('Hạng mục #'.($record['id'] ?? '--')),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'deleted_at' => $record['deleted_at'] ?? null,
        ];
    }

    /**
     * @return array<int, int>|null
     */
    private function resolveAllowedDepartmentIdsForRequest(Request $request): ?array
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof InternalUser) {
            return [];
        }

        return $this->userAccessService->resolveDepartmentIdsForUser((int) $authenticatedUser->id);
    }

    private function applyCustomerRequestReadScope(Request $request, mixed $query, string $alias = 'cr'): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId, $alias): void {
            $applied = false;

            if ($this->support->hasColumn('customer_requests', 'project_id') && $this->support->hasTable('projects')) {
                if ($this->support->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', $alias.'.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->support->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', $alias.'.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif (
                    $this->support->hasColumn('projects', 'opportunity_id')
                    && $this->support->hasTable('opportunities')
                    && $this->support->hasColumn('opportunities', 'dept_id')
                ) {
                    // Opportunity-based scope removed — opportunity module retired
                }
            }

            if (
                $this->support->hasColumn('customer_requests', 'project_item_id')
                && $this->support->hasTable('project_items')
                && $this->support->hasColumn('project_items', 'project_id')
                && $this->support->hasTable('projects')
            ) {
                // project_item → project → dept_id scope (opportunity path removed)
            }

            if ($this->support->hasColumn('customer_requests', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere($alias.'.created_by', $userId);
                } else {
                    $scope->where($alias.'.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    private function applySupportRequestReadScope(Request $request, mixed $query): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId): void {
            $applied = false;

            if ($this->support->hasColumn('support_requests', 'dept_id')) {
                $scope->whereIn('sr.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('support_requests', 'department_id')) {
                $scope->whereIn('sr.department_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->support->hasColumn('support_requests', 'project_id') && $this->support->hasTable('projects')) {
                if ($this->support->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'sr.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->support->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'sr.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if ($this->support->hasColumn('support_requests', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere('sr.created_by', $userId);
                } else {
                    $scope->where('sr.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }
}
