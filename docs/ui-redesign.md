# UI Redesign Playbook

This document is the shared source of truth for the VNPT Business Management UI redesign workflow.

Use it when an AI model needs to redesign a React/TypeScript page or component so it matches the project's design system without changing business logic.

This file is intentionally model-agnostic:
- Claude can wrap it in a slash-command skill
- Codex or Cursor can read it directly from the repo
- ChatGPT, Gemini, or any other assistant can follow it as a pasted prompt or attached repo document

## Universal Prompt Template

Use this template with any AI model:

```text
Use /docs/ui-redesign.md as the operating spec.

Target: <url | path | tab key | component description>

Task:
1. Resolve the target to the correct component file(s)
2. Read the file(s) and build a delta checklist against the design system
3. Rewrite only the JSX return block and file-level style constants
4. Do not change imports, hooks, types, state, handlers, API calls, or business logic
5. Run `cd frontend && npm run lint`
6. Report changed files, design deltas applied, and lint result
```

## Auto-companion Redesign (NEW)

When you `/ui-redesign <url>`, automatically redesign the entire page:

1. **Primary component** → list, hub, or dashboard
2. **Related modals** → detected from `onOpenModal()` calls
3. **Tabs & form fields** → search, filter, form inputs
4. **All buttons** → primary CTA, secondary, danger/delete, action buttons
5. **KPI cards** → metrics display
6. **Master layout** → page wrapper, header, spacing

No need to call 5 times — **one call = full page redesign**.

### Auto-companion Detection

**Modal identification:**
- Primary component calls `onOpenModal('ADD_ITEM', ...)`
- Look for modal file: `frontend/components/modals/<ItemName>Modal.tsx`
- If found → redesign together with primary component

**Tab & form field detection:**
- Search for `<input type=`, `onChange`, `value={searchTerm}` patterns
- Filter buttons: `onClick={() => setFilter(...)}`
- These stay in primary component JSX, redesign as part of it

**Button detection (NEW):**
- Primary CTA: `className="... bg-primary ..."` → `px-2.5 py-1.5 rounded text-xs font-semibold`
- Secondary: `className="... border border-slate-200 ..."` → secondary button style
- Danger/delete: `className="... bg-error ..."` → error button style
- Action buttons: any `<button>` inside component → auto-style

**KPI card detection:**
- Pattern: `text-lg font-black text-deep-teal` or grid of metric cards
- Inside primary component or dashboard
- Redesign styling to match §5 KPI design (p-3, text-xl, icon box)

**Master layout detection:**
- Outer `<div>` wrapper with `className="p-4 md:p-8 pb-20 ..."`
- Page header section (icon + title + subtitle)
- This is the "master layout" → redesign to `p-3 pb-6` + header pattern

### Example: Auto-companion in action

**Input:**
```
/ui-redesign reminders
```

**Auto-detects + redesigns:**
1. `ReminderList.tsx`
   - Master wrapper: `p-4 md:p-8 pb-20` → `p-3 pb-6`
   - Header: oversized title → compact + icon box
   - Search input: `py-2.5 pl-10` → `h-8 pl-8`
   - Filter buttons: `px-4 py-2` → `px-2.5 py-1.5`
   - **Add button: large shadow → compact primary style** (NEW)
   - **Edit/delete buttons: styled consistently** (NEW)
   - KPI grid: `gap-4 md:gap-6` → `gap-3`
   - Card padding: `p-5 md:p-6` → `p-3`

2. `ReminderModal.tsx` (if found)
   - Modal header: icon box sizing
   - Form inputs: `h-11 px-4` → `h-8 px-3`
   - **Button padding: `px-4 py-2` → `px-2.5 py-1.5`** (NEW)
   - Button colors: primary (save) + secondary (cancel)

3. All related modals in batch

**Output: 2 files changed, 45 deltas applied** (vs manually doing 5 separate calls)

---

## Empty URL Handling + New Feature Creation (NEW)

When you call `/ui-redesign` **without URL or URL not found**:

### Interactive Flow

```text
/ui-redesign
→ ❓ URL not found. Create new feature? (Y/n):
```

**If user confirms (Y):**

1. **What's the feature?** → "Dashboard for expense tracking"
2. **Tab key name?** → `expense_tracking` (auto-generates ExpenseTrackingHub.tsx)
3. **Component type?** → list | hub | dashboard

### Auto-generated Component Template

Created component includes:

✅ **Full design system integration:**
- Primary colors: `#004481` + `primary-soft`, `secondary`, `deep-teal`
- Surface stack: `surface`, `surface-low`, `surface-container`, `surface-container-lowest`
- Text colors: `on-surface`, `on-surface-variant`
- Semantic colors: success, warning, error

✅ **Master layout pattern:**
```jsx
<div className="p-3 pb-6">
  {/* Header with icon */}
  {/* Search / tabs */}
  {/* Content grid */}
</div>
```

✅ **Standard components:**
- Page header (icon + title + description)
- Search input (h-8, p-3)
- Filter buttons (px-2.5 py-1.5)
- **Primary CTA button** (gradient, hover-deep-teal)
- **Secondary button** (border, slate)
- **Danger button** (error color)
- KPI grid (p-3, gap-3)
- Card base (rounded-lg, border-slate-200)

✅ **TypeScript types & imports:**
- React hooks, types interfaces
- Proper component structure

### Example: New Feature Creation

```text
/ui-redesign
→ Create new feature? (Y/n): Y
→ Feature name: Dashboard for expense tracking
→ Tab key: expense_tracking
→ Type: dashboard

✅ CREATED: frontend/components/ExpenseTrackingHub.tsx

Component includes:
• Master wrapper: p-3 pb-6
• Header: icon + "Quản lý Chi phí" + description
• KPI grid: 4 cards (total spent, budget, savings, pending)
• Filter tabs: month selector, department filter
• Action button: "+ Thêm chi phí" (primary style with gradient)
• Table stub: ready for data integration
• Modal stub: ExpenseModal for create/edit

Next: /ui-redesign expense_tracking (to further customize)
```

### Auto-created File Structure

```
frontend/components/ExpenseTrackingHub.tsx
├── Imports (React, hooks, types)
├── Types (Props, Filter, State)
├── Styles (color tokens, spacing patterns)
├── Component
│   ├── Master wrapper: p-3 pb-6
│   ├── Header section: icon + title + subtitle
│   ├── Tabs section: filters, search
│   ├── KPI grid: 4 cards with icon boxes
│   ├── Main content: list or dashboard
│   └── Buttons: all design-system compliant
└── Export
```

---

## Master Layout Pattern

Every list/hub page follows this structure:

```jsx
<div className="p-3 pb-6">  {/* Master wrapper */}

  {/* Header section */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>icon</span>
      </div>
      <div>
        <h2 className="text-sm font-bold text-deep-teal">Page Title</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Description</p>
      </div>
    </div>
    <button>Action button</button>
  </div>

  {/* Tabs & filters */}
  <div className="flex gap-3 mb-3">
    {/* search input, filter buttons */}
  </div>

  {/* Content */}
  <div className="grid gap-3">
    {/* List items, cards, or KPIs */}
  </div>
</div>
```

**Master layout rules:**
- Wrapper: `p-3 pb-6` (not `p-4 md:p-8 pb-20`)
- Header margin: `mb-3` (not `mb-6 md:mb-8`)
- Header spacing: `gap-2` between icon and title
- All margins/gaps: `mb-3`, `gap-3` (not `mb-6`, `gap-6`)
- Section spacing: `space-y-3` (not `space-y-6`)

### Batch Processing Mode

To redesign multiple components in one pass, use comma-separated targets:

```text
Targets: reminders, products, contracts
OR: http://127.0.0.1:5174/reminders, fee_collection, http://127.0.0.1:5174/contracts
OR: modals, customer-request, revenue-mgmt
```

**Batch workflow with auto-companion:**
1. Parse comma-separated list (split by `, `)
2. For each target, auto-detect companions (modals, tabs, KPIs, layout)
3. Build delta checklists for all files
4. Rewrite all JSX blocks
5. Run lint **once after all files are changed**
6. Return combined report showing all targets + total changes + companion files

Example batch report:
```
✅ BATCH WITH AUTO-COMPANION

[reminders] Primary: ReminderList, Modal: ReminderModal → 2 files, 28 deltas
[products] Primary: ProductList, Modal: ProductModal, Bulk: ProductBulkModal → 3 files, 35 deltas
[contracts] Primary: ContractList, Modal: ContractModal → 2 files, 32 deltas

Total: 7 files, 95 deltas applied
Lint: ✅ Pass
```

## Scope

This workflow rewrites the JSX `return (...)` block and file-level style constants of one or more React/TypeScript components to conform to the VNPT Business Management design system.

Never modify:
- imports
- TypeScript types or interfaces
- hooks
- state declarations
- event handlers
- API calls
- helper functions
- prop definitions
- business logic

## Step 0 - Classify the input

Determine what the user input refers to:

| Input type | Example | Action |
|-----------|---------|--------|
| Full URL | `http://127.0.0.1:5174/contracts` | Strip protocol and host, take the last path segment |
| Path | `/contracts` | Take the last path segment |
| Route or tab name | `contracts` | Normalize directly |
| Tab key | `contract_list` | Normalize directly |
| Component description | `modals`, `shared modal shell`, `fee-collection modals` | Jump to Step 0b |

### Step 0a - Route input to component file

Normalize to a tab key:
- replace `-` with `_`
- strip leading `/`

Then look up the file:

| Tab key | Component file |
|---------|----------------|
| `dashboard` | `frontend/components/Dashboard.tsx` |
| `internal_user_dashboard` | `frontend/components/InternalUserDashboard.tsx` |
| `internal_user_list` | `frontend/components/InternalUserModuleTabs.tsx` |
| `internal_user_party_members` | `frontend/components/InternalUserModuleTabs.tsx` |
| `departments` | `frontend/components/DepartmentList.tsx` |
| `user_dept_history` | `frontend/components/UserDeptHistoryList.tsx` |
| `businesses` | `frontend/components/BusinessList.tsx` |
| `vendors` | `frontend/components/VendorList.tsx` |
| `products` | `frontend/components/ProductList.tsx` |
| `clients` | `frontend/components/CustomerList.tsx` |
| `cus_personnel` | `frontend/components/CusPersonnelList.tsx` |
| `projects` | `frontend/components/ProjectList.tsx` |
| `contracts` | `frontend/components/ContractList.tsx` |
| `documents` | `frontend/components/DocumentList.tsx` |
| `reminders` | `frontend/components/ReminderList.tsx` |
| `customer_request_management` | `frontend/components/CustomerRequestManagementHub.tsx` |
| `revenue_mgmt` | `frontend/components/RevenueManagementHub.tsx` |
| `fee_collection` | `frontend/components/FeeCollectionHub.tsx` |
| `support_master_management` | `frontend/components/SupportMasterManagement.tsx` |
| `procedure_template_config` | `frontend/components/ProcedureTemplateManagement.tsx` |
| `department_weekly_schedule_management` | `frontend/components/DepartmentWeeklyScheduleManagement.tsx` |
| `audit_logs` | `frontend/components/AuditLogList.tsx` |
| `user_feedback` | `frontend/components/FeedbackList.tsx` |
| `integration_settings` | `frontend/components/IntegrationSettingsPanel.tsx` |
| `access_control` | `frontend/components/AccessControlList.tsx` |

If the tab key is not in the table:
- grep `frontend/App.tsx` for `case '<tab_key>'`
- read the `import('./components/...')` path

### Step 0b - Component description input

If the input is descriptive, identify the relevant files by checking common targets first:

- Shared modal shell and form primitives:
  - `frontend/components/modals/shared.tsx`
- Delete and warning modals:
  - `frontend/components/modals/ReadOnlyWarningModals.tsx`
  - `frontend/components/modals/DeleteEntityModals.tsx`
- Fee collection modals:
  - `frontend/components/fee-collection/InvoiceModal.tsx`
  - `frontend/components/fee-collection/ReceiptModal.tsx`
  - `frontend/components/fee-collection/InvoiceBulkGenerateModal.tsx`
- Revenue modals:
  - `frontend/components/revenue-mgmt/RevenueTargetModal.tsx`
  - `frontend/components/revenue-mgmt/RevenueBulkTargetModal.tsx`
- All form modals:
  - `frontend/components/modals/`

Read the relevant files, then apply the same workflow to all of them in one pass.

## Step 1 - Read and analyze the component

While reading each file, note:

- icon library usage, especially `lucide-react`
- outer wrapper classes like `p-4 md:p-8` or `p-6`
- hardcoded colors like `blue-600`, `#2563eb`, `violet-*`, `orange-*`, `purple-*`, `indigo-*`, `yellow-*`, `green-*`
- spacing violations like `gap-6`, `p-5`, `p-6`, `h-10`, `h-11`, `mb-6`, `mb-8`, `pb-20`
- typography violations like oversized headings or labels
- icon sizing done with Tailwind text-size classes
- modal patterns like `rounded-xl shadow-2xl p-6`, `h-11 px-4 rounded-lg`

## Step 2 - Build a delta checklist

Before editing, list every violation found.

Example:

```text
[ ] wrapper: p-4 md:p-8 pb-20 -> p-3 pb-6
[ ] header: text-xl font-black -> text-sm font-bold text-deep-teal + icon box
[ ] KPI card: rounded-xl px-4 py-3 text-xs font-medium text-slate-500 -> rounded-lg p-3 text-[11px] font-semibold text-neutral
[ ] badge: bg-violet-100 text-violet-700 -> bg-deep-teal/10 text-deep-teal
[ ] input: h-11 px-4 rounded-lg -> h-8 px-3 rounded
[ ] icon: text-2xl -> style={{ fontSize: 18 }}
```

Use this checklist as the implementation contract.

## Step 3 - Rewrite JSX only

Allowed changes:
- the `return (...)` block
- file-level style token constants such as `STATUS_COLORS`

Disallowed changes:
- imports
- types
- hooks
- state
- handlers
- API calls
- prop definitions
- helper functions

After rewriting:

```bash
cd frontend && npm run lint
```

Fix all TypeScript errors before reporting. If a design token class such as `text-neutral` or `bg-error` appears to fail, check `frontend/tailwind.config.js`.

## Step 3b - Responsive Design Self-Check (REQUIRED before reporting)

**This step is mandatory.** After rewriting the JSX, verify every layout breakpoint in the output matches the responsive grid rules in §13.

Self-check checklist (tick each before proceeding):

```text
[ ] Page wrapper: p-3 pb-6 (no md:/lg: override on wrapper)
[ ] KPI grid: grid-cols-2 xl:grid-cols-4 (tablet = 2 col, desktop = 4 col)
[ ] Filter row: stacked on mobile, side-by-side on xl (grid-cols-1 xl:grid-cols-[...])
[ ] Table: overflow-x-auto + min-w-[Npx] for horizontal scroll on mobile
[ ] Action buttons in table: always visible (sticky right-0 bg-white) on all sizes
[ ] Modal: max-w-sm (mobile), max-w-2xl/4xl (desktop) — ModalWrapper width prop set correctly
[ ] Modal body grid: grid-cols-1 lg:grid-cols-2 for two-column form layouts
[ ] Header row: flex-wrap or flex-col on small, flex-row on lg+
[ ] CTA button: full-width on mobile optional, auto width on sm+
[ ] No hardcoded px widths that break at 375px (iPhone SE viewport)
```

If any item fails, fix it before moving to Step 4.

## Step 4 - Report

Return a concise report with:
- files changed
- changes grouped by component, using before -> after wording
- responsive test result (pass/fail per breakpoint)
- lint result

# Design System

Stack:
- React 19
- TailwindCSS
- TypeScript
- Custom tokens from `frontend/tailwind.config.js`
- Icons via Google Material Symbols loaded by CDN

## 0. Font Stack

System-native only — no custom font downloads, no CDN, no npm font packages.

### 0a. Font family priority (device-native first)

| Priority | CSS value | Thiết bị / OS |
|----------|-----------|----------------|
| 1 | `sans-serif` | Browser default (highest) |
| 2 | `system-ui` | Modern browsers — font hệ thống thiết bị |
| 3 | `-apple-system` | macOS / iOS / iPadOS → **SF Pro** |
| 4 | `BlinkMacSystemFont` | Chrome on macOS → **SF Pro** |
| 5 | `"Segoe UI"` | Windows 10/11 |
| 6 | `Roboto` | **Android / Chrome OS** |
| 7 | `"Helvetica Neue"` | macOS legacy |
| 8 | `Arial` | Universal fallback |

> **Kết quả thực tế:**
> - iPhone / iPad → **SF Pro Text** (Apple system font, tối ưu Retina)
> - Android → **Roboto** (Google system font)
> - Windows → **Segoe UI**
> - macOS → **SF Pro**
> - Linux → `system-ui` fallback

Rules:
- Never add `font-family` inline in components — the CSS variable `--dashboard-font` in `index.css` covers the whole app
- Never import external font files (CDN or npm) unless approved
- `@fontsource-variable/material-symbols-outlined` is the only allowed font import (icons only)
- `-webkit-text-size-adjust: 100%` **phải có** trong `:root` để ngăn iOS tự scale chữ khi xoay ngang

### 0b. Responsive base font-size (mobile-first)

Base `font-size` được set trên `:root` theo breakpoint — tất cả giá trị `rem` trong Tailwind tự scale theo:

| Breakpoint | `font-size` trên `:root` | Target device | Lý do |
|-----------|--------------------------|---------------|-------|
| Default (mobile) | `14px` | Điện thoại ≤ 767px | Màn nhỏ, mật độ pixel cao — chữ 14px đủ đọc |
| `md:` 768px+ | `14px` | Máy tính bảng | Giữ 14px — tablet đọc tốt ở mật độ cao |
| `lg:` 1024px+ | `15px` | Laptop | Màn lớn hơn — tăng nhẹ để dễ đọc |
| `xl:` 1280px+ | `16px` | Desktop | Standard desktop reading size |

**Quy tắc bổ sung:**
- Không dùng `font-size` inline trực tiếp trên `body` hay `html` — chỉ set trên `:root` qua `index.css`
- Không hardcode `px` trên text component — dùng Tailwind class (`text-xs`, `text-sm`, `text-[11px]`, v.v.)
- Với icon `material-symbols-outlined`: luôn dùng `style={{ fontSize: N }}` (không dùng Tailwind `text-*` vì icon font scale khác body font)
- Thêm `-webkit-font-smoothing: antialiased` và `-moz-osx-font-smoothing: grayscale` trên `body` để chữ sắc nét trên Retina (iPhone, iPad, MacBook)

### 0c. Font-size scale theo thiết bị (reference)

Khi dùng Tailwind class, chữ thực tế render tương ứng:

| Tailwind class | Mobile (14px base) | Tablet (14px base) | Laptop (15px base) | Desktop (16px base) |
|---------------|--------------------|--------------------|--------------------|--------------------|
| `text-[10px]` | 10px | 10px | 10px | 10px *(hardcoded)* |
| `text-[11px]` | 11px | 11px | 11px | 11px *(hardcoded)* |
| `text-xs` (0.75rem) | 10.5px | 10.5px | 11.25px | 12px |
| `text-sm` (0.875rem) | 12.25px | 12.25px | 13.13px | 14px |
| `text-base` (1rem) | 14px | 14px | 15px | 16px |
| `text-lg` (1.125rem) | 15.75px | 15.75px | 16.88px | 18px |
| `text-xl` (1.25rem) | 17.5px | 17.5px | 18.75px | 20px |

> **Lưu ý:** `text-[10px]`, `text-[11px]` là giá trị tuyệt đối (px) — không scale theo base font. Dùng cho caption/badge nhỏ trên mọi thiết bị.

## 1. Color tokens

**Standard: WCAG AA minimum (contrast ≥ 4.5:1 for normal text, ≥ 3:1 for UI components)**

All colors must use custom Tailwind tokens. Never use raw Tailwind color scales such as `blue-*`, `violet-*`, `orange-*`, `purple-*`, `indigo-*`, `yellow-*`, or `green-*` in the redesigned output.

### 1a. Primary — VNPT Blue + Soft variants (Long-session Comfort)

| Token                     | Hex        | WCAG on white     | Sử dụng |
|---------------------------|------------|-------------------|---------|
| `primary` | `#004481` | 9.78:1 ✅ AAA | CTA gradient start, links, active states |
| `primary-container` | `#005BAA` | 6.83:1 ✅ AA | CTA gradient end, focus ring |
| `deep-teal` | `#003F7A` | 12.4:1 ✅ AAA | Hover on primary, page headings |
| **`primary-soft`** | **`#155893`** | **8.12:1 ✅ AAA** | **Active sidebar, large accent areas, hover state dài hạn (soft variant để dịu mắt)** |
| **`primary-soft-hover`** | **`#0F426F`** | **10.85:1 ✅ AAA** | **Hover trên primary-soft (Comfort Mode long-session)** |
| **`primary-container-soft`** | **`#DFE8F5`** | **dark 12.1:1 ✅ AAA** | **Background tint cho panel/card lớn, focus ring nhẹ (long-session)** |

**CTA button spec (cập nhật):**
- `background: linear-gradient(135deg, #004481, #005BAA)`
- `color: white` — worst-case CR 6.83:1 ✅ AA
- `hover: bg-deep-teal` (#003F7A) — hover ngắn hạn
- **`hover (long-session / Comfort Mode): bg-primary-soft` (#155893)** — ưu tiên khi user làm việc >45 phút
- `border-radius: 0.75rem` (xl)

### 1b. Secondary / Sky Blue

⚠ **Usage restriction:** `secondary` and `secondary-container` must NEVER be used as text color on light backgrounds (CR 2.53:1 — fails all WCAG levels). Use only as bg / icon / chart fill.

| Token | Hex | Use |
|-------|-----|-----|
| `secondary` | `#00AEEF` | Icons, chart fills, accent bars, decorative — bg/icon only |
| `secondary-container` | `#2DBCFE` | Success / positive growth bg — dark text only |
| `secondary-fixed` | `#C6E7FF` | Badge "In Progress" bg — on-surface text 13.24:1 ✅ AAA |

### 1c. Tertiary / Amber Brown

| Token | Hex | WCAG on white | Use |
|-------|-----|---------------|-----|
| `tertiary` | `#964201` | 6.83:1 ✅ AA | Warning text, caution labels |
| `tertiary-fixed` | `#FFDBCA` | dark 5.28:1 ✅ AA | Badge "Warning" background |
| `tertiary-fixed-dim` | `#C07039` | 4.91:1 ✅ AA | Chart 3rd data series |

### 1d. Surface stack

No borders between sections — use background shifts only (The "No-Line" Rule).

| Token | Hex | Level | Use |
|-------|-----|-------|-----|
| `surface` | `#F9F9FF` | Base | Canvas / page background |
| `surface-low` | `#F2F3FA` | Sectioning | Sidebar, panels, layout blocks |
| `surface-container` | `#ECEDF5` | Container | Card base, tonal layer |
| `surface-container-lowest` | `#FFFFFF` | Active content | KPI cards, data entry zones |
| `surface-high` | `#E7E8EF` | Elevated | Floating headers, drawers |
| `surface-variant` | `#ECEDF5` | Hover | Table row `:hover` background |
| `bg-light` | `#F2EFE7` | @deprecated | Migrate to `surface-low` |

### 1e. Text

| Token | Hex | WCAG on surface | Use |
|-------|-----|-----------------|-----|
| `on-surface` | `#191C21` | 16.28:1 ✅ AAA | Body text, headings — never use `#000000` |
| `on-surface-variant` | `#485070` | 7.53:1 ✅ AAA | Captions, meta, helper text |
| `neutral` | `#485070` | 7.53:1 ✅ AAA | Alias → `on-surface-variant` (backward compat) |

### 1f. Border & Shadow

| Token | Value | Use |
|-------|-------|-----|
| `outline-variant` | `#C1C6D3` | Ghost border — decorative only, use at ≤15% opacity |
| `shadow-cloud` | `0 24px 48px -12px rgba(0,28,59,0.08)` | High-priority modals (blue-tinted shadow) |
| `shadow-glass` | `0 8px 32px -8px rgba(0,28,59,0.06)` | Glassmorphism nav / filter bars |

Glassmorphism rule: `surface-container-lowest` at 80% opacity + `backdrop-blur-[20px]` for floating nav/filter bars.

### 1g. Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `success` | `#10B981` | Healthy / active states |
| `warning` | `#F59E0B` | Medium severity warnings |
| `error` | `#EF4444` | Errors, failures, destructive actions |

Strict icon color rules **(cập nhật: long-session comfort)**:
- decorative section icons → `on-surface-variant` (#485070) **(ưu tiên khi session dài >45 phút)**
- warning / alert icons → `text-tertiary`
- CTA icons → `text-primary` (hoặc `text-primary-soft` trong Comfort Mode)
- charts, SVGs, gradients → use hex values from chart palette below

### 1h. Chart color palette

Use hex only for SVG, `conic-gradient`, or inline `style` — never in `className`:

| Slot | Hex | Token | Use |
|------|-----|-------|-----|
| C1 | `#004481` | `primary` | Primary series |
| C2 | `#00AEEF` | `secondary` | Secondary series (fill only) |
| C3 | `#C07039` | `tertiary-fixed-dim` | Tertiary series |
| C4 | `#964201` | `tertiary` | Warning series |
| C5 | `#10B981` | `success` | Completed or active |
| C6 | `#F59E0B` | `warning` | Near deadline |
| C7 | `#485070` | `neutral` | Unknown or other |
| C8 | `#EF4444` | `error` | Error or cancelled |

Slot assignment **(cập nhật: ưu tiên long-session comfort):**
- 2-segment pie: C1 + C2
- 3-segment pie: C1 + C2 + C4
- 4+ pie: C1 → C2 → C5 → C4 → C6 → C7
- bar chart: C1 + C2
- line chart: C1 + C2 + C5
- stacked bar bottom to top: C1 + C5 + C2 + C6 + C4 + C7
- KPI sparkline: C5 up, C8 down, C2 neutral
- Revenue comparison (Planned vs Actual): `primary` bar + semi-transparent `secondary-container` overlay

**Long-session recommendation:**
- Tránh C2 (#00AEEF secondary) cho fill area lớn (chói mắt khi làm việc lâu)
- Ưu tiên thứ tự: **C1 → C5 → C7 → C3 → C4 → C6** cho visibility dài hạn
- Charts nhẹ: dùng `primary-soft` (#155893) thay vì primary (#004481) cho background/accent

Examples:

```jsx
style={{ background: `conic-gradient(#004481 0% ${pct}%, #00AEEF ${pct}% 100%)` }}

const CHART_COLORS = ['#004481', '#00AEEF', '#C07039', '#964201', '#10B981', '#F59E0B', '#485070', '#EF4444'];
<rect fill={CHART_COLORS[index % CHART_COLORS.length]} />
```

## 2. Icons

Required:
- `material-symbols-outlined`

Forbidden:
- `lucide-react`

Correct syntax:

```jsx
<span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>icon_name</span>
```

Size rules:
- use `style={{ fontSize: N }}` with N from 14 to 20
- never use Tailwind text-size classes on icons

Common sizes:
- `14` for caption icons
- `15` for inline badges
- `16` for header icon boxes
- `17` to `18` for modal headers and action buttons

Common mappings:

| lucide | material-symbols |
|--------|------------------|
| `Users` | `group` |
| `User` | `person` |
| `UserCheck` | `how_to_reg` |
| `UserPlus` | `person_add` |
| `BarChart3` / `BarChart2` | `bar_chart` |
| `LineChart` | `show_chart` |
| `PieChart` | `pie_chart` |
| `Calendar` | `calendar_month` |
| `CalendarDays` | `calendar_today` |
| `Clock` | `schedule` |
| `Mars` | `male` |
| `Venus` | `female` |
| `ShieldCheck` | `verified_user` |
| `Shield` | `shield` |
| `Settings` / `Cog` | `settings` |
| `Search` | `search` |
| `Plus` | `add` |
| `X` / `XCircle` | `close` |
| `Check` / `CheckCircle` | `check_circle` |
| `AlertTriangle` | `warning` |
| `AlertCircle` | `error` |
| `Info` | `info` |
| `Download` | `download` |
| `Upload` | `upload` |
| `Trash2` / `Trash` | `delete` |
| `Edit` / `Edit2` | `edit` |
| `Eye` | `visibility` |
| `EyeOff` | `visibility_off` |
| `ChevronDown` | `expand_more` |
| `ChevronRight` | `chevron_right` |
| `ChevronLeft` | `chevron_left` |
| `ArrowRight` | `arrow_forward` |
| `ArrowLeft` | `arrow_back` |
| `RefreshCw` | `refresh` |
| `Filter` | `filter_list` |
| `Building2` / `Building` | `business` |
| `FileText` | `description` |
| `File` | `insert_drive_file` |
| `Folder` | `folder` |
| `Mail` | `mail` |
| `Phone` | `phone` |
| `MapPin` | `location_on` |
| `Star` | `star` |
| `Heart` | `favorite` |
| `Lock` | `lock` |
| `Unlock` | `lock_open` |
| `Bell` | `notifications` |
| `Send` | `send` |
| `Copy` | `content_copy` |
| `Link` | `link` |
| `ExternalLink` | `open_in_new` |
| `Home` | `home` |
| `LogOut` | `logout` |
| `Menu` | `menu` |
| `Grid` | `grid_view` |
| `List` | `list` |
| `Tag` | `label` |
| `DollarSign` | `payments` |
| `TrendingUp` | `trending_up` |
| `TrendingDown` | `trending_down` |

If the icon is not in the table, find the closest Material Symbols equivalent.

## 3. Layout

### Page wrapper

```jsx
<div className="p-3 pb-6">
  {/* page header */}
  {/* content */}
</div>
```

### Page header

Always place the page header first inside the wrapper:

```jsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>ICON_NAME</span>
    </div>
    <div>
      <h2 className="text-sm font-bold text-deep-teal leading-tight">Page Title</h2>
      <p className="text-[11px] text-slate-400 leading-tight">Short description</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    {/* optional toolbar */}
  </div>
</div>
```

## 4. Cards

- container: `rounded-lg border border-slate-200 bg-white shadow-sm`
- padding: `p-3` for compact, `p-4` for standard
- title bar: `flex items-center justify-between px-4 py-2 border-b border-slate-100`

## 5. KPI cards

```jsx
<div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
  <div className="flex items-center justify-between mb-2">
    <span className="text-[11px] font-semibold text-neutral">Metric label</span>
    <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center">
      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 15 }}>icon</span>
    </div>
  </div>
  <p className="text-xl font-black text-deep-teal leading-tight">Value</p>
  <p className="text-[10px] text-slate-400 mt-0.5">Sub-text / trend info</p>
</div>
```

KPI grid:
- `grid grid-cols-2 xl:grid-cols-4 gap-3`

## 6. Buttons

Base classes:
- `inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors disabled:opacity-50`

Variants:
- **Primary CTA:** gradient fill — `style={{ background: 'linear-gradient(135deg,#004481,#005BAA)' }} className="text-white hover:bg-deep-teal shadow-sm rounded-xl"`
- **Primary (flat):** `bg-primary text-white hover:bg-deep-teal shadow-sm`
- **Secondary:** `border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`
- **Danger:** `bg-error text-white hover:bg-red-700 shadow-sm`

WCAG note: white text on primary gradient — worst-case CR 6.83:1 ✅ AA

## 7. Badge and status chips

Base patterns:

```text
Success   -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700
Error     -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700
Warning   -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700
Neutral   -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500
Primary   -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary
Secondary -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary
Deep-teal -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-deep-teal/10 text-deep-teal
Tertiary  -> text-[10px] font-bold px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary
```

Business status mapping:

| Business state | Badge variant |
|---------------|---------------|
| Active / In progress / Processing | Success |
| Completed / Confirmed / Achieved | Primary |
| Pending / Awaiting approval | Secondary |
| Warning / Near deadline / Moderate | Warning |
| Overdue / Debt | Tertiary |
| Cancelled / Failed / Rejected | Error |
| Draft / Inactive / Unknown | Neutral |
| High priority / Leader / Featured | Deep-teal |

## 8. Typography scale

| Level | Tailwind class | Use |
|------|----------------|-----|
| Page title | `text-sm font-bold text-deep-teal` | Top `h2` |
| Card title | `text-xs font-bold text-slate-700` | Section headings |
| Field label | `text-xs font-semibold text-neutral` | Input labels |
| KPI number | `text-xl font-black text-deep-teal` | Large stat values |
| Body text | `text-sm text-slate-700` | Regular content |
| Sub-heading | `text-[11px] text-slate-400` | Under page title |
| Caption | `text-[10px] text-slate-400` | Meta info |

## 9. Spacing rules

| Element | Correct | Wrong |
|--------|---------|-------|
| Page wrapper | `p-3 pb-6` | `p-4 md:p-8`, `p-6 md:p-8` |
| Grid gap | `gap-3`, `gap-4` | `gap-6` |
| Card padding | `p-3`, `p-4` | `p-5`, `p-6` |
| Input height | `h-8` | `h-10`, `h-11` |
| Section spacing | `space-y-3`, `mb-3` | `space-y-6`, `mb-8` |
| Header margin | `mb-3` | `mb-6`, `mb-8` |
| Mobile bottom padding | `pb-6` | `pb-20` |

## 10. Modals

### Shared modal shell

Target file:
- `frontend/components/modals/shared.tsx`

Header structure:

```jsx
<div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>{icon}</span>
    </div>
    <h2 className="min-w-0 flex-1 text-sm font-bold text-deep-teal leading-tight truncate">{title}</h2>
  </div>
  <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50">
    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
  </button>
</div>
```

Panel classes:
- `rounded-lg shadow-xl border border-slate-200`

### Modal footer

```jsx
<div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 flex-shrink-0">
  <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
    Huy
  </button>
  <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors bg-primary text-white hover:bg-deep-teal shadow-sm disabled:opacity-50">
    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
    Luu
  </button>
</div>
```

### Delete confirm modal

- panel: `max-w-sm rounded-lg shadow-xl border border-slate-200 p-4`
- icon box: `w-9 h-9 rounded bg-error/10`
- icon: `text-error`, fontSize `18`
- title: `text-sm font-bold text-deep-teal`
- sub text: `text-[11px] text-slate-400`
- message: `text-xs text-slate-600 pl-12`

### Warning or blocker modal

- panel: `max-w-sm rounded-lg border border-warning/30 border-l-4 border-l-warning shadow-xl`
- icon box: `w-8 h-8 rounded bg-warning/15`
- icon: `text-warning`, fontSize `17`
- title: `text-sm font-bold text-deep-teal`
- body: `text-xs text-slate-600`

### Form inputs inside modals

- label: `text-xs font-semibold text-neutral`
- input: `h-8 px-3 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-primary/30 focus:border-primary`
- error: `text-[11px] text-error`
- label and input gap: `gap-1`

## 11. Progress bars

```jsx
<div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
  <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
</div>

<div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
  <div className="bg-primary h-full" style={{ width: `${p1}%` }} />
  <div className="bg-secondary h-full" style={{ width: `${p2}%` }} />
  <div className="bg-tertiary h-full" style={{ width: `${p3}%` }} />
</div>
```

Fill meaning:
- `bg-primary` for normal completion
- `bg-success` for achieved or healthy
- `bg-secondary` for comparison
- `bg-warning` for moderate risk
- `bg-tertiary` for overdue or special states
- `bg-error` for failed or cancelled
- `bg-neutral` for unknown or other

Legend dots:
- `inline-block w-2 h-2 rounded-full bg-{token} shrink-0`

## 12. Common violations quick reference

| Old pattern | Correct pattern |
|------------|-----------------|
| `p-4 md:p-8 pb-20` | `p-3 pb-6` |
| `text-xl md:text-2xl font-black text-deep-teal` for page title | `text-sm font-bold text-deep-teal` plus icon box |
| `text-sm text-slate-500` sub-heading | `text-[11px] text-slate-400` |
| `rounded-xl shadow-2xl` | `rounded-lg shadow-xl border border-slate-200` |
| `px-4 py-2 rounded-lg font-medium text-sm` button | `px-2.5 py-1.5 rounded text-xs font-semibold` |
| `px-4 py-2 md:px-5 md:py-2.5` button | `px-2.5 py-1.5` |
| `h-11 px-4 rounded-lg` input | `h-8 px-3 rounded` |
| `text-sm font-semibold text-slate-700` field label | `text-xs font-semibold text-neutral` |
| `gap-6` | `gap-3` or `gap-4` |
| `space-y-6` | `space-y-3` |
| `mb-6` or `mb-8` | `mb-3` |
| `py-10 px-6` empty state | `py-8 px-4` |
| `text-4xl` on icon | `style={{ fontSize: 36 }}` |
| `text-2xl` on icon | `style={{ fontSize: 18 }}` |
| `text-base` on icon | `style={{ fontSize: 16 }}` |
| `text-lg` on icon | `style={{ fontSize: 17 }}` |
| `text-sm` on icon | `style={{ fontSize: 15 }}` |
| `bg-violet-*` or `text-violet-*` | `bg-deep-teal/10 text-deep-teal` |
| `bg-orange-*` or `text-orange-*` | `bg-warning/15 text-tertiary` or `bg-tertiary/10 text-tertiary` |
| `bg-yellow-*` | `bg-warning/15 text-warning` |
| `bg-green-100 text-green-700` | `bg-emerald-100 text-emerald-700` |
| `bg-red-100 text-red-600` for icon | `bg-error/10 text-error` |
| `w-12 h-12 rounded-full` modal icon | `w-9 h-9 rounded` |
| `hover:bg-primary/5` action button | `hover:bg-slate-100` |
| `text-xs font-medium` badge | `text-[10px] font-bold` |
| `border-none bg-slate-50` filter input | `border border-slate-200 bg-slate-50` |
| `focus:ring-2 focus:ring-primary/20` | `focus:ring-1 focus:ring-primary/30 focus:border-primary` |
| `rounded-2xl backdrop-blur-sm` filter bar | `rounded-lg` |
| `px-3 py-1.5` period button | `px-2.5 py-1 text-[11px]` |
| `h-9 w-36` date input | `h-8 w-32` |
| `bg-primary` (#005BAA old) CTA | gradient `#004481→#005BAA` or `bg-primary` (#004481 new) |
| `text-neutral` (#75777D old) | `text-neutral` or `text-on-surface-variant` (#485070 new) |
| `bg-bg-light` (#F2EFE7) | `bg-surface` (#F9F9FF) or `bg-surface-low` (#F2F3FA) |
| `text-slate-900` body text | `text-on-surface` (#191C21) |
| `border border-slate-200` section separator | remove border — use background shift (No-Line Rule) |

## 13. Responsive Design (REQUIRED — must pass before task is complete)

Every redesigned component **must be verified** against all four breakpoints before the task is considered complete.

### Breakpoint reference

| Breakpoint | Tailwind prefix | Target device | Min width |
|-----------|----------------|---------------|-----------|
| Mobile | *(default, no prefix)* | Điện thoại (iPhone SE → iPhone 15 Pro Max) | 375 px |
| Tablet | `sm:` / `md:` | Máy tính bảng (iPad Mini → iPad Pro 12.9") | 640 px / 768 px |
| Laptop | `lg:` | Laptop (13"–15", 1280 px) | 1024 px |
| Desktop | `xl:` | Desktop (1440 px+) | 1280 px |

### Responsive rules per element

#### Page wrapper
```jsx
<div className="p-3 pb-6">   {/* uniform — no responsive override */}
```

#### Page header
```jsx
{/* Mobile: stacked (title left, button below or right) */}
{/* Desktop: single flex row */}
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
```
- On mobile (< sm): title + subtitle stack, CTA button either wraps below or stays right as icon-only
- On sm+: single row — icon box + title left, CTA right

#### KPI grid
```jsx
{/* Mobile: 2 columns; Tablet+: 4 columns */}
<div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
```
- **Never** `grid-cols-1` for KPI cards (wastes vertical space on phone)
- **Never** `grid-cols-4` without `xl:` prefix (breaks on tablet)

#### Filter / search bar
```jsx
{/* Mobile: stacked; Desktop: side-by-side */}
<div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
```
- On mobile: search input full-width (stacked)
- On xl+: search + status select side by side

#### Data table
```jsx
{/* Always scrollable on mobile */}
<div className="overflow-x-auto">
  <table className="w-full min-w-[700px]">  {/* min-w prevents column crush */}
```
- Action buttons column: `sticky right-0 bg-white` — always visible without horizontal scroll
- `min-w` value depends on column count: `min-w-[700px]` (5–6 cols), `min-w-[900px]` (7–8 cols)

#### Modals
```jsx
{/* ModalWrapper width prop */}
width="max-w-sm"      /* single-field / delete confirm */
width="max-w-xl"      /* standard form (single column) */
width="max-w-4xl"     /* two-column form */
```
- ModalWrapper internally adds `w-full mx-4` on mobile — no additional wrapper needed
- Two-column form body: `grid grid-cols-1 lg:grid-cols-2 gap-4` (stacks to 1 col on mobile/tablet)
- Modal footer buttons: always `flex-row gap-2` (do NOT stack on mobile)

#### Buttons
- CTA (page-level): `w-full sm:w-auto` — full width on mobile, auto on sm+
- Action buttons (table row): always fixed size `h-7 w-7` — never change on breakpoint

### Responsive self-check command (run in browser DevTools)

After writing code, mentally simulate or use browser DevTools to verify at these exact widths:

| Width | Device | What to check |
|-------|--------|--------------|
| 375 px | iPhone SE | KPI 2-col, filter stacked, table scrolls horizontally, modal not clipped |
| 768 px | iPad Mini | KPI 2-col, filter stacked, table visible without scroll |
| 1024 px | Laptop | KPI 4-col (if xl) or 2-col (if only xl:), filter row side-by-side |
| 1440 px | Desktop | Full layout, no overflow |

### Responsive violations quick reference

| Violation | Fix |
|-----------|-----|
| `grid-cols-4` without `xl:` | `grid-cols-2 xl:grid-cols-4` |
| `grid-cols-1` on KPI cards | `grid-cols-2 xl:grid-cols-4` |
| No `overflow-x-auto` on table | Wrap `<div className="overflow-x-auto">` |
| No `min-w-[Npx]` on table | Add `min-w-[700px]` or appropriate value |
| `flex-row` header always | `flex-col sm:flex-row` |
| `hidden` on important element on mobile | Use `sm:block` pattern, not `hidden` |
| Fixed px width on filter input | Use `w-full` or `minmax(0,1fr)` |
| `max-w-4xl` modal without `w-full mx-4` | ModalWrapper handles this — ensure `width` prop is set |
| Modal body `grid-cols-2` always | `grid-cols-1 lg:grid-cols-2` |
| `px-8` / `p-6` on mobile wrapper | Must be `p-3 pb-6` |
