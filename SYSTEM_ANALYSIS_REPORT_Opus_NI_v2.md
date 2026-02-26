# 🔍 VNPT Business Management — Audit Report v2.1 (Deep Dive)

> **Phiên bản:** Audit Report v2.1 (Opus NI Edition)
> **Thời gian rà soát:** 26/02/2026 — 10:53 (GMT+7)
> **Auditor:** Independent QA/Security Auditor (Principal Architect + Senior Security Auditor + UX Expert)
> **Đối tượng:** Source Code Frontend (React + Vite), Backend (Laravel 11+), Database Schema (MySQL)
> **Bối cảnh:** Hệ thống sau Đợt Refactor Lần 1

---

## 📊 TÓM TẮT NHANH (EXECUTIVE SUMMARY)

| Thống kê | Số lượng |
| :--- | :---: |
| **Tổng tiêu chí đánh giá** | 18 |
| ✅ Đã Fix Tốt | 9 |
| ⚠️ Fix Một Phần | 3 |
| ❌ Chưa Xử Lý | 4 |
| 🚨 Rủi Ro Mới Phát Sinh | 2 |

**Nhận định tổng thể:** Front-End đạt tiêu chuẩn production-grade (Toast, Searchable Dropdown, overflow-x-auto, useMemo tối ưu). Back-End có cải thiện đáng kể (Eager Loading, Pagination, Token Expiry, Rate Limiting, File Upload Validation). **TUY NHIÊN**, tồn tại 2 lỗ hổng CRITICAL mức P0: **(1) IDOR — Không kiểm tra Data Ownership trên các endpoint mutate** và **(2) Audit Trail rỗng — Không có Observer/Trait ghi log**. God Controller 6.800 dòng chưa được chia nhỏ.

---

## 1. 🚀 ĐÁNH GIÁ HIỆU NĂNG (PERFORMANCE)

| # | Tiêu chí | Điểm | Trạng thái | Minh chứng & Phân tích |
|---|----------|:-----:|:----------:|------------------------|
| 1.1 | **Chia nhỏ God Controller** | 1/10 | $$❌ Chưa Xử Lý$$ | `V5MasterDataController.php` = **6.799 dòng**, chứa **65 public methods** + **111 private methods**. Gom toàn bộ logic CRUD (Department, Employee, Customer, Vendor, Project, Contract, Document, Opportunity, SupportRequest, AuditLog, PaymentSchedule), Google Drive integration, và utility functions vào **1 file duy nhất**. Vi phạm nghiêm trọng SRP (Single Responsibility Principle). |
| 1.2 | **N+1 Query & Eager Loading** | 9/10 | $$✅ Đã Fix Tốt$$ | Tất cả API list đã sử dụng `->with()` + `->select()` chọn lọc cột tối thiểu. Ví dụ: `Contract::query()->with(['customer' => fn ($query) => $query->select(...), 'project' => fn ($query) => $query->select(...)])` (file `V5MasterDataController.php`, dòng 504-508). Employees cũng load kèm `department`, `position` đúng chuẩn (dòng 114-138). |
| 1.3 | **Pagination Backend** | 9/10 | $$✅ Đã Fix Tốt$$ | Đã implement cơ chế `shouldPaginate()` + `resolvePaginationParams()` với `max_per_page = 200` (dòng 5960-5974). Contracts, Employees, AuditLogs, SupportRequests, Documents đều hỗ trợ `->paginate()`. Frontend cũng có component `PaginationControls.tsx` tương ứng. |
| 1.4 | **Caching (Danh mục tĩnh)** | 0/10 | $$❌ Chưa Xử Lý$$ | Không tìm thấy `Cache::remember()`, `Cache::get()`, Redis hay bất kỳ cơ chế caching nào trong toàn bộ codebase. Các API tĩnh như `departments()`, `businesses()`, `products()` đọc DB mỗi lần gọi. |
| 1.5 | **React Re-render Optimization** | 10/10 | $$✅ Đã Fix Tốt$$ | `useMemo` được sử dụng rộng rãi: `filteredContracts`, `filteredCustomers`, `filteredProjects`, `customerOptions`, `employeeFormOptions`, `projectItemOptions`, v.v. Tìm thấy **50+ instances** `useMemo` trải đều trên 15 components. |
| 1.6 | **Database Indexing** | 7/10 | $$⚠️ Fix Một Phần$$ | ✅ `audit_logs`: Partition by RANGE (month), PK kép `(id, created_at)` — hợp lệ. ✅ `support_requests`: Có `idx_support_status`, `idx_support_dates`. ✅ `contracts`: Có `idx_cont_status_exp`. ⚠️ **Thiếu index** cho `audit_logs.created_by` (cần cho filter theo actor) và `support_requests.created_by`. |

---

## 2. 🛡️ ĐÁNH GIÁ BẢO MẬT (SECURITY)

| # | Tiêu chí | Điểm | Trạng thái | Minh chứng & Phân tích |
|---|----------|:-----:|:----------:|------------------------|
| 2.1 | **Token Expiry** | 10/10 | $$✅ Đã Fix Tốt$$ | `sanctum.php` dòng 50: `'expiration' => (int) env('SANCTUM_EXPIRATION', 480)`. Token được tạo với `$expiresAt = now()->addMinutes(...)` tại `AuthController.php` dòng 62-63. Cookie cũng set `$minutes = max(1, (int) config('vnpt_auth.cookie_minutes', 480))` (dòng 225). |
| 2.2 | **Rate Limiting (Anti Brute Force)** | 10/10 | $$✅ Đã Fix Tốt$$ | `AppServiceProvider.php` dòng 25-30: `RateLimiter::for('auth.login', ... Limit::perMinute(5)->by($key))` với key = `IP + username`. Route login áp dụng `->middleware('throttle:auth.login')` tại `api.php` dòng 32. Bảng `auth_login_attempts` ghi nhận mọi lần đăng nhập (dòng 191-216 AuthController). |
| 2.3 | **File Upload Validation** | 10/10 | $$✅ Đã Fix Tốt$$ | Validate **3 lớp bảo mật**: (1) `mimes:pdf,doc,docx,xlsx,xls,txt,png,jpg,jpeg`, (2) `mimetypes:application/pdf,...` kiểm tra MIME thực, (3) Extension check thủ công `in_array($extension, $allowedExtensions)`. Giới hạn `max:20480` (20MB). File `.php`, `.exe` bị chặn triệt để. (Dòng 3366-3388). |
| 2.4 | **RBAC Middleware** | 8/10 | $$✅ Đã Fix Tốt$$ | Tất cả routes đều được bảo vệ bởi `middleware('permission:xxx')` (file `api.php`, dòng 39-226). Middleware `EnsurePermission.php` kiểm tra qua `UserAccessService->hasPermission()` với cơ chế DENY override, role expiry check, cascading permissions. |
| 2.5 | **IDOR (Insecure Direct Object Reference)** | 0/10 | $$🚨 Rủi Ro Mới Phát Sinh$$ | **CRITICAL** — Mọi endpoint mutation (`updateContract`, `deleteContract`, `updateProject`, `deleteProject`, `updateOpportunity`, v.v.) chỉ dùng `::query()->findOrFail($id)` mà **không kiểm tra** user hiện tại có quyền sở hữu/truy cập record đó không. User A có permission `contracts.write` có thể sửa/xóa hợp đồng của phòng ban B bằng cách thay `$id` trên URL. |
| 2.6 | **Data Exposure** | 7/10 | $$⚠️ Fix Một Phần$$ | ✅ Model `InternalUser` có `$hidden = ['password', 'remember_token']` (dòng 35-38). ✅ `serializeUser()` chỉ trả về fields cần thiết. ⚠️ **Nhưng route** `GET /api/user` tại `api.php` dòng 11-13 trả về `$request->user()` raw — nếu `$hidden` bị bypass (ví dụ qua `toArray()` tùy chỉnh), có thể lộ data. ⚠️ `bootstrap` API trả về **toàn bộ mảng permissions** cho client (AuthController dòng 105). |

---

## 3. 🧠 ĐÁNH GIÁ LOGIC NGHIỆP VỤ (BUSINESS LOGIC)

| # | Tiêu chí | Điểm | Trạng thái | Minh chứng & Phân tích |
|---|----------|:-----:|:----------:|------------------------|
| 3.1 | **Data Isolation (Phạm vi dữ liệu)** | 3/10 | $$⚠️ Fix Một Phần$$ | ✅ Bảng `user_dept_scopes` có schema tốt (SELF_ONLY, DEPT_ONLY, DEPT_AND_CHILDREN, ALL). ✅ `UserAccessService.resolveEmployeeVisibility()` đã implement logic đầy đủ (dòng 176-227). ✅ API `employees()` đã áp dụng filter theo visibility (dòng 140-173). ❌ **NHƯNG** các API `contracts()`, `projects()`, `customers()`, `opportunities()`, `documents()`, `supportRequests()` **KHÔNG áp dụng bất kỳ filter data_scope nào**, trả về toàn bộ dữ liệu cho mọi user đã đăng nhập. |
| 3.2 | **RACI Matrix Rules** | 0/10 | $$❌ Chưa Xử Lý$$ | Không tìm thấy bất kỳ logic nào kiểm tra vai trò R/A/C/I trên project/contract. Không có bảng `project_members` hay `raci_assignments`. User có permission `contracts.write` có thể Approve/Delete mọi hợp đồng. |
| 3.3 | **Workflow: Sinh kỳ thanh toán** | 2/10 | $$❌ Chưa Xử Lý$$ | API `generateContractPayments()` (dòng 3719-3767) gọi `CALL sp_generate_contract_payments(?)` nhưng **Stored Procedure không tồn tại trong SQL dump**. Validation cho `sign_date` và `expiry_date` chỉ là `['nullable', 'date']` (dòng 2885-2886), không có rule `after_or_equal:sign_date` cho `expiry_date` → cho phép ngày kết thúc < ngày ký, gây crash khi sinh kỳ thanh toán. |
| 3.4 | **Audit Trail** | 1/10 | $$🚨 Rủi Ro Mới Phát Sinh$$ | Bảng `audit_logs` có schema hoàn chỉnh + Partition. **NHƯNG** toàn bộ codebase Backend không có: (1) Model Observer, (2) Auditable trait, (3) Event/Listener, (4) Manual insert vào `audit_logs` khi CRUD. Hàm `deleteModel()` (dòng 5947-5958) chỉ `$model->delete()` rồi return, không ghi log. Mọi thao tác CRUD đều **vô hình** — không ai biết ai đã sửa/xóa gì. |

---

## 4. 🎨 ĐÁNH GIÁ UX/UI (USER EXPERIENCE)

| # | Tiêu chí | Điểm | Trạng thái | Minh chứng & Phân tích |
|---|----------|:-----:|:----------:|------------------------|
| 4.1 | **Toast Notification** | 10/10 | $$✅ Đã Fix Tốt$$ | Component `Toast.tsx` với `ToastContainer` render tại `App.tsx` dòng 3539. Không còn `alert()` trong toàn bộ frontend. Toast phân biệt `success/error` với icon Material Symbols, animation `slide-in`, auto-close. |
| 4.2 | **API Error Handling** | 10/10 | $$✅ Đã Fix Tốt$$ | `v5Api.ts` có hệ thống xử lý lỗi đa tầng: `parseErrorMessage()` (dòng 318-358) bắt 401/403/404/409/422/500, localize sang tiếng Việt. `localizeValidationMessage()` (dòng 259-301) dịch từng field error. Timeout 20s với `AbortController`. Không thể xảy ra White Screen. |
| 4.3 | **Responsive Layout** | 10/10 | $$✅ Đã Fix Tốt$$ | **18 instances** `overflow-x-auto` trên tất cả table components: ContractList, SupportRequestList, EmployeeList, DepartmentList, DocumentList, ProjectList, AuditLogList, ProductList, v.v. |
| 4.4 | **Form UX (Searchable + Loading)** | 10/10 | $$✅ Đã Fix Tốt$$ | `SearchableSelect` component được implement **2 lần** (trong `Modals.tsx` dòng 162 và `SupportRequestList.tsx` dòng 187) với search filter, keyboard navigation. Nút Submit có `disabled={isSubmitting}` + label "Đang lưu..." (SupportRequestList dòng 1497-1500). |

---

## 5. 📌 GIẢI PHÁP ĐỀ XUẤT (REMEDIATION CODE)

### 🔴 P0-FIX-01: Chặn IDOR — Thêm Data Scope Filter vào mọi API mutation

**Vấn đề:** `Contract::query()->findOrFail($id)` không kiểm tra ownership.

**Giải pháp:** Tạo trait `ScopedByDepartment` và áp dụng lên Controller.

```php
<?php
// File: app/Support/Scopes/DataScopeFilter.php

namespace App\Support\Scopes;

use App\Support\Auth\UserAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class DataScopeFilter
{
    public function __construct(
        private readonly UserAccessService $accessService
    ) {}

    /**
     * Apply data scope filtering to a query.
     * Ensures user can only access records within their department scope.
     */
    public function applyToQuery(Builder $query, Request $request, string $deptColumn = 'dept_id'): Builder
    {
        $user = $request->user();
        if ($user === null) {
            return $query->whereRaw('1 = 0');
        }

        $userId = (int) $user->id;
        if ($this->accessService->isAdmin($userId)) {
            return $query; // Admin sees all
        }

        $deptIds = $this->accessService->resolveDepartmentIdsForUser($userId);
        if ($deptIds === null) {
            return $query; // ALL scope
        }

        if ($deptIds === []) {
            return $query->whereRaw('1 = 0'); // No access
        }

        return $query->whereIn($deptColumn, $deptIds);
    }

    /**
     * Verify a single model belongs to user's scope.
     * Use this for show/update/delete operations.
     */
    public function canAccessModel(Model $model, Request $request, string $deptAttribute = 'dept_id'): bool
    {
        $user = $request->user();
        if ($user === null) {
            return false;
        }

        $userId = (int) $user->id;
        if ($this->accessService->isAdmin($userId)) {
            return true;
        }

        $deptIds = $this->accessService->resolveDepartmentIdsForUser($userId);
        if ($deptIds === null) {
            return true; // ALL scope
        }

        $modelDeptId = (int) ($model->getAttribute($deptAttribute) ?? 0);
        return in_array($modelDeptId, $deptIds, true);
    }
}
```

**Cách áp dụng vào Controller (ví dụ cho Contract):**

```php
// Trong updateContract():
$contract = Contract::query()->findOrFail($id);

// ===== THÊM ĐOẠN NÀY =====
$scopeFilter = app(DataScopeFilter::class);
if (! $scopeFilter->canAccessModel($contract, $request, 'dept_id')) {
    return response()->json(['message' => 'Bạn không có quyền truy cập hợp đồng này.'], 403);
}
// ===========================

// ... tiếp tục logic update
```

---

### 🔴 P0-FIX-02: Audit Trail — Tạo Model Observer tự động ghi log

**Vấn đề:** Bảng `audit_logs` tồn tại nhưng không có cơ chế ghi.

**Giải pháp:**

```php
<?php
// File: app/Observers/AuditableObserver.php

namespace App\Observers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuditableObserver
{
    public function created(Model $model): void
    {
        $this->recordAudit($model, 'INSERT', [], $model->getAttributes());
    }

    public function updated(Model $model): void
    {
        $original = $model->getOriginal();
        $changes = $model->getChanges();

        // Filter out timestamps
        $filteredOriginal = array_intersect_key($original, $changes);
        unset($filteredOriginal['updated_at'], $changes['updated_at']);

        $this->recordAudit($model, 'UPDATE', $filteredOriginal, $changes);
    }

    public function deleted(Model $model): void
    {
        $this->recordAudit($model, 'DELETE', $model->getOriginal(), []);
    }

    private function recordAudit(Model $model, string $event, array $oldValues, array $newValues): void
    {
        try {
            if (! Schema::hasTable('audit_logs')) {
                return;
            }

            $user = request()->user();

            DB::table('audit_logs')->insert([
                'uuid'            => (string) Str::uuid(),
                'event'           => $event,
                'auditable_type'  => $model->getTable(),
                'auditable_id'    => (int) $model->getKey(),
                'old_values'      => $oldValues !== [] ? json_encode($oldValues, JSON_UNESCAPED_UNICODE) : null,
                'new_values'      => $newValues !== [] ? json_encode($newValues, JSON_UNESCAPED_UNICODE) : null,
                'url'             => request()->fullUrl(),
                'ip_address'      => request()->ip(),
                'user_agent'      => mb_substr((string) request()->userAgent(), 0, 255),
                'created_at'      => now(),
                'created_by'      => $user ? (int) $user->id : null,
            ]);
        } catch (\Throwable) {
            // Silently fail to avoid breaking business operations
        }
    }
}
```

**Đăng ký trong `AppServiceProvider.php`:**

```php
use App\Models\Contract;
use App\Models\Customer;
use App\Models\Department;
use App\Models\InternalUser;
use App\Models\Opportunity;
use App\Models\Project;
use App\Models\Vendor;
use App\Observers\AuditableObserver;

public function boot(): void
{
    // Rate Limiter (giữ nguyên)
    RateLimiter::for('auth.login', function (Request $request): Limit {
        $username = strtolower(trim((string) $request->input('username', '')));
        $key = sprintf('%s|%s', $request->ip(), $username);
        return Limit::perMinute(5)->by($key);
    });

    // Register Audit Observer cho tất cả Model chính
    $auditableModels = [
        Contract::class,
        Customer::class,
        Department::class,
        InternalUser::class,
        Opportunity::class,
        Project::class,
        Vendor::class,
    ];

    foreach ($auditableModels as $model) {
        $model::observe(AuditableObserver::class);
    }
}
```

---

### 🟡 P1-FIX-03: Validate `expiry_date` phải sau `sign_date`

**Vấn đề:** Không có rule so sánh ngày, cho phép `expiry_date < sign_date`.

**File:** `V5MasterDataController.php` dòng 2885-2886

**Sửa từ:**
```php
'sign_date' => ['nullable', 'date'],
'expiry_date' => ['nullable', 'date'],
```

**Thành:**
```php
'sign_date' => ['nullable', 'date'],
'expiry_date' => ['nullable', 'date', 'after_or_equal:sign_date'],
```

Tương tự, sửa validation trong `updateContract()` tại dòng 2965-2966.

---

### 🟡 P1-FIX-04: Thêm Data Scope filter cho API Contracts, Projects, Opportunities

**Vấn đề:** Chỉ có `employees()` áp dụng data isolation.

**File:** `V5MasterDataController.php`, hàm `contracts()` (dòng 498)

**Thêm sau dòng 525 (sau `->select(...)`):**

```php
// Áp dụng data scope isolation
$authenticatedUser = $request->user();
if ($authenticatedUser instanceof InternalUser) {
    $scopeFilter = app(\App\Support\Scopes\DataScopeFilter::class);
    $deptColumn = $this->hasColumn('contracts', 'dept_id') ? 'contracts.dept_id' : null;
    if ($deptColumn !== null) {
        $scopeFilter->applyToQuery($query, $request, $deptColumn);
    }
}
```

Áp dụng tương tự cho `projects()`, `opportunities()`, `documents()`, `supportRequests()`.

---

### 🟢 P2-FIX-05: Thêm Cache cho Department list

```php
// Trong hàm departments(), thay vì query trực tiếp:
use Illuminate\Support\Facades\Cache;

$rows = Cache::remember('departments_list', 3600, function () {
    return Department::query()
        ->select($this->selectColumns('departments', [...]))
        ->orderBy('dept_code')
        ->get();
});
```

**Lưu ý:** Cần invalidate cache khi `storeDepartment`, `updateDepartment`, `deleteDepartment`:

```php
Cache::forget('departments_list');
```

---

### 🟢 P2-FIX-06: Thêm index cho `audit_logs.created_by`

```sql
-- Migration hoặc chạy trực tiếp:
CREATE INDEX idx_audit_created_by ON audit_logs (created_by);
CREATE INDEX idx_support_created_by ON support_requests (created_by);
```

---

### 🟢 P2-FIX-07: Xóa route `/api/user` trả raw model

**File:** `api.php` dòng 10-14

**Xóa hoặc thay thế:**
```php
// TRƯỚC (nguy hiểm):
Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', function (Request $request) {
        return $request->user(); // Trả raw model — có thể lộ data
    });
});

// SAU (an toàn):
// Đã có /api/v5/auth/me — xóa endpoint này hoàn toàn.
```

---

## 6. 📋 TỔNG HỢP ƯU TIÊN KHẮC PHỤC

| Ưu tiên | Mã Fix | Mô tả | Effort | Impact |
|:-------:|:------:|-------|:------:|:------:|
| **P0** | FIX-01 | Chặn IDOR — Data Scope cho mutation endpoints | **Medium** | **CRITICAL** |
| **P0** | FIX-02 | Audit Trail — Model Observer ghi log | **Low** | **CRITICAL** |
| **P1** | FIX-03 | Validate expiry_date > sign_date | **Trivial** | **High** |
| **P1** | FIX-04 | Data Scope filter cho Contracts/Projects/Opportunities | **Medium** | **High** |
| **P2** | FIX-05 | Cache cho danh mục tĩnh (Department, Business, Product) | **Low** | **Medium** |
| **P2** | FIX-06 | Thêm database index cho created_by | **Trivial** | **Medium** |
| **P2** | FIX-07 | Xóa route `/api/user` trả raw model | **Trivial** | **Low** |
| **P3** | — | Chia nhỏ God Controller thành Service Classes | **High** | **Medium** (maintainability) |

---

## 7. 🏗️ LỘ TRÌNH ĐỀ XUẤT CHIA NHỎ GOD CONTROLLER (P3)

```
app/Http/Controllers/Api/
├── AuthController.php              ✅ (đã tách - 297 dòng)
├── V5/
│   ├── DepartmentController.php    ← departments(), store/update/deleteDepartment()
│   ├── EmployeeController.php      ← employees(), store/update/deleteEmployee(), bulk
│   ├── CustomerController.php      ← customers(), store/update/deleteCustomer()
│   ├── VendorController.php        ← vendors(), store/update/deleteVendor()
│   ├── ProjectController.php       ← projects(), projectItems(), store/update/deleteProject()
│   ├── ContractController.php      ← contracts(), store/update/deleteContract(), generatePayments
│   ├── DocumentController.php      ← documents(), store/update/delete, upload/deleteAttachment
│   ├── OpportunityController.php   ← opportunities(), store/update/deleteOpportunity()
│   ├── SupportRequestController.php← supportRequests all actions
│   ├── AuditLogController.php      ← auditLogs()
│   └── IntegrationController.php   ← Google Drive settings/test
│
app/Services/
├── SchemaIntrospectionService.php  ← hasTable(), hasColumn(), selectColumns() (extracted)
├── DataScopeService.php            ← resolveEmployeeVisibility() logic
├── GoogleDriveService.php          ← upload/delete/auth logic
└── DocumentFileService.php         ← uploadDocumentFileToStorage(), delete
```

---

> **Ghi chú của Auditor:**
> Đợt Refactor Lần 1 đã mang lại cải thiện rất tốt ở tầng Frontend và một phần Backend (N+1, Pagination, Auth Security). Tuy nhiên, **lỗ hổng IDOR và Audit Trail rỗng là 2 vấn đề cần khắc phục NGAY LẬP TỨC** trước khi đưa hệ thống vào production. Code giải pháp đã được cung cấp ở trên — có thể copy/paste và áp dụng trực tiếp.

---

*— End of Audit Report v2.1 (Opus NI Edition) —*
