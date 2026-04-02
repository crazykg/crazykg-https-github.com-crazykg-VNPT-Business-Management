# Backend Product Target Segments CRUD Endpoint Design
## Thorough Exploration Report

**Date:** March 30, 2026  
**Focus:** Service/Controller Pattern for product_target_segments CRUD Implementation

---

## 1. PROJECT STRUCTURE & FILE LOCATIONS

### 1.1 Core Files

| Component | File Path | Type |
|-----------|-----------|------|
| **Product Controller** | `backend/app/Http/Controllers/Api/V5/ProductController.php` | Endpoint Gateway |
| **Product Service** | `backend/app/Services/V5/Domain/ProductDomainService.php` | Main CRUD Logic |
| **Feature Catalog Service** | `backend/app/Services/V5/Domain/ProductFeatureCatalogDomainService.php` | Sub-entity Pattern Reference |
| **Product Model** | `backend/app/Models/Product.php` | Minimal Model (uses DB::table) |
| **Store Request** | `backend/app/Http/Requests/V5/StoreProductRequest.php` | Validation Rules |
| **Update Request** | `backend/app/Http/Requests/V5/UpdateProductRequest.php` | Validation Rules |
| **Routes** | `backend/routes/api/master-data.php` | Endpoint Mappings |
| **Migration** | `backend/database/migrations/2026_03_29_100000_create_product_target_segments_table.php` | Schema Definition |
| **Base Controller** | `backend/app/Http/Controllers/Api/V5/V5BaseController.php` | Base class with injection |
| **Audit Service** | `backend/app/Services/V5/V5AccessAuditService.php` | Audit logging & recording |

---

## 2. DATABASE SCHEMA FOR product_target_segments

### 2.1 Full Schema Definition

```sql
CREATE TABLE product_target_segments (
    id                          BIGINT PRIMARY KEY AUTO_INCREMENT,
    uuid                        VARCHAR(36) UNIQUE NOT NULL,
    product_id                  BIGINT UNSIGNED NOT NULL,
    customer_sector             VARCHAR(50) NOT NULL,
    facility_type               VARCHAR(50) NULLABLE,
    bed_capacity_min            INT UNSIGNED NULLABLE,
    bed_capacity_max            INT UNSIGNED NULLABLE,
    priority                    TINYINT UNSIGNED DEFAULT 1,
    sales_notes                 TEXT NULLABLE,
    is_active                   BOOLEAN DEFAULT true,
    created_by                  BIGINT UNSIGNED NULLABLE,
    updated_by                  BIGINT UNSIGNED NULLABLE,
    created_at                  TIMESTAMP,
    updated_at                  TIMESTAMP,
    deleted_at                  TIMESTAMP NULLABLE (soft delete),
    
    -- Foreign Keys
    CONSTRAINT fk_product_target_segments_product_id 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_target_segments_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_target_segments_updated_by 
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_pts_sector_lookup (customer_sector, facility_type, is_active, deleted_at),
    INDEX idx_pts_product_lookup (product_id, is_active, deleted_at)
);
```

### 2.2 Key Characteristics

- **Soft Deletes:** Uses `deleted_at` column (required pattern)
- **Audit Trail:** `created_by`, `updated_by`, `created_at`, `updated_at`
- **Cascading Deletes:** When a product is deleted, all its target segments are deleted
- **UUID Support:** Unique `uuid` column for external references
- **Optimization:** Two compound indexes for common queries

---

## 3. CONTROLLER PATTERN ANALYSIS

### 3.1 ProductController Structure

**File:** `backend/app/Http/Controllers/Api/V5/ProductController.php`

```php
class ProductController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProductDomainService $productService,
        private readonly ProductFeatureCatalogDomainService $productFeatureCatalogService,
        private readonly ProductQuotationDomainService $productQuotationService,
        private readonly ProductQuotationExportService $quotationExportService
    ) {
        parent::__construct($support, $accessAudit);
    }
```

**Pattern:** Constructor Dependency Injection via Service Container

**Key Methods:**
- `index(Request $request)` → Lists all products
- `store(StoreProductRequest $request)` → Creates new product
- `update(UpdateProductRequest $request, int $id)` → Updates existing product
- `destroy(Request $request, int $id)` → Deletes product
- `featureCatalog(Request $request, int $id)` → Shows feature catalog (sub-entity)
- `updateFeatureCatalog(Request $request, int $id)` → Updates catalog

**For ProductTargetSegments:** You would add similar methods like:
```php
// GET /products/{id}/target-segments
public function targetSegments(Request $request, int $id): JsonResponse
{
    return $this->productTargetSegmentService->index($request, $id);
}

// POST /products/{id}/target-segments
public function storeTargetSegment(Request $request, int $id): JsonResponse
{
    return $this->productTargetSegmentService->store($request, $id);
}

// PUT /products/{id}/target-segments/{segmentId}
public function updateTargetSegment(Request $request, int $id, int $segmentId): JsonResponse
{
    return $this->productTargetSegmentService->update($request, $id, $segmentId);
}

// DELETE /products/{id}/target-segments/{segmentId}
public function destroyTargetSegment(Request $request, int $id, int $segmentId): JsonResponse
{
    return $this->productTargetSegmentService->destroy($request, $id, $segmentId);
}
```

---

## 4. SERVICE/DOMAIN LAYER PATTERN

### 4.1 ProductDomainService Architecture

**Key Characteristics:**

1. **Stateless Design**
   - No stored state between requests
   - Pure methods that return JsonResponse
   - All dependencies injected

2. **Method Signature Pattern**
   ```php
   public function index(Request $request): JsonResponse
   public function store(Request $request): JsonResponse
   public function update(Request $request, int $id): JsonResponse
   public function destroy(Request $request, int $id): JsonResponse
   ```

3. **Core Workflow in `store()` method (lines 193-277)**
   ```
   ✓ Check table exists
   ✓ Define validation rules
   ✓ Parse & validate input
   ✓ Validate foreign key references
   ✓ Normalize & filter payload
   ✓ Add audit metadata (created_by, updated_by, timestamps)
   ✓ Insert into database with error handling
   ✓ Sync related data (attachments in product case)
   ✓ Clear cache
   ✓ Invalidate insights
   ✓ Reload & serialize full record
   ✓ Return 201 with data or error with 422
   ```

4. **Core Workflow in `update()` method (lines 279-404)**
   ```
   ✓ Check table exists
   ✓ Load current record (404 if not found)
   ✓ Define validation rules (use 'sometimes' for partial updates)
   ✓ Parse & validate input
   ✓ Check foreign key references if provided
   ✓ Build partial payload only with changed fields
   ✓ Add audit metadata if needed
   ✓ Apply updates (skip if payload empty)
   ✓ Sync related data if needed
   ✓ Clear cache
   ✓ Invalidate insights
   ✓ Reload & serialize full record
   ✓ Return 200 with data or error with 422
   ```

5. **Error Handling Patterns**
   - 404 for missing resources
   - 422 for validation failures or unique constraint violations
   - 500 for reload failures (data created but can't retrieve)
   - QueryException caught for unique constraint detection (error code 1062 = MySQL duplicate key)

### 4.2 Key Service Methods

#### Private Helper: `tableRowExists()`
```php
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
```
**Usage:** Validate foreign key references before insertion/update

#### Private Helper: `serializeProductRecord()`
```php
private function serializeProductRecord(array $record, array $attachments = []): array
{
    return [
        'id' => $record['id'] ?? null,
        'service_group' => $this->resolveServiceGroup($record['service_group'] ?? null),
        'product_code' => (string) ($record['product_code'] ?? ''),
        // ... normalized fields
        'attachments' => array_values($attachments),
    ];
}
```
**Purpose:** Transform raw database rows into consistent API response format

#### Cache Invalidation
```php
Cache::forget(self::PRODUCT_CACHE_KEY);  // Clear list cache
$this->insightService->invalidateAllInsightCaches();  // Clear all insights
$this->insightService->invalidateProductDetailCaches($id);  // Clear specific product
```

---

## 5. SUB-ENTITY CRUD PATTERN (Feature Catalog Reference)

### 5.1 How ProductFeatureCatalogDomainService Handles Nested Updates

**File:** `backend/app/Services/V5/Domain/ProductFeatureCatalogDomainService.php`

The feature catalog implements a complete nested CRUD pattern for groups and features. This is the EXACT pattern you should follow for target segments.

#### Pattern Overview:

1. **Single Update Endpoint Handles All Operations**
   ```php
   public function update(Request $request, int $productId): JsonResponse
   {
       // Accepts complete groups array (including new, updated, deleted items)
       // Returns updated catalog with all groups and features
   }
   ```

2. **Validation of Nested Structures**
   ```php
   $validated = $request->validate([
       'groups' => ['required', 'array'],
       'groups.*.id' => ['nullable', 'integer'],  // null = create, int = update
       'groups.*.group_name' => ['required', 'string', 'max:255'],
       'groups.*.features' => ['nullable', 'array'],
       'groups.*.features.*.id' => ['nullable', 'integer'],
       'groups.*.features.*.feature_name' => ['required', 'string', 'max:255'],
       // ... more rules
   ]);
   
   // Additional validation
   $this->validateNoDuplicateCatalogEntries($validated['groups']);
   ```

3. **Transaction-Based Sync**
   ```php
   DB::transaction(function () use (...) {
       foreach ($groups as $groupIndex => $groupPayload) {
           $groupId = $this->syncGroup(...);  // Create or Update
           
           foreach ($groupPayload['features'] as $feature) {
               $featureId = $this->syncFeature(...);  // Create or Update
           }
       }
       
       // Clean up removed items
       $this->deleteRemovedFeatures(...);
       $this->deleteRemovedGroups(...);
   });
   ```

4. **Individual Sync Methods**
   
   **`syncGroup()` method (lines 442-523):**
   ```php
   private function syncGroup(
       Request $request,
       int $productId,
       array $groupPayload,
       int $groupIndex,
       Collection $existingGroups,
       ?int $actorId
   ): int
   {
       $groupId = $this->support->parseNullableInt($groupPayload['id'] ?? null);
       
       // Validate ID belongs to this product
       if ($groupId !== null && ! $existingGroups->has((string) $groupId)) {
           throw ValidationException::withMessages([
               "groups.{$groupIndex}.id" => ['Invalid group or not in product']
           ]);
       }
       
       if ($groupId === null) {
           // INSERT: New group
           $insertPayload = [ /* normalized data */ ];
           $groupId = DB::table('product_feature_groups')->insertGetId($insertPayload);
           
           // Record audit INSERT
           $this->accessAudit->recordAuditEvent(
               $request, 'INSERT', 'product_feature_groups', $groupId, null, $inserted
           );
       } else {
           // UPDATE: Existing group
           $before = $this->extractGroupAuditRecord($existingGroup);
           DB::table('product_feature_groups')->where('id', $groupId)->update($updatePayload);
           
           // Record audit UPDATE only if changed
           $this->accessAudit->recordAuditEvent(
               $request, 'UPDATE', 'product_feature_groups', $groupId, $before, $after
           );
       }
       
       return $groupId;
   }
   ```

5. **Deletion of Removed Items**
   ```php
   private function deleteRemovedFeatures(
       Request $request,
       array $productIds,
       Collection $existingFeatures,
       array $featureIdsSeen,  // IDs from current request
       ?int $actorId
   ): void
   {
       // Find features NOT in current request (= removed)
       $toDelete = DB::table('product_features')
           ->whereIn('product_id', $productIds)
           ->whereNull('deleted_at')
           ->whereNotIn('id', $featureIdsSeen)
           ->get();
       
       foreach ($toDelete as $record) {
           // Soft delete with audit
           DB::table('product_features')->where('id', $record->id)->update([
               'deleted_at' => now(),
               'updated_by' => $actorId,
               'updated_at' => now(),
           ]);
           
           $this->accessAudit->recordAuditEvent(
               $request, 'DELETE', 'product_features', $featureId, $before, null
           );
       }
   }
   ```

6. **Snapshot-Based Change Detection**
   ```php
   $beforeSnapshot = $this->loadCatalogSnapshot($catalogProductIds);
   // ... perform updates ...
   $afterSnapshot = $this->loadCatalogSnapshot($catalogProductIds);
   
   if ($beforeSnapshot !== $afterSnapshot) {
       $event = $beforeSnapshot === [] ? 'INSERT' : 
                ($afterSnapshot === [] ? 'DELETE' : 'UPDATE');
       
       $this->accessAudit->recordAuditEvent(
           $request, $event, 'product_feature_catalogs', 
           $catalogProductId, $oldAuditPayload, $newAuditPayload
       );
   }
   ```

7. **Pagination & Filtering in List Views**
   - Uses `loadCatalogListRows()` for paginated display
   - Implements search with LIKE operator
   - Union queries for groups + features rows
   - Filter by group_id if provided

---

## 6. VALIDATION PATTERN

### 6.1 Request Classes

**File Structure:** `backend/app/Http/Requests/V5/{StoreProductRequest, UpdateProductRequest}.php`

**StoreProductRequest (lines 1-53):**
```php
class StoreProductRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('products.write');
    }

    public function rules(): array
    {
        $rules = [
            'service_group' => ['nullable', 'string', Rule::in(self::SERVICE_GROUP_VALUES)],
            'product_code' => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'domain_id' => ['required', 'integer'],
            'vendor_id' => ['required', 'integer'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
        ];
        
        // Dynamic rule for unique constraint
        if ($this->support()->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code');
            if ($this->support()->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($q) => $q->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }
        
        return $rules;
    }
}
```

**UpdateProductRequest (lines 1-55):**
- Same rules but with `'sometimes'` instead of `'required'`
- Allows partial updates
- Unique rule uses `.ignore($id)` to exclude current record

**For ProductTargetSegments:**
```php
// StoreProductTargetSegmentRequest
class StoreProductTargetSegmentRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('products.write');
    }

    public function rules(): array
    {
        return [
            'customer_sector' => ['required', 'string', 'max:50'],
            'facility_type' => ['nullable', 'string', 'max:50'],
            'bed_capacity_min' => ['nullable', 'integer', 'min:0'],
            'bed_capacity_max' => ['nullable', 'integer', 'min:0'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:255'],
            'sales_notes' => ['nullable', 'string', 'max:65535'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}

// UpdateProductTargetSegmentRequest
class UpdateProductTargetSegmentRequest extends V5FormRequest
{
    public function authorize(): bool
    {
        return $this->authorizeWithPermission('products.write');
    }

    public function rules(): array
    {
        return [
            'customer_sector' => ['sometimes', 'string', 'max:50'],
            'facility_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bed_capacity_min' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'bed_capacity_max' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'priority' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:255'],
            'sales_notes' => ['sometimes', 'nullable', 'string', 'max:65535'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
```

### 6.2 Validation Rule Helpers in Service

The service layer also defines validation rules inline:

```php
public function store(Request $request): JsonResponse
{
    $rules = [
        'service_group' => ['nullable', 'string', Rule::in(self::SERVICE_GROUP_VALUES)],
        'product_code' => ['required', 'string', 'max:100'],
        // ...
    ];
    $rules = array_merge($rules, $this->attachmentValidationRules());
    
    $validated = $this->validatedInput($request);  // Trait method
}
```

---

## 7. AUDIT LOGGING PATTERN

### 7.1 V5AccessAuditService

**File:** `backend/app/Services/V5/V5AccessAuditService.php` (lines 89-135)

```php
public function recordAuditEvent(
    Request $request,
    string $event,
    string $auditableType,
    int|string|null $auditableId,
    ?array $oldValues = null,
    ?array $newValues = null
): void
{
    if (! $this->support->hasTable('audit_logs')) {
        return;  // Graceful failure if table missing
    }

    $eventCode = strtoupper(trim($event));
    if (! in_array($eventCode, ['INSERT', 'UPDATE', 'DELETE', 'RESTORE'], true)) {
        return;  // Only these 4 event types
    }

    // Build audit record
    $payload = [
        'uuid' => (string) Str::uuid(),
        'event' => $eventCode,  // INSERT, UPDATE, DELETE, RESTORE
        'auditable_type' => $auditableType,  // Table name or custom type
        'auditable_id' => $auditableIdValue,  // Record ID
        'old_values' => $this->encodeAuditValues($oldValues),  // JSON
        'new_values' => $this->encodeAuditValues($newValues),  // JSON
        'url' => $request->fullUrl(),
        'ip_address' => $request->ip(),
        'user_agent' => $request->userAgent(),
        'created_at' => now(),
        'created_by' => $this->resolveAuthenticatedUserId($request),
    ];

    DB::table('audit_logs')->insert($payload);
}
```

**Key Characteristics:**
- Sanitizes values before encoding (removes sensitive data)
- Non-blocking: errors in audit don't interrupt business logic
- Encodes old/new values as JSON
- Records request metadata (IP, user-agent, URL)
- Event types: INSERT, UPDATE, DELETE, RESTORE

**Usage in ProductDomainService:**

```php
// After INSERT
$this->accessAudit->recordAuditEvent(
    $request, 
    'INSERT', 
    'products',  // auditable_type
    $insertId,   // auditable_id
    null,        // no old values
    $inserted    // new values
);

// After UPDATE (only if changed)
if ($this->extractGroupAuditRecord(array_merge($existingGroup, $updatePayload)) !== $before) {
    $this->accessAudit->recordAuditEvent(
        $request,
        'UPDATE',
        'product_feature_groups',
        $groupId,
        $before,    // old values
        $after      // new values
    );
}

// After DELETE
$this->accessAudit->recordAuditEvent(
    $request,
    'DELETE',
    'product_feature_groups',
    $groupId,
    $before,    // old values
    null        // no new values
);
```

### 7.2 Helper Methods

```php
private function extractGroupAuditRecord(array $group): array
{
    return [
        'product_id' => $group['product_id'] ?? null,
        'group_name' => $group['group_name'] ?? null,
        'notes' => $group['notes'] ?? null,
        'display_order' => $group['display_order'] ?? null,
    ];
}
```
Used to compare before/after and only record audit if different.

---

## 8. ROUTES PATTERN

### 8.1 Current Product Routes (backend/routes/api/master-data.php)

```php
// List all products
Route::get('/products', [ProductController::class, 'index'])
    ->middleware('permission:products.read');

// Get feature catalog for product
Route::get('/products/{id}/feature-catalog', [ProductController::class, 'featureCatalog'])
    ->middleware('permission:products.read');

// List features with pagination & search
Route::get('/products/{id}/feature-catalog/list', [ProductController::class, 'featureCatalogList'])
    ->middleware('permission:products.read');

// Update feature catalog (all groups & features)
Route::put('/products/{id}/feature-catalog', [ProductController::class, 'updateFeatureCatalog'])
    ->middleware('permission:products.write');

// Create product
Route::post('/products', [ProductController::class, 'store'])
    ->middleware('permission:products.write');

// Update product
Route::put('/products/{id}', [ProductController::class, 'update'])
    ->middleware('permission:products.write');

// Delete product
Route::delete('/products/{id}', [ProductController::class, 'destroy'])
    ->middleware('permission:products.delete');
```

### 8.2 For ProductTargetSegments (Add to routes):

```php
// GET /products/{id}/target-segments
Route::get('/products/{id}/target-segments', [ProductController::class, 'targetSegments'])
    ->middleware('permission:products.read');

// POST /products/{id}/target-segments
Route::post('/products/{id}/target-segments', [ProductController::class, 'storeTargetSegment'])
    ->middleware('permission:products.write');

// PUT /products/{id}/target-segments/{segmentId}
Route::put('/products/{id}/target-segments/{segmentId}', [ProductController::class, 'updateTargetSegment'])
    ->middleware('permission:products.write');

// DELETE /products/{id}/target-segments/{segmentId}
Route::delete('/products/{id}/target-segments/{segmentId}', [ProductController::class, 'destroyTargetSegment'])
    ->middleware('permission:products.delete');

// OR BATCH UPDATE (like feature catalog):
Route::put('/products/{id}/target-segments', [ProductController::class, 'updateTargetSegments'])
    ->middleware('permission:products.write');
```

---

## 9. SUPPORT & UTILITY METHODS

### 9.1 V5DomainSupportService Methods Used

| Method | Purpose | Example |
|--------|---------|---------|
| `hasTable($table)` | Check if table exists | `$this->support->hasTable('products')` |
| `hasColumn($table, $column)` | Check if column exists | `$this->support->hasColumn('products', 'deleted_at')` |
| `selectColumns($table, array)` | Select only existing columns | `$this->support->selectColumns('products', ['id', 'name'])` |
| `filterPayloadByTableColumns($table, array)` | Remove non-existent columns from payload | `$this->support->filterPayloadByTableColumns('products', $payload)` |
| `parseNullableInt($value)` | Safe integer parsing | `$id = $this->support->parseNullableInt($input['id'] ?? null)` |
| `normalizeNullableString($value)` | Trim & return null if empty | `$name = $this->support->normalizeNullableString($value)` |
| `resolvePaginationParams(Request)` | Extract page/perPage with defaults | `[$page, $perPage] = $this->support->resolvePaginationParams($request, 20, 200)` |
| `shouldPaginate(Request)` | Check if pagination requested | `if ($this->support->shouldPaginate($request))` |
| `buildPaginationMeta($page, $perPage, $total)` | Build pagination metadata | Includes has_more, total_pages, etc |

### 9.2 ResolvesValidatedInput Trait

Used in ProductDomainService:

```php
class ProductDomainService
{
    use ResolvesValidatedInput;  // Provides validatedInput() method
    
    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatedInput($request);  // Auto-validates with rules()
    }
}
```

---

## 10. KEY PATTERNS & BEST PRACTICES

### 10.1 Database Interaction

**Pattern: Query Builder over Eloquent**
```php
// NOT using model syntax, using query builder:
DB::table('products')
    ->where('id', $id)
    ->when($this->support->hasColumn('products', 'deleted_at'), 
        fn ($q) => $q->whereNull('deleted_at'))
    ->first();

// This allows schema flexibility - columns are checked before use
```

**Soft Deletes Always Checked:**
```php
$query = DB::table('products')->where('id', $id);
if ($this->support->hasColumn('products', 'deleted_at')) {
    $query->whereNull('deleted_at');  // Only select active records
}
```

### 10.2 Null Handling

```php
// Normalize nullable strings
$field = $this->support->normalizeNullableString($value);
// Returns: null if empty/null, trimmed string otherwise

// Safe integer parsing
$id = $this->support->parseNullableInt($value);
// Returns: null if not a valid int, int otherwise

// Check existence with foreign keys
if ($id === null || ! $this->tableRowExists('business_domains', $id)) {
    return response()->json(['message' => 'domain_id is invalid.'], 422);
}
```

### 10.3 Payload Normalization

```php
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

// filterPayloadByTableColumns removes columns that don't exist in table
```

### 10.4 Timestamp & Audit Metadata

```php
if ($this->support->hasColumn('products', 'created_at')) {
    $payload['created_at'] = now();
}
if ($this->support->hasColumn('products', 'updated_at')) {
    $payload['updated_at'] = now();
}

// Then filter again to apply
$payload = $this->support->filterPayloadByTableColumns('products', $payload);
```

### 10.5 Error Response Patterns

```php
// 404 Not Found
return response()->json(['message' => 'Product not found.'], 404);

// 422 Unprocessable Entity (validation/constraint)
return response()->json(['message' => 'Product code already exists.'], 422);

// 500 Server Error (unexpected condition)
return response()->json(['message' => 'Product created but cannot be reloaded.'], 500);

// 403 Forbidden (authorization)
return response()->json(['message' => 'You do not have access to this resource.'], 403);

// With additional data
return response()->json([
    'message' => 'Cannot delete product with references',
    'data' => [
        'references' => [
            ['table' => 'contract_items', 'label' => 'contract items', 'count' => 5]
        ]
    ]
], 422);
```

### 10.6 Cache Invalidation Strategy

```php
// Clear product list cache
Cache::forget(self::PRODUCT_CACHE_KEY);  // 'v5:products:list:v1'

// Invalidate all insight caches (affects multiple features)
$this->insightService->invalidateAllInsightCaches();

// Invalidate specific product insights
$this->insightService->invalidateProductDetailCaches($productId);
```

---

## 11. COMPLETE REQUEST/RESPONSE LIFECYCLE

### 11.1 Create Target Segment (POST)

```
HTTP Request:
  POST /api/v5/products/42/target-segments
  Authorization: Bearer token
  Content-Type: application/json
  
  {
    "customer_sector": "HOSPITAL",
    "facility_type": "GENERAL",
    "bed_capacity_min": 100,
    "bed_capacity_max": 500,
    "priority": 1,
    "sales_notes": "Primary market target",
    "is_active": true
  }

↓ ProductController::storeTargetSegment()
  ↓ Check permission: products.write ✓
  ↓ ProductTargetSegmentDomainService::store()
    ✓ Check product exists (product_id: 42)
    ✓ Validate input (max lengths, types)
    ✓ Normalize fields (trim strings)
    ✓ Add audit metadata:
      - created_by: 15 (authenticated user)
      - updated_by: 15
      - created_at: 2026-03-30 10:30:00
      - updated_at: 2026-03-30 10:30:00
    ✓ INSERT into product_target_segments
      - Returns: id = 789
    ✓ Record audit event:
      - event: INSERT
      - auditable_type: product_target_segments
      - auditable_id: 789
      - old_values: null
      - new_values: {customer_sector, facility_type, ...}
    ✓ Load inserted record for response
    ✓ Serialize to API format

HTTP Response: 201 Created
  {
    "data": {
      "id": 789,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "product_id": 42,
      "customer_sector": "HOSPITAL",
      "facility_type": "GENERAL",
      "bed_capacity_min": 100,
      "bed_capacity_max": 500,
      "priority": 1,
      "sales_notes": "Primary market target",
      "is_active": true,
      "created_by": 15,
      "updated_by": 15,
      "created_at": "2026-03-30",
      "updated_at": "2026-03-30"
    }
  }
```

### 11.2 Update Target Segment (PUT)

```
HTTP Request:
  PUT /api/v5/products/42/target-segments/789
  
  {
    "priority": 2,
    "sales_notes": "Secondary market - follow up"
  }

↓ ProductTargetSegmentDomainService::update()
  ✓ Load current record
  ✓ Validate partial input
  ✓ Build partial payload (only provided fields)
  ✓ Compare before/after - changes detected ✓
  ✓ UPDATE record
  ✓ Record audit event:
    - event: UPDATE
    - old_values: {priority: 1, sales_notes: "Primary..."}
    - new_values: {priority: 2, sales_notes: "Secondary..."}
  ✓ Reload & serialize

HTTP Response: 200 OK
  {
    "data": {
      "id": 789,
      "priority": 2,
      "sales_notes": "Secondary market - follow up",
      ... other fields unchanged
    }
  }
```

### 11.3 Delete Target Segment (DELETE)

```
HTTP Request:
  DELETE /api/v5/products/42/target-segments/789

↓ ProductTargetSegmentDomainService::destroy()
  ✓ Load record
  ✓ Check for references (none in this case)
  ✓ Soft delete: UPDATE deleted_at = now()
  ✓ Record audit event:
    - event: DELETE
    - old_values: {all fields}
    - new_values: null

HTTP Response: 200 OK
  {
    "message": "Target segment deleted."
  }
```

---

## 12. IMPLEMENTATION CHECKLIST

### Files to Create

- [ ] `backend/app/Models/ProductTargetSegment.php`
- [ ] `backend/app/Services/V5/Domain/ProductTargetSegmentDomainService.php`
- [ ] `backend/app/Http/Requests/V5/StoreProductTargetSegmentRequest.php`
- [ ] `backend/app/Http/Requests/V5/UpdateProductTargetSegmentRequest.php`

### Files to Modify

- [ ] `backend/app/Http/Controllers/Api/V5/ProductController.php`
  - Add 4 new methods (targetSegments, storeTargetSegment, updateTargetSegment, destroyTargetSegment)
  - Add service dependency injection
- [ ] `backend/routes/api/master-data.php`
  - Add 4 new routes
- [ ] Service bindings in container (if applicable)

### Code Patterns to Follow

- ✓ Use `DB::table()` not Eloquent models
- ✓ Check table/column existence before use
- ✓ Handle soft deletes with `whereNull('deleted_at')`
- ✓ Always filter payloads with `filterPayloadByTableColumns()`
- ✓ Add audit metadata (created_by, updated_by, timestamps)
- ✓ Record audit events for INSERT/UPDATE/DELETE
- ✓ Handle foreign key validation
- ✓ Clear caches after mutations
- ✓ Return appropriate HTTP status codes
- ✓ Serialize responses consistently

---

## 13. MIGRATION STATUS

**Migration File:** `backend/database/migrations/2026_03_29_100000_create_product_target_segments_table.php`

**Status:** ✅ Already created and ready
**Run:** `php artisan migrate`

**Schema Verification:**
```bash
php artisan tinker
> DB::table('product_target_segments')->getColumns()
```

---

## Summary

The VNPT Business Management system uses a **clean, service-oriented architecture** with:

1. **Thin Controllers** - Route requests to services
2. **Thick Services** - All business logic, validation, audit
3. **Query Builder** - Flexible schema handling
4. **Soft Deletes** - Data integrity with audit trail
5. **Comprehensive Audit** - Every mutation logged with before/after snapshots
6. **Cache Invalidation** - Automatic cache busting
7. **Error Handling** - Appropriate HTTP status codes
8. **Request Validation** - Two-layer (request + service)

The **ProductFeatureCatalogDomainService** is the perfect reference for implementing nested CRUD operations like target segments. It demonstrates transaction handling, snapshot-based auditing, and batch operations.

