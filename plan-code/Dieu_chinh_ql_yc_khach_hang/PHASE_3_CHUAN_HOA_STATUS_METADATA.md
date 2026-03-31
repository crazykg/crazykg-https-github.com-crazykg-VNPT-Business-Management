# PHASE 3 — CHUẨN HÓA STATUS METADATA VÀ CAPABILITY-RELATED PRESENTATION

**Ngày tạo:** 2026-03-30
**Phạm vi:** CRC status presentation layer
**Trạng thái:** Completed (incremental)

---

## 1. Mục tiêu phase 3

Giảm phụ thuộc trực tiếp của UI CRC vào `STATUS_COLOR_MAP` bằng cách chuyển dần sang các resolver chung, để status label/màu/fallback đi qua một entry point thống nhất hơn.

---

## 2. Thay đổi đã thực hiện

## 2.1. Tận dụng resolver chung cho transition target
### File
- `frontend/components/customer-request/CustomerRequestTransitionModal.tsx`

### Đã làm
- bỏ cách lấy target status meta trực tiếp từ `STATUS_COLOR_MAP[transitionStatusCode]`
- chuyển sang `resolveStatusMeta(transitionStatusCode, fallbackLabel)`
- fallback label lấy từ transition option đang chọn hoặc `transitionProcessMeta`

### Ý nghĩa
- transition modal bám metadata resolver chung hơn
- sẵn sàng nhận label backend tốt hơn ở các phase sau

---

## 2.2. Chuẩn hóa quick action modal
### File
- `frontend/components/customer-request/CustomerRequestQuickActionModal.tsx`

### Đã làm
- thay import `STATUS_COLOR_MAP` bằng `resolveStatusMeta`
- mỗi quick action giờ resolve status chip qua resolver chung

### Ý nghĩa
- giảm thêm một consumer trực tiếp của map tĩnh
- thống nhất fallback label/class cho quick action UI

---

## 2.3. Chuẩn hóa full detail view
### File
- `frontend/components/customer-request/CustomerRequestFullDetail.tsx`

### Đã làm
- đổi badge trạng thái chính sang `resolveStatusMeta(currentStatusCode)`
- đổi timeline status badge sang `resolveStatusMeta(code)`

### Ý nghĩa
- full detail không còn tự fallback thủ công từ `STATUS_COLOR_MAP`
- status display đi qua resolver chung

---

## 2.4. Chuẩn hóa search result status chip
### File
- `frontend/components/customer-request/CustomerRequestSearchBar.tsx`

### Đã làm
- đổi result status chip sang `resolveStatusMeta(code)`

### Ý nghĩa
- thêm một consumer phổ biến của status badge được gom về cùng resolver

---

## 3. Những gì phase 3 chưa làm hết

Phase 3 mới là bước incremental, chưa gom toàn bộ capability/status semantics.

### Chưa làm hết
- `STATUS_COLOR_MAP` vẫn còn tồn tại làm nguồn local fallback chính
- chưa thay hết toàn bộ consumer trong CRC khác như:
  - plan views
  - một số detail/report/search consumer khác
- chưa tách riêng status display metadata khỏi business status semantics
- chưa gom toàn bộ capability model (`can_transition`, `can_write`, `primary action`, workspace ownership) về một adapter thống nhất

### Kết luận thực tế
Phase 3 đã **chuẩn hóa điểm vào của status presentation**, nhưng chưa **thay đổi hoàn toàn kiến trúc capability model**.

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
- việc gom metadata về `resolveStatusMeta(...)` chưa làm thay đổi hành vi hiện tại
- có thể tiếp tục phase 4 trên nền an toàn hơn

---

## 5. Tác động kiến trúc

Sau phase 3:
- UI CRC đã có thêm nhiều điểm dùng resolver chung thay vì đọc thẳng `STATUS_COLOR_MAP`
- fallback status label/màu được tập trung hơn
- Phase 4 có thể refactor workspace mà ít cần đụng trực tiếp vào từng status chip consumer

---

## 6. Gợi ý chuyển phase 4

Phase tiếp theo nên tập trung vào:
1. gom logic workspace creator/dispatcher/performer về helper tập trung hơn
2. giảm các status set cứng phân tán ở 3 file workspace
3. chuẩn bị capability/workspace hint rõ hơn để sẵn sàng nhận metadata backend sau này

---

## 7. Kết luận

Phase 3 đã hoàn thành mục tiêu incremental:
- chuẩn hóa thêm lớp status metadata resolver
- chuyển một số consumer quan trọng khỏi `STATUS_COLOR_MAP` trực tiếp
- giữ nguyên hành vi hiện tại và pass test

Đây là bước đệm tốt trước khi vào Phase 4 — refactor workspace logic, vốn là phần khó nhất của plan.
