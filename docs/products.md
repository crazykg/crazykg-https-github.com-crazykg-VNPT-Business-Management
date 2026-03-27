# Module Products - Tài liệu chi tiết

## Tổng quan

Module **Products** (Sản phẩm) quản lý danh mục sản phẩm/dịch vụ của công ty, bao gồm thông tin giá, đơn vị tính, và các tính năng sản phẩm (product features).

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
- **Services**: ProductDomainService, ProductFeatureCatalogDomainService, ProductQuotationDomainService
- **Controllers**: ProductController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: ProductList, ProductFeatureCatalogModal, ProductQuotationTab
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (ProductList)  │     │ (ProductCtrl)    │     │ (ProductDomain) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Products)    │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `products`

Bảng chính lưu trữ thông tin sản phẩm.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `product_code` | varchar(100) | Mã sản phẩm | Required, unique |
| `product_name` | varchar(255) | Tên sản phẩm | Required |
| `product_type` | enum | Loại sản phẩm | SOFTWARE, HARDWARE, SERVICE |
| `category` | varchar(100) | Danh mục | Nullable |
| `unit_of_measure` | varchar(50) | Đơn vị tính | Required |
| `list_price` | decimal(15,2) | Giá niêm yết | Default: 0 |
| `cost_price` | decimal(15,2) | Giá vốn | Default: 0 |
| `vat_rate` | decimal(5,2) | Thuế suất VAT (%) | Default: 10 |
| `is_active` | boolean | Trạng thái hoạt động | Default: true |
| `description` | text | Mô tả | Nullable |
| `specifications` | json | Thông số kỹ thuật | Nullable |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**product_type**:
- `SOFTWARE` - Phần mềm
- `HARDWARE` - Phần cứng
- `SERVICE` - Dịch vụ

#### Unit of Measure Examples

- `SOFTWARE`: license, user, month, year
- `HARDWARE`: unit, set, box
- `SERVICE`: hour, day, month, project

### Bảng `product_features`

Bảng lưu trữ tính năng sản phẩm.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `product_id` | bigint unsigned | FK to products |
| `feature_code` | varchar(100) | Mã tính năng |
| `feature_name` | varchar(255) | Tên tính năng |
| `feature_group` | varchar(100) | Nhóm tính năng |
| `is_active` | boolean | Trạng thái |
| `sort_order` | int | Thứ tự |

### Bảng `product_quotations`

Bảng lưu trữ báo giá sản phẩm.

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `quotation_code` | varchar(100) | Mã báo giá |
| `customer_id` | bigint unsigned | FK to customers |
| `contract_id` | bigint unsigned | FK to contracts |
| `quotation_date` | date | Ngày báo giá |
| `valid_until` | date | Hiệu lực đến |
| `status` | enum | Trạng thái |
| `total_amount` | decimal(15,2) | Tổng tiền |
| `notes` | text | Ghi chú |

### Mối quan hệ

- `products` hasMany `product_features`
- `products` hasMany `contract_items`
- `products` hasMany `invoice_items`
- `products` hasMany `product_quotations`
- `products` hasMany `product_quotation_versions`

---

## Backend API

### Route Definition

**File**: `backend/routes/api.php`

```php
// Products
Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::post('/', [ProductController::class, 'store']);
    Route::get('/{product}', [ProductController::class, 'show']);
    Route::put('/{product}', [ProductController::class, 'update']);
    Route::delete('/{product}', [ProductController::class, 'destroy']);
    
    // Features
    Route::get('/{product}/features', [ProductController::class, 'features']);
    Route::post('/{product}/features', [ProductController::class, 'storeFeature']);
    Route::put('/{product}/features/{feature}', [ProductController::class, 'updateFeature']);
    
    // Quotations
    Route::get('/{product}/quotations', [ProductController::class, 'quotations']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'products.read',
        'store' => 'products.write',
        'update' => 'products.write',
        'destroy' => 'products.delete',
    ]);
});
```

### Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/products` | `products.read` | Lấy danh sách sản phẩm |
| `store` | POST | `/api/v5/products` | `products.write` | Tạo mới sản phẩm |
| `show` | GET | `/api/v5/products/{id}` | `products.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/products/{id}` | `products.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/products/{id}` | `products.delete` | Xóa |

---

## Frontend Components

### Component chính

#### `ProductList.tsx`
**Vị trí**: `frontend/components/ProductList.tsx`

**Chức năng**:
- Hiển thị bảng danh sách sản phẩm
- Tìm kiếm, lọc theo mã/tên/loại/danh mục
- Pagination (phân trang)
- Trigger các modal CRUD

**Props**:
```typescript
interface ProductListProps {
  initialQuery?: PaginatedQuery;
  onProductSelect?: (product: Product) => void;
}
```

#### `ProductFeatureCatalogModal.tsx`
**Vị trí**: `frontend/components/ProductFeatureCatalogModal.tsx`

**Chức năng**:
- Quản lý tính năng sản phẩm
- Thêm/sửa/xóa tính năng
- Sắp xếp theo nhóm

### Service Layer

**File**: `frontend/services/v5Api.ts`

```typescript
// Lấy danh sách sản phẩm
export const fetchProducts = async (query?: PaginatedQuery): Promise<PaginatedResult<Product>> =>
  fetchPaginatedList<Product>('/api/v5/products', query);

// Tạo mới
export const createProduct = async (data: Partial<Product>): Promise<Product> =>
  fetchPost<Product>('/api/v5/products', data);

// Cập nhật
export const updateProduct = async (id: string | number, data: Partial<Product>): Promise<Product> =>
  fetchPut<Product>(`/api/v5/products/${id}`, data);

// Xóa
export const deleteProduct = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/products/${id}`);
```

### Type Definition

**File**: `frontend/types.ts`

```typescript
export interface Product {
  id: string | number;
  product_code: string;
  product_name: string;
  product_type: 'SOFTWARE' | 'HARDWARE' | 'SERVICE';
  category?: string | null;
  unit_of_measure: string;
  list_price: number;
  cost_price: number;
  vat_rate: number;
  is_active: boolean;
  description?: string | null;
  specifications?: object | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}

export interface ProductFeature {
  id: string | number;
  product_id: string | number;
  feature_code: string;
  feature_name: string;
  feature_group?: string | null;
  is_active: boolean;
  sort_order: number;
}
```

---

## Luồng nghiệp vụ

### 1. Tạo sản phẩm mới

```
1. Người dùng nhập thông tin sản phẩm
2. Validate: mã sản phẩm (unique), tên, đơn vị tính
3. Lưu vào CSDL
4. Ghi audit log
5. Thêm tính năng (optional)
```

### 2. Quản lý tính năng

```
1. Chọn sản phẩm
2. Xem danh sách tính năng
3. Thêm/sửa/xóa tính năng
4. Sắp xếp theo nhóm
5. Cập nhật sort_order
```

### 3. Tạo báo giá

```
1. Chọn khách hàng
2. Chọn sản phẩm cần báo giá
3. Nhập số lượng, chiết khấu (nếu có)
4. Tự động tính tổng tiền
5. Tạo quotation document
6. Gửi khách hàng
```

---

## Phân quyền

### Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `products.read` | Xem sản phẩm | PRODUCTS | All authenticated |
| `products.write` | Thêm/Sửa sản phẩm | PRODUCTS | Admin, Product Manager |
| `products.delete` | Xóa sản phẩm | PRODUCTS | Admin |
| `products.import` | Nhập từ Excel | PRODUCTS | Admin, Product Manager |
| `products.export` | Xuất ra Excel | PRODUCTS | All authenticated |

---

## Các service chính

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| `ProductDomainService` | `backend/app/Services/V5/Domain/ProductDomainService.php` | Orchestrates CRUD operations |
| `ProductFeatureCatalogDomainService` | `backend/app/Services/V5/Domain/ProductFeatureCatalogDomainService.php` | Feature catalog management |
| `ProductQuotationDomainService` | `backend/app/Services/V5/Domain/ProductQuotationDomainService.php` | Quotation management |
| `ProductQuotationExportService` | `backend/app/Services/V5/Domain/ProductQuotationExportService.php` | Export quotation to PDF/Excel |

---

## UI/UX Notes

### Layout Design

**Danh sách**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Quản lý Sản phẩm                              [+ Thêm mới]     │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...] [Lọc: Loại ▼] [Xuất] [Nhập]                  │
├─────────────────────────────────────────────────────────────────┤
│  Mã | Tên | Loại | ĐVT | Giá niêm yết | VAT | Trạng thái | Thao tác│
│  ─────────────────────────────────────────────────────────────  │
│  SP001 | VNPT eHospital | SOFTWARE | license | 50tr | 10% | ✅  │
└─────────────────────────────────────────────────────────────────┘
```

### Validation Rules

**Frontend**:
- `product_code`: Bắt buộc, unique, max 100 ký tự
- `product_name`: Bắt buộc, max 255 ký tự
- `product_type`: Bắt buộc (SOFTWARE/HARDWARE/SERVICE)
- `unit_of_measure`: Bắt buộc, max 50 ký tự
- `list_price`: >= 0
- `vat_rate`: 0-100

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- [skills/products.skill](../skills/products.skill)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`
