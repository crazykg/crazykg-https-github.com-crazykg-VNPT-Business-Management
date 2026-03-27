# Quản lý Lĩnh vực Kinh doanh (Business Domains)

## 1. Tổng quan chức năng

Chức năng **Quản lý Lĩnh vực Kinh doanh** cho phép quản trị hệ thống thiết lập và duy trì danh mục các lĩnh vực kinh doanh (business domains) của VNPT. Đây là dữ liệu master dùng để phân loại và tổ chức các hoạt động kinh doanh theo từng mảng riêng biệt.

### 1.1. Mục đích
- Định nghĩa các lĩnh vực kinh doanh chính (ví dụ: Y tế số, Giáo dục số, Nông nghiệp số)
- Phân biệt giữa phần mềm (PM) và phần cứng (PC) trong từng lĩnh vực
- Quản lý thông tin đầu mối phụ trách (focal point) cho từng lĩnh vực
- Làm cơ sở phân quyền và báo cáo theo lĩnh vực kinh doanh

### 1.2. Phạm vi áp dụng
- **Module**: Master Data (Danh mục dùng chung)
- **Đối tượng sử dụng**: Admin, Quản trị hệ thống
- **Tần suất sử dụng**: Thấp (thiết lập ban đầu, cập nhật khi có thay đổi tổ chức)

### 1.3. Các thao tác chính
| Thao tác | Mô tả | Frequency |
|----------|-------|-----------|
| Xem danh sách | Liệt kê tất cả lĩnh vực kinh doanh | Cao |
| Thêm mới | Tạo lĩnh vực kinh doanh mới | Thấp |
| Chỉnh sửa | Cập nhật thông tin lĩnh vực | Thấp |
| Xóa | Xóa lĩnh vực không còn sử dụng | Rất thấp |
| Xuất dữ liệu | Export danh sách ra Excel | Trung bình |
| Nhập dữ liệu | Import từ file Excel | Rất thấp |

---

## 2. Frontend Components

### 2.1. Component chính

#### `BusinessManagement.tsx` (hoặc tích hợp trong `MasterDataPage.tsx`)
**Vị trí**: `frontend/components/BusinessManagement.tsx`

**Chức năng**:
- Hiển thị bảng danh sách lĩnh vực kinh doanh
- Tìm kiếm, lọc theo tên/mã lĩnh vực
- Pagination (phân trang)
- Trigger các modal CRUD

**Props**:
```typescript
interface BusinessManagementProps {
  initialQuery?: PaginatedQuery;
  onBusinessSelect?: (business: Business) => void;
}
```

**State management**:
- `businesses`: Danh sách lĩnh vực kinh doanh
- `loading`: Trạng thái tải dữ liệu
- `pagination`: Thông tin phân trang
- `filters`: Bộ lọc hiện tại
- `modalType`: Loại modal đang mở (ADD/EDIT/DELETE/VIEW)
- `selectedBusiness`: Lĩnh vực được chọn để chỉnh sửa/xem

### 2.2. Modal Components

#### `BusinessFormModal`
**Vị trí**: `frontend/components/Modals.tsx` (export riêng)

**Chức năng**:
- Form thêm mới/chỉnh sửa lĩnh vực kinh doanh
- Validation các trường bắt buộc
- Hiển thị lỗi từ backend

**Props**:
```typescript
interface BusinessFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Business | null;
  onClose: () => void;
  onSave: (data: Partial<Business>) => Promise<void>;
}
```

**Fields**:
| Field | Label | Type | Required | Validation |
|-------|-------|------|----------|------------|
| `domain_code` | Mã lĩnh vực | Text | ✓ | Unique, max 50 ký tự, uppercase |
| `domain_name` | Tên lĩnh vực | Text | ✓ | Max 100 ký tự |
| `focal_point_name` | Đầu mối phụ trách | Text | ✗ | Max 255 ký tự |
| `focal_point_phone` | SĐT đầu mối | Text | ✗ | Max 50 ký tự, phone format |
| `focal_point_email` | Email đầu mối | Email | ✗ | Email format, max 255 |

#### `BusinessDeleteModal`
**Vị trí**: `frontend/components/Modals.tsx`

**Chức năng**:
- Xác nhận xóa lĩnh vực kinh doanh
- Hiển thị cảnh báo nếu có dữ liệu liên quan

**Props**:
```typescript
interface BusinessDeleteModalProps {
  data: Business;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}
```

### 2.3. Service Layer

#### API calls (`frontend/services/v5Api.ts`)
```typescript
// Lấy danh sách (không phân trang)
export const fetchBusinesses = async (): Promise<Business[]> => 
  fetchList<Business>('/api/v5/businesses');

// Lấy danh sách (có phân trang)
export const fetchBusinessesPage = async (query: PaginatedQuery): Promise<PaginatedResult<Business>> =>
  fetchPaginatedList<Business>('/api/v5/businesses', query);

// Lấy danh sách cho dropdown (tối ưu)
export const fetchBusinessesOptionsPage = async (q: string, page = 1, perPage = 30): Promise<PaginatedResult<Business>> =>
  fetchBusinessesPage(buildOptionsPageQuery(q, page, perPage));

// Tạo mới
export const createBusiness = async (data: Partial<Business>): Promise<Business> =>
  fetchPost<Business>('/api/v5/businesses', data);

// Cập nhật
export const updateBusiness = async (id: string | number, data: Partial<Business>): Promise<Business> =>
  fetchPut<Business>(`/api/v5/businesses/${id}`, data);

// Xóa
export const deleteBusiness = async (id: string | number): Promise<void> =>
  fetchDelete(`/api/v5/businesses/${id}`);
```

### 2.4. Type Definition (`frontend/types.ts`)
```typescript
export interface Business {
  id: string | number;
  domain_code: string;
  domain_name: string;
  focal_point_name?: string | null;
  focal_point_phone?: string | null;
  focal_point_email?: string | null;
  created_at?: string;
  created_by?: string | number | null;
  updated_at?: string;
  updated_by?: string | number | null;
}
```

### 2.5. UI Components sử dụng
- `DataTable` - Hiển thị danh sách
- `SearchInput` - Ô tìm kiếm
- `Pagination` - Phân trang
- `Button` - Nút thao tác
- `Modal` - Modal dialog
- `FormField` - Trường nhập liệu
- `Badge` - Hiển thị trạng thái
- `Toast` - Thông báo

---

## 3. Backend API Endpoints

### 3.1. Route Definition
**File**: `backend/routes/api.php`

```php
// Business Domains
Route::prefix('businesses')->group(function () {
    Route::get('/', [BusinessController::class, 'index']);
    Route::post('/', [BusinessController::class, 'store']);
    Route::get('/{business}', [BusinessController::class, 'show']);
    Route::put('/{business}', [BusinessController::class, 'update']);
    Route::delete('/{business}', [BusinessController::class, 'destroy']);
})->middleware([
    'auth:sanctum',
    UseSanctumCookieToken::class,
    EnsureActiveTab::class,
    EnforcePasswordChange::class,
])->withMiddleware(function (Middleware $middleware) {
    $middleware->validatePermissions([
        'index' => 'businesses.read',
        'store' => 'businesses.write',
        'update' => 'businesses.write',
        'destroy' => 'businesses.delete',
    ]);
});
```

### 3.2. Controller Methods

| Method | HTTP | Endpoint | Permission | Description |
|--------|------|----------|------------|-------------|
| `index` | GET | `/api/v5/businesses` | `businesses.read` | Lấy danh sách lĩnh vực |
| `store` | POST | `/api/v5/businesses` | `businesses.write` | Tạo mới lĩnh vực |
| `show` | GET | `/api/v5/businesses/{id}` | `businesses.read` | Xem chi tiết |
| `update` | PUT | `/api/v5/businesses/{id}` | `businesses.write` | Cập nhật |
| `destroy` | DELETE | `/api/v5/businesses/{id}` | `businesses.delete` | Xóa |

---

## 4. Database Tables

### 4.1. Bảng `business_domains`

**Mô tả**: Bảng 22: Lĩnh vực kinh doanh

**Schema**:
```sql
CREATE TABLE `business_domains` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `domain_code` varchar(50) NOT NULL,
  `domain_name` varchar(100) NOT NULL,
  `focal_point_name` varchar(255) DEFAULT NULL,
  `focal_point_phone` varchar(50) DEFAULT NULL,
  `focal_point_email` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_code` (`domain_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4.2. Field Descriptions

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | bigint | NO | Primary key |
| `domain_code` | varchar(50) | NO | Mã lĩnh vực (unique) |
| `domain_name` | varchar(100) | NO | Tên lĩnh vực |
| `focal_point_name` | varchar(255) | YES | Đầu mối phụ trách |
| `focal_point_phone` | varchar(50) | YES | SĐT đầu mối |
| `focal_point_email` | varchar(255) | YES | Email đầu mối |
| `created_at` | timestamp | YES | Thời gian tạo |
| `created_by` | bigint | YES | ID người tạo |
| `updated_at` | timestamp | YES | Thời gian cập nhật |
| `updated_by` | bigint | YES | ID người cập nhật |

### 4.3. Sample Data

```sql
INSERT INTO `business_domains` VALUES 
(3, 'YTESO_PM', 'Phần mềm Y tế số', 'Nguyễn Việt Hưng', '0945200052', 'ropv.hgi@vnpt.vn', ...),
(5, 'YTESO_PC', 'Phần cứng Y tế số', NULL, NULL, NULL, ...),
(6, 'GD_PM', 'Phần mềm Giáo dục số', NULL, NULL, NULL, ...),
(7, 'GD_PC', 'Phần cứng Giáo dục số', NULL, NULL, NULL, ...),
(8, 'NN_PM', 'Phần mềm Nông nghệp số', 'Nguyễn Thành Công', '0919862107', ...),
(9, 'KHDN_PM', 'KHDN_Nhóm A', NULL, NULL, NULL, ...);
```

---

## 5. Permission Requirements

### 5.1. Permission Codes

| Permission Code | Description | Group | Default Roles |
|-----------------|-------------|-------|---------------|
| `businesses.read` | Xem lĩnh vực kinh doanh | MASTER_DATA | Admin, Manager, Staff |
| `businesses.write` | Thêm/Sửa lĩnh vực | MASTER_DATA | Admin, Manager |
| `businesses.delete` | Xóa lĩnh vực | MASTER_DATA | Admin |
| `businesses.import` | Nhập từ Excel | MASTER_DATA | Admin, Manager |
| `businesses.export` | Xuất ra Excel | MASTER_DATA | All authenticated |

### 5.2. Role-Based Access Matrix

| Role | Read | Write | Delete | Import | Export |
|------|------|-------|--------|--------|--------|
| **Super Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manager** | ✓ | ✓ | ✗ | ✓ | ✓ |
| **Staff** | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Guest** | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 6. UI/UX Notes

### 6.1. Layout Design

**Danh sách**:
```
┌─────────────────────────────────────────────────────────┐
│  Quản lý Lĩnh vực Kinh doanh              [+ Thêm mới]  │
├─────────────────────────────────────────────────────────┤
│  [🔍 Tìm kiếm...]                  [Xuất] [Nhập]        │
├─────────────────────────────────────────────────────────┤
│  STT | Mã | Tên | Đầu mối | SĐT | Email | Thao tác     │
│  ─────────────────────────────────────────────────────  │
│   1  | YTESO_PM | ... | Nguyễn VH | ... | [✏️][🗑️]     │
└─────────────────────────────────────────────────────────┘
```

### 6.2. Validation Rules

**Frontend**:
- `domain_code`: Bắt buộc, unique, max 50 ký tự, chỉ chữ HOA + số + gạch dưới
- `domain_name`: Bắt buộc, max 100 ký tự
- `focal_point_email`: Email format nếu có

### 6.3. Error Messages

| Scenario | Message |
|----------|---------|
| Missing code | "Mã lĩnh vực là bắt buộc" |
| Duplicate code | "Mã lĩnh vực đã tồn tại" |
| Missing name | "Tên lĩnh vực là bắt buộc" |
| Invalid email | "Email không hợp lệ" |

### 6.4. Responsive

- **Desktop**: Full table
- **Tablet**: Thu gọn cột (ẩn SĐT, Email)
- **Mobile**: Card view

---

## Lịch sử cập nhật

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-27 | Tạo tài liệu ban đầu |

## Tham chiếu

- [CLAUDE.md](../CLAUDE.md)
- Database: `database/vnpt_business_db_2026-02-24_175408.sql`

