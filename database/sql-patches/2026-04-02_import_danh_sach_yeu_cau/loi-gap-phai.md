# Lỗi Encoding UTF-8 Khi Import SQL Script

## Ngày phát hiện: 2026-04-02

## Mô tả lỗi

Khi chạy MySQL script có chứa tiếng Việt, dữ liệu hiển thị bị lỗi encoding trong MySQL console:

```
Bß╗çnh viß╗çn Ung bã░ß╗øu Cß║ºn Thãí  (SAI - hiển thị trong console)
```

Thay vì:
```
Bệnh viện Ung bướu Cần Thơ  (ĐÚNG)
```

## Nguyên nhân

MySQL client trên Windows không tự động set charset UTF-8 khi chạy script, dẫn đến:
1. Console hiển thị sai encoding
2. Dữ liệu có thể bị lưu sai nếu không set charset đúng

## Cách kiểm tra dữ liệu có đúng không

### Cách 1: Kiểm tra HEX value trong database
```bash
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 -e "SELECT HEX(summary), summary FROM customer_request_cases WHERE request_code = 'CRC-202604-0001';"
```

Nếu HEX value chứa các byte UTF-8 đúng (ví dụ: `E1BABF` = ưỡ, `C6B0` = ươ) thì dữ liệu đã đúng.

### Cách 2: Kiểm tra trên frontend
Truy cập: http://localhost:5174/customer-request-management

Nếu hiển thị đúng tiếng Việt trên UI thì dữ liệu đã đúng.

## Cách fix

### Khi chạy MySQL script, LUÔN dùng `--default-character-set=utf8mb4`

```bash
# SAI - có thể bị lỗi encoding
mysql -h localhost -u root -proot vnpt_business_db < script.sql

# ĐÚNG - set charset UTF-8
mysql -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 < script.sql
```

### Trong file SQL script, thêm lệnh SET charset

```sql
-- SET encoding UTF-8
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
```

### Đảm bảo file SQL được lưu với encoding UTF-8

Kiểm tra bằng Python:
```python
import chardet
data = open('script.sql', 'rb').read()
result = chardet.detect(data)
print(result)  # {'encoding': 'utf-8', 'confidence': 0.99}
```

## Script mẫu đúng

```sql
-- ================================================================================
-- SCRIPT IMPORT WITH UTF-8 ENCODING
-- ================================================================================

-- SET encoding UTF-8
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

INSERT INTO `customer_request_cases`
(`request_code`, `customer_id`, `summary`, `description`, ...)
VALUES
('CRC-202604-0001', 3, 'In phiếu dinh dưỡng không được BN: Nguyễn Huỳnh Gia Phú', ...);
```

## Lưu ý quan trọng

1. **Console Windows bị lỗi hiển thị** ≠ **Dữ liệu bị lưu sai**
   - Console `cmd.exe` hoặc PowerShell có thể hiển thị sai do font chữ
   - Kiểm tra bằng HEX value hoặc frontend để xác nhận dữ liệu đúng

2. **LUÔN dùng `utf8mb4` thay vì `utf8`**
   - `utf8mb4` hỗ trợ đầy đủ Unicode (bao gồm emoji)
   - `utf8` trong MySQL chỉ là alias của `utf8mb3` (3 bytes)

3. **Encoding phải đúng ở 3 nơi**:
   - File SQL: Lưu với encoding UTF-8
   - MySQL connection: `--default-character-set=utf8mb4`
   - Database/Table charset: `CHARSET=utf8mb4`

## Các file đã được fix

- `2026-04-02_02a_test_2_requests.sql` - Đã thêm SET NAMES utf8mb4
- `2026-04-02_02_insert_requests.sql` - Đã thêm SET NAMES utf8mb4

## Cách chạy script đúng

```bash
# Test 2 requests
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 < database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_02a_test_2_requests.sql

# Import toàn bộ 197 requests
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u root -proot vnpt_business_db --default-character-set=utf8mb4 < database/sql-patches/2026-04-02_import_danh_sach_yeu_cau/2026-04-02_02_insert_requests.sql
```
