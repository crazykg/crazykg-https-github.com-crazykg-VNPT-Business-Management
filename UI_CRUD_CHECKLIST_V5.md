# UI CRUD Checklist (V5)

## Preconditions
- [ ] Backend chạy: `http://127.0.0.1:8000`
- [ ] Frontend chạy: `http://localhost:3000`
- [ ] API health OK: `GET /api/v5/health/tables` trả tất cả `true`
- [ ] `meta.connection=mysql`, `meta.database=vnpt_business_db`

## Departments
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới phòng ban thành công, xuất hiện ngay trên bảng
- [ ] UPDATE sửa tên/mã/trạng thái thành công
- [ ] DELETE xóa thành công khi không có ràng buộc
- [ ] VALIDATION: để trống `dept_code` hoặc `dept_name` phải báo lỗi

## Employees
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới nhân sự thành công
- [ ] UPDATE sửa thông tin/status thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: email sai format phải báo lỗi

## Customers
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới khách hàng thành công
- [ ] UPDATE sửa thông tin thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: thiếu `customer_code` hoặc `customer_name` phải báo lỗi

## Vendors
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới vendor thành công
- [ ] UPDATE sửa thông tin thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: thiếu `vendor_code` hoặc `vendor_name` phải báo lỗi

## Opportunities
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới cơ hội thành công
- [ ] UPDATE sửa stage/amount thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: customer không hợp lệ phải báo lỗi

## Projects
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới dự án thành công
- [ ] UPDATE sửa status/thông tin thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: project_code trùng phải báo lỗi

## Contracts
- [ ] READ danh sách hiển thị đúng dữ liệu DB
- [ ] CREATE tạo mới hợp đồng thành công
- [ ] UPDATE sửa status/value thành công
- [ ] DELETE xóa thành công
- [ ] VALIDATION: thiếu `customer_id` hoặc mã hợp đồng trùng phải báo lỗi

## Cross-check DB
- [ ] Mỗi thao tác CREATE có bản ghi mới trong MySQL
- [ ] Mỗi thao tác UPDATE phản ánh đúng trong MySQL
- [ ] Mỗi thao tác DELETE mất bản ghi trong MySQL
- [ ] Không còn lỗi 500 ở tab Network của browser

## Result Summary
- [ ] Departments: PASS / FAIL
- [ ] Employees: PASS / FAIL
- [ ] Customers: PASS / FAIL
- [ ] Vendors: PASS / FAIL
- [ ] Opportunities: PASS / FAIL
- [ ] Projects: PASS / FAIL
- [ ] Contracts: PASS / FAIL

## Failure Notes
- Module:
- Action:
- HTTP code:
- API message:
- Steps to reproduce:
