# Plan: Hạng mục hợp đồng (`contract_items`) + Cải tiến ContractModal

## Context

ContractModal hiện có bảng **"Hạng mục dự án" read-only** (dòng 1591-1679 ContractModal.tsx) — chỉ hiển thị hạng mục của `project_items`, user không thể sửa SL/đơn giá riêng cho hợp đồng. Vấn đề: mỗi hợp đồng có thể có giá/SL thương mại khác dự án gốc (ví dụ: chiết khấu, thêm hạng mục phụ trội).

**Giải pháp:** Tạo bảng `contract_items` riêng. Khi tạo HĐ mới, copy hạng mục từ `project_items` làm draft. User sửa thoải mái trên draft, rồi save cùng contract trong 1 request.

**Tại sao không sửa trực tiếp `project_items`:** Sửa hạng mục dự án từ modal hợp đồng sẽ ảnh hưởng dự án gốc + các hợp đồng khác cùng dự án. Tách dữ liệu = an toàn.

---

## Tổng hợp files (12 files)

| # | File | Hành động |
|---|------|-----------|
| 1 | `backend/database/migrations/..._create_contract_items_table.php` | **TẠO MỚI** |
| 2 | `backend/database/migrations/..._add_unit_to_products.php` | **TẠO MỚI** |
| 3 | `backend/app/Models/ContractItem.php` | **TẠO MỚI** |
| 4 | `backend/app/Models/Contract.php` | Thêm `items()` HasMany |
| 5 | `backend/app/Http/Controllers/Api/V5/ContractController.php` | Thêm `show()` |
| 6 | `backend/routes/api.php` | Thêm `GET /contracts/{id}` |
| 7 | `backend/app/Services/V5/Domain/ContractDomainService.php` | Thêm `show()`, `syncContractItems()`, gọi trong store/update |
| 8 | `backend/app/Services/V5/V5DomainSupportService.php` | `serializeContract()` thêm items |
| 9 | `frontend/types.ts` | Thêm `ContractItem`, bổ sung `items?` vào Contract |
| 10 | `frontend/services/v5Api.ts` | Thêm `fetchContractDetail()`, sửa create/update gửi items |
| 11 | `frontend/components/ContractModal.tsx` | UI bảng hạng mục HĐ + form width + draft CRUD + nút đồng bộ |
| 12 | `frontend/App.tsx` | Truyền `products`, fetch detail khi mở EDIT modal |

---

## CHI TIẾT TRIỂN KHAI

### 1. Migration — `contract_items` (TẠO MỚI)

```sql
CREATE TABLE contract_items (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id   BIGINT UNSIGNED NOT NULL,
  product_id    BIGINT UNSIGNED NOT NULL,
  quantity      DECIMAL(12,2)   NOT NULL DEFAULT 1.00,
  unit_price    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  created_by    BIGINT UNSIGNED NULL,
  updated_by    BIGINT UNSIGNED NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  -- KHÔNG dùng deleted_at: sync = hard-delete rồi re-insert (giống payment_schedules)
  UNIQUE KEY uq_ci_contract_product (contract_id, product_id),
  CONSTRAINT fk_ci_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_product  FOREIGN KEY (product_id)  REFERENCES products(id),
  INDEX idx_ci_contract (contract_id)
) COMMENT='Hạng mục chi tiết hợp đồng';
```

**Quyết định:**
- **Không SoftDeletes** — `syncContractItems()` hard-delete + re-insert, giống `payment_schedules` cũng không có `deleted_at`
- **UNIQUE (contract_id, product_id)** — chặn trùng SP ở DB level

### 2. Migration — `products.unit` (TẠO MỚI)

```php
Schema::table('products', function (Blueprint $table) {
    $table->string('unit', 50)->nullable()->after('standard_price')
          ->comment('Đơn vị tính (License, Tháng, Gói...)');
});
```

- DB `products` hiện **chưa có** cột `unit` (đã verify SQL dump)
- BE serializer `serializeProductRecord()` (V5MasterDataController dòng 15347) **đã sẵn sàng** output `unit`
- FE `Product` interface **đã có** `unit?: string | null`

### 3. Model `ContractItem.php` (TẠO MỚI)

```php
<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractItem extends Model
{
    protected $table = 'contract_items';
    // Không dùng SoftDeletes
    protected $fillable = ['contract_id','product_id','quantity','unit_price','created_by','updated_by'];
    protected $casts = ['quantity'=>'float','unit_price'=>'float'];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
```

### 4. Model `Contract.php` — Thêm relation

**File:** `backend/app/Models/Contract.php` — sau `project()` (dòng 49-52)

```php
use Illuminate\Database\Eloquent\Relations\HasMany;

public function items(): HasMany
{
    return $this->hasMany(ContractItem::class, 'contract_id');
}
```

### 5–6. Route + Controller — `GET /contracts/{id}` (show detail)

**Lý do cần route detail:**
- Hiện KHÔNG có route `GET /contracts/{id}` (routes/api.php dòng 334-342)
- `selectedContract` lấy trực tiếp từ list data (App.tsx dòng 3487)
- Nếu nhét `items.product` vào `index()` → payload list phình nhanh (mỗi contract kèm N items × product)
- **Pattern copy từ:** `ProjectController::show()` dòng 26-29 + `ProjectDomainService::show()` dòng 169-186

**File `routes/api.php`** — thêm sau dòng 334:
```php
Route::get('/contracts/{id}', [ContractController::class, 'show'])
    ->middleware('permission:contracts.read');
```

**File `ContractController.php`** — thêm method:
```php
public function show(Request $request, int $id): JsonResponse
{
    return $this->contractService->show($request, $id);
}
```

### 7. Service `ContractDomainService.php` — Thay đổi chính

#### 7a. Thêm `show()` method

```php
public function show(Request $request, int $id): JsonResponse
{
    if (! $this->support->hasTable('contracts')) {
        return $this->support->missingTable('contracts');
    }

    $query = Contract::query()
        ->with([
            'customer' => fn($q) => $q->select($this->support->customerRelationColumns()),
            'project'  => fn($q) => $q->select($this->support->projectRelationColumns()),
            'items'    => fn($q) => $q->with('product:id,product_code,product_name,unit'),
        ])
        ->whereKey($id);

    $this->applyReadScope($request, $query);
    $contract = $query->firstOrFail();

    return response()->json([
        'data' => $this->support->serializeContract($contract),
    ]);
}
```

#### 7b. Thêm validation rules cho items — trong `$rules` của cả `store()` (dòng 203-218) và `update()` (dòng 384-399)

```php
'items'              => ['sometimes', 'array'],
'items.*.product_id' => ['required', 'integer'],
'items.*.quantity'   => ['required', 'numeric', 'gt:0'],
'items.*.unit_price' => ['required', 'numeric', 'min:0'],
```

#### 7c. Guard trong `update()` — TRƯỚC `$contract->save()` (trước dòng 555)

```php
if ($request->has('items')) {
    // payment_schedules KHÔNG có deleted_at (đã verify SQL dump)
    $hasSchedules = $this->support->hasTable('payment_schedules')
        && DB::table('payment_schedules')
            ->where('contract_id', $contract->getKey())
            ->exists();
    if ($hasSchedules) {
        return response()->json([
            'message' => 'Không thể sửa hạng mục khi đã có kỳ thanh toán.',
        ], 422);
    }
}
```

#### 7d. Gọi sync SAU `$contract->save()` — trong cả `store()` (sau dòng 351) và `update()` (sau dòng 555)

```php
if ($request->has('items') && is_array($request->input('items'))) {
    $this->syncContractItems(
        (int) $contract->getKey(),
        $validated['items'] ?? [],
        $actorId
    );
}
```

#### 7e. Private method `syncContractItems()`

**Copy pattern từ `ProjectDomainService::syncProjectItems()`** (dòng 680-756), đổi `project_items` → `contract_items`, `project_id` → `contract_id`:

```php
private function syncContractItems(int $contractId, array $items, ?int $actorId): void
{
    if (! $this->support->hasTable('contract_items')) {
        throw ValidationException::withMessages([
            'items' => ['Hệ thống chưa hỗ trợ lưu hạng mục hợp đồng.'],
        ]);
    }

    foreach (['contract_id', 'product_id'] as $requiredColumn) {
        if (! $this->support->hasColumn('contract_items', $requiredColumn)) {
            throw ValidationException::withMessages([
                'items' => ["Bảng contract_items thiếu cột {$requiredColumn}."],
            ]);
        }
    }

    // Validate product_ids exist (copy pattern dòng 696-713)
    $productIds = collect($items)->pluck('product_id')->map(fn($id) => (int)$id)->unique()->values();
    if ($productIds->isNotEmpty()) {
        $existing = DB::table('products')->whereIn('id', $productIds->all())->pluck('id')->map(fn($id) => (int)$id)->all();
        $missing = array_values(array_diff($productIds->all(), $existing));
        if ($missing !== []) {
            throw ValidationException::withMessages([
                'items' => ['Không tìm thấy sản phẩm: '.implode(', ', $missing).'.'],
            ]);
        }
    }

    // Hard delete existing (giống dòng 716)
    DB::table('contract_items')->where('contract_id', $contractId)->delete();

    if ($items === []) {
        return;
    }

    // Bulk insert (giống dòng 722-755, đổi project_id → contract_id)
    $now = now();
    $rows = [];
    foreach ($items as $item) {
        $row = ['contract_id' => $contractId, 'product_id' => $item['product_id']];
        if ($this->support->hasColumn('contract_items', 'quantity'))   $row['quantity']   = $item['quantity'];
        if ($this->support->hasColumn('contract_items', 'unit_price')) $row['unit_price'] = $item['unit_price'];
        if ($this->support->hasColumn('contract_items', 'created_at')) $row['created_at'] = $now;
        if ($this->support->hasColumn('contract_items', 'updated_at')) $row['updated_at'] = $now;
        if ($actorId !== null && $this->support->hasColumn('contract_items', 'created_by')) $row['created_by'] = $actorId;
        if ($actorId !== null && $this->support->hasColumn('contract_items', 'updated_by')) $row['updated_by'] = $actorId;
        // KHÔNG set deleted_at vì bảng không có cột này
        $rows[] = $row;
    }
    DB::table('contract_items')->insert($rows);
}
```

#### 7f. Response — Eager load items

Trong return response của `store()` (dòng 362-368) và `update()` (dòng 565-572), thay `loadMissing`:

```php
// Trước:
$contract->loadMissing([
    'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
    'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
])
// Sau:
$contract->loadMissing([
    'customer' => fn ($query) => $query->select($this->support->customerRelationColumns()),
    'project' => fn ($query) => $query->select($this->support->projectRelationColumns()),
    'items' => fn ($query) => $query->with('product:id,product_code,product_name,unit'),
])
```

**LƯU Ý:** `index()` KHÔNG thêm items vào `with()` — giữ list response gọn.

### 8. Service `V5DomainSupportService.php` — `serializeContract()` kèm items

**File:** dòng 1291-1313. Thêm trước `return $data;` (dòng 1313):

```php
if ($contract->relationLoaded('items')) {
    $data['items'] = $contract->items->map(fn ($item) => [
        'id'           => $item->id,
        'contract_id'  => $item->contract_id,
        'product_id'   => $item->product_id,
        'product_code' => $item->product?->product_code,
        'product_name' => $item->product?->product_name,
        'unit'         => $item->product?->unit,
        'quantity'     => (float) $item->quantity,
        'unit_price'   => (float) $item->unit_price,
    ])->values()->all();
}
```

**Giải thích:** Chỉ khi `items` relation đã loaded mới serialize → `index()` không load items nên response list không chứa `items`, còn `show()`/`store()`/`update()` có load nên response có `items`.

### 9. Frontend — `types.ts`

#### 9a. Thêm `ContractItem` interface (gần Contract, ~dòng 1531)

```typescript
export interface ContractItem {
  id: string | number;
  contract_id: string | number;
  product_id: string | number;
  product_code?: string | null;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
}
```

#### 9b. Bổ sung vào `Contract` interface

```typescript
items?: ContractItem[];
```

#### 9c. Bổ sung vào `ProjectItemMaster` (sau `unit_price`)

```typescript
product_unit?: string | null;
```

### 10. Frontend — `v5Api.ts`

#### 10a. Thêm `fetchContractDetail()` (TẠO MỚI)

```typescript
export const fetchContractDetail = async (id: string | number): Promise<Contract> => {
  const res = await apiFetch(`/api/v5/contracts/${id}`, {
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'FETCH_CONTRACT_DETAIL_FAILED'));
  return parseItemJson<Contract>(res);
};
```

#### 10b. `createContract()` (dòng 3073-3089) — thêm `items` vào body

```typescript
body: JSON.stringify({
  ...existing fields...,
  items: payload.items,  // ← THÊM
}),
```

#### 10c. `updateContract()` (dòng 3107+) — tương tự

```typescript
body: JSON.stringify({
  ...existing fields...,
  items: payload.items,  // ← THÊM
}),
```

### 11. Frontend — `ContractModal.tsx` (thay đổi lớn nhất)

#### 11a. Form width — Dòng 1481

```typescript
// Trước:
isExpandedPaymentTab ? 'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]' : 'max-w-4xl max-h-[90vh]'
// Sau (luôn full-width):
'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]'
```

#### 11b. Import thêm

```typescript
import { ContractItem, Product } from '../types';
```

#### 11c. Props mới — Thêm vào `ContractModalProps` (dòng 27-47)

```typescript
products?: Product[];
```

#### 11d. State draft items

```typescript
const [draftItems, setDraftItems] = useState<ContractItem[]>([]);
```

**Khởi tạo** trong `useMemo initialFormData` hoặc `useEffect`:
- **EDIT**: `setDraftItems(data?.items || [])` — từ `fetchContractDetail` response
- **ADD khi chọn project**: copy từ `projectItems` prop (FE-only, KHÔNG cần BE flag `copy_project_items`)

#### 11e. Computed values

```typescript
const isItemsEditable = schedules.length === 0;
const draftItemsTotal = draftItems.reduce(
  (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0
);
const contractValue = parseCurrency(formData.value || 0);
const itemsMismatch = draftItems.length > 0 && Math.abs(draftItemsTotal - contractValue) > 0.5;
```

#### 11f. CRUD handlers (local draft, KHÔNG gọi API)

```typescript
const handleAddItem = () => {
  setDraftItems(prev => [...prev, {
    id: `temp-${Date.now()}`, contract_id: 0, product_id: 0,
    quantity: 1, unit_price: 0,
  }]);
};

const handleUpdateItem = (index: number, field: string, value: unknown) => {
  setDraftItems(prev => prev.map((item, i) =>
    i === index ? { ...item, [field]: value } : item
  ));
};

const handleRemoveItem = (index: number) => {
  setDraftItems(prev => prev.filter((_, i) => i !== index));
};

const handleSyncContractValue = () => {
  handleChange('value', draftItemsTotal);
};
```

#### 11g. Chọn sản phẩm → auto-fill

```typescript
const handleProductChange = (index: number, productId: string | number) => {
  const product = (products || []).find(p => String(p.id) === String(productId));
  setDraftItems(prev => prev.map((item, i) =>
    i === index ? {
      ...item,
      product_id: productId,
      product_code: product?.product_code || null,
      product_name: product?.product_name || null,
      unit: product?.unit || null,
      unit_price: item.unit_price === 0 && product?.standard_price
        ? product.standard_price : item.unit_price,
    } : item
  ));
};
```

#### 11h. Save — gửi items kèm contract (sửa `handleSave`, dòng 1374-1392)

```typescript
await Promise.resolve(
  onSave({
    ...formData,
    value: parseCurrency(formData.value || 0),
    term_unit: hasTermUnit ? (normalizedTermUnit as ContractTermUnit) : null,
    term_value: Number.isFinite(normalizedTermValue) ? normalizedTermValue : null,
    expiry_date_manual_override: expiryDateManualOverride,
    // ← THÊM:
    items: isItemsEditable && draftItems.some(i => i.product_id)
      ? draftItems.filter(i => i.product_id).map(i => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
      : undefined,
  })
);
```

#### 11i. Khi đổi `project_id` → copy hạng mục

Trong handler `handleChange` hoặc `applyProjectSelection` (dòng 808):
- Nếu draft **rỗng** hoặc tất cả `product_id === 0` → tự copy từ `projectItems`
- Nếu draft **đã có dữ liệu** → `window.confirm('Đổi dự án sẽ thay thế hạng mục hiện tại. Tiếp tục?')` trước khi overwrite

#### 11j. Validate trước sinh kỳ thanh toán (sửa `handleGenerateSchedules`, dòng 1412)

```typescript
// Thêm trước logic hiện tại:
if (draftItems.length === 0) {
  const ok = window.confirm('Chưa có hạng mục hợp đồng. Bạn có chắc muốn sinh kỳ thanh toán?');
  if (!ok) return;
}
if (itemsMismatch) {
  const ok = window.confirm(
    `Tổng hạng mục (${formatCurrency(draftItemsTotal)}) đang lệch Giá trị HĐ (${formatCurrency(contractValue)}). Tiếp tục?`
  );
  if (!ok) return;
}
```

#### 11k. UI bảng "Hạng mục hợp đồng" — VỊ TRÍ & LAYOUT

**Vị trí:** SAU bảng "Hạng mục dự án" read-only (dòng 1679), TRƯỚC block Trạng thái (dòng 1688).

**Bảng "Hạng mục dự án" hiện tại (dòng 1591-1679):** GIỮ NGUYÊN làm tham chiếu read-only, nhưng đổi thành **collapsible** (mặc định thu gọn) để không chiếm quá nhiều không gian.

**Bảng MỚI "Hạng mục hợp đồng":**

```
┌─ Hạng mục hợp đồng (n HM) ──────────────────────── [+ Thêm hạng mục] ────┐
│                                                                              │
│  # │ Sản phẩm/DV (dropdown)  │ ĐVT   │  SL (input) │ Đơn giá (input) │ Thành tiền │ X │
│  1 │ [Phần mềm VNPT HIS ▾]  │License│    [1]      │ [150.000.000]   │150.000.000 │ 🗑│
│  2 │ [DV giám sát SOC  ▾]   │Tháng  │    [1]      │ [ 80.000.000]   │ 80.000.000 │ 🗑│
├────┤                         │       │             │ Tổng HM:        │230.000.000 │
│    │                         │       │             │ Giá trị HĐ:     │982.019.190 │
│    │                         │       │             │ Chênh lệch:     │-752.019.190│ ← đỏ
├────┴─────────────────────────┴───────┴─────────────┴─────────────────┴────────────┤
│  [Đồng bộ giá trị HĐ ↻]                                                         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Khi đã có kỳ thanh toán:**
```
┌─ Hạng mục hợp đồng (n HM) ────────── 🔒 Không thể sửa — đã có kỳ thanh toán ──┐
│  # │ Sản phẩm/DV (text)    │ ĐVT   │  SL │ Đơn giá      │ Thành tiền           │
│  1 │ Phần mềm VNPT HIS     │License│  1  │ 150.000.000  │ 150.000.000          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Chi tiết UI:**

| Cột | Khi editable | Khi locked |
|-----|-------------|------------|
| Sản phẩm/DV | `<SearchableSelect>` dùng `products.map(p => ({value: p.id, label: p.product_name}))`. Disable SP đã chọn ở row khác. | Text read-only |
| ĐVT | Read-only text: `product.unit \|\| '--'` | Read-only |
| SL | `<input type="number" step="1" min="0.01">` | Text read-only |
| Đơn giá | Input text, format currency `formatCurrency()`/`parseCurrency()` (đã có sẵn trong ContractModal dòng 180-202) | Text read-only |
| Thành tiền | Read-only: `SL × Đơn giá` | Read-only |
| Xóa | Button 🗑 (`Trash2` icon, đã import dòng 3) | Ẩn |

**Footer bảng:**
- Tổng HM / Giá trị HĐ / Chênh lệch (đỏ nếu lệch, xanh nếu = 0)
- Nút "Đồng bộ giá trị HĐ" → chỉ hiện khi editable + chênh lệch > 0

### 12. Frontend — `App.tsx`

#### 12a. Dependencies tab contracts (dòng 867)

```typescript
// Trước:
contracts: ['projects', 'customers', 'paymentSchedules'],
// Sau:
contracts: ['projects', 'customers', 'paymentSchedules', 'products', 'projectItems'],
```

#### 12b. Truyền `products` vào `<ContractModal>` (dòng 6830-6844)

```tsx
<ContractModal
  ...existing props...
  products={products}  // ← THÊM
/>
```

#### 12c. Fetch detail khi mở EDIT_CONTRACT modal (dòng 3486-3487)

**Copy pattern từ EDIT_PROJECT** (dòng 3466-3484):

```typescript
// Trước:
} else if (type?.includes('CONTRACT')) {
   setSelectedContract(item ? (item as Contract) : null);

// Sau:
} else if (type?.includes('CONTRACT')) {
   const contract = item as Contract;
   setSelectedContract(contract);
   if (type === 'EDIT_CONTRACT' && contract?.id) {
     void fetchContractDetail(contract.id)
       .then((detail) => {
         setSelectedContract(detail);
       })
       .catch((error) => {
         const message = error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.';
         addToast('error', 'Tải dữ liệu thất bại', message);
       });
   }
```

---

## KHÔNG LÀM (loại bỏ so với plan cũ)

1. ❌ **Không sửa `V5DomainSupportService::fetchProjectItemsByProjectIds()`** — consumer chính là embedded project-items trong serializer dự án, không liên quan đến contract_items
2. ❌ **Không sửa `V5MasterDataController::projectItemSelectColumns()`** — `GET /project-items` API hiện không trả `unit`, nhưng ContractModal không cần vì `unit` sẽ lấy từ `products[]` prop (đã có `unit` trong Product API response, serializer dòng 15347)
3. ❌ **Không tạo BE flag `copy_project_items`** — FE copy từ `projectItems` prop ngay trong modal (local state)
4. ❌ **Không thêm `items.product` vào `index()`** — list endpoint giữ gọn, chỉ `show()`/`store()`/`update()` response có items

---

## Verification

1. `php artisan migrate` → 2 migration OK (contract_items + products.unit)
2. **ADD contract** + chọn project → draft auto-copy items từ projectItems, ĐVT hiện đúng từ products
3. Sửa SL/đơn giá → Thành tiền cập nhật reactive
4. "Đồng bộ giá trị HĐ" → `formData.value = tổng HM`
5. Lưu → BE nhận `items`, sync `contract_items` trong DB, response có `items`
6. Mở lại EDIT → `fetchContractDetail(id)` trả items, modal hiện đúng
7. Chọn SP mới → auto-fill `standard_price` nếu đơn giá đang = 0, SP trùng disabled
8. Sinh kỳ TT → bảng chuyển read-only, ẩn nút thêm/xóa/đồng bộ
9. Save kèm items khi đã có schedules → BE trả 422
10. `GET /contracts` (list) KHÔNG chứa items → response gọn
11. `GET /contracts/{id}` trả items.product đầy đủ
12. `npx tsc --noEmit` pass
13. Modal full-width cả 2 tab
14. Bảng "Hạng mục dự án" vẫn còn (collapsible) để tham chiếu
