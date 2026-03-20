# Plan: Nâng cấp UI/UX & Dashboard — Tab Hợp đồng

> **Output:** Sau khi approve, plan sẽ được lưu vào `plan-code/Nang_cap_Hop_dong_Dashboard.md`

> **Version:** v1.0
> **Ngày:** 2026-03-20
> **Scope:** ContractList.tsx, Dashboard.tsx, PaymentScheduleTab.tsx, App.tsx, types.ts
> **Baseline:** Code đã đọc và phân tích ngày 2026-03-20

---

## MỤC LỤC

1. [HIỆN TRẠNG](#1-hiện-trạng)
2. [FIX LỖI & THIẾU HỤT CHỨC NĂNG (Phase 1)](#2-fix-lỗi--thiếu-hụt-chức-năng)
3. [NÂNG CẤP KPI & DASHBOARD (Phase 2)](#3-nâng-cấp-kpi--dashboard)
4. [UI/UX POLISH (Phase 3)](#4-uiux-polish)
5. [FILES CẦN SỬA](#5-files-cần-sửa)
6. [PHASED ROLLOUT](#6-phased-rollout)
7. [BẢNG TỔNG HỢP](#7-bảng-tổng-hợp)

---

## 1. HIỆN TRẠNG

### Đã có sẵn (KHÔNG cần làm)
- ✅ CRUD đầy đủ: Thêm / Sửa / Xóa contract (ContractModal, App.tsx handlers)
- ✅ Bảng danh sách với sort 9 cột, search, filter theo status (ContractList.tsx)
- ✅ Pagination server-side với PaginationControls (ContractList.tsx:366-375)
- ✅ 4 KPI cards: Tổng HĐ, Đã ký, Sắp hết hạn, KH sắp thanh toán (ContractList.tsx:241-270)
- ✅ Permission gate ở handleOpenModal (App.tsx:4645) và các handler TT
- ✅ PaymentScheduleTab với TABLE/TIMELINE view, filter, export Excel, xác nhận thu tiền
- ✅ Dashboard với 4 FinanceCard, monthly revenue chart, pipeline donut, project status bars
- ✅ Alert settings cho hết hạn HĐ và thanh toán (App.tsx:5890-5933)

### Cần fix / cải thiện
- ❌ Search không debounce → gõ mỗi ký tự trigger server query
- ❌ Nút Edit/Delete hiện cho mọi user (không check permission ở component)
- ❌ Không có chức năng export (Excel/CSV/PDF) cho danh sách HĐ
- ❌ Empty state không phân biệt "chưa có data" vs "filter không khớp"
- ❌ Không có nút "Xóa bộ lọc" khi filter active
- ❌ `window.confirm()` trong PaymentScheduleTab (dòng 304)
- ❌ KPI cards chỉ hiện COUNT, thiếu tổng giá trị HĐ và progress indicators
- ❌ Dashboard không có widget: phân bổ trạng thái HĐ, cảnh báo hết hạn, tỷ lệ thu tiền, quá hạn TT
- ❌ Loading state chỉ là text "Đang tải dữ liệu...", không có skeleton

---

## 2. FIX LỖI & THIẾU HỤT CHỨC NĂNG

### 🔴 FIX-1 (Critical): Search không debounce

**Vấn đề:** `ContractList.tsx:33,279` — `setSearchTerm(e.target.value)` trigger trực tiếp → `useEffect` (dòng 176-191) gọi `onQueryChange` mỗi keystroke.

**Giải pháp:**

```
Tách state thành 2 biến (pattern giống UX-1 trong plan Sản phẩm):

State mới:
  const [searchInput, setSearchInput] = useState('');      // giá trị input (instant)
  const [searchTerm, setSearchTerm] = useState('');        // giá trị debounced (350ms)

useEffect debounce:
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);  // ← RESET pagination khi filter thay đổi
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

Input onChange (dòng 279): setSearchInput(e.target.value)
Input value (dòng 278): value={searchInput}

useMemo filtering (dòng 81): dùng searchTerm (debounced)
useEffect query (dòng 182): dùng searchTerm (debounced)

Shared reset function (dùng chung với FIX-4):
  const resetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setStatusFilter('');
    setCurrentPage(1);
  };

Verification:
  □ Gõ nhanh 5 ký tự → chỉ 1 request sau 350ms
  □ Xóa hết text → kết quả reset về toàn bộ
  □ Server mode: onQueryChange chỉ trigger sau debounce
```

### 🔴 FIX-2 (Critical): Nút Edit/Delete hiện cho mọi user

**Vấn đề:** `ContractList.tsx` — không nhận permission props → luôn render nút Thêm mới/Sửa/Xóa cho tất cả user.

**Tham chiếu:** ProductList đã triển khai pattern `canEdit`/`canDelete` props.

**Giải pháp:**

```
Bước 1: Thêm props vào ContractListProps (dòng 13):
  interface ContractListProps {
    ...existing props...
    canAdd?: boolean;      // contracts.write — default true (backward-compatible)
    canEdit?: boolean;     // contracts.write — default false
    canDelete?: boolean;   // contracts.write — default false
    onNotify?: (type: 'success' | 'error', title: string, message: string) => void;
  }

Bước 2: Conditional render:
  - Nút "Thêm mới" (dòng 231-237): bọc trong {canAdd && (...)}
  - Nút "Sửa" (dòng 349): bọc trong {canEdit && (...)}
  - Nút "Xóa" (dòng 350): bọc trong {canDelete && (...)}
  - Tính showActionColumn = canEdit || canDelete
  - Cột "Thao tác" header (dòng 321): ẩn nếu !showActionColumn
  - colSpan empty state: điều chỉnh theo showActionColumn

Bước 3: App.tsx (dòng 6367-6375) — truyền props:
  <ContractList
    ...existing props...
    canAdd={hasPermission(authUser, 'contracts.write')}
    canEdit={hasPermission(authUser, 'contracts.write')}
    canDelete={hasPermission(authUser, 'contracts.write')}
    onNotify={addToast}
  />

Verification:
  □ User read-only → KHÔNG thấy nút Thêm mới/Sửa/Xóa
  □ User có quyền write → thấy đầy đủ
  □ !showActionColumn → cột Thao tác ẩn hoàn toàn
  □ Backward compatible: không truyền props → hiện nút Thêm mới, ẩn Sửa/Xóa
```

### 🟡 FIX-3 (High): Empty state không phân biệt

**Vấn đề:** `ContractList.tsx:355-361` — chỉ có 1 message "Không tìm thấy hợp đồng." cho mọi trường hợp.

**Tham chiếu:** PaymentScheduleTab.tsx:624-625 đã phân biệt theo filter.

**Giải pháp:**

```
Tính biến phân biệt (dùng filteredContracts, KHÔNG dùng currentData):
  const isEmptyData = totalContractsKpi === 0 && !searchTerm && !statusFilter;
  const isFilterNoMatch = !isEmptyData && currentData.length === 0 && !isLoading;
  const colCount = showActionColumn ? 10 : 9;

Thay dòng 355-361:

  Case 1 — isLoading:
    → Skeleton loading rows (xem UX-6)

  Case 2 — isEmptyData (chưa có HĐ nào):
    Icon: description (to, mờ)
    "Chưa có hợp đồng nào."
    "Bắt đầu bằng cách thêm mới hợp đồng đầu tiên."
    Nút: [Thêm mới] (nếu canAdd)

  Case 3 — isFilterNoMatch (filter không match):
    Icon: filter_list_off
    "Không tìm thấy hợp đồng phù hợp."
    "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
    Nút: [Xóa bộ lọc] → gọi resetFilters()

Verification:
  □ 0 HĐ + không filter → "Chưa có hợp đồng nào" + CTA thêm mới
  □ Có data + filter no match → "Không tìm thấy" + nút xóa lọc
  □ isLoading → skeleton (hoặc loading text tạm thời trong Phase 1)
```

### 🟡 FIX-4 (High): Không có nút "Xóa bộ lọc"

**Vấn đề:** `ContractList.tsx:272-292` — Khi search/filter active, user phải xóa text và chọn lại dropdown thủ công.

**Giải pháp:**

```
Tính: const hasActiveFilter = searchInput.trim() !== '' || statusFilter !== '';

Thêm sau SearchableSelect (sau dòng 291):
  {hasActiveFilter && (
    <button
      onClick={resetFilters}
      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-500
        hover:text-error bg-slate-100 hover:bg-red-50 rounded-lg transition-colors"
    >
      <span className="material-symbols-outlined text-sm">filter_list_off</span>
      Xóa lọc
    </button>
  )}

Thêm nút clear (×) inline trong ô search (dòng 276-282):
  {searchInput && (
    <button onClick={() => { setSearchInput(''); setSearchTerm(''); setCurrentPage(1); }}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
      <span className="material-symbols-outlined text-sm">close</span>
    </button>
  )}

resetFilters() đã define ở FIX-1 — dùng chung.

Verification:
  □ Gõ text + chọn filter → hiện nút "Xóa lọc"
  □ Click "Xóa lọc" → reset tất cả, page = 1
  □ Không có filter active → nút ẩn
  □ Click × trong ô search → chỉ clear search, giữ status filter
```

### 🟡 FIX-5 (High): Thiếu chức năng export cho danh sách HĐ

**Vấn đề:** Tab Hợp đồng không có export, trong khi ProductList (dòng 351-387) và PaymentScheduleTab (dòng 353-384) đều có.

**Tham chiếu:**
- `frontend/utils/exportUtils.ts` — đã có sẵn `exportCsv`, `exportExcel`, `exportPdfTable`, `isoDateStamp`
- `frontend/utils/excelTemplate.ts` — `downloadExcelWorkbook`
- ProductList export pattern

**Giải pháp:**

```
Import:
  import { exportCsv, exportPdfTable, isoDateStamp } from '../utils/exportUtils';
  import { downloadExcelWorkbook } from '../utils/excelTemplate';

State:
  const [showExportMenu, setShowExportMenu] = useState(false);

Hàm handleExport:
  const handleExport = (type: 'excel' | 'csv' | 'pdf') => {
    setShowExportMenu(false);
    const fileName = `HopDong_${isoDateStamp()}`;
    const headers = ['Mã HĐ', 'Tên HĐ', 'Khách hàng', 'Dự án', 'Chu kỳ TT',
                     'Giá trị HĐ', 'Ngày ký', 'Ngày hiệu lực', 'Trạng thái'];
    const dataToExport = serverMode ? (contracts || []) : filteredContracts;
    const rows = dataToExport.map(item => [
      item.contract_code, item.contract_name,
      getCustomerName(item.customer_id), getProjectName(item.project_id),
      getPaymentCycleLabel(item.payment_cycle),
      item.value || 0,
      formatDate(item.sign_date || null), formatDate(item.effective_date || null),
      getStatusLabel(item.status),
    ]);
    if (type === 'excel') downloadExcelWorkbook(fileName, [{ name: 'HopDong', headers, rows }]);
    if (type === 'csv') exportCsv(fileName, headers, rows);
    if (type === 'pdf') exportPdfTable({ fileName, title: 'Danh sách Hợp đồng', headers, rows });
  };

UI: Nút Export cạnh nút "Thêm mới" (dòng 230) — dropdown 3 options.
Pattern giống ProductList: relative wrapper + showExportMenu toggle + dropdown panel.

PDF popup blocked: dùng onNotify thay vì window.alert (nếu popup bị chặn).

Verification:
  □ Click Export → dropdown 3 options (Excel, CSV, PDF)
  □ Chọn Excel → tải file .xlsx đúng format
  □ Chọn CSV → tải file .csv
  □ Chọn PDF → mở popup print
  □ Click ngoài dropdown → đóng menu
  □ Export data = filteredContracts (client) hoặc contracts (server)
```

### 🟡 FIX-6 (High): `window.confirm()` trong PaymentScheduleTab

**Vấn đề:** `PaymentScheduleTab.tsx:304` — `window.confirm('Gỡ file này khỏi kỳ thanh toán?')` không theo design system.

**Giải pháp:**

```
State mới:
  const [pendingRemoveAttachmentId, setPendingRemoveAttachmentId] = useState<string | null>(null);

Sửa handleRemoveAttachment (dòng 299-310):
  // Thay window.confirm bằng set state
  const handleRemoveAttachment = (id: string) => {
    if (isReadOnlyConfirm) return;
    setPendingRemoveAttachmentId(id);
  };

  const confirmRemoveAttachment = () => {
    if (pendingRemoveAttachmentId) {
      setAttachments(prev => prev.filter(a => String(a.id) !== pendingRemoveAttachmentId));
      setPendingRemoveAttachmentId(null);
    }
  };

Thêm mini confirmation dialog (trước dòng 865, trong cùng JSX):
  {pendingRemoveAttachmentId && (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30"
        onClick={() => setPendingRemoveAttachmentId(null)} />
      <div className="relative bg-white rounded-xl p-5 shadow-xl max-w-sm w-full animate-fade-in">
        <p className="text-sm font-semibold text-slate-900 mb-2">Xác nhận gỡ file</p>
        <p className="text-sm text-slate-600 mb-4">Bạn có chắc muốn gỡ file này khỏi kỳ thanh toán?</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setPendingRemoveAttachmentId(null)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100">
            Hủy
          </button>
          <button onClick={confirmRemoveAttachment}
            className="px-3 py-1.5 rounded-lg bg-error text-white text-sm font-semibold hover:bg-red-600">
            Gỡ file
          </button>
        </div>
      </div>
    </div>
  )}

Verification:
  □ Click xóa attachment → hiện custom dialog
  □ Click "Hủy" → đóng dialog, file còn nguyên
  □ Click "Gỡ file" → file bị xóa
  □ ESC hoặc click overlay → đóng dialog
```

---

## 3. NÂNG CẤP KPI & DASHBOARD

### 🟡 UX-1: Nâng cấp KPI cards — thêm tổng giá trị & mini progress bars

**File:** `ContractList.tsx:241-270`

```
Hiện tại: 4 cards chỉ hiện số lượng (count)

Đề xuất: Thêm 1 card "Tổng giá trị HĐ đã ký" + mini progress bars

Layout mới: 5 cards hoặc 2 hàng
  Hàng 1 (2 cards lớn, md:grid-cols-2):
    ┌─ Tổng giá trị HĐ đã ký ─────────────────┐  ┌─ Tỷ lệ thu tiền ─────────────────────┐
    │  formatCurrency(signedTotalValue)          │  │  XX% (circular SVG mini indicator)    │
    │  hint: "Tổng giá trị tất cả HĐ đã ký"    │  │  hint: "Đã thu / Dự kiến thu"        │
    └───────────────────────────────────────────┘  └───────────────────────────────────────┘

  Hàng 2 (4 cards nhỏ, xl:grid-cols-4 — giữ nguyên nhưng nâng cấp):
    ┌─ Tổng số HĐ ──────┐  ┌─ Đã ký kết ─────┐  ┌─ Sắp hết hiệu lực ─┐  ┌─ KH sắp TT ──────┐
    │  {totalContractsKpi}│  │  {signedKpi}      │  │  {expiringSoonKpi}  │  │  {upcomingKpi}     │
    │  X soạn · Y gia hạn│  │  ██████░░ XX%    │  │  ⚠ trong N ngày     │  │  trong N ngày      │
    └────────────────────┘  └──────────────────┘  └────────────────────┘  └────────────────────┘

Card "Tổng số HĐ" — thêm sub-text breakdown:
  <p className="text-xs text-slate-400 mt-1">
    {draftCount} đang soạn · {renewedCount} đã gia hạn
  </p>

Card "Đã ký kết" — thêm mini progress bar:
  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
    <div className="h-full bg-green-500 rounded-full transition-all"
      style={{ width: `${safePercent(signedKpi, totalKpi)}%` }} />
  </div>
  <p className="text-xs text-slate-400 mt-1">{safePercent(signedKpi, totalKpi)}% tổng HĐ</p>

Card "Sắp hết hiệu lực" — đổi icon + highlight nếu > 0:
  Nếu expiringSoonKpi > 0: bg-orange-50 border-orange-200 (nổi bật)
  Nếu === 0: giữ style bình thường

Tính toán cần thêm trong component:
  const draftCount = server KPI hoặc contracts.filter(c => c.status === 'DRAFT').length;
  const renewedCount = server KPI hoặc contracts.filter(c => c.status === 'RENEWED').length;
  const signedTotalValue = server KPI hoặc contracts
    .filter(c => c.status === 'SIGNED').reduce((s, c) => s + (c.value || 0), 0);
  const safePercent = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;

Nếu backend hỗ trợ: mở rộng PaginationMeta.kpis (types.ts) thêm:
  draft_count?, renewed_count?, signed_value?, collection_rate?
  → Dùng server value khi có, fallback tính từ local data.
```

### 🟡 UX-2: Dashboard — Widget phân bổ trạng thái hợp đồng

**File:** `Dashboard.tsx` (thêm mới), `types.ts:1506-1514`, `App.tsx:6088`

```
Mở rộng DashboardStats (types.ts dòng 1506):
  export interface DashboardStats {
    ...existing 7 fields...
    contractStatusCounts: ContractStatusBreakdown[];  // MỚI
    collectionRate: number;                           // MỚI (0-100)
    overduePaymentCount: number;                      // MỚI
    overduePaymentAmount: number;                     // MỚI
  }

  // Thêm interface mới:
  export interface ContractStatusBreakdown {
    status: ContractStatus;
    count: number;
    totalValue: number;
  }

Tính trong App.tsx (sau dòng 6086):
  const contractStatusCounts: ContractStatusBreakdown[] = ['DRAFT','SIGNED','RENEWED']
    .map(status => ({
      status,
      count: contracts.filter(c => c.status === status).length,
      totalValue: contracts.filter(c => c.status === status)
        .reduce((s, c) => s + (c.value || 0), 0),
    }));

  const totalExpected = paymentSchedules
    .reduce((s, p) => s + Number(p.expected_amount || 0), 0);
  const totalCollected = paymentSchedules
    .filter(p => p.status === 'PAID')
    .reduce((s, p) => s + Number(p.actual_paid_amount || 0), 0);
  const collectionRate = totalExpected > 0
    ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const overdueSchedules = paymentSchedules.filter(p => p.status === 'OVERDUE');
  const overduePaymentCount = overdueSchedules.length;
  const overduePaymentAmount = overdueSchedules
    .reduce((s, p) => s + Math.max(0, Number(p.expected_amount||0) - Number(p.actual_paid_amount||0)), 0);

Widget UI — Donut chart CSS (reuse buildPieGradient pattern dòng 370-394):
  Màu: DRAFT=#f59e0b (amber), SIGNED=#22c55e (green), RENEWED=#3b82f6 (blue)
  Hiện: donut bên trái + breakdown list bên phải (giống PipelineCard dòng 260-323)
  Mỗi item: status label + count + totalValue formatted

Vị trí: Thêm hàng mới DƯỚI grid pipeline+project (sau dòng 218):
  <div className="grid gap-6 lg:grid-cols-2">
    <ContractStatusWidget data={stats.contractStatusCounts} />
    <CollectionRateWidget rate={stats.collectionRate}
      overdueCount={stats.overduePaymentCount}
      overdueAmount={stats.overduePaymentAmount} />
  </div>
```

### 🟡 UX-3: Dashboard — Widget cảnh báo HĐ sắp hết hiệu lực

**File:** `Dashboard.tsx`, `App.tsx`

```
Tính trong App.tsx:
  const WARNING_DAYS = 30;
  const nowMs = Date.now();
  const expiringContracts = (contracts || [])
    .filter(c => c.expiry_date && c.status !== 'DRAFT')
    .map(c => {
      const daysRemaining = Math.ceil((new Date(c.expiry_date!).getTime() - nowMs) / 86_400_000);
      const customer = customers.find(cus => String(cus.id) === String(c.customer_id));
      return {
        id: c.id, contract_code: c.contract_code, contract_name: c.contract_name,
        customer_name: customer?.customer_name || '',
        expiry_date: c.expiry_date!, daysRemaining, value: c.value,
      };
    })
    .filter(c => c.daysRemaining >= 0 && c.daysRemaining <= WARNING_DAYS)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

Mở rộng DashboardStats + dashboardStats object:
  expiringContracts: ExpiringContractSummary[] (thêm interface vào types.ts)

Widget UI:
  Card dạng list, header "HĐ sắp hết hiệu lực" + icon warning
  Mỗi item: mã HĐ + tên KH + badge "X ngày" (đỏ nếu ≤ 7, vàng nếu 8-30)
  Empty: "Không có HĐ nào sắp hết hạn trong 30 ngày tới"

Vị trí: Cùng hàng hoặc dưới UX-2 widgets
```

### 🟡 UX-4: Dashboard — Tỷ lệ thu tiền + cảnh báo quá hạn

**File:** `Dashboard.tsx`

```
Collection Rate Widget — Circular progress (SVG, không cần thư viện):
  <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
    <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="8"
      strokeDasharray={`${collectionRate * 2.51} 251`} strokeLinecap="round" />
  </svg>
  Center text: {collectionRate}%

Overdue Payment Alert — Nổi bật nếu count > 0:
  Background gradient: from-red-50 to-orange-50, border-red-200
  Header: "X kỳ thanh toán quá hạn"
  Sub: "Tổng nợ: {formatCurrency(overdueAmount)}"
  Nếu count === 0: ẩn card hoặc hiện "Không có kỳ thanh toán quá hạn" (xanh)

Cả 2 widget lấy data từ dashboardStats đã tính ở UX-2.
```

---

## 4. UI/UX POLISH

### 🟢 UX-5: Loading skeleton cho bảng HĐ

**File:** `ContractList.tsx:355-361`

```
Khi isLoading = true, render 5 skeleton rows thay vì text:
  {isLoading && Array.from({ length: 5 }).map((_, i) => (
    <tr key={`skel-${i}`}>
      <td className="px-6 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
      ...9 cột...
    </tr>
  ))}

Cũng thêm skeleton cho KPI cards khi loading.

Pattern: animate-pulse + rounded bg-slate-200 (đã có trong codebase).
```

### 🟢 UX-6: Status badges với icons

**File:** `ContractList.tsx:342-345`

```
Map icon cho mỗi ContractStatus:
  DRAFT: 'edit_note'    (đang soạn)
  SIGNED: 'verified'    (đã ký)
  RENEWED: 'autorenew'  (đã gia hạn)

Sửa badge render:
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
    {label}
  </span>
```

### 🟢 UX-7: Responsive card view cho mobile

**File:** `ContractList.tsx`

```
Trên viewport < md (768px): option chuyển sang card view thay vì table.
Mỗi card hiện: Mã HĐ + Status badge (header), Tên HĐ, Khách hàng, Giá trị, Ngày ký.
Toggle button Bảng/Thẻ (tương tự PaymentScheduleTab TABLE/TIMELINE toggle).

Lưu ý: Chỉ triển khai nếu effort phù hợp. Có thể defer sang version sau.
```

---

## 5. FILES CẦN SỬA

### Phase 1 — Fix lỗi & thiếu hụt (independently deployable)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 1a | `frontend/components/ContractList.tsx` | Debounce search (searchInput + searchTerm + useEffect timer). Thêm props canAdd/canEdit/canDelete/onNotify. Conditional render buttons. Empty state phân biệt. Nút "Xóa lọc" + clear × trong search. Export menu + handleExport. Import từ exportUtils + excelTemplate |
| 1b | `frontend/components/PaymentScheduleTab.tsx` | Thay window.confirm → custom dialog. Thêm state pendingRemoveAttachmentId |
| 1c | `frontend/App.tsx` | Truyền canAdd/canEdit/canDelete/onNotify props cho ContractList (dòng 6367-6375) |

### Phase 2 — Nâng cấp KPI & Dashboard (independently deployable, SAU Phase 1)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 2a | `frontend/types.ts` | Mở rộng DashboardStats interface: thêm contractStatusCounts, collectionRate, overduePaymentCount, overduePaymentAmount, expiringContracts. Thêm interfaces ContractStatusBreakdown, ExpiringContractSummary |
| 2b | `frontend/App.tsx` | Tính contractStatusCounts, collectionRate, overduePayment*, expiringContracts. Truyền vào dashboardStats object (dòng 6088-6096) |
| 2c | `frontend/components/Dashboard.tsx` | Thêm ContractStatusWidget (donut chart). Thêm CollectionRateWidget (SVG circular progress). Thêm ExpiringContractsWidget (list). Thêm OverduePaymentAlert (conditional card) |
| 2d | `frontend/components/ContractList.tsx` | Nâng cấp KPI cards: thêm card tổng giá trị, mini progress bars, sub-text breakdown, highlight sắp hết hạn |

### Phase 3 — UI/UX Polish (independently deployable, SAU Phase 2)

| # | File | Thay đổi cụ thể |
|---|------|-----------------|
| 3a | `frontend/components/ContractList.tsx` | Loading skeleton (5 rows + KPI cards). Status badges icons. Responsive card view (optional) |

---

## 6. PHASED ROLLOUT

### Phase 1: Fix lỗi & thiếu hụt
```
1.1  Search debounce 350ms (FIX-1)
1.2  Permission-based button visibility (FIX-2)
1.3  Empty state phân biệt (FIX-3)
1.4  Nút "Xóa bộ lọc" (FIX-4)
1.5  Export Excel/CSV/PDF (FIX-5)
1.6  Thay window.confirm → custom dialog (FIX-6)

Acceptance test Phase 1:
  □ Gõ nhanh search → chỉ 1 request sau 350ms
  □ User read-only → KHÔNG thấy nút Thêm mới/Sửa/Xóa
  □ 0 HĐ + không filter → "Chưa có hợp đồng nào" + CTA
  □ Có data + filter no match → "Không tìm thấy" + nút xóa lọc
  □ Click "Xóa lọc" → reset search + filter + page
  □ Export Excel → tải file .xlsx thành công
  □ Export CSV → tải file .csv thành công
  □ Export PDF → mở popup print
  □ Xóa attachment → custom dialog (không phải browser confirm)
```

### Phase 2: Nâng cấp KPI & Dashboard
```
2.1  Mở rộng DashboardStats interface (UX-2 prerequisite)
2.2  Tính contract metrics trong App.tsx (UX-2)
2.3  Dashboard: widget phân bổ trạng thái HĐ — donut (UX-2)
2.4  Dashboard: widget cảnh báo HĐ sắp hết hạn (UX-3)
2.5  Dashboard: tỷ lệ thu tiền + cảnh báo quá hạn (UX-4)
2.6  Nâng cấp KPI cards ContractList (UX-1)

Acceptance test Phase 2:
  □ Dashboard hiện donut chart 3 trạng thái HĐ đúng tỷ lệ
  □ Dashboard hiện danh sách HĐ sắp hết hạn (≤ 30 ngày)
  □ Dashboard hiện circular progress tỷ lệ thu tiền
  □ Dashboard hiện cảnh báo đỏ khi có kỳ TT quá hạn
  □ Không có HĐ nào → empty placeholder đúng
  □ KPI cards hiện tổng giá trị HĐ đã ký (format VND)
  □ KPI "Đã ký" có mini progress bar
  □ KPI "Tổng số" có sub-text breakdown (X soạn · Y gia hạn)
  □ KPI "Sắp hết hạn" highlight nếu > 0
```

### Phase 3: UI/UX Polish
```
3.1  Loading skeleton rows + KPI skeleton (UX-5)
3.2  Status badges với icons (UX-6)
3.3  Responsive card view mobile (UX-7) — optional

Acceptance test Phase 3:
  □ Loading → skeleton rows animation mượt
  □ Mỗi status badge có icon phù hợp
  □ Mobile: card view (nếu implement)
```

---

## 7. BẢNG TỔNG HỢP

| # | Thay đổi | Ưu tiên | Effort | Phase | Impact |
|---|---------|---------|--------|-------|--------|
| FIX-1 | Search debounce 350ms | ⭐⭐⭐ | Rất nhỏ | 1 | Performance |
| FIX-2 | Permission-based buttons | ⭐⭐⭐ | Nhỏ | 1 | Security UX |
| FIX-3 | Empty state phân biệt | ⭐⭐ | Nhỏ | 1 | UX |
| FIX-4 | Nút "Xóa bộ lọc" | ⭐⭐ | Rất nhỏ | 1 | UX |
| FIX-5 | Export Excel/CSV/PDF | ⭐⭐ | Nhỏ | 1 | Feature |
| FIX-6 | Thay window.confirm | ⭐⭐ | Rất nhỏ | 1 | UX |
| UX-1 | Nâng cấp KPI cards | ⭐⭐ | Nhỏ | 2 | UX |
| UX-2 | Dashboard: status donut | ⭐⭐ | Trung bình | 2 | Dashboard |
| UX-3 | Dashboard: cảnh báo hết hạn | ⭐⭐ | Nhỏ | 2 | Dashboard |
| UX-4 | Dashboard: tỷ lệ thu + quá hạn | ⭐⭐ | Nhỏ | 2 | Dashboard |
| UX-5 | Loading skeleton | ⭐ | Rất nhỏ | 3 | UX |
| UX-6 | Status badges + icons | ⭐ | Rất nhỏ | 3 | UX |
| UX-7 | Responsive card view | ⭐ | Trung bình | 3 | UX |

**Tổng effort ước tính:** ~4-6 giờ (Phase 1: ~2h, Phase 2: ~2.5h, Phase 3: ~1h)

**Không có thay đổi backend. Không cần migration. Không ảnh hưởng API contract.**

**Reuse từ codebase:**
- `exportCsv`, `exportPdfTable`, `isoDateStamp` từ `frontend/utils/exportUtils.ts`
- `downloadExcelWorkbook` từ `frontend/utils/excelTemplate.ts`
- `buildPieGradient` pattern từ `Dashboard.tsx:370-394`
- `hasPermission` từ `App.tsx` (đã dùng cho contracts.write, contracts.read, contracts.payments)
- `animate-pulse` skeleton pattern từ codebase
- `motion/react` animations + `lucide-react` icons (đã có)
