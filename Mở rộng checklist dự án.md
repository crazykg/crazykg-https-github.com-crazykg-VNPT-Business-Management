# Mở rộng Checklist Dự án (Đầu tư & Thuê dịch vụ)

> Tài liệu thiết kế chức năng quản lý **thủ tục/checklist dự án** trong tab Quản lý Dự án (`?tab=projects`).
> Ngày: 14/03/2026

---

## 1. Bối cảnh & Mục tiêu

### Hiện trạng
Tab **Quản lý Dự án** hiện chỉ lưu trữ thông tin cơ bản:
- Mã dự án, tên, khách hàng, trạng thái (TRIAL → ONGOING → WARRANTY → COMPLETED)
- Sản phẩm triển khai (project items), RACI, hợp đồng liên kết

### Thiếu sót
Chưa có cơ chế theo dõi **thủ tục hành chính/quy trình triển khai** — bao gồm hàng chục bước tuần tự, mỗi bước có đơn vị thực hiện, kết quả dự kiến, số ngày, tiến độ, số văn bản, ngày văn bản.

### Mục tiêu
Thiết kế DB + API + UI để quản lý 2 loại thủ tục:

| Loại | Số bước | Giai đoạn |
|------|---------|-----------|
| **Thủ tục dự án Đầu tư** | ~52 bước | Chuẩn bị → Chuẩn bị ĐT → Thực hiện ĐT → Kết thúc ĐT |
| **Thủ tục dự án Thuê dịch vụ** | ~34 bước | Chuẩn bị thực hiện KH thuê → Thực hiện ĐT → Kết thúc ĐT |

---

## 2. SQL Mở Rộng

### 2.1. Bảng `project_procedure_templates` — Template thủ tục mẫu

Lưu các bộ thủ tục chuẩn (DAU_TU, THUE_DICH_VU). Quản trị viên có thể thêm mẫu mới.

```sql
CREATE TABLE project_procedure_templates (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_code   VARCHAR(50) NOT NULL UNIQUE COMMENT 'DAU_TU | THUE_DICH_VU',
    template_name   VARCHAR(255) NOT NULL        COMMENT 'Thủ tục dự án đầu tư',
    description     TEXT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      BIGINT UNSIGNED NULL,
    updated_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    INDEX idx_template_code (template_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2. Bảng `project_procedure_template_steps` — Các bước mẫu

Chứa tất cả bước trong template. Hỗ trợ bước con (parent_step_id) cho trường hợp như bước 20 có 20a, 20b, 20c.

```sql
CREATE TABLE project_procedure_template_steps (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id             BIGINT UNSIGNED NOT NULL,
    step_number             INT NOT NULL                COMMENT 'Số TT: 1, 2, 3...',
    parent_step_id          BIGINT UNSIGNED NULL        COMMENT 'Bước cha (cho bước con 20a, 20b)',
    phase                   VARCHAR(100) NULL           COMMENT 'CHUAN_BI | CHUAN_BI_DAU_TU | THUC_HIEN_DAU_TU | KET_THUC_DAU_TU',
    step_name               VARCHAR(500) NOT NULL       COMMENT 'Tên bước: Báo cáo đề xuất chủ trương đầu tư',
    step_detail             TEXT NULL                   COMMENT 'Nội dung cụ thể',
    lead_unit               VARCHAR(500) NULL           COMMENT 'Đơn vị chủ trì/thực hiện',
    support_unit            VARCHAR(500) NULL           COMMENT 'Đơn vị hỗ trợ',
    expected_result         TEXT NULL                   COMMENT 'Kết quả dự kiến',
    default_duration_days   INT NULL DEFAULT 0          COMMENT 'Số ngày triển khai mặc định',
    sort_order              INT NOT NULL DEFAULT 0      COMMENT 'Thứ tự sắp xếp',
    created_at              TIMESTAMP NULL,
    updated_at              TIMESTAMP NULL,

    FOREIGN KEY (template_id)    REFERENCES project_procedure_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_step_id) REFERENCES project_procedure_template_steps(id) ON DELETE SET NULL,
    INDEX idx_template_sort (template_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3. Bảng `project_procedures` — Instance thủ tục gắn vào dự án

Mỗi dự án có thể gắn 1+ bộ thủ tục (VD: vừa Đầu tư vừa Thuê). Clone từ template.

```sql
CREATE TABLE project_procedures (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id          BIGINT UNSIGNED NOT NULL,
    template_id         BIGINT UNSIGNED NOT NULL,
    procedure_name      VARCHAR(255) NOT NULL       COMMENT 'Có thể custom tên',
    overall_progress    DECIMAL(5,2) DEFAULT 0      COMMENT 'Auto-calc: % hoàn thành tổng',
    notes               TEXT NULL,
    created_by          BIGINT UNSIGNED NULL,
    updated_by          BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    deleted_at          TIMESTAMP NULL,

    FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES project_procedure_templates(id),
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.4. Bảng `project_procedure_steps` — Instance từng bước (runtime data)

Chứa dữ liệu thực tế mà user cập nhật: tiến độ, số VB, ngày VB, ghi chú.

```sql
CREATE TABLE project_procedure_steps (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    procedure_id        BIGINT UNSIGNED NOT NULL,
    template_step_id    BIGINT UNSIGNED NULL        COMMENT 'Link tới bước mẫu (NULL = bước custom)',
    step_number         INT NOT NULL,
    parent_step_id      BIGINT UNSIGNED NULL,
    phase               VARCHAR(100) NULL,
    step_name           VARCHAR(500) NOT NULL,
    step_detail         TEXT NULL,
    lead_unit           VARCHAR(500) NULL,
    support_unit        VARCHAR(500) NULL,
    expected_result     TEXT NULL,
    duration_days       INT NULL DEFAULT 0,

    -- === Dữ liệu runtime (user cập nhật) ===
    progress_status     ENUM('CHUA_THUC_HIEN','DANG_THUC_HIEN','HOAN_THANH')
                        DEFAULT 'CHUA_THUC_HIEN'    COMMENT 'Tiến độ thực tế',
    document_number     VARCHAR(255) NULL            COMMENT 'Số văn bản (VD: 59/BC-SKHCN)',
    document_date       DATE NULL                    COMMENT 'Ngày văn bản',
    actual_start_date   DATE NULL,
    actual_end_date     DATE NULL,
    step_notes          TEXT NULL                    COMMENT 'Ghi chú riêng từng bước',
    sort_order          INT NOT NULL DEFAULT 0,

    updated_by          BIGINT UNSIGNED NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,

    FOREIGN KEY (procedure_id)    REFERENCES project_procedures(id) ON DELETE CASCADE,
    FOREIGN KEY (template_step_id) REFERENCES project_procedure_template_steps(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_step_id)  REFERENCES project_procedure_steps(id) ON DELETE SET NULL,
    INDEX idx_procedure_sort (procedure_id, sort_order),
    INDEX idx_progress (procedure_id, progress_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.5. Seed Data

Insert 2 templates + tất cả bước tương ứng:

**Template 1: DAU_TU** — 52 bước, 4 giai đoạn:
- Giai đoạn mở đầu (bước 1–8): Đề xuất → Thẩm định → Phê duyệt → Dự toán → KHLCNT
- CHUẨN BỊ ĐẦU TƯ (bước 9–17): Chọn nhà thầu TV → Khảo sát → BC KTKT → Thẩm tra → Phê duyệt
- THỰC HIỆN ĐẦU TƯ (bước 18–49): KHLCNT → Chọn TV → E-HSMT → Đánh giá → Thương thảo → Ký HĐ → Triển khai → Giám sát
- KẾT THÚC ĐẦU TƯ (bước 50–52): Nghiệm thu → Tổng nghiệm thu → Quyết toán

**Template 2: THUE_DICH_VU** — 34 bước, 3 giai đoạn:
- CHUẨN BỊ THỰC HIỆN KH THUÊ (bước 1–11): Xin chủ trương → Dự toán → KHLCNT → Lập KH thuê → Thẩm định → Phê duyệt
- THỰC HIỆN ĐẦU TƯ (bước 12–33): KHLCNT → Chọn TV → E-HSMT → Đánh giá → Thương thảo → Ký HĐ → Triển khai → Giám sát
- KẾT THÚC ĐẦU TƯ (bước 34): Nghiệm thu khởi tạo dịch vụ

---

## 3. Backend API

### 3.1. API Endpoints

```
# ─── Template (read-only cho user, admin mới CRUD) ───
GET  /api/v5/project-procedure-templates              # Danh sách templates
GET  /api/v5/project-procedure-templates/{id}/steps    # Các bước mẫu

# ─── Procedure instance (gắn vào project) ───
GET  /api/v5/projects/{projectId}/procedures           # Lấy procedure(s) của dự án
POST /api/v5/projects/{projectId}/procedures           # Tạo từ template (auto clone steps)
PUT  /api/v5/projects/{projectId}/procedures/{id}      # Cập nhật thông tin chung

# ─── Steps CRUD ───
GET    /api/v5/project-procedures/{procedureId}/steps  # Danh sách steps
PUT    /api/v5/project-procedure-steps/{stepId}        # Cập nhật 1 bước
PUT    /api/v5/project-procedure-steps/batch           # Batch update nhiều bước
POST   /api/v5/project-procedures/{procedureId}/steps  # Thêm bước custom
DELETE /api/v5/project-procedure-steps/{stepId}        # Xóa bước custom
```

### 3.2. Logic Service chính

| Chức năng | Mô tả |
|-----------|-------|
| **Clone from template** | `POST .../procedures` → clone tất cả template steps → `project_procedure_steps` |
| **Auto-calc progress** | Sau mỗi update step → `overall_progress = COUNT(HOAN_THANH) / COUNT(*) × 100` |
| **Batch update** | Nhận array `[{id, progress_status, document_number, document_date, step_notes}]` → update cùng lúc |
| **Custom step** | Cho phép thêm bước mới (không có template_step_id) vào vị trí bất kỳ |

### 3.3. Files Backend

| File | Hành động |
|------|-----------|
| `database/migrations/2026_03_14_180000_create_project_procedure_tables.php` | Tạo mới — 4 bảng |
| `database/seeders/ProjectProcedureTemplateSeeder.php` | Tạo mới — Seed data |
| `app/Models/ProjectProcedureTemplate.php` | Tạo mới |
| `app/Models/ProjectProcedureTemplateStep.php` | Tạo mới |
| `app/Models/ProjectProcedure.php` | Tạo mới |
| `app/Models/ProjectProcedureStep.php` | Tạo mới |
| `app/Services/V5/Domain/ProjectProcedureService.php` | Tạo mới — Business logic |
| `routes/api.php` | Sửa — Thêm routes |

---

## 4. Frontend — UI/UX

### 4.1. Điểm truy cập

Trong `ProjectList.tsx`, thêm **action button** ở cột "Thao tác" mỗi dòng dự án:
- Icon: `checklist` (Material Symbols)
- Tooltip: "Thủ tục dự án"
- Click → mở full-width modal

### 4.2. Giao diện chính — Procedure Tracker Modal

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Quay lại    Thủ tục dự án: [DA-001 Tên dự án]       [Đầu tư ▼] [Thuê]   │
│                                                                              │
│ ┌─ Progress Overview ──────────────────────────────────────────────────────┐ │
│ │ ████████████████████░░░░░  68% (35/52 bước)                             │ │
│ │ ✅ Hoàn thành: 35  │  ⏳ Đang TH: 3  │  ○ Chưa TH: 14                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Phase Tabs (Stepper) ──────────────────────────────────────────────────┐ │
│ │ [① Chuẩn bị ✅8/8] ─── [② Chuẩn bị ĐT ✅9/9] ─── [③ TH ĐT ●15/32]  │ │
│ │                    ───────── [④ Kết thúc ĐT ○0/3]                      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Steps Table ──────────────────────────────────────────────────────────┐  │
│ │ TT │ Trình tự công việc         │ ĐV thực hiện  │ Kết quả   │ Ngày │  │  │
│ │    │                            │               │ dự kiến   │ (d)  │  │  │
│ │────┼────────────────────────────┼───────────────┼───────────┼──────┤  │  │
│ │    │ ▸ GIAI ĐOẠN THỰC HIỆN ĐT  │               │           │      │  │  │
│ │────┼────────────────────────────┼───────────────┼───────────┼──────┤  │  │
│ │ 18 │ Lập KHLCNT                 │ Chủ đầu tư    │ Tờ trình  │  2   │  │  │
│ │ 19 │ Phê duyệt KHLCNT          │ Cơ quan CTTQ  │ QĐ phê    │  2   │  │  │
│ │ 20 │ Chọn lựa nhà thầu TV...   │ Chủ đầu tư    │ BB, QĐ    │  3   │  │  │
│ │  └ │   Thương thảo              │ CĐT + TV      │           │  1   │  │  │
│ │  └ │   QĐ chỉ định thầu        │ CĐT           │           │  1   │  │  │
│ │  └ │   Hợp đồng                 │ CĐT + TV      │           │  1   │  │  │
│ │ 21 │ Tổ chức lập E-HSMT        │ Đơn vị TV     │ E-HSMT    │ 15   │  │  │
│ └────┴────────────────────────────┴───────────────┴───────────┴──────┘  │  │
│                                                                              │
│ ┌─ Tiếp tục (cột runtime) ──────────────────────────────────────────────┐  │
│ │ Tiến độ       │ Số văn bản       │ Ngày VB    │ Ghi chú              │  │  │
│ │───────────────┼──────────────────┼────────────┼──────────────────────│  │  │
│ │               │                  │            │                      │  │  │
│ │───────────────┼──────────────────┼────────────┼──────────────────────│  │  │
│ │ [✅ HT    ▼] │ 59/BC-SKHCN      │ 07/05/2024 │                      │  │  │
│ │ [✅ HT    ▼] │ 149/BC-SKHĐT     │ 23/05/2024 │                      │  │  │
│ │ [⏳ Đang  ▼] │                  │            │ Nhiều gói thầu       │  │  │
│ │ [✅ HT    ▼] │                  │            │                      │  │  │
│ │ [✅ HT    ▼] │                  │            │                      │  │  │
│ │ [○ Chưa   ▼] │                  │            │                      │  │  │
│ │ [✅ HT    ▼] │                  │            │                      │  │  │
│ └───────────────┴──────────────────┴────────────┴──────────────────────┘  │  │
│                                                                              │
│                                                        [Hủy] [Lưu thay đổi] │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3. Cấu trúc Component

```
ProjectProcedureModal.tsx (MỚI — ~800-1000 dòng)
├── Header
│   ├── Nút quay lại ←
│   ├── Tiêu đề: "Thủ tục dự án: [Mã] [Tên]"
│   └── Toggle: [Đầu tư] / [Thuê] (nếu dự án có cả 2)
├── ProgressOverview
│   ├── Progress bar tổng (%): thanh ngang gradient primary
│   └── KPI mini: Hoàn thành / Đang TH / Chưa TH (3 chip)
├── PhaseTabs (Stepper bar ngang)
│   ├── Mỗi phase = 1 step indicator (circle + label + count)
│   ├── Connector line giữa phases
│   └── Click phase → scroll/filter tới nhóm bước tương ứng
├── StepsTable (Bảng chính)
│   ├── Phase divider row (nền đậm, text tên giai đoạn)
│   ├── Step rows
│   │   ├── Cột cố định: TT, Tên, ĐV, Kết quả, Ngày
│   │   └── Cột editable: Tiến độ (dropdown), Số VB (input), Ngày VB (date), Ghi chú (textarea)
│   ├── Sub-step rows (indent, icon branch └)
│   ├── Expand/collapse chi tiết (step_detail)
│   └── Row coloring theo progress_status
└── Footer
    ├── Nút "Hủy" (secondary)
    └── Nút "Lưu thay đổi" (primary, disabled khi no changes)
```

### 4.4. Bảng chi tiết UX từng cột

| Cột | Loại | Hành vi |
|-----|------|---------|
| TT | Read-only | Số thứ tự, indent cho bước con với icon `└` |
| Trình tự công việc | Read-only | Text, truncate + tooltip. Click → expand `step_detail` |
| Nội dung cụ thể | Expandable | Click row → toggle hiện/ẩn chi tiết |
| ĐV chủ trì | Read-only | Badge nhỏ, text |
| ĐV hỗ trợ | Read-only | Badge nhạt hơn |
| Kết quả dự kiến | Read-only | Text, truncate + tooltip |
| Số ngày | Read-only | Number center-align |
| **Tiến độ** | **Editable** | Dropdown mini: `○ Chưa TH` / `⏳ Đang TH` / `✅ Hoàn thành` |
| **Số văn bản** | **Editable** | Inline text input (blur → draft) |
| **Ngày văn bản** | **Editable** | Date picker compact |
| **Ghi chú** | **Editable** | Click → expandable textarea |

### 4.5. Interaction Pattern

| Pattern | Chi tiết |
|---------|----------|
| **Inline editing** | Click vào ô editable → hiện input. Blur → auto-buffer local (chưa gửi API) |
| **Batch save** | Nút "Lưu thay đổi" → gom tất cả changes → `PUT /batch` → refresh data |
| **Dirty tracking** | So sánh state hiện tại vs initial → enable/disable nút Lưu + hiện badge "X thay đổi" |
| **Row coloring** | `HOAN_THANH` → `bg-emerald-50`, `DANG_THUC_HIEN` → `bg-amber-50`, `CHUA_THUC_HIEN` → `bg-white` |
| **Phase divider** | Row header full-width, nền `bg-slate-100 font-bold text-slate-700` |
| **Phase filter** | Click phase tab → scroll smooth tới phase divider tương ứng |
| **Confirmation** | Đóng modal khi có unsaved changes → confirm dialog |

### 4.6. Mobile Responsive

- `< md` (768px): Chuyển từ table → **card list**
- Mỗi card = 1 bước: `TT` + `Tên` + `Badge tiến độ` + `Số VB`
- Tap card → expand xem chi tiết + inline form edit
- PhaseTabs → compact: chỉ hiện circle + count

### 4.7. Files Frontend

| File | Hành động |
|------|-----------|
| `components/ProjectProcedureModal.tsx` | **Tạo mới** — Component chính |
| `components/ProjectList.tsx` | **Sửa** — Thêm nút "Thủ tục dự án" ở cột thao tác |
| `types.ts` | **Sửa** — Thêm interfaces |
| `services/v5Api.ts` | **Sửa** — Thêm API functions |
| `App.tsx` | **Sửa** — Import + render modal + state management |

### 4.8. TypeScript Interfaces mới

```typescript
// Template
export interface ProcedureTemplate {
  id: string | number;
  template_code: string;      // 'DAU_TU' | 'THUE_DICH_VU'
  template_name: string;
  description?: string | null;
  is_active: boolean;
}

export interface ProcedureTemplateStep {
  id: string | number;
  template_id: string | number;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  default_duration_days?: number | null;
  sort_order: number;
  children?: ProcedureTemplateStep[];
}

// Instance
export type ProcedureStepStatus = 'CHUA_THUC_HIEN' | 'DANG_THUC_HIEN' | 'HOAN_THANH';

export interface ProjectProcedure {
  id: string | number;
  project_id: string | number;
  template_id: string | number;
  procedure_name: string;
  overall_progress: number;
  notes?: string | null;
  steps?: ProjectProcedureStep[];
}

export interface ProjectProcedureStep {
  id: string | number;
  procedure_id: string | number;
  template_step_id?: string | number | null;
  step_number: number;
  parent_step_id?: string | number | null;
  phase?: string | null;
  step_name: string;
  step_detail?: string | null;
  lead_unit?: string | null;
  support_unit?: string | null;
  expected_result?: string | null;
  duration_days?: number | null;
  progress_status: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  step_notes?: string | null;
  sort_order: number;
  children?: ProjectProcedureStep[];
}

// Batch update payload
export interface ProcedureStepBatchUpdate {
  id: string | number;
  progress_status?: ProcedureStepStatus;
  document_number?: string | null;
  document_date?: string | null;
  step_notes?: string | null;
}
```

---

## 5. Dữ liệu Seed Chi Tiết

### 5.1. Template: Thủ tục Dự án Đầu tư (DAU_TU)

| TT | Phase | Trình tự công việc | ĐV chủ trì | ĐV hỗ trợ | Kết quả dự kiến | Ngày |
|----|-------|--------------------|-------------|------------|-----------------|------|
| 1 | CHUAN_BI | Báo cáo đề xuất chủ trương đầu tư | Chủ đầu tư | | Tờ trình và báo cáo ĐXCT đầu tư | 0 |
| 2 | CHUAN_BI | Báo cáo kết quả thẩm định ĐXCT | Sở KHĐT | | | 0 |
| 3 | CHUAN_BI | Phê duyệt chủ trương thực hiện | UBND Tỉnh Hậu Giang | | Quyết định chủ trương | 0 |
| 4 | CHUAN_BI | Lập dự toán giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | | 0 |
| 5 | CHUAN_BI | Phê duyệt dự toán giai đoạn chuẩn bị đầu tư | Sở KHĐT | | | 0 |
| 6 | CHUAN_BI | Lập kế hoạch lựa chọn nhà thầu GĐ chuẩn bị ĐT | Chủ đầu tư | | | 0 |
| 7 | CHUAN_BI | Tờ trình phê duyệt KHLCNT nhiệm vụ chuẩn bị ĐT | Chủ đầu tư | | | 0 |
| 8 | CHUAN_BI | Phê duyệt KHLCNT giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | | 0 |
| 9 | CHUAN_BI_DAU_TU | Chọn lựa nhà thầu TV khảo sát, thẩm định giá, TV lập BC KTKT, TV thẩm tra BC KTKT | Chủ đầu tư | Các đơn vị tư vấn | BB thương thảo; QĐ chỉ định thầu; Các HĐ tư vấn | 3 |
| 10 | CHUAN_BI_DAU_TU | Lập nhiệm vụ khảo sát | Đơn vị tư vấn | Chủ đầu tư | Nhiệm vụ khảo sát | 3 |
| 11 | CHUAN_BI_DAU_TU | Phê duyệt nhiệm vụ khảo sát | Chủ đầu tư | | | 3 |
| 12 | CHUAN_BI_DAU_TU | Khảo sát | Đơn vị tư vấn | Chủ đầu tư | Báo cáo khảo sát | 6 |
| 13 | CHUAN_BI_DAU_TU | Lập báo cáo kinh tế kỹ thuật | Đơn vị tư vấn | Chủ đầu tư | Hồ sơ báo cáo kinh tế kỹ thuật | 30 |
| 14 | CHUAN_BI_DAU_TU | Thẩm định giá | Đơn vị tư vấn | Chủ đầu tư | Chứng thư thẩm định giá | 30 |
| 15 | CHUAN_BI_DAU_TU | Thẩm tra báo cáo kinh tế kỹ thuật | Đơn vị tư vấn thẩm tra | Chủ đầu tư | Báo cáo thẩm tra BC KTKT | 30 |
| 16 | CHUAN_BI_DAU_TU | Trình phê duyệt Hồ sơ BC KTKT | Chủ đầu tư | Đơn vị tư vấn | Hồ sơ BC KTKT hoàn chỉnh | 5 |
| 17 | CHUAN_BI_DAU_TU | Phê duyệt Hồ sơ BC KTKT | Cơ quan có thẩm quyền | Chủ đầu tư | QĐ phê duyệt Hồ sơ BC KTKT | 15 |
| 18 | THUC_HIEN_DAU_TU | Lập kế hoạch lựa chọn nhà thầu | Chủ đầu tư | | Tờ trình phê duyệt KHLCNT GĐ thực hiện ĐT | 2 |
| 19 | THUC_HIEN_DAU_TU | Phê duyệt kế hoạch lựa chọn nhà thầu | Cơ quan có thẩm quyền | Chủ đầu tư | QĐ phê duyệt KHLCNT | 2 |
| 20 | THUC_HIEN_DAU_TU | Chọn lựa nhà thầu TV QLDA, TV đấu thầu, TV thẩm định thầu, TV giám sát | Chủ đầu tư | Các đơn vị tư vấn | BB thương thảo; QĐ chỉ định; Các HĐ tư vấn | 3 |
| 20a | THUC_HIEN_DAU_TU | ↳ Thương thảo | Chủ đầu tư | Các đơn vị tư vấn | | 1 |
| 20b | THUC_HIEN_DAU_TU | ↳ QĐ chỉ định thầu | Chủ đầu tư | Các đơn vị tư vấn | | 1 |
| 20c | THUC_HIEN_DAU_TU | ↳ Hợp đồng | Chủ đầu tư | Các đơn vị tư vấn | | 1 |
| 21 | THUC_HIEN_DAU_TU | Tổ chức lập E-HSMT cho các gói thầu | Đơn vị tư vấn | Chủ đầu tư | E-HSMT | 15 |
| 22 | THUC_HIEN_DAU_TU | Tổ chức thẩm định E-HSMT | Đơn vị tư vấn | | Báo cáo thẩm định | 10 |
| 23 | THUC_HIEN_DAU_TU | Phê duyệt E-HSMT | Chủ đầu tư | | QĐ phê duyệt E-HSMT; E-HSMT chính thức | 2 |
| 24 | THUC_HIEN_DAU_TU | Đăng thông báo mời thầu | Chủ đầu tư | Đơn vị tư vấn | | 1 |
| 25 | THUC_HIEN_DAU_TU | Phát hành E-HSMT | Chủ đầu tư | | E-HSMT | 18 |
| 26 | THUC_HIEN_DAU_TU | Nhận E-HSDT | Chủ đầu tư | | E-HSDT | 0 |
| 27 | THUC_HIEN_DAU_TU | Đóng/mở thầu | Đơn vị tư vấn, nhà thầu | Chủ đầu tư | Biên bản đóng/mở thầu | 0 |
| 28 | THUC_HIEN_DAU_TU | Đánh giá HSĐXKT | Đơn vị tư vấn | | Báo cáo đánh giá HSĐXKT | 10 |
| 29 | THUC_HIEN_DAU_TU | Bàn giao Báo cáo Đánh giá HSĐXKT | Đơn vị tư vấn | Chủ đầu tư | BC Đánh giá HSĐXKT, QĐ, CV, tờ trình | 0 |
| 30 | THUC_HIEN_DAU_TU | Bàn giao BC đánh giá HSĐXKT cho TV thẩm định | Chủ đầu tư | Đơn vị TV thẩm định | | 0 |
| 31 | THUC_HIEN_DAU_TU | Tổ chức thẩm định BC đánh giá HSĐXKT | Đơn vị TV thẩm định thầu | | BC thẩm định kết quả đánh giá HSĐXKT | 10 |
| 32 | THUC_HIEN_DAU_TU | Bàn giao BC thẩm định kết quả đánh giá HSĐXKT | Đơn vị TV thẩm định thầu | Chủ đầu tư | BC thẩm định, QĐ, CV, tờ trình | 0 |
| 33 | THUC_HIEN_DAU_TU | Phê duyệt danh sách nhà thầu đáp ứng YCKT | Chủ đầu tư | | QĐ phê duyệt DS nhà thầu đáp ứng YCKT | 1 |
| 34 | THUC_HIEN_DAU_TU | Mở HSĐXTC | Đơn vị tư vấn, nhà thầu | Chủ đầu tư | Biên bản mở thầu | 0 |
| 35 | THUC_HIEN_DAU_TU | Đánh giá HSĐXTC | Đơn vị tư vấn | | Báo cáo đánh giá HSĐXTC | 5 |
| 36 | THUC_HIEN_DAU_TU | Bàn giao BC Đánh giá HSĐXTC | Đơn vị tư vấn | Chủ đầu tư | BC Đánh giá HSĐXTC, QĐ, CV, tờ trình | 0 |
| 37 | THUC_HIEN_DAU_TU | Mời thương thảo | Chủ đầu tư | Nhà thầu | | 0 |
| 38 | THUC_HIEN_DAU_TU | Thương thảo hợp đồng | Chủ đầu tư, Nhà thầu đạt | | | 1 |
| 39 | THUC_HIEN_DAU_TU | Bàn giao BC đánh giá HSĐXTC và BB thương thảo | Chủ đầu tư | Đơn vị TV thẩm định thầu | | 2 |
| 40 | THUC_HIEN_DAU_TU | Tổ chức thẩm định kết quả lựa chọn nhà thầu | Đơn vị TV thẩm định thầu | | BC thẩm định kết quả LCNT | 5 |
| 41 | THUC_HIEN_DAU_TU | Bàn giao BC thẩm định kết quả LCNT | Đơn vị TV thẩm định thầu | Chủ đầu tư | BC thẩm định, CV, tờ trình | 0 |
| 42 | THUC_HIEN_DAU_TU | Phê duyệt kết quả lựa chọn nhà thầu | Chủ đầu tư | Đơn vị tư vấn | QĐ phê duyệt kết quả LCNT | 2 |
| 43 | THUC_HIEN_DAU_TU | Thông báo | Chủ đầu tư | Đơn vị tư vấn | | 0 |
| 44 | THUC_HIEN_DAU_TU | Đăng tải KQLCNT | Chủ đầu tư | Đơn vị tư vấn | | 0 |
| 45 | THUC_HIEN_DAU_TU | Thương thảo hoàn thiện HĐ, ký kết HĐ và tổ chức triển khai | Chủ đầu tư, Nhà thầu đạt | Đơn vị tư vấn | Hợp đồng | 7 |
| 46 | THUC_HIEN_DAU_TU | Triển khai hợp đồng | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Nhật ký thi công | 120 |
| 47 | THUC_HIEN_DAU_TU | Quản lý dự án | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Báo cáo quản lý dự án | 120 |
| 48 | THUC_HIEN_DAU_TU | Giám sát | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Báo cáo giám sát, nhật ký giám sát | 120 |
| 49 | THUC_HIEN_DAU_TU | Dự phòng | Chủ đầu tư | Đơn vị tư vấn | | 30 |
| 50 | KET_THUC_DAU_TU | Bàn giao/nghiệm thu sản phẩm và dự án | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Hồ sơ nghiệm thu và bàn giao | 30 |
| 51 | KET_THUC_DAU_TU | Tổng nghiệm thu | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Hồ sơ tổng nghiệm thu | 0 |
| 52 | KET_THUC_DAU_TU | Quyết toán vốn đầu tư | Chủ đầu tư | Các đơn vị TV, nhà thầu | Hồ sơ quyết toán | 0 |

### 5.2. Template: Thủ tục Dự án Thuê dịch vụ (THUE_DICH_VU)

| TT | Phase | Trình tự công việc | ĐV chủ trì | ĐV hỗ trợ | Kết quả dự kiến | Ngày |
|----|-------|--------------------|-------------|------------|-----------------|------|
| 1 | CHUAN_BI_KH_THUE | Trình xin chủ trương thực hiện kế hoạch thuê | Sở Tài chính | | Tờ trình | 0 |
| 1b | CHUAN_BI_KH_THUE | Phê duyệt chủ trương thực hiện kế hoạch thuê | UBND Tỉnh Hậu Giang | | QĐ/Văn bản chấp thuận chủ trương | 0 |
| 2 | CHUAN_BI_KH_THUE | Lập dự toán giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | Dự toán GĐ chuẩn bị ĐT | 5 |
| 3 | CHUAN_BI_KH_THUE | Phê duyệt dự toán giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | QĐ phê duyệt dự toán - GĐ chuẩn bị ĐT | 1 |
| 4 | CHUAN_BI_KH_THUE | Lập KHLCNT giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | KHLCNT - GĐ chuẩn bị ĐT | 5 |
| 5 | CHUAN_BI_KH_THUE | Phê duyệt KHLCNT giai đoạn chuẩn bị đầu tư | Chủ đầu tư | | QĐ phê duyệt KHLCNT - GĐ chuẩn bị ĐT | 2 |
| 6 | CHUAN_BI_KH_THUE | Chọn lựa nhà thầu TV lập KH thuê, thẩm định giá, TV thẩm tra KH thuê | Chủ đầu tư | Các đơn vị tư vấn | BB thương thảo; QĐ chỉ định thầu; Các HĐ tư vấn | 3 |
| 7 | CHUAN_BI_KH_THUE | Lập kế hoạch thuê | Đơn vị tư vấn | Chủ đầu tư | Hồ sơ kế hoạch thuê | 10 |
| 8 | CHUAN_BI_KH_THUE | Thẩm định giá | Thẩm định giá | Chủ đầu tư | Chứng thư thẩm định giá | 2 |
| 9 | CHUAN_BI_KH_THUE | Thẩm định công nghệ kế hoạch thuê | Sở TT&TT và Sở Tài chính | Chủ đầu tư | | 2 |
| 9b | CHUAN_BI_KH_THUE | Thẩm tra kế hoạch thuê | Đơn vị tư vấn thẩm tra | Chủ đầu tư | Báo cáo thẩm tra kế hoạch thuê | 0 |
| 9c | CHUAN_BI_KH_THUE | Thẩm định công nghệ kế hoạch thuê (lần 2) | Đơn vị đầu mối CNTT | | | 0 |
| 10 | CHUAN_BI_KH_THUE | Trình phê duyệt Hồ sơ kế hoạch thuê | Chủ đầu tư | Đơn vị tư vấn | Hồ sơ KH thuê hoàn chỉnh | 3 |
| 11 | CHUAN_BI_KH_THUE | Phê duyệt Hồ sơ kế hoạch thuê | Cơ quan có thẩm quyền | Chủ đầu tư | QĐ phê duyệt Hồ sơ KH thuê | 0 |
| 12 | THUC_HIEN_DAU_TU | Lập kế hoạch lựa chọn nhà thầu | Chủ đầu tư | | Tờ trình phê duyệt KHLCNT GĐ thực hiện ĐT | 0 |
| 13 | THUC_HIEN_DAU_TU | Phê duyệt kế hoạch lựa chọn nhà thầu | Cơ quan có thẩm quyền | Chủ đầu tư | QĐ phê duyệt KHLCNT | 3 |
| 14 | THUC_HIEN_DAU_TU | Chọn lựa nhà thầu TV QLDA, đấu thầu, TV thẩm định HSMT-KQLCNT | Chủ đầu tư | Các đơn vị tư vấn | BB thương thảo; QĐ chỉ định; Các HĐ tư vấn | 1 |
| 14a | THUC_HIEN_DAU_TU | ↳ Thương thảo | Chủ đầu tư | Các đơn vị tư vấn | | 0 |
| 14b | THUC_HIEN_DAU_TU | ↳ QĐ chỉ định thầu | Chủ đầu tư | Các đơn vị tư vấn | | 0 |
| 14c | THUC_HIEN_DAU_TU | ↳ Hợp đồng | Chủ đầu tư | Các đơn vị tư vấn | | 0 |
| 15 | THUC_HIEN_DAU_TU | Tổ chức lập E-HSMT cho gói thầu thuê (Phi tư vấn) | Đơn vị tư vấn | Chủ đầu tư | E-HSMT (Phi tư vấn, 1 GĐ 2 túi HS) | 5 |
| 16 | THUC_HIEN_DAU_TU | Tổ chức thẩm định E-HSMT | Đơn vị TV thẩm định | | Báo cáo thẩm định | 1 |
| 17 | THUC_HIEN_DAU_TU | Phê duyệt E-HSMT | Chủ đầu tư | | QĐ phê duyệt E-HSMT; E-HSMT chính thức | 0 |
| 19 | THUC_HIEN_DAU_TU | Phát hành E-HSMT | Chủ đầu tư | | E-HSMT | 7 |
| 20 | THUC_HIEN_DAU_TU | Đóng/mở thầu | Đơn vị tư vấn, nhà thầu | Chủ đầu tư | Biên bản đóng/mở thầu | 0 |
| 21 | THUC_HIEN_DAU_TU | Đánh giá E-HSDT | Đơn vị tư vấn | | Báo cáo đánh giá E-HSDT | 3 |
| 22 | THUC_HIEN_DAU_TU | Bàn giao BC Đánh giá E-HSDT | Đơn vị tư vấn | Chủ đầu tư | BC Đánh giá E-HSDT, QĐ, CV, tờ trình | 0 |
| 23 | THUC_HIEN_DAU_TU | Phê duyệt danh sách xếp hạng nhà thầu | Chủ đầu tư | | QĐ phê duyệt DS xếp hạng nhà thầu | 0 |
| 24 | THUC_HIEN_DAU_TU | Mời thương thảo | Chủ đầu tư | Nhà thầu | | 0 |
| 25 | THUC_HIEN_DAU_TU | Thương thảo hợp đồng | Chủ đầu tư, Nhà thầu đạt | | | 1 |
| 26 | THUC_HIEN_DAU_TU | Bàn giao BC đánh giá E-HSDT và BB thương thảo | Chủ đầu tư | Đơn vị TV thẩm định thầu | | 0 |
| 27 | THUC_HIEN_DAU_TU | Tổ chức thẩm định kết quả lựa chọn nhà thầu | Đơn vị TV thẩm định thầu | | BC thẩm định kết quả LCNT | 2 |
| 28 | THUC_HIEN_DAU_TU | Phê duyệt kết quả lựa chọn nhà thầu | Chủ đầu tư | Đơn vị tư vấn | QĐ phê duyệt kết quả LCNT | 1 |
| 29 | THUC_HIEN_DAU_TU | Thông báo | Chủ đầu tư | Đơn vị tư vấn | | 0 |
| 30 | THUC_HIEN_DAU_TU | Đăng tải KQLCNT | Chủ đầu tư | Đơn vị tư vấn | | 0 |
| 31 | THUC_HIEN_DAU_TU | Thương thảo hoàn thiện HĐ, ký kết HĐ và tổ chức triển khai | Chủ đầu tư, Nhà thầu đạt | Đơn vị tư vấn | Hợp đồng | 1 |
| 32 | THUC_HIEN_DAU_TU | Triển khai hợp đồng | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Nhật ký cho thuê | 3 |
| 33 | THUC_HIEN_DAU_TU | Giám sát (nếu có) | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Báo cáo giám sát, nhật ký giám sát | 3 |
| 34 | KET_THUC_DAU_TU | Nghiệm thu khởi tạo dịch vụ - Bắt đầu tính thời gian thuê | CĐT, Nhà thầu, ĐV TV | Đơn vị tư vấn | Hồ sơ nghiệm thu và bàn giao | 1 |

---

## 6. Verification

### 6.1. Database
- Chạy migration → verify 4 bảng được tạo
- Chạy seeder → verify 2 templates + ~86 template steps

### 6.2. API Test
```bash
# Lấy danh sách templates
GET /api/v5/project-procedure-templates → [DAU_TU, THUE_DICH_VU]

# Tạo procedure cho 1 project
POST /api/v5/projects/{id}/procedures
  Body: { template_id: 1 }
  → Clone 52 steps

# Batch update tiến độ
PUT /api/v5/project-procedure-steps/batch
  Body: { steps: [{id:1, progress_status:'HOAN_THANH', document_number:'59/BC-SKHCN', document_date:'2024-05-07'}, ...] }
  → overall_progress tự cập nhật
```

### 6.3. UI Test
1. Mở `?tab=projects` → click icon `checklist` ở 1 dự án
2. Modal mở → chọn template "Đầu tư" → 52 bước hiện ra, chia theo giai đoạn
3. Sửa tiến độ bước 1-8 thành "Hoàn thành" → progress bar cập nhật 15.4%
4. Điền số VB `59/BC-SKHCN` + ngày `07/05/2024` → lưu → reload → verify persist
5. Chuyển sang "Thuê" → 34 bước khác hiện ra
6. Mobile < 768px → card list layout hoạt động tốt
