# Import Danh Sách 197 Yêu Cầu - Customer Request Cases

## Ngày tạo: 2026-04-02

## Mục tiêu

Import 197 yêu cầu từ file Excel vào bảng `customer_request_cases` với trạng thái `new_intake` (Mới tiếp nhận).

## Nguồn dữ liệu

File: `plan-code/Dieu_chinh_ql_yc_khach_hang/du-lieu-can-import/danh sách yêu cầu.xlsx`

## Thứ tự chạy scripts

```bash
# 1. Backup database
mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-04-02_pre_import.sql

# 2. Chạy scripts theo thứ tự
mysql -h localhost -u root -proot vnpt_business_db < 2026-04-02_01_data_mapping.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-04-02_02_insert_requests.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-04-02_03_verify.sql
```

## Các file scripts

1. **2026-04-02_01_data_mapping.sql** - Tạo bảng tạm và mapping dữ liệu
2. **2026-04-02_02_insert_requests.sql** - INSERT 197 yêu cầu vào `customer_request_cases`
3. **2026-04-02_03_verify.sql** - Verify kết quả sau import

## Lưu ý

- Backup database trước khi chạy
- Scripts là forward-only, không có rollback
- Encoding: UTF-8

## Verify sau import

```sql
-- Kiểm tra số lượng
SELECT COUNT(*) FROM customer_request_cases WHERE current_status_code = 'new_intake';

-- Kiểm tra display
SELECT request_code, summary, customer_id, current_status_code, created_at 
FROM customer_request_cases 
WHERE request_code LIKE 'CRC-202604-%'
ORDER BY id DESC;
```
