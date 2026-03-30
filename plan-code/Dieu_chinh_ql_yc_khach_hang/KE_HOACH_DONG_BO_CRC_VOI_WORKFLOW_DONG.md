# KẾ HOẠCH ĐỒNG BỘ CRC VỚI WORKFLOW ĐỘNG

**Version:** 1.0
**Ngày tạo:** 2026-03-30
**Phạm vi:** Customer Request Management (CRC)
**Trạng thái:** Draft for Implementation

---

## 1. Mục tiêu

Đồng bộ module `customer-request-management` để frontend CRC bám đúng workflow động đã có ở backend, giảm phụ thuộc vào các rule hardcode theo status/role cũ.

### Kết quả mong muốn
- UI transition của CRC hiển thị theo `allowed_next_processes` từ backend.
- Workspace creator / dispatcher / performer giảm phụ thuộc vào bucket status cứng.
- Status label / màu / grouping có nguồn dữ liệu rõ ràng, không phụ thuộc hoàn toàn vào map tĩnh cũ.
- Quick actions, detail pane, modal chuyển trạng thái và save flow hoạt động đúng khi workflow thay đổi.
- Khi admin thêm/chỉnh workflow trong workflow-management, CRC không cần sửa nhiều code frontend mới chạy đúng.

---

## 2. Hiện trạng đã kiểm tra

## 2.1. Điểm đã kết nối với workflow động
- Form tạo mới đã load workflow từ `getWorkflows('customer_request', false)`.
- Create/update case đã gửi `workflow_definition_id`.
- Backend đã resolve transition theo `workflow_definition_id`.
- Backend đã validate transition theo workflow đang gắn với case.

## 2.2. Điểm chưa đồng bộ hoàn toàn
- Frontend không dùng nguyên bản `allowed_next_processes`, mà còn đi qua lớp filter/alignment riêng.
- Workspace creator / dispatcher / performer đang suy diễn từ status code cũ.
- Status presentation vẫn dựa nhiều vào `STATUS_COLOR_MAP` và các map tĩnh tương tự.
- Create flow vẫn mang assumption nghiệp vụ cũ như `self_handle`, `assign_dispatcher`.
- Quick access / action visibility / detail pane chưa dựa hoàn toàn trên capability động.

## 2.3. Rủi ro nếu không sửa
- Backend cho phép transition nhưng UI không hiện nút tương ứng.
- Admin thêm status mới nhưng CRC không hiển thị đúng label, màu, workspace.
- Dashboard/workspace lệch nghĩa nghiệp vụ khi workflow đổi lane xử lý.
- Tăng chi phí bảo trì: mỗi lần đổi workflow lại phải vá frontend thủ công.

---

## 3. Nguyên tắc triển khai

1. **Backend là nguồn sự thật cuối cùng** cho transition hợp lệ.
2. **Frontend không tự suy diễn lại workflow** nếu backend đã trả metadata đủ dùng.
3. **Giảm hardcode theo từng lớp**, không refactor big bang.
4. **Ưu tiên tương thích với bộ status CRC hiện tại** để tránh vỡ các báo cáo đang chạy.
5. **Mỗi phase đều phải giữ được khả năng chạy với workflow hiện tại** trước khi mở rộng sang workflow biến thể.

---

## 4. Phạm vi triển khai

## 4.1. Trong phạm vi
- Transition action list trong CRC.
- Modal chuyển trạng thái.
- Detail pane và quick actions liên quan workflow.
- Workspace creator / dispatcher / performer.
- Chuẩn hóa metadata hiển thị status ở frontend.
- Bổ sung test cho workflow động trong CRC.

## 4.2. Ngoài phạm vi phase đầu
- Viết lại toàn bộ CRC thành workflow engine UI tổng quát.
- Thiết kế lại toàn bộ dashboard/report theo schema mới.
- Bỏ hoàn toàn registry/status cũ ở backend.
- Import/export Excel cho workflow hoặc CRC import phase riêng.

---

## 5. Phân tích vấn đề theo lớp

## 5.1. Lớp create
**Hiện trạng:** Có gắn `workflow_definition_id` nhưng create flow vẫn dùng route business cố định.
**Vấn đề:** workflow-aware nhưng chưa workflow-generated.
**Hướng xử lý:** giữ create flow hiện tại trong phase đầu, chỉ chuẩn hóa cách chọn workflow mặc định và metadata hiển thị để đảm bảo case tạo ra gắn đúng workflow.

## 5.2. Lớp transition
**Hiện trạng:** Backend trả `allowed_next_processes` nhưng frontend còn gọi lớp build/filter riêng.
**Vấn đề:** UI có thể lệch backend khi workflow đổi.
**Hướng xử lý:** chuyển dần sang render transition list trực tiếp từ metadata backend, chỉ giữ lại lớp transform tối thiểu cho UI.

## 5.3. Lớp workspace
**Hiện trạng:** Workspace bucket theo status code cố định.
**Vấn đề:** thêm status mới là case có thể rơi sai tab hoặc mất khỏi workspace.
**Hướng xử lý:** đưa thêm concept capability/ownership động từ backend hoặc metadata trạng thái; nếu chưa đủ dữ liệu backend thì gom các rule cứng về một chỗ để dễ thay thế.

## 5.4. Lớp presentation
**Hiện trạng:** label/màu/trạng thái dựa nhiều vào map tĩnh.
**Vấn đề:** status mới hoặc workflow mới khó hiển thị đúng.
**Hướng xử lý:** chuẩn hóa một adapter status metadata có fallback an toàn, giảm rải rác map cứng ở nhiều file.

---

## 6. Kế hoạch thực hiện theo phase

## Phase 1 — Audit và cô lập hardcode CRC
**Mục tiêu:** xác định đầy đủ các điểm frontend đang suy diễn workflow cũ.

### Công việc
- Rà soát các file CRC đang hardcode transition/status/role.
- Liệt kê toàn bộ hàm filter/normalize/build option liên quan workflow.
- Gắn nhóm vấn đề theo 4 lớp: transition, workspace, presentation, action visibility.
- Chốt danh sách metadata backend hiện đã có và metadata còn thiếu.

### File cần kiểm tra ưu tiên
- `frontend/components/CustomerRequestManagementHub.tsx`
- `frontend/components/customer-request/presentation.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
- `frontend/components/customer-request/CustomerRequestDetailPane.tsx`
- `frontend/components/customer-request/CustomerRequestQuickAccessBar.tsx`
- `frontend/components/customer-request/creatorWorkspace.ts`
- `frontend/components/customer-request/dispatcherWorkspace.ts`
- `frontend/components/customer-request/performerWorkspace.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestDetail.ts`
- `frontend/components/customer-request/hooks/useCustomerRequestList.ts`

### Deliverables
- Danh sách hardcode còn tồn tại.
- Ma trận “logic cũ → logic sẽ thay bằng metadata nào”.
- Danh sách API/backend field cần bổ sung nếu thiếu.

### Definition of Done
- Không còn điểm hardcode quan trọng nào chưa được liệt kê.
- Có bảng mapping rõ cho từng loại logic cần refactor.

---

## Phase 2 — Chuẩn hóa transition metadata và action rendering
**Mục tiêu:** UI chuyển trạng thái bám backend hơn, giảm filter cứng.

### Công việc
- Tạo adapter chuẩn cho `allowed_next_processes`.
- Thu gọn hoặc loại bỏ các hàm alignment/filter theo XML flow cũ.
- Render danh sách transition theo dữ liệu backend trả về.
- Chuẩn hóa dữ liệu dùng cho modal transition: label, required fields, handler assumptions, notes, task payload.
- Đảm bảo thông báo thành công/thất bại không phụ thuộc status map tĩnh quá mức.

### Hướng kỹ thuật
- Tạo một lớp helper duy nhất nhận `processDetail` và trả về `availableTransitions` cho UI.
- Tách phần fallback tương thích cũ vào một chỗ riêng, có thể bật/tắt dần.
- Nếu backend chưa trả đủ metadata hiển thị, bổ sung field ở API thay vì viết thêm nhiều frontend rule.

### Deliverables
- CRC detail pane hiển thị đúng danh sách transition theo backend.
- Modal transition dùng chung adapter metadata mới.
- Giảm đáng kể logic hardcode trong `presentation.ts`.

### Definition of Done
- Khi workflow đổi transition trong admin, UI CRC phản ánh đúng mà không cần sửa thêm rule frontend.
- Không còn lớp filter transition quan trọng dựa trên status lane cũ.

---

## Phase 3 — Chuẩn hóa status presentation và capability model
**Mục tiêu:** gom các rule hiển thị status/action về một nguồn metadata rõ ràng.

### Công việc
- Thiết kế `status metadata adapter` dùng cho label, màu, nhóm, thứ tự hiển thị.
- Gom các map như `STATUS_COLOR_MAP` về một lớp đọc metadata có fallback.
- Chuẩn hóa capability check cho action visibility: được sửa, được chuyển, được upload, được thêm task, v.v.
- Xóa dần các `if statusCode === ...` nằm rải rác trong CRC UI.

### File dự kiến tác động
- `frontend/components/customer-request/presentation.ts`
- `frontend/components/customer-request/CustomerRequestDetailPane.tsx`
- `frontend/components/customer-request/CustomerRequestQuickAccessBar.tsx`
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
- `frontend/types.ts`

### Deliverables
- Một lớp metadata tập trung cho status và capability.
- UI badge/action đồng nhất giữa list, detail, modal.

### Definition of Done
- Thêm status mới không cần sửa nhiều hơn một adapter/fallback layer.
- Không còn nhiều map status rải rác khó kiểm soát.

---

## Phase 4 — Refactor workspace creator / dispatcher / performer
**Mục tiêu:** giảm bucket cứng theo status, tăng khả năng thích nghi khi workflow thay đổi.

### Công việc
- Rà soát cách chia case vào workspace hiện tại.
- Tách logic xác định “case thuộc workspace nào” thành helper tập trung.
- Nếu backend chưa trả ownership/capability đủ rõ, bổ sung metadata ở API list/detail.
- Ưu tiên refactor các badge count, tab counts, quick sections phụ thuộc status code cứng.

### Hướng kỹ thuật
- Tạm thời có thể duy trì fallback theo status cũ, nhưng phải gom vào một helper duy nhất.
- Về lâu dài, workspace nên dựa vào actor assignment/capability thay vì tên status thuần túy.

### Deliverables
- Creator/dispatcher/performer workspace hoạt động ổn với workflow biến thể trong cùng nhóm CRC.
- Giảm rủi ro case bị rơi sai workspace khi thêm status trung gian.

### Definition of Done
- Một status mới hoặc nhánh mới không làm case biến mất khỏi workspace chính.
- Rule workspace không còn phân tán ở nhiều file.

---

## Phase 5 — Bổ sung test và hardening
**Mục tiêu:** khóa hành vi đúng bằng test để workflow động không bị regress.

### Công việc backend
- Bổ sung test cho allowed transitions theo `workflow_definition_id`.
- Bổ sung test cho transition validation với nhiều workflow khác nhau.
- Bổ sung test cho fallback workflow mặc định nếu case chưa có workflow.

### Công việc frontend
- Test adapter transition metadata.
- Test rendering action buttons khi workflow trả transition khác nhau.
- Test workspace bucketing với status biến thể.
- Test create/select workflow và follow-up flow.

### Deliverables
- Bộ test bao phủ các đường dẫn chính của CRC dynamic workflow.
- Checklist smoke test manual cho QA/UAT.

### Definition of Done
- Có thể đổi workflow trên staging và kiểm tra CRC không lệch UI chính.
- Các regression quan trọng đều có test tự động bảo vệ.

---

## 7. Danh sách hạng mục kỹ thuật chi tiết

## 7.1. Frontend
- Tạo helper/adapter chuẩn cho workflow transition metadata.
- Gỡ bớt logic trong `presentation.ts` chỉ còn phần trình bày.
- Chuẩn hóa nguồn status label/color/group.
- Gom logic workspace vào các helper ít phân tán hơn.
- Kiểm tra lại các hook list/detail/transition để bỏ workaround không còn cần thiết.

## 7.2. Backend
- Rà lại response `allowed_next_processes` xem đã đủ cho UI chưa.
- Nếu cần, bổ sung metadata như:
  - transition label
  - display order
  - actor/capability hints
  - status display metadata
  - workspace/ownership hints
- Đảm bảo API detail/list trả dữ liệu nhất quán, tránh frontend phải fallback nhiều shape.

## 7.3. Tài liệu
- Cập nhật `QUY_TRINH_TAO_VA_CHUYEN_YC.md` sau khi chốt hành vi mới.
- Nếu bổ sung metadata mới từ backend, cập nhật thêm tài liệu API/workflow tương ứng.
- Ghi rõ phần nào còn fallback legacy, phần nào đã chuyển sang dynamic hoàn toàn.

---

## 8. Thứ tự ưu tiên thực hiện

### Ưu tiên P1
1. Transition rendering
2. Modal transition
3. Status metadata adapter

### Ưu tiên P2
4. Quick access / detail action visibility
5. Workspace bucket helper
6. Chuẩn hóa response shape list/detail

### Ưu tiên P3
7. Dashboard/report grouping review
8. Tối ưu create flow để giảm assumption cũ

---

## 9. Rủi ro và cách giảm thiểu

| Rủi ro | Tác động | Cách giảm thiểu |
|--------|----------|------------------|
| UI đang phụ thuộc nhiều logic cũ, refactor dễ vỡ | Cao | Refactor theo phase nhỏ, có fallback tạm thời |
| Backend chưa trả đủ metadata cho UI | Cao | Bổ sung metadata ở API thay vì viết thêm hardcode frontend |
| Workspace logic chạm nhiều file | Trung bình | Gom logic vào helper trước, rồi thay dần từng màn |
| Dashboard/report đang dùng nhóm status cũ | Trung bình | Tách riêng review phase sau, không trộn vào transition refactor đầu |
| Workflow mới không tương thích với create flow hiện tại | Trung bình | Giữ create flow cũ ở phase đầu, chỉ mở rộng sau khi transition/workspace ổn định |

---

## 10. Tiêu chí nghiệm thu cuối

Hệ thống được xem là đạt mục tiêu phase này khi:

1. Admin đổi workflow active cho `customer_request` trên staging.
2. User tạo case mới với workflow đó mà không cần sửa frontend riêng.
3. CRC detail hiển thị đúng các transition backend cho phép.
4. User chuyển trạng thái thành công với modal/action đúng metadata.
5. Case vẫn xuất hiện đúng khu vực làm việc chính, không bị rơi khỏi workspace do status mới.
6. Không cần thêm hardcode mới ở frontend cho mỗi biến thể workflow cùng loại.

---

## 11. Khuyến nghị triển khai thực tế

- Bắt đầu từ **transition path** trước, vì đây là chỗ ảnh hưởng trực tiếp nhất tới người dùng.
- Không refactor toàn bộ CRC một lần; nên dùng chiến lược **adapter + fallback**.
- Mỗi lần backend bổ sung metadata mới, frontend nên xóa bớt rule cũ tương ứng ngay.
- Sau khi xong phase 2 và 3 mới đụng mạnh tới workspace để tránh phạm vi lan quá lớn.

---

## 12. Kết luận

CRC hiện tại đã có nền tảng workflow động ở backend nhưng frontend vẫn còn nhiều lớp diễn giải theo flow cũ. Kế hoạch phù hợp nhất là refactor theo từng phase nhỏ, ưu tiên transition và metadata trước, sau đó mới mở rộng sang workspace và reporting.

Cách làm này giúp:
- giảm rủi ro vỡ CRC đang chạy,
- tận dụng được workflow-management đã xây,
- và đưa CRC tiến dần tới mô hình frontend bám workflow động thực sự.
