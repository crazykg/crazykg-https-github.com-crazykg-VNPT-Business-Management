# Bổ sung import/export Excel cho Quản lý yêu cầu khách hàng

## 1. Mục tiêu

Thiết kế mẫu Excel để người dùng có thể:
- tải file mẫu từ màn hình `customer-request-management`
- điền dữ liệu tạo mới yêu cầu hàng loạt
- import vào hệ thống với validation rõ ràng
- export danh sách yêu cầu ra Excel theo đúng nhóm thông tin nghiệp vụ

Phạm vi của file mẫu bám theo form **Tạo yêu cầu mới** hiện tại tại `frontend/components/customer-request/CustomerRequestCreateModal.tsx` và payload tạo mới tại `frontend/components/CustomerRequestManagementHub.tsx`.

## 2. Căn cứ từ UI/logic hiện tại

### 2.1. Nhóm field master của form tạo mới
Nguồn chuẩn hiện tại nằm ở `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php`:
- `project_item_id` — Khách hàng | Dự án | Sản phẩm
- `summary` — Nội dung yêu cầu (**bắt buộc**)
- `customer_id` — Khách hàng
- `customer_personnel_id` — Người yêu cầu
- `support_service_group_id` — Kênh tiếp nhận
- `source_channel` — Kênh khác
- `priority` — Độ ưu tiên
- `description` — Mô tả chi tiết

Lưu ý:
- `project_id` và `product_id` là hidden field, hiện được suy ra từ `project_item_id`, không nên yêu cầu người dùng nhập trực tiếp trong file import.
- UI hiện có cascade:
  - chọn `project_item_id` có thể tự điền `customer_id`
  - chọn `customer_id` có thể lọc `customer_personnel_id`, `support_service_group_id`, `project_item_id`
- Vì vậy file import nên ưu tiên nhập theo **mã nghiệp vụ dễ tra cứu**, không nhập trực tiếp ID DB.

### 2.2. Nhóm field luồng tạo mới (create flow)
Nguồn tại `frontend/components/customer-request/createFlow.ts`:
- `handlingMode`: `self_handle` | `assign_dispatcher`
- `performerUserId`
- `dispatcherUserId`
- `initialEstimatedHours`
- `estimateNote`

Ý nghĩa nghiệp vụ:
- Nếu chọn tự xử lý (`self_handle`) thì cần người xử lý.
- Nếu chọn chuyển PM (`assign_dispatcher`) thì cần PM điều phối.
- Estimate ban đầu là bước follow-up sau khi tạo case, nhưng về trải nghiệm import nên cho phép nhập ngay trong cùng file.

### 2.3. Nhóm task liên quan
Nguồn tại `frontend/components/CustomerRequestManagementHub.tsx`:
- IT360 task:
  - `task_source = IT360`
  - `task_code`
  - `task_link`
  - `task_status` = `TODO | IN_PROGRESS | DONE | CANCELLED | BLOCKED`
- Reference task:
  - `task_source = REFERENCE`
  - `task_code` hoặc `id`

### 2.4. Workflow chọn khi tạo mới
Nguồn tại `CustomerRequestCreateModal.tsx`:
- người dùng có thể chọn `workflow_definition_id`
- workflow được load từ `getWorkflows('customer_request', false)`

Với import Excel, không nên bắt người dùng nhập `workflow_definition_id` dạng số nguyên. Nên dùng:
- `workflow_code` hoặc `workflow_name`
- backend/frontend sẽ map sang workflow active tương ứng

## 3. Đề xuất thiết kế workbook Excel mẫu

Đề xuất dùng **1 workbook nhiều sheet**, tương thích với pattern import/export hiện có của repo (`frontend/utils/excelTemplate.ts`, `frontend/utils/importParser.ts`).

### 3.1. Sheet chính: `YeuCauNhap`
Đây là sheet người dùng nhập dữ liệu tạo yêu cầu.

#### Cột đề xuất
| STT | Cột tiếng Việt | Field nội bộ | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| 1 | Mã dòng | import_row_code | Không | Chỉ để đối soát file import |
| 2 | Mã khách hàng | customer_code | Có* | Bắt buộc nếu không nhập Mã hạng mục |
| 3 | Tên khách hàng | customer_name | Không | Chỉ để tham chiếu, không dùng làm khóa chính |
| 4 | Mã hạng mục/Dự án/SP | project_item_code | Có* | Ưu tiên dùng để map `project_item_id`; nếu có thì tự suy ra khách hàng |
| 5 | Tên hạng mục/Dự án/Sản phẩm | project_item_name | Không | Chỉ để người dùng đọc |
| 6 | Người yêu cầu | requester_name | Không | Chỉ để người dùng đọc/đối chiếu |
| 7 | Mã nhân sự liên hệ | customer_personnel_code | Không | Map sang `customer_personnel_id` |
| 8 | Kênh tiếp nhận | support_service_group_code | Không | Map sang `support_service_group_id` |
| 9 | Kênh khác | source_channel | Không | Chỉ nhập khi cần diễn giải thêm |
| 10 | Nội dung yêu cầu | summary | Có | Map thẳng field `summary` |
| 11 | Mô tả chi tiết | description | Không | Map thẳng field `description` |
| 12 | Độ ưu tiên | priority_label | Không | Nhập: Thấp / Trung bình / Cao / Khẩn |
| 13 | Hướng xử lý | handling_mode | Không | `TU_XU_LY` hoặc `CHUYEN_PM` |
| 14 | Mã người xử lý | performer_user_code | Có điều kiện | Bắt buộc nếu `handling_mode = TU_XU_LY` |
| 15 | Mã PM điều phối | dispatcher_user_code | Có điều kiện | Bắt buộc nếu `handling_mode = CHUYEN_PM` |
| 16 | Estimate ban đầu (giờ) | initial_estimated_hours | Không | Số > 0 nếu nhập |
| 17 | Ghi chú estimate | estimate_note | Không | Gắn vào payload estimate |
| 18 | Mã workflow | workflow_code | Không | Nếu bỏ trống dùng workflow active mặc định |
| 19 | Task IT360 1 - Mã task | it360_task_code_1 | Không | Hỗ trợ 2-3 cột lặp cố định nếu muốn sheet đơn |
| 20 | Task IT360 1 - Link | it360_task_link_1 | Không | |
| 21 | Task IT360 1 - Trạng thái | it360_task_status_1 | Không | TODO / IN_PROGRESS / DONE / CANCELLED / BLOCKED |
| 22 | Task tham chiếu 1 - Mã YC/task | reference_task_code_1 | Không | |
| 23 | Ghi chú import | import_note | Không | Không lưu DB, chỉ phục vụ người dùng |

**Khuyến nghị thực thi:**
- Sheet `YeuCauNhap` nên giữ ở mức **1 dòng = 1 yêu cầu**.
- Chỉ hỗ trợ số lượng task liên quan nhỏ trong sheet chính (ví dụ 1 IT360 + 1 reference task), hoặc tách sang sheet con để linh hoạt hơn.

### 3.2. Sheet con: `YeuCauTasks`
Dùng khi muốn import nhiều task liên quan cho một yêu cầu.

#### Cột đề xuất
| Cột tiếng Việt | Field trung gian | Bắt buộc | Ghi chú |
|---|---|---|---|
| Mã dòng | import_row_code | Có | Liên kết về sheet `YeuCauNhap` |
| Loại task | task_source | Có | `IT360` hoặc `REFERENCE` |
| Mã task | task_code | Có | |
| Link task | task_link | Không | Chỉ dùng cho IT360 |
| Trạng thái task | task_status | Không | Chỉ dùng cho IT360 |
| Thứ tự | sort_order | Không | Nếu muốn giữ thứ tự hiển thị |

**Ưu điểm:**
- scale tốt hơn sheet chính
- đúng với payload `ref_tasks[]`
- dễ mở rộng nếu sau này cần import nhiều task trên 1 yêu cầu

**Khuyến nghị:** nên chọn phương án này thay vì nhồi nhiều nhóm cột task vào 1 dòng.

### 3.3. Các sheet danh mục tham chiếu
Để người dùng điền đúng mã, file mẫu nên đính kèm các sheet read-only sau:

#### `KhachHang`
- `Mã khách hàng`
- `Tên khách hàng`
- `ID` (ẩn hoặc để cuối sheet)

#### `HangMucDuAnSanPham`
- `Mã hạng mục`
- `Tên hạng mục`
- `Mã khách hàng`
- `Tên khách hàng`
- `Mã dự án`
- `Tên dự án`
- `Mã sản phẩm`
- `Tên sản phẩm`

#### `NhanSuLienHe`
- `Mã nhân sự liên hệ`
- `Họ và tên`
- `Mã khách hàng`
- `Email`
- `SĐT`

#### `KenhTiepNhan`
- `Mã kênh`
- `Tên kênh`
- `Mã khách hàng` (nếu có ràng buộc theo KH)

#### `NhanSuNoiBo`
- `Mã nhân sự`
- `Họ tên`
- `Username`
- `Vai trò gợi ý`

#### `Workflow`
- `Mã workflow`
- `Tên workflow`
- `Active`
- `Default`

#### `HuongDan`
Sheet mô tả ngắn:
- cột nào bắt buộc
- giá trị hợp lệ cho Độ ưu tiên
- giá trị hợp lệ cho Hướng xử lý
- giá trị hợp lệ cho trạng thái IT360
- quy tắc chọn giữa `Mã khách hàng` và `Mã hạng mục/Dự án/SP`

## 4. Mẫu dữ liệu gợi ý cho file template

### 4.1. Sheet `YeuCauNhap`
| Mã dòng | Mã khách hàng | Tên khách hàng | Mã hạng mục/Dự án/SP | Tên hạng mục/Dự án/Sản phẩm | Người yêu cầu | Mã nhân sự liên hệ | Kênh tiếp nhận | Kênh khác | Nội dung yêu cầu | Mô tả chi tiết | Độ ưu tiên | Hướng xử lý | Mã người xử lý | Mã PM điều phối | Estimate ban đầu (giờ) | Ghi chú estimate | Mã workflow |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|---|
| YC001 | KH001 | Công ty A | PI001 | CRM | Nguyễn Văn A | NSLH001 | EMAIL |  | Khách hàng đề nghị bổ sung trường MST trên màn hình hợp đồng | Cần hiển thị và lưu được MST khi chỉnh sửa hợp đồng | Cao | TU_XU_LY | NV001 |  | 4 | Estimate sơ bộ từ người tiếp nhận | WF_CRC_DEFAULT |
| YC002 | KH002 | Công ty B | PI045 | DMS | Trần Thị B | NSLH010 | HOTLINE | Zalo OA | Khách hàng báo lỗi đồng bộ đơn hàng | Lỗi phát sinh từ 8h sáng, cần kiểm tra log tích hợp | Khẩn | CHUYEN_PM |  | PM003 | 8 | Cần PM phân công BA/dev | WF_CRC_DEFAULT |

### 4.2. Sheet `YeuCauTasks`
| Mã dòng | Loại task | Mã task | Link task | Trạng thái task | Thứ tự |
|---|---|---|---|---|---:|
| YC001 | IT360 | IT360-1234 | https://it360.local/task/1234 | IN_PROGRESS | 1 |
| YC001 | REFERENCE | CRC-202603-0012 |  |  | 2 |
| YC002 | IT360 | IT360-5678 | https://it360.local/task/5678 | TODO | 1 |

## 5. Mapping import đề xuất

## 5.1. Mapping master payload
- `project_item_code` → tra cứu `project_item_id`
- `customer_code` → tra cứu `customer_id`
- `customer_personnel_code` → tra cứu `customer_personnel_id`
- `support_service_group_code` → tra cứu `support_service_group_id`
- `summary` → `summary`
- `description` → `description`
- `source_channel` → `source_channel`
- `priority_label`:
  - Thấp → `1`
  - Trung bình → `2`
  - Cao → `3`
  - Khẩn → `4`
- `workflow_code` → tra cứu `workflow_definition_id`

## 5.2. Mapping create flow
- `handling_mode = TU_XU_LY` → `dispatch_route = self_handle`
- `handling_mode = CHUYEN_PM` → `dispatch_route = assign_pm`
- `performer_user_code` → `performer_user_id`
- `dispatcher_user_code` → `dispatcher_user_id`
- `initial_estimated_hours` + `estimate_note` → payload estimate sau khi tạo case

## 5.3. Mapping task liên quan
Từ sheet `YeuCauTasks` nhóm theo `import_row_code`:
- `task_source = IT360`:
  - `task_code`
  - `task_link`
  - `task_status`
- `task_source = REFERENCE`:
  - `task_code`

Kết quả map về:
```json
ref_tasks: [
  {
    "task_source": "IT360",
    "task_code": "IT360-1234",
    "task_link": "https://...",
    "task_status": "IN_PROGRESS"
  },
  {
    "task_source": "REFERENCE",
    "task_code": "CRC-202603-0012"
  }
]
```

## 6. Rule validation đề xuất

### 6.1. Validation bắt buộc
Mỗi dòng import tối thiểu phải hợp lệ các điều kiện sau:
- có `summary`
- có ít nhất một trong hai:
  - `project_item_code`
  - hoặc `customer_code`
- nếu `handling_mode = TU_XU_LY` thì phải có `performer_user_code`
- nếu `handling_mode = CHUYEN_PM` thì phải có `dispatcher_user_code`
- nếu có `initial_estimated_hours` thì phải > 0

### 6.2. Validation tham chiếu
- `customer_code` phải tồn tại trong danh mục khách hàng
- `project_item_code` phải tồn tại trong danh mục hạng mục
- nếu nhập cả `customer_code` và `project_item_code` thì hai giá trị phải cùng một khách hàng
- `customer_personnel_code` phải thuộc đúng khách hàng (nếu có customer context)
- `support_service_group_code` phải hợp lệ theo customer hiện tại hoặc là nhóm dùng chung
- `performer_user_code` / `dispatcher_user_code` phải map được sang nhân sự nội bộ
- `workflow_code` phải tồn tại và đang active, nếu không thì fallback workflow mặc định hoặc báo lỗi (cần chốt rule)

### 6.3. Validation giá trị enum
- `priority_label` chỉ nhận: `Thấp`, `Trung bình`, `Cao`, `Khẩn`
- `handling_mode` chỉ nhận: `TU_XU_LY`, `CHUYEN_PM`
- `task_source` chỉ nhận: `IT360`, `REFERENCE`
- `task_status` chỉ nhận: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`, `BLOCKED`

## 7. Luồng import đề xuất

### Pha 1 — tải file mẫu
Frontend tạo workbook bằng `downloadExcelWorkbook(...)` giống các module import khác trong repo.

### Pha 2 — đọc file
Dùng parser hiện có `parseImportFile(...)` để hỗ trợ `.xlsx`, `.xls`, `.csv` nếu cần.

### Pha 3 — preview và validate client-side
- chọn sheet `YeuCauNhap`
- đọc thêm `YeuCauTasks` nếu có
- hiển thị preview 10-20 dòng đầu
- validate header bắt buộc
- validate enum cơ bản
- validate mapping tham chiếu nếu frontend đã có sẵn dataset

### Pha 4 — import server-side
Khuyến nghị endpoint mới:
- `POST /api/v5/customer-request-cases/import`

Payload đề xuất:
```json
{
  "rows": [
    {
      "import_row_code": "YC001",
      "master": {
        "customer_id": 1,
        "project_item_id": 5,
        "customer_personnel_id": 10,
        "support_service_group_id": 3,
        "summary": "...",
        "description": "...",
        "priority": 3,
        "source_channel": null,
        "workflow_definition_id": 2,
        "dispatch_route": "self_handle",
        "performer_user_id": 12
      },
      "estimate": {
        "estimated_hours": 4,
        "estimate_scope": "total",
        "estimate_type": "creator_initial",
        "note": "Estimate sơ bộ từ import",
        "sync_master": true
      },
      "ref_tasks": [
        {
          "task_source": "IT360",
          "task_code": "IT360-1234",
          "task_link": "https://...",
          "task_status": "IN_PROGRESS"
        }
      ]
    }
  ]
}
```

### Pha 5 — phản hồi kết quả
Response nên cùng pattern các module import khác:
- số dòng thành công
- danh sách lỗi theo dòng
- cho phép xuất file lỗi với cột `Lý do lỗi`

## 8. Luồng export đề xuất

### 8.1. Export danh sách yêu cầu
Sheet `DanhSachYeuCau` nên có:
- Mã yêu cầu
- Khách hàng
- Hạng mục/Dự án/Sản phẩm
- Người yêu cầu
- Kênh tiếp nhận
- Nội dung yêu cầu
- Độ ưu tiên
- Trạng thái hiện tại
- Người tiếp nhận
- PM điều phối
- Người thực hiện
- Estimate
- Tổng giờ thực tế
- Ngày tạo
- Cập nhật cuối

### 8.2. Export chi tiết task liên quan
Sheet `TaskLienQuan`:
- Mã yêu cầu
- Loại task
- Mã task
- Link task
- Trạng thái task

### 8.3. Export chế độ template
Nút “Tải file mẫu import” nên sinh workbook gồm:
- `YeuCauNhap`
- `YeuCauTasks`
- `KhachHang`
- `HangMucDuAnSanPham`
- `NhanSuLienHe`
- `KenhTiepNhan`
- `NhanSuNoiBo`
- `Workflow`
- `HuongDan`

## 9. Quyết định thiết kế cần chốt trước khi code

1. Có cho import chỉ bằng `customer_code` mà không có `project_item_code` không?
   - Đề xuất: **Có**, để hỗ trợ yêu cầu chung chưa gắn hạng mục.

2. Nếu `workflow_code` để trống thì xử lý thế nào?
   - Đề xuất: tự gán workflow active mặc định.

3. Nếu 1 dòng có nhiều task liên quan thì dùng cột lặp hay sheet con?
   - Đề xuất: **sheet con `YeuCauTasks`**.

4. Có import attachment không?
   - Đề xuất: **Chưa** trong pha đầu. Attachment phức tạp hơn vì liên quan upload file thật.

5. Có cho import trực tiếp trạng thái ngoài `new_intake` không?
   - Đề xuất: **Không**. Pha đầu chỉ tạo mới ở trạng thái đầu vào, bám sát flow hiện tại.

## 10. Đề xuất phạm vi triển khai phase 1

### Phase 1A — Template + preview
- thêm nút tải file mẫu
- sinh workbook nhiều sheet
- mở modal import + preview sheet `YeuCauNhap`

### Phase 1B — Import create mới
- parse workbook
- validate dữ liệu
- gọi API import hoặc import tuần tự
- hỗ trợ file lỗi

### Phase 1C — Export danh sách yêu cầu
- export danh sách case hiện tại
- export sheet task liên quan

## 11. Khuyến nghị implementation

### Frontend
Tận dụng lại các utility đã có:
- `frontend/utils/excelTemplate.ts`
- `frontend/utils/importParser.ts`
- `frontend/utils/importValidation.ts`

Nên thêm mới:
- `frontend/utils/customerRequestImportTemplate.ts`
- `frontend/utils/customerRequestImportMapper.ts`
- `frontend/utils/customerRequestImportValidation.ts`

### Backend
Nên thêm mới:
- endpoint import bulk cho customer request
- service normalize row import → payload create case
- validate theo mã nghiệp vụ thay vì bắt frontend gửi raw ID

## 12. Kết luận

Phương án phù hợp nhất với UI hiện tại là:
- **1 sheet chính `YeuCauNhap` cho dữ liệu yêu cầu**
- **1 sheet con `YeuCauTasks` cho task liên quan**
- **nhiều sheet danh mục tra cứu** để người dùng nhập đúng mã

Thiết kế này bám sát:
- field tạo mới trong registry backend
- create flow hiện tại của frontend
- cấu trúc payload `ref_tasks` đang dùng
- pattern import/export Excel sẵn có trong codebase

Do đó có thể triển khai theo hướng ít phá vỡ kiến trúc hiện tại và tái sử dụng tối đa utility import/export sẵn có.
