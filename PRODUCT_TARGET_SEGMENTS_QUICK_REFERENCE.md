# Product Target Segments - Quick Reference Guide

## 🔑 Key Points at a Glance

### Database Schema
```
product_target_segments {
  id, uuid, product_id (FK), customer_sector, facility_type,
  bed_capacity_min, bed_capacity_max, priority, sales_notes,
  is_active, created_by, updated_by, created_at, updated_at, deleted_at (soft)
}
```

### CRUD Endpoints to Create
```
GET    /api/v5/products/{id}/target-segments          → List all segments for product
POST   /api/v5/products/{id}/target-segments          → Create segment
PUT    /api/v5/products/{id}/target-segments/{segId}  → Update segment
DELETE /api/v5/products/{id}/target-segments/{segId}  → Delete segment (soft)
```

### Files to Create
```
app/Models/ProductTargetSegment.php
app/Services/V5/Domain/ProductTargetSegmentDomainService.php
app/Http/Requests/V5/StoreProductTargetSegmentRequest.php
app/Http/Requests/V5/UpdateProductTargetSegmentRequest.php
```

### Files to Modify
```
app/Http/Controllers/Api/V5/ProductController.php    (add 4 methods + DI)
routes/api/master-data.php                            (add 4 routes)
```

---

## 📋 Service Layer Template

```php
// ProductTargetSegmentDomainService::store($request, $productId)
1. Check table exists
2. Load & validate product exists
3. Validate input (max:50 for sectors, etc)
4. Parse nullable integers (bed_capacity_min/max)
5. Validate no duplicate segment for same (product_id + customer_sector + facility_type)
6. Normalize & filter payload
7. Add audit metadata (created_by, updated_by, timestamps)
8. INSERT → get ID
9. Record audit: INSERT event with old_values=null, new_values=full record
10. Reload & serialize
11. Return 201 with data

// ProductTargetSegmentDomainService::update($request, $productId, $segmentId)
1. Load current segment (404 if not found)
2. Verify belongs to product_id
3. Validate partial input (use 'sometimes')
4. Build payload with only changed fields
5. Check uniqueness if sector/facility_type changed
6. UPDATE
7. Record audit: UPDATE event with old_values and new_values
8. Reload & serialize
9. Return 200 with data

// ProductTargetSegmentDomainService::destroy($request, $productId, $segmentId)
1. Load segment (404 if not found)
2. Soft delete: UPDATE deleted_at = now()
3. Record audit: DELETE event with old_values=full record, new_values=null
4. Return 200 with message

// ProductTargetSegmentDomainService::index($request, $productId)
1. Check product exists
2. Paginate segments for product (use shouldPaginate helper)
3. Filter by is_active if requested
4. Search by customer_sector/facility_type if search param
5. Serialize each row
6. Return with pagination meta
```

---

## 🎯 Validation Rules Pattern

**StoreProductTargetSegmentRequest:**
```php
'customer_sector' => ['required', 'string', 'max:50'],
'facility_type' => ['nullable', 'string', 'max:50'],
'bed_capacity_min' => ['nullable', 'integer', 'min:0'],
'bed_capacity_max' => ['nullable', 'integer', 'min:0'],
'priority' => ['nullable', 'integer', 'min:1', 'max:255'],
'sales_notes' => ['nullable', 'string', 'max:65535'],
'is_active' => ['nullable', 'boolean'],
```

**UpdateProductTargetSegmentRequest:** (same but 'sometimes' instead of 'required')

---

## 🔐 Audit Logging

Every mutation gets logged:
```
recordAuditEvent(
    $request,
    'INSERT',                        // event
    'product_target_segments',       // auditable_type
    $segmentId,                      // auditable_id
    null,                            // old_values (null for INSERT)
    $inserted                        // new_values
)
```

**Audit Fields Captured:**
- UUID, event type, auditable type/id
- old_values (JSON), new_values (JSON)
- URL, IP address, user agent
- created_at, created_by (user ID)

---

## ⚡ Key Helper Methods

| Method | Usage |
|--------|-------|
| `$this->support->hasTable('products')` | Check table exists |
| `$this->support->parseNullableInt($v)` | Safe int parsing |
| `$this->support->normalizeNullableString($v)` | Trim/null |
| `$this->support->filterPayloadByTableColumns($t, $p)` | Remove non-existent columns |
| `$this->support->resolvePaginationParams($req)` | Get page/perPage |
| `$this->accessAudit->recordAuditEvent(...)` | Log mutation |
| `$this->accessAudit->resolveAuthenticatedUserId($req)` | Get user ID |

---

## 🛡️ Error Responses

| Status | When | Example |
|--------|------|---------|
| 404 | Product/segment not found | Product not found. |
| 422 | Validation/unique constraint | Customer sector already exists. |
| 500 | DB exception | Cannot complete operation. |
| 403 | No permission | Unauthorized. |
| 201 | Created | With full record in `data` |
| 200 | Updated/Listed/Deleted | With record or message |

---

## 📊 Sample Request/Response

**POST /api/v5/products/42/target-segments**

Request:
```json
{
  "customer_sector": "HOSPITAL",
  "facility_type": "GENERAL",
  "bed_capacity_min": 100,
  "bed_capacity_max": 500,
  "priority": 1,
  "sales_notes": "Primary target",
  "is_active": true
}
```

Response (201 Created):
```json
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
    "sales_notes": "Primary target",
    "is_active": true,
    "created_by": 15,
    "updated_by": 15,
    "created_at": "2026-03-30",
    "updated_at": "2026-03-30"
  }
}
```

---

## 🔄 Controller Methods

```php
class ProductController extends V5BaseController
{
    public function __construct(
        V5DomainSupportService $support,
        V5AccessAuditService $accessAudit,
        private readonly ProductTargetSegmentDomainService $segmentService,
        // ... other services
    ) { parent::__construct($support, $accessAudit); }

    public function targetSegments(Request $request, int $id): JsonResponse
    {
        return $this->segmentService->index($request, $id);
    }

    public function storeTargetSegment(
        StoreProductTargetSegmentRequest $request, int $id
    ): JsonResponse {
        return $this->segmentService->store($request, $id);
    }

    public function updateTargetSegment(
        UpdateProductTargetSegmentRequest $request, int $id, int $segmentId
    ): JsonResponse {
        return $this->segmentService->update($request, $id, $segmentId);
    }

    public function destroyTargetSegment(Request $request, int $id, int $segmentId): JsonResponse
    {
        return $this->segmentService->destroy($request, $id, $segmentId);
    }
}
```

---

## 📍 Routes

Add to `backend/routes/api/master-data.php`:

```php
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

## ✅ Implementation Checklist

- [ ] Create ProductTargetSegment model
- [ ] Create ProductTargetSegmentDomainService
- [ ] Create StoreProductTargetSegmentRequest
- [ ] Create UpdateProductTargetSegmentRequest
- [ ] Add 4 controller methods
- [ ] Add 4 routes
- [ ] Test CREATE (201)
- [ ] Test READ (200)
- [ ] Test UPDATE (200)
- [ ] Test DELETE (200)
- [ ] Verify audit logs recorded
- [ ] Check uniqueness constraint
- [ ] Test foreign key validation
- [ ] Verify soft delete behavior
- [ ] Test pagination on list

