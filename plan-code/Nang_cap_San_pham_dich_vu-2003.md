# Plan: Nâng cấp & Fix lỗi — Tab Sản phẩm / Dịch vụ

> **Version:** v1.2 (sau Codex Review Round 2 — 10/10 issues accepted)
> **Ngày:** 2026-03-20
> **Scope:** ProductList.tsx, Modals.tsx (ProductFormModal), App.tsx (product handlers), v5Api.ts
> **Baseline:** Code đã đọc và phân tích ngày 2026-03-20

---

## MỤC LỤC

1. [HIỆN TRẠNG](#1-hiện-trạng)
2. [FIX LỖI LOGIC (Critical/High)](#2-fix-lỗi-logic)
3. [CẢI THIỆN UI/UX](#3-cải-thiện-uiux)
4. [FILES CẦN SỬA](#4-files-cần-sửa)
5. [PHASED ROLLOUT](#5-phased-rollout)
6. [BẢNG TỔNG HỢP](#6-bảng-tổng-hợp)

---

## 1. HIỆN TRẠNG

### Đã có sẵn (KHÔNG cần làm)
- ✅ CRUD đầy đủ: Thêm / Sửa / Xóa product (ProductFormModal, App.tsx handlers)
- ✅ Bảng danh sách với sort 7 cột, search, filter theo lĩnh vực (ProductList.tsx)
- ✅ Pagination với URL sync (ProductList.tsx:264-291)
- ✅ Export Excel / CSV / PDF (ProductList.tsx:351-387)
- ✅ Import từ Excel + tải file mẫu (ProductList.tsx:324-349, App.tsx import flow)
- ✅ Permission gate ở handleOpenModal (App.tsx:3407-3413)
- ✅ Soft delete ở backend (V5MasterDataController.php:1463)
- ✅ Unique constraint product_code (backend validation + DB)
- ✅ Thẻ thống kê tổng số + theo lĩnh vực (ProductList.tsx:464-490)

### Cần fix / cải thiện
- ❌ `normalizeProductUnit()` ghi giá trị giả "Cái/Gói" vào DB → phá release gate
- ❌ Form không validate trước khi submit
- ❌ Nút Edit/Delete hiện cho user read-only (không check permission ở component)
- ❌ Search không debounce
- ❌ Thứ tự field trong form không hợp lý
- ❌ Empty state không phân biệt "chưa có data" vs "filter không khớp"
- ❌ `window.alert()` text không dấu thay vì dùng toast

---

## 2. FIX LỖI LOGIC

### 🔴 FIX-1 (Critical): normalizeProductUnit() ghi fallback giả vào DB

**Vấn đề:**

3 file đều có cùng hàm `normalizeProductUnit()`:
- `App.tsx:1622-1628`
- `Modals.tsx:215-221`
- `ProductList.tsx:149-155`

Logic hiện tại:
```typescript
// Nếu unit trống → trả "Cái/Gói" → GHI VÀO DB
const normalizeProductUnit = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text || text === '--' || text === '---') return 'Cái/Gói';  // ← SAI
  return text;
};
```

Hậu quả:
- Product chưa nhập unit → DB lưu `unit = "Cái/Gói"` thay vì `NULL`
- Release gate query `WHERE unit IS NULL` → luôn trả 0 → pass giả tạo
- Không phân biệt được "admin đã xác nhận unit = Cái/Gói" vs "chưa ai nhập unit"

**Giải pháp — Tách display fallback khỏi data normalization:**

```
Bước 1: Tạo shared utility (1 file duy nhất)
  ├─ normalizeProductUnitForSave(value) → string | null
  │    Trống/null → return null (để DB lưu NULL)
  │    Có giá trị → return trimmed string
  │
  └─ formatProductUnitForDisplay(value) → string
       Trống/null → return "—" (chỉ hiển thị, KHÔNG lưu)
       Có giá trị → return trimmed string

Bước 2: FULL AUDIT — thay thế TẤT CẢ call sites (FIX CODEX-ISSUE-1)

  WRITE paths (dùng normalizeProductUnitForSave):
  ├─ App.tsx:3866 (handleSaveProduct)       → normalizeProductUnitForSave
  ├─ App.tsx:2544 (import flow)             → normalizeProductUnitForSave
  └─ Modals.tsx:2161 (form init)            → giữ raw value (null → null), KHÔNG normalize

  READ/HYDRATION paths (FIX CODEX-ISSUE-1 — phải audit):
  ├─ App.tsx:1630 (normalizeProductRecord)  → KHÔNG gọi normalizeProductUnit cho unit nữa
  │    Thay: unit: normalizeProductUnit(product.unit) → unit: product.unit (giữ nguyên null)
  └─ Bất kỳ response handler nào khác parse product.unit → kiểm tra KHÔNG convert null→string

  DISPLAY paths (dùng formatProductUnitForDisplay):
  ├─ ProductList.tsx:563 (table cell)       → formatProductUnitForDisplay (hiện "—")
  └─ ProductList.tsx:229-230 (sort compare) → formatProductUnitForDisplay

  EXPORT paths (FIX CODEX-ISSUE-2 — tách riêng khỏi display):
  └─ ProductList.tsx:359 (export)           → dùng formatProductUnitForExport
       Tạo thêm hàm: formatProductUnitForExport(value) → string
         null/trống → return "" (blank, KHÔNG phải "—")
         Có giá trị → return trimmed string
       Lý do: export là data interchange, "—" gây ô nhiễm data khi re-import

Bước 3: Xóa 3 hàm normalizeProductUnit() duplicate ở 3 file

Bước 4: AUDIT CHECKLIST (FIX CODEX-ISSUE-1, CODEX-ISSUE-8)

  Phase 1 gate (chạy sau khi hoàn thành Phase 1):
  □ grep -rn "normalizeProductUnit\b" frontend/ --include="*.ts" --include="*.tsx"
    → phải trả 0 kết quả (hàm cũ đã xóa)
    Lưu ý: "normalizeProductUnitForSave" và "normalizeProductUnitForDisplay" KHÔNG match vì \b word boundary
  □ grep -rn '"Cái/Gói"' frontend/ --include="*.ts" --include="*.tsx"
    → phải trả 0 kết quả (Phase 1 KHÔNG có datalist — đó là Phase 2)
  □ Kiểm tra tất cả response parse paths: fetchProducts, import response, create/update response
  □ Không có path nào convert null unit → non-null string

  Phase 2 gate (chạy sau khi hoàn thành Phase 2):
  □ grep -rn "normalizeProductUnit\b" frontend/ → vẫn 0
  □ grep -rn '"Cái/Gói"' frontend/ --include="*.ts" --include="*.tsx"
    → CHỈ match trong datalist suggestions (Modals.tsx, UX-7)

Verification:
  □ Tạo product mới KHÔNG nhập unit → DB có unit = NULL
  □ Hiển thị trong bảng: "—" (dash)
  □ Edit product có unit = NULL → form hiện placeholder, KHÔNG hiện "Cái/Gói"
  □ Export product unit = NULL → cell trống (blank), KHÔNG phải "—"
  □ Re-import exported file → unit vẫn NULL
  □ Release gate query hoạt động đúng
```

### 🔴 FIX-2 (High): Form không validate trước khi submit

**Vấn đề:** `Modals.tsx:2244` — nút Lưu gọi `onSave(formData)` trực tiếp, không check gì.

**Giải pháp:**

```
Thêm validateProductForm() trước onSave:

PREREQUISITE — Validation audit (FIX CODEX-ISSUE-3):
  □ Đọc backend rules tại V5MasterDataController.php:1268-1277 (storeProduct)
  □ Đọc backend rules tại V5MasterDataController.php:1355-1363 (updateProduct)
  □ So sánh FE rules vs BE rules → ghi lại bất kỳ khác biệt
  □ Kiểm tra legacy data: query SELECT product_code FROM products WHERE product_code NOT REGEXP '^[A-Za-z0-9_]+$'
  □ Nếu có legacy product_code không match alphanumeric+underscore → dùng SOFT validation:
    - Tạo mới: enforce strict (alphanumeric + underscore)
    - Sửa existing: KHÔNG reject nếu product_code giữ nguyên giá trị cũ (chỉ validate khi thay đổi)
  □ Ghi kết quả audit vào comment trong validateProductForm()

Validation rules (PHẢI verify với backend trước khi hard-code):
  ├─ product_code: required, max 100 chars, pattern kiểm tra theo audit result
  ├─ product_name: required, max 255 chars
  ├─ domain_id: required (phải chọn)
  ├─ vendor_id: required (phải chọn)
  ├─ standard_price: >= 0 (cho phép 0 nhưng hiện warning)
  └─ unit: optional, max 50 chars

UI behavior:
  ├─ Inline error message dưới mỗi field lỗi (text đỏ)
  ├─ Border field lỗi → đổi sang border-red-500
  ├─ Scroll tới field lỗi đầu tiên
  ├─ Nút Lưu disable khi đang submit (loading state)
  └─ Nút Lưu hiện spinner icon khi đang gọi API

State changes trong ProductFormModal:
  ├─ Thêm: const [errors, setErrors] = useState<Record<string, string>>({})
  ├─ Thêm: const [isSubmitting, setIsSubmitting] = useState(false)
  └─ onChange mỗi field → clear error tương ứng (real-time validation)

Submit loading — ownership model (FIX CODEX-ISSUE-10):
  Chọn: onSave trở thành async contract, modal own loading state.

  Thay đổi:
  1. onSave prop signature: (data: Partial<Product>) => Promise<void>
     (hiện t���i là (data: Partial<Product>) => void — cần đổi)
  2. Modal handler:
     const handleSubmit = async () => {
       const validationErrors = validateProductForm(formData);
       if (Object.keys(validationErrors).length > 0) {
         setErrors(validationErrors);
         return;
       }
       setIsSubmitting(true);
       try {
         await onSave(formData);  // ← await Promise
         // onSave success → parent sẽ close modal
       } catch (err) {
         // onSave failed → modal vẫn mở, user thấy error toast (từ parent)
       } finally {
         setIsSubmitting(false);  // ← LUÔN reset dù success hay fail
       }
     };
  3. Nút Lưu: disabled={isSubmitting}, hiện spinner khi isSubmitting
  4. Parent (App.tsx handleSaveProduct):
     - Đã là async function → chỉ cần đảm bảo THROW error khi fail
     - Khi success → closeModal (như hiện tại)
     - Khi fail → throw error (để modal catch và giữ state)

  Lý do chọn modal-owned:
  - Ít thay đổi hơn (parent đã async, chỉ cần thêm throw)
  - Modal tự quản loading → không cần prop drilling isSaving
  - try/finally đảm bảo không bao giờ stuck disabled
```

### 🔴 FIX-3 (High): Nút Edit/Delete hiện cho user read-only

**Vấn đề:** `ProductList.tsx` không nhận permission info → luôn render nút Edit/Delete.

**Giải pháp:**

```
Bước 1: Thêm props vào ProductListProps
  interface ProductListProps {
    ...existing props...
    canEdit?: boolean;    // products.write permission
    canDelete?: boolean;  // products.delete permission
  }

Bước 2: Conditional render trong ProductList.tsx
  - Cột "Thao tác" header: ẩn hoàn toàn nếu !canEdit && !canDelete
  - Nút Edit: chỉ render nếu canEdit
  - Nút Delete: chỉ render nếu canDelete
  - colSpan empty state: điều chỉnh theo số cột thực tế

Bước 3: Truyền props từ App.tsx
  <ProductList
    ...
    canEdit={hasPermission(authUser, 'products.write')}
    canDelete={hasPermission(authUser, 'products.delete')}
  />

Tương tự cho header buttons:
  - Nút "Thêm mới sản phẩm": ẩn nếu !canEdit
  - Nút "Nhập" / "Upload tài liệu": ẩn nếu không có permission tương ứng

Không thay đổi backend — chỉ hide UI elements ở FE.
Fallback: handleOpenModal vẫn check permission (defense in depth).
```

### 🟡 FIX-4 (Medium): Xóa product không warning FK dependency

**Vấn đề:** User click Xóa → confirm → API reject 422 nếu product đang dùng trong contract/project. Error message qua toast, dễ bỏ qua.

**Giải pháp:**

```
Approach A (FE-only, chọn approach này — FIX CODEX-ISSUE-5):
  - Sau khi API trả 422 → detect delete-dependency error
  - Detection strategy (KHÔNG match text copy — dùng signal ổn định):
    ├─ Primary: Check HTTP status 422 + context (đang trong flow deleteProduct)
    ├─ Fallback: Check error message contains keywords ["sử dụng", "used", "constraint"]
    ├─ Safe default: MỌI lỗi 422 trong deleteProduct flow → hiện modal dependency warning
    │   (Vì deleteProduct chỉ có 2 failure modes: 404 not found hoặc 422 FK constraint)
    └─ Nếu backend thay đổi wording → vẫn hoạt động vì key off status code + context
  - Hiện modal cảnh báo rõ ràng (không phải toast):
    "Sản phẩm [TÊN] đang được sử dụng trong hợp đồng/dự án.
     Vui lòng gỡ sản phẩm khỏi hợp đồng/dự án trước khi xóa."
  - Nút: [Đóng]

Approach B (nâng cao, KHÔNG làm trong phase này):
  - Backend API trả thêm danh sách contracts/projects đang dùng product
  - FE hiện danh sách chi tiết
  - Cần thêm API endpoint → scope lớn hơn

Chỉ implement Approach A. Approach B để backlog.
```

### 🟡 FIX-5 (Medium): window.alert() text không dấu

**Vấn đề:** `ProductList.tsx:385`

```typescript
window.alert('Trinh duyet dang chan popup. Vui long cho phep popup de xuat PDF.');
```

**Giải pháp:**

```
Thay bằng toast (đã có sẵn addToast) — FIX CODEX-ISSUE-6:

Prerequisite: Verify toast API contract
  □ Kiểm tra addToast signature trong App.tsx: addToast(type, title, message)
  □ Kiểm tra type có hỗ trợ 'warning' không (hiện tại có thể chỉ 'success' | 'error')
  □ Nếu toast KHÔNG hỗ trợ 'warning':
    - Option A: Dùng 'error' type thay thế (thay đổi nhỏ nhất)
    - Option B: Mở rộng toast system thêm 'warning' (scope nhỏ nhưng cần ghi rõ)
  □ Ghi kết quả vào plan trước khi implement

Cần: ProductList nhận thêm prop onNotify BIND CHÍNH XÁC tới existing toast API.

Option 1 (đơn giản): Thêm prop callback — bind đúng type addToast hỗ trợ
  interface ProductListProps {
    ...
    onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
    // ← type match CHÍNH XÁC addToast signature (verify trước khi implement)
  }

  // Thay thế:
  onNotify?.('error', 'Xuất PDF', 'Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.');

Option 2 (tốt hơn): Dùng toast context nếu có

Chọn Option 1 vì ít thay đổi hơn. Type sẽ quyết định sau audit.
```

---

## 3. CẢI THIỆN UI/UX

### 🟡 UX-1: Search debounce

**File:** `ProductList.tsx:499-502`

```
Hiện tại: mỗi keystroke → setSearchTerm → recompute filter + URL update
Cải thiện: debounce 300ms

Implementation (FIX CODEX-ISSUE-4 — specify pagination + sync rõ ràng):
  ├─ Thêm state: const [searchInput, setSearchInput] = useState(searchTerm)
  ├─ Input onChange → setSearchInput (instant, cho UX responsive)
  ├─ useEffect debounce:
  │    useEffect(() => {
  │      const timer = setTimeout(() => {
  │        setSearchTerm(searchInput);
  │        setCurrentPage(DEFAULT_PAGE);  // ← RESET pagination khi filter thay đổi
  │      }, 300);
  │      return () => clearTimeout(timer);
  │    }, [searchInput]);
  ├─ URL sync vẫn dùng searchTerm (debounced value)
  └─ External reset sync:
       Khi user click "Xóa bộ lọc" (UX-6) hoặc URL thay đổi external:
       → setSearchInput('') đồng thời setSearchTerm('') (bypass debounce)
       → setCurrentPage(DEFAULT_PAGE)
       Đảm bảo: searchInput luôn === searchTerm sau external reset

Empty state logic (liên quan):
  - KHÔNG dùng currentData.length (page-sliced) để check empty
  - Dùng filteredProducts.length (toàn bộ sau filter) để phân biệt:
    Case 1: products.length === 0 → chưa có data
    Case 2: filteredProducts.length === 0 && products.length > 0 → filter no match

Không cần thư viện ngoài — dùng setTimeout + cleanup trong useEffect.
```

### 🟡 UX-2: Thứ tự field trong ProductFormModal

**File:** `Modals.tsx:2190-2240`

```
Hiện tại: Mã SP → Tên SP → Giá → Đơn vị → Trạng thái → Lĩnh vực → NCC → Mô tả

Đề xuất (nhóm theo logic nghiệp vụ):

  ┌─ Thông tin cơ bản ──────────────────────┐
  │  Mã sản phẩm *         Tên sản phẩm *   │  ← 2 cột ngang (nếu modal rộng hơn)
  ├─ Phân loại ──────────────────────────────┤
  │  Lĩnh vực kinh doanh *                   │
  │  Nhà cung cấp *                          │
  ├─ Thông tin giá & đơn vị ─────────────────┤
  │  Đơn vị tính            Giá tiêu chuẩn   │  ← 2 cột ngang
  ├─ Khác ───────────────────────────────────┤
  │  Trạng thái                               │
  │  Mô tả                                    │
  └──────────────────────────────────────────┘

Kèm: mở rộng modal width → max-w-xl (từ max-w-lg)
     Cho phép 2-column layout ở các cặp field ngắn
```

### 🟡 UX-3: Empty state phân biệt rõ

**File:** `ProductList.tsx:582`

```
Hiện tại: Luôn hiện "Không có sản phẩm nào."

Đề xuất: Phân biệt 2 trường hợp

Case 1 — products.length === 0 (chưa có data):
  Icon: inventory_2 (to, mờ)
  "Chưa có sản phẩm nào."
  "Nhấn [Thêm mới sản phẩm] để bắt đầu." (nếu có quyền write)

Case 2 — products.length > 0 nhưng filteredProducts.length === 0 (filter no match):
  Icon: search_off
  "Không tìm thấy sản phẩm phù hợp."
  Nút: [Xóa bộ lọc] → reset search + domain filter

Implementation (FIX CODEX-ISSUE-4 — dùng filteredProducts, KHÔNG dùng currentData):
  - Check: products.length === 0 → Case 1 (chưa có data)
  - Check: filteredProducts.length === 0 && products.length > 0 → Case 2 (filter no match)
  - KHÔNG dùng currentData.length (đó là page-sliced, có thể trống do pagination bug)
```

### 🟢 UX-4: Cải thiện thẻ thống kê

**File:** `ProductList.tsx:464-490`

```
Card "Tổng số" → bổ sung:
  ├─ Số đang hoạt động (badge xanh)
  └─ Số ngưng hoạt động (badge xám)

Calculation (thêm useMemo):
  const activeCount = products.filter(p => p.is_active !== false).length;
  const inactiveCount = products.length - activeCount;
```

### 🟢 UX-5: Cột Nhà cung cấp truncate

**File:** `ProductList.tsx:562`

```
Thêm: className="... max-w-[200px] truncate" + title attribute

<td className="px-6 py-4 text-sm text-slate-600 max-w-[200px] truncate"
    title={getVendorName(item.vendor_id)}>
  {getVendorName(item.vendor_id)}
</td>
```

### 🟢 UX-6: Nút "Xóa bộ lọc" khi có filter active

**File:** `ProductList.tsx:493-518`

```
Khi searchTerm !== '' || domainFilterId !== '':
  Hiện chip/badge: "Đang lọc: [X]" + nút [Xóa bộ lọc]
  Click → gọi shared resetFilters() (FIX CODEX-ISSUE-9):
    const resetFilters = () => {
      setSearchInput('');      // ← clear input hiển thị (bypass debounce)
      setSearchTerm('');       // ← clear debounced value
      setDomainFilterId('');   // ← clear domain filter
      setCurrentPage(DEFAULT_PAGE);  // ← reset pagination
    };
  Đảm bảo: hàm này CŨNG được dùng trong UX-1 external reset sync
```

### 🟢 UX-7: Placeholder đơn vị tính dùng autocomplete suggestions

**File:** `Modals.tsx:2205`

```
Hiện tại: input text thường với placeholder "Cái/Gói"

Đề xuất: datalist HTML5 (không cần thêm component)

<input list="unit-suggestions" ... placeholder="Chọn hoặc nhập đơn vị" />
<datalist id="unit-suggestions">
  <option value="License" />
  <option value="Tháng" />
  <option value="Gói" />
  <option value="Bộ" />
  <option value="Cái" />
  <option value="Thiết bị" />
  <option value="User" />
  <option value="Module" />
</datalist>

Ưu điểm: native, không cần state, user vẫn nhập tự do.
```

---

## 4. FILES CẦN SỬA (FIX CODEX-ISSUE-7 — tách rõ change bundles theo phase)

### Phase 1 — Fix lỗi logic (independently deployable)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 1a | `frontend/utils/productUnit.ts` | TẠO MỚI — `normalizeProductUnitForSave()`, `formatProductUnitForDisplay()`, `formatProductUnitForExport()` |
| 1b | `frontend/App.tsx` | Import productUnit.ts. Thay `normalizeProductUnit` → `normalizeProductUnitForSave` ở handleSaveProduct (line 3866), import flow (line 2544). Xóa `normalizeProductUnit()` (line 1622-1628). Sửa `normalizeProductRecord` (line 1630) bỏ unit normalize. Truyền `canEdit`/`canDelete`/`onNotify` props cho ProductList |
| 1c | `frontend/components/Modals.tsx` | Xóa `normalizeProductUnit()` (line 215-221). ProductFormModal: thêm `validateProductForm()`, `errors` state, `isSubmitting` state, loading trên nút Lưu |
| 1d | `frontend/components/ProductList.tsx` | Xóa `formatUnit()` (line 149-155), import `formatProductUnitForDisplay`/`formatProductUnitForExport`. Thêm props `canEdit`/`canDelete`/`onNotify`. Conditional render Edit/Delete/Thêm mới buttons. Thay `window.alert` → `onNotify` |

### Phase 2 — Cải thiện UI/UX (independently deployable, SAU Phase 1)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 2a | `frontend/components/ProductList.tsx` | Debounce search (thêm `searchInput` state, useEffect timer). Empty state phân biệt (2 cases). Truncate vendor column. Nút "Xóa bộ lọc". Bổ sung active/inactive count trong stats card |
| 2b | `frontend/components/Modals.tsx` | ProductFormModal: reorder fields (Mã→Tên→LV→NCC→ĐVT→Giá→TT→Mô tả). Mở rộng modal → max-w-xl. Datalist cho unit input |

**Nguyên tắc:** Phase 1 và Phase 2 KHÔNG chồng chéo về logic. Phase 1 có thể deploy + test độc lập. Phase 2 chỉ thêm UX polish, không sửa lại code Phase 1.

**Không có thay đổi backend.** Toàn bộ fix/cải thiện nằm ở FE.

---

## 5. PHASED ROLLOUT

### Phase 1: Fix lỗi logic (Critical + High)
```
1.1  Tạo shared utility productUnit.ts (FIX-1)
1.2  Thay thế tất cả normalizeProductUnit() call sites
1.3  Thêm form validation vào ProductFormModal (FIX-2)
1.4  Thêm permission-based button visibility (FIX-3)
1.5  Cải thiện error handling khi xóa product (FIX-4)
1.6  Thay window.alert bằng toast callback (FIX-5)

Acceptance test Phase 1:
  □ Tạo product không nhập unit → DB unit = NULL
  □ Product unit = NULL hiển thị "—" trong bảng
  □ Edit product unit NULL → form hiện placeholder, KHÔNG "Cái/Gói"
  □ Submit form trống → inline errors hiện, API KHÔNG được gọi
  □ User read-only → KHÔNG thấy nút Edit/Delete/Thêm mới
  □ Xóa product đang dùng → modal cảnh báo rõ ràng (không phải toast)
  □ Export PDF bị chặn popup → toast tiếng Việt có dấu
```

### Phase 2: Cải thiện UI/UX
```
2.1  Search debounce 300ms (UX-1)
2.2  Reorder fields trong ProductFormModal (UX-2)
2.3  Empty state phân biệt (UX-3)
2.4  Thẻ thống kê bổ sung active/inactive count (UX-4)
2.5  Truncate cột Nhà cung cấp (UX-5)
2.6  Nút "Xóa bộ lọc" (UX-6)
2.7  Datalist gợi ý đơn vị tính (UX-7)

Acceptance test Phase 2:
  □ Gõ search nhanh → không lag, chỉ filter sau 300ms dừng gõ
  □ Form fields theo thứ tự: Mã → Tên → Lĩnh vực → NCC → ĐVT → Giá → TT → Mô tả
  □ Bảng trống + không filter → hiện "Chưa có sản phẩm nào" + CTA
  □ Bảng trống + có filter → hiện "Không tìm thấy" + nút xóa bộ lọc
  □ Card tổng số hiện active/inactive count
  □ Tên NCC dài → truncate với tooltip
  □ Nhập ĐVT → dropdown gợi ý (License, Tháng, Gói...)
```

---

## 6. BẢNG TỔNG HỢP

| # | Thay đổi | Ưu tiên | Effort | Phase | Impact |
|---|---------|---------|--------|-------|--------|
| FIX-1 | normalizeProductUnit → split save/display | ⭐⭐⭐ | Nhỏ | 1 | Data integrity |
| FIX-2 | Form validation + loading state | ⭐⭐⭐ | Trung bình | 1 | UX + data quality |
| FIX-3 | Permission-based button visibility | ⭐⭐⭐ | Nhỏ | 1 | Security UX |
| FIX-4 | Delete error → modal thay vì toast | ⭐⭐ | Rất nhỏ | 1 | UX |
| FIX-5 | window.alert → toast có dấu | ⭐⭐ | Rất nhỏ | 1 | UX |
| UX-1 | Search debounce | ⭐⭐ | Rất nhỏ | 2 | Performance |
| UX-2 | Reorder form fields + wider modal | ⭐⭐ | Nhỏ | 2 | UX |
| UX-3 | Empty state phân biệt | ⭐⭐ | Nhỏ | 2 | UX |
| UX-4 | Stats card active/inactive | ⭐ | Rất nhỏ | 2 | UX |
| UX-5 | Vendor column truncate | ⭐ | Rất nhỏ | 2 | UX |
| UX-6 | Nút xóa bộ lọc | ⭐ | Rất nhỏ | 2 | UX |
| UX-7 | Unit datalist suggestions | ⭐ | Rất nhỏ | 2 | UX |

**Tổng effort ước tính:** ~3-4 giờ (Phase 1: ~2h, Phase 2: ~1.5h)
**Không có thay đổi backend. Không cần migration. Không ảnh hưởng API contract.**

---

## 📝 CODEX REVIEW CHANGELOG

### Round 1 → v1.1

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| CODEX-ISSUE-1: Call-site inventory incomplete | Critical | ACCEPTED | Thêm full audit checklist: read/hydration paths (normalizeProductRecord), grep verification, response handler checks. Bước 2 expanded từ 5 → 4 category paths |
| CODEX-ISSUE-2: Export reintroduces placeholder data | High | ACCEPTED | Tách export path riêng: thêm `formatProductUnitForExport()` trả blank thay vì "—". Thêm verification re-import |
| CODEX-ISSUE-3: FE validation rules chưa verify với backend | High | ACCEPTED | Thêm prerequisite validation audit step. Legacy data handling: soft validation cho existing records. Ghi rõ cần verify trước hard-code |
| CODEX-ISSUE-4: Debounce under-specified | High | ACCEPTED | Thêm pagination reset trong debounce effect. External reset sync. Empty state dùng filteredProducts thay vì currentData |
| CODEX-ISSUE-5: Delete error dựa trên fragile text matching | Medium | ACCEPTED | Thay match text → key off HTTP 422 status + deleteProduct context. Safe default: mọi 422 trong delete flow → modal warning |
| CODEX-ISSUE-6: Toast contract chưa verify 'warning' type | Medium | ACCEPTED | Thêm prerequisite audit toast API. onNotify type bind chính xác addToast signature. Ghi rõ cần verify trước implement |
| CODEX-ISSUE-7: File matrix không tách rõ theo phase | Medium | ACCEPTED | Tách file matrix thành 2 bảng riêng: Phase 1 (4 entries) + Phase 2 (2 entries). Ghi rõ nguyên tắc independently deployable |

### Round 2 → v1.2

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| CODEX-ISSUE-8: Grep checklist không executable | Medium | ACCEPTED | Tách checklist thành Phase 1 gate + Phase 2 gate. Grep dùng `\b` word boundary để không match tên hàm mới. "Cái/Gói" grep expected = 0 ở Phase 1, chỉ match datalist ở Phase 2 |
| CODEX-ISSUE-9: Clear-filter mâu thuẫn với debounce sync | Medium | ACCEPTED | Thống nhất: tạo shared `resetFilters()` dùng chung cho UX-1 external reset và UX-6 clear filter button. Reset cả `searchInput` + `searchTerm` + `domainFilterId` + `currentPage` |
| CODEX-ISSUE-10: Submit loading state thiếu async contract | High | ACCEPTED | Chọn modal-owned loading. `onSave` → `Promise<void>`. Modal dùng `try/finally` đảm bảo `isSubmitting` luôn reset. Parent throw error khi fail để modal giữ state |
