# Module Fee Collection - Tài liệu chi tiết

## Tổng quan

Module **Fee Collection** (Thu cước) quản lý hóa đơn, biên lai, công nợ và quy trình thu tiền từ khách hàng. Module này tích hợp chặt chẽ với hợp đồng và doanh thu.

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
- **Services**: InvoiceDomainService, ReceiptDomainService, FeeCollectionDashboardService, DebtAgingReportService
- **Controllers**: FeeCollectionController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: FeeCollectionHub, InvoiceList, InvoiceModal, ReceiptList, ReceiptModal, DebtAgingReport
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (Fee Hub)      │     │ (FeeCollection)  │     │ (Invoice/Receipt)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Invoices)    │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `invoices`

Bảng chính lưu trữ thông tin hóa đơn.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `invoice_code` | varchar(100) | Mã hóa đơn | Required, unique |
| `invoice_series` | varchar(50) | Ký hiệu hóa đơn | Required |
| `contract_id` | bigint unsigned | FK to contracts | Required |
| `customer_id` | bigint unsigned | FK to customers | Required |
| `project_id` | bigint unsigned | FK to projects | Nullable |
| `invoice_date` | date | Ngày hóa đơn | Required |
| `due_date` | date | Ngày đến hạn | Required |
| `period_from` | date | Kỳ từ ngày | Nullable |
| `period_to` | date | Kỳ đến ngày | Nullable |
| `subtotal` | decimal(15,2) | Tiền trước thuế | Required |
| `vat_rate` | decimal(5,2) | Thuế suất VAT (%) | Default: 10 |
| `vat_amount` | decimal(15,2) | Tiền thuế VAT | Calculated |
| `total_amount` | decimal(15,2) | Tổng tiền | Required |
| `paid_amount` | decimal(15,2) | Đã thanh toán | Default: 0 |
| `status` | enum | Trạng thái | Required |
| `notes` | text | Ghi chú | Nullable |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**status**:
- `DRAFT` - Nháp
- `ISSUED` - Đã phát hành
- `PARTIAL` - Thanh toán một phần
- `PAID` - Đã thanh toán
- `CANCELLED` - Đã hủy
- `VOID` - Vô hiệu

#### Computed Attributes

```php
// outstanding = total_amount - paid_amount
public function getOutstandingAttribute(): float {
    return round(($this->total_amount ?? 0) - ($this->paid_amount ?? 0), 2);
}

// is_overdue = due_date < today AND outstanding > 0
public function getIsOverdueAttribute(): bool {
    if (in_array($this->status, ['PAID', 'CANCELLED', 'VOID', 'DRAFT'], true)) {
        return false;
    }
    return $this->due_date !== null
        && $this->due_date->lt(now()->startOfDay())
        && $this->outstanding > 0;
}
```

### Bảng `invoice_items`

Bảng lưu trữ chi tiết hóa đơn.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `invoice_id` | bigint unsigned | FK to invoices |
| `product_id` | bigint unsigned | FK to products |
| `product_name` | varchar(255) | Tên sản phẩm |
| `quantity` | int | Số lượng |
| `unit_price` | decimal(15,2) | Đơn giá |
| `total_price` | decimal(15,2) | Thành tiền |
| `sort_order` | int | Thứ tự hiển thị |

### Bảng `receipts`

Bảng lưu trữ thông tin biên lai/phieu thu.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `receipt_code` | varchar(100) | Mã biên lai |
| `invoice_id` | bigint unsigned | FK to invoices |
| `customer_id` | bigint unsigned | FK to customers |
| `receipt_date` | date | Ngày thu |
| `amount` | decimal(15,2) | Số tiền |
| `payment_method` | enum | Phương thức |
| `status` | enum | Trạng thái |
| `notes` | text | Ghi chú |

### Bảng `dunning_logs`

Bảng lưu trữ lịch sử nhắc nợ.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `invoice_id` | bigint unsigned | FK to invoices |
| `dunning_date` | date | Ngày nhắc |
| `dunning_level` | int | Cấp độ nhắc |
| `method` | enum | Phương thức |
| `notes` | text | Ghi chú |

### Mối quan hệ

- `invoices` belongsTo `contracts`
- `invoices` belongsTo `customers`
- `invoices` belongsTo `projects` (optional)
- `invoices` hasMany `invoice_items`
- `invoices` hasMany `receipts`
- `invoices` hasMany `dunning_logs`
- `receipts` belongsTo `invoices`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Fee Collection
Route::prefix('fee-collection')->group(function () {
    // Invoices
    Route::get('/invoices', [FeeCollectionController::class, 'invoices']);
    Route::post('/invoices', [FeeCollectionController::class, 'createInvoice']);
    Route::get('/invoices/{invoice}', [FeeCollectionController::class, 'invoiceDetail']);
    Route::put('/invoices/{invoice}', [FeeCollectionController::class, 'updateInvoice']);
    Route::delete('/invoices/{invoice}', [FeeCollectionController::class, 'deleteInvoice']);
    
    // Receipts
    Route::get('/receipts', [FeeCollectionController::class, 'receipts']);
    Route::post('/receipts', [FeeCollectionController::class, 'createReceipt']);
    Route::put('/receipts/{receipt}', [FeeCollectionController::class, 'updateReceipt']);
    Route::delete('/receipts/{receipt}', [FeeCollectionController::class, 'deleteReceipt']);
    
    // Dashboard
    Route::get('/dashboard', [FeeCollectionController::class, 'dashboard']);
    
    // Debt Aging
    Route::get('/debt-aging', [FeeCollectionController::class, 'debtAging']);
    
    // Bulk operations
    Route::post('/invoices/bulk-generate', [FeeCollectionController::class, 'bulkGenerate']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'invoices' => 'revenue.read',
        'createInvoice' => 'revenue.write',
        'receipts' => 'revenue.read',
        'createReceipt' => 'revenue.write',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `invoices` | GET | `/api/v5/fee-collection/invoices` | `revenue.read` | Lấy danh sách hóa đơn |
| `createInvoice` | POST | `/api/v5/fee-collection/invoices` | `revenue.write` | Tạo hóa đơn |
| `updateInvoice` | PUT | `/api/v5/fee-collection/invoices/{id}` | `revenue.write` | Cập nhật hóa đơn |
| `receipts` | GET | `/api/v5/fee-collection/receipts` | `revenue.read` | Lấy danh sách biên lai |
| `createReceipt` | POST | `/api/v5/fee-collection/receipts` | `revenue.write` | Tạo biên lai |
| `dashboard` | GET | `/api/v5/fee-collection/dashboard` | `revenue.read` | Dashboard stats |
| `debtAging` | GET | `/api/v5/fee-collection/debt-aging` | `revenue.read` | Báo cáo công nợ |

---

## Frontend Components

### Component chính

#### `FeeCollectionHub.tsx`
**Vị trí**: `frontend/components/FeeCollectionHub.tsx`

**Chức năng**:
- Hub trung tâm cho thu cước
- Tabs: Hóa đơn, Biên lai, Dashboard, Debt Aging
- Filter, search, export

#### `InvoiceList.tsx`
**Vị trí**: `frontend/components/fee-collection/InvoiceList.tsx`

**Chức năng**:
- Hiển thị danh sách hóa đơn
- Filter theo status, customer, date range
- Badge hiển thị overdue

#### `InvoiceModal.tsx`
**Vị trí**: `frontend/components/fee-collection/InvoiceModal.tsx`

**Chức năng**:
- Form thêm mới/chỉnh sửa hóa đơn
- Tự động tính VAT, total
- Quản lý invoice items

#### `ReceiptModal.tsx`
**Vị trí**: `frontend/components/fee-collection/ReceiptModal.tsx`

**Chức năng**:
- Form tạo biên lai thu tiền
- Link với invoice
- Update paid_amount tự động

#### `DebtAgingReport.tsx`
**Vị trí**: `frontend/components/fee-collection/DebtAgingReport.tsx`

**Chức năng**:
- Báo cáo công nợ theo độ tuổi
- Bucket: Current, 1-30 days, 31-60 days, 61-90 days, >90 days
- Export Excel

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách hóa đơn
export const fetchInvoices = async (query?: PaginatedQuery): Promise<PaginatedResult<Invoice>> =>
  fetchPaginatedList<Invoice>('/api/v5/fee-collection/invoices', query);

// Tạo hóa đơn
export const createInvoice = async (data: Partial<Invoice>): Promise<Invoice> =>
  fetchPost<Invoice>('/api/v5/fee-collection/invoices', data);

// Tạo biên lai
export const createReceipt = async (data: Partial<Receipt>): Promise<Receipt> =>
  fetchPost<Receipt>('/api/v5/fee-collection/receipts', data);

// Dashboard
export const fetchFeeCollectionDashboard = async (): Promise<FeeCollectionDashboard> =>
  fetchGet<FeeCollectionDashboard>('/api/v5/fee-collection/dashboard');

// Debt Aging
export const fetchDebtAgingReport = async (filters?: object): Promise<DebtAgingReport> =>
  fetchGet<DebtAgingReport>('/api/v5/fee-collection/debt-aging', { params: filters });
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface Invoice {
  id: string | number;
  invoice_code: string;
  invoice_series: string;
  contract_id: string | number;
  customer_id: string | number;
  invoice_date: string;
  due_date: string;
  period_from?: string | null;
  period_to?: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'VOID';
  outstanding?: number;
  is_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Receipt {
  id: string | number;
  receipt_code: string;
  invoice_id: string | number;
  customer_id: string | number;
  receipt_date: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo hóa đơn

```
1. Chọn hợp đồng
2. Nhập kỳ hóa đơn (period_from, period_to)
3. Nhập các items (sản phẩm, số lượng, đơn giá)
4. Tự động tính subtotal, VAT, total
5. Lưu hóa đơn
6. Gửi email cho khách (optional)
```

### 2. Thu tiền (Create Receipt)

```
1. Chọn hóa đơn cần thu
2. Nhập số tiền thu
3. Chọn phương thức thanh toán
4. Lưu biên lai
5. Tự động cập nhật paid_amount của invoice
6. Cập nhật status: PARTIAL hoặc PAID
```

### 3. Nhắc nợ (Dunning)

```
1. Hệ thống tự động phát hiện invoice quá hạn
2. Tạo dunning_log
3. Gửi email/SMS nhắc nợ
4. Tăng dunning_level
```

### 4. Hủy hóa đơn

```
1. Chọn hóa đơn cần hủy
2. Kiểm tra đã thu tiền chưa
3. Nếu đã thu: tạo receipt âm để offset
4. Cập nhật status = CANCELLED
5. Ghi audit log
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `revenue.read` | Xem hóa đơn/biên lai | REVENUE | All authenticated |
| `revenue.write` | Tạo/Sửa hóa đơn/biên lai | REVENUE | Finance, Admin |
| `revenue.targets` | Quản lý target doanh thu | REVENUE | Finance, Admin |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `InvoiceDomainService` | `backend/app/Services/V5/FeeCollection/InvoiceDomainService.php` | Invoice CRUD operations |
| `ReceiptDomainService` | `backend/app/Services/V5/FeeCollection/ReceiptDomainService.php` | Receipt CRUD operations |
| `FeeCollectionDashboardService` | `backend/app/Services/V5/FeeCollection/FeeCollectionDashboardService.php` | Dashboard stats |
| `DebtAgingReportService` | `backend/app/Services/V5/FeeCollection/DebtAgingReportService.php` | Debt aging analysis |

---

## UI/UX Notes

### Layout Design

**Invoice List**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Hóa đơn                               [+ Tạo mới]      │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...] [Lọc: Status ▼] [Xuất] [Bulk Generate]       │
├─────────────────────────────────────────────────────────────────┤
│  Mã | Ký hiệu | Khách hàng | Ngày đến hạn | Tổng tiền | Trạng thái│
│  ─────────────────────────────────────────────────────────────  │
│  HD001 | AA26T | Cty ABC | 2026-03-30 | 500tr | OVERDUE 🔴    │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `invoice_code`: Bắt buộc, unique, max 100 ký tự
- `invoice_series`: Bắt buộc, max 50 ký tự
- `contract_id`: Bắt buộc
- `invoice_date`: Bắt buộc, <= today
- `due_date`: Bắt buộc, >= invoice_date
- `total_amount`: Bắt buộc, > 0

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/fee-collection.skill](../skills/fee-collection.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
