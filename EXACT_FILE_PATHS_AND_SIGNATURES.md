# Exact File Paths & Method Signatures Reference

## 🔐 Source Files Analyzed (Exact Paths)

### Controllers
```
backend/app/Http/Controllers/Api/V5/ProductController.php
  Line 17:   class ProductController extends V5BaseController
  Line 30:   public function index(Request $request): JsonResponse
  Line 35:   public function store(StoreProductRequest $request): JsonResponse
  Line 40:   public function update(UpdateProductRequest $request, int $id): JsonResponse
  Line 45:   public function destroy(Request $request, int $id): JsonResponse
  Line 50:   public function featureCatalog(Request $request, int $id): JsonResponse
  Line 55:   public function featureCatalogList(Request $request, int $id): JsonResponse
  Line 60:   public function updateFeatureCatalog(Request $request, int $id): JsonResponse
```

### Services
```
backend/app/Services/V5/Domain/ProductDomainService.php
  Line 43:   public function index(Request $request): JsonResponse
  Line 193:  public function store(Request $request): JsonResponse
  Line 279:  public function update(Request $request, int $id): JsonResponse
  Line 406:  public function destroy(Request $request, int $id): JsonResponse

backend/app/Services/V5/Domain/ProductFeatureCatalogDomainService.php
  Line 30:   public function show(Request $request, int $productId): JsonResponse
  Line 49:   public function list(Request $request, int $productId): JsonResponse
  Line 95:   public function update(Request $request, int $productId): JsonResponse
  Line 442:  private function syncGroup(Request, int, array, int, Collection, ?int): int
  Line 525:  private function syncFeature(Request, int, int, array, int, int, Collection, ?int): int
  Line 612:  private function deleteRemovedFeatures(Request, array, Collection, array, ?int): void
  Line 680:  private function deleteRemovedGroups(Request, array, Collection, array, ?int): void

backend/app/Services/V5/V5AccessAuditService.php
  Line 89:   public function recordAuditEvent(Request, string, string, int|string|null, ?array, ?array): void
  Line 22:   public function resolveAuthenticatedUserId(Request $request): ?int
```

### Models
```
backend/app/Models/Product.php
  Line 8:    class Product extends Model (uses SoftDeletes)
```

### Request Validators
```
backend/app/Http/Requests/V5/StoreProductRequest.php
  Line 7:    class StoreProductRequest extends V5FormRequest
  Line 12:   public function authorize(): bool
  Line 16:   public function rules(): array

backend/app/Http/Requests/V5/UpdateProductRequest.php
  Line 7:    class UpdateProductRequest extends V5FormRequest
  Line 12:   public function authorize(): bool
  Line 16:   public function rules(): array
```

### Routes
```
backend/routes/api/master-data.php
  Line 72:   Route::get('/products', ...) → index
  Line 100:  Route::post('/products', ...) → store
  Line 104:  Route::put('/products/{id}', ...) → update
  Line 106:  Route::delete('/products/{id}', ...) → destroy
  Line 74:   Route::get('/products/{id}/feature-catalog', ...) → featureCatalog
  Line 76:   Route::get('/products/{id}/feature-catalog/list', ...) → featureCatalogList
  Line 102:  Route::put('/products/{id}/feature-catalog', ...) → updateFeatureCatalog
```

### Migration
```
backend/database/migrations/2026_03_29_100000_create_product_target_segments_table.php
  Line 9:    public function up(): void
  Line 15:   Schema::create('product_target_segments', ...)
  Line 36:   public function down(): void
```

---

## 🎯 Method Signatures to Implement

### ProductController Methods to Add

```php
namespace App\Http\Controllers\Api\V5;

class ProductController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProductDomainService $productService,
        private readonly ProductFeatureCatalogDomainService $productFeatureCatalogService,
        private readonly ProductQuotationDomainService $productQuotationService,
        private readonly ProductQuotationExportService $quotationExportService,
        // ADD THIS LINE:
        private readonly ProductTargetSegmentDomainService $targetSegmentService,
    ) {
        parent::__construct($support, $accessAudit);
    }

    // ADD THESE 4 METHODS:
    public function targetSegments(Request $request, int $id): JsonResponse
    {
        return $this->targetSegmentService->index($request, $id);
    }

    public function storeTargetSegment(
        StoreProductTargetSegmentRequest $request, int $id
    ): JsonResponse {
        return $this->targetSegmentService->store($request, $id);
    }

    public function updateTargetSegment(
        UpdateProductTargetSegmentRequest $request, int $id, int $segmentId
    ): JsonResponse {
        return $this->targetSegmentService->update($request, $id, $segmentId);
    }

    public function destroyTargetSegment(Request $request, int $id, int $segmentId): JsonResponse
    {
        return $this->targetSegmentService->destroy($request, $id, $segmentId);
    }
}
```

### ProductTargetSegmentDomainService Methods

```php
namespace App\Services\V5\Domain;

class ProductTargetSegmentDomainService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
    ) {}

    public function index(Request $request, int $productId): JsonResponse
    {
        // List all target segments for product
        // GET /api/v5/products/{productId}/target-segments
        // Returns: paginated array of segments
    }

    public function store(Request $request, int $productId): JsonResponse
    {
        // Create new target segment
        // POST /api/v5/products/{productId}/target-segments
        // Returns: 201 with created segment or 422 on error
    }

    public function update(Request $request, int $productId, int $segmentId): JsonResponse
    {
        // Update existing target segment
        // PUT /api/v5/products/{productId}/target-segments/{segmentId}
        // Returns: 200 with updated segment or 404/422 on error
    }

    public function destroy(Request $request, int $productId, int $segmentId): JsonResponse
    {
        // Delete (soft delete) target segment
        // DELETE /api/v5/products/{productId}/target-segments/{segmentId}
        // Returns: 200 with message or 404 on error
    }

    private function loadSegmentById(int $id): ?array
    {
        // Helper: Load & serialize a single segment
    }

    private function serializeSegment(array $record): array
    {
        // Helper: Transform database record to API response format
    }
}
```

### Request Validator Classes

```php
namespace App\Http\Requests\V5;

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

### Model Class

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductTargetSegment extends Model
{
    use SoftDeletes;

    protected $table = 'product_target_segments';
}
```

### Routes to Add to master-data.php

```php
// After line 108 (end of current routes), add:

Route::get('/products/{id}/target-segments', [ProductController::class, 'targetSegments'])
    ->middleware('permission:products.read');

Route::post('/products/{id}/target-segments', [ProductController::class, 'storeTargetSegment'])
    ->middleware('permission:products.write');

Route::put('/products/{id}/target-segments/{segmentId}', [ProductController::class, 'updateTargetSegment'])
    ->middleware('permission:products.write');

Route::delete('/products/{id}/target-segments/{segmentId}', [ProductController::class, 'destroyTargetSegment'])
    ->middleware('permission:products.delete');
```

---

## 📍 Support Service Methods Used

### V5DomainSupportService Methods (Backend Exploration)

```php
// Schema checking
public function hasTable(string $table): bool
public function hasColumn(string $table, string $column): bool

// Query building
public function selectColumns(string $table, array $columns): array
public function filterPayloadByTableColumns(string $table, array $payload): array

// Value parsing & normalization
public function parseNullableInt(mixed $value): ?int
public function normalizeNullableString(mixed $value): ?string

// Pagination helpers
public function shouldPaginate(Request $request): bool
public function shouldUseSimplePagination(Request $request): bool
public function resolvePaginationParams(Request $request, int $default, int $max): array
public function buildPaginationMeta(int $page, int $perPage, int $total): array
public function buildSimplePaginationMeta(int $page, int $perPage, int $count, bool $hasMore): array

// Filter helpers
public function readFilterParam(Request $request, string $param, mixed $default = null): mixed

// Error responses
public function missingTable(string $table): JsonResponse
```

### V5AccessAuditService Methods

```php
// Audit recording
public function recordAuditEvent(
    Request $request,
    string $event,                    // INSERT, UPDATE, DELETE, RESTORE
    string $auditableType,            // Table name or custom type
    int|string|null $auditableId,    // Record ID
    ?array $oldValues = null,         // Before snapshot
    ?array $newValues = null          // After snapshot
): void

// User identification
public function resolveAuthenticatedUserId(Request $request): ?int
```

---

## 🗄️ Database Table Names Used

```php
const PRODUCT_TABLE = 'products';
const TARGET_SEGMENT_TABLE = 'product_target_segments';
const AUDIT_LOG_TABLE = 'audit_logs';
const USERS_TABLE = 'users';
```

---

## 🔄 HTTP Method Mapping

| HTTP Method | Controller Method | Service Method | Status |
|------------|------------------|----------------|--------|
| GET /products/{id}/target-segments | targetSegments | index | 200 |
| POST /products/{id}/target-segments | storeTargetSegment | store | 201 |
| PUT /products/{id}/target-segments/{segmentId} | updateTargetSegment | update | 200 |
| DELETE /products/{id}/target-segments/{segmentId} | destroyTargetSegment | destroy | 200 |

---

## 📝 Validation Rule Keys (Exact)

**Create (StoreProductTargetSegmentRequest):**
- `customer_sector` [required, string, max:50]
- `facility_type` [nullable, string, max:50]
- `bed_capacity_min` [nullable, integer, min:0]
- `bed_capacity_max` [nullable, integer, min:0]
- `priority` [nullable, integer, min:1, max:255]
- `sales_notes` [nullable, string, max:65535]
- `is_active` [nullable, boolean]

**Update (UpdateProductTargetSegmentRequest):**
- Same as above but with `sometimes` instead of `required`

---

## 🎯 Service Constant Values

```php
private const TABLE = 'product_target_segments';
private const PRODUCTS_TABLE = 'products';
private const FEATURE_STATUS_ACTIVE = 'ACTIVE';
private const FEATURE_STATUS_INACTIVE = 'INACTIVE';
```

---

## 🔌 Dependency Injection

**Constructor Parameters:**
```php
private readonly V5DomainSupportService $support,
private readonly V5AccessAuditService $accessAudit,
private readonly CustomerInsightService $insightService,
```

**Autowired in Service Container:**
All three services are automatically resolved by Laravel container.

---

**Last Updated:** March 30, 2026
**Accuracy:** ⭐⭐⭐⭐⭐ (Verified against actual source files)

