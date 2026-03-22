<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SupportServiceGroupService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function serviceGroups(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return $this->support->missingTable('support_service_groups');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByGroupId = $this->supportServiceGroupUsageSummaryById();
        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
        ];

        if ($this->support->hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
            $selects[] = 'ssg.workflow_status_catalog_id';
            if ($this->support->hasTable('workflow_status_catalogs')) {
                $query->leftJoin('workflow_status_catalogs as wsc_bind', 'ssg.workflow_status_catalog_id', '=', 'wsc_bind.id');
                if ($this->support->hasColumn('workflow_status_catalogs', 'status_code')) {
                    $selects[] = 'wsc_bind.status_code as workflow_status_code';
                }
                if ($this->support->hasColumn('workflow_status_catalogs', 'status_name')) {
                    $selects[] = 'wsc_bind.status_name as workflow_status_name';
                }
                if ($this->support->hasColumn('workflow_status_catalogs', 'form_key')) {
                    $selects[] = 'wsc_bind.form_key as workflow_status_form_key';
                }
            }
        }
        if ($this->support->hasColumn('support_service_groups', 'workflow_form_key')) {
            $selects[] = 'ssg.workflow_form_key';
        }

        if ($this->support->hasColumn('support_service_groups', 'customer_id')) {
            $selects[] = 'ssg.customer_id';
            if ($this->support->hasTable('customers')) {
                $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
                if ($this->support->hasColumn('customers', 'customer_code')) {
                    $selects[] = 'c.customer_code as customer_code';
                }
                if ($this->support->hasColumn('customers', 'customer_name')) {
                    $selects[] = 'c.customer_name as customer_name';
                }
            }
        }

        $query->select($selects);

        if (! $includeInactive && $this->support->hasColumn('support_service_groups', 'is_active')) {
            $query->where('ssg.is_active', 1);
        }

        if (
            $this->support->hasColumn('support_service_groups', 'customer_id')
            && $this->support->hasColumn('customers', 'customer_name')
        ) {
            $query->orderBy('c.customer_name');
        }

        if ($this->support->hasColumn('support_service_groups', 'group_name')) {
            $query->orderBy('ssg.group_name');
        }
        if ($this->support->hasColumn('support_service_groups', 'id')) {
            $query->orderBy('ssg.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendSupportServiceGroupUsageMetadata(
                $this->serializeSupportServiceGroupRecord((array) $item),
                $usageByGroupId
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function availableServiceGroups(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return $this->support->missingTable('support_service_groups');
        }

        if (! $this->support->hasColumn('support_service_groups', 'customer_id')) {
            return response()->json(['message' => 'support_service_groups.customer_id is not available.'], 503);
        }

        $validated = $request->validate([
            'customer_id' => ['required', 'integer'],
            'include_group_id' => ['nullable', 'integer'],
            'include_inactive' => ['nullable', 'boolean'],
        ]);

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $includeGroupId = $this->support->parseNullableInt($validated['include_group_id'] ?? null);
        if ($includeGroupId !== null && ! $this->tableRowExists('support_service_groups', $includeGroupId)) {
            return response()->json(['message' => 'include_group_id is invalid.'], 422);
        }

        $includeInactive = filter_var($validated['include_inactive'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $usageByGroupId = $this->supportServiceGroupUsageSummaryById();

        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
            'ssg.customer_id',
        ];

        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
            if ($this->support->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->support->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
        }

        $query->select($selects)
            ->where(function ($builder) use ($customerId, $includeInactive, $includeGroupId): void {
                $builder->where(function ($matched) use ($customerId, $includeInactive): void {
                    $matched->where('ssg.customer_id', $customerId);
                    if (! $includeInactive) {
                        $matched->where('ssg.is_active', 1);
                    }
                });

                if ($includeGroupId !== null) {
                    $builder->orWhere('ssg.id', $includeGroupId);
                }
            })
            ->orderBy('ssg.group_name')
            ->orderBy('ssg.id');

        $rows = $query
            ->get()
            ->unique(fn (object $item): string => (string) ($item->id ?? ''))
            ->map(fn (object $item): array => $this->appendSupportServiceGroupUsageMetadata(
                $this->serializeSupportServiceGroupRecord((array) $item),
                $usageByGroupId
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeServiceGroup(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return $this->support->missingTable('support_service_groups');
        }

        $validated = $request->validate([
            'group_name' => ['required', 'string', 'max:100'],
            'group_code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'customer_id' => ['required', 'integer'],
            'workflow_status_catalog_id' => ['nullable', 'integer'],
            'workflow_form_key' => ['nullable', 'string', 'max:120'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $workflowStatusCatalogId = $this->support->parseNullableInt($validated['workflow_status_catalog_id'] ?? null);
        if (
            $workflowStatusCatalogId !== null
            && (! $this->support->hasTable('workflow_status_catalogs') || ! $this->tableRowExists('workflow_status_catalogs', $workflowStatusCatalogId))
        ) {
            return response()->json(['message' => 'workflow_status_catalog_id is invalid.'], 422);
        }

        $groupName = trim((string) $validated['group_name']);
        if ($this->supportServiceGroupNameExists($groupName, null, $customerId)) {
            return response()->json(['message' => 'group_name has already been taken.'], 422);
        }

        $payload = [
            'group_name' => $groupName,
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'customer_id' => $customerId,
            'workflow_status_catalog_id' => $workflowStatusCatalogId,
            'workflow_form_key' => $this->support->normalizeNullableString($validated['workflow_form_key'] ?? null),
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        if ($this->support->hasColumn('support_service_groups', 'group_code')) {
            $inputGroupCode = $this->sanitizeSupportServiceGroupCode((string) ($validated['group_code'] ?? ''));
            if ($inputGroupCode === '') {
                $payload['group_code'] = $this->generateSupportServiceGroupCode($groupName, null, $customerId);
            } else {
                if ($this->supportServiceGroupCodeExists($inputGroupCode, null, $customerId)) {
                    return response()->json(['message' => 'group_code has already been taken.'], 422);
                }
                $payload['group_code'] = $inputGroupCode;
            }
        }

        $payload = $this->support->filterPayloadByTableColumns('support_service_groups', $payload);

        if ($this->support->hasColumn('support_service_groups', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('support_service_groups', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_service_groups')->insertGetId($payload);
        $record = $this->loadSupportServiceGroupById($insertId);

        if ($record === null) {
            return response()->json(['message' => 'Support service group created but cannot be reloaded.'], 500);
        }

        $record = $this->appendSupportServiceGroupUsageMetadata(
            $record,
            $this->supportServiceGroupUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function storeServiceGroupsBulk(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return $this->support->missingTable('support_service_groups');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-service-groups', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeServiceGroup($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Khong the tao nhom Zalo/Telegram yeu cau.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Khong the doc phan hoi khi tao nhom Zalo/Telegram yeu cau.',
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
                        : 'Khong the tao nhom Zalo/Telegram yeu cau.',
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

    public function updateServiceGroup(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return $this->support->missingTable('support_service_groups');
        }

        $current = DB::table('support_service_groups')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support service group not found.'], 404);
        }

        $validated = $request->validate([
            'group_name' => ['required', 'string', 'max:100'],
            'group_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'customer_id' => ['required', 'integer'],
            'workflow_status_catalog_id' => ['sometimes', 'nullable', 'integer'],
            'workflow_form_key' => ['sometimes', 'nullable', 'string', 'max:120'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->support->parseNullableInt($request->user()?->id ?? null);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $customerId = $this->support->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $workflowStatusCatalogId = array_key_exists('workflow_status_catalog_id', $validated)
            ? $this->support->parseNullableInt($validated['workflow_status_catalog_id'] ?? null)
            : $this->support->parseNullableInt($current->workflow_status_catalog_id ?? null);
        if (
            $workflowStatusCatalogId !== null
            && (! $this->support->hasTable('workflow_status_catalogs') || ! $this->tableRowExists('workflow_status_catalogs', $workflowStatusCatalogId))
        ) {
            return response()->json(['message' => 'workflow_status_catalog_id is invalid.'], 422);
        }

        $groupName = trim((string) $validated['group_name']);
        if ($this->supportServiceGroupNameExists($groupName, $id, $customerId)) {
            return response()->json(['message' => 'group_name has already been taken.'], 422);
        }

        $payload = ['group_name' => $groupName];
        if ($this->support->hasColumn('support_service_groups', 'customer_id')) {
            $payload['customer_id'] = $customerId;
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('workflow_status_catalog_id', $validated)) {
            $payload['workflow_status_catalog_id'] = $workflowStatusCatalogId;
        }
        if (array_key_exists('workflow_form_key', $validated)) {
            $payload['workflow_form_key'] = $this->support->normalizeNullableString($validated['workflow_form_key'] ?? null);
        }
        if ($this->support->hasColumn('support_service_groups', 'group_code') && array_key_exists('group_code', $validated)) {
            $inputGroupCode = $this->sanitizeSupportServiceGroupCode((string) ($validated['group_code'] ?? ''));
            if ($inputGroupCode === '') {
                $payload['group_code'] = $this->generateSupportServiceGroupCode($groupName, $id, $customerId);
            } else {
                if ($this->supportServiceGroupCodeExists($inputGroupCode, $id, $customerId)) {
                    return response()->json(['message' => 'group_code has already been taken.'], 422);
                }
                $payload['group_code'] = $inputGroupCode;
            }
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('support_service_groups', $payload);
        if ($this->support->hasColumn('support_service_groups', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_service_groups')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportServiceGroupById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support service group not found.'], 404);
        }

        $record = $this->appendSupportServiceGroupUsageMetadata(
            $record,
            $this->supportServiceGroupUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    private function loadSupportServiceGroupById(int $id): ?array
    {
        if (! $this->support->hasTable('support_service_groups')) {
            return null;
        }

        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
        ];

        if ($this->support->hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
            $selects[] = 'ssg.workflow_status_catalog_id';
            if ($this->support->hasTable('workflow_status_catalogs')) {
                $query->leftJoin('workflow_status_catalogs as wsc_bind', 'ssg.workflow_status_catalog_id', '=', 'wsc_bind.id');
                if ($this->support->hasColumn('workflow_status_catalogs', 'status_code')) {
                    $selects[] = 'wsc_bind.status_code as workflow_status_code';
                }
                if ($this->support->hasColumn('workflow_status_catalogs', 'status_name')) {
                    $selects[] = 'wsc_bind.status_name as workflow_status_name';
                }
                if ($this->support->hasColumn('workflow_status_catalogs', 'form_key')) {
                    $selects[] = 'wsc_bind.form_key as workflow_status_form_key';
                }
            }
        }
        if ($this->support->hasColumn('support_service_groups', 'workflow_form_key')) {
            $selects[] = 'ssg.workflow_form_key';
        }

        if ($this->support->hasColumn('support_service_groups', 'customer_id')) {
            $selects[] = 'ssg.customer_id';
            if ($this->support->hasTable('customers')) {
                $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
                if ($this->support->hasColumn('customers', 'customer_code')) {
                    $selects[] = 'c.customer_code as customer_code';
                }
                if ($this->support->hasColumn('customers', 'customer_name')) {
                    $selects[] = 'c.customer_name as customer_name';
                }
            }
        }

        $record = $query
            ->select($selects)
            ->where('ssg.id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportServiceGroupRecord((array) $record);
    }

    /**
     * @return array<int, array{used_in_customer_requests:int}>
     */
    private function supportServiceGroupUsageSummaryById(): array
    {
        $usageByGroupId = [];

        if ($this->support->hasTable('customer_requests') && $this->support->hasColumn('customer_requests', 'service_group_id')) {
            $supportQuery = DB::table('customer_requests')
                ->selectRaw('service_group_id, COUNT(*) as total')
                ->whereNotNull('service_group_id');

            if ($this->support->hasColumn('customer_requests', 'deleted_at')) {
                $supportQuery->whereNull('deleted_at');
            }

            $supportRows = $supportQuery
                ->groupBy('service_group_id')
                ->get();

            foreach ($supportRows as $row) {
                $groupId = $this->support->parseNullableInt($row->service_group_id ?? null);
                if ($groupId === null) {
                    continue;
                }

                if (! isset($usageByGroupId[$groupId])) {
                    $usageByGroupId[$groupId] = [
                        'used_in_customer_requests' => 0,
                    ];
                }
                $usageByGroupId[$groupId]['used_in_customer_requests'] += (int) ($row->total ?? 0);
            }
        }

        return $usageByGroupId;
    }

    /**
     * @param array<int, array{used_in_customer_requests:int}> $usageByGroupId
     * @return array<string, mixed>
     */
    private function appendSupportServiceGroupUsageMetadata(array $record, array $usageByGroupId): array
    {
        $groupId = $this->support->parseNullableInt($record['id'] ?? null);
        $usage = $groupId !== null
            ? ($usageByGroupId[$groupId] ?? ['used_in_customer_requests' => 0])
            : ['used_in_customer_requests' => 0];

        $record['used_in_customer_requests'] = (int) ($usage['used_in_customer_requests'] ?? 0);

        return $record;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSupportServiceGroupRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'group_code' => $this->support->normalizeNullableString($record['group_code'] ?? null),
            'group_name' => (string) ($record['group_name'] ?? ''),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? false),
            'customer_id' => $this->support->parseNullableInt($record['customer_id'] ?? null),
            'customer_code' => $this->support->normalizeNullableString($record['customer_code'] ?? null),
            'customer_name' => $this->support->normalizeNullableString($record['customer_name'] ?? null),
            'workflow_status_catalog_id' => $this->support->parseNullableInt($record['workflow_status_catalog_id'] ?? null),
            'workflow_status_code' => $this->support->normalizeNullableString($record['workflow_status_code'] ?? null),
            'workflow_status_name' => $this->support->normalizeNullableString($record['workflow_status_name'] ?? null),
            'workflow_status_form_key' => $this->support->normalizeNullableString($record['workflow_status_form_key'] ?? null),
            'workflow_form_key' => $this->support->normalizeNullableString($record['workflow_form_key'] ?? null),
            'used_in_customer_requests' => isset($record['used_in_customer_requests']) ? (int) $record['used_in_customer_requests'] : 0,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function sanitizeSupportServiceGroupCode(string $groupCode): string
    {
        $trimmed = trim($groupCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function supportServiceGroupCodeExists(string $groupCode, ?int $ignoreId = null, ?int $customerId = null): bool
    {
        if (
            $groupCode === ''
            || ! $this->support->hasTable('support_service_groups')
            || ! $this->support->hasColumn('support_service_groups', 'group_code')
        ) {
            return false;
        }

        $query = DB::table('support_service_groups')
            ->whereRaw('UPPER(TRIM(group_code)) = ?', [$groupCode]);

        if ($customerId !== null && $this->support->hasColumn('support_service_groups', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($ignoreId !== null && $this->support->hasColumn('support_service_groups', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportServiceGroupNameExists(string $groupName, ?int $ignoreId = null, ?int $customerId = null): bool
    {
        $normalizedName = trim($groupName);
        if (
            $normalizedName === ''
            || ! $this->support->hasTable('support_service_groups')
            || ! $this->support->hasColumn('support_service_groups', 'group_name')
        ) {
            return false;
        }

        $query = DB::table('support_service_groups')
            ->where('group_name', $normalizedName);

        if ($customerId !== null && $this->support->hasColumn('support_service_groups', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($ignoreId !== null && $this->support->hasColumn('support_service_groups', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function resolveUniqueSupportServiceGroupCode(string $baseCode, ?int $ignoreId = null, ?int $customerId = null): string
    {
        $seed = $this->sanitizeSupportServiceGroupCode($baseCode);
        if ($seed === '') {
            $seed = 'GROUP';
        }

        $candidate = $seed;
        $counter = 1;
        while ($this->supportServiceGroupCodeExists($candidate, $ignoreId, $customerId)) {
            $counter++;
            $suffix = '_'.$counter;
            $prefixLength = 50 - strlen($suffix);
            $prefix = substr($seed, 0, max(1, $prefixLength));
            $candidate = $prefix.$suffix;
        }

        return $candidate;
    }

    private function generateSupportServiceGroupCode(string $groupName, ?int $ignoreId = null, ?int $customerId = null): string
    {
        $seed = $this->sanitizeSupportServiceGroupCode($groupName);
        if ($seed === '') {
            $seed = 'GROUP';
        }

        return $this->resolveUniqueSupportServiceGroupCode($seed, $ignoreId, $customerId);
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
