# PHASE 4 — REFACTOR WORKSPACE CREATOR / DISPATCHER / PERFORMER

**Ngày tạo:** 2026-03-30
**Phạm vi:** CRC workspace bucketing logic
**Trạng thái:** Completed (centralized helpers)

---

## 1. Mục tiêu phase 4

Giảm phân tán của logic bucket workspace trong 3 file riêng lẻ bằng cách gom các rule status-based về helper tập trung hơn, chuẩn bị cho bước thay thế dần bằng metadata/capability trong tương lai.

---

## 2. Thay đổi đã thực hiện

## 2.1. Gom rule workspace vào `presentation.ts`
### File
- `frontend/components/customer-request/presentation.ts`

### Đã thêm
- `classifyCreatorWorkspaceStatus(...)`
- `classifyPerformerWorkspaceStatus(...)`
- `getPerformerWorkspaceStatusPriority(...)`
- `classifyDispatcherWorkspaceRow(...)`
- `isDispatcherTeamLoadActiveStatus(...)`
- `isWorkspaceClosedStatus(...)`

### Ý nghĩa
- rule workspace không còn nằm rải rác hoàn toàn ở 3 file
- có entry point tập trung để thay dần logic status cứng sau này

---

## 2.2. Refactor creator workspace
### File
- `frontend/components/customer-request/creatorWorkspace.ts`

### Đã làm
- đổi phân loại row sang dùng `classifyCreatorWorkspaceStatus(statusCode)`
- bỏ mảng `includes(...)` dài ngay trong file workspace

### Ý nghĩa
- creator workspace không còn giữ riêng bộ status set cứng
- dễ thay rule hơn ở một nơi tập trung

---

## 2.3. Refactor performer workspace
### File
- `frontend/components/customer-request/performerWorkspace.ts`

### Đã làm
- bỏ local sets:
  - `CLOSED_STATUSES`
  - `ACTIVE_STATUSES`
  - `PENDING_STATUS_PRIORITY`
- chuyển sang dùng:
  - `classifyPerformerWorkspaceStatus(...)`
  - `getPerformerWorkspaceStatusPriority(...)`

### Ý nghĩa
- performer workspace đã bỏ được một cụm hardcode status nội bộ
- sort priority được gom về helper dùng lại được

---

## 2.4. Refactor dispatcher workspace
### File
- `frontend/components/customer-request/dispatcherWorkspace.ts`

### Đã làm
- bỏ local set `ACTIVE_WORKLOAD_STATUSES`
- đổi logic split row sang `classifyDispatcherWorkspaceRow(row)`
- đổi logic team load sang `isDispatcherTeamLoadActiveStatus(statusCode)`

### Ý nghĩa
- rule queue/returned/feedback/approval/active được gom khỏi file workspace
- dispatcher workspace bớt phụ thuộc vào nhiều branch status cứng viết inline

---

## 3. Những gì phase 4 chưa làm hết

Phase 4 mới gom logic về helper tập trung, chưa chuyển sang workspace metadata thực sự từ backend.

### Chưa làm hết
- helper trong `presentation.ts` vẫn đang dựa trên status code cứng
- workspace vẫn chưa đọc `workspace_hint` hay capability metadata từ backend
- badge counts/tab counts vẫn đang phụ thuộc các rule status-based này
- chưa có test chuyên biệt cho từng helper workspace mới

### Kết luận thực tế
Phase 4 là bước **centralize hardcode**, chưa phải **eliminate hardcode**.

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
- refactor workspace helper chưa làm đổi hành vi cũ đang được bộ test hiện tại bảo vệ gián tiếp
- có thể tiếp tục phase 5 để bổ sung test/hardening

---

## 5. Tác động kiến trúc

Sau phase 4:
- 3 workspace không còn mỗi nơi giữ một cụm status set cứng lớn riêng biệt
- `presentation.ts` trở thành nơi tập trung hơn cho logic status/workspace transition-related UI
- phase sau có thể thay helper nội bộ bằng metadata backend mà không cần sửa nhiều call site workspace nữa

---

## 6. Gợi ý phase 5

Phase tiếp theo nên tập trung vào:
1. bổ sung test cho các helper workspace mới
2. bổ sung test cho adapter transition/status resolver đã tạo ở phase 2/3
3. nếu cần, thêm smoke checklist cho các màn creator/dispatcher/performer

---

## 7. Kết luận

Phase 4 đã hoàn thành mục tiêu refactor an toàn:
- gom logic workspace về helper tập trung
- giảm trùng lặp hardcode giữa 3 file workspace
- giữ nguyên hành vi hiện tại và pass test

Đây là nền phù hợp để bước sang Phase 5 — test và hardening.
