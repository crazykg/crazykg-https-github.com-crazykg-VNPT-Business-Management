<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductPackageFeatureCatalogDomainService
{
    private const GROUP_TABLE = 'product_package_feature_groups';
    private const FEATURE_TABLE = 'product_package_features';
    private const CATALOG_AUDIT_TYPE = 'product_package_feature_catalogs';
    private const FEATURE_STATUS_ACTIVE = 'ACTIVE';
    private const FEATURE_STATUS_INACTIVE = 'INACTIVE';
    private const FEATURE_NAME_MAX_LENGTH = 2000;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly ProductFeatureCatalogOwnershipService $catalogOwnership,
        private readonly ProductFeatureCatalogDomainService $productCatalogService,
    ) {}

    public function show(Request $request, int $packageId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $package = $this->findPackageSummary($packageId);
        if ($package === null) {
            return response()->json(['message' => 'Product package not found.'], 404);
        }

        $catalogPolicy = $this->catalogOwnership->resolvePackageCatalogPolicy($package);

        return response()->json([
            'data' => $this->buildResolvedCatalogPayload($request, $package, $catalogPolicy),
        ]);
    }

    public function list(Request $request, int $packageId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $package = $this->findPackageSummary($packageId);
        if ($package === null) {
            return response()->json(['message' => 'Product package not found.'], 404);
        }

        [$page, $perPage] = $this->support->resolvePaginationParams($request, 40, 100);
        $groupId = $this->support->parseNullableInt($this->support->readFilterParam($request, 'group_id'));
        $search = trim((string) $this->support->readFilterParam($request, 'search', ''));
        $catalogPolicy = $this->catalogOwnership->resolvePackageCatalogPolicy($package);

        return response()->json([
            'data' => $this->buildResolvedCatalogListPayload(
                $request,
                $package,
                $catalogPolicy,
                $page,
                $perPage,
                $groupId,
                $search !== '' ? $search : null
            ),
        ]);
    }

    public function update(Request $request, int $packageId): JsonResponse
    {
        $tableError = $this->ensureCatalogTablesExist();
        if ($tableError instanceof JsonResponse) {
            return $tableError;
        }

        $package = $this->findPackageSummary($packageId);
        if ($package === null) {
            return response()->json(['message' => 'Product package not found.'], 404);
        }

        $catalogPolicy = $this->catalogOwnership->resolvePackageCatalogPolicy($package);
        if (($catalogPolicy['can_edit'] ?? false) !== true) {
            throw ValidationException::withMessages([
                'groups' => [$this->buildPackageCatalogLockedMessage($catalogPolicy)],
            ]);
        }

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

        $groups = is_array($validated['groups'] ?? null) ? $validated['groups'] : [];
        $this->validateNoDuplicateCatalogEntries($groups);
        $auditContext = is_array($validated['audit_context'] ?? null) ? $validated['audit_context'] : [];
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $beforeSnapshot = $this->loadCatalogSnapshot([$packageId]);
        $existingGroups = $this->fetchExistingGroups([$packageId]);
        $existingFeatures = $this->fetchExistingFeatures([$packageId]);
        $groupIdsSeen = [];
        $featureIdsSeen = [];

        DB::transaction(function () use (
            $packageId,
            $groups,
            $existingGroups,
            $existingFeatures,
            $actorId,
            &$groupIdsSeen,
            &$featureIdsSeen
        ): void {
            foreach ($groups as $groupIndex => $groupPayload) {
                $resolvedGroupId = $this->syncGroup(
                    $packageId,
                    $groupPayload,
                    $groupIndex,
                    $existingGroups,
                    $actorId
                );
                $groupIdsSeen[] = $resolvedGroupId;

                $features = is_array($groupPayload['features'] ?? null) ? $groupPayload['features'] : [];
                foreach ($features as $featureIndex => $featurePayload) {
                    $resolvedFeatureId = $this->syncFeature(
                        $packageId,
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
            $this->deleteRemovedFeatures([$packageId], $featureIdsSeen, $actorId);
            $this->deleteRemovedGroups([$packageId], $groupIdsSeen, $actorId);
        });

        $afterSnapshot = $this->loadCatalogSnapshot([$packageId]);
        if ($beforeSnapshot !== $afterSnapshot) {
            $event = $beforeSnapshot === []
                ? 'INSERT'
                : ($afterSnapshot === [] ? 'DELETE' : 'UPDATE');

            $this->accessAudit->recordAuditEvent(
                $request,
                $event,
                self::CATALOG_AUDIT_TYPE,
                $packageId,
                $beforeSnapshot === [] ? null : [
                    'groups' => $beforeSnapshot,
                    'audit_context' => $auditContext,
                ],
                $afterSnapshot === [] ? null : [
                    'groups' => $afterSnapshot,
                    'audit_context' => $auditContext,
                ]
            );
        }

        $reloadedPackage = $this->findPackageSummary($packageId);

        return response()->json([
            'data' => $this->buildResolvedCatalogPayload(
                $request,
                $reloadedPackage ?? $package,
                $this->catalogOwnership->resolvePackageCatalogPolicy($reloadedPackage ?? $package)
            ),
        ]);
    }

    private function ensureCatalogTablesExist(): ?JsonResponse
    {
        if (! $this->support->hasTable('product_packages')) {
            return $this->support->missingTable('product_packages');
        }
        if (! $this->support->hasTable(self::GROUP_TABLE)) {
            return $this->support->missingTable(self::GROUP_TABLE);
        }
        if (! $this->support->hasTable(self::FEATURE_TABLE)) {
            return $this->support->missingTable(self::FEATURE_TABLE);
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findPackageSummary(int $packageId): ?array
    {
        $columns = [];
        foreach (['id', 'uuid', 'product_id', 'package_code', 'package_name', 'description', 'is_active'] as $column) {
            if ($this->support->hasColumn('product_packages', $column)) {
                $columns[] = "product_packages.{$column}";
            }
        }
        $hasProductsTable = $this->support->hasTable('products');
        if ($hasProductsTable && $this->support->hasColumn('products', 'product_code')) {
            $columns[] = 'products.product_code as parent_product_code';
        }
        if ($hasProductsTable && $this->support->hasColumn('products', 'product_name')) {
            $columns[] = 'products.product_name as parent_product_name';
        }
        if ($hasProductsTable && $this->support->hasColumn('products', 'service_group')) {
            $columns[] = 'products.service_group';
        }

        $query = DB::table('product_packages')->select($columns);
        if ($hasProductsTable) {
            $query->leftJoin('products', 'products.id', '=', 'product_packages.product_id');
        }

        $record = $query
            ->where('product_packages.id', $packageId)
            ->when(
                $this->support->hasColumn('product_packages', 'deleted_at'),
                fn ($query) => $query->whereNull('product_packages.deleted_at')
            )
            ->when(
                $hasProductsTable && $this->support->hasColumn('products', 'deleted_at'),
                fn ($query) => $query->whereNull('products.deleted_at')
            )
            ->first();

        return $record ? (array) $record : null;
    }

    /**
     * @param array<string, mixed> $package
     * @return array<string, mixed>
     */
    private function buildCatalogPayload(array $package, array $catalogPolicy = []): array
    {
        $packageId = (int) ($package['id'] ?? 0);
        $packageIds = $packageId > 0 ? [$packageId] : [];
        $snapshot = $this->loadCatalogSnapshot($packageIds);
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
                collect($this->loadCatalogAuditLogs($packageIds))->map(fn (array $log) => $log['created_by'] ?? null)
            )
            ->filter(fn (mixed $value): bool => $this->support->parseNullableInt($value) !== null)
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();
        $actorMap = $this->resolveActorMap($actorIds);

        return [
            'product' => $this->serializePackageSummary($package),
            'catalog_scope' => [
                'catalog_product_id' => $packageId,
                'product_ids' => $packageIds,
                'package_count' => 1,
                'product_codes' => [trim((string) ($package['package_code'] ?? ''))],
            ],
            'catalog_policy' => $catalogPolicy,
            'groups' => collect($snapshot)
                ->map(fn (array $group): array => $this->decorateGroupActors($group, $actorMap))
                ->values()
                ->all(),
            'audit_logs' => collect($this->loadCatalogAuditLogs($packageIds))
                ->map(fn (array $log): array => $this->decorateAuditActor($log, $actorMap))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<string, mixed> $package
     * @param array<string, mixed> $catalogPolicy
     * @return array<string, mixed>
     */
    private function buildResolvedCatalogPayload(Request $request, array $package, array $catalogPolicy): array
    {
        if (($catalogPolicy['source'] ?? 'empty') !== 'product') {
            return $this->buildCatalogPayload($package, $catalogPolicy);
        }

        $parentProductId = $this->support->parseNullableInt($package['product_id'] ?? null);
        if ($parentProductId === null) {
            return $this->buildCatalogPayload($package, $catalogPolicy);
        }

        $response = $this->productCatalogService->show($request, $parentProductId);
        $payload = $response->getData(true);
        $productCatalog = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return [
            ...$productCatalog,
            'product' => $this->serializePackageSummary($package),
            'catalog_scope' => is_array($productCatalog['catalog_scope'] ?? null)
                ? $productCatalog['catalog_scope']
                : [
                    'catalog_product_id' => $package['id'] ?? null,
                    'product_ids' => [$package['id'] ?? null],
                    'package_count' => 1,
                    'product_codes' => [trim((string) ($package['package_code'] ?? ''))],
                ],
            'catalog_policy' => $catalogPolicy,
        ];
    }

    /**
     * @param array<string, mixed> $package
     * @param array<string, mixed> $catalogPolicy
     * @return array<string, mixed>
     */
    private function buildResolvedCatalogListPayload(
        Request $request,
        array $package,
        array $catalogPolicy,
        int $page,
        int $perPage,
        ?int $groupId,
        ?string $search
    ): array {
        if (($catalogPolicy['source'] ?? 'empty') === 'product') {
            $parentProductId = $this->support->parseNullableInt($package['product_id'] ?? null);
            if ($parentProductId !== null) {
                $response = $this->productCatalogService->list($request, $parentProductId);
                $payload = $response->getData(true);
                $productCatalog = is_array($payload['data'] ?? null) ? $payload['data'] : [];

                return [
                    ...$productCatalog,
                    'product' => $this->serializePackageSummary($package),
                    'catalog_policy' => $catalogPolicy,
                ];
            }
        }

        $packageId = (int) ($package['id'] ?? 0);
        $packageIds = $packageId > 0 ? [$packageId] : [];
        $listPayload = $this->loadCatalogListRows(
            $packageIds,
            $groupId,
            $search,
            $page,
            $perPage
        );

        return [
            'product' => $this->serializePackageSummary($package),
            'catalog_scope' => [
                'catalog_product_id' => $packageId,
                'product_ids' => $packageIds,
                'package_count' => 1,
                'product_codes' => [trim((string) ($package['package_code'] ?? ''))],
            ],
            'catalog_policy' => $catalogPolicy,
            'group_filters' => $this->loadCatalogGroupFilters($packageIds),
            'rows' => $listPayload['rows'],
            'meta' => $this->support->buildPaginationMeta($page, $perPage, $listPayload['total']),
        ];
    }

    private function buildPackageCatalogLockedMessage(array $catalogPolicy): string
    {
        if (($catalogPolicy['lock_reason'] ?? null) === 'blocked_by_product') {
            $productCode = trim((string) ($catalogPolicy['inherited_product_code'] ?? ''));
            $productName = trim((string) ($catalogPolicy['inherited_product_name'] ?? ''));

            if ($productCode !== '' && $productName !== '') {
                return sprintf(
                    'Danh mục tính năng của gói cước đang bị khóa vì đang tham chiếu từ product %s - %s.',
                    $productCode,
                    $productName
                );
            }

            return 'Danh mục tính năng của gói cước đang bị khóa vì đang tham chiếu từ product.';
        }

        return 'Danh mục tính năng của gói cước đang bị khóa.';
    }

    /**
     * @param array<int, int> $packageIds
     * @return array<int, array<string, mixed>>
     */
    private function loadCatalogGroupFilters(array $packageIds): array
    {
        if ($packageIds === []) {
            return [];
        }

        return DB::table(self::GROUP_TABLE)
            ->select($this->support->selectColumns(self::GROUP_TABLE, [
                'id',
                'group_name',
                'display_order',
                'notes',
            ]))
            ->whereIn('package_id', $packageIds)
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
     * @param array<int, int> $packageIds
     * @return array{rows: array<int, array<string, mixed>>, total: int}
     */
    private function loadCatalogListRows(array $packageIds, ?int $groupId, ?string $search, int $page, int $perPage): array
    {
        if ($packageIds === []) {
            return ['rows' => [], 'total' => 0];
        }

        $searchLike = null;
        if ($search !== null && trim($search) !== '') {
            $searchLike = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($search)) . '%';
        }

        $buildUnionQuery = function () use ($packageIds, $groupId, $searchLike) {
            $groupRows = DB::table(self::GROUP_TABLE . ' as g')
                ->selectRaw(
                    "'group' as row_type, g.id as group_id, null as feature_id, " .
                    "g.display_order as group_display_order, null as feature_display_order, " .
                    "g.group_name as row_name, COALESCE(NULLIF(g.notes, ''), 'Danh sách chức năng thuộc phân hệ này.') as row_detail"
                )
                ->whereIn('g.package_id', $packageIds)
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
                ->whereIn('f.package_id', $packageIds)
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

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * @param array<int, int> $packageIds
     */
    private function fetchExistingGroups(array $packageIds): Collection
    {
        if ($packageIds === []) {
            return collect();
        }

        return collect(DB::table(self::GROUP_TABLE)
            ->whereIn('package_id', $packageIds)
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

    /**
     * @param array<int, int> $packageIds
     */
    private function fetchExistingFeatures(array $packageIds): Collection
    {
        if ($packageIds === []) {
            return collect();
        }

        return collect(DB::table(self::FEATURE_TABLE)
            ->whereIn('package_id', $packageIds)
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

    private function syncGroup(
        int $packageId,
        array $groupPayload,
        int $groupIndex,
        Collection $existingGroups,
        ?int $actorId
    ): int {
        $groupId = $this->support->parseNullableInt($groupPayload['id'] ?? null);
        if ($groupId !== null && ! $existingGroups->has((string) $groupId)) {
            throw ValidationException::withMessages([
                "groups.{$groupIndex}.id" => ['Nhóm chức năng không hợp lệ hoặc không thuộc gói cước đang chọn.'],
            ]);
        }

        $payload = [
            'package_id' => $packageId,
            'group_name' => trim((string) ($groupPayload['group_name'] ?? '')),
            'display_order' => $groupIndex + 1,
            'notes' => $this->support->normalizeNullableString($groupPayload['notes'] ?? null),
        ];

        if ($groupId === null) {
            $insertPayload = array_merge($payload, [
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

            return (int) DB::table(self::GROUP_TABLE)->insertGetId(
                $this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $insertPayload)
            );
        }

        $updatePayload = $payload;
        if ($actorId !== null) {
            $updatePayload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn(self::GROUP_TABLE, 'updated_at')) {
            $updatePayload['updated_at'] = now();
        }

        DB::table(self::GROUP_TABLE)
            ->where('id', $groupId)
            ->update($this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $updatePayload));

        return $groupId;
    }

    private function syncFeature(
        int $packageId,
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
                "groups.{$groupIndex}.features.{$featureIndex}.id" => ['Chức năng không hợp lệ hoặc không thuộc gói cước đang chọn.'],
            ]);
        }

        $payload = [
            'package_id' => $packageId,
            'group_id' => $groupId,
            'feature_name' => trim((string) ($featurePayload['feature_name'] ?? '')),
            'detail_description' => $this->support->normalizeNullableString($featurePayload['detail_description'] ?? null),
            'status' => $this->normalizeFeatureStatus($featurePayload['status'] ?? null),
            'display_order' => $featureIndex + 1,
        ];

        if ($featureId === null) {
            $insertPayload = array_merge($payload, [
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

            return (int) DB::table(self::FEATURE_TABLE)->insertGetId(
                $this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $insertPayload)
            );
        }

        $updatePayload = $payload;
        if ($actorId !== null) {
            $updatePayload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn(self::FEATURE_TABLE, 'updated_at')) {
            $updatePayload['updated_at'] = now();
        }

        DB::table(self::FEATURE_TABLE)
            ->where('id', $featureId)
            ->update($this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $updatePayload));

        return $featureId;
    }

    /**
     * @param array<int, int> $packageIds
     * @param array<int, int> $featureIdsSeen
     */
    private function deleteRemovedFeatures(array $packageIds, array $featureIdsSeen, ?int $actorId): void
    {
        if ($packageIds === []) {
            return;
        }

        $remainingIds = collect($featureIdsSeen)->map(fn (mixed $id): int => (int) $id)->values()->all();
        $query = DB::table(self::FEATURE_TABLE)
            ->whereIn('package_id', $packageIds)
            ->when(
                $this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at'),
                fn ($builder) => $builder->whereNull('deleted_at')
            );

        if ($remainingIds !== []) {
            $query->whereNotIn('id', $remainingIds);
        }

        $toDelete = $query
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        foreach ($toDelete as $record) {
            $featureId = (int) ($record['id'] ?? 0);
            if ($featureId <= 0) {
                continue;
            }

            $payload = [];
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'deleted_at')) {
                $payload['deleted_at'] = now();
            }
            if ($actorId !== null && $this->support->hasColumn(self::FEATURE_TABLE, 'updated_by')) {
                $payload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::FEATURE_TABLE, 'updated_at')) {
                $payload['updated_at'] = now();
            }

            $payload = $this->support->filterPayloadByTableColumns(self::FEATURE_TABLE, $payload);
            if ($payload !== []) {
                DB::table(self::FEATURE_TABLE)->where('id', $featureId)->update($payload);
            } else {
                DB::table(self::FEATURE_TABLE)->where('id', $featureId)->delete();
            }
        }
    }

    /**
     * @param array<int, int> $packageIds
     * @param array<int, int> $groupIdsSeen
     */
    private function deleteRemovedGroups(array $packageIds, array $groupIdsSeen, ?int $actorId): void
    {
        if ($packageIds === []) {
            return;
        }

        $remainingIds = collect($groupIdsSeen)->map(fn (mixed $id): int => (int) $id)->values()->all();
        $query = DB::table(self::GROUP_TABLE)
            ->whereIn('package_id', $packageIds)
            ->when(
                $this->support->hasColumn(self::GROUP_TABLE, 'deleted_at'),
                fn ($builder) => $builder->whereNull('deleted_at')
            );

        if ($remainingIds !== []) {
            $query->whereNotIn('id', $remainingIds);
        }

        $toDelete = $query
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        foreach ($toDelete as $record) {
            $groupId = (int) ($record['id'] ?? 0);
            if ($groupId <= 0) {
                continue;
            }

            $payload = [];
            if ($this->support->hasColumn(self::GROUP_TABLE, 'deleted_at')) {
                $payload['deleted_at'] = now();
            }
            if ($actorId !== null && $this->support->hasColumn(self::GROUP_TABLE, 'updated_by')) {
                $payload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::GROUP_TABLE, 'updated_at')) {
                $payload['updated_at'] = now();
            }

            $payload = $this->support->filterPayloadByTableColumns(self::GROUP_TABLE, $payload);
            if ($payload !== []) {
                DB::table(self::GROUP_TABLE)->where('id', $groupId)->update($payload);
            } else {
                DB::table(self::GROUP_TABLE)->where('id', $groupId)->delete();
            }
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

    /**
     * @param array<int, int> $packageIds
     * @return array<int, array<string, mixed>>
     */
    private function loadCatalogSnapshot(array $packageIds): array
    {
        if ($packageIds === []) {
            return [];
        }

        $groups = DB::table(self::GROUP_TABLE)
            ->select($this->support->selectColumns(self::GROUP_TABLE, [
                'id',
                'uuid',
                'package_id',
                'group_name',
                'display_order',
                'notes',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->whereIn('package_id', $packageIds)
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
                'package_id',
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
            ->whereIn('package_id', $packageIds)
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

                return [
                    ...$this->serializeGroupRecord($group),
                    'features' => collect($features[$groupId] ?? [])
                        ->map(fn (array $feature): array => $this->serializeFeatureRecord($feature))
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param array<int, int> $packageIds
     * @return array<int, array<string, mixed>>
     */
    private function loadCatalogAuditLogs(array $packageIds): array
    {
        if (! $this->support->hasTable('audit_logs') || $packageIds === []) {
            return [];
        }

        $auditLogIdColumns = $this->support->selectColumns('audit_logs', ['id', 'created_at']);
        if (! in_array('id', $auditLogIdColumns, true)) {
            return [];
        }

        $auditLogIds = DB::table('audit_logs')
            ->select($auditLogIdColumns)
            ->where('auditable_type', self::CATALOG_AUDIT_TYPE)
            ->whereIn('auditable_id', $packageIds)
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

    /**
     * @param array<int, int> $actorIds
     * @return array<string, array<string, mixed>>
     */
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

    /**
     * @param array<string, mixed> $package
     * @return array<string, mixed>
     */
    private function serializePackageSummary(array $package): array
    {
        return [
            'id' => $package['id'] ?? null,
            'uuid' => $package['uuid'] ?? null,
            'service_group' => $this->support->normalizeNullableString($package['service_group'] ?? null),
            'product_code' => (string) ($package['package_code'] ?? ''),
            'product_name' => (string) ($package['package_name'] ?? ''),
            'package_name' => $this->support->normalizeNullableString($package['parent_product_name'] ?? null),
            'description' => $this->support->normalizeNullableString($package['description'] ?? null),
            'is_active' => array_key_exists('is_active', $package) ? (bool) $package['is_active'] : true,
            'catalog_package_count' => 1,
            'parent_product_code' => $this->support->normalizeNullableString($package['parent_product_code'] ?? null),
            'parent_product_name' => $this->support->normalizeNullableString($package['parent_product_name'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $group
     * @param array<string, array<string, mixed>> $actorMap
     * @return array<string, mixed>
     */
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

    /**
     * @param array<string, mixed> $auditLog
     * @param array<string, array<string, mixed>> $actorMap
     * @return array<string, mixed>
     */
    private function decorateAuditActor(array $auditLog, array $actorMap): array
    {
        return [
            ...$auditLog,
            'actor' => $this->resolveActor($auditLog['created_by'] ?? null, $actorMap),
        ];
    }

    /**
     * @param array<string, array<string, mixed>> $actorMap
     * @return array<string, mixed>|null
     */
    private function resolveActor(mixed $actorId, array $actorMap): ?array
    {
        $resolvedId = $this->support->parseNullableInt($actorId);
        if ($resolvedId === null) {
            return null;
        }

        return $actorMap[(string) $resolvedId] ?? null;
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeGroupRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['package_id'] ?? null,
            'group_name' => trim((string) ($record['group_name'] ?? '')),
            'display_order' => (int) ($record['display_order'] ?? 0),
            'notes' => $this->support->normalizeNullableString($record['notes'] ?? null),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeFeatureRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $record['uuid'] ?? null,
            'product_id' => $record['package_id'] ?? null,
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

    /**
     * @param array<int, array<string, mixed>> $groups
     */
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
