# PHASE 1 AUDIT — CRC WORKFLOW HARDCODE

**Ngày tạo:** 2026-03-30
**Phạm vi:** Customer Request Management frontend
**Mục tiêu:** Liệt kê các điểm hardcode workflow/status/role/action để chuẩn bị Phase 2 refactor

---

## 1. Kết luận audit

CRC frontend hiện đang **workflow-aware nhưng chưa workflow-native**.

- Backend đã trả transition động theo `workflow_definition_id`.
- Frontend CRC vẫn còn nhiều lớp suy diễn lại transition/status/workspace theo flow cũ.
- Điểm hardcode tập trung nhất nằm ở:
  1. `presentation.ts`
  2. `creatorWorkspace.ts`
  3. `dispatcherWorkspace.ts`
  4. `performerWorkspace.ts`
  5. các component/hook dùng `STATUS_COLOR_MAP`

---

## 2. Danh sách hardcode đã xác định

## 2.1. Transition filtering/alignment

### File
- `frontend/components/customer-request/presentation.ts`
- `frontend/components/CustomerRequestManagementHub.tsx`

### Hardcode chính
- `filterTransitionOptionsForRequest(...)`
- `buildXmlAlignedTransitionOptionsForRequest(...)`
- `PERFORMER_INTAKE_STATUS_CODES`
- `DISPATCHER_INTAKE_STATUS_CODES`
- `DISPATCHER_INTAKE_PM_MISSING_INFO_TARGETS`
- `IN_PROGRESS_XML_TARGET_STATUS_CODES`
- `PM_MISSING_INFO_DECISION_SOURCE_STATUSES`
- synthetic process `pm_missing_customer_info_review`

### Nhận định
Frontend không render nguyên bản `allowed_next_processes` từ backend mà còn lọc/biến đổi theo lane và XML flow cũ.

### Tác động
- workflow đổi transition nhưng UI có thể không hiện đúng
- backend cho phép nhưng user không bấm được trên UI
- thêm status/nhánh mới sẽ dễ bị ẩn khỏi dropdown/action list

---

## 2.2. Intake lane inference

### File
- `frontend/components/customer-request/presentation.ts`

### Hardcode chính
- `resolveRequestIntakeLane(...)`
- các assumption theo `dispatch_route`:
  - `self_handle`
  - `assign_direct`
  - `assign_pm`
- fallback từ field cứng như `performer_user_id`, `dispatcher_user_id`

### Nhận định
Frontend đang tự diễn giải lane xử lý tại `new_intake` thay vì đọc capability/assignment metadata hoàn chỉnh từ backend.

### Tác động
- workflow mới có lane khác sẽ không tự thích nghi
- UI creator/dispatcher/performer dễ bucket sai ở giai đoạn đầu

---

## 2.3. Status normalization và hidden runtime alias

### File
- `frontend/components/customer-request/presentation.ts`

### Hardcode chính
- `RUNTIME_ONLY_XML_HIDDEN_STATUS_CODES = new Set(['dispatched'])`
- `STATUS_UI_ALIAS_MAP = { dispatched: 'new_intake' }`
- `normalizeStatusCodeForXmlUi(...)`
- `filterXmlVisibleProcesses(...)`

### Nhận định
Frontend đang duy trì cơ chế alias/ẩn status runtime theo cách trình bày XML cũ.

### Tác động
- status runtime mới cần alias sẽ phải vá thêm ở nhiều nơi
- nguy cơ UI hiển thị sai semantics với workflow mới

---

## 2.4. Workspace bucketing theo status cứng

### File
- `frontend/components/customer-request/creatorWorkspace.ts`
- `frontend/components/customer-request/dispatcherWorkspace.ts`
- `frontend/components/customer-request/performerWorkspace.ts`

### Hardcode chính
#### Creator workspace
- `waiting_customer_feedback` → `reviewRows`
- `completed` → `notifyRows`
- `customer_notified`, `not_executed` → `closedRows`
- nhóm follow-up cứng gồm:
  - `new_intake`
  - `dispatched`
  - `analysis`
  - `in_progress`
  - `returned_to_manager`
  - `coding`
  - `dms_transfer`
  - `dms_task_created`

#### Dispatcher workspace
- `returned_to_manager` → `returnedRows`
- `waiting_customer_feedback` → `feedbackRows`
- `completed` → `approvalRows`
- `new_intake` + lane → queue/active
- `dispatched` → active legacy
- `analysis`, `in_progress`, `coding`, `dms_transfer` → active/queue tùy performer
- `ACTIVE_WORKLOAD_STATUSES` set cố định

#### Performer workspace
- `ACTIVE_STATUSES = {'in_progress','analysis','coding','dms_transfer','dms_task_created'}`
- `CLOSED_STATUSES = {'completed','customer_notified','not_executed'}`
- `PENDING_STATUS_PRIORITY` map cố định

### Nhận định
Ba workspace vẫn chủ yếu được suy diễn theo status code cứng thay vì capability/ownership metadata.

### Tác động
- status mới dễ làm case rơi sai tab hoặc mất khỏi workspace
- đổi meaning của status sẽ kéo theo sai badge count, sort priority, work queue

---

## 2.5. Status label/color/group map tĩnh

### File
- `frontend/components/customer-request/presentation.ts`
- nhiều component dùng lại map này

### Hardcode chính
- `STATUS_COLOR_MAP`
- `LIST_KPI_STATUSES`
- `ATTENTION_REASON_META`
- `WARNING_LEVEL_META`
- `SLA_STATUS_META`

### Điểm dùng nhiều
- `CustomerRequestDetailPane.tsx`
- `CustomerRequestTransitionModal.tsx`
- `CustomerRequestQuickActionModal.tsx`
- `CustomerRequestFullDetail.tsx`
- `CustomerRequestPlanBacklog.tsx`
- `CustomerRequestPlanMonthly.tsx`
- `CustomerRequestSearchBar.tsx`
- `useCustomerRequestTransition.ts`

### Nhận định
Status presentation hiện là frontend-owned metadata, không phải workflow/backend-owned metadata.

### Tác động
- status mới sẽ không có label/màu đúng nếu không sửa code
- rất nhiều màn bị ảnh hưởng cùng lúc vì cùng phụ thuộc `STATUS_COLOR_MAP`

---

## 2.6. Quick action / action visibility phụ thuộc status semantics cũ

### File
- `frontend/components/customer-request/CustomerRequestDetailPane.tsx`
- `frontend/components/customer-request/CustomerRequestQuickActionModal.tsx`
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`

### Hardcode chính
- CTA label đặc biệt cho `pm_missing_customer_info_review`
- thông báo success transition lấy label từ `STATUS_COLOR_MAP`
- nhiều action UI vẫn bám status semantics cũ thay vì metadata action thống nhất

### Nhận định
Action rendering đã có dùng `available_actions`, nhưng phần status/action wording vẫn còn phụ thuộc map cũ.

### Tác động
- transition mới có thể chạy được nhưng UI label/hint/modal chưa đúng ngữ nghĩa

---

## 2.7. API shape workaround

### File
- `frontend/components/customer-request/hooks/useCustomerRequestList.ts`

### Hardcode chính
- tự patch `receiver_name` từ `process_row.data` / `status_row.data`

### Nhận định
Đây không phải workflow hardcode trực tiếp, nhưng là dấu hiệu response contract chưa đủ ổn định, khiến frontend phải tự vá dữ liệu.

### Tác động
- làm tăng coupling giữa UI và shape runtime của CRC
- bất lợi cho Phase 2/3 khi cần adapter sạch hơn

---

## 3. Mapping logic cũ → metadata nên thay thế

| Logic cũ | Hiện đang ở đâu | Nên thay bằng gì |
|---|---|---|
| Filter transition theo status/lane | `presentation.ts` | `allowed_next_processes` + transition display metadata từ backend |
| Suy diễn intake lane từ `dispatch_route` | `presentation.ts` | actor/capability/ownership metadata từ case detail |
| Alias/hide status runtime | `presentation.ts` | status display metadata có `display_code`, `is_hidden_in_ui`, `display_order` |
| Chia workspace theo status set | `creator/dispatcher/performerWorkspace.ts` | workspace/ownership hints hoặc capability group từ backend |
| Label/màu status | `STATUS_COLOR_MAP` | status metadata adapter với dữ liệu backend + fallback local |
| Quick action wording theo status cũ | detail/modal/hook | transition label + capability/action metadata |
| Patch receiver_name từ nhiều shape | `useCustomerRequestList.ts` | API list trả field chuẩn hóa sẵn |

---

## 4. Metadata backend còn thiếu hoặc nên chuẩn hóa thêm

## Ưu tiên cao
- `transition_label`
- `transition_display_order`
- `status_label`
- `status_color` hoặc status tone key
- `status_group_code`
- `status_group_label`
- `workspace_hint` hoặc `primary_owner_role`
- `available_actions` nhất quán hơn giữa list/detail

## Ưu tiên trung bình
- `display_status_code` (nếu cần alias UI)
- `is_hidden_in_ui`
- `intake_lane` hoặc metadata ownership ở trạng thái đầu
- `receiver_name` / `current_handler_name` chuẩn hóa sẵn trong list payload

---

## 5. Ưu tiên refactor Phase 2

### P1
1. `presentation.ts` — transition filter/alignment
2. `CustomerRequestManagementHub.tsx` — nơi gọi `buildXmlAlignedTransitionOptionsForRequest(...)`
3. `useCustomerRequestTransition.ts` — chuẩn hóa success label / modal payload metadata

### P2
4. `STATUS_COLOR_MAP` consumer chain
5. `CustomerRequestDetailPane.tsx`
6. `CustomerRequestTransitionModal.tsx`

### P3
7. `creatorWorkspace.ts`
8. `dispatcherWorkspace.ts`
9. `performerWorkspace.ts`

---

## 6. Test đã chạy trong Phase 1

### Frontend test
- File: `frontend/__tests__/crc-status-v4.test.ts`
- Kết quả: **31 tests passed**

### Ý nghĩa
- bộ test hiện tại đang khóa lại đúng chính các rule hardcode ở `presentation.ts`
- khi sang Phase 2/3 cần cập nhật test để phản ánh hành vi workflow-driven mới
- không nên xem bộ test hiện tại là bằng chứng rằng CRC đã dynamic hoàn toàn

---

## 7. Kết luận để chuyển Phase 2

Phase 1 đã xác định rõ:
- vùng hardcode trọng tâm
- mapping logic cũ sang metadata mới
- các field backend nên bổ sung
- thứ tự ưu tiên refactor tiếp theo

Đề xuất chuyển sang Phase 2 với mục tiêu đầu tiên:
**thay lớp `buildXmlAlignedTransitionOptionsForRequest(...)` bằng adapter transition metadata bám backend hơn, có fallback tạm thời để tránh vỡ UI.**
