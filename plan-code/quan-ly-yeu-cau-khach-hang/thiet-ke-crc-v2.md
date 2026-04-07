# Thiết kế module: Quản lý yêu cầu khách hàng V2 (CRC V2)

Ngày tạo: 2026-04-06

---

## 1) Tổng quan

Module CRC V2 quản lý yêu cầu khách hàng theo luồng mới (workflowa.xlsx), hoàn toàn độc lập với CRC V1 hiện tại.

**Nguyên tắc thiết kế:**
- Không migrate dữ liệu từ CRC V1.
- Menu riêng: "Quản lý yêu cầu khách hàng v2".
- Actor model đơn giản: A (PM), R (Performer), C/I (stakeholder xem).
- Mỗi status có bảng payload riêng với trường tối giản.

---

## 2) Actor model & Permission

| Vai trò RACI | Mapping hệ thống | Permission scope |
|---|---|---|
| **A (Accountable)** | PM (`dispatcher_user_id`) | `crc_v2.write`, `crc_v2.transition`, `crc_v2.assign` |
| **R (Responsible)** | Performer (`performer_user_id`) | `crc_v2.write`, `crc_v2.worklog`, `crc_v2.transition` |
| **C (Consulted)** | Stakeholder | `crc_v2.read` (xem danh sách + chi tiết) |
| **I (Informed)** | Stakeholder | `crc_v2.read` (xem danh sách + chi tiết) |

**Quyền chi tiết:**

| Action | A (PM) | R (Performer) | C/I |
|---|---|---|---|
| Xem danh sách | ✓ | ✓ | ✓ |
| Xem chi tiết | ✓ | ✓ | ✓ |
| Tạo yêu cầu | ✓ | ✓ | ✗ |
| Chuyển trạng thái (intake group) | ✓ | ✗ | ✗ |
| Assign performer | ✓ | ✗ | ✗ |
| Chuyển trạng thái (processing) | ✓ | ✓ | ✗ |
| Ghi worklog | ✓ | ✓ | ✗ |
| Update estimate | ✓ | ✓ | ✗ |
| Đóng case (completed) | ✓ | ✓ | ✗ |
| Thông báo KH | ✓ | ✓ | ✗ |

---

## 3) Status Catalog

| STT | Code | Label | Group | Bảng payload |
|---:|---|---|---|---|
| 1 | `intake` | Tiếp nhận | intake | `workflow_intakes` |
| 2 | `assigned_performer` | Giao R thực hiện | intake | `workflow_assigned_performers` |
| 3 | `in_progress` | R Đang thực hiện | processing | `workflow_in_progress` |
| 4 | `waiting_customer` | Chờ KH cung cấp TT | intake | `workflow_waiting_customers` |
| 5 | `not_accepted` | Không tiếp nhận | closure | `workflow_not_accepted` |
| 6 | `analysis` | Chuyển BA phân tích | analysis | `workflow_analysis` |
| 7 | `analysis_suspended` | BA tạm ngưng | analysis | `workflow_analysis_suspended` |
| 8 | `analysis_completed` | BA hoàn thành | analysis | `workflow_analysis_completed` |
| 9 | `coding` | Lập trình | coding | `workflow_coding` |
| 10 | `coding_suspended` | Dev tạm ngưng | coding | `workflow_coding_suspended` |
| 11 | `coding_completed` | Dev hoàn thành | coding | `workflow_coding_completed` |
| 12 | `dms` | Chuyển DMS | dms | `workflow_dms` |
| 13 | `dms_suspended` | DMS tạm ngưng | dms | `workflow_dms_suspended` |
| 14 | `dms_completed` | DMS hoàn thành | dms | `workflow_dms_completed` |
| 15 | `completed` | Hoàn thành | closure | `workflow_completed` |
| 16 | `customer_notified` | Thông báo KH | closure | `workflow_customer_notified` |

---

## 4) Database Schema

### 4.1 Bảng master

#### `workflow_cases`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | PK |
| `request_code` | VARCHAR(32) | NO | | CRC2-YYYYMM-NNNN |
| `title` | VARCHAR(255) | NO | | Tiêu đề yêu cầu |
| `customer_id` | BIGINT UNSIGNED | YES | | FK customers |
| `customer_name` | VARCHAR(255) | YES | | Snapshot |
| `project_id` | BIGINT UNSIGNED | YES | | FK projects |
| `product_id` | BIGINT UNSIGNED | YES | | FK products |
| `priority` | TINYINT | NO | 2 | 1=Critical,2=High,3=Medium,4=Low |
| `source_channel` | VARCHAR(64) | YES | | Email/Phone/Portal/... |
| `received_by_user_id` | BIGINT UNSIGNED | NO | | Người tiếp nhận (Creator) |
| `received_at` | DATETIME | NO | | Thời điểm tiếp nhận |
| `dispatcher_user_id` | BIGINT UNSIGNED | YES | | PM (A) |
| `performer_user_id` | BIGINT UNSIGNED | YES | | Performer (R) |
| `current_status_code` | VARCHAR(64) | NO | | Status code hiện tại |
| `current_status_instance_id` | BIGINT UNSIGNED | YES | | FK → status_instances |
| `estimated_hours` | DECIMAL(10,2) | YES | | Tổng estimate |
| `total_hours_spent` | DECIMAL(10,2) | NO | 0 | Tổng giờ thực tế |
| `extended_at` | DATETIME | YES | | Ngày gia hạn gần nhất |
| `completed_at` | DATETIME | YES | | Ngày hoàn thành |
| `created_by` | BIGINT UNSIGNED | NO | | User tạo |
| `updated_by` | BIGINT UNSIGNED | NO | | User cập nhật |
| `created_at` | DATETIME | NO | | |
| `updated_at` | DATETIME | NO | | |

**Indexes:**
- `PRIMARY KEY (id)`
- `UNIQUE KEY (request_code)`
- `KEY (current_status_code)`
- `KEY (dispatcher_user_id)`
- `KEY (performer_user_id)`
- `KEY (customer_id)`
- `KEY (created_at)`

---

### 4.2 Bảng status instances

#### `workflow_status_instances`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | PK |
| `request_case_id` | BIGINT UNSIGNED | NO | | FK → workflow_cases |
| `status_code` | VARCHAR(64) | NO | | |
| `status_table` | VARCHAR(128) | NO | | Bảng payload |
| `status_row_id` | BIGINT UNSIGNED | NO | | ID row bảng payload |
| `previous_instance_id` | BIGINT UNSIGNED | YES | | FK → self (linked list) |
| `next_instance_id` | BIGINT UNSIGNED | YES | | FK → self |
| `is_current` | TINYINT(1) | NO | 0 | Cờ current |
| `entered_at` | DATETIME | NO | | Thời điểm vào status |
| `exited_at` | DATETIME | YES | | Thời điểm thoát status |
| `created_by` | BIGINT UNSIGNED | NO | | |
| `created_at` | DATETIME | NO | | |

**Indexes:**
- `PRIMARY KEY (id)`
- `KEY (request_case_id, is_current)`
- `KEY (status_code)`

---

### 4.3 Bảng catalog & transitions

#### `workflow_status_catalogs`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | PK |
| `status_code` | VARCHAR(64) | NO | | Unique |
| `status_label_vi` | VARCHAR(255) | NO | | |
| `group_code` | VARCHAR(64) | NO | | intake/processing/... |
| `group_label_vi` | VARCHAR(255) | NO | | |
| `table_name` | VARCHAR(128) | NO | | Bảng payload |
| `is_active` | TINYINT(1) | NO | 1 | |
| `created_at` | DATETIME | NO | | |

#### `workflow_status_transitions`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | PK |
| `from_status_code` | VARCHAR(64) | NO | | |
| `to_status_code` | VARCHAR(64) | NO | | |
| `direction` | ENUM | NO | 'forward' | forward/backward |
| `is_default` | TINYINT(1) | NO | 0 | Default route |
| `sort_order` | INT | NO | 0 | |
| `actor_role` | VARCHAR(16) | YES | | A/R/C/I |
| `created_at` | DATETIME | NO | | |

**Indexes:**
- `PRIMARY KEY (id)`
- `KEY (from_status_code, sort_order)`
- `UNIQUE KEY (from_status_code, to_status_code)`

---

### 4.4 Bảng payload (tất cả cùng schema cốt lõi)

Mỗi bảng payload có cấu trúc tối giản:

```sql
CREATE TABLE workflow_<status_name> (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_case_id BIGINT UNSIGNED NOT NULL,
    status_instance_id BIGINT UNSIGNED NOT NULL,
    progress_percent TINYINT UNSIGNED DEFAULT 0,
    received_at DATETIME DEFAULT NULL,
    extended_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_by BIGINT UNSIGNED DEFAULT NULL,
    updated_by BIGINT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY (request_case_id),
    KEY (status_instance_id),
    CONSTRAINT fk_<status>_case FOREIGN KEY (request_case_id) REFERENCES workflow_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_<status>_instance FOREIGN KEY (status_instance_id) REFERENCES workflow_status_instances(id) ON DELETE CASCADE
);
```

**Danh sách bảng payload cần tạo:**

| STT | Bảng | Field đặc thù (ngoài core 8 field) |
|---:|---|---|
| 1 | `workflow_intakes` | `source_channel_detail`, `requester_name`, `requester_contact` |
| 2 | `workflow_assigned_performers` | `performer_user_id`, `assigned_by_user_id`, `assigned_at` |
| 3 | `workflow_in_progress` | `performer_user_id`, `started_at` |
| 4 | `workflow_waiting_customers` | `feedback_request_content`, `feedback_requested_at`, `customer_due_at`, `customer_feedback_at`, `customer_feedback_content` |
| 5 | `workflow_not_accepted` | `decision_by_user_id`, `decision_at`, `decision_reason` |
| 6 | `workflow_analysis` | `analyst_user_id`, `analysis_content`, `started_at` |
| 7 | `workflow_analysis_suspended` | `analyst_user_id`, `suspend_reason`, `suspended_at` |
| 8 | `workflow_analysis_completed` | `analyst_user_id`, `analysis_result`, `completed_at` |
| 9 | `workflow_coding` | `developer_user_id`, `coding_content`, `coding_started_at`, `upcode_version`, `upcode_environment` |
| 10 | `workflow_coding_suspended` | `developer_user_id`, `suspend_reason`, `suspended_at` |
| 11 | `workflow_coding_completed` | `developer_user_id`, `coding_result`, `completed_at` |
| 12 | `workflow_dms` | `dms_contact_user_id`, `exchange_content`, `started_at` |
| 13 | `workflow_dms_suspended` | `dms_contact_user_id`, `suspend_reason`, `suspended_at` |
| 14 | `workflow_dms_completed` | `dms_contact_user_id`, `task_ref`, `task_url`, `completed_at` |
| 15 | `workflow_completed` | `completed_by_user_id`, `result_content`, `completed_at` |
| 16 | `workflow_customer_notified` | `notified_by_user_id`, `notification_channel`, `notification_content`, `customer_feedback`, `notified_at` |

---

### 4.5 Bảng worklog & estimate

#### `workflow_worklogs`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | |
| `request_case_id` | BIGINT UNSIGNED | NO | | FK |
| `status_instance_id` | BIGINT UNSIGNED | YES | | FK |
| `user_id` | BIGINT UNSIGNED | NO | | |
| `activity_type` | VARCHAR(64) | NO | | analysis/coding/dms/... |
| `work_date` | DATE | NO | | |
| `started_at` | TIME | YES | | |
| `ended_at` | TIME | YES | | |
| `hours_spent` | DECIMAL(10,2) | NO | | |
| `is_billable` | TINYINT(1) | NO | 1 | |
| `description` | TEXT | YES | | |
| `created_by` | BIGINT UNSIGNED | NO | | |
| `created_at` | DATETIME | NO | | |

#### `workflow_estimates`
| Column | Type | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI | |
| `request_case_id` | BIGINT UNSIGNED | NO | | FK |
| `status_instance_id` | BIGINT UNSIGNED | YES | | FK |
| `estimated_hours` | DECIMAL(10,2) | NO | | |
| `estimate_type` | VARCHAR(64) | NO | | creator_initial/pm_revision/... |
| `estimate_scope` | VARCHAR(64) | NO | | total/phase/... |
| `note` | TEXT | YES | | |
| `estimated_by_user_id` | BIGINT UNSIGNED | NO | | |
| `created_at` | DATETIME | NO | | |

---

### 4.6 Bảng hỗ trợ (optional)

#### `workflow_status_attachments`
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI |
| `request_case_id` | BIGINT UNSIGNED | NO | |
| `status_instance_id` | BIGINT UNSIGNED | YES | |
| `attachment_id` | BIGINT UNSIGNED | NO | |
| `created_by` | BIGINT UNSIGNED | NO | |
| `created_at` | DATETIME | NO | |

#### `workflow_status_ref_tasks`
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | AI |
| `request_case_id` | BIGINT UNSIGNED | NO | |
| `status_instance_id` | BIGINT UNSIGNED | YES | |
| `ref_task_id` | BIGINT UNSIGNED | NO | |
| `created_by` | BIGINT UNSIGNED | NO | |
| `created_at` | DATETIME | NO | |

---

## 5) Transition Rules (theo workflowa.xlsx)

```
intake
  → assigned_performer (A)
  → not_accepted (A)
  → waiting_customer (A)
  → analysis (A)
  → coding (A)
  → dms (A)
  → in_progress (A)
  → completed (A)

assigned_performer
  → in_progress (R)
  → not_accepted (R)
  → analysis (R)
  → coding (R)
  → dms (R)
  → completed (R)

in_progress
  → completed (R)
  → not_accepted (R/A)
  → waiting_customer (R/A)

waiting_customer
  → assigned_performer (A)
  → in_progress (R)
  → not_accepted (A)

analysis
  → analysis_completed (R)
  → analysis_suspended (R)
  → not_accepted (A)

analysis_suspended
  → analysis (R)
  → analysis_completed (R)
  → not_accepted (A)

analysis_completed
  → coding (A)
  → dms (A)
  → in_progress (A)
  → not_accepted (A)

coding
  → coding_completed (R)
  → coding_suspended (R)
  → not_accepted (A)

coding_suspended
  → coding (R)
  → coding_completed (R)
  → not_accepted (A)

coding_completed
  → completed (A)
  → dms (A)
  → not_accepted (A)

dms
  → dms_completed (R)
  → dms_suspended (R)
  → not_accepted (A)

dms_suspended
  → dms (R)
  → dms_completed (R)
  → not_accepted (A)

dms_completed
  → completed (A)
  → not_accepted (A)

completed
  → customer_notified (A/R)
  → not_accepted (A)

not_accepted
  → customer_notified (A)
  → assigned_performer (A)

customer_notified
  → assigned_performer (A)  [reopen]
```

---

## 6) Frontend Architecture

### 6.1 Component tree
```
WorkflowV2Hub.tsx (root)
├── WorkflowV2List.tsx (danh sách theo filter)
├── WorkflowV2DetailPane.tsx (chi tiết bên phải)
│   ├── WorkflowV2IntakeWorkspace.tsx
│   ├── WorkflowV2DispatcherWorkspace.tsx
│   ├── WorkflowV2PerformerWorkspace.tsx
│   └── WorkflowV2TransitionModal.tsx
├── WorkflowV2Dashboard.tsx (KPI theo role)
└── WorkflowV2CreateModal.tsx
```

### 6.2 API endpoints (`/api/v5/workflow-v2/`)
```
GET    /cases                    # List (paginated)
POST   /cases                    # Create
GET    /cases/{id}               # Detail
POST   /cases/{id}/transition    # Transition
POST   /cases/{id}/worklog       # Create worklog
POST   /cases/{id}/estimate      # Create estimate
GET    /cases/{id}/timeline      # Timeline
GET    /dashboard                # Dashboard KPI
GET    /status-catalog           # Status catalog
GET    /transitions              # Allowed transitions
```

### 6.3 Phác thảo giao diện (để review nghiệp vụ)

#### 6.3.1 Màn hình danh sách `WorkflowV2List`

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Quản lý yêu cầu khách hàng v2                                                     [+ Tạo yêu cầu mới]     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bộ lọc: [Từ ngày] [Đến ngày] [Trạng thái v] [Ưu tiên v] [PM v] [Performer v] [Tìm mã/tên......] [Lọc]   │
├────┬──────────────┬───────────────────────────────┬────────────────────┬──────────┬──────────┬─────────────┤
│STT │ Mã yêu cầu   │ Tiêu đề                        │ Trạng thái hiện tại │ PM (A)   │ R        │ Cập nhật     │
├────┼──────────────┼───────────────────────────────┼────────────────────┼──────────┼──────────┼─────────────┤
│ 1  │ CRC2-202604… │ Lỗi đồng bộ hóa công nợ       │ Giao R thực hiện     │ PM Lan   │ Huy      │ 06/04 10:30  │
│ 2  │ CRC2-202604… │ KH yêu cầu chỉnh mẫu báo cáo  │ Chờ KH cung cấp TT   │ PM Lan   │ Trâm     │ 06/04 09:10  │
│ 3  │ CRC2-202604… │ Điều chỉnh luồng phê duyệt    │ Lập trình            │ PM Minh  │ Khánh    │ 05/04 17:05  │
└────┴──────────────┴───────────────────────────────┴────────────────────┴──────────┴──────────┴─────────────┘

Right panel khi chọn 1 dòng:
- Header: Mã yêu cầu + trạng thái + chip ưu tiên
- Tab: [Chi tiết] [Timeline] [Worklog] [Estimate]
- Nút hành động theo quyền: [Chuyển trạng thái] [Ghi worklog] [Cập nhật estimate]
```

#### 6.3.2 Màn hình thêm mới `WorkflowV2CreateModal`

```text
┌──────────────────────────────────────── Tạo yêu cầu mới (CRC V2) ────────────────────────────────────────┐
│ Thông tin chung                                                                                           │
│ [Tiêu đề yêu cầu.........................................................]                                │
│ [Khách hàng v] [Dự án v] [Sản phẩm v] [Độ ưu tiên v]                                                      │
│ [Kênh tiếp nhận v] [Ngày nhận dd/mm/yyyy hh:mm]                                                           │
│ [PM (A) v] [Người thực hiện (R) v]                                                                        │
│ [Mô tả chi tiết....................................................................................]      │
│                                                                                                            │
│ Thiết lập trạng thái đầu                                                                                  │
│ (•) Tiếp nhận   ( ) Giao R thực hiện   ( ) Giao PM/Trả YC cho PM                                         │
│                                                                                                            │
│ Field chuẩn chuyển trạng thái đầu:                                                                        │
│ [Tiến độ %] [Ngày nhận] [Ngày gia hạn] [Ngày hoàn thành]                                                 │
│ [Ghi chú.............................................................................................]    │
│                                                                                                            │
│                                               [Hủy] [Lưu nháp] [Tạo yêu cầu]                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 6.3.3 Màn hình chỉnh sửa/chi tiết `WorkflowV2DetailPane`

```text
┌─ CRC2-202604-0012 ─ Điều chỉnh luồng phê duyệt ─ [Lập trình] ─ [PM Lan] [R Khánh] ─────────────────────┐
│ [Chi tiết] [Timeline] [Worklog] [Estimate] [Đính kèm]                                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bước hiện tại: Lập trình                                                                                  │
│ Allowed transitions: [Dev đang thực hiện] [Dev tạm ngưng] [Giao PM/Trả YC cho PM]                        │
│                                                                                                            │
│ Form cập nhật trạng thái (áp dụng chung mọi transition):                                                  │
│ - Tiến độ (%):        [ 65 ]                                                                              │
│ - Ngày nhận:          [ 06/04/2026 08:30 ]                                                                │
│ - Ngày gia hạn:       [ 08/04/2026 17:30 ]                                                                │
│ - Ngày hoàn thành:    [                    ]                                                              │
│ - Ghi chú:            [ Đã xử lý phần API, còn UI + test regression ]                                    │
│                                                                                                            │
│ [Lưu chỉnh sửa] [Chuyển trạng thái]                                                                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Timeline mẫu:
- 06/04 08:30  PM Lan: Tiếp nhận -> Giao R thực hiện
- 06/04 09:10  Khánh : Giao R thực hiện -> Lập trình
- 06/04 10:05  Khánh : cập nhật tiến độ 65%, gia hạn 08/04
```

#### 6.3.4 Màn hình chuyển trạng thái nhanh `WorkflowV2TransitionModal`

```text
┌──────────────────── Chuyển trạng thái ────────────────────┐
│ Từ: Lập trình   ->   Đến: Dev tạm ngưng                   │
│                                                            │
│ Tiến độ (%)      [ 65 ]                                    │
│ Ngày nhận        [ 06/04/2026 08:30 ]                     │
│ Ngày gia hạn     [ 08/04/2026 17:30 ]                     │
│ Ngày hoàn thành  [                    ]                   │
│ Ghi chú          [ Chờ phản hồi API từ hệ thống ngoài ]   │
│                                                            │
│                                        [Hủy] [Xác nhận]   │
└────────────────────────────────────────────────────────────┘
```

### 6.4 Quy ước UI cần chốt trước khi code

- Danh sách dùng layout 2 cột: trái là bảng, phải là detail pane.
- Toàn bộ transition dùng chung 5 field chuẩn: `progress_percent`, `received_at`, `extended_at`, `completed_at`, `notes`.
- Với C/I: ẩn toàn bộ nút mutate (`Tạo`, `Chuyển trạng thái`, `Lưu chỉnh sửa`, `Worklog`, `Estimate`).
- Status badge dùng màu theo group (`intake`, `analysis`, `coding`, `dms`, `closure`) để dễ scan.

---

## 7) Implementation Checklist

### Phase 1: Database & Backend Core (Tuần 1-2)
- [ ] Migration tạo 20+ bảng
- [ ] Model classes (WorkflowCase, WorkflowStatusInstance, ...)
- [ ] WorkflowV2Controller + routes
- [ ] WorkflowV2WriteService (create, transition)
- [ ] WorkflowV2ReadQueryService (list, detail)
- [ ] Status catalog seeder

### Phase 2: Frontend Core (Tuần 3-4)
- [ ] WorkflowV2Hub.tsx
- [ ] WorkflowV2List.tsx
- [ ] WorkflowV2DetailPane.tsx
- [ ] WorkflowV2CreateModal.tsx
- [ ] WorkflowV2TransitionModal.tsx
- [ ] Permission integration

### Phase 3: Dashboard & Report (Tuần 5)
- [ ] WorkflowV2Dashboard.tsx
- [ ] KPI metrics (theo role)
- [ ] Export functionality

### Phase 4: Testing & Go-live (Tuần 6)
- [ ] Unit tests (backend)
- [ ] E2E tests (frontend)
- [ ] UAT với user
- [ ] Deploy production

---

## 8) File migration mẫu

File migration đầu tiên sẽ tạo:
1. `workflow_cases`
2. `workflow_status_instances`
3. `workflow_status_catalogs`
4. `workflow_status_transitions`

Các bảng payload sẽ tạo ở migration riêng để dễ review.
