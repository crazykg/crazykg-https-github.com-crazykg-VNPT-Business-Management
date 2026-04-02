---
name: basecode-dev
description: Implement từng phase của Architecture Upgrade DEV plan (Architecture_Upgrade_Plan_DEV.md). Nhận argument là phase ID (A19, P1A, P3B...) hoặc "status"/"next".
disable-model-invocation: true
---

# basecode-dev

Bạn đang xử lý lệnh `/basecode-dev $ARGUMENTS`.

---

## Bước 1 — Parse argument

1. Nếu `$ARGUMENTS` trống hoặc là `status` → thực hiện **lệnh status** (xem § Status Command).
2. Nếu `$ARGUMENTS` là `next` → thực hiện **lệnh next** (xem § Next Command).
3. Nếu `$ARGUMENTS` là phase ID hợp lệ:
   - Pre-reqs: `A19`, `A12`, `A8`, `A1`
   - Phases: `P0`, `P1A`, `P1B`, `P1C`, `P2A`, `P3A`, `P3B`, `P4A`, `P4B`
   - `P5A`, `P5B`, `P5C`, `P5D`, `P5E`
   - `P6A`, `P6B`, `P6C`
   - `P7A`, `P7B`
   - `P8A`, `P8B`, `P8C`, `P8D`, `P8E`
   → thực hiện **implement task** (xem § Implement Task).
4. Nếu argument không hợp lệ → in danh sách phases hợp lệ và dừng.

---

## § Status Command

Đọc `plan-code/Plan_basecode.md` và in bảng tóm tắt:

```
╔══════════╦═════════════════════════════════╦═══════════════╗
║ Task     ║ Mô tả                           ║ Status        ║
╠══════════╬═════════════════════════════════╬═══════════════╣
║ A19      ║ API Error Envelope              ║ DONE          ║
║ ...      ║ ...                             ║ ...           ║
╚══════════╩═════════════════════════════════╩═══════════════╝

Tasks sẵn sàng (pre-req đã DONE): P7A, P8A...
```

---

## § Next Command

1. Đọc `plan-code/Plan_basecode.md`.
2. Tìm task đầu tiên `NOT_STARTED` có tất cả pre-req `DONE`.
3. In: "Task sẵn sàng: **{TASK_ID}** — {mô tả}. Tiến hành không?"
4. Nếu user xác nhận → implement task đó.

---

## § Implement Task

### Bước 2 — Kiểm tra pre-req

Đọc `plan-code/Plan_basecode.md`. Tra bảng pre-req:

| Task | Pre-req bắt buộc |
|------|-----------------|
| A19, A12, A8, A1, P0 | — (không có) |
| P1A, P1B | — |
| P1C | A12 |
| P2A | A19, A1 |
| P3A | A8 |
| P3B | P3A |
| P4A | P3B |
| P4B | P4A |
| P5A | P2A, P3B |
| P5B | P5A |
| P5C | P5B |
| P5D | P5C |
| P5E | P5D |
| P6A | P5B |
| P6B | P6A |
| P6C | P6B |
| P7A | P1C |
| P7B | P7A |
| P8A | P6C |
| P8B | P8A |
| P8C | P8B |
| P8D | P5B |
| P8E | P8D |

Nếu pre-req chưa `DONE`:
```
❌ Không thể implement {TASK_ID}: pre-req chưa xong
   Cần: {PRE_REQ_1} ({status}), {PRE_REQ_2} ({status})
   Chạy /basecode-dev {PRE_REQ_1} trước.
```

---

### Bước 3 — Chuẩn bị

1. Update `plan-code/Plan_basecode.md`: status → `IN_PROGRESS`.
2. Tạo branch:
   ```bash
   git checkout -b upgrade/<task-id-lowercase>
   # Ví dụ: upgrade/a19, upgrade/p1a, upgrade/p3b-cache-service
   ```
3. Đọc section tương ứng trong `plan-code/Architecture_Upgrade_Plan_DEV.md`.
4. Tóm tắt cho user:
   ```
   🚀 {TASK_ID}: {mô tả}
   Branch: upgrade/{task-id}
   Files mới: ...
   Files sửa: ...
   ```

---

### Bước 4 — Implement

1. Thực hiện **đúng theo code** trong DEV plan — không thêm/bớt scope.
2. Sau mỗi sub-task: `✅ {TASK_ID}.N — {mô tả ngắn}`
3. Sau tất cả sub-task, chạy tests:
   - Backend: `cd backend && composer test`
   - Frontend: `cd frontend && npm test && npm run lint`
   - E2E (khi cần): `cd frontend && npm run test:e2e`
4. Nếu tests fail → cố fix tối đa 2 lần → nếu vẫn fail: set `BLOCKED`, ghi lỗi, dừng.

---

### Bước 5 — Hoàn tất

1. Update `plan-code/Plan_basecode.md`:
   - Checklist sub-tasks → `[x]`
   - Status → `DONE` (hoặc `BLOCKED`)
   - Notes: files đã tạo/sửa + test result
   - Thêm dòng vào `## Lịch sử cập nhật`

2. Báo cáo:
   ```
   ✅ {TASK_ID} hoàn tất!
   📁 Files mới: ...
   ✏️  Files sửa: ...
   🧪 Tests: X passed, 0 failed
   📋 Task tiếp theo: /basecode-dev next
   ```

---

## Guards bắt buộc

- **KHÔNG implement** khi pre-req chưa `DONE`.
- **KHÔNG sửa** `App.tsx`, `CustomerRequestManagementHub.tsx` nếu không phải task P6.
   Nếu buộc phải sửa → confirm với user trước.
- **KHÔNG thêm scope** ngoài DEV plan cho task đó.
- **Commit format**: `upgrade(P1A): split routes/api.php into 12 feature files`
- Nếu test fail sau 2 lần → `BLOCKED`, không tiếp tục.

---

## Tham chiếu

- **DEV plan**: `plan-code/Architecture_Upgrade_Plan_DEV.md`
- **Rà soát**: `plan-code/Architecture_Upgrade_Plan_DEV_RASOAT_2903.md`
- **Tracking**: `plan-code/Plan_basecode.md`
- **Conventions**: `CLAUDE.md`
