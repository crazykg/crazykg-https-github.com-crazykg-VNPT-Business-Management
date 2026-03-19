# Ẩn cột "Số văn bản" & "Ngày VB" — thay bằng badge Tài liệu + form trong Worklog panel

## Bối cảnh

Bảng thủ tục hiện có 2 cột riêng biệt **Số văn bản** và **Ngày VB** chiếm ~235px trên mỗi dòng.
Yêu cầu: **ẩn 2 cột này khỏi bảng chính**, thay bằng một badge nhỏ gọn trong bảng, và khi người dùng **mở Worklog panel** của bước thì thấy form nhập/sửa đầy đủ ở đó.

Luồng lưu `document_number` / `document_date` đã có sẵn ở `ProjectProcedureModal.tsx` (handleSave → batch) và backend `ProjectProcedureController.php` (batchUpdateSteps) cũng đã support. Scope thay đổi chỉ là **frontend-only**.

---

## Hiện trạng bảng — 14 cột

| # | Cột | `<th>` dòng | Ghi chú |
|---|------|------------|---------|
| 1 | ▲/▼ reorder | 1223 | |
| 2 | TT | 1224 | |
| 3 | Trình tự công việc | 1225 | |
| 4 | ĐV chủ trì | 1226 | |
| 5 | Kết quả dự kiến | 1227 | |
| 6 | Ngày | 1228 | |
| 7 | Từ ngày | 1229 | |
| 8 | Đến ngày | 1230 | |
| 9 | Tiến độ | 1231 | |
| 10 | **Số văn bản** | 1232 | **XOÁ** |
| 11 | **Ngày VB** | 1233 | **XOÁ** |
| 12 | Worklog | 1234 | |
| 13 | File đính kèm | 1240 | |
| 14 | Actions | 1246 | |

Sau khi xoá 2 cột (10, 11) + thêm 1 cột badge Tài liệu → **13 cột mới**.

---

## Các file cần sửa

| # | File | Thay đổi |
|---|------|----------|
| 1 | `frontend/components/procedure/StepRow.tsx` | Xoá 2 `<td>` Số VB + Ngày VB; thêm `<td>` badge Tài liệu; bổ sung section văn bản trong Worklog panel; sửa tất cả `colSpan` |
| 2 | `frontend/components/ProjectProcedureModal.tsx` | Xoá 2 `<th>` + thêm 1 `<th>` badge; thu hẹp min-w/max-w; sửa tất cả `colSpan` trong file |

---

## Chi tiết yêu cầu

### 1. Xoá 2 cột cũ + thêm 1 cột header badge trong `<thead>` (ProjectProcedureModal.tsx)

Tìm và **xoá** 2 thẻ `<th>` có nội dung **"Số văn bản"** (dòng 1232) và **"Ngày VB"** (dòng 1233).

**Thêm** 1 `<th>` mới ở đúng vị trí đó (sau Tiến độ, trước Worklog):
```html
<th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-[100px]">Tài liệu</th>
```

Thu hẹp kích thước:
- `min-w-[1360px]` → `min-w-[1140px]`
- `max-w-[1820px]` → `max-w-[1600px]`

---

### 2. Trong `StepRow.tsx` — Xoá 2 `<td>` cũ, thêm `<td>` badge Tài liệu

**Xoá** 2 `<td>` có comment `{/* Số văn bản */}` (dòng ~367) và `{/* Ngày VB */}` (dòng ~378).

**Thêm** 1 `<td>` mới thay thế (đặt ở đúng vị trí cũ, giữa cột Tiến độ và cột Worklog), hiển thị badge trạng thái văn bản.

**Quan trọng — Draft-first binding:** Badge phải đọc giá trị draft trước, step sau:
```
const docNum  = draft.document_number ?? step.document_number ?? '';
const docDate = draft.document_date   ?? step.document_date   ?? '';
const hasDoc  = !!docNum;
```
Mẫu bind đúng đã có sẵn ở dòng ~371 hiện tại (`draft.document_number ?? step.document_number ?? ''`). Dùng pattern tương tự.

**Hiển thị badge:**
- **Chưa có văn bản** (`hasDoc = false`): hiện badge mờ nhỏ (nền slate-100, chữ slate-400)
- **Đã có văn bản** (`hasDoc = true`): hiện badge emerald (nền emerald-50, chữ emerald-700, border emerald-200), text truncate ~12 ký tự
- Badge **không click** — chỉ trạng thái hiển thị. Để nhập/sửa → user mở Worklog panel.
- Badge có `title` tooltip: `Số VB: {docNum} · Ngày: {docDate}` (hoặc "Chưa có văn bản" nếu rỗng).

**Icon dùng `material-symbols-outlined`** — KHÔNG dùng emoji. Style nhất quán với các icon khác trong bảng (ví dụ `history`, `attach_file`). Dùng icon `description` cho tài liệu:
```
Chưa có:  [description Thêm VB]              (slate-100, slate-400)
Đã có:    [description QĐ-123/2025 check]    (emerald-50, emerald-700, border emerald-200)
```

---

### 3. Trong `StepRow.tsx` — Bổ sung section văn bản vào Worklog panel

Bên trong `{isWlogOpen && ...}` (Worklog expanded panel, dòng ~456), **thêm một section nhỏ ở đầu panel**, phía trên form nhập worklog hiện tại. Section này chứa form nhập Số VB + Ngày VB.

**Layout section văn bản:**
```
┌── [description] Thông tin văn bản ─────────────────────┐
│  Số văn bản: [________________]  Ngày VB: [__/__/____] │
└────────────────────────────────────────────────────────┘
```

- Tiêu đề nhỏ dùng icon `description` (material-symbols-outlined) + text "Thông tin văn bản" (text-xs, slate-500). **KHÔNG dùng emoji**.
- Input **Số văn bản**: `type="text"`, bind `draft.document_number ?? step.document_number ?? ''`, onChange → `onDraftChange(step.id, 'document_number', value || null)`.
- Input **Ngày VB**: `type="date"`, bind `draft.document_date ?? step.document_date ?? ''`, onChange → `onDraftChange(step.id, 'document_date', value || null)`.
- Style nhất quán với các input trong bảng (border slate-200, rounded, text-xs, focus:border-deep-teal).
- Đặt trong `div` nền trắng, border violet-100, rounded-xl, padding 2.5, giống phần form worklog bên dưới.

**autoFocus:** Input worklog hiện đang có `autoFocus` ở dòng ~463. Sau khi thêm section văn bản phía trên, **bỏ `autoFocus` khỏi input worklog** — không chuyển sang input văn bản, để user tự chọn.

---

### 4. Sửa tất cả `colSpan` cho đúng 13 cột mới

Bảng mới có **13 cột**. Cần rà soát và sửa **tất cả** `colSpan` trong cả 2 file:

**`StepRow.tsx`:**

| Vị trí | colSpan hiện tại | colSpan mới | Ghi chú |
|--------|-----------------|-------------|---------|
| Worklog panel (dòng ~458) | `11` | `13` | Span toàn bộ |
| Attachment panel (dòng ~657) | `11` | `13` | Span toàn bộ |
| Add-child row: các cột cuối (dòng ~713) | `8` | `7` | Sau cột Ngày, span hết phần còn lại (13 - 6 cột đầu = 7) |

**`ProjectProcedureModal.tsx`:**

| Vị trí | colSpan hiện tại | colSpan mới | Ghi chú |
|--------|-----------------|-------------|---------|
| Inline add-step row (dòng ~1381) | `5` | Tính lại theo số cột thừa sau các input | |
| Empty state row (dòng ~1406) | `11` | `13` | Span toàn bộ |

---

### 5. Lưu ý quan trọng

- **Không thay đổi** logic backend, API, types — chỉ thay đổi UI.
- **Không thêm state mới** vào Modal hay StepRow — tái dùng `onDraftChange` đã có.
- **Draft-first**: cả badge lẫn form trong Worklog panel đều đọc `draft.xxx ?? step.xxx`, để khi user sửa chưa lưu thì badge cập nhật ngay lập tức.
- **Icon style**: toàn bộ dùng `material-symbols-outlined` (class `material-symbols-outlined`), KHÔNG dùng emoji literal. Icon tài liệu = `description`, icon check = `check`.
- Chạy `npx tsc --noEmit` sau khi xong, đảm bảo 0 lỗi TypeScript.

---

## Xác minh sau triển khai

1. Bảng gọn hơn ~135px (bỏ 235px, thêm ~100px badge), không còn 2 cột input lộ ra.
2. Nhìn vào badge biết ngay bước nào đã có/chưa có văn bản.
3. Sửa Số VB trong Worklog panel → badge **cập nhật ngay** (draft-first) mà chưa cần bấm Lưu.
4. Bấm "Lưu thay đổi" (batch update) → dữ liệu lưu đúng qua API.
5. Đóng modal, mở lại → dữ liệu hiển thị đúng giá trị đã lưu.
6. Mở Worklog panel → con trỏ **KHÔNG** tự nhảy vào input nào.
7. Tất cả expanded panel (worklog, attachment, add-child, empty state, inline add-step) **không bị lệch** colSpan.
