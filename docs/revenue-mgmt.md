# Module Revenue Management - Tài liệu chi tiết

## Tổng quan

Module **Revenue Management** (Quản lý Doanh thu) cung cấp công cụ theo dõi, dự báo, và báo cáo doanh thu toàn diện. Module này tích hợp với hợp đồng, thu cước, và dự án để cung cấp cái nhìn 360 độ về tình hình doanh thu.

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
- **Pattern**: Domain-Driven Design (DDD) + Analytics Pattern
- **Services**: RevenueOverviewService, RevenueByContractService, RevenueByCollectionView, RevenueForecastService, RevenueReportService, RevenueTargetService
- **Controllers**: RevenueManagementController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: RevenueManagementHub, RevenueOverviewDashboard, RevenueByContractView, RevenueByCollectionView, RevenueForecastView, RevenueReportView, RevenueTargetModal, RevenueBulkTargetModal, RevenueAdjustmentPlanPanel
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (Revenue Hub)  │     │ (Revenue Mgmt)   │     │ (Revenue Svc)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Snapshots)   │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `revenue_targets`

Bảng chính lưu trữ chỉ tiêu doanh thu.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `period_type` | enum | Loại kỳ | MONTHLY, QUARTERLY, YEARLY |
| `period_key` | varchar(50) | Khóa kỳ | YYYY-MM, YYYY-Qn, YYYY |
| `period_start` | date | Ngày bắt đầu kỳ | Required |
| `period_end` | date | Ngày kết thúc kỳ | Required |
| `dept_id` | bigint unsigned | FK to departments | Phòng ban |
| `target_type` | enum | Loại chỉ tiêu | BOOKING, BILLING, COLLECTION |
| `target_amount` | decimal(15,2) | Số tiền chỉ tiêu | Required |
| `actual_amount` | decimal(15,2) | Số tiền thực tế | Default: 0 |
| `notes` | text | Ghi chú | Nullable |
| `approved_by` | bigint unsigned | FK to internal_users | Người duyệt |
| `approved_at` | timestamp | Ngày duyệt | Nullable |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**period_type**:
- `MONTHLY` - Hàng tháng (YYYY-MM)
- `QUARTERLY` - Hàng quý (YYYY-Q1, Q2, Q3, Q4)
- `YEARLY` - Hàng năm (YYYY)

**target_type**:
- `BOOKING` - Ký hợp đồng
- `BILLING` - Xuất hóa đơn
- `COLLECTION` - Thu tiền

### Bảng `revenue_snapshots`

Bảng lưu trữ snapshot doanh thu theo giờ/tháng.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `snapshot_month` | date | Tháng snapshot |
| `dept_id` | bigint unsigned | FK to departments |
| `user_id` | bigint unsigned | FK to internal_users |
| `project_id` | bigint unsigned | FK to projects |
| `hours_planned` | decimal(8,2) | Giờ kế hoạch |
| `hours_actual` | decimal(8,2) | Giờ thực tế |
| `revenue_planned` | decimal(15,2) | Doanh thu kế hoạch |
| `revenue_actual` | decimal(15,2) | Doanh thu thực tế |

### Bảng `monthly_hours_snapshots`

Bảng lưu trữ snapshot giờ làm việc hàng tháng.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `month` | date | Tháng |
| `user_id` | bigint unsigned | FK to internal_users |
| `project_id` | bigint unsigned | FK to projects |
| `case_id` | bigint unsigned | FK to customer_request_cases |
| `hours` | decimal(8,2) | Số giờ |
| `rate` | decimal(10,2) | Đơn giá |
| `amount` | decimal(15,2) | Thành tiền |

### Mối quan hệ

- `revenue_targets` belongsTo `department`
- `revenue_targets` belongsTo `creator` (internal_users)
- `revenue_targets` belongsTo `approver` (internal_users)
- `revenue_snapshots` belongsTo `department`
- `revenue_snapshots` belongsTo `user`
- `revenue_snapshots` belongsTo `project`
- `monthly_hours_snapshots` belongsTo `user`
- `monthly_hours_snapshots` belongsTo `project`
- `monthly_hours_snapshots` belongsTo `case`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Revenue Management
Route::prefix('revenue-management')->group(function () {
    // Overview
    Route::get('/overview', [RevenueManagementController::class, 'overview']);
    
    // By Contract
    Route::get('/by-contract', [RevenueManagementController::class, 'byContract']);
    
    // By Collection
    Route::get('/by-collection', [RevenueManagementController::class, 'byCollection']);
    
    // Forecast
    Route::get('/forecast', [RevenueManagementController::class, 'forecast']);
    
    // Report
    Route::get('/report', [RevenueManagementController::class, 'report']);
    
    // Targets
    Route::get('/targets', [RevenueManagementController::class, 'targets']);
    Route::post('/targets', [RevenueManagementController::class, 'storeTarget']);
    Route::put('/targets/{target}', [RevenueManagementController::class, 'updateTarget']);
    Route::delete('/targets/{target}', [RevenueManagementController::class, 'deleteTarget']);
    Route::post('/targets/bulk', [RevenueManagementController::class, 'bulkStoreTargets']);
    
    // Snapshots
    Route::post('/snapshots/generate', [RevenueManagementController::class, 'generateSnapshots']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'overview' => 'revenue.read',
        'targets' => 'revenue.read',
        'storeTarget' => 'revenue.targets',
        'updateTarget' => 'revenue.targets',
        'deleteTarget' => 'revenue.targets',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `overview` | GET | `/api/v5/revenue-management/overview` | `revenue.read` | Dashboard tổng quan |
| `byContract` | GET | `/api/v5/revenue-management/by-contract` | `revenue.read` | Doanh thu theo hợp đồng |
| `byCollection` | GET | `/api/v5/revenue-management/by-collection` | `revenue.read` | Doanh thu theo thu cước |
| `forecast` | GET | `/api/v5/revenue-management/forecast` | `revenue.read` | Dự báo doanh thu |
| `report` | GET | `/api/v5/revenue-management/report` | `revenue.read` | Báo cáo doanh thu |
| `targets` | GET | `/api/v5/revenue-management/targets` | `revenue.read` | Lấy chỉ tiêu |
| `storeTarget` | POST | `/api/v5/revenue-management/targets` | `revenue.targets` | Tạo chỉ tiêu |
| `bulkStoreTargets` | POST | `/api/v5/revenue-management/targets/bulk` | `revenue.targets` | Tạo nhiều chỉ tiêu |

---

## Frontend Components

### Component chính

#### `RevenueManagementHub.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueManagementHub.tsx`

**Chức năng**:
- Hub trung tâm cho quản lý doanh thu
- 5 tabs chính: Tổng quan, Theo hợp đồng, Theo thu cước, Dự báo, Báo cáo
- Filter theo period, department

#### `RevenueOverviewDashboard.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueOverviewDashboard.tsx`

**Chức năng**:
- KPI cards: Target, Actual, Variance, Achievement %
- Trend charts
- Breakdown by department

#### `RevenueByContractView.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueByContractView.tsx`

**Chức năng**:
- Doanh thu theo hợp đồng
- Contract value, recognized revenue, remaining
- Waterfall chart

#### `RevenueByCollectionView.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueByCollectionView.tsx`

**Chức năng**:
- Doanh thu theo thu cước
- Invoice status breakdown
- Collection efficiency

#### `RevenueForecastView.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueForecastView.tsx`

**Chức năng**:
- Dự báo doanh thu tương lai
- Based on contracts, payment schedules
- Confidence intervals

#### `RevenueReportView.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueReportView.tsx`

**Chức năng**:
- Báo cáo tùy chỉnh
- Export Excel/PDF
- Drill-down capabilities

#### `RevenueBulkTargetModal.tsx`
**Vị trí**: `frontend/components/revenue-mgmt/RevenueBulkTargetModal.tsx`

**Chức năng**:
- Tạo chỉ tiêu hàng loạt
- Theo department, period
- Bulk upload từ Excel

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Overview
export const fetchRevenueOverview = async (filters?: RevenueFilters): Promise<RevenueOverview> =>
  fetchGet<RevenueOverview>('/api/v5/revenue-management/overview', { params: filters });

// Targets
export const fetchRevenueTargets = async (query?: PaginatedQuery): Promise<PaginatedResult<RevenueTarget>> =>
  fetchPaginatedList<RevenueTarget>('/api/v5/revenue-management/targets', query);

export const createRevenueTarget = async (data: Partial<RevenueTarget>): Promise<RevenueTarget> =>
  fetchPost<RevenueTarget>('/api/v5/revenue-management/targets', data);

export const bulkCreateRevenueTargets = async (data: RevenueTargetBulkInput): Promise<RevenueTarget[]> =>
  fetchPost<RevenueTarget[]>('/api/v5/revenue-management/targets/bulk', data);

// Forecast
export const fetchRevenueForecast = async (filters?: RevenueFilters): Promise<RevenueForecast> =>
  fetchGet<RevenueForecast>('/api/v5/revenue-management/forecast', { params: filters });
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface RevenueTarget {
  id: string | number;
  period_type: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  period_key: string;
  period_start: string;
  period_end: string;
  dept_id: string | number;
  target_type: 'BOOKING' | 'BILLING' | 'COLLECTION';
  target_amount: number;
  actual_amount: number;
  achievement_rate?: number;
  variance?: number;
  notes?: string | null;
  approved_by?: string | number | null;
  approved_at?: string | null;
  department?: Department | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface RevenueOverview {
  total_target: number;
  total_actual: number;
  achievement_rate: number;
  variance: number;
  by_department: DepartmentRevenue[];
  trend: RevenueTrend[];
}

export interface RevenueForecast {
  period: string;
  forecast_amount: number;
  confidence_level: number;
  breakdown: ForecastBreakdown[];
}
```

---

## Luồng nghiệp vụ

### 1. Thiết lập chỉ tiêu doanh thu

```
1. Chọn kỳ (tháng/quý/năm)
2. Chọn phòng ban
3. Nhập chỉ tiêu cho từng target_type
4. Duyệt chỉ tiêu
5. Gửi thông báo
```

### 2. Tạo chỉ tiêu hàng loạt

```
1. Upload Excel với danh sách chỉ tiêu
2. Validate dữ liệu
3. Preview trước khi lưu
4. Lưu hàng loạt
5. Báo cáo kết quả
```

### 3. Generate snapshots

```
1. Chọn tháng cần snapshot
2. Hệ thống tự động tính toán:
   - Hours planned/actual từ worklogs
   - Revenue planned/actual từ invoices/receipts
3. Lưu snapshot
4. Cập nhật dashboard
```

### 4. Xem báo cáo doanh thu

```
1. Chọn filter (period, department, target_type)
2. Xem KPIs
3. Drill-down theo cấp độ
4. Export báo cáo
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `revenue.read` | Xem doanh thu | REVENUE | All authenticated |
| `revenue.targets` | Quản lý chỉ tiêu | REVENUE | Finance, Admin, Manager |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `RevenueOverviewService` | `backend/app/Services/V5/Revenue/RevenueOverviewService.php` | Dashboard overview |
| `RevenueByContractService` | `backend/app/Services/V5/Revenue/RevenueByContractService.php` | Revenue by contract analysis |
| `RevenueByCollectionView` | `backend/app/Services/V5/Revenue/RevenueByCollectionView.php` | Revenue by collection analysis |
| `RevenueForecastService` | `backend/app/Services/V5/Revenue/RevenueForecastService.php` | Revenue forecasting |
| `RevenueReportService` | `backend/app/Services/V5/Revenue/RevenueReportService.php` | Custom reports |
| `RevenueTargetService` | `backend/app/Services/V5/Revenue/RevenueTargetService.php` | Target management |

---

## UI/UX Notes

### Layout Design

**Overview Dashboard**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Doanh thu                                              │
├─────────────────────────────────────────────────────────────────┤
│  [Period: Tháng 3/2026 ▼] [Dept: Tất cả ▼] [Xuất báo cáo]      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Target   │ │ Actual   │ │ Variance │ │ Achieve% │          │
│  │ 5.0 tỷ   │ │ 4.2 tỷ   │ │ -0.8 tỷ  │ │  84%     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Biểu đồ xu hướng                                               │
│  [Line chart: Target vs Actual by month]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `period_type`: Bắt buộc
- `period_key`: Bắt buộc, format YYYY-MM / YYYY-Qn / YYYY
- `dept_id`: Bắt buộc
- `target_type`: Bắt buộc
- `target_amount`: Bắt buộc, > 0
- `period_start`: Bắt buộc
- `period_end`: Bắt buộc, >= period_start

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/revenue-mgmt.skill](../skills/revenue-mgmt.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
