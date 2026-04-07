# Kế hoạch điều chỉnh module Quản lý yêu cầu khách hàng hiện tại

Ngày tạo: 2026-04-06

Phạm vi: điều chỉnh trực tiếp module `/customer-request-management` đang chạy (không tạo module mới CRC V2).

---

## 1) Mục tiêu

1. **Áp dụng workflow từ `workflowa.xlsx`** vào luồng xử lý thực tế của module hiện tại.
2. **Chuẩn hóa toàn bộ form trạng thái** chỉ còn 7 trường dùng chung cho mọi status:
   - `received_at` — Ngày bắt đầu
   - `completed_at` — Ngày kết thúc
   - `extended_at` — Ngày gia hạn
   - `notes` — Ghi chú
   - `progress_percent` — Tiến độ phần trăm
   - `from_user_id` — Người chuyển
   - `to_user_id` — Người nhận

3. **Không làm workflow selector** — làm cứng (hardcode) vào code.

---

## 2) Hiện trạng (trước điều chỉnh)

| Khía cạnh | Trạng thái hiện tại |
|---|---|
| **Trạng thái mở đầu khi tạo** | Luôn là `new_intake` (hardcode trong `CustomerRequestCaseWriteService::store`) |
| **Danh sách transition hợp lệ** | Đọc từ bảng `customer_request_status_transitions` + logic lane trong write service |
| **Form hiển thị theo status** | Mỗi status có `form_fields` khác nhau từ `CustomerRequestCaseRegistry` |
| **UI transition modal** | Render động theo `transitionProcessMeta.form_fields` |
| **Permission transition** | Kiểm tra `canWriteCase` + scope, không check `actor_role` per-transition |

### 2.1) Phạm vi form cố định sau điều chỉnh (không dynamic)

#### A. Nhóm thông tin yêu cầu (giữ nguyên, không dynamic)
- `project_item_id` — Khách hàng | Dự án | Sản phẩm
- `summary` — Nội dung yêu cầu
- `customer_id` — Khách hàng
- `customer_personnel_id` — Người yêu cầu
- `support_service_group_id` — Kênh tiếp nhận
- `source_channel` — Kênh khác
- `priority` — Độ ưu tiên
- `description` — Mô tả chi tiết
- `project_id` — Dự án (ẩn, auto map)
- `product_id` — Sản phẩm (ẩn, auto map)

#### B. Nhóm trạng thái/chuyển trạng thái (cố định, không dynamic)
- `received_at` — Ngày bắt đầu
- `completed_at` — Ngày kết thúc
- `extended_at` — Ngày gia hạn
- `notes` — Ghi chú
- `progress_percent` — Tiến độ phần trăm
- `from_user_id` — Người chuyển
- `to_user_id` — Người nhận

---

## 3) Mapping Workflow A → Status code hiện tại

| STT | Quy trình (workflowa) | Tác nhân | Task hiện tại | Task tiếp theo | `from_status_code` (đề xuất) | `to_status_code` (đề xuất) |
|---:|---|---|---|---|---|---|
| 1 | Bắt đầu | Tất cả | Tiếp nhận | Giao R thực hiện | `new_intake` | `assigned_performer` |
| 2 | Bắt đầu | Tất cả | Tiếp nhận | Giao PM/Trả YC cho PM | `new_intake` | `pending_dispatch` |
| 3 | — | R | Giao R thực hiện | R Đang thực hiện | `assigned_performer` | `in_progress` |
| 4 | — | R | Giao R thực hiện | Giao PM/Trả YC cho PM | `assigned_performer` | `pending_dispatch` |
| 5 | — | A | Giao PM/Trả YC cho PM | Không tiếp nhận | `pending_dispatch` | `not_executed` |
| 6 | — | A | Giao PM/Trả YC cho PM | Chờ khách hàng cung cấp thông tin | `pending_dispatch` | `waiting_customer_feedback` |
| 7 | — | A | Giao PM/Trả YC cho PM | Giao R thực hiện | `pending_dispatch` | `assigned_performer` |
| 8 | — | A | Giao PM/Trả YC cho PM | Chuyển BA Phân tích | `pending_dispatch` | `analysis` |
| 9 | — | A | Giao PM/Trả YC cho PM | Chuyển DMS | `pending_dispatch` | `dms_transfer` |
| 10 | — | A | Giao PM/Trả YC cho PM | Lập trình | `pending_dispatch` | `coding` |
| 11 | — | A | Giao PM/Trả YC cho PM | Hoàn thành | `pending_dispatch` | `completed` |
| 12 | — | A | Hoàn thành | Giao R thực hiện | `completed` | `assigned_performer` |
| 13 | — | Tất cả | Hoàn thành | Giao PM/Trả YC cho PM | `completed` | `pending_dispatch` |
| 14 | — | Tất cả | Hoàn thành | Thông báo khách hàng | `completed` | `customer_notified` |
| 15 | — | R | R Đang thực hiện | Hoàn thành | `in_progress` | `completed` |
| 16 | — | R | R Đang thực hiện | Giao PM/Trả YC cho PM | `in_progress` | `pending_dispatch` |
| 17 | — | Tất cả | Không tiếp nhận | Thông báo khách hàng | `not_executed` | `customer_notified` |
| 18 | — | Tất cả | Không tiếp nhận | Giao PM/Trả YC cho PM | `not_executed` | `pending_dispatch` |
| 19 | — | Tất cả | Chờ khách hàng cung cấp thông tin | Giao R thực hiện | `waiting_customer_feedback` | `assigned_performer` |
| 20 | — | Tất cả | Chờ khách hàng cung cấp thông tin | Giao PM/Trả YC cho PM | `waiting_customer_feedback` | `pending_dispatch` |
| 21 | — | R | Chuyển BA Phân tích | Chuyển BA Phân tích hoàn thành | `analysis` | `analysis_completed` |
| 22 | — | R | Chuyển BA Phân tích | Chuyển BA Phân tích tạm ngưng | `analysis` | `analysis_suspended` |
| 23 | — | R | Chuyển BA Phân tích | Giao PM/Trả YC cho PM | `analysis` | `pending_dispatch` |
| 24 | — | Tất cả | Chuyển BA Phân tích hoàn thành | Chuyển DMS | `analysis_completed` | `dms_transfer` |
| 25 | — | Tất cả | Chuyển BA Phân tích hoàn thành | Lập trình | `analysis_completed` | `coding` |
| 26 | — | R | Chuyển BA Phân tích hoàn thành | Giao PM/Trả YC cho PM | `analysis_completed` | `pending_dispatch` |
| 27 | — | Tất cả | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích | `analysis_suspended` | `analysis` |
| 28 | — | R | Chuyển BA Phân tích tạm ngưng | Chuyển BA Phân tích hoàn thành | `analysis_suspended` | `analysis_completed` |
| 29 | — | R | Chuyển BA Phân tích tạm ngưng | Giao PM/Trả YC cho PM | `analysis_suspended` | `pending_dispatch` |
| 30 | — | Tất cả | Chuyển DMS | Tạo task | `dms_transfer` | `dms_task_created` |
| 31 | — | Tất cả | Chuyển DMS | Giao PM/Trả YC cho PM | `dms_transfer` | `pending_dispatch` |
| 32 | — | Tất cả | Tạo task | DMS Đang thực hiện | `dms_task_created` | `dms_in_progress` |
| 33 | — | Tất cả | Tạo task | Giao PM/Trả YC cho PM | `dms_task_created` | `pending_dispatch` |
| 34 | — | Tất cả | DMS Đang thực hiện | Hoàn thành | `dms_in_progress` | `completed` |
| 35 | — | Tất cả | DMS Đang thực hiện | DMS tạm ngưng | `dms_in_progress` | `dms_suspended` |
| 36 | — | Tất cả | DMS Đang thực hiện | Giao PM/Trả YC cho PM | `dms_in_progress` | `pending_dispatch` |
| 37 | — | Tất cả | DMS tạm ngưng | DMS Đang thực hiện | `dms_suspended` | `dms_in_progress` |
| 38 | — | Tất cả | DMS tạm ngưng | Giao PM/Trả YC cho PM | `dms_suspended` | `pending_dispatch` |
| 39 | — | R | Lập trình | Dev đang thực hiện | `coding` | `coding_in_progress` |
| 40 | — | R | Lập trình | Giao PM/Trả YC cho PM | `coding` | `pending_dispatch` |
| 41 | — | R | Dev đang thực hiện | Hoàn thành | `coding_in_progress` | `completed` |
| 42 | — | R | Dev đang thực hiện | Dev tạm ngưng | `coding_in_progress` | `coding_suspended` |
| 43 | — | R | Dev đang thực hiện | Giao PM/Trả YC cho PM | `coding_in_progress` | `pending_dispatch` |
| 44 | — | R | Dev tạm ngưng | Dev đang thực hiện | `coding_suspended` | `coding_in_progress` |
| 45 | — | R | Dev tạm ngưng | Giao PM/Trả YC cho PM | `coding_suspended` | `pending_dispatch` |
| 46 | Kết thúc | Tất cả | Thông báo khách hàng | Giao PM/Trả YC cho PM | `customer_notified` | `pending_dispatch` |

> Ghi chú: một số status code như `assigned_performer`, `analysis_completed`, `dms_task_created`, `dms_in_progress`, `coding_in_progress` có thể cần tạo mới hoặc map sang status gần nhất nếu chưa tồn tại.

---

## 4) Việc cần làm

### 4.1 Backend

| Giai đoạn | Hạng mục | File cần sửa | Mô tả |
|---|---|---|---|
| 1 | Hardcode transition map theo workflowa | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` | Thêm hàm `getWorkflowaTransitions()` trả về danh sách `from => to` hợp lệ; cập nhật `isTransitionAllowedForCase()` và `resolveXmlAlignedAllowedTargets()` dùng map này |
| 2 | Đồng bộ allowed_next_statuses cho UI | `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php` | Hàm `getAllowedTransitionsForCase()` dùng chung map workflowa |
| 3 | Migration cập nhật transition table | `backend/database/migrations/2026_04_06_000000_apply_workflowa_transitions.php` (mới) | Upsert `customer_request_status_transitions` theo workflowa, set `is_active` = 1 cho allowed, 0 cho conflicting |
| 4 | Unify form fields về 7 trường | `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php` | Thay `form_fields` mỗi status bằng schema cố định 7 field |
| 5 | Chuẩn hóa validate/defaults | `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` | `normalizeStatusPayload()` và `applyStatusDefaults()` chỉ làm việc với 7 field |

### 4.2 Frontend

| Giai đoạn | Hạng mục | File cần sửa | Mô tả |
|---|---|---|---|
| 1 | Loại bỏ render dynamic form fields | `frontend/components/CustomerRequestManagementHub.tsx` | Thay `transitionRenderableFields = transitionProcessMeta?.form_fields` bằng fixed schema 7 field |
| 2 | Transition modal chỉ hiển thị 7 field | `frontend/components/customer-request/CustomerRequestTransitionModal.tsx` | Render cố định 7 field thay vì map từ `transitionRenderableFields` |
| 3 | Hook transition khởi tạo draft từ 7 keys | `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts` | Sửa `initializeModalStatusPayload()` trả về 7 keys |
| 4 | Detail pane editor form | `frontend/components/customer-request/CustomerRequestDetailPane.tsx` | Align editor process form về 7 field (nếu cần) |
| 5 | Helpers serialize payload | `frontend/components/customer-request/helpers.ts` | `buildPayloadFromDraft` nhận fixed field list hoặc bypass cho transition |

### 4.3 Tests cần cập nhật

| Loại test | File | Nội dung cần sửa |
|---|---|---|
| UI test | `frontend/__tests__/customerRequestTransitionModal.ui.test.tsx` | Fixture `form_fields` → fixed 7 keys |
| Helper test | `frontend/__tests__/customerRequestTransitionHelpers.test.ts` | Assert payload shape 7 keys |
| Hub UI test | `frontend/__tests__/customerRequestManagementHub.ui.test.tsx` | Mock process meta + transition payload |
| DetailPane test | `frontend/__tests__/customerRequestDetailPane.ui.test.tsx` | Editor form fixture |
| E2E mock | `frontend/e2e/helpers/customer-request-api-mock.ts` | `statusMeta.form_fields` + transition handler |
| Backend test | `backend/tests/Feature/**/*CustomerRequest*` | Transition validity + actor constraint tests |

---

## 5) Schema chuẩn nhóm trạng thái/chuyển trạng thái

| Field key | Kiểu | Label UI | Required |
|---|---|---|---|
| `received_at` | datetime | Ngày bắt đầu | No |
| `completed_at` | datetime | Ngày kết thúc | No |
| `extended_at` | datetime | Ngày gia hạn | No |
| `notes` | text | Ghi chú | No |
| `progress_percent` | tinyint (0-100) | Tiến độ phần trăm | No |
| `from_user_id` | bigint unsigned | Người chuyển | No |
| `to_user_id` | bigint unsigned | Người nhận | No |

> Quy ước hiển thị:
> - `from_user_id`: mặc định lấy user đang thao tác transition (actor).
> - `to_user_id`: chọn người nhận theo nhánh chuyển trạng thái (ví dụ giao PM, giao R, chuyển BA/DMS/Dev).
> - Khi không cần chỉ định người nhận cho một nhánh cụ thể, `to_user_id` có thể null.

---

## 6) Rủi ro & Ghi chú

| Rủi ro | Giảm thiểu |
|---|---|
| Dữ liệu cũ có field khác | Giữ bảng cũ, chỉ write/read 7 field; adapter fallback khi đọc case lịch sử |
| Transition map hardcode drift so với DB | Dùng 1 canonical map trong code, cả write-path và domain-service cùng đọc |
| Status code chưa tồn tại (vd: `analysis_completed`) | Tạo migration seeder catalog hoặc map sang status gần nhất |

---

## 7) Timeline đề xuất

| Tuần | Nội dung |
|---|---|
| 1 | Backend: transition map + migration + unify registry fields |
| 2 | Frontend: remove dynamic render + fixed 5-field form |
| 3 | Test regression + UAT + rollout staging |

---

## 8) Mẫu form hiển thị (đưa vào scope kế hoạch, bám UI hiện tại)

### 8.1 Form Thêm mới yêu cầu (GIỮ NGUYÊN bố cục hiện tại)

```text
┌──────────────────────────────────── TẠO YÊU CẦU MỚI ────────────────────────────────────┐
│ [LEFT - giữ nguyên như hiện tại]                                 │ [RIGHT - còn Estimate]│
│ Khách hàng | Dự án | Sản phẩm                                    │ Estimate ban đầu      │
│ Nội dung yêu cầu *                                                │ - Giờ ước lượng       │
│ Khách hàng            Người yêu cầu                               │ - Ghi chú ước lượng   │
│ Kênh tiếp nhận        Kênh khác                                   │                       │
│ Độ ưu tiên                                                        │ (KHÔNG còn Hướng xử lý)│
│ Mô tả chi tiết                                                     │                       │
│                                                                    │                       │
│ TASK LIÊN QUAN (giữ nguyên)                                        │                       │
│ ĐÍNH KÈM (giữ nguyên)                                              │                       │
│                                                                    │                       │
│ [Hủy]                                                                  [Tạo yêu cầu]      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

> Ghi chú: Form tạo mới giữ các khối xung quanh cần thiết (Estimate, Task liên quan, Đính kèm), nhưng **bỏ hoàn toàn khối Hướng xử lý**. Luồng xử lý sẽ hardcode theo workflowa ở backend.

### 8.2 Form Chỉnh sửa trạng thái trong Detail Pane (giữ layout pane hiện tại, chỉ cố định field)

```text
┌───────────────────────────── DETAIL PANE - CHỈNH SỬA TRẠNG THÁI ─────────────────────────┐
│ Thông tin chung + timeline + section xung quanh: GIỮ NGUYÊN như hiện tại                │
│ ----------------------------------------------------------------------------------------- │
│ Cụm form trạng thái (thay dynamic -> fixed):                                             │
│ - Ngày bắt đầu             [ dd/mm/yyyy hh:mm ]                                          │
│ - Ngày kết thúc            [ dd/mm/yyyy hh:mm ]                                          │
│ - Ngày gia hạn             [ dd/mm/yyyy hh:mm ]                                          │
│ - Tiến độ phần trăm        [ 0..100 ]                                                    │
│ - Người chuyển             [ Chọn người chuyển                                      v ]  │
│ - Người nhận               [ Chọn người nhận                                        v ]  │
│ - Ghi chú                  [......................................................... ]   │
│ [Lưu chỉnh sửa]                                                                        │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Form Chuyển trạng thái nhanh (giữ modal hiện tại, chỉ cố định field)

```text
┌────────────────────────────── CHUYỂN TRẠNG THÁI ──────────────────────────────────────────┐
│ Từ trạng thái: [....................]   Đến trạng thái: [..................]             │
│ (các block thông tin xung quanh trong modal hiện tại: giữ nguyên)                         │
│ ----------------------------------------------------------------------------------------- │
│ Cụm field chuyển trạng thái (fixed):                                                      │
│ - Ngày bắt đầu             [ dd/mm/yyyy hh:mm ]                                           │
│ - Ngày kết thúc            [ dd/mm/yyyy hh:mm ]                                           │
│ - Ngày gia hạn             [ dd/mm/yyyy hh:mm ]                                           │
│ - Tiến độ phần trăm        [ 0..100 ]                                                     │
│ - Người chuyển             [ Chọn người chuyển                                      v ]   │
│ - Người nhận               [ Chọn người nhận                                        v ]   │
│ - Ghi chú                  [......................................................... ]    │
│ [Hủy]                                                              [Xác nhận chuyển]      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

> Quy tắc UI chốt trong kế hoạch:
> - Giữ nguyên layout/khối giao diện hiện tại của `/customer-request-management`.
> - Giữ các panel xung quanh cần thiết (Estimate, Task liên quan, Đính kèm, timeline/detail sections).
> - **Bỏ panel Hướng xử lý** trong form thêm mới.
> - Chỉ thay phần field động của trạng thái/chuyển trạng thái thành 7 field cố định.
> - Không thêm/bớt field theo từng trạng thái.

## 9) Canonical status codes (chuẩn hóa theo `workflowa.xlsx`)

> Nguyên tắc: map từ nhãn nghiệp vụ trong `workflowa.xlsx` về bộ mã kỹ thuật ổn định để seed transition và validate ở backend.

| Nhãn trong `workflowa.xlsx` | Canonical code | Nhóm | Có trong hệ thống hiện tại | Ghi chú |
|---|---|---|---|---|
| Tiếp nhận | `new_intake` | intake | Yes | Trạng thái mở đầu cố định |
| Giao R thực hiện | `assigned_performer` | intake | No/Check | Có thể cần thêm catalog |
| Giao PM/Trả YC cho PM | `pending_dispatch` | intake | Yes (legacy) | Dùng làm hub điều phối |
| R Đang thực hiện | `in_progress` | processing | Yes | |
| Không tiếp nhận | `not_executed` | closure | Yes | |
| Chờ khách hàng cung cấp thông tin | `waiting_customer_feedback` | intake | Yes | |
| Chuyển BA Phân tích | `analysis` | analysis | Yes | |
| Chuyển BA Phân tích hoàn thành | `analysis_completed` | analysis | No/Check | Có thể cần thêm catalog |
| Chuyển BA Phân tích tạm ngưng | `analysis_suspended` | analysis | No/Check | Có thể cần thêm catalog |
| Chuyển DMS | `dms_transfer` | dms | Yes | |
| Tạo task | `dms_task_created` | dms | No/Check | Có thể cần thêm catalog |
| DMS Đang thực hiện | `dms_in_progress` | dms | No/Check | Có thể cần thêm catalog |
| DMS tạm ngưng | `dms_suspended` | dms | No/Check | Có thể cần thêm catalog |
| Lập trình | `coding` | coding | Yes | |
| Dev đang thực hiện | `coding_in_progress` | coding | No/Check | Có thể cần thêm catalog |
| Dev tạm ngưng | `coding_suspended` | coding | No/Check | Có thể cần thêm catalog |
| Hoàn thành | `completed` | closure | Yes | |
| Thông báo khách hàng | `customer_notified` | closure | Yes | |

### 9.1 Canonical transition set (theo workflowa)

- Transition hợp lệ cuối cùng phải được generate theo bảng mapping Mục 3.
- Không dùng transition ngoài mapping này.
- `new_intake` luôn là điểm bắt đầu.

## 10) Rule required/optional cho 7 field trạng thái

| Field key | Create case | Edit trạng thái (không đổi status) | Transition status | Rule nghiệp vụ |
|---|---|---|---|---|
| `received_at` | Optional | Optional | Optional | Nếu null thì backend có thể default = `now()` khi vào status đầu |
| `completed_at` | Optional | Optional | Optional | Bắt buộc khi chuyển sang `completed` hoặc `customer_notified` |
| `extended_at` | Optional | Optional | Optional | Chỉ nhập khi có gia hạn |
| `notes` | Optional | Optional | **Required** (khuyến nghị) | Bắt buộc với các nhánh tạm ngưng / không tiếp nhận / trả PM |
| `progress_percent` | Optional | Optional | Optional | Validate 0..100; mặc định 0 nếu null |
| `from_user_id` | Optional | Optional | **Required** | Mặc định actor hiện tại nếu FE không gửi |
| `to_user_id` | Optional | Optional | Conditional | Bắt buộc cho nhánh “giao/chuyển” cần người nhận; cho phép null ở nhánh không cần |

### 10.1 Rule bắt buộc `to_user_id` theo nhóm chuyển

| Nhóm chuyển trạng thái | `to_user_id` |
|---|---|
| Chuyển sang `pending_dispatch` (trả PM) | Required (PM đích) |
| Chuyển sang `assigned_performer` / `in_progress` / `coding*` / `analysis*` / `dms*` | Required |
| Chuyển sang `completed` / `customer_notified` / `not_executed` | Optional |

## 11) Bảng migration chi tiết (cột nào thêm vào bảng nào)

> Mục tiêu: thêm đủ 7 field chuẩn vào toàn bộ bảng payload status đang active để đọc/ghi thống nhất.

### 11.1 Bảng cần bổ sung cột

| Bảng | Cột thêm mới | Kiểu | Null | Index |
|---|---|---|---|---|
| `customer_request_waiting_customer_feedbacks` | `progress_percent`, `from_user_id`, `to_user_id` | tinyint unsigned, bigint unsigned, bigint unsigned | YES | index(`from_user_id`), index(`to_user_id`) |
| `customer_request_in_progress` | `from_user_id`, `to_user_id` | bigint unsigned, bigint unsigned | YES | index(`from_user_id`), index(`to_user_id`) |
| `customer_request_analysis` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `completed_at`, `extended_at`, `notes`* | mixed | YES | index user columns |
| `customer_request_not_executed` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `completed_at`, `extended_at`* | mixed | YES | index user columns |
| `customer_request_completed` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `extended_at`* | mixed | YES | index user columns |
| `customer_request_customer_notified` | `progress_percent`, `from_user_id`, `to_user_id` | tinyint unsigned, bigint unsigned, bigint unsigned | YES | index user columns |
| `customer_request_returned_to_manager` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `completed_at`, `extended_at`, `notes`* | mixed | YES | index user columns |
| `customer_request_coding` | `from_user_id`, `to_user_id` | bigint unsigned, bigint unsigned | YES | index user columns |
| `customer_request_dms_transfer` | `from_user_id`, `to_user_id` | bigint unsigned, bigint unsigned | YES | index user columns |
| `customer_request_pending_dispatch` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `completed_at`, `extended_at`, `notes`* | mixed | YES | index user columns |
| `customer_request_dispatched` | `progress_percent`, `from_user_id`, `to_user_id`, `received_at`, `completed_at`, `extended_at`, `notes`* | mixed | YES | index user columns |

> `*` Chỉ thêm nếu bảng chưa có cột tương ứng. Migration phải dùng guard `Schema::hasColumn(...)`.

### 11.2 Migration kỹ thuật

| Migration file đề xuất | Nội dung |
|---|---|
| `2026_04_06_000000_apply_workflowa_transitions.php` | Upsert transition theo workflowa + deactivate transition ngoài scope |
| `2026_04_06_000100_add_unified_status_fields_to_crc_tables.php` | Add missing columns của 7-field schema vào các status payload tables |
| `2026_04_06_000200_seed_missing_status_catalogs_for_workflowa.php` | Upsert status catalog còn thiếu (analysis_completed, dms_task_created, ... nếu chọn phương án tạo mới) |

## 12) Test matrix A/R/C/I + UAT pass criteria

### 12.1 Test matrix quyền và transition

| Vai trò | Xem danh sách/chi tiết | Tạo yêu cầu | Edit trạng thái | Transition theo workflowa | Kỳ vọng |
|---|---|---|---|---|---|
| A (PM) | Yes | Yes | Yes | Yes (theo map) | Pass nếu chỉ thấy transition hợp lệ |
| R (Performer) | Yes | Yes | Yes | Yes (theo map giao cho R) | Pass nếu không đi được nhánh chỉ dành PM |
| C (Consulted) | Yes | No | No | No | Pass nếu nút mutate bị ẩn + API trả 403 khi gọi trực tiếp |
| I (Informed) | Yes | No | No | No | Pass nếu giống C |

### 12.2 UAT pass criteria (bắt buộc)

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| UAT-01 | Mở form tạo mới | Không còn panel “Hướng xử lý”; các khối còn lại giữ nguyên |
| UAT-02 | Tạo case mới | Case vào `new_intake` |
| UAT-03 | Chuyển trạng thái bất kỳ | Form chỉ hiển thị đúng 7 field cố định |
| UAT-04 | Nhập `progress_percent` ngoài 0..100 | Validate lỗi đúng thông báo |
| UAT-05 | Chuyển nhánh cần người nhận mà bỏ `to_user_id` | Bị chặn và báo lỗi |
| UAT-06 | Nhánh completed/customer_notified | `completed_at` được yêu cầu hoặc auto theo rule đã chốt |
| UAT-07 | User C/I thao tác chuyển trạng thái | UI không cho thao tác; API trả 403 |
| UAT-08 | Case lịch sử trước migration | Mở detail không lỗi, vẫn xem được |
| UAT-09 | Allowed next statuses | Chỉ xuất hiện transition có trong workflowa mapping |
| UAT-10 | Audit dữ liệu sau lưu | `from_user_id`/`to_user_id` ghi đúng vào row trạng thái |

## 13) Checklist hoàn thành

- [ ] Backend transition map hardcode theo workflowa
- [ ] Migration upsert transitions vào DB
- [ ] Backend registry unify 7 field
- [ ] Frontend transition modal + detail form dùng 7 field
- [ ] Tests backend/frontend cập nhật + pass
- [ ] Manual test flow create + transition tại nhiều status
- [ ] Regression check case lịch sử
- [ ] UAT-01..UAT-10 pass trên staging
- [ ] Tài liệu mapping status/transitions được chốt và lưu trong repo

