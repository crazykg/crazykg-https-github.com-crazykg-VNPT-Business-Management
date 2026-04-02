# PHASE 2 — CHUẨN HÓA TRANSITION METADATA VÀ ACTION RENDERING

**Ngày tạo:** 2026-03-30
**Phạm vi:** CRC transition path
**Trạng thái:** Completed (initial implementation)

---

## 1. Mục tiêu phase 2

Giảm coupling trực tiếp giữa `CustomerRequestManagementHub` và lớp XML alignment cũ, đồng thời chuẩn hóa cách UI lấy metadata hiển thị transition để chuẩn bị cho các phase sau.

---

## 2. Thay đổi đã thực hiện

## 2.1. Tạo adapter transition tập trung
### File
- `frontend/components/customer-request/presentation.ts`

### Đã làm
- Tách logic cũ thành hàm nội bộ:
  - `buildLegacyXmlAlignedTransitionOptions(...)`
- Thêm adapter mới:
  - `resolveTransitionOptionsForRequest(...)`

### Ý nghĩa
- UI hub không còn gọi trực tiếp hàm mang semantics XML cũ.
- Có một lớp adapter trung gian để sau này chuyển dần sang backend metadata mà không phải sửa toàn bộ call site.
- Vẫn giữ fallback legacy để tránh vỡ hành vi hiện tại.

---

## 2.2. Đổi hub sang dùng adapter mới
### File
- `frontend/components/CustomerRequestManagementHub.tsx`

### Đã làm
- thay import từ `buildXmlAlignedTransitionOptionsForRequest` sang `resolveTransitionOptionsForRequest`
- thay `useMemo` transition options để đi qua adapter mới

### Ý nghĩa
- điểm tích hợp chính của CRC transition đã được gom về một entry point rõ ràng hơn
- thuận lợi cho phase sau khi backend trả thêm metadata

---

## 2.3. Chuẩn hóa metadata label cho thông báo transition
### File
- `frontend/components/customer-request/hooks/useCustomerRequestTransition.ts`
- `frontend/components/customer-request/presentation.ts`

### Đã làm
- thêm helper:
  - `resolveTransitionMeta(...)`
  - `resolveTransitionLabel(...)`
- thay success notify trong `useCustomerRequestTransition.ts` từ `STATUS_COLOR_MAP[...]` sang `resolveStatusMeta(...)` với fallback `transitionProcessMeta?.process_label`

### Ý nghĩa
- giảm phụ thuộc trực tiếp vào `STATUS_COLOR_MAP`
- cho phép dùng label backend/process metadata tốt hơn khi có

---

## 3. Những gì phase 2 chưa làm hết

Phase 2 hiện mới hoàn thành lớp đầu tiên, chưa xóa được hết hardcode transition.

### Chưa làm hết
- chưa bỏ hẳn legacy XML alignment/filter
- `resolveTransitionOptionsForRequest(...)` hiện vẫn dùng fallback legacy là chính
- chưa thêm metadata backend mới như:
  - `transition_label`
  - `transition_display_order`
  - capability hints
- chưa cập nhật các component khác ngoài transition path chính

### Kết luận thực tế
Phase 2 này là bước **đặt adapter và gom điểm tích hợp**, chưa phải bước **loại bỏ hoàn toàn logic cũ**.

---

## 4. Kết quả test

### Frontend test đã chạy
```bash
cd frontend && npx vitest run __tests__/crc-status-v4.test.ts
```

### Kết quả
- **1 test file passed**
- **31 tests passed**

### Ý nghĩa
- refactor phase 2 chưa làm vỡ hành vi CRC hiện có
- adapter mới đang tương thích với rule cũ đã được test khóa lại

---

## 5. Tác động kiến trúc

Sau phase 2, transition path của CRC đã có cấu trúc tốt hơn:

- **Trước đây**
  - Hub gọi thẳng logic XML-aligned cũ
  - notify dùng trực tiếp `STATUS_COLOR_MAP`

- **Sau phase 2**
  - Hub gọi adapter `resolveTransitionOptionsForRequest(...)`
  - notify đi qua resolver chung `resolveStatusMeta(...)`
  - legacy logic được hạ xuống làm fallback nội bộ

Điều này giúp Phase 3/4 dễ triển khai hơn mà ít phải sửa call site.

---

## 6. Gợi ý chuyển phase 3

Phase tiếp theo nên tập trung vào:
1. chuẩn hóa `STATUS_COLOR_MAP` thành adapter metadata rõ hơn
2. giảm các `if statusCode === ...` ở presentation/detail/action path
3. gom logic capability/action visibility vào một lớp metadata thống nhất

---

## 7. Kết luận

Phase 2 đã hoàn thành mục tiêu tối thiểu:
- tạo adapter transition metadata tập trung
- chuyển hub sang dùng adapter đó
- chuẩn hóa success label cho transition
- giữ nguyên hành vi cũ và pass test

Đây là bước refactor an toàn để chuẩn bị cho Phase 3, nơi sẽ bắt đầu gom status metadata và capability model rõ ràng hơn.
