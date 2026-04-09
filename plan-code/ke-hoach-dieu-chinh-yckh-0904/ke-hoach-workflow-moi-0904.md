# Kế hoạch điều chỉnh workflow YCKH (0904)

_Ngày phân tích: 2026-04-09_

## 1) Nguồn dữ liệu đã đối chiếu

- DB: `customer_request_status_catalogs` (status code + tên trạng thái + metadata form/list)
- DB: `customer_request_status_transitions` (map from_status_code → to_status_code)
- Tài liệu: `thongtinmoi.txt`
- File quy định luồng mới: `plan-code/ke-hoach-dieu-chinh-yckh-0904/workflowa (1).xlsx`

## 2) Kết quả so sánh tổng quan

- Số status active hiện tại: **23**
- Số transition active hiện tại: **52**
- Transition đánh dấu **Xoá** trong Excel: **29**
- Transition đánh dấu **Thêm** trong Excel: **10**
- Nếu áp đúng cột F (Xoá/Thêm): transition còn lại dự kiến: **34**

Chi tiết quality check:
- Xoá hợp lệ (đang tồn tại trong DB): **28**
- Xoá nhưng DB hiện chưa có: **1** (`completed -> customer_notified`)
- Thêm mới (DB chưa có): **10**
- Thêm nhưng đã tồn tại sẵn: **0**

## 3) Danh sách transition cần THÊM (theo cột F)

- `assigned_to_receiver` (Giao R thực hiện) → `waiting_notification` (Chờ thông báo khách hàng) | actor: R
- `assigned_to_receiver` (Giao R thực hiện) → `customer_notified` (Thông báo khách hàng) | actor: R
- `returned_to_manager` (Giao PM/Trả YC cho PM) → `closed` (Đóng yêu cầu) | actor: A
- `returned_to_manager` (Giao PM/Trả YC cho PM) → `customer_notified` (Thông báo khách hàng) | actor: A
- `not_executed` (Không tiếp nhận) → `waiting_notification` (Chờ thông báo khách hàng) | actor: Tất cả
- `not_executed` (Không tiếp nhận) → `closed` (Đóng yêu cầu) | actor: Tất cả
- `dms_transfer` (Chuyển DMS) → `waiting_notification` (Chờ thông báo khách hàng) | actor: Tất cả
- `dms_transfer` (Chuyển DMS) → `customer_notified` (Thông báo khách hàng) | actor: Tất cả
- `coding` (Lập trình) → `waiting_notification` (Chờ thông báo khách hàng) | actor: R
- `coding` (Lập trình) → `customer_notified` (Thông báo khách hàng) | actor: R

## 4) Danh sách transition cần XOÁ (theo cột F)

- `assigned_to_receiver` (Giao R thực hiện) → `in_progress` (R Đang thực hiện) | actor: R
- `completed` (Hoàn thành) → `assigned_to_receiver` (Giao R thực hiện) | actor: A
- `completed` (Hoàn thành) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: Tất cả
- `completed` (Hoàn thành) → `waiting_notification` (Chờ thông báo khách hàng) | actor: Tất cả
- `completed` (Hoàn thành) → `customer_notified` (Thông báo khách hàng) | actor: Tất cả (DB hiện không có)
- `in_progress` (R Đang thực hiện) → `completed` (Hoàn thành) | actor: R
- `in_progress` (R Đang thực hiện) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: R
- `analysis` (Chuyển BA Phân tích) → `analysis_completed` (Chuyển BA Phân tích hoàn thành) | actor: R
- `analysis` (Chuyển BA Phân tích) → `analysis_suspended` (Chuyển BA Phân tích tạm ngưng) | actor: R
- `analysis_completed` (Chuyển BA Phân tích hoàn thành) → `dms_transfer` (Chuyển DMS) | actor: Tất cả
- `analysis_completed` (Chuyển BA Phân tích hoàn thành) → `coding` (Lập trình) | actor: Tất cả
- `analysis_completed` (Chuyển BA Phân tích hoàn thành) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: R
- `analysis_suspended` (Chuyển BA Phân tích tạm ngưng) → `analysis` (Chuyển BA Phân tích) | actor: Tất cả
- `analysis_suspended` (Chuyển BA Phân tích tạm ngưng) → `analysis_completed` (Chuyển BA Phân tích hoàn thành) | actor: R
- `analysis_suspended` (Chuyển BA Phân tích tạm ngưng) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: R
- `dms_transfer` (Chuyển DMS) → `dms_task_created` (Tạo task) | actor: Tất cả
- `dms_task_created` (Tạo task) → `dms_in_progress` (DMS Đang thực hiện) | actor: Tất cả
- `dms_task_created` (Tạo task) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: Tất cả
- `dms_in_progress` (DMS Đang thực hiện) → `completed` (Hoàn thành) | actor: Tất cả
- `dms_in_progress` (DMS Đang thực hiện) → `dms_suspended` (DMS tạm ngưng) | actor: Tất cả
- `dms_in_progress` (DMS Đang thực hiện) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: Tất cả
- `dms_suspended` (DMS tạm ngưng) → `dms_in_progress` (DMS Đang thực hiện) | actor: Tất cả
- `dms_suspended` (DMS tạm ngưng) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: Tất cả
- `coding` (Lập trình) → `coding_in_progress` (Dev đang thực hiện) | actor: R
- `coding_in_progress` (Dev đang thực hiện) → `completed` (Hoàn thành) | actor: R
- `coding_in_progress` (Dev đang thực hiện) → `coding_suspended` (Dev tạm ngưng) | actor: R
- `coding_in_progress` (Dev đang thực hiện) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: R
- `coding_suspended` (Dev tạm ngưng) → `coding_in_progress` (Dev đang thực hiện) | actor: R
- `coding_suspended` (Dev tạm ngưng) → `returned_to_manager` (Giao PM/Trả YC cho PM) | actor: R

## 5) Điểm cần chốt nghiệp vụ trước khi triển khai

### 5.1 Dòng có dấu `*` nhưng chưa ghi rõ Xoá/Thêm

**Đã chốt nghiệp vụ:** 2 dòng có dấu `*` nhưng không ghi action sẽ **giữ nguyên như DB hiện tại** (không thêm, không xoá):

- `waiting_notification` (Chờ thông báo khách hàng) → `returned_to_manager` (Giao PM/Trả YC cho PM)
- `waiting_notification` (Chờ thông báo khách hàng) → `customer_notified` (Thông báo khách hàng)

### 5.2 Trạng thái chưa map được sang status_code trong DB

- `closed` (Đóng yêu cầu) → `Kết thúc` (chưa có status code tương ứng trong `customer_request_status_catalogs`)

## 6) Check chi tiết chức năng customer-request-management theo luồng DB

Các điểm chính đang chi phối luồng:

- API route chính: `GET/POST /api/v5/customer-request-cases/*` ở `backend/routes/api.php` và `backend/routes/api/customer-requests.php`.
- Nguồn transitions runtime: `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseMetadataService.php` (`getAllowedTransitions`, đọc trực tiếp bảng `customer_request_status_transitions`).
- Backend transition còn bị ràng bởi fallback map: `backend/app/Services/V5/Domain/CustomerRequestCaseRegistry.php` (`workflowaAllowedTargets`).
- Khi chuyển trạng thái, write service đang ép align theo fallback map trên: `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` (`resolveXmlAlignedAllowedTargets`, `alignTransitionRowsWithWorkflowTargets`).
- Frontend màn hình `http://localhost:5174/customer-request-management` nhận `allowed_next_processes` từ API, nhưng validate payload chuyển trạng thái vẫn hard-rule trong `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`.

=> Kết luận: nếu chỉ đổi 2 bảng DB mà không đồng bộ fallback/hard-rule thì UI có thể hiển thị 1 kiểu, API transition xử lý 1 kiểu.

## 7) Kế hoạch triển khai đề xuất

### Phase A — Chốt nghiệp vụ
1. Chốt action cho 2 dòng `*` đang để trống (mục 5.1).
2. Chốt `Kết thúc` là:
   - dùng `closed` làm trạng thái cuối, hoặc
   - tạo status mới trong `customer_request_status_catalogs`.
3. Chốt có loại bỏ hoàn toàn cụm sub-state BA/DMS/Coding hay chỉ ẩn trên UI.

### Phase B — Cập nhật dữ liệu DB
1. Tạo SQL patch mới trong `database/sql-patches/<ngay>_workflowa_0904/`:
   - disable/delete transition cần Xoá,
   - insert transition cần Thêm,
   - insert status mới (nếu có `Kết thúc`).
2. Chạy patch theo đúng thứ tự + verify bằng query kiểm tra từng from_status_code.
3. Backup DB trước khi chạy môi trường chính thức.

### Phase C — Đồng bộ backend
1. Cập nhật `CustomerRequestCaseRegistry::workflowaAllowedTargets()` theo luồng mới đã chốt.
2. Rà soát `CustomerRequestCaseWriteService` để bỏ/giảm fallback inject nhánh cũ.
3. Rà soát `CustomerRequestCaseTransitionEvaluator` cho các rule lane/new_intake/in_progress.
4. Chạy test CRC backend (`php artisan test --filter=CustomerRequestCase`).

### Phase D — Đồng bộ frontend
1. Kiểm tra dropdown/chip transition ở màn customer-request-management dùng đúng allowed_next_processes mới.
2. Cập nhật validate bắt buộc field trong `useCustomerRequestTransition.ts` cho phù hợp luồng mới.
3. Kiểm tra CTA/list filter/status chip không phụ thuộc nhánh đã xoá.
4. Chạy test frontend liên quan CRC.

### Phase E — UAT và rollout
1. Test matrix theo vai trò: A/PM, R, Tất cả.
2. Test các luồng trọng yếu: `new_intake`, `returned_to_manager`, `assigned_to_receiver`, `not_executed`, `customer_notified`, `closed`.
3. Chốt checklist go-live + phương án rollback (restore từ backup).

## 8) Kết luận nhanh

- Luồng trong Excel 0904 đang giảm mạnh số nhánh (đặc biệt các nhánh trung gian BA/DMS/Coding).
- Cần triển khai đồng bộ **DB + backend fallback + frontend validation** để tránh lệch luồng.
- Trước khi code patch chính thức cần chốt 2 điểm nghiệp vụ còn mơ hồ (mục 5.1 và 5.2).

---

### Tệp dữ liệu phân tích kèm theo

- `plan-code/ke-hoach-dieu-chinh-yckh-0904/workflowa_1_dump.json`
- `plan-code/ke-hoach-dieu-chinh-yckh-0904/workflowa_transition_diff.json`
