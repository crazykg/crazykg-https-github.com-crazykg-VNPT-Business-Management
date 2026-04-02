# Báo Cáo Kiểm Tra Đồng Bộ SQL Scripts với Database
**Date:** 2026-03-30  
**Database:** vnpt_business_db (localhost)  
**Folder:** `database/sql-patches/2026-03-28_workflow_definitions/`

---

## ✅ TỔNG QUAN

Tất cả các file SQL scripts trong folder **2026-03-28_workflow_definitions** đã được kiểm tra và **ĐỒNG BỘ 100%** với cấu trúc database hiện tại.

---

## 📊 CHI TIẾT KIỂM TRA

### 1. File: `2026-03-28_01_workflow_definitions.sql`

**Mục đích:** Tạo bảng `workflow_definitions`

**Status:** ✅ **ĐỒNG BỘ**

| Column | SQL Script | Database Actual | Match |
|--------|------------|-----------------|-------|
| id | bigint unsigned | bigint unsigned | ✅ |
| code | varchar(50) | varchar(50) | ✅ |
| name | varchar(255) | varchar(255) | ✅ |
| description | text | text | ✅ |
| process_type | varchar(50) | varchar(50) | ✅ |
| is_active | tinyint(1) | tinyint(1) | ✅ |
| is_default | tinyint(1) | tinyint(1) | ✅ |
| version | varchar(20) | varchar(20) | ✅ |
| config | json | json | ✅ |
| created_by | bigint unsigned | bigint unsigned | ✅ |
| updated_by | bigint unsigned | bigint unsigned | ✅ |
| activated_at | timestamp | timestamp | ✅ |
| created_at | timestamp | timestamp | ✅ |
| updated_at | timestamp | timestamp | ✅ |
| deleted_at | timestamp | timestamp | ✅ |

**Indexes:** ✅ Full match (code, process_type, active, default, deleted_at)  
**Foreign Keys:** ✅ Full match (fk_workflow_created_by, fk_workflow_updated_by)

---

### 2. File: `2026-03-28_02_workflow_transitions_update.sql`

**Mục đích:** Thêm column `workflow_definition_id` vào `customer_request_status_transitions`

**Status:** ✅ **ĐỒNG BỘ**

**Database structure hiện tại:**
```
+------------------------+-------------------+------+-----+---------+
| Field                  | Type              | Null | Key | Default |
+------------------------+-------------------+------+-----+---------+
| id                     | bigint unsigned   | NO   | PRI | NULL    |
| workflow_definition_id | bigint unsigned   | YES  | MUL | NULL    | ← Added
| from_status_code       | varchar(80)       | NO   | MUL | NULL    |
| to_status_code         | varchar(80)       | NO   |     | NULL    |
| process_name_vi        | varchar(255)      | YES  |     | NULL    |
| allowed_roles          | json              | YES  |     | NULL    |
| transition_config      | json              | YES  |     | NULL    |
| direction              | varchar(20)       | NO   |     | forward |
| is_default             | tinyint(1)        | NO   |     | 0       |
| is_active              | tinyint(1)        | NO   |     | 1       |
| sort_order             | smallint unsigned | NO   |     | 0       |
| notes                  | text              | YES  |     | NULL    |
| created_at             | timestamp         | YES  |     | NULL    |
| updated_at             | timestamp         | YES  |     | NULL    |
+------------------------+-------------------+------+-----+---------+
```

✅ Column `workflow_definition_id` đã được thêm thành công  
✅ Index `idx_workflow_transitions` đã tồn tại  
✅ Foreign key `fk_workflow_transitions_workflow` đã tồn tại

---

### 3. File: `2026-03-28_03_seed_default_workflow.sql`

**Mục đích:** Seed workflow mặc định LUONG_A

**Status:** ✅ **ĐỒNG BỘ**

**Data trong database:**
```
+----+---------+--------------------------------+-----------+
| id | code    | name                           | is_active |
+----+---------+--------------------------------+-----------+
|  4 | LUONG_A | Luồng xử lý Yêu cầu khách hàng |     1     |
+----+---------+--------------------------------+-----------+
```

✅ Workflow LUONG_A đã được seed  
✅ `is_active = 1`, `is_default = 1`  
✅ `version = '1.0'`  
✅ `config` JSON đã được lưu

---

### 4. File: `2026-03-28_04_import_workflowa_transitions.sql`

**Mục đích:** Import 46 transitions từ workflowa.xlsx

**Status:** ✅ **ĐÃ CẬP NHẬT - ĐỒNG BỘ**

**Cập nhật:** Đã bổ sung column `process_name_vi` vào INSERT statements

**Data trong database:**
```
+-------+------------------------+
| total | workflow_definition_id |
+-------+------------------------+
|    46 |                      4 |
+-------+------------------------+
```

✅ 46 transitions đã được import cho workflow LUONG_A (id=4)  
✅ Column `process_name_vi` đã có dữ liệu tiếng Việt  
✅ Example: `'Giao R thực hiện'`, `'Chuyển BA Phân tích'`, etc.

---

### 5. File: `2026-03-28_05_link_customer_request_cases_to_workflow.sql`

**Mục đích:** Thêm FK `workflow_definition_id` vào `customer_request_cases`

**Status:** ✅ **ĐỒNG BỘ**

**Database structure:**
```
+----------------------------+------------------+------+-----+
| Field                      | Type             | Null | Key |
+----------------------------+------------------+------+-----+
| id                         | bigint unsigned  | NO   | PRI |
| ...                        |                  |      |     |
| workflow_definition_id     | bigint unsigned  | YES  | MUL | ← Added
| ...                        |                  |      |     |
+----------------------------+------------------+------+-----+
```

✅ Column `workflow_definition_id` đã tồn tại  
✅ Index `idx_workflow_definition` đã tồn tại  
✅ Foreign key `fk_crc_workflow_definition` đã tồn tại

---

### 6. File: `2026-03-28_06_add_workflow_management_permissions.sql`

**Mục đích:** Thêm permission `workflow.manage`

**Status:** ✅ **ĐỒNG BỘ**

**Data trong database:**
```
+-----+-----------------+-------------------------+
| id  | perm_key        | perm_name               |
+-----+-----------------+-------------------------+
| 154 | workflow.manage | Quản lý luồng công việc |
+-----+-----------------+-------------------------+
```

✅ Permission `workflow.manage` đã tồn tại  
✅ Đã gán cho role ADMIN (kiểm tra trong role_permission)

---

### 7. File: `2026-03-29_01_add_process_name_vi_to_transitions.sql`

**Mục đích:** Thêm column `process_name_vi` vào `customer_request_status_transitions`

**Status:** ✅ **ĐỒNG BỘ**

**Database structure:**
```
+-------------------+------+-----+
| Field             | Null | Key |
+-------------------+------+-----+
| process_name_vi   | YES  |     |
+-------------------+------+-----+
```

✅ Column `process_name_vi` đã tồn tại  
✅ Data đã được update cho workflow LUONG_A

---

### 8. File: `2026-03-29_02_create_customer_request_assigned_to_receiver_table.sql`

**Mục đích:** Tạo bảng `customer_request_assigned_to_receiver`

**Status:** ✅ **ĐỒNG BỘ**

| Column | SQL Script | Database Actual | Match |
|--------|------------|-----------------|-------|
| id | bigint unsigned | bigint unsigned | ✅ |
| request_case_id | bigint unsigned | bigint unsigned | ✅ |
| receiver_user_id | bigint unsigned | bigint unsigned | ✅ |
| accepted_at | datetime | datetime | ✅ |
| started_at | datetime | datetime | ✅ |
| expected_completed_at | datetime | datetime | ✅ |
| processing_content | text | text | ✅ |
| notes | text | text | ✅ |
| created_by | bigint unsigned | bigint unsigned | ✅ |
| updated_by | bigint unsigned | bigint unsigned | ✅ |
| created_at | timestamp | timestamp | ✅ |
| updated_at | timestamp | timestamp | ✅ |
| deleted_at | timestamp | timestamp | ✅ |

✅ Table đã tồn tại trong database  
✅ Indexes: request_case_id, receiver_user_id, created_by, updated_by, deleted_at  
✅ Foreign keys: fk_crc_assigned_to_receiver_case, receiver, created_by, updated_by

---

### 9. File: `2026-03-29_03_create_customer_request_receiver_in_progress_table.sql`

**Mục đích:** Tạo bảng `customer_request_receiver_in_progress`

**Status:** ✅ **ĐỒNG BỘ**

| Column | SQL Script | Database Actual | Match |
|--------|------------|-----------------|-------|
| id | bigint unsigned | bigint unsigned | ✅ |
| request_case_id | bigint unsigned | bigint unsigned | ✅ |
| receiver_user_id | bigint unsigned | bigint unsigned | ✅ |
| accepted_at | datetime | datetime | ✅ |
| started_at | datetime | datetime | ✅ |
| expected_completed_at | datetime | datetime | ✅ |
| progress_percent | tinyint unsigned | tinyint unsigned | ✅ |
| processing_content | text | text | ✅ |
| notes | text | text | ✅ |
| created_by | bigint unsigned | bigint unsigned | ✅ |
| updated_by | bigint unsigned | bigint unsigned | ✅ |
| created_at | timestamp | timestamp | ✅ |
| updated_at | timestamp | timestamp | ✅ |
| deleted_at | timestamp | timestamp | ✅ |

✅ Table đã tồn tại trong database  
✅ Indexes: request_case_id, receiver_user_id, created_by, updated_by, deleted_at  
✅ Foreign keys: fk_crc_receiver_in_progress_case, receiver, created_by, updated_by

---

## 📋 TÓM TẮT

| # | File SQL | Status | Ghi chú |
|---|----------|--------|---------|
| 1 | 2026-03-28_01_workflow_definitions.sql | ✅ Đồng bộ | Table workflow_definitions |
| 2 | 2026-03-28_02_workflow_transitions_update.sql | ✅ Đồng bộ | Added workflow_definition_id FK |
| 3 | 2026-03-28_03_seed_default_workflow.sql | ✅ Đồng bộ | Seed LUONG_A workflow |
| 4 | 2026-03-28_04_import_workflowa_transitions.sql | ✅ Đã cập nhật | Added process_name_vi |
| 5 | 2026-03-28_05_link_customer_request_cases_to_workflow.sql | ✅ Đồng bộ | FK in customer_request_cases |
| 6 | 2026-03-28_06_add_workflow_management_permissions.sql | ✅ Đồng bộ | Permission workflow.manage |
| 7 | 2026-03-29_01_add_process_name_vi_to_transitions.sql | ✅ Đồng bộ | Column process_name_vi |
| 8 | 2026-03-29_02_create_customer_request_assigned_to_receiver_table.sql | ✅ Đồng bộ | Table assigned_to_receiver |
| 9 | 2026-03-29_03_create_customer_request_receiver_in_progress_table.sql | ✅ Đồng bộ | Table receiver_in_progress |

---

## ✅ KẾT LUẬN

**TẤT CẢ 9 FILE SQL ĐÃ ĐỒNG BỘ 100% VỚI DATABASE**

### Các table đã được tạo và đồng bộ:
- ✅ `workflow_definitions`
- ✅ `customer_request_status_transitions` (với workflow_definition_id, process_name_vi)
- ✅ `customer_request_cases` (với workflow_definition_id FK)
- ✅ `customer_request_assigned_to_receiver`
- ✅ `customer_request_receiver_in_progress`

### Data đã được seed:
- ✅ Workflow LUONG_A (id=4, is_active=1, is_default=1)
- ✅ 46 transitions cho LUONG_A với process_name_vi
- ✅ Permission `workflow.manage` (id=154)

---

## 🔧 KHUYẾN NGHỊ

1. **Không cần chạy lại scripts** - Database đã đồng bộ hoàn toàn
2. **Backup database** trước khi chạy bất kỳ script nào trong tương lai
3. **File 2026-03-28_04** đã được cập nhật với `process_name_vi` - giữ nguyên bản này cho tương lai

---

**Report generated:** 2026-03-30  
**Verified by:** SQL Script Comparison Tool
