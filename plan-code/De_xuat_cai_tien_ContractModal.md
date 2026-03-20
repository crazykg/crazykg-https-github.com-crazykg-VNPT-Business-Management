# Đề xuất cải tiến UI/UX & Logic — ContractModal (v3)

> Cập nhật v3: Sửa theo kết quả Codex Plan Review Round 1. Làm rõ ownership model (contract_items vs project_items), thêm backend enforcement, refresh hiện trạng, phased rollout.

---

## ⚠ KIẾN TRÚC: Ownership Model — contract_items vs project_items

### Quyết định kiến trúc (FIX ISSUE-1)

ContractModal thao tác trên **contract_items** (snapshot thương mại riêng của hợp đồng), **KHÔNG** trực tiếp sửa project_items (master data của dự án).

| Aspect | contract_items | project_items |
|--------|---------------|---------------|
| **Table** | `contract_items` (đã có migration) | `project_items` |
| **Scope** | Per-contract snapshot | Per-project reference |
| **FE State** | `draftItems` (editable) | `projectItems` (read-only reference) |
| **Persistence** | `syncContractItems()` khi save contract | `syncProjectItems()` khi save project |
| **Unique constraint** | `(contract_id, product_id)` | Không |
| **CRUD từ ContractModal** | ✅ CÓ — thêm/sửa/xóa qua contract API | ❌ KHÔNG — chỉ đọc tham chiếu |

→ Tất cả CRUD trong ContractModal đều thao tác trên `contract_items` thông qua contract create/update API.
→ `project_items` chỉ hiển thị dạng read-only reference table.
→ `syncProjectItems()` (bulk delete + re-insert) KHÔNG bị ảnh hưởng — chỉ chạy khi save Project.

---

## 📋 HIỆN TRẠNG THỰC TẾ (refreshed — FIX ISSUE-3)

### Đã có sẵn trong codebase ✅

```
FE — ContractModal.tsx:
  ✅ Bảng "Hạng mục dự án gốc" (read-only reference, lines 1789-1860)
  ✅ Bảng "Hạng mục hợp đồng" (editable, lines 1867-2043) — dùng draftItems state
  ✅ isItemsEditable = schedules.length === 0 (FE condition)
  ✅ Nút "Đồng bộ từ hạng mục HĐ" — handleSyncContractValueFromDraftItems() (line 943)
  ✅ Add/Edit/Delete UI cho draftItems (SearchableSelect, quantity, unit_price inputs)
  ✅ Lock icon khi isItemsEditable === false

BE — contract_items:
  ✅ Table contract_items (migration 2026_03_19_170000)
  ✅ Schema: contract_id, product_id, quantity, unit_price, created_by, updated_by
  ✅ Items saved via createContract() và updateContract() (v5Api.ts lines 3083, 3139)

FE — Types:
  ✅ ProjectItemMaster interface có product_name (types.ts line 925)
  ✅ Product interface có unit?: string | null (types.ts line 300)

API — project_items (read-only):
  ✅ GET /api/v5/project-items (đọc danh sách)
```

### Cần làm thêm ❌

```
DB:
  ❌ Cột `unit` chưa có trong DB products table
  → Contract item serialization ĐÃ select unit từ products (ContractDomainService.php:690)
  → Nhưng DB thiếu cột → giá trị luôn null
  → Existing product CRUD (Modals.tsx:2154, ProductList.tsx:533) ĐÃ CÓ unit field

BE:
  ✅ Backend ĐÃ enforce schedule lock (ContractDomainService.php:446-455)
  ✅ Contract item serialization ĐÃ join products.unit (ContractDomainService.php:690)
  ❌ Project items API response chưa select `unit` (V5DomainSupportService fetchProjectItemsByProjectIds)

FE:
  ❌ Form width tab CONTRACT vẫn hẹp hơn tab PAYMENT
  ❌ Cột ĐVT hiện null vì DB thiếu cột unit
```

---

## 🔴 THAY ĐỔI 1 (User yêu cầu): Form width lớn hơn

### Hiện trạng

```
Tab CONTRACT:  max-w-4xl (~896px)
Tab PAYMENT:   max-w-[95vw] xl:max-w-[1400px]
```

→ Tab CONTRACT quá hẹp, đặc biệt khi hiển thị bảng hạng mục.

### Giải pháp

Nâng tab CONTRACT lên cùng kích thước với tab PAYMENT.

**File:** `ContractModal.tsx` — tìm chỗ set modal width class
**Thay đổi:** Luôn dùng `'max-w-[95vw] xl:max-w-[1400px] max-h-[94vh]'` cho cả 2 tab.

→ Modal luôn full-width, cả 2 tab.

---

## ✅ THAY ĐỔI 2: Backend enforcement cho schedule lock — ĐÃ CÓ SẴN

> **Verified (Codex Round 2):** Backend ĐÃ enforce schedule lock tại `ContractDomainService.php:446-455`.
> Khi `PUT /api/v5/contracts/{id}` với `items[]` trong body và contract đã có payment_schedules → return 422.
> **KHÔNG cần thêm code.**

---

## 🔴 THAY ĐỔI 3 (User yêu cầu): Cột ĐVT — thêm data vào DB + API

### Vấn đề

DB products table **không có cột `unit`**. FE type có sẵn nhưng data trống.

### Giải pháp — 3 bước (FIX ISSUE-5: bao gồm backfill)

**Bước 1 — Migration:**
```
Thêm cột `unit VARCHAR(50) NULL` vào bảng `products`
```

**Bước 2 — Backfill via existing product management (FIX ISSUE-8 + ISSUE-9):**

```
Source of truth: Admin nhập thủ công qua EXISTING product CRUD screens.

Đã có sẵn:
  ✅ Product edit form có unit field (Modals.tsx:2154)
  ✅ Product list có unit column (ProductList.tsx:533)
  ✅ Product save API persists unit (v5Api.ts:2244)

KHÔNG tạo admin page mới — dùng existing product management.

Backfill workflow:
  1. Chạy migration thêm cột unit
  2. Admin mở Product Management → filter products chưa có unit
  3. Admin nhập unit cho từng product qua existing edit form
  4. Autocomplete gợi ý: License, Tháng, Gói, Bộ, Cái, Thiết bị, User, Module

Release gate (FIX ISSUE-10):
  - Trước khi deploy Phase 3 (FE), kiểm tra:
    □ Tất cả products ĐANG DÙNG trong contract_items VÀ project_items phải có unit != NULL
    □ Query:
        SELECT DISTINCT p.id, p.product_name FROM products p
        LEFT JOIN contract_items ci ON ci.product_id = p.id
        LEFT JOIN project_items pi ON pi.product_id = p.id AND pi.deleted_at IS NULL
        WHERE (ci.id IS NOT NULL OR pi.id IS NOT NULL)
          AND p.unit IS NULL
    □ Nếu count > 0 → CHƯA ĐỦ điều kiện deploy FE → admin phải nhập xong
    □ Nếu count = 0 → OK deploy FE
  - Products chưa dùng trong contract/project → cho phép unit = NULL (không block release)

Correctness check:
  □ Không có data sai do auto-fill heuristic (admin tự nhập)
  □ Products đang dùng trong contracts đều có unit
  □ FE fallback '—' chỉ xuất hiện cho products chưa bao giờ dùng
```

**Bước 3 — Backend API:**
```
Bổ sung select `products.unit` trong:
  - projectItemSelectColumns() → join products.unit (project-items API)
  - serializeProjectItemRecord() → return unit field (project-items API)
  - Contract items response → ĐÃ CÓ SẴN (verify only, không cần code change)
```

**Bước 4 — FE:**
```
Hiển thị product.unit trong cột ĐVT (read-only, lấy từ product)
Fallback: product.unit || '—' (chỉ hiện khi backfill chưa xong)
```

### Files cần sửa

| # | File | Thay đổi | Phase |
|---|------|----------|-------|
| 1 | `backend/database/migrations/..._add_unit_to_products.php` | TẠO MỚI — thêm cột `unit` | Phase 1 |
| 2 | `backend/app/Services/V5/V5DomainSupportService.php` | Bổ sung select `unit` trong fetchProjectItemsByProjectIds() | Phase 2 |
| 3 | `frontend/components/ContractModal.tsx` | Form width + hiển thị unit trong cột ĐVT | Phase 3 |

---

## 🔴 THAY ĐỔI 4: Làm rõ integration contracts (FIX ISSUE-6)

### API Contract — Contract Items (qua Contract API)

Contract items KHÔNG có API riêng. Chúng được gửi kèm trong contract create/update payload:

```
POST /api/v5/contracts
PUT  /api/v5/contracts/{id}

Body: {
  ...contract fields...,
  items: [
    { product_id: number, quantity: number, unit_price: number },
    ...
  ]
}

Response: Contract object with items[] populated (join product_name, product_code, unit)
```

### Product Loading Strategy — Quyết định dứt khoát

**Chọn: Dùng existing products data đã available trong parent component.**

- ContractModal nhận prop `products: Product[]` từ parent (hoặc dùng existing data store)
- KHÔNG fetch riêng — tránh thêm loading state
- Dropdown options: `products.map(p => ({ value: p.id, label: p.product_name }))`

### Route Convention

Giữ nguyên route convention hiện có:
- Contract routes: `/api/v5/contracts` (đã có)
- Project items (read-only): `/api/v5/project-items` (đã có)
- **KHÔNG tạo thêm route mới** cho contract_items — items đi kèm contract payload

---

## 🔴 RECONCILIATION: CRUD mới vs bulk sync cũ (FIX ISSUE-4)

### Authoritative Save Path

```
ContractModal → save contract → API PUT /api/v5/contracts/{id}
  └─ Backend: syncContractItems(contract_id, items[])
     └─ Delete existing contract_items WHERE contract_id = X
     └─ Insert new items from payload
     └─ (ĐÂY là save path duy nhất cho contract_items)

Project save → syncProjectItems(project_id, items[])
  └─ Delete + re-insert project_items
  └─ KHÔNG ảnh hưởng contract_items
  └─ (ĐÂY là save path duy nhất cho project_items)
```

### Quy tắc rõ ràng

1. **contract_items** chỉ thay đổi qua `PUT /api/v5/contracts/{id}` với `items[]` trong body
2. **project_items** chỉ thay đổi qua project save flow (`syncProjectItems`)
3. Hai bảng **hoàn toàn độc lập** — không có cross-write
4. FE `draftItems` state → local edits → gửi kèm contract save → backend sync

→ Không có risk data loss hay overwrite vì hai save path không overlap.

---

## 🟡 ĐỀ XUẤT BỔ SUNG (scope đã giảm — nhiều feature đã có sẵn)

### Đã có sẵn (KHÔNG cần làm)
- ✅ Bảng hạng mục editable — đã implement
- ✅ Nút đồng bộ giá trị HĐ — `handleSyncContractValueFromDraftItems()` đã có
- ✅ isItemsEditable logic — đã có
- ✅ Product dropdown (SearchableSelect) — đã có

### Cần cải thiện (effort nhỏ)

| # | Cải thiện | Effort | Mô tả |
|---|----------|--------|-------|
| A | Validate trước sinh kỳ TT | Nhỏ | Thêm warning nếu chưa có hạng mục hoặc tổng lệch |
| B | Auto-fill đơn giá từ SP | Rất nhỏ | Khi chọn product → set unit_price = standard_price |
| C | Auto-fill SL = 1 | Rất nhỏ | Default quantity = 1 khi thêm row mới |
| D | Disable SP đã chọn | Nhỏ | Dropdown disable option đã có trong draftItems |
| E | Show tổng HM trong info bar | Rất nhỏ | Thêm "(N HM)" vào label |

---

## 📋 PHASED ROLLOUT ORDER (FIX ISSUE-7)

### Phase 1: Database Migration & Admin Backfill
```
1.1  Migration: thêm cột `unit` vào products table
1.2  Deploy migration lên staging
1.3  Admin nhập unit cho products qua existing Product Management screens
1.4  Chạy release gate query → verify tất cả products đang dùng trong contracts có unit

Acceptance test Phase 1:
  □ DB products table có cột unit
  □ Admin nhập unit thành công qua existing product edit form
  □ Release gate query: 0 products đang dùng trong contracts VÀ projects còn unit = NULL
  □ Schedule lock backend ĐÃ CÓ SẴN — verify only
```

### Phase 2: Backend API Response Update
```
2.1  Backend: bổ sung select products.unit trong project-items response (fetchProjectItemsByProjectIds)
     (Contract items response ĐÃ CÓ SẴN unit — verify only)
2.2  Deploy backend lên staging

Acceptance test Phase 2:
  □ GET /api/v5/project-items response chứa unit field
  □ Contract response items[].unit ĐÃ CÓ SẴN — verify only
  □ Contract response chứa items[].unit field
  □ unit hiển thị đúng cho các product đã backfill
```

### Phase 3: Frontend Changes
```
3.1  ContractModal form width → max-w-[95vw] xl:max-w-[1400px] cho cả 2 tab
3.2  Cột ĐVT hiển thị product.unit (read-only)
3.3  UX improvements (validate, auto-fill, disable duplicate, item count)
3.4  Deploy FE lên staging

Acceptance test Phase 3:
  □ Modal width = 1400px max trên cả 2 tab ← acceptance criteria
  □ Bảng hạng mục editable khi chưa có schedules ← acceptance criteria
  □ Bảng hạng mục read-only + lock icon khi đã có schedules
  □ product_name hiển thị đúng trong dropdown ← acceptance criteria
  □ unit hiển thị đúng trong cột ĐVT ← acceptance criteria
  □ Nút đồng bộ giá trị HĐ hoạt động ← acceptance criteria
  □ Backend reject sửa items khi đã có schedules (test race condition)
```

### Phase 4: Production Deploy
```
4.1  Deploy Phase 1+2 (backend) trước
4.2  Verify staging acceptance tests pass
4.3  Deploy Phase 3 (frontend)
4.4  Smoke test trên production

Rollout order: DB → Backend → Frontend (đảm bảo FE không ship trước API)
```

---

## 📊 BẢNG TỔNG HỢP (v3.2 — updated)

| # | Thay đổi | Ưu tiên | Effort | Phase | Status |
|---|---------|---------|--------|-------|--------|
| 1 | Form width lớn hơn | ⭐⭐⭐ | Rất nhỏ (1 dòng CSS) | 3 | Cần làm |
| 2 | Backend schedule lock enforcement | — | — | — | ✅ ĐÃ CÓ SẴN (verify only) |
| 3 | Cột ĐVT (migration + backfill qua existing product CRUD) | ⭐⭐⭐ | Nhỏ (migration only, backfill via existing UI) | 1-2 | Cần làm |
| 4 | Integration contracts clarity | — | — | — | ✅ Đã làm rõ trong plan |
| 5 | Ownership model (contract_items) | — | — | — | ✅ Đã làm rõ trong plan |
| A | Validate trước sinh kỳ TT | ⭐⭐ | Nhỏ | 3 | Optional |
| B | Auto-fill đơn giá từ SP | ⭐ | Rất nhỏ | 3 | Optional |
| C | Auto-fill SL = 1 | ⭐ | Rất nhỏ | 3 | Optional |
| D | Disable SP đã chọn | ⭐ | Nhỏ | 3 | Optional |
| E | Show tổng HM trong info bar | ⭐ | Rất nhỏ | 3 | Optional |

---

## 📝 CODEX REVIEW CHANGELOG

### Round 1 → v3

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| ISSUE-1: Write target mis-scoped | Critical | ACCEPTED | Thêm section "Ownership Model". Toàn bộ CRUD chỉ trên contract_items. Xóa đề xuất tạo project-items CRUD API |
| ISSUE-2: Schedule lock UI-only | High | ACCEPTED | Thêm "THAY ĐỔI 2" — backend validation reject khi có payment schedules |
| ISSUE-3: Stale baseline | High | ACCEPTED | Viết lại "HIỆN TRẠNG THỰC TẾ" với verified code references. Split thành "đã có" vs "cần làm" |
| ISSUE-4: CRUD vs bulk sync | High | ACCEPTED | Thêm section "RECONCILIATION" — define authoritative save path, chứng minh 2 path độc lập |
| ISSUE-5: Unit rollout incomplete | High | ACCEPTED | Thêm backfill strategy, rollout gating, 4-step approach thay vì 2-step |
| ISSUE-6: Integration contracts | Medium | ACCEPTED | Thêm "THAY ĐỔI 4" — explicit API contract, product loading strategy, route convention |
| ISSUE-7: No rollout order | Medium | ACCEPTED | Thêm "PHASED ROLLOUT ORDER" — 4 phases với acceptance tests cho mỗi phase |

### Round 2 → v3.1

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| ISSUE-3 (reopened): Baseline still stale | Medium | ACCEPTED | Cập nhật: schedule lock ĐÃ CÓ (ContractDomainService:446), unit serialization ĐÃ CÓ (ContractDomainService:690). Bỏ khỏi "cần làm". Giảm scope thực tế |
| ISSUE-8: Backfill strategy ambiguous | Medium | ACCEPTED | Thay heuristic auto-fill bằng admin UI thủ công. Thêm correctness check. Bỏ seeder, dùng admin page |

### Round 3 → v3.2

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| ISSUE-3 (still open): Plan sections inconsistent | Medium | ACCEPTED | Xóa contract items unit từ Phase 2 (đã có sẵn). Cập nhật summary table: schedule lock = "ĐÃ CÓ SẴN". Cleanup tất cả references |
| ISSUE-9: Admin page unnecessary | Medium | ACCEPTED | Xóa admin page mới. Dùng existing Product Management screens (Modals.tsx:2154, ProductList.tsx:533). Giảm scope |
| ISSUE-10: No unit coverage gate | Medium | ACCEPTED | Thêm release gate query: tất cả products đang dùng trong contracts phải có unit != NULL trước khi deploy FE |

### Round 4 → v3.3

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| ISSUE-3 (Low): Contract-side unit described twice | Low | ACCEPTED | Relabeled Bước 3 contract items line as "ĐÃ CÓ SẴN (verify only)" |
| ISSUE-10: Release gate query thiếu project_items | Medium | ACCEPTED | Aligned query to include BOTH contract_items AND project_items. Updated Phase 1 acceptance |

### Round 5 → v3.4 (Final)

| Issue | Severity | Action | Changes |
|-------|----------|--------|---------|
| ISSUE-11: Gate query includes soft-deleted project_items | Low | ACCEPTED | Added `AND pi.deleted_at IS NULL` to release gate query to match active-item semantics |
