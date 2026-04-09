# Kế hoạch export/import Excel cho Customer Request (trạng thái Tiếp nhận)

**Date:** 2026-04-09  
**Module:** `/customer-request-management`  
**Mục tiêu trạng thái khi import:** `new_intake` (Tiếp nhận)

---

## 1) Mục tiêu

1. Cho phép người dùng tải file mẫu Excel từ màn hình `customer-request-management`.
2. Cho phép import danh sách yêu cầu từ Excel và tạo mới case ở trạng thái **Tiếp nhận**.
3. Cho phép export danh sách yêu cầu hiện có ra Excel để đối soát.
4. Có validation rõ ràng theo từng dòng, trả lỗi dễ sửa.

---

## 2) Phạm vi phase 1

### Trong phạm vi
- Export danh sách yêu cầu ra `.xlsx`.
- Download template import `.xlsx`.
- Import tạo mới yêu cầu (không update case cũ).
- Case tạo mới luôn vào trạng thái `new_intake`.
- Hỗ trợ task liên quan mức cơ bản (IT360/REFERENCE) theo sheet phụ.
- Xử lý partial success theo dòng.

### Ngoài phạm vi (phase sau)
- Import attachment/file đính kèm.
- Import để cập nhật trạng thái khác `new_intake`.
- Import update case đã tồn tại theo `request_code`.
- Import async bằng queue/background job.

---

## 3) Thiết kế workbook import

## 3.1 Sheet chính: `YeuCauNhap`

Mỗi dòng = 1 yêu cầu cần tạo mới.

### Cột bắt buộc tối thiểu
1. `summary` (Nội dung yêu cầu)  
2. `project_item_code` **hoặc** `customer_code`

### Cột khuyến nghị dùng trong phase 1
- `import_row_code`
- `customer_code`
- `project_item_code`
- `customer_personnel_code`
- `support_service_group_code`
- `source_channel`
- `summary`
- `description`
- `priority_label` (`Thấp|Trung bình|Cao|Khẩn`)
- `receiver_user_code` (nếu muốn gán người tiếp nhận ngay)
- `creator_user_code` (nếu cần override người tạo; mặc định lấy user đăng nhập)

## 3.2 Sheet phụ: `YeuCauTasks` (khuyến nghị)

- `import_row_code`
- `task_source` (`IT360|REFERENCE`)
- `task_code`
- `task_link` (bắt buộc khi `task_source=IT360`)
- `task_status` (`TODO|IN_PROGRESS|DONE|CANCELLED|BLOCKED`)

## 3.3 Sheet danh mục tra cứu (read-only)

- `KhachHang`
- `HangMucDuAnSanPham`
- `NhanSuLienHe`
- `KenhTiepNhan`
- `NhanSuNoiBo`
- `NhomHoTro`
- `HuongDan`

## 3.4 Quy tắc dropdown trong file template

- File template `.xlsx` phải cấu hình dropdown ngay trong workbook (Excel Data Validation).
- Dropdown lấy dữ liệu từ các sheet danh mục tra cứu (ưu tiên qua named range), không hard-code text trong từng ô nhập liệu.
- Mapping dropdown bắt buộc:
  - `customer_code` -> `KhachHang`
  - `project_item_code` -> `HangMucDuAnSanPham`
  - `customer_personnel_code` -> `NhanSuLienHe`
  - `support_service_group_code` -> `NhomHoTro`
  - `source_channel` -> `KenhTiepNhan`
  - `receiver_user_code` và `creator_user_code` -> `NhanSuNoiBo`
- `priority_label` và enum task (`task_source`, `task_status`) dùng dropdown chuẩn để giảm lỗi nhập tay.

## 3.5 Data dictionary cột import (phase 1)

| Cột | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| import_row_code | string | Không | <= 50 ký tự, unique trong file nếu có |
| summary | string | Có | 1..500 ký tự |
| description | string | Không | <= 5000 ký tự |
| customer_code | string | Có* | Bắt buộc nếu không có `project_item_code` |
| project_item_code | string | Có* | Bắt buộc nếu không có `customer_code` |
| customer_personnel_code | string | Không | Phải thuộc customer tương ứng |
| support_service_group_code | string | Không | Phải map được danh mục |
| source_channel | string | Không | Phải map được danh mục kênh |
| priority_label | string | Không | `Thấp|Trung bình|Cao|Khẩn`, mặc định `Trung bình` |
| receiver_user_code | string | Không | Phải map được user active |
| creator_user_code | string | Không | Chỉ cho phép nếu user import có quyền override |

---

## 4) Mapping dữ liệu import vào payload tạo mới

## 4.1 Mapping field chính
- `summary` -> `summary`
- `description` -> `description`
- `source_channel` -> `source_channel`
- `priority_label` -> `priority` (1..4)
- `customer_code` -> `customer_id`
- `project_item_code` -> `project_item_id`
- `customer_personnel_code` -> `customer_personnel_id`
- `support_service_group_code` -> `support_service_group_id`

## 4.2 Rule trạng thái khi tạo
- Luôn set trạng thái khởi tạo là `new_intake`.
- Không nhận cột status từ file import (nếu có thì bỏ qua + warning policy).
- Trước khi import phải kiểm tra `new_intake` tồn tại trong status catalog theo workflow hiện hành.
- Nếu workflow hiện hành không có `new_intake` -> chặn toàn file với lỗi policy.

## 4.3 Task liên quan
- Nhóm theo `import_row_code` để build `ref_tasks[]`.
- `task_source=IT360` bắt buộc có `task_link`.
- `task_source=REFERENCE` không yêu cầu `task_link`.

## 4.4 Rule chống trùng (idempotency nhẹ)
- Trong cùng 1 file: không cho trùng `import_row_code` (nếu cột này được nhập).
- Giữa các lần import: phase 1 chưa dedupe theo business key, chấp nhận tạo mới.
- Cảnh báo người dùng: import lại file có thể tạo duplicate case.

---

## 5) Validation bắt buộc

## 5.1 Validation cấu trúc file
- Có sheet `YeuCauNhap`.
- Header đúng tên cột bắt buộc.
- Nếu có sheet `YeuCauTasks` thì phải đúng header task.

## 5.2 Validation từng dòng
- `summary` không rỗng, <= 500 ký tự.
- Có ít nhất 1 trong 2: `project_item_code` hoặc `customer_code`.
- Nếu có cả 2 thì phải cùng customer context.
- `priority_label` đúng enum.
- Các mã tham chiếu (customer/project_item/personnel/channel/user) phải map được.
- `creator_user_code` chỉ hợp lệ khi user import có quyền override.

## 5.3 Validation task
- `task_source` đúng enum.
- `task_status` đúng enum nếu được nhập.
- `task_source=IT360` thì `task_link` bắt buộc và là URL hợp lệ.

## 5.4 Cơ chế phản hồi lỗi
- Trả về danh sách lỗi theo `row_number` + `import_row_code` + `field` + `error_code` + `error_message`.
- Mỗi dòng có thể có nhiều lỗi.
- Cho phép tải file lỗi để user sửa nhanh.

## 5.5 Bộ mã lỗi chuẩn
- `INVALID_TEMPLATE`
- `MISSING_REQUIRED_FIELD`
- `INVALID_ENUM`
- `REFERENCE_NOT_FOUND`
- `REFERENCE_CONFLICT`
- `PERMISSION_DENIED`
- `POLICY_VIOLATION`
- `SYSTEM_ERROR`

---

## 6) Thiết kế kỹ thuật theo lớp

## 6.1 Frontend

### UI tại `customer-request-management`
- Nút `Tải file mẫu`.
- Nút `Import Excel` (mở modal upload + preview + validate client-side).
- Nút `Export Excel` (export theo filter hiện tại).

### Utility đề xuất
- `frontend/utils/customerRequestImportTemplate.ts` (generate workbook + dropdown từ sheet danh mục)
- `frontend/utils/customerRequestImportParser.ts`
- `frontend/utils/customerRequestImportValidation.ts`
- `frontend/utils/customerRequestImportMapper.ts`
- Quy ước template: dùng named range + data validation để dropdown tự mở rộng theo danh mục.

### API client
- `POST /api/v5/customer-request-cases/import-intake` (mới)
- `GET /api/v5/customer-request-cases/export-intake` hoặc export chung có tham số `format=xlsx`
- `GET /api/v5/customer-request-cases/import-intake/template`

> Ghi chú: endpoint import cũ `/api/v5/customer-requests/import` đang decommissioned (410), nên cần endpoint mới theo domain hiện tại.

## 6.2 Backend

### Route + Permission
- Route mới cho import/export/template.
- Permission đề xuất:
  - `support_requests.import`
  - `support_requests.export`
  - `support_requests.import_override_creator` (nếu dùng `creator_user_code`).

### Service xử lý import
- Parse workbook và chuẩn hóa dữ liệu.
- Resolve mã nghiệp vụ -> ID.
- Validate business rule.
- Tạo case ở `new_intake` + ghi audit log.
- Ghi nhận lỗi từng dòng, không chặn toàn file trừ lỗi policy/template.

### Tích hợp metadata/workflow
- Lấy workflow hiện hành bằng `CustomerRequestCaseMetadataService::resolveWorkflowDefinitionId()`.
- Kiểm tra status catalog bằng `getStatusCatalog()`/`hasStatusMeta('new_intake')` trước khi insert.
- Không hard-code flow ngoài `new_intake` trong phase 1.

### Transaction
- Chế độ **partial success** theo batch.
- Mỗi batch 100 dòng, mỗi dòng transaction riêng khi create case + ref_tasks.
- Lỗi 1 dòng không rollback các dòng khác.

### Giới hạn vận hành (phase 1)
- Kích thước file tối đa: 10MB.
- Số dòng tối đa: 2,000 dòng/file.
- Timeout server mục tiêu: 120s.

## 6.3 API contract chi tiết

### 6.3.1 Download template
- `GET /api/v5/customer-request-cases/import-intake/template`
- Response: file `.xlsx` (binary stream)

### 6.3.2 Import intake
- `POST /api/v5/customer-request-cases/import-intake`
- Content-Type: `multipart/form-data`
- Request:
  - `file`: bắt buộc, `.xlsx`
  - `dry_run`: optional boolean (mặc định `false`)

- Response mẫu:
```json
{
  "success": true,
  "data": {
    "total_rows": 120,
    "success_rows": 110,
    "failed_rows": 10,
    "created_case_ids": [1201, 1202],
    "errors": [
      {
        "row_number": 12,
        "import_row_code": "R-0012",
        "field": "customer_code",
        "error_code": "REFERENCE_NOT_FOUND",
        "error_message": "Không tìm thấy customer_code CUST999"
      }
    ],
    "warnings": [
      {
        "row_number": 25,
        "import_row_code": "R-0025",
        "field": "status",
        "message": "Bỏ qua cột status vì phase 1 chỉ cho phép new_intake"
      }
    ],
    "error_file_token": "tmp_err_abc123"
  }
}
```

### 6.3.3 Export intake
- `GET /api/v5/customer-request-cases/export-intake?format=xlsx&...filters`
- Response: file `.xlsx` theo filter hiện tại.

---

## 7) Kế hoạch triển khai theo giai đoạn

## Giai đoạn A — Chuẩn hóa template + export
1. Chốt bộ cột template.
2. Thêm nút tải template từ UI.
3. Thêm export `.xlsx` từ danh sách hiện tại.

**Deliverable:** tải được template + export hoạt động.

## Giai đoạn B — Import preview + validate
1. Upload file và preview 20 dòng đầu.
2. Validate header + enum + dữ liệu cơ bản ở frontend.
3. Hiển thị thống kê: hợp lệ/lỗi.

**Deliverable:** user thấy lỗi trước khi bấm import.

## Giai đoạn C — Import server-side tạo case Tiếp nhận
1. Xây endpoint import mới.
2. Resolve mapping mã -> ID.
3. Validate workflow metadata có `new_intake`.
4. Tạo case `new_intake` + ref_tasks.
5. Trả kết quả thành công/thất bại theo dòng.

**Deliverable:** import tạo mới thành công vào trạng thái Tiếp nhận.

## Giai đoạn D — Hardening & rollout
1. Test dữ liệu lớn (500-2,000 dòng).
2. Bổ sung file lỗi tải về.
3. Bổ sung audit + metric cơ bản.
4. UAT với dữ liệu thật.
5. Rollout có canary theo nhóm user.

**Deliverable:** sẵn sàng rollout production.

---

## 8) Test plan

## 8.1 Functional
- Import file đúng mẫu tạo case thành công.
- Case mới hiển thị tại màn hình với trạng thái `Tiếp nhận`.
- Export ra file đúng dữ liệu theo filter.
- `dry_run=true` không tạo dữ liệu, chỉ trả lỗi/warning.

## 8.2 Negative
- Thiếu `summary` -> lỗi đúng dòng.
- Sai mã khách hàng/mã hạng mục -> lỗi map.
- Sai enum ưu tiên/task status -> lỗi validation.
- Workflow không có `new_intake` -> lỗi policy toàn file.

## 8.3 Permission
- User không có quyền import/export bị chặn đúng.
- User không có quyền override creator thì `creator_user_code` bị từ chối.

## 8.4 Regression
- Không ảnh hưởng luồng tạo tay hiện tại trên modal tạo yêu cầu.
- Không ảnh hưởng các endpoint CRC hiện tại.

## 8.5 Performance
- Import 2,000 dòng hoàn thành trong ngưỡng timeout.
- Memory không tăng bất thường khi parse workbook lớn.

---

## 9) Tiêu chí nghiệm thu (UAT)

1. User tải được file mẫu từ màn hình `customer-request-management`.
2. Import file hợp lệ tạo đúng số case.
3. 100% case import mới ở trạng thái `new_intake`.
4. Lỗi trả đúng dòng, rõ lý do, có thể sửa và import lại.
5. Export file mở được bằng Excel, dữ liệu đúng với danh sách trên UI.
6. Log/audit có thể truy vết được người import, file import, kết quả từng lần import.

---

## 10) Quan sát vận hành (logging/audit/metrics)

## 10.1 Audit bắt buộc
- `import_job_id`
- `imported_by_user_id`
- `file_name`
- `total_rows/success_rows/failed_rows`
- `started_at/finished_at`

## 10.2 Metrics theo dõi
- Số lượt import/ngày.
- Tỷ lệ lỗi theo `error_code`.
- Thời gian xử lý trung bình/file.

## 10.3 Logging lỗi
- Log chi tiết lỗi hệ thống (`SYSTEM_ERROR`) kèm trace id.
- Không log dữ liệu nhạy cảm trong nội dung Excel.

---

## 11) Rủi ro và phương án giảm thiểu

1. **Rủi ro map theo tên gây sai dữ liệu**  
   - Giảm thiểu: bắt buộc/ưu tiên map theo `*_code`, không map theo tên.

2. **Dữ liệu master thiếu/không đồng bộ**  
   - Giảm thiểu: đính kèm sheet danh mục tra cứu trong template.

3. **File lớn gây timeout**  
   - Giảm thiểu: import theo batch 100 dòng + giới hạn 2,000 dòng.

4. **Người dùng nhập sai định dạng**  
   - Giảm thiểu: validate client-side + file lỗi chi tiết.

5. **Workflow metadata lệch giữa môi trường**  
   - Giảm thiểu: check `new_intake` ở runtime; fail-fast nếu thiếu cấu hình.

---

## 12) Rollout & backout plan

## 12.1 Rollout
1. Deploy backend endpoint + permission.
2. Deploy frontend nút template/import/export.
3. Mở quyền cho nhóm pilot.
4. Theo dõi metrics 3-5 ngày trước khi mở rộng toàn bộ.

## 12.2 Backout
- Tắt quyền `support_requests.import` cho toàn hệ thống nếu phát sinh sự cố.
- Giữ endpoint export hoạt động bình thường.
- Không rollback DB schema nếu không cần thiết; ưu tiên khóa chức năng import trước.

---

## 13) Đề xuất tên file và vị trí

- **Vị trí:** `plan-code/ke-hoach-import-yckh/`
- **Tên file:** `ke-hoach-export-import-excel-customer-request-tiep-nhan.md`

(Đã điều chỉnh trực tiếp trên file hiện tại.)