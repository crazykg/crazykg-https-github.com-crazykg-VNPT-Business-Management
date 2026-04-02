---
name: ui-redesign
description: Redesign UI component/page(s) + auto-companion (modals, tabs, KPIs, master layout). Supports batch processing with comma-separated inputs.
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

## Empty URL Handling + New Feature Creation

If URL is **empty or not found**:

```text
/ui-redesign
→ ❓ "URL not provided. New feature? (Y/n)"
```

**If user confirms (Y):**

1. Ask: **"Describe the new feature"** (e.g., "Dashboard for expense tracking")
2. Ask: **"Tab key name"** (e.g., `expense_tracking` → `frontend/components/ExpenseTrackingHub.tsx`)
3. Ask: **"Primary component type"** (list, hub, dashboard)
4. Auto-generate component with:
   - ✅ Full design system styling (primary, secondary, surfaces, typography)
   - ✅ Master layout pattern (p-3 pb-6)
   - ✅ Header section (icon + title + description)
   - ✅ Action buttons (primary CTA style)
   - ✅ Modal stub (if needed)
   - ✅ TypeScript types
   - ✅ Proper imports + structure

**Example new feature creation:**

```text
/ui-redesign
→ ❓ New feature? (Y/n): Y
→ Feature name: Dashboard for expense tracking
→ Tab key: expense_tracking
→ Type: dashboard

✅ CREATED: ExpenseTrackingHub.tsx
   • Master layout: p-3 pb-6
   • Header: icon + title + subtitle
   • KPI grid: 4 cards, p-3 gap-3
   • Action buttons: primary style
   • Color tokens: all from design system
   • Ready to customize: edit content + add logic

→ Run: /ui-redesign expense_tracking (to redesign when updated)
```

---

## Batch Processing

`$ARGUMENTS` can be:
- **Single target:** `/ui-redesign http://127.0.0.1:5174/reminders`
- **Multiple targets (comma-separated):** `/ui-redesign reminders, products, contracts`
- **Mixed formats:** `/ui-redesign http://127.0.0.1:5174/reminders, fee_collection, contracts`

For batch input (comma-separated), process each target sequentially with auto-companion:

1. Split by `, ` (comma + space) → list of targets
2. For each target, auto-detect + redesign (primary + modals + tabs + KPIs + layout)
3. Accumulate files changed, deltas, and lint result
4. Return combined report at the end

---

## Single Target Workflow

For each target:

1. **Resolve** `target` to primary file using playbook rules
2. **Auto-detect companions** (modals, tabs, KPIs, master layout)
3. **Build delta checklist** for all files
4. **Rewrite JSX** `return (...)` block + file-level style constants
5. **Keep unchanged:** imports, hooks, state, handlers, types, business logic
6. **Run lint once** after all files are changed
7. **Report** files changed, applied deltas, lint result

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
Files changed: 2, Deltas: 28, Status: ✅

[Target 2: products]
Primary: ProductList.tsx ✅
Modals: ProductModal.tsx, ProductBulkModal.tsx ✅
Tabs: Filter bar, search ✅
KPIs: 4 cards ✅
Layout: Master wrapper ✅
Files changed: 3, Deltas: 35, Status: ✅

[Target 3: contracts]
Primary: ContractList.tsx ✅
Modals: ContractModal.tsx ✅
Tabs: Search, filter tabs ✅
KPIs: Dashboard cards ✅
Layout: Master wrapper ✅
Files changed: 2, Deltas: 32, Status: ✅

────────────────────────
Total files changed: 7
Total deltas applied: 95
Lint result: ✅ Pass
────────────────────────
```
