# Phác thảo giao diện v7 — Quản lý yêu cầu khách hàng

> **Ngày cập nhật:** 2026-03-22
> **Nguồn gốc:** Mô phỏng giao diện theo [Nâng cấp quản lý yêu cầu khách hàng v7](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/Nang_cap_quan_ly_yeu_cau_khach_hang_v7.md)
> **Mục tiêu:** Giúp team hình dung giao diện `customer_request_management` sau khi nâng cấp UI/UX theo hướng chuyên nghiệp, role-based, action-first
> **Phạm vi:** `overview / creator / dispatcher / performer / list / detail / modal`

---

## 1. Nguyên tắc mô phỏng

- Không vẽ để “đẹp chung chung”, mà để thấy rõ thứ tự quyết định.
- Mỗi role mở màn phải thấy ngay: `việc cần làm`, `rủi ro`, `nút xử lý nhanh`.
- Thông tin quan trọng được đặt ở 3 tầng:
  - `Tầng 1`: KPI + cảnh báo
  - `Tầng 2`: inbox / queue / priority list
  - `Tầng 3`: detail pane và modal xử lý sâu
- `List` không đứng tách rời; nó là nhịp giữa `workspace` và `detail`.
- App đã có menu trái tổng, nên mockup v7 này **không dùng thêm sidebar cấp 2** trong module.
- Điều hướng role bên trong module được chuyển thành `tabs / segmented switch / quick filters` ở khu vực header.
- Không dồn `KPI + inbox + bảng + phân tích` theo một cột dài trong cùng trạng thái mặc định.
- Mỗi role có 3 bề mặt truy cập nhanh:
  - `Inbox`: việc cần xử lý ngay
  - `Danh sách`: bảng tra cứu + detail
  - `Phân tích`: KPI, trend, top entity, risk

---

## 2. Khung giao diện tổng thể

### 2.1 Mô hình điều hướng nhanh

- `Lớp 1`: chọn role `Overview / Creator / Dispatcher / Performer`
- `Lớp 2`: chọn view `Inbox / Danh sách / Phân tích`
- `Thanh truy cập nhanh`: `Tìm YC`, `Saved view`, `Recent`, `Pinned`, `Filter nâng cao`
- `Nguyên tắc mặc định`:
  - `Overview` mở vào `Phân tích`
  - `Creator` mở vào `Inbox`
  - `Dispatcher` mở vào `Inbox`
  - `Performer` mở vào `Inbox`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ VNPT Business | Quản lý YC khách hàng                                      [Tìm YC] [Bộ lọc] [Tạo YC] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Overview ] [ Creator ] [ Dispatcher ] [ Performer ]     [Saved view] [Recent] [Pinned] [Filter]     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ] [ Danh sách ] [ Phân tích ]                                     [Sort] [Scope] [Mở nhanh]    │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Workspace shell                                                                                     👤 │
│                                                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Header điều hành: tên workspace | mô tả vai trò | CTA chính | filter ngữ cảnh                     │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                          │
│      Khi active = Inbox:                                                                                │
│      ┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐  │
│      │ Queue / attention / quick actions   │ Context phụ / side metrics                            │  │
│      └──────────────────────────────────────┴────────────────────────────────────────────────────────┘  │
│                                                                                                          │
│      Khi active = Danh sách:                                                                            │
│      ┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐  │
│      │ List pane                           │ Detail pane                                             │  │
│      └──────────────────────────────────────┴────────────────────────────────────────────────────────┘  │
│                                                                                                          │
│      Khi active = Phân tích:                                                                            │
│      ┌──────────────────────────────────────┬────────────────────────────────────────────────────────┐  │
│      │ KPI / trend / heatmap               │ top customer / top project / bottleneck               │  │
│      └──────────────────────────────────────┴────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Overview dashboard

### 3.1 Mục tiêu

Màn `Overview` là “tháp điều hành”. Không đi sâu thao tác một case như các role khác, mà trả lời:

- hệ thống đang nóng ở đâu
- đội nào đang bottleneck
- dự án/khách hàng nào đang có nguy cơ
- tuần này đang tốt hơn hay xấu hơn tuần trước

### 3.2 Wireframe — `Overview / Phân tích`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Creator ] [ Dispatcher ] [ Performer ]                               [Tìm YC] [Filter] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ] [ Danh sách ] [ Phân tích ● ]                                 [7 ngày] [30 ngày] [Export]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ OVERVIEW                                                                                         Admin │
│ Toàn cảnh vận hành YC khách hàng                                                                Admin │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ 146 Mở ] [ 12 SLA risk ] [ 19 Vượt estimate ] [ 8 Chờ phân công ] [ Throughput 7d: +14% ]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Attention board                                     │ Trend                                          │ │
│ │ 🔴 12 ca SLA risk                                   │ Mở mới vs đóng xong 7d / 30d                   │ │
│ │ 🟠 8 ca chờ phân công                               │ Trend theo tuần                                │ │
│ │ 🟡 19 ca vượt estimate                              │ Age buckets: 0-1d / 2-3d / 4-7d / >7d          │ │
│ │ [Xem danh sách nóng]                               │ [Mở dashboard chi tiết]                        │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────┬──────────────────────────────┬───────────────────────────────────────┐ │
│ │ Top khách hàng nóng          │ Top dự án nóng              │ Top bottleneck                        │ │
│ │ 1. VNPT HN  11 ca           │ 1. Billing Core  9 ca       │ Performer quá tải                     │ │
│ │ 2. FPT      8 ca            │ 2. Cổng HĐ      7 ca        │ PM nhiều ca chậm                      │ │
│ │ 3. Viettel  6 ca            │ 3. DMS Portal   5 ca        │ Role nào trả lại nhiều nhất           │ │
│ └──────────────────────────────┴──────────────────────────────┴───────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Bảng attention cases                                                                              │ │
│ │ Mã | Tiêu đề | KH / Dự án / SP | Owner hiện tại | TT | Est/Act | Risk | Next action | Updated     │ │
│ │ #0412 | Lỗi hóa đơn ... | VNPT HN / Billing / HĐĐT | Dev A | Coding | 6h/9h | Critical | PM xử lý │ │
│ │ #0415 | Thêm báo cáo ... | FPT / ERP / Dashboard  | PM B  | Chờ KH  | 4h/3h | Warning  | Báo KH    │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Workspace `CREATOR`

### 4.1 Điều creator cần thấy ngay

- yêu cầu nào đang chờ mình
- ai đang cầm việc
- có cần báo khách hàng không
- yêu cầu nào đang bị chậm hoặc bị trả lại

### 4.2 Wireframe — `Creator / Inbox`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Creator ● ] [ Dispatcher ] [ Performer ]                       [Tìm YC] [+ Tạo YC]     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ● ] [ Danh sách ] [ Phân tích ]                         [Saved view] [Bộ lọc của tôi]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ YC của tôi                                                                                              │
│ Theo dõi các YC do tôi tạo, phản hồi khách hàng, và đóng vòng giao tiếp                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ YC tôi tạo ] [ Chờ tôi quyết định ] [ Chờ báo KH ] [ Tạo→tiếp nhận TB ] [ Tỷ lệ bổ sung ]          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Cần tôi hành động                                   │ Side panel                                    │ │
│ │ 🟠 #0418 KH đã phản hồi        [Đánh giá]           │ Top khách hàng tôi tạo nhiều YC               │ │
│ │ 🔵 #0409 Đã hoàn thành          [Báo KH]            │ YC đóng gần đây                               │ │
│ │ 🔴 #0411 Bị trả lại              [Xem lý do]        │ Thời gian phản hồi TB của PM/performer        │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Danh sách của tôi    [Tìm YC] [Saved filter] [Sort: Cần xử lý]                                     │ │
│ │ Mã | Tiêu đề | KH / Dự án / SP | Owner hiện tại | TT | Next action | Updated | Flag               │ │
│ │ #0418 | Module đối soát | VNPT HN / Billing / Kế toán | PM B | Chờ KH | Creator đánh giá | 2h     │ │
│ │ #0409 | Lỗi dashboard   | FPT / ERP / BI             | Creator | Hoàn thành | Báo KH | 1d          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Detail emphasis cho creator

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ #0418 Module đối soát                     [Đánh giá KH] [Báo KH] [Xem timeline]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Trạng thái: Chờ phản hồi KH   Owner: Creator Nguyễn A   Next action: Đánh giá       │
│ KH / Dự án / SP: VNPT HN / Billing / Kế toán                                         │
│ Creator: Nguyễn A   PM: Trần B   Performer: Dev A                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Tóm tắt giao tiếp gần nhất                                                           │
│ - KH phản hồi lúc 10:32: "Đã gửi file API..."                                       │
│ - PM note gần nhất: "Cần xác nhận thêm mẫu input"                                   │
│ - File liên quan: api_spec.pdf, sample.xlsx                                          │
│ - Task IT360: IT360-4412                                                             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Tab] Tổng quan | Tiến độ | File & Task | Timeline                                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Workspace `DISPATCHER`

### 5.1 Điều dispatcher cần thấy ngay

- ca nào cần phân công ngay
- ai đang quá tải / còn trống
- ca nào thiếu estimate hoặc vượt estimate
- ca nào cần PM quyết định trong hôm nay

### 5.2 Wireframe — `Dispatcher / Inbox`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Creator ] [ Dispatcher ● ] [ Performer ]              [Tìm YC] [Saved view] [+]       │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ● ] [ Danh sách ] [ Phân tích ]                          [Theo team] [Theo dự án]            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Điều phối YC                                                                                             │
│ Hàng chờ phân công, tải đội ngũ, cảnh báo estimate và SLA                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Chờ phân công ] [ Ca PM cần chốt ] [ Ca trả lại ] [ SLA risk ] [ Load TB team ] [ Thiếu estimate ] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Inbox điều phối                                     │ PM action queue                               │ │
│ │ 🔴 #0421 Lỗi thanh toán       [Phân công]           │ #0415 Thiếu estimate     [Chốt]              │ │
│ │ 🟠 #0423 YC mới từ creator     [Phân công]           │ #0416 Vượt estimate      [Xem risk]          │ │
│ │ 🟡 #0417 Case trả lại          [Xử lý nhanh]         │ #0412 Chờ duyệt kết quả  [Duyệt]             │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Team load matrix                                    │ Bản đồ nóng theo dự án                       │ │
│ │ Dev A  4 ca | 32h | 80% 🟡                         │ Billing Core   9 ca | 3 risk                 │ │
│ │ Dev B  5 ca | 39h | 97% 🔴                         │ ERP Portal     6 ca | 2 trả lại              │ │
│ │ BA C   2 ca | 18h | 45% 🟢                         │ DMS Gateway    4 ca | 1 blocker              │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Bảng điều phối                                                                                     │ │
│ │ Mã | Tiêu đề | KH/Dự án/SP | Performer | Est/Act/Remain | Due | Risk | Lý do vào attention | CTA │ │
│ │ #0421 | Lỗi thanh toán | VNPT HN / Billing / HĐĐT | — | 8h/0h/8h | Hôm nay | Critical | Chưa PC │ │
│ │ #0416 | Báo cáo mới    | FPT / ERP / BI             | Dev B | 10h/14h/-4h | Mai | Warning | +40% │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Detail emphasis cho dispatcher

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ #0421 Lỗi thanh toán                                              [Điều phối nhanh]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Trạng thái: Mới tiếp nhận   Owner: Dispatcher Trần B   Next action: Phân công         │
│ Warning: Critical | SLA risk hôm nay | Chưa có performer                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Estimate: 8h    Actual: 0h    Remaining: 8h    Deadline: 22/03                        │
│ Team suggestions: Dev A (80%), BA C (45%), Dev B (97%)                                │
│ Ngữ cảnh: screenshot_error.png | IT360-5001 | Task tham chiếu JIRA-221               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Tab] Tổng quan | Estimate & Worklog | File & Task | Timeline | Audit                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Workspace `PERFORMER`

### 6.1 Điều performer cần thấy ngay

- hôm nay phải làm gì trước
- còn bao nhiêu giờ estimate
- PM đang đợi gì
- case nào đang bị chặn hoặc lâu chưa cập nhật

### 6.2 Wireframe — `Performer / Inbox`

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Creator ] [ Dispatcher ] [ Performer ● ]                    [Tìm YC] [Recent]          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ● ] [ Danh sách ] [ Phân tích ]                              [Tuần này] [Lọc blocker]        │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Việc của tôi                                                                                             │
│ Danh sách việc ưu tiên, thời gian còn lại, và cập nhật cần làm hôm nay                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Việc mới ] [ Đang thực hiện ] [ Giờ tuần này ] [ Ca sắp trễ ] [ Ca vượt estimate ]                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Làm ngay hôm nay                                    │ Timesheet tuần                                │ │
│ │ 🔴 #0412 API billing        [Nhận việc]             │ Mon 6h / Tue 7h / Wed 8h / Thu 4h / Fri 5h   │ │
│ │ 🟠 #0416 Báo cáo BI         [Tiếp tục]              │ Billable 24h | Non-billable 6h               │ │
│ │ 🟡 #0407 Mapping dữ liệu     [Cập nhật]             │ Top 3 ca tốn giờ nhất                         │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┬───────────────────────────────────────────────┐ │
│ │ Estimate còn lại theo ca                            │ Blocker / PM note                             │ │
│ │ #0412 còn 4h                                        │ #0412 PM chờ mẫu output                       │ │
│ │ #0416 còn 2h                                        │ #0407 Chờ DB dump                             │ │
│ │ #0407 còn 6h                                        │ #0411 Thiếu file từ creator                   │ │
│ └──────────────────────────────────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Bảng việc của tôi                                                                                   │ │
│ │ Mã | Tiêu đề | KH/Dự án/SP | PM | Est/Act/Remain | Due | Latest PM note | Blocker | CTA           │ │
│ │ #0412 | API billing | VNPT HN / Billing / Kế toán | Trần B | 10/6/4h | Hôm nay | Chờ mẫu output │ │
│ │ #0416 | Báo cáo BI  | FPT / ERP / Dashboard       | Trần B | 16/14/2h| Mai     | Chốt số liệu    │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Detail emphasis cho performer

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ #0412 API billing                                                 [Performer nhanh]     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Trạng thái: Đang xử lý   Owner: Dev A   PM: Trần B   Next action: Cập nhật progress     │
│ Estimate: 10h   Actual: 6h   Remaining: 4h   Due: 22/03                                  │
│ Latest PM note: "Chốt theo format file mẫu đính kèm"                                     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Context bắt buộc                                                                         │
│ - File hiện có: api_spec.pdf, sample_output.xlsx                                         │
│ - IT360 chính: IT360-4412                                                                │
│ - Task liên quan: JIRA-221, Internal-DB-88                                               │
│ - Worklog gần nhất: "Đã parse lỗi ở service invoice..."                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ [Tab] Tổng quan | Worklog | Estimate | File & Task | Timeline                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. View `Danh sách` + detail đồng bộ

### 7.1 Mô hình tương tác

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Creator ● ] [ Dispatcher ] [ Performer ]                           [Tìm YC] [Pinned]    │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Inbox ] [ Danh sách ● ] [ Phân tích ]                     [Saved filter] [Sort] [Filter nâng cao]   │
├─────────────────────────────────────────────┬────────────────────────────────────────────────────────────┤
│ List pane                                   │ Detail pane                                                │
│                                             │                                                            │
│ Quick filter bar                            │ #0412 API billing                                          │
│ [Chờ tôi] [SLA risk] [Thiếu estimate]       │ Status: Coding   Risk: Warning   Next action: PM review    │
│                                             │                                                            │
│ Mã  Tiêu đề  Owner  TT  Est/Act  Risk  ... │ CTA: [Điều phối nhanh] [Báo KH] [Cập nhật]                 │
│ 0412 ...                                    │                                                            │
│ 0416 ...                                    │ Context | Estimate | Worklog | File & Task | Timeline      │
│ 0407 ...                                    │                                                            │
│                                             │ Section 1: quyết định                                      │
│ Hover card: last worklog, owner, due, risk  │ Section 2: ngữ cảnh nghiệp vụ                              │
│                                             │ Section 3: tiến độ thực thi                                │
│                                             │ Section 4: lịch sử và giải thích                           │
└─────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

### 7.2 Nguyên tắc hiển thị trên mỗi row

- `badge trạng thái` phải đọc được trong 1 giây
- `risk` phải nằm cùng trục nhìn với `estimate/actual`
- `next action` không được chôn trong detail
- `owner hiện tại` luôn hiện rõ thay vì buộc mở case
- nếu có `file/task` quan trọng thì row có icon/hint nhỏ

---

## 8. Modal `Tạo yêu cầu mới`

### 8.1 Ý đồ UX

- form chính là nơi nhập thông tin yêu cầu
- cột quyết định chỉ hiển thị các yếu tố cần để tạo đúng luồng
- task/file phải là phần ngữ cảnh thật, không phải phần “trang trí”

### 8.2 Wireframe desktop

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Tạo yêu cầu mới                                                                                     ✕   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┬─────────────────────────────────┐ │
│ │ THÔNG TIN YÊU CẦU                                                 │ KẾT QUẢ SAU KHI TẠO            │ │
│ │                                                                  │                                 │ │
│ │ Khách hàng | Dự án | Sản phẩm *                                  │ Hướng xử lý                    │ │
│ │ [ Searchable select .......................................... ] │ (•) Tự xử lý   ( ) Chuyển PM  │ │
│ │                                                                  │                                 │ │
│ │ Tiêu đề *                                                        │ Nếu tự xử lý:                  │ │
│ │ [ ............................................................ ] │ - chuyển sang Đang xử lý       │ │
│ │                                                                  │ - gán performer ngay           │ │
│ │ Mô tả                                                            │                                 │ │
│ │ [ ............................................................ ] │ Nếu chuyển PM:                 │ │
│ │ [ ............................................................ ] │ - đưa vào hàng chờ điều phối   │ │
│ │                                                                  │ - PM thấy ngay trong inbox     │ │
│ │ Kênh tiếp nhận        Ưu tiên                                    │                                 │ │
│ │ [ Điện thoại ▼ ]     [ Trung bình ▼ ]                            │ Estimate ban đầu               │ │
│ │                                                                  │ [ 4.0 ] giờ                    │ │
│ │ TASK & NGỮ CẢNH                                                  │ [ Ghi chú estimate ......... ] │ │
│ │ [Tab IT360] [Tab Tham chiếu]                         [+ Thêm]    │                                 │ │
│ │ IT360-4412 | link | trạng thái | x                              │ PM / Người xử lý              │ │
│ │ JIRA-221   | link | trạng thái | x                              │ [ Select theo hướng xử lý ]   │ │
│ │                                                                  │                                 │ │
│ │ ĐÍNH KÈM                                                         │ Summary                        │ │
│ │ [Upload file]  api_spec.pdf   sample.xlsx                        │ KH: VNPT HN                    │ │
│ │                                                                  │ SP: Billing / Kế toán          │ │
│ │                                                                  │ Outcome: Chờ PM                │ │
│ └────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘ │
│                                                                                                          │
│ Sticky footer: [Hủy] [Lưu nháp] [Tạo yêu cầu]                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Wireframe responsive

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Tạo yêu cầu mới                                                 ✕   │
├──────────────────────────────────────────────────────────────────────┤
│ Thông tin yêu cầu                                                   │
│ Khách hàng | Dự án | Sản phẩm                                       │
│ Tiêu đề / Mô tả / Kênh / Ưu tiên                                    │
│ Task & ngữ cảnh                                                     │
│ Đính kèm                                                            │
│ ───────────────────────────────────────────────────────────────────  │
│ Hướng xử lý                                                         │
│ Estimate ban đầu                                                    │
│ PM / Người xử lý                                                    │
│ Summary sau khi tạo                                                 │
│ ───────────────────────────────────────────────────────────────────  │
│ Sticky footer: [Hủy] [Tạo yêu cầu]                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Modal `Transition`

### 9.1 Ý đồ UX

- Người dùng phải thấy rõ `đang ở đâu -> sẽ đi đâu`.
- Modal không chỉ hỏi form mới, mà phải cho thấy ngữ cảnh file/task hiện có.
- Hành động phải có “expected outcome”.

### 9.2 Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Chuyển trạng thái — #0412 API billing                                                                 ✕ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Từ: Đang xử lý  ─────────────▶  Sang: Chờ duyệt kết quả                                                 │
│ Expected outcome: PM sẽ thấy case trong hàng chờ duyệt, kèm file bằng chứng và worklog mới nhất       │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────┬─────────────────────────────────┐ │
│ │ Bổ sung cho bước mới                                              │ Ngữ cảnh hiện có                │ │
│ │                                                                  │                                 │ │
│ │ Lý do / ghi chú                                                   │ File đã có                      │ │
│ │ [ ............................................................ ] │ - api_spec.pdf                 │ │
│ │                                                                  │ - sample_output.xlsx           │ │
│ │ Kết quả / mô tả                                                   │                                 │ │
│ │ [ ............................................................ ] │ Task IT360                      │ │
│ │                                                                  │ - IT360-4412                   │ │
│ │ Worklog                                                           │                                 │ │
│ │ Giờ công [ 1.0 ]  Activity [ Coding ▼ ]                          │ Task liên quan                  │ │
│ │ Nội dung [ .................................................. ]  │ - JIRA-221                     │ │
│ │                                                                  │                                 │ │
│ │ Đính kèm bổ sung                                                  │ Ghi chú gần nhất                │ │
│ │ [Upload file] output_v2.xlsx                                      │ - "Đã fix phần parse dữ liệu"  │ │
│ └────────────────────────────────────────────────────────────────────┴─────────────────────────────────┘ │
│                                                                                                          │
│ Footer: [Hủy] [Xác nhận chuyển bước]                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Modal `Đánh giá KH` và `Báo KH`

### 10.1 Modal đánh giá KH

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Đánh giá phản hồi KH — #0418                                                                           ✕ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ KH phản hồi gần nhất: "Đã gửi file API và dữ liệu test"                                                │
│ Thời gian: 22/03 10:30                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Quyết định                                                                                                │
│ (•) Đủ thông tin -> tiếp tục xử lý                                                                      │
│ ( ) Yêu cầu KH bổ sung                                                                                   │
│     Nội dung cần bổ sung [................................................]                             │
│ ( ) Không thực hiện                                                                                      │
│     Lý do [.........................................................]                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Context liên quan: file + task + note gần nhất                                                          │
│ - File: api_spec.pdf, sample.xlsx                                                                       │
│ - IT360: IT360-4412                                                                                     │
│ - PM note: "Chờ creator xác nhận format input"                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Worklog: [0.5h] [Hỗ trợ ▼] [Đọc phản hồi và đánh giá tài liệu ....]                                    │
│ Footer: [Hủy] [Xác nhận]                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Modal báo khách hàng

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Báo khách hàng — #0409                                                                                 ✕ │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ KH: VNPT HCM — Anh Minh                                                                                 │
│ Kết quả hiện tại: Hoàn thành   Giờ: 5h / 6h   File bàn giao: 2                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kênh báo [Điện thoại ▼]                                                                                 │
│ Nội dung báo [...................................................................]                     │
│ KH phản hồi [....................................................................]                     │
│ Đính kèm thêm [Upload file]                                                                             │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Context phải thấy được                                                                                  │
│ - File đã có: release_note.pdf, output.xlsx                                                             │
│ - IT360: IT360-4401                                                                                     │
│ - Task liên quan: JIRA-220                                                                              │
│ - Lần xử lý cuối: "Đã deploy và xác nhận số liệu khớp"                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Worklog: [0.5h] [Trao đổi KH ▼] [Gọi xác nhận kết quả và ghi nhận phản hồi]                            │
│ Footer: [Hủy] [Xác nhận — Kết thúc YC]                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Gợi ý visual direction

### 11.1 Màu theo role

- `Creator`: xanh teal dịu, nhấn vào giao tiếp và follow-up
- `Dispatcher`: cam/amber nhạt, nhấn vào quyết định và điều phối
- `Performer`: xanh dương sâu, nhấn vào tiến độ và thực thi
- `Overview`: slate / neutral, nhấn vào toàn cảnh

### 11.2 Hệ thống badge

- `Status badge`: trạng thái workflow
- `Risk badge`: `Info / Warning / Critical`
- `Ownership badge`: `Creator / PM / Performer / KH`
- `Next action badge`: hành động kế tiếp

### 11.3 Mật độ thông tin

- `KPI row`: compact, đọc nhanh
- `Priority queue`: nổi bật, card hoặc list density vừa
- `Table`: dense vừa phải, có hover card
- `Detail`: thoáng hơn table, ưu tiên block quyết định

---

## 12. Gợi ý thực thi theo mockup

1. Dựng `workspace shell` chung cho cả 4 role, dùng `role switch ngang` thay cho sidebar cấp 2.
2. Thêm `view switch`: `Inbox / Danh sách / Phân tích`.
3. Chuẩn hóa `priority queue`, `analysis widgets`, `quick access bar`.
4. Nâng `list pane` thành table để ra quyết định.
5. Tách `detail pane` theo 4 block: quyết định, ngữ cảnh, tiến độ, lịch sử.
6. Chỉnh lại `create / transition / feedback / notify modal` theo mockup trên.
7. Sau khi code xong, chụp visual regression ở:
   - `overview`
   - `creator`
   - `dispatcher`
   - `performer`
   - `create modal`
   - `transition modal`

---

## 13. Kết luận

Mockup v7 này không thay thế plan gốc, mà đóng vai trò:

- bản mô phỏng để trao đổi với business
- khung cho dev/frontend implement
- chuẩn để kiểm tra `UI có còn đang thiên về raw data hay đã chuyển sang action-first`

Nếu cần đi tiếp, bước hợp lý nhất là tách mockup này thành backlog component:

- `WorkspaceShell`
- `RoleHeader`
- `KpiStrip`
- `PriorityQueue`
- `AnalysisWidgets`
- `DecisionTable`
- `DecisionDetailPane`
- `ProfessionalCreateModal`
- `ProfessionalTransitionModal`
