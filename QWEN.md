# VNPT Business Management - QWEN.md

## Project Overview

VNPT Business Management is an enterprise CRM/ERP system for managing:
- **Contracts & Projects** - contract lifecycle, project procedures, RACI matrices
- **Customer Request Workflow (CRC)** - status-driven workflow with SLA tracking
- **Fee Collection & Revenue Management** - invoices, receipts, debt aging, revenue targets
- **Products, Customers, Employees, Departments, Opportunities**

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + TypeScript + TailwindCSS + Zustand |
| Backend | Laravel 12 + PHP 8.2+ + MySQL 8 + Redis |
| Auth | Laravel Sanctum (cookie-based) |
| Testing | Vitest (FE), PHPUnit (BE), Playwright (E2E), k6 (perf) |

### Monorepo Structure

```
qlcv2/
├── frontend/          # React 19 + Vite app (port 5174)
├── backend/           # Laravel 12 API (port 8002)
├── perf/              # k6 performance test scenarios
├── plan-code/         # Architecture/feature plans (Vietnamese)
├── database/          # SQL dumps, patches, schema docs
├── testcases/         # Manual test cases
└── docs/              # Documentation
```

---

## Building & Running

### Quick Start (Both Apps)

```bash
# Terminal 1 - Backend
cd backend
composer setup        # Full setup: install, env, key, migrate, npm build
composer dev          # Starts server + queue + logs + vite concurrently

# Terminal 2 - Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev           # Vite dev server on http://127.0.0.1:5174
```

### Frontend Commands

```bash
cd frontend
npm run dev           # Vite dev server (proxies /api → backend:8002)
npm run build         # Production build
npm run preview       # Preview production build
npm run lint          # TypeScript type-check (tsc --noEmit)
npm run test          # Vitest unit tests (run once)
npm run test:watch    # Vitest watch mode
npm run test:e2e      # Playwright E2E tests
```

Run single test:
```bash
npx vitest run __tests__/authorization.test.ts
```

### Backend Commands

```bash
cd backend
composer setup        # Full setup
composer dev          # Concurrent: server + queue + logs + vite
php artisan serve --host=127.0.0.1 --port=8002   # API only
composer test         # PHPUnit (clears config first)
php artisan migrate   # Run migrations
php artisan queue:listen --tries=1   # Async jobs
```

Run single test:
```bash
php artisan test --filter=CustomerRequestCaseWorkflowCrudTest
```

Useful artisan commands:
```bash
php artisan crc:snapshot-hours              # Generate previous month hours snapshot
php artisan crc:snapshot-hours 2026-03      # Specific month (YYYY-MM)
php artisan crc:snapshot-hours 2026-03 --force  # Overwrite existing
```

### Performance Testing

```bash
cd perf
npm run smoke                                    # Quick smoke test
PERF_BASE_URL=http://localhost:8002 npm run load  # Full load test
```

Env vars: `PERF_BASE_URL`, `PERF_USERNAME` (default `admin.demo`), `PERF_PASSWORD` (default `password`)

---

## Development Conventions

### Git Workflow

See [`GIT_RULES_WORKFLOWS.md`](./GIT_RULES_WORKFLOWS.md) for mandatory workflow.

**Branch naming:** `username/task-name` (e.g., `john/fix-contract-modal`)

**Commit format:**
```
<type>(<scope>): <message>

Types: feat | fix | refactor | chore | test
Scopes: frontend | backend | database
```

**Merge rule:** Always merge latest main before push. Follow "GIỮ CẢ HAI" principle - preserve code from both main and branch when resolving conflicts.

### Protected Files (Ask Before Modifying)

| Area | Files |
|------|-------|
| Frontend | `App.tsx` (large refactor), `utils/revenueDisplay.ts`, `utils/dateDisplay.ts`, `utils/authorization.ts`, `utils/importParser.ts`, `utils/exportUtils.ts` |
| Backend | `V5MasterDataController.php`, `routes/api.php`, middleware stack, DomainService patterns |

### Frontend Patterns

**State Management:** Zustand stores in transition
- `shared/stores/uiStore.ts` - active tab, sidebar
- `shared/stores/toastStore.ts` - notifications
- `shared/stores/revenueStore.ts` - revenue period/dept filters

**API Layer:** `services/v5Api.ts` - all HTTP calls via `apiFetch()` with:
- 401 auto-refresh
- Tab eviction (`TAB_EVICTED`)
- GET deduplication
- 45s timeout

**Key Utils:**
- `utils/revenueDisplay.ts` - `formatCurrencyVnd()`, `formatCompactCurrencyVnd()` (tỷ/tr/đ)
- `utils/dateDisplay.ts` - `formatDateDdMmYyyy()`, `formatDateTimeDdMmYyyy()` (UTC→Asia/Ho_Chi_Minh)
- `utils/productUnit.ts` - `normalizeProductUnitForSave()`, `formatProductUnitForDisplay()`

**Currency Input:** Use `formatVietnameseCurrencyInput()` / `parseVietnameseCurrencyInput()`

### Backend Patterns

**Service Layer:** Domain services in `app/Services/V5/`
- `Domain/` - one DomainService per resource
- `CustomerRequest/` - sub-services for case workflow
- `FeeCollection/` - invoice, receipt, dashboard, debt aging
- `Revenue/` - overview, targets, forecast, report

**Audit Logging:** Always call `$this->auditService->recordAuditEvent()` in mutating endpoints. Sensitive fields auto-redacted via `AuditValueSanitizer`.

**Schema Guards:** Always check `$this->support->hasColumn($table, $col)` before accessing optional columns.

**Soft Deletes:** Most models use `SoftDeletes`. Unique constraints scoped via `whereNull('deleted_at')`.

### API Response Format

Paginated:
```json
{
  "data": [...],
  "meta": { "page": 1, "per_page": 15, "total": 100, "total_pages": 7 }
}
```

KPIs may be in `meta.kpis`.

---

## Key Domain: Customer Request Workflow (CRC)

### 12 Status Codes

```
INTAKE:      new_intake → pending_dispatch → dispatched → waiting_customer_feedback
ANALYSIS:    analysis → returned_to_manager
PROCESSING:  in_progress → coding → dms_transfer
CLOSURE:     completed → customer_notified → not_executed
```

### 3 Actor Roles

| Role | Field | Responsibility |
|------|-------|----------------|
| Creator | `received_by_user_id` | Enters the request |
| Dispatcher | `dispatcher_user_id` | Project PM, triages/assigns |
| Performer | `performer_user_id` | Executes the work |

### Key Files

**Backend:**
- `CustomerRequestCaseRegistry.php` - status catalog (single source of truth)
- `CustomerRequestCaseDomainService.php` - orchestrates sub-services
- `CustomerRequestCaseExecutionService.php` - transition logic

**Frontend:**
- `CustomerRequestManagementHub.tsx` (~9,300 lines) - primary hub
- `components/customer-request/hooks/` - 10 custom hooks

---

## Fee Collection & Revenue Management

### Fee Collection (Thu Cước)

**Invoice Status:** `DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID`
- `OVERDUE` is computed (`is_overdue` boolean), not persisted

**Receipt Reversal:** Original CONFIRMED + negative CONFIRMED offset → net zero

**Key Tables:** `invoices`, `invoice_items`, `receipts`, `dunning_logs`

### Revenue Management

| Sub-view | Component | Backend Service |
|----------|-----------|-----------------|
| Tổng quan | `RevenueOverviewDashboard` | `RevenueOverviewService` |
| Theo hợp đồng | `RevenueByContractView` | `RevenueByContractService` |
| Theo thu cước | `RevenueByCollectionView` | `FeeCollectionDashboardService` |
| Dự báo | `RevenueForecastView` | `RevenueForecastService` |
| Báo cáo | `RevenueReportView` | `RevenueReportService` |

---

## Testing

### CI Pipeline (`.github/workflows/ci.yml`)

Three parallel jobs on every push/PR:
1. **Backend Tests** - PHP 8.4, SQLite, `php artisan test`
2. **Frontend Unit Tests** - Node 22, `npm test`
3. **Frontend E2E Tests** - Node 22, Playwright (Chromium), `npm run test:e2e`

### Test Environment

SQLite `:memory:`, array cache/session, sync queue (`phpunit.xml`). No MySQL/Redis needed.

---

## Authentication

Sanctum cookie-based:
- `vnpt_business_auth_token` (60min)
- `vnpt_business_refresh_token` (7d)
- `vnpt_business_tab_token` (session)

**Middleware Stack:**
1. `UseSanctumCookieToken` - extracts auth from cookie
2. `EnsureActiveTab` - multi-tab session control
3. `EnforcePasswordChange` - first-login password reset
4. `EnsurePermission` - role-based authorization
5. `RejectOversizedRequest` - payload size limit
6. `SecurityHeaders` - security response headers
7. `DeprecatedApiAlias` - legacy route mapping

---

## Language & Localization

- **UI text:** Vietnamese
- **Code/variables/comments:** English
- **Legacy DB columns:** Some Vietnamese names

---

## Related Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Comprehensive architecture & conventions |
| `GIT_RULES_WORKFLOWS.md` | Mandatory git workflow & coding rules |
| `VNPT_AUDIT_2026-02-28.md` | System audit report |
| `UI_CRUD_CHECKLIST_V5.md` | UI CRUD implementation checklist |
| `plan-code/` | Feature plans & architecture proposals |
