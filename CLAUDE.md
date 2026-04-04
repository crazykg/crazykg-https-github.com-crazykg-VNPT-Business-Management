# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VNPT Business Management — enterprise CRM/ERP managing contracts, projects, customers, employees, products, opportunities, a customer request workflow system, and **fee collection / revenue management (Thu Cước)**.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev          # Vite dev server http://127.0.0.1:5174 (proxies /api → backend:8002)
npm run build        # Production build
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
```

Run a single test:
```bash
cd frontend && npx vitest run __tests__/authorization.test.ts
```

### Backend (from `backend/`)
```bash
composer setup       # Full setup: install, env, key, migrate, npm build
composer dev         # Starts server + queue + logs + vite concurrently
php artisan serve --host=127.0.0.1 --port=8002   # API only (single-threaded)
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=127.0.0.1 --port=8002  # Parallel (needed for concurrent frontend calls)
composer test        # PHPUnit (clears config first)
php artisan migrate
php artisan queue:listen --tries=1   # Async jobs (exports, etc.)
```

Run a single test:
```bash
cd backend && php artisan test --filter=CustomerRequestCaseWorkflowCrudTest
```

All CRC workflow tests: `cd backend && php artisan test --filter=CustomerRequestCase`

Test environment: SQLite `:memory:`, array cache/session, sync queue (`phpunit.xml`). No MySQL/Redis needed.

### Useful artisan commands
```bash
php artisan crc:snapshot-hours              # Generate previous month hours snapshot
php artisan crc:snapshot-hours 2026-03      # Specific month (YYYY-MM)
php artisan crc:snapshot-hours 2026-03 --force  # Overwrite existing snapshot
php artisan app:backfill-customer-request-case-metrics  # Backfill CRC case metrics
php artisan app:prune-async-exports         # Clean up old async export files
```

### Development Quickstart (both apps)
```bash
# Terminal 1 — backend (starts server:8002, queue worker, pail logs, vite concurrently)
cd backend && composer setup && composer dev

# Terminal 2 — frontend (Vite dev server on :5174, proxies /api → :8002)
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

### Performance Testing (from `perf/`)
```bash
npm run smoke                                    # Quick smoke test
PERF_BASE_URL=http://localhost:8002 npm run load  # Full load test
```
Env vars: `PERF_BASE_URL`, `PERF_USERNAME` (default `admin.demo`), `PERF_PASSWORD` (default `password`).

### CI Pipeline (`.github/workflows/ci.yml`)
Runs on every push/PR — three parallel jobs:
1. **Backend Tests** — PHP 8.4, SQLite, `php artisan test`
2. **Frontend Unit Tests** — Node 22, `npm test`
3. **Frontend E2E Tests** — Node 22, Playwright (Chromium), `npm run test:e2e`

Concurrency: auto-cancels in-progress runs on new push to same branch.

## Architecture

### Monorepo Structure
```
frontend/    → React 19 + Vite + TailwindCSS + TypeScript
backend/     → Laravel 12 + MySQL 8 + Redis + Sanctum
perf/        → k6 load testing scenarios
plan-code/   → Architecture/upgrade plans (Vietnamese markdown)
docs/        → Additional documentation
```

### Frontend Architecture

**Entry point & routing** — `index.tsx` → `AppWithRouter` (React Router `BrowserRouter`) → `App.tsx`. The router uses a single catch-all `*` route; all tab/page navigation is handled internally by `App.tsx` using `useLocation`/`useNavigate`. `AppPages.tsx` holds lazy-loaded `React.lazy()` imports for every page component, keeping `App.tsx` free of direct import bloat.

**Top-level directory layout:**
```
frontend/
  App.tsx                 → monolithic state + CRUD handlers (~7,400 lines)
  AppPages.tsx            → lazy-loaded page component imports
  AppWithRouter.tsx       → BrowserRouter wrapper
  types.ts                → all TypeScript interfaces (~2,600 lines)
  constants.ts            → mock/seed data used during development
  hooks/                  → per-entity hooks (useContracts, useCustomers, useEmployees…) that wrap App.tsx state
  services/v5Api.ts       → full API client (~5,600 lines)
  shared/
    api/apiFetch.ts       → core HTTP fetch utility
    stores/               → Zustand stores (uiStore, toastStore, revenueStore)
  components/             → all UI components
  utils/                  → pure utility functions
  router/                 → ProtectedRoute + routes.tsx (route config)
  __tests__/              → Vitest unit tests
  e2e/                    → Playwright E2E tests
```

**State management transition in progress** — App.tsx (~7,400 lines) still holds most state via `useState`. A Zustand migration is underway:
- `frontend/shared/stores/uiStore.ts` — active tab, sidebar state (absorbing from App.tsx progressively)
- `frontend/shared/stores/toastStore.ts` — toast notifications (replaces `addToast` prop drilling)
- `frontend/shared/stores/revenueStore.ts` — revenue sub-view navigation, period filters, dept selection (used by `RevenueManagementHub` and all revenue sub-views)
- `frontend/shared/api/apiFetch.ts` — core HTTP utility (extracted from `services/v5Api.ts`)

Until migration completes, **App.tsx remains the source of truth** for all entity data and CRUD handlers. New modules (customer-request, revenue, fee-collection) use the shared stores.

**API layer** — `services/v5Api.ts` (~5,600 lines) wraps all HTTP calls via `apiFetch()`. Features: 401 auto-refresh, tab eviction (`TAB_EVICTED`), GET deduplication (`inFlightGetRequests`), `cancelKey` + AbortController, 45s timeout. All endpoints use `/api/v5/` prefix.

**Customer-request module** uses custom hooks in `components/customer-request/hooks/`:
- `useCustomerRequestList`, `useCustomerRequestDetail`, `useCustomerRequestSearch`
- `useCustomerRequestCreatorWorkspace`, `useCustomerRequestDispatcherWorkspace`, `useCustomerRequestPerformerWorkspace`
- `useCustomerRequestTransition`, `useCustomerRequestDashboard`, `useCustomerRequestAttachments`
- `useCustomerRequestQuickAccess`

These hooks call `services/v5Api.ts` directly and manage their own loading/error state.

**Key component groups:**
- `components/customer-request/` — 40+ components: role workspaces, plan, escalation, leadership, reports
- `components/fee-collection/` — `InvoiceList`, `InvoiceModal`, `InvoiceBulkGenerateModal`, `ReceiptList`, `ReceiptModal`, `FeeCollectionDashboard`, `DebtAgingReport`
- `components/revenue-mgmt/` — `RevenueOverviewDashboard`, `RevenueByContractView`, `RevenueByCollectionView`, `RevenueForecastView`, `RevenueReportView`, `RevenueTargetModal`, `RevenueBulkTargetModal`, `RevenueAdjustmentPlanPanel`
- `components/contract-revenue/` — `ContractRevenueView`, `RevenueBarChart`, `RevenueCumulativeChart`
- `components/procedure/` — `StepRow.tsx`, `RaciMatrixPanel.tsx` for project procedures
- `components/` (root) — one `*List.tsx` per entity, hub components (`RevenueManagementHub`, `FeeCollectionHub`, `CustomerRequestManagementHub`), `Modals.tsx`, `Sidebar.tsx`, `Toast.tsx`

**Key reference files:**
- `types.ts` (~2,600 lines) — All TypeScript interfaces
- `utils/authorization.ts` — `hasPermission(user, 'resource.action')`, `canAccessTab()`, `canOpenModal()`
- `utils/revenueDisplay.ts` — `formatCurrencyVnd()`, `formatCompactCurrencyVnd()` (tỷ/tr/đ), `formatSignedCurrencyVnd()`, `formatRevenuePeriodLabel()`, `formatDateRangeDdMmYyyy()`, `getRevenuePeriodBounds()`. Use these for all revenue/fee-collection currency display.
- `utils/dateDisplay.ts` — `formatDateDdMmYyyy()`, `formatDateTimeDdMmYyyy()` — handles SQL datetime→UTC parse correctly for Asia/Ho_Chi_Minh timezone.
- `utils/revenuePlanning.ts` — `buildRevenueAdjustmentPlan()` — gap analysis between targets and actuals per period, `describeRevenueAdjustment()`.
- `utils/importParser.ts` (~1,400 lines) — Excel import with `getImportCell()`, alias matching
- `utils/exportUtils.ts` — CSV/Excel export
- `utils/productUnit.ts` — Use `normalizeProductUnitForSave()` / `formatProductUnitForDisplay()` / `formatProductUnitForExport()`. Never `normalizeProductUnit()` (deprecated).

**Pagination pattern** (server-side list tabs in App.tsx):
1. `*PageQueryRef` stores current query
2. `load*Page()` fetches with dedup + stale-response protection
3. `handle*PageQueryChange()` debounces via `schedulePageQueryLoad()` (250ms)
4. List component calls `onQueryChange(query)`

### Backend Architecture

**Controller pattern:**
- `V5MasterDataController.php` (~900KB) — Mega-controller for simple entities (products, departments, vendors, employees). Uses `hasColumn()`/`hasTable()` guards for schema resilience.
- Domain-specific controllers in `app/Http/Controllers/Api/V5/` — thin, delegate to DomainService.

**Backend service layers** (`app/Services/V5/`):
- `Domain/` — one DomainService per resource; business logic lives here
- `CustomerRequest/` — `CustomerRequestCaseDomainService` delegates to 5 sub-services:
  - `CustomerRequestCaseWriteService` — creates, transitions, worklogs
  - `CustomerRequestCaseReadQueryService` — list queries, filters, pagination
  - `CustomerRequestCaseReadModelService` — detail views, full-detail hydration
  - `CustomerRequestCaseDashboardService` — role-specific dashboard KPIs
  - `CustomerRequestCaseExecutionService` — status transition logic
- `Support/` — reusable cross-cutting helpers injected into DomainServices:
  - `LifecycleSupport` — opportunity stage definitions, entity lifecycle helpers
  - `OwnershipResolver` — resolves entity ownership/assignment
  - `PayloadMutationSupport` — request payload normalization
  - `QueryRequestSupport` — pagination/sort param parsing, `buildPaginationMeta()`
  - `SchemaCapabilityService` — `hasColumn()`/`hasTable()` schema introspection
  - `SettingsResolver` — integration settings lookup
- `app/Shared/Services/` — shared across all service layers:
  - `ColumnDetectionService`, `NormalizationService`, `PaginationService`, `SortingService`, `StatusMappingService`
- `V5DomainSupportService` — cross-cutting: column detection, pagination, serialization, sort resolution
- `FeeCollection/` — 4 services for invoice & receipt management:
  - `InvoiceDomainService` — CRUD, bulk generate from payment_schedules, overdue scope, dunning logs
  - `ReceiptDomainService` — CRUD, reversal pattern (negative offset), `reconcileInvoice()` auto-updates paid_amount/status
  - `FeeCollectionDashboardService` — KPIs (period-flow + balance), by-month, top debtors, urgent overdue
  - `DebtAgingReportService` — aging buckets (current/1-30/31-60/61-90/>90 days), debt-by-customer, debt trend
- `Revenue/` — 4 services for revenue analytics:
  - `RevenueOverviewService` — reconciled dashboard (contracts + invoices), period buckets, alerts
  - `RevenueTargetService` — targets CRUD + bulk, live achievement for open periods
  - `RevenueByContractService` — per-contract drill-down with schedule detail
  - `RevenueForecastService` — N-month horizon, by-month/by-status, expiring contract alerts
  - `RevenueReportService` — multi-dimension aggregation (department/customer/product/time)

**Workflow** (`app/Services/V5/Workflow/`):
- `StatusDrivenSlaResolver.php` — multi-level SLA matching (status → priority → service_group → customer)

**Auth** — Sanctum cookie-based. `vnpt_business_auth_token` (60min), `vnpt_business_refresh_token` (7d), `vnpt_business_tab_token` (session).

**Audit logging** — `V5AccessAuditService` records INSERT/UPDATE/DELETE/RESTORE to `audit_logs`. Sensitive fields auto-redacted via `AuditValueSanitizer`. Always call `$this->auditService->recordAuditEvent()` in new mutating endpoints.

**Caching** — `V5MasterDataController` uses `Cache::remember('v5:{resource}:list:v1', 15min)`, invalidated on write. Redis for cache + queues.

**Soft delete** — Most models use `SoftDeletes`. Unique constraints scoped via `whereNull('deleted_at')`.

**Routes** — All in `backend/routes/api.php` under `Route::prefix('v5')`. Kebab-case only (`/api/v5/customer-request-cases`). Legacy underscore aliases sunset 2026-04-27.

**Middleware stack** (applied to authenticated `v5` routes):
- `UseSanctumCookieToken` — extracts auth from `vnpt_business_auth_token` cookie
- `EnsureActiveTab` — multi-tab session control; evicts older tabs via `TAB_EVICTED` 409 response
- `EnforcePasswordChange` — blocks requests until first-login password reset
- `EnsurePermission` — role-based authorization (`permission:resource.action`)
- `RejectOversizedRequest` — rejects payloads exceeding size limit
- `SecurityHeaders` — adds security response headers
- `DeprecatedApiAlias` — maps legacy underscore routes to kebab-case, adds `Sunset` header

## Conventions

### Git Workflow

Branch naming: `username/task-name` (e.g., `tung/add-fee-collection-feature`).

Commit format:
```
<type>(<scope>): <message>

Types:  feat | fix | refactor | chore | test
Scopes: frontend | backend | database
```

Merge rule on conflict — **keep both sides**: never discard functions/logic from either `main` or the feature branch. Always merge `origin/main` into the feature branch before pushing.

### Protected files — ask before modifying

| Layer | Files / Patterns |
|-------|-----------------|
| Frontend | `App.tsx` (large refactors), existing state-management pattern, routing structure |
| Frontend utils | `revenueDisplay.ts`, `dateDisplay.ts`, `authorization.ts`, `importParser.ts`, `exportUtils.ts` |
| Backend core | `V5MasterDataController.php`, `routes/api.php`, middleware stack |
| Backend services | Existing DomainService pattern |
| Database | Existing schema tables — add new columns via migration only |

### Language
UI text in Vietnamese. Code, variables, comments in English. Some legacy DB column names in Vietnamese.

### API responses
Paginated: `{ data: [...], meta: { page, per_page, total, total_pages } }` — KPIs may be in `meta.kpis`.
Full lists: `{ data: [...] }`.

### Frontend
- **Form modals**: Use `ModalWrapper` with `width` prop. `onSave` is `Promise<void>` — modal owns `isSubmitting`. Parent `throw`s on failure.
- **URL state sync**: Each module prefixes params (e.g., `products_q`, `products_sort_key`) via `window.history.replaceState`.
- **Icons**: `<span className="material-symbols-outlined">icon_name</span>`
- **Currency**: `formatVietnameseCurrencyInput()` / `parseVietnameseCurrencyInput()` for inputs. Display: `formatCurrencyVnd()` / `formatCompactCurrencyVnd()` from `utils/revenueDisplay.ts` (preferred) or `toLocaleString('vi-VN') + ' đ'` (legacy).
- **Dates**: `formatDateDdMmYyyy()` / `formatDateTimeDdMmYyyy()` from `utils/dateDisplay.ts` — correctly handles UTC→local timezone for SQL datetimes.
- **CRUD in App.tsx**: `handleSave*` → try/catch → `addToast` → `void load*Page()`. `handleDelete*` → try/catch → remove from local state → refresh.
- **Notifications**: `useToastStore.getState().addToast('success'|'error', title, message)` for new code. Legacy code uses prop-drilled `addToast`.

### Backend
- **Validation**: `required` in store rules; `sometimes|required` in update rules. `Rule::unique()->ignore($id)` for updates.
- **Schema guards**: Always `$this->support->hasColumn($table, $col)` before accessing optional columns.
- **Config**: `config('vnpt_auth.cookie_name')` not hardcoded. Audit masking in `config/audit.php`.
- **Async exports**: Use `GenerateAsyncExportJob` (queued) for large exports.

## Customer Request Workflow System (CRC)

This is the most complex domain. Read this section before modifying.

### 12 Status Codes — 4 Groups

```
INTAKE:      new_intake → pending_dispatch → dispatched → waiting_customer_feedback
ANALYSIS:    analysis → returned_to_manager
PROCESSING:  in_progress → coding → dms_transfer
CLOSURE:     completed → customer_notified → not_executed
```

Sub-phases:
- `coding`: `coding_phase` = `coding | coding_done | upcode_pending | upcode_deployed`
- `dms_transfer`: `dms_phase` = `exchange | task_created | in_progress | completed`

### 3 Actor Roles
- **Creator (C)** — `received_by_user_id` — person who enters the request
- **Dispatcher (D)** — `dispatcher_user_id` — project PM who triages/assigns
- **Performer (P)** — `performer_user_id` — person who executes

### Database Design
Each status has a **dedicated table** (e.g., `customer_request_analysis`, `customer_request_in_progress`). Status definitions, valid tables, and form fields are in `CustomerRequestCaseRegistry.php` (single source of truth — do not hardcode status codes elsewhere).

`customer_request_status_instances` — immutable audit trail of transitions (`previous_instance_id`/`next_instance_id` linked list, `is_current` flag). Reports always use `status_instance_id`, not `GROUP BY status_code` (avoids merging repeated visits to same status).

Status transitions stored in `customer_request_status_transitions` table.

**Request code format**: Auto-generated `CRC-YYYYMM-NNNN`.

### Key Backend Files
- `CustomerRequestCaseRegistry.php` — status catalog, tables, form field configs
- `CustomerRequestCaseDomainService.php` (~1,250 lines) — orchestrates sub-services
- `CustomerRequestCaseExecutionService.php` — transition logic (`CustomerRequest/`)
- `CustomerRequestCaseWriteService.php` — create, worklog, estimate (`CustomerRequest/`)
- `CustomerRequestEscalationDomainService.php` — escalation CRUD (`Domain/`)
- `CustomerRequestPlanService.php` — weekly/monthly plans, carry-over (`Domain/`)
- `CustomerRequestReportService.php` — KPI, trend, pain points (`Domain/`)
- `LeadershipDashboardService.php` — leadership KPIs (trend, SLA, backlog) (`Domain/`)
- `LeadershipDirectiveService.php` — directives lifecycle (`Domain/`)

### Key Frontend Files
- `CustomerRequestManagementHub.tsx` (~9,300 lines) — primary hub, modal-driven transitions
- `components/customer-request/hooks/` — 10 custom hooks (one per concern)
- `CustomerRequestCreatorWorkspace.tsx`, `CustomerRequestDispatcherWorkspace.tsx`, `CustomerRequestPerformerWorkspace.tsx`, `CustomerRequestOverviewWorkspace.tsx` — role-specific UIs
- `CustomerRequestPlanWeekly.tsx`, `CustomerRequestPlanMonthly.tsx` — planning
- `CustomerRequestPlanBacklog.tsx` — unplanned cases backlog
- `LeadershipDashboard.tsx`, `LeadershipComparison.tsx`, `LeadershipRisks.tsx` — leadership views
- `EscalationList.tsx`, `EscalationCreateForm.tsx`, `EscalationReviewModal.tsx` — escalation
- `DirectiveCreateModal.tsx` — leadership directives
- `CodingProgressBar.tsx`, `DmsProgressBar.tsx` — sub-phase progress
- `CustomerRequestHoursPanel.tsx` — hours per status instance
- `CustomerRequestEstimatePanel.tsx` — estimate management
- `ReportMonthlyHoursByUser.tsx`, `ReportMonthlyHoursByProject.tsx`, `ReportTrend.tsx`, `ReportPainPoint.tsx` — reports

### Test Patterns
- Feature tests use `InteractsWithCustomerRequestCaseFixtures` trait
- Tests labeled by delivery phase (PhaseTwo, PhaseSix, etc.)
- Test files: `CustomerRequestCaseWorkflowCrudTest`, `CustomerRequestCaseWorkflowV4Test`, `CustomerRequestEscalationCrudTest`, `CustomerRequestPlanCrudTest`, `CustomerRequestReportServiceTest`

### Escalation & Directive Roles
```
Escalation creator:  PERFORMER or DISPATCHER
Directive lifecycle: open → acknowledged → implemented → closed
  - LEADER: create, close directives
  - DISPATCHER/PERFORMER: acknowledge
  - PERFORMER: mark implemented
All directives closed → escalation auto-resolves
```

### Hours Attribution Rule (worklogs → plan_items)
When a worklog is added, `actual_hours` updates the matching plan_item using:
1. Match by `work_date` within plan's `period_start..period_end`
2. Weekly plan prioritized over monthly via `CASE WHEN plan_type = 'weekly' THEN 0 ELSE 1 END`
3. Each worklog matches at most 1 plan_item (no double-count)
4. No matching plan → worklog saved, plan_item unchanged

### Overrun Warning Thresholds (G7)
Three levels on `customer_request_cases`: `warn_70_sent`, `warn_90_sent`, `warn_100_sent` flags.
Guard: skip if `estimated_hours` is null/zero.
Reset flags when estimate is revised.

## Legacy Status

- **System 1 (yeu_cau)**: 24 Vietnamese-named tables — dropped via migration `drop_legacy_workflow_tables`
- **System 2 (workflow_*)**: Generic workflow engine tables — dropped
- **System 3 (customer_request_cases)**: 21 tables, **currently active** — the only system
- `YeuCauManagementHub.tsx` — **removed**, replaced by `CustomerRequestManagementHub.tsx`
- Active plan: `plan-code/Nang_cap_quan_ly_yeu_cau_khach_hang_v5.md`

## Fee Collection & Revenue Management Module

### Sidebar Group: "Tài chính & Doanh thu"
Two tabs: `revenue_mgmt` (Quản trị Doanh thu, 5 sub-views) and `fee_collection` (Thu Cước, 4 sub-views).

### Fee Collection (Thu Cước) — `fee_collection` tab

**Status:** Active — design at `plan-code/Quan_ly_thu_cuoc.md`, audit at `plan-code/Doanh_thu_codex_plan_review.md`

Module for invoice management, receipt tracking, and debt reporting. Key design decisions:
- **Invoice status** — `DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID` (no persisted OVERDUE — computed `is_overdue` boolean field)
- **Receipt reversal** — keeps original CONFIRMED + adds negative CONFIRMED offset; `reconcileInvoice()` sums all CONFIRMED → net zero
- **1:1 cardinality** — one `payment_schedule` links to at most one `invoice`; `bulkGenerate()` creates 1 invoice per schedule
- **Overdue detection** — query-time only via `overdueScope()`: `due_date < today AND outstanding > 0 AND status ∈ {ISSUED, PARTIAL}`
- **Debt trend** — point-in-time: SUM invoice totals minus SUM confirmed receipts (constrained to those invoices) at each month-end
- **Outstanding** — `total_amount - paid_amount` computed in PHP (not DB GENERATED column) for MySQL version compat

Key backend files:
- `app/Http/Controllers/Api/V5/FeeCollectionController.php` — invoice CRUD, receipt CRUD, dunning, dashboard, debt reports
- `app/Services/V5/FeeCollection/InvoiceDomainService.php`
- `app/Services/V5/FeeCollection/ReceiptDomainService.php`
- `app/Services/V5/FeeCollection/FeeCollectionDashboardService.php`
- `app/Services/V5/FeeCollection/DebtAgingReportService.php`

Key frontend files:
- `FeeCollectionHub.tsx` — sub-view router with period selector
- `components/fee-collection/` — `InvoiceList`, `InvoiceModal`, `InvoiceBulkGenerateModal`, `ReceiptList`, `ReceiptModal`, `FeeCollectionDashboard`, `DebtAgingReport`

Permissions: `fee_collection.read`, `fee_collection.write`, `fee_collection.delete`

### Revenue Management (Quản trị Doanh thu) — `revenue_mgmt` tab

**Status:** Active — 5/5 sub-views operational

| Sub-view | Component | Backend |
|----------|-----------|---------|
| Tổng quan | `RevenueOverviewDashboard` | `RevenueOverviewService` — reconciled contracts + invoices |
| Theo hợp đồng | `RevenueByContractView` | `RevenueByContractService` — drill-down per contract |
| Theo thu cước | `RevenueByCollectionView` | reuses `FeeCollectionDashboardService` |
| Dự báo | `RevenueForecastView` | `RevenueForecastService` — 3/6/12 month horizon |
| Báo cáo | `RevenueReportView` | `RevenueReportService` — 4 dimensions |

Key backend files:
- `app/Http/Controllers/Api/V5/RevenueManagementController.php` — overview, targets CRUD, by-contract, forecast, report
- `app/Services/V5/Revenue/` — 5 service files

Key frontend files:
- `RevenueManagementHub.tsx` — sub-view router with Zustand-based state
- `shared/stores/revenueStore.ts` — shared period/dept/view state across sub-views
- `components/revenue-mgmt/` — 8 component files
- `utils/revenueDisplay.ts` — currency/period formatting (use these, not inline formatting)
- `utils/revenuePlanning.ts` — gap analysis between targets and actuals

Permissions: `revenue.read`, `revenue.targets`

### Database Tables (7 tables)

| Table | Purpose | SoftDeletes |
|-------|---------|-------------|
| `invoices` | Invoice headers: code INV-YYYYMM-NNNN, contract/customer links, amounts, status | ✓ |
| `invoice_items` | Line items per invoice (hard-delete+re-insert sync) | ✗ |
| `receipts` | Payment receipts: code RCP-YYYYMM-NNNN, reversal flags | ✓ |
| `dunning_logs` | Immutable dunning audit trail per invoice | ✗ |
| `revenue_targets` | Revenue goals by period/dept/type | ✓ |
| `revenue_snapshots` | Point-in-time revenue metrics for closed periods | ✗ |
| `payment_schedules.invoice_id` | 1:1 link payment_schedule → invoice | (FK extension) |

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **QLCV** (13802 symbols, 33286 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/QLCV/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/QLCV/context` | Codebase overview, check index freshness |
| `gitnexus://repo/QLCV/clusters` | All functional areas |
| `gitnexus://repo/QLCV/processes` | All execution flows |
| `gitnexus://repo/QLCV/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
