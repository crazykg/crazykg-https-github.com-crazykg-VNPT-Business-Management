# Module Employees - Tài liệu chi tiết

## Tổng quan

Module **Employees** (Nhân sự) quản lý thông tin nhân viên, tài khoản người dùng nội bộ, vị trí/chức vụ, và lịch sử công tác tại các phòng ban.

## Mục lục

1. [Kiến trúc tổng thể](#kiến-trúc-tổng-thể)
2. [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
3. [Backend API](#backend-api)
4. [Frontend Components](#frontend-components)
5. [Luồng nghiệp vụ](#luồng-nghiệp-vụ)
6. [Phân quyền](#phân-quyền)
7. [Các service chính](#các-service-chính)
8. [Ví dụ sử dụng](#ví-dụ-sử-dụng)

---

## Kiến trúc tổng thể

### Backend Stack
- **Framework**: Laravel (PHP)
- **Pattern**: Domain-Driven Design (DDD)
- **Services**: EmployeeDomainService, UserAccessDomainService
- **Controllers**: EmployeeController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: EmployeeList, UserDeptHistoryList, InternalUserModuleTabs
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (EmployeeList) │     │ (EmployeeCtrl)   │     │ (EmployeeDomain)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Employees)   │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `internal_users`

Bảng chính lưu trữ thông tin nhân viên/người dùng nội bộ.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `user_code` | varchar(100) | Mã nhân viên | Required, unique |
| `full_name` | varchar(255) | Họ và tên | Required |
| `email` | varchar(255) | Email | Required, unique |
| `phone` | varchar(50) | Số điện thoại | Nullable |
| `department_id` | bigint unsigned | FK to departments | Phòng ban hiện tại |
| `position_id` | bigint unsigned | FK to positions | Chức vụ hiện tại |
| `status` | enum | Trạng thái | ACTIVE, INACTIVE, TERMINATED |
| `hire_date` | date | Ngày vào công ty | Nullable |
| `termination_date` | date | Ngày nghỉ việc | Nullable |
| `password` | varchar(255) | Hashed password | Required |
| `remember_token` | varchar(100) | Remember me token | Nullable |
| `must_change_password` | boolean | Bắt buộc đổi mật khẩu | Default: true |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**status**:
- `ACTIVE` - Đang làm việc
- `INACTIVE` - Tạm ngưng
- `TERMINATED` - Nghỉ việc

### Bảng `positions`

Bảng lưu trữ danh mục vị trí/chức vụ.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `position_code` | varchar(100) | Mã chức vụ |
| `position_name` | varchar(255) | Tên chức vụ |
| `position_level` | enum | Cấp độ |
| `is_active` | boolean | Trạng thái |

### Bảng `user_department_history`

Bảng lưu trữ lịch sử công tác phòng ban.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `user_id` | bigint unsigned | FK to internal_users |
| `department_id` | bigint unsigned | FK to departments |
| `position_id` | bigint unsigned | FK to positions |
| `start_date` | date | Ngày bắt đầu |
| `end_date` | date | Ngày kết thúc |
| `is_current` | boolean | Đang hiện tại |

### Mối quan hệ

- `internal_users` belongsTo `department`
- `internal_users` belongsTo `position`
- `internal_users` hasMany `user_department_history`
- `internal_users` hasMany `created_contracts`
- `internal_users` hasMany `updated_contracts`
- `internal_users` hasMany `created_customer_requests`
- `internal_users` hasMany `dispatched_customer_requests`
- `internal_users` hasMany `performed_customer_requests`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Employees
Route::prefix('employees')->group(function () {
    Route::get('/', [EmployeeController::class, 'index']);
    Route::post('/', [EmployeeController::class, 'store']);
    Route::get('/{employee}', [EmployeeController::class, 'show']);
    Route::put('/{employee}', [EmployeeController::class, 'update']);
    Route::delete('/{employee}', [EmployeeController::class, 'destroy']);
    
    // Department history
    Route::get('/{employee}/dept-history', [EmployeeController::class, 'deptHistory']);
    Route::post('/{employee}/dept-history', [EmployeeController::class, 'storeDeptHistory']);
    
    // Password change
    Route::post('/{employee}/change-password', [EmployeeController::class, 'changePassword']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'employees.read',
        'store' => 'employees.write',
        'update' => 'employees.write',
        'destroy' => 'employees.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/employees` | `employees.read` | Lấy danh sách nhân viên |
| `store` | POST | `/api/v5/employees` | `employees.write` | Tạo mới nhân viên |
| `show` | GET | `/api/v5/employees/{id}` | `employees.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/employees/{id}` | `employees.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/employees/{id}` | `employees.delete` | Xóa |
| `changePassword` | POST | `/api/v5/employees/{id}/change-password` | `employees.write` | Đổi mật khẩu |

---

## Frontend Components

### Component chính

#### `EmployeeList.tsx`
**Vị trí**: `frontend/components/EmployeeList.tsx`

**Chức năng**:
- Hiển thị bảng danh sách nhân viên
- Tìm kiếm, lọc theo mã/tên/phòng ban/trạng thái
- Pagination (phân trang)
- Trigger các modal CRUD

**Props**:
```typescript
interface EmployeeListProps {
  initialQuery?: PaginatedQuery;
  onEmployeeSelect?: (employee: InternalUser) => void;
}
```

#### `UserDeptHistoryList.tsx`
**Vị trí**: `frontend/components/UserDeptHistoryList.tsx`

**Chức năng**:
- Hiển thị lịch sử công tác phòng ban
- Thêm/sửa lịch sử
- Theo dõi quá trình công tác

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách nhân viên
export const fetchEmployees = async (query?: PaginatedQuery): Promise<PaginatedResult<InternalUser>> =>
  fetchPaginatedList<InternalUser>('/api/v5/employees', query);

// Tạo mới
export const createEmployee = async (data: Partial<InternalUser>): Promise<InternalUser> =>
  fetchPost<InternalUser>('/api/v5/employees', data);

// Cập nhật
export const updateEmployee = async (id: string | number, data: Partial<InternalUser>): Promise<InternalUser> =>
  fetchPut<InternalUser>(`/api/v5/employees/${id}`, data);

// Xóa
export const deleteEmployee = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/employees/${id}`);

// Đổi mật khẩu
export const changePassword = async (id: string | number, passwords: {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}): Promise<void> =>
  fetchPost(`/api/v5/employees/${id}/change-password`, passwords);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface InternalUser {
  id: string | number;
  user_code: string;
  full_name: string;
  email: string;
  phone?: string | null;
  department_id?: string | number | null;
  position_id?: string | number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  hire_date?: string | null;
  termination_date?: string | null;
  must_change_password: boolean;
  department?: Department | null;
  position?: Position | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo nhân viên mới

```
1. Người dùng nhập thông tin nhân viên
2. Validate: mã nhân viên (unique), email (unique)
3. Hash password
4. Lưu vào CSDL
5. Ghi audit log
6. Gửi email mời (optional)
```

### 2. Cập nhật phòng ban

```
1. Chọn nhân viên
2. Thay đổi department_id
3. Tạo record mới trong user_department_history
4. Đánh dấu record cũ là is_current = false
5. Lưu audit log
```

### 3. Đổi mật khẩu

```
1. Người dùng nhập mật khẩu hiện tại + mới
2. Validate mật khẩu hiện tại
3. Hash mật khẩu mới
4. Cập nhật vào CSDL
5. Set must_change_password = false
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `employees.read` | Xem nhân viên | HR | All authenticated |
| `employees.write` | Thêm/Sửa nhân viên | HR | HR, Admin |
| `employees.delete` | Xóa nhân viên | HR | Admin |
| `employees.import` | Nhập từ Excel | HR | HR, Admin |
| `employees.export` | Xuất ra Excel | HR | All authenticated |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `EmployeeDomainService` | `backend/app/Services/V5/Domain/EmployeeDomainService.php` | Orchestrates CRUD operations |
| `UserAccessDomainService` | `backend/app/Services/V5/Domain/UserAccessDomainService.php` | User access, roles, permissions |

---

## UI/UX Notes

### Layout Design

**Danh sách**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Nhân viên                             [+ Thêm mới]     │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...] [Lọc: Phòng ban ▼] [Xuất] [Nhập]             │
├─────────────────────────────────────────────────────────────────┤
│  Mã | Tên | Email | Phòng ban | Chức vụ | Trạng thái | Thao tác│
│  ─────────────────────────────────────────────────────────────  │
│  NV001 | Nguyễn Văn A | a@vnpt.vn | Kinh doanh | NV | ACTIVE   │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `user_code`: Bắt buộc, unique, max 100 ký tự
- `full_name`: Bắt buộc, max 255 ký tự
- `email`: Bắt buộc, unique, email format
- `password`: Bắt buộc khi tạo mới, min 8 ký tự
- `department_id`: Optional
- `position_id`: Optional

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/employees.skill](../skills/employees.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
