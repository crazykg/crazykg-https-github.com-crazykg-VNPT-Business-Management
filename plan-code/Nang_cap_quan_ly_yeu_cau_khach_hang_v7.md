# Nâng cấp quản lý yêu cầu khách hàng v7

> **Ngày cập nhật:** 2026-03-22
> **Mục đích:** Nâng cấp UI/UX module `customer_request_management` theo hướng chuyên nghiệp hơn, rõ vai trò hơn, và tăng chất lượng thông tin hiển thị cho từng role
> **Phạm vi:** Dashboard, list, detail, modal create/transition và role workspaces `creator / dispatcher / performer`
> **Trạng thái:** Product + UX plan
> **Mockup đi kèm:** [Phác thảo giao diện v7](/Users/pvro86gmail.com/Downloads/QLCV/plan-code/Phac_thao_giao_dien_yeu_cau_KH_v7.md)

---

## 1. Đánh giá nhanh hiện trạng UI

### 1.1 Điểm đã có

Hệ thống hiện tại đã có nền tảng tốt:

- có dashboard overview
- có workspace riêng cho `creator`, `dispatcher`, `performer`
- có list pane + detail pane + create modal + transition modal
- có quick actions, timesheet, attention cases, top customer/project/performer
- màu sắc theo role đã có định hướng tương đối rõ

### 1.2 Điểm còn thiếu để đạt mức “chuyên nghiệp”

UI hiện tại vẫn mang cảm giác:

- nhiều card đúng chức năng nhưng chưa có trật tự ưu tiên đủ mạnh
- thông tin hữu ích có, nhưng chưa được “đóng gói” theo quyết định của từng vai trò
- một số màn thiên về hiển thị raw data hơn là dẫn dắt hành động
- list/detail/workspace đang hơi tách rời, chưa có cảm giác một hệ thống điều hành thống nhất
- các khu vực `task / file / estimate / worklog / risk` đã tồn tại nhưng chưa được nâng lên thành “khối thông tin quyết định”

Nói ngắn gọn: **đã có nhiều tính năng, nhưng trải nghiệm điều hành công việc chưa đủ sắc**.

---

## 2. Mục tiêu của v7

v7 không tập trung thêm feature lớn mới trước, mà tập trung vào:

1. làm giao diện nhìn chuyên nghiệp, thống nhất, có thứ bậc rõ
2. biến mỗi workspace thành một “bàn điều khiển theo vai trò”
3. làm thông tin hiển thị phục vụ quyết định, không chỉ để xem
4. giảm thời gian người dùng phải đọc và tự suy luận
5. chuẩn hóa detail/modal để dữ liệu quan trọng luôn xuất hiện đúng lúc

---

## 3. North Star UX

### 3.1 Mỗi role phải trả lời được 3 câu hỏi ngay khi mở màn

1. `Tôi đang có gì cần xử lý ngay?`
2. `Cái gì đang rủi ro hoặc chậm bất thường?`
3. `Tôi cần bấm vào đâu để xử lý nhanh nhất?`

### 3.2 Từ “quản lý màn hình” sang “quản lý quyết định”

Không thiết kế theo kiểu:

- nhiều box đẹp nhưng ai cũng phải tự đọc và tự đoán

Mà phải thiết kế theo kiểu:

- mở màn là thấy thứ cần xử lý
- mỗi block đều dẫn tới hành động
- số liệu đều có ngữ cảnh
- detail pane giúp ra quyết định, không chỉ cho xem form

### 3.3 Thông tin hiển thị phải có 3 tầng

1. `Nhìn lướt`: KPI, badge, trạng thái, cảnh báo
2. `Nhìn để quyết định`: owner, deadline, risk, estimate vs actual, blocker
3. `Nhìn để xử lý sâu`: files, task IT360, task liên quan, timeline, worklog, audit context

---

## 4. Định hướng UI chuyên nghiệp hơn

## 4.1 Tái cấu trúc giao diện theo “command center”

Nguyên tắc quan trọng:

- **không tạo thêm một sidebar cố định bên trong module** nếu app shell đã có menu trái tổng
- điều hướng `overview / creator / dispatcher / performer` nên chuyển thành:
  - `role tabs` hoặc `segmented switch` ở phần header
  - `view switch` ngay dưới role: `Inbox / Danh sách / Phân tích`
  - `saved views` và `quick filters` nằm ngang
  - `drawer/filter panel` chỉ mở khi cần, không chiếm chiều ngang thường trực

Mỗi màn role-based nên có bố cục chuẩn:

1. `Header điều hành`
   - tên workspace
   - mô tả ngắn đúng vai trò
   - CTA chính
   - bộ lọc ngữ cảnh
   - role switch ngang thay cho sidebar cấp 2
   - view switch để đi thẳng tới `hành động / tra cứu / số liệu`

2. `Dải KPI ra quyết định`
   - 3 đến 5 chỉ số thật sự quan trọng với role đó

3. `Khối ưu tiên hành động`
   - hàng đợi / inbox / ca cần chú ý
   - luôn đặt ở vị trí nổi bật nhất

4. `Khối phân tích phụ`
   - top khách hàng
   - top dự án
   - tải người thực hiện
   - xu hướng, risk, pain points

5. `Danh sách chi tiết / detail pane`
   - mở sâu để xử lý, không phá ngữ cảnh đang theo dõi

Lý do:

- app hiện đã có menu điều hướng toàn cục ở trái
- nếu module lại thêm một sidebar riêng thì sẽ làm hẹp vùng `list/detail`
- màn này bản chất cần nhiều không gian ngang cho `table`, `decision cards`, `detail pane`, nên nên ưu tiên `top navigation` thay vì `left navigation`
- người dùng cần đi nhanh giữa `xử lý ngay`, `xem danh sách`, `xem số liệu`, nên nên có `view switch` thay vì cuộn dọc qua tất cả các khối

## 4.2 Thiết kế visual thống nhất hơn

### Nên chuẩn hóa

- 1 hệ card system chung
- 1 hệ badge trạng thái chung
- 1 hệ alert badge chung
- 1 kiểu section title chung
- 1 kiểu empty state chung
- 1 kiểu CTA chính / CTA phụ / quick action chung

### Nên giảm

- card nào cũng “đẹp ngang nhau”
- quá nhiều viền nhẹ nhưng không có điểm nhấn
- typography còn hơi đồng đều, thiếu độ phân tầng
- mỗi workspace đang giống một nhóm card độc lập hơn là một bề mặt điều hành

## 4.3 Chuyên nghiệp hóa bằng “progressive disclosure”

Mặc định chỉ hiển thị:

- cái quan trọng
- cái cần hành động
- cái có nguy cơ

Còn phần sâu hơn mới mở khi cần:

- timeline chi tiết
- estimate history đầy đủ
- file/task đầy đủ
- worklog dài
- audit/notes

---

## 5. Thông tin cần hiển thị cho từng role

## 5.1 Role `CREATOR`

### Creator cần thấy gì nhất

Creator không cần nhìn hệ thống quá rộng. Creator cần biết:

- yêu cầu mình tạo đang nằm ở đâu
- ai đang giữ trách nhiệm
- có đang bị chờ mình hay không
- khách hàng đã phản hồi chưa
- khi nào cần báo lại khách hàng

### KPI nên hiển thị

- `YC tôi tạo`
- `Đang chờ tôi quyết định`
- `Chờ báo khách hàng`
- `Thời gian TB từ tạo -> được tiếp nhận`
- `Tỷ lệ YC bị yêu cầu bổ sung`

### Danh sách ưu tiên nên có

1. `Cần tôi phản hồi ngay`
   - khách hàng đã phản hồi
   - PM/perfomer hỏi lại
   - thiếu thông tin để đi tiếp

2. `Chờ tôi báo khách hàng`
   - đã hoàn thành nhưng vòng giao tiếp chưa đóng

3. `YC tôi tạo đang rủi ro`
   - vượt deadline
   - quá lâu không cập nhật
   - bị trả lại

### Thông tin nên hiển thị trên mỗi item

- mã YC
- tiêu đề ngắn
- khách hàng
- dự án / sản phẩm
- người đang giữ ca
- trạng thái hiện tại
- lần cập nhật gần nhất
- next action
- cờ `KH phản hồi`, `cần báo KH`, `trả lại`, `quá hạn`

### Thông tin nên có ở side panel của creator

- top khách hàng tôi tạo nhiều YC nhất
- YC gần đây đã đóng
- thời gian phản hồi trung bình của PM/perfomer cho YC tôi tạo

---

## 5.2 Role `DISPATCHER`

### Dispatcher cần thấy gì nhất

Dispatcher là người điều phối, nên cần thấy:

- ca nào cần phân công ngay
- performer nào đang quá tải / rảnh
- ca nào vượt estimate / SLA risk
- ca nào bị trả lại hoặc chờ PM chốt

### KPI nên hiển thị

- `Chờ phân công`
- `Đang theo dõi`
- `Ca trả lại`
- `Thiếu estimate`
- `SLA risk`
- `Load TB của team`

### Danh sách ưu tiên nên có

1. `Inbox điều phối`
   - hàng chờ phân công
   - ca mới quay lại
   - ca không có performer

2. `Ca PM cần chốt`
   - thiếu estimate
   - vượt estimate
   - chờ duyệt kết quả
   - performer báo blocker

3. `Rủi ro tải đội ngũ`
   - performer vượt ngưỡng tải
   - performer có nhiều ca overdue

### Thông tin nên hiển thị trên mỗi item

- mã YC
- tiêu đề
- khách hàng
- dự án / sản phẩm
- performer hiện tại
- estimate vs actual
- deadline / due date
- warning level
- lý do bị đưa vào attention
- lần cập nhật worklog gần nhất

### Widget nên bổ sung cho dispatcher

- `Team load matrix`
  - người thực hiện
  - số ca active
  - estimate còn lại
  - actual tuần này
  - % tải

- `PM action queue`
  - số ca cần chốt hôm nay
  - số ca overdue
  - số ca vượt estimate > 20%

- `Bản đồ phân bổ theo dự án`
  - dự án nào đang dồn nhiều ca
  - dự án nào đang có nhiều blocker / trả lại

---

## 5.3 Role `PERFORMER`

### Performer cần thấy gì nhất

Performer không cần quá nhiều thống kê tổng hợp. Performer cần:

- hôm nay phải làm gì
- ca nào là ưu tiên 1
- estimate còn bao nhiêu
- PM đang đợi gì
- khách hàng / PM có cập nhật gì mới

### KPI nên hiển thị

- `Việc mới`
- `Đang thực hiện`
- `Giờ tuần này`
- `Ca sắp trễ`
- `Ca vượt estimate`

### Danh sách ưu tiên nên có

1. `Làm ngay hôm nay`
   - ca mới nhận
   - ca gần deadline
   - ca PM nhắc

2. `Đang thực hiện`
   - có progress
   - cần cập nhật worklog / estimate / kết quả

3. `Đang bị chặn`
   - chờ PM
   - chờ khách hàng
   - chờ môi trường / dữ liệu / task ngoài

### Thông tin nên hiển thị trên mỗi item

- mã YC
- tiêu đề
- khách hàng
- dự án / sản phẩm
- PM điều phối
- estimate tổng / estimate còn lại
- actual hours
- deadline dự kiến
- latest note từ PM
- task IT360 chính
- blocker flag

### Widget nên bổ sung cho performer

- `Lịch hôm nay / tuần này`
- `Estimate còn lại theo ca`
- `Ca chưa cập nhật worklog`
- `Ca chưa gắn task/file đủ ngữ cảnh`

### Timesheet nên chuyên nghiệp hơn

Ngoài chart ngày, nên có thêm:

- giờ theo activity type
- billable vs non-billable
- top 3 ca tốn giờ nhất
- ngày nào > ngưỡng giờ

---

## 5.4 Role `OVERVIEW / LEAD / ADMIN`

### Overview cần trả lời

- hệ thống đang nghẽn ở đâu
- vai trò nào đang bottleneck
- dự án/khách hàng nào đang nóng
- xu hướng tuần này tốt hơn hay xấu hơn tuần trước

### KPI nên hiển thị

- tổng ca đang mở
- ca SLA risk
- ca vượt estimate
- ca chờ phản hồi KH
- ca chờ phân công
- throughput 7 ngày / 30 ngày

### Khối phân tích nên có

- top khách hàng nóng
- top dự án nóng
- top performer quá tải
- top PM có nhiều ca chậm
- xu hướng mở mới vs đóng xong

### Nên có thêm

- so sánh theo tuần
- heatmap theo trạng thái
- age bucket: `0-1d`, `2-3d`, `4-7d`, `>7d`

---

## 6. Nâng cấp list và detail để đồng bộ với role workspace

## 6.1 List pane

List pane hiện nên nâng lên thành “table để ra quyết định”, không chỉ là bảng tra cứu.

### Cột nên ưu tiên

- mã YC
- tiêu đề
- khách hàng / dự án / sản phẩm
- role ownership hiện tại
- trạng thái
- estimate / actual / remaining
- warning level
- updated at
- next action

### Tương tác nên có

- sort nhanh theo `cần xử lý`, `quá hạn`, `vượt estimate`, `mới cập nhật`
- saved filters theo role
- quick preview hover card
- batch view cho dispatcher nếu cần

## 6.2 Detail pane

Detail pane nên chia thành 4 khối lớn:

1. `Ra quyết định`
   - trạng thái hiện tại
   - owner hiện tại
   - warning
   - next action
   - CTA chính

2. `Ngữ cảnh nghiệp vụ`
   - khách hàng
   - dự án / sản phẩm
   - người yêu cầu
   - PM / performer / creator

3. `Tiến độ thực thi`
   - estimate history
   - actual hours
   - worklog gần nhất
   - task IT360 / task liên quan
   - file / evidence

4. `Lịch sử và giải thích`
   - timeline
   - lý do chuyển bước
   - ghi chú quan trọng

---

## 7. Nâng cấp modal để đúng chuẩn “professional workflow”

## 7.1 Modal create

Ngoài phần fix layout ở v6, modal create nên:

- nhấn mạnh `Thông tin yêu cầu` là phần chính
- `Hướng xử lý` là phần quyết định
- `Estimate`, `Task`, `File` là phần bổ trợ
- có summary outcome trước khi bấm tạo

## 7.2 Modal transition

Transition modal nên có:

- trạng thái hiện tại -> trạng thái mới
- lý do hành động
- context file/task đã có
- phần bổ sung cho bước mới
- expected outcome sau khi confirm

## 7.3 Modal creator/notify

Các modal giao tiếp với khách hàng nên có:

- context từ yêu cầu
- kết quả hiện tại
- file/task liên quan
- lịch sử tương tác gần nhất

Điều này giúp thao tác “có căn cứ”, nhìn chuyên nghiệp hơn hẳn.

---

## 8. Hạng mục UI/UX nên thêm mới

### 8.1 Hover card / quick preview

Khi rê hoặc focus vào một YC, nên thấy nhanh:

- trạng thái
- owner
- estimate/actual
- khách hàng
- project/product
- last worklog
- last update

### 8.2 Empty states có hướng dẫn

Không chỉ ghi “chưa có dữ liệu”, mà nên chỉ dẫn:

- vì sao chưa có
- bước tiếp theo nên làm gì
- role nào cần thao tác

### 8.3 Alert system rõ hơn

Nên có 3 mức cảnh báo thống nhất:

- `Info`
- `Warning`
- `Critical`

Và hiển thị nhất quán trên:

- dashboard
- list
- detail
- role workspaces

### 8.4 Personalization theo role

Cho phép:

- ghim widget
- nhớ filter theo role
- nhớ tab detail đã mở gần nhất
- nhớ list sort ưu tiên

---

## 9. Phase triển khai đề xuất

## 9.1 Phase A — Design system và khung giao diện

- thống nhất card, badge, CTA, empty state
- chuẩn hóa header, role switch ngang, KPI row, workspace shell
- chuẩn hóa list + detail layout

## 9.2 Phase B — Role workspace nâng cấp

- nâng `creator workspace`
- nâng `dispatcher workspace`
- nâng `performer workspace`
- nâng `overview dashboard`

## 9.3 Phase C — Detail + modal chuyên nghiệp hóa

- detail pane
- create modal
- transition modal
- feedback / notify modal

## 9.4 Phase D — Quality + adoption

- UI test
- visual regression
- responsive verify
- pilot UAT với từng role

---

## 10. Checklist theo role

### Creator

- [ ] KPI creator rõ hơn
- [ ] danh sách “cần tôi hành động”
- [ ] hiển thị owner hiện tại + next action
- [ ] hiển thị lịch sử phản hồi KH ngắn
- [ ] hiển thị file/task context trong modal liên quan

### Dispatcher

- [ ] inbox điều phối rõ ràng
- [ ] team load matrix
- [ ] PM action queue
- [ ] estimate/actual/warning rõ trên từng item
- [ ] bản đồ nóng theo dự án / performer

### Performer

- [ ] việc hôm nay / việc ưu tiên
- [ ] estimate remaining
- [ ] latest PM note / blocker
- [ ] timesheet chuyên nghiệp hơn
- [ ] action-first detail cho performer

### Overview

- [ ] throughput
- [ ] age buckets
- [ ] top customer / project / performer / PM
- [ ] heatmap trạng thái
- [ ] xu hướng tuần / tháng

---

## 11. Tiêu chí Done của v7

v7 chỉ được xem là done khi:

- mở mỗi workspace là hiểu ngay cần làm gì
- KPI của từng role không trùng lặp vô nghĩa
- list/detail/modal đều phục vụ quyết định, không chỉ hiển thị dữ liệu
- thông tin `owner / deadline / estimate / actual / risk / next action` luôn dễ thấy
- UI nhất quán, chuyên nghiệp, có thứ bậc rõ
- creator / dispatcher / performer đều cảm thấy “đây là màn dành cho mình”

---

## 12. Gợi ý thực thi

Thứ tự an toàn nhất:

1. nâng khung dashboard + workspace shell
   - dùng `header-level role switch`, không thêm sidebar cấp 2
2. nâng `dispatcher workspace` trước
3. nâng `performer workspace`
4. nâng `creator workspace`
5. chốt detail + modal

Lý do:

- `dispatcher` là role cần nhiều thông tin để ra quyết định nhất
- khi dispatcher shell tốt lên, các pattern còn lại dễ nhân rộng cho creator/performer

---

## 13. Responsive strategy cho v7

v7 chỉ thật sự đạt chất lượng nếu không dừng ở desktop rộng, mà phải chạy ổn trên:

- **Desktop:** `1920x1080`, `1536x864`, `1366x768`
- **Tablet:** `768x1024`, `810x1080`
- **Mobile:** `360x800`, `390x844`, `412x915`

Nguyên tắc:

- không “thu nhỏ nguyên xi” giao diện desktop xuống mobile/tablet
- không giữ table nhiều cột ở các viewport hẹp
- không phá kiến trúc hiện có; ưu tiên **đổi bố cục hiển thị**, không đổi bản chất dữ liệu / workflow
- `role switch` + `view switch` phải là xương sống xuyên suốt mọi kích thước màn hình

### 13.1 Tầng responsive đề xuất

1. `Desktop XL` — từ `>= 1800px`
   - mục tiêu: khai thác không gian cho điều hành và so sánh dữ liệu
2. `Desktop / Laptop chuẩn` — `1440px - 1799px`
   - mục tiêu: giữ đầy đủ chức năng, vẫn có split view đẹp
3. `Laptop compact` — `1280px - 1439px`, trọng tâm `1366x768`
   - mục tiêu: không chật, không tràn, không ép user cuộn ngang
4. `Tablet portrait` — `768px - 1024px`
   - mục tiêu: action-first, giảm table, tăng panel stack / drawer
5. `Mobile` — `< 768px`
   - mục tiêu: xem nhanh, xử lý nhanh, search nhanh, không cố giữ desktop mental model

---

## 14. Mô hình giao diện theo viewport

### 14.1 Desktop `1920x1080`

Đây là màn hình để khai thác tối đa mô hình `command center`.

Nên hiển thị:

- hàng đầu: `role switch`, `view switch`, `search`, `saved views`, `recent`, `pinned`
- view `Inbox`: 2 cột lớn
  - trái: queue / priority list / quick actions
  - phải: side metrics / risk / top entity
- view `Danh sách`: split `list + detail`
  - tỷ lệ gợi ý: `7/5` hoặc `8/4`
- view `Phân tích`: 3 vùng
  - `KPI + trend`
  - `top customer/project`
  - `risk / bottleneck / heatmap`

Không nên:

- kéo mọi thứ thành full width nếu nội dung cần so sánh ngang
- ẩn detail pane sau click nếu màn hình vẫn đủ rộng để xem song song

### 14.2 Desktop `1536x864`

Đây là mức desktop/laptop phổ biến, nên xem như chuẩn chính để thiết kế.

Nên hiển thị:

- `role switch` + `view switch` vẫn nằm cùng phần header
- `Inbox`: giữ bố cục 2 cột, nhưng card phụ gọn hơn
- `Danh sách`: split `list + detail`, tỷ lệ `6/6` hoặc `7/5`
- `Phân tích`: KPI 1 hàng, phần trend và top entity chia 2 cột

Không nên:

- để card phụ quá cao làm list bị đẩy xuống thấp
- để table cần cuộn ngang mới đọc được trạng thái chính

### 14.3 Desktop `1366x768`

Đây là viewport dễ “vỡ trải nghiệm” nhất vì chiều ngang và chiều cao đều hạn chế.

Mặc định nên:

- ưu tiên `Inbox` khi vào role workspace
- giảm chiều cao header, KPI, card trang trí
- dùng list kiểu “table compact” hoặc “row summary”
- khi vào view `Danh sách`, detail pane nên mở theo 2 chế độ:
  - mặc định: list full width
  - click row: detail slide-over hoặc split hẹp `8/4`

Nên tối giản:

- chỉ giữ 5-6 cột quan trọng nhất trên row
- các trường phụ như `task hint`, `last worklog`, `owner phụ` chuyển vào hover / preview / detail

Không nên:

- cố giữ full split view 2 cột nặng như desktop rộng
- vừa hiện KPI lớn vừa hiện bảng dày vừa hiện detail cố định

---

## 15. Tablet strategy

### 15.1 Tablet `768x1024`

Tablet nên ưu tiên thao tác kiểu `stack + drawer`, không cố làm desktop thu nhỏ.

Mặc định nên:

- `role switch` là pills ngang có thể scroll
- `view switch` sticky ngay dưới header
- `Inbox`: stack card theo 1 cột
- `Danh sách`: danh sách dạng card/table hybrid
- `Detail`: mở full-height panel hoặc slide-over
- `Phân tích`: KPI 2 cột, chart / top entity xếp dọc

Nên thay đổi:

- filter nâng cao mở thành drawer
- action bar của detail nằm sticky dưới cùng
- modal create/transition chuyển sang `full-screen modal`

### 15.2 Tablet `810x1080`

Viewport này rộng hơn chút, nên có thể thoải mái hơn `768x1024`.

Nên hiển thị:

- `Inbox`: 2 cột nhẹ ở một số khối, nhưng không ép toàn bộ layout thành 2 cột
- `Danh sách`: list full width + detail drawer phải
- `Phân tích`: KPI 2 hàng, top entity 2 cột

Nguyên tắc:

- vẫn ưu tiên tap targets lớn
- không dùng hover-only interaction
- không đặt quá nhiều quick actions trên một hàng

---

## 16. Mobile strategy

### 16.1 Mobile `360x800`

Đây là mức hẹp nhất, nên mọi quyết định phải ưu tiên thao tác nhanh.

Mặc định nên:

- mở vào `Inbox`
- `role switch` scroll ngang
- `view switch` sticky
- search là action lớn, dễ thấy
- list không phải table mà là `case cards`
- detail mở kiểu full-screen sheet

Một card YC trên mobile chỉ nên giữ:

- mã YC + tiêu đề
- khách hàng / dự án rút gọn
- trạng thái
- risk
- owner hiện tại
- next action
- estimate/actual rút gọn

### 16.2 Mobile `390x844` và `412x915`

Hai viewport này có dư hơn một chút, có thể bổ sung:

- 2 badge phụ trên card
- 1 hàng metadata nữa
- action chip rõ hơn
- chart mini trong `Phân tích`

Nhưng vẫn nên:

- giữ `Inbox` là bề mặt mặc định
- để `Danh sách` ở dạng card feed
- chỉ mở full table ở `tablet` trở lên

Không nên:

- đưa table 6-8 cột xuống mobile
- để modal create dạng popup nhỏ giữa màn
- bắt user mở quá nhiều accordion mới hiểu một case

---

## 17. Responsive behavior theo từng bề mặt

### 17.1 Role switch + view switch

- `Desktop`: hiển thị đầy đủ theo hàng ngang
- `Tablet`: hàng ngang scroll nhẹ nếu cần
- `Mobile`: segmented pills scroll ngang, sticky khi cuộn

### 17.2 Inbox

- `Desktop XL / Desktop`: 2 cột hoặc `2 + 1`
- `Laptop compact`: 1 cột chính + card phụ xếp xuống dưới
- `Tablet / Mobile`: 1 cột

### 17.3 Danh sách

- `Desktop XL / Desktop`: `table + detail split`
- `Laptop compact`: `table compact` + `detail drawer`
- `Tablet`: `list hybrid` + `detail full-height drawer`
- `Mobile`: `card feed` + `full-screen detail`

### 17.4 Phân tích

- `Desktop XL`: 3 vùng phân tích song song
- `Desktop / Laptop`: 2 vùng chính
- `Tablet`: KPI grid + chart stack
- `Mobile`: KPI cards + mini trend + top 3 lists

### 17.5 Modal create / transition / feedback / notify

- `Desktop XL / Desktop`: modal lớn hoặc side-by-side layout
- `1366x768`: modal gọn hơn, giảm cột phụ
- `Tablet`: full-screen modal
- `Mobile`: step-based full-screen sheet

---

## 18. Dữ liệu nào phải ưu tiên hiển thị theo thiết bị

### 18.1 Dữ liệu luôn phải thấy trên mọi viewport

- mã YC
- tiêu đề
- trạng thái
- owner hiện tại
- risk
- next action

### 18.2 Dữ liệu ưu tiên từ tablet trở lên

- estimate / actual / remaining
- customer + project + product đầy đủ
- latest note / latest worklog
- file/task context rút gọn

### 18.3 Dữ liệu nên để vào detail hoặc drawer trên mobile

- timeline đầy đủ
- estimate history
- file list đầy đủ
- worklog dài
- audit context
- heatmap / trend sâu

---

## 19. Responsive mà không phá codebase

Nguyên tắc triển khai:

- giữ nguyên `role dashboards`, `workspace tabs`, `list pane`, `detail pane`, `modal`
- thêm `view switch state` ở hub, không tách route mới
- chỉ render mạnh phần active view, các view khác lazy hoặc preload nhẹ
- không viết một bộ component hoàn toàn mới cho mobile nếu có thể giải bằng variant props

Nên ưu tiên:

- `variant` cho component hiện có: `desktop / compact / mobile`
- `drawer` và `sheet` cho detail/modal ở viewport hẹp
- `card list renderer` dùng lại data mapping từ `list pane`
- `responsive density` thay vì đổi hoàn toàn dữ liệu

Không nên:

- nhân đôi toàn bộ workspace thành bản desktop và bản mobile riêng biệt
- để business logic rơi xuống component CSS-only workaround
- trộn role logic với viewport logic trong cùng một khối `if` quá lớn

---

## 20. Checklist verify theo viewport

### Desktop

- [ ] `1920x1080`: `Inbox`, `Danh sách`, `Phân tích` đều khai thác tốt chiều ngang
- [ ] `1536x864`: split view không chật, header không đẩy content xuống quá thấp
- [ ] `1366x768`: không tràn ngang, detail không làm bảng unusable

### Tablet

- [ ] `768x1024`: role/view switch dễ chạm, detail mở dạng drawer hoặc full-height
- [ ] `810x1080`: card và quick actions không bị chật, analytics vẫn đọc được

### Mobile

- [ ] `360x800`: không có table tràn, inbox đọc nhanh, detail full-screen dễ dùng
- [ ] `390x844`: search, filter, next action dễ thao tác
- [ ] `412x915`: card list đủ thông tin mà chưa bị quá rối

### Tất cả viewport

- [ ] tạo YC mới thuận
- [ ] chuyển trạng thái không bị vỡ layout
- [ ] file/task context vẫn thấy được khi cần
- [ ] `role switch` + `view switch` luôn nhất quán
- [ ] không có double-scroll khó chịu
