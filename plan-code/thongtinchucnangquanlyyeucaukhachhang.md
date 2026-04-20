# Thông tin chức năng Quản lý Yêu cầu Khách hàng (Customer Request Management)

## 1) Tổng quan chức năng

**URL nghiệp vụ:** `/customer-request-management`  
**Tab nội bộ frontend:** `customer_request_management`

Module này quản lý toàn bộ vòng đời xử lý yêu cầu khách hàng (CRC - Customer Request Case), bao gồm:
- Tiếp nhận yêu cầu
- Điều phối và phân công
- Theo dõi thực thi theo trạng thái nghiệp vụ
- Ghi nhận giờ công thực tế (worklog)
- Quản lý ước lượng (estimate) và cảnh báo vượt ngưỡng
- Kế hoạch tuần/tháng và carry-over
- Escalation khi phát sinh khó khăn/rủi ro
- Dashboard/analytics và báo cáo

Mục tiêu chính:
1. Chuẩn hóa luồng xử lý xuyên suốt từ intake đến closure
2. Theo dõi năng suất và SLA theo vai trò (Creator/Dispatcher/Performer)
3. Tăng khả năng kiểm soát tiến độ, điểm nghẽn và chất lượng xử lý

---

## 2) Kiến trúc tổng thể

## 2.1 Frontend

- Route mapping trong App: `/customer-request-management` → tab `customer_request_management`
- Hub chính: `CustomerRequestManagementHub.tsx` (điều phối workspace + surface + modal)
- Workspace tabs:
  - Overview
  - Creator
  - Dispatcher
  - Performer
- Surface switch:
  - Inbox
  - List
  - Analytics

Cấu trúc chính trong `frontend/components/customer-request/`:
- Workspace: creator/dispatcher/performer/overview
- Các panel: hours, estimate, timeline, coding/dms progress
- Các hook domain-specific (list/detail/search/transition/dashboard/attachments...)

## 2.2 Backend

Mô hình nhiều lớp:

1. **Controller layer** (API endpoints)
2. **Domain service layer** (orchestration nghiệp vụ)
3. **Sub-service layer** (read/write/execution/dashboard/metadata)
4. **Model + DB layer**

Controller chính:
- `CustomerRequestCaseController` (CRUD + transition + worklog + estimate + dashboard + detail)
- `CustomerRequestPlanController` (plan/item/carry-over/backlog)
- `CustomerRequestReportController` (reports)
- `CustomerRequestEscalationController` (escalation lifecycle)

Service trung tâm:
- `CustomerRequestCaseDomainService`
- `CustomerRequestCaseRegistry` (single source of truth cho status/tables/fields)

Các service tách theo trách nhiệm:
- ReadQueryService (list/filter/pagination)
- WriteService (create/update/transition lưu dữ liệu)
- ExecutionService (worklog, estimate, overrun warning)
- DashboardService (KPI theo vai trò)
- MetadataService (status catalog + allowed transitions)

## 2.3 Database

Thiết kế workflow chuyên biệt:
- `customer_request_cases` là bảng master case
- Mỗi status có bảng riêng để lưu form-field theo trạng thái
- Có bảng `status_instances` theo linked-list để lưu lịch sử chuyển trạng thái bất biến
- Có hệ estimate/worklog/plan/escalation/reports metadata

---

## 3) Luồng nghiệp vụ và trạng thái

## 3.1 12 mã trạng thái (4 nhóm)

### INTAKE
1. `new_intake`
2. `pending_dispatch`
3. `dispatched`
4. `waiting_customer_feedback`

### ANALYSIS
5. `analysis`
6. `returned_to_manager`

### PROCESSING
7. `in_progress`
8. `coding`
9. `dms_transfer`

### CLOSURE
10. `completed`
11. `customer_notified`
12. `not_executed`

> Trạng thái và mapping bảng/field được quản lý tập trung trong `CustomerRequestCaseRegistry`.

## 3.2 Vai trò chính

- **Creator (C):** `received_by_user_id` — người tiếp nhận/khởi tạo yêu cầu
- **Dispatcher (D):** `dispatcher_user_id` — điều phối/triage/phân công
- **Performer (P):** `performer_user_id` — người trực tiếp xử lý

## 3.3 Luồng chuyển trạng thái

- Chuyển trạng thái qua endpoint transition
- Mỗi lần chuyển tạo bản ghi trong `customer_request_status_instances`
- `status_instances` dùng `previous_instance_id`/`next_instance_id`, `is_current` để tạo lịch sử tuyến tính, không ghi đè
- Báo cáo theo `status_instance_id` để không bị merge sai khi case quay lại trạng thái cũ

## 3.4 Sub-phase chi tiết

- `coding_phase`: `coding | coding_done | upcode_pending | upcode_deployed`
- `dms_phase`: `exchange | task_created | in_progress | completed`

Ngoài status chính, hệ còn có detail status/action để tracking granular trong từng giai đoạn xử lý.

---

## 4) Thiết kế dữ liệu (DB schema mức nghiệp vụ)

## 4.1 Bảng lõi

1. `customer_request_cases`
   - Master record của yêu cầu
   - Chứa thông tin tổng quan, owner/assignee, estimated_hours, total_hours_spent
   - Cờ cảnh báo vượt ngưỡng: `warn_70_sent`, `warn_90_sent`, `warn_100_sent`

2. `customer_request_status_catalogs`
   - Danh mục trạng thái cấu hình theo workflow

3. `customer_request_status_transitions`
   - Cấu hình chuyển trạng thái hợp lệ

4. `customer_request_status_instances`
   - Audit trail bất biến theo từng lần đổi trạng thái
   - Có liên kết previous/next để truy vết timeline chính xác

5. `customer_request_worklogs`
   - Nhật ký thời gian làm việc, billable/non-billable
   - Có trường difficulty/detail action để ghi nhận tình trạng thực thi chi tiết

6. `customer_request_estimates`
   - Lưu các bản estimate (theo phase/scope/type)

7. `customer_request_plans`
8. `customer_request_plan_items`
   - Kế hoạch tuần/tháng và từng item công việc

9. `customer_request_escalations`
   - Quản lý escalation và vòng đời review/resolve

10. `customer_request_workflow_metadata`
   - Metadata mở rộng cho workflow

11. `customer_request_status_ref_tasks`
12. `customer_request_status_attachments`
   - Tài liệu tham chiếu và tệp đính kèm theo status

13. `status_detail_states`
14. `status_detail_logs`
   - Quản lý trạng thái chi tiết trong từng status chính và lịch sử thay đổi

## 4.2 Bảng theo từng trạng thái

Mỗi trạng thái nghiệp vụ map vào bảng lưu dữ liệu chuyên biệt (ngoài bảng master), giúp:
- Quản lý field theo ngữ cảnh từng status
- Giảm nhiễu dữ liệu giữa các phase khác nhau
- Dễ mở rộng metadata/status form trong tương lai

Ví dụ tên bảng theo pattern `customer_request_<status_code>` cho các trạng thái như:
- `pending_dispatch`, `analysis`, `in_progress`, `coding`, `dms_transfer`, `completed`, ...

## 4.3 Danh sách đầy đủ tất cả table liên quan chức năng CRC

### A. Nhóm bảng lõi đang vận hành
1. `customer_request_cases`
2. `customer_request_status_catalogs`
3. `customer_request_status_transitions`
4. `customer_request_status_instances`
5. `customer_request_worklogs`
6. `customer_request_status_ref_tasks`
7. `customer_request_status_attachments`
8. `customer_request_estimates`
9. `customer_request_plans`
10. `customer_request_plan_items`
11. `customer_request_escalations`
12. `customer_request_workflow_metadata`
13. `customer_request_status_detail_states`
14. `customer_request_status_detail_logs`

### B. Nhóm bảng chi tiết theo trạng thái (status-specific tables)
15. `customer_request_assigned_to_receiver`
16. `customer_request_pending_dispatch`
17. `customer_request_dispatched`
18. `customer_request_receiver_in_progress`
19. `customer_request_waiting_customer_feedbacks`
20. `customer_request_in_progress`
21. `customer_request_analysis`
22. `customer_request_analysis_completed`
23. `customer_request_analysis_suspended`
24. `customer_request_coding`
25. `customer_request_coding_in_progress`
26. `customer_request_coding_suspended`
27. `customer_request_dms_transfer`
28. `customer_request_dms_task_created`
29. `customer_request_dms_in_progress`
30. `customer_request_dms_suspended`
31. `customer_request_completed`
32. `customer_request_not_executed`
33. `customer_request_customer_notified`
34. `customer_request_returned_to_manager`

### C. Bảng được code tham chiếu nhưng chưa thấy migration `Schema::create(...)` trong thư mục `backend/database/migrations`
35. `customer_request_waiting_notification` (được khai báo trong model + registry)
36. `customer_request_closed` (được khai báo trong model + registry)
37. `customer_request_case_tags` (được model/controller dùng để gắn tag cho case)

### D. Bảng legacy/liên quan lịch sử workflow customer-request
38. `customer_requests`
39. `workflow_status_catalogs`
40. `workflow_form_field_configs`
41. `request_raci_assignments`
42. `worklog_activity_types`

> Ghi chú: Danh sách trên tổng hợp từ migration + registry + model hiện có trong repo để dễ tra cứu đầy đủ khi audit/chuyển đổi dữ liệu.

## 4.4 Quy ước mã yêu cầu

`CRC-YYYYMM-NNNN`

---

## 5) API chính (prefix `/api/v5`)

## 5.1 Cases & workflow

- `GET /customer-request-statuses`
- `GET /customer-request-status-transitions`
- `GET /customer-request-cases`
- `GET /customer-request-cases/{id}`
- `GET /customer-request-cases/{id}/full-detail`
- `POST /customer-request-cases`
- `PUT /customer-request-cases/{id}`
- `DELETE /customer-request-cases/{id}`
- `POST /customer-request-cases/{id}/transition`

## 5.2 Worklog & estimate

- `POST /customer-request-cases/{id}/worklogs`
- `GET /customer-request-cases/{id}/worklogs`
- `POST /customer-request-cases/{id}/estimates`
- `GET /customer-request-cases/{id}/estimates`

## 5.3 Dashboard

- `GET /customer-request-cases/dashboard/creator`
- `GET /customer-request-cases/dashboard/dispatcher`
- `GET /customer-request-cases/dashboard/performer`
- `GET /customer-request-cases/dashboard/overview`

## 5.4 Plans

- `GET /customer-request-plans`
- `POST /customer-request-plans`
- `PUT /customer-request-plans/{id}`
- `DELETE /customer-request-plans/{id}`
- `POST /customer-request-plans/{id}/items`
- `PUT /customer-request-plans/items/{itemId}`
- `DELETE /customer-request-plans/items/{itemId}`
- `POST /customer-request-plans/{id}/carry-over`
- `GET /customer-request-plans/backlog`

## 5.5 Reports

- `GET /customer-request-cases/reports/monthly-hours`
- `GET /customer-request-cases/reports/weekly-hours`
- `GET /customer-request-cases/reports/pain-points`
- `GET /customer-request-cases/reports/trend`

## 5.6 Escalation

- `GET /customer-request-escalations`
- `POST /customer-request-escalations`
- `POST /customer-request-escalations/{id}/review`
- `POST /customer-request-escalations/{id}/resolve`
- `GET /customer-request-escalations/stats`

---

## 6) Nghiệp vụ cốt lõi

## 6.1 Tạo case

- Tạo từ payload intake
- Gán mã `CRC-YYYYMM-NNNN`
- Khởi tạo status ban đầu (`new_intake`)
- Ghi nhận instance hiện hành

## 6.2 Chuyển trạng thái

- Validate transition theo catalog/transitions
- Lưu dữ liệu status-specific table tương ứng
- Tạo status instance mới, đóng instance cũ (`is_current = false`)
- Ghi timeline phục vụ audit/report

## 6.3 Full detail hydration

Endpoint full-detail trả đầy đủ:
- Thông tin case master
- Trạng thái hiện hành + lịch sử
- Worklogs/Estimates
- Dữ liệu người liên quan (creator/dispatcher/performer)
- Metadata mở rộng

## 6.4 Worklog và giờ công

- Worklog có thể billable/non-billable
- Có trường difficulty/detail action để ghi nhận ngữ cảnh xử lý
- Cập nhật tổng giờ thực tế cho case
- Dữ liệu này là nền cho dashboard và pain-point report

## 6.5 Estimate & cảnh báo vượt ngưỡng

Khi cộng dồn `total_hours_spent`, hệ so với `estimated_hours`:
- >= 70%: set `warn_70_sent`
- >= 90%: set `warn_90_sent`
- >= 100%: set `warn_100_sent`

Nguyên tắc:
- Không cảnh báo nếu estimate null/0
- Flag được reset khi estimate được revise

## 6.6 Gắn worklog vào plan item

Khi tạo worklog:
1. Tìm plan item có `work_date` nằm trong kỳ plan
2. Ưu tiên plan tuần hơn plan tháng
3. Mỗi worklog chỉ map tối đa 1 plan item
4. Không tìm được plan phù hợp thì vẫn lưu worklog bình thường

## 6.7 Escalation

- Người tạo escalation: Dispatcher hoặc Performer
- Có lifecycle review/resolve
- Dùng cho các case khó, phụ thuộc, rủi ro deadline/chất lượng

## 6.8 Dashboard theo vai trò

- Creator: theo dõi case đã tiếp nhận, trạng thái phản hồi
- Dispatcher: backlog cần phân luồng/phân công, cân bằng tải
- Performer: việc đang xử lý, cảnh báo quá hạn/overrun
- Overview: KPI tổng hợp, top customer/project/user, attention list

## 6.9 Báo cáo pain points

Báo cáo phân tích các điểm nghẽn điển hình (ví dụ):
- Người xử lý quá tải
- Tỷ lệ billable thấp
- Sai lệch estimate cao
- Case kéo dài bất thường
- Kẹt trạng thái
- Tốn quá nhiều giờ họp
- Khách hàng có tải yêu cầu cao

---

## 7) Frontend chi tiết theo màn hình

## 7.1 Hub chính

`CustomerRequestManagementHub.tsx` giữ vai trò:
- Điều hướng giữa workspace + surface
- Đồng bộ filter/query state
- Mở modal tạo/sửa/chuyển trạng thái/escalation
- Gọi các hooks dữ liệu để tải list/detail/dashboard

## 7.2 List pane

Danh sách hiển thị các cột trọng tâm:
- Yêu cầu
- Phụ trách
- Trạng thái xử lý
- Giờ
- CTA
- Cập nhật

Hỗ trợ:
- Filter/search
- Sorting/pagination
- Quick actions theo vai trò và quyền

## 7.3 Analytics & dashboard

- KPI cards
- Top entities (khách hàng/dự án/người xử lý)
- Attention cases cần ưu tiên
- Biểu đồ trend theo kỳ

---

## 8) Backend chi tiết theo service

## 8.1 CaseDomainService (orchestration)

- Điều phối create/update/transition
- Gọi sub-services theo use case
- Chuẩn hóa payload/response

## 8.2 Registry (single source of truth)

- Khai báo status code, label, form fields, mapping bảng
- Tránh hardcode status rải rác nhiều nơi
- Là nền cho validation transition và metadata rendering

## 8.3 ReadQuery/ReadModel

- List/query/filter/pagination tối ưu
- Full detail model hóa dữ liệu phục vụ UI

## 8.4 Write/Execution

- Write: lưu case + status data + transitions
- Execution: worklog, estimate, warnings, giờ công

## 8.5 Dashboard/Report

- Dashboard role-based
- Reports theo giờ tháng/tuần, trend, pain points

## 8.6 Escalation/Plan services

- PlanService: CRUD plan + items + carry-over + backlog
- EscalationService: tạo/review/resolve + thống kê

---

## 9) Quyền truy cập và middleware

## 9.1 Permission

Module chạy trên nhóm quyền customer-request (read/write/transition/report/escalation tùy endpoint).

## 9.2 Middleware stack áp dụng

- Xác thực Sanctum cookie token
- Multi-tab session control (`TAB_EVICTED`)
- Enforce password change (nếu chưa đổi mật khẩu lần đầu)
- Permission guard theo route
- Request size/security headers

---

## 10) Điểm mạnh kỹ thuật và lưu ý

## 10.1 Điểm mạnh

1. Workflow có cấu hình status/transitions rõ ràng, dễ mở rộng
2. Audit trail mạnh nhờ status instances linked-list
3. Tách service theo trách nhiệm giúp dễ maintain
4. Kết hợp tốt giữa vận hành (dashboard) và cải tiến (pain points)

## 10.2 Lưu ý khi phát triển tiếp

1. Không hardcode status ngoài Registry
2. Báo cáo phải dựa trên status instance (không group thô theo status_code)
3. Khi thêm field mới cho status cần cập nhật đồng bộ:
   - migration
   - registry field config
   - serialization read model
   - validation write service
4. Khi thay đổi logic giờ công cần test lại:
   - overrun warning
   - plan item attribution
   - dashboard KPI consistency

---

## 11) Checklist test hồi quy đề xuất

1. Tạo case mới từ intake
2. Chuyển trạng thái theo luồng hợp lệ và chặn luồng sai
3. Ghi worklog nhiều lần, kiểm tra cộng dồn giờ
4. Đặt estimate nhỏ để verify trigger 70/90/100
5. Sửa estimate và verify reset warning flags
6. Tạo plan tuần/tháng, thêm worklog, kiểm tra attribution đúng ưu tiên
7. Tạo escalation, review, resolve, kiểm tra stats
8. Đối chiếu dashboard creator/dispatcher/performer/overview
9. Đối chiếu report monthly/weekly/trend/pain-points với dữ liệu mẫu

---

## 12) Tóm tắt nhanh

Customer Request Management trong QLCV là hệ workflow CRC theo kiến trúc nhiều lớp, có mô hình trạng thái rõ ràng (12 status), audit trail mạnh, quản trị estimate/worklog, kế hoạch tuần-tháng, escalation và hệ dashboard/report phục vụ vận hành. Đây là module nghiệp vụ trọng yếu cho việc chuẩn hóa xử lý yêu cầu khách hàng đầu-cuối trong hệ thống.