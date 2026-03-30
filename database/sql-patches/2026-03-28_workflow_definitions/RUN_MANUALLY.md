# Hướng Dẫn Chạy SQL Scripts - Workflow Definitions

**Date:** 2026-03-28  
**Database:** vnpt_business_db  
**MySQL Credentials:** root / root (password: root)

---

## 📋 Checklist Trước Khi Chạy

- [ ] Backup database hiện tại
- [ ] Đảm bảo MySQL đang chạy
- [ ] Kiểm tra kết nối database
- [ ] Đọc kỹ các warnings và notes

---

## 🔧 Cách Chạy

### Cách 1: MySQL Workbench / HeidiSQL / DBeaver

1. Mở MySQL Workbench / HeidiSQL / DBeaver
2. Kết nối với thông số:
   - **Host:** localhost
   - **Port:** 3306
   - **Username:** root
   - **Password:** root
   - **Database:** vnpt_business_db

3. Mở lần lượt các file SQL theo thứ tự:
   - `2026-03-28_01_workflow_definitions.sql`
   - `2026-03-28_02_workflow_transitions_update.sql`
   - `2026-03-28_03_seed_default_workflow.sql`
   - `2026-03-28_04_import_workflowa_transitions.sql`

4. Execute từng file (Ctrl+Shift+E hoặc F5)

---

### Cách 2: Command Line (Nếu có mysql trong PATH)

```bash
# Kết nối thử
mysql -h localhost -u root -proot vnpt_business_db -e "SELECT 'Connection OK' AS status;"

# Chạy lần lượt từng file
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_01_workflow_definitions.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_02_workflow_transitions_update.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_03_seed_default_workflow.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_04_import_workflowa_transitions.sql
```

---

### Cách 3: Windows Batch File

Tạo file `run_scripts.bat` trong folder `2026-03-28_workflow_definitions`:

```batch
@echo off
echo Running Workflow Definitions SQL Scripts...
echo.

echo [1/4] Running 2026-03-28_01_workflow_definitions.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_01_workflow_definitions.sql
if errorlevel 1 (
    echo ERROR: Script 01 failed!
    pause
    exit /b 1
)
echo [OK] Script 01 completed
echo.

echo [2/4] Running 2026-03-28_02_workflow_transitions_update.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_02_workflow_transitions_update.sql
if errorlevel 1 (
    echo ERROR: Script 02 failed!
    pause
    exit /b 1
)
echo [OK] Script 02 completed
echo.

echo [3/4] Running 2026-03-28_03_seed_default_workflow.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_03_seed_default_workflow.sql
if errorlevel 1 (
    echo ERROR: Script 03 failed!
    pause
    exit /b 1
)
echo [OK] Script 03 completed
echo.

echo [4/4] Running 2026-03-28_04_import_workflowa_transitions.sql
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_04_import_workflowa_transitions.sql
if errorlevel 1 (
    echo ERROR: Script 04 failed!
    pause
    exit /b 1
)
echo [OK] Script 04 completed
echo.

echo ====================================
echo All scripts executed successfully!
echo ====================================
pause
```

Sau đó chạy:
```bash
cd database/sql-patches/2026-03-28_workflow_definitions
run_scripts.bat
```

---

## ✅ Verify Sau Khi Chạy

### 1. Kiểm tra bảng workflow_definitions

```sql
-- Kiểm tra bảng đã tạo
SELECT * FROM workflow_definitions;
-- Expected: 1 row (LUONG_A)
```

### 2. Kiểm tra số lượng transitions

```sql
-- Kiểm tra số lượng transitions
SELECT 
    w.code AS workflow_code,
    w.name AS workflow_name,
    COUNT(t.id) AS transition_count
FROM workflow_definitions w
LEFT JOIN customer_request_status_transitions t ON w.id = t.workflow_definition_id
WHERE w.code = 'LUONG_A'
GROUP BY w.id, w.code, w.name;
-- Expected: 46 transitions
```

### 3. Kiểm tra transitions từ new_intake

```sql
-- Kiểm tra các transitions có thể từ new_intake
SELECT 
    t.to_status_code,
    t.allowed_roles,
    t.sort_order
FROM customer_request_status_transitions t
JOIN workflow_definitions w ON t.workflow_definition_id = w.id
WHERE w.code = 'LUONG_A'
  AND t.from_status_code = 'new_intake'
  AND t.is_active = TRUE
ORDER BY t.sort_order;
-- Expected: 2 rows (assigned_to_receiver, pending_dispatch)
```

### 4. Kiểm tra cấu trúc bảng

```sql
-- Kiểm tra cấu trúc workflow_definitions
DESCRIBE workflow_definitions;

-- Kiểm tra cấu trúc customer_request_status_transitions
DESCRIBE customer_request_status_transitions;

-- Kiểm tra indexes
SHOW INDEX FROM workflow_definitions;
SHOW INDEX FROM customer_request_status_transitions;

-- Kiểm tra foreign keys
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'vnpt_business_db'
  AND TABLE_NAME = 'customer_request_status_transitions'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

---

## 📊 Kết Quả Mong Đợi

### workflow_definitions

| id | code | name | is_active | is_default |
|----|------|------|-----------|------------|
| 1 | LUONG_A | Luồng xử lý A | 1 | 1 |

### customer_request_status_transitions (46 rows)

| sort_order | from_status_code | to_status_code | allowed_roles |
|------------|------------------|----------------|---------------|
| 1 | new_intake | assigned_to_receiver | ["R"] |
| 2 | new_intake | pending_dispatch | ["all"] |
| 3 | assigned_to_receiver | receiver_in_progress | ["R"] |
| ... | ... | ... | ... |
| 46 | customer_notified | pending_dispatch | ["all"] |

---

## ⚠️ Troubleshooting

### Lỗi: Table 'workflow_definitions' already exists

**Giải pháp:**
```sql
DROP TABLE IF EXISTS workflow_definitions;
-- Sau đó chạy lại scripts
```

### Lỗi: Column 'workflow_definition_id' already exists

**Giải pháp:** Bỏ qua script 02, chạy tiếp scripts 03 và 04

### Lỗi: Foreign key constraint fails

**Nguyên nhân:** Table `workflow_definitions` chưa tồn tại khi tạo FK

**Giải pháp:** Chạy script 01 trước, sau đó chạy script 02

### Lỗi: Duplicate entry 'LUONG_A'

**Giải pháp:**
```sql
DELETE FROM customer_request_status_transitions 
WHERE workflow_definition_id IN (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A');
DELETE FROM workflow_definitions WHERE code = 'LUONG_A';
-- Sau đó chạy lại scripts 03 và 04
```

---

## 📝 Backup Database

```bash
# Backup trước khi chạy
mysqldump -h localhost -u root -proot vnpt_business_db > backup_before_workflow_2026-03-28.sql

# Hoặc backup với gzip
mysqldump -h localhost -u root -proot vnpt_business_db | gzip > backup_before_workflow_2026-03-28.sql.gz
```

---

## 🔄 Rollback (Nếu Cần)

```sql
-- Xóa tất cả data workflow
DELETE FROM customer_request_status_transitions WHERE workflow_definition_id IS NOT NULL;
DELETE FROM workflow_definitions;

-- Hoặc xóa table
DROP TABLE IF EXISTS workflow_definitions;

-- Lưu ý: Script 02 chỉ thêm column và indexes, không có rollback SQL
-- Để rollback script 02, cần chạy:
ALTER TABLE customer_request_status_transitions 
  DROP FOREIGN KEY fk_workflow_transitions_workflow,
  DROP INDEX idx_workflow_transitions,
  DROP COLUMN workflow_definition_id;
```

---

## 📞 Next Steps Sau Khi Chạy Scripts

1. ✅ Verify data trong database
2. ✅ Chạy tests: `cd backend && php artisan test --filter=Workflow`
3. ✅ Tạo Services (Phase 2)
4. ✅ Tạo Controllers (Phase 2)
5. ✅ Tạo API endpoints (Phase 2)

---

**Status:** Ready for execution  
**Estimated Time:** 5-10 minutes  
**Risk Level:** Medium (backup trước khi chạy)
