<?php

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductDomainService
{
    private const PRODUCT_CACHE_KEY = 'v5:products:list:v1';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit
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
                    'product_code',
                    'product_name',
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
                });
            }

            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
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
                    'product_code',
                    'product_name',
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

            return $query
                ->get()
                ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
                ->values()
                ->all();
        }));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('products')) {
            return $this->support->missingTable('products');
        }

        $rules = [
            'product_code' => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'domain_id' => ['required', 'integer'],
            'vendor_id' => ['required', 'integer'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
        ];

        if ($this->support->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code');
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        $domainId = $this->support->parseNullableInt($validated['domain_id'] ?? null);
        if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
            return response()->json(['message' => 'domain_id is invalid.'], 422);
        }

        $vendorId = $this->support->parseNullableInt($validated['vendor_id'] ?? null);
        if ($vendorId === null || ! $this->tableRowExists('vendors', $vendorId)) {
            return response()->json(['message' => 'vendor_id is invalid.'], 422);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $payload = $this->support->filterPayloadByTableColumns('products', [
            'product_code' => trim((string) $validated['product_code']),
            'product_name' => trim((string) $validated['product_name']),
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
        } catch (QueryException $exception) {
            return response()->json([
                'message' => $this->isUniqueConstraintViolation($exception)
                    ? 'Mã sản phẩm đã tồn tại.'
                    : 'Không thể tạo sản phẩm.',
            ], 422);
        }

        Cache::forget(self::PRODUCT_CACHE_KEY);

        $record = $this->loadProductById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Product created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
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
            'product_code' => ['sometimes', 'string', 'max:100'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'domain_id' => ['sometimes', 'integer'],
            'vendor_id' => ['sometimes', 'integer'],
            'standard_price' => ['sometimes', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        if ($this->support->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code')->ignore($id);
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);
        $payload = [];

        if (array_key_exists('product_code', $validated)) {
            $payload['product_code'] = trim((string) $validated['product_code']);
        }
        if (array_key_exists('product_name', $validated)) {
            $payload['product_name'] = trim((string) $validated['product_name']);
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
            $payload['standard_price'] = max(0, (float) $validated['standard_price']);
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

        if ($payload === []) {
            return response()->json(['data' => $this->serializeProductRecord((array) $current)]);
        }

        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null && $this->support->hasColumn('products', 'updated_by')) {
            $payload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn('products', 'updated_at')) {
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

        Cache::forget(self::PRODUCT_CACHE_KEY);

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

        try {
            if ($this->support->hasColumn('products', 'deleted_at')) {
                $updatePayload = ['deleted_at' => now()];
                $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
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
                DB::table('products')->where('id', $id)->delete();
            }
            Cache::forget(self::PRODUCT_CACHE_KEY);

            return response()->json(['message' => 'Product deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Sản phẩm đang được sử dụng và không thể xóa.',
            ], 422);
        }
    }

    private function serializeProductRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'product_code' => (string) ($record['product_code'] ?? ''),
            'product_name' => (string) ($record['product_name'] ?? ''),
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
        ];
    }

    private function loadProductById(int $id): ?array
    {
        if (! $this->support->hasTable('products')) {
            return null;
        }

        $record = DB::table('products')
            ->select($this->support->selectColumns('products', [
                'id',
                'product_code',
                'product_name',
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

        return $record !== null ? $this->serializeProductRecord((array) $record) : null;
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

    private function isUniqueConstraintViolation(QueryException $exception): bool
    {
        $errorInfo = $exception->errorInfo;
        if (is_array($errorInfo) && isset($errorInfo[1])) {
            return (int) $errorInfo[1] === 1062;
        }

        return false;
    }
}
