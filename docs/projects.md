# Module Projects - Tài liệu chi tiết

## Tổng quan

Module **Projects** (Dự án) quản lý thông tin dự án, quy trình thực hiện dự án (procedures), ma trận RACI, và lịch trình doanh thu dự án.

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
- **Pattern**: Domain-Driven Design (DDD) + Project Procedure Pattern
- **Services**: ProjectDomainService, ProjectProcedureRaciService, ProjectProcedureStepService, ProjectProcedureTemplateService, ProjectRevenueScheduleDomainService
- **Controllers**: ProjectController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: ProjectList, ProjectProcedureModal, ProcedureTemplateManagement, RaciMatrixPanel, ProjectRevenueSchedulePanel
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (ProjectList)  │     │ (ProjectCtrl)    │     │ (ProjectDomain) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Projects)    │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `projects`

Bảng chính lưu trữ thông tin dự án.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `project_code` | varchar(100) | Mã dự án | Required, unique |
| `project_name` | varchar(255) | Tên dự án | Required |
| `customer_id` | bigint unsigned | FK to customers | Nullable |
| `department_id` | bigint unsigned | FK to departments | Phòng ban phụ trách |
| `project_type` | enum | Loại dự án | INTERNAL, EXTERNAL |
| `status` | enum | Trạng thái | PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED |
| `priority` | enum | Độ ưu tiên | LOW, MEDIUM, HIGH, URGENT |
| `start_date` | date | Ngày bắt đầu | Nullable |
| `end_date` | date | Ngày kết thúc | Nullable |
| `budget` | decimal(15,2) | Ngân sách | Default: 0 |
| `actual_cost` | decimal(15,2) | Chi phí thực tế | Default: 0 |
| `manager_user_id` | bigint unsigned | FK to internal_users | Quản lý dự án |
| `description` | text | Mô tả | Nullable |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**project_type**:
- `INTERNAL` - Dự án nội bộ
- `EXTERNAL` - Dự án khách hàng

**status**:
- `PLANNING` - Đang lập kế hoạch
- `IN_PROGRESS` - Đang thực hiện
- `ON_HOLD` - Tạm hoãn
- `COMPLETED` - Hoàn thành
- `CANCELLED` - Hủy bỏ

**priority**:
- `LOW` - Thấp
- `MEDIUM` - Trung bình
- `HIGH` - Cao
- `URGENT` - Khẩn cấp

### Bảng `project_procedures`

Bảng lưu trữ quy trình thực hiện dự án.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `project_id` | bigint unsigned | FK to projects |
| `procedure_code` | varchar(100) | Mã quy trình |
| `procedure_name` | varchar(255) | Tên quy trình |
| `status` | enum | Trạng thái |
| `start_date` | date | Ngày bắt đầu |
| `end_date` | date | Ngày kết thúc |

### Bảng `project_procedure_steps`

Bảng lưu trữ các bước trong quy trình.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `procedure_id` | bigint unsigned | FK to project_procedures |
| `step_code` | varchar(100) | Mã bước |
| `step_name` | varchar(255) | Tên bước |
| `step_order` | int | Thứ tự |
| `description` | text | Mô tả |
| `estimated_hours` | decimal(8,2) | Giờ ước tính |

### Bảng `project_procedure_raci`

Bảng lưu trữ ma trận RACI cho quy trình.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `procedure_id` | bigint unsigned | FK to project_procedures |
| `user_id` | bigint unsigned | FK to internal_users |
| `role_type` | enum | Loại vai trò |
| `raci_type` | enum | RACI type |

### Bảng `project_procedure_templates`

Bảng lưu trữ mẫu quy trình.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `template_code` | varchar(100) | Mã mẫu |
| `template_name` | varchar(255) | Tên mẫu |
| `template_type` | enum | Loại mẫu |
| `is_active` | boolean | Trạng thái |

### Bảng `project_revenue_schedules`

Bảng lưu trữ lịch trình doanh thu dự án.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `project_id` | bigint unsigned | FK to projects |
| `schedule_date` | date | Ngày dự kiến |
| `amount` | decimal(15,2) | Số tiền |
| `status` | enum | Trạng thái |
| `actual_date` | date | Ngày thực tế |
| `actual_amount` | decimal(15,2) | Số tiền thực tế |

### Mối quan hệ

- `projects` belongsTo `customers` (optional)
- `projects` belongsTo `department`
- `projects` belongsTo `manager_user`
- `projects` hasMany `contracts`
- `projects` hasMany `project_procedures`
- `projects` hasMany `project_revenue_schedules`
- `project_procedures` hasMany `project_procedure_steps`
- `project_procedures` hasMany `project_procedure_raci`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Projects
Route::prefix('projects')->group(function () {
    Route::get('/', [ProjectController::class, 'index']);
    Route::post('/', [ProjectController::class, 'store']);
    Route::get('/{project}', [ProjectController::class, 'show']);
    Route::put('/{project}', [ProjectController::class, 'update']);
    Route::delete('/{project}', [ProjectController::class, 'destroy']);
    
    // Procedures
    Route::get('/{project}/procedures', [ProjectController::class, 'procedures']);
    Route::post('/{project}/procedures', [ProjectController::class, 'storeProcedure']);
    
    // Revenue Schedule
    Route::get('/{project}/revenue-schedule', [ProjectController::class, 'revenueSchedule']);
    Route::post('/{project}/revenue-schedule', [ProjectController::class, 'storeRevenueSchedule']);
    
    // Templates
    Route::get('/procedure-templates', [ProjectController::class, 'procedureTemplates']);
    Route::post('/procedure-templates', [ProjectController::class, 'storeProcedureTemplate']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'projects.read',
        'store' => 'projects.write',
        'update' => 'projects.write',
        'destroy' => 'projects.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/projects` | `projects.read` | Lấy danh sách dự án |
| `store` | POST | `/api/v5/projects` | `projects.write` | Tạo mới dự án |
| `show` | GET | `/api/v5/projects/{id}` | `projects.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/projects/{id}` | `projects.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/projects/{id}` | `projects.delete` | Xóa |

---

## Frontend Components

### Component chính

#### `ProjectList.tsx`
**Vị trí**: `frontend/components/ProjectList.tsx`

**Chức năng**:
- Hiển thị bảng danh sách dự án
- Tìm kiếm, lọc theo mã/tên/khách hàng/trạng thái
- Pagination (phân trang)
- Trigger các modal CRUD

**Props**:
```typescript
interface ProjectListProps {
  initialQuery?: PaginatedQuery;
  onProjectSelect?: (project: Project) => void;
}
```

#### `ProjectProcedureModal.tsx`
**Vị trí**: `frontend/components/ProjectProcedureModal.tsx`

**Chức năng**:
- Quản lý quy trình dự án
- Thêm/sửa/xóa bước
- Ma trận RACI

#### `RaciMatrixPanel.tsx`
**Vị trí**: `frontend/components/procedure/RaciMatrixPanel.tsx`

**Chức năng**:
- Hiển thị ma trận RACI
- Assign roles cho users
- RACI types: Responsible, Accountable, Consulted, Informed

#### `ProjectRevenueSchedulePanel.tsx`
**Vị trí**: `frontend/components/ProjectRevenueSchedulePanel.tsx`

**Chức năng**:
- Quản lý lịch trình doanh thu
- Theo dõi planned vs actual
- Forecast revenue

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách dự án
export const fetchProjects = async (query?: PaginatedQuery): Promise<PaginatedResult<Project>> =>
  fetchPaginatedList<Project>('/api/v5/projects', query);

// Tạo mới
export const createProject = async (data: Partial<Project>): Promise<Project> =>
  fetchPost<Project>('/api/v5/projects', data);

// Cập nhật
export const updateProject = async (id: string | number, data: Partial<Project>): Promise<Project> =>
  fetchPut<Project>(`/api/v5/projects/${id}`, data);

// Xóa
export const deleteProject = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/projects/${id}`);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface Project {
  id: string | number;
  project_code: string;
  project_name: string;
  customer_id?: string | number | null;
  department_id?: string | number | null;
  project_type: 'INTERNAL' | 'EXTERNAL';
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  start_date?: string | null;
  end_date?: string | null;
  budget: number;
  actual_cost: number;
  manager_user_id?: string | number | null;
  description?: string | null;
  customer?: Customer | null;
  department?: Department | null;
  manager?: InternalUser | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo dự án mới

```
1. Người dùng nhập thông tin dự án
2. Validate: mã dự án (unique), tên
3. Chọn customer (nếu external project)
4. Chọn department, manager
5. Lưu vào CSDL
6. Ghi audit log
```

### 2. Tạo quy trình từ template

```
1. Chọn dự án
2. Chọn template quy trình
3. Customize các bước (nếu cần)
4. Assign RACI roles
5. Lưu quy trình
```

### 3. Quản lý RACI

```
1. Xem ma trận RACI
2. Assign user cho mỗi role
3. RACI types:
   - R (Responsible): Người thực hiện
   - A (Accountable): Người chịu trách nhiệm
   - C (Consulted): Người được tham vấn
   - I (Informed): Người được thông báo
```

### 4. Theo dõi doanh thu

```
1. Tạo revenue schedule
2. Nhập planned amount và date
3. Cập nhật actual khi có
4. Theo dõi variance
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `projects.read` | Xem dự án | PROJECTS | All authenticated |
| `projects.write` | Thêm/Sửa dự án | PROJECTS | PM, Admin |
| `projects.delete` | Xóa dự án | PROJECTS | Admin |
| `projects.import` | Nhập từ Excel | PROJECTS | Admin, PM |
| `projects.export` | Xuất ra Excel | PROJECTS | All authenticated |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `ProjectDomainService` | `backend/app/Services/V5/Domain/ProjectDomainService.php` | Orchestrates CRUD operations |
| `ProjectProcedureRaciService` | `backend/app/Services/V5/ProjectProcedure/ProjectProcedureRaciService.php` | RACI matrix management |
| `ProjectProcedureStepService` | `backend/app/Services/V5/ProjectProcedure/ProjectProcedureStepService.php` | Procedure step management |
| `ProjectProcedureTemplateService` | `backend/app/Services/V5/ProjectProcedure/ProjectProcedureTemplateService.php` | Template management |
| `ProjectRevenueScheduleDomainService` | `backend/app/Services/V5/Domain/ProjectRevenueScheduleDomainService.php` | Revenue schedule management |

---

## UI/UX Notes

### Layout Design

**Danh sách**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Dự án                                 [+ Thêm mới]     │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...] [Lọc: Trạng thái ▼] [Xuất] [Nhập]            │
├─────────────────────────────────────────────────────────────────┤
│  Mã | Tên | Khách hàng | PM | Trạng thái | Ưu tiên | Tiến độ  │
│  ─────────────────────────────────────────────────────────────  │
│  DA001 | eHospital | BV Chợ Rẫy | Nguyễn VA | IN_PROGRESS | 🔴 │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `project_code`: Bắt buộc, unique, max 100 ký tự
- `project_name`: Bắt buộc, max 255 ký tự
- `project_type`: Bắt buộc (INTERNAL/EXTERNAL)
- `department_id`: Bắt buộc
- `manager_user_id`: Bắt buộc
- `start_date`: Optional, <= end_date
- `end_date`: Optional, >= start_date

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/projects.skill](../skills/projects.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
