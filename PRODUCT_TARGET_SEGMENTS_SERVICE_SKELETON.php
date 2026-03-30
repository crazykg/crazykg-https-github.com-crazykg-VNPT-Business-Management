<?php
/**
 * ProductTargetSegmentDomainService
 * 
 * Handles CRUD operations for product target segments
 * Follows the exact pattern from ProductDomainService and ProductFeatureCatalogDomainService
 * 
 * File: backend/app/Services/V5/Domain/ProductTargetSegmentDomainService.php
 */

namespace App\Services\V5\Domain;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductTargetSegmentDomainService
{
    // Table name constants
    private const TABLE = 'product_target_segments';
    private const PRODUCTS_TABLE = 'products';

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
    ) {}

    /**
     * List all target segments for a product
     * 
     * GET /api/v5/products/{productId}/target-segments
     * 
     * @param Request $request
     * @param int $productId
     * @return JsonResponse
     */
    public function index(Request $request, int $productId): JsonResponse
    {
        // ✓ 1. Check table exists
        if (! $this->support->hasTable(self::TABLE) || ! $this->support->hasTable(self::PRODUCTS_TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        // ✓ 2. Verify product exists
        $product = DB::table(self::PRODUCTS_TABLE)
            ->where('id', $productId)
            ->when(
                $this->support->hasColumn(self::PRODUCTS_TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            )
            ->first();

        if ($product === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        // ✓ 3. Build query with pagination & filtering
        $query = DB::table(self::TABLE)
            ->select($this->support->selectColumns(self::TABLE, [
                'id',
                'uuid',
                'product_id',
                'customer_sector',
                'facility_type',
                'bed_capacity_min',
                'bed_capacity_max',
                'priority',
                'sales_notes',
                'is_active',
                'created_by',
                'updated_by',
                'created_at',
                'updated_at',
            ]))
            ->where('product_id', $productId)
            ->when(
                $this->support->hasColumn(self::TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            )
            ->orderBy('priority')
            ->orderBy('id');

        // ✓ 4. Apply filtering if requested
        $isActive = $this->support->readFilterParam($request, 'is_active');
        if ($isActive !== null && $isActive !== '') {
            $query->where('is_active', (bool) $isActive);
        }

        $search = trim((string) ($this->support->readFilterParam($request, 'search', '') ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->where('customer_sector', 'like', $like)
                    ->orWhere('facility_type', 'like', $like)
                    ->orWhere('sales_notes', 'like', $like);
            });
        }

        // ✓ 5. Apply pagination
        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 100);

            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeSegment((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta(
                        $page, $perPage, (int) $rows->count(), $paginator->hasMorePages()
                    ),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeSegment((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        // ✓ 6. Return non-paginated list
        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeSegment((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    /**
     * Create a new target segment for a product
     * 
     * POST /api/v5/products/{productId}/target-segments
     * 
     * @param Request $request
     * @param int $productId
     * @return JsonResponse
     */
    public function store(Request $request, int $productId): JsonResponse
    {
        // ✓ 1. Check tables exist
        if (! $this->support->hasTable(self::TABLE) || ! $this->support->hasTable(self::PRODUCTS_TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        // ✓ 2. Verify product exists
        $product = DB::table(self::PRODUCTS_TABLE)
            ->where('id', $productId)
            ->when(
                $this->support->hasColumn(self::PRODUCTS_TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            )
            ->first();

        if ($product === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        // ✓ 3. Define validation rules
        $rules = [
            'customer_sector' => ['required', 'string', 'max:50'],
            'facility_type' => ['nullable', 'string', 'max:50'],
            'bed_capacity_min' => ['nullable', 'integer', 'min:0'],
            'bed_capacity_max' => ['nullable', 'integer', 'min:0'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:255'],
            'sales_notes' => ['nullable', 'string', 'max:65535'],
            'is_active' => ['nullable', 'boolean'],
        ];

        // ✓ 4. Validate input
        $validated = $request->validate($rules);

        // ✓ 5. Check for duplicates (product_id + customer_sector + facility_type)
        $sector = trim((string) $validated['customer_sector']);
        $facilityType = $this->support->normalizeNullableString($validated['facility_type'] ?? null);

        $existingQuery = DB::table(self::TABLE)
            ->where('product_id', $productId)
            ->where('customer_sector', $sector)
            ->when(
                $this->support->hasColumn(self::TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            );

        if ($facilityType !== null) {
            $existingQuery->where('facility_type', $facilityType);
        } else {
            $existingQuery->whereNull('facility_type');
        }

        if ($existingQuery->exists()) {
            return response()->json([
                'message' => 'A target segment for this customer sector and facility type already exists.',
            ], 422);
        }

        // ✓ 6. Normalize & filter payload
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        $payload = $this->support->filterPayloadByTableColumns(self::TABLE, [
            'product_id' => $productId,
            'customer_sector' => $sector,
            'facility_type' => $facilityType,
            'bed_capacity_min' => $this->support->parseNullableInt($validated['bed_capacity_min'] ?? null),
            'bed_capacity_max' => $this->support->parseNullableInt($validated['bed_capacity_max'] ?? null),
            'priority' => max(1, (int) ($validated['priority'] ?? 1)),
            'sales_notes' => $this->support->normalizeNullableString($validated['sales_notes'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        // ✓ 7. Add timestamps
        if ($this->support->hasColumn(self::TABLE, 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn(self::TABLE, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        // ✓ 8. Add UUID
        if ($this->support->hasColumn(self::TABLE, 'uuid')) {
            $payload['uuid'] = (string) \Illuminate\Support\Str::uuid();
        }

        // ✓ 9. INSERT
        try {
            $insertId = (int) DB::table(self::TABLE)->insertGetId($payload);
        } catch (QueryException $exception) {
            return response()->json([
                'message' => 'Cannot create target segment.',
            ], 422);
        }

        // ✓ 10. Reload & serialize
        $record = $this->loadSegmentById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Segment created but cannot be reloaded.'], 500);
        }

        // ✓ 11. Record audit event
        $this->accessAudit->recordAuditEvent(
            $request,
            'INSERT',
            self::TABLE,
            $insertId,
            null,
            $record
        );

        // ✓ 12. Invalidate caches
        $this->insightService->invalidateProductDetailCaches($productId);

        // ✓ 13. Return 201
        return response()->json(['data' => $record], 201);
    }

    /**
     * Update an existing target segment
     * 
     * PUT /api/v5/products/{productId}/target-segments/{segmentId}
     * 
     * @param Request $request
     * @param int $productId
     * @param int $segmentId
     * @return JsonResponse
     */
    public function update(Request $request, int $productId, int $segmentId): JsonResponse
    {
        // ✓ 1. Check tables exist
        if (! $this->support->hasTable(self::TABLE) || ! $this->support->hasTable(self::PRODUCTS_TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        // ✓ 2. Load current segment
        $currentQuery = DB::table(self::TABLE)
            ->where('id', $segmentId)
            ->where('product_id', $productId)
            ->when(
                $this->support->hasColumn(self::TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            );

        $current = $currentQuery->first();
        if ($current === null) {
            return response()->json(['message' => 'Target segment not found.'], 404);
        }

        // ✓ 3. Define validation rules (partial updates)
        $rules = [
            'customer_sector' => ['sometimes', 'string', 'max:50'],
            'facility_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bed_capacity_min' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'bed_capacity_max' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'priority' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:255'],
            'sales_notes' => ['sometimes', 'nullable', 'string', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        // ✓ 4. Validate input
        $validated = $request->validate($rules);

        // ✓ 5. Check for duplicates if sector/facility_type changed
        if (array_key_exists('customer_sector', $validated) || array_key_exists('facility_type', $validated)) {
            $checkSector = $validated['customer_sector'] ?? $current->customer_sector;
            $checkFacility = $validated['facility_type'] ?? $current->facility_type;

            $duplicateQuery = DB::table(self::TABLE)
                ->where('product_id', $productId)
                ->where('customer_sector', $checkSector)
                ->where('id', '!=', $segmentId)
                ->when(
                    $this->support->hasColumn(self::TABLE, 'deleted_at'),
                    fn ($q) => $q->whereNull('deleted_at')
                );

            if ($checkFacility !== null) {
                $duplicateQuery->where('facility_type', $checkFacility);
            } else {
                $duplicateQuery->whereNull('facility_type');
            }

            if ($duplicateQuery->exists()) {
                return response()->json([
                    'message' => 'A target segment for this customer sector and facility type already exists.',
                ], 422);
            }
        }

        // ✓ 6. Build partial payload
        $payload = [];

        if (array_key_exists('customer_sector', $validated)) {
            $payload['customer_sector'] = trim((string) $validated['customer_sector']);
        }
        if (array_key_exists('facility_type', $validated)) {
            $payload['facility_type'] = $this->support->normalizeNullableString($validated['facility_type']);
        }
        if (array_key_exists('bed_capacity_min', $validated)) {
            $payload['bed_capacity_min'] = $this->support->parseNullableInt($validated['bed_capacity_min']);
        }
        if (array_key_exists('bed_capacity_max', $validated)) {
            $payload['bed_capacity_max'] = $this->support->parseNullableInt($validated['bed_capacity_max']);
        }
        if (array_key_exists('priority', $validated)) {
            $payload['priority'] = max(1, (int) $validated['priority']);
        }
        if (array_key_exists('sales_notes', $validated)) {
            $payload['sales_notes'] = $this->support->normalizeNullableString($validated['sales_notes']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }

        // ✓ 7. If no changes, return current record
        if ($payload === []) {
            $record = $this->loadSegmentById($segmentId);
            return response()->json(['data' => $record ?? $this->serializeSegment((array) $current)]);
        }

        // ✓ 8. Add audit metadata
        $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
        if ($actorId !== null && $this->support->hasColumn(self::TABLE, 'updated_by')) {
            $payload['updated_by'] = $actorId;
        }
        if ($this->support->hasColumn(self::TABLE, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        // ✓ 9. Filter payload
        $payload = $this->support->filterPayloadByTableColumns(self::TABLE, $payload);

        // ✓ 10. Capture before snapshot for audit
        $before = $this->serializeSegment((array) $current);

        // ✓ 11. UPDATE
        DB::table(self::TABLE)->where('id', $segmentId)->update($payload);

        // ✓ 12. Reload & serialize
        $record = $this->loadSegmentById($segmentId);
        if ($record === null) {
            return response()->json(['message' => 'Segment updated but cannot be reloaded.'], 500);
        }

        // ✓ 13. Record audit event
        $this->accessAudit->recordAuditEvent(
            $request,
            'UPDATE',
            self::TABLE,
            $segmentId,
            $before,
            $record
        );

        // ✓ 14. Invalidate caches
        $this->insightService->invalidateProductDetailCaches($productId);

        // ✓ 15. Return 200
        return response()->json(['data' => $record]);
    }

    /**
     * Delete (soft delete) a target segment
     * 
     * DELETE /api/v5/products/{productId}/target-segments/{segmentId}
     * 
     * @param Request $request
     * @param int $productId
     * @param int $segmentId
     * @return JsonResponse
     */
    public function destroy(Request $request, int $productId, int $segmentId): JsonResponse
    {
        // ✓ 1. Check tables exist
        if (! $this->support->hasTable(self::TABLE) || ! $this->support->hasTable(self::PRODUCTS_TABLE)) {
            return $this->support->missingTable(self::TABLE);
        }

        // ✓ 2. Load segment
        $segmentQuery = DB::table(self::TABLE)
            ->where('id', $segmentId)
            ->where('product_id', $productId)
            ->when(
                $this->support->hasColumn(self::TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            );

        $segment = $segmentQuery->first();
        if ($segment === null) {
            return response()->json(['message' => 'Target segment not found.'], 404);
        }

        // ✓ 3. Capture before snapshot for audit
        $before = $this->serializeSegment((array) $segment);

        // ✓ 4. Soft delete
        try {
            $deletePayload = [];

            if ($this->support->hasColumn(self::TABLE, 'deleted_at')) {
                $deletePayload['deleted_at'] = now();
            }

            $actorId = $this->accessAudit->resolveAuthenticatedUserId($request);
            if ($actorId !== null && $this->support->hasColumn(self::TABLE, 'updated_by')) {
                $deletePayload['updated_by'] = $actorId;
            }
            if ($this->support->hasColumn(self::TABLE, 'updated_at')) {
                $deletePayload['updated_at'] = now();
            }

            $deletePayload = $this->support->filterPayloadByTableColumns(self::TABLE, $deletePayload);

            if ($deletePayload !== []) {
                DB::table(self::TABLE)->where('id', $segmentId)->update($deletePayload);
            } else {
                DB::table(self::TABLE)->where('id', $segmentId)->delete();
            }

            // ✓ 5. Record audit event
            $this->accessAudit->recordAuditEvent(
                $request,
                'DELETE',
                self::TABLE,
                $segmentId,
                $before,
                null
            );

            // ✓ 6. Invalidate caches
            $this->insightService->invalidateProductDetailCaches($productId);

            // ✓ 7. Return 200
            return response()->json(['message' => 'Target segment deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Cannot delete target segment.',
            ], 422);
        }
    }

    /**
     * Load a segment by ID
     * 
     * @param int $id
     * @return array<string, mixed>|null
     */
    private function loadSegmentById(int $id): ?array
    {
        if (! $this->support->hasTable(self::TABLE)) {
            return null;
        }

        $record = DB::table(self::TABLE)
            ->select($this->support->selectColumns(self::TABLE, [
                'id',
                'uuid',
                'product_id',
                'customer_sector',
                'facility_type',
                'bed_capacity_min',
                'bed_capacity_max',
                'priority',
                'sales_notes',
                'is_active',
                'created_by',
                'updated_by',
                'created_at',
                'updated_at',
            ]))
            ->where('id', $id)
            ->when(
                $this->support->hasColumn(self::TABLE, 'deleted_at'),
                fn ($q) => $q->whereNull('deleted_at')
            )
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSegment((array) $record);
    }

    /**
     * Serialize a segment record for API response
     * 
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function serializeSegment(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'uuid' => $this->support->normalizeNullableString($record['uuid'] ?? null),
            'product_id' => $record['product_id'] ?? null,
            'customer_sector' => (string) ($record['customer_sector'] ?? ''),
            'facility_type' => $this->support->normalizeNullableString($record['facility_type'] ?? null),
            'bed_capacity_min' => $record['bed_capacity_min'] !== null ? (int) $record['bed_capacity_min'] : null,
            'bed_capacity_max' => $record['bed_capacity_max'] !== null ? (int) $record['bed_capacity_max'] : null,
            'priority' => (int) ($record['priority'] ?? 1),
            'sales_notes' => $this->support->normalizeNullableString($record['sales_notes'] ?? null),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_by' => $record['created_by'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'created_at' => $record['created_at'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
        ];
    }
}
