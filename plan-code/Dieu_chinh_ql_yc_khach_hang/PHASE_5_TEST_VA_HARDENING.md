# PHASE 5 — TEST VÀ HARDENING

**Ngày tạo:** 2026-03-30
**Phạm vi:** CRC frontend refactor verification
**Trạng thái:** Completed

---

## 1. Mục tiêu phase 5

Khóa lại các thay đổi của phase 2-4 bằng test để giảm nguy cơ regressions khi tiếp tục refactor CRC theo hướng workflow-driven hơn.

---

## 2. Thay đổi test đã thực hiện

### File cập nhật
- `frontend/__tests__/crc-status-v4.test.ts`

### Đã bổ sung test cho

## 2.1. Phase 2 — Transition adapter
- `resolveTransitionOptionsForRequest(...)` fallback về XML-aligned options ở dispatcher intake
- `resolveTransitionOptionsForRequest(...)` trả visible backend-provided options khi không cần legacy rewrite

## 2.2. Phase 3 — Status metadata resolver
- `resolveStatusMeta(...)` dùng fallback label cho status chưa biết
- `resolveStatusMeta('dispatched')` normalize đúng về visible intake status

## 2.3. Phase 4 — Workspace classifiers
- `classifyCreatorWorkspaceStatus(...)`
- `classifyPerformerWorkspaceStatus(...)`
- `getPerformerWorkspaceStatusPriority(...)`
- `classifyDispatcherWorkspaceRow(...)`
- `isDispatcherTeamLoadActiveStatus(...)`

## 2.4. Smoke hardening
- synthetic status `pm_missing_customer_info_review` vẫn có label đúng qua resolver metadata

---

## 3. Kết quả test

### Lệnh chạy
```bash
cd frontend && npx vitest run __tests__/crc-status-v4.test.ts
```

### Kết quả
- **1 test file passed**
- **39 tests passed**

### So với trước phase 5
- trước: **31 tests**
- sau: **39 tests**
- tăng thêm: **8 tests**

---

## 4. Ý nghĩa hardening

Sau phase 5, các phần refactor chính của CRC đã có test bao phủ rõ hơn:
- transition option adapter
- status metadata resolver
- workspace classifier helpers

Điều này giúp những phase sau an toàn hơn khi:
- thay backend metadata
- giảm tiếp legacy fallback
- tiếp tục dọn `presentation.ts`

---

## 5. Những gì chưa có test đầy đủ

Dù phase 5 đã bổ sung test tốt hơn, vẫn còn các vùng có thể mở rộng thêm sau này:
- test component-level cho modal/detail panes
- test workspace rendering end-to-end theo dataset thực
- test API contract normalization ở hooks list/detail
- test integration với workflow admin thay đổi transition thật

---

## 6. Kết luận

Phase 5 đã hoàn thành mục tiêu:
- tăng coverage cho các helper mới sinh ra từ phase 2-4
- xác nhận refactor hiện tại không làm vỡ hành vi đang có
- tạo nền an toàn hơn cho đợt refactor workflow-driven tiếp theo

Trạng thái hiện tại của CRC sau 5 phase:
- đã **giảm coupling trực tiếp** ở transition/status/workspace
- đã **gom logic cứng về các entry point rõ hơn**
- đã **có test khóa lại các lớp refactor mới**

Tuy nhiên, hệ thống vẫn chưa fully workflow-native; để đi tiếp sẽ cần thêm metadata backend và giảm dần fallback legacy ở frontend.
