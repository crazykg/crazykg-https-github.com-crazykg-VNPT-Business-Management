# 🛠️ ĐỀ XUẤT GIẢI PHÁP KHẮC PHỤC HỆ THỐNG VNPT BUSINESS MANAGEMENT

> **Thực hiện bởi:** Gemini 3.1  
> **Thời gian thực hiện:** 26/02/2026 07:13:11 (Giờ Việt Nam)  
> **Áp dụng cho báo cáo:** SYSTEM_ANALYSIS_REPORT.md

---

## MỤC LỤC

1. [Giai Đoạn 1: Xử Lý Tức Thì (Quick Wins) - 2 Tuần](#giai-đoạn-1-xử-lý-tức-thì-quick-wins---2-tuần)
2. [Giai Đoạn 2: Tái Khắc Phục Tối Ưu Tốt (Kiến Trúc Frontend) - 4 Tuần](#giai-đoạn-2-tái-khắc-phục-tối-ưu-tốt-kiến-trúc-frontend---4-tuần)
3. [Giai Đoạn 3: Tái Cấu Trúc PHP API (Kiến Trúc Backend) - 4 Tuần](#giai-đoạn-3-tái-cấu-trúc-php-api-kiến-trúc-backend---4-tuần)
4. [Giai Đoạn 4: An Toàn Hệ Thống (Bảo Mật & Database) - 2 Tuần](#giai-đoạn-4-an-toàn-hệ-thống-bảo-mật--database---2-tuần)

---

## Giai Đoạn 1: Xử Lý Tức Thì (Quick Wins) - 2 Tuần

### 1.1 Loại Bỏ Tài Nguyên Rác & Mã Bị Khóa Cứng (Mock Data)
- **Tập tin:** `frontend/constants.ts`
- **Hành động:** Xóa đi những biến tạo giả (mock generator) không cần thiết như `MOCK_DEPARTMENTS`, `MOCK_EMPLOYEES`, `generateEmployees()`, `generateOpportunities()`. Điều này tiết kiệm trung bình 10-15KB Bandwidth JavaScript Tĩnh.

### 1.2 Dọn Dẹp Route Trùng Lặp ở API
- **Tập tin:** `backend/routes/api.php`
- **Hành động:** Loại bỏ toàn bộ hệ phân cách underscore (`support_requests`). Chuẩn hóa theo chuẩn Kebab-case của RESTful (`/support-requests`).
- **Update Client:** `v5Api.ts` sửa lại URI Endpoint trùng khớp sau khi dọn dẹp.

### 1.3 Thiết Lập Bắt Lỗi Xuyên Xuất (Error Boundaries React)
- **Hành động:** Viết một HOC Component `<ErrorBoundary>` áp dụng quanh thẻ Tab Panels. Điều này ngăn toàn bộ ứng dụng chết trắng nếu một bảng Data-Grid sinh lỗi.

### 1.4 Làm Sạch Repository & Môi Trường
- **Hành động:** Thêm `/.env` vào `.gitignore`. 
- **Giải Pháp:** Chạy `git rm --cached backend/.env` và `git commit -m "fix: remove sensitive env vars"`

### 1.5 Fix ID Collision cho Toast Component
- **Hành động:** Ngăn sự cố Toast sinh đè bằng Date.now() khi nhập Excel Import (nhiều bản ghi). Sử dụng Counter Variable thay thế.

---

## Giai Đoạn 2: Tái Khắc Phục Tối Ưu Tốt (Kiến Trúc Frontend) - 4 Tuần

### 2.1 Router Mới với React-Router-DOM
- **Mục tiêu:** Áp dụng Client-side Routing. `App.tsx` không còn phải duy trì `useState('activeTab')`.
- **Áp dụng:** Tách logic thành các URL rõ ràng `domain/departments`, `domain/projects`. Ngăn tải toàn bộ 20 module về ram khi chỉ cần vào xem Thông Báo hay Xem 1 Khách hàng. Hỗ trợ cho Lazy-loading / Code-splitting tốt hơn.

### 2.2 Đổi Mới State Management với Zustand.js
- **Mục tiêu:** Phân quyền State bằng cách chia 56 useState hỗn hợp.
- **Áp dụng:** Khởi tạo `useAuthStore` (Đăng nhập), `useToastStore`, `useDepartmentStore`,... làm giảm thiểu Drilling Properties.

### 2.3 Giải Động Chức Năng `App.tsx` & `Modals.tsx`
- **Mục tiêu:** App.tsx phải dưới 100 dòng. Modals.tsx 144KB phải biến mất.
- **Áp dụng:** Chuyển từng Form vào Folder `modals/ProjectFormModal.tsx`. 
- **Cơ chế gọi Component Mở Rộng:** Lazy load khi `isOpen = true` thay vì Import tất cả trong 1 file Global.

### 2.4 Modular Import Hook
- **Mục tiêu:** Chuyển khối lượng Import 5000 Dòng code từ UI Component xuống custom hook `useBulkImport.ts`. Bóc tách Logic Parse Data Excel ra Worker Thread.

---

## Giai Đoạn 3: Tái Cấu Trúc PHP API (Kiến Trúc Backend) - 4 Tuần

### 3.1 Xóa Bỏ "God Controller" (Single Responsibility)
- **Mục tiêu:** Băm nhỏ `V5MasterDataController.php` (240 KB).
- **Áp dụng:** Tách thành `DepartmentController`, `ProjectController`, `ContractController`... Controller chỉ việc Inject Logic và Validations. 

### 3.2 Kỹ Thuật Phân Trang Máy Chủ (Server-Side Pagination)
- **Mục tiêu:** Tuyệt đối cấm sử dụng `->get()` toàn cục thay bằng `->paginate(20)`. 
- **Áp dụng:** Tích hợp bộ Trait `Paginatable.php` trên Laravel để Client chỉ tải gói JSON siêu nhẹ phân bổ 20-50 dòng mỗi Request thay cho 5-10MB ngầm định.

### 3.3 Đẩy Nhanh Batch API Endpoint
- **Mục tiêu:** Cắt giảm thảm họa gửi từng dòng Excel (5000 Request) qua kết nối mạng.
- **Áp dụng:** Cung cấp `/api/v5/bulk/departments` đón mảng mảng object JSON, validate qua Collection Array của Laravel và Bulk Insert ( `insert()` ) qua 1 Transaction DB. Tốc độ tăng >= 10 Lần.

---

## Giai Đoạn 4: An Toàn Hệ Thống (Bảo Mật & Database) - 2 Tuần

### 4.1 Indexing Tables Mở Rộng
- Nhắm tới: File Migration Laravel để bù đắp các truy vấn.
- Thêm: `INDEX idx_cust_is_active ON customers(is_active)`. Tạo Foreign keys cho `dept_id` bị thiếu ở `contracts`.

### 4.2 Cookie-based HttpOnly Authentication
- **Hành động:** Bỏ lưu JWT tại LocalStorage, gán bảo mật mã hóa thẳng trong header responses `Set-Cookie`.
- Điều này loại bỏ >90% nguy cơ Cross-Site Scripting đánh cắp phiên.

### 4.3 Giới Hạn Rate-Limiter (Chống Brute-force)
- **Hành động:** Áp chuẩn Laravel Throttle. Cứ 5 lượt sai trong 1 phút khóa route Login IP 60 giây.

### 4.4 Phân Mảnh Khôn Ngoan Dữ Liệu Lịch Sử (Audit Log)
- **Hành động:** Drop cấu hình Partitioning tháng của `audit_logs` để thay thế bằng Phân Mảnh Năm/Tháng. Tránh sự cố năm cũ đổ dồn vào năm mới sau 1 năm chạy bằng RANGE DATE `LESS THAN`.

### 4.5 Lịch Tự Động Clear Token Rác
- **Hành động:** Cron Job `Schedule::command('tokens:cleanup')` gỡ các tokens expired lâu hơn 30 ngày (Giảm hàng nghìn Access_tokens của DB Token Size_growth).

---

# 🛠️ BỔ SUNG GIẢI PHÁP KHẮC PHỤC — CLAUDE OPUS

> **Thực hiện bởi:** Claude Opus  
> **Thời gian thực hiện:** 26/02/2026 07:19:24 (Giờ Việt Nam)  
> **Dựa trên:** Phân tích bổ sung tại SYSTEM_ANALYSIS_REPORT.md (mục 8-12)

---

## Giai Đoạn Bổ Sung 1: Sửa Bug & UI/UX Khẩn Cấp (1 Tuần)

### BS-1.1 Fix Bug ViewDepartmentModal Dùng MOCK_DATA

**Tập tin:** `frontend/components/Modals.tsx` — Dòng 692  
**Vấn đề:** `ViewDepartmentModal` tham chiếu `MOCK_DEPARTMENTS` thay vì danh sách departments từ API.

**Sửa:**
```tsx
// TRƯỚC (BUG):
const parentDept = MOCK_DEPARTMENTS.find(d => d.id === data.parent_id);

// SAU (FIX) - Thêm prop departments vào component:
export const ViewDepartmentModal: React.FC<{
  data: Department;
  departments: Department[];  // ← thêm prop
  onClose: () => void;
  onEdit: () => void;
}> = ({ data, departments, onClose, onEdit }) => {
  const parentDept = departments.find(d => d.id === data.parent_id);
  // ...
};
```

### BS-1.2 Fix Table Responsive (min-w-[1920px])

**Tập tin:** `frontend/components/EmployeeList.tsx` — Dòng 456  
**Vấn đề:** `min-w-[1920px]` ép table cực rộng.

**Sửa:** Ẩn cột phụ trên màn hình nhỏ:
```tsx
// Thay min-w-[1920px] bằng min-w-[1200px]
// Ẩn cột VPN, IP, Ngày sinh trên < 1440px
<th className="... hidden xl:table-cell">VPN</th>
<th className="... hidden xl:table-cell">ĐỊA CHỈ IP</th>
<th className="... hidden lg:table-cell">NGÀY SINH</th>
```

### BS-1.3 Thay `alert()` Bằng Toast

**Tập tin:** `frontend/components/EmployeeList.tsx` — Dòng 307  
**Sửa:** Truyền `addToast` callback vào component thay vì dùng `alert()`.

---

## Giai Đoạn Bổ Sung 2: An Toàn Bảo Mật Nâng Cao (2 Tuần)

### BS-2.1 Thêm Login Audit Trail

**Tập tin:** `backend/app/Http/Controllers/Api/AuthController.php`

```php
// Thêm sau mỗi login attempt (thành công/thất bại):
DB::table('audit_logs')->insert([
    'user_id'    => $user?->id,
    'action'     => $user ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    'ip_address' => $request->ip(),
    'user_agent' => $request->userAgent(),
    'details'    => json_encode(['username' => $loginInput]),
    'created_at' => now(),
]);
```

### BS-2.2 Token Expiry Bắt Buộc

**Tập tin:** `backend/app/Http/Controllers/Api/AuthController.php` — Dòng 56

```php
// TRƯỚC:
$token = $user->createToken('vnpt_business_web', $abilities)->plainTextToken;

// SAU — Token hết hạn sau 24 giờ:
$tokenResult = $user->createToken('vnpt_business_web', $abilities);
$tokenResult->accessToken->expires_at = now()->addHours(24);
$tokenResult->accessToken->save();
$token = $tokenResult->plainTextToken;
```

### BS-2.3 Giới Hạn Thông Tin Trong serializeUser()

```php
// Không trả permissions chi tiết cho client thông thường
// Chỉ trả role codes, frontend tự map permission từ role
private function serializeUser(InternalUser $user): array {
    return [
        'id'            => (int) $user->id,
        'username'      => $user->username,
        'full_name'     => $user->full_name,
        'email'         => $user->email,
        'status'        => $user->status,
        'department_id' => $user->department_id,
        'roles'         => $this->accessService->roleCodesForUser($userId),
        // Bỏ 'permissions' và 'dept_scopes' khỏi response
    ];
}
```

### BS-2.4 Validate File Upload MIME Type

```php
// Thêm validation cho document upload
$request->validate([
    'file' => [
        'required', 'file', 'max:10240',
        'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif',
    ],
]);
```

### BS-2.5 Cache Schema Check Trong AuthController

```php
// Thay vì gọi Schema::hasColumn mỗi request:
private static ?bool $hasStatusColumn = null;

private function userTableHasStatus(): bool
{
    if (self::$hasStatusColumn === null) {
        self::$hasStatusColumn = $this->hasColumn('internal_users', 'status');
    }
    return self::$hasStatusColumn;
}
```

---

## Giai Đoạn Bổ Sung 3: Hiệu Năng Frontend Nâng Cao (2 Tuần)

### BS-3.1 Ngăn Re-render Cascade Với React.memo

```tsx
// Bọc mỗi list component bằng React.memo
export const EmployeeList = React.memo(({ employees, departments, onOpenModal }) => {
  // ...component hiện tại...
});

// Dùng useCallback cho handlers truyền xuống
const handleOpenModal = useCallback((type, item) => {
  setModalType(type);
  // ...
}, []);
```

### BS-3.2 Debounce Search Input

```tsx
// Thêm debounce cho tất cả search inputs trong List components
import { useDeferredValue } from 'react';

const [searchTerm, setSearchTerm] = useState('');
const deferredSearch = useDeferredValue(searchTerm);

// Dùng deferredSearch thay vì searchTerm trong useMemo filter
const filteredEmployees = useMemo(() => {
  return employees.filter(emp =>
    emp.full_name.toLowerCase().includes(deferredSearch.toLowerCase())
  );
}, [employees, deferredSearch]);
```

### BS-3.3 Fix Memory Leak — Toast Timeout Cleanup

```tsx
// Dùng useRef để track timeouts và cleanup khi unmount
const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

const addToast = (type, title, message) => {
  const id = ++toastIdRef.current;
  setToasts(prev => [...prev, { id, type, title, message }]);
  const timeout = setTimeout(() => {
    removeToast(id);
    timeoutRefs.current.delete(id);
  }, 5000);
  timeoutRefs.current.set(id, timeout);
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    timeoutRefs.current.forEach(clearTimeout);
  };
}, []);
```

### BS-3.4 Fix Import Lock — Reset importInFlightRef

```tsx
// Thêm cleanup trong finally block
const handleImportData = async (payload) => {
  if (importInFlightRef.current) return;
  importInFlightRef.current = true;
  try {
    // ... import logic ...
  } finally {
    importInFlightRef.current = false;  // ← LUÔN reset
    setIsSaving(false);
    setImportLoadingText('');
  }
};
```

---

## Bảng Tổng Hợp Effort Bổ Sung (Claude Opus)

| # | Task | Effort | Impact | Ưu tiên |
|---|---|---|---|---|
| BS-1.1 | Fix MOCK_DATA bug | 1h | 🔴 Sửa bug hiển thị sai | Ngay |
| BS-1.2 | Fix table responsive | 2h | 🔴 Mobile UX | Ngay |
| BS-1.3 | Thay alert() bằng toast | 30min | 🟡 UX | Ngay |
| BS-2.1 | Login audit trail | 3h | 🔴 Security | Tuần 1 |
| BS-2.2 | Token expiry 24h | 1h | 🔴 Security | Tuần 1 |
| BS-2.3 | Giới hạn serializeUser | 1h | 🟡 Security | Tuần 1 |
| BS-2.4 | Validate file upload | 1h | 🟡 Security | Tuần 1 |
| BS-2.5 | Cache schema check | 30min | 🟢 Performance | Tuần 2 |
| BS-3.1 | React.memo components | 3h | 🟡 Performance | Tuần 2 |
| BS-3.2 | Debounce search | 2h | 🟡 Performance | Tuần 2 |
| BS-3.3 | Fix toast memory leak | 1h | 🟡 Stability | Tuần 2 |
| BS-3.4 | Fix import lock | 30min | 🟡 Stability | Tuần 2 |

