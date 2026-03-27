# Module Customers - Tài liệu chi tiết

## Tổng quan

Module **Customers** (Khách hàng) là một phần cốt lõi của hệ thống CRM trong ứng dụng QLCV2. Module này quản lý thông tin khách hàng, đầu mối liên hệ và cung cấp các công cụ phân tích insight toàn diện (Customer 360).

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
- **Services**: CustomerDomainService, CustomerInsightService, CustomerPersonnelDomainService
- **Controllers**: CustomerController, CustomerPersonnelController

### Frontend Stack
- **Framework**: React + TypeScript
- **Components**: CustomerList, CustomerInsightPanel
- **Hooks**: useCustomers
- **API Client**: v5Api.ts

### Luồng dữ liệu

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Controller  │────▶│ Domain Service  │
│  (CustomerList) │     │ (CustomerCtrl)   │     │ (CustomerDomain)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Access Audit    │     │   Eloquent ORM  │
                        │  (Audit Logs)    │     │   (Customers)   │
                        └──────────────────┘     └─────────────────┘
```

---

## Cơ sở dữ liệu

### Bảng `customers`

Bảng chính lưu trữ thông tin khách hàng.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----|-------------|-------|---------|
| `id` | bigint unsigned | Primary key | Auto increment |
| `uuid` | varchar(100) | UUID duy nhất | Generated nếu không có |
| `customer_code` | varchar(100) | Mã khách hàng | Required, unique |
| `customer_name` | varchar(255) | Tên khách hàng | Required |
| `company_name` | varchar(255) | Tên công ty | Alias của customer_name |
| `tax_code` | varchar(100) | Mã số thuế | Nullable |
| `address` | text | Địa chỉ | Nullable |
| `customer_sector` | enum | Lĩnh vực hoạt động | HEALTHCARE, GOVERNMENT, INDIVIDUAL, OTHER |
| `healthcare_facility_type` | enum | Loại hình cơ sở y tế | HOSPITAL_TTYT, TYT_CLINIC, OTHER |
| `bed_capacity` | int | Số giường bệnh | Chỉ dùng cho HEALTHCARE |
| `data_scope` | varchar(255) | Phạm vi dữ liệu | Nullable |
| `created_by` | bigint unsigned | Người tạo | FK to internal_users |
| `updated_by` | bigint unsigned | Người cập nhật | FK to internal_users |
| `created_at` | timestamp | Ngày tạo | Auto |
| `updated_at` | timestamp | Ngày cập nhật | Auto |
| `deleted_at` | timestamp | Xóa mềm | Soft delete |

#### Enum values

**customer_sector**:
- `HEALTHCARE` - Cơ sở y tế
- `GOVERNMENT` - Cơ quan nhà nước
- `INDIVIDUAL` - Cá nhân
- `OTHER` - Khác

**healthcare_facility_type**:
- `HOSPITAL_TTYT` - Bệnh viện đa khoa/chuyên khoa
- `TYT_CLINIC` - Trạm y tế/phòng khám
- `OTHER` - Khác

#### Indexes

```sql
-- Primary key
PRIMARY KEY (id)

-- Unique constraints
UNIQUE KEY (uuid) WHERE deleted_at IS NULL
UNIQUE KEY (customer_code) WHERE deleted_at IS NULL

-- Foreign keys
KEY (created_by)
KEY (updated_by)
```

### Bảng `customer_personnel`

Bảng lưu trữ thông tin đầu mối liên hệ tại khách hàng.

#### Cấu trúc bảng

| Cột | Kiểu dữ liệu | Mô tả |
|-----|-------------|-------|
| `id` | bigint unsigned | Primary key |
| `customer_id` | bigint unsigned | FK to customers |
| `name` | varchar(255) | Tên đầu mối |
| `position` | varchar(100) | Chức vụ |
| `phone` | varchar(50) | Số điện thoại |
| `email` | varchar(255) | Email |
| `date_of_birth` | date | Ngày sinh |
| `status` | enum | Trạng thái |
| `created_at` | timestamp | Ngày tạo |
| `updated_at` | timestamp | Ngày cập nhật |
| `deleted_at` | timestamp | Xóa mềm |

### Mối quan hệ

- `customers` hasMany `customer_request_cases`
- `customers` hasMany `projects`
- `customers` hasMany `contracts`
- `customers` hasMany `opportunities`
- `customers` hasMany `customer_personnel`
