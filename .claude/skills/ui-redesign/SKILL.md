---
name: ui-redesign
description: Redesign UI component/page(s) + auto-companion (modals, tabs, KPIs, master layout). Supports batch processing with comma-separated inputs. Includes mandatory responsive design check (mobile/tablet/laptop/desktop) before task completion.
disable-model-invocation: true
---

# UI Redesign Skill

You are executing `/ui-redesign $ARGUMENTS`.

Read the shared playbook at `docs/ui-redesign.md` and treat it as the single source of truth.

## Auto-companion Redesign (NEW)

When you call `/ui-redesign <url>`, the skill **automatically redesigns**:

1. **Primary component** (list, hub, dashboard)
2. **Related modals** → auto-identify from `onOpenModal()` calls or modal registry
3. **Tabs & form fields** → within the primary component
4. **Buttons** → all button styles (primary, secondary, danger) including action buttons
5. **KPI cards** → if present in component
6. **Master layout** → page wrapper, header, spacing patterns

**No need to call separately!** One URL = full page redesign.

### Auto-companion Detection Rules

**Modals:** Search for patterns in primary component:
```jsx
onOpenModal('ADD_REMINDER', ...)    → frontend/components/modals/ReminderModal.tsx (if exists)
onOpenModal('EDIT_PRODUCT', ...)    → frontend/components/modals/ProductModal.tsx
```

**Tabs:** Check component for `<input type="text" ... className=` or form field patterns

**Buttons:** Auto-detect all buttons:
```jsx
className="bg-primary ..."          → Primary CTA style
className="border border-slate-200" → Secondary button style
className="bg-error ..."            → Danger/delete style
onClick={() => onOpenModal(...)}    → Action buttons
```

**KPIs:** Auto-detect grid of cards with pattern `text-lg font-black text-deep-teal` or `text-xl font-black`

**Master layout:** Wrapper `div` with `p-*` classes + header section

### Example: Single URL, Full Redesign

```text
/ui-redesign reminders
```

Will redesign:
1. `ReminderList.tsx` ✅
2. `ReminderModal.tsx` (if linked) ✅
3. Header + search + filter tabs ✅
4. **All buttons** (add, edit, delete, filter) ✅
5. KPI cards ✅
6. Master layout wrapper ✅

Result: Entire reminder page + all modals + all buttons redesigned in one pass.

---

## Empty URL Handling + Clone UI từ chức năng hiện có

If URL/URI is **empty or not provided**:

```text
/ui-redesign
→ ❓ "Bạn có muốn clone mẫu UI từ một chức năng hiện có để tạo mới không? (Y/n)"
```

**Nếu user xác nhận (Y):**

1. Ask: **"Cung cấp URL hoặc tab key của chức năng muốn clone mẫu"**
   (ví dụ: `http://127.0.0.1:5174/reminders` hoặc `reminders`)
2. Resolve URL/tab key → đọc component gốc (primary + modals nếu có)
3. Ask: **"Tab key hoặc tên component mới?"**
   (ví dụ: `maintenance_requests` → `MaintenanceRequestList.tsx`)
4. Clone cấu trúc UI từ component gốc:
   - Giữ nguyên toàn bộ **layout pattern** (wrapper, header, KPI grid, filter bar, table)
   - Giữ nguyên **design system tokens** (màu, spacing, typography, icon style)
   - Thay **tên entity**, **cột bảng**, **KPI labels**, **icon** phù hợp với chức năng mới
   - Tạo file component mới với TypeScript types skeleton
   - Tạo modal stub nếu component gốc có modal liên kết
   - ✅ **Responsive layout** đầy đủ (§13 của playbook)

**Nếu user cung cấp URL/URI ngay (không hỏi Y/n):**

Bỏ qua bước hỏi — tự động clone mẫu UI từ URL/URI đó sang component mới.

**Ví dụ clone flow:**

```text
/ui-redesign
→ Clone từ chức năng nào? (Y/n): Y
→ URL nguồn: http://127.0.0.1:5174/reminders
→ Component mới: maintenance_requests

✅ CLONED: MaintenanceRequestList.tsx (từ ReminderList.tsx)
   • Layout: clone từ ReminderList — p-3 pb-6, header, KPI 4 cards, filter, table
   • Thay entity: Reminder → MaintenanceRequest
   • Columns: adapted (Tiêu đề, Loại, Ưu tiên, Trạng thái, Hạn xử lý)
   • Modal stub: MaintenanceRequestModal.tsx
   • Responsive: 375px ✅ | 768px ✅ | 1024px ✅ | 1440px ✅
   • TypeScript: Props + types skeleton sẵn sàng

→ Run: /ui-redesign maintenance_requests (để redesign khi đã có data)
```

**Nếu user từ chối (N):**

```text
→ ❓ "Mô tả chức năng mới bạn muốn tạo:"
```

1. Ask: **"Tên chức năng"** (e.g., "Quản lý bảo trì thiết bị")
2. Ask: **"Tab key name"** (e.g., `maintenance_requests` → `MaintenanceRequestList.tsx`)
3. Ask: **"Loại component"** (list / hub / dashboard)
4. Auto-generate component mới từ template chuẩn:
   - ✅ Full design system styling
   - ✅ Master layout pattern (p-3 pb-6)
   - ✅ Header section (icon + title + description)
   - ✅ Action buttons (primary CTA style)
   - ✅ Modal stub (if needed)
   - ✅ TypeScript types
   - ✅ Proper imports + structure
   - ✅ **Responsive layout** (mobile/tablet/laptop/desktop — §13 of playbook)

---

## Batch Processing

`$ARGUMENTS` can be:
- **Single target:** `/ui-redesign http://127.0.0.1:5174/reminders`
- **Multiple targets (comma-separated):** `/ui-redesign reminders, products, contracts`
- **Mixed formats:** `/ui-redesign http://127.0.0.1:5174/reminders, fee_collection, contracts`

For batch input (comma-separated), process each target sequentially with auto-companion:

1. Split by `, ` (comma + space) → list of targets
2. For each target, auto-detect + redesign (primary + modals + tabs + KPIs + layout)
3. Accumulate files changed, deltas, responsive check result, and lint result
4. Return combined report at the end

---

## Single Target Workflow

For each target:

1. **Resolve** `target` to primary file using playbook rules
2. **Hỏi xác nhận Dashboard** — TRƯỚC KHI đi vào các bước tiếp theo:

   ```text
   ❓ "Bạn có muốn tạo Dashboard với KPI cards cho trang này không? (Y/n)"
   ```

   - **Y (Có)** → Tiếp tục workflow với **Dashboard mode**: bao gồm KPI grid (4 cards), summary header, chart/metric section nếu phù hợp. Auto-detect hoặc generate KPI cards dựa trên entity của trang.
   - **N (Không)** → Tiếp tục workflow với **Template mode**: chỉ áp dụng design system token, không gen thêm dashboard hay KPI cards.

3. **Auto-detect companions** (modals, tabs, KPIs, master layout)
4. **Build delta checklist** for all files
5. **Rewrite JSX** `return (...)` block + file-level style constants
6. **Keep unchanged:** imports, hooks, state, handlers, types, business logic
7. **Run responsive self-check** against §13 of playbook (REQUIRED — task cannot complete without pass)
8. **Run lint once** after all files are changed
9. **Report** files changed, applied deltas, responsive test result, lint result

### Responsive test (step 7) — mandatory checklist

Before reporting, verify every item below. If any fails, fix the JSX then re-check:

```text
[ ] 375px  (mobile)  — KPI 2-col, filter stacked, table scrolls, modal not clipped, font 14px base
[ ] 768px  (tablet)  — KPI 2-col, filter visible, header row wraps, font 14px base
[ ] 1024px (laptop)  — layout starts expanding, filter side-by-side, font 15px base
[ ] 1440px (desktop) — 4-col KPI (if xl:grid-cols-4), full table, font 16px base
[ ] Font   — NO font-family inline; NO rem hardcoded as px; icons use style={{ fontSize: N }}
```

Responsive rules summary (full spec in §13 of docs/ui-redesign.md):
- Wrapper: `p-3 pb-6` (no responsive override)
- KPI grid: `grid-cols-2 xl:grid-cols-4 gap-3`
- Filter row: `grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px]`
- Table: `overflow-x-auto` + `min-w-[700px]` on table element
- Action column: `sticky right-0 bg-white`
- Modal body two-col form: `grid-cols-1 lg:grid-cols-2`
- Header row: `flex-col sm:flex-row sm:items-center sm:justify-between`
- CTA button: `w-full sm:w-auto` (full-width on mobile)

Shared repo entry points:
- `docs/ui-redesign.md`
- `.claude/skills/ui-redesign/SKILL.md`

---

## Batch Report Format

After processing all targets with auto-companion:

```text
✅ BATCH REDESIGN REPORT (Auto-companion Mode)

Targets processed: 3
────────────────────────

[Target 1: reminders]
Primary: ReminderList.tsx ✅
Modals: ReminderModal.tsx ✅
Tabs/KPIs: Header, search, filter ✅
Layout: Master wrapper ✅
Files changed: 2, Deltas: 28
Responsive: 375px ✅ | 768px ✅ | 1024px ✅ | 1440px ✅
Lint: ✅

[Target 2: products]
Primary: ProductList.tsx ✅
Modals: ProductModal.tsx, ProductBulkModal.tsx ✅
Tabs: Filter bar, search ✅
KPIs: 4 cards ✅
Layout: Master wrapper ✅
Files changed: 3, Deltas: 35
Responsive: 375px ✅ | 768px ✅ | 1024px ✅ | 1440px ✅
Lint: ✅

[Target 3: contracts]
Primary: ContractList.tsx ✅
Modals: ContractModal.tsx ✅
Tabs: Search, filter tabs ✅
KPIs: Dashboard cards ✅
Layout: Master wrapper ✅
Files changed: 2, Deltas: 32
Responsive: 375px ✅ | 768px ✅ | 1024px ✅ | 1440px ✅
Lint: ✅

────────────────────────
Total files changed: 7
Total deltas applied: 95
Responsive: ✅ Pass (all breakpoints)
Lint: ✅ Pass
────────────────────────
```
