# Đề xuất cải tiến UI/UX & Logic — ContractModal (v2)

> Cập nhật theo yêu cầu mới: cho sửa hạng mục + đơn vị tính + form rộng hơn + tên sản phẩm đúng.

---

## 🔴 THAY ĐỔI 1 (User yêu cầu): Form width lớn hơn

### Hiện trạng

```
Tab CONTRACT:  max-w-4xl (~896px)
Tab PAYMENT:   max-w-[95vw] xl:max-w-[1400px]
```

→ Tab CONTRACT quá hẹp, đặc biệt khi thêm bảng hạng mục.

### Giải pháp

Nâng tab CONTRACT lên cùng kích thước với tab PAYMENT:

**File:** `ContractModal.tsx` dòng 1481

```
Trước: isExpandedPaymentTab ? 'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]' : 'max-w-4xl max-h-[90vh]'
Sau:   'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]'
```

→ Modal luôn full-width, cả 2 tab.
→ Biến `isExpandedPaymentTab` không cần thiết nữa cho width (vẫn giữ nếu dùng ở chỗ khác).

---

## 🔴 THAY ĐỔI 2 (User yêu cầu): Bảng hạng mục EDITABLE khi chưa sinh kỳ thanh toán

### Hiện trạng phân tích

```
Data đã có:
  ✅ projectItems (prop) — data từ API GET /project-items (join product_name, product_code)
  ✅ projectTotals — tính tổng từ projectItems
  ❌ Không có UI hiển thị chi tiết
  ❌ Không có API CRUD riêng cho project-items (chỉ có bulk sync khi save Project)

Hiện trạng API:
  ✅ GET /api/v5/project-items — đọc danh sách (đã có)
  ❌ POST /api/v5/project-items — tạo mới (chưa có)
  ❌ PUT /api/v5/project-items/{id} — cập nhật (chưa có)
  ❌ DELETE /api/v5/project-items/{id} — xóa (chưa có)

Backend hiện tại:
  - syncProjectItems() trong ProjectDomainService: bulk delete + re-insert (gọi khi save project)
  - Cần tạo API CRUD riêng để sửa từng item từ ContractModal

DB schema products:
  ❌ Không có cột `unit` trong DB (products table)
  ✅ FE types.ts Product interface có `unit?: string | null` (dòng 300) — sẵn sàng
```

### Quy tắc editable

| Điều kiện | Editable? | Lý do |
|---|---|---|
| Chưa có kỳ thanh toán (`schedules.length === 0`) | ✅ CÓ | Chưa có dòng tiền, an toàn sửa |
| Đã có kỳ thanh toán | ❌ KHÔNG | Sửa hạng mục → tổng lệch → kỳ thanh toán sai |

### Thiết kế UI

```
┌─ Hạng mục dự án (2 hạng mục) ─────────────────── [+ Thêm hạng mục] ─────────────────┐
│                                                                                        │
│  ┌─────┬──────────────────┬──────────┬──────┬──────────────┬───────────────┬──────────┐│
│  │  #  │ Sản phẩm/DV      │ ĐVT      │  SL  │  Đơn giá     │  Thành tiền   │ Thao tác ││
│  ├─────┼──────────────────┼──────────┼──────┼──────────────┼───────────────┼──────────┤│
│  │  1  │ [Phần mềm VNPT ▾]│ License  │ [1]  │ [150.000.000]│  150.000.000  │  🗑      ││
│  │  2  │ [DV giám sát S ▾]│ Tháng    │ [1]  │ [ 80.000.000]│   80.000.000  │  🗑      ││
│  ├─────┼──────────────────┼──────────┼──────┼──────────────┼───────────────┼──────────┤│
│  │     │                  │          │      │ Tổng HM:     │  230.000.000  │          ││
│  │     │                  │          │      │ Giá trị HĐ:  │  982.019.190  │          ││
│  │     │                  │          │      │ Chênh lệch:  │ -752.019.190  │ ← đỏ    ││
│  └─────┴──────────────────┴──────────┴──────┴──────────────┴───────────────┴──────────┘│
│                                                                                        │
│  [Đồng bộ giá trị HĐ ↻]  ← bấm → formData.value = tổng hạng mục                    │
└────────────────────────────────────────────────────────────────────────────────────────┘

Khi đã có kỳ thanh toán → bảng chuyển thành READ-ONLY:
┌─ Hạng mục dự án (2 hạng mục) ──── 🔒 Đã có kỳ thanh toán, không thể sửa ──────────┐
│  (bảng giống nhưng không có input, không có nút Thêm/Xóa/Đồng bộ)                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cột "Sản phẩm/Dịch vụ" — lấy đúng tên

**Vấn đề:** FE type `ProjectItemMaster` có `product_name` (join từ bảng `products`) nhưng hiện tại bảng không hiển thị.

**Giải pháp:** Dùng `<SearchableSelect>` hoặc `<select>` dropdown với danh sách sản phẩm:
- Label hiển thị: `product_name` (VD: "Phần mềm VNPT HIS L3")
- Không dùng `display_name` (thường ghép project + product → dài dòng)
- Cần thêm prop `products: Product[]` vào ContractModal hoặc fetch riêng

### Cột "ĐVT" (Đơn vị tính) — cần bổ sung data

**Vấn đề:** Bảng `products` trong DB **không có cột `unit`**, nhưng FE type Product interface đã có `unit?: string | null`.

**Giải pháp:** 2 bước:
1. **Migration:** Thêm cột `unit VARCHAR(50) NULL` vào bảng `products`
2. **Backend:** Bổ sung select `unit` trong API response
3. **FE:** Hiển thị `product.unit || '--'` trong cột ĐVT (read-only, lấy từ product)

### Chi tiết triển khai — Tổng hợp files cần sửa

| # | File | Thay đổi | Scope |
|---|------|----------|-------|
| 1 | `backend/database/migrations/2026_03_19_*_add_unit_to_products.php` | **TẠO MỚI** — thêm cột `unit` VARCHAR(50) nullable | DB |
| 2 | `backend/app/Http/Controllers/Api/V5MasterDataController.php` | Bổ sung select `pr.unit` trong `projectItemSelectColumns()` (dòng 12514-12521) + `serializeProjectItemRecord()` | BE |
| 3 | `backend/app/Http/Controllers/Api/V5MasterDataController.php` | Tạo 3 method: `storeProjectItem`, `updateProjectItem`, `destroyProjectItem` | BE |
| 4 | `backend/routes/api.php` | Thêm 3 routes: POST/PUT/DELETE `/project-items` | BE |
| 5 | `backend/app/Services/V5/V5DomainSupportService.php` | Bổ sung select `unit` trong `fetchProjectItemsByProjectIds()` (dòng 1370-1379) | BE |
| 6 | `frontend/types.ts` | Bổ sung `unit?: string \| null` vào `ProjectItemMaster` | FE |
| 7 | `frontend/services/v5Api.ts` | Thêm 3 functions: `createProjectItem`, `updateProjectItem`, `deleteProjectItem` | FE |
| 8 | `frontend/components/ContractModal.tsx` | Thêm bảng hạng mục UI + CRUD handlers + nút đồng bộ + form width | FE |

### API CRUD cho Project Items

**3a. `storeProjectItem(Request $request)` — POST `/api/v5/project-items`**

```
Body: { project_id, product_id, quantity, unit_price }
Validate:
  - project_id required, exists in projects
  - product_id required, exists in products
  - quantity required, numeric, > 0
  - unit_price required, numeric, >= 0
Return: ProjectItemMaster record (join product info)
```

**3b. `updateProjectItem(Request $request, int $id)` — PUT `/api/v5/project-items/{id}`**

```
Body: { product_id?, quantity?, unit_price? }
Validate: tương tự store nhưng optional
Return: updated ProjectItemMaster record
```

**3c. `destroyProjectItem(int $id)` — DELETE `/api/v5/project-items/{id}`**

```
Soft delete (deleted_at)
Return: 204 No Content
```

### Frontend — ContractModal.tsx changes

**8a. State mới:**

```typescript
const [localProjectItems, setLocalProjectItems] = useState<ProjectItemMaster[]>([]);
```

Init từ `projectItems.filter(i => String(i.project_id) === String(formData.project_id))`.

**8b. CRUD handlers:**

```typescript
const handleAddProjectItem = async (productId, quantity, unitPrice) => { ... }
const handleUpdateProjectItem = async (itemId, updates) => { ... }
const handleDeleteProjectItem = async (itemId) => { ... }
const handleSyncContractValue = () => {
  const total = localProjectItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
  handleChange('value', total);
};
```

**8c. Editable condition:**

```typescript
const isItemsEditable = schedules.length === 0;
```

**8d. Product dropdown:**

Cần thêm prop `products: Product[]` vào ContractModalProps, hoặc fetch từ existing data.
Mỗi row hiển thị SearchableSelect với options = `products.map(p => ({ value: p.id, label: p.product_name }))`.

---

## 🟡 ĐỀ XUẤT BỔ SUNG: Nút "Đồng bộ giá trị HĐ" từ hạng mục

Khi tổng hạng mục lệch giá trị HĐ, hiện nút:

```
⚠ Tổng HM (230.000.000) lệch Giá trị HĐ (982.019.190). Chênh lệch: -752.019.190
                                                          [Đồng bộ giá trị HĐ ↻]
```

Bấm → `formData.value = tổng hạng mục` → warning biến mất.

Chỉ hiện khi `isItemsEditable = true` (chưa có kỳ thanh toán).

---

## 🟢 ĐỀ XUẤT THÊM CỦA TÔI

### A. Validate trước khi sinh kỳ thanh toán

Khi bấm "Sinh kỳ thanh toán", kiểm tra:
- Nếu `localProjectItems.length === 0` → warning: "Chưa có hạng mục nào. Bạn có chắc muốn sinh kỳ thanh toán?"
- Nếu tổng hạng mục lệch giá trị HĐ → warning: "Tổng hạng mục đang lệch giá trị HĐ. Tiếp tục?"

→ Giúp user nhận ra sai sót trước khi tạo dòng tiền.

### B. Auto-fill đơn giá từ sản phẩm

Khi chọn sản phẩm trong dropdown, tự điền `unit_price = product.standard_price` (nếu > 0).
User vẫn có thể sửa lại.

→ Tiết kiệm thời gian nhập liệu.

### C. Auto-fill SL = 1 khi thêm hạng mục mới

Mặc định `quantity = 1` khi bấm "Thêm hạng mục" → user chỉ cần chọn sản phẩm.

### D. Disable sản phẩm đã chọn trong dropdown

Nếu sản phẩm X đã có trong bảng → dropdown disable option X (tránh trùng).
Hoặc cho phép trùng nhưng hiện badge "(đã có)" bên cạnh.

### E. Show tổng số hạng mục trong info bar

Hiện tại info bar chỉ hiện "Giá trị hạng mục: 150.000.000 VNĐ".
Bổ sung: "Giá trị hạng mục: 150.000.000 VNĐ (2 HM)".

---

## 📊 BẢNG TỔNG HỢP (cập nhật)

| # | Thay đổi | Ưu tiên | Effort | Ảnh hưởng |
|---|---------|---------|--------|-----------|
| 1 | Form width lớn hơn | ⭐⭐⭐ | Rất nhỏ (1 dòng CSS) | User yêu cầu |
| 2 | Bảng hạng mục EDITABLE + CRUD API | ⭐⭐⭐ | Trung bình (BE+FE) | User yêu cầu |
| 3 | Cột ĐVT (+ migration `unit`) | ⭐⭐⭐ | Nhỏ (migration + select) | User yêu cầu |
| 4 | Cột SP/DV lấy đúng product_name | ⭐⭐⭐ | Nhỏ (dropdown + label) | User yêu cầu |
| 5 | Nút "Đồng bộ giá trị HĐ" | ⭐⭐ | Rất nhỏ | UX tiện lợi |
| A | Validate trước sinh kỳ TT | ⭐⭐ | Nhỏ | Logic an toàn |
| B | Auto-fill đơn giá từ SP | ⭐ | Rất nhỏ | UX tiện lợi |
| C | Auto-fill SL = 1 | ⭐ | Rất nhỏ | UX tiện lợi |
| D | Disable SP đã chọn | ⭐ | Nhỏ | UX tránh trùng |
| E | Show tổng HM trong info bar | ⭐ | Rất nhỏ | UX thông tin |
