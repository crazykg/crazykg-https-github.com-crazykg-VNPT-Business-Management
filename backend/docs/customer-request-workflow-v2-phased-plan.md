# Customer Request Workflow V2 Phased Plan

Tài liệu này khóa phạm vi nâng cấp luồng `Quản lý yêu cầu KH` theo tài liệu nghiệp vụ
[Luồng cấu hình yêu cầu KH.md](/Users/pvro86gmail.com/Library/Mobile%20Documents/com~apple~CloudDocs/Temp%20trong%20nga%CC%80y/Lu%E1%BB%93ng%20c%E1%BA%A5u%20h%C3%ACnh%20y%C3%AAu%20c%E1%BA%A7u%20KH.md),
nhưng triển khai trên nền workflow động hiện có của repo.

## Mục tiêu tổng

- Không thay toàn bộ schema hiện tại trong một lần.
- Giữ tương thích với `customer_requests`, `workflow_status_catalogs`, `workflow_form_field_configs`, `request_transitions`.
- Chuyển dần từ frontend-driven workflow sang backend-driven workflow.
- Mỗi phase phải có thể deploy độc lập.

## Phase Status

| Phase | Mục tiêu | Trạng thái |
|---|---|---|
| 0 | Khóa mapping nghiệp vụ và hiện trạng | Done |
| 1 | Bổ sung transition config và quyền thao tác ở DB | Done |
| 2 | Workflow engine ở backend | Done |
| 3 | UI quản trị cấu hình workflow | Done |
| 4 | Refactor màn Quản lý yêu cầu KH theo action-driven UI | Done |
| 5 | Danh mục hỗ trợ động và bind workflow riêng | Done |
| 6 | Migration dữ liệu và compatibility | Done |
| 7 | SLA, thông báo, audit, báo cáo | Done |

## Phase 0

### 0.1. Hiện trạng repo

Nguồn hiện tại:
- Schema lõi: [2026_03_03_220000_customer_request_workflow_core.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_03_220000_customer_request_workflow_core.php)
- Service vận hành workflow: [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php)
- UI chính: [CustomerRequestManagementHub.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/components/CustomerRequestManagementHub.tsx)

Workflow hiện tại đang dùng cây trạng thái:

| Level | Status code | Tên hiển thị | Canonical |
|---|---|---|---|
| 1 | `MOI_TIEP_NHAN` | Mới tiếp nhận | `MOI_TIEP_NHAN` |
| 1 | `DOI_PHAN_HOI_KH` | Đợi phản hồi từ khách hàng | `DOI_PHAN_HOI_KH` |
| 1 | `DANG_XU_LY` | Đang xử lý | `DANG_XU_LY` |
| 1 | `KHONG_THUC_HIEN` | Không thực hiện | `KHONG_THUC_HIEN` |
| 1 | `HOAN_THANH` | Hoàn thành | `HOAN_THANH` |
| 1 | `BAO_KHACH_HANG` | Báo khách hàng | `BAO_KHACH_HANG` |
| 1 | `CHUYEN_TRA_QL` | Chuyển trả người quản lý | `CHUYEN_TRA_QL` |
| 1 | `PHAN_TICH` | Phân tích | `PHAN_TICH` |
| 2 | `LAP_TRINH_GROUP` | Lập trình | `LAP_TRINH` |
| 3 | `LAP_TRINH_DANG_THUC_HIEN` | Đang thực hiện | `LAP_TRINH / DANG_THUC_HIEN` |
| 3 | `LAP_TRINH_HOAN_THANH` | Hoàn thành | `LAP_TRINH / HOAN_THANH` |
| 3 | `LAP_TRINH_UPCODE` | Upcode | `LAP_TRINH / UPCODE` |
| 3 | `LAP_TRINH_TAM_NGUNG` | Tạm ngưng | `LAP_TRINH / TAM_NGUNG` |
| 2 | `CHUYEN_DMS_GROUP` | Chuyển DMS | `CHUYEN_DMS` |
| 3 | `CHUYEN_DMS_TRAO_DOI` | Trao đổi | `CHUYEN_DMS / TRAO_DOI` |
| 3 | `CHUYEN_DMS_TAO_TASK` | Tạo task | `CHUYEN_DMS / TAO_TASK` |
| 3 | `CHUYEN_DMS_TAM_NGUNG` | Tạm ngưng | `CHUYEN_DMS / TAM_NGUNG` |
| 3 | `CHUYEN_DMS_HOAN_THANH` | Hoàn thành | `CHUYEN_DMS / HOAN_THANH` |

Nhận xét Phase 0:
- Repo hiện có workflow động theo catalog và field schema, nhưng chưa có lớp cấu hình transition/action riêng.
- Quyền thao tác vẫn còn nằm rải ở frontend và một phần trong controller validation.
- Quyền xem theo vai trò chưa được model hóa thành rule cấu hình.
- Các flow `Lập trình` và `Chuyển DMS` đã là nhánh con của `Phân tích`, đây là nền tốt để mở rộng sang mô hình workflow v2.

### 0.2. Mô hình mục tiêu từ tài liệu nghiệp vụ

Tài liệu nghiệp vụ mong muốn chuỗi trạng thái tổng quát:

`Mới tạo -> Chờ duyệt -> Đã duyệt -> Đang xử lý -> Hoàn thành -> Đóng`

Nhánh phụ:
- `Từ chối`
- `Trả lại`
- `Tạm dừng`

Quyền xem theo vai trò mục tiêu:
- Khách hàng
- Người nhập YC
- PM
- Người thực hiện
- Admin

### 0.3. Mapping mục tiêu sang workflow hiện có

Không áp dụng theo kiểu thay schema sang `request_status` / `request_workflow` mới ngay. Giai đoạn đầu sẽ map lên `workflow_status_catalogs` hiện có như sau:

| Trạng thái mục tiêu | Mapping tạm trên repo hiện tại | Ghi chú |
|---|---|---|
| Mới tạo | `MOI_TIEP_NHAN` | Repo chưa có draft riêng. Tạm coi `Mới tiếp nhận` là trạng thái đầu. |
| Chờ duyệt | Chưa có | Phase 1 cần bổ sung status catalog mới. |
| Đã duyệt | Chưa có | Phase 1 cần bổ sung status catalog mới hoặc model qua action trước khi vào `PHAN_TICH`/`DANG_XU_LY`. |
| Đang xử lý | `DANG_XU_LY` hoặc các nhánh con sau `PHAN_TICH` | Cần tách nghĩa business rõ giữa support handle và programming/DMS execution. |
| Hoàn thành | `HOAN_THANH`, `LAP_TRINH_HOAN_THANH`, `CHUYEN_DMS_HOAN_THANH` | Cần hợp nhất cách hiển thị/reporting. |
| Từ chối | Chưa có | Có thể mở rộng từ `KHONG_THUC_HIEN` nhưng khác nghĩa. Nên tạo mới. |
| Trả lại | `CHUYEN_TRA_QL` chỉ gần đúng | Không cùng nghĩa với `trả lại bổ sung`. Nên tạo mới. |
| Tạm dừng | `LAP_TRINH_TAM_NGUNG`, `CHUYEN_DMS_TAM_NGUNG` | Chưa có root pause chung. |
| Đóng | `BAO_KHACH_HANG` gần nghĩa, chưa phải closed thật sự | Nên tạo trạng thái đóng riêng. |

### 0.4. Các quyết định khóa trong Phase 0

1. Không thay `customer_requests` sang bảng mới `customer_request`.
2. Không bỏ `workflow_status_catalogs`; đây vẫn là nguồn trạng thái chính.
3. Sẽ thêm lớp `transition config` thay vì encode đường đi trạng thái bằng hardcode frontend.
4. Các trạng thái mới trong tài liệu sẽ được bổ sung dần vào `workflow_status_catalogs`.
5. `PHAN_TICH -> LAP_TRINH/CHUYEN_DMS` vẫn được giữ làm nhánh triển khai kỹ thuật.
6. Quyền xem và quyền thao tác sẽ do backend quyết định từ Phase 2 trở đi.

### 0.5. Gap analysis cần giải quyết

| Nhóm | Hiện tại | Thiếu |
|---|---|---|
| Transition | Chưa có bảng action/transition riêng | Cần bảng cấu hình action giữa các trạng thái |
| Permissions | Chủ yếu hardcode ở UI | Cần backend trả quyền thao tác và quyền xem |
| View matrix | Chưa model hóa | Cần rule theo vai trò |
| Approval flow | Chưa có `Chờ duyệt` / `Đã duyệt` | Cần thêm trạng thái và transition |
| Closed state | Chưa có trạng thái đóng thực sự | Cần thêm `Đóng` |
| Return flow | `CHUYEN_TRA_QL` chưa đủ nghĩa | Cần trạng thái trả lại riêng |
| Reporting | Badge/list phụ thuộc nhiều vào label frontend | Cần normalize qua backend |

### 0.6. Deliverables khóa cho Phase 1

Phase 1 phải bắt đầu từ các đầu việc sau:
- Thêm bảng transition config.
- Thêm bảng view rules hoặc một cấu trúc rule tương đương.
- Seed các trạng thái mới tối thiểu:
  - `CHO_DUYET`
  - `DA_DUYET`
  - `TU_CHOI`
  - `TRA_LAI`
  - `DONG`
- Chưa refactor frontend lớn ở phase này.
- Giữ compatibility với dữ liệu cũ.

## Phase 1

### Mục tiêu

Tạo lớp cấu hình chuyển trạng thái ở database để backend có thể trả `available_actions` một cách thống nhất.

### Thay đổi schema dự kiến

1. Bảng `workflow_status_transitions`
- `id`
- `from_status_catalog_id`
- `to_status_catalog_id`
- `action_code`
- `action_name`
- `required_role`
- `condition_json`
- `notify_targets_json`
- `sort_order`
- `is_active`
- audit columns

2. Bảng `workflow_status_view_rules`
- `id`
- `status_catalog_id`
- `viewer_role`
- `can_view`
- `sort_order`
- `is_active`

### Seed tối thiểu Phase 1

- `MOI_TIEP_NHAN -> CHO_DUYET`
- `CHO_DUYET -> DA_DUYET`
- `CHO_DUYET -> TU_CHOI`
- `CHO_DUYET -> TRA_LAI`
- `DA_DUYET -> PHAN_TICH` hoặc `DANG_XU_LY`
- `DANG_XU_LY -> HOAN_THANH`
- `HOAN_THANH -> DONG`

### API/backend dự kiến

Thêm trong [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php):
- loader transition config
- resolver `available_actions`
- resolver `viewer_role_context`
- helper validate transition hợp lệ

Controller liên quan:
- [V5MasterDataController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5MasterDataController.php)

### Không làm trong Phase 1

- Chưa refactor toàn bộ modal edit
- Chưa thay đổi full UI support master management
- Chưa migration dữ liệu cũ diện rộng

### Kết quả đã thực hiện

- Đã thêm migration tạo bảng:
  - `workflow_status_transitions`
  - `workflow_status_view_rules`
- Đã seed các trạng thái tối thiểu:
  - `CHO_DUYET`
  - `DA_DUYET`
  - `TU_CHOI`
  - `TRA_LAI`
  - `DONG`
- Đã seed transition config tối thiểu cho approval flow và close flow.
- Đã seed view rules tối thiểu theo ma trận quyền xem ở tài liệu.
- Đã thêm service scaffolding để:
  - liệt kê transition config
  - liệt kê view rules
  - resolve action khả dụng theo role
- Đã cập nhật `WorkflowFlowResolver` để các trạng thái mới không rơi về fallback.

## Phase 2

### Mục tiêu

Biến transition config ở database thành runtime engine thực tế ở backend.

### Kết quả đã thực hiện

- API `customer-requests` list/detail hiện trả thêm:
  - `available_actions`
  - `viewer_role_context`
  - `viewer_can_view`
- Backend hiện resolve role context theo request runtime:
  - `ADMIN`
  - `PM`
  - `EXECUTOR`
  - `CREATOR`
  - `OTHER`
- `viewer_execution_role` cũ vẫn được giữ để không làm vỡ logic UI đang dùng.
- `updateCustomerRequest` đã validate transition theo cấu hình trong `workflow_status_transitions`.
- Có compatibility guard:
  - nếu trạng thái hiện tại chưa có transition config thì backend vẫn giữ hành vi cũ, không khóa save.
- Đã thêm regression test cho:
  - role context
  - available actions
  - transition validation

## Phase 3

### Mục tiêu

Đưa cấu hình transition workflow lên màn quản trị để admin thao tác trực tiếp từ UI.

### Kết quả đã thực hiện

- Đã mở rộng API CRUD cho `workflow_status_transitions`.
- Đã thêm route:
  - list
  - create
  - update
- Đã bổ sung type và API frontend cho transition workflow.
- Đã mở rộng màn `Quản lý danh mục hỗ trợ` để:
  - xem danh sách transition
  - thêm transition mới
  - cập nhật transition hiện có
- Admin hiện cấu hình được:
  - trạng thái nguồn
  - trạng thái đích
  - `action_code`
  - `action_name`
  - `required_role`
  - `notify_targets`
  - `condition_json`
  - `sort_order`
  - `is_active`
- Đã thêm regression test cho CRUD transition qua API.

## Phase 4

### Mục tiêu

Refactor màn `Quản lý yêu cầu KH` để modal edit bắt đầu tiêu thụ contract backend `viewer_role_context` và `available_actions`, thay vì tiếp tục suy toàn bộ vai trò/thao tác ở client.

### Kết quả đã thực hiện

- Modal edit trong [CustomerRequestManagementHub.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/components/CustomerRequestManagementHub.tsx) hiện ưu tiên `viewer_role_context` từ backend để xác định ngữ cảnh người mở form.
- Logic `người giao việc` / `người nhận việc` ở selector `Trạng thái xử lý` đã chuyển sang dùng role context backend làm nguồn chính, client chỉ còn fallback khi draft thay đổi `receiver_user_id` hoặc `assignee_id` trên form.
- Mỗi request hiện trả thêm `has_configured_transitions`, để frontend biết khi nào phải áp ràng buộc transition theo config thay vì hành vi legacy.
- Khi trạng thái hiện tại đã có transition config:
  - option `Hướng xử lý` / `Trạng thái xử lý` không hợp lệ sẽ bị disable ngay trên form
  - `Lưu` sẽ bị chặn ở frontend nếu target status không nằm trong `available_actions`
  - message lỗi được đồng bộ theo action config backend
- Compatibility vẫn được giữ:
  - nếu trạng thái hiện tại chưa có transition config thì form vẫn vận hành như flow cũ
  - backend test cũ không có bảng `workflow_status_transitions` vẫn pass nhờ fallback an toàn trong serializer

## Phase 6

### Mục tiêu

Đảm bảo dữ liệu `customer_requests` cũ vẫn chạy được trên workflow engine mới, kể cả khi
`status_catalog_id` chưa được backfill hoặc đang lệch với cặp `status/sub_status`.

### Kết quả đã thực hiện

- Đã bổ sung compatibility layer trong
  [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php):
  - tự suy ra `status_catalog_id` hiệu lực từ `status/sub_status` khi dữ liệu cũ chưa có liên kết catalog
  - dùng `status_catalog_id` hiệu lực cho:
    - serialize row
    - `available_actions`
    - `viewer_role_context`
    - transition validation
- Đã bổ sung cache lookup runtime để tránh query lặp khi infer trạng thái legacy.
- Đã thêm migration backfill:
  [2026_03_13_183000_backfill_customer_request_status_catalog_ids.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_13_183000_backfill_customer_request_status_catalog_ids.php)
  với behavior:
  - chỉ chạy khi đủ bảng/cột liên quan
  - map `status/sub_status` sang `workflow_status_catalogs`
  - tự sửa các row:
    - `status_catalog_id` bị `null`
    - trỏ tới catalog không tồn tại
    - hoặc không khớp với runtime status hiện tại
- Đã thêm regression test:
  [CustomerRequestWorkflowCompatibilityPhaseSixTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestWorkflowCompatibilityPhaseSixTest.php)
  để khóa 3 hành vi:
  - list infer được `status_catalog_id` cho row legacy
  - transition validation dùng inferred catalog id thay vì lệ thuộc cột null
  - create vẫn nhận payload legacy chỉ có `status/sub_status`
- Đã kiểm tra compatibility suite và full test suite:
  - `php artisan test` pass
  - `npm run lint` pass

## Phase 5

### Mục tiêu

Cho phép từng `danh mục hỗ trợ` bind workflow riêng và form riêng, nhưng vẫn fallback an toàn về luồng mặc định nếu danh mục chưa cấu hình.

### Bước 1 đã thực hiện

- Đã bổ sung 2 field cấu hình trực tiếp trên `support_service_groups`:
  - `workflow_status_catalog_id`
  - `workflow_form_key`
- Đã mở rộng CRUD danh mục hỗ trợ trong
  [V5MasterDataController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5MasterDataController.php)
  để:
  - nhận và validate workflow bind
  - join tên workflow khi list/reload
  - round-trip đủ dữ liệu cho frontend quản trị
- Đã thêm migration:
  [2026_03_13_201000_add_workflow_binding_to_support_service_groups.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_13_201000_add_workflow_binding_to_support_service_groups.php)
- Đã mở rộng UI quản trị trong
  [SupportMasterManagement.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/components/SupportMasterManagement.tsx)
  để admin cấu hình:
  - workflow mặc định cho danh mục hỗ trợ
  - `form key override`
- Đã thêm regression test:
  [SupportServiceGroupWorkflowBindingTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/SupportServiceGroupWorkflowBindingTest.php)

### Bước 2 đã thực hiện

- Runtime resolver của `customer request create/update` giờ đã ưu tiên workflow bind theo `service_group_id`:
  - nếu payload không chỉ rõ `status_catalog_id` hoặc `status/sub_status`, service sẽ lấy workflow mặc định từ `support_service_groups`
  - nếu danh mục hỗ trợ chưa cấu hình workflow thì fallback an toàn về `MOI_TIEP_NHAN`
- Khi serialize request, backend hiện trả thêm metadata bind của danh mục hỗ trợ:
  - `service_group_workflow_status_catalog_id`
  - `service_group_workflow_status_code`
  - `service_group_workflow_status_name`
  - `service_group_workflow_form_key`
- `form_key` runtime của request sẽ ưu tiên `workflow_form_key` từ danh mục hỗ trợ nếu request đang đứng tại entry status được bind.
- Đã thêm regression test:
  [CustomerRequestServiceGroupWorkflowBindingRuntimeTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestServiceGroupWorkflowBindingRuntimeTest.php)
  để khóa các case:
  - create theo workflow bind
  - fallback mặc định khi không có bind
  - update thường không tự đổi trạng thái khi chỉ đổi danh mục hỗ trợ

### Bước 3 đã thực hiện

- Modal runtime ở
  [CustomerRequestManagementHub.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/components/CustomerRequestManagementHub.tsx)
  giờ đã nối `service_group_workflow_form_key` vào cơ chế resolve schema field.
- Cách resolve hiện tại:
  - lấy `workflow_form_key` từ danh mục hỗ trợ đang chọn
  - tìm `workflow_status_catalog` có cùng `form_key` và cùng `canonical status/sub_status` với trạng thái đang chọn
  - nếu tìm thấy thì dùng `workflow_form_field_configs` của catalog đó làm schema runtime
  - nếu không tìm thấy thì fallback về schema cũ của chính `status_catalog_id` đang chọn
- Nhờ đó, cùng một trạng thái runtime vẫn có thể dùng form schema khác nhau theo `danh mục hỗ trợ`, nhưng không làm vỡ dữ liệu cũ hay các trạng thái chưa được cấu hình riêng.

### Bước 4 đã thực hiện

- Đã thêm migration backfill:
  [2026_03_13_210000_backfill_support_service_group_workflow_defaults.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_13_210000_backfill_support_service_group_workflow_defaults.php)
- Migration chỉ backfill cho các nhóm hỗ trợ nhận diện rất rõ và giữ nguyên cấu hình admin đã có:
  - nhóm chứa token `DMS` sẽ được gợi ý bind tới `CHUYEN_DMS_GROUP` + `programming.chuyen_dms`
  - nhóm kỹ thuật như `HIS L3`, `HIS L34`, `UPCODE`, `HOÀN THIỆN PHẦN MỀM` sẽ được gợi ý bind tới `PHAN_TICH` + `programming.phan_tich`
  - nhóm `SMOKE/TEST` bị bỏ qua hoàn toàn
- Migration không overwrite cấu hình đã có:
  - nếu `workflow_status_catalog_id` hoặc `workflow_form_key` đang có giá trị khác heuristic thì bỏ qua row đó
  - chỉ tự điền phần còn thiếu khi phần đã có khớp với binding mặc định
- Đã thêm regression test:
  [SupportServiceGroupWorkflowBindingBackfillTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/SupportServiceGroupWorkflowBindingBackfillTest.php)

### Kết luận Phase 5

- Danh mục hỗ trợ hiện đã bind được workflow riêng và form riêng.
- Runtime create/list/edit đã đọc được bind này với fallback an toàn.
- Dữ liệu nhóm hỗ trợ cũ đã có lớp backfill mặc định đủ bảo thủ để dùng ngoài thực tế mà không đè cấu hình admin.

## Phase 7

### 7.1. SLA rule engine

Mục tiêu bước đầu của Phase 7 là để SLA không chỉ phụ thuộc `status/sub_status/priority`, mà còn có thể phụ thuộc thêm:
- `service_group_id`
- `workflow_action_code`

Điều này cho phép cùng một trạng thái đích nhưng SLA khác nhau theo:
- nhóm hỗ trợ
- action workflow như `APPROVE`, `ASSIGN_EXECUTOR`, `RETURN_FOR_UPDATE`

### Kết quả đã thực hiện

- Đã thêm cột mới vào `sla_configs`:
  - `service_group_id`
  - `workflow_action_code`
- Đã mở rộng
  [StatusDrivenSlaResolver.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/StatusDrivenSlaResolver.php)
  để ưu tiên theo thứ tự:
  - exact `sub_status` > wildcard
  - exact `service_group_id` > wildcard
  - exact `workflow_action_code` > wildcard
  - exact `request_type_prefix` > wildcard
- Đã mở rộng CRUD SLA trong
  [V5MasterDataController.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Http/Controllers/Api/V5MasterDataController.php)
  để:
  - lưu `service_group_id`
  - lưu `workflow_action_code`
  - trả thêm `service_group_name`
  - chống trùng theo full scope mới
- Đã mở rộng UI quản trị SLA trong
  [SupportMasterManagement.tsx](/Users/pvro86gmail.com/Downloads/QLCV/frontend/components/SupportMasterManagement.tsx):
  - chọn `Nhóm hỗ trợ`
  - chọn `Workflow action code`
  - hiển thị scope mới trực tiếp trên bảng
- Đã nối runtime transition của customer request để khi append transition:
  - truyền `service_group_id`
  - suy `workflow_action_code` từ `workflow_status_transitions`
  - resolve SLA theo rule cụ thể nhất

### Regression coverage

- [StatusDrivenSlaResolverTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/StatusDrivenSlaResolverTest.php)
  - exact `service_group_id` thắng wildcard
  - exact `workflow_action_code` thắng wildcard
  - exact `service_group_id + workflow_action_code` thắng rule chung hơn
- [SupportSlaConfigScopedCrudTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/SupportSlaConfigScopedCrudTest.php)
  - create/list/update round-trip cho SLA scoped
- [CustomerRequestSlaScopedResolutionPhaseSevenTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestSlaScopedResolutionPhaseSevenTest.php)
  - runtime transition dùng đúng SLA cụ thể nhất theo `service_group_id + action_code`

### 7.2. Notification routing

Mục tiêu bước này là biến `notify_targets_json` trong `workflow_status_transitions` thành runtime log thực tế để backend biết:
- transition nào cần thông báo
- cần thông báo cho vai trò nào
- người dùng thực tế nào được resolve từ các vai trò đó

### Kết quả đã thực hiện

- Đã thêm bảng log mới:
  [2026_03_13_230000_create_workflow_notification_logs_table.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_13_230000_create_workflow_notification_logs_table.php)
  với các field chính:
  - `customer_request_id`
  - `request_transition_id`
  - `request_code`
  - `action_code`
  - `target_role`
  - `recipient_user_id`
  - `channel`
  - `delivery_status`
  - `payload_json`
- Đã mở rộng runtime transition trong
  [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php)
  để sau khi ghi `request_transitions` sẽ tự:
  - đọc `notify_targets_json` từ transition config
  - resolve đúng transition theo `from_status_catalog_id + to_status_catalog_id + workflow_action_code`
  - resolve recipient thực theo role context:
    - `CREATOR` -> `created_by`
    - `PM` / `ASSIGNER` / `INITIAL_RECEIVER` -> `receiver_user_id`
    - `EXECUTOR` / `WORKER` -> `assignee_id`
    - `ADMIN` -> danh sách user có role `ADMIN`
  - ghi một dòng log cho mỗi recipient đã resolve
  - ghi log `SKIPPED` khi có target role nhưng không resolve được recipient

### Regression coverage

- [CustomerRequestNotificationRoutingPhaseSevenTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestNotificationRoutingPhaseSevenTest.php)
  - PM/Executor/Creator/Admin được resolve đúng recipient khi update transition
  - target role không resolve được recipient sẽ sinh log `SKIPPED`
  - khi nhiều transition cùng đi tới một trạng thái đích, backend sẽ chọn đúng transition theo `workflow_action_code`

### Phase tiếp theo đề xuất trong Phase 7

Sau notification routing, bước nên làm tiếp là **7.3 Audit enrichment**:
- chuẩn hóa audit action theo `workflow_action_code`
- ghi rõ `from_status_catalog_id`, `to_status_catalog_id`, `viewer_role_context`, `reason`
- liên kết `request_transitions` với `workflow_notification_logs`
- chuẩn bị dữ liệu đầu vào sạch cho dashboard/reporting ở bước sau

### 7.3. Audit enrichment

Mục tiêu bước này là chuẩn hóa lớp dữ liệu audit cho workflow để các bước sau có thể dùng thẳng cho history, dashboard và reporting mà không phải suy lại từ logic nghiệp vụ.

### Kết quả đã thực hiện

- Đã thêm migration:
  [2026_03_13_231500_add_audit_columns_to_request_transitions.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/database/migrations/2026_03_13_231500_add_audit_columns_to_request_transitions.php)
  để bổ sung các cột chuẩn hóa trên `request_transitions`:
  - `from_status_catalog_id`
  - `to_status_catalog_id`
  - `workflow_action_code`
  - `workflow_reason`
  - `viewer_role_context_json`
- Đã mở rộng runtime append transition trong
  [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php)
  để:
  - chuẩn hóa `workflow_reason`
  - lưu `viewer_role_context` của actor tại thời điểm chuyển bước
  - enrich `transition_metadata` với envelope chuẩn hóa
  - ghi một audit event riêng vào `audit_logs` cho mỗi `request_transition`
  - gắn `notification_summary` vào audit payload để trace lại kết quả notify theo từng transition
- Đã nối `request_transitions` với `workflow_notification_logs` ở lớp read model:
  - `history()` và feed histories giờ trả thêm `notification_summary`
  - mỗi transition feed có đủ:
    - `from_status_catalog_id`
    - `to_status_catalog_id`
    - `workflow_action_code`
    - `workflow_reason`
    - `viewer_role_context`
    - `notification_summary`

### Regression coverage

- [CustomerRequestWorkflowAuditEnrichmentPhaseSevenTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestWorkflowAuditEnrichmentPhaseSevenTest.php)
  - update sinh đủ cột audit chuẩn hóa trên `request_transitions`
  - audit log lưu đúng `workflow_action_code`, `workflow_reason`, `notification_summary`
  - history trả ra đúng `viewer_role_context` và `notification_summary`

### Phase tiếp theo đề xuất trong Phase 7

Sau audit enrichment, bước nên làm tiếp là **7.4 Dashboard/reporting foundation**:
- xây query/report tổng hợp theo `workflow_action_code`, `service_group_id`, `viewer_role_context`
- đếm SLA breach theo action và trạng thái đích
- tổng hợp notification resolved/skipped theo transition
- chuẩn bị API/dashboard cho PM và admin

### 7.4. Dashboard/reporting foundation

Mục tiêu bước này là cung cấp lớp dữ liệu tổng hợp đủ gọn để PM/admin dựng dashboard và export báo cáo mà không phải join lại nhiều bảng workflow ở frontend.

### Kết quả đã thực hiện

- Đã thêm summary API cho yêu cầu khách hàng:
  - `GET /api/v5/customer-requests/dashboard-summary`
  - `GET /api/v5/customer_requests/dashboard_summary` (alias deprecated)
- Đã thêm export CSV cho tập aggregate:
  - `GET /api/v5/customer-requests/dashboard-summary/export`
  - `GET /api/v5/customer_requests/dashboard_summary/export` (alias deprecated)
- Đã mở rộng
  [CustomerRequestWorkflowService.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/app/Services/V5/Workflow/CustomerRequestWorkflowService.php)
  để:
  - normalize filter report theo `q`, `status`, `sub_status`, `service_group_id`, `workflow_action_code`, `to_status_catalog_id`, `date_from`, `date_to`
  - tổng hợp dataset phẳng theo tổ hợp:
    - `workflow_action_code`
    - `service_group_id`
    - `to_status_catalog_id`
  - tính sẵn metric cho từng row:
    - `transition_count`
    - `sla_tracked_count`
    - `sla_breached_count`
    - `sla_on_time_count`
    - `notification_total`
    - `notification_resolved`
    - `notification_skipped`
  - suy ra các summary block:
    - `by_action`
    - `by_service_group`
    - `by_target_status`
    - `totals`
    - `notifications`
    - `sla`
- Dataset aggregate hiện là nền dùng chung cho:
  - PM/admin dashboard
  - CSV summary export
  - các bước drill-down/reporting sau này
- Đã mở rộng contract frontend ở:
  - [types.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/types.ts)
  - [v5Api.ts](/Users/pvro86gmail.com/Downloads/QLCV/frontend/services/v5Api.ts)
  để sẵn sàng nối dashboard UI ở bước sau.

### Regression coverage

- [CustomerRequestDashboardSummaryPhaseSevenTest.php](/Users/pvro86gmail.com/Downloads/QLCV/backend/tests/Feature/CustomerRequestDashboardSummaryPhaseSevenTest.php)
  - aggregate đúng theo `workflow_action_code`, `service_group_id`, `to_status_catalog_id`
  - tính đúng `SLA breach/on-time`
  - tính đúng `notification resolved/skipped`
  - export CSV dùng đúng compact dataset theo filter

### Phase tiếp theo đề xuất sau Phase 7

Sau khi hoàn tất nền aggregate/report, bước nên làm tiếp là **Phase 8: Dashboard UI và drill-down báo cáo**:
- dựng card/tables/charts cho PM và admin dựa trên summary API mới
- thêm drill-down từ aggregate row về danh sách request/transitions tương ứng
- nối export summary ngay trong UI dashboard
- chốt scope hiển thị theo role PM/admin và theo nhóm hỗ trợ

## Tiêu chí hoàn thành Phase 0

- Mapping hiện trạng và mục tiêu đã được khóa.
- Đã xác định rõ phần nào giữ lại, phần nào bổ sung.
- Đã khóa đầu việc cụ thể cho Phase 1.
