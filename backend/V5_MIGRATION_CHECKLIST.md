# V5 Migration Checklist (Enterprise)

## 1. Environment

- [ ] Backup database production/staging trước migrate.
- [ ] Cập nhật `.env` đúng database v5.
- [ ] Đảm bảo `APP_ENV=production`, `APP_DEBUG=false` trên môi trường deploy.

## 2. Schema & Data

- [ ] Chạy migration v5 cho các bảng domain:
  - `departments`
  - `internal_users`
  - `customers`
  - `vendors`
  - `projects`
  - `contracts`
  - `opportunities`
- [ ] Đảm bảo có cột audit trail: `created_at`, `updated_at`, `created_by`, `updated_by` (nếu dùng).
- [ ] Đảm bảo có cột `data_scope` (nếu áp dụng policy theo đơn vị/phạm vi dữ liệu).
- [ ] Seed dữ liệu master ban đầu (department/customer/vendor...).

## 3. API v5

- [ ] Kiểm tra auth Sanctum hoạt động (`/api/user`).
- [ ] Kiểm tra các endpoint v5:
  - [ ] `GET /api/v5/departments`
  - [ ] `GET /api/v5/internal-users` (alias cũ: `/api/v5/employees`)
  - [ ] `GET /api/v5/customers`
  - [ ] `GET /api/v5/vendors`
  - [ ] `GET /api/v5/projects`
  - [ ] `GET /api/v5/contracts`
  - [ ] `GET /api/v5/opportunities`
- [ ] Xác nhận response trả đúng field v5:
  - `contract_code` (không dùng `contract_number`)
  - `customer_id` (không dùng tên cứng)
  - `opp_name`, `amount`, `stage`
  - `is_active`, `dept_path`
- [ ] Xác nhận eager loading trả quan hệ cần map UI:
  - contract -> customer/project
  - project -> customer
  - internal_user (API employee) -> department
  - opportunity -> customer

## 4. Frontend Integration

- [ ] Đăng nhập để nhận session Sanctum hợp lệ.
- [ ] Mở frontend và kiểm tra các tab v5 load dữ liệu từ API:
  - Departments
  - Employees
  - Customers
  - Vendors
  - Projects
  - Contracts
  - Opportunities
- [ ] Verify không còn phụ thuộc field legacy:
  - `company_name`
  - `contract_number`
  - `total_value`
  - `estimatedValue`
  - `customerId`

## 5. Smoke Test

- [ ] `npm run lint` (frontend) pass.
- [ ] `npm run build` (frontend) pass.
- [ ] `npm run build` (backend assets) pass.
- [ ] Test nhanh CRUD trên các module v5 chính.
