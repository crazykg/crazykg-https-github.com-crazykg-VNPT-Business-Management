# Step-level RACI v3 — Avatar column + Matrix overlay + Copy RACI

## Bối cảnh

Hiện tại RACI chỉ ở cấp **thủ tục** (procedure-level): tab RACI hiển thị danh sách thành viên với vai trò R/A/C/I cho toàn bộ thủ tục. Cần bổ sung RACI ở cấp **từng bước** (step-level) để phân công ai phụ trách bước nào cụ thể.

**Nguồn dữ liệu thành viên:** Lấy từ `raciList` đã load sẵn (procedure-level RACI) — KHÔNG cần tìm kiếm user mới. User chỉ chọn từ danh sách thành viên đã được phân công ở tab RACI.

**Ràng buộc A (Accountable):** Mỗi bước tối đa 1 người giữ vai trò A. Gán A mới sẽ tự thay A cũ. R/C/I vẫn multi-select.

---

## Hiện trạng

| Cấp | Bảng DB | Trạng thái |
|-----|---------|------------|
| Procedure-level | `project_procedure_raci` | Đã có |
| **Step-level** | **Chưa có** | **Cần tạo mới** |

`raciList` được load song song với `steps` ngay khi mở modal (dòng 326-334 `ProjectProcedureModal.tsx`), nên dữ liệu thành viên luôn sẵn sàng.

---

## Thiết kế UX — 3 lớp tương tác

| Lớp | Công cụ | Mục đích | Tốc độ |
|-----|---------|----------|--------|
| 1 | **Cột avatar A** (trong bảng chính) | Gán nhanh Accountable — thao tác hàng ngày | 2 click/bước |
| 2 | **Matrix overlay** (nút "Phân công" ở phase header) | Gán đầy đủ R/A/C/I — phân công lần đầu hoặc chỉnh sửa | 1 click/ô |
| 3 | **Copy RACI** (nút 📋 trong matrix) | Sao chép RACI từ 1 bước sang nhiều bước | 1 click sao chép tất cả |

**Luồng phân công nhanh nhất:**
```
Bước 1: Mở matrix → gán R/A/C/I cho bước đầu tiên (4 click)
Bước 2: Click 📋 → chọn "Áp dụng cho tất cả" (2 click)
Bước 3: Chỉnh bước nào khác trong matrix (vài click)
→ Tổng: ~10 click cho 8 bước thay vì 32 click
```

---

## Các file cần sửa/tạo

| # | File | Thay đổi |
|---|------|----------|
| 1 | `backend/database/migrations/2026_03_19_*` | **TẠO MỚI** — migration bảng `project_procedure_step_raci` |
| 2 | `backend/app/Models/ProjectProcedureStepRaci.php` | **TẠO MỚI** — Eloquent model |
| 3 | `backend/app/Http/Controllers/Api/V5/ProjectProcedureController.php` | Thêm 4 method + sửa `removeRaci()` cascade |
| 4 | `backend/routes/api.php` | Thêm 4 routes |
| 5 | `frontend/types.ts` | Thêm interface `ProcedureStepRaciEntry` |
| 6 | `frontend/services/v5Api.ts` | Thêm 3 API functions |
| 7 | `frontend/components/procedure/StepRow.tsx` | Thêm cột avatar A + micro-dropdown |
| 8 | `frontend/components/procedure/RaciMatrixPanel.tsx` | **TẠO MỚI** — Matrix overlay + Copy RACI |
| 9 | `frontend/components/ProjectProcedureModal.tsx` | Thêm state, load data, handlers, truyền props, render matrix |

---

## Chi tiết triển khai

### 1. Backend — Migration

Tạo file `backend/database/migrations/2026_03_19_100000_create_project_procedure_step_raci_table.php`

**Schema bảng `project_procedure_step_raci`:**

| Cột | Type | Ràng buộc |
|-----|------|-----------|
| id | BIGINT | PK auto-increment |
| step_id | BIGINT UNSIGNED | FK → `project_procedure_steps.id` ON DELETE CASCADE |
| user_id | BIGINT UNSIGNED | indexed |
| raci_role | ENUM('R','A','C','I') | NOT NULL |
| created_by | BIGINT UNSIGNED | nullable |
| created_at / updated_at | TIMESTAMP | |

**Unique constraint:** `(step_id, user_id, raci_role)` — 1 user chỉ giữ 1 role/step.

**Index:** `step_id` (lookup theo step).

Tham khảo cấu trúc migration `project_procedure_raci` (file `2026_03_14_200000_create_procedure_worklogs_and_raci.php` dòng 38-53) để giữ style nhất quán.

---

### 2. Backend — Model

Tạo `backend/app/Models/ProjectProcedureStepRaci.php`:

- `$table = 'project_procedure_step_raci'`
- `$fillable = ['step_id', 'user_id', 'raci_role', 'created_by']`
- Relationships: `step()` → BelongsTo `ProjectProcedureStep`, `user()` → BelongsTo `InternalUser`
- Tham khảo `ProjectProcedureRaci.php` (30 dòng) để giữ style nhất quán.

---

### 3. Backend — Controller methods

Thêm vào `ProjectProcedureController.php`:

**3a. `getStepRaciBulk(Request $request, int $procedureId)`**
- Load tất cả step RACI của toàn bộ procedure trong 1 query: `ProjectProcedureStepRaci::whereIn('step_id', $stepIds)->get()` kèm join user info (`full_name`, `user_code`, `username`)
- Return grouped by step_id
- Tham khảo `getRaci()` (dòng 1380-1406) để copy pattern join user

**3b. `setStepRaci(Request $request, int $stepId)`**
- Validate: `user_id` required integer, `raci_role` required in R/A/C/I
- `user_id` phải tồn tại trong `project_procedure_raci` của procedure chứa step (chỉ cho phép chọn thành viên đã phân công ở procedure-level). Trả 422 nếu không.
- **Đặc biệt role A:** Chạy trong transaction — xoá mọi entry có `raci_role = 'A'` của step_id đó trước khi gán A mới. Đảm bảo tối đa 1 A per step.
- R/C/I: dùng `updateOrCreate` giống `addRaci()` (dòng 1411-1462)
- Return entry mới kèm user info

**3c. `removeStepRaci(Request $request, int $raciId)`**
- Tìm `ProjectProcedureStepRaci` → resolve quyền → delete
- Tham khảo `removeRaci()` (dòng 1467-1475)

**3d. `batchSetStepRaci(Request $request, int $procedureId)`** *(cho Copy RACI)*
- Validate: `assignments` array, mỗi phần tử có `step_id`, `user_id`, `raci_role`
- Validate tất cả `step_id` thuộc procedure, tất cả `user_id` thuộc procedure-level RACI
- Hỗ trợ `mode`: `'overwrite'` (xoá cũ, gán mới) hoặc `'merge'` (giữ cũ, thêm mới)
- Xử lý trong 1 transaction
- **Rule A:** Nếu 1 step có nhiều A trong batch → chỉ giữ A cuối cùng
- Return tất cả step RACI entries sau khi batch xong (giống `getStepRaciBulk`)

**3e. Sửa `removeRaci()` (dòng 1467-1475) — Cascade step RACI**
- Khi xoá 1 thành viên khỏi procedure-level RACI, xoá luôn tất cả step RACI của thành viên đó trong cùng procedure:
```
ProjectProcedureStepRaci::whereIn('step_id', $stepIdsOfProcedure)
    ->where('user_id', $removedUserId)
    ->delete();
```

---

### 4. Backend — Routes

Thêm vào group routes đã có:

```
GET    /project-procedures/{procedureId}/step-raci        → getStepRaciBulk   [projects.read]
POST   /project-procedure-steps/{stepId}/raci             → setStepRaci       [projects.write]
DELETE /project-procedure-step-raci/{raciId}              → removeStepRaci    [projects.delete]
POST   /project-procedures/{procedureId}/step-raci/batch  → batchSetStepRaci  [projects.write]
```

---

### 5. Frontend — Types (`types.ts`)

Thêm interface (gần `ProcedureRaciEntry` dòng ~1477):

```typescript
export interface ProcedureStepRaciEntry {
  id: string | number;
  step_id: string | number;
  user_id: string | number;
  raci_role: ProcedureRaciRole;   // tái dùng type đã có
  full_name?: string | null;
  user_code?: string | null;
  username?: string | null;
  created_at?: string | null;
}
```

---

### 6. Frontend — API functions (`v5Api.ts`)

Thêm 4 functions (gần `fetchProcedureRaci` dòng ~2907):

- `fetchStepRaciBulk(procedureId)` → GET `/project-procedures/{id}/step-raci` → return `ProcedureStepRaciEntry[]`
- `addStepRaci(stepId, { user_id, raci_role })` → POST → return `ProcedureStepRaciEntry`
- `removeStepRaci(raciId)` → DELETE
- `batchSetStepRaci(procedureId, { assignments, mode })` → POST `.../step-raci/batch` → return `ProcedureStepRaciEntry[]`

Tham khảo pattern `fetchProcedureRaci`, `addProcedureRaci`, `removeProcedureRaci` (dòng 2907-2940).

---

### 7. Frontend — Modal state & data loading (`ProjectProcedureModal.tsx`)

**7a. Thêm state** (gần dòng 228, sau `raciList`):

```typescript
const [stepRaciMap, setStepRaciMap] = useState<Record<string, ProcedureStepRaciEntry[]>>({});
const [raciMatrixPhase, setRaciMatrixPhase] = useState<string | null>(null);  // phase đang mở matrix
```

**7b. Load song song khi mở modal** (dòng 327-334):

Thêm `fetchStepRaciBulk(activeProcedure.id)` vào `Promise.all` đã có. Sau đó group kết quả theo step_id → set vào `stepRaciMap`.

**7c. Handler `handleAssignA`** *(cho avatar column — single-select A)*:
- Nếu user đang là A → gọi `removeStepRaci` (toggle off)
- Nếu user chưa là A → gọi `addStepRaci(stepId, { user_id, raci_role: 'A' })`
- Optimistic update `stepRaciMap`: lọc bỏ A cũ của step, thêm A mới
- Backend tự xoá A cũ trong transaction

**7d. Handler `handleToggleStepRaci`** *(cho matrix — toggle R/C/I hoặc A)*:
- Nếu role đã gán → gọi `removeStepRaci(entryId)`
- Nếu chưa gán → gọi `addStepRaci(stepId, { user_id, raci_role })`
- Nếu role = A: optimistic lọc bỏ A cũ trước khi thêm A mới
- Optimistic update `stepRaciMap`

**7e. Handler `handleCopyStepRaci`** *(cho Copy RACI)*:
- Params: `sourceStepId`, `targetStepIds[]`, `mode: 'overwrite' | 'merge'`
- Lấy entries của source step từ `stepRaciMap`
- Build `assignments[]` = cross product (targetStepIds × sourceEntries)
- Gọi `batchSetStepRaci(procedureId, { assignments, mode })`
- Response trả về toàn bộ step RACI → replace `stepRaciMap` luôn (không cần merge phức tạp)

**7f. Truyền props xuống StepRow & RaciMatrixPanel:**

StepRow:
```
stepRaciEntries={stepRaciMap[String(step.id)] ?? []}
raciMembers={raciList}
onAssignA={handleAssignA}
```

RaciMatrixPanel (render khi `raciMatrixPhase !== null`):
```
phase={raciMatrixPhase}
steps={stepsInPhase}           // bước cha, đã sort
raciMembers={raciList}
stepRaciMap={stepRaciMap}
onToggle={handleToggleStepRaci}
onCopy={handleCopyStepRaci}
onClose={() => setRaciMatrixPhase(null)}
```

---

### 8. Frontend — Cột avatar A trong bảng chính (`StepRow.tsx`)

**8a. Thêm `<th>` trong `ProjectProcedureModal.tsx`** (sau cột "TT", trước "Trình tự công việc"):

```html
<th className="px-1 py-2 text-[10px] font-bold text-slate-400 uppercase w-[40px] text-center">A</th>
```

**8b. Thêm props vào `StepRowProps`:**

```typescript
stepRaciEntries: ProcedureStepRaciEntry[];
raciMembers: ProcedureRaciEntry[];
onAssignA: (stepId: string | number, userId: string | number) => void;
```

**8c. Thêm `<td>` trong StepRow** (sau cột TT, trước Tên bước):

Chỉ hiện cho bước cha (`!isChild`). Bước con: `<td />` rỗng.

**Hiển thị:**
- **Chưa có A:** Vòng tròn trống, border-dashed slate-300, 28×28px. Hover → border-amber-400, cursor-pointer, tooltip "Chọn người chịu trách nhiệm".
- **Đã có A:** Avatar tròn 28×28px, bg-amber-100, text-amber-700, hiện initials (chữ cái đầu tên). Tooltip: full_name.

**Click → micro-dropdown:**
```
┌─────────────────────┐
│ ● Phan Vĩnh Rạng  ✓│  ← đang chọn (bg-amber-50)
│ ○ Hà Quang Tuấn     │
│ ○ Nguyễn Thanh Lâm  │
│ ─────────────────── │
│ ✕ Bỏ chọn           │  ← chỉ hiện khi đang có A
└─────────────────────┘
```

- Danh sách lấy từ `raciMembers` (unique by user_id)
- Click tên → `onAssignA(step.id, userId)` → dropdown đóng
- Click "Bỏ chọn" → `onAssignA(step.id, currentAUserId)` (toggle off) → dropdown đóng
- Click ngoài → đóng
- Mỗi member hiện: avatar initials nhỏ (20px) + full_name
- Member đang là A → highlight bg-amber-50, icon ✓

**8d. Ẩn khi đang edit inline** (`isEditing = true`): hiện `<td />` rỗng.

**8e. Cập nhật colSpan:** Thêm 1 cột → tất cả `colSpan` trong StepRow và Modal phải +1. Rà soát kỹ tất cả expanded panels (worklog, attachment, add-child, empty state...).

---

### 9. Frontend — `RaciMatrixPanel.tsx` (TẠO MỚI)

Component overlay hiển thị matrix RACI cho 1 giai đoạn.

**9a. Props:**

```typescript
interface RaciMatrixPanelProps {
  phase: string;
  phaseLabel: string;
  steps: ProjectProcedureStep[];          // bước cha, sorted
  raciMembers: ProcedureRaciEntry[];      // procedure-level RACI (unique users)
  stepRaciMap: Record<string, ProcedureStepRaciEntry[]>;
  onToggle: (stepId: string | number, userId: string | number, role: ProcedureRaciRole) => void;
  onCopy: (sourceStepId: string | number, targetStepIds: (string | number)[], mode: 'overwrite' | 'merge') => void;
  onClose: () => void;
}
```

**9b. Layout — Overlay modal:**

```
┌─── Phân công RACI — {phaseLabel} ──────────────────────── [✕ Đóng] ────┐
│                                                                          │
│                        Hà Quang Tuấn    Phan Vĩnh Rạng   Nguyễn T.Lâm  │
│  Bước                     (HQT)            (PVR)            (NTL)       │
│  ─────────────────────────────────────────────────────────────────────   │
│  1. Kiểm tra hồ sơ    [A] [R] [C] [I]  [A] [R] [C] [I]  [A][R][C][I]  📋│
│  2. Lập phương án      [·] [·] [·] [·]  [·] [·] [·] [·]  [·][·][·][·]  📋│
│  3. Trình phê duyệt   [·] [·] [·] [·]  [·] [·] [·] [·]  [·][·][·][·]  📋│
│  4. Ký hợp đồng       [·] [·] [·] [·]  [·] [·] [·] [·]  [·][·][·][·]  📋│
│  5. Nghiệm thu         [·] [·] [·] [·]  [·] [·] [·] [·]  [·][·][·][·]  📋│
│                                                                          │
│  📋 = nút Sao chép (hiện khi dòng có ít nhất 1 role đã gán)            │
│                                                                          │
│  Chú thích:                                                             │
│  [A] amber  [R] red  [C] blue  [I] slate  [·] chưa gán (border-dashed) │
│  Click ô chưa gán → gán. Click ô đã gán → bỏ gán.                     │
│  Mỗi dòng tối đa 1 [A] — gán A mới sẽ tự thay A cũ.                   │
│                                                                          │
│                                                          [Đóng]         │
└──────────────────────────────────────────────────────────────────────────┘
```

**9c. Mỗi ô (cell) trong matrix:**

Mỗi member × mỗi step = 4 nút nhỏ (A, R, C, I):
- **Chưa gán `[·]`:** border-dashed, bg-white, text-slate-300. Hover → border-solid, bg tương ứng mờ.
- **Đã gán `[A]`/`[R]`/`[C]`/`[I]`:** bg filled, text đậm, border-solid.
- Click → `onToggle(stepId, userId, role)`
- Nếu click A mà step đã có A khác → A cũ tự mất (optimistic update ở parent)

**Màu role:**
- A = `bg-amber-100 text-amber-700 border-amber-300`
- R = `bg-red-100 text-red-700 border-red-300`
- C = `bg-blue-100 text-blue-700 border-blue-300`
- I = `bg-slate-100 text-slate-600 border-slate-300`
- `[·]` = `border-dashed border-slate-200 text-slate-300`

**9d. Nút 📋 Sao chép — mỗi dòng:**

Chỉ hiện khi dòng đó có ít nhất 1 role đã gán. Click → mở popover:

```
┌──────────────────────────────────────────┐
│ Sao chép RACI của bước 1                 │
│                                          │
│  ☑ 2. Lập phương án kỹ thuật            │
│  ☑ 3. Trình phê duyệt                  │
│  ☑ 4. Ký hợp đồng                      │
│  ☑ 5. Nghiệm thu                        │
│                                          │
│  [✓ Chọn tất cả]  [Bỏ chọn tất cả]     │
│                                          │
│  Chế độ:                                 │
│  ● Ghi đè (xoá RACI cũ, gán mới)       │
│  ○ Gộp thêm (giữ cũ, thêm thiếu)       │
│                                          │
│      [Huỷ]   [Áp dụng cho N bước]       │
└──────────────────────────────────────────┘
```

**Luồng:**
1. Mặc định: tất cả bước còn lại được chọn, mode = "Ghi đè"
2. User có thể bỏ chọn bước không muốn copy
3. Click "Áp dụng" → gọi `onCopy(sourceStepId, selectedStepIds, mode)`
4. Matrix cập nhật tức thì (optimistic) + flash animation (bg-amber-50 fade) ở các dòng vừa copy
5. Popover tự đóng

**9e. Nút mở matrix — ở phase header (`ProjectProcedureModal.tsx`):**

Thêm nút "Phân công" bên cạnh nút "Thêm bước" ở phase header (dòng ~1210):

```html
<button
  onClick={() => setRaciMatrixPhase(isMatrixOpen ? null : group.phase)}
  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-600 bg-white border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors"
>
  <span className="material-symbols-outlined text-sm">group</span>
  Phân công
</button>
```

**9f. Render matrix — overlay trong Modal:**

Render `<RaciMatrixPanel>` như một overlay panel ngay trên bảng steps, bên trong cùng scroll container. Dùng `position: sticky` hoặc fixed overlay với backdrop mờ.

```
{raciMatrixPhase && (
  <RaciMatrixPanel
    phase={raciMatrixPhase}
    phaseLabel={...}
    steps={stepsInPhase}
    raciMembers={raciList}
    stepRaciMap={stepRaciMap}
    onToggle={handleToggleStepRaci}
    onCopy={handleCopyStepRaci}
    onClose={() => setRaciMatrixPhase(null)}
  />
)}
```

**9g. Overflow khi nhiều member:**

Nếu `raciMembers` > 5 người → bảng matrix cuộn ngang (overflow-x-auto). Header member sticky.

---

## Lưu ý quan trọng

- **Không tạo user search mới** — chỉ chọn từ `raciMembers` (procedure-level RACI đã load sẵn).
- **Validation backend**: `user_id` trong `setStepRaci`/`batchSetStepRaci` phải tồn tại trong `project_procedure_raci` của procedure chứa step. Trả 422 nếu không.
- **A single-select:** Backend enforce trong transaction (xoá A cũ trước khi gán A mới). Frontend optimistic update cùng logic.
- **Cascade delete procedure RACI → step RACI**: Khi xoá 1 thành viên khỏi tab RACI (procedure-level), controller `removeRaci()` (dòng 1467) phải xoá luôn tất cả step RACI của user đó trong procedure.
- **Icon style**: dùng `material-symbols-outlined`, không dùng emoji.
- **Performance**: bulk load (`getStepRaciBulk`) 1 request khi mở modal. Copy RACI dùng `batchSetStepRaci` 1 request. Không N+1.
- Chạy `php artisan migrate` sau khi tạo migration.
- Chạy `npx tsc --noEmit` sau khi xong frontend, đảm bảo 0 lỗi.

---

## Xác minh sau triển khai

### Cột avatar A (bảng chính)
1. Bước chưa có A → hiện ○ trống, click → dropdown hiện 3 member
2. Click chọn PVR → avatar `(PV)` amber hiện ngay, dropdown đóng
3. Click avatar đang hiện → dropdown mở, PVR có ✓, click HQT → A chuyển sang HQT
4. Click "Bỏ chọn" → avatar biến mất, thành ○ trống
5. Bước con → `<td>` rỗng, không hiện avatar

### Matrix overlay
6. Click "Phân công" ở phase header → matrix overlay mở, hiện đúng steps × members
7. Click ô `[·]` → gán role, ô chuyển sang filled
8. Click ô đã gán → bỏ gán, ô chuyển lại `[·]`
9. Gán A cho HQT ở bước 1, rồi gán A cho PVR cùng bước → HQT mất A, PVR có A
10. Đóng matrix → cột avatar A trong bảng chính cập nhật đúng

### Copy RACI
11. Bước 1 có A:HQT, R:PVR, C:NTL → click 📋 → popover hiện 4 bước còn lại
12. Chọn tất cả, mode "Ghi đè" → click "Áp dụng cho 4 bước" → 4 dòng flash + hiện đúng RACI
13. Chỉnh bước 3: đổi A sang PVR → chỉ bước 3 thay đổi, các bước khác giữ nguyên
14. Mode "Gộp thêm": bước 2 đã có I:NTL, copy bước 1 mode "Gộp" → bước 2 giờ có cả I:NTL lẫn A:HQT, R:PVR, C:NTL

### Cascade & edge case
15. Tab RACI xoá PVR → tất cả step RACI của PVR bị xoá, avatar column + matrix cập nhật
16. Reload modal → dữ liệu hiển thị đúng (bulk load)
17. Modal không có thành viên RACI → avatar column hiện ○ disabled, matrix hiện text "Vui lòng thêm thành viên ở tab RACI trước"
