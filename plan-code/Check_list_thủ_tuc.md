# Check_list thủ tục — Plan tổng hợp

## Trạng thái triển khai

### ✅ HOÀN THÀNH — Cột "Từ ngày" & "Đến ngày"

| # | Hạng mục | Trạng thái |
|---|----------|-----------|
| 1 | Backend: validation + `$updateFields` trong `batchUpdateSteps()` | ✅ Done |
| 2 | Backend: `addCustomStep()` hỗ trợ `parent_step_id` | ✅ Done |
| 3 | Backend: Migration `actual_start_date` / `actual_end_date` | ✅ Done (cột đã tồn tại, migration đánh dấu ran) |
| 4 | Backend: `$casts` → `'date:Y-m-d'` (fix serialize format) | ✅ Done |
| 5 | Frontend `types.ts`: thêm 2 field vào `ProcedureStepBatchUpdate` | ✅ Done |
| 6 | Frontend `v5Api.ts`: thêm `parent_step_id` vào payload | ✅ Done |
| 7 | Frontend Modal: `computeEndDate` helper + `handleStartDateChange` | ✅ Done |
| 8 | Frontend Modal: 2 cột `<th>` + 2 `<td>` (Từ ngày / Đến ngày) | ✅ Done |
| 9 | Frontend Modal: `handleSave` gửi `actual_start_date` / `actual_end_date` | ✅ Done |
| 10 | Frontend Modal: Phase header hiển thị tổng ngày | ✅ Done |
| 11 | Frontend Modal: Mở rộng modal + table width | ✅ Done |
| 12 | Frontend Modal: Thêm bước con (state + handler + nút + form) | ✅ Done |

### Bugs đã fix
- **Serialize date** — `$casts['date']` trả về `"2025-10-10T00:00:00.000000Z"` → `<input type="date">` không parse được → đổi thành `'date:Y-m-d'` → trả đúng `"2025-10-10"`.

---

## 🔧 TỐI ƯU HIỆU NĂNG — `ProjectProcedureModal.tsx` (2573 dòng)

### Phân tích các vấn đề

**File 2573 dòng — monolithic component** chứa tất cả logic: steps, worklogs, RACI, attachments, inline editing, issues → mỗi thay đổi nhỏ (1 draft field) re-render TOÀN BỘ 2573 dòng JSX.

#### P1 — Tính toán lặp lại KHÔNG memoize (dòng 344-350)

```typescript
// Chạy lại mỗi render, mỗi khi bất kỳ state thay đổi
const totalSteps      = steps.filter((s) => !s.parent_step_id).length;            // ← filter #1
const completedSteps  = steps.filter((s) => !s.parent_step_id && ...).length;     // ← filter #2
const inProgressSteps = steps.filter((s) => !s.parent_step_id && ...).length;     // ← filter #3
const hasAnyWorklog   = steps.some((s) => (s.worklogs_count ?? 0) > 0);          // ← scan #4
```

**4 lần scan** toàn bộ `steps[]` mỗi render, phụ thuộc `steps` + `drafts` nhưng KHÔNG wrap `useMemo`.

#### P2 — Tính toán lặp trong mỗi phase header (dòng 1037-1044)

```typescript
// BÊN TRONG .map() — chạy N lần (N = số phase)
const phTotal     = group.steps.filter(s => !s.parent_step_id).length;
const phCompleted = group.steps.filter(s => !s.parent_step_id && ...).length;
const phTotalDays = group.steps.filter(s => !s.parent_step_id).reduce(...);
```

**3 lần filter** mỗi phase × mỗi render. Nếu 8 phase → 24 filter calls/render.

#### P3 — Tính toán nặng bên trong mỗi step row (dòng 1174-1186)

```typescript
// BÊN TRONG .map() — chạy M lần (M = số step)
const roleCodes     = (authUser?.roles ?? []).map(role => String(role).toUpperCase());       // ← cùng kết quả mỗi step!
const permissionCodes = new Set((authUser?.permissions ?? []).map(perm => ...));             // ← new Set mỗi step!
const isAdmin       = roleCodes.includes('ADMIN') || permissionCodes.has('*');              // ← cùng kết quả mỗi step!
const isRaciA       = raciList.some(r => String(r.user_id) === myId && r.raci_role === 'A'); // ← scan raciList mỗi step!
```

Nếu 60 steps → tạo 60 `Set`, 60 `.map()`, 60 `.some()` — **tất cả cho ra cùng kết quả** vì chúng không phụ thuộc `step`.

#### P4 — Không tách component con → không thể `React.memo` từng row

Toàn bộ `<tr>` (100+ dòng JSX mỗi step) nằm inline trong `.map()` → không thể `React.memo` → thay đổi 1 draft → **re-render TẤT CẢ rows**.

---

### Kế hoạch tối ưu

#### Bước 1 — Memoize computed values (KHÔNG thay đổi cấu trúc)

**File**: `ProjectProcedureModal.tsx` dòng 344-350

Wrap 4 computed values vào 1 `useMemo`:

```typescript
const { totalSteps, completedSteps, inProgressSteps, overallPercent, hasAnyWorklog } = useMemo(() => {
  const top = steps.filter((s) => !s.parent_step_id);
  const completed = top.filter((s) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
  const inProgress = top.filter((s) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'DANG_THUC_HIEN').length;
  return {
    totalSteps: top.length,
    completedSteps: completed,
    inProgressSteps: inProgress,
    overallPercent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
    hasAnyWorklog: steps.some((s) => (s.worklogs_count ?? 0) > 0),
  };
}, [steps, drafts]);
```

**Tác dụng**: filter `steps[]` chỉ 1 lần thay vì 4 lần/render.

#### Bước 2 — Hoist auth/permission ra ngoài `.map()` step

**File**: `ProjectProcedureModal.tsx` — thêm `useMemo` ~dòng 352

```typescript
const { myId, isAdmin, isRaciA } = useMemo(() => {
  const mid = authUser?.id != null ? String(authUser.id) : '';
  const roles = (authUser?.roles ?? []).map((r) => String(r).toUpperCase());
  const perms = new Set((authUser?.permissions ?? []).map((p) => String(p).trim()));
  return {
    myId: mid,
    isAdmin: roles.includes('ADMIN') || perms.has('*'),
    isRaciA: !!mid && raciList.some((r) => String(r.user_id) === mid && r.raci_role === 'A'),
  };
}, [authUser, raciList]);
```

Xóa 5 dòng lặp trong `.map()` step (1175-1182), thay bằng:
```typescript
const canMutate = blockingWlogCount === 0 && (isAdmin || isRaciA || (isCustom && !!myId && String(step.created_by) === myId));
```

**Tác dụng**: từ 60× `new Set()` + `.some()` → chỉ còn 1 lần.

#### Bước 3 — Memoize phaseStats để tránh filter lặp trong `.map()` phase

**File**: `ProjectProcedureModal.tsx` — thêm `useMemo` sau `phaseGroups`

```typescript
const phaseStats = useMemo(() =>
  phaseGroups.map((g) => {
    const top = g.steps.filter((s) => !s.parent_step_id);
    const completed = top.filter((s) => (drafts[s.id]?.progress_status ?? s.progress_status) === 'HOAN_THANH').length;
    return {
      phase: g.phase,
      total: top.length,
      completed,
      percent: top.length > 0 ? Math.round((completed / top.length) * 100) : 0,
      totalDays: top.reduce((sum, s) => sum + (s.duration_days || 0), 0),
      isAllDone: completed === top.length && top.length > 0,
    };
  }),
  [phaseGroups, drafts],
);
```

Trong `.map()` phase (dòng 1037), thay thế 3 filter calls bằng:
```typescript
const stat = phaseStats[gIdx];
```

**Tác dụng**: chỉ recompute khi `phaseGroups` hoặc `drafts` thực sự thay đổi.

#### Bước 4 — Extract `StepRow` component + `React.memo`

**File mới**: `frontend/components/procedure/StepRow.tsx`

```typescript
interface StepRowProps {
  step: ProjectProcedureStep;
  draft: Record<string, any>;
  isAdmin: boolean;
  isRaciA: boolean;
  myId: string;
  raciList: ProcedureRaciEntry[];
  // callbacks...
  onDraftChange: (id, field, value) => void;
  onStartDateChange: (step, date) => void;
  onDelete: (step) => void;
  onToggleWorklog: (id) => void;
  // ...other handlers
}

const StepRow = React.memo(function StepRow(props: StepRowProps) {
  // 100+ dòng JSX hiện tại từ .map() → chuyển vào đây
});
```

Trong `ProjectProcedureModal.tsx` thay thế:
```tsx
{group.steps.map((step) => (
  <StepRow
    key={step.id}
    step={step}
    draft={drafts[String(step.id)] ?? EMPTY_OBJ}
    isAdmin={isAdmin}
    isRaciA={isRaciA}
    myId={myId}
    {...callbacks}
  />
))}
```

**Tác dụng**: khi user sửa 1 step, chỉ StepRow đó re-render, 59 rows còn lại skip (nhờ `React.memo` shallow compare). **Đây là tối ưu lớn nhất.**

---

### Ưu tiên triển khai

| # | Bước | Khó | Tác động hiệu năng | Rủi ro |
|---|------|-----|---------------------|--------|
| 1 | Memoize computed (useMemo wrap) | Thấp | Trung bình | Rất thấp |
| 2 | Hoist auth/permission | Thấp | Trung bình | Rất thấp |
| 3 | Memoize phaseStats | Thấp | Trung bình | Rất thấp |
| 4 | Extract StepRow + React.memo | Cao | **Rất cao** | Trung bình (cần test kỹ) |

> **Bước 1-3 có thể làm ngay, an toàn, không thay đổi cấu trúc. Bước 4 tối ưu nhất nhưng cần refactor nhiều.**

---

## Xác minh

### Features (đã test ✅)
1. ✅ 2 cột Từ ngày / Đến ngày hiển thị đúng — tự tính khi `duration_days > 0`
2. ✅ Lưu thay đổi → persist vào DB → reload hiện đúng (format `Y-m-d`)
3. ✅ Phase header hiển thị tổng ngày
4. ✅ Thêm bước con (nút └+, form teal, API parent_step_id)

### Performance (sau tối ưu)
5. Mở modal 60+ steps → không lag khi gõ / chọn ngày
6. Thay đổi 1 draft → chỉ 1 row re-render (nếu Bước 4)
7. Chrome DevTools Profiler: render time < 16ms/frame
