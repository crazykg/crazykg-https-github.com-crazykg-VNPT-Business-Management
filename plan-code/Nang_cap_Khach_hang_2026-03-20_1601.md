# Plan: Nâng cấp & Fix lỗi — Tab Khách hàng (Clients + Nhân sự liên hệ)

> **Version:** v1.0 (initial)
> **Ngày:** 2026-03-20 16:01
> **Scope:** CustomerList.tsx, CusPersonnelList.tsx, Modals.tsx (CustomerFormModal, CusPersonnelFormModal), App.tsx (customer handlers), v5Api.ts
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
- ✅ CRUD đầy đủ: Thêm / Sửa / Xóa Customer + CustomerPersonnel (Modals.tsx, App.tsx handlers)
- ✅ Server-side pagination cho CustomerList (dual mode: server + client) với PaginationControls
- ✅ Search theo mã, tên, MST (CustomerList) / theo tên, KH, email (CusPersonnelList)
- ✅ Sort tất cả cột, Vietnamese locale (CustomerList.tsx:56-74, CusPersonnelList.tsx:215-242)
- ✅ Export Excel / CSV / PDF (CustomerList.tsx:146-180, CusPersonnelList.tsx:334-374)
- ✅ Import từ Excel + tải file mẫu — CusPersonnel multi-sheet template (CusPersonnelList.tsx:283-331)
- ✅ Permission gate ở handleOpenModal (App.tsx:3407-3413 — `canOpenModal`)
- ✅ Soft delete ở backend (Customer model: `SoftDeletes`)
- ✅ Unique constraint customer_code (backend: store rule line 115, update rule line 200)
- ✅ Toast thông báo — đã dùng `onNotify` prop thay vì `window.alert`
- ✅ Thẻ thống kê tổng số (CustomerList.tsx:234-242)
- ✅ Filter nâng cao CusPersonnel: vai trò, trạng thái, SĐT, email (CusPersonnelList.tsx:480-533)
- ✅ Validation CusPersonnelFormModal: fullName, customerId, positionId, email format, birthday (Modals.tsx:2388-2403)
- ✅ Status badge Active/Inactive cho CusPersonnel (CusPersonnelList.tsx:577-580)
- ✅ Address column truncate + title tooltip (CustomerList.tsx:282)

### Cần fix / cải thiện
- ❌ CustomerFormModal KHÔNG validate trước khi submit
- ❌ CustomerFormModal KHÔNG có loading state (nút Lưu không disable khi đang gọi API)
- ❌ Nút Edit/Delete hiện cho user read-only (CustomerList + CusPersonnelList)
- ❌ Nút Thêm mới / Nhập hiện cho user không có quyền write
- ❌ Search không debounce (CustomerList ở server mode → mỗi keystroke gọi API)
- ❌ Empty state không phân biệt "chưa có data" vs "filter không khớp"
- ❌ CusPersonnelList pagination cứng 7 dòng/trang, không đổi được
- ❌ Pagination page correction gọi trong render (CusPersonnelList.tsx:251)
- ❌ Export PDF title không dấu tiếng Việt
- ❌ Xóa customer đang dùng → chỉ toast chung, không warning FK dependency rõ ràng
- ❌ CusPersonnelFormModal: field "Khách hàng" nằm cuối form (nên đầu)

---

## 2. FIX LỖI LOGIC

### 🔴 C-FIX-1 (Critical): CustomerFormModal KHÔNG validate trước khi submit

**Vấn đề:**

`Modals.tsx:2273` — nút Lưu gọi `onSave(formData)` trực tiếp, KHÔNG check gì.

So sánh: CusPersonnelFormModal ở cùng file ĐÃ CÓ validate (line 2388-2403).

```typescript
// Hiện tại — KHÔNG validate:
<button onClick={() => onSave(formData)} className="...">Lưu</button>
```

Hậu quả:
- Submit form trống → API reject 422, nhưng user chỉ thấy toast lỗi chung
- Không có inline error → UX kém, user không biết field nào sai
- Có thể submit customer_code trống → backend reject nhưng FE không chặn

**Giải pháp:**

```
PREREQUISITE — Validation audit:
  □ Đọc backend rules tại CustomerDomainService.php:113-120 (store)
  □ Đọc backend rules tại CustomerDomainService.php:183-190 (update)

Backend rules (đã đọc — VERIFIED):
  store:
    customer_code: required, string, max:100, unique (soft-delete aware)
    customer_name: required, string, max:255
    tax_code: nullable, string, max:100
    address: nullable, string
  update:
    customer_code: sometimes+required, string, max:100, unique ignore self
    customer_name: sometimes+required, string, max:255
    tax_code: sometimes+nullable, string, max:100
    address: sometimes+nullable, string

FE validation rules (match backend):
  ├─ customer_code: required, max 100 chars
  ├─ customer_name: required, max 255 chars
  ├─ tax_code: optional, max 100 chars, pattern /^[\d-]+$/ (chỉ số + dấu gạch)
  │   → Nếu legacy data có tax_code không match pattern → SOFT validation:
  │     Tạo mới: enforce strict
  │     Sửa existing: KHÔNG reject nếu tax_code giữ nguyên giá trị cũ
  └─ address: optional (không giới hạn FE, backend cũng không set max)

UI behavior:
  ├─ Inline error message dưới mỗi field lỗi (text đỏ)
  ├─ Border field lỗi → đổi sang border-red-500
  ├─ Scroll tới field lỗi đầu tiên
  └─ Pattern theo CusPersonnelFormModal đã có sẵn (copy approach)

State changes trong CustomerFormModal:
  ├─ Thêm: const [errors, setErrors] = useState<Record<string, string>>({})
  ├─ Thêm: validateCustomerForm() → Record<string, string>
  └─ onChange mỗi field → clear error tương ứng (real-time)

Implementation approach — copy CusPersonnelFormModal pattern:
  1. Thêm errors state
  2. Thêm validate() function
  3. Thêm handleSubmit() gọi validate trước onSave
  4. Đổi input từ FormInput → manual input + error hiển thị (hoặc mở rộng FormInput nhận error)

Verification:
  □ Submit form trống → inline errors hiện cho customer_code + customer_name
  □ Submit chỉ thiếu tên → chỉ customer_name có lỗi
  □ Nhập customer_code > 100 chars → error "Tối đa 100 ký tự"
  □ API KHÔNG được gọi khi validate fail
```

### 🔴 C-FIX-2 (Critical): CustomerFormModal không có loading state

**Vấn đề:**

`Modals.tsx:2254-2277` — không có `isSubmitting`, nút Lưu luôn enabled.
Khi user double-click → gọi API 2 lần → có thể tạo duplicate customer.

So sánh: App.tsx `handleSaveCustomer` (line 3910) set `setIsSaving(true)` nhưng modal KHÔNG dùng giá trị này.

**Giải pháp — Modal-owned loading (giống plan Sản phẩm FIX-2):**

```
Thay đổi:
1. onSave prop signature: (data: Partial<Customer>) => Promise<void>
   (hiện tại là (data: Partial<Customer>) => void — cần đổi)

2. Modal handler:
   const handleSubmit = async () => {
     const validationErrors = validateCustomerForm(formData);
     if (Object.keys(validationErrors).length > 0) {
       setErrors(validationErrors);
       return;
     }
     setIsSubmitting(true);
     try {
       await onSave(formData);
       // success → parent close modal
     } catch (err) {
       // fail → modal vẫn mở, error toast từ parent
     } finally {
       setIsSubmitting(false);
     }
   };

3. Nút Lưu: disabled={isSubmitting}, hiện spinner khi isSubmitting

4. Parent (App.tsx handleSaveCustomer):
   - Đã là async → chỉ cần THROW error khi fail (thêm re-throw)
   - Khi success → closeModal (đã có)
   - Khi fail → throw error (để modal catch và giữ state)
   - BỎ `setIsSaving(false)` trong catch (modal tự quản)

State:
  ├─ Thêm: const [isSubmitting, setIsSubmitting] = useState(false)
  └─ Nút Lưu: disabled={isSubmitting}

ÁP DỤNG TƯƠNG TỰ cho CusPersonnelFormModal:
  CusPersonnelFormModal (Modals.tsx:2405-2418) ĐÃ CÓ validate nhưng CHƯA CÓ loading:
  - handleSubmit() hiện tại gọi onSave() synchronously
  - Cần đổi sang async pattern tương tự
  - Thêm isSubmitting state + disabled button

Verification:
  □ Click Lưu → nút disable + spinner
  □ Double-click nhanh → chỉ 1 API request
  □ API fail → nút enable lại, modal vẫn mở
  □ API success → modal đóng
```

### 🔴 C-FIX-3 (High): Nút Edit/Delete hiện cho user read-only

**Vấn đề:**

**CustomerList.tsx:272-288** — cột "Thao tác" + nút Edit/Delete LUÔN render, không check permission.
**CusPersonnelList.tsx:556-611** — cùng vấn đề.

**Giải pháp:**

```
Bước 1: Thêm props vào CustomerListProps
  interface CustomerListProps {
    ...existing props...
    canEdit?: boolean;      // customers.write permission
    canDelete?: boolean;    // customers.delete permission
  }

Bước 2: Conditional render trong CustomerList.tsx
  - Cột "Thao tác" header: ẩn hoàn toàn nếu !canEdit && !canDelete
  - Nút Edit: chỉ render nếu canEdit
  - Nút Delete: chỉ render nếu canDelete
  - colSpan empty state: điều chỉnh theo số cột thực tế (6 → 5 nếu ẩn Thao tác)

Bước 3: Tương tự cho CusPersonnelListProps
  interface CusPersonnelListProps {
    ...existing props...
    canEdit?: boolean;      // customer_personnel.write permission
    canDelete?: boolean;    // customer_personnel.delete permission
  }

Bước 4: Truyền props từ App.tsx
  <CustomerList
    ...
    canEdit={hasPermission(authUser, 'customers.write')}
    canDelete={hasPermission(authUser, 'customers.delete')}
  />
  <CusPersonnelList
    ...
    canEdit={hasPermission(authUser, 'customer_personnel.write')}
    canDelete={hasPermission(authUser, 'customer_personnel.delete')}
  />

Bước 5: Header buttons (Thêm mới, Nhập) cũng conditional:
  CustomerList:
  - Nút "Thêm mới": ẩn nếu !canEdit
  - Nút "Nhập": ẩn nếu !canEdit
  CusPersonnelList:
  - Nút "Thêm mới": ẩn nếu !canEdit
  - Nút "Nhập": ẩn nếu !canEdit

PREREQUISITE:
  □ Kiểm tra permission keys thực tế: grep "customers" trong permission config
  □ Xác nhận key chính xác: 'customers.write' hay 'customers.update'?
  □ Xác nhận có tách riêng customer_personnel permission hay chung với customers?

Không thay đổi backend. Fallback: handleOpenModal vẫn check permission (defense in depth).
```

### 🟡 C-FIX-4 (Medium): Xóa customer không warning FK dependency

**Vấn đề:**

Customer model có 3 relations:
- `projects()` → HasMany Project
- `contracts()` → HasMany Contract
- `opportunities()` → HasMany Opportunity

User click Xóa → confirm → API reject (soft delete check bởi `accessAudit->deleteModel`) nếu customer đang dùng.
Error qua toast chung (`App.tsx:3947`), dễ bỏ qua.

**Giải pháp — FE-only (giống plan Sản phẩm FIX-4):**

```
Approach: Detect HTTP 422 trong deleteCustomer flow

Detection strategy:
  ├─ Primary: HTTP status 422 + context (đang trong flow deleteCustomer)
  ├─ Safe default: MỌI lỗi 422 trong deleteCustomer flow → hiện modal cảnh báo
  └─ Vì deleteCustomer chỉ có 2 failure modes: 404 not found hoặc 422 FK constraint

Modal cảnh báo:
  "Khách hàng [TÊN] đang được sử dụng trong hợp đồng/dự án/cơ hội kinh doanh.
   Vui lòng gỡ khách hàng khỏi các liên kết trước khi xóa."
  Nút: [Đóng]

Implementation trong App.tsx handleDeleteCustomer:
  try {
    await deleteCustomer(selectedCustomer.id);
    // success...
  } catch (error) {
    if (error instanceof Error && error.message.includes('422')) {
      // Hiện dependency modal thay vì toast
      setDependencyWarning({
        title: 'Không thể xóa khách hàng',
        message: `Khách hàng "${selectedCustomer.customer_name}" đang được sử dụng...`,
      });
    } else {
      addToast('error', 'Xóa thất bại', `...`);
    }
  }

NOTE: Cần kiểm tra v5Api.ts deleteCustomer có parse status code hay không.
  □ Audit parseErrorMessage: có truyền HTTP status code vào Error message không?
  □ Nếu không → cần thêm custom error class hoặc check error.message pattern
```

### 🟡 C-FIX-5 (Medium): Search không debounce — CRITICAL cho server mode

**Vấn đề:**

**CustomerList.tsx:249** — `onChange={(e) => setSearchTerm(e.target.value)}`
Ở server mode, `searchTerm` thay đổi → trigger `useEffect` (line 91-103) → gọi `onQueryChange` → API call.
→ MỖI keystroke = 1 API request. Gõ "Công ty ABC" = 12 API requests.

CusPersonnelList.tsx:478 — client-side nhưng vẫn nên debounce để giảm recompute.

**Giải pháp:**

```
CustomerList.tsx (server mode — QUAN TRỌNG):
  ├─ Thêm state: const [searchInput, setSearchInput] = useState(searchTerm)
  ├─ Input onChange → setSearchInput (instant, responsive UX)
  ├─ useEffect debounce:
  │    useEffect(() => {
  │      const timer = setTimeout(() => {
  │        setSearchTerm(searchInput);
  │        // Pagination reset: server mode → API tự xử lý qua query
  │        if (!serverMode) setCurrentPage(1);
  │      }, 300);
  │      return () => clearTimeout(timer);
  │    }, [searchInput]);
  ├─ URL sync vẫn dùng searchTerm (debounced)
  └─ External reset: khi clear filter → setSearchInput('') + setSearchTerm('')

CusPersonnelList.tsx (client-side — ít quan trọng hơn):
  ├─ Cùng pattern: searchInput + debounce 300ms
  ├─ Reset pagination: setCurrentPage(1) khi searchTerm thay đổi
  └─ Filter reset sync: clear tất cả filter states đồng thời

Không cần thư viện ngoài — dùng setTimeout + cleanup trong useEffect.
```

### 🟡 C-FIX-6 (Medium): CusPersonnelList pagination page correction trong render

**Vấn đề:**

`CusPersonnelList.tsx:251-253`:
```typescript
if (currentPage > totalPages && totalPages > 0) {
  setCurrentPage(totalPages);  // ← setState TRONG render body → React warning
}
```

So sánh: CustomerList.tsx:85-89 ĐÃ đúng — dùng `useEffect`.

**Giải pháp:**

```
Di chuyển vào useEffect (giống CustomerList pattern):

useEffect(() => {
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);

Xóa block if ở line 251-253.
```

### 🟡 C-FIX-7 (Medium): Export PDF title không dấu tiếng Việt

**Vấn đề:**

- `CustomerList.tsx:171`: `title: 'Danh sach khach hang'`
- `CusPersonnelList.tsx:365`: `title: 'Danh sach nhan su lien he'`

**Giải pháp:**

```
Thay bằng text có dấu:
- CustomerList.tsx:171    → title: 'Danh sách khách hàng'
- CusPersonnelList.tsx:365 → title: 'Danh sách nhân sự liên hệ'

NOTE: Cần verify exportPdfTable render Unicode đúng.
  □ Kiểm tra exportPdfTable trong exportUtils.ts dùng font gì
  □ Nếu dùng default PDF font (không hỗ trợ Vietnamese) → giữ không dấu
  □ Nếu dùng HTML-to-PDF (window.print) → có dấu OK
```

---

## 3. CẢI THIỆN UI/UX

### 🟡 C-UX-1: Empty state phân biệt rõ (2 component)

**Files:** `CustomerList.tsx:292-297`, `CusPersonnelList.tsx:615-616`

```
Hiện tại: Luôn hiện "Không tìm thấy dữ liệu."

CustomerList (server mode):
  Case 1 — totalItems === 0 && searchTerm === '' → chưa có data:
    Icon: groups_2 (to, mờ)
    "Chưa có khách hàng nào."
    "Nhấn [Thêm mới] để bắt đầu." (nếu canEdit)

  Case 2 — totalItems === 0 && searchTerm !== '' → search no match:
    Icon: search_off
    "Không tìm thấy khách hàng phù hợp."
    Nút: [Xóa bộ lọc]

  NOTE: server mode → dùng totalItems (từ paginationMeta.total) + searchTerm
        client mode → dùng filteredCustomers.length vs customers.length

CusPersonnelList:
  Case 1 — personnel.length === 0 → chưa có data:
    "Chưa có nhân sự liên hệ nào."
    "Nhấn [Thêm mới] để bắt đầu." (nếu canEdit)

  Case 2 — filteredPersonnel.length === 0 && personnel.length > 0 → filter no match:
    "Không tìm thấy nhân sự phù hợp."
    Nút: [Xóa bộ lọc]
```

### 🟡 C-UX-2: Nút "Xóa bộ lọc"

**Files:** `CustomerList.tsx`, `CusPersonnelList.tsx`

```
CustomerList:
  Khi searchTerm !== '':
    Hiện chip: "Đang lọc" + nút [Xóa bộ lọc]
    Click → resetFilters():
      setSearchInput('')
      setSearchTerm('')
      // server mode: onQueryChange sẽ tự trigger với q=''

CusPersonnelList:
  Khi searchTerm !== '' || positionFilter !== '' || statusFilter !== '' || phoneFilter !== '' || emailFilter !== '':
    Hiện chip: "Đang lọc: [X]" + nút [Xóa bộ lọc]
    Click → resetFilters():
      setSearchInput('')   // nếu thêm debounce
      setSearchTerm('')
      setPositionFilter('')
      setStatusFilter('')
      setPhoneFilter('')
      setEmailFilter('')
      setCurrentPage(1)
```

### 🟢 C-UX-3: Stats card bổ sung cho CusPersonnelList

**File:** `CusPersonnelList.tsx:461-470`

```
Hiện tại: 1 card "Tổng số" = personnel.length (gọi activeCount nhưng thực ra là total)

Đề xuất: 3 cards (grid đã sẵn sm:grid-cols-3)

  Card 1: Tổng số → personnel.length
  Card 2: Hoạt động (badge xanh) → personnel.filter(p => normalizeStatus(p.status) === 'Active').length
  Card 3: Không hoạt động (badge xám) → personnel.length - activeCount

Calculation (thêm useMemo):
  const realActiveCount = useMemo(() =>
    (personnel || []).filter(p => normalizeStatus(p.status) === 'Active').length,
    [personnel]
  );
  const inactiveCount = (personnel || []).length - realActiveCount;

NOTE: Biến hiện tại `activeCount` (line 42) thực ra = personnel.length (SAI tên).
  Rename: activeCount → totalCount, thêm realActiveCount + inactiveCount.
```

### 🟢 C-UX-4: CusPersonnelFormModal — đưa "Khách hàng" lên đầu form

**File:** `Modals.tsx:2435-2522`

```
Hiện tại: Họ tên → Ngày sinh → Chức vụ → SĐT → Email → Trạng thái → Khách hàng (CUỐI)

Đề xuất (nhóm theo logic):

  ┌─ Thông tin liên kết ─────────────────────┐
  │  Khách hàng *           (col-span-2)      │  ← ĐƯA LÊN ĐẦU
  ├─ Thông tin cá nhân ──────────────────────┤
  │  Họ và tên *           Ngày sinh          │
  ├─ Công việc ──────────────────────────────┤
  │  Chức vụ *             Trạng thái         │
  ├─ Liên hệ ───────────────────────────────┤
  │  Số điện thoại         Email              │
  └──────────────────────────────────────────┘

Lý do: Khách hàng là context quan trọng nhất — user cần chọn KH trước rồi mới nhập thông tin nhân sự.
```

### 🟢 C-UX-5: CusPersonnelList dùng PaginationControls thay pagination tự build

**File:** `CusPersonnelList.tsx:622-638`

```
Hiện tại:
  - ITEMS_PER_PAGE = 7 (cứng)
  - Pagination build thủ công: prev/next button + page numbers
  - User KHÔNG đổi được rows/page

Đề xuất:
  - Dùng PaginationControls component (đã import ở CustomerList)
  - Thêm state: const [rowsPerPage, setRowsPerPage] = useState(10)
  - Thay ITEMS_PER_PAGE → rowsPerPage

  <PaginationControls
    currentPage={currentPage}
    totalItems={totalItems}
    rowsPerPage={rowsPerPage}
    onPageChange={goToPage}
    onRowsPerPageChange={(rows) => {
      setRowsPerPage(rows);
      setCurrentPage(1);
    }}
  />

Xóa: block pagination tự build (line 622-638).
```

---

## 4. FILES CẦN SỬA

### Phase 1 — Fix lỗi logic (independently deployable)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 1a | `frontend/components/Modals.tsx` | **CustomerFormModal (line 2254-2277)**: thêm `errors` state, `isSubmitting` state, `validateCustomerForm()`, `handleSubmit()` async, loading spinner trên nút Lưu, inline error hiển thị. Đổi onSave type → `Promise<void>`. **CusPersonnelFormModal (line 2405-2418)**: thêm `isSubmitting` state, đổi `handleSubmit()` → async, disabled button khi submitting. |
| 1b | `frontend/components/CustomerList.tsx` | Thêm props `canEdit`/`canDelete`. Conditional render cột Thao tác + nút Edit/Delete. Conditional render nút Thêm mới + Nhập. Sửa colSpan empty state. |
| 1c | `frontend/components/CusPersonnelList.tsx` | Thêm props `canEdit`/`canDelete`. Conditional render cột Thao tác + nút Edit/Delete. Conditional render nút Thêm mới + Nhập. Di chuyển pagination page correction vào useEffect (line 251). Sửa colSpan empty state. |
| 1d | `frontend/App.tsx` | Truyền `canEdit`/`canDelete` props cho CustomerList + CusPersonnelList. Sửa `handleSaveCustomer` thêm re-throw khi fail (cho modal catch). Sửa `handleDeleteCustomer` detect 422 → modal dependency warning. Tương tự `handleSaveCusPersonnel` thêm re-throw. |

### Phase 2 — Cải thiện UI/UX (independently deployable, SAU Phase 1)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 2a | `frontend/components/CustomerList.tsx` | Debounce search 300ms (thêm `searchInput` state, useEffect timer). Empty state phân biệt 2 cases. Nút "Xóa bộ lọc". |
| 2b | `frontend/components/CusPersonnelList.tsx` | Debounce search 300ms. Empty state phân biệt 2 cases. Nút "Xóa bộ lọc". Stats cards 3 cột (total/active/inactive). Rename `activeCount` → đúng ngữ nghĩa. Thay pagination tự build → PaginationControls + rowsPerPage state. |
| 2c | `frontend/components/Modals.tsx` | CusPersonnelFormModal: reorder fields (KH → Họ tên → Ngày sinh → Chức vụ → TT → SĐT → Email). |
| 2d | `frontend/components/CustomerList.tsx` + `CusPersonnelList.tsx` | Sửa export PDF title có dấu tiếng Việt (verify font support trước). |

**Nguyên tắc:** Phase 1 và Phase 2 KHÔNG chồng chéo logic. Phase 1 deploy + test độc lập. Phase 2 chỉ UX polish.

**Không có thay đổi backend.** Toàn bộ fix/cải thiện nằm ở FE.

---

## 5. PHASED ROLLOUT

### Phase 1: Fix lỗi logic (Critical + High)
```
1.1  Thêm form validation vào CustomerFormModal (C-FIX-1)
1.2  Thêm loading state vào CustomerFormModal + CusPersonnelFormModal (C-FIX-2)
1.3  Thêm permission-based button visibility — CustomerList + CusPersonnelList (C-FIX-3)
1.4  Cải thiện error handling khi xóa customer — dependency modal (C-FIX-4)
1.5  Di chuyển CusPersonnelList pagination correction vào useEffect (C-FIX-6)

Acceptance test Phase 1:
  □ Submit CustomerForm trống → inline errors hiện cho customer_code + customer_name
  □ Submit CustomerForm đúng → nút Lưu disable + spinner, API gọi 1 lần
  □ Double-click nút Lưu → chỉ 1 API request (cả CustomerForm + CusPersonnelForm)
  □ API fail → nút Lưu enable lại, modal vẫn mở, toast error hiện
  □ User read-only → KHÔNG thấy nút Edit/Delete/Thêm mới/Nhập (cả 2 list)
  □ User có quyền write → thấy đầy đủ buttons
  □ Xóa customer đang dùng trong project → modal cảnh báo rõ (không phải toast)
  □ CusPersonnelList: không có React warning về setState trong render
```

### Phase 2: Cải thiện UI/UX
```
2.1  Search debounce 300ms — CustomerList + CusPersonnelList (C-FIX-5)
2.2  Empty state phân biệt (C-UX-1)
2.3  Nút "Xóa bộ lọc" (C-UX-2)
2.4  Stats cards 3 cột cho CusPersonnelList (C-UX-3)
2.5  Reorder fields CusPersonnelFormModal — KH lên đầu (C-UX-4)
2.6  CusPersonnelList dùng PaginationControls (C-UX-5)
2.7  Export PDF title có dấu (C-FIX-7)

Acceptance test Phase 2:
  □ Gõ search nhanh (CustomerList server mode) → chỉ 1 API call sau 300ms dừng gõ
  □ Gõ search nhanh (CusPersonnelList) → không lag, filter sau 300ms
  □ Bảng trống + không search → "Chưa có khách hàng nào" + CTA thêm mới
  □ Bảng trống + có search → "Không tìm thấy" + nút xóa bộ lọc
  □ Click "Xóa bộ lọc" → reset tất cả filter, hiện lại data
  □ Stats CusPersonnel: 3 cards Tổng / Hoạt động / Không hoạt động
  □ CusPersonnelFormModal: field Khách hàng ở đầu form
  □ CusPersonnelList: có dropdown chọn số dòng/trang (10/20/50)
  □ Export PDF → title có dấu tiếng Việt (nếu font hỗ trợ)
```

---

## 6. BẢNG TỔNG HỢP

| # | Thay đổi | Ưu tiên | Effort | Phase | Impact |
|---|---------|---------|--------|-------|--------|
| C-FIX-1 | CustomerFormModal validation | ⭐⭐⭐ | Nhỏ | 1 | Data quality + UX |
| C-FIX-2 | Loading state (cả 2 modal) | ⭐⭐⭐ | Nhỏ | 1 | Prevent duplicate |
| C-FIX-3 | Permission-based button visibility | ⭐⭐⭐ | Nhỏ | 1 | Security UX |
| C-FIX-4 | Delete dependency warning modal | ⭐⭐ | Nhỏ | 1 | UX |
| C-FIX-5 | Search debounce (server mode critical) | ⭐⭐⭐ | Rất nhỏ | 2 | Performance |
| C-FIX-6 | Pagination correction → useEffect | ⭐⭐ | Rất nhỏ | 1 | React correctness |
| C-FIX-7 | Export PDF title có dấu | ⭐ | Rất nhỏ | 2 | UX |
| C-UX-1 | Empty state phân biệt | ⭐⭐ | Nhỏ | 2 | UX |
| C-UX-2 | Nút xóa bộ lọc | ⭐⭐ | Rất nhỏ | 2 | UX |
| C-UX-3 | Stats cards 3 cột (CusPersonnel) | ⭐ | Rất nhỏ | 2 | UX |
| C-UX-4 | Reorder CusPersonnel form fields | ⭐ | Rất nhỏ | 2 | UX |
| C-UX-5 | PaginationControls cho CusPersonnel | ⭐⭐ | Nhỏ | 2 | UX |

**Tổng effort ước tính:** ~3-4 giờ (Phase 1: ~2h, Phase 2: ~1.5h)
**Không có thay đổi backend. Không cần migration. Không ảnh hưởng API contract.**

---

## 📎 SO SÁNH VỚI PLAN SẢN PHẨM

| Vấn đề | Plan Sản phẩm | Plan Khách hàng | Ghi chú |
|--------|--------------|-----------------|---------|
| normalizeProductUnit bug | ✅ FIX-1 Critical | N/A | Khách hàng không có hàm tương tự |
| Form validation | ✅ FIX-2 | ✅ C-FIX-1 | Cùng pattern — CustomerFormModal thiếu validate |
| Loading state | ✅ FIX-2 | ✅ C-FIX-2 | Cùng pattern — thêm isSubmitting |
| Permission buttons | ✅ FIX-3 | ✅ C-FIX-3 | Cùng pattern — 2 list cần fix |
| Delete FK warning | ✅ FIX-4 | ✅ C-FIX-4 | Cùng approach — detect 422 |
| window.alert | ✅ FIX-5 | N/A | Khách hàng ĐÃ dùng onNotify ✅ |
| Search debounce | ✅ UX-1 | ✅ C-FIX-5 | Ở KH server mode → critical hơn |
| Empty state | ✅ UX-3 | ✅ C-UX-1 | Cùng pattern |
| Form reorder | ✅ UX-2 | ✅ C-UX-4 | CusPersonnelForm KH field cuối |
| Xóa bộ lọc | ✅ UX-6 | ✅ C-UX-2 | Cùng pattern |
| Stats card | ✅ UX-4 | ✅ C-UX-3 | CusPersonnel stats sai tên biến |

**Có thể tái sử dụng code/pattern từ plan Sản phẩm khi implement.**
