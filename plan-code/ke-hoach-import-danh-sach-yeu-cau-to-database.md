# Kế Hoạch Import Danh Sách Yêu Cầu Vào Database

## Mục tiêu

Tạo file SQL script để import 197 yêu cầu từ file Excel vào bảng `customer_request_cases` với trạng thái "Mới tiếp nhận" (`new_intake`).

## Nguồn dữ liệu

- **File Excel**: `plan-code/Dieu_chinh_ql_yc_khach_hang/du-lieu-can-import/danh sách yêu cầu.xlsx`
- **Số lượng yêu cầu**: 197 yêu cầu (STT từ 1 đến 197)
- **Cột dữ liệu**:
  1. `STT` - Số thứ tự
  2. `Nội dung yêu cầu` - Nội dung yêu cầu (summary)
  3. `Đơn vị` - Tên đơn vị/khách hàng
  4. `Người yêu cầu` - Tên người yêu cầu
  5. `Nhóm Zalo` - Nhóm Zalo liên quan
  6. `Người tiếp nhận` - Tên người tiếp nhận yêu cầu

## Cấu trúc bảng đích

### Bảng `customer_request_cases`

```sql
CREATE TABLE `customer_request_cases` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID yêu cầu',
  `request_code` varchar(50) NOT NULL COMMENT 'Mã yêu cầu',
  `customer_id` bigint unsigned DEFAULT NULL COMMENT 'Khách hàng',
  `customer_personnel_id` bigint unsigned DEFAULT NULL COMMENT 'Người yêu cầu phía khách hàng',
  `support_service_group_id` bigint unsigned DEFAULT NULL COMMENT 'Nhóm hỗ trợ',
  `summary` varchar(500) NOT NULL COMMENT 'Nội dung yêu cầu',
  `description` text COMMENT 'Mô tả chi tiết',
  `priority` tinyint unsigned NOT NULL DEFAULT '2' COMMENT 'Độ ưu tiên 1-4',
  `current_status_code` varchar(80) NOT NULL DEFAULT 'new_intake' COMMENT 'Trạng thái hiện tại',
  `received_by_user_id` bigint unsigned DEFAULT NULL COMMENT 'Người tiếp nhận ban đầu',
  `created_by` bigint unsigned DEFAULT NULL COMMENT 'Người tạo',
  `updated_by` bigint unsigned DEFAULT NULL COMMENT 'Người cập nhật',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  ...
)
```

### Các bảng liên quan cần ánh xạ

1. **`customers`** - Ánh xạ `Đơn vị` → `customer_id`
   - Cột ánh xạ: `customer_code` (ví dụ: '93003', '93007') hoặc `customer_name`
   
2. **`support_service_groups`** - Ánh xạ `Nhóm Zalo` → `support_service_group_id`
   - Cột ánh xạ: `group_name` (ví dụ: 'HIS_L2', 'EMR_BENH_VIEN_SAN_NHI')
   
3. **`internal_users`** - Ánh xạ `Người tiếp nhận` → `received_by_user_id`
   - Cột ánh xạ: `full_name` hoặc `username`

4. **`customer_personnel`** - Ánh xạ `Người yêu cầu` → `customer_personnel_id`
   - Cột ánh xạ: `full_name`

## Mapping Logic

### 1. Mã yêu cầu (request_code)

Format: `CRC-202604-XXXX` với XXXX là số thứ tự 0001-0197

```
STT 1 → CRC-202604-0001
STT 2 → CRC-202604-0002
...
STT 197 → CRC-202604-0197
```

### 2. Trạng thái (current_status_code)

Tất cả yêu cầu được set về: `new_intake` (Mới tiếp nhận)

### 3. Độ ưu tiên (priority)

Mặc định: `2` (Trung bình)

### 4. Ánh xạ đơn vị → customer_id

Dựa trên data có sẵn trong database:

| Đơn vị (Excel) | customer_code | customer_id |
|---------------|---------------|-------------|
| Bệnh viện Ung bướu Cần Thơ | (cần tạo mới) | TBD |
| BV Sản Nhi | 93007 | 3 |
| BVĐK KV Ngã Bảy | 93016 | 14 |
| TTYT KV Long Mỹ | 93003 | 7 |
| TTYT KV Phụng Hiệp | 93004 | 8 |
| TTYT KV Châu Thành | 93005 | 12 |
| TTYT KV Vị Thủy | (cần tra cứu) | TBD |
| Trạm Y tế Hỏa Lựu | 93015 | 97 |
| ... | ... | ... |

### 5. Ánh xạ người tiếp nhận → received_by_user_id

Danh sách người tiếp nhận từ Excel:
- Nguyễn Vĩnh Lạp
- Nguyễn Nhựt Trường
- Phan Phú Thịnh
- Dương Tố Như
- Phạm Thanh Trào
- Trương Công Quốc Huy
- Lê Đào Thiên Đức
- Nguyễn Hải Đăng
- Võ Hoàng Kiệt
- A. Khanh
- C. Nữ
- Phát
- Trường
- Đăng TH
- A. Huy
- A. Thảo
- A. Rở
- Duy
- Luận

Cần tra cứu trong bảng `internal_users` để lấy `id` theo `full_name`.

## Các bước thực hiện

### Bước 1: Chuẩn bị dữ liệu

1. Đọc file Excel và export ra CSV để dễ xử lý
2. Tạo file trung gian chứa mapping:
   - `customer_mapping.sql` - INSERT/UPDATE cho customers chưa tồn tại
   - `user_mapping.sql` - Tra cứu user IDs
   - `group_mapping.sql` - Tra cứu support group IDs

### Bước 2: Tạo file SQL script chính

File: `database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_01_import_197_yeu_cau.sql`

Nội dung:
```sql
-- Script import 197 yêu cầu từ Excel
-- Ngày tạo: 2026-04-02
-- Nguồn: plan-code/Dieu_chinh_ql_yc_khach_hang/du-lieu-can-import/danh sách yêu cầu.xlsx

-- Bước 1: Kiểm tra/ tạo customers mới (nếu cần)
-- Bước 2: Insert vào customer_request_cases
-- Bước 3: Verify số lượng
```

### Bước 3: Chạy script và verify

```bash
# Backup database trước khi chạy
mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-04-02_pre_import.sql

# Chạy script
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_01_import_197_yeu_cau.sql

# Verify
mysql -h localhost -u root -proot vnpt_business_db -e "SELECT COUNT(*) FROM customer_request_cases WHERE current_status_code = 'new_intake';"
```

## File cần tạo

1. `ke-hoach-import-danh-sach-yeu-cau-to-database.md` (file này)
2. `database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/README.md`
3. `database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_01_data_mapping.sql`
4. `database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_02_insert_requests.sql`
5. `database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_03_verify.sql`

## Lưu ý quan trọng

1. **Backup database** trước khi chạy script
2. **Chạy theo thứ tự**: 01 → 02 → 03
3. **Script là forward-only**, không có rollback
4. **Kiểm tra duplicate**: `request_code` là UNIQUE
5. **Xử lý NULL**: Các field không map được sẽ để NULL
6. **Encoding**: File SQL lưu với encoding UTF-8 để hỗ trợ tiếng Việt

## Mapping đã áp dụng

### Support Service Groups
| ID | Code | Tên |
|----|------|-----|
| 1 | HIS_L2 | HIS L2 |
| 2 | HIS_L3 | HIS L3 |
| 3 | UPCODE_VAN_BAN | UPCODE VĂN BẢN |
| 4 | EMR_BENH_VIEN_SAN_NHI | EMR-Bệnh viện Sản Nhi |
| 5 | HOAN_THIEN_PHAN_MEM | HOÀN THIỆN PHẦN MỀM |
| 6 | DOI_LIS_EMR | Hiss Bệnh Viện Sản Nhi |

### Receivers (Người tiếp nhận)
| User ID | Username | Full Name |
|---------|----------|-----------|
| 10 | traopt.hgi | Phạm Thanh Trào |
| 32 | thinhpp.cto | Phan Phú Thịnh |
| 36 | ducldt.cto | Lê Đào Thiên Đức |
| 39 | dangnh.hgi | Nguyễn Hải Đăng |
| 42 | huytcq.cto | Trương Công Quốc Huy |
| 43 | lapnv.hgi | Nguyễn Vĩnh Lạp |
| 45 | kietvh.cto | Võ Hoàng Kiệt |
| 46 | nhudt.cto | Dương Tố Như |
| 50 | truongnn.cto | Nguyễn Nhựt Trường |

### Customers mapping
- BV Sản Nhi (3), BVĐK Ngã Bảy (14), TTYT Long Mỹ (7), TTYT Phụng Hiệp (8), TTYT Châu Thành (12)
- Các đơn vị chưa có trong database sẽ để `customer_id = NULL`

## Timeline dự kiến

| Bước | Mô tả | Thời gian |
|-----|-------|----------|
| 1 | Phân tích data mapping | 30 phút |
| 2 | Tạo script SQL | 60 phút |
| 3 | Test trên môi trường dev | 30 phút |
| 4 | Chạy production | 15 phút |
| 5 | Verify kết quả | 15 phút |

## Tiêu chí hoàn thành

- [ ] 197 yêu cầu được import thành công
- [ ] Tất cả yêu cầu có `current_status_code = 'new_intake'`
- [ ] `request_code` đúng format `CRC-202604-XXXX`
- [ ] Các field `customer_id`, `support_service_group_id` được map đúng
- [ ] Không có lỗi duplicate key
- [ ] Dữ liệu hiển thị đúng trên frontend: http://localhost:5174/customer-request-management
