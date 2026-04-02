# UI Quản lý Product Target Segments

> **Ngày**: 2026-03-30
> **Phạm vi**: Backend (Laravel) + Frontend (React) + API endpoints
> **Ước tính**: ~480 dòng code, 4 phase, 5 file sửa, 2 file mới
> **Phụ thuộc**: Bảng `product_target_segments` đã có migration `2026_03_29_100000` (đã chạy)

---

## 1. Bối cảnh & Vấn đề

Bảng `product_target_segments` đã tồn tại và đang được `CustomerInsightService` sử dụng để xếp hạng gợi ý bán hàng theo segment (sector/facility_type/bed_capacity). Tuy nhiên **chưa có UI** để admin cấu hình dữ liệu — chỉ có thể nhập bằng tay vào DB.

### Hiện trạng

```
product_target_segments (đã tạo, schema sẵn)
├── product_id (FK → products)
├── customer_sector: HEALTHCARE | GOVERNMENT | INDIVIDUAL | OTHER
├── facility_type: PUBLIC_HOSPITAL | PRIVATE_HOSPITAL | MEDICAL_CENTER | PRIVATE_CLINIC | TYT_PKDK | OTHER | NULL
├── bed_capacity_min / bed_capacity_max (nullable — NULL = wildcard)
├── priority: 1-255 (1=cao nhất)
├── sales_notes: text (gợi ý cho sales)
├── is_active: boolean
├── created_by / updated_by (FK → users)
└── soft deletes
```

### Mục tiêu

Cho phép admin (permission `products.write`) quản lý target segments **ngay trong trang sản phẩm** — xem, thêm, sửa, xóa segment mapping cho từng sản phẩm. Không cần trang riêng — gắn vào flow sản phẩm hiện có.

### Quyết định kiến trúc: Standalone modal mở từ ProductList (App-level orchestration)

**Lý do KHÔNG thêm tab vào ProductFormModal:**
- `ProductFormModal` (681 dòng) hiện không có tabs, chỉ là form đơn tuyến tính (4 sections). Thêm tab vào đây phải refactor toàn bộ layout, thay đổi `ModalWrapper` usage, và chạm vào protected file.
- Mẫu tiền lệ: `ProductFeatureCatalogModal` (2,458 dòng) là modal riêng biệt, quản lý sub-entity (groups + features) độc lập khỏi ProductForm. Pattern này đã proven và user đã quen.

**Giải pháp**: Tạo `ProductTargetSegmentModal` — modal standalone, mở qua **App-level modal orchestration** (modalType + selectedProduct), giống chính xác pattern `PRODUCT_FEATURE_CATALOG`:
- `ProductList.tsx` gọi `onOpenModal('PRODUCT_TARGET_SEGMENT', product)`
- `App.tsx` render `<ProductTargetSegmentModal>` khi `modalType === 'PRODUCT_TARGET_SEGMENT'`
- Pattern đã kiểm chứng: App.tsx line 1531

---

## 2. Thiết kế tổng quan — 4 Phase

| Phase | Nội dung | File ảnh hưởng | Effort |
|-------|----------|----------------|--------|
| **0** | Backend: Service + Controller endpoints (index + bulkSync) | 1 file mới, 2 file sửa | ~160 lines |
| **1** | Frontend: Types + API functions | 2 file sửa | ~50 lines |
| **2** | Frontend: `ProductTargetSegmentModal` component | 1 file mới | ~280 lines |
| **3** | Frontend: Tích hợp vào `ProductList` + `App.tsx` modal registry | 2 file sửa | ~20 lines |

---

## 3. Phase 0: Backend — Service + Controller (2 endpoints only)

**Scope giới hạn**: Chỉ 2 endpoints: `index` (read) + `bulkSync` (write). Không tạo individual store/update/destroy vì frontend chỉ dùng fetch + sync (modal save-all-at-once). Nếu tương lai cần row-level API cho non-UI consumers thì bổ sung sau.

### 3.1 Tạo file mới: `ProductTargetSegmentDomainService.php`

**File**: `backend/app/Services/V5/Domain/ProductTargetSegmentDomainService.php`

Pattern theo `ProductFeatureCatalogDomainService` — thin methods, schema guards, audit logging.

```php
class ProductTargetSegmentDomainService
{
    private const TABLE = 'product_target_segments';
    private const SECTOR_VALUES = ['HEALTHCARE', 'GOVERNMENT', 'INDIVIDUAL', 'OTHER'];
    private const FACILITY_TYPE_VALUES = [
        'PUBLIC_HOSPITAL', 'PRIVATE_HOSPITAL', 'MEDICAL_CENTER',
        'PRIVATE_CLINIC', 'TYT_PKDK', 'OTHER',
    ];
    private const MAX_PRIORITY = 255;
    private const MAX_SEGMENTS_PER_PRODUCT = 20;

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
        private readonly CustomerInsightService $insightService,
    ) {}
```

#### 3.1a `index(Request $request, int $productId): JsonResponse`

Trả danh sách segments của 1 sản phẩm.

```php
public function index(Request $request, int $productId): JsonResponse
{
    if (! $this->support->hasTable(self::TABLE)) {
        return response()->json(['data' => [], 'meta' => ['table_available' => false]]);
    }

    // Verify product exists (scoped by deleted_at)
    $product = $this->findActiveProduct($productId);
    if ($product === null) {
        return response()->json(['message' => 'Product not found.'], 404);
    }

    $rows = DB::table(self::TABLE)
        ->where('product_id', $productId)
        ->whereNull('deleted_at')
        ->orderBy('priority')
        ->orderBy('customer_sector')
        ->orderBy('id')
        ->select([
            'id', 'uuid', 'product_id', 'customer_sector', 'facility_type',
            'bed_capacity_min', 'bed_capacity_max', 'priority',
            'sales_notes', 'is_active', 'created_at', 'updated_at',
            'created_by', 'updated_by',
        ])
        ->get();

    return response()->json(['data' => $rows, 'meta' => ['table_available' => true]]);
}
```

**meta.table_available**: Frontend dùng để disable nút Save khi bảng chưa migrate (graceful degradation cho writers).

#### 3.1b `bulkSync(Request $request, int $productId): JsonResponse`

Batch sync toàn bộ segments cho 1 product — transactional replace-all pattern.

```php
public function bulkSync(Request $request, int $productId): JsonResponse
{
    // ─── Schema guard: write unavailable when table missing ───
    if (! $this->support->hasTable(self::TABLE)) {
        return response()->json([
            'message' => 'Target segments table is not available in this environment.',
        ], 503);
    }

    // ─── Product existence guard ───
    $product = $this->findActiveProduct($productId);
    if ($product === null) {
        return response()->json(['message' => 'Product not found.'], 404);
    }

    // ─── Validate input array ───
    // Input: { segments: [...] }
    $validated = $request->validate([
        'segments'                       => ['present', 'array', 'max:' . self::MAX_SEGMENTS_PER_PRODUCT],
        'segments.*.customer_sector'     => ['required', 'string', Rule::in(self::SECTOR_VALUES)],
        'segments.*.facility_type'       => ['nullable', 'string', Rule::in(self::FACILITY_TYPE_VALUES)],
        'segments.*.bed_capacity_min'    => ['nullable', 'integer', 'min:0'],
        'segments.*.bed_capacity_max'    => ['nullable', 'integer', 'min:0'],
        'segments.*.priority'            => ['nullable', 'integer', 'min:1', 'max:' . self::MAX_PRIORITY],
        'segments.*.sales_notes'         => ['nullable', 'string', 'max:2000'],
        'segments.*.is_active'           => ['nullable', 'boolean'],
    ]);
    // Cross-field: min <= max, facility_type only when HEALTHCARE
    // (custom validation logic after $request->validate())

    // ─── Resolve authenticated actor ───
    $actorId = $request->user()?->id;

    // ─── Transactional replace-all ───
    // Capture before-state for audit BEFORE starting transaction
    $beforeSnapshot = DB::table(self::TABLE)
        ->where('product_id', $productId)
        ->whereNull('deleted_at')
        ->get()
        ->toArray();

    $newRows = DB::transaction(function () use ($productId, $validated, $actorId) {
        // 1. Soft-delete all existing segments for this product
        DB::table(self::TABLE)
            ->where('product_id', $productId)
            ->whereNull('deleted_at')
            ->update(['deleted_at' => now(), 'updated_by' => $actorId]);

        // 2. Insert all new rows
        $insertedIds = [];
        foreach ($validated['segments'] as $seg) {
            $insertedIds[] = DB::table(self::TABLE)->insertGetId([
                'uuid'             => Str::uuid()->toString(),
                'product_id'       => $productId,
                'customer_sector'  => $seg['customer_sector'],
                'facility_type'    => $seg['facility_type'] ?? null,
                'bed_capacity_min' => $seg['bed_capacity_min'] ?? null,
                'bed_capacity_max' => $seg['bed_capacity_max'] ?? null,
                'priority'         => $seg['priority'] ?? 1,
                'sales_notes'      => $seg['sales_notes'] ?? null,
                'is_active'        => $seg['is_active'] ?? true,
                'created_by'       => $actorId,
                'updated_by'       => $actorId,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);
        }

        return $insertedIds;
    });

    // ─── Post-commit: audit + cache ───
    $afterSnapshot = DB::table(self::TABLE)
        ->where('product_id', $productId)
        ->whereNull('deleted_at')
        ->get()
        ->toArray();

    // Use existing audit contract: event='UPDATE', positional args
    // (V5AccessAuditService only supports INSERT|UPDATE|DELETE|RESTORE)
    $this->accessAudit->recordAuditEvent(
        $request,
        'UPDATE',                          // event code (string, not named param)
        'product_target_segments',         // auditableType
        $productId,                        // auditableId (product being configured)
        ['segments' => $beforeSnapshot],   // oldValues
        ['segments' => $afterSnapshot],    // newValues
    );

    $this->insightService->invalidateAllInsightCaches();

    // ─── Return updated list ───
    $rows = DB::table(self::TABLE)
        ->where('product_id', $productId)
        ->whereNull('deleted_at')
        ->orderBy('priority')
        ->orderBy('customer_sector')
        ->orderBy('id')
        ->get();

    return response()->json(['data' => $rows]);
}
```

**Key guarantees (ISSUE-1 fix)**:
- Entire delete+insert wrapped in `DB::transaction()` — rollback on any failure
- Validation completes BEFORE mutation starts
- Audit + cache invalidation happen AFTER transaction commits (not inside)

**Audit strategy (ISSUE-5, ISSUE-8 fix)**: Single `UPDATE` event per save, with before/after snapshots of the full segment list for the product. Không tạo N delete + N insert events (noisy).

**Product guard (ISSUE-3 fix)**: `findActiveProduct($productId)` called at top of bulkSync, returns 404 if product doesn't exist or is soft-deleted.

**Schema guard for writes (ISSUE-4 fix)**: Returns HTTP 503 when table missing, không 200 empty — đảm bảo frontend biết write path unavailable.

### 3.2 Sửa file: `ProductController.php`

Thêm DI + 2 thin methods (ISSUE-6 fix: chỉ index + sync, không individual CRUD):

```php
class ProductController extends V5BaseController
{
    public function __construct(
        // ... existing deps ...
        private readonly ProductTargetSegmentDomainService $targetSegmentService,  // NEW
    ) { ... }

    // NEW methods (2 only):
    public function targetSegments(Request $request, int $id): JsonResponse
    {
        return $this->targetSegmentService->index($request, $id);
    }

    public function syncTargetSegments(Request $request, int $id): JsonResponse
    {
        return $this->targetSegmentService->bulkSync($request, $id);
    }
}
```

### 3.3 Sửa file: `routes/api/master-data.php`

Thêm 2 routes sau block `/products/{id}/feature-catalog` (ISSUE-6 fix: chỉ 2 routes):

```php
Route::get('/products/{id}/target-segments', [ProductController::class, 'targetSegments'])
    ->middleware('permission:products.read');
Route::put('/products/{id}/target-segments-sync', [ProductController::class, 'syncTargetSegments'])
    ->middleware('permission:products.write');
```

### 3.4 Cache Invalidation

`bulkSync` gọi (after transaction commit):
```php
$this->insightService->invalidateAllInsightCaches();
```

Đây là pattern đã dùng trong `ProductFeatureCatalogDomainService` khi feature catalog thay đổi. Không cần `Cache::forget('v5:products:list:v1')` vì product list cache không chứa segment data.

### 3.5 Audit Logging

`bulkSync` ghi 1 audit event sử dụng **contract hiện có** của `V5AccessAuditService::recordAuditEvent()`:

```php
$this->accessAudit->recordAuditEvent(
    $request,                          // Request (positional arg 1)
    'UPDATE',                          // event: string — must be INSERT|UPDATE|DELETE|RESTORE
    'product_target_segments',         // auditableType: string
    $productId,                        // auditableId: int|string|null (product being configured)
    ['segments' => $beforeSnapshot],   // oldValues: ?array
    ['segments' => $afterSnapshot],    // newValues: ?array
);
```

- Event dùng `'UPDATE'` (không phải BULK_SYNC) vì audit service chỉ hỗ trợ 4 event codes: `INSERT|UPDATE|DELETE|RESTORE` (xem `V5AccessAuditService.php` line 102)
- Positional arguments — **không dùng named parameters** (compatible with PHP 8.0+ call site)
- Before/after snapshot ghi full segment list cho product — readable audit trail

---

## 4. Phase 1: Frontend Types + API

### 4.1 Thêm interface — `frontend/types/product.ts`

```typescript
export interface ProductTargetSegment {
  id: number | string;
  uuid: string;
  product_id: number | string;
  customer_sector: 'HEALTHCARE' | 'GOVERNMENT' | 'INDIVIDUAL' | 'OTHER';
  facility_type: string | null;
  bed_capacity_min: number | null;
  bed_capacity_max: number | null;
  priority: number;
  sales_notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by: number | string | null;
  updated_by: number | string | null;
}
```

### 4.2 Thêm API functions — `frontend/services/api/productApi.ts`

```typescript
export const fetchProductTargetSegments = async (
  productId: string | number,
): Promise<{ data: ProductTargetSegment[]; meta: { table_available: boolean } }> => {
  const res = await apiFetch(`/api/v5/products/${productId}/target-segments`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'FETCH_PRODUCT_TARGET_SEGMENTS_FAILED'));
  }

  return res.json();
};

export const syncProductTargetSegments = async (
  productId: string | number,
  segments: Partial<ProductTargetSegment>[],
): Promise<{ data: ProductTargetSegment[] }> => {
  const res = await apiFetch(`/api/v5/products/${productId}/target-segments-sync`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ segments }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SYNC_PRODUCT_TARGET_SEGMENTS_FAILED'));
  }

  // Return raw wrapper { data: [...] } — do NOT use parseItemJson (which unwraps .data)
  return res.json();
};
```

**Follows existing `productApi.ts` conventions** (cf. `updateProductFeatureCatalog`):
- `credentials: 'include'` — Sanctum cookie auth
- `JSON_HEADERS` / `JSON_ACCEPT_HEADER` — from `_infra.ts`
- `!res.ok` → `parseErrorMessage()` → `throw Error` — modal error path catches correctly
- `parseItemJson()` for typed response parsing

---

## 5. Phase 2: Frontend — `ProductTargetSegmentModal`

### 5.1 Tạo file mới: `frontend/components/ProductTargetSegmentModal.tsx`

**~280 lines**. Pattern theo `ProductFeatureCatalogModal` nhưng đơn giản hơn nhiều (flat list, không có groups/trees).

### 5.2 Props

```typescript
interface ProductTargetSegmentModalProps {
  product: Product;
  canManage: boolean;   // from hasPermission(authUser, 'products.write')
  onClose: () => void;
  onNotify: NotifyFn;   // toast notification function (from App.tsx)
}
```

**Props match FeatureCatalog pattern**: `product`, `canManage`, `onClose`, `onNotify` — identical to `ProductFeatureCatalogModal` props.

### 5.3 Layout wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Cấu hình đề xuất bán hàng — [Tên SP]                  │
│  [Mô tả ngắn: Sản phẩm này sẽ được gợi ý cho...]          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ # │ Lĩnh vực  │ Loại hình    │ Giường (Min-Max) │ Ưu   ││
│  │   │           │              │                  │ tiên  ││
│  │───│───────────│──────────────│──────────────────│───────││
│  │ 1 │ Y tế [▼]  │ BV Công [▼]  │ 200 — ∞          │ 1     ││
│  │   │ 📝 Phù hợp BV công quy mô lớn, tích hợp BHYT     ││
│  │   │                                          [🗑️ Xóa]  ││
│  │───│─────────────────────────────────────────────────────││
│  │ 2 │ Y tế [▼]  │ PK Tư nhân ▼│ — — 200            │ 2    ││
│  │   │ 📝 Gọn nhẹ cho phòng khám tư nhân                  ││
│  │   │                                          [🗑️ Xóa]  ││
│  │───│─────────────────────────────────────────────────────││
│  │ 3 │ Chính quyền│ Tất cả      │ — — —             │ 1    ││
│  │   │ 📝 Cổng DVC cho cơ quan nhà nước                    ││
│  │   │                                          [🗑️ Xóa]  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  [+ Thêm segment]                                            │
│                                                              │
│  ┌─────────────────────────┐ ┌──────────────────────────────┐│
│  │ ❌ Hủy                  │ │ ✅ Lưu thay đổi              ││
│  └─────────────────────────┘ └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Các sub-component nội bộ (trong cùng file)

#### `SegmentRow` — 1 row editable

```typescript
function SegmentRow({
  segment,         // DraftSegment
  index,           // number (STT)
  showFacilityType, // boolean — chỉ hiện khi sector = HEALTHCARE
  onUpdate,        // (field, value) => void
  onRemove,        // () => void
  disabled,        // boolean — khi canManage=false hoặc saving
}: SegmentRowProps)
```

Fields mỗi row:
1. **Lĩnh vực KH** (`customer_sector`) — `<select>` dùng `CUSTOMER_SECTOR_OPTIONS` từ `customerClassification.ts`
2. **Loại hình** (`facility_type`) — `<select>` dùng `HEALTHCARE_FACILITY_TYPE_OPTIONS`, chỉ hiện khi sector = `HEALTHCARE`. Tùy chọn đầu: "Tất cả loại hình" (= null)
3. **Giường bệnh tối thiểu** (`bed_capacity_min`) — `<input type="number">`, placeholder "Không giới hạn"
4. **Giường bệnh tối đa** (`bed_capacity_max`) — `<input type="number">`, placeholder "Không giới hạn"
5. **Mức ưu tiên** (`priority`) — `<input type="number" min="1" max="255">`, default 1
6. **Ghi chú bán hàng** (`sales_notes`) — `<textarea rows="2">`, placeholder "Gợi ý cho nhân viên bán hàng khi tư vấn SP này cho segment khách hàng này"
7. **Trạng thái** (`is_active`) — toggle/checkbox
8. **Nút Xóa** — icon button, xóa row khỏi draft

#### Conditional logic:
- Khi `customer_sector` thay đổi sang non-HEALTHCARE → tự clear `facility_type`, `bed_capacity_min`, `bed_capacity_max`
- `bed_capacity_min`/`bed_capacity_max` chỉ hiện khi sector = `HEALTHCARE`

### 5.5 State management

```typescript
type DraftSegment = {
  _tempId: string;                // UUID tạm cho React key
  id?: number | string | null;    // null = new row
  customer_sector: string;
  facility_type: string | null;
  bed_capacity_min: number | null;
  bed_capacity_max: number | null;
  priority: number;
  sales_notes: string;
  is_active: boolean;
};

const [segments, setSegments] = useState<DraftSegment[]>([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [tableAvailable, setTableAvailable] = useState(true); // from meta.table_available
```

#### Load flow:
1. `useEffect` on mount → `fetchProductTargetSegments(product.id)` → map to `DraftSegment[]` (add `_tempId`)
2. Set `tableAvailable` from `meta.table_available`
3. Error → hiện retry button

#### Save flow:
1. Guard: if `!tableAvailable` → button disabled, show info message
2. Frontend validation:
   - Mỗi row phải có `customer_sector` (required)
   - Nếu `bed_capacity_min` && `bed_capacity_max` → min ≤ max
   - Không cho phép duplicate (cùng sector + facility_type + bed range)
3. `syncProductTargetSegments(product.id, segments)` → replace all
4. Success → `onNotify('success', ...)` + `onClose()`
5. Error → `onNotify('error', ...)`, keep modal open

### 5.6 Empty state

Khi chưa có segment nào:
```
┌─────────────────────────────────────────────┐
│  🎯 Chưa cấu hình đề xuất                  │
│  Sản phẩm này chưa được gắn với segment    │
│  khách hàng nào. Thêm segment để hệ thống  │
│  gợi ý SP này cho đúng đối tượng.           │
│                                              │
│  [+ Thêm segment đầu tiên]                  │
└─────────────────────────────────────────────┘
```

### 5.7 Unavailable state (ISSUE-4 fix: missing-table degradation for writers)

Khi `tableAvailable === false`:
```
┌─────────────────────────────────────────────┐
│  ⚠️ Tính năng chưa sẵn sàng                │
│  Bảng dữ liệu đề xuất bán hàng chưa được  │
│  tạo trong môi trường này. Vui lòng chạy   │
│  migration trước khi sử dụng.               │
│                                              │
│  [Đóng]                                      │
└─────────────────────────────────────────────┘
```

- "Thêm segment" button hidden
- "Lưu thay đổi" button disabled with tooltip: "Tính năng chưa sẵn sàng"

### 5.8 Validation errors inline

```
┌──────────────────────────────────────────┐
│ # │ Lĩnh vực   │ ...                     │
│ 1 │ [Chọn ▼]   │                         │
│   │ ⚠️ Vui lòng chọn lĩnh vực           │
│───│────────────│─────────────────────────│
│ 2 │ Y tế       │ Giường: 500 — 200       │
│   │            │ ⚠️ Tối thiểu ≤ tối đa   │
└──────────────────────────────────────────┘
```

---

## 6. Phase 3: Tích hợp vào `ProductList` + `App.tsx` (App-level modal)

### 6.1 Sửa file: `frontend/components/ProductList.tsx` (ISSUE-2 fix)

Thêm nút "Cấu hình đề xuất" vào mỗi row sản phẩm, cạnh nút "Danh mục chức năng" hiện có. Dùng **cùng `onOpenModal` callback** từ App.tsx:

```typescript
// Trong action buttons của mỗi product row (cạnh PRODUCT_FEATURE_CATALOG button):
<button
  onClick={() => onOpenModal('PRODUCT_TARGET_SEGMENT', item)}
  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
  title="Cấu hình đề xuất bán hàng"
>
  <span className="material-symbols-outlined text-lg">target</span>
</button>
```

**Không cần local state trong ProductList** — `onOpenModal` đã handle modal lifecycle ở App.tsx.

### 6.2 Sửa file: `frontend/App.tsx`

Thêm vào modal registry (cạnh dòng `PRODUCT_FEATURE_CATALOG`):

```typescript
// Import (lazy):
const ProductTargetSegmentModal = React.lazy(() => import('./components/ProductTargetSegmentModal'));

// Trong modal render block (sau dòng PRODUCT_FEATURE_CATALOG):
{modalType === 'PRODUCT_TARGET_SEGMENT' && selectedProduct && (
  <ProductTargetSegmentModal
    product={selectedProduct}
    canManage={hasPermission(authUser, 'products.write')}
    onClose={() => setModalType(null)}
    onNotify={addToast}
  />
)}
```

**Thêm `'PRODUCT_TARGET_SEGMENT'` vào `ModalType` union type.** File sửa: `frontend/types/legacy.ts` hoặc nơi ModalType được định nghĩa.

### 6.3 Permission guard

Nút trong ProductList chỉ hiện khi user có `products.write` — kiểm tra bằng `canEdit` prop (đã available trong ProductList row, giống nút edit/delete).

---

## 7. Tổng hợp file thay đổi

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `backend/app/Services/V5/Domain/ProductTargetSegmentDomainService.php` | **CREATE** | ~140 |
| 2 | `backend/app/Http/Controllers/Api/V5/ProductController.php` | MODIFY | +15 |
| 3 | `backend/routes/api/master-data.php` | MODIFY | +3 |
| 4 | `frontend/types/product.ts` | MODIFY | +20 |
| 5 | `frontend/services/api/productApi.ts` | MODIFY | +20 |
| 6 | `frontend/components/ProductTargetSegmentModal.tsx` | **CREATE** | ~280 |
| 7 | `frontend/components/ProductList.tsx` | MODIFY | +8 |
| 8 | `frontend/App.tsx` | MODIFY | +5 (modal registry) |

**Tổng**: ~480 dòng. **2 file mới, 6 file sửa.**

---

## 8. Kiểm tra & Xác nhận

### 8.1 Backend tests (PHPUnit)

| # | Test case | Expected | Acceptance criteria |
|---|-----------|----------|-------------------|
| T1 | `testTargetSegmentsIndexReturnsSegments` — product có 3 segments | 3 items sorted by priority, `meta.table_available: true` | AC-1 |
| T2 | `testTargetSegmentsIndexReturnsEmptyWhenTableMissing` | `{ data: [], meta: { table_available: false } }`, 200 | AC-6 |
| T3 | `testBulkSyncReplacesAllTransactionally` — 2 existing → sync 3 new | 2 soft-deleted, 3 created, all within transaction | AC-3 |
| T4 | `testBulkSyncValidatesRequiredSector` — segment without sector | 422, validation error | AC-7 |
| T5 | `testBulkSyncValidatesMinMaxBedCapacity` — min > max | 422, "min ≤ max" error | AC-7 |
| T6 | `testBulkSyncFacilityTypeRequiresHealthcareSector` — GOVERNMENT + PUBLIC_HOSPITAL | 422 | AC-7 |
| T7 | `testBulkSyncReturns503WhenTableMissing` | HTTP 503, write unavailable | AC-6 |
| T8 | `testBulkSyncVerifiesProductExists` — nonexistent product ID | HTTP 404 | AC-3 |
| T9 | `testBulkSyncEmitsAuditEvent` | Single UPDATE audit event with before/after snapshots in audit_logs | AC-5 |
| T10 | `testBulkSyncInvalidatesInsightCache` | `invalidateAllInsightCaches()` called | AC-4 |
| T11 | `testBulkSyncRollsBackOnInsertFailure` | No segments deleted after insert failure | AC-3 |
| T12 | `testBulkSyncMaxSegmentsLimit` — 21 segments | 422, max 20 | AC-7 |

### 8.2 Frontend unit tests (Vitest)

| # | Test case | Expected | Acceptance criteria |
|---|-----------|----------|-------------------|
| F1 | `testModalRendersExistingSegments` | Segment rows rendered | AC-1 |
| F2 | `testAddSegmentRow` — click "Thêm segment" | New empty row added | AC-2 |
| F3 | `testRemoveSegmentRow` — click Xóa | Row removed from list | AC-2 |
| F4 | `testSectorChangeHidesFacilityType` — HEALTHCARE → GOVERNMENT | facility_type + bed fields hidden | AC-2 |
| F5 | `testValidationShowsInlineErrors` — save with empty sector | Error message shown | AC-7 |
| F6 | `testDuplicateSegmentValidation` — 2 identical rows | Warning shown | AC-7 |
| F7 | `testSaveCallsSyncApi` — save with valid data | `syncProductTargetSegments` called | AC-3 |
| F8 | `testUnavailableStateWhenTableMissing` — `meta.table_available: false` | Save button disabled, info message shown | AC-6 |
| F9 | `testButtonHiddenForReadOnlyUser` — `canManage: false` | Add/Save/Delete buttons hidden | AC-8 |

### 8.3 Manual verification

1. `cd backend && php artisan test --filter=ProductTargetSegment`
2. `cd frontend && npx vitest run __tests__/productTargetSegment.test.ts`
3. `cd frontend && npm run lint`
4. Mở ProductList → click nút "🎯" → modal hiện → thêm/sửa/xóa segments → Save → verify DB
5. Mở Customer Insight Panel → Gợi ý bán hàng → verify targeted suggestions thay đổi theo segments mới
6. Test với user không có `products.write` → nút ẩn
7. Drop bảng `product_target_segments` → modal hiện thông báo "chưa sẵn sàng", Save disabled

---

## 9. Rủi ro & Giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|--------|--------|------------|
| Bảng `product_target_segments` chưa migrate | Thấp | Read → trả `meta.table_available: false`, Write → 503. UI disable save, show info message |
| User tạo duplicate segments | Trung bình | Frontend validation trước save: warn duplicate, highlight conflicting rows |
| bulkSync fail giữa chừng | Thấp | `DB::transaction()` — rollback toàn bộ, segments giữ nguyên trạng thái cũ |
| Performance: nhiều segments per product | Thấp | Giới hạn tối đa 20 segments per product trong validation |
| App.tsx modification (protected file) | Thấp | Chỉ thêm 3 dòng (import + render conditional), minimal risk, pattern identical to existing |

---

## 10. Design Decisions Log

| # | Quyết định | Lý do | Thay thế đã xem xét |
|---|-----------|-------|---------------------|
| D1 | Standalone modal (không tab trong ProductForm) | Giữ ProductFormModal đơn giản (protected file), pattern giống FeatureCatalog | Thêm tab vào ProductForm — rejected vì refactor lớn |
| D2 | bulkSync thay vì individual CRUD | Modal save-all-at-once UX, giảm API surface + validation + test scope | Individual store/update/destroy — rejected vì unnecessary scope expansion (ISSUE-6) |
| D3 | Reuse `CUSTOMER_SECTOR_OPTIONS` + `HEALTHCARE_FACILITY_TYPE_OPTIONS` từ `customerClassification.ts` | DRY, đảm bảo values khớp Customer form và segment matching | Hardcode options — rejected vì inconsistency |
| D4 | Sector=HEALTHCARE mới hiện facility_type + bed fields | Facility_type và bed_capacity chỉ có nghĩa cho Y tế, tránh confusion | Luôn hiện tất cả fields — rejected vì noise |
| D5 | App-level modal orchestration (App.tsx render + onOpenModal) | Chính xác pattern ProductFeatureCatalogModal (App.tsx:1531), đã proven | Local state trong ProductList — rejected vì vi phạm existing pattern (ISSUE-2) |
| D6 | `DB::transaction()` cho bulkSync | Đảm bảo atomicity: delete+insert hoặc cả hai rollback | No transaction — rejected vì risk mất data (ISSUE-1) |
| D7 | Single UPDATE audit event (before/after snapshot) | Readable audit trail, không flood log. Dùng `'UPDATE'` event code vì audit service chỉ hỗ trợ INSERT/UPDATE/DELETE/RESTORE (ISSUE-5, ISSUE-8) | BULK_SYNC custom event — rejected vì audit service không support |
| D8 | `meta.table_available` + 503 for writes | Writer degradation: UI disable save khi bảng chưa migrate | Button hidden — rejected vì user confused (ISSUE-4) |

---

## 11. Codex Plan Review — Peer Debate Log

> **Thread ID**: `019d3be1-1ac9-7770-96ed-11b77a276743`
> **Ngày review**: 2026-03-30
> **Effort level**: xhigh (5 rounds max)

### Round 1 — 7 issues found

| # | Title | Category | Severity | Verdict | Fix Applied |
|---|-------|----------|----------|---------|-------------|
| ISSUE-1 | `bulkSync` lacks transaction boundaries | correctness | critical | **Accept** | Added `DB::transaction()` wrapper, validation before mutation, audit+cache after commit (§3.1b) |
| ISSUE-2 | UI flow doesn't follow FeatureCatalog pattern | architecture | high | **Accept** | Switched to App-level modal orchestration: `onOpenModal('PRODUCT_TARGET_SEGMENT')` from ProductList, rendered in App.tsx (§6.1-6.2) |
| ISSUE-3 | Mutation missing product/ownership guards | correctness | high | **Accept** | Added `findActiveProduct()` guard at top of bulkSync, 404 for nonexistent product (§3.1b) |
| ISSUE-4 | Graceful degradation only for read, not write | risk | high | **Accept** | Read: `meta.table_available: false`. Write: HTTP 503. UI: Save disabled + info message (§3.1b, §5.7) |
| ISSUE-5 | Audit behavior for bulkSync under-specified | correctness | medium | **Accept** | Single UPDATE event with before/after snapshots, emitted after commit (§3.1b, §3.5) |
| ISSUE-6 | Scope creep: individual CRUD not needed | scope | medium | **Accept** | Trimmed to index + bulkSync only. 2 routes, 2 controller methods (§3.2, §3.3) |
| ISSUE-7 | Test matrix gaps | sequencing | medium | **Accept** | Expanded: T1-T12 backend (audit, permission, transaction rollback, table missing, max limit) + F1-F9 frontend (unavailable state, permission guard, duplicate validation) (§8) |

### Round 2 — 2 issues found

| # | Title | Category | Severity | Verdict | Fix Applied |
|---|-------|----------|----------|---------|-------------|
| ISSUE-8 | `BULK_SYNC` audit call incompatible with audit service | correctness | critical | **Accept** | Changed to `'UPDATE'` event code with positional args matching `recordAuditEvent()` signature. No BULK_SYNC custom event (§3.1b, §3.5) |
| ISSUE-9 | API functions don't follow existing request/error conventions | correctness | high | **Accept** | Added `JSON_HEADERS`, `credentials: 'include'`, `!res.ok` + `parseErrorMessage()`, `parseItemJson()` — matching `productApi.ts` conventions (§4.2) |

### Round 3 — 3 issues found

| # | Title | Category | Severity | Verdict | Fix Applied |
|---|-------|----------|----------|---------|-------------|
| ISSUE-10 | Audit event naming inconsistent across plan | sequencing | medium | **Accept** | Normalized all BULK_SYNC references to UPDATE: §3.1b key guarantees, T9 test case (§8.1) |
| ISSUE-11 | syncProductTargetSegments response contract mismatch | correctness | medium | **Accept** | Changed from `parseItemJson<{data:...}>` (unwraps) to `res.json()` (returns raw wrapper) — consistent return type (§4.2) |
| ISSUE-12 | bulkSync missing validation/actor resolution steps | correctness | medium | **Accept** | Added explicit `$validated = $request->validate(...)` and `$actorId = $request->user()?->id` before transaction (§3.1b) |

### Round 4 — APPROVED ✅

No new issues. All 12 issues verified resolved. Plan approved against all 8 acceptance criteria.
