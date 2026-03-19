# Nghiệp vụ: Quản lý Yêu cầu Khách hàng
> **Cập nhật lần cuối:** 2026-03-17
> **Module:** `customer_request_management` — component `YeuCauManagementHub`

---

## 1. Tổng quan nghiệp vụ

Module quản lý toàn bộ vòng đời yêu cầu hỗ trợ từ khách hàng, bao gồm:
- **Tiếp nhận** yêu cầu từ nhiều kênh (Zalo, email, điện thoại, trực tiếp…)
- **Phân loại** theo khách hàng, kênh tiếp nhận, độ ưu tiên
- **Theo dõi tiến trình** qua các bước xử lý (workflow)
- **Chuyển trạng thái** có cấu hình: mỗi bước lưu thông tin chi tiết riêng
- **Lịch sử** đầy đủ theo chuỗi linked-list instance

---

## 2. Kiến trúc dữ liệu

### 2.1 Bảng trung tâm: `customer_request_cases`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | BIGINT PK | ID yêu cầu (dùng làm case_id) |
| `request_code` | VARCHAR(50) UNIQUE | Mã yêu cầu hiển thị (VD: CRC-202603-0001) |
| `legacy_customer_request_id` | BIGINT FK nullable | Liên kết yêu cầu cũ (migration) |
| `customer_id` | BIGINT FK | Khách hàng |
| `customer_personnel_id` | BIGINT FK | Người yêu cầu phía KH |
| `support_service_group_id` | BIGINT FK | Kênh/nhóm tiếp nhận |
| `project_id / project_item_id` | BIGINT FK | Dự án / Hạng mục liên quan |
| `summary` | VARCHAR(500) | Nội dung tóm tắt yêu cầu |
| `priority` | TINYINT (1-4) | Độ ưu tiên: Thấp/Trung bình/Cao/Khẩn |
| `current_status_code` | VARCHAR(80) | Trạng thái hiện tại (FK → status_catalogs) |
| `current_status_instance_id` | BIGINT FK | Instance trạng thái đang active |
| `received_at` | DATETIME | Thời điểm tiếp nhận |
| `completed_at` | DATETIME | Thời điểm hoàn thành |
| `current_status_changed_at` | DATETIME | Thời điểm đổi trạng thái gần nhất |

---

### 2.2 Danh mục trạng thái: `customer_request_status_catalogs`

| `status_code` | Tên tiếng Việt | Bảng chi tiết | Màu UI |
|---------------|---------------|---------------|--------|
| `new_intake` | Mới tiếp nhận | *(inline trong cases)* | 🔵 Sky |
| `waiting_customer_feedback` | Đợi phản hồi KH | `customer_request_waiting_customer_feedbacks` | 🟡 Yellow |
| `in_progress` | Đang xử lý | `customer_request_in_progress` | 🟠 Amber |
| `not_executed` | Không thực hiện | `customer_request_not_executed` | ⚫ Slate |
| `completed` | Hoàn thành | `customer_request_completed` | 🟢 Emerald |
| `customer_notified` | Báo khách hàng | `customer_request_customer_notified` | 🩵 Teal |
| `returned_to_manager` | Chuyển trả QL | `customer_request_returned_to_manager` | 🟠 Orange |
| `analysis` | Phân tích | `customer_request_analysis` | 🟣 Purple |

---

### 2.3 Cấu hình chuyển trạng thái: `customer_request_status_transitions`

| Cột | Mô tả |
|-----|-------|
| `from_status_code` | Trạng thái đi (hiện tại) |
| `to_status_code` | Trạng thái đến |
| `direction` | `forward` / `backward` |
| `is_default` | Luồng mặc định |
| `is_active` | Còn hiệu lực |

**Luồng tiêu chuẩn (forward):**
```
new_intake → waiting_customer_feedback (mặc định)
new_intake → in_progress
new_intake → not_executed
new_intake → analysis

waiting_customer_feedback → in_progress (mặc định)
waiting_customer_feedback → not_executed

analysis → in_progress (mặc định)
analysis → not_executed

in_progress → completed (mặc định)
in_progress → not_executed
in_progress → returned_to_manager

completed → customer_notified (mặc định)
returned_to_manager → analysis (mặc định)
```

---

### 2.4 Chuỗi instance trạng thái: `customer_request_status_instances`

Mỗi lần chuyển trạng thái tạo ra một instance mới theo dạng **linked-list**:

```
[instance #1: new_intake]
    └──next_id──► [instance #2: waiting_customer_feedback]
                      └──next_id──► [instance #3: in_progress] ← is_current=true
```

| Cột | Mô tả |
|-----|-------|
| `request_case_id` | FK → cases |
| `status_code` | Mã trạng thái |
| `status_table` | Bảng detail tương ứng |
| `status_row_id` | ID dòng trong bảng detail |
| `previous_instance_id` | Instance trước (linked-list) |
| `next_instance_id` | Instance sau |
| `entered_at / exited_at` | Thời gian vào/rời trạng thái |
| `is_current` | Đang active hay không |

---

### 2.5 Bảng chi tiết per-trạng thái

Mỗi bảng có **base columns** chung:
- `id`, `request_case_id`, `status_instance_id`, `notes`, `created_by`, `updated_by`, `timestamps`

**Columns đặc thù:**

#### `customer_request_waiting_customer_feedbacks`
| Cột | Mô tả |
|-----|-------|
| `feedback_request_content` | Nội dung cần KH phản hồi |
| `feedback_requested_at` | Ngày gửi yêu cầu phản hồi |
| `customer_due_at` | Hạn phản hồi |
| `customer_feedback_at` | Ngày KH thực sự phản hồi |
| `customer_feedback_content` | Nội dung KH phản hồi |

#### `customer_request_in_progress`
| Cột | Mô tả |
|-----|-------|
| `performer_user_id` | Người thực hiện |
| `started_at` | Ngày bắt đầu |
| `expected_completed_at` | Ngày dự kiến hoàn thành |
| `progress_percent` | Tiến độ (0-100%) |
| `processing_content` | Nội dung xử lý |

#### `customer_request_not_executed`
| Cột | Mô tả |
|-----|-------|
| `decision_by_user_id` | Người xác nhận |
| `decision_at` | Ngày xác nhận |
| `decision_reason` | **Lý do** (bắt buộc) |

#### `customer_request_completed`
| Cột | Mô tả |
|-----|-------|
| `completed_by_user_id` | Người hoàn thành |
| `completed_at` | Ngày hoàn thành |
| `result_content` | Kết quả thực hiện |

#### `customer_request_customer_notified`
| Cột | Mô tả |
|-----|-------|
| `notified_by_user_id` | Người báo KH |
| `notified_at` | Ngày báo |
| `notification_channel` | Kênh báo (Email/Zalo/ĐT…) |
| `notification_content` | Nội dung báo |
| `customer_feedback` | Phản hồi của KH |

#### `customer_request_returned_to_manager`
| Cột | Mô tả |
|-----|-------|
| `returned_by_user_id` | Người chuyển trả |
| `returned_at` | Ngày chuyển trả |
| `return_reason` | Lý do chuyển trả |

#### `customer_request_analysis`
| Cột | Mô tả |
|-----|-------|
| `performer_user_id` | Người phân tích |
| `analysis_content` | Nội dung phân tích |
| `analysis_completed_at` | Ngày hoàn thành phân tích |

---

### 2.6 Bảng phụ trợ theo instance

| Bảng | Mô tả |
|------|-------|
| `customer_request_worklogs` | Log giờ làm việc theo từng instance |
| `customer_request_status_ref_tasks` | Task tham chiếu (IT360, JIRA…) gắn với instance |
| `customer_request_status_attachments` | File đính kèm theo từng instance |

---

## 3. Luồng xử lý chuyển trạng thái

```
User chọn trạng thái mới trong form
          │
          ▼
Frontend: transitionStatusCode ≠ current trang_thai ?
          │
          ├── KHÔNG → saveYeuCauProcess() bình thường
          │
          └── CÓ → validate (not_executed cần decision_reason)
                      │
                      ▼
              POST /api/v5/customer-request-cases/{id}/transition
              { to_status_code, status_payload: { ...fields đặc thù } }
                      │
                      ▼ Backend (DB Transaction):
              ① check customer_request_status_transitions (from → to hợp lệ?)
              ② instance cũ: is_current=false, exited_at=now(), next_id=new_id
              ③ tạo instance mới: is_current=true, entered_at=now(), previous_id=old_id
              ④ INSERT vào bảng detail tương ứng với status_payload
              ⑤ UPDATE customer_request_cases.current_status_code + current_status_instance_id
              ⑥ Audit log
                      │
                      ▼
              saveYeuCauProcess() → cập nhật master fields
```

---

## 4. API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v5/customer-request-statuses` | Lấy catalog tiến trình/trạng thái |
| GET | `/api/v5/customer-request-cases` | Danh sách yêu cầu (có filter/search) |
| POST | `/api/v5/customer-request-cases` | Tạo yêu cầu mới |
| GET | `/api/v5/customer-request-cases/{id}` | Chi tiết một yêu cầu |
| GET | `/api/v5/customer-request-cases/{id}/statuses/{code}` | Chi tiết trạng thái |
| POST | `/api/v5/customer-request-cases/{id}/statuses/{code}` | Lưu data trạng thái |
| **POST** | **`/api/v5/customer-request-cases/{id}/transition`** | **Chuyển trạng thái** |
| GET | `/api/v5/customer-request-cases/{id}/timeline` | Lịch sử chuyển trạng thái |
| DELETE | `/api/v5/customer-request-cases/{id}` | Xóa yêu cầu |

---

## 5. Frontend — `YeuCauManagementHub.tsx`

### 5.1 States quan trọng

| State | Kiểu | Mô tả |
|-------|------|-------|
| `requestStatusFilter` | `string` | Filter trạng thái trong danh sách |
| `transitionStatusCode` | `string` | Trạng thái được chọn trong form |
| `transitionPayload` | `Record<string,unknown>` | Fields đặc thù của trạng thái mới |
| `listPage` | `number` | Trang hiện tại trong danh sách |

### 5.2 STATUS_COLOR_MAP

Hằng số ánh xạ `status_code → { label, cls }` Tailwind dùng chung cho:
- Badge trong danh sách (`processBadge`)
- Badge "Hiện tại" trong form
- Dropdown filter danh sách

### 5.3 Luồng UI

**Danh sách (list view):**
- 6 filter: Tiến trình, Từ khóa, Khách hàng, Kênh tiếp nhận, Độ ưu tiên, **Trạng thái xử lý**
- Phân trang 20 items/trang
- Mỗi item hiển thị: mã YC, badge trạng thái màu, kết quả, ưu tiên, tiêu đề, meta, người xử lý, số ngày

**Form view:**
1. Section **Trạng thái xử lý** (chỉ hiện khi EDIT):
   - Badge trạng thái hiện tại (màu, tên)
   - Dropdown chọn trạng thái mới
   - Nếu trạng thái khác hiện tại → hiện dynamic fields đặc thù
2. Section **Thông tin yêu cầu**: master fields (khách hàng, kênh, ưu tiên…)
3. Section **Tiến trình** (workflow fields): form_fields động từ catalog
4. Section **Task liên quan & file đính kèm**

### 5.4 Keyboard shortcuts

| Phím | Tác dụng |
|------|----------|
| `F1` | Lưu / Cập nhật yêu cầu |
| `Ctrl/Cmd + N` | Tạo yêu cầu mới |
| `Ctrl/Cmd + U` | Cập nhật yêu cầu |
| `Ctrl/Cmd + D` | Xóa yêu cầu |

---

## 6. Validation nghiệp vụ

| Trường hợp | Quy tắc |
|------------|---------|
| Chuyển sang `not_executed` | `decision_reason` bắt buộc không được để trống |
| Chuyển trạng thái | Backend validate qua `customer_request_status_transitions` |
| Transition không hợp lệ | Backend trả 422 với message lỗi |
| Tạo mới | `summary` bắt buộc |

---

## 7. Files thay đổi

| File | Thay đổi |
|------|---------|
| `frontend/services/v5Api.ts` | Thêm `transitionCustomerRequestCase()` |
| `frontend/types.ts` | Thêm `current_status_name_vi` vào `YeuCau` |
| `frontend/components/YeuCauManagementHub.tsx` | Thêm `STATUS_COLOR_MAP`, states, filter, form status section, dynamic fields, transition logic |
