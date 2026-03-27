# Module Support Master - Tài liệu chi tiết

## Tổng quan

Module **Support Master** (Danh mục Hỗ trợ) quản lý các danh mục cấu hình cho module Customer Request, bao gồm: nhóm dịch vụ hỗ trợ, trạng thái yêu cầu, cấu hình SLA, loại hoạt động worklog, và vị trí liên hệ hỗ trợ.

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
- **Pattern**: Domain-Driven Design (DDD) + Configuration Pattern
- **Services**: SupportServiceGroupService, SupportRequestStatusService, SupportSlaConfigService, WorklogActivityTypeService, SupportContactPositionDomainService
- **Controllers**: SupportMasterController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: SupportMasterManagement
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (Support Master)│    │ (SupportMaster)  │     │ (SupportConfig) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Config)      │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `support_service_groups`

Bảng lưu trữ nhóm dịch vụ hỗ trợ.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `group_code` | varchar(100) | Mã nhóm | Required, unique |
| `group_name` | varchar(255) | Tên nhóm | Required |
| `parent_id` | bigint unsigned | FK to self | Nhóm cha (hierarchy) |
| `group_path` | varchar(500) | Đường dẫn đầy đủ | Materialized path |
| `description` | text | Mô tả | Nullable |
| `is_active` | boolean | Trạng thái | Default: true |
| `sort_order` | int | Thứ tự | Default: 0 |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

### Bảng `support_request_statuses`

Bảng lưu trữ trạng thái yêu cầu hỗ trợ (custom statuses).

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `status_code` | varchar(100) | Mã trạng thái |
| `status_name` | varchar(255) | Tên trạng thái |
| `status_group` | enum | Nhóm trạng thái |
| `color` | varchar(50) | Màu hiển thị |
| `is_active` | boolean | Trạng thái |
| `sort_order` | int | Thứ tự |

### Bảng `support_sla_configs`

Bảng cấu hình SLA cho yêu cầu hỗ trợ.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `priority` | enum | Độ ưu tiên |
| `response_time_hours` | decimal(8,2) | Thời gian phản hồi |
| `resolution_time_hours` | decimal(8,2) | Thời gian giải quyết |
| `escalation_time_hours` | decimal(8,2) | Thời gian leo thang |
| `is_active` | boolean | Trạng thái |

### Bảng `worklog_activity_types`

Bảng lưu trữ loại hoạt động worklog.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `type_code` | varchar(100) | Mã loại |
| `type_name` | varchar(255) | Tên loại |
| `description` | text | Mô tả |
| `is_billable` | boolean | Có tính phí |
| `default_rate` | decimal(10,2) | Đơn giá mặc định |
| `is_active` | boolean | Trạng thái |

### Bảng `support_contact_positions`

Bảng lưu trữ vị trí liên hệ hỗ trợ tại khách hàng.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `customer_id` | bigint unsigned | FK to customers |
| `customer_personnel_id` | bigint unsigned | FK to customer_personnel |
| `position_type` | enum | Loại liên hệ |
| `is_primary` | boolean | Liên hệ chính |
| `contact_methods` | json | Phương thức liên hệ |

### Mối quan hệ

- `support_service_groups` belongsTo `parent` (self-referential)
- `support_service_groups` hasMany `children` (self-referential)
- `support_request_statuses` hasMany `customer_request_cases`
- `support_sla_configs` appliesTo `customer_request_cases`
- `worklog_activity_types` hasMany `customer_request_worklogs`
- `support_contact_positions` belongsTo `customers`
- `support_contact_positions` belongsTo `customer_personnel`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Support Master (Support Config)
Route::prefix('support-config')->group(function () {
    // Service Groups
    Route::get('/service-groups', [SupportMasterController::class, 'serviceGroups']);
    Route::post('/service-groups', [SupportMasterController::class, 'storeServiceGroup']);
    Route::put('/service-groups/{group}', [SupportMasterController::class, 'updateServiceGroup']);
    Route::delete('/service-groups/{group}', [SupportMasterController::class, 'deleteServiceGroup']);
    
    // Request Statuses
    Route::get('/request-statuses', [SupportMasterController::class, 'requestStatuses']);
    Route::post('/request-statuses', [SupportMasterController::class, 'storeRequestStatus']);
    
    // SLA Configs
    Route::get('/sla-configs', [SupportMasterController::class, 'slaConfigs']);
    Route::put('/sla-configs/{config}', [SupportMasterController::class, 'updateSlaConfig']);
    
    // Activity Types
    Route::get('/activity-types', [SupportMasterController::class, 'activityTypes']);
    Route::post('/activity-types', [SupportMasterController::class, 'storeActivityType']);
    
    // Contact Positions
    Route::get('/contact-positions', [SupportMasterController::class, 'contactPositions']);
    Route::post('/contact-positions', [SupportMasterController::class, 'storeContactPosition']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'serviceGroups' => 'support_requests.read',
        'requestStatuses' => 'support_requests.read',
        'slaConfigs' => 'support_requests.read',
        'activityTypes' => 'support_requests.read',
        'contactPositions' => 'support_requests.read',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `serviceGroups` | GET | `/api/v5/support-config/service-groups` | `support_requests.read` | Lấy nhóm dịch vụ |
| `storeServiceGroup` | POST | `/api/v5/support-config/service-groups` | `support_requests.write` | Tạo nhóm dịch vụ |
| `requestStatuses` | GET | `/api/v5/support-config/request-statuses` | `support_requests.read` | Lấy trạng thái |
| `slaConfigs` | GET | `/api/v5/support-config/sla-configs` | `support_requests.read` | Lấy cấu hình SLA |
| `activityTypes` | GET | `/api/v5/support-config/activity-types` | `support_requests.read` | Lấy loại hoạt động |
| `contactPositions` | GET | `/api/v5/support-config/contact-positions` | `support_requests.read` | Lấy vị trí liên hệ |

---

## Frontend Components

### Component chính

#### `SupportMasterManagement.tsx`
**Vị trí**: `frontend/components/SupportMasterManagement.tsx`

**Chức năng**:
- Hub trung tâm cho quản lý danh mục hỗ trợ
- Tabs: Service Groups, Request Statuses, SLA Configs, Activity Types, Contact Positions
- CRUD operations cho từng danh mục

**Props**:
```typescript
interface SupportMasterManagementProps {
  initialTab?: 'service-groups' | 'statuses' | 'sla' | 'activity-types' | 'contact-positions';
}
```

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Service Groups
export const fetchServiceGroups = async (): Promise<SupportServiceGroup[]> =>
  fetchList<SupportServiceGroup>('/api/v5/support-config/service-groups');

export const createServiceGroup = async (data: Partial<SupportServiceGroup>): Promise<SupportServiceGroup> =>
  fetchPost<SupportServiceGroup>('/api/v5/support-config/service-groups', data);

// SLA Configs
export const fetchSlaConfigs = async (): Promise<SupportSlaConfig[]> =>
  fetchList<SupportSlaConfig>('/api/v5/support-config/sla-configs');

export const updateSlaConfig = async (id: string | number, data: Partial<SupportSlaConfig>): Promise<SupportSlaConfig> =>
  fetchPut<SupportSlaConfig>(`/api/v5/support-config/sla-configs/${id}`, data);

// Activity Types
export const fetchActivityTypes = async (): Promise<WorklogActivityType[]> =>
  fetchList<WorklogActivityType>('/api/v5/support-config/activity-types');

export const createActivityType = async (data: Partial<WorklogActivityType>): Promise<WorklogActivityType> =>
  fetchPost<WorklogActivityType>('/api/v5/support-config/activity-types', data);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface SupportServiceGroup {
  id: string | number;
  group_code: string;
  group_name: string;
  parent_id?: string | number | null;
  group_path?: string | null;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  parent?: SupportServiceGroup | null;
  children?: SupportServiceGroup[];
  created_at?: string;
  updated_at?: string;
}

export interface SupportSlaConfig {
  id: string | number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_time_hours: number;
  is_active: boolean;
}

export interface WorklogActivityType {
  id: string | number;
  type_code: string;
  type_name: string;
  description?: string | null;
  is_billable: boolean;
  default_rate: number;
  is_active: boolean;
}
```

---

## Luồng nghiệp vụ

### 1. Quản lý nhóm dịch vụ

```
1. Xem cây nhóm dịch vụ
2. Tạo nhóm mới (chọn parent nếu có)
3. Sắp xếp thứ tự
4. Kích hoạt/Vô hiệu hóa nhóm
```

### 2. Cấu hình SLA

```
1. Xem danh sách SLA configs theo priority
2. Cập nhật thời gian response/resolution/escalation
3. Lưu cấu hình
4. Áp dụng cho customer request cases mới
```

### 3. Quản lý loại hoạt động worklog

```
1. Xem danh sách activity types
2. Tạo loại mới
3. Cấu hình is_billable và default_rate
4. Sử dụng khi ghi worklog
```

### 4. Quản lý vị trí liên hệ

```
1. Chọn khách hàng
2. Xem danh sách contact positions
3. Thêm vị trí liên hệ mới
4. Chỉ định primary contact
5. Cấu hình contact methods (email, phone, SMS)
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `support_requests.read` | Xem cấu hình hỗ trợ | SUPPORT | All authenticated |
| `support_requests.write` | Sửa cấu hình hỗ trợ | SUPPORT | Admin, Support Manager |
| `support_contact_positions.read` | Xem vị trí liên hệ | SUPPORT | All authenticated |
| `support_contact_positions.write` | Sửa vị trí liên hệ | SUPPORT | Admin, Support Manager |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `SupportServiceGroupService` | `backend/app/Services/V5/SupportConfig/SupportServiceGroupService.php` | Service group management |
| `SupportRequestStatusService` | `backend/app/Services/V5/SupportConfig/SupportRequestStatusService.php` | Request status management |
| `SupportSlaConfigService` | `backend/app/Services/V5/SupportConfig/SupportSlaConfigService.php` | SLA configuration |
| `WorklogActivityTypeService` | `backend/app/Services/V5/SupportConfig/WorklogActivityTypeService.php` | Activity type management |
| `SupportContactPositionDomainService` | `backend/app/Services/V5/Domain/SupportContactPositionDomainService.php` | Contact position management |

---

## UI/UX Notes

### Layout Design

**Support Master Management**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Danh mục Hỗ trợ                                                │
├─────────────────────────────────────────────────────────────────┤
│  [Service Groups] [Statuses] [SLA] [Activity Types] [Contacts] │
├─────────────────────────────────────────────────────────────────┤
│  Nhóm Dịch vụ Hỗ trợ                          [+ Thêm nhóm]     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 Hỗ trợ Kỹ thuật                                      │   │
│  │   ├── 📁 Phần mềm                                       │   │
│  │   ├── 📁 Phần cứng                                      │   │
│  │   └── 📁 Hạ tầng                                        │   │
│  │ 📁 Hỗ trợ Nghiệp vụ                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### SLA Configuration Example

| Priority | Response Time | Resolution Time | Escalation Time |
|----------|--------------|-----------------|-----------------|
| LOW | 24 hours | 72 hours | 48 hours |
| MEDIUM | 8 hours | 48 hours | 24 hours |
| HIGH | 4 hours | 24 hours | 8 hours |
| URGENT | 1 hour | 4 hours | 2 hours |

### Validation Rules

**Frontend**:
- `group_code`: Bắt buộc, unique, max 100 ký tự
- `group_name`: Bắt buộc, max 255 ký tự
- `priority`: Bắt buộc (LOW/MEDIUM/HIGH/URGENT)
- `response_time_hours`: > 0
- `resolution_time_hours`: >= response_time_hours
- `type_code`: Bắt buộc, unique, max 100 ký tự
- `type_name`: Bắt buộc, max 255 ký tự

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/support-master.skill](../skills/support-master.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
