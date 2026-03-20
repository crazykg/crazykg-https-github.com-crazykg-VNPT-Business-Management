# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VNPT Business Management — an enterprise CRM/ERP system with React frontend and Laravel backend, managing contracts, projects, customers, employees, products, opportunities, and support requests.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev          # Vite dev server on http://127.0.0.1:5174 (proxies /api → backend:8002)
npm run build        # Production build
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
```

Run a single unit test file:
```bash
cd frontend && npx vitest run __tests__/authorization.test.ts
```

### Backend (from `backend/`)
```bash
composer setup                          # Full setup: install, env, key, migrate, npm build
composer dev                            # Starts server + queue + logs + vite concurrently
php artisan serve --host=127.0.0.1 --port=8002  # API server only (single-threaded)
composer test                           # PHPUnit tests (clears config first)
php artisan migrate                     # Run migrations
php artisan queue:listen --tries=1      # Process async jobs (exports, etc.)
```

For parallel requests during development (frontend makes concurrent API calls):
```bash
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=127.0.0.1 --port=8002
```

Run a single backend test:
```bash
cd backend && php artisan test --filter=CustomerRequestCaseWorkflowCrudTest
```

Test environment: SQLite `:memory:` with array cache/session and sync queue (`phpunit.xml`). No MySQL or Redis needed to run tests.

### Perf tests (from `perf/`)
```bash
npm run smoke                    # Quick smoke test across all modules
npm run load                     # Longer load test run
npm run contracts                # Scenario: contracts endpoints
npm run customer-request-cases   # Scenario: customer request cases
npm run dashboard                # Scenario: dashboard summary
npm run public                   # Baseline test (no auth required)
```

Env vars: `PERF_BASE_URL` (default: backend's APP_URL), `PERF_USERNAME`/`PERF_PASSWORD` (default: `admin.demo`/`password`), `PERF_OUTPUT` (JSON report path). Scenarios configured in `perf/scenarios.mjs`.

## Architecture

### Monorepo Structure
```
frontend/    → React 19 + Vite + TailwindCSS + TypeScript
backend/     → Laravel 12 + MySQL 8 + Redis + Sanctum
perf/        → API load testing scripts
plan-code/   → Upgrade plans (Vietnamese markdown docs)
```

### Frontend Architecture

**Centralized state in App.tsx** — All application state lives in `App.tsx` (~280KB) via `useState` hooks. No Redux/Zustand. Data is prop-drilled to child components. This is the single source of truth for all CRUD operations and modal state.

**API layer** — `services/v5Api.ts` (~177KB) wraps all HTTP calls via `apiFetch()`. Features: auto auth token refresh on 401, tab session eviction, GET request deduplication (`inFlightGetRequests` map), request cancellation via `cancelKey` + AbortController, and 45s timeout. All endpoints use `/api/v5/` prefix.

**Server-side pagination pattern** — For list tabs using server-side pagination, App.tsx follows a consistent pattern:
1. `*PageQueryRef` stores the current query
2. `load*Page()` fetches data with dedup (`pageQueryInFlightSignatureRef`) and stale response protection (`beginPageLoad`/`isLatestPageLoad`)
3. `handle*PageQueryChange()` wraps `schedulePageQueryLoad()` which debounces API calls by 250ms
4. List component calls `onQueryChange(query)` on search/sort/page changes

**Modal system** — `components/Modals.tsx` (~295KB) contains all modal components (form modals, delete confirmations, detail views). `ModalWrapper` provides the shell with header, scroll area, and close behavior. Footer buttons inside children scroll with content unless explicitly given `flex-shrink-0`.

**Permission system** — `utils/authorization.ts` exports `hasPermission(user, 'resource.action')`, `canAccessTab()`, and `canOpenModal()`. Backend enforces the same permissions on routes. Permission strings follow `resource.read`/`resource.write`/`resource.delete` pattern.

**Tab session** — `hooks/useTabSession.ts` enforces single active tab per browser session via `BroadcastChannel` + server-side tab tokens. Heartbeat every 30s. Backend returns `TAB_EVICTED` to force logout stale tabs.

**Data loading on tab switch** — `App.tsx` defines `TAB_DATA_REQUIREMENTS` mapping each tab to its required data slices (e.g., `clients: ['customers']`, `cus_personnel: ['customerPersonnel', 'customers', 'supportContactPositions']`). On tab change, only missing/stale data is fetched. Some tabs share data slices (e.g., `customers` is needed by clients, opportunities, projects, contracts).

**Key component mapping:**
- Each resource tab has a dedicated `*List.tsx` component (ProductList, CustomerList, etc.)
- `SearchableSelect` and `SearchableMultiSelect` are the standard dropdown components (support portal rendering, keyboard nav)
- `PaginationControls` handles all table pagination with URL query sync
- `Toast` provides notification system (`addToast(type, title, message)`) — supports `'success' | 'error'` types

**Key reference files:**
- `types.ts` (~48KB) — All TypeScript interfaces (AuthUser, Customer, Contract, Project, etc.). Check here first for data shapes.
- `constants.ts` (~18KB) — Mock data constants for unit tests.
- `utils/importParser.ts` (~43KB) — Excel import parsing with `getImportCell()`, header alias matching, row validation.
- `utils/exportUtils.ts` — CSV/Excel export with column formatting.

### Backend Architecture

**Controller pattern** — Two types of controllers:
- `V5MasterDataController.php` (~828KB): Mega-controller handling CRUD for simple entities (products, departments, vendors, employees). Uses dynamic column detection (`hasColumn`, `hasTable`) for resilience across DB schema variations.
- Domain-specific controllers in `app/Http/Controllers/Api/V5/`: One per resource (ContractController, ProjectController, CustomerController, etc.), each delegates to a corresponding DomainService.

**Service layer** — `app/Services/V5/Domain/` contains domain services (ContractDomainService, CustomerDomainService, ProjectDomainService, etc.) with business logic. `V5DomainSupportService` handles cross-cutting concerns (column detection, pagination, serialization, sort resolution).

**Workflow engine** — `app/Services/V5/Workflow/` provides status-driven workflows for customer requests with SLA resolution.

**Auth** — Laravel Sanctum with cookie-based tokens. `vnpt_business_auth_token` (60min), `vnpt_business_refresh_token` (7days), `vnpt_business_tab_token` (session).

**Middleware stack** — Authenticated route chain: `auth:sanctum → password.change → active.tab → throttle:api.write`. Per-route: `permission:{resource}.{action}` checks authorization. Global API middleware includes `RejectOversizedRequest`, `UseSanctumCookieToken` (reads token from cookie), and `SecurityHeaders`.

**Audit logging** — `V5AccessAuditService` records INSERT/UPDATE/DELETE/RESTORE events to `audit_logs` table. Sensitive fields (password, token, secret, etc.) are redacted via `AuditValueSanitizer` using keys from `config/audit.php`. When adding new data-mutating endpoints, call `$this->auditService->recordAuditEvent()`.

**Deprecated route aliases** — Legacy underscore routes (e.g., `/api/v5/customer_requests`) coexist with canonical kebab-case routes (`/api/v5/customer-requests`). The `deprecated.route` middleware adds `Deprecation`/`Sunset`/`Link` headers. All aliases sunset 2026-04-27. New routes should use kebab-case only.

**Caching** — `V5MasterDataController` caches list queries with `Cache::remember('v5:{resource}:list:v1', 15min)`. Cache is invalidated on create/update/delete. Redis is used for cache and queues.

**Soft delete** — Most models use Laravel `SoftDeletes` trait. Unique constraints (e.g., `customer_code`) are scoped to exclude soft-deleted records via `whereNull('deleted_at')`.

## Conventions

### General
- **Language**: UI text in Vietnamese. Code (variables, functions, comments) in English. Some legacy DB table names use Vietnamese (e.g., `yeu_cau`).
- **API responses**: `{ data: [...], meta: { page, per_page, total, total_pages } }` for paginated; `{ data: [...] }` for full lists. KPIs may be included in `meta.kpis`.

### Frontend
- **Product unit handling**: Use `normalizeProductUnitForSave()` for DB writes (preserves null), `formatProductUnitForDisplay()` for UI (shows "—"), `formatProductUnitForExport()` for exports (blank string). These live in `frontend/utils/productUnit.ts`. Never use the deprecated `normalizeProductUnit()`.
- **Form modals**: Use `ModalWrapper` with `width` prop (`max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl`). `onSave` should be `Promise<void>` — modal owns `isSubmitting` state with `try/finally`. Parent handler should `throw` on failure so the modal keeps state.
- **URL state sync**: List components sync filter/sort/pagination to URL query params via `window.history.replaceState`. Each module prefixes its params (e.g., `products_q`, `products_sort_key`).
- **Icons**: Material Symbols Outlined via `<span className="material-symbols-outlined">icon_name</span>`.
- **Currency formatting**: Use `formatVietnameseCurrencyInput()` / `parseVietnameseCurrencyInput()` for form inputs. Display with `toLocaleString('vi-VN')` + ` đ` suffix.
- **List component props pattern**: List components receive `canEdit`/`canDelete` booleans and `onNotify` callback (bound to `addToast`). Buttons for Edit/Delete/Add/Import are conditionally rendered based on these permission props.
- **CRUD handler pattern in App.tsx**: Each entity follows `handleSave*` (async, try/catch, addToast, then `void load*Page()` to refresh server-side list) and `handleDelete*` (async, try/catch, remove from local state, then refresh).
- **Import flow**: Excel import uses `getImportCell(row, headerIndex, aliasArray)` to match columns by normalized aliases. Validation failures are collected in a `failures[]` array and summarized via `summarizeImportResult()`. Supports rollback of partially imported rows.

### Backend
- **Vite proxy**: Frontend dev server proxies `/api/*` to `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8002`).
- **Backend validation**: Store rules use `required`; update rules use `sometimes|required`. Unique constraints use `Rule::unique()->ignore($id)` for updates, with soft-delete awareness.
- **Dynamic schema resilience**: Backend uses `hasColumn()`/`hasTable()` guards extensively to tolerate schema variations across environments. Always use `$this->support->hasColumn($table, $col)` before accessing optional columns.
- **Config files**: Auth cookie settings in `config/vnpt_auth.php`, audit field masking in `config/audit.php`. Use `config('vnpt_auth.cookie_name')` not hardcoded strings.
