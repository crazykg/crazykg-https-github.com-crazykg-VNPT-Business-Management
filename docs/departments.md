# Module Departments - Tài liệu chi tiết

## Tổng quan

Module **Departments** (Phòng ban) quản lý cơ cấu tổ chức phòng ban trong công ty, hỗ trợ phân quyền theo phòng ban và quản lý nhân viên thuộc phòng ban.

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
- **Pattern**: Domain-Driven Design (DDD) + Hierarchical Tree
- **Services**: DepartmentDomainService, DepartmentWeeklyScheduleDomainService
- **Controllers**: DepartmentController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: DepartmentList, DepartmentWeeklyScheduleManagement
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (DepartmentList)│    │ (DepartmentCtrl) │     │ (Dept Domain)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Departments) │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `departments`

Bảng chính lưu trữ thông tin phòng ban.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `dept_code` | varchar(100) | Mã phòng ban | Required, unique |
| `dept_name` | varchar(255) | Tên phòng ban | Required |
| `parent_id` | bigint unsigned | FK to departments | Phòng ban cha (hierarchy) |
| `dept_path` | varchar(500) | Đường dẫn đầy đủ | Materialized path |
| `is_active` | boolean | Trạng thái hoạt động | Default: true |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Hierarchical Structure

```
Công ty VNPT
├── Ban Giám đốc
├── Phòng Kinh doanh
│   ├── Team Bán hàng
│   └── Team Marketing
├── Phòng Kỹ thuật
│   ├── Team Phát triển
│   └── Team Hạ tầng
└── Phòng Hành chính
    ├── Team Nhân sự
    └── Team Kế toán
```

#### Indexes

```sql
-- Primary key
PRIMARY KEY (id)

-- Unique constraints
UNIQUE KEY (dept_code) WHERE deleted_at IS NULL

-- Foreign keys
KEY (parent_id)
KEY (created_by)
KEY (updated_by)

-- Hierarchical queries
KEY (dept_path)
```

### Bảng `department_weekly_schedules`

Bảng lưu trữ lịch làm việc tuần của phòng ban.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `department_id` | bigint unsigned | FK to departments |
| `week_start_date` | date | Ngày bắt đầu tuần |
| `week_end_date` | date | Ngày kết thúc tuần |
| `status` | enum | Trạng thái |
| `created_by` | bigint unsigned | Người tạo |
| `updated_by` | bigint unsigned | Người cập nhật |

### Bảng `department_weekly_schedule_entries`

Bảng lưu trữ các mục trong lịch tuần.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `schedule_id` | bigint unsigned | FK to department_weekly_schedules |
| `entry_date` | date | Ngày |
| `entry_type` | enum | Loại công việc |
| `title` | varchar(255) | Tiêu đề |
| `description` | text | Mô tả |
| `start_time` | time | Giờ bắt đầu |
| `end_time` | time | Giờ kết thúc |

### Mối quan hệ

- `departments` belongsTo `parent` (self-referential)
- `departments` hasMany `children` (self-referential)
- `departments` hasMany `employees` (InternalUser)
- `departments` hasMany `department_weekly_schedules`
- `departments` hasMany `revenue_targets`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Departments
Route::prefix('departments')->group(function () {
    Route::get('/', [DepartmentController::class, 'index']);
    Route::post('/', [DepartmentController::class, 'store']);
    Route::get('/{department}', [DepartmentController::class, 'show']);
    Route::put('/{department}', [DepartmentController::class, 'update']);
    Route::delete('/{department}', [DepartmentController::class, 'destroy']);
    
    // Tree structure
    Route::get('/tree', [DepartmentController::class, 'tree']);
    
    // Weekly schedule
    Route::get('/{department}/weekly-schedules', [DepartmentController::class, 'weeklySchedules']);
    Route::post('/{department}/weekly-schedules', [DepartmentController::class, 'storeWeeklySchedule']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'departments.read',
        'store' => 'departments.write',
        'update' => 'departments.write',
        'destroy' => 'departments.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/departments` | `departments.read` | Lấy danh sách phòng ban |
| `store` | POST | `/api/v5/departments` | `departments.write` | Tạo mới phòng ban |
| `show` | GET | `/api/v5/departments/{id}` | `departments.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/departments/{id}` | `departments.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/departments/{id}` | `departments.delete` | Xóa |
| `tree` | GET | `/api/v5/departments/tree` | `departments.read` | Cây phòng ban |

---

## Frontend Components

### Component chính

#### `DepartmentList.tsx`
**Vị trí**: `frontend/components/DepartmentList.tsx`

**Chức năng**:
- Hiển thị bảng/cây danh sách phòng ban
- Tìm kiếm, lọc theo mã/tên
- Pagination (phân trang)
- Trigger các modal CRUD
- Hiển thị hierarchy (tree view)

**Props**:
```typescript
interface DepartmentListProps {
  initialQuery?: PaginatedQuery;
  onDepartmentSelect?: (department: Department) => void;
  viewMode?: 'table' | 'tree';
}
```

#### `DepartmentWeeklyScheduleManagement.tsx`
**Vị trí**: `frontend/components/DepartmentWeeklyScheduleManagement.tsx`

**Chức năng**:
- Quản lý lịch làm việc tuần
- Xem/thêm/sửa lịch tuần
- Phân công công việc

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách phòng ban
export const fetchDepartments = async (query?: PaginatedQuery): Promise<PaginatedResult<Department>> =>
  fetchPaginatedList<Department>('/api/v5/departments', query);

// Lấy cây phòng ban
export const fetchDepartmentsTree = async (): Promise<Department[]> =>
  fetchList<Department>('/api/v5/departments/tree');

// Tạo mới
export const createDepartment = async (data: Partial<Department>): Promise<Department> =>
  fetchPost<Department>('/api/v5/departments', data);

// Cập nhật
export const updateDepartment = async (id: string | number, data: Partial<Department>): Promise<Department> =>
  fetchPut<Department>(`/api/v5/departments/${id}`, data);

// Xóa
export const deleteDepartment = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/departments/${id}`);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface Department {
  id: string | number;
  dept_code: string;
  dept_name: string;
  parent_id?: string | number | null;
  dept_path?: string | null;
  is_active: boolean;
  parent?: Department | null;
  children?: Department[];
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo phòng ban mới

```
1. Người dùng nhập thông tin phòng ban
2. Chọn phòng ban cha (nếu có)
3. Validate: mã phòng ban (unique), tên
4. Tự động tính dept_path từ parent
5. Lưu vào CSDL
6. Ghi audit log
```

### 2. Cập nhật hierarchy

```
1. Thay đổi parent_id
2. Recalculate dept_path cho phòng ban và tất cả children
3. Update recursive
```

### 3. Quản lý lịch tuần

```
1. Chọn phòng ban
2. Chọn tuần
3. Thêm/sửa công việc trong tuần
4. Publish lịch
5. Thông báo nhân viên
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `departments.read` | Xem phòng ban | ORGANIZATION | All authenticated |
| `departments.write` | Thêm/Sửa phòng ban | ORGANIZATION | Admin, HR |
| `departments.delete` | Xóa phòng ban | ORGANIZATION | Admin |
| `departments.import` | Nhập từ Excel | ORGANIZATION | Admin, HR |
| `departments.export` | Xuất ra Excel | ORGANIZATION | All authenticated |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `DepartmentDomainService` | `backend/app/Services/V5/Domain/DepartmentDomainService.php` | Orchestrates CRUD operations |
| `DepartmentWeeklyScheduleDomainService` | `backend/app/Services/V5/Domain/DepartmentWeeklyScheduleDomainService.php` | Weekly schedule management |

---

## UI/UX Notes

### Layout Design

**Danh sách (Tree View)**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Phòng ban                             [+ Thêm mới]     │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...]                        [Tree ▼] [Xuất]        │
├─────────────────────────────────────────────────────────────────┤
│  📁 Công ty VNPT                                                 │
│    ├── 📁 Ban Giám đốc                                          │
│    ├── 📁 Phòng Kinh doanh                                       │
│    │   ├── 📁 Team Bán hàng                                     │
│    │   └── 📁 Team Marketing                                    │
│    ├── 📁 Phòng Kỹ thuật                                         │
│    │   ├── 📁 Team Phát triển                                   │
│    │   └── 📁 Team Hạ tầng                                      │
│    └── 📁 Phòng Hành chính                                       │
│        ├── 📁 Team Nhân sự                                      │
│        └── 📁 Team Kế toán                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `dept_code`: Bắt buộc, unique, max 100 ký tự, uppercase
- `dept_name`: Bắt buộc, max 255 ký tự
- `parent_id`: Optional (null = root level)

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/departments.skill](../skills/departments.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
