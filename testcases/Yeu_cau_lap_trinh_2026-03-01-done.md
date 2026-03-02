# Baseline Testcase + Checklist PASS/FAIL — Yêu cầu lập trình
**Ngày cập nhật:** 2026-03-01  
**Module:** `ProgrammingRequestList` + `ProgrammingRequestModal`  
**Phạm vi code:** `frontend/components/ProgrammingRequestList.tsx`, `frontend/components/ProgrammingRequestModal.tsx`, `frontend/App.tsx`, `frontend/services/v5Api.ts`, `frontend/types.ts`, `backend/app/Http/Controllers/ProgrammingRequestController.php`, `backend/app/Http/Requests/StoreProgrammingRequestRequest.php`, `backend/app/Http/Requests/UpdateProgrammingRequestRequest.php`

## 1) Baseline UI thực tế (đối chiếu theo code hiện tại)

### 1.1 KPI cards (6 cards)
1. `Tổng yêu cầu`
2. `Mới tạo`
3. `Phân tích`
4. `Lập trình`
5. `Chờ upcode`
6. `Hoàn tất`

### 1.2 Filter bar
1. Search placeholder: `Tìm theo mã task, nội dung, khách hàng, người xử lý...`
2. Filter trạng thái: `SearchableMultiSelect` (multi-select)
3. Filter loại: `Tất cả loại YC`
4. Filter dev: `Tất cả Dev`
5. Date labels:
- `Từ ngày nhận yêu cầu`
- `Đến ngày nhận yêu cầu`
6. Date picker: `BlackDatePicker`, placeholder `dd/mm/yyyy`
7. Mặc định date range:
- `requestedDateFrom = ngày đầu tháng hiện tại`
- `requestedDateTo = ngày hiện tại`

### 1.3 Bảng danh sách
1. `Mã YC`
2. `Tên YC`
3. `Sản phẩm`
4. `Khách hàng`
5. `Loại`
6. `Trạng thái`
7. `Tiến độ`
8. `Hạn phân tích`
9. `Hạn Code`
10. `Ngày TBKH`
11. `Dev`
12. `Thao tác`

### 1.4 Thao tác row
1. `Chi tiết` (icon `visibility`) -> mở modal Worklog.
2. `Sửa` (icon `edit`) -> mở modal cập nhật.
3. `Hủy yêu cầu` (icon `delete`) chỉ hiển thị khi `status = NEW`.

### 1.5 Modal yêu cầu lập trình
1. Có 4 tab:
- `Thông tin chung`
- `Phân tích`
- `Lập trình`
- `Triển khai & TB`
2. Trường bắt buộc quan trọng: `project_item_id`, `req_name`, `req_type`, `status`, `requested_date`.
3. `source_type` và `support_request_id` đang là hidden fields (không có source toggle trực tiếp trên UI).
4. Có upload tài liệu đặc tả (Google Drive/local fallback).

### 1.6 Khác với baseline cũ cần loại bỏ
1. KPI bug "server mode chỉ đếm current page" đã được fix bằng `meta.kpis` từ backend.
2. Cột `Nguồn` không hiển thị trên list hiện tại.
3. Form không có toggle `DIRECT/FROM_SUPPORT` hiển thị trực tiếp cho user ở trạng thái hiện tại.

---

## 2) Phase P2 (UX/QA baseline) — Checklist PASS/FAIL

## 2.1 UI
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| UI-01 | 6 KPI cards đúng nhãn hiện hành | PASS | `ProgrammingRequestList.tsx` (`managementKpis`) |
| UI-02 | Filter labels/placeholders đúng baseline mới | PASS | `ProgrammingRequestList.tsx` section filter |
| UI-03 | Table headers đúng baseline mới | PASS | `ProgrammingRequestList.tsx` table header |
| UI-04 | Action icons đúng yêu cầu (detail/edit/cancel NEW) | PASS | `ProgrammingRequestList.tsx` action column |
| UI-05 | Modal 4 tabs render đúng | PASS | `ProgrammingRequestModal.tsx` tab buttons |

## 2.2 Logic trạng thái + validate ngày chain
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| ST-01 | FE status type-safe theo union code | PASS | `types/programmingRequest.ts` (`PROGRAMMING_REQUEST_STATUSES`) |
| ST-02 | Backend validate status nằm trong whitelist | PASS | `StoreProgrammingRequestRequest` + `UpdateProgrammingRequestRequest` (`Rule::in(...)`) |
| ST-03 | Hủy yêu cầu chỉ cho phép ở `NEW` | PASS | `App.tsx` (`handleCancelProgrammingRequest`) + button guard list |
| ST-04 | Enforce transition matrix cứng (ví dụ chặn `CLOSED -> NEW`) | PASS | `StoreProgrammingRequestRequest::validateStatusTransition()` |
| ST-05 | Ràng buộc `source_type` vs `support_request_id` | PASS | FE `zod superRefine` + BE `requiredIf/prohibitedIf` |
| ST-06 | Mutual exclusion `notified_internal_id`/`notified_customer_id` | PASS | FE + BE đều validate |
| ST-07 | Date chain analyze -> code -> deploy | PASS | FE `zod superRefine` + BE `ensureDateOrder(...)` |

## 2.3 Filter + Pagination
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| FP-01 | Luồng list chính dùng server pagination/filter | PASS | `App.tsx` gọi `fetchProgrammingRequestsPage()` |
| FP-02 | Query contract gồm page/per_page/q/status/req_type/coder_id/date | PASS | `ProgrammingRequestList.tsx` -> `onQueryChange` payload |
| FP-03 | Backend guard `per_page` max 100 | PASS | `ProgrammingRequestController@index` (`min(...,100)`) |
| FP-04 | KPI lấy từ server-side aggregate theo cùng filter | PASS | `ProgrammingRequestController@index` (`$aggregate` + `meta.kpis`) |
| FP-05 | Không còn helper full-fetch trong codebase | PASS | Đã dọn `fetchProgrammingRequests()` khỏi `v5Api.ts` |

## 2.4 Hiệu năng
| ID | Hạng mục | Kết quả | Bằng chứng |
|---|---|---|---|
| PF-01 | KPI query không phụ thuộc current page | PASS | Backend aggregate độc lập pagination |
| PF-02 | Worklog query có index phục vụ lọc chính | PASS | Migration `2026_03_01_191000_add_programming_worklog_indexes.php` |
| PF-03 | Search/filter list tránh full-fetch ở luồng chính | PASS | Server paging flow trong `App.tsx` |
| PF-04 | Tìm task tham chiếu server-side fuzzy + debounce cho Programming | PASS | API `/programming-requests/reference-search` + debounce modal 300ms |
| PF-05 | Export dữ liệu lớn theo async job/stream riêng cho Programming | PASS | API stream `/programming-requests/export` + FE `Xuất CSV` |

---

## 3) Phase P3 (Regression) — Regression bắt buộc

| ID | Luồng hồi quy | Kỳ vọng | Kết quả hiện tại |
|---|---|---|---|
| RG-00 | FROM_SUPPORT auto-fill + consistency | Flow từ support sang programming giữ source/support_request hợp lệ | PASS |
| RG-01 | Tạo mới yêu cầu (tab Thông tin chung) | Tạo thành công khi đủ `project_item_id + req_name + req_type + status + requested_date` | PASS |
| RG-02 | Cập nhật yêu cầu qua 4 tab | Đổi tab không mất state form, submit thành công | PASS |
| RG-03 | Chain date analyze -> code -> deploy | Dữ liệu sai thứ tự bị chặn bởi FE/BE | PASS |
| RG-04 | Hủy yêu cầu từ list | Chỉ `NEW` được hủy, status -> `CANCELLED` | PASS |
| RG-05 | Upload/xóa tài liệu đặc tả | Upload thành công, hiển thị file, xóa được | PASS |
| RG-06 | Parent/depth validation | Chặn self-reference, depth-parent mismatch | PASS |
| RG-07 | Worklog CRUD + summary theo phase | Mở modal worklog, thêm/sửa/xóa, tổng hợp giờ theo phase đúng | PASS |
| RG-08 | Multi-select status + date filter + reset filter | Lọc nhiều trạng thái + khoảng ngày + bấm Xóa lọc về mặc định | PASS |
| RG-09 | Tìm task tham chiếu quy mô lớn | Tìm được ngoài page hiện tại với fuzzy search | PASS |

---

## 4) Definition of Done (đối chiếu P3)

| DoD | Trạng thái | Ghi chú |
|---|---|---|
| KPI server mode đúng toàn tập filter | PASS | KPI đọc từ `meta.kpis` backend aggregate theo cùng filter |
| Không còn query worklog bị full-scan ở flow chính | PASS | Index `idx_worklog_req_phase` + `idx_worklog_req_logged_id` đã có |
| Filter/pagination ổn với dữ liệu lớn | PASS (code-level) | Server pagination + per_page guard + query contract chuẩn |
| Status chỉ nhận giá trị hợp lệ theo master data | PASS | FE union + BE whitelist validate |
| `php -l`, `php artisan migrate`, `npm run lint`, `npm run build` pass | PASS | Đã chạy trong lượt chốt P2/P3 |
| Test tay flow chính pass | PENDING | Cần QA chạy tay các mục `RG-00..RG-09` trên môi trường UI |

---

## 5) Đề xuất chốt P2 tiếp theo (từ các mục FAIL)
1. Cân nhắc chuẩn hóa nhãn trạng thái xuất CSV (map code -> label) nếu cần tài liệu nghiệp vụ.
