# Kế hoạch điều chỉnh YCKH theo yêu cầu 0904

_Ngày cập nhật: 2026-04-10_

## 1) Input và phạm vi

### 1.1 Input đã đối chiếu
- `thongtinmoi.txt`
- `plan-code/ke-hoach-dieu-chinh-yckh-0904/yeucauchinhsua.txt`
- UI thực tế: `http://localhost:5174/customer-request-management`
- Luồng DB runtime:
  - `customer_request_status_catalogs`
  - `customer_request_status_transitions`
- Luồng thực thi FE/BE chính:
  - `frontend/components/customer-request/CustomerRequestDetailPane.tsx`
  - `frontend/components/customer-request/CustomerRequestWorklogModal.tsx`
  - `frontend/services/api/customerRequestApi.ts`
  - `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseMetadataService.php`
  - `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php`
  - `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php`

### 1.2 Yêu cầu business đã chốt
1. **Tái cấu trúc cụm tab** trong khung chỉnh sửa: đưa tab lên đầu khung.
2. **Thứ tự tab mới**:
   - `Chi tiết yêu cầu` (tab gộp)
   - `Giờ công`
   - `Tệp`
   - `Ước lượng`
   - `Task/Ref`
   - `Dòng thời gian`
3. Tab `Tệp` phải đứng **ngay sau** `Giờ công`.
4. `Ước lượng` phải đứng **trước** `Dòng thời gian`.
5. Tab `Chi tiết yêu cầu` sẽ gộp:
   - `Thông tin yêu cầu`
   - `Tags`
   - Nội dung tab `Chi tiết` cũ.
6. Bỏ tab `Chi tiết` cũ sau khi sáp nhập.
7. Form ghi giờ công cho phép nhập `0 giờ`.
8. Bổ sung field worklog:
   - `Khó khăn`
   - `Đề xuất`
   - `Trạng thái xử lý khó khăn` (`không`, `có`, `đã giải quyết`)
9. Bổ sung detail status cho mỗi trạng thái xử lý:
   - `mở`, `đang thực hiện`, `tạm ngưng`, `hoàn thành`
10. Rule chuyển trạng thái chính:
   - Trạng thái cũ auto `hoàn thành`
   - Trạng thái mới auto `mở`
11. Khóa chuyển trạng thái chính nếu detail status hiện tại = `mở`.
12. Hai nút nhanh dưới `Trạng thái xử lý`:
   - `Đang thực hiện`
   - `Tạm ngưng`
   - Vị trí hiển thị: nằm **dưới dòng `Trạng thái xử lý`** và **bên trái label trạng thái hiện tại**.
13. Khi click vào 1 trong 2 nút nhanh (`Đang thực hiện`/`Tạm ngưng`) thì luôn mở **popup ghi worklog**.
14. Khi bấm `Lưu` trong popup worklog từ **nút nhanh detail status**:
   - Hệ thống tự động cập nhật detail status theo nút đã click.
   - Đồng thời lưu bản ghi giờ công/worklog trong cùng thao tác.
15. Khi bấm nút `Ghi giờ công` ở tab `Giờ công`:
   - Chỉ lưu worklog.
   - **Không truyền action/detail status**, không cập nhật trạng thái chi tiết.
16. Mục tiêu: tránh ghi đè/cập nhật lặp detail status làm thay đổi sai `ngày cập nhật trạng thái chi tiết`.
17. Popup không được đóng bằng click ra ngoài.
18. Form ghi worklog và thao tác đổi detail status dùng cùng giao diện popup, nhưng khác ngữ cảnh submit (có action vs không action).
19. Chuẩn hóa định dạng ngày giờ:
   - `Ngày bắt đầu`, `Ngày kết thúc`, `Ngày gia hạn`: `DD/MM/YYYY HH:mm` (24h)
   - `Ngày làm việc` (worklog): `DD/MM/YYYY`
   - Không dùng `mm/dd/yyyy`, không AM/PM.
20. Form create và form edit/detail phải hiển thị **full screen**.
21. File ở tab `Tệp` đã lưu phải được giữ nguyên sau khi chuyển trạng thái (không mất link/không mất dữ liệu).
22. Mỗi file upload phải có trường **ghi chú của file** (note theo từng file) và hiển thị lại đúng ghi chú khi xem danh sách file.
23. Ghi chú file phải được bảo toàn khi chuyển trạng thái, tương tự như file/link.
24. Khi chỉnh sửa ghi chú file, chỉ cập nhật ghi chú của file đó, không ảnh hưởng file khác.
25. Khi lưu worklog phải luôn gắn với **`status_instance_id` hiện tại** (id bước hiện tại), không dựa vào `status_code` để tránh nhầm khi 1 trạng thái lặp lại nhiều vòng.
26. Danh sách worklog hiển thị phải render “Trạng thái tại thời điểm ghi” dựa trên `status_instance_id` đã lưu.
27. Khi click vào 1 dòng worklog đã ghi, phải mở popup để cập nhật worklog đó.
28. Cập nhật worklog không được tự ý đổi `status_instance_id` trừ khi người dùng thao tác qua nút nhanh chuyển trạng thái.
29. Tối ưu mật độ giao diện: các khung/card trong màn chi tiết (panel giờ công, Người liên quan, Quick stats, khu vực tags và popup ghi giờ công) cần **thu gọn kích thước** (padding/chiều cao/khoảng cách) để nhìn gọn hơn, không mất thông tin.
30. Ưu tiên hiển thị nhiều nội dung hơn trong 1 màn hình, giảm khoảng trắng dư thừa.

### 1.3 Tách thành 2 kế hoạch triển khai

## Kế hoạch 1 (thực hiện trước)
Theo thứ tự bạn chốt: **7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 26, 28, 27**

- (7) Form ghi giờ công cho phép nhập `0 giờ`.
- (8) Bổ sung field worklog: Khó khăn / Đề xuất / Trạng thái xử lý khó khăn.
- (9) Bổ sung detail status cho mỗi trạng thái xử lý.
- (10) Rule chuyển trạng thái chính: cũ auto `hoàn thành`, mới auto `mở`.
- (11) Khóa chuyển trạng thái chính nếu detail status hiện tại = `mở`.
- (12) Hai nút nhanh dưới `Trạng thái xử lý` + vị trí hiển thị.
- (13) Click nút nhanh luôn mở popup ghi worklog.
- (14) Lưu popup từ nút nhanh: vừa đổi detail status vừa ghi worklog.
- (15) Nút `Ghi giờ công` ở tab Giờ công: chỉ lưu worklog, không đổi detail status.
- (16) Tránh cập nhật lặp detail status làm sai ngày cập nhật trạng thái chi tiết.
- (17) Popup không đóng bằng click ra ngoài.
- (18) Cùng 1 UI popup, khác ngữ cảnh submit (có action / không action).
- (19) Chuẩn hóa format ngày giờ `DD/MM/YYYY HH:mm` và `DD/MM/YYYY`.
- (20) Form create và form edit/detail hiển thị full screen.
- (21) File tab `Tệp` giữ nguyên sau transition.
- (25) Luôn gắn worklog với `status_instance_id` hiện tại.
- (26) Danh sách worklog hiển thị trạng thái theo `status_instance_id` đã lưu.
- (28) Update worklog không tự ý đổi `status_instance_id`.
- (27) Click dòng worklog mở popup để cập nhật.

## Kế hoạch 2 (thực hiện sau)
Các yêu cầu còn lại: **1, 2, 3, 4, 5, 6, 22, 23, 24, 29, 30**

- (1) Tái cấu trúc cụm tab trong khung chỉnh sửa: đưa tab lên đầu khung.
- (2) Thứ tự tab mới.
- (3) Tab `Tệp` ngay sau `Giờ công`.
- (4) `Ước lượng` trước `Dòng thời gian`.
- (5) Tab `Chi tiết yêu cầu` gộp thông tin yêu cầu + tags + chi tiết cũ.
- (6) Bỏ tab `Chi tiết` cũ.
- (22) Mỗi file upload có ghi chú riêng.
- (23) Ghi chú file bảo toàn qua transition.
- (24) Sửa ghi chú file nào chỉ ảnh hưởng file đó.
- (29) Thu gọn kích thước card/khung để UI gọn hơn.
- (30) Giảm khoảng trắng dư thừa, tăng mật độ hiển thị.

---

## 2) Danh sách tab: hiện tại vs mục tiêu

### 2.1 Tab hiện tại (theo code)
Trong `CustomerRequestDetailPane.tsx`, `DETAIL_TABS` hiện có:
1. `Chi tiết`
2. `Giờ công`
3. `Ước lượng`
4. `Tệp`
5. `Task/Ref`
6. `Dòng thời gian`

### 2.2 Tab mục tiêu sau chỉnh sửa
1. `Chi tiết yêu cầu` (gộp)
2. `Giờ công`
3. `Tệp`
4. `Ước lượng`
5. `Task/Ref`
6. `Dòng thời gian`

> `Tệp` đứng ngay sau `Giờ công`, và `Ước lượng` vẫn đứng trước `Dòng thời gian`.

---

## 3) Wireframe giao diện mục tiêu

```text
[Header yêu cầu + trạng thái xử lý + nút chuyển]

[Tabs đặt lên đầu khung chỉnh sửa]
| Chi tiết yêu cầu | Giờ công | Tệp | Ước lượng | Task/Ref | Dòng thời gian |

-----------------------------------------------------------
Tab: Chi tiết yêu cầu (compact)
-----------------------------------------------------------
- Khối Thông tin yêu cầu (form fields, khoảng cách gọn)
- Khối Tags (chiều cao gọn)
- Khối Tổng quan/chi tiết cũ (card compact)

-----------------------------------------------------------
Tab: Giờ công (compact)
-----------------------------------------------------------
- Panel giờ công thu gọn
- Popup ghi worklog duy nhất (compact spacing):
  + mở khi click nút `Đang thực hiện` hoặc `Tạm ngưng`
  + khi lưu sẽ vừa đổi detail status theo nút đã chọn, vừa lưu worklog

-----------------------------------------------------------
Tab: Tệp | Ước lượng | Task/Ref | Dòng thời gian
-----------------------------------------------------------
- Giữ logic hiện có, tối ưu lại kích thước card/khung để hiển thị được nhiều thông tin hơn.
```

---

## 4) Hiện trạng kỹ thuật (as-is)

| Hạng mục | Hiện trạng | Ghi chú tác động |
|---|---|---|
| Tab trong detail pane | `DETAIL_TABS` có `chi_tiet` riêng | Cần gộp vào tab `Chi tiết yêu cầu` |
| Vị trí tab | Chưa cố định theo layout mới | Cần đưa cụm tab lên đầu khung |
| Validate giờ công FE | Đang chặn `hours > 0`, input `min=0.25` | Cần cho phép `0` |
| Worklog schema | Chưa có cột khó khăn/đề xuất/trạng thái khó khăn và chưa chốt hiển thị theo `status_instance_id` | Cần mở rộng schema + chuẩn hóa liên kết theo instance |
| Detail status dùng chung | Chưa có mô hình chung | Cần bổ sung bảng/state machine |
| Guard transition theo detail status | Chưa có | Cần chặn khi detail status = `open` |
| Popup nút nhanh detail status | Cơ chế popup chưa gom thành 1 luồng | Cần luôn mở popup worklog và lưu đồng thời đổi trạng thái + giờ công |
| Date format UI | Có nơi đang kiểu `mm/dd/yyyy`, AM/PM | Cần chuẩn hóa format VN 24h |
| Full screen create/edit | Chưa nhất quán | Cần full screen cả 2 luồng |
| Mật độ UI còn thưa | Một số card/panel/popup có padding & chiều cao lớn, nhiều khoảng trắng | Cần thu gọn khung để tối ưu diện tích hiển thị |
| Attachments sau transition | Có hiện tượng mất file hiển thị | Cần bảo toàn liên kết + re-fetch đúng |
| Ghi chú theo từng file | Chưa chuẩn hóa note riêng cho mỗi file upload | Cần lưu/đọc/sửa note theo từng file và giữ nguyên qua transition |

---

## 5) Thiết kế dữ liệu đề xuất (to-be)

### 5.1 Mở rộng `customer_request_worklogs`
Thêm/cố định cột:
- `status_instance_id` (FK, bắt buộc khi insert mới) — khóa chính ngữ cảnh bước tại thời điểm ghi
- `status_code` (chỉ để hiển thị/phụ trợ; không dùng để xác định duy nhất bước)
- `difficulty_note` (TEXT, nullable)
- `proposal_note` (TEXT, nullable)
- `difficulty_status` (VARCHAR(30), default `none`) — `none|has_issue|resolved`
- `detail_status_action` (VARCHAR(30), nullable) — `in_progress|paused`

Quy tắc lưu:
- Luôn lưu `status_instance_id` từ bước hiện tại khi tạo worklog.
- Không map ngược theo `status_code` vì cùng `status_code` có thể xuất hiện nhiều lần trong vòng đời 1 yêu cầu.
- Với update worklog, giữ nguyên `status_instance_id` gốc (trừ trường hợp nghiệp vụ đặc biệt có xác nhận rõ).

### 5.2 Mở rộng dữ liệu file đính kèm (note theo từng file)
Với mỗi file upload cần có `attachment_note` (ghi chú file).

Đề xuất lưu tại một trong 2 cách:
1. Bổ sung cột `note` trực tiếp trên bảng `attachments` (nếu file dùng chung 1 context), hoặc
2. Bổ sung cột `attachment_note` trên bảng map `customer_request_status_attachments` / bảng map request-level attachment (khuyến nghị để note theo ngữ cảnh CRC).

Yêu cầu dữ liệu:
- Mỗi file có note riêng.
- Note hiển thị lại đúng khi mở tab `Tệp`.
- Note không mất khi chuyển trạng thái.
- Sửa note chỉ tác động đúng file tương ứng.

### 5.3 Detail status theo status instance
Tạo bảng `customer_request_status_detail_states`:
- `id`
- `request_case_id` (FK)
- `status_instance_id` (FK)
- `status_code`
- `detail_status` (`open|in_progress|paused|completed`)
- `started_at`, `completed_at` (nullable)
- `changed_by` (nullable)
- `note` (nullable)
- timestamps

Tạo bảng log `customer_request_status_detail_logs`:
- `request_case_id`, `status_instance_id`, `status_code`
- `from_detail_status`, `to_detail_status`
- `changed_by`
- `source` (`button_worklog_submit|system_transition`)
- timestamps

---

## 6) Thay đổi backend

| Nhóm việc | Chỗ tác động chính | Kết quả mong muốn |
|---|---|---|
| Migration worklog | `backend/database/migrations/*` | Thêm cột worklog mới |
| Migration detail status | `backend/database/migrations/*` | Tạo 2 bảng detail status + logs |
| API lưu worklog | `CustomerRequestCaseExecutionService::storeWorklog` | Cho phép 0h + nhận field mới + bắt buộc gắn `status_instance_id` hiện tại |
| API cập nhật worklog | customer-request worklog service/controller | Update 1 dòng worklog theo id, giữ `status_instance_id` gốc |
| Validation request | `StoreCustomerRequestCaseWorklogRequest` | Rule cho enum/status mới + rule `status_instance_id` |
| API cập nhật detail status + worklog | service/controller customer-request | Chỉ áp dụng khi submit popup mở từ nút nhanh; lưu đồng thời đổi detail status + worklog |
| API ghi giờ công thuần | service/controller customer-request | Submit từ tab `Giờ công` chỉ lưu worklog, không đổi detail status |
| Guard transition | write/transition flow | Reject transition khi detail status=`open` |
| Hook transition | write/transition flow | old→`completed`, new→`open` |
| Bảo toàn attachments | write/read services | Không xóa link file cấp request khi chuyển trạng thái |
| API note cho file đính kèm | attachment services/controllers | Hỗ trợ tạo/sửa/lấy `attachment_note` theo từng file |
| Payload FE | read model/domain service | Trả `detail_status`, `can_transition_main_status`, `attachment_note` |

### API đề xuất
- `POST /api/v5/customer-request-cases/{id}/detail-status-worklog`
  - payload: `{ action: "in_progress" | "paused", worklog: {...} }`
  - dùng cho popup mở từ nút nhanh detail status
  - xử lý trong 1 transaction: update detail status + insert worklog
  - insert worklog phải lưu `status_instance_id` hiện tại tại thời điểm submit
- `POST /api/v5/customer-request-cases/{id}/worklogs`
  - payload: `{ worklog: {...} }` (hoặc payload hiện tại)
  - dùng cho nút `Ghi giờ công` ở tab `Giờ công`
  - chỉ insert worklog, không cập nhật detail status
  - vẫn bắt buộc lưu `status_instance_id` hiện tại
- `PATCH /api/v5/customer-request-cases/{id}/worklogs/{worklogId}`
  - cập nhật 1 worklog đã có khi click vào dòng worklog
  - không đổi `status_instance_id` mặc định
- `GET /api/v5/customer-request-cases/{id}/detail-status`
- `POST /api/v5/customer-request-cases/{id}/transition`
  - enforce guard `detail_status != open`

> Nếu tái sử dụng 1 endpoint duy nhất, cần quy ước rõ: có `action` thì mới update detail status; không có `action` thì chỉ lưu worklog.
> Không được tự suy luận action từ UI để tránh cập nhật lặp detail status.
> Truy vấn danh sách worklog phải join theo `status_instance_id` để hiển thị đúng “trạng thái tại thời điểm ghi”.

---

## 7) Thay đổi frontend

| Nhóm việc | File/chỗ tác động | Kết quả mong muốn |
|---|---|---|
| Cấu trúc tab mới | `CustomerRequestDetailPane.tsx` (`DETAIL_TABS`) | Tab order mới, bỏ tab `Chi tiết`, thêm `Chi tiết yêu cầu` |
| Gộp nội dung chi tiết | `CustomerRequestDetailPane.tsx` | Gộp Thông tin yêu cầu + Tags + overview cũ vào tab `Chi tiết yêu cầu` |
| Đưa tabs lên đầu | `CustomerRequestDetailPane.tsx` layout | Tabs nằm đầu khung chỉnh sửa |
| Popup worklog từ nút nhanh | `CustomerRequestWorklogModal.tsx` (hoặc modal mới) | Submit có `action`; đổi detail status theo nút đã chọn + lưu worklog |
| Popup ghi giờ công từ tab `Giờ công` | `CustomerRequestWorklogModal.tsx` + trigger ở Hours tab | Submit không có `action`; chỉ lưu worklog |
| Hiển thị trạng thái theo dòng worklog | Hours tab list/worklog table | Render trạng thái theo `status_instance_id` đã lưu, không chỉ theo code |
| Click dòng worklog để sửa | Hours tab list + modal | Click 1 dòng worklog mở popup ở chế độ cập nhật |
| Thu gọn card/panel ở màn chi tiết | `CustomerRequestDetailPane.tsx`, `CustomerRequestHoursPanel.tsx`, panel phải (Người liên quan/Quick stats) | Giảm padding/gap/min-height để tăng mật độ thông tin |
| Thu gọn popup ghi giờ công | `CustomerRequestWorklogModal.tsx` | Giảm chiều cao textarea, khoảng cách giữa field, footer gọn hơn nhưng vẫn dễ thao tác |
| Worklog 0h | `CustomerRequestWorklogModal.tsx` | Bỏ check `<=0`, min=0 |
| Date format | detail/worklog inputs + util date | `DD/MM/YYYY HH:mm` (24h) và `DD/MM/YYYY` |
| Khóa nút chuyển | `CustomerRequestDetailPane.tsx` | Disable + tooltip khi detail status=`open` |
| Full screen | `CustomerRequestDetailFrame.tsx`, `CustomerRequestManagementHub.tsx`, `CustomerRequestCreateModal.tsx` | Create/edit/detail full screen |
| Tab Tệp sau transition | hooks fetch detail/attachments | Không reset rỗng sau transition |
| Ghi chú theo từng file trên UI tab `Tệp` | `CustomerRequestDetailPane.tsx` + AttachmentManager | Mỗi file hiển thị input/label ghi chú, lưu riêng từng file |
| API client | `customerRequestApi.ts` | Payload mới cho detail-status/worklog + attachment note |

---

## 8) Quy tắc nghiệp vụ bắt buộc

1. Vào status chính mới => detail status mặc định `open`.
2. Detail status = `open` => **không cho** chuyển status chính.
3. Click nút nhanh (`Đang thực hiện`/`Tạm ngưng`):
   - luôn mở popup ghi worklog
   - khi bấm lưu: vừa cập nhật detail status theo nút đã click, vừa lưu worklog trong cùng thao tác
4. Click nút `Ghi giờ công` ở tab `Giờ công`:
   - mở popup ghi worklog giống UI
   - khi bấm lưu: chỉ lưu worklog, không cập nhật detail status
5. Transition status chính:
   - status cũ auto `completed`
   - status mới auto `open`
5. Worklog cho phép `hours_spent = 0`.
6. Popup không đóng khi click nền ngoài.
7. Date-time theo chuẩn VN 24h.
8. File tab `Tệp` phải giữ ổn định qua transition.
9. Mỗi file upload phải có ghi chú riêng (`attachment_note`) và ghi chú này phải được bảo toàn qua transition.
10. Cập nhật ghi chú của file nào thì chỉ ảnh hưởng file đó.

---

## 9) Kế hoạch triển khai theo phase

| Phase | Mục tiêu | Deliverable | Kiểm thử chính |
|---|---|---|---|
| P1 | Chốt rule + mock UI tab mới | Spec + wireframe final | Review nghiệp vụ + xác nhận thứ tự tab |
| P2 | DB patch | Migration + SQL verify | Check schema/detail logs |
| P3 | Backend API/guard | API detail-status-worklog/transition | Test submit popup (update status + worklog) + guard open |
| P4 | Frontend UI | Tab gộp + tab order + full screen + popup worklog | Test thao tác thực tế toàn luồng |
| P5 | Regression CRC | Checklist regression | Detail/transition/tệp/timeline/worklog |
| P6 | UAT | Biên bản nghiệm thu | Test theo vai trò A/PM/R |

---

## 10) Checklist nghiệm thu

- [ ] Tabs lên đầu khung chỉnh sửa.
- [ ] Thứ tự tab đúng: `Chi tiết yêu cầu` → `Giờ công` → `Tệp` → `Ước lượng` → `Task/Ref` → `Dòng thời gian`.
- [ ] Tab `Chi tiết` cũ đã bỏ; nội dung đã gộp vào `Chi tiết yêu cầu`.
- [ ] `Ước lượng` đứng trước `Dòng thời gian`.
- [ ] Worklog cho nhập `0 giờ`.
- [ ] Có thêm 3 field: khó khăn/đề xuất/trạng thái xử lý khó khăn.
- [ ] Khi detail status=`open` thì khóa nút chuyển trạng thái chính (FE+BE).
- [ ] Click nút detail status luôn mở popup worklog; bấm Lưu sẽ đồng thời đổi detail status theo nút đã chọn và ghi worklog.
- [ ] Bấm `Ghi giờ công` ở tab `Giờ công` thì popup chỉ lưu worklog, không cập nhật detail status.
- [ ] Date format đúng `DD/MM/YYYY HH:mm` (24h), worklog date `DD/MM/YYYY`.
- [ ] Create/Edit/Detail full screen.
- [ ] File ở tab `Tệp` không mất sau transition.
- [ ] Mỗi file upload có ghi chú riêng và hiển thị đúng ghi chú trên tab `Tệp`.
- [ ] Ghi chú file không mất sau transition; sửa ghi chú file A không làm đổi file B.

---

## 11) Gợi ý thứ tự làm kỹ thuật

1. Chốt spec tab mới + wireframe.
2. Làm DB migration.
3. Làm backend API + guard + attachment safety.
4. Làm frontend tab/layout/popup/date/full-screen.
5. Chạy regression + UAT.