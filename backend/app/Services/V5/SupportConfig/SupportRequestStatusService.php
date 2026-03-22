<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SupportRequestStatusService
{
    private const LEGACY_SUPPORT_REQUEST_STATUS_MAP = [
        'OPEN' => 'NEW',
        'HOTFIXING' => 'TRANSFER_DEV',
        'RESOLVED' => 'COMPLETED',
        'DEPLOYED' => 'COMPLETED',
        'PENDING' => 'WAITING_CUSTOMER',
        'CANCELLED' => 'UNABLE_TO_EXECUTE',
    ];

    private const DEFAULT_SUPPORT_REQUEST_STATUS_DEFINITIONS = [
        [
            'status_code' => 'NEW',
            'status_name' => 'Moi tiep nhan',
            'description' => 'Yeu cau vua duoc ghi nhan',
            'requires_completion_dates' => false,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 10,
        ],
        [
            'status_code' => 'IN_PROGRESS',
            'status_name' => 'Dang xu ly',
            'description' => 'Yeu cau dang duoc xu ly',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 20,
        ],
        [
            'status_code' => 'WAITING_CUSTOMER',
            'status_name' => 'Cho phan hoi KH',
            'description' => 'Dang cho phan hoi tu khach hang',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 30,
        ],
        [
            'status_code' => 'COMPLETED',
            'status_name' => 'Hoan thanh',
            'description' => 'Yeu cau da hoan thanh',
            'requires_completion_dates' => true,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 40,
        ],
        [
            'status_code' => 'PAUSED',
            'status_name' => 'Tam dung',
            'description' => 'Yeu cau tam dung xu ly',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 50,
        ],
        [
            'status_code' => 'TRANSFER_DEV',
            'status_name' => 'Chuyen Dev',
            'description' => 'Yeu cau chuyen cho doi phat trien',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_transfer_dev' => true,
            'is_active' => true,
            'sort_order' => 60,
        ],
        [
            'status_code' => 'TRANSFER_DMS',
            'status_name' => 'Chuyen DMS',
            'description' => 'Yeu cau chuyen cho doi DMS',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 70,
        ],
        [
            'status_code' => 'UNABLE_TO_EXECUTE',
            'status_name' => 'Khong thuc hien duoc',
            'description' => 'Khong the thuc hien yeu cau',
            'requires_completion_dates' => true,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 80,
        ],
    ];

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function requestStatuses(Request $request): JsonResponse
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $definitions = $this->supportRequestStatusDefinitions($includeInactive);
        $usageByCode = $this->supportRequestStatusUsageSummaryByCode();

        return response()->json([
            'data' => array_values(array_map(
                fn (array $row): array => $this->appendSupportRequestStatusUsageMetadata($row, $usageByCode),
                $definitions
            )),
        ]);
    }

    public function normalizeStatusCode(string $status): string
    {
        $normalized = $this->sanitizeSupportRequestStatusCode($status);
        if ($normalized !== '' && isset(self::LEGACY_SUPPORT_REQUEST_STATUS_MAP[$normalized])) {
            return self::LEGACY_SUPPORT_REQUEST_STATUS_MAP[$normalized];
        }

        $lookup = $this->supportRequestStatusLookup();
        if ($normalized !== '' && isset($lookup[$normalized])) {
            return $lookup[$normalized];
        }

        $token = $this->normalizeSupportRequestStatusLookupToken($status);
        if ($token !== '' && isset($lookup[$token])) {
            return $lookup[$token];
        }

        return isset($lookup['NEW']) ? 'NEW' : ($lookup !== [] ? reset($lookup) : 'NEW');
    }

    public function storeRequestStatus(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_request_statuses')) {
            return $this->support->missingTable('support_request_statuses');
        }

        $validated = $request->validate([
            'status_code' => ['required', 'string', 'max:50'],
            'status_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'requires_completion_dates' => ['nullable', 'boolean'],
            'is_terminal' => ['nullable', 'boolean'],
            'is_transfer_dev' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($validated['status_code'] ?? ''));
        if ($statusCode === '') {
            return response()->json(['message' => 'status_code is invalid.'], 422);
        }

        $statusName = trim((string) ($validated['status_name'] ?? ''));
        if ($statusName === '') {
            return response()->json(['message' => 'status_name is required.'], 422);
        }

        if ($this->support->hasColumn('support_request_statuses', 'status_code')) {
            $exists = DB::table('support_request_statuses')
                ->whereRaw('UPPER(status_code) = ?', [$statusCode])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'status_code has already been taken.'], 422);
            }
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->support->parseNullableInt($request->user()?->id ?? null);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('support_request_statuses', [
            'status_code' => $statusCode,
            'status_name' => $statusName,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'requires_completion_dates' => array_key_exists('requires_completion_dates', $validated)
                ? (bool) $validated['requires_completion_dates']
                : $statusCode !== 'NEW',
            'is_terminal' => array_key_exists('is_terminal', $validated)
                ? (bool) $validated['is_terminal']
                : in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true),
            'is_transfer_dev' => array_key_exists('is_transfer_dev', $validated)
                ? (bool) $validated['is_transfer_dev']
                : $statusCode === 'TRANSFER_DEV',
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->support->hasColumn('support_request_statuses', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('support_request_statuses', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_request_statuses')->insertGetId($payload);
        $record = $this->loadSupportRequestStatusById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Support request status created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function storeRequestStatusesBulk(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_request_statuses')) {
            return $this->support->missingTable('support_request_statuses');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-request-statuses', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeRequestStatus($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Khong the tao trang thai yeu cau ho tro.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Khong the doc phan hoi khi tao trang thai yeu cau ho tro.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
            } catch (ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Khong the tao trang thai yeu cau ho tro.',
                ];
            }
        }

        $failedCount = count(array_filter(
            $results,
            fn (array $item): bool => ($item['success'] ?? false) !== true
        ));

        return response()->json([
            'data' => [
                'results' => array_values($results),
                'created' => array_values($created),
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function updateRequestStatus(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('support_request_statuses')) {
            return $this->support->missingTable('support_request_statuses');
        }

        $current = DB::table('support_request_statuses')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request status not found.'], 404);
        }

        $validated = $request->validate([
            'status_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'requires_completion_dates' => ['sometimes', 'boolean'],
            'is_terminal' => ['sometimes', 'boolean'],
            'is_transfer_dev' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeSupportRequestStatusCode((string) ($current->status_code ?? ''));
        $nextCode = array_key_exists('status_code', $validated)
            ? $this->sanitizeSupportRequestStatusCode((string) ($validated['status_code'] ?? ''))
            : $currentCode;

        if ($nextCode === '') {
            return response()->json(['message' => 'status_code is invalid.'], 422);
        }

        $statusName = trim((string) ($validated['status_name'] ?? ''));
        if ($statusName === '') {
            return response()->json(['message' => 'status_name is required.'], 422);
        }

        if ($nextCode !== $currentCode) {
            $usage = $this->supportRequestStatusUsageSummaryByCode()[$currentCode] ?? [
                'used_in_requests' => 0,
                'used_in_history' => 0,
            ];
            $usedInRequests = (int) ($usage['used_in_requests'] ?? 0);
            $usedInHistory = (int) ($usage['used_in_history'] ?? 0);
            if ($usedInRequests > 0 || $usedInHistory > 0) {
                return response()->json([
                    'message' => 'Khong the doi ma trang thai da phat sinh du lieu.',
                ], 422);
            }
        }

        if ($this->support->hasColumn('support_request_statuses', 'status_code')) {
            $exists = DB::table('support_request_statuses')
                ->whereRaw('UPPER(TRIM(status_code)) = ?', [$nextCode])
                ->where('id', '<>', $id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'status_code has already been taken.'], 422);
            }
        }

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->support->parseNullableInt($request->user()?->id ?? null);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'status_code' => $nextCode,
            'status_name' => $statusName,
        ];

        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('requires_completion_dates', $validated)) {
            $payload['requires_completion_dates'] = (bool) $validated['requires_completion_dates'];
        }
        if (array_key_exists('is_terminal', $validated)) {
            $payload['is_terminal'] = (bool) $validated['is_terminal'];
        }
        if (array_key_exists('is_transfer_dev', $validated)) {
            $payload['is_transfer_dev'] = (bool) $validated['is_transfer_dev'];
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('support_request_statuses', $payload);
        if ($this->support->hasColumn('support_request_statuses', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_request_statuses')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportRequestStatusById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support request status not found.'], 404);
        }

        $record = $this->appendSupportRequestStatusUsageMetadata(
            $record,
            $this->supportRequestStatusUsageSummaryByCode()
        );

        return response()->json(['data' => $record]);
    }

    /**
     * @return array<string, array{used_in_requests:int,used_in_history:int}>
     */
    private function supportRequestStatusUsageSummaryByCode(): array
    {
        $usageByCode = [];

        if ($this->support->hasTable('support_requests') && $this->support->hasColumn('support_requests', 'status')) {
            $requestRows = DB::table('support_requests')
                ->selectRaw('UPPER(TRIM(status)) as status_code, COUNT(*) as total')
                ->whereNotNull('status')
                ->whereRaw('TRIM(status) <> ?', [''])
                ->groupBy('status_code')
                ->get();

            foreach ($requestRows as $row) {
                $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                if ($statusCode === '') {
                    continue;
                }

                if (! isset($usageByCode[$statusCode])) {
                    $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                }
                $usageByCode[$statusCode]['used_in_requests'] += (int) ($row->total ?? 0);
            }
        }

        if ($this->support->hasTable('support_request_history')) {
            if ($this->support->hasColumn('support_request_history', 'new_status')) {
                $historyRows = DB::table('support_request_history')
                    ->selectRaw('UPPER(TRIM(new_status)) as status_code, COUNT(*) as total')
                    ->whereNotNull('new_status')
                    ->whereRaw('TRIM(new_status) <> ?', [''])
                    ->groupBy('status_code')
                    ->get();

                foreach ($historyRows as $row) {
                    $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                    if ($statusCode === '') {
                        continue;
                    }

                    if (! isset($usageByCode[$statusCode])) {
                        $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                    }
                    $usageByCode[$statusCode]['used_in_history'] += (int) ($row->total ?? 0);
                }
            }

            if ($this->support->hasColumn('support_request_history', 'old_status')) {
                $historyRows = DB::table('support_request_history')
                    ->selectRaw('UPPER(TRIM(old_status)) as status_code, COUNT(*) as total')
                    ->whereNotNull('old_status')
                    ->whereRaw('TRIM(old_status) <> ?', [''])
                    ->groupBy('status_code')
                    ->get();

                foreach ($historyRows as $row) {
                    $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                    if ($statusCode === '') {
                        continue;
                    }

                    if (! isset($usageByCode[$statusCode])) {
                        $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                    }
                    $usageByCode[$statusCode]['used_in_history'] += (int) ($row->total ?? 0);
                }
            }
        }

        return $usageByCode;
    }

    /**
     * @param array<string, array{used_in_requests:int,used_in_history:int}> $usageByCode
     * @return array<string, mixed>
     */
    private function appendSupportRequestStatusUsageMetadata(array $record, array $usageByCode): array
    {
        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));
        $usage = $usageByCode[$statusCode] ?? ['used_in_requests' => 0, 'used_in_history' => 0];
        $usedInRequests = (int) ($usage['used_in_requests'] ?? 0);
        $usedInHistory = (int) ($usage['used_in_history'] ?? 0);

        $record['used_in_requests'] = $usedInRequests;
        $record['used_in_history'] = $usedInHistory;
        $record['is_code_editable'] = $usedInRequests === 0 && $usedInHistory === 0;

        return $record;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function supportRequestStatusDefinitions(bool $includeInactive = false): array
    {
        $definitionsByCode = [];
        foreach (self::DEFAULT_SUPPORT_REQUEST_STATUS_DEFINITIONS as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }

            $definitionsByCode[$statusCode] = [
                'id' => null,
                'status_code' => $statusCode,
                'status_name' => (string) ($definition['status_name'] ?? $statusCode),
                'description' => $this->support->normalizeNullableString($definition['description'] ?? null),
                'requires_completion_dates' => (bool) ($definition['requires_completion_dates'] ?? ($statusCode !== 'NEW')),
                'is_terminal' => (bool) ($definition['is_terminal'] ?? in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true)),
                'is_transfer_dev' => (bool) ($definition['is_transfer_dev'] ?? ($statusCode === 'TRANSFER_DEV')),
                'is_active' => (bool) ($definition['is_active'] ?? true),
                'sort_order' => (int) ($definition['sort_order'] ?? 0),
                'created_at' => null,
                'created_by' => null,
                'updated_at' => null,
                'updated_by' => null,
            ];
        }

        if (
            $this->support->hasTable('support_request_statuses')
            && $this->support->hasColumn('support_request_statuses', 'status_code')
            && $this->support->hasColumn('support_request_statuses', 'status_name')
        ) {
            $query = DB::table('support_request_statuses')
                ->select($this->support->selectColumns('support_request_statuses', [
                    'id',
                    'status_code',
                    'status_name',
                    'description',
                    'requires_completion_dates',
                    'is_terminal',
                    'is_transfer_dev',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->support->hasColumn('support_request_statuses', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->support->hasColumn('support_request_statuses', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->support->hasColumn('support_request_statuses', 'status_name')) {
                $query->orderBy('status_name');
            } elseif ($this->support->hasColumn('support_request_statuses', 'status_code')) {
                $query->orderBy('status_code');
            }
            if ($this->support->hasColumn('support_request_statuses', 'id')) {
                $query->orderBy('id');
            }

            foreach ($query->get() as $item) {
                $record = $this->serializeSupportRequestStatusRecord((array) $item);
                $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));
                if ($statusCode === '') {
                    continue;
                }

                $record['status_code'] = $statusCode;
                $definitionsByCode[$statusCode] = $record;
            }
        }

        $definitions = array_values($definitionsByCode);
        usort($definitions, function (array $left, array $right): int {
            $sortCompare = (int) ($left['sort_order'] ?? 0) <=> (int) ($right['sort_order'] ?? 0);
            if ($sortCompare !== 0) {
                return $sortCompare;
            }

            return strcmp(
                strtoupper((string) ($left['status_code'] ?? '')),
                strtoupper((string) ($right['status_code'] ?? ''))
            );
        });

        return array_values($definitions);
    }

    private function loadSupportRequestStatusById(int $id): ?array
    {
        if (! $this->support->hasTable('support_request_statuses')) {
            return null;
        }

        $record = DB::table('support_request_statuses')
            ->select($this->support->selectColumns('support_request_statuses', [
                'id',
                'status_code',
                'status_name',
                'description',
                'requires_completion_dates',
                'is_terminal',
                'is_transfer_dev',
                'is_active',
                'sort_order',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportRequestStatusRecord((array) $record);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSupportRequestStatusRecord(array $record): array
    {
        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'status_code' => $statusCode !== '' ? $statusCode : 'NEW',
            'status_name' => (string) ($record['status_name'] ?? ($statusCode !== '' ? $statusCode : 'NEW')),
            'description' => $record['description'] ?? null,
            'requires_completion_dates' => (bool) ($record['requires_completion_dates'] ?? ($statusCode !== 'NEW')),
            'is_terminal' => (bool) ($record['is_terminal'] ?? in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true)),
            'is_transfer_dev' => (bool) ($record['is_transfer_dev'] ?? ($statusCode === 'TRANSFER_DEV')),
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function sanitizeSupportRequestStatusCode(string $statusCode): string
    {
        $trimmed = trim($statusCode);
        if ($trimmed === '') {
            return '';
        }

        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($trimmed, 'UTF-8')
            : strtoupper($trimmed);
        $normalized = preg_replace('/[^A-Z0-9_]+/', '_', $upper);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    /**
     * @return array<string, string>
     */
    private function supportRequestStatusLookup(): array
    {
        $lookup = [];

        foreach ($this->supportRequestStatusDefinitions(true) as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }

            $lookup[$statusCode] = $statusCode;

            $nameToken = $this->normalizeSupportRequestStatusLookupToken((string) ($definition['status_name'] ?? ''));
            if ($nameToken !== '' && ! isset($lookup[$nameToken])) {
                $lookup[$nameToken] = $statusCode;
            }
        }

        return $lookup;
    }

    private function normalizeSupportRequestStatusLookupToken(string $value): string
    {
        $ascii = Str::upper(Str::ascii(trim($value)));
        $token = preg_replace('/[^A-Z0-9]+/', '', $ascii);

        return (string) $token;
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table)) {
            return false;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->support->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = $payload['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        if (is_array($payload['errors'] ?? null)) {
            foreach ($payload['errors'] as $fieldErrors) {
                if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                    return trim($fieldErrors[0]);
                }
            }
        }

        return $fallback;
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $fieldErrors) {
            if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                return trim($fieldErrors[0]);
            }
        }

        return $exception->getMessage() !== ''
            ? $exception->getMessage()
            : 'Du lieu khong hop le.';
    }
}
