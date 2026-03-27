# Module CRC - Customer Request Cases - Tài liệu chi tiết

## Tổng quan

Module **Customer Request Cases** (CRC - Yêu cầu Khách hàng) quản lý vòng đời yêu cầu hỗ trợ từ khách hàng, từ khi tiếp nhận, điều phối, xử lý, đến khi hoàn thành. Đây là module cốt lõi của hệ thống CRM.

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
- **Pattern**: Domain-Driven Design (DDD) + State Machine
- **Services**: CustomerRequestCaseDomainService, CustomerRequestCaseExecutionService, CustomerRequestCaseWriteService, CustomerRequestCaseReadModelService
- **Controllers**: CustomerRequestController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: CustomerRequestManagementHub, CustomerRequestCreatorWorkspace, CustomerRequestDispatcherWorkspace, CustomerRequestPerformerWorkspace
- **Hooks**: 10+ custom hooks cho CRC
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (CRC Hub)      │     │ (CRC Controller) │     │ (Case Domain)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Cases)       │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `customer_request_cases`

Bảng chính lưu trữ thông tin yêu cầu khách hàng.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `case_code` | varchar(100) | Mã yêu cầu | Required, unique |
| `case_title` | varchar(255) | Tiêu đề | Required |
| `customer_id` | bigint unsigned | FK to customers | Required |
| `status` | enum | Trạng thái | Required |
| `priority` | enum | Độ ưu tiên | LOW, MEDIUM, HIGH, URGENT |
| `received_by_user_id` | bigint unsigned | Người tiếp nhận | Creator |
| `dispatcher_user_id` | bigint unsigned | Người điều phối | Project PM |
| `performer_user_id` | bigint unsigned | Người thực hiện | Performer |
| `project_id` | bigint unsigned | FK to projects | Nullable |
| `contract_id` | bigint unsigned | FK to contracts | Nullable |
| `description` | text | Mô tả chi tiết | Required |
| `received_at` | timestamp | Thời gian tiếp nhận | Auto |
| `dispatched_at` | timestamp | Thời gian điều phối | Nullable |
| `started_at` | timestamp | Thời gian bắt đầu | Nullable |
| `completed_at` | timestamp | Thời gian hoàn thành | Nullable |
| `sla_deadline` | timestamp | Hạn SLA | Calculated |
| `is_overdue` | boolean | Quá hạn | Computed |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**status** (12 trạng thái):
- `NEW_INTAKE` - Mới tiếp nhận
- `PENDING_DISPATCH` - Chờ điều phối
- `DISPATCHED` - Đã điều phối
- `WAITING_CUSTOMER_FEEDBACK` - Chờ feedback khách
- `ANALYSIS` - Đang phân tích
- `RETURNED_TO_MANAGER` - Trả lại quản lý
- `IN_PROGRESS` - Đang xử lý
- `CODING` - Đang code
- `DMS_TRANSFER` - Chuyển DMS
- `COMPLETED` - Hoàn thành
- `CUSTOMER_NOTIFIED` - Đã thông báo KH
- `NOT_EXECUTED` - Không thực hiện

**priority**:
- `LOW` - Thấp
- `MEDIUM` - Trung bình
- `HIGH` - Cao
- `URGENT` - Khẩn cấp

### Bảng liên quan

| Bảng | Mô tả |
|------|-------|
| `customer_request_dispatched` | Lịch sử điều phối |
| `customer_request_pending_dispatch` | Yêu cầu chờ điều phối |
| `customer_request_worklog` | Nhật ký công việc |
| `customer_request_estimate` | Dự toán thời gian/chi phí |
| `customer_request_coding` | Thông tin coding |
| `customer_request_dms_transfer` | Chuyển DMS |
| `customer_request_escalation` | Leo thang yêu cầu |
| `customer_request_plan` | Kế hoạch xử lý |
| `customer_request_plan_item` | Công việc trong kế hoạch |
| `customer_request_status_instance` | Instance trạng thái |

### Mối quan hệ

- `customer_request_cases` belongsTo `customers`
- `customer_request_cases` belongsTo `projects` (optional)
- `customer_request_cases` belongsTo `contracts` (optional)
- `customer_request_cases` belongsTo `received_by_user` (creator)
- `customer_request_cases` belongsTo `dispatcher_user` (PM)
- `customer_request_cases` belongsTo `performer_user` (performer)
- `customer_request_cases` hasMany `customer_request_dispatched`
- `customer_request_cases` hasMany `customer_request_worklog`
- `customer_request_cases` hasMany `customer_request_escalation`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Customer Request Cases
Route::prefix('customer-requests')->group(function () {
    Route::get('/', [CustomerRequestController::class, 'index']);
    Route::post('/', [CustomerRequestController::class, 'store']);
    Route::get('/{case}', [CustomerRequestController::class, 'show']);
    Route::put('/{case}', [CustomerRequestController::class, 'update']);
    Route::delete('/{case}', [CustomerRequestController::class, 'destroy']);
    
    // Transitions
    Route::post('/{case}/transition', [CustomerRequestController::class, 'transition']);
    
    // Dispatch
    Route::post('/{case}/dispatch', [CustomerRequestController::class, 'dispatch']);
    
    // Worklog
    Route::get('/{case}/worklogs', [CustomerRequestController::class, 'worklogs']);
    Route::post('/{case}/worklogs', [CustomerRequestController::class, 'storeWorklog']);
    
    // Escalation
    Route::get('/{case}/escalations', [CustomerRequestController::class, 'escalations']);
    Route::post('/{case}/escalations', [CustomerRequestController::class, 'storeEscalation']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'support_requests.read',
        'store' => 'support_requests.write',
        'update' => 'support_requests.write',
        'destroy' => 'support_requests.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/customer-requests` | `support_requests.read` | Lấy danh sách yêu cầu |
| `store` | POST | `/api/v5/customer-requests` | `support_requests.write` | Tạo mới yêu cầu |
| `show` | GET | `/api/v5/customer-requests/{id}` | `support_requests.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/customer-requests/{id}` | `support_requests.write` | Cập nhật |
| `transition` | POST | `/api/v5/customer-requests/{id}/transition` | `support_requests.write` | Chuyển trạng thái |
| `dispatch` | POST | `/api/v5/customer-requests/{id}/dispatch` | `support_requests.write` | Điều phối |

---

## Frontend Components

### Component chính

#### `CustomerRequestManagementHub.tsx`
**Vị trí**: `frontend/components/CustomerRequestManagementHub.tsx` (~9,300 lines)

**Chức năng**:
- Hub trung tâm cho tất cả thao tác CRC
- Hiển thị workspace theo role (Creator/Dispatcher/Performer)
- Quản lý tabs, panels, modals
- Real-time updates

**Props**:
```typescript
interface CustomerRequestManagementHubProps {
  initialCaseId?: string | number;
  initialView?: 'list' | 'detail' | 'workspace';
}
```

#### `CustomerRequestCreatorWorkspace.tsx`
**Vị trí**: `frontend/components/customer-request/CustomerRequestCreatorWorkspace.tsx`

**Chức năng**:
- Workspace cho người tiếp nhận (Creator)
- Tạo yêu cầu mới
- Theo dõi yêu cầu đã tạo
- Cung cấp feedback

#### `CustomerRequestDispatcherWorkspace.tsx`
**Vị trí**: `frontend/components/customer-request/CustomerRequestDispatcherWorkspace.tsx`

**Chức năng**:
- Workspace cho người điều phối (PM)
- Xem yêu cầu chờ điều phối
- Assign performer
- Theo dõi tiến độ

#### `CustomerRequestPerformerWorkspace.tsx`
**Vị trí**: `frontend/components/customer-request/CustomerRequestPerformerWorkspace.tsx`

**Chức năng**:
- Workspace cho người thực hiện
- Xem yêu cầu được giao
- Cập nhật trạng thái
- Ghi worklog

### Custom Hooks

**Thư mục**: `frontend/components/customer-request/hooks/`

| Hook | Purpose |
|------|---------|
| `useCustomerRequestCases` | Fetch cases list |
| `useCustomerRequestCase` | Fetch single case |
| `useCustomerRequestTransitions` | Available transitions |
| `useCustomerRequestDispatch` | Dispatch logic |
| `useCustomerRequestWorklog` | Worklog CRUD |
| `useCustomerRequestEscalation` | Escalation logic |
| `useCustomerRequestPlan` | Plan management |
| `useCustomerRequestHours` | Hours tracking |
| `useCustomerRequestSLA` | SLA calculation |
| `useCustomerRequestStats` | Dashboard stats |

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách yêu cầu
export const fetchCustomerRequests = async (query?: PaginatedQuery): Promise<PaginatedResult<CustomerRequestCase>> =>
  fetchPaginatedList<CustomerRequestCase>('/api/v5/customer-requests', query);

// Tạo mới
export const createCustomerRequest = async (data: Partial<CustomerRequestCase>): Promise<CustomerRequestCase> =>
  fetchPost<CustomerRequestCase>('/api/v5/customer-requests', data);

// Chuyển trạng thái
export const transitionCustomerRequest = async (id: string | number, transition: string): Promise<CustomerRequestCase> =>
  fetchPost<CustomerRequestCase>(`/api/v5/customer-requests/${id}/transition`, { transition });

// Điều phối
export const dispatchCustomerRequest = async (id: string | number, performerId: string | number): Promise<CustomerRequestCase> =>
  fetchPost<CustomerRequestCase>(`/api/v5/customer-requests/${id}/dispatch`, { performer_id: performerId });
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface CustomerRequestCase {
  id: string | number;
  case_code: string;
  case_title: string;
  customer_id: string | number;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  received_by_user_id?: string | number | null;
  dispatcher_user_id?: string | number | null;
  performer_user_id?: string | number | null;
  project_id?: string | number | null;
  contract_id?: string | number | null;
  description: string;
  received_at: string;
  dispatched_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  sla_deadline?: string | null;
  is_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
}
```

---

## Luồng nghiệp vụ

### 1. Tiếp nhận yêu cầu (INTAKE)

```
1. Khách hàng gửi yêu cầu
2. Creator tiếp nhận, tạo case
3. Status: NEW_INTAKE → PENDING_DISPATCH
4. Gửi thông báo cho Dispatcher
```

### 2. Điều phối (DISPATCH)

```
1. Dispatcher xem yêu cầu chờ
2. Phân tích, xác định performer
3. Assign performer
4. Status: PENDING_DISPATCH → DISPATCHED
5. Gửi thông báo cho Performer
```

### 3. Xử lý (PROCESSING)

```
1. Performer nhận yêu cầu
2. Phân tích chi tiết
3. Status: DISPATCHED → ANALYSIS → IN_PROGRESS → CODING
4. Ghi worklog
5. Cập nhật tiến độ
```

### 4. Hoàn thành (CLOSURE)

```
1. Performer hoàn thành công việc
2. Status: CODING → COMPLETED
3. Thông báo khách hàng
4. Status: COMPLETED → CUSTOMER_NOTIFIED
5. Đóng case
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `support_requests.read` | Xem yêu cầu | SUPPORT | All authenticated |
| `support_requests.write` | Tạo/Sửa yêu cầu | SUPPORT | Creator, PM, Performer |
| `support_requests.delete` | Xóa yêu cầu | SUPPORT | Admin |
| `support_requests.dispatch` | Điều phối | SUPPORT | PM, Dispatcher |
| `support_requests.escalate` | Leo thang | SUPPORT | All authenticated |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `CustomerRequestCaseDomainService` | `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php` | Orchestrates all CRC operations |
| `CustomerRequestCaseExecutionService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php` | Transition logic, state machine |
| `CustomerRequestCaseWriteService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` | Write operations |
| `CustomerRequestCaseReadModelService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseReadModelService.php` | Read model, queries |
| `CustomerRequestCaseDashboardService` | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseDashboardService.php` | Dashboard stats |

---

## UI/UX Notes

### Layout Design

**Workspace**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Yêu cầu Khách hàng                                    │
├──────────────┬──────────────────────────────────────────────────┤
│  Danh sách   │  Chi tiết yêu cầu                                │
│  - Tìm kiếm  │  Mã: CRC-2026-001                               │
│  - Lọc       │  Tiêu đề: Lỗi đăng nhập                         │
│  - Tabs      │  Khách: Cty ABC                                 │
│              │  Trạng thái: IN_PROGRESS                        │
│              │  Ưu tiên: HIGH                                  │
│              │  Performer: Nguyễn Văn A                        │
│              │  SLA: 2026-03-30 17:00 (2 ngày còn lại)         │
│              │                                                  │
│              │  [Chuyển trạng thái] [Ghi worklog] [Escalate]   │
└──────────────┴──────────────────────────────────────────────────┘
```

### SLA Calculation

```typescript
// SLA based on priority
const SLA_HOURS = {
  LOW: 72,      // 3 ngày
  MEDIUM: 48,   // 2 ngày
  HIGH: 24,     // 1 ngày
  URGENT: 4,    // 4 giờ
};

// Deadline = received_at + SLA_HOURS[priority]
```

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/crc.skill](../skills/crc.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
