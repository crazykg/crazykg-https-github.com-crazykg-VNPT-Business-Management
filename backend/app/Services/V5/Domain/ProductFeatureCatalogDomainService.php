<?php

namespace App\Services\V5\Domain;

use App\Models\Product;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
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

        $catalogScope = $this->resolveCatalogScope($product);

        return response()->json([
            'data' => $this->buildCatalogPayload($catalogScope, $product),
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

        $catalogScope = $this->resolveCatalogScope($product);
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

        $catalogScope = $this->resolveCatalogScope($product);
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
            'groups.*.features.*.feature_name' => ['required', 'string', 'max:255'],
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
        }

        foreach ($catalogProductIds as $catalogProductId) {
            $this->insightService->invalidateProductDetailCaches($catalogProductId);
        }

        return response()->json([
            'data' => $this->buildCatalogPayload($catalogScope, $product),
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

    private function buildCatalogPayload(array $catalogScope, Product $product): array
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

        $childCountByGroup = $existingFeatures
            ->filter(function (mixed $feature) use ($groupIdsMarkedForDeletion): bool {
                $groupId = (int) (((array) $feature)['group_id'] ?? 0);

                return $groupId > 0 && $groupIdsMarkedForDeletion->contains($groupId);
            })
            ->groupBy(fn (mixed $feature): int => (int) (((array) $feature)['group_id'] ?? 0))
            ->map(fn (Collection $features): int => $features->count());

        $errors = [];
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

        return DB::table('audit_logs')
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
            ->where('auditable_type', self::CATALOG_AUDIT_TYPE)
            ->whereIn('auditable_id', $productIds)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(100)
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

    private function resolveCatalogScope(Product $product): array
    {
        $productName = trim((string) ($product->product_name ?? ''));
        $currentProductId = (int) $product->getKey();

        if ($productName === '' || ! $this->support->hasTable('products')) {
            return [
                'catalog_product_id' => $currentProductId,
                'product_ids' => [$currentProductId],
                'package_count' => 1,
                'product_codes' => [trim((string) ($product->product_code ?? ''))],
            ];
        }

        $selectColumns = $this->support->selectColumns('products', [
            'id',
            'product_code',
            'product_name',
            'service_group',
            'domain_id',
            'vendor_id',
            'deleted_at',
        ]);

        $query = DB::table('products')
            ->select($selectColumns)
            ->where('product_name', $productName);

        $serviceGroup = $this->support->normalizeNullableString($product->service_group ?? null);
        if ($serviceGroup !== null && $this->support->hasColumn('products', 'service_group')) {
            $query->where('service_group', $serviceGroup);
        }

        $domainId = $this->support->parseNullableInt($product->domain_id ?? null);
        if ($domainId !== null && $this->support->hasColumn('products', 'domain_id')) {
            $query->where('domain_id', $domainId);
        }

        $vendorId = $this->support->parseNullableInt($product->vendor_id ?? null);
        if ($vendorId !== null && $this->support->hasColumn('products', 'vendor_id')) {
            $query->where('vendor_id', $vendorId);
        }

        $records = $query
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        if ($records->isEmpty()) {
            return [
                'catalog_product_id' => $currentProductId,
                'product_ids' => [$currentProductId],
                'package_count' => 1,
                'product_codes' => [trim((string) ($product->product_code ?? ''))],
            ];
        }

        $activeRecords = $records->filter(function (array $record): bool {
            if (! array_key_exists('deleted_at', $record)) {
                return true;
            }

            return $record['deleted_at'] === null;
        })->values();

        $catalogProductId = (int) (($activeRecords->first()['id'] ?? null) ?: ($records->first()['id'] ?? $currentProductId));

        return [
            'catalog_product_id' => $catalogProductId,
            'product_ids' => $records
                ->pluck('id')
                ->map(fn (mixed $id): int => (int) $id)
                ->filter(fn (int $id): bool => $id > 0)
                ->unique()
                ->values()
                ->all(),
            'package_count' => max(1, (int) $activeRecords->count()),
            'product_codes' => $activeRecords
                ->pluck('product_code')
                ->map(fn (mixed $code): string => trim((string) $code))
                ->filter(fn (string $code): bool => $code !== '')
                ->values()
                ->all(),
        ];
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
