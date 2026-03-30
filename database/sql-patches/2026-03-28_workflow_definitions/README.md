# Workflow Definitions - SQL Patch Set

- **Date:** 2026-03-28
- **Purpose:** Tạo bảng workflow_definitions và cập nhật workflow_transitions để hỗ trợ multi-workflow
- **Source:** workflowa.xlsx (46 transitions cho LUONG_A)
- **Baseline:** vnpt_business_db_2026-02-24_175408.sql

## Apply Order

1. `2026-03-28_01_workflow_definitions.sql` - Tạo bảng workflow_definitions
2. `2026-03-28_02_workflow_transitions_update.sql` - Thêm FK workflow_definition_id
3. `2026-03-28_03_seed_default_workflow.sql` - Seed workflow mặc định LUONG_A
4. `2026-03-28_04_import_workflowa_transitions.sql` - Import 46 transitions từ workflowa.xlsx

## Source Data

File 04 được generate từ: `plan-code/Dieu_chinh_ql_yc_khach_hang/workflowa.xlsx`
- **Workflow:** LUONG_A (Luồng xử lý A)
- **Số transitions:** 46 rows
- **Mapping:** Tiếng Việt → English status codes

## Hướng Dẫn Chạy SQL Scripts

### Cách 1: MySQL CLI

```bash
# Kết nối MySQL
mysql -h localhost -u root -proot vnpt_business_db

# Apply lần lượt theo thứ tự
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_01_workflow_definitions.sql
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_02_workflow_transitions_update.sql
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_03_seed_default_workflow.sql
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_04_import_workflowa_transitions.sql
```

### Cách 2: Command Line

```bash
# Chạy từng file
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_01_workflow_definitions.sql
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_02_workflow_transitions_update.sql
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_03_seed_default_workflow.sql
mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_04_import_workflowa_transitions.sql
```

### Cách 3: Chạy tất cả (Windows)

```bash
cd database/sql-patches/2026-03-28_workflow_definitions
for %f in (2026-03-28_*.sql) do mysql -h localhost -u root -proot vnpt_business_db < %f
```

## Verify Sau Khi Apply

```sql
-- 1. Kiểm tra bảng workflow_definitions
SELECT * FROM workflow_definitions;
-- Expected: 1 row (LUONG_A)

-- 2. Kiểm tra số lượng transitions
SELECT workflow_definition_id, COUNT(*) as transition_count
FROM customer_request_status_transitions
WHERE workflow_definition_id IS NOT NULL
GROUP BY workflow_definition_id;
-- Expected: 46 transitions for LUONG_A

-- 3. Kiểm tra transitions của LUONG_A
SELECT t.from_status_code, t.to_status_code, t.allowed_roles, t.sort_order
FROM customer_request_status_transitions t
JOIN workflow_definitions w ON t.workflow_definition_id = w.id
WHERE w.code = 'LUONG_A'
ORDER BY t.sort_order;

-- 4. Kiểm tra transitions từ new_intake
SELECT to_status_code, allowed_roles
FROM customer_request_status_transitions
WHERE workflow_definition_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A')
  AND from_status_code = 'new_intake'
  AND is_active = TRUE;
-- Expected: 2 rows (assigned_to_receiver, pending_dispatch)
```

## Backup Trước Khi Apply

```bash
# Backup database
mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-03-28_workflow_definitions.sql

# Hoặc backup với gzip
mysqldump -h localhost -u root -proot vnpt_business_db | gzip > backup_2026-03-28_workflow_definitions.sql.gz
```

## Rollback (Nếu Cần)

```sql
-- Xóa bảng workflow_definitions (sẽ cascade delete transitions)
DROP TABLE IF EXISTS workflow_definitions;

-- Hoặc xóa data cụ thể
DELETE FROM customer_request_status_transitions WHERE workflow_definition_id IS NOT NULL;
DELETE FROM workflow_definitions;
```

## Troubleshooting

### Lỗi: Foreign key constraint fails

**Nguyên nhân:** Table `customer_request_status_transitions` chưa có column `workflow_definition_id`

**Giải pháp:** Chạy script 02 trước script 03 và 04

### Lỗi: Duplicate entry

**Nguyên nhân:** Đã chạy script trước đó

**Giải pháp:** Xóa data cũ hoặc dùng `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE`

### Lỗi: Workflow LUONG_A not found

**Nguyên nhân:** Script 03 chưa chạy hoặc failed

**Giải pháp:** Chạy lại script 03:
```bash
mysql -h localhost -u root -proot vnpt_business_db < 2026-03-28_03_seed_default_workflow.sql
```

## Notes

- ✅ Các scripts là **forward-only**, không có rollback SQL
- ✅ Script 04 import đúng 46 transitions từ file Excel workflowa.xlsx
- ✅ Tất cả transitions đều thuộc workflow `LUONG_A`
- ✅ `allowed_roles` là JSON: `["all"]`, `["R"]`, hoặc `["A"]`
- ✅ Chỉ 1 workflow active tại một thời điểm (`is_active = TRUE`)

## Next Steps

Sau khi apply thành công:
1. ✅ Tạo Models: `WorkflowDefinition.php`, `WorkflowTransition.php`
2. ✅ Tạo Services: `WorkflowDefinitionService`, `WorkflowTransitionService`
3. ✅ Tạo Controllers: `WorkflowDefinitionController`, `WorkflowTransitionController`
4. ✅ Tạo API endpoints
5. ✅ Tạo Frontend Admin UI

---

**Status:** Ready for execution  
**Tested:** ✅ Staging DB  
**Approved:** Pending
