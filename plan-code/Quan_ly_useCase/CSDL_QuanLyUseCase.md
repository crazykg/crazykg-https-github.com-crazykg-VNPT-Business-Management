# CSDL - Quản lý Use Case theo Dự án

> **Module:** Quản lý Use Case
> **Ngày tạo:** 2026-03-21
> **File SQL:** [CSDL_QuanLyUseCase.sql](./CSDL_QuanLyUseCase.sql)

---

## 1. Tổng quan kiến trúc

### Sơ đồ quan hệ (ERD)

```
┌──────────────┐
│   PROJECTS   │  ← Gốc sở hữu: mỗi dự án có tập UC riêng biệt
│──────────────│
│ id (PK)      │
│ project_code │  (unique)
│ project_name │
│ description  │
│ document_content │  ← Lưu văn bản dự án
│ start_date   │
│ end_date     │
│ status       │
└──────┬───────┘
       │
       │ 1:N (project_id)
       │
       ├────────────────────────────────────────────────────────┐
       │                          │                             │
       ▼                          ▼                             ▼
┌──────────────┐     ┌───────────────────┐           ┌──────────────┐
│  SUBSYSTEMS  │     │ FUNCTION_GROUPS   │           │   ACTORS     │
│──────────────│     │───────────────────│           │──────────────│
│ id (PK)      │     │ id (PK)           │           │ id (PK)      │
│ project_id   │────→│ project_id        │           │ project_id   │
│ subsystem_   │     │ subsystem_id (FK) │←──────────│ actor_name   │
│   code       │     │ group_code        │           │ actor_type   │
│ subsystem_   │     │ group_name        │           │ description  │
│   name       │     │ document_content  │           │ document_    │
│ document_    │     └─────────┬─────────┘           │   content    │
│   content    │               │                     └──────┬───────┘
└──────┬───────┘               │                            │
       │                       │                            │
       │          ┌────────────┘                            │
       │          │                                         │
       ▼          ▼                                         │
┌═══════════════════════════════════════════┐               │
║           ★ USE_CASES ★                  ║               │
║═══════════════════════════════════════════║               │
║ id (PK)                                  ║               │
║ project_id (FK) ← NOT NULL, trực tiếp   ║               │
║ subsystem_id (FK) ← NULL được           ║               │
║ function_group_id (FK) ← NULL được      ║               │
║──────────────────────────────────────────║               │
║ sequence_number    │ use_case_code       ║               │
║ use_case_name      │ use_case_description║               │
║ necessity_level    │ transaction_count   ║               │
║ complexity_level   │ classification      ║               │
║ notes              │ document_content    ║  ← Văn bản   │
║ document_format    │ status              ║               │
║ version            │ sort_order          ║               │
╚═══════════╤═══════════════════════════════╝               │
            │                                               │
            │ 1:N                                           │
    ┌───────┼──────────────┬────────────────┐               │
    ▼       ▼              ▼                ▼               │
┌────────┐┌──────────┐┌────────────┐┌──────────────┐       │
│ STEPS  ││ATTACH-   ││ AUDIT_LOGS ││USE_CASE_     │       │
│        ││MENTS     ││            ││ACTORS        │←──────┘
│step_   ││file_name ││action      ││use_case_id   │  N:N
│ number ││file_path ││field_      ││actor_id      │
│step_   ││file_type ││ changed    ││actor_role    │
│ desc.  ││document_ ││old_value   ││(primary/     │
│step_   ││ content  ││new_value   ││ secondary)   │
│ type   ││          ││changed_by  ││              │
└────────┘└──────────┘└────────────┘└──────────────┘
```

---

## 2. Chi tiết các bảng

### 2.1. `projects` — Bảng Dự án

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `project_code` | VARCHAR(50) UNIQUE | NO | Mã dự án (VD: `PL3-DANSO`) |
| `project_name` | VARCHAR(500) | NO | Tên dự án |
| `description` | TEXT | YES | Mô tả ngắn |
| `document_content` | LONGTEXT | YES | Nội dung văn bản tài liệu dự án |
| `start_date` | DATE | YES | Ngày bắt đầu |
| `end_date` | DATE | YES | Ngày kết thúc (dự kiến) |
| `status` | ENUM | NO | `draft` / `in_progress` / `completed` / `archived` |
| `created_by` | BIGINT UNSIGNED | YES | Người tạo |
| `updated_by` | BIGINT UNSIGNED | YES | Người cập nhật cuối |
| `created_at` | TIMESTAMP | NO | Thời gian tạo |
| `updated_at` | TIMESTAMP | NO | Thời gian cập nhật |
| `deleted_at` | TIMESTAMP | YES | Soft delete |

---

### 2.2. `subsystems` — Hệ thống con / Module

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `project_id` | BIGINT UNSIGNED FK | NO | Thuộc dự án nào |
| `subsystem_code` | VARCHAR(20) | NO | Mã (I, II, III...) |
| `subsystem_name` | VARCHAR(500) | NO | Tên hệ thống con |
| `description` | TEXT | YES | Mô tả |
| `document_content` | LONGTEXT | YES | Văn bản chi tiết |
| `sort_order` | INT | NO | Thứ tự sắp xếp |

**Unique:** `(project_id, subsystem_code)`

---

### 2.3. `function_groups` — Nhóm chức năng

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `project_id` | BIGINT UNSIGNED FK | NO | Thuộc dự án nào (denormalized) |
| `subsystem_id` | BIGINT UNSIGNED FK | YES | Thuộc subsystem nào (NULL nếu không phân cấp) |
| `group_code` | VARCHAR(20) | NO | Mã nhóm (I.1, I.2, II.1...) |
| `group_name` | VARCHAR(500) | NO | Tên nhóm |
| `description` | TEXT | YES | Mô tả |
| `document_content` | LONGTEXT | YES | Văn bản chi tiết |
| `sort_order` | INT | NO | Thứ tự sắp xếp |

**Unique:** `(project_id, group_code)`

---

### 2.4. `actors` — Tác nhân

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `project_id` | BIGINT UNSIGNED FK | NO | Thuộc dự án nào |
| `actor_name` | VARCHAR(200) | NO | Tên tác nhân |
| `actor_type` | ENUM | NO | `human` / `system` / `external` |
| `description` | TEXT | YES | Mô tả |
| `document_content` | LONGTEXT | YES | Văn bản chi tiết |

**Unique:** `(project_id, actor_name)`

---

### 2.5. `use_cases` — ★ Bảng chính Use Case

| Cột | Kiểu | Null | Nguồn Excel | Mô tả |
|-----|------|------|-------------|-------|
| `id` | BIGINT UNSIGNED PK | NO | — | ID tự tăng |
| `project_id` | BIGINT UNSIGNED FK | **NO** | — | ★ Thuộc dự án nào (FK trực tiếp) |
| `subsystem_id` | BIGINT UNSIGNED FK | YES | — | Thuộc subsystem (tuỳ chọn) |
| `function_group_id` | BIGINT UNSIGNED FK | YES | — | Thuộc nhóm chức năng (tuỳ chọn) |
| `sequence_number` | INT | NO | Cột A (TT) | Số thứ tự |
| `use_case_code` | VARCHAR(50) | YES | — | Mã UC (VD: `UC-I1-001`) |
| `use_case_name` | VARCHAR(500) | NO | Cột B | Tên Use Case |
| `use_case_description` | TEXT | YES | Cột E | Mô tả các bước |
| `necessity_level` | VARCHAR(50) | YES | Cột F | **Hiện tại: VARCHAR** — Bắt buộc (B) / Mong muốn (M) / Tuỳ chọn (T). **Target (xem §10):** FK → `lookup_necessity_levels` |
| `transaction_count` | INT | YES | Cột G | Số transaction |
| `complexity_level` | VARCHAR(50) | YES | Cột H | **Hiện tại: VARCHAR** — Đơn giản / Trung Bình / Phức tạp. **Target (xem §10):** FK → `lookup_complexity_levels` |
| `classification` | VARCHAR(100) | YES | Cột I | **Hiện tại: VARCHAR** — Dữ liệu đầu vào / Dữ liệu đầu ra / Truy vấn. **Target (xem §10):** FK → `lookup_classifications` |
| `notes` | TEXT | YES | Cột J | Ghi chú |
| `document_content` | LONGTEXT | YES | ★ Bổ sung | Văn bản đặc tả chi tiết |
| `document_format` | VARCHAR(20) | NO | ★ Bổ sung | plain / markdown / html |
| `status` | ENUM | NO | — | draft / reviewed / approved / implemented / tested |
| `version` | INT | NO | — | Phiên bản (mặc định 1) |
| `sort_order` | INT | NO | — | Thứ tự sắp xếp tuỳ chỉnh |

**Unique:** `(project_id, use_case_code)` — mã UC không trùng trong cùng dự án

**Indexes chính:**
- `idx_use_cases_project` — lọc UC theo dự án
- `idx_use_cases_project_subsystem` — lọc theo dự án + subsystem
- `idx_use_cases_project_group` — lọc theo dự án + nhóm chức năng
- `idx_use_cases_name` — tìm kiếm theo tên
- `idx_use_cases_status` — lọc theo trạng thái

---

### 2.6. `use_case_actors` — Liên kết UC ↔ Actor (N:N)

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `use_case_id` | BIGINT UNSIGNED FK | NO | FK → use_cases |
| `actor_id` | BIGINT UNSIGNED FK | NO | FK → actors |
| `actor_role` | ENUM | NO | `primary` = Tác nhân chính / `secondary` = Tác nhân phụ |

**Unique:** `(use_case_id, actor_id, actor_role)`

---

### 2.7. `use_case_steps` — Các bước của UC

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `use_case_id` | BIGINT UNSIGNED FK | NO | FK → use_cases |
| `step_number` | INT | NO | Số thứ tự bước |
| `step_description` | TEXT | NO | Mô tả bước |
| `step_type` | ENUM | NO | `main` / `alternative` / `exception` |
| `document_content` | LONGTEXT | YES | Văn bản chi tiết cho bước |

---

### 2.8. `use_case_attachments` — File đính kèm

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `use_case_id` | BIGINT UNSIGNED FK | NO | FK → use_cases |
| `file_name` | VARCHAR(500) | NO | Tên file gốc |
| `file_path` | VARCHAR(1000) | NO | Đường dẫn lưu trữ |
| `file_size` | BIGINT UNSIGNED | YES | Kích thước (bytes) |
| `file_type` | VARCHAR(100) | YES | MIME type |
| `description` | TEXT | YES | Mô tả |
| `document_content` | LONGTEXT | YES | Nội dung text trích xuất từ file |

---

### 2.9. `use_case_audit_logs` — Lịch sử thay đổi

| Cột | Kiểu | Null | Mô tả |
|-----|------|------|-------|
| `id` | BIGINT UNSIGNED PK | NO | ID tự tăng |
| `use_case_id` | BIGINT UNSIGNED FK | NO | FK → use_cases |
| `action` | ENUM | NO | `create` / `update` / `delete` / `restore` / `status_change` |
| `field_changed` | VARCHAR(100) | YES | Trường bị thay đổi |
| `old_value` | TEXT | YES | Giá trị cũ |
| `new_value` | TEXT | YES | Giá trị mới |
| `changed_by` | BIGINT UNSIGNED | YES | Người thay đổi |
| `changed_at` | TIMESTAMP | NO | Thời điểm thay đổi |

---

## 3. Views hỗ trợ truy vấn

| View | Mục đích | Query mẫu |
|------|----------|-----------|
| `v_project_use_cases` | Hiển thị UC đầy đủ theo dự án (như bảng Excel) | `SELECT * FROM v_project_use_cases WHERE project_id = 1` |
| `v_project_use_case_summary` | Thống kê UC theo nhóm/subsystem/dự án | `SELECT * FROM v_project_use_case_summary WHERE project_id = 1` |
| `v_project_overview` | Tổng quan nhanh: đếm UC, actor, subsystem theo dự án (sử dụng subqueries riêng biệt để tránh fan-out) | `SELECT * FROM v_project_overview` |

> **Lưu ý kiến trúc (ISSUE-2 fix):** View `v_project_overview` phải sử dụng **subqueries/CTEs riêng biệt** cho mỗi bảng con (use_cases, subsystems, function_groups, actors), sau đó JOIN kết quả lại. **KHÔNG** join trực tiếp nhiều bảng 1:N vào projects vì gây fan-out (nhân bản rows → sai COUNT/SUM).
>
> ```sql
> CREATE OR REPLACE VIEW v_project_overview AS
> SELECT p.id, p.project_code, p.project_name, p.status,
>        COALESCE(uc_agg.total_use_cases, 0) AS total_use_cases,
>        COALESCE(uc_agg.total_transactions, 0) AS total_transactions,
>        COALESCE(s_agg.cnt, 0) AS total_subsystems,
>        COALESCE(fg_agg.cnt, 0) AS total_function_groups,
>        COALESCE(a_agg.cnt, 0) AS total_actors
> FROM projects p
> LEFT JOIN (SELECT project_id, COUNT(*) AS total_use_cases,
>            SUM(COALESCE(transaction_count,0)) AS total_transactions
>            FROM use_cases WHERE deleted_at IS NULL GROUP BY project_id) uc_agg ON p.id = uc_agg.project_id
> LEFT JOIN (SELECT project_id, COUNT(*) AS cnt FROM subsystems WHERE deleted_at IS NULL GROUP BY project_id) s_agg ON p.id = s_agg.project_id
> LEFT JOIN (SELECT project_id, COUNT(*) AS cnt FROM function_groups WHERE deleted_at IS NULL GROUP BY project_id) fg_agg ON p.id = fg_agg.project_id
> LEFT JOIN (SELECT project_id, COUNT(*) AS cnt FROM actors WHERE deleted_at IS NULL GROUP BY project_id) a_agg ON p.id = a_agg.project_id
> WHERE p.deleted_at IS NULL;
> ```

---

## 4. Query thường dùng

```sql
-- Lấy tất cả UC của 1 dự án
SELECT * FROM v_project_use_cases WHERE project_code = 'PL3-DANSO';

-- Lấy UC chỉ thuộc Website (subsystem I)
SELECT * FROM v_project_use_cases WHERE project_id = 1 AND subsystem_code = 'I';

-- Lấy UC theo nhóm chức năng cụ thể
SELECT * FROM v_project_use_cases WHERE project_id = 1 AND group_code = 'I.3';

-- Tìm UC theo tên
SELECT * FROM use_cases WHERE project_id = 1 AND use_case_name LIKE '%hộ gia đình%';

-- Thống kê theo dự án
SELECT * FROM v_project_use_case_summary WHERE project_id = 1;

-- Tổng quan tất cả dự án
SELECT * FROM v_project_overview;

-- Lấy UC có nội dung văn bản đính kèm
SELECT use_case_code, use_case_name, document_content
FROM use_cases
WHERE project_id = 1 AND document_content IS NOT NULL;
```

---

## 5. Nguyên tắc thiết kế

1. **Project là gốc sở hữu** — Mọi dữ liệu (UC, actor, subsystem, group) đều thuộc 1 dự án cụ thể, các dự án hoàn toàn tách biệt
2. **Phân cấp linh hoạt** — `subsystem_id` và `function_group_id` trong `use_cases` là tuỳ chọn (NULL), phù hợp cả dự án đơn giản lẫn phức tạp
3. **Denormalized `project_id`** — Có mặt ở `use_cases`, `function_groups`, `actors` để query nhanh không cần JOIN nhiều tầng
4. **Trường `document_content` (LONGTEXT)** — Có mặt ở mọi bảng chính, cho phép lưu văn bản chi tiết cho từng cấp
5. **Soft delete** — Tất cả bảng chính đều có `deleted_at` để khôi phục dữ liệu
6. **Audit trail** — `use_case_audit_logs` ghi nhận mọi thay đổi

---

## 6. Đảm bảo tính toàn vẹn sở hữu dự án (ISSUE-1 fix)

> **Vấn đề:** FK đơn cột (chỉ `id`) không đảm bảo rằng subsystem, function_group, actor được liên kết cùng thuộc 1 project. Một UC có thể vô tình trỏ đến subsystem của dự án khác.

### 6.1. Quy tắc ràng buộc sở hữu

**Nguyên tắc:** Mọi FK tham chiếu đến entity có `project_id` phải đảm bảo cùng project boundary.

| Bảng | FK | Ràng buộc cần thiết |
|------|-----|---------------------|
| `use_cases` | `subsystem_id` | `subsystems.project_id` phải = `use_cases.project_id` |
| `use_cases` | `function_group_id` | `function_groups.project_id` phải = `use_cases.project_id` |
| `use_case_actors` | `actor_id` | `actors.project_id` phải = `use_cases.project_id` (thông qua join) |
| `function_groups` | `subsystem_id` | `subsystems.project_id` phải = `function_groups.project_id` |

### 6.2. Chiến lược enforcement

**Tầng 1 — Application layer (Laravel):** Service layer phải validate `project_id` khớp trước khi tạo/cập nhật liên kết. Đây là tầng enforcement **bắt buộc**.

```php
// Ví dụ trong UseCaseDomainService
private function validateProjectOwnership(UseCase $uc, ?int $subsystemId, ?int $groupId): void
{
    if ($subsystemId && Subsystem::where('id', $subsystemId)->value('project_id') !== $uc->project_id) {
        throw new ValidationException('Subsystem does not belong to this project');
    }
    // Tương tự cho function_group, actors
}
```

**Tầng 2 — Database triggers (tuỳ chọn, defense-in-depth):**

```sql
CREATE TRIGGER trg_use_cases_project_check BEFORE INSERT ON use_cases
FOR EACH ROW
BEGIN
    IF NEW.subsystem_id IS NOT NULL AND
       (SELECT project_id FROM subsystems WHERE id = NEW.subsystem_id) != NEW.project_id
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cross-project subsystem reference';
    END IF;
    -- Tương tự cho function_group_id
END;
```

**Tầng 3 — Composite unique keys (đã có):** `uk_subsystem_code_project (project_id, subsystem_code)`, `uk_group_code_project (project_id, group_code)` đảm bảo mã không trùng trong project.

---

## 7. Chính sách xoá dữ liệu (ISSUE-3 fix)

> **Vấn đề:** `ON DELETE CASCADE` (hard delete) mâu thuẫn với `deleted_at` (soft delete). Cần chính sách rõ ràng.

### 7.1. Phân loại bảng theo chính sách xoá

| Bảng | Chính sách | `deleted_at` | `ON DELETE` | Lý do |
|------|-----------|--------------|-------------|-------|
| `projects` | **Soft delete** | ✅ | — (gốc) | Khôi phục được dự án |
| `subsystems` | **Soft delete** | ✅ | `SET NULL` | Giữ lịch sử, UC trỏ thành NULL |
| `function_groups` | **Soft delete** | ✅ | `SET NULL` | Giữ lịch sử, UC trỏ thành NULL |
| `actors` | **Soft delete** | ✅ | `RESTRICT` via junction table (`use_case_actors.actor_id` → `actors.id` ON DELETE RESTRICT) | Không xoá actor đang được sử dụng. Phải gỡ liên kết UC trước |
| `use_cases` | **Soft delete** | ✅ | `CASCADE` tới steps/attachments | Xoá mềm UC, con theo |
| `use_case_actors` | **Hard delete** (junction) | ❌ | `CASCADE` | Bảng liên kết, tái tạo được |
| `use_case_steps` | **Hard delete** (child) | ❌ | `CASCADE` | Luôn đi theo UC cha |
| `use_case_attachments` | **Soft delete** | ✅ thêm | `CASCADE` | Giữ metadata file |
| `use_case_audit_logs` | **Immutable** (append-only) | ❌ | `RESTRICT` (không cho xoá UC nếu có audit log; phải archive trước) | Không bao giờ xoá/sửa log |

### 7.2. Quy tắc vận hành

1. **Mặc định soft delete** — Gọi `$model->delete()` (Laravel SoftDeletes trait) thay vì `forceDelete()`
2. **Cấm hard delete** ở application layer — Chỉ cho phép qua migration hoặc admin CLI
3. **`ON DELETE CASCADE`** chỉ áp dụng cho bảng con không có soft delete (steps, junction tables)
4. **`ON DELETE SET NULL`** cho FK tuỳ chọn (subsystem_id, function_group_id) — UC giữ nguyên khi group bị soft delete
5. **Audit logs immutable** — Không có `deleted_at`, không có UPDATE, chỉ INSERT. FK dùng `RESTRICT` — không cho xoá UC nếu còn audit log
6. **Quy trình force-delete UC** (admin only): Bước 1: Chuyển audit logs sang bảng archive (`use_case_audit_logs_archive`) → Bước 2: DELETE audit logs gốc → Bước 3: force delete UC. **Không** dùng SET NULL vì `use_case_id` là NOT NULL

### 7.3. Bảng Archive cho Audit Logs

> Bảng `use_case_audit_logs_archive` có cùng schema với `use_case_audit_logs`, bổ sung metadata archive:

```sql
CREATE TABLE use_case_audit_logs_archive (
    id              BIGINT UNSIGNED PRIMARY KEY,  -- Giữ nguyên ID gốc
    use_case_id     BIGINT UNSIGNED NOT NULL COMMENT 'UC ID gốc (không FK vì UC đã bị xoá)',
    action          ENUM('create', 'update', 'delete', 'restore', 'status_change') NOT NULL,
    field_changed   VARCHAR(100) NULL,
    old_value       TEXT NULL,
    new_value       TEXT NULL,
    changed_by      BIGINT UNSIGNED NULL,
    changed_at      TIMESTAMP NOT NULL,
    -- Metadata archive
    archived_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm chuyển vào archive',
    archived_by     BIGINT UNSIGNED NULL COMMENT 'Admin thực hiện archive',
    archive_reason  VARCHAR(200) NULL COMMENT 'Lý do: force_delete_uc, data_retention, ...',
    INDEX idx_archive_uc (use_case_id),
    INDEX idx_archive_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Archive bảng audit logs — lưu trữ log khi UC bị force-delete';
```

**Chính sách retention:** Archive logs giữ tối thiểu **2 năm**, sau đó có thể purge theo batch. Không có auto-delete.

---

## 8. Cơ chế Audit Trail (ISSUE-4 fix)

> **Vấn đề:** Bảng `use_case_audit_logs` tồn tại nhưng chưa xác định cơ chế tạo log.

### 8.1. Cơ chế: Laravel Service Layer (V5AccessAuditService pattern)

Theo kiến trúc backend hiện tại, audit được thực hiện ở **tầng Service**, không dùng DB triggers.

**Quy trình:**
1. Mọi thao tác CRUD trên `use_cases` phải đi qua `UseCaseDomainService`
2. Service gọi `$this->auditService->recordAuditEvent()` sau mỗi INSERT/UPDATE/DELETE/RESTORE
3. `V5AccessAuditService` tự động:
   - Capture `old_value` / `new_value` cho từng field thay đổi
   - Redact sensitive fields (nếu có) qua `AuditValueSanitizer`
   - Ghi `changed_by` từ `auth()->id()`

**Các event cần audit:**

| Action | Trigger | Ghi gì |
|--------|---------|--------|
| `create` | Tạo UC mới | Toàn bộ field values |
| `update` | Cập nhật UC | Chỉ các field thay đổi (old→new) |
| `delete` | Soft delete UC | Ghi `deleted_at` timestamp |
| `restore` | Khôi phục UC | Ghi `restored_at` |
| `status_change` | Đổi trạng thái | `old_value`=status cũ, `new_value`=status mới |

### 8.2. Không dùng DB triggers vì:
- Laravel model events (`creating`, `updating`, `deleting`) đã cover
- Triggers không capture `changed_by` (không có auth context)
- Khó maintain và debug
- Không consistent với pattern hiện tại của backend

---

## 9. Bảng mapping Excel → SQL đầy đủ (ISSUE-5 fix)

> **Vấn đề:** Mapping Excel chưa cover đầy đủ tất cả cột và loại dòng.

### 9.1. Mapping cột Excel

| Cột Excel | Header gốc | Kiểu dòng | Bảng đích | Cột đích | Ghi chú |
|-----------|------------|-----------|-----------|----------|---------|
| A | TT | Data row | `use_cases` | `sequence_number` | Số thứ tự trong nhóm |
| B | Tên Use-Case | Data row | `use_cases` | `use_case_name` | |
| C | Tác nhân chính | Data row | `use_case_actors` | `actor_id` + `actor_role='primary'` | Parse nhiều tên, tách bằng dấu phẩy/xuống dòng |
| D | Tác nhân phụ | Data row | `use_case_actors` | `actor_id` + `actor_role='secondary'` | Parse nhiều tên, tách bằng dấu phẩy/xuống dòng |
| E | Mô tả Use-Case | Data row | `use_cases` | `use_case_description` | Giữ nguyên xuống dòng → `\n` |
| F | Mức độ cần thiết | Data row | `use_cases` | `necessity_level` (hiện tại VARCHAR, target: FK `necessity_level_id`) | Map: "Bắt buộc (B)"→B, "Mong muốn (M)"→M, "Tuỳ chọn (T)"→T |
| G | Số transaction | Data row | `use_cases` | `transaction_count` | Parse INT, NULL nếu trống |
| H | Mức độ phức tạp | Data row | `use_cases` | `complexity_level` (hiện tại VARCHAR, target: FK `complexity_level_id`) | Map: "Đơn giản"→simple, "Trung Bình"→medium, "Phức tạp"→complex |
| I | Phân loại | Data row | `use_cases` | `classification` (hiện tại VARCHAR, target: FK `classification_id`) | Map: "Dữ liệu đầu vào"→input, "Dữ liệu đầu ra"→output, "Truy vấn"→query |
| J | Ghi chú | Data row | `use_cases` | `notes` | |

### 9.2. Mapping dòng đặc biệt (header rows)

| Pattern nhận diện | Bảng đích | Xử lý |
|-------------------|-----------|-------|
| Cột A chứa số La Mã đơn: `I`, `II`, `III` (không có dấu chấm theo sau chữ số) | `subsystems` | Tạo subsystem mới, `subsystem_code` = "I"/"II" |
| Cột A chứa số La Mã + số: `I.1`, `I.2`, `II.1` (có dấu chấm + chữ số) | `function_groups` | Tạo function group, link tới subsystem cha |
| Cột A chứa số nguyên (1, 2, 3...) | `use_cases` | Dòng data — tạo UC |
| Dòng trống / merged cells / không khớp pattern | — | Bỏ qua |

### 9.3. Xử lý Actors khi import

1. Parse tên actor từ cột C + D (split bằng `,` hoặc `\n`)
2. Trim whitespace, normalize Unicode (NFC)
3. Lookup actor theo `(project_id, actor_name)` — tạo mới nếu chưa tồn tại
4. Tạo liên kết `use_case_actors` với `actor_role` tương ứng

---

## 10. Chuẩn hoá giá trị phân loại (ISSUE-6 fix)

> **Vấn đề:** Các cột `necessity_level`, `complexity_level`, `classification` dùng VARCHAR tự do, views đếm theo literal cố định → dễ sai khi data không khớp chính xác.

### 10.1. Trạng thái hiện tại vs Target

| Giai đoạn | Schema | SQL file | Ghi chú |
|-----------|--------|----------|---------|
| **Hiện tại (v1)** | VARCHAR tự do | ✅ CSDL_QuanLyUseCase.sql | Hoạt động được, import nhanh |
| **Target (v2)** | FK → lookup tables | ❌ Chưa implement | Migration riêng khi ổn định |

### 10.2. Giải pháp target: Lookup tables

Thay VARCHAR tự do bằng FK tới lookup tables:

```sql
CREATE TABLE lookup_necessity_levels (
    id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code  VARCHAR(10) NOT NULL UNIQUE,     -- 'B', 'M', 'T'
    label VARCHAR(50) NOT NULL              -- 'Bắt buộc (B)', 'Mong muốn (M)', 'Tuỳ chọn (T)'
);

CREATE TABLE lookup_complexity_levels (
    id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code  VARCHAR(20) NOT NULL UNIQUE,     -- 'simple', 'medium', 'complex'
    label VARCHAR(50) NOT NULL              -- 'Đơn giản', 'Trung Bình', 'Phức tạp'
);

CREATE TABLE lookup_classifications (
    id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code  VARCHAR(20) NOT NULL UNIQUE,     -- 'input', 'output', 'query'
    label VARCHAR(100) NOT NULL             -- 'Dữ liệu đầu vào', 'Dữ liệu đầu ra', 'Truy vấn'
);
```

**Thay đổi trong `use_cases`:**
- `necessity_level` → `necessity_level_id TINYINT UNSIGNED FK → lookup_necessity_levels`
- `complexity_level` → `complexity_level_id TINYINT UNSIGNED FK → lookup_complexity_levels`
- `classification` → `classification_id TINYINT UNSIGNED FK → lookup_classifications`

**Lợi ích:**
- Views dùng JOIN thay vì literal matching → không bị sai khi label thay đổi
- UI hiển thị dropdown từ lookup table → đảm bảo consistency
- Import process map Vietnamese text → lookup code → FK id

---

## 11. Chiến lược tìm kiếm fulltext (ISSUE-7 fix)

> **Vấn đề:** Index B-tree trên `use_case_name` không hỗ trợ `LIKE '%keyword%'` hiệu quả.

### 11.1. Phân tích

- **Dataset hiện tại:** <100 UC/project, <10K UC tổng → B-tree + LIKE đủ dùng
- **Tương lai:** Nếu scale lên 50K+ UC → cần FULLTEXT

### 11.2. Chiến lược 2 giai đoạn

**Giai đoạn 1 (hiện tại):** Giữ B-tree index, query luôn scope theo `project_id` trước:
```sql
-- project_id index đã giới hạn scan range, LIKE chỉ quét trong project
SELECT * FROM use_cases WHERE project_id = ? AND use_case_name LIKE CONCAT('%', ?, '%');
```

**Giai đoạn 2 (khi cần):** Thêm FULLTEXT index cho tìm kiếm nâng cao:
```sql
ALTER TABLE use_cases ADD FULLTEXT INDEX ft_use_cases_search (use_case_name, use_case_description, notes);

-- Query với FULLTEXT
SELECT *, MATCH(use_case_name, use_case_description, notes) AGAINST(? IN BOOLEAN MODE) AS relevance
FROM use_cases
WHERE project_id = ? AND MATCH(use_case_name, use_case_description, notes) AGAINST(? IN BOOLEAN MODE)
ORDER BY relevance DESC;
```

**Trigger chuyển giai đoạn:** Khi tổng UC > 10K hoặc query LIKE > 500ms (đo qua slow query log).
