# Phác thảo giao diện — Quản lý Yêu cầu Khách hàng

> Theo 3 vai trò: CREATOR → DISPATCHER → PERFORMER + Dashboard tổng hợp

---

## 1. LUỒNG TỔNG QUAN

```
  CREATOR                    DISPATCHER                  PERFORMER
  ════════                   ═══════════                 ══════════

  ┌─────────┐
  │ Tạo YC  │
  └────┬────┘
       │
       ├── Tự xử lý ──────────────────────────────────▶ ┌──────────┐
       │                                                 │ Nhận việc│
       │                                                 └────┬─────┘
       │                                                      │
       └── Chuyển PM ──▶ ┌────────────┐                      │
                         │ Đánh giá   │                      │
                         │ Phân công  │──── Giao ────────▶   │
                         └─────┬──────┘                      │
                               │                             ▼
                               │ Giám sát  ◀──────── ┌──────────┐
                               │                     │ Xử lý    │
                               │                     │ Ghi giờ  │
                               │                     └────┬─────┘
                               │                          │
                         ┌─────┴──────┐                   │
                         │ Duyệt KQ   │◀── Hoàn thành ───┘
                         └─────┬──────┘
                               │
  ┌──────────┐                 │
  │ Báo KH   │◀───────────────┘
  └──────────┘
```

---

## 2. CREATOR — Người tiếp nhận

### 2.1 Trang chính: "YC của tôi"

```
┌─────────────────────────────────────────────────────────┐
│  VNPT Business          YC của tôi        👤 Nguyễn A  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [ 12 Mới ]  [ 8 Đang XL ]  [ 45 Hoàn thành ]  [ 3 ❌]│
│                                                         │
│  ── Cần hành động ──────────────────────────────────    │
│                                                         │
│  🟠 #0318  Module kết nối     Chờ KH      [Đánh giá]   │
│  🔴 #0315  Lỗi báo cáo       Hoàn thành  [Báo KH  ]   │
│  🟡 #0320  YC bổ sung         Mới         [Xử lý ▼ ]   │
│                                                         │
│  ── Danh sách ──────────────── 🔍 ──── [+ Tạo YC] ──  │
│                                                         │
│  Mã    Tiêu đề        KH       TT     Est  Act   Ngày  │
│  0320  YC bổ sung     VNPT HN  🟢Mới   4h   —   20/03  │
│  0318  Module kết nối FPT      🟡ChờKH  8h  3h   18/03  │
│  0315  Lỗi báo cáo   VNPT HCM 🔵HT     6h  5h   15/03  │
│  0312  Tích hợp API   Viettel  ⚙️Code  17h 12h   12/03  │
│  ...                                                     │
│                                                         │
│  ◀ 1 2 3 4 5 ▶                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Form tạo YC mới

```
┌─────────────────────────────────────────────────────────┐
│  TẠO YÊU CẦU MỚI                                   ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Khách hàng *     [▼ Tìm KH...                      ]  │
│  Người liên hệ    [▼ Chọn...                        ]  │
│  Dự án            [▼ Chọn DA...                      ]  │
│  Hạng mục         [▼ Chọn...        ]  SP [▼ Chọn.. ]  │
│  Nhóm DVHT        [▼ Chọn...                        ]  │
│  ─────────────────────────────────────────────────────  │
│  Tiêu đề *        [                                  ]  │
│  Mô tả            [                                  ]  │
│                    [                                  ]  │
│  Ưu tiên          ○Thấp  ◉TB  ○Cao  ○Khẩn            │
│  Kênh tiếp nhận   [▼ Điện thoại  ]                     │
│  Đính kèm         [📎 Chọn file]  file1.png ✕          │
│  ─────────────────────────────────────────────────────  │
│  Est. giờ          [ 4.0 ] giờ   Ghi chú [          ]  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Hướng xử lý:                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ◉ Tự xử lý    Người XL: [▼ Tôi (Nguyễn A)  ]  │   │
│  │ ○ Chuyển PM    PM:       [▼ Chọn PM...       ]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                          [ Hủy ]  [ Tạo yêu cầu ]      │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Popup đánh giá khi KH phản hồi

```
┌─────────────────────────────────────────────────────────┐
│  ĐÁNH GIÁ PHẢN HỒI KH — #0318                      ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KH đã phản hồi:  "Đã gửi tài liệu API qua email"    │
│  Thời gian:        20/03 10:30                          │
│                                                         │
│  Thông tin đã đủ?                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ◉ Đủ → Tiếp tục xử lý                          │   │
│  │ ○ Chưa đủ → Yêu cầu KH bổ sung                │   │
│  │   Nội dung cần bổ sung: [                     ] │   │
│  │ ○ Không thực hiện                               │   │
│  │   Lý do: [                                    ] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Giờ công:  [ 0.5 ] giờ   [▼ Hỗ trợ ]                 │
│  Nội dung:  [ Đọc tài liệu KH gửi, đánh giá đầy đủ ] │
│                                                         │
│                          [ Hủy ]  [ Xác nhận ]          │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Popup báo khách hàng

```
┌─────────────────────────────────────────────────────────┐
│  BÁO KHÁCH HÀNG — #0315                             ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KH:        VNPT HCM — Anh Minh (0912xxx)              │
│  Kết quả:   ✅ Hoàn thành   Giờ: 5h/6h (83%) 🟢       │
│  ─────────────────────────────────────────────────────  │
│  Kênh báo       [▼ Điện thoại  ]                       │
│  Nội dung       [ YC đã xử lý xong. Anh kiểm tra... ] │
│                  [                                    ] │
│  KH phản hồi    [                                    ] │
│  Đính kèm       [📎 Chọn file]                         │
│  ─────────────────────────────────────────────────────  │
│  Giờ công:  [ 0.5 ] giờ   [▼ Hỗ trợ ]                 │
│  Nội dung:  [ Gọi KH thông báo kết quả               ] │
│                                                         │
│                     [ Hủy ]  [ Xác nhận — Kết thúc YC ] │
└─────────────────────────────────────────────────────────┘
```

---

## 3. DISPATCHER — PM / A trong RACI

### 3.1 Trang chính: "Điều phối"

```
┌─────────────────────────────────────────────────────────┐
│  VNPT Business       Điều phối YC         👔 Trần B    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [🔴 5 Chờ PC]  [⚙️ 12 Đang XL]  [85% Đúng hạn]  [⏱️ 3.2h TB]│
│                                                         │
│  ── Đội ngũ ────────────────────────────────────────    │
│                                                         │
│  Performer       Đang làm   Giờ/tuần   Tải            │
│  Ngô Dev A       3 YC       28/40h     ██████░░ 70% 🟢│
│  Lê Dev B        5 YC       36/40h     █████████ 90% 🟠│
│  Phạm BA C       2 YC       18/40h     ████░░░░ 45% 🟢│
│  Hoàng Sup D     4 YC       32/40h     ████████ 80% 🟡│
│                                                         │
│  ── Chờ phân công (5) ────────────────────── Sắp ƯT ──│
│                                                         │
│  🔴 #0319  Lỗi thanh toán  VNPT HN  Khẩn  [Phân công] │
│  🟠 #0317  Thêm báo cáo   FPT      Cao    [Phân công] │
│  🟡 #0316  Cập nhật DM    Viettel  TB     [Phân công] │
│  ...                                                    │
│                                                         │
│  ── Trả lại (1) ───────────────────────────────────    │
│                                                         │
│  ⚠️ #0314  Tích hợp SSO   "Vượt khả năng"             │
│            [Giao lại]  [Phân tích]  [Chờ KH]  [Từ chối]│
│                                                         │
│  ── Chờ duyệt KQ (1) ──────────────────────────────    │
│                                                         │
│  🔵 #0312  Tích hợp API   12.5/17h (73%) 🟢            │
│            [✅ Duyệt → Báo KH]  [🔄 Chưa đạt]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Popup phân công

```
┌─────────────────────────────────────────────────────────┐
│  PHÂN CÔNG — #0319  Lỗi module thanh toán            ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KH: VNPT HN — Chị Lan     ƯT: 🔴Khẩn    Est: 8h     │
│  Tạo bởi: Nguyễn A (20/03 14:30)                       │
│  Mô tả: KH báo nhấn "Xuất HĐ" hiện lỗi 500...        │
│  📎 screenshot_error.png                                │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Quyết định:                                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ○ Từ chối          Lý do: [                   ] │   │
│  │                                                  │   │
│  │ ○ Tự xử lý (PM làm trực tiếp)                  │   │
│  │                                                  │   │
│  │ ◉ Giao người xử lý                              │   │
│  │   Người XL:  [▼ Ngô Dev A (3 YC, 70%)       ]  │   │
│  │                                                  │   │
│  │ ○ Chuyển phân tích                               │   │
│  │   BA:        [▼ Chọn BA...                   ]  │   │
│  │                                                  │   │
│  │ ○ Chờ KH cung cấp thông tin                     │   │
│  │   Cần KH:    [                                ] │   │
│  │   Hạn:       [ 22/03/2026 ]                     │   │
│  └─────────────────────────────────────────────────┘   │
│  ─────────────────────────────────────────────────────  │
│  Est. của PM:  [ 6.0 ] giờ   (ban đầu 8h)              │
│  Ghi chú:      [ Lỗi query, Dev A quen module      ]   │
│  ─────────────────────────────────────────────────────  │
│  Giờ công:  [ 0.5 ] giờ   [▼ Họp & trao đổi ]         │
│  Nội dung:  [ Đánh giá YC, trao đổi phân công       ]  │
│                                                         │
│                          [ Hủy ]  [ Xác nhận ]          │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Giám sát tiến độ

```
┌─────────────────────────────────────────────────────────┐
│  GIÁM SÁT TIẾN ĐỘ                    Tháng 03/2026    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ── Giờ công vs Ước lượng ──────────────────────────    │
│                                                         │
│  Ngô Dev A   ████████████████░░░░  80/96h  83% 🟡      │
│  Lê Dev B    ██████████████████░░  92/104h 88% 🟠      │
│  Phạm BA C   ████████░░░░░░░░░░░  42/60h  70% 🟢      │
│  Hoàng Sup D ████████████░░░░░░░  56/72h  78% 🟡      │
│  Tổng        ████████████████░░░  270/332h 81% 🟡      │
│                                                         │
│  ── Tất cả YC đang XL ──── 🔍 ──── [▼ Bộ lọc] ────   │
│                                                         │
│  Mã   Tiêu đề         Performer   TT       Est  Act %  │
│  0319 Lỗi thanh toán  Ngô Dev A  ⚙️XL      6h  2h 33% │
│  0317 Thêm báo cáo    Lê Dev B   ⚙️Code   16h 10h 62% │
│  0316 Cập nhật DM     Hoàng D    ⚙️XL      4h  3h 75% │
│  0314 Tích hợp SSO    —          🔙Trả lại 12h  8h 67% │
│  0312 Tích hợp API    Ngô Dev A  ⚙️Code   17h 12h 71% │
│  0310 Module import   Phạm BA C  🔍PT       —  3h  —   │
│                                                         │
│  ── Cảnh báo ───────────────────────────────────────    │
│                                                         │
│  🔴 #0314 Tích hợp SSO — vượt SLA 4h                   │
│  🟠 #0316 Cập nhật DM — 75% est, sắp hết giờ          │
│  ⚠️ #0310 Module import — chưa có estimate              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. PERFORMER — Người xử lý

### 4.1 Trang chính: "Việc của tôi"

```
┌─────────────────────────────────────────────────────────┐
│  VNPT Business        Việc của tôi       🔧 Ngô Dev A  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [📥 3 Mới]  [⚙️ 2 Đang làm]  [✅ 18 HT tháng]  [⏱️ 28h/tuần]│
│                                                         │
│  ── Timesheet tuần ─────────────────────────────────    │
│  T2    T3    T4    T5    T6    T7   CN   Tổng           │
│  6.0h  7.5h  5.0h  8.0h  1.5h  —    —    28/40h        │
│  ███   ████  ██░   ████  █░░   ░░   ░░                  │
│                                                         │
│  ── Việc mới chờ nhận ──────────────────────────────    │
│                                                         │
│  📥 #0319 Lỗi thanh toán  VNPT HN  🔴Khẩn  Est:6h     │
│     PM: Trần B  "Lỗi query, anh quen module này"       │
│     [✅ Nhận việc]  [❌ Trả lại]                        │
│                                                         │
│  📥 #0320 YC bổ sung      VNPT HN  🟡TB    Est:4h     │
│     Từ CREATOR: Nguyễn A (giao trực tiếp)              │
│     [✅ Nhận việc]  [❌ Trả lại]                        │
│                                                         │
│  ── Đang thực hiện ─────────────────────────────────    │
│                                                         │
│  ⚙️ #0312 Tích hợp API  Viettel  ⚙️coding              │
│     Est:17h  Act:12.5h  ████████████████░░░░ 73% 🟡    │
│     [📝 Giờ công]  [✅ Hoàn thành]  [🔙 Trả PM]       │
│                                                         │
│  ⚙️ #0315 Sửa lỗi BC    VNPT HCM  ⚙️in_prog           │
│     Est:6h   Act:4h     ████████████░░░░░░░ 67% 🟢    │
│     [📝 Giờ công]  [✅ Hoàn thành]  [🔙 Trả PM]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Popup nhận việc

```
┌─────────────────────────────────────────────────────────┐
│  NHẬN VIỆC — #0319                                   ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Lỗi module thanh toán — không xuất được hóa đơn       │
│  KH: VNPT HN   ƯT: 🔴Khẩn   DA: ERP VNPT HN          │
│  Mô tả: KH báo nhấn "Xuất HĐ" hiện lỗi 500...        │
│  📎 screenshot_error.png  📎 error_log.txt              │
│  ─────────────────────────────────────────────────────  │
│  Lịch sử estimate:                                      │
│    • 8h — Nguyễn A (CREATOR)                            │
│    • 6h — Trần B (PM)  ← hiện hành                     │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Est. của tôi:  [ 5.0 ] giờ   (PM: 6h)                 │
│  Ghi chú:       [ Biết nguyên nhân, fix nhanh hơn    ] │
│                                                         │
│              [ Trả lại PM ]  [ ✅ Nhận & bắt đầu ]     │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Chi tiết YC đang xử lý (tabs)

```
┌─────────────────────────────────────────────────────────┐
│  #0312 Tích hợp API               Est:17h Act:12.5h    │
│  Viettel                          ████████████░░░ 73% 🟡│
├─────────────────────────────────────────────────────────┤
│  [Chi tiết] [📝 Giờ công] [⏱️ Est] [📎 File] [🎫 Task]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ═══ TAB: GIỜ CÔNG ═══                                  │
│                                                         │
│  ┌── Thêm giờ công ────────────────────────────────┐   │
│  │ Ngày:    [20/03/2026 📅]   Giờ: [ 2.0 ]         │   │
│  │ Loại:    [▼ Viết/review code ]   Phí KH: [✓]    │   │
│  │ ND:      [ Fix query xuất HĐ, thêm index      ] │   │
│  │ File:    [📎 Chọn]                               │   │
│  │                         [ 💾 Lưu giờ công ]      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Ngày   Giờ   Nội dung                      Loại  Phí  │
│  20/03  1.0h  Phân tích log, xác định NC    CODE   ✓   │
│  20/03  0.5h  Trao đổi PM về phương án      HỌP   ✗   │
│  19/03  3.0h  Code module kết nối API       CODE   ✓   │
│  18/03  4.0h  Setup môi trường, đọc API doc R&D    ✓   │
│  17/03  4.0h  Code xử lý mapping data       CODE   ✓   │
│  ────── ───── ────────────────────────────── ───── ──── │
│  Tổng   12.5h                               11h phí    │
│                                                         │
│  ── Hành động ──────────────────────────────────────    │
│  [✅ Hoàn thành]  [🔙 Trả PM]  [⏸️ Tạm ngưng]        │
│  [⏱️ Cập nhật est]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Popup hoàn thành

```
┌─────────────────────────────────────────────────────────┐
│  HOÀN THÀNH — #0312                                 ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tích hợp API Viettel   Est:17h  Act:12.5h  73% 🟢     │
│  ─────────────────────────────────────────────────────  │
│  Kết quả:   [ Đã code + unit test + deploy staging   ] │
│             [ API mapping 100%, test OK 50k records  ] │
│  Đính kèm:  [📎 Chọn]  test_report.pdf ✕               │
│  ─────────────────────────────────────────────────────  │
│  Giờ bước cuối: [ 2.0 ] giờ  [▼ Kiểm thử & QA ]      │
│  Nội dung:      [ Test tích hợp, verify kết quả     ]  │
│                                                         │
│                          [ Hủy ]  [ ✅ Xác nhận HT ]   │
└─────────────────────────────────────────────────────────┘
```

### 4.5 Phân tích (BA)

```
┌─────────────────────────────────────────────────────────┐
│  PHÂN TÍCH — #0310                                   ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Module import dữ liệu từ hệ thống cũ                  │
│  KH: MobiFone   DA: Migration project                  │
│  ─────────────────────────────────────────────────────  │
│  Nội dung PT:                                           │
│  [ KH cần import 50k records từ Oracle DB cũ.         ] │
│  [ Cần: mapping schema, script, validate, deploy.     ] │
│  Đính kèm: [📎 Chọn]  analysis_spec.docx ✕             │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Est. theo giai đoạn:                                   │
│  ┌───────────────────────┬────────┬──────────────────┐ │
│  │ Giai đoạn             │ Giờ    │ Ghi chú          │ │
│  │ Lập trình             │ [ 12 ] │ Migration script │ │
│  │ Kiểm thử              │ [  4 ] │ Sample + full    │ │
│  │ Triển khai             │ [  2 ] │ Staging + prod   │ │
│  │ ───────────────────── │ ────── │ ──────────────── │ │
│  │ TỔNG                  │  18h   │ → cập nhật est   │ │
│  └───────────────────────┴────────┴──────────────────┘ │
│                                                         │
│  Hướng xử lý:                                          │
│  ◉ Chuyển Lập trình   Dev: [▼ Ngô Dev A          ]    │
│  ○ Chuyển DMS                                          │
│  ○ Trả lại PM                                          │
│  ─────────────────────────────────────────────────────  │
│  Giờ PT: [ 3.0 ] giờ  [▼ Nghiên cứu & Phân tích ]    │
│  ND:     [ Phân tích YC, viết spec, mapping schema ]   │
│                                                         │
│                        [ Hủy ]  [ Xác nhận & chuyển ]  │
└─────────────────────────────────────────────────────────┘
```

### 4.6 Trả lại PM

```
┌─────────────────────────────────────────────────────────┐
│  TRẢ LẠI PM — #0314                                 ✕  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tích hợp SSO   Est:12h  Act:8h  67%                   │
│  ─────────────────────────────────────────────────────  │
│  Lý do:     [ Cần tài liệu API từ KH, vượt khả năng ] │
│             [ hỗ trợ. Đề xuất chuyển đội DMS.        ] │
│  ─────────────────────────────────────────────────────  │
│  Giờ bước này: [ 1.0 ] giờ  [▼ Nghiên cứu ]          │
│  ND:           [ Thử tích hợp, phát hiện thiếu doc  ]  │
│                                                         │
│                        [ Hủy ]  [ 🔙 Xác nhận trả ]   │
└─────────────────────────────────────────────────────────┘
```

---

## 5. DASHBOARD TỔNG HỢP (Admin / Ban lãnh đạo)

```
┌─────────────────────────────────────────────────────────┐
│  VNPT Business      Dashboard YC            03/2026     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [📥 58 Mới] [⚙️ 23 XL] [✅ 142 HT] [❌ 8] [📊 85%SLA]│
│                                                         │
│  ── Xu hướng 3 tháng ──────────────────────────────     │
│                                                         │
│  Chỉ số               T1     T2     T3    Hướng        │
│  TG XL trung bình     8.5h   7.2h   6.1h  ↓ tốt       │
│  HT đúng SLA          78%    82%    85%   ↑ tốt       │
│  Est chính xác         62%    68%    74%   ↑ tốt       │
│  Tổng giờ công        520h   580h   610h  ↑            │
│  Giờ billable          68%    71%    73%   ↑ tốt       │
│  Tồn đọng              15     12      8   ↓ tốt       │
│                                                         │
│  ── Phân bổ theo TT ───────────────────────────────     │
│                                                         │
│  Mới tiếp nhận  ███░░░░░░░░░░░░░░░░░░░░░░░  5          │
│  Chờ phân công  ██░░░░░░░░░░░░░░░░░░░░░░░░  3          │
│  Đang XL        ████████████░░░░░░░░░░░░░░  12         │
│  Phân tích      ████░░░░░░░░░░░░░░░░░░░░░░  4          │
│  Lập trình      ██████░░░░░░░░░░░░░░░░░░░░  6          │
│  DMS            ████░░░░░░░░░░░░░░░░░░░░░░  4          │
│  Hoàn thành     ██████████████████░░░░░░░░  18         │
│  Đã báo KH     ████████████████████████████ 142        │
│                                                         │
│  ── Top KH ─────────────────────────────────────────    │
│                                                         │
│  1. VNPT HN    25 YC  TB:5.2h  SLA:88%   Giờ:120h     │
│  2. FPT        18 YC  TB:7.1h  SLA:82%   Giờ: 95h     │
│  3. Viettel    12 YC  TB:8.5h  SLA:79%   Giờ: 80h     │
│  4. VNPT HCM    8 YC  TB:4.8h  SLA:90%   Giờ: 45h     │
│  5. MobiFone    5 YC  TB:6.0h  SLA:85%   Giờ: 30h     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 6. KPI TỔNG HỢP THEO VAI TRÒ

```
╔═════════════════════════════════════════════════════════╗
║  CREATOR                                                ║
║  ───────                                                ║
║  • Số YC tiếp nhận / tháng              kỳ vọng ≥ 20   ║
║  • TG trung bình tạo → phân công        kỳ vọng ≤ 1h   ║
║  • Tỷ lệ tự xử lý (không qua PM)       kỳ vọng ≥ 50%  ║
║  • Tỷ lệ YC mô tả đầy đủ              kỳ vọng ≥ 90%  ║
║  • TG trung bình báo KH sau hoàn thành  kỳ vọng ≤ 2h   ║
║  • Số YC quá hạn chưa xử lý            kỳ vọng ≤ 5%   ║
╠═════════════════════════════════════════════════════════╣
║  DISPATCHER                                             ║
║  ──────────                                             ║
║  • TG trung bình phân công               kỳ vọng ≤ 2h   ║
║  • Tỷ lệ HT đúng SLA                   kỳ vọng ≥ 85%  ║
║  • Tỷ lệ ước lượng chính xác (±20%)    kỳ vọng ≥ 70%  ║
║  • Tỷ lệ YC bị trả lại từ performer    kỳ vọng ≤ 10%  ║
║  • Tỷ lệ sử dụng nguồn lực đội ngũ    kỳ vọng 70-90%  ║
║  • Số YC tồn đọng (backlog > 48h)       kỳ vọng ≤ 3    ║
║  • TG trung bình toàn bộ YC (tạo→HT)   kỳ vọng ≤ 24h  ║
╠═════════════════════════════════════════════════════════╣
║  PERFORMER                                              ║
║  ─────────                                              ║
║  • Số YC hoàn thành / tháng             kỳ vọng ≥ 15   ║
║  • TG trung bình xử lý / YC            tùy loại YC    ║
║  • Tỷ lệ HT đúng estimate (±20%)       kỳ vọng ≥ 75%  ║
║  • Tỷ lệ trả lại PM                    kỳ vọng ≤ 10%  ║
║  • Tổng giờ công / tuần                kỳ vọng 32-40h  ║
║  • Tỷ lệ giờ billable                  kỳ vọng ≥ 70%  ║
║  • Tỷ lệ HT lần đầu (không bị trả)    kỳ vọng ≥ 85%  ║
║  • Độ chính xác est khi nhận việc       kỳ vọng ≥ 70%  ║
╠═════════════════════════════════════════════════════════╣
║  TỔNG THỂ (Admin)                                       ║
║  ────────────────                                       ║
║  • TG xử lý trung bình                 xu hướng giảm   ║
║  • Tỷ lệ HT đúng SLA                  xu hướng tăng   ║
║  • Tỷ lệ est chính xác                xu hướng tăng   ║
║  • Tổng giờ công + giờ billable         xu hướng tăng   ║
║  • Tồn đọng                            xu hướng giảm   ║
║  • Top KH (số YC, TG TB, SLA, giờ)     theo tháng      ║
╚═════════════════════════════════════════════════════════╝
```

---

## 7. TRA CỨU YÊU CẦU — Admin / A dự án

> Nhấn vào bất kỳ mã YC nào từ danh sách, dashboard, hoặc gõ mã YC trên thanh tìm kiếm
> → Mở trang chi tiết toàn cảnh: **ai đang xử lý, tiến độ, đang ở giai đoạn nào**

### 7.1 Trang tra cứu chi tiết YC

```
┌───────────────────────────────────────────────────────────────────────────┐
│  🔍 TRA CỨU YÊU CẦU               [ #YC-2024-0312               🔍 ]  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌── HEADER ─────────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  #YC-2024-0312                                                     │   │
│  │  Tích hợp API thanh toán Viettel                                   │   │
│  │                                                                    │   │
│  │  Giai đoạn       ⚙️ ĐANG LẬP TRÌNH (coding)                      │   │
│  │                   ↳ bước 6/12 trong luồng xử lý                   │   │
│  │                                                                    │   │
│  │  Tiến độ giờ     ████████████████░░░░░░  12.5 / 17h (73%) 🟡      │   │
│  │  Thời gian       Tạo: 12/03  →  Hiện tại: 8 ngày                 │   │
│  │  Ưu tiên         🟠 Cao           SLA: còn 16h 🟢                 │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── 3 VAI TRÒ ─────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  👤 Người tạo          👔 PM điều phối        🔧 Đang xử lý      │   │
│  │  ──────────────        ──────────────         ──────────────      │   │
│  │  Nguyễn A              Trần B                 Ngô Dev A           │   │
│  │  Phòng DVKH            Phòng DA               Phòng Dev           │   │
│  │  12/03 14:30           12/03 15:10            13/03 09:00         │   │
│  │  (tạo YC)             (nhận & phân công)     (nhận việc)          │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── THÔNG TIN YC ──────────────────────────────────────────────────┐   │
│  │  KH:          Viettel — Anh Tuấn (0912xxx)                       │   │
│  │  Dự án:       Tích hợp cổng thanh toán v2                        │   │
│  │  Hạng mục:    API Gateway                                        │   │
│  │  Sản phẩm:    VNPT Pay                                           │   │
│  │  Nhóm DVHT:   Hỗ trợ kỹ thuật                                   │   │
│  │  Mô tả:       KH yêu cầu tích hợp API thanh toán qua REST...    │   │
│  │  Đính kèm:    📎 api_spec_v2.pdf   📎 requirement.docx           │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── DÒNG THỜI GIAN (timeline) ─────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  12/03 14:30  ① Mới tiếp nhận                                     │   │
│  │  ●────────── Nguyễn A tạo YC. Est: 20h                           │   │
│  │  │                                                                 │   │
│  │  12/03 15:10  ③ Giao PM                                           │   │
│  │  ●────────── Nguyễn A → Trần B. "YC phức tạp, cần PM đánh giá"  │   │
│  │  │            ⏱️ 0.5h (trao đổi)                                  │   │
│  │  │                                                                 │   │
│  │  12/03 16:00  ④ PM phân công                                      │   │
│  │  ●────────── Trần B → Ngô Dev A. Est điều chỉnh: 17h             │   │
│  │  │            ⏱️ 0.5h (đánh giá, trao đổi dev)                   │   │
│  │  │                                                                 │   │
│  │  13/03 09:00  ⑤ Đang xử lý                                       │   │
│  │  ●────────── Ngô Dev A nhận việc. Est dev: 15h                    │   │
│  │  │            ⏱️ 4h (setup, đọc API doc)                          │   │
│  │  │                                                                 │   │
│  │  14/03 09:00  ⑥ Phân tích                                        │   │
│  │  ●────────── Ngô Dev A phân tích.                                 │   │
│  │  │            ⏱️ 3h (phân tích, viết spec)                        │   │
│  │  │            Hướng: Lập trình                                    │   │
│  │  │                                                                 │   │
│  │  15/03 09:00  ⑥a Đang lập trình   ← HIỆN TẠI                    │   │
│  │  ◉────────── Ngô Dev A đang code                                 │   │
│  │               ⏱️ 5h (code + test)                                 │   │
│  │               Worklog gần nhất: 20/03 — "Fix mapping data" 2h    │   │
│  │                                                                    │   │
│  │  ⏳ Tiếp theo dự kiến:                                            │   │
│  │  ○╌╌╌╌╌╌╌╌╌ ⑥a Hoàn thành lập trình                             │   │
│  │  ○╌╌╌╌╌╌╌╌╌ ⑥a Upcode (triển khai)                              │   │
│  │  ○╌╌╌╌╌╌╌╌╌ ⑦ Hoàn thành                                        │   │
│  │  ○╌╌╌╌╌╌╌╌╌ ⑫ Báo khách hàng                                    │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── GIỜ CÔNG CHI TIẾT ─────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  Theo giai đoạn:                                                   │   │
│  │  ┌──────────────────────┬───────┬───────┬──────┬────────────────┐ │   │
│  │  │ Giai đoạn            │ Người │ Est   │ Act  │ Trạng thái     │ │   │
│  │  ├──────────────────────┼───────┼───────┼──────┼────────────────┤ │   │
│  │  │ Tiếp nhận + giao PM  │ NguA  │  —    │ 0.5h │ ✅ xong        │ │   │
│  │  │ PM đánh giá + phân   │ TrầnB │  —    │ 0.5h │ ✅ xong        │ │   │
│  │  │ Xử lý ban đầu       │ NgôA  │  —    │ 4.0h │ ✅ xong        │ │   │
│  │  │ Phân tích            │ NgôA  │  —    │ 3.0h │ ✅ xong        │ │   │
│  │  │ Lập trình            │ NgôA  │ 12h   │ 4.5h │ ⚙️ đang làm   │ │   │
│  │  │ Kiểm thử             │ NgôA  │  4h   │  —   │ ○ chưa         │ │   │
│  │  │ Triển khai            │ NgôA  │  2h   │  —   │ ○ chưa         │ │   │
│  │  ├──────────────────────┼───────┼───────┼──────┼────────────────┤ │   │
│  │  │ TỔNG                 │       │ 17h   │12.5h │ 73%            │ │   │
│  │  └──────────────────────┴───────┴───────┴──────┴────────────────┘ │   │
│  │                                                                    │   │
│  │  Theo người:                                                       │   │
│  │  ┌──────────────┬──────┬──────────────────────────────────────┐   │   │
│  │  │ Người        │ Giờ  │ Phân bổ                              │   │   │
│  │  ├──────────────┼──────┼──────────────────────────────────────┤   │   │
│  │  │ Ngô Dev A    │11.5h │ █████████████████████████████████ 92%│   │   │
│  │  │ Trần B (PM)  │ 0.5h │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  4%│   │   │
│  │  │ Nguyễn A     │ 0.5h │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  4%│   │   │
│  │  └──────────────┴──────┴──────────────────────────────────────┘   │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── LỊCH SỬ ƯỚC LƯỢNG ────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  Lần  Người      Vai trò    Giờ    Loại           Thời điểm      │   │
│  │  1    Nguyễn A   CREATOR    20h    Ước lượng đầu  12/03 14:30    │   │
│  │  2    Trần B     PM         17h    Phân công      12/03 16:00    │   │
│  │  3    Ngô Dev A  PERFORMER  15h    Nhận việc      13/03 09:00    │   │
│  │  4    Ngô Dev A  PERFORMER  17h    Cập nhật       16/03 17:00    │   │
│  │                              ↑ tăng 2h do API phức tạp hơn dự kiến│   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── WORKLOG GẦN NHẤT ──────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  Ngày   Người     Giờ   Nội dung                       Loại Phí  │   │
│  │  20/03  Ngô Dev A 2.0h  Fix mapping data, thêm index   CODE  ✓   │   │
│  │  19/03  Ngô Dev A 3.0h  Code module kết nối API         CODE  ✓   │   │
│  │  18/03  Ngô Dev A 4.0h  Setup env, đọc API doc          R&D   ✓   │   │
│  │  17/03  Ngô Dev A 4.0h  Code xử lý mapping data         CODE  ✓   │   │
│  │  ...    [Xem tất cả →]                                            │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌── TASKS & REF ────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │  🎫 IT Tasks:                                                      │   │
│  │  • IT-0045  Setup API Gateway staging    Ngô Dev A   ✅ done      │   │
│  │  • IT-0046  Code payment mapping         Ngô Dev A   ⚙️ in_prog  │   │
│  │  • IT-0047  Unit test payment flow       Ngô Dev A   ○ open      │   │
│  │                                                                    │   │
│  │  🔗 Ref Tasks:                                                     │   │
│  │  • JIRA VT-1234  "Payment API v2 spec"   🔗 link                  │   │
│  │                                                                    │   │
│  │  📎 Đính kèm:                                                     │   │
│  │  • api_spec_v2.pdf (tạo YC)                                       │   │
│  │  • requirement.docx (tạo YC)                                      │   │
│  │  • analysis_spec.docx (phân tích)                                 │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Thanh tìm kiếm nhanh (Global search)

```
Thanh tìm kiếm nằm ở header chính của ứng dụng.
Gõ mã YC hoặc từ khóa → dropdown gợi ý → nhấn → mở trang 7.1

┌───────────────────────────────────────────────────────────────────────┐
│  VNPT Business    [🔍 Tìm YC: "0312"                          ]     │
│                   ┌──────────────────────────────────────────────┐   │
│                   │ #YC-2024-0312  Tích hợp API    ⚙️coding     │   │
│                   │   Viettel  Ngô Dev A  12.5/17h  73% 🟡      │   │
│                   ├──────────────────────────────────────────────┤   │
│                   │ #YC-2024-0312a Bổ sung API v2  🟢mới        │   │
│                   │   Viettel  —           —                     │   │
│                   └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘

Hoặc gõ tên KH, người XL, tiêu đề:

┌───────────────────────────────────────────────────────────────────────┐
│  VNPT Business    [🔍 "Ngô Dev A"                              ]     │
│                   ┌──────────────────────────────────────────────┐   │
│                   │ 5 kết quả — YC mà Ngô Dev A đang xử lý:    │   │
│                   │                                              │   │
│                   │ #0319  Lỗi thanh toán    ⚙️in_prog  2/6h    │   │
│                   │ #0312  Tích hợp API      ⚙️coding  12.5/17h │   │
│                   │ #0301  Sửa dashboard     ✅HT       8/8h    │   │
│                   │ #0295  Nâng cấp module   ✅Báo KH  14/16h   │   │
│                   │ #0288  Fix export        ✅Báo KH   3/4h    │   │
│                   └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### 7.3 Tóm tắt thẻ YC (Card view — hiển thị khi hover hoặc trong danh sách)

```
Khi hover lên mã YC bất kỳ ở dashboard, danh sách, giám sát...
→ Hiện thẻ tóm tắt nhanh, KHÔNG cần mở trang chi tiết:

     ┌────────────────────────────────────────────────┐
     │  #YC-2024-0312  Tích hợp API thanh toán        │
     │  ─────────────────────────────────────────────  │
     │  KH:      Viettel — Anh Tuấn                   │
     │  ƯT:      🟠 Cao          SLA: còn 16h 🟢     │
     │  ─────────────────────────────────────────────  │
     │  Giai đoạn:  ⚙️ Đang lập trình (coding)       │
     │  ─────────────────────────────────────────────  │
     │  👤 Tạo:     Nguyễn A      12/03               │
     │  👔 PM:      Trần B        12/03               │
     │  🔧 Xử lý:  Ngô Dev A     13/03 → nay         │
     │  ─────────────────────────────────────────────  │
     │  Tiến độ:  ████████████░░░░  12.5/17h  73% 🟡  │
     │  ─────────────────────────────────────────────  │
     │  Worklog gần nhất:                              │
     │  20/03 Ngô Dev A  2h  "Fix mapping data"       │
     │                                                  │
     │            [Mở chi tiết →]                       │
     └────────────────────────────────────────────────┘
```

---

## 8. LẬP KẾ HOẠCH GIAO VIỆC (Tuần / Tháng)

> PM cuối tuần lập kế hoạch phân bổ YC tồn cho thành viên tuần sau.
> Cuối tháng lập kế hoạch tháng sau. Theo dõi kế hoạch vs thực tế.

### 8.1 Database bổ sung

```
── BẢNG MỚI ──────────────────────────────────────────────────────────

CREATE TABLE customer_request_plans (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_code          VARCHAR(30) NOT NULL UNIQUE,     -- "W2026-W12", "M2026-04"
  plan_type          ENUM('weekly','monthly') NOT NULL,
  period_start       DATE NOT NULL,                    -- đầu tuần / đầu tháng
  period_end         DATE NOT NULL,                    -- cuối tuần / cuối tháng
  dispatcher_user_id UNSIGNED BIGINT NOT NULL,         -- PM lập kế hoạch
  status             VARCHAR(20) DEFAULT 'draft',      -- draft → submitted → approved
  note               TEXT NULLABLE,
  total_planned_hours DECIMAL(10,2) DEFAULT 0,         -- SUM items
  created_by         UNSIGNED BIGINT,
  created_at         TIMESTAMP,
  updated_at         TIMESTAMP,
  deleted_at         TIMESTAMP NULLABLE,

  INDEX idx_plan_period (plan_type, period_start),
  INDEX idx_plan_dispatcher (dispatcher_user_id)
);

CREATE TABLE customer_request_plan_items (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_id            UNSIGNED BIGINT NOT NULL,          -- FK → plans.id CASCADE
  request_case_id    UNSIGNED BIGINT NOT NULL,          -- FK → cases.id
  performer_user_id  UNSIGNED BIGINT NOT NULL,          -- Ai xử lý

  planned_hours      DECIMAL(8,2) NOT NULL,             -- Giờ dự kiến trong kỳ
  planned_start_date DATE NULLABLE,                     -- Ngày bắt đầu dự kiến
  planned_end_date   DATE NULLABLE,                     -- Ngày kết thúc dự kiến
  priority_order     SMALLINT DEFAULT 0,                 -- Thứ tự ưu tiên trong kỳ
  note               VARCHAR(500) NULLABLE,

  -- KẾT QUẢ THỰC TẾ (cập nhật tự động từ worklogs)
  actual_hours       DECIMAL(8,2) DEFAULT 0,            -- SUM(worklogs) trong kỳ
  actual_status      VARCHAR(30) DEFAULT 'pending',     -- pending → in_progress → done → carried_over
  carried_to_plan_id UNSIGNED BIGINT NULLABLE,           -- Nếu chuyển sang kỳ sau

  created_at         TIMESTAMP,
  updated_at         TIMESTAMP,

  INDEX idx_item_plan (plan_id),
  INDEX idx_item_performer (performer_user_id, planned_start_date),
  INDEX idx_item_case (request_case_id),
  UNIQUE KEY uq_plan_case (plan_id, request_case_id)    -- Mỗi YC chỉ xuất hiện 1 lần / kế hoạch
);

── ALTER BẢNG CŨ ─────────────────────────────────────────────────────

ALTER TABLE customer_request_cases
  ADD current_plan_item_id UNSIGNED BIGINT NULLABLE;    -- Link đến plan item hiện tại
```

### 8.2 Màn hình lập kế hoạch tuần

```
┌───────────────────────────────────────────────────────────────────────┐
│  📅 KẾ HOẠCH TUẦN                                     PM: Trần B   │
│                                                                       │
│  [◀ Tuần trước]  Tuần 12: 17/03 → 21/03/2026  [Tuần sau ▶]         │
│  Trạng thái: 📝 Nháp            [ Gửi duyệt ]  [ Lưu nháp ]       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── YC TỒN ĐỌNG chưa giao ──────────────── Kéo thả vào lịch ↓ ──  │
│                                                                       │
│  📥 #0319  Lỗi thanh toán   VNPT HN   🔴Khẩn   Est: 6h             │
│  📥 #0317  Thêm báo cáo    FPT       🟠Cao     Est: 16h            │
│  📥 #0316  Cập nhật DM     Viettel   🟡TB      Est: 4h             │
│  📥 #0314  Tích hợp SSO    MobiFone  🟠Cao     Est: 12h (trả lại) │
│                                                                       │
│  ── PHÂN BỔ THEO THÀNH VIÊN ────────────────────────────────────    │
│                                                                       │
│  ┌─────────────┬──────┬──────┬──────┬──────┬──────┬────────────────┐│
│  │ Performer    │ T2   │ T3   │ T4   │ T5   │ T6   │ Tổng / Tải   ││
│  ├─────────────┼──────┼──────┼──────┼──────┼──────┼────────────────┤│
│  │ Ngô Dev A   │      │      │      │      │      │ 0h / 40h  0%  ││
│  │             │ #0319│      │      │      │      │               ││
│  │             │  6h  │      │      │      │      │ 6h / 40h 15%  ││
│  ├─────────────┼──────┼──────┼──────┼──────┼──────┼────────────────┤│
│  │ Lê Dev B    │      │      │      │      │      │ 0h / 40h  0%  ││
│  │             │ #0317│ #0317│ #0317│      │      │               ││
│  │             │  6h  │  6h  │  4h  │      │      │16h / 40h 40%  ││
│  ├─────────────┼──────┼──────┼──────┼──────┼──────┼────────────────┤│
│  │ Phạm BA C   │      │      │      │      │      │ 0h / 40h  0%  ││
│  │             │      │      │ #0314│ #0314│      │               ││
│  │             │      │      │  6h  │  6h  │      │12h / 40h 30%  ││
│  ├─────────────┼──────┼──────┼──────┼──────┼──────┼────────────────┤│
│  │ Hoàng Sup D │      │      │      │      │      │ 0h / 40h  0%  ││
│  │             │ #0316│      │      │      │      │               ││
│  │             │  4h  │      │      │      │      │ 4h / 40h 10%  ││
│  ├─────────────┼──────┼──────┼──────┼──────┼──────┼────────────────┤│
│  │ TỔNG ĐỘI    │ 16h  │  6h  │ 10h  │  6h  │  0h  │38h /160h 24%  ││
│  └─────────────┴──────┴──────┴──────┴──────┴──────┴────────────────┘│
│                                                                       │
│  ── GHI CHÚ ────────────────────────────────────────────────────    │
│  [ Tuần 12: Ưu tiên #0319 khẩn, #0317 deadline KH 21/03.          ]│
│  [ #0314 chuyển BA C phân tích lại, chờ KH cung cấp doc API.      ]│
│                                                                       │
│  ── CHUYỂN TỪ TUẦN TRƯỚC ──────────────────────────────────────    │
│                                                                       │
│  🔄 #0312 Tích hợp API  Ngô Dev A  KH còn 4.5h → chuyển tiếp      │
│  🔄 #0310 Module import  Phạm BA C  KH chưa xong PT → chuyển tiếp  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 8.3 Màn hình lập kế hoạch tháng

```
┌───────────────────────────────────────────────────────────────────────┐
│  📅 KẾ HOẠCH THÁNG                                    PM: Trần B   │
│                                                                       │
│  [◀ T3]  Tháng 04/2026  [T5 ▶]      [ Gửi duyệt ]  [ Lưu nháp ]  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── TỔNG QUAN NGUỒN LỰC THÁNG SAU ──────────────────────────────   │
│                                                                       │
│  Performer       Ngày làm   Tổng giờ   YC tồn từ T3   YC mới dự kiến│
│  Ngô Dev A       22 ngày    176h        2 YC (4.5h)    ~8 YC         │
│  Lê Dev B        22 ngày    176h        1 YC (6h)      ~8 YC         │
│  Phạm BA C       20 ngày    160h        1 YC (12h)     ~5 YC         │
│  Hoàng Sup D     22 ngày    176h        0 YC           ~10 YC        │
│  ──────────────────────────────────────────────────────────────────  │
│  TỔNG             —          688h        4 YC (22.5h)   ~31 YC       │
│                                                                       │
│  ── YC TỒN CHUYỂN SANG T4 ──────────────────────────────────────   │
│                                                                       │
│  Mã    Tiêu đề          Performer   Est còn lại   Tuần dự kiến HT  │
│  #0312 Tích hợp API     Ngô Dev A   4.5h          Tuần 1            │
│  #0317 Thêm báo cáo     Lê Dev B    6.0h          Tuần 1            │
│  #0314 Tích hợp SSO     Phạm BA C   12.0h         Tuần 1-2          │
│  #0310 Module import    Phạm BA C   chưa rõ       Tuần 2 (chờ est) │
│                                                                       │
│  ── PHÂN BỔ GIỜ DỰ KIẾN T4 ────────────────────────────────────   │
│                                                                       │
│  Performer       Tồn T3   YC mới    Tổng plan   / Capacity   Tải   │
│  Ngô Dev A       4.5h     ~60h      64.5h       / 176h       37%   │
│  Lê Dev B        6.0h     ~65h      71.0h       / 176h       40%   │
│  Phạm BA C       12.0h    ~40h      52.0h       / 160h       33%   │
│  Hoàng Sup D     0h       ~70h      70.0h       / 176h       40%   │
│  ──────────────────────────────────────────────────────────────────  │
│  TỔNG            22.5h    ~235h     257.5h      / 688h       37%   │
│                                                                       │
│  ── MỤC TIÊU THÁNG ─────────────────────────────────────────────   │
│  [ ] Hoàn thành 100% YC tồn T3                                      │
│  [ ] Đạt SLA ≥ 85%                                                   │
│  [ ] Tỷ lệ est chính xác ≥ 75%                                     │
│  [ ] Giờ billable ≥ 70%                                              │
│  [ Ghi chú thêm...                                                 ]│
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 8.4 So sánh kế hoạch vs thực tế

```
┌───────────────────────────────────────────────────────────────────────┐
│  📊 KẾ HOẠCH vs THỰC TẾ            Tuần 11: 10/03 → 14/03/2026     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── TỔNG QUAN ───────────────────────────────────────────────────   │
│                                                                       │
│  Planned: 38h     Actual: 34.5h     Đạt: 91%     Chuyển kỳ: 2 YC  │
│                                                                       │
│  ── CHI TIẾT THEO YC ───────────────────────────────────────────    │
│                                                                       │
│  Mã   Performer   Plan  Actual  KQ                                   │
│  ─── ──────────  ───── ──────  ──────────────────────────────────── │
│  0312 Ngô Dev A   8h    8h     ⚙️ Đang làm tiếp (còn 4.5h)        │
│  0310 Phạm BA C   6h    3h     🔄 Chuyển tuần sau (chờ KH)         │
│  0305 Hoàng D     8h    9h     ✅ Hoàn thành (vượt 1h)             │
│  0303 Lê Dev B    10h   10.5h  ✅ Hoàn thành (vượt 0.5h)           │
│  0301 Ngô Dev A   6h    4h     ✅ Hoàn thành sớm (tiết kiệm 2h)   │
│                                                                       │
│  ── CHI TIẾT THEO NGƯỜI ─────────────────────────────────────────   │
│                                                                       │
│  Performer      Plan    Actual  Chênh   YC xong  YC chuyển          │
│  Ngô Dev A      14h     12h     -2h     1/2      1 (#0312)          │
│  Lê Dev B       10h     10.5h   +0.5h   1/1      0                  │
│  Phạm BA C       6h      3h     -3h     0/1      1 (#0310 chờ KH)  │
│  Hoàng Sup D     8h      9h     +1h     1/1      0                  │
│  ──────────────────────────────────────────────────────────────────  │
│  TỔNG           38h     34.5h   -3.5h   3/5      2 (40% chuyển kỳ) │
│                                                                       │
│  ── NHẬN XÉT ───────────────────────────────────────────────────   │
│  🟢 Ngô Dev A: HT #0301 sớm 2h, tốt                               │
│  🟡 Lê Dev B: Vượt nhẹ 0.5h, chấp nhận được                       │
│  🟠 Phạm BA C: #0310 bị block do KH chưa gửi data, cần escalate   │
│  🟢 Hoàng Sup D: HT đúng, vượt 1h do YC phức tạp hơn dự kiến      │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 9. THỐNG KÊ GIỜ CÔNG THÁNG — Phân tích Pain Point

> Cuối tháng thống kê giờ từng thành viên, từng dự án.
> Phát hiện điểm nghẽn, người quá tải, dự án tốn giờ, loại công việc chiếm nhiều giờ.

### 9.1 Database bổ sung

```
Không cần bảng mới — tất cả truy vấn từ bảng có sẵn:
  • customer_request_worklogs   (work_date, hours_spent, activity_type_code,
                                  is_billable, performed_by_user_id)
  • customer_request_cases      (project_id, customer_id, dispatcher_user_id,
                                  performer_user_id, estimated_hours,
                                  total_hours_spent, current_status_code)
  • customer_request_estimates  (estimated_hours, estimate_type)
  • projects                    (project_code, project_name, customer_id)
  • customers                   (customer_code, customer_name)
  • worklog_activity_types      (code, name)

── CHỈ CẦN THÊM 1 BẢNG GHI KẾT QUẢ SNAPSHOT (optional, tăng tốc query) ───

CREATE TABLE monthly_hours_snapshots (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  snapshot_month     CHAR(7) NOT NULL,                  -- "2026-03"

  -- Theo người
  user_id            UNSIGNED BIGINT NOT NULL,
  user_name          VARCHAR(100),

  -- Theo dự án (nullable = tổng)
  project_id         UNSIGNED BIGINT NULLABLE,
  project_name       VARCHAR(200) NULLABLE,
  customer_id        UNSIGNED BIGINT NULLABLE,
  customer_name      VARCHAR(200) NULLABLE,

  -- Số liệu
  total_hours        DECIMAL(10,2) DEFAULT 0,
  billable_hours     DECIMAL(10,2) DEFAULT 0,
  non_billable_hours DECIMAL(10,2) DEFAULT 0,
  estimated_hours    DECIMAL(10,2) DEFAULT 0,
  request_count      INT DEFAULT 0,
  completed_count    INT DEFAULT 0,

  -- Theo loại công việc (JSON vì linh hoạt)
  hours_by_activity  JSON NULLABLE,
  -- {"CODING":40,"TESTING":12,"SUPPORT":8,"MEETING":5,...}

  created_at         TIMESTAMP,

  INDEX idx_snap_month (snapshot_month),
  INDEX idx_snap_user (user_id, snapshot_month),
  INDEX idx_snap_project (project_id, snapshot_month),
  UNIQUE KEY uq_snap (snapshot_month, user_id, project_id)
);

── API ENDPOINTS ──────────────────────────────────────────────────────

GET /customer-request-cases/reports/monthly-hours
    ?month=2026-03
    &group_by=user|project|customer|activity
    &user_id=X  (optional filter)
    &project_id=X  (optional filter)

GET /customer-request-cases/reports/pain-points
    ?month=2026-03
    → Tự động phân tích: người quá tải, dự án tốn giờ, YC kéo dài,
      est sai lệch nhiều, status bị stuck
```

### 9.2 Báo cáo giờ công theo thành viên

```
┌───────────────────────────────────────────────────────────────────────┐
│  📊 THỐNG KÊ GIỜ CÔNG            [◀ T2]  Tháng 03/2026  [T4 ▶]    │
│                                                                       │
│  Nhóm: [▼ Tất cả]   PM: [▼ Tất cả]   [📥 Xuất Excel]              │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── TỔNG QUAN ĐỘI NGŨ ──────────────────────────────────────────   │
│                                                                       │
│  Người       Tổng giờ  Billable  Non-bill  Bill%  YC   HT  Est acc │
│  ──────────  ────────  ────────  ────────  ─────  ──── ──  ─────── │
│  Ngô Dev A   142h      108h      34h       76%    12   9   78%     │
│  Lê Dev B    156h      102h      54h       65%    14   11  72%     │
│  Phạm BA C    88h       52h      36h       59%     8   5   68%     │
│  Hoàng Sup D 128h      100h      28h       78%    18   16  82%     │
│  ──────────  ────────  ────────  ────────  ─────  ──── ──  ─────── │
│  TỔNG        514h      362h     152h       70%    52   41  75%     │
│                                                                       │
│  ── PHÂN BỔ GIỜ THEO LOẠI CÔNG VIỆC ─────────────────── (toàn đội)│
│                                                                       │
│  CODE     ██████████████████████████████████░░  210h  41%            │
│  SUPPORT  ████████████████░░░░░░░░░░░░░░░░░░  128h  25%            │
│  TESTING  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░   64h  12%            │
│  MEETING  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░   45h   9%            │
│  R&D      ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   32h   6%            │
│  DEPLOY   ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   20h   4%            │
│  DOC      ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   15h   3%            │
│                                                                       │
│  ── CHI TIẾT TỪNG NGƯỜI (nhấn để mở rộng) ──────────────────────   │
│                                                                       │
│  ▼ Ngô Dev A — 142h ─────────────────────────────────────────────   │
│                                                                       │
│    Loại:                                                              │
│    CODE    ████████████████████████████░░  82h  58%                   │
│    TESTING █████████░░░░░░░░░░░░░░░░░░░░  24h  17%                   │
│    R&D     ██████░░░░░░░░░░░░░░░░░░░░░░  16h  11%                   │
│    MEETING ████░░░░░░░░░░░░░░░░░░░░░░░░  12h   8%                   │
│    DEPLOY  ██░░░░░░░░░░░░░░░░░░░░░░░░░░   8h   6%                   │
│                                                                       │
│    Theo tuần:                                                         │
│    Tuần 10  ████████████████████  38h / 40h  95% 🟠                  │
│    Tuần 11  ████████████████░░░░  34h / 40h  85% 🟡                  │
│    Tuần 12  ██████████████████░░  36h / 40h  90% 🟠                  │
│    Tuần 13  ██████████████████░░  34h / 40h  85% 🟡                  │
│                                                                       │
│  ▶ Lê Dev B — 156h (nhấn để mở rộng)                                │
│  ▶ Phạm BA C — 88h                                                   │
│  ▶ Hoàng Sup D — 128h                                                │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.3 Báo cáo giờ công theo dự án

```
┌───────────────────────────────────────────────────────────────────────┐
│  📊 GIỜ CÔNG THEO DỰ ÁN             Tháng 03/2026     [📥 Excel]  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Dự án            KH        Số YC  Est    Act    %     Bill   Bill% │
│  ──────────────── ───────── ───── ────── ────── ───── ────── ───── │
│  ERP VNPT HN      VNPT HN    12   120h   105h   88%   85h    81%  │
│  Cổng TT Viettel  Viettel     6    80h    72h   90%   60h    83%  │
│  CRM FPT          FPT         8    95h    88h   93%   62h    70%  │
│  Migration Mobi   MobiFone    3    60h    48h   80%   35h    73%  │
│  Nội bộ           —           5    —      42h   —     0h      0%  │
│  ──────────────── ───────── ───── ────── ────── ───── ────── ───── │
│  TỔNG                        34   355h   355h  100%  242h    68%  │
│                                                                       │
│  ── CHI TIẾT DỰ ÁN (nhấn để mở rộng) ──────────────────────────   │
│                                                                       │
│  ▼ ERP VNPT HN — 105h ──────────────────────────────────────────   │
│                                                                       │
│    Theo người:                                                        │
│    Ngô Dev A   ██████████████████████░░  52h  50%                    │
│    Hoàng Sup D ██████████████░░░░░░░░░░  35h  33%                    │
│    Lê Dev B    ██████░░░░░░░░░░░░░░░░░░  18h  17%                    │
│                                                                       │
│    Theo loại:                                                         │
│    CODE    ████████████████████████░░  58h  55%                      │
│    SUPPORT ██████████░░░░░░░░░░░░░░░  24h  23%                      │
│    TESTING ██████░░░░░░░░░░░░░░░░░░░  14h  13%                      │
│    OTHER   ████░░░░░░░░░░░░░░░░░░░░░   9h   9%                      │
│                                                                       │
│    Top YC tốn giờ:                                                    │
│    #0312  Tích hợp API   Ngô Dev A  Est:17h  Act:12.5h  ⚙️đang     │
│    #0305  Sửa dashboard  Hoàng D    Est: 8h  Act: 9h    ✅HT       │
│    #0298  Nâng cấp auth  Lê Dev B   Est:10h  Act:10.5h  ✅HT       │
│                                                                       │
│  ▶ Cổng TT Viettel — 72h                                            │
│  ▶ CRM FPT — 88h                                                    │
│  ▶ Migration Mobi — 48h                                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.4 Phân tích Pain Point (tự động)

```
┌───────────────────────────────────────────────────────────────────────┐
│  🔍 PHÂN TÍCH PAIN POINT              Tháng 03/2026                 │
│                                                                       │
│  Hệ thống tự động phát hiện vấn đề từ dữ liệu giờ công & workflow  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── 🔴 NGHIÊM TRỌNG ────────────────────────────────────────────   │
│                                                                       │
│  1. NGƯỜI QUÁ TẢI                                                    │
│     Lê Dev B — 156h/tháng (39h/tuần TB)                              │
│     Tuần 10: 42h (vượt 5%)   Tuần 13: 41h (vượt 3%)                │
│     → 3 tuần liên tục ≥ 38h, nguy cơ burnout                       │
│     💡 Đề xuất: Giảm tải 1-2 YC sang Ngô Dev A (tải 35.5h/tuần)   │
│                                                                       │
│  2. DỰ ÁN TỐN GIỜ BẤT THƯỜNG                                      │
│     CRM FPT — Tỷ lệ billable thấp nhất: 70%                        │
│     30% non-billable = 26h họp + trao đổi nội bộ                   │
│     → So sánh: Các DA khác TB 80% billable                          │
│     💡 Đề xuất: Review lại quy trình làm việc với FPT              │
│                                                                       │
│  ── 🟠 CẢNH BÁO ────────────────────────────────────────────────   │
│                                                                       │
│  3. ƯỚC LƯỢNG SAI NHIỀU                                             │
│     Phạm BA C — Est accuracy: 68% (thấp nhất đội)                   │
│     5/8 YC có actual vượt est > 30%                                  │
│     Top sai: #0314 est 12h → actual 20h+ (chưa xong)               │
│     💡 Đề xuất: Review kỹ hơn khi BA ước lượng, thêm buffer 20%   │
│                                                                       │
│  4. YC KÉO DÀI                                                      │
│     3 YC đang mở > 14 ngày:                                         │
│     #0312 Tích hợp API — 8 ngày (coding, còn 4.5h)                 │
│     #0310 Module import — 10 ngày (chờ KH, blocked)                 │
│     #0314 Tích hợp SSO — 6 ngày (trả lại PM, chưa giao lại)       │
│     💡 Đề xuất: Escalate #0310 (KH chậm), ưu tiên giao lại #0314  │
│                                                                       │
│  5. LOẠI CÔNG VIỆC MẤT CÂN ĐỐI                                     │
│     Phạm BA C — 41% giờ là MEETING (36h/88h)                       │
│     So sánh: đội TB chỉ 9% MEETING                                  │
│     💡 Đề xuất: Giảm họp, chuyển sang async (email/chat)           │
│                                                                       │
│  ── 🟡 THEO DÕI ────────────────────────────────────────────────   │
│                                                                       │
│  6. KHÁCH HÀNG TỐN NHIỀU GIỜ SUPPORT NHẤT                          │
│     VNPT HN — 42h support (33% tổng giờ support)                   │
│     → 15 YC support, TB 2.8h/YC                                    │
│     💡 Cân nhắc: Đào tạo KH sử dụng, hoặc viết FAQ/tài liệu      │
│                                                                       │
│  7. TỶ LỆ BILLABLE THẤP CÁ NHÂN                                    │
│     Phạm BA C — 59% billable (thấp nhất, kỳ vọng ≥ 70%)           │
│     → 36h non-billable: 20h meeting + 10h R&D + 6h doc             │
│                                                                       │
│  ── 📊 SO SÁNH VỚI THÁNG TRƯỚC ─────────────────────────────────  │
│                                                                       │
│  Chỉ số              T2        T3      Thay đổi                     │
│  Tổng giờ            480h      514h    +34h (+7%)  ↑                 │
│  Billable%           71%       70%     -1%         ↓ nhẹ            │
│  Est accuracy        68%       75%     +7%         ↑ tốt            │
│  YC tồn đọng        12        8       -4          ↓ tốt            │
│  TB giờ/người/tuần   30h       32h     +2h         ↑ chú ý          │
│  Người vượt 40h/tuần 1 lần    3 lần   +2          ↑ xấu           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 9.5 Queries cho báo cáo

```
── GIỜ CÔNG THEO NGƯỜI / THÁNG ───────────────────────────────────────

SELECT
  w.performed_by_user_id,
  u.name AS user_name,
  SUM(w.hours_spent) AS total_hours,
  SUM(CASE WHEN w.is_billable = 1 THEN w.hours_spent ELSE 0 END) AS billable,
  SUM(CASE WHEN w.is_billable = 0 THEN w.hours_spent ELSE 0 END) AS non_billable,
  COUNT(DISTINCT w.request_case_id) AS request_count,
  COUNT(DISTINCT CASE
    WHEN c.current_status_code IN ('completed','customer_notified')
    THEN w.request_case_id END) AS completed_count
FROM customer_request_worklogs w
JOIN customer_request_cases c ON c.id = w.request_case_id
JOIN internal_users u ON u.id = w.performed_by_user_id
WHERE w.work_date BETWEEN :startOfMonth AND :endOfMonth
GROUP BY w.performed_by_user_id
ORDER BY total_hours DESC;

── GIỜ CÔNG THEO DỰ ÁN / THÁNG ──────────────────────────────────────

SELECT
  c.project_id,
  p.project_name,
  cust.customer_name,
  SUM(w.hours_spent) AS total_hours,
  SUM(CASE WHEN w.is_billable = 1 THEN w.hours_spent ELSE 0 END) AS billable,
  SUM(c.estimated_hours) AS total_estimated,    -- cẩn thận distinct
  COUNT(DISTINCT c.id) AS request_count
FROM customer_request_worklogs w
JOIN customer_request_cases c ON c.id = w.request_case_id
LEFT JOIN projects p ON p.id = c.project_id
LEFT JOIN customers cust ON cust.id = c.customer_id
WHERE w.work_date BETWEEN :startOfMonth AND :endOfMonth
GROUP BY c.project_id
ORDER BY total_hours DESC;

── GIỜ THEO LOẠI CÔNG VIỆC / NGƯỜI ───────────────────────────────────

SELECT
  w.performed_by_user_id,
  w.activity_type_code,
  SUM(w.hours_spent) AS hours
FROM customer_request_worklogs w
WHERE w.work_date BETWEEN :startOfMonth AND :endOfMonth
GROUP BY w.performed_by_user_id, w.activity_type_code;

── GIỜ THEO TUẦN / NGƯỜI (phát hiện quá tải) ─────────────────────────

SELECT
  w.performed_by_user_id,
  YEARWEEK(w.work_date, 1) AS year_week,
  MIN(w.work_date) AS week_start,
  SUM(w.hours_spent) AS weekly_hours
FROM customer_request_worklogs w
WHERE w.work_date BETWEEN :startOfMonth AND :endOfMonth
GROUP BY w.performed_by_user_id, YEARWEEK(w.work_date, 1)
HAVING SUM(w.hours_spent) > 40;     -- flag quá tải

── PAIN POINT: YC KÉO DÀI ────────────────────────────────────────────

SELECT
  c.id, c.request_code, c.summary,
  c.current_status_code,
  c.performer_user_id,
  c.estimated_hours,
  c.total_hours_spent,
  DATEDIFF(NOW(), c.received_at) AS days_open
FROM customer_request_cases c
WHERE c.current_status_code NOT IN ('completed','customer_notified','not_executed')
  AND c.deleted_at IS NULL
  AND DATEDIFF(NOW(), c.received_at) > 14
ORDER BY days_open DESC;

── PAIN POINT: ƯỚC LƯỢNG SAI LỆCH ───────────────────────────────────

SELECT
  c.performer_user_id,
  u.name,
  COUNT(*) AS total_completed,
  COUNT(CASE WHEN ABS(c.total_hours_spent - c.estimated_hours)
            / NULLIF(c.estimated_hours, 0) > 0.3 THEN 1 END) AS bad_est_count,
  AVG(ABS(c.total_hours_spent - c.estimated_hours)
      / NULLIF(c.estimated_hours, 0) * 100) AS avg_deviation_pct
FROM customer_request_cases c
JOIN internal_users u ON u.id = c.performer_user_id
WHERE c.current_status_code IN ('completed','customer_notified')
  AND c.estimated_hours IS NOT NULL AND c.estimated_hours > 0
  AND c.completed_at BETWEEN :startOfMonth AND :endOfMonth
GROUP BY c.performer_user_id;
```

---

## 10. BÁO CÁO KHÓ KHĂN & ĐỀ XUẤT ESCALATION

> Performer/PM gặp vướng mắc → gửi báo cáo khó khăn → đề xuất hướng xử lý
> → Lãnh đạo duyệt, chỉ đạo → theo dõi giải quyết

### 10.1 Database bổ sung

```
CREATE TABLE customer_request_escalations (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  escalation_code    VARCHAR(30) NOT NULL UNIQUE,        -- "ESC-2026-0001"
  request_case_id    UNSIGNED BIGINT NOT NULL,            -- YC nào bị vướng
  raised_by_user_id  UNSIGNED BIGINT NOT NULL,            -- Ai báo cáo (PM hoặc Performer)
  raised_at          TIMESTAMP NOT NULL,

  -- MÔ TẢ KHÓ KHĂN
  difficulty_type    VARCHAR(30) NOT NULL,                 -- technical, resource, customer,
                                                          -- scope_change, dependency, sla_risk
  severity           VARCHAR(10) DEFAULT 'medium',        -- low, medium, high, critical
  description        TEXT NOT NULL,                        -- Mô tả chi tiết vấn đề
  impact_description VARCHAR(1000) NULLABLE,              -- Ảnh hưởng nếu không giải quyết
  blocked_since      DATE NULLABLE,                       -- Bị vướng từ khi nào

  -- ĐỀ XUẤT
  proposed_action    TEXT NULLABLE,                        -- Đề xuất hướng XL
  proposed_handler_user_id  UNSIGNED BIGINT NULLABLE,     -- Đề xuất ai xử lý
  proposed_additional_hours DECIMAL(8,2) NULLABLE,        -- Cần thêm bao nhiêu giờ
  proposed_deadline_extension DATE NULLABLE,              -- Đề xuất gia hạn

  -- DUYỆT & CHỈ ĐẠO
  status             VARCHAR(20) DEFAULT 'pending',       -- pending → reviewing → resolved
                                                          --        → rejected → closed
  reviewed_by_user_id UNSIGNED BIGINT NULLABLE,           -- Lãnh đạo duyệt
  reviewed_at        TIMESTAMP NULLABLE,
  resolution_decision VARCHAR(30) NULLABLE,               -- approve_proposal, reassign,
                                                          -- add_resource, extend_deadline,
                                                          -- cancel_request, other
  resolution_note    TEXT NULLABLE,                        -- Chỉ đạo cụ thể
  resolved_at        TIMESTAMP NULLABLE,

  created_at         TIMESTAMP,
  updated_at         TIMESTAMP,
  deleted_at         TIMESTAMP NULLABLE,

  INDEX idx_esc_case (request_case_id),
  INDEX idx_esc_status (status, severity),
  INDEX idx_esc_raised (raised_by_user_id, raised_at)
);
```

### 10.2 Form báo cáo khó khăn (Performer / PM)

```
┌───────────────────────────────────────────────────────────────────────┐
│  🚨 BÁO CÁO KHÓ KHĂN — #YC-0314 Tích hợp SSO                  ✕  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  YC:       #0314  Tích hợp SSO — MobiFone                           │
│  Đang ở:   ⚙️ Đang xử lý      Performer: Ngô Dev A                │
│  Est: 12h  Act: 8h (67%)      Đã 6 ngày                            │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  Loại khó khăn *    [▼ Kỹ thuật                         ]           │
│                      ┌─────────────────────────────────┐             │
│                      │ Kỹ thuật (technical)            │             │
│                      │ Thiếu nguồn lực (resource)      │             │
│                      │ Khách hàng (customer)           │             │
│                      │ Thay đổi phạm vi (scope_change) │             │
│                      │ Phụ thuộc bên ngoài (dependency)│             │
│                      │ Nguy cơ trễ SLA (sla_risk)      │             │
│                      └─────────────────────────────────┘             │
│                                                                       │
│  Mức độ *           ○Thấp  ○TB  ◉Cao  ○Nghiêm trọng               │
│                                                                       │
│  Mô tả khó khăn *                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ API SSO của MobiFone sử dụng SAML 2.0, hệ thống hiện tại     │ │
│  │ chỉ hỗ trợ OAuth2. Cần refactor module auth hoặc thêm        │ │
│  │ middleware SAML. Tài liệu API từ KH không đầy đủ, đã yêu     │ │
│  │ cầu 2 lần nhưng chưa nhận.                                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Bị vướng từ        [ 17/03/2026 📅 ]  (3 ngày)                    │
│                                                                       │
│  Ảnh hưởng nếu không giải quyết                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Trễ deadline KH 5 ngày. KH đã hỏi tiến độ 2 lần. Nếu kéo   │ │
│  │ dài sẽ ảnh hưởng hợp đồng giai đoạn 2.                       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  ĐỀ XUẤT XỬ LÝ                                                     │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  Đề xuất hướng:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 1. Chuyển cho team DMS (có kinh nghiệm SAML)                  │ │
│  │ 2. Hoặc thuê consultant SAML bên ngoài hỗ trợ 2-3 ngày       │ │
│  │ 3. Escalate lên KH yêu cầu gửi tài liệu đầy đủ              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Đề xuất người XL    [▼ Phạm BA C (team DMS, có exp SAML)    ]     │
│  Cần thêm giờ        [ 20  ] giờ                                    │
│  Gia hạn deadline     [ 28/03/2026 📅 ]  (+5 ngày)                 │
│                                                                       │
│  Đính kèm            [📎 Chọn file]  saml_error_log.txt ✕          │
│                                                                       │
│                       [ Hủy ]  [ 🚨 Gửi báo cáo khó khăn ]        │
└───────────────────────────────────────────────────────────────────────┘
```

### 10.3 Danh sách khó khăn chờ duyệt (Lãnh đạo)

```
┌───────────────────────────────────────────────────────────────────────┐
│  🚨 BÁO CÁO KHÓ KHĂN & ESCALATION                    👑 Giám đốc │
│                                                                       │
│  [🔴 3 Chờ duyệt]  [🟡 2 Đang XL]  [✅ 15 Đã giải quyết]         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── CHỜ DUYỆT ──────────────────────────────────────────────────   │
│                                                                       │
│  🔴 ESC-0003  #0314 Tích hợp SSO                                    │
│     Báo bởi: Ngô Dev A (Performer)  20/03 09:00   Vướng: 3 ngày    │
│     Loại: Kỹ thuật + KH     Mức: Cao                               │
│     "API SAML 2.0 — thiếu tài liệu KH, vượt khả năng dev"         │
│     Đề xuất: Chuyển team DMS + gia hạn 5 ngày + thêm 20h          │
│     [📋 Xem chi tiết]  [✅ Duyệt]  [✏️ Chỉ đạo khác]  [❌ Từ chối]│
│                                                                       │
│  🔴 ESC-0002  #0310 Module import MobiFone                          │
│     Báo bởi: Phạm BA C (PM)  19/03 16:00   Vướng: 5 ngày          │
│     Loại: Khách hàng      Mức: Trung bình                          │
│     "KH chưa cung cấp data mẫu & schema DB cũ"                    │
│     Đề xuất: Escalate qua GĐKD gọi KH, tạm ngưng chờ data        │
│     [📋 Xem chi tiết]  [✅ Duyệt]  [✏️ Chỉ đạo khác]  [❌ Từ chối]│
│                                                                       │
│  🟠 ESC-0001  #0317 Thêm báo cáo FPT                               │
│     Báo bởi: Lê Dev B (Performer)  18/03 14:00   Vướng: 2 ngày    │
│     Loại: Thay đổi phạm vi    Mức: Trung bình                      │
│     "KH yêu cầu thêm 3 báo cáo ngoài scope ban đầu"               │
│     Đề xuất: Tách thành YC mới, báo giá bổ sung                    │
│     [📋 Xem chi tiết]  [✅ Duyệt]  [✏️ Chỉ đạo khác]  [❌ Từ chối]│
│                                                                       │
│  ── ĐANG GIẢI QUYẾT ────────────────────────────────────────────   │
│                                                                       │
│  🟡 ESC-0004  #0308 Nâng cấp auth                                   │
│     Chỉ đạo: "Thuê consultant 3 ngày, GĐKD gọi KH" — GĐ Lê X    │
│     Tiến độ: Consultant đã liên hệ, KH hẹn meeting 22/03          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 10.4 Popup duyệt & chỉ đạo (Lãnh đạo)

```
┌───────────────────────────────────────────────────────────────────────┐
│  DUYỆT ESCALATION — ESC-0003                                     ✕  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── THÔNG TIN YC ────────────────────────────────────────────────   │
│  YC:       #0314  Tích hợp SSO — MobiFone      🟠 Cao               │
│  PM:       Trần B    Performer: Ngô Dev A                            │
│  Est: 12h  Act: 8h  Vướng: 3 ngày   SLA: quá hạn 4h 🔴            │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  ── KHÓ KHĂN ───────────────────────────────────────────────────   │
│  API SAML 2.0 — hệ thống chỉ hỗ trợ OAuth2. Cần refactor module  │
│  auth. Tài liệu API từ KH không đầy đủ, đã yêu cầu 2 lần.       │
│  Ảnh hưởng: Trễ deadline KH, ảnh hưởng HĐ giai đoạn 2.           │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  ── ĐỀ XUẤT CỦA BÁO CÁO ───────────────────────────────────────  │
│  • Chuyển team DMS (Phạm BA C)   +20h   Gia hạn → 28/03           │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  QUYẾT ĐỊNH *                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ○ Duyệt đề xuất (giữ nguyên)                                   ││
│  │                                                                  ││
│  │ ◉ Chỉ đạo khác:                                                ││
│  │   Hướng XL:     [▼ Bổ sung nguồn lực        ]                  ││
│  │                  ┌──────────────────────────────┐               ││
│  │                  │ Duyệt đề xuất               │               ││
│  │                  │ Chuyển người khác            │               ││
│  │                  │ Bổ sung nguồn lực            │               ││
│  │                  │ Gia hạn deadline             │               ││
│  │                  │ Hủy YC                       │               ││
│  │                  │ Khác                         │               ││
│  │                  └──────────────────────────────┘               ││
│  │   Chuyển cho:    [▼ Phạm BA C + Ngô Dev A (phối hợp)   ]      ││
│  │   Thêm giờ:     [ 16 ] giờ (giảm so đề xuất 20h)              ││
│  │   Gia hạn:      [ 27/03/2026 📅 ]                              ││
│  │                                                                  ││
│  │ ○ Từ chối                                                       ││
│  │   Lý do: [                                                    ] ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Chỉ đạo cụ thể                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Phạm BA C hỗ trợ phần SAML (có kinh nghiệm). Ngô Dev A tiếp  ││
│  │ tục phần integration. GĐKD Minh gọi KH yêu cầu gửi doc ngay. ││
│  │ Nếu 23/03 chưa có doc thì tạm ngưng, chuyển ưu tiên #0319.   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│                          [ Hủy ]  [ ✅ Xác nhận quyết định ]       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 11. DASHBOARD LÃNH ĐẠO CẤP CAO

> Giám đốc / Phó GĐ — nhìn toàn cục: sức khỏe đội ngũ, rủi ro, tài chính giờ công,
> so sánh qua các tháng/quý, không cần đi vào chi tiết từng YC.

### 11.1 Tổng quan điều hành

```
┌───────────────────────────────────────────────────────────────────────┐
│  📊 DASHBOARD LÃNH ĐẠO                                  03/2026    │
│                                                                       │
│  [Tháng ▼]  [Quý ▼]  [Năm ▼]     So với: [Tháng trước ▼]          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  📥 58   │  │  ✅ 41   │  │  85%     │  │  🚨 3   │            │
│  │  YC mới  │  │  Hoàn th │  │  SLA     │  │  Escalat │            │
│  │  +12%    │  │  +18%    │  │  +3pt    │  │  +2      │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  514h    │  │  362h    │  │  75%     │  │  6.1h   │            │
│  │  Tổng giờ│  │  Billable│  │  Est acc │  │  TB/YC  │            │
│  │  +7%     │  │  70%     │  │  +7pt    │  │  -15% ↓ │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                       │
│  ── SỨC KHỎE ĐỘI NGŨ ──────────────────────────────────────────   │
│                                                                       │
│  Performer       Giờ/tuần  Tải     Bill%  SLA   Est    Escalation  │
│  ──────────────  ────────  ──────  ─────  ────  ─────  ──────────  │
│  Ngô Dev A       35.5h     89% 🟠  76%    88%   78%    1 đang XL  │
│  Lê Dev B        39.0h     98% 🔴  65%    82%   72%    1 chờ duyệt│
│  Phạm BA C       22.0h     55% 🟢  59%    90%   68%    0          │
│  Hoàng Sup D     32.0h     80% 🟡  78%    85%   82%    0          │
│  ──────────────  ────────  ──────  ─────  ────  ─────  ──────────  │
│  TRUNG BÌNH      32.1h     80%     70%    85%   75%    2 open     │
│                                                                       │
│  🔴 Cảnh báo: Lê Dev B tải 98% — 3 tuần liên tục > 38h            │
│  🟠 Cảnh báo: Ngô Dev A tải 89% — sắp quá tải nếu thêm YC       │
│  🟢 Cơ hội: Phạm BA C tải 55% — có thể nhận thêm                 │
│                                                                       │
│  ── XU HƯỚNG QUÝ ────────────────── (biểu đồ đường) ────────────  │
│                                                                       │
│       T1         T2         T3        Hướng     Mục tiêu           │
│  YC   45         52         58        ↑ +13/th  —                  │
│  HT   32         35         41        ↑ +5/th   ≥ 90% YC          │
│  SLA  78%   →    82%   →    85%       ↑ tốt     ≥ 90%             │
│  Est  62%   →    68%   →    75%       ↑ tốt     ≥ 80%             │
│  Bill 68%   →    71%   →    70%       → ngang   ≥ 75%             │
│  TB/YC 8.5h →    7.2h  →    6.1h     ↓ tốt     ≤ 5h              │
│                                                                       │
│  ── TÀI CHÍNH GIỜ CÔNG ─────────────────────────────────────────   │
│                                                                       │
│  Tổng giờ tháng:      514h                                          │
│  ├── Billable:         362h (70%)  × đơn giá TB = 📈 ước tính     │
│  ├── Non-billable:     152h (30%)                                   │
│  │   ├── Meeting:       45h (9%)   ← giảm 2% so T2 🟢            │
│  │   ├── R&D:           32h (6%)                                   │
│  │   ├── Nội bộ:        42h (8%)                                   │
│  │   └── Khác:          33h (7%)                                   │
│  │                                                                   │
│  Top KH theo billable giờ:                                          │
│  1. VNPT HN    85h   ██████████████████████████████████  23%        │
│  2. Viettel    60h   ████████████████████████░░░░░░░░░░  17%        │
│  3. FPT        62h   █████████████████████████░░░░░░░░░  17%        │
│  4. MobiFone   35h   ██████████████░░░░░░░░░░░░░░░░░░░░  10%        │
│  5. Khác      120h   ██████████████████████████████████████ 33%      │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 11.2 Rủi ro & Quyết định

```
┌───────────────────────────────────────────────────────────────────────┐
│  ⚠️ RỦI RO & QUYẾT ĐỊNH CẦN ĐƯA                                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ── CẦN QUYẾT ĐỊNH NGAY ────────────────────────────────────────   │
│                                                                       │
│  🔴 3 ESCALATION CHỜ DUYỆT                                         │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ESC-0003  #0314 SSO MobiFone   Kỹ thuật  🟠Cao  vướng 3 ngày ││
│  │   → Đề xuất: chuyển team DMS + thêm 20h + gia hạn 5 ngày     ││
│  │   [✅ Duyệt]  [✏️ Chỉ đạo]                                    ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │ ESC-0002  #0310 Import Mobi    KH chậm   🟡TB   vướng 5 ngày ││
│  │   → Đề xuất: escalate qua GĐKD gọi KH                        ││
│  │   [✅ Duyệt]  [✏️ Chỉ đạo]                                    ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │ ESC-0001  #0317 BC FPT         Scope     🟡TB   vướng 2 ngày ││
│  │   → Đề xuất: tách YC mới, báo giá bổ sung                     ││
│  │   [✅ Duyệt]  [✏️ Chỉ đạo]                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ── RỦI RO TỰ ĐỘNG PHÁT HIỆN ───────────────────────────────────  │
│                                                                       │
│  🔴 NHÂN SỰ                                                         │
│  • Lê Dev B quá tải 3 tuần liền (39h/tuần TB)                      │
│    → Rủi ro: burnout, giảm chất lượng                               │
│    💡 Chuyển 2 YC cho Phạm BA C (tải 55%)                          │
│    [📋 Tạo chỉ đạo]                                                │
│                                                                       │
│  🟠 KHÁCH HÀNG                                                      │
│  • MobiFone — 2 YC bị block do KH chậm data (5 ngày + 3 ngày)    │
│    → Rủi ro: trễ HĐ giai đoạn 2, mất uy tín                      │
│    💡 GĐKD Minh can thiệp trực tiếp                                │
│    [📋 Tạo chỉ đạo]                                                │
│                                                                       │
│  • FPT — billable chỉ 70%, meeting chiếm 30% giờ                  │
│    → Rủi ro: lãng phí nguồn lực, lợi nhuận thấp                   │
│    💡 Review quy trình, chuyển sang async                           │
│    [📋 Tạo chỉ đạo]                                                │
│                                                                       │
│  🟡 QUY TRÌNH                                                       │
│  • Tỷ lệ est chính xác: 75% (mục tiêu 80%)                       │
│    Phạm BA C chỉ đạt 68% — cần training est                       │
│  • Non-billable meeting: 9% toàn đội (mục tiêu ≤ 8%)              │
│                                                                       │
│  ── THỐNG KÊ ESCALATION ────────────────────────────────────────   │
│                                                                       │
│  Tháng     Tổng  Duyệt  Từ chối  TB giải quyết  Loại phổ biến    │
│  T1/2026     5     4       1       2.1 ngày       KH (40%)         │
│  T2/2026     7     6       1       1.8 ngày       Kỹ thuật (43%)   │
│  T3/2026     8     5       0       2.3 ngày*      Kỹ thuật (38%)   │
│              * 3 đang chờ duyệt                                     │
│                                                                       │
│  Xu hướng: Escalation tăng +1/tháng, chủ yếu kỹ thuật             │
│  💡 Cân nhắc: Đào tạo nâng cao kỹ thuật cho đội dev               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 11.3 So sánh đội ngũ & dự án qua các tháng

```
┌───────────────────────────────────────────────────────────────────────┐
│  📈 SO SÁNH HIỆU SUẤT              Q1/2026 (T1 → T3)               │
│                                                                       │
│  [Theo đội ngũ]  [Theo dự án]  [Theo KH]                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ═══ TAB: THEO ĐỘI NGŨ ═══                                          │
│                                                                       │
│  ── Giờ / tuần ───────────────────── (biểu đồ cột chồng) ────────  │
│                                                                       │
│               T1           T2           T3                           │
│  Ngô Dev A   ████ 30h     █████ 34h    ██████ 35.5h  → tăng đều   │
│  Lê Dev B    █████ 32h    ██████ 36h   ███████ 39h   → 🔴 quá tải │
│  Phạm BA C   ████ 28h     ███ 24h      ███ 22h       → giảm       │
│  Hoàng Sup D ████ 30h     █████ 34h    █████ 32h     → ổn định    │
│                                                                       │
│  ── Radar chart: năng lực tổng hợp ──── (5 chỉ số) ──────────────  │
│                                                                       │
│              Giờ/tuần   Bill%    SLA%    Est%    HT/tháng            │
│  Ngô Dev A   35.5 🟠    76 🟢   88 🟢   78 🟢   9 🟢              │
│  Lê Dev B    39.0 🔴    65 🟡   82 🟡   72 🟡   11 🟢             │
│  Phạm BA C   22.0 🟢    59 🔴   90 🟢   68 🔴   5 🟡              │
│  Hoàng Sup D 32.0 🟢    78 🟢   85 🟢   82 🟢   16 🟢             │
│                                                                       │
│  ═══ TAB: THEO DỰ ÁN ═══                                            │
│                                                                       │
│  Dự án             T1      T2      T3     Trend   ROI               │
│  ──────────────── ──────  ──────  ──────  ─────   ─────             │
│  ERP VNPT HN       95h    100h    105h    ↑       ★★★★ Tốt        │
│  Cổng TT Viettel   50h     65h     72h    ↑       ★★★ Khá         │
│  CRM FPT            —      60h     88h    ↑↑      ★★ TB (bill thấp)│
│  Migration Mobi     —       —      48h    mới     ★★ (bị block)    │
│  Nội bộ            35h     40h     42h    ↑       —                 │
│                                                                       │
│  ═══ TAB: THEO KHÁCH HÀNG ═══                                       │
│                                                                       │
│  KH              Số YC/tháng   TB xử lý   SLA    Giờ bill  Escal.  │
│  ──────────────  ───────────   ────────   ─────  ────────  ──────  │
│  VNPT HN         8 → 10 → 12  5.2h ↓     88%    85h       0       │
│  Viettel         4 →  5 →  6  8.5h ↓     79%    60h       1       │
│  FPT             0 →  6 →  8  7.1h →     82%    62h       1       │
│  MobiFone        0 →  0 →  5  6.0h       85%    35h       2 🔴    │
│  VNPT HCM        3 →  4 →  4  4.8h ↓     90%    45h       0       │
│                                                                       │
│  📌 Nhận xét:                                                        │
│  • VNPT HN: KH lớn nhất, xu hướng tốt (SLA tăng, TB giảm)        │
│  • MobiFone: KH mới nhưng đã 2 escalation — cần chú ý đặc biệt   │
│  • FPT: billable thấp 70% — cần review quy trình làm việc          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 11.4 Chỉ đạo nhanh (Lãnh đạo tạo chỉ thị từ dashboard)

```
┌───────────────────────────────────────────────────────────────────────┐
│  📋 TẠO CHỈ ĐẠO                                                 ✕  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Từ rủi ro:  "Lê Dev B quá tải 3 tuần liền"                        │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  Gửi đến *          [▼ Trần B (PM — Dispatcher)           ]        │
│  CC                  [▼ Lê Dev B, Phạm BA C                ]        │
│                                                                       │
│  Loại chỉ đạo       [▼ Điều chuyển nguồn lực               ]       │
│                      ┌───────────────────────────────────┐           │
│                      │ Điều chuyển nguồn lực              │           │
│                      │ Gia hạn deadline                    │           │
│                      │ Thay đổi ưu tiên                   │           │
│                      │ Liên hệ KH                         │           │
│                      │ Đào tạo / nâng cao năng lực        │           │
│                      │ Khác                                │           │
│                      └───────────────────────────────────┘           │
│                                                                       │
│  Nội dung chỉ đạo                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Chuyển 2 YC (ưu tiên thấp nhất) của Lê Dev B sang Phạm BA C. ││
│  │ Phạm BA C hiện tải 55%, có thể nhận thêm 15-20h/tuần.        ││
│  │ Thực hiện ngay từ tuần sau (tuần 13).                          ││
│  │ Trần B review & cập nhật kế hoạch tuần 13 trước T6.           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  Deadline thực hiện  [ 21/03/2026 📅 ]                              │
│  Mức ưu tiên        ◉Cao  ○TB  ○Thấp                               │
│                                                                       │
│  Liên kết YC:   [+ Thêm YC]  #0316 ✕  #0317 ✕                     │
│  Liên kết ESC:  [+ Thêm]                                            │
│                                                                       │
│                          [ Hủy ]  [ 📋 Gửi chỉ đạo ]               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 12. MA TRẬN TỔNG HỢP: Vai trò × Chức năng × Màn hình

```
                      CREATOR          DISPATCHER        PERFORMER       LÃNH ĐẠO
─────────────────── ──────────────── ───────────────── ──────────────── ──────────────
LUỒNG YC
① Mới tiếp nhận      Tạo YC (2.2)    —                 —               —
② Giao Performer     (đã giao)        —                 Nhận việc (4.2) —
③ Giao PM            (đã giao)        Phân công (3.2)   —               —
④ PM đã điều phối    —                (đã giao)         Nhận việc (4.2) —
⑤ Đang XL            —                Giám sát (3.3)    XL + giờ (4.3)  —
⑥ Phân tích          —                Giám sát (3.3)    PT + est (4.5)  —
⑥a Lập trình         —                Giám sát (3.3)    XL + giờ (4.3)  —
⑥b DMS               —                Giám sát (3.3)    XL + giờ (4.3)  —
⑦ Hoàn thành         —                Duyệt (3.1)       HT (4.4)        —
⑧ Trả lại PM         —                Xem xét (3.1)     Trả (4.6)       —
⑨ Chờ KH             Đánh giá (2.3)  —                 —               —
⑩ Từ chối            —                —                 —               —
⑪ Tạm ngưng          —                Theo dõi          —               —
⑫ Báo KH             Báo KH (2.4)    Báo KH (2.4)      —               —

QUẢN LÝ
KH tuần              —                Lập KH (8.2)      Xem lịch mình   Duyệt
KH tháng             —                Lập KH (8.3)      Xem lịch mình   Duyệt
KH vs Thực tế        —                So sánh (8.4)     —               Xem (8.4)

BÁO CÁO
Giờ công tháng       —                Theo dõi (9.2)    Xem giờ mình    Xem tổng hợp
Giờ theo DA          —                Báo cáo (9.3)     —               Xem (9.3)
Pain point           —                Phân tích (9.4)   —               Xem (9.4)

ESCALATION
Báo cáo khó khăn    —                Tạo (10.2)        Tạo (10.2)      —
Duyệt escalation    —                —                  —               Duyệt (10.4)
DS escalation        —                Xem mình           —               Xem tất cả (10.3)

LÃNH ĐẠO
Dashboard điều hành  —                —                  —               Xem (11.1)
Rủi ro & quyết định  —                —                  —               Xem (11.2)
So sánh hiệu suất   —                —                  —               Xem (11.3)
Tạo chỉ đạo         —                Nhận chỉ đạo       Nhận chỉ đạo   Tạo (11.4)

TRA CỨU
Tra cứu YC           Xem YC mình(7.1) Xem tất cả (7.1)  Xem YC mình    Xem tất cả (7.1)
Tìm kiếm nhanh       ✅ (7.2)         ✅ (7.2)           ✅ (7.2)        ✅ (7.2)
Hover card            ✅ (7.3)         ✅ (7.3)           ✅ (7.3)        ✅ (7.3)
```
