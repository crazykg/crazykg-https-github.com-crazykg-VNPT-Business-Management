<?php

namespace App\Services\V5\Domain;

use App\Models\Product;
use App\Services\V5\IntegrationSettings\EmailSmtpIntegrationService;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductFeatureCatalogDomainService
{
    private const GROUP_TABLE = 'product_feature_groups';
    private const FEATURE_TABLE = 'product_features';
    private const CATALOG_AUDIT_TYPE = 'product_feature_catalogs';
    private const FEATURE_STATUS_ACTIVE = 'ACTIVE';
    private const FEATURE_STATUS_INACTIVE = 'INACTIVE';
    private const FEATURE_NAME_MAX_LENGTH = 2000;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
        private readonly EmailSmtpIntegrationService $emailSmtp,
        private readonly ProductFeatureCatalogOwnershipService $catalogOwnership,
    ) {}

    public function show(Request $request, int $productId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $product = Product::query()->find($productId);
        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $catalogScope = $this->catalogOwnership->resolveProductCatalogScope($product);
        $catalogPolicy = $this->catalogOwnership->resolveProductCatalogPolicy($product, $catalogScope);

        return response()->json([
            'data' => $this->buildCatalogPayload($catalogScope, $product, $catalogPolicy),
        ]);
    }

    public function list(Request $request, int $productId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $product = Product::query()->find($productId);
        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $catalogScope = $this->catalogOwnership->resolveProductCatalogScope($product);
        $catalogPolicy = $this->catalogOwnership->resolveProductCatalogPolicy($product, $catalogScope);
        $catalogProductIds = collect($catalogScope['product_ids'] ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();
        [$page, $perPage] = $this->support->resolvePaginationParams($request, 40, 100);
        $groupId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'group_id'));
        $search = trim((string) $this->support->readFilterParam($request, 'search', ''));
        $groupFilters = $this->loadCatalogGroupFilters($catalogProductIds);
        $listPayload = $this->loadCatalogListRows(
            $catalogProductIds,
            $groupId,
            $search !== '' ? $search : null,
            $page,
            $perPage
        );

        return response()->json([
            'data' => [
                'product' => $this->serializeProductSummary($product, $catalogScope),
                'catalog_scope' => [
                    'catalog_product_id' => $catalogScope['catalog_product_id'] ?? $product->getKey(),
                    'product_ids' => $catalogProductIds,
                    'package_count' => (int) ($catalogScope['package_count'] ?? 1),
                    'product_codes' => array_values(array_filter($catalogScope['product_codes'] ?? [], fn (mixed $code): bool => trim((string) $code) !== '')),
                ],
                'catalog_policy' => $catalogPolicy,
                'group_filters' => $groupFilters,
                'rows' => $listPayload['rows'],
                'meta' => $this->support->buildPaginationMeta($page, $perPage, $listPayload['total']),
            ],
        ]);
    }

    public function update(Request $request, int $productId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $product = Product::query()->find($productId);
        if (! $product) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $catalogScope = $this->catalogOwnership->resolveProductCatalogScope($product);
        $catalogPolicy = $this->catalogOwnership->resolveProductCatalogPolicy($product, $catalogScope);
        if (($catalogPolicy['lock_reason'] ?? null) === 'blocked_by_package') {
            throw ValidationException::withMessages([
                'groups' => [$this->buildProductCatalogLockedMessage($catalogPolicy)],
            ]);
        }

        $catalogProductId = (int) ($catalogScope['catalog_product_id'] ?? $productId);
        $catalogProductIds = collect($catalogScope['product_ids'] ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $validated = $request->validate([
            'groups' => ['required', 'array'],
            'groups.*.id' => ['nullable', 'integer'],
            'groups.*.uuid' => ['nullable', 'string', 'max:100'],
            'groups.*.group_name' => ['required', 'string', 'max:255'],
            'groups.*.notes' => ['nullable', 'string', 'max:2000'],
            'groups.*.display_order' => ['nullable', 'integer', 'min:1'],
            'groups.*.features' => ['nullable', 'array'],
            'groups.*.features.*.id' => ['nullable', 'integer'],
            'groups.*.features.*.uuid' => ['nullable', 'string', 'max:100'],
            'groups.*.features.*.feature_name' => ['required', 'string', 'max:'.self::FEATURE_NAME_MAX_LENGTH],
            'groups.*.features.*.detail_description' => ['nullable', 'string', 'max:20000'],
            'groups.*.features.*.status' => ['nullable', 'string', Rule::in([
                self::FEATURE_STATUS_ACTIVE,
                self::FEATURE_STATUS_INACTIVE,
            ])],
            'groups.*.features.*.display_order' => ['nullable', 'integer', 'min:1'],
            'audit_context' => ['nullable', 'array'],
            'audit_context.source' => ['nullable', 'string', Rule::in(['FORM', 'IMPORT'])],
            'audit_context.import_file_name' => ['nullable', 'string', 'max:255'],
            'audit_context.import_sheet_name' => ['nullable', 'string', 'max:255'],
            'audit_context.import_row_count' => ['nullable', 'integer', 'min:0'],
            'audit_context.import_group_count' => ['nullable', 'integer', 'min:0'],
            'audit_context.import_feature_count' => ['nullable', 'integer', 'min:0'],
        ]);
        $this->validateNoDuplicateCatalogEntries(is_array($validated['groups'] ?? null) ? $validated['groups'] : []);
        $auditContext = $this->normalizeCatalogAuditContext(
            is_array($validated['audit_context'] ?? null) ? $validated['audit_context'] : []
        );

        $beforeSnapshot = $this->loadCatalogSnapshot($catalogProductIds);
        $existingGroups = $this->fetchExistingGroups($catalogProductIds);
        $existingFeatures = $this->fetchExistingFeatures($catalogProductIds);
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $groupIdsSeen = [];
        $featureIdsSeen = [];

        DB::transaction(function () use (
            $request,
            $catalogProductId,
            $catalogProductIds,
            $validated,
            $existingGroups,
            $existingFeatures,
            $actorId,
            &$groupIdsSeen,
            &$featureIdsSeen
        ): void {
            $groups = is_array($validated['groups'] ?? null) ? $validated['groups'] : [];

            foreach ($groups as $groupIndex => $groupPayload) {
                $resolvedGroupId = $this->syncGroup(
                    $request,
                    $catalogProductId,
                    $groupPayload,
                    $groupIndex,
                    $existingGroups,
                    $actorId
                );
                $groupIdsSeen[] = $resolvedGroupId;

                $features = is_array($groupPayload['features'] ?? null) ? $groupPayload['features'] : [];
                foreach ($features as $featureIndex => $featurePayload) {
                    $resolvedFeatureId = $this->syncFeature(
                        $request,
                        $catalogProductId,
                        $resolvedGroupId,
                        $featurePayload,
                        $groupIndex,
                        $featureIndex,
                        $existingFeatures,
                        $actorId
                    );
                    $featureIdsSeen[] = $resolvedFeatureId;
                }
            }

            $this->ensureRemovedGroupsDoNotHaveChildren($existingGroups, $existingFeatures, $groupIdsSeen);
            $this->deleteRemovedFeatures($request, $catalogProductIds, $existingFeatures, $featureIdsSeen, $actorId);
            $this->deleteRemovedGroups($request, $catalogProductIds, $existingGroups, $groupIdsSeen, $actorId);
        });

        $afterSnapshot = $this->loadCatalogSnapshot($catalogProductIds);
        if ($beforeSnapshot !== $afterSnapshot) {
            $event = $beforeSnapshot === []
                ? 'INSERT'
                : ($afterSnapshot === [] ? 'DELETE' : 'UPDATE');
            $changeSummary = $this->buildCatalogChangeSummary($beforeSnapshot, $afterSnapshot, $auditContext);
            $oldAuditPayload = $beforeSnapshot === []
                ? null
                : [
                    'groups' => $beforeSnapshot,
                    'audit_context' => $auditContext,
                    'change_summary' => $changeSummary,
                ];
            $newAuditPayload = $afterSnapshot === []
                ? null
                : [
                    'groups' => $afterSnapshot,
                    'audit_context' => $auditContext,
                    'change_summary' => $changeSummary,
                ];

            $this->accessAudit->recordAuditEvent(
                $request,
                $event,
                self::CATALOG_AUDIT_TYPE,
                $catalogProductId,
                $oldAuditPayload,
                $newAuditPayload
            );

            $this->sendCatalogAuditNotification($request, $product, $catalogScope, $changeSummary);
        }

        foreach ($catalogProductIds as $catalogProductId) {
            $this->insightService->invalidateProductDetailCaches($catalogProductId);
        }

        $updatedCatalogPolicy = $this->catalogOwnership->resolveProductCatalogPolicy($product, $catalogScope);

        return response()->json([
            'data' => $this->buildCatalogPayload($catalogScope, $product, $updatedCatalogPolicy),
        ]);
    }

    private function ensureCatalogTablesExist(): ?JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }
        if (! $this->support->hasTable(self::GROUP_TABLE)) {
            return $this->support->missingTable(self::GROUP_TABLE);
        }
        if (! $this->support->hasTable(self::FEATURE_TABLE)) {
            return $this->support->missingTable(self::FEATURE_TABLE);
        }

        return null;
    }

    private function buildCatalogPayload(array $catalogScope, Product $product, array $catalogPolicy = []): array
    {
        $catalogProductIds = collect($catalogScope['product_ids'] ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();
        $snapshot = $this->loadCatalogSnapshot($catalogProductIds);
        $actorIds = collect($snapshot)
            ->flatMap(function (array $group): array {
                $featureActors = collect($group['features'] ?? [])->flatMap(function (array $feature): array {
                    return [
                        $feature['created_by'] ?? null,
                        $feature['updated_by'] ?? null,
                    ];
                })->all();

                return array_merge(
                    [$group['created_by'] ?? null, $group['updated_by'] ?? null],
                    $featureActors
                );
            })
            ->merge(
                collect($this->loadCatalogAuditLogs($catalogProductIds))->map(fn (array $log) => $log['created_by'] ?? null)
            )
            ->filter(fn (mixed $value): bool => $this->support->parseNullableInt($value) !== null)
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();
        $actorMap = $this->resolveActorMap($actorIds);

        $groups = collect($snapshot)
            ->map(fn (array $group): array => $this->decorateGroupActors($group, $actorMap))
            ->values()
            ->all();

        $auditLogs = collect($this->loadCatalogAuditLogs($catalogProductIds))
            ->map(fn (array $log): array => $this->decorateAuditActor($log, $actorMap))
            ->values()
            ->all();

        return [
            'product' => $this->serializeProductSummary($product, $catalogScope),
            'catalog_scope' => [
                'catalog_product_id' => $catalogScope['catalog_product_id'] ?? $product->getKey(),
                'product_ids' => $catalogProductIds,
                'package_count' => (int) ($catalogScope['package_count'] ?? 1),
                'product_codes' => array_values(array_filter($catalogScope['product_codes'] ?? [], fn (mixed $code): bool => trim((string) $code) !== '')),
            ],
            'catalog_policy' => $catalogPolicy,
            'groups' => $groups,
            'audit_logs' => $auditLogs,
        ];
    }

    private function loadCatalogGroupFilters(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        return DB::table(self::GROUP_TABLE)
            ->select($this->support->selectColumns(self::GROUP_TABLE, [
                'id',
                'group_name',
                'display_order',
                'notes',
            ]))
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(function (object $record): array {
                $row = (array) $record;

                return [
                    'id' => $row['id'] ?? null,
                    'group_name' => trim((string) ($row['group_name'] ?? '')),
                    'display_order' => (int) ($row['display_order'] ?? 0),
                    'notes' => $this->support->normalizeNullableString($row['notes'] ?? null),
                ];
            })
            ->filter(fn (array $row): bool => $this->support->parseNullableInt($row['id'] ?? null) !== null)
            ->values()
            ->all();
    }

    /**
     * @return array{rows:array<int, array<string, mixed>>, total:int}
     */
    private function loadCatalogListRows(array $productIds, ?int $groupId, ?string $search, int $page, int $perPage): array
    {
        if ($productIds === []) {
            return ['rows' => [], 'total' => 0];
        }

        $searchLike = null;
        if ($search !== null && trim($search) !== '') {
            $searchLike = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($search)) . '%';
        }

        $buildUnionQuery = function () use ($productIds, $groupId, $searchLike) {
            $groupRows = DB::table(self::GROUP_TABLE . ' as g')
                ->selectRaw(
                    "'group' as row_type, g.id as group_id, null as feature_id, " .
                    "g.display_order as group_display_order, null as feature_display_order, " .
                    "g.group_name as row_name, COALESCE(NULLIF(g.notes, ''), 'Danh sách chức năng thuộc phân hệ này.') as row_detail"
                )
                ->whereIn('g.product_id', $productIds)
                ->when(
                    $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                    fn ($query) => $query->whereNull('g.deleted_at')
                )
                ->when($groupId !== null, fn ($query) => $query->where('g.id', $groupId))
                ->when($searchLike !== null, function ($query) use ($searchLike): void {
                    $query->whereExists(function ($exists) use ($searchLike): void {
                        $exists->selectRaw('1')
                            ->from(self::FEATURE_TABLE . ' as f')
                            ->whereColumn('f.group_id', 'g.id')
                            ->when(
                                $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                                fn ($featureQuery) => $featureQuery->whereNull('f.deleted_at')
                            )
                            ->where('f.feature_name', 'like', $searchLike);
                    });
                });

            $featureRows = DB::table(self::FEATURE_TABLE . ' as f')
                ->join(self::GROUP_TABLE . ' as g', 'g.id', '=', 'f.group_id')
                ->selectRaw(
                    "'feature' as row_type, g.id as group_id, f.id as feature_id, " .
                    "g.display_order as group_display_order, f.display_order as feature_display_order, " .
                    "f.feature_name as row_name, COALESCE(NULLIF(f.detail_description, ''), '—') as row_detail"
                )
                ->whereIn('f.product_id', $productIds)
                ->when(
                    $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                    fn ($query) => $query->whereNull('g.deleted_at')
                )
                ->when(
                    $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                    fn ($query) => $query->whereNull('f.deleted_at')
                )
                ->when($groupId !== null, fn ($query) => $query->where('g.id', $groupId))
                ->when($searchLike !== null, fn ($query) => $query->where('f.feature_name', 'like', $searchLike));

            return $groupRows->unionAll($featureRows);
        };

        $total = (int) DB::query()
            ->fromSub($buildUnionQuery(), 'catalog_rows')
            ->count();

        $rows = DB::query()
            ->fromSub($buildUnionQuery(), 'catalog_rows')
            ->orderBy('group_display_order')
            ->orderByRaw("case when row_type = 'group' then 0 else 1 end")
            ->orderBy('feature_display_order')
            ->orderBy('group_id')
            ->orderBy('feature_id')
            ->forPage($page, $perPage)
            ->get()
            ->map(function (object $record): array {
                $row = (array) $record;
                $rowType = ($row['row_type'] ?? 'feature') === 'group' ? 'group' : 'feature';

                return [
                    'row_type' => $rowType,
                    'group_id' => $row['group_id'] ?? null,
                    'feature_id' => $row['feature_id'] ?? null,
                    'group_display_order' => (int) ($row['group_display_order'] ?? 0),
                    'feature_display_order' => $row['feature_display_order'] !== null ? (int) $row['feature_display_order'] : null,
                    'name' => trim((string) ($row['row_name'] ?? '')),
                    'detail' => $this->support->normalizeNullableString($row['row_detail'] ?? null)
                        ?? ($rowType === 'group' ? 'Danh sách chức năng thuộc phân hệ này.' : '—'),
                ];
            })
            ->values()
            ->all();

        return [
            'rows' => $rows,
            'total' => $total,
        ];
    }

    private function syncGroup(
        Request $request,
        int $productId,
        array $groupPayload,
        int $groupIndex,
        Collection $existingGroups,
        ?int $actorId
    ): int {
        $groupId = $this->support->parseNullableInt($groupPayload['id'] ?? null);
        if ($groupId !== null && ! $existingGroups->has((string) $groupId)) {
            throw ValidationException::withMessages([
                "groups.{$groupIndex}.id" => ['Nhóm chức năng không hợp lệ hoặc không thuộc sản phẩm đang chọn.'],
            ]);
        }

        $normalizedGroup = [
            'product_id' => $productId,
            'group_name' => trim((string) ($groupPayload['group_name'] ?? '')),
            'display_order' => $groupIndex + 1,
            'notes' => $this->support->normalizeNullableString($groupPayload['notes'] ?? null),
        ];

        if ($groupId === null) {
            $insertPayload = array_merge($normalizedGroup, [
                'uuid' => $this->support->normalizeNullableString($groupPayload['uuid'] ?? null) ?: (string) Str::uuid(),
            ]);
            if ($actorId !== null) {
                $insertPayload['created_by'] = $actorId;
                $insertPayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::GROUP_TABLE, 'created_at')) {
                $insertPayload['created_at'] = now();
            }
            if ($this->support->hasColumn(self::GROUP_TABLE, 'updated_at')) {
                $insertPayload['updated_at'] = now();
            }

            $insertPayload = $this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $insertPayload);
            $groupId = (int) DB::table(self::GROUP_TABLE)->insertGetId($insertPayload);
            $inserted = $this->fetchGroupRecord($groupId);

            $this->accessAudit->recordAuditEvent(
                $request,
                'INSERT',
                self::GROUP_TABLE,
                $groupId,
                null,
                $inserted
            );

            return $groupId;
        }

        $existingGroup = (array) $existingGroups->get((string) $groupId);
        $before = $this->extractGroupAuditRecord($existingGroup);
        $updatePayload = array_merge($normalizedGroup, []);
        if ($actorId !== null) {
            $updatePayload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn(self::GROUP_TABLE, 'updated_at')) {
            $updatePayload['updated_at'] = now();
        }
        $updatePayload = $this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $updatePayload);

        if ($this->extractGroupAuditRecord(array_merge($existingGroup, $updatePayload)) !== $before) {
            DB::table(self::GROUP_TABLE)
                ->where('id', $groupId)
                ->update($updatePayload);

            $after = $this->fetchGroupRecord($groupId);
            $this->accessAudit->recordAuditEvent(
                $request,
                'UPDATE',
                self::GROUP_TABLE,
                $groupId,
                $before,
                $after
            );
        }

        return $groupId;
    }

    private function syncFeature(
        Request $request,
        int $productId,
        int $groupId,
        array $featurePayload,
        int $groupIndex,
        int $featureIndex,
        Collection $existingFeatures,
        ?int $actorId
    ): int {
        $featureId = $this->support->parseNullableInt($featurePayload['id'] ?? null);
        if ($featureId !== null && ! $existingFeatures->has((string) $featureId)) {
            throw ValidationException::withMessages([
                "groups.{$groupIndex}.features.{$featureIndex}.id" => ['Chức năng không hợp lệ hoặc không thuộc sản phẩm đang chọn.'],
            ]);
        }

        $normalizedFeature = [
            'product_id' => $productId,
            'group_id' => $groupId,
            'feature_name' => trim((string) ($featurePayload['feature_name'] ?? '')),
            'detail_description' => $this->support->normalizeNullableString($featurePayload['detail_description'] ?? null),
            'status' => $this->normalizeFeatureStatus($featurePayload['status'] ?? null),
            'display_order' => $featureIndex + 1,
        ];

        if ($featureId === null) {
            $insertPayload = array_merge($normalizedFeature, [
                'uuid' => $this->support->normalizeNullableString($featurePayload['uuid'] ?? null) ?: (string) Str::uuid(),
            ]);
            if ($actorId !== null) {
                $insertPayload['created_by'] = $actorId;
                $insertPayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'created_at')) {
                $insertPayload['created_at'] = now();
            }
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'updated_at')) {
                $insertPayload['updated_at'] = now();
            }

            $insertPayload = $this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $insertPayload);
            $featureId = (int) DB::table(self::FEATURE_TABLE)->insertGetId($insertPayload);
            $inserted = $this->fetchFeatureRecord($featureId);

            $this->accessAudit->recordAuditEvent(
                $request,
                'INSERT',
                self::FEATURE_TABLE,
                $featureId,
                null,
                $inserted
            );

            return $featureId;
        }

        $existingFeature = (array) $existingFeatures->get((string) $featureId);
        $before = $this->extractFeatureAuditRecord($existingFeature);
        $updatePayload = array_merge($normalizedFeature, []);
        if ($actorId !== null) {
            $updatePayload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn(self::FEATURE_TABLE, 'updated_at')) {
            $updatePayload['updated_at'] = now();
        }
        $updatePayload = $this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $updatePayload);

        if ($this->extractFeatureAuditRecord(array_merge($existingFeature, $updatePayload)) !== $before) {
            DB::table(self::FEATURE_TABLE)
                ->where('id', $featureId)
                ->update($updatePayload);

            $after = $this->fetchFeatureRecord($featureId);
            $this->accessAudit->recordAuditEvent(
                $request,
                'UPDATE',
                self::FEATURE_TABLE,
                $featureId,
                $before,
                $after
            );
        }

        return $featureId;
    }

    private function deleteRemovedFeatures(
        Request $request,
        array $productIds,
        Collection $existingFeatures,
        array $featureIdsSeen,
        ?int $actorId
    ): void {
        if ($productIds === []) {
            return;
        }

        $remainingIds = collect($featureIdsSeen)->map(fn (mixed $id): int => (int) $id)->values()->all();
        $toDelete = DB::table(self::FEATURE_TABLE)
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->when(
                $remainingIds !== [],
                fn ($query) => $query->whereNotIn('id', $remainingIds)
            )
            ->when(
                $remainingIds === [],
                fn ($query) => $query
            )
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        foreach ($toDelete as $record) {
            $featureId = (int) ($record['id'] ?? 0);
            if ($featureId <= 0) {
                continue;
            }

            $before = $this->extractFeatureAuditRecord($record);
            $deletePayload = [];
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at')) {
                $deletePayload['deleted_at'] = now();
            }
            if ($actorId !== null && $this->support->hasColumn(self::FEATURE_TABLE, 'updated_by')) {
                $deletePayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'updated_at')) {
                $deletePayload['updated_at'] = now();
            }
            $deletePayload = $this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $deletePayload);

            if ($deletePayload !== []) {
                DB::table(self::FEATURE_TABLE)
                    ->where('id', $featureId)
                    ->update($deletePayload);
            } else {
                DB::table(self::FEATURE_TABLE)->where('id', $featureId)->delete();
            }

            $this->accessAudit->recordAuditEvent(
                $request,
                'DELETE',
                self::FEATURE_TABLE,
                $featureId,
                $before,
                null
            );
        }
    }

    private function deleteRemovedGroups(
        Request $request,
        array $productIds,
        Collection $existingGroups,
        array $groupIdsSeen,
        ?int $actorId
    ): void {
        if ($productIds === []) {
            return;
        }

        $remainingIds = collect($groupIdsSeen)->map(fn (mixed $id): int => (int) $id)->values()->all();
        $toDelete = DB::table(self::GROUP_TABLE)
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->when(
                $remainingIds !== [],
                fn ($query) => $query->whereNotIn('id', $remainingIds)
            )
            ->when(
                $remainingIds === [],
                fn ($query) => $query
            )
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        foreach ($toDelete as $record) {
            $groupId = (int) ($record['id'] ?? 0);
            if ($groupId <= 0) {
                continue;
            }

            $before = $this->extractGroupAuditRecord($record);
            $deletePayload = [];
            if ($this->support->hasColumn(self::GROUP_TABLE, 'deleted_at')) {
                $deletePayload['deleted_at'] = now();
            }
            if ($actorId !== null && $this->support->hasColumn(self::GROUP_TABLE, 'updated_by')) {
                $deletePayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::GROUP_TABLE, 'updated_at')) {
                $deletePayload['updated_at'] = now();
            }
            $deletePayload = $this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $deletePayload);

            if ($deletePayload !== []) {
                DB::table(self::GROUP_TABLE)
                    ->where('id', $groupId)
                    ->update($deletePayload);
            } else {
                DB::table(self::GROUP_TABLE)->where('id', $groupId)->delete();
            }

            $this->accessAudit->recordAuditEvent(
                $request,
                'DELETE',
                self::GROUP_TABLE,
                $groupId,
                $before,
                null
            );
        }
    }

    private function ensureRemovedGroupsDoNotHaveChildren(
        Collection $existingGroups,
        Collection $existingFeatures,
        array $groupIdsSeen
    ): void {
        $remainingIds = collect($groupIdsSeen)
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $groupIdsMarkedForDeletion = $existingGroups
            ->keys()
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0 && ! in_array($id, $remainingIds, true))
            ->values();

        if ($groupIdsMarkedForDeletion->isEmpty()) {
            return;
        }

        $errors = [];
        foreach ($groupIdsMarkedForDeletion as $groupId) {
            $groupRecord = (array) ($existingGroups->get((string) $groupId) ?? []);
            $groupName = trim((string) ($groupRecord['group_name'] ?? ''));
            $errors['groups'][] = sprintf(
                'Nhóm "%s" đã phát sinh dữ liệu danh mục chức năng. Không thể xóa nhóm đã lưu.',
                $groupName !== '' ? $groupName : ('#' . $groupId)
            );
        }

        $childCountByGroup = $existingFeatures
            ->filter(function (mixed $feature) use ($groupIdsMarkedForDeletion): bool {
                $groupId = (int) (((array) $feature)['group_id'] ?? 0);

                return $groupId > 0 && $groupIdsMarkedForDeletion->contains($groupId);
            })
            ->groupBy(fn (mixed $feature): int => (int) (((array) $feature)['group_id'] ?? 0))
            ->map(fn (Collection $features): int => $features->count());

        foreach ($groupIdsMarkedForDeletion as $groupId) {
            $childCount = (int) ($childCountByGroup->get($groupId) ?? 0);
            if ($childCount <= 0) {
                continue;
            }

            $groupRecord = (array) ($existingGroups->get((string) $groupId) ?? []);
            $groupName = trim((string) ($groupRecord['group_name'] ?? ''));
            $errors['groups'][] = sprintf(
                'Nhóm "%s" đang có %d chức năng con. Vui lòng xóa các chức năng con trước khi xóa nhóm.',
                $groupName !== '' ? $groupName : ('#' . $groupId),
                $childCount
            );
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function fetchExistingGroups(array $productIds): Collection
    {
        if ($productIds === []) {
            return collect();
        }

        return collect(DB::table(self::GROUP_TABLE)
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->keyBy(fn (array $record): string => (string) ($record['id'] ?? ''))
            ->filter(fn (array $record, string $key): bool => $key !== '')
            ->all());
    }

    private function fetchExistingFeatures(array $productIds): Collection
    {
        if ($productIds === []) {
            return collect();
        }

        return collect(DB::table(self::FEATURE_TABLE)
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->keyBy(fn (array $record): string => (string) ($record['id'] ?? ''))
            ->filter(fn (array $record, string $key): bool => $key !== '')
            ->all());
    }

    private function loadCatalogSnapshot(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $groups = DB::table(self::GROUP_TABLE)
            ->select($this->support->selectColumns(self::GROUP_TABLE, [
                'id',
                'uuid',
                'product_id',
                'group_name',
                'display_order',
                'notes',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        $features = DB::table(self::FEATURE_TABLE)
            ->select($this->support->selectColumns(self::FEATURE_TABLE, [
                'id',
                'uuid',
                'product_id',
                'group_id',
                'feature_name',
                'detail_description',
                'status',
                'display_order',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->whereIn('product_id', $productIds)
            ->when(
                $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                fn ($query) => $query->whereNull('deleted_at')
            )
            ->orderBy('group_id')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->groupBy(fn (array $record): string => (string) ($record['group_id'] ?? ''))
            ->all();

        return $groups
            ->map(function (array $group) use ($features): array {
                $groupId = (string) ($group['id'] ?? '');
                $items = collect($features[$groupId] ?? [])
                    ->map(fn (array $feature): array => $this->serializeFeatureRecord($feature))
                    ->values()
                    ->all();

                return [
                    ...$this->serializeGroupRecord($group),
                    'features' => $items,
                ];
            })
            ->values()
            ->all();
    }

    private function loadCatalogAuditLogs(array $productIds): array
    {
        if (! $this->support->hasTable('audit_logs') || $productIds === []) {
            return [];
        }

        $auditLogIdColumns = $this->support->selectColumns('audit_logs', [
            'id',
            'created_at',
        ]);
        if (! in_array('id', $auditLogIdColumns, true)) {
            return [];
        }

        // Fetch the latest ids first so MySQL does not sort large JSON payload columns in memory.
        $auditLogIds = DB::table('audit_logs')
            ->select($auditLogIdColumns)
            ->where('auditable_type', self::CATALOG_AUDIT_TYPE)
            ->whereIn('auditable_id', $productIds)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(100)
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        if ($auditLogIds === []) {
            return [];
        }

        $auditLogsById = DB::table('audit_logs')
            ->select($this->support->selectColumns('audit_logs', [
                'id',
                'uuid',
                'event',
                'auditable_type',
                'auditable_id',
                'old_values',
                'new_values',
                'url',
                'ip_address',
                'user_agent',
                'created_at',
                'created_by',
            ]))
            ->whereIn('id', $auditLogIds)
            ->get()
            ->map(function (object $record): array {
                $row = (array) $record;
                if (array_key_exists('old_values', $row)) {
                    $row['old_values'] = $this->decodeJsonColumnIfNeeded($row['old_values']);
                }
                if (array_key_exists('new_values', $row)) {
                    $row['new_values'] = $this->decodeJsonColumnIfNeeded($row['new_values']);
                }

                return $row;
            })
            ->keyBy(fn (array $row): int => (int) ($row['id'] ?? 0));

        return collect($auditLogIds)
            ->map(fn (int $id): ?array => $auditLogsById->get($id))
            ->filter(fn (?array $row): bool => $row !== null)
            ->values()
            ->all();
    }

    private function resolveActorMap(array $actorIds): array
    {
        if ($actorIds === []) {
            return [];
        }

        $actorTable = $this->support->resolveEmployeeTable();
        if ($actorTable === null) {
            return [];
        }

        $columns = $this->support->selectColumns($actorTable, ['id', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($actorTable)
            ->select($columns)
            ->whereIn('id', $actorIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => $data['id'] ?? null,
                    'full_name' => $this->support->firstNonEmpty($data, ['full_name', 'name']),
                    'username' => $this->support->firstNonEmpty($data, ['username']),
                ];
            })
            ->filter(fn (array $record): bool => array_key_exists('id', $record) && $record['id'] !== null)
            ->keyBy(fn (array $record): string => (string) $record['id'])
            ->all();
    }

    private function decorateGroupActors(array $group, array $actorMap): array
    {
        return [
            ...$group,
            'created_by_actor' => $this->resolveActor($group['created_by'] ?? null, $actorMap),
            'updated_by_actor' => $this->resolveActor($group['updated_by'] ?? null, $actorMap),
            'features' => collect($group['features'] ?? [])
                ->map(fn (array $feature): array => [
                    ...$feature,
                    'created_by_actor' => $this->resolveActor($feature['created_by'] ?? null, $actorMap),
                    'updated_by_actor' => $this->resolveActor($feature['updated_by'] ?? null, $actorMap),
                ])
                ->values()
                ->all(),
        ];
    }

    private function decorateAuditActor(array $auditLog, array $actorMap): array
    {
        return [
            ...$auditLog,
            'actor' => $this->resolveActor($auditLog['created_by'] ?? null, $actorMap),
        ];
    }

    private function resolveActor(mixed $actorId, array $actorMap): ?array
    {
        $resolvedId = $this->support->parseNullableInt($actorId);
        if ($resolvedId === null) {
            return null;
        }

        return $actorMap[(string) $resolvedId] ?? null;
    }

    private function serializeProductSummary(Product $product, array $catalogScope = []): array
    {
        return [
            'id' => $product->getKey(),
            'uuid' => $product->uuid ?? null,
            'service_group' => $product->service_group ?? null,
            'product_code' => (string) ($product->product_code ?? ''),
            'product_name' => (string) ($product->product_name ?? ''),
            'package_name' => $this->support->normalizeNullableString($product->package_name ?? null),
            'description' => $this->support->normalizeNullableString($product->description ?? null),
            'is_active' => $product->is_active !== false,
            'catalog_package_count' => (int) ($catalogScope['package_count'] ?? 1),
        ];
    }

    private function buildProductCatalogLockedMessage(array $catalogPolicy): string
    {
        $blockingPackages = collect($catalogPolicy['blocking_packages'] ?? [])
            ->map(function (mixed $package): string {
                $packageData = is_array($package) ? $package : [];
                $packageCode = trim((string) ($packageData['package_code'] ?? ''));
                $packageName = trim((string) ($packageData['package_name'] ?? ''));

                return $packageCode !== '' && $packageName !== ''
                    ? sprintf('%s - %s', $packageCode, $packageName)
                    : ($packageCode !== '' ? $packageCode : $packageName);
            })
            ->filter(fn (string $label): bool => $label !== '')
            ->values()
            ->all();

        if ($blockingPackages === []) {
            return 'Danh mục chức năng của sản phẩm đang bị khóa vì đã có dữ liệu ở product-package.';
        }

        return sprintf(
            'Danh mục chức năng của sản phẩm đang bị khóa vì đã có dữ liệu ở product-package: %s.',
            implode(', ', $blockingPackages)
        );
    }

    private function serializeGroupRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'group_name' => trim((string) ($record['group_name'] ?? '')),
            'display_order' => (int) ($record['display_order'] ?? 0),
            'notes' => $this->support->normalizeNullableString($record['notes'] ?? null),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeFeatureRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'group_id' => $record['group_id'] ?? null,
            'feature_name' => trim((string) ($record['feature_name'] ?? '')),
            'detail_description' => $this->support->normalizeNullableString($record['detail_description'] ?? null),
            'status' => $this->normalizeFeatureStatus($record['status'] ?? null),
            'display_order' => (int) ($record['display_order'] ?? 0),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function sendCatalogAuditNotification(
        Request $request,
        Product $product,
        array $catalogScope,
        array $changeSummary
    ): void {
        $recipients = collect(config('audit.product_feature_catalog_notification_recipients', []))
            ->map(fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values()
            ->all();

        if ($recipients === []) {
            return;
        }

        $actor = $request->user();
        $actorName = trim((string) ($actor?->full_name ?? $actor?->username ?? 'Không rõ'));
        $actorUsername = trim((string) ($actor?->username ?? ''));
        $actorDisplay = $actorUsername !== ''
            ? sprintf('%s (%s)', $actorName, $actorUsername)
            : $actorName;
        $performedAt = now()->format('d/m/Y H:i:s');

        $result = $this->emailSmtp->sendHtmlEmail(
            $recipients,
            $this->buildCatalogAuditEmailSubject($product, $changeSummary),
            $this->buildCatalogAuditEmailLines($request, $product, $catalogScope, $changeSummary, $performedAt, $actorDisplay),
            $this->buildCatalogAuditEmailHtml($request, $product, $catalogScope, $changeSummary, $performedAt, $actorDisplay)
        );

        if (($result['success'] ?? false) === true) {
            return;
        }

        Log::warning('product_feature_catalog.audit_email_failed', [
            'product_id' => $product->getKey(),
            'product_code' => $product->product_code ?? null,
            'recipients' => $recipients,
            'message' => $result['message'] ?? 'Unknown mail error.',
        ]);
    }

    private function buildCatalogAuditEmailSubject(Product $product, array $changeSummary): string
    {
        $source = strtoupper(trim((string) ($changeSummary['source'] ?? 'FORM')));
        $sourceLabel = $source === 'IMPORT' ? 'Import' : 'Cập nhật';
        $productCode = trim((string) ($product->product_code ?? ''));
        $productName = trim((string) ($product->product_name ?? ''));
        $productLabel = $productCode !== ''
            ? $productCode
            : ($productName !== '' ? $productName : sprintf('Product #%s', (string) $product->getKey()));

        return sprintf('[VNPT Business] %s danh mục chức năng - %s', $sourceLabel, $productLabel);
    }

    private function buildCatalogAuditEmailLines(
        Request $request,
        Product $product,
        array $catalogScope,
        array $changeSummary,
        string $performedAt,
        string $actorDisplay
    ): array {
        $source = strtoupper(trim((string) ($changeSummary['source'] ?? 'FORM')));
        $sourceLabel = $source === 'IMPORT' ? 'Import file' : 'Nhập tay trên giao diện';
        $packageCount = max(1, (int) ($catalogScope['package_count'] ?? 1));
        $entries = is_array($changeSummary['entries'] ?? null) ? $changeSummary['entries'] : [];
        $visibleEntries = array_slice($entries, 0, 20);
        $remainingEntryCount = max(0, count($entries) - count($visibleEntries));
        $counts = is_array($changeSummary['counts'] ?? null) ? $changeSummary['counts'] : [];

        $messageLines = [
            'Hệ thống vừa ghi nhận một lần lưu danh mục chức năng.',
            '',
            'Sản phẩm: ' . trim((string) ($product->product_name ?? '')),
            'Mã sản phẩm: ' . trim((string) ($product->product_code ?? '')),
            'Gói triển khai cùng catalog: ' . $packageCount,
            'Người thực hiện: ' . $actorDisplay,
            'Thời gian: ' . $performedAt,
            'Nguồn thao tác: ' . $sourceLabel,
            'URL: ' . $request->fullUrl(),
            'IP: ' . (string) ($request->ip() ?? 'Không rõ'),
            '',
            'Tổng quan thay đổi:',
            '- Phân hệ tạo mới: ' . (int) ($counts['groups_created'] ?? 0),
            '- Phân hệ cập nhật: ' . (int) ($counts['groups_updated'] ?? 0),
            '- Phân hệ xóa: ' . (int) ($counts['groups_deleted'] ?? 0),
            '- Chức năng tạo mới: ' . (int) ($counts['features_created'] ?? 0),
            '- Chức năng cập nhật: ' . (int) ($counts['features_updated'] ?? 0),
            '- Chức năng xóa: ' . (int) ($counts['features_deleted'] ?? 0),
        ];

        $import = is_array($changeSummary['import'] ?? null) ? $changeSummary['import'] : null;
        if ($import !== null) {
            $messageLines[] = '';
            $messageLines[] = 'Thông tin import:';
            $messageLines[] = '- File: ' . trim((string) ($import['file_name'] ?? 'Không rõ'));
            $messageLines[] = '- Sheet: ' . trim((string) ($import['sheet_name'] ?? 'Không rõ'));
            $messageLines[] = '- Số dòng: ' . (int) ($import['row_count'] ?? 0);
            $messageLines[] = '- Số phân hệ: ' . (int) ($import['group_count'] ?? 0);
            $messageLines[] = '- Số chức năng: ' . (int) ($import['feature_count'] ?? 0);
        }

        if ($visibleEntries !== []) {
            $messageLines[] = '';
            $messageLines[] = 'Chi tiết thay đổi:';

            foreach ($visibleEntries as $entry) {
                $messageLines[] = '- ' . trim((string) ($entry['message'] ?? 'Thay đổi không rõ'));

                $fieldChanges = is_array($entry['field_changes'] ?? null) ? $entry['field_changes'] : [];
                foreach ($fieldChanges as $change) {
                    $messageLines[] = sprintf(
                        '  + %s: %s -> %s',
                        trim((string) ($change['label'] ?? 'Trường')),
                        trim((string) ($change['from'] ?? '—')),
                        trim((string) ($change['to'] ?? '—'))
                    );
                }
            }

            if ($remainingEntryCount > 0) {
                $messageLines[] = sprintf('... và còn %d thay đổi khác trong hệ thống.', $remainingEntryCount);
            }
        }

        $messageLines[] = '';
        $messageLines[] = 'Bạn có thể mở màn hình Danh mục chức năng để xem lịch sử thay đổi chi tiết.';

        return $messageLines;
    }

    private function buildCatalogAuditEmailHtml(
        Request $request,
        Product $product,
        array $catalogScope,
        array $changeSummary,
        string $performedAt,
        string $actorDisplay
    ): string {
        $source = strtoupper(trim((string) ($changeSummary['source'] ?? 'FORM')));
        $sourceLabel = $source === 'IMPORT' ? 'Import file' : 'Nhập tay trên giao diện';
        $packageCount = max(1, (int) ($catalogScope['package_count'] ?? 1));
        $productName = trim((string) ($product->product_name ?? ''));
        $productCode = trim((string) ($product->product_code ?? ''));
        $counts = is_array($changeSummary['counts'] ?? null) ? $changeSummary['counts'] : [];
        $entries = is_array($changeSummary['entries'] ?? null) ? $changeSummary['entries'] : [];
        $visibleEntries = array_slice($entries, 0, 20);
        $remainingEntryCount = max(0, count($entries) - count($visibleEntries));
        $import = is_array($changeSummary['import'] ?? null) ? $changeSummary['import'] : null;
        $url = trim((string) $request->fullUrl());

        $infoRows = [
            ['label' => 'Sản phẩm', 'value' => $productName !== '' ? $productName : '—'],
            ['label' => 'Mã sản phẩm', 'value' => $productCode !== '' ? $productCode : '—'],
            ['label' => 'Gói triển khai cùng catalog', 'value' => (string) $packageCount],
            ['label' => 'Người thực hiện', 'value' => $actorDisplay],
            ['label' => 'Thời gian', 'value' => $performedAt],
            ['label' => 'Nguồn thao tác', 'value' => $sourceLabel],
            [
                'label' => 'URL',
                'value' => $url !== ''
                    ? '<a href="' . $this->escapeCatalogAuditHtml($url) . '" style="color:#0b4f93;text-decoration:none;">'
                        . $this->escapeCatalogAuditHtml($url)
                        . '</a>'
                    : '—',
                'is_html' => $url !== '',
            ],
            ['label' => 'IP', 'value' => (string) ($request->ip() ?? 'Không rõ')],
        ];

        $summaryRows = [
            ['label' => 'Phân hệ tạo mới', 'value' => (string) (int) ($counts['groups_created'] ?? 0)],
            ['label' => 'Phân hệ cập nhật', 'value' => (string) (int) ($counts['groups_updated'] ?? 0)],
            ['label' => 'Phân hệ xóa', 'value' => (string) (int) ($counts['groups_deleted'] ?? 0)],
            ['label' => 'Chức năng tạo mới', 'value' => (string) (int) ($counts['features_created'] ?? 0)],
            ['label' => 'Chức năng cập nhật', 'value' => (string) (int) ($counts['features_updated'] ?? 0)],
            ['label' => 'Chức năng xóa', 'value' => (string) (int) ($counts['features_deleted'] ?? 0)],
        ];

        $html = [
            '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
            '<body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">',
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:1100px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;">',
            '<tr><td style="padding:28px 32px 16px 32px;">',
            '<div style="font-size:24px;font-weight:700;color:#0b4f93;">Thông báo cập nhật danh mục chức năng</div>',
            '<div style="margin-top:8px;font-size:14px;line-height:1.6;color:#4b5563;">Hệ thống vừa ghi nhận một lần lưu danh mục chức năng. Bạn có thể mở màn hình Danh mục chức năng để xem lịch sử thay đổi chi tiết.</div>',
            '</td></tr>',
            '<tr><td style="padding:0 32px 24px 32px;">',
            '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Thông tin thao tác</div>',
            $this->renderCatalogAuditKeyValueTableHtml($infoRows),
            '</td></tr>',
            '<tr><td style="padding:0 32px 24px 32px;">',
            '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Tổng quan thay đổi</div>',
            $this->renderCatalogAuditKeyValueTableHtml($summaryRows),
            '</td></tr>',
        ];

        if ($import !== null) {
            $importRows = [
                ['label' => 'File import', 'value' => trim((string) ($import['file_name'] ?? 'Không rõ'))],
                ['label' => 'Sheet import', 'value' => trim((string) ($import['sheet_name'] ?? 'Không rõ'))],
                ['label' => 'Số dòng', 'value' => (string) (int) ($import['row_count'] ?? 0)],
                ['label' => 'Số phân hệ', 'value' => (string) (int) ($import['group_count'] ?? 0)],
                ['label' => 'Số chức năng', 'value' => (string) (int) ($import['feature_count'] ?? 0)],
            ];

            $html[] = '<tr><td style="padding:0 32px 24px 32px;">';
            $html[] = '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Thông tin import</div>';
            $html[] = $this->renderCatalogAuditKeyValueTableHtml($importRows);
            $html[] = '</td></tr>';
        }

        $html[] = '<tr><td style="padding:0 32px 32px 32px;">';
        $html[] = '<div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Nội dung thay đổi</div>';
        $html[] = '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #dbe4f0;">';
        $html[] = '<thead><tr>';
        $html[] = '<th align="left" style="width:38%;padding:14px 16px;background:#f8fbff;border:1px solid #dbe4f0;font-size:13px;font-weight:700;color:#0f172a;">Nội dung cũ</th>';
        $html[] = '<th align="left" style="width:38%;padding:14px 16px;background:#f8fbff;border:1px solid #dbe4f0;font-size:13px;font-weight:700;color:#0f172a;">Nội dung đã cập nhật</th>';
        $html[] = '<th align="left" style="width:24%;padding:14px 16px;background:#f8fbff;border:1px solid #dbe4f0;font-size:13px;font-weight:700;color:#0f172a;">Người cập nhật, ngày giờ cập nhật</th>';
        $html[] = '</tr></thead><tbody>';
        $html[] = $this->buildCatalogAuditEmailChangeRowsHtml($visibleEntries, $actorDisplay, $performedAt);

        if ($remainingEntryCount > 0) {
            $html[] = '<tr>';
            $html[] = '<td colspan="3" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;color:#4b5563;background:#fafcff;">';
            $html[] = $this->escapeCatalogAuditHtml(sprintf('Còn %d thay đổi khác trong hệ thống. Vui lòng mở màn hình Danh mục chức năng để xem đầy đủ.', $remainingEntryCount));
            $html[] = '</td></tr>';
        }

        if ($visibleEntries === []) {
            $html[] = '<tr><td colspan="3" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;color:#4b5563;">Không có thay đổi chi tiết để hiển thị.</td></tr>';
        }

        $html[] = '</tbody></table>';
        $html[] = '</td></tr>';
        $html[] = '</table></body></html>';

        return implode('', $html);
    }

    private function renderCatalogAuditKeyValueTableHtml(array $rows): string
    {
        $html = ['<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #dbe4f0;">'];

        foreach ($rows as $row) {
            $value = (string) ($row['value'] ?? '—');
            $html[] = '<tr>';
            $html[] = '<td style="width:32%;padding:12px 16px;border:1px solid #dbe4f0;background:#f8fbff;font-size:13px;font-weight:600;color:#374151;">'
                . $this->escapeCatalogAuditHtml((string) ($row['label'] ?? 'Thông tin'))
                . '</td>';
            $html[] = '<td style="padding:12px 16px;border:1px solid #dbe4f0;font-size:13px;line-height:1.6;color:#111827;">'
                . (($row['is_html'] ?? false) ? $value : $this->formatCatalogAuditHtmlValue($value))
                . '</td>';
            $html[] = '</tr>';
        }

        $html[] = '</table>';

        return implode('', $html);
    }

    private function buildCatalogAuditEmailChangeRowsHtml(array $entries, string $actorDisplay, string $performedAt): string
    {
        $rows = [];

        foreach ($entries as $entry) {
            $message = trim((string) ($entry['message'] ?? 'Thay đổi không rõ'));
            $action = strtoupper(trim((string) ($entry['action'] ?? 'UPDATE')));
            $fieldChanges = is_array($entry['field_changes'] ?? null) ? $entry['field_changes'] : [];

            if ($fieldChanges !== []) {
                foreach ($fieldChanges as $change) {
                    $rows[] = $this->renderCatalogAuditEmailChangeRowHtml(
                        $this->buildCatalogAuditFieldChangeCellHtml($message, $change, true),
                        $this->buildCatalogAuditFieldChangeCellHtml($message, $change, false),
                        $actorDisplay,
                        $performedAt
                    );
                }

                continue;
            }

            $rows[] = $this->renderCatalogAuditEmailChangeRowHtml(
                $this->buildCatalogAuditActionCellHtml($message, $action, true),
                $this->buildCatalogAuditActionCellHtml($message, $action, false),
                $actorDisplay,
                $performedAt
            );
        }

        return implode('', $rows);
    }

    private function renderCatalogAuditEmailChangeRowHtml(
        string $beforeHtml,
        string $afterHtml,
        string $actorDisplay,
        string $performedAt
    ): string {
        return implode('', [
            '<tr>',
            '<td valign="top" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;line-height:1.7;color:#111827;">',
            $beforeHtml,
            '</td>',
            '<td valign="top" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;line-height:1.7;color:#111827;">',
            $afterHtml,
            '</td>',
            '<td valign="top" style="padding:14px 16px;border:1px solid #dbe4f0;font-size:13px;line-height:1.7;color:#111827;background:#fcfdff;">',
            '<div style="font-weight:600;color:#0f172a;">', $this->escapeCatalogAuditHtml($actorDisplay), '</div>',
            '<div style="margin-top:6px;color:#4b5563;">', $this->escapeCatalogAuditHtml($performedAt), '</div>',
            '</td>',
            '</tr>',
        ]);
    }

    private function buildCatalogAuditFieldChangeCellHtml(string $message, array $change, bool $isBefore): string
    {
        $fieldLabel = trim((string) ($change['label'] ?? 'Trường thay đổi'));
        $value = trim((string) ($change[$isBefore ? 'from' : 'to'] ?? '—'));

        return implode('', [
            '<div style="font-size:12px;font-weight:700;color:#0b4f93;text-transform:uppercase;letter-spacing:0.04em;">',
            $this->escapeCatalogAuditHtml($fieldLabel),
            '</div>',
            '<div style="margin-top:6px;font-size:13px;font-weight:600;color:#111827;">',
            $this->escapeCatalogAuditHtml($message),
            '</div>',
            '<div style="margin-top:10px;font-size:12px;color:#6b7280;">',
            $this->escapeCatalogAuditHtml($isBefore ? 'Giá trị cũ' : 'Giá trị đã cập nhật'),
            '</div>',
            '<div style="margin-top:4px;color:#111827;white-space:normal;">',
            $this->formatCatalogAuditHtmlValue($value),
            '</div>',
        ]);
    }

    private function buildCatalogAuditActionCellHtml(string $message, string $action, bool $isBefore): string
    {
        if ($action === 'CREATE') {
            $title = $isBefore ? 'Trước cập nhật' : 'Sau cập nhật';
            $content = $isBefore ? 'Chưa có dữ liệu trước đó.' : $message;

            return $this->buildCatalogAuditSimpleCellHtml($title, $content);
        }

        if ($action === 'DELETE') {
            $title = $isBefore ? 'Trước cập nhật' : 'Sau cập nhật';
            $content = $isBefore ? $message : 'Dữ liệu đã bị xóa khỏi danh mục chức năng.';

            return $this->buildCatalogAuditSimpleCellHtml($title, $content);
        }

        return $this->buildCatalogAuditSimpleCellHtml(
            $isBefore ? 'Trước cập nhật' : 'Sau cập nhật',
            $message
        );
    }

    private function buildCatalogAuditSimpleCellHtml(string $title, string $content): string
    {
        return implode('', [
            '<div style="font-size:12px;font-weight:700;color:#0b4f93;text-transform:uppercase;letter-spacing:0.04em;">',
            $this->escapeCatalogAuditHtml($title),
            '</div>',
            '<div style="margin-top:8px;font-size:13px;color:#111827;line-height:1.7;">',
            $this->formatCatalogAuditHtmlValue($content),
            '</div>',
        ]);
    }

    private function formatCatalogAuditHtmlValue(string $value): string
    {
        return nl2br($this->escapeCatalogAuditHtml($value), false);
    }

    private function escapeCatalogAuditHtml(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function extractGroupAuditRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'group_name' => trim((string) ($record['group_name'] ?? '')),
            'display_order' => (int) ($record['display_order'] ?? 0),
            'notes' => $this->support->normalizeNullableString($record['notes'] ?? null),
        ];
    }

    private function extractFeatureAuditRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'group_id' => $record['group_id'] ?? null,
            'feature_name' => trim((string) ($record['feature_name'] ?? '')),
            'detail_description' => $this->support->normalizeNullableString($record['detail_description'] ?? null),
            'status' => $this->normalizeFeatureStatus($record['status'] ?? null),
            'display_order' => (int) ($record['display_order'] ?? 0),
        ];
    }

    private function fetchGroupRecord(int $groupId): array
    {
        $record = DB::table(self::GROUP_TABLE)->where('id', $groupId)->first();

        return $record ? $this->extractGroupAuditRecord((array) $record) : [];
    }

    private function fetchFeatureRecord(int $featureId): array
    {
        $record = DB::table(self::FEATURE_TABLE)->where('id', $featureId)->first();

        return $record ? $this->extractFeatureAuditRecord((array) $record) : [];
    }

    private function normalizeCatalogAuditContext(array $payload): array
    {
        $source = strtoupper(trim((string) ($payload['source'] ?? 'FORM')));
        if (! in_array($source, ['FORM', 'IMPORT'], true)) {
            $source = 'FORM';
        }

        return [
            'source' => $source,
            'import_file_name' => $this->support->normalizeNullableString($payload['import_file_name'] ?? null),
            'import_sheet_name' => $this->support->normalizeNullableString($payload['import_sheet_name'] ?? null),
            'import_row_count' => $this->support->parseNullableInt($payload['import_row_count'] ?? null),
            'import_group_count' => $this->support->parseNullableInt($payload['import_group_count'] ?? null),
            'import_feature_count' => $this->support->parseNullableInt($payload['import_feature_count'] ?? null),
        ];
    }

    private function buildCatalogChangeSummary(array $beforeSnapshot, array $afterSnapshot, array $auditContext): array
    {
        $beforeGroups = $this->buildGroupSnapshotMap($beforeSnapshot);
        $afterGroups = $this->buildGroupSnapshotMap($afterSnapshot);
        $beforeFeatures = $this->buildFeatureSnapshotMap($beforeSnapshot);
        $afterFeatures = $this->buildFeatureSnapshotMap($afterSnapshot);
        $beforeGroupNames = $this->extractGroupNameMap($beforeSnapshot);
        $afterGroupNames = $this->extractGroupNameMap($afterSnapshot);

        $summary = [
            'source' => $auditContext['source'] ?? 'FORM',
            'counts' => [
                'groups_created' => 0,
                'groups_updated' => 0,
                'groups_deleted' => 0,
                'features_created' => 0,
                'features_updated' => 0,
                'features_deleted' => 0,
            ],
            'entries' => [],
        ];

        if (($auditContext['source'] ?? 'FORM') === 'IMPORT') {
            $summary['import'] = array_filter([
                'file_name' => $auditContext['import_file_name'] ?? null,
                'sheet_name' => $auditContext['import_sheet_name'] ?? null,
                'row_count' => $auditContext['import_row_count'] ?? null,
                'group_count' => $auditContext['import_group_count'] ?? null,
                'feature_count' => $auditContext['import_feature_count'] ?? null,
            ], fn (mixed $value): bool => $value !== null && $value !== '');
        }

        foreach ($afterGroups as $key => $afterGroup) {
            if (! isset($beforeGroups[$key])) {
                $summary['counts']['groups_created']++;
                $summary['entries'][] = [
                    'entity_type' => 'group',
                    'action' => 'CREATE',
                    'message' => sprintf('Tạo phân hệ "%s".', $afterGroup['group_name'] ?? 'Chưa đặt tên'),
                ];
                continue;
            }

            $changes = $this->buildGroupFieldChanges($beforeGroups[$key], $afterGroup);
            if ($changes !== []) {
                $summary['counts']['groups_updated']++;
                $summary['entries'][] = [
                    'entity_type' => 'group',
                    'action' => 'UPDATE',
                    'message' => sprintf('Cập nhật phân hệ "%s".', $afterGroup['group_name'] ?? ($beforeGroups[$key]['group_name'] ?? 'Chưa đặt tên')),
                    'field_changes' => $changes,
                ];
            }
        }

        foreach ($beforeGroups as $key => $beforeGroup) {
            if (isset($afterGroups[$key])) {
                continue;
            }

            $summary['counts']['groups_deleted']++;
            $summary['entries'][] = [
                'entity_type' => 'group',
                'action' => 'DELETE',
                'message' => sprintf('Xóa phân hệ "%s".', $beforeGroup['group_name'] ?? 'Chưa đặt tên'),
            ];
        }

        foreach ($afterFeatures as $key => $afterFeature) {
            if (! isset($beforeFeatures[$key])) {
                $summary['counts']['features_created']++;
                $summary['entries'][] = [
                    'entity_type' => 'feature',
                    'action' => 'CREATE',
                    'message' => sprintf(
                        'Tạo chức năng "%s" trong phân hệ "%s".',
                        $afterFeature['feature_name'] ?? 'Chưa đặt tên',
                        $afterGroupNames[(string) ($afterFeature['group_id'] ?? '')] ?? 'Không rõ'
                    ),
                ];
                continue;
            }

            $changes = $this->buildFeatureFieldChanges(
                $beforeFeatures[$key],
                $afterFeature,
                $beforeGroupNames,
                $afterGroupNames
            );
            if ($changes !== []) {
                $summary['counts']['features_updated']++;
                $summary['entries'][] = [
                    'entity_type' => 'feature',
                    'action' => 'UPDATE',
                    'message' => sprintf(
                        'Cập nhật chức năng "%s" trong phân hệ "%s".',
                        $afterFeature['feature_name'] ?? ($beforeFeatures[$key]['feature_name'] ?? 'Chưa đặt tên'),
                        $afterGroupNames[(string) ($afterFeature['group_id'] ?? '')]
                            ?? $beforeGroupNames[(string) ($beforeFeatures[$key]['group_id'] ?? '')]
                            ?? 'Không rõ'
                    ),
                    'field_changes' => $changes,
                ];
            }
        }

        foreach ($beforeFeatures as $key => $beforeFeature) {
            if (isset($afterFeatures[$key])) {
                continue;
            }

            $summary['counts']['features_deleted']++;
            $summary['entries'][] = [
                'entity_type' => 'feature',
                'action' => 'DELETE',
                'message' => sprintf(
                    'Xóa chức năng "%s" khỏi phân hệ "%s".',
                    $beforeFeature['feature_name'] ?? 'Chưa đặt tên',
                    $beforeGroupNames[(string) ($beforeFeature['group_id'] ?? '')] ?? 'Không rõ'
                ),
            ];
        }

        return $summary;
    }

    private function buildGroupSnapshotMap(array $groups): array
    {
        $map = [];

        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }

            $key = $this->resolveAuditEntityKey($group);
            if ($key === null) {
                continue;
            }

            $map[$key] = $group;
        }

        return $map;
    }

    private function buildFeatureSnapshotMap(array $groups): array
    {
        $map = [];

        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }

            foreach (($group['features'] ?? []) as $feature) {
                if (! is_array($feature)) {
                    continue;
                }

                $key = $this->resolveAuditEntityKey($feature);
                if ($key === null) {
                    continue;
                }

                $map[$key] = $feature;
            }
        }

        return $map;
    }

    private function extractGroupNameMap(array $groups): array
    {
        $map = [];

        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }

            $groupId = $this->support->parseNullableInt($group['id'] ?? null);
            if ($groupId === null) {
                continue;
            }

            $map[(string) $groupId] = trim((string) ($group['group_name'] ?? ''));
        }

        return $map;
    }

    private function buildGroupFieldChanges(array $before, array $after): array
    {
        return array_values(array_filter([
            $this->buildAuditFieldChange('group_name', 'Tên phân hệ', $before['group_name'] ?? null, $after['group_name'] ?? null),
            $this->buildAuditFieldChange('notes', 'Ghi chú nhóm', $before['notes'] ?? null, $after['notes'] ?? null),
            $this->buildAuditFieldChange('display_order', 'STT nhóm', $before['display_order'] ?? null, $after['display_order'] ?? null),
        ]));
    }

    private function buildFeatureFieldChanges(
        array $before,
        array $after,
        array $beforeGroupNames,
        array $afterGroupNames
    ): array {
        return array_values(array_filter([
            $this->buildAuditFieldChange('feature_name', 'Tên chức năng', $before['feature_name'] ?? null, $after['feature_name'] ?? null),
            $this->buildAuditFieldChange('detail_description', 'Mô tả chi tiết', $before['detail_description'] ?? null, $after['detail_description'] ?? null),
            $this->buildAuditFieldChange('status', 'Trạng thái', $before['status'] ?? null, $after['status'] ?? null),
            $this->buildAuditFieldChange('display_order', 'STT chức năng', $before['display_order'] ?? null, $after['display_order'] ?? null),
            $this->buildAuditFieldChange('group_id', 'Phân hệ', $before['group_id'] ?? null, $after['group_id'] ?? null, $beforeGroupNames, $afterGroupNames),
        ]));
    }

    private function buildAuditFieldChange(
        string $field,
        string $label,
        mixed $before,
        mixed $after,
        array $beforeGroupNames = [],
        array $afterGroupNames = []
    ): ?array {
        $from = $this->formatAuditFieldValue($field, $before, $beforeGroupNames);
        $to = $this->formatAuditFieldValue($field, $after, $afterGroupNames);

        if ($from === $to) {
            return null;
        }

        return [
            'field' => $field,
            'label' => $label,
            'from' => $from,
            'to' => $to,
        ];
    }

    private function formatAuditFieldValue(string $field, mixed $value, array $groupNames = []): string
    {
        if ($field === 'status') {
            return $this->normalizeFeatureStatus($value) === self::FEATURE_STATUS_INACTIVE
                ? 'Tạm ngưng'
                : 'Hoạt động';
        }

        if ($field === 'group_id') {
            $groupId = $this->support->parseNullableInt($value);

            return $groupId !== null
                ? ($groupNames[(string) $groupId] ?? sprintf('Phân hệ #%d', $groupId))
                : '—';
        }

        if (in_array($field, ['display_order'], true)) {
            $numeric = $this->support->parseNullableInt($value);

            return $numeric !== null ? (string) $numeric : '—';
        }

        $text = $this->support->normalizeNullableString($value);

        return $text !== null && $text !== ''
            ? $text
            : '—';
    }

    private function resolveAuditEntityKey(array $record): ?string
    {
        $resolvedId = $this->support->parseNullableInt($record['id'] ?? null);
        if ($resolvedId !== null) {
            return sprintf('id:%d', $resolvedId);
        }

        $uuid = trim((string) ($record['uuid'] ?? ''));
        if ($uuid !== '') {
            return 'uuid:' . $uuid;
        }

        if (array_key_exists('group_name', $record)) {
            $normalizedName = $this->normalizeCatalogKey($record['group_name'] ?? null);

            return $normalizedName !== '' ? 'group:' . $normalizedName : null;
        }

        if (array_key_exists('feature_name', $record)) {
            $normalizedName = $this->normalizeCatalogKey($record['feature_name'] ?? null);
            $groupId = $this->support->parseNullableInt($record['group_id'] ?? null);
            if ($normalizedName !== '' && $groupId !== null) {
                return sprintf('feature:%d:%s', $groupId, $normalizedName);
            }
        }

        return null;
    }

    private function normalizeFeatureStatus(mixed $value): string
    {
        $normalized = strtoupper(trim((string) ($value ?? '')));

        return $normalized === self::FEATURE_STATUS_INACTIVE
            ? self::FEATURE_STATUS_INACTIVE
            : self::FEATURE_STATUS_ACTIVE;
    }

    private function decodeJsonColumnIfNeeded(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return $value;
        }

        $decoded = json_decode($value, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $value;
        }

        return $decoded;
    }

    private function validateNoDuplicateCatalogEntries(array $groups): void
    {
        $errors = [];
        $seenGroupKeys = [];

        foreach ($groups as $groupIndex => $groupPayload) {
            $groupName = trim((string) ($groupPayload['group_name'] ?? ''));
            $groupKey = $this->normalizeCatalogKey($groupName);

            if ($groupKey !== '') {
                if (isset($seenGroupKeys[$groupKey])) {
                    $errors["groups.{$groupIndex}.group_name"][] = "Tên phân hệ \"{$groupName}\" đang bị trùng.";
                } else {
                    $seenGroupKeys[$groupKey] = true;
                }
            }

            $seenFeatureKeys = [];
            $features = is_array($groupPayload['features'] ?? null) ? $groupPayload['features'] : [];
            foreach ($features as $featureIndex => $featurePayload) {
                $featureName = trim((string) ($featurePayload['feature_name'] ?? ''));
                $featureKey = $this->normalizeCatalogKey($featureName);

                if ($featureKey === '') {
                    continue;
                }

                if (isset($seenFeatureKeys[$featureKey])) {
                    $errors["groups.{$groupIndex}.features.{$featureIndex}.feature_name"][] = "Phân hệ \"{$groupName}\" đang có chức năng trùng tên \"{$featureName}\".";
                } else {
                    $seenFeatureKeys[$featureKey] = true;
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function normalizeCatalogKey(mixed $value): string
    {
        $normalized = strtolower(trim(Str::ascii((string) ($value ?? ''))));

        return preg_replace('/[^a-z0-9]+/', '', $normalized) ?? '';
    }
}
