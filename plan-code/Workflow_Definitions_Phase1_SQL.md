# 📋 Plan: Workflow Definitions - Phase 1 (SQL Scripts)

**Ngày cập nhật:** 2026-03-28  
**Version:** 1.1 (SQL Script Approach)  
**Trạng thái:** Ready for Implementation

---

## 🎯 Mục Tiêu

Triển khai Phase 1 của hệ thống Workflow Definitions sử dụng **SQL script files** thay vì Laravel migration để:
- Tạo bảng `workflow_definitions` - định nghĩa các luồng xử lý
- Cập nhật bảng `customer_request_status_transitions` để hỗ trợ multi-workflow
- Seed default workflow "LUONG_A"
- Follow pattern hiện có từ `database/sql-patches/`

---

## 📊 Phân Tích Chức Năng

### Phạm vi
- **Backend only**: Database schema + Models
- **Không thay đổi**: Frontend UI, API endpoints (sẽ cập nhật ở Phase 2)
- **Pattern**: SQL scripts trong `database/sql-patches/` thay vì `database/migrations/`

### Yêu cầu chính
1. ✅ Tạo bảng `workflow_definitions` với đầy đủ indexes và foreign keys
2. ✅ Thêm `workflow_definition_id` vào `customer_request_status_transitions`
3. ✅ Seed default workflow "LUONG_A" với các transitions mặc định
4. ✅ Tạo Eloquent models cho 2 tables
5. ✅ Unit tests cho models và relationships

### Ràng buộc
- **Database**: MySQL 8.0+ (InnoDB, utf8mb4)
- **Pattern**: Follow cấu trúc từ `database/sql-patches/2026-03-26_...`
- **Compatibility**: Giữ tương thích ngược với data hiện có
- **Soft deletes**: `workflow_definitions` có `deleted_at`

### Rủi ro
| Rủi ro | Mức độ | Mitigation |
|--------|--------|------------|
| Mất data khi ALTER TABLE | Medium | Backup DB trước khi chạy scripts |
| Foreign key constraint fails | Medium | Chạy scripts theo đúng thứ tự |
| Duplicate workflow codes | Low | UNIQUE constraint trên `code` |
| Performance với transitions | Low | Add composite index |

---

## 📝 Chi Tiết Plan

### Phase 1.1: Tạo SQL Scripts

| Task ID | Mô Tả | Priority | Estimate | Dependencies | Status |
|---------|-------|----------|----------|--------------|--------|
| **T1.1** | **Tạo folder và README.md**<br>- Folder: `database/sql-patches/2026-03-28_workflow_definitions/`<br>- README.md: Hướng dẫn apply scripts, thứ tự chạy, notes | High | 1h | None | Pending |
| **T1.2** | **Script 01: workflow_definitions.sql**<br>- CREATE TABLE workflow_definitions<br>- Indexes: idx_process_type_active<br>- Foreign keys: created_by, updated_by | High | 2h | T1.1 | Pending |
| **T1.3** | **Script 02: workflow_transitions_update.sql**<br>- ALTER TABLE customer_request_status_transitions<br>- ADD COLUMN workflow_definition_id<br>- ADD INDEX idx_workflow_transitions<br>- ADD FOREIGN KEY constraint | High | 1.5h | T1.2 | Pending |
| **T1.4** | **Script 03: seed_default_workflow.sql**<br>- INSERT workflow "LUONG_A"<br>- INSERT các transitions mặc định<br>- Verify data | High | 1.5h | T1.3 | Pending |
| **T1.5** | **Script 04: Import transitions từ workflowa.xlsx**<br>- Mapping tiếng Việt → English status codes<br>- Mapping Tác nhân → allowed_roles JSON<br>- 46 INSERT statements cho LUONG_A<br>- Verify queries | High | 2h | T1.4 | Pending |
| **T1.6** | **Cập nhật thongtinmoi.txt**<br>- Thêm hướng dẫn kết nối MySQL<br>- Lệnh chạy SQL scripts<br>- Checklist verify | Medium | 0.5h | None | Pending |

### Phase 1.2: Tạo Eloquent Models

| Task ID | Mô Tả | Priority | Estimate | Dependencies | Status |
|---------|-------|----------|----------|--------------|--------|
| **T1.6** | **Model WorkflowDefinition**<br>- File: `backend/app/Models/WorkflowDefinition.php`<br>- Relationships: hasMany(WorkflowTransition), belongsTo(User)<br>- Scopes: active(), default()<br>- Fillable properties | High | 1.5h | T1.1-T1.4 | Pending |
| **T1.7** | **Model WorkflowTransition**<br>- File: `backend/app/Models/WorkflowTransition.php`<br>- Relationships: belongsTo(WorkflowDefinition)<br>- Scopes: active(), forProcessType()<br>- Casts: config → array | High | 1.5h | T1.1-T1.4 | Pending |

### Phase 1.3: Testing & Validation

| Task ID | Mô Tả | Priority | Estimate | Dependencies | Status |
|---------|-------|----------|----------|--------------|--------|
| **T1.8** | **Unit Tests - Models**<br>- Test: WorkflowDefinitionTest.php<br>- Test: WorkflowTransitionTest.php<br>- Coverage: relationships, scopes | Medium | 2h | T1.6, T1.7 | Pending |
| **T1.9** | **Manual Testing - SQL Scripts**<br>- Apply scripts trên staging DB<br>- Verify schema changes<br>- Verify seed data | High | 1h | T1.1-T1.4 | Pending |
| **T1.10** | **Documentation & Commit**<br>- Cập nhật plan-code docs<br>- Commit với message chuẩn<br>- Push branch | Low | 0.5h | All above | Pending |

**Tổng ước lượng:** **15 hours** (~2 working days với buffer)

---

## 🏁 Milestones

### Milestone 1: SQL Scripts Complete
- **Deliverables**: 4 SQL scripts + README.md
- **Target**: Day 1 morning
- **Acceptance**: Scripts chạy thành công trên staging DB

### Milestone 2: Models Complete
- **Deliverables**: WorkflowDefinition.php, WorkflowTransition.php
- **Target**: Day 1 afternoon
- **Acceptance**: Models pass unit tests

### Milestone 3: Testing & Documentation Complete
- **Deliverables**: Unit tests, verified DB schema, committed code
- **Target**: Day 2 morning
- **Acceptance**: All tests pass, docs updated

---

## ✅ Definition of Done

### Phase 1.1 (SQL Scripts)
- [ ] Folder `database/sql-patches/2026-03-28_workflow_definitions/` được tạo
- [ ] README.md với hướng dẫn apply scripts
- [ ] Script 01: `workflow_definitions.sql` - CREATE TABLE thành công
- [ ] Script 02: `workflow_transitions_update.sql` - ALTER TABLE thành công
- [ ] Script 03: `seed_default_workflow.sql` - INSERT data thành công
- [ ] Script 04: `import_workflowa_transitions.sql` - INSERT 46 transitions thành công
- [ ] Verify: `SELECT * FROM workflow_definitions` trả về 1 row (LUONG_A)
- [ ] Verify: `DESCRIBE customer_request_status_transitions` có column `workflow_definition_id`
- [ ] Verify: 46 transitions được insert cho LUONG_A
- [ ] Commit SQL scripts vào Git

### Phase 1.2 (Models)
- [ ] Model `WorkflowDefinition.php` với đầy đủ relationships
- [ ] Model `WorkflowTransition.php` với đầy đủ relationships
- [ ] Scopes: `active()`, `default()`, `forProcessType()`
- [ ] Fillable properties đúng
- [ ] Casts cho JSON columns

### Phase 1.3 (Testing)
- [ ] Unit tests cho 2 models (minimum 80% coverage)
- [ ] Manual test: Apply scripts trên staging DB
- [ ] Checklist verify hoàn thành
- [ ] Documentation cập nhật
- [ ] Git commit với message chuẩn: `feat(backend): add workflow definitions schema and models`

---

## 📂 Cấu Trúc Files

```
qlcv2/
├── database/
│   └── sql-patches/
│       └── 2026-03-28_workflow_definitions/
│           ├── README.md                                      # ✅ T1.1
│           ├── 2026-03-28_01_workflow_definitions.sql          # ✅ T1.2
│           ├── 2026-03-28_02_workflow_transitions_update.sql   # ✅ T1.3
│           ├── 2026-03-28_03_seed_default_workflow.sql         # ✅ T1.4
│           └── 2026-03-28_04_import_workflowa_transitions.sql  # ✅ T1.5
├── backend/
│   └── app/
│       └── Models/
│           ├── WorkflowDefinition.php             # ✅ T1.7
│           └── WorkflowTransition.php             # ✅ T1.8
├── backend/
│   └── tests/
│       └── Unit/
│           ├── Models/
│           │   ├── WorkflowDefinitionTest.php     # ✅ T1.9
│           │   └── WorkflowTransitionTest.php     # ✅ T1.9
├── thongtinmoi.txt                                # ✅ T1.6
└── plan-code/
    └── Workflow_Definitions_Phase1_SQL.md         # ✅ File này
```

---

## 🔧 Hướng Dẫn Chạy SQL Scripts

### Bước 1: Backup Database
```bash
mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-03-28.sql
```

### Bước 2: Kết nối MySQL
```bash
mysql -h localhost -u root -proot
```

### Bước 3: Chọn Database
```sql
USE vnpt_business_db;
```

### Bước 4: Apply Scripts (theo thứ tự)
```sql
-- Script 01: Tạo bảng workflow_definitions
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_01_workflow_definitions.sql;

-- Script 02: Cập nhật workflow_transitions
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_02_workflow_transitions_update.sql;

-- Script 03: Seed default workflow
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_03_seed_default_workflow.sql;

-- Script 04: Import transitions từ workflowa.xlsx
source database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_04_import_workflowa_transitions.sql;
```

### Hoặc từ Command Line
```bash
cd C:\Users\pchgi\Documents\code\qlcv2

mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_01_workflow_definitions.sql

mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_02_workflow_transitions_update.sql

mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_03_seed_default_workflow.sql

mysql -h localhost -u root -proot vnpt_business_db < database/sql-patches/2026-03-28_workflow_definitions/2026-03-28_04_import_workflowa_transitions.sql
```

---

## ✅ Checklist Verify Sau Khi Chạy Scripts

```markdown
## Checklist Áp Dụng SQL Scripts

### Trước khi chạy
- [ ] Backup database: `mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-03-28.sql`
- [ ] Kiểm tra connection: `mysql -h localhost -u root -proot`
- [ ] Chọn database: `USE vnpt_business_db;`

### Sau Script 01 (workflow_definitions)
- [ ] Verify table exists: `SHOW TABLES LIKE 'workflow_definitions';`
- [ ] Verify columns: `DESCRIBE workflow_definitions;`
- [ ] Verify indexes: `SHOW INDEX FROM workflow_definitions;`
- [ ] Verify foreign keys: `SELECT * FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = 'workflow_definitions' AND CONSTRAINT_TYPE = 'FOREIGN KEY';`

### Sau Script 02 (workflow_transitions_update)
- [ ] Verify column added: `DESCRIBE customer_request_status_transitions;` (có workflow_definition_id)
- [ ] Verify index: `SHOW INDEX FROM customer_request_status_transitions;`
- [ ] Verify foreign key: `SELECT * FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_NAME = 'customer_request_status_transitions' AND CONSTRAINT_TYPE = 'FOREIGN KEY';`

### Sau Script 03 (seed_default_workflow)
- [ ] Verify seed data: `SELECT * FROM workflow_definitions;` (có 1 row LUONG_A)
- [ ] Verify transitions: `SELECT * FROM customer_request_status_transitions WHERE workflow_definition_id IS NOT NULL;`
- [ ] Verify active flag: `SELECT code, is_active, is_default FROM workflow_definitions WHERE code = 'LUONG_A';`

### Sau Script 04 (import_workflowa_transitions)
- [ ] Verify 46 transitions: `SELECT COUNT(*) FROM customer_request_status_transitions WHERE workflow_definition_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A');`
- [ ] Verify transitions by status: `SELECT from_status_code, COUNT(*) FROM customer_request_status_transitions WHERE workflow_definition_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A') GROUP BY from_status_code;`
- [ ] Verify allowed_roles: `SELECT DISTINCT allowed_roles FROM customer_request_status_transitions WHERE workflow_definition_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A');`

### Commit & Push
- [ ] Commit SQL scripts: `git add database/sql-patches/2026-03-28_workflow_definitions/`
- [ ] Commit models: `git add backend/app/Models/WorkflowDefinition.php backend/app/Models/WorkflowTransition.php`
- [ ] Commit tests: `git add backend/tests/Unit/Models/`
- [ ] Commit message: `feat(backend): add workflow definitions schema and models (Phase 1)`
- [ ] Push branch: `git push origin <branch-name>`
```

---

## 📄 SQL Script Templates

### Template: README.md
```markdown
# Workflow Definitions Schema Patch

- **Date:** 2026-03-28
- **Author:** [Your Name]
- **Purpose:** Create workflow_definitions table and update transitions for multi-workflow support

## Apply Order

1. `2026-03-28_01_workflow_definitions.sql` - CREATE TABLE workflow_definitions
2. `2026-03-28_02_workflow_transitions_update.sql` - ALTER TABLE customer_request_status_transitions
3. `2026-03-28_03_seed_default_workflow.sql` - INSERT default workflow "LUONG_A"
4. `2026-03-28_04_import_workflowa_transitions.sql` - INSERT 46 transitions from workflowa.xlsx

## Notes

- **Backup first:** `mysqldump -h localhost -u root -proot vnpt_business_db > backup_2026-03-28.sql`
- Scripts are forward-only. No rollback included.
- Script 02 adds nullable column with default NULL for backward compatibility.
- Script 03 seeds default workflow with is_active=TRUE, is_default=TRUE.
- Script 04 imports 46 transitions from workflowa.xlsx for LUONG_A workflow.

## Verification

```sql
-- Check workflow_definitions table
SELECT * FROM workflow_definitions;

-- Check transitions with workflow
SELECT wt.*, wd.code as workflow_code
FROM customer_request_status_transitions wt
LEFT JOIN workflow_definitions wd ON wt.workflow_definition_id = wd.id
WHERE wt.workflow_definition_id IS NOT NULL;

-- Check LUONG_A transitions count
SELECT COUNT(*) FROM customer_request_status_transitions 
WHERE workflow_definition_id = (SELECT id FROM workflow_definitions WHERE code = 'LUONG_A');
```
```

### Template: 01_workflow_definitions.sql
```sql
-- 2026-03-28_01_workflow_definitions.sql
-- Purpose: Create workflow_definitions table

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã luồng: LUONG_A, LUONG_B',
    name VARCHAR(255) NOT NULL COMMENT 'Tên luồng: Luồng xử lý A',
    description TEXT COMMENT 'Mô tả luồng',
    process_type VARCHAR(50) NOT NULL DEFAULT 'customer_request' COMMENT 'Loại process',
    is_active BOOLEAN DEFAULT FALSE COMMENT 'Chỉ 1 luồng active tại thời điểm',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'Luồng mặc định',
    version VARCHAR(20) DEFAULT '1.0' COMMENT 'Version luồng',
    config JSON COMMENT 'Cấu hình bổ sung (JSON)',
    created_by BIGINT UNSIGNED COMMENT 'User tạo',
    updated_by BIGINT UNSIGNED COMMENT 'User cập nhật',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL COMMENT 'Soft delete',
    
    INDEX idx_process_type_active (process_type, is_active),
    INDEX idx_is_default (is_default),
    CONSTRAINT fk_workflow_created_by FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_workflow_updated_by FOREIGN KEY (updated_by) REFERENCES internal_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Định nghĩa luồng workflow';
```

### Template: 02_workflow_transitions_update.sql
```sql
-- 2026-03-28_02_workflow_transitions_update.sql
-- Purpose: Add workflow_definition_id to customer_request_status_transitions

-- Step 1: Add column (nullable for backward compatibility)
ALTER TABLE customer_request_status_transitions
ADD COLUMN workflow_definition_id BIGINT UNSIGNED NULL 
    COMMENT 'FK to workflow_definitions, NULL = applies to all workflows'
    AFTER id;

-- Step 2: Add index for performance
ALTER TABLE customer_request_status_transitions
ADD INDEX idx_workflow_transitions (workflow_definition_id, from_status_code, to_status_code, is_active);

-- Step 3: Add foreign key constraint
ALTER TABLE customer_request_status_transitions
ADD CONSTRAINT fk_workflow_transitions_workflow
    FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE;

-- Note: Existing transitions have NULL workflow_definition_id
-- They apply to ALL workflows (backward compatible)
```

### Template: 03_seed_default_workflow.sql
```sql
-- 2026-03-28_03_seed_default_workflow.sql
-- Purpose: Seed default workflow "LUONG_A" with standard transitions

-- Step 1: Insert workflow definition
INSERT INTO workflow_definitions (code, name, process_type, is_active, is_default, version, created_at, updated_at)
VALUES (
    'LUONG_A',
    'Luồng xử lý A',
    'customer_request',
    TRUE,
    TRUE,
    '1.0',
    NOW(),
    NOW()
);

-- Get the workflow ID
SET @workflow_a_id = LAST_INSERT_ID();

-- Step 2: Insert standard transitions for LUONG_A
-- new_intake → waiting_customer_feedback (default)
INSERT INTO customer_request_status_transitions 
    (workflow_definition_id, from_status_code, to_status_code, direction, is_default, is_active, created_at)
VALUES 
    (@workflow_a_id, 'new_intake', 'waiting_customer_feedback', 'forward', TRUE, TRUE, NOW()),
    (@workflow_a_id, 'new_intake', 'in_progress', 'forward', FALSE, TRUE, NOW()),
    (@workflow_a_id, 'new_intake', 'not_executed', 'forward', FALSE, TRUE, NOW()),
    (@workflow_a_id, 'new_intake', 'analysis', 'forward', FALSE, TRUE, NOW()),
    
    (@workflow_a_id, 'waiting_customer_feedback', 'in_progress', 'forward', TRUE, TRUE, NOW()),
    (@workflow_a_id, 'waiting_customer_feedback', 'not_executed', 'forward', FALSE, TRUE, NOW()),
    
    (@workflow_a_id, 'analysis', 'in_progress', 'forward', TRUE, TRUE, NOW()),
    (@workflow_a_id, 'analysis', 'not_executed', 'forward', FALSE, TRUE, NOW()),
    
    (@workflow_a_id, 'in_progress', 'completed', 'forward', TRUE, TRUE, NOW()),
    (@workflow_a_id, 'in_progress', 'not_executed', 'forward', FALSE, TRUE, NOW()),
    (@workflow_a_id, 'in_progress', 'returned_to_manager', 'backward', FALSE, TRUE, NOW()),
    
    (@workflow_a_id, 'completed', 'customer_notified', 'forward', TRUE, TRUE, NOW()),
    
    (@workflow_a_id, 'returned_to_manager', 'analysis', 'backward', TRUE, TRUE, NOW());

-- Verify
SELECT wd.code, wd.name, COUNT(wt.id) as transition_count
FROM workflow_definitions wd
LEFT JOIN customer_request_status_transitions wt ON wt.workflow_definition_id = wd.id
WHERE wd.code = 'LUONG_A'
GROUP BY wd.id;
```

---

## 🚀 Next Steps (Phase 2 Preview)

Sau khi Phase 1 hoàn thành:
1. **API Endpoints**: CRUD cho workflow_definitions
2. **Frontend UI**: Modal cấu hình luồng workflow
3. **Transition Logic**: Update CustomerRequestCaseDomainService để hỗ trợ multi-workflow
4. **Migration Strategy**: Convert existing transitions to workflow-specific

---

## 📞 Liên Hệ & Support

- **Technical Lead:** [Name]
- **Database Admin:** [Name]
- **Reviewers:** [Names]

**Lưu ý:** Luôn backup database trước khi chạy SQL scripts trên production.
