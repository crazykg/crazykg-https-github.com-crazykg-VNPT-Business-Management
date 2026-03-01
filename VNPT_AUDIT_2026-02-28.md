# VNPT Business Management — Audit Report
**Ngày:** 28-02-2026
**Phiên bản DB backup:** `vnpt_business_db_2026-02-24_175408.sql`
**Scope:** SQL · Backend (BE) · API · Frontend (FE)
**Đánh giá tổng thể:** 4/10

---

## Mục lục
- [I. SQL / Database](#i-sql--database)
- [II. Backend (BE)](#ii-backend-be)
- [III. API](#iii-api)
- [IV. Frontend (FE)](#iv-frontend-fe)
- [V. Ma trận tác động chéo](#v-ma-trận-tác-động-chéo)
- [VI. Ưu tiên fix theo sprint](#vi-ưu-tiên-fix-theo-sprint)

---

## I. SQL / Database

### I-1. CRITICAL

#### I-1-1. `support_requests.status` là VARCHAR thay vì ENUM
- **Vấn đề:** Cột `status` kiểu `VARCHAR(50)` cho phép lưu bất kỳ chuỗi nào. Không có constraint tại DB layer.
- **Giá trị hợp lệ cần enforce:** `NEW`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `COMPLETED`, `PAUSED`, `TRANSFER_DEV`, `TRANSFER_DMS`, `UNABLE_TO_EXECUTE`
- **Rủi ro:** Dữ liệu rác, KPI tính sai, filter không đúng.
- **Fix SQL:**
```sql
ALTER TABLE support_requests
  MODIFY COLUMN status ENUM(
    'NEW','IN_PROGRESS','WAITING_CUSTOMER','COMPLETED',
    'PAUSED','TRANSFER_DEV','TRANSFER_DMS','UNABLE_TO_EXECUTE'
  ) NOT NULL DEFAULT 'NEW';
```

#### I-1-2. `contracts` — tên cột `total_value` vs `value` không nhất quán
- **Vấn đề:** Schema thực tế có cột `total_value`, nhưng migration gốc định nghĩa `value`. Code FE và BE gửi field `value` → dữ liệu không được lưu.
- **Fix SQL:**
```sql
-- Nếu cột hiện tại là 'value', đổi tên:
ALTER TABLE contracts RENAME COLUMN `value` TO `total_value`;
```

#### I-1-3. `contracts.dept_id` không nhất quán với `internal_users.department_id`
- **Vấn đề:** Toàn hệ thống dùng `department_id`, riêng bảng `contracts` dùng `dept_id`.
- **Fix SQL:**
```sql
ALTER TABLE contracts RENAME COLUMN `dept_id` TO `department_id`;
-- Cập nhật FK nếu cần:
ALTER TABLE contracts
  DROP FOREIGN KEY fk_contracts_dept,
  ADD CONSTRAINT fk_contracts_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
```

#### I-1-4. `opportunities.stage` là VARCHAR thay vì ENUM
- **Vấn đề:** Không có ràng buộc giá trị. Dữ liệu pipeline CRM không thể phân tích nhất quán.
- **Fix SQL:**
```sql
ALTER TABLE opportunities
  MODIFY COLUMN stage ENUM('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST')
  NOT NULL DEFAULT 'NEW';
```

---

### I-2. HIGH

#### I-2-1. Thiếu index trên `programming_request_worklogs`
- **Vấn đề:** Không có index trên `(programming_request_id, phase)` và `logged_date`. Query tổng hợp giờ công theo phase sẽ full-scan.
- **Fix SQL:**
```sql
ALTER TABLE programming_request_worklogs
  ADD INDEX idx_worklog_req_phase (programming_request_id, phase),
  ADD INDEX idx_worklog_date (logged_date);
```

#### I-2-2. Thiếu index composite `(customer_id, status)` trên `support_requests`
- **Vấn đề:** Filter phổ biến nhất (theo khách hàng + trạng thái) không có index.
- **Fix SQL:**
```sql
ALTER TABLE support_requests
  ADD INDEX idx_sr_customer_status (customer_id, status);
```

#### I-2-3. `attachments` — quan hệ polymorphic không có referential integrity
- **Vấn đề:** `reference_type` + `reference_id` không có FK thực sự. Record cha bị xóa → attachment mồ côi.
- **Fix:** Enforce tại application layer — khi xóa entity cha phải xóa attachments liên quan trong cùng transaction.

#### I-2-4. `project_items` — không có UNIQUE constraint cho `(project_id, product_id)`
- **Vấn đề:** Có thể thêm cùng một sản phẩm nhiều lần vào một dự án.
- **Fix SQL:**
```sql
ALTER TABLE project_items
  ADD UNIQUE KEY uq_project_product (project_id, product_id);
```

#### I-2-5. `support_requests` có 2.4M+ rows — không có partitioning
- **Vấn đề:** Bảng lớn nhất hệ thống không được partition. Query chậm theo thời gian.
- **Fix SQL (sau khi fix status thành ENUM):**
```sql
-- Cần rebuild table với partition key trên requested_date
-- Thực hiện trong maintenance window
ALTER TABLE support_requests
  PARTITION BY RANGE (YEAR(requested_date) * 100 + MONTH(requested_date)) (
    PARTITION p_2024_01 VALUES LESS THAN (202402),
    PARTITION p_2024_02 VALUES LESS THAN (202403),
    -- ...
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );
```

---

### I-3. MEDIUM

#### I-3-1. `programming_requests` — check constraint `chk_source_consistency` có thể không enforce trên MySQL < 8.0.16
- **Vấn đề:** Constraint đảm bảo `source_type = 'FROM_SUPPORT'` thì `support_request_id` phải có giá trị. MySQL < 8.0.16 parse nhưng không enforce CHECK.
- **Fix:** Thêm validation tại BE layer (đã có một phần), và verify MySQL version >= 8.0.16.

#### I-3-2. `documents.customer_id` cho phép NULL — tạo orphaned documents
- **Vấn đề:** Tài liệu không có khách hàng không thể phân loại, khó tìm kiếm.
- **Đề xuất:** Thêm cột `doc_scope` ENUM('INTERNAL','CUSTOMER') để phân loại thay vì dùng NULL.

#### I-3-3. `audit_logs.created_by` không có FK do partitioning
- **Vấn đề:** Không thể JOIN với `internal_users` để lấy tên người thực hiện mà đảm bảo toàn vẹn.
- **Fix:** Thêm cột `created_by_name VARCHAR(100)` để denormalize tên tại thời điểm ghi log.

---

## II. Backend (BE)

### II-1. CRITICAL

#### II-1-1. `V5MasterDataController.php` — 10,550 dòng, vi phạm Single Responsibility
- **File:** [backend/app/Http/Controllers/Api/V5MasterDataController.php](backend/app/Http/Controllers/Api/V5MasterDataController.php)
- **Vấn đề:** Một controller xử lý 15+ entity khác nhau. Không thể test độc lập, không thể maintain.
- **Fix:** Tách thành các controller riêng:
```
Controllers/Api/V5/
  ContractController.php
  CustomerController.php
  SupportRequestController.php
  ProgrammingRequestController.php
  ProjectController.php
  EmployeeController.php
  ...
```

#### II-1-2. Không có server-side pagination cho hầu hết endpoints
- **Vấn đề:** Toàn bộ dataset (có thể 15-50MB) được load về client mỗi lần khởi tạo app.
- **Fix PHP (mẫu):**
```php
public function supportRequests(Request $request)
{
    $query = SupportRequest::query()->with(['customer', 'assignee']);

    if ($request->filled('q')) {
        $query->where('summary', 'like', "%{$request->q}%");
    }
    if ($request->filled('status')) {
        $query->where('status', $request->status);
    }

    return $query->paginate($request->get('per_page', 20));
}
```

#### II-1-3. Backend check BOTH `department_id` và `dept_id` động — schema fragility
- **File:** [backend/app/Http/Controllers/Api/V5MasterDataController.php:304-306](backend/app/Http/Controllers/Api/V5MasterDataController.php#L304)
- **Vấn đề:**
```php
$departmentColumn = $this->hasColumn($employeeTable, 'department_id')
    ? 'department_id'
    : ($this->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);
```
- **Fix:** Sau khi chuẩn hóa DB (mục I-1-3), xóa fallback này, dùng `department_id` cứng.

---

### II-2. HIGH

#### II-2-1. Status validation chỉ ở controller, không ở DB
- **File:** [backend/app/Http/Controllers/Api/V5MasterDataController.php:1961-1967](backend/app/Http/Controllers/Api/V5MasterDataController.php#L1961)
- **Vấn đề:** `supportRequestStatusValidationValues()` validate ở controller, nhưng DB vẫn là VARCHAR → bypass qua direct DB access hoặc migration.
- **Fix:** Sau khi fix I-1-1 (đổi thành ENUM), validation tầng controller trở thành redundant nhưng vẫn nên giữ.

#### II-2-2. Raw SQL hardcode status values trong KPI logic
- **File:** [backend/app/Http/Controllers/Api/V5MasterDataController.php:2102-2129](backend/app/Http/Controllers/Api/V5MasterDataController.php#L2102)
- **Vấn đề:** KPI query hardcode status strings — nếu thêm status mới phải sửa nhiều chỗ.
- **Fix:** Extract thành constants hoặc dùng ENUM model:
```php
// Tạo Enum class
enum SupportRequestStatus: string {
    case NEW = 'NEW';
    case IN_PROGRESS = 'IN_PROGRESS';
    case COMPLETED = 'COMPLETED';
    // ...
}
```

#### II-2-3. Thiếu Form Request validation classes
- **Vấn đề:** Nhiều endpoint không có `FormRequest` riêng — validation trộn lẫn trong controller.
- **Fix:** Tạo Request classes:
```
Http/Requests/
  StoreContractRequest.php      → validate total_value (not value)
  StoreSupportRequestRequest.php
  StoreProgrammingRequestRequest.php
```

---

### II-3. MEDIUM

#### II-3-1. Soft delete không được enforce qua Global Scope nhất quán
- **Vấn đề:** Một số model có `SoftDeletes` trait, nhưng raw query trong controller không luôn có `WHERE deleted_at IS NULL`.
- **Fix:** Dùng Eloquent thay raw query, Global Scope của Laravel tự xử lý.

#### II-3-2. `programming_requests` — nhiều date constraint phức tạp không được validate tại BE
- **Vấn đề:** `chk_phase_order_code_after_analyze` và các constraint tương tự chỉ ở DB level — lỗi trả về generic MySQL error, không có friendly message.
- **Fix:** Thêm validation trong `StoreProgrammingRequestRequest.php` trước khi hit DB.

---

## III. API

### III-1. CRITICAL

#### III-1-1. Contract endpoint nhận `value` nhưng DB lưu `total_value`
- **Vấn đề:** FE gửi `{ value: 1000000 }`, BE không map, DB có cột `total_value` → giá trị hợp đồng không được lưu, luôn là 0.
- **Fix BE (FormRequest):**
```php
// StoreContractRequest.php
public function rules(): array {
    return [
        'total_value' => 'required|numeric|min:0',
        // ...
    ];
}
// Trong controller, không nhận 'value'
```
- **Fix FE:** Xem mục IV-1-1.

#### III-1-2. Không có chuẩn response envelope nhất quán
- **Vấn đề:** Một số endpoint trả `{ data: [...] }`, một số trả `[...]` trực tiếp, một số trả `{ items: [...], meta: {...} }`.
- **Fix:** Chuẩn hóa response:
```json
{
  "data": [...],
  "meta": { "current_page": 1, "per_page": 20, "total": 2457489 },
  "message": "OK"
}
```

---

### III-2. HIGH

#### III-2-1. Routes không document pagination parameters
- **File:** [backend/routes/api.php](backend/routes/api.php)
- **Vấn đề:** FE không biết endpoint nào hỗ trợ `?page=&per_page=&q=`. Dẫn đến FE gọi không paginate.
- **Fix:** Thêm comment hoặc OpenAPI spec. Ít nhất thêm comment trong route:
```php
// GET /support-requests?page=1&per_page=20&status=NEW&customer_id=5&q=keyword
Route::get('/support-requests', [SupportRequestController::class, 'index'])
    ->middleware('permission:support_requests.read');
```

#### III-2-2. Deprecated route aliases chưa được dọn dẹp
- **File:** [backend/routes/api.php:222-283](backend/routes/api.php#L222)
- **Vấn đề:** Nhiều route alias cũ song song với route mới — tăng attack surface, gây nhầm lẫn.
- **Fix:** Xóa deprecated routes sau khi confirm FE không còn dùng.

#### III-2-3. Một số FK endpoint thiếu auth middleware
- **Vấn đề:** Một số GET endpoints master data không có `permission:` middleware — bất kỳ user authenticated nào đều có thể đọc.
- **Fix:** Review lại từng route, thêm middleware phù hợp.

---

### III-3. MEDIUM

#### III-3-1. Không có rate limiting trên auth endpoints
- **File:** [backend/routes/api.php](backend/routes/api.php)
- **Vấn đề:** `/api/login` và `/api/auth/*` không có throttle middleware.
- **Fix:**
```php
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
});
```

---

## IV. Frontend (FE)

### IV-1. CRITICAL

#### IV-1-1. `v5Api.ts` gửi `value` thay vì `total_value` cho contracts
- **File:** [frontend/services/v5Api.ts:1441,1467](frontend/services/v5Api.ts#L1441)
- **Vấn đề:**
```typescript
// HIỆN TẠI (SAI)
value: normalizeNumber(payload.value, 0),

// ĐÚNG
total_value: normalizeNumber(payload.total_value ?? payload.value, 0),
```

#### IV-1-2. `SupportRequestStatus` type quá rộng — cho phép any string
- **File:** [frontend/types/types.ts:376](frontend/types/types.ts#L376)
- **Vấn đề:**
```typescript
// HIỆN TẠI (SAI)
export type SupportRequestStatus = string;

// ĐÚNG
export type SupportRequestStatus =
  | 'NEW' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'COMPLETED'
  | 'PAUSED' | 'TRANSFER_DEV' | 'TRANSFER_DMS' | 'UNABLE_TO_EXECUTE';
```

#### IV-1-3. `Contract` interface có cả `value` lẫn `total_value` — ambiguous
- **File:** [frontend/types/types.ts:604-605](frontend/types/types.ts#L604)
- **Vấn đề:**
```typescript
// HIỆN TẠI (NHẬP NHẰNG)
export interface Contract {
  value: number;         // trường sai
  total_value?: number;  // trường đúng
}

// ĐÚNG
export interface Contract {
  total_value: number;
}
```

---

### IV-2. HIGH

#### IV-2-1. `fetchSupportRequests()` load toàn bộ records không có pagination
- **File:** [frontend/services/v5Api.ts:822](frontend/services/v5Api.ts#L822)
- **Vấn đề:**
```typescript
// HIỆN TẠI — load ALL 2.4M+ records
export const fetchSupportRequests = async (): Promise<SupportRequest[]> =>
  fetchList<SupportRequest>('/api/v5/support-requests');
```
- **Fix:** Chỉ dùng `fetchSupportRequestsPage()` với pagination, xóa hàm không paginate.

#### IV-2-2. `App.tsx` — 4,804 dòng, 56+ useState hooks, không có routing
- **File:** [frontend/App.tsx](frontend/App.tsx)
- **Vấn đề:** Toàn bộ app state trong một component. F5 reset về dashboard. Không có URL-based navigation.
- **Fix:** Migrate sang React Router v6:
```tsx
// Thay vì if/else state:
<Routes>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/support-requests" element={<SupportRequestList />} />
  <Route path="/contracts" element={<ContractList />} />
</Routes>
```

#### IV-2-3. `Modals.tsx` — 3,294 dòng, tất cả forms trong một file
- **File:** [frontend/components/Modals.tsx](frontend/components/Modals.tsx)
- **Vấn đề:** Mọi modal form đều load dù không dùng. Bundle size lớn.
- **Fix:** Tách từng modal thành file riêng, dùng `React.lazy()`:
```tsx
const ContractModal = lazy(() => import('./modals/ContractModal'));
const SupportRequestModal = lazy(() => import('./modals/SupportRequestModal'));
```

#### IV-2-4. JWT token lưu trong `localStorage` — XSS vulnerability
- **Vấn đề:** `localStorage` accessible qua JavaScript — XSS attack có thể đánh cắp token.
- **Fix:** Dùng `httpOnly` cookie (backend set, FE không đọc trực tiếp). Laravel Sanctum hỗ trợ sẵn.

---

### IV-3. MEDIUM

#### IV-3-1. `Employee` interface có field alias không rõ ràng
- **File:** [frontend/types/types.ts:291-295](frontend/types/types.ts#L291)
- **Vấn đề:**
```typescript
department_id: string | number | null;
department?: string | number | null;  // alias không tường minh
```
- **Fix:** Xóa alias `department`, chỉ dùng `department_id` + join với departments list.

#### IV-3-2. Hardcode default status không validate với backend
- **File:** [frontend/services/v5Api.ts:678-679](frontend/services/v5Api.ts#L678)
- **Vấn đề:**
```typescript
status: payload.status || 'NEW',    // hardcode
priority: payload.priority || 'MEDIUM',  // hardcode
```
- **Fix:** Load danh sách status/priority từ API một lần lúc khởi tạo app, lưu vào context.

---

## V. Ma trận tác động chéo

| Vấn đề gốc (DB) | Hệ quả BE | Hệ quả API | Hệ quả FE |
|---|---|---|---|
| `contracts.total_value` vs `value` | Không có field mapping | Response trả `total_value = 0` | UI hiển thị giá trị hợp đồng = 0 |
| `support_requests.status` = VARCHAR | Controller validate rồi nhưng DB không enforce | Status filter không đáng tin | Type `string` cho phép gửi giá trị sai |
| Thiếu pagination | Load all + raw SQL | Response 50MB+ | App treo khi có data lớn |
| `dept_id` vs `department_id` | Dynamic schema check | Mapping không nhất quán | Field type `department?` ambiguous |
| Không có index worklog phase | Query tổng giờ công chậm | API timeout | Dashboard giờ công load rất chậm |

---

## VI. Ưu tiên fix theo sprint

### Sprint 1 — Dữ liệu sai (Fix ngay, không cần refactor lớn)
| # | Mục | File/Table |
|---|---|---|
| 1 | Đổi `support_requests.status` thành ENUM | Migration SQL |
| 2 | Chuẩn hóa `contracts.total_value` — fix FE gửi đúng field | `v5Api.ts`, `types.ts` |
| 3 | Fix `SupportRequestStatus` type | `types.ts` |
| 4 | Thêm index `(customer_id, status)` và worklog indexes | Migration SQL |
| 5 | Đổi `contracts.dept_id` → `department_id` | Migration SQL + BE |

### Sprint 2 — Performance & Security
| # | Mục | File/Table |
|---|---|---|
| 6 | Bật pagination cho tất cả list endpoints | BE Controllers |
| 7 | FE dùng paginated API, xóa `fetchSupportRequests()` all | `v5Api.ts` |
| 8 | Migrate JWT sang httpOnly cookie | BE Auth + FE |
| 9 | Thêm rate limiting trên auth routes | `api.php` |
| 10 | Xóa deprecated route aliases | `api.php` |

### Sprint 3 — Refactor Architecture
| # | Mục | File/Table |
|---|---|---|
| 11 | Tách `V5MasterDataController.php` thành controller riêng | BE |
| 12 | Migrate FE sang React Router v6 | `App.tsx` |
| 13 | Tách `Modals.tsx` + lazy loading | `components/` |
| 14 | Chuẩn hóa API response envelope | BE Controllers |
| 15 | Thêm FormRequest classes | BE Http/Requests |

---

*File này được tạo tự động bởi Claude Code — 28-02-2026*
*Cập nhật lần tiếp theo: sau Sprint 1 hoàn thành*
