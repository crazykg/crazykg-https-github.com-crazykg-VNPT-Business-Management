# Module Contracts - Tài liệu chi tiết

## Tổng quan

Module **Contracts** (Hợp đồng) quản lý vòng đời hợp đồng từ khi ký kết, theo dõi hiệu lực, gia hạn, đến khi hết hạn. Module này tích hợp với khách hàng, dự án và doanh thu.

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
- **Services**: ContractDomainService, ContractPaymentService, ContractRenewalService, ContractRevenueAnalyticsService
- **Controllers**: ContractController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: ContractList, ContractModal, PaymentScheduleTab, ProductQuotationTab
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (ContractList) │     │ (ContractCtrl)   │     │ (ContractDomain)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Contracts)   │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `contracts`

Bảng chính lưu trữ thông tin hợp đồng.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `contract_code` | varchar(100) | Mã hợp đồng | Required, unique |
| `contract_name` | varchar(255) | Tên hợp đồng | Required |
| `customer_id` | bigint unsigned | FK to customers | Required |
| `project_id` | bigint unsigned | FK to projects | Nullable |
| `value` | decimal(15,2) | Giá trị hợp đồng | Required |
| `payment_cycle` | enum | Chu kỳ thanh toán | MONTHLY, QUARTERLY, YEARLY, ONE_TIME |
| `status` | enum | Trạng thái | DRAFT, ACTIVE, SUSPENDED, EXPIRED, TERMINATED |
| `sign_date` | date | Ngày ký | Required |
| `effective_date` | date | Ngày hiệu lực | Nullable |
| `expiry_date` | date | Ngày hết hạn | Nullable |
| `term_unit` | enum | Đơn vị期限 | MONTHS, YEARS |
| `term_value` | int | Thời hạn | Số tháng/năm |
| `parent_contract_id` | bigint unsigned | FK to contracts | Hợp đồng mẹ (gia hạn) |
| `addendum_type` | enum | Loại phụ lục | SUPPLEMENTARY, AMENDMENT |
| `gap_days` | int | Số ngày gap | Giữa các hợp đồng |
| `continuity_status` | enum | Trạng thái liên tục | CONTINUOUS, GAP, RENEWED |
| `penalty_rate` | decimal(5,2) | Phạt vi phạm | Phần trăm |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**payment_cycle**:
- `MONTHLY` - Thanh toán hàng tháng
- `QUARTERLY` - Thanh toán hàng quý
- `YEARLY` - Thanh toán hàng năm
- `ONE_TIME` - Thanh toán một lần

**status**:
- `DRAFT` - Nháp
- `ACTIVE` - Đang hiệu lực
- `SUSPENDED` - Tạm hoãn
- `EXPIRED` - Hết hạn
- `TERMINATED` - Chấm dứt

#### Indexes

```sql
-- Primary key
PRIMARY KEY (id)

-- Unique constraints
UNIQUE KEY (contract_code) WHERE deleted_at IS NULL

-- Foreign keys
KEY (customer_id)
KEY (project_id)
KEY (parent_contract_id)
KEY (created_by)
KEY (updated_by)
```

### Bảng `contract_items`

Bảng lưu trữ chi tiết sản phẩm/dịch vụ trong hợp đồng.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `contract_id` | bigint unsigned | FK to contracts |
| `product_id` | bigint unsigned | FK to products |
| `product_name` | varchar(255) | Tên sản phẩm |
| `quantity` | int | Số lượng |
| `unit_price` | decimal(15,2) | Đơn giá |
| `total_price` | decimal(15,2) | Thành tiền |
| `sort_order` | int | Thứ tự hiển thị |

### Mối quan hệ

- `contracts` belongsTo `customers`
- `contracts` belongsTo `projects` (optional)
- `contracts` hasMany `contract_items`
- `contracts` hasMany `invoices`
- `contracts` hasMany `receipts`
- `contracts` belongsTo `parent_contract` (self-referential)
- `contracts` hasMany `child_contracts`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Contracts
Route::prefix('contracts')->group(function () {
    Route::get('/', [ContractController::class, 'index']);
    Route::post('/', [ContractController::class, 'store']);
    Route::get('/{contract}', [ContractController::class, 'show']);
    Route::put('/{contract}', [ContractController::class, 'update']);
    Route::delete('/{contract}', [ContractController::class, 'destroy']);
    
    // Contract items
    Route::get('/{contract}/items', [ContractController::class, 'items']);
    Route::post('/{contract}/items', [ContractController::class, 'storeItem']);
    Route::put('/{contract}/items/{item}', [ContractController::class, 'updateItem']);
    Route::delete('/{contract}/items/{item}', [ContractController::class, 'destroyItem']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'contracts.read',
        'store' => 'contracts.write',
        'update' => 'contracts.write',
        'destroy' => 'contracts.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/contracts` | `contracts.read` | Lấy danh sách hợp đồng |
| `store` | POST | `/api/v5/contracts` | `contracts.write` | Tạo mới hợp đồng |
| `show` | GET | `/api/v5/contracts/{id}` | `contracts.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/contracts/{id}` | `contracts.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/contracts/{id}` | `contracts.delete` | Xóa |

---

## Frontend Components

### Component chính

#### `ContractList.tsx`
**Vị trí**: `frontend/components/ContractList.tsx`

**Chức năng**:
- Hiển thị bảng danh sách hợp đồng
- Tìm kiếm, lọc theo mã/tên/khách hàng/trạng thái
- Pagination (phân trang)
- Trigger các modal CRUD

**Props**:
```typescript
interface ContractListProps {
  initialQuery?: PaginatedQuery;
  onContractSelect?: (contract: Contract) => void;
}
```

#### `ContractModal.tsx`
**Vị trí**: `frontend/components/ContractModal.tsx`

**Chức năng**:
- Form thêm mới/chỉnh sửa hợp đồng
- Validation các trường bắt buộc
- Quản lý tab: Thông tin chung, Sản phẩm, Lịch thanh toán

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách hợp đồng
export const fetchContracts = async (query?: PaginatedQuery): Promise<PaginatedResult<Contract>> =>
  fetchPaginatedList<Contract>('/api/v5/contracts', query);

// Tạo mới
export const createContract = async (data: Partial<Contract>): Promise<Contract> =>
  fetchPost<Contract>('/api/v5/contracts', data);

// Cập nhật
export const updateContract = async (id: string | number, data: Partial<Contract>): Promise<Contract> =>
  fetchPut<Contract>(`/api/v5/contracts/${id}`, data);

// Xóa
export const deleteContract = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/contracts/${id}`);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface Contract {
  id: string | number;
  contract_code: string;
  contract_name: string;
  customer_id: string | number;
  project_id?: string | number | null;
  value: number;
  payment_cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'TERMINATED';
  sign_date: string;
  effective_date?: string | null;
  expiry_date?: string | null;
  term_unit?: 'MONTHS' | 'YEARS' | null;
  term_value?: number | null;
  parent_contract_id?: string | number | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo hợp đồng mới

```
1. Người dùng nhập thông tin hợp đồng
2. Validate: mã hợp đồng (unique), ngày ký, giá trị
3. Lưu hợp đồng vào CSDL
4. Ghi audit log
5. Nếu có sản phẩm: lưu contract_items
```

### 2. Gia hạn hợp đồng

```
1. Chọn hợp đồng cần gia hạn
2. Tạo hợp đồng con (child contract)
3. Link parent_contract_id
4. Cập nhật continuity_status
5. Tính gap_days (nếu có)
```

### 3. Theo dõi hết hạn

```
1. Hàng ngày: kiểm tra expiry_date
2. Nếu expiry_date < today → cập nhật status = EXPIRED
3. Gửi thông báo cho người phụ trách
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `contracts.read` | Xem hợp đồng | CONTRACTS | All authenticated |
| `contracts.write` | Thêm/Sửa hợp đồng | CONTRACTS | Manager, Admin |
| `contracts.delete` | Xóa hợp đồng | CONTRACTS | Admin |
| `contracts.import` | Nhập từ Excel | CONTRACTS | Manager, Admin |
| `contracts.export` | Xuất ra Excel | CONTRACTS | All authenticated |
| `contracts.payments` | Quản lý thanh toán | CONTRACTS | Finance, Admin |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `ContractDomainService` | `backend/app/Services/V5/Domain/ContractDomainService.php` | Orchestrates CRUD operations |
| `ContractPaymentService` | `backend/app/Services/V5/Contract/ContractPaymentService.php` | Payment schedule, tracking |
| `ContractRenewalService` | `backend/app/Services/V5/Contract/ContractRenewalService.php` | Renewal logic, gap analysis |
| `ContractRevenueAnalyticsService` | `backend/app/Services/V5/Contract/ContractRevenueAnalyticsService.php` | Revenue analytics, forecasting |

---

## UI/UX Notes

### Layout Design

**Danh sách**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Hợp đồng                              [+ Thêm mới]     │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...] [Lọc: Tất cả ▼] [Xuất] [Nhập]                │
├─────────────────────────────────────────────────────────────────┤
│  Mã | Tên | Khách hàng | Giá trị | Trạng thái | Hết hạn | Thao tác│
│  ─────────────────────────────────────────────────────────────  │
│  HC001 | ... | Cty ABC | 500tr | ACTIVE | 2026-12 | [✏️][🗑️]   │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `contract_code`: Bắt buộc, unique, max 100 ký tự
- `contract_name`: Bắt buộc, max 255 ký tự
- `customer_id`: Bắt buộc
- `value`: Bắt buộc, > 0
- `sign_date`: Bắt buộc, <= today

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/contracts.skill](../skills/contracts.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
