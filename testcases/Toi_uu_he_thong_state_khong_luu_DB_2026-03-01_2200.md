# Rà soát tối ưu hệ thống — State không lưu DB
**Ngày:** 2026-03-01 22:00
**Hệ thống:** VNPT Business Management
**Phạm vi:** Toàn bộ frontend (App.tsx + 15 component modules)

---

## 1) Tổng quan hiện trạng

| Metric | Giá trị |
|--------|---------|
| `useState` trong App.tsx | **93 khai báo** |
| `useRef` trong App.tsx | **11 khai báo** |
| Modules bị mất state khi refresh | **12/12** (tất cả) |
| `localStorage` / `sessionStorage` usage | **0** |
| URL hash / query params routing | **0** |
| Server-side user preference API | **0** |

**Kết luận:** Toàn bộ UI state (filter, search, sort, pagination, active tab, sidebar, form draft) chỉ nằm trong React useState/useRef → **mất sạch khi refresh trang**.

---

## 2) Chi tiết theo module

### 2.1 Filter / Search — TẤT CẢ module đều mất khi refresh

| Module | File | State mất khi refresh |
|--------|------|----------------------|
| EmployeeList | `EmployeeList.tsx` | `searchTerm`, `emailFilter`, `departmentFilter`, `statusFilter` |
| CustomerList | `CustomerList.tsx` | `searchTerm` |
| ProjectList | `ProjectList.tsx` | `searchTerm`, `statusFilter` |
| ContractList | `ContractList.tsx` | `searchTerm`, `statusFilter` |
| SupportRequestList | `SupportRequestList.tsx` | 18 form fields trong `SupportRequestFormState` |
| ProgrammingRequestList | `ProgrammingRequestList.tsx` | filter states |
| DocumentList | `DocumentList.tsx` | `searchTerm`, filters |
| BusinessList | `BusinessList.tsx` | `searchTerm`, filters |
| VendorList | `VendorList.tsx` | `searchTerm`, filters |
| ProductList | `ProductList.tsx` | `searchTerm`, filters |
| OpportunityList | `OpportunityList.tsx` | `searchTerm`, filters |
| ReminderList | `ReminderList.tsx` | `searchTerm`, filters |

### 2.2 Pagination — TẤT CẢ reset về trang 1

| State | Vị trí | Mô tả |
|-------|--------|-------|
| `currentPage` | Mỗi list component | Luôn reset về 1 |
| `rowsPerPage` | Mỗi list component | Reset về default (7 hoặc 10) |
| `sortConfig` | Mỗi list component | Reset về default sort |
| `pageQueryRef` (x8) | App.tsx:433-440 | useRef — không persist |

### 2.3 Active Tab — Mất

| State | File | Hậu quả |
|-------|------|---------|
| `activeTab` | App.tsx:336 | Luôn quay về `'dashboard'` khi refresh |
| `internalUserSubTab` | App.tsx:337 | Reset về `'dashboard'` |
| PaymentScheduleTab `viewMode` | PaymentScheduleTab.tsx | Reset về `TABLE` |
| PaymentScheduleTab `filter` | PaymentScheduleTab.tsx | Reset về `ALL` |

### 2.4 Sidebar UI — Mất

| State | File | Hậu quả |
|-------|------|---------|
| `isCollapsed` | Sidebar.tsx:39 | Sidebar luôn mở rộng lại |
| `expandedGroups` | Sidebar.tsx:40 | Menu groups luôn mở default |

### 2.5 Form Drafts — Mất khi navigate away

| Module | State mất | Mức độ |
|--------|-----------|--------|
| AccessControlList | `roleDraft`, `scopeDraft`, `permissionDraft` (15 useState) | Cao |
| SupportRequestList | 18 form fields `SupportRequestFormState` | Cao |
| ProgrammingRequest modal | react-hook-form state | Cao |
| IntegrationSettingsPanel | 12 form useState | Trung bình |

### 2.6 Cache In-Memory — Mất

| Cache | File | Mô tả |
|-------|------|-------|
| `SupportRequestHistoryCacheEntry` | SupportRequestList.tsx:134-138 | Cache lịch sử YCHT với timestamp, chỉ in-memory |
| `loadedModulesRef` | App.tsx | Track dataset đã load → reset → phải load lại toàn bộ API |
| `prefetchedTabsRef` | App.tsx | Track tab đã prefetch → reset |
| `datasetLoadInFlightRef` | App.tsx | Pending API requests tracking |

---

## 3) Những gì ĐÃ lưu DB đúng (không vấn đề)

| Module | Write API | Status |
|--------|-----------|--------|
| CRUD entities (Customer, Employee, Project, Contract, etc.) | create/update/delete | OK |
| Support Request + Tasks + History | full CRUD + worklogs | OK |
| Programming Request + Worklogs | full CRUD | OK |
| Access Control (Roles/Permissions/Scopes) | update endpoints | OK |
| Payment Schedule | update actual payment | OK |
| Integration Settings (Google Drive, Alerts) | update settings | OK |
| Audit Logs | server-side auto-log | OK |

---

## 4) Đánh giá mức độ ảnh hưởng

| # | Vấn đề | Impact | Ưu tiên |
|---|--------|--------|---------|
| 1 | Active tab mất khi refresh → luôn về dashboard | User phải click lại tab mỗi lần | **CAO** |
| 2 | Filter/search mất khi refresh | User đang lọc phức tạp → mất hết | **CAO** |
| 3 | Form draft mất khi navigate away | User nhập form dài → mất hết | **CAO** |
| 4 | Pagination reset về trang 1 | User đang xem trang 5 → quay lại trang 1 | **TRUNG BÌNH** |
| 5 | Sort preferences mất | Minor — sort lại nhanh | **THẤP** |
| 6 | Sidebar collapse state mất | Minor — bấm lại | **THẤP** |
| 7 | Rows per page preference mất | Minor — chọn lại | **THẤP** |
| 8 | SupportRequest history cache rebuild | Phải load lại từ API | **THẤP** |

---

## 5) Đề xuất tối ưu

### 5.1 Ưu tiên CAO — Effort nhỏ, impact lớn

| # | Giải pháp | Cách làm | Effort | Files ảnh hưởng |
|---|-----------|----------|--------|-----------------|
| A | **URL hash cho active tab** | `activeTab` ↔ `window.location.hash` (`#customers`, `#projects`, `#contracts`) | Nhỏ | `App.tsx` |
| B | **URL query params cho filter/search/page** | Sync `?q=abc&status=NEW&page=3` ↔ filter state | Trung bình | `App.tsx` + 12 list components |
| C | **sessionStorage cho form drafts** | Auto-save draft mỗi 5s vào `sessionStorage`, restore khi mở lại form | Nhỏ | Các modal/form components |

### 5.2 Ưu tiên TRUNG BÌNH — Nâng UX

| # | Giải pháp | Cách làm | Effort |
|---|-----------|----------|--------|
| D | **localStorage cho UI preferences** | Sidebar collapse, rowsPerPage, sort preferences | Nhỏ |
| E | **React Router (hoặc hash router)** | Thay thế `activeTab` state bằng proper routing | Trung bình |

### 5.3 Ưu tiên THẤP — Cross-device

| # | Giải pháp | Cách làm | Effort |
|---|-----------|----------|--------|
| F | **DB `user_preferences` table** | Server-side lưu preferences per user, sync cross-device | Lớn |

---

## 6) Chi tiết kỹ thuật đề xuất A, B, C

### A. URL hash cho active tab

```tsx
// App.tsx — thay useState bằng URL hash
const getTabFromHash = () => window.location.hash.replace('#', '') || 'dashboard';
const [activeTab, setActiveTab] = useState(getTabFromHash);

useEffect(() => {
  const handler = () => setActiveTab(getTabFromHash());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}, []);

const handleTabChange = (tab: string) => {
  window.location.hash = tab;
  setActiveTab(tab);
};
```

**Kết quả:** User ở `#customers` → refresh → vẫn ở tab Customers.

### B. URL query params cho filter

```tsx
// Utility hook
function useQueryState(key: string, defaultValue: string) {
  const params = new URLSearchParams(window.location.search);
  const [value, setValue] = useState(params.get(key) ?? defaultValue);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState({}, '', url.toString());
  }, [value]);

  return [value, setValue] as const;
}

// Sử dụng trong component
const [searchTerm, setSearchTerm] = useQueryState('q', '');
const [statusFilter, setStatusFilter] = useQueryState('status', '');
const [currentPage, setCurrentPage] = useQueryState('page', '1');
```

**Kết quả:** URL `#customers?q=VNPT&status=ACTIVE&page=3` → refresh → giữ nguyên filter + page.

### C. sessionStorage cho form drafts

```tsx
// Hook auto-save draft
function useFormDraft<T>(key: string, initialValue: T) {
  const stored = sessionStorage.getItem(key);
  const [value, setValue] = useState<T>(stored ? JSON.parse(stored) : initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(value));
    }, 2000); // debounce 2s
    return () => clearTimeout(timer);
  }, [value]);

  const clearDraft = () => sessionStorage.removeItem(key);
  return [value, setValue, clearDraft] as const;
}

// Sử dụng
const [formData, setFormData, clearDraft] = useFormDraft('sr-form-draft', defaultFormState);
// Khi save thành công → clearDraft()
```

**Kết quả:** User đang nhập form → vô tình refresh → form data vẫn còn.

---

## 7) Ma trận tác động fix

| Fix | Modules ảnh hưởng | Regression risk | Test cần |
|-----|-------------------|-----------------|----------|
| A. URL hash tab | App.tsx, Sidebar.tsx | Thấp | Verify tab đúng sau refresh, back/forward browser |
| B. URL query params | App.tsx + 12 list components | Trung bình | Verify filter/page persist, clear filter works, deep link works |
| C. sessionStorage draft | Modal/form components | Thấp | Verify draft restore, clear sau save, không conflict giữa tabs |
| D. localStorage prefs | Sidebar, list components | Thấp | Verify persist + clear |

---

*Generated by Claude Code — 2026-03-01 22:00*
