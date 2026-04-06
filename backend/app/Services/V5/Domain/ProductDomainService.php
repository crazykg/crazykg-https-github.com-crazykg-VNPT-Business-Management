<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductDomainService
{
    use ResolvesValidatedInput;

    private const PRODUCT_CACHE_KEY = 'v5:products:list:v1';
    private const DEFAULT_SERVICE_GROUP = 'GROUP_B';
    private const SERVICE_GROUP_VALUES = ['GROUP_A', 'GROUP_B', 'GROUP_C'];
    private const PRODUCT_DELETE_REFERENCE_SOURCES = [
        ['table' => 'contract_items', 'column' => 'product_id', 'label' => 'hạng mục hợp đồng'],
        ['table' => 'project_items', 'column' => 'product_id', 'label' => 'hạng mục dự án'],
        ['table' => 'document_product_links', 'column' => 'product_id', 'label' => 'liên kết tài liệu'],
        ['table' => 'customer_request_cases', 'column' => 'product_id', 'label' => 'yêu cầu khách hàng'],
        ['table' => 'customer_requests', 'column' => 'product_id', 'label' => 'phiếu yêu cầu khách hàng'],
        ['table' => 'invoice_items', 'column' => 'product_id', 'label' => 'dòng hóa đơn'],
    ];
    private const PRODUCT_STANDARD_PRICE_LOCK_REFERENCE_SOURCES = [
        ['table' => 'product_quotation_items', 'column' => 'product_id', 'label' => 'dòng báo giá sản phẩm'],
        ['table' => 'product_quotation_version_items', 'column' => 'product_id', 'label' => 'phiên bản báo giá sản phẩm'],
        ['table' => 'project_items', 'column' => 'product_id', 'label' => 'hạng mục dự án'],
        ['table' => 'contract_items', 'column' => 'product_id', 'label' => 'hạng mục hợp đồng'],
        ['table' => 'invoice_items', 'column' => 'product_id', 'label' => 'dòng hóa đơn'],
    ];
    private const PRODUCT_FEATURE_GROUP_TABLE = 'product_feature_groups';
    private const PRODUCT_FEATURE_TABLE = 'product_features';
    private const ATTACHMENT_REFERENCE_TYPE = 'PRODUCT';
    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;
    private const BACKBLAZE_B2_STORAGE_DISK = 'backblaze_b2';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        if ($this->support->shouldPaginate($request)) {
            $query = DB::table('products')
                ->select($this->support->selectColumns('products', [
                    'id',
                    'service_group',
                    'product_code',
                    'product_name',
                    'package_name',
                    'domain_id',
                    'vendor_id',
                    'standard_price',
                    'unit',
                    'description',
                    'is_active',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            if ($this->support->hasColumn('products', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($builder) use ($like): void {
                    $builder->whereRaw('1 = 0');
                    if ($this->support->hasColumn('products', 'product_code')) {
                        $builder->orWhere('product_code', 'like', $like);
                    }
                    if ($this->support->hasColumn('products', 'product_name')) {
                        $builder->orWhere('product_name', 'like', $like);
                    }
                    if ($this->support->hasColumn('products', 'package_name')) {
                        $builder->orWhere('package_name', 'like', $like);
                    }
                });
            }

            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rawRows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();
                $attachmentMap = $this->loadProductAttachmentMap(
                    $rawRows
                        ->pluck('id')
                        ->map(fn (mixed $value): int => (int) $value)
                        ->filter(fn (int $value): bool => $value > 0)
                        ->values()
                        ->all()
                );
                $standardPriceLockMap = $this->loadProductStandardPriceLockMetaMap(
                    $rawRows
                        ->pluck('id')
                        ->map(fn (mixed $value): int => (int) $value)
                        ->filter(fn (int $value): bool => $value > 0)
                        ->values()
                        ->all()
                );
                $rows = $rawRows
                    ->map(fn (array $item): array => $this->serializeProductRecord(
                        $item,
                        $attachmentMap[(string) ($item['id'] ?? '')] ?? [],
                        $standardPriceLockMap[(string) ($item['id'] ?? '')] ?? null
                    ))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rawRows = collect($paginator->items())
                ->map(fn (object $item): array => (array) $item)
                ->values();
            $attachmentMap = $this->loadProductAttachmentMap(
                $rawRows
                    ->pluck('id')
                    ->map(fn (mixed $value): int => (int) $value)
                    ->filter(fn (int $value): bool => $value > 0)
                    ->values()
                    ->all()
            );
            $standardPriceLockMap = $this->loadProductStandardPriceLockMetaMap(
                $rawRows
                    ->pluck('id')
                    ->map(fn (mixed $value): int => (int) $value)
                    ->filter(fn (int $value): bool => $value > 0)
                    ->values()
                    ->all()
            );
            $rows = $rawRows
                ->map(fn (array $item): array => $this->serializeProductRecord(
                    $item,
                    $attachmentMap[(string) ($item['id'] ?? '')] ?? [],
                    $standardPriceLockMap[(string) ($item['id'] ?? '')] ?? null
                ))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = collect(Cache::remember(self::PRODUCT_CACHE_KEY, now()->addMinutes(15), function (): array {
            $query = DB::table('products')
                ->select($this->support->selectColumns('products', [
                    'id',
                    'service_group',
                    'product_code',
                    'product_name',
                    'package_name',
                    'domain_id',
                    'vendor_id',
                    'standard_price',
                    'unit',
                    'description',
                    'is_active',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            if ($this->support->hasColumn('products', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $rawRows = $query
                ->get()
                ->map(fn (object $item): array => (array) $item)
                ->values();
            $attachmentMap = $this->loadProductAttachmentMap(
                $rawRows
                    ->pluck('id')
                    ->map(fn (mixed $value): int => (int) $value)
                    ->filter(fn (int $value): bool => $value > 0)
                    ->values()
                    ->all()
            );

            return $rawRows
                ->map(fn (array $item): array => $this->serializeProductRecord(
                    $item,
                    $attachmentMap[(string) ($item['id'] ?? '')] ?? []
                ))
                ->values()
                ->all();
        }));

        $standardPriceLockMap = $this->loadProductStandardPriceLockMetaMap(
            $rows
                ->pluck('id')
                ->map(fn (mixed $value): int => (int) $value)
                ->filter(fn (int $value): bool => $value > 0)
                ->values()
                ->all()
        );
        $rows = $rows
            ->map(fn (array $item): array => $this->mergeProductStandardPriceLockMeta(
                $item,
                $standardPriceLockMap[(string) ($item['id'] ?? '')] ?? null
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $rules = [
            'service_group' => ['nullable', 'string', Rule::in(self::SERVICE_GROUP_VALUES)],
            'product_code' => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'package_name' => ['nullable', 'string', 'max:255'],
            'domain_id' => ['required', 'integer'],
            'vendor_id' => ['required', 'integer'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
        ];
        $rules = array_merge($rules, $this->attachmentValidationRules());

        if ($this->support->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code');
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $this->validatedInput($request, $rules);

        $domainId = $this->support->parseNullableInt($validated['domain_id'] ?? null);
        if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
            return response()->json(['message' => 'domain_id is invalid.'], 422);
        }

        $vendorId = $this->support->parseNullableInt($validated['vendor_id'] ?? null);
        if ($vendorId === null || ! $this->tableRowExists('vendors', $vendorId)) {
            return response()->json(['message' => 'vendor_id is invalid.'], 422);
        }

        $attachments = is_array($validated['attachments'] ?? null) ? $validated['attachments'] : [];
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $payload = $this->support->filterPayloadByTableColumns('products', [
            'service_group' => $this->resolveServiceGroup($validated['service_group'] ?? null),
            'product_code' => trim((string) $validated['product_code']),
            'product_name' => trim((string) $validated['product_name']),
            'package_name' => $this->support->normalizeNullableString($validated['package_name'] ?? null),
            'domain_id' => $domainId,
            'vendor_id' => $vendorId,
            'standard_price' => max(0, (float) ($validated['standard_price'] ?? 0)),
            'unit' => $this->support->normalizeNullableString($validated['unit'] ?? null),
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        if ($this->support->hasColumn('products', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('products', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        try {
            $insertId = (int) DB::table('products')->insertGetId($payload);
            $this->syncProductAttachments($insertId, $attachments, $actorId);
        } catch (QueryException $exception) {
            return response()->json([
                'message' => $this->isUniqueConstraintViolation($exception)
                    ? 'Mã sản phẩm đã tồn tại.'
                    : 'Không thể tạo sản phẩm.',
            ], 422);
        }

        Cache::forget(self::PRODUCT_CACHE_KEY);
        $this->insightService->invalidateAllInsightCaches();

        $record = $this->loadProductById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Product created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:1000'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/products', 'POST', (array) $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());

                $response = $this->store($subRequest);
                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể lưu sản phẩm từ file import.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo sản phẩm.',
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
            } catch (\Throwable) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể lưu sản phẩm từ file import.',
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

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $currentQuery = DB::table('products')->where('id', $id);
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $currentQuery->whereNull('deleted_at');
        }
        $current = $currentQuery->first();
        if ($current === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $rules = [
            'service_group' => ['sometimes', 'string', Rule::in(self::SERVICE_GROUP_VALUES)],
            'product_code' => ['sometimes', 'string', 'max:100'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'package_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'domain_id' => ['sometimes', 'integer'],
            'vendor_id' => ['sometimes', 'integer'],
            'standard_price' => ['sometimes', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
        $rules = array_merge($rules, $this->attachmentValidationRules(true));

        if ($this->support->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code')->ignore($id);
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $this->validatedInput($request, $rules);
        $attachmentsProvided = array_key_exists('attachments', $validated);
        $attachments = $attachmentsProvided && is_array($validated['attachments'] ?? null)
            ? $validated['attachments']
            : [];
        $payload = [];

        if (array_key_exists('service_group', $validated)) {
            $payload['service_group'] = $this->resolveServiceGroup($validated['service_group']);
        }
        if (array_key_exists('product_code', $validated)) {
            $payload['product_code'] = trim((string) $validated['product_code']);
        }
        if (array_key_exists('product_name', $validated)) {
            $payload['product_name'] = trim((string) $validated['product_name']);
        }
        if (array_key_exists('package_name', $validated)) {
            $payload['package_name'] = $this->support->normalizeNullableString($validated['package_name']);
        }
        if (array_key_exists('domain_id', $validated)) {
            $domainId = $this->support->parseNullableInt($validated['domain_id']);
            if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
                return response()->json(['message' => 'domain_id is invalid.'], 422);
            }
            $payload['domain_id'] = $domainId;
        }
        if (array_key_exists('vendor_id', $validated)) {
            $vendorId = $this->support->parseNullableInt($validated['vendor_id']);
            if ($vendorId === null || ! $this->tableRowExists('vendors', $vendorId)) {
                return response()->json(['message' => 'vendor_id is invalid.'], 422);
            }
            $payload['vendor_id'] = $vendorId;
        }
        if (array_key_exists('standard_price', $validated)) {
            $incomingStandardPrice = max(0, (float) $validated['standard_price']);
            $currentStandardPrice = max(0, (float) ($current->standard_price ?? 0));
            $isPriceChanged = abs($incomingStandardPrice - $currentStandardPrice) > 0.00001;

            if ($isPriceChanged) {
                $standardPriceLockMeta = $this->buildProductStandardPriceLockMeta($id);
                if (($standardPriceLockMeta['locked'] ?? false) === true) {
                    return response()->json([
                        'message' => (string) ($standardPriceLockMeta['message'] ?? 'Đơn giá đã được sử dụng ở dữ liệu khác nên không thể cập nhật.'),
                        'data' => [
                            'references' => $standardPriceLockMeta['references'] ?? [],
                            'standard_price_locked' => true,
                        ],
                    ], 422);
                }
            }

            $payload['standard_price'] = $incomingStandardPrice;
        }
        if (array_key_exists('unit', $validated)) {
            $payload['unit'] = $this->support->normalizeNullableString($validated['unit']);
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }

        if ($payload === [] && ! $attachmentsProvided) {
            $record = $this->loadProductById($id);

            return response()->json(['data' => $record ?? $this->serializeProductRecord((array) $current)]);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null && $this->support->hasColumn('products', 'updated_by')) {
            $payload['updated_by'] = $actorId;
        }
        if (($payload !== [] || $attachmentsProvided) && $this->support->hasColumn('products', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $payload = $this->support->filterPayloadByTableColumns('products', $payload);

        if ($payload !== []) {
            try {
                DB::table('products')->where('id', $id)->update($payload);
            } catch (QueryException $exception) {
                return response()->json([
                    'message' => $this->isUniqueConstraintViolation($exception)
                        ? 'Mã sản phẩm đã tồn tại.'
                        : 'Không thể cập nhật sản phẩm.',
                ], 422);
            }
        }

        if ($attachmentsProvided) {
            $this->syncProductAttachments($id, $attachments, $actorId);
        }

        Cache::forget(self::PRODUCT_CACHE_KEY);
        $this->insightService->invalidateAllInsightCaches();
        $this->insightService->invalidateProductDetailCaches($id);

        $record = $this->loadProductById($id);
        if ($record === null) {
            return response()->json(['message' => 'Product updated but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $productQuery = DB::table('products')->where('id', $id);
        if ($this->support->hasColumn('products', 'deleted_at')) {
            $productQuery->whereNull('deleted_at');
        }
        $product = $productQuery->first();
        if ($product === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $references = $this->collectProductDeleteReferences($id);
        if ($references !== []) {
            return response()->json([
                'message' => $this->buildProductDeleteReferenceMessage($references),
                'data' => [
                    'references' => $references,
                ],
            ], 422);
        }

        try {
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $updatePayload = ['deleted_at' => now()];
                $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
                $this->softDeleteProductFeatureCatalog($id, $actorId);
                if ($actorId !== null && $this->support->hasColumn('products', 'updated_by')) {
                    $updatePayload['updated_by'] = $actorId;
                }
                if ($this->support->hasColumn('products', 'updated_at')) {
                    $updatePayload['updated_at'] = now();
                }
                DB::table('products')
                    ->where('id', $id)
                    ->update($this->support->filterPayloadByTableColumns('products', $updatePayload));
            } else {
                $this->softDeleteProductFeatureCatalog($id, $this->accessAudit->resolveAuthenticatedUserId($request));
                DB::table('products')->where('id', $id)->delete();
            }
            Cache::forget(self::PRODUCT_CACHE_KEY);
            $this->insightService->invalidateAllInsightCaches();
            $this->insightService->invalidateProductDetailCaches($id);

            return response()->json(['message' => 'Product deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Sản phẩm đang phát sinh ở dữ liệu khác. Vui lòng xóa bản ghi tham chiếu trước khi xóa sản phẩm.',
            ], 422);
        }
    }

    private function softDeleteProductFeatureCatalog(int $productId, ?int $actorId): void
    {
        $catalogScope = $this->resolveProductFeatureCatalogScope($productId);
        $sharedSiblingIds = collect($catalogScope['product_ids'] ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0 && $id !== $productId)
            ->values()
            ->all();

        if ($sharedSiblingIds !== []) {
            $remainingCatalogOwnerId = (int) ($sharedSiblingIds[0] ?? 0);
            if ($remainingCatalogOwnerId > 0) {
                foreach ([self::PRODUCT_FEATURE_TABLE, self::PRODUCT_FEATURE_GROUP_TABLE] as $table) {
                    if (! $this->support->hasTable($table) || ! $this->support->hasColumn($table, 'product_id')) {
                        continue;
                    }

                    $payload = ['product_id' => $remainingCatalogOwnerId];
                    if ($actorId !== null && $this->support->hasColumn($table, 'updated_by')) {
                        $payload['updated_by'] = $actorId;
                    }
                    if ($this->support->hasColumn($table, 'updated_at')) {
                        $payload['updated_at'] = now();
                    }

                    DB::table($table)
                        ->where('product_id', $productId)
                        ->when(
                            $this->support->hasColumn($table, 'deleted_at'),
                            fn ($query) => $query->whereNull('deleted_at')
                        )
                        ->update($this->support->filterPayloadByTableColumns($table, $payload));
                }

                return;
            }
        }

        $tables = [
            self::PRODUCT_FEATURE_TABLE,
            self::PRODUCT_FEATURE_GROUP_TABLE,
        ];

        foreach ($tables as $table) {
            if (! $this->support->hasTable($table)) {
                continue;
            }

            $query = DB::table($table)->where('product_id', $productId);
            if ($this->support->hasColumn($table, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            if ($this->support->hasColumn($table, 'deleted_at')) {
                $payload = ['deleted_at' => now()];
                if ($actorId !== null && $this->support->hasColumn($table, 'updated_by')) {
                    $payload['updated_by'] = $actorId;
                }
                if ($this->support->hasColumn($table, 'updated_at')) {
                    $payload['updated_at'] = now();
                }

                $query->update($this->support->filterPayloadByTableColumns($table, $payload));
                continue;
            }

            $query->delete();
        }
    }

    private function resolveProductFeatureCatalogScope(int $productId): array
    {
        if (! $this->support->hasTable('products')) {
            return ['product_ids' => [$productId]];
        }

        $selectColumns = $this->support->selectColumns('products', [
            'id',
            'product_name',
            'service_group',
            'domain_id',
            'vendor_id',
            'deleted_at',
        ]);

        $currentProduct = DB::table('products')
            ->select($selectColumns)
            ->where('id', $productId)
            ->first();

        if (! $currentProduct) {
            return ['product_ids' => [$productId]];
        }

        $current = (array) $currentProduct;
        $productName = trim((string) ($current['product_name'] ?? ''));
        if ($productName === '') {
            return ['product_ids' => [$productId]];
        }

        $query = DB::table('products')
            ->select($selectColumns)
            ->where('product_name', $productName);

        $serviceGroup = $this->support->normalizeNullableString($current['service_group'] ?? null);
        if ($serviceGroup !== null && $this->support->hasColumn('products', 'service_group')) {
            $query->where('service_group', $serviceGroup);
        }

        $domainId = $this->support->parseNullableInt($current['domain_id'] ?? null);
        if ($domainId !== null && $this->support->hasColumn('products', 'domain_id')) {
            $query->where('domain_id', $domainId);
        }

        $vendorId = $this->support->parseNullableInt($current['vendor_id'] ?? null);
        if ($vendorId !== null && $this->support->hasColumn('products', 'vendor_id')) {
            $query->where('vendor_id', $vendorId);
        }

        $records = $query
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values();

        if ($records->isEmpty()) {
            return ['product_ids' => [$productId]];
        }

        $activeProductIds = $records
            ->filter(function (array $record): bool {
                if (! array_key_exists('deleted_at', $record)) {
                    return true;
                }

                return $record['deleted_at'] === null;
            })
            ->pluck('id')
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        return [
            'product_ids' => $activeProductIds !== [] ? $activeProductIds : [$productId],
        ];
    }

    /**
     * @param array{locked:bool,message:string|null,references:array<int, array{table:string,label:string,count:int}>}|null $standardPriceLockMeta
     */
    private function serializeProductRecord(array $record, array $attachments = [], ?array $standardPriceLockMeta = null): array
    {
        return $this->mergeProductStandardPriceLockMeta([
            'id' => $record['id'] ?? null,
            'service_group' => $this->resolveServiceGroup($record['service_group'] ?? null),
            'product_code' => (string) ($record['product_code'] ?? ''),
            'product_name' => (string) ($record['product_name'] ?? ''),
            'package_name' => $this->support->normalizeNullableString($record['package_name'] ?? null),
            'domain_id' => $record['domain_id'] ?? null,
            'vendor_id' => $record['vendor_id'] ?? null,
            'standard_price' => (float) ($record['standard_price'] ?? 0),
            'unit' => $this->support->normalizeNullableString($record['unit'] ?? null),
            'description' => $this->support->normalizeNullableString($record['description'] ?? null),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'attachments' => array_values($attachments),
        ], $standardPriceLockMeta);
    }

    private function loadProductById(int $id): ?array
    {
        if (! $this->support->hasTable('products')) {
            return null;
        }

        $record = DB::table('products')
            ->select($this->support->selectColumns('products', [
                'id',
                'service_group',
                'product_code',
                'product_name',
                'package_name',
                'domain_id',
                'vendor_id',
                'standard_price',
                'unit',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->when($this->support->hasColumn('products', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        if ($record === null) {
            return null;
        }

        $attachmentMap = $this->loadProductAttachmentMap([$id]);
        $standardPriceLockMap = $this->loadProductStandardPriceLockMetaMap([$id]);

        return $this->serializeProductRecord(
            (array) $record,
            $attachmentMap[(string) $id] ?? [],
            $standardPriceLockMap[(string) $id] ?? null
        );
    }

    /**
     * @param array<string, mixed> $record
     * @param array{locked:bool,message:string|null,references:array<int, array{table:string,label:string,count:int}>}|null $standardPriceLockMeta
     * @return array<string, mixed>
     */
    private function mergeProductStandardPriceLockMeta(array $record, ?array $standardPriceLockMeta = null): array
    {
        $lockMeta = $standardPriceLockMeta ?? $this->defaultProductStandardPriceLockMeta();

        $record['standard_price_locked'] = (bool) ($lockMeta['locked'] ?? false);
        $record['standard_price_lock_message'] = isset($lockMeta['message']) && is_string($lockMeta['message'])
            ? $lockMeta['message']
            : null;
        $record['standard_price_lock_references'] = array_values($lockMeta['references'] ?? []);

        return $record;
    }

    /**
     * @param array<int, int> $productIds
     * @return array<string, array{locked:bool,message:string|null,references:array<int, array{table:string,label:string,count:int}>}>
     */
    private function loadProductStandardPriceLockMetaMap(array $productIds): array
    {
        $normalizedIds = collect($productIds)
            ->map(fn (mixed $value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->values()
            ->all();

        if ($normalizedIds === []) {
            return [];
        }

        $referenceMap = [];
        foreach ($normalizedIds as $productId) {
            $referenceMap[(string) $productId] = [];
        }

        foreach (self::PRODUCT_STANDARD_PRICE_LOCK_REFERENCE_SOURCES as $source) {
            $table = (string) ($source['table'] ?? '');
            $column = (string) ($source['column'] ?? 'product_id');
            $label = (string) ($source['label'] ?? $table);

            if ($table === '' || ! $this->support->hasTable($table) || ! $this->support->hasColumn($table, $column)) {
                continue;
            }

            $query = DB::table($table)
                ->selectRaw($column.' as product_id, COUNT(*) as aggregate_count')
                ->whereIn($column, $normalizedIds)
                ->groupBy($column);

            if ($this->support->hasColumn($table, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            foreach ($query->get() as $row) {
                $productId = (string) ($row->product_id ?? '');
                $count = (int) ($row->aggregate_count ?? 0);
                if ($productId === '' || $count <= 0) {
                    continue;
                }

                $referenceMap[$productId][] = [
                    'table' => $table,
                    'label' => $label,
                    'count' => $count,
                ];
            }
        }

        $metaMap = [];
        foreach ($referenceMap as $productId => $references) {
            $metaMap[$productId] = [
                'locked' => $references !== [],
                'message' => $references !== [] ? $this->buildProductStandardPriceLockedMessage($references) : null,
                'references' => array_values($references),
            ];
        }

        return $metaMap;
    }

    /**
     * @return array{locked:bool,message:string|null,references:array<int, array{table:string,label:string,count:int}>}
     */
    private function buildProductStandardPriceLockMeta(int $productId): array
    {
        return $this->loadProductStandardPriceLockMetaMap([$productId])[(string) $productId] ?? $this->defaultProductStandardPriceLockMeta();
    }

    /**
     * @return array{locked:bool,message:string|null,references:array<int, array{table:string,label:string,count:int}>}
     */
    private function defaultProductStandardPriceLockMeta(): array
    {
        return [
            'locked' => false,
            'message' => null,
            'references' => [],
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function attachmentValidationRules(bool $partial = false): array
    {
        return [
            'attachments' => $partial ? ['sometimes', 'nullable', 'array'] : ['nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
        ];
    }

    /**
     * @param array<int, int> $productIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadProductAttachmentMap(array $productIds): array
    {
        if (
            $productIds === []
            || ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $query = DB::table('attachments')
            ->select($this->support->selectColumns('attachments', [
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ]))
            ->where('reference_type', self::ATTACHMENT_REFERENCE_TYPE)
            ->whereIn('reference_id', $productIds)
            ->when($this->support->hasColumn('attachments', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'));

        if ($this->support->hasColumn('attachments', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }

            $map[$referenceId][] = $this->serializeAttachmentRecord($row);
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncProductAttachments(int $productId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->support->hasTable('attachments')
            || ! $this->support->hasColumn('attachments', 'reference_type')
            || ! $this->support->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', self::ATTACHMENT_REFERENCE_TYPE)
            ->where('reference_id', $productId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) $this->support->firstNonEmpty($item, ['fileName', 'file_name'], ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->support->parseNullableInt($this->support->firstNonEmpty($item, ['fileSize', 'file_size'], 0)) ?? 0;
            $storagePath = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storagePath', 'storage_path']));
            $storageDisk = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageDisk', 'storage_disk']));
            $storageVisibility = $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['storageVisibility', 'storage_visibility']));
            $payload = $this->support->filterPayloadByTableColumns('attachments', [
                'reference_type' => self::ATTACHMENT_REFERENCE_TYPE,
                'reference_id' => $productId,
                'file_name' => $fileName,
                'file_url' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['fileUrl', 'file_url'])),
                'drive_file_id' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['driveFileId', 'drive_file_id'])),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->support->normalizeNullableString($this->support->firstNonEmpty($item, ['mimeType', 'mime_type'])),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeAttachmentRecord(array $record): array
    {
        return [
            'id' => (string) ($record['id'] ?? ''),
            'fileName' => (string) ($record['file_name'] ?? ''),
            'mimeType' => (string) ($this->support->firstNonEmpty($record, ['mime_type'], 'application/octet-stream')),
            'fileSize' => (int) ($record['file_size'] ?? 0),
            'fileUrl' => $this->resolveAttachmentFileUrl($record),
            'driveFileId' => (string) ($record['drive_file_id'] ?? ''),
            'createdAt' => $this->formatDateColumn($record['created_at'] ?? null) ?? '',
            'storagePath' => $this->support->normalizeNullableString($record['storage_path'] ?? null),
            'storageDisk' => $this->support->normalizeNullableString($record['storage_disk'] ?? null),
            'storageVisibility' => $this->support->normalizeNullableString($record['storage_visibility'] ?? null),
            'storageProvider' => $this->support->normalizeNullableString($record['drive_file_id'] ?? null) !== null
                ? 'GOOGLE_DRIVE'
                : (($this->support->normalizeNullableString($record['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
        ];
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function resolveAttachmentFileUrl(array $attachment): string
    {
        $storedPath = $this->support->normalizeNullableString($attachment['storage_path'] ?? null);
        $storedDisk = $this->support->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->support->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';
        $attachmentId = $this->support->parseNullableInt($attachment['id'] ?? null);

        if ($storedPath !== null) {
            if ($attachmentId !== null) {
                $signedUrl = $this->buildSignedAttachmentDownloadUrl($attachmentId);
                if ($signedUrl !== '') {
                    return $signedUrl;
                }
            }

            $temporaryUrl = $this->buildSignedTempAttachmentDownloadUrl($storedDisk, $storedPath, $fileName);
            if ($temporaryUrl !== '') {
                return $temporaryUrl;
            }
        }

        return (string) ($attachment['file_url'] ?? '');
    }

    private function buildSignedAttachmentDownloadUrl(int $attachmentId): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.attachments.download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                ['id' => $attachmentId],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function buildSignedTempAttachmentDownloadUrl(string $disk, string $path, string $name): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.temp-download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                [
                    'disk' => $disk,
                    'path' => $path,
                    'name' => $name,
                ],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function formatDateColumn(mixed $value): ?string
    {
        $normalized = $this->support->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return \Illuminate\Support\Carbon::parse($normalized)->toDateString();
        } catch (\Throwable) {
            return $normalized;
        }
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

    /**
     * @return array<int, array{table:string,label:string,count:int}>
     */
    private function collectProductDeleteReferences(int $productId): array
    {
        $references = [];

        foreach (self::PRODUCT_DELETE_REFERENCE_SOURCES as $source) {
            $table = (string) ($source['table'] ?? '');
            $column = (string) ($source['column'] ?? 'product_id');
            $label = (string) ($source['label'] ?? $table);

            if ($table === '' || ! $this->support->hasTable($table) || ! $this->support->hasColumn($table, $column)) {
                continue;
            }

            $query = DB::table($table)->where($column, $productId);
            if ($this->support->hasColumn($table, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $count = (int) $query->count();
            if ($count <= 0) {
                continue;
            }

            $references[] = [
                'table' => $table,
                'label' => $label,
                'count' => $count,
            ];
        }

        return $references;
    }

    /**
     * @param array<int, array{table:string,label:string,count:int}> $references
     */
    private function buildProductDeleteReferenceMessage(array $references): string
    {
        $parts = collect($references)
            ->map(function (array $reference): string {
                $count = max(1, (int) ($reference['count'] ?? 0));
                $label = trim((string) ($reference['label'] ?? 'bản ghi tham chiếu'));

                return $count.' '.$label;
            })
            ->values()
            ->all();

        $detail = implode(', ', $parts);

        return $detail !== ''
            ? 'Sản phẩm đang phát sinh ở dữ liệu khác ('.$detail.'). Vui lòng xóa bản ghi tham chiếu trước khi xóa sản phẩm.'
            : 'Sản phẩm đang phát sinh ở dữ liệu khác. Vui lòng xóa bản ghi tham chiếu trước khi xóa sản phẩm.';
    }

    /**
     * @param array<int, array{table:string,label:string,count:int}> $references
     */
    private function buildProductStandardPriceLockedMessage(array $references): string
    {
        $parts = collect($references)
            ->map(function (array $reference): string {
                $count = max(1, (int) ($reference['count'] ?? 0));
                $label = trim((string) ($reference['label'] ?? 'bản ghi sử dụng giá'));

                return $count.' '.$label;
            })
            ->values()
            ->all();

        $detail = implode(', ', $parts);

        return $detail !== ''
            ? 'Đơn giá đã được sử dụng ở dữ liệu khác ('.$detail.') nên không thể cập nhật.'
            : 'Đơn giá đã được sử dụng ở dữ liệu khác nên không thể cập nhật.';
    }

    private function resolveServiceGroup(mixed $value): string
    {
        $normalized = strtoupper(trim((string) $value));
        if (in_array($normalized, self::SERVICE_GROUP_VALUES, true)) {
            return $normalized;
        }

        return self::DEFAULT_SERVICE_GROUP;
    }

    private function isUniqueConstraintViolation(QueryException $exception): bool
    {
        $errorInfo = $exception->errorInfo;
        if (is_array($errorInfo) && isset($errorInfo[1])) {
            return (int) $errorInfo[1] === 1062;
        }

        return false;
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $messages) {
            if (! is_array($messages)) {
                continue;
            }

            foreach ($messages as $message) {
                if (is_string($message) && trim($message) !== '') {
                    return $message;
                }
            }
        }

        return 'Dữ liệu sản phẩm không hợp lệ.';
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = $payload['message'] ?? null;

        return is_string($message) && trim($message) !== '' ? $message : $fallback;
    }
}
