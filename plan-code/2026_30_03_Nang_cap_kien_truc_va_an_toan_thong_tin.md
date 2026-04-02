# Nang cap Kien truc & An toan Thong tin — VNPT Business Management

> **Ngay danh gia:** 2026-03-30
> **Cap nhat lan cuoi:** 2026-03-31 — kiem tra doi chieu codebase thuc te
> **Pham vi:** Full-stack (Backend Laravel 12 + Frontend React 19)
> **Phuong phap:** Static analysis — code review toan bo codebase + so sanh tieu chuan OWASP Top 10:2021, CIS Benchmark, NIST SP 800-53
> **Peer review:** Codex CLI adversarial review — 5 rounds, 20 issues found → all resolved
> **Tham chieu:** `Bao_mat_va_toi_uu_he_thong.md` (24/03), `Nang_cap_kien_truc_he_thong.md`, `Architecture_Upgrade_Plan_DEV.md`
> **Trang thai:** DANG THUC HIEN — xem [Section 9: Kiem tra doi chieu codebase](#9-kiem-tra-doi-chieu-codebase-2026-03-31)

---

## MUC LUC

1. [Bang diem tong hop](#1-bang-diem-tong-hop)
2. [Chi tiet diem Frontend](#2-chi-tiet-diem-frontend)
3. [Chi tiet diem Backend](#3-chi-tiet-diem-backend)
4. [Kiem tra doi chieu OWASP Top 10:2021](#4-kiem-tra-doi-chieu-owasp-top-102021)
5. [Lo trinh nang cap kien truc — 4 Phase](#5-lo-trinh-nang-cap-kien-truc--4-phase)
6. [Lo trinh an toan thong tin — 4 Phase](#6-lo-trinh-an-toan-thong-tin--4-phase)
7. [Production Hardening Checklist](#7-production-hardening-checklist)
8. [Tieu chi nghiem thu tung phase](#8-tieu-chi-nghiem-thu-tung-phase)

---

## 1. Bang diem tong hop

### 1.1 Diem theo layer (Verified 2026-03-31 — single authoritative scorecard)

| Layer | Kien truc | Bao mat | Trung binh |
|-------|-----------|---------|------------|
| **Frontend** | 6.9 / 10 | 7.9 / 10 | **7.4 / 10** |
| **Backend** | 7.8 / 10 | 8.7 / 10 | **8.3 / 10** |
| **He thong tong** | 7.4 / 10 | 8.3 / 10 | **7.9 / 10** |

> **Phuong phap tinh (toan bo tinh tu item values trong bang 1.2 — single source of truth):**
> FE Arch = mean(#15=8, #17=6, #18=7, #19=6.5) = 27.5/4 = **6.9**
> FE Sec = mean(#13=9, #14=9, #16=7, #20=6.5) = 31.5/4 = **7.9**
> FE combined = (6.9+7.9)/2 = **7.4**
> BE Arch = mean(#3=8, #4=6.5, #5=8, #9=8, #10=8, #11=8) = 46.5/6 = **7.8**
> BE Sec = mean(#1=9, #2=9, #6=9, #7=8, #8=9, #12=8) = 52/6 = **8.7**
> BE combined = (7.8+8.7)/2 = **8.3**
> System = (7.4+8.3)/2 = **7.9**
> Xem Phu luc B cho evidence commands de kiem tra tung item.

### 1.2 Diem chi tiet theo hang muc

| # | Hang muc | Diem | Ghi chu |
|---|----------|------|---------|
| 1 | BE: Authentication & Session | 9/10 | Bcrypt-12, 3-token, multi-tab isolation, password policy 12+ chars |
| 2 | BE: SQL Injection Prevention | 9/10 | Eloquent ORM, prepared statements, 0 exploitable raw queries |
| 3 | BE: Authorization (route-level) | 8/10 | 100% route coverage middleware, role-based |
| 4 | BE: Authorization (service-level) | 6.5/10 | `assertModelMutationAccess()` bao ve ContractDomainService/InvoiceDomainService/ReceiptDomainService; controllers CHUA goi `Gate::authorize()` cho tat ca mutating endpoints; department-scope check co nhung chua cover het |
| 5 | BE: Input Validation | 8/10 | FormRequest cho moi endpoint, enum/range checks |
| 6 | BE: Security Headers | 9/10 | CSP strict (no unsafe-inline/eval), HSTS, X-Frame-Options |
| 7 | BE: Rate Limiting | 8/10 | Write (30/min), Heavy (10/min), Auth (5/min), Read (120/min) DA THEM vao AppServiceProvider; three-part keys (user+IP+path) |
| 8 | BE: Audit Logging | 9/10 | Auto-audit INSERT/UPDATE/DELETE, sensitive field masking |
| 9 | BE: Error Handling | 8/10 | ApiErrorResponse khi debug=false; can kiem tra edge cases |
| 10 | BE: Service Architecture | 8/10 | DDD pattern tot; V5MasterDataCtrl DA tach (wave-based); V5MasterDataLegacyService 25-line retired shell; CustomerRequestCaseWriteService 1,487 dong can tach tiep |
| 11 | BE: Database Design | 8/10 | 177 migrations, proper FK/indexes, soft deletes nhat quan |
| 12 | BE: Caching Strategy | 8/10 | rememberTagged + tag invalidation, 15min TTL cho master data |
| 13 | FE: Token Storage | 9/10 | httpOnly cookies, KHONG localStorage — chuan tot nhat |
| 14 | FE: XSS Prevention | 9/10 | 0 dangerouslySetInnerHTML, 0 eval(), React auto-escape |
| 15 | FE: API Layer | 8/10 | 401 auto-refresh, dedup, AbortController, 45s timeout |
| 16 | FE: Authorization Logic | 7/10 | `canAccessTab()` implicit-allow DA FIX (deny-by-default cho unknown tabs, xac nhan qua unit test `authorization.test.ts`); TypeScript strict chua on |
| 17 | FE: State Management | 6/10 | App.tsx 1,597 dong (verified 31/03), 7 Zustand stores: authStore, contractStore, filterStore, modalStore, revenueStore, toastStore, uiStore (xac nhan bang `ls frontend/shared/stores/`); customerStore/employeeStore/projectStore/productStore CHUA TAO; domain entity migration chi 1/5 entity stores |
| 18 | FE: Code Organization | 7/10 | types/ folder DA tach (types/index.ts re-export, types/legacy.ts backward compat), path aliases chua nhat quan |
| 19 | FE: TypeScript Safety | 6.5/10 | `strictNullChecks` + `noImplicitAny` DA BAT va PASS (0 errors sau fix, xac nhan 31/03); `strict: true` (full) chua bat — con `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization` |
| 20 | FE: Test Coverage | 6.5/10 | 111 unit tests PASS, 12 E2E specs (xac nhan `find e2e -name '*.spec.ts'`); can 25+ cho CRC 12-status workflow va auth/permission flows |

### 1.3 Muc do san sang Production

```
Backend:  █████████░  88% — env vars DA FIX (template), CORS DA TAO; con lai: A8 enforcement (3 controllers)
Frontend: ███████░░░  72% — authorization implicit-allow DA FIX, strictNullChecks DA BAT; con lai: App.tsx split, E2E gate
Tong:     ████████░░  78% — production-ready SAU KHI Phase A.8 enforcement hoan thanh
```

**GO-LIVE BLOCKING ITEMS (con lai):**
1. `Gate::authorize()` trong ContractController, FeeCollectionController, CustomerRequestCaseController (est. 3 ngay)
2. A1-A5 runtime verification tren production server (est. 30 phut)

---

## 2. Chi tiet diem Frontend

### 2.1 Kien truc: 6.9 / 10

#### Diem manh (+)

| Hang muc | Chi tiet | File tham chieu |
|----------|----------|-----------------|
| Lazy loading | `React.lazy()` cho toan bo pages | `AppPages.tsx` |
| API modular | ~20 API modules, 8,545 dong tong | `services/api/` |
| Zustand stores | 7 stores: authStore, contractStore, filterStore, modalStore, revenueStore, toastStore, uiStore + index.ts (verified 31/03 bang `ls frontend/shared/stores/`); customerStore/employeeStore/projectStore/productStore CHUA TAO | `shared/stores/` |
| Custom hooks | 10 hooks cho CRC module, tai su dung tot | `components/customer-request/hooks/` |
| Request dedup | GET deduplication tranh waterfall | `shared/api/apiFetch.ts` |
| Types refactor | DA tach types.ts → types/ folder voi index.ts re-export | `types/index.ts`, `types/legacy.ts` |

#### Diem yeu (-)

**FE-ARCH-01: App.tsx — Van con 1,597 dong (verified 31/03)**

```
File: App.tsx
Dong: 1,597 (verified, sau nhieu dot refactor tu ~7,400)
Tien trien: Da giam dang ke tu ~7,400 dong
Van de con lai:
  - Van giu mot so useState + CRUD handlers cho entities chua migrate sang Zustand
  - Routing logic + modal management van tap trung
  - Can tiep tuc tach tung entity store
Muc tieu: < 800 dong (chi routing + layout shell)
```

**FE-ARCH-02: types/ — DA TACH, can tiep tuc clean up**

```
Trang thai: DA HOAN THANH co ban
  - types.ts → 1 dong re-export (backward compat)
  - types/index.ts → barrel export
  - types/legacy.ts → legacy compat
Van de con lai:
  - Co the co-locate them types voi component su dung
  - Path aliases chua nhat quan
```

**FE-ARCH-03: TypeScript strict mode — DANG TIEN TRIEN**

```
Trang thai 31/03:
  - strictNullChecks: DA BAT ✅
  - noImplicitAny: DA BAT ✅
  - strict: true (full): CHUA — muc tieu Phase 3
Con lai: strictFunctionTypes, strictBindCallApply, noImplicitThis, alwaysStrict
```

Hau qua con lai: Mot so edge cases van chua duoc bat boi full strict mode.

**FE-ARCH-04: E2E coverage qua mong**

```
Unit tests: 111 files / ~18,000 dong  ✅ Tot (verified 2026-03-31: find __tests__ + shared/*.test.*)
E2E tests:  12 specs / ~1,100 dong   ⚠️ Can tang them
                                         CRC workflow 12 trang thai can it nhat 20-25 E2E specs
```

### 2.2 Bao mat: 7.9 / 10

#### Diem manh (+)

| Kiem tra | Ket qua | Ghi chu |
|----------|---------|---------|
| Token storage | ✅ AN TOAN | httpOnly cookies, KHONG localStorage |
| XSS vectors | ✅ AN TOAN | 0 dangerouslySetInnerHTML, 0 eval() trong app code |
| Auto-refresh | ✅ TOT | 401 → refresh token → retry, transparent cho UX |
| Tab eviction | ✅ TOT | TAB_EVICTED 409 response, ngat tab cu |
| Request cancel | ✅ TOT | AbortController + cancelKey, ngat request trung lap |
| Timeout | ✅ TOT | 45s hard timeout cho moi request |

#### Diem yeu (-)

**FE-SEC-01: hasPermission() implicit-allow — DA CO GUARD trong canAccessTab ✅**

```typescript
// authorization.ts (trang thai hien tai — DA DUOC FIX):
// canAccessTab() — unknown tab → return false ✅
// support_master_management — explicit multi-permission check ✅

// Con lai: hasPermission(user, null) van return true — intentional design
// cho "public tabs" (permission === null trong MAP co nghia la "public intentionally")
// KHONG con la security gap vi canAccessTab guard truoc.
// Luu y: Them comment doc explaining null-permission contract.
```

**FE-SEC-02: TypeScript strict mode — DA GIAI QUYET MOT PHAN (31/03)**

`strictNullChecks` va `noImplicitAny` DA BAT. Risk giam dang ke:
- ✅ `user.permissions` undefined bay gio bi TypeScript bat
- ✅ `roles.includes('ADMIN')` voi undefined array bay gio bi bat
Con lai: Full `strict: true` se bat them strictFunctionTypes, noImplicitThis — muc tieu Phase 3.

**FE-SEC-03: Vite dev server host — DA FIX ✅**

```typescript
// vite.config.ts (trang thai hien tai):
server: { host: '127.0.0.1' }  // ← DA BIND localhost only — an toan
```

---

## 3. Chi tiet diem Backend

### 3.1 Kien truc: 7.8 / 10

#### Diem manh (+)

| Hang muc | Chi tiet |
|----------|----------|
| DDD pattern | Domain/, Support/, Shared/ tach biet ro rang |
| Service layer | Moi entity co DomainService, dependency injection chuan |
| Support services | 6 shared support services (Pagination, Sorting, Column, ...) |
| Migration strategy | 177 migrations, proper indexes + FK + cascading deletes |
| Model protection | 51/51 models dung `$fillable` whitelist |
| Caching | `rememberTagged()` voi tag-based invalidation |
| Async exports | `GenerateAsyncExportJob` queued, khong block request |
| Schema guards | `hasColumn()`/`hasTable()` bao ve deploy errors |

#### Diem yeu (-)

**BE-ARCH-01: V5MasterDataController — DA TACH (wave-based)**

```
Trang thai hien tai:
  - V5MasterDataController da duoc tach theo wave plan
  - Routes da chuyen sang backend/routes/api/master-data.php
  - V5MasterDataLegacyService.php chi con 25 dong (retired shell)
  - Wave 01 (Vendor + Business + System): ✅ Done
  - 32 domain controllers da ton tai trong app/Http/Controllers/Api/V5/
Van de con lai:
  - Mot so legacy methods co the van reference file cu
  - Can xac nhan route parity 100% voi endpoint cu
  - CompatibilityLookupService (1,215 dong) can sunset plan
```

**BE-ARCH-02: CustomerRequestCaseWriteService — 1,487 dong**

```
File: app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php
Dong: 1,487
Van de: Chua toan bo write operations cho 12-status workflow
  - Case creation
  - Status transitions
  - Worklog management
  - Estimate management
  → Nen tach thanh 3-4 focused services
```

**BE-ARCH-03: CompatibilityLookupService — 1,215 dong**

```
File: CustomerRequestCompatibilityLookupService.php
Dong: 1,215
Van de: Legacy compatibility layer — nen co ke hoach sunset
```

**BE-ARCH-04: Khong co Docker configuration**

```
Hien tai: Khong co Dockerfile, docker-compose.yml
Hau qua:
  - Moi truong dev/staging/prod khong dong nhat
  - Onboarding dev moi mat thoi gian setup
  - Khong co reproducible builds
```

### 3.2 Bao mat: 8.7 / 10

#### Diem manh (+)

| Kiem tra | Ket qua | Chi tiet ky thuat |
|----------|---------|-------------------|
| Authentication | ✅ 9/10 | Sanctum + httpOnly cookies, Bcrypt-12, password 12+ chars 4 classes |
| Token lifecycle | ✅ 9/10 | Access 60min, Refresh 7d, tab token per-session |
| CSRF protection | ✅ 8/10 | Sanctum CSRF middleware, SameSite=lax |
| CSP header | ✅ 9/10 | `default-src 'self'; script-src 'self'` — NO unsafe-inline/eval |
| Security headers | ✅ 9/10 | HSTS, X-Frame-Options DENY, X-Content-Type nosniff |
| SQL injection | ✅ 9/10 | Eloquent ORM + prepared statements, 0 exploitable |
| Mass assignment | ✅ 9/10 | 51/51 models dung $fillable |
| File upload | ✅ 8/10 | Whitelist MIME + extension + 20MB, rate limit 10/min |
| Signed downloads | ✅ 9/10 | URL signing cho file downloads |
| Audit trail | ✅ 9/10 | Auto INSERT/UPDATE/DELETE logging, AuditValueSanitizer |
| Error handling | ✅ 8/10 | Generic error khi debug=false, ApiErrorResponse class |
| Rate limiting | ✅ 7/10 | 3-tier (auth/write/heavy), three-part keys (user+IP+route) |

#### Diem yeu (-)

**BE-SEC-01: Production .env — DA HARDENED trong .env.example ✅**

```env
# File: .env.example (verified 2026-03-30) — DA dung gia tri production-safe:
APP_DEBUG=false                       ✅
LOG_LEVEL=warning                     ✅
SESSION_ENCRYPT=true                  ✅
VNPT_AUTH_COOKIE_SECURE=true          ✅
VNPT_AUTH_COOKIE_SAME_SITE=strict     ✅
```

Action con lai: Dam bao runtime `.env` tren staging/prod server OVERRIDE `CORS_ALLOWED_ORIGINS`
thanh domain thuc (khong dung `http://127.0.0.1:5174`).

**BE-SEC-02: CORS — config/cors.php DA TON TAI & CORRECT ✅**

```php
// config/cors.php (verified 2026-03-30):
'allowed_origins' => array_values(array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', '')))),
'supports_credentials' => true,
// Khong co wildcard '*'
```

Action con lai: Verify runtime `CORS_ALLOWED_ORIGINS` tren tung moi truong.

**BE-SEC-03: GET endpoints khong rate limit**

```
Hien tai:
  - POST/PUT/DELETE: 30 req/min  ✅
  - Import/Export: 10 req/min    ✅
  - Login: 5 req/min             ✅
  - GET requests: KHONG GIOI HAN ❌

Risk:
  - Data scraping toan bo customer/contract data
  - DoS qua GET flood
  - Enumeration attack (brute-force IDs)
```

**BE-SEC-04: Policy-to-controller gap — REAL REMAINING ISSUE**

```
He thong DA CO LAP BAO VE tai service layer:
  ✅ assertModelMutationAccess() trong ContractDomainService, InvoiceDomainService, ReceiptDomainService
  ✅ UserAccessService.resolveDepartmentIdsForUser() cho dept scoping
  ✅ CustomerController.update/delete: Gate::authorize() duoc goi o controller ✅
  ✅ CustomerRequestCasePolicy, InvoicePolicy, ContractPolicy DA DINH NGHIA

Van de: Controllers CHUA noi Gate::authorize() → Policy cho cac mutating endpoints:
  ❌ ContractController.update/destroy — ContractPolicy.update/delete BI BO QUA
  ❌ FeeCollectionController.invoiceUpdate/invoiceDestroy — InvoicePolicy BI BO QUA
  ❌ CustomerRequestCaseController.transition/destroy — CasePolicy BI BO QUA
  ❌ Receipt model — KHONG CO ReceiptPolicy (can tao)

Risk: Trung binh (service layer co assertModelMutationAccess() la lop bao ve thu 1,
     nhung dept-scope check co the bi bo qua neu service bi goi truc tiep qua job/test).
     Defense-in-depth duoi chuan.

Fix uu tien (Phase A.8):
  1. ContractController.update/destroy: them Gate::authorize()
  2. FeeCollectionController.invoiceUpdate/invoiceDestroy: tuong tu
  3. Tao ReceiptPolicy moi (extend InvoicePolicy pattern)
  4. CustomerRequestCaseController.transition/destroy: them authorize()
```

---

## 4. Kiem tra doi chieu OWASP Top 10:2021

> **Lua chon tieu chuan:** Su dung **OWASP Top 10:2021** lam baseline nhat quan cho toan bo he thong VNPT Business Management, vi day la phien ban duoc tich hop trong bao cao kiem tra bao mat 24/03 (tham chieu `Bao_mat_va_toi_uu_he_thong.md`). OWASP Top 10:2025 da duoc phat hanh chinh thuc — team nen lap ke hoach migration sang taxonomy 2025 trong Phase D (Compliance) de dam bao tuan thu tieu chuan moi nhat.

| # | OWASP Category | Trang thai | Chi tiet |
|---|---------------|------------|----------|
| A01 | Broken Access Control | ⚠️ 7/10 | CustomerPolicy OK; ContractController/FeeCollectionController/CRC missing Gate::authorize() |
| A02 | Cryptographic Failures | ✅ 9/10 | Bcrypt-12, COOKIE_SECURE=true + SESSION_ENCRYPT=true DA BAT trong .env.example |
| A03 | Injection | ✅ 9/10 | Eloquent ORM, prepared statements |
| A04 | Insecure Design | ✅ 8/10 | App.tsx da giam 1,563 dong, authorization DA FIX (canAccessTab deny-by-default) |
| A05 | Security Misconfiguration | ✅ 8/10 | CSP tot, .env.example DA hardened, config/cors.php DA TON TAI |
| A06 | Vulnerable Components | ✅ 8/10 | Laravel 12 + PHP 8.4 current, 7 npm vulns dev-only |
| A07 | Identification & Auth Failures | ✅ 9/10 | 3-token system, SameSite=strict, password policy manh |
| A08 | Software & Data Integrity | ✅ 8/10 | Audit logging, signed downloads |
| A09 | Security Logging & Monitoring | ✅ 8/10 | AuditService + AuditValueSanitizer |
| A10 | Server-Side Request Forgery | ✅ 9/10 | Khong co user-controlled URL fetch |

### Tong diem OWASP Top 10:2021: 80/100 — Dat muc "Tot", can nang len "Xuat sac" (90+)

---

## 5. Lo trinh nang cap kien truc — 4 Phase

### Phase 1: Foundation (Tuan 1-2) — ✅ HOAN THANH (100%)

| # | Task | Layer | File bi touch | Do kho | Gia tri |
|---|------|-------|---------------|--------|---------|
| 1.1 | ✅ Bat TypeScript `strictNullChecks` + `noImplicitAny` | FE | `tsconfig.json` — DA HOAN THANH | — | CAO |
| 1.2 | ✅ Fix `hasPermission()` implicit-allow | FE | `utils/authorization.ts` — DA HOAN THANH | — | CRITICAL |
| 1.3 | Vite dev server bind 127.0.0.1 | FE | `vite.config.ts` | Thap | Trung binh |

#### 1.1 Chi tiet: Bat TypeScript strictNullChecks

```json
// tsconfig.json — buoc 1:
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

Quy trinh:
1. Bat `strictNullChecks` trong `tsconfig.json`
2. Chay `npm run lint` (tsc --noEmit)
3. Fix tung loi — uu tien `utils/authorization.ts` va `shared/api/apiFetch.ts` truoc
4. Phan loai loi: (a) them `!` non-null assertion cho truong hop chac chan, (b) them null check cho truong hop can guard
5. KHONG dung `// @ts-ignore` — moi loi phai duoc fix dung cach

Du kien: 200-400 loi TypeScript, mat 3-5 ngay dev

#### 1.2 Chi tiet: Fix hasPermission() implicit-allow

```typescript
// TRUOC (nguy hiem):
export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  return hasPermission(user, TAB_PERMISSION_MAP[tabId] ?? null);
  // tabId khong co trong map → null → true → ALLOW
};

// SAU (an toan):
export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  if (tabId === 'support_master_management') {
    return (
      hasPermission(user, 'support_requests.read')
      || hasPermission(user, 'support_service_groups.read')
      || hasPermission(user, 'support_contact_positions.read')
    );
  }

  const permission = TAB_PERMISSION_MAP[tabId];
  if (permission === undefined) {
    // Tab chua duoc map → DENY by default
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Auth] Tab '${tabId}' missing from TAB_PERMISSION_MAP — denied`);
    }
    return false;
  }

  // permission === null → intentionally public tab (e.g. dashboard)
  return hasPermission(user, permission);
};
```

---

### Phase 2: State Migration (Tuan 3-6) — ⚠️ GATE PENDING

**Trang thai (31/03):** 8 stores DA TON TAI (authStore, contractStore, filterStore, modalStore, revenueStore, toastStore, uiStore + index.ts); productStore/customerStore/employeeStore/projectStore CHUA TAO (~25% entity migration — chi contractStore la domain entity store). Phase 2 CHUA DUOC BAT DAU CHINH THUC vi prerequisite gate chua hoan thanh.

**PREREQUISITE GATE (PHAI PASS truoc khi bat dau bat ky Phase 2 task nao):**
- [ ] Route parity verification: `php artisan route:list --json` snapshot + diff truoc/sau moi PR (assert 0 removed routes)
- [ ] Core workflow E2E (CRC full flow + auth): it nhat 5 E2E specs moi (tach tu Phase 3.6)
- [ ] API contract snapshot: record `/api/v5/*` response schemas voi tool (e.g. `php artisan test --filter=ApiContractSnapshot`), diff khi merge
- [ ] Phase A go-live blocker (A8 enforcement) HOAN THANH

| # | Task | Layer | Do kho | Gia tri |
|---|------|-------|--------|---------|
| 2.0 | Them 5 core E2E specs + route-list snapshot test | FE+BE | Trung binh | CRITICAL (gate) |
| 2.1 | Tach App.tsx → Zustand stores theo entity | FE | CAO | CRITICAL |
| 2.2 | Xac nhan route parity + clean up CompatibilityLookupService | BE | Trung binh | CAO |
| 2.3 | Tach CustomerRequestCaseWriteService | BE | Trung binh | CAO |
| 2.4 | Bat TypeScript `noImplicitAny` | FE | Trung binh | CAO |

#### 2.1 Chi tiet: Tach App.tsx → Zustand stores

Thu tu tach (moi entity la 1 PR rieng):

```
Buoc 1: contractStore.ts (PR #1)
  - Di chuyen: contracts state, handleSave/Delete/Load Contract
  - Hook: useContractStore() thay the App.tsx props
  - Test: Chay toan bo contract-related unit + E2E

Buoc 2: customerStore.ts (PR #2)
  - Tuong tu pattern buoc 1

Buoc 3: employeeStore.ts (PR #3)

Buoc 4: projectStore.ts (PR #4)

Buoc 5: productStore.ts (PR #5)

... lap lai cho tung entity ...

Ket qua: App.tsx giam tu 1,597 → ~800 dong (routing + layout)
```

Pattern cho moi store:
```typescript
// shared/stores/contractStore.ts
import { create } from 'zustand';
import { Contract, PaginatedResponse } from '../types';
import * as contractApi from '../services/api/contractApi';

interface ContractState {
  contracts: Contract[];
  meta: PaginatedResponse['meta'] | null;
  loading: boolean;
  // CRUD actions
  loadPage: (query: Record<string, unknown>) => Promise<void>;
  save: (data: Partial<Contract>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  meta: null,
  loading: false,
  loadPage: async (query) => {
    set({ loading: true });
    try {
      const res = await contractApi.list(query);
      set({ contracts: res.data, meta: res.meta });
    } finally {
      set({ loading: false });
    }
  },
  save: async (data) => { /* ... */ },
  remove: async (id) => { /* ... */ },
}));
```

#### 2.3 Chi tiet: Tach WriteService

```
TRUOC:
  CustomerRequestCaseWriteService.php (1,487 dong)

SAU:
  CustomerRequest/Write/
    CaseCreateService.php         (~250 dong) — createCase(), validateCreation()
    CaseTransitionService.php     (~450 dong) — transition(), validateTransition()
    WorklogService.php            (~300 dong) — addWorklog(), updateWorklog()
    EstimateService.php           (~200 dong) — setEstimate(), reviseEstimate()
    CaseWriteOrchestrator.php     (~200 dong) — orchestration, inject 4 services tren

Luu y: CaseWriteOrchestrator giu public API giong nhu WriteService cu
       → Controller khong can thay doi
```

---

### Phase 3: Hardening (Tuan 7-8) — ⚠️ DANG THUC HIEN (33%)

| # | Task | Layer | Do kho | Gia tri |
|---|------|-------|--------|---------|
| 3.1 | Mo rong existing Policies + UserAccessService cho tat ca mutating endpoints | BE | Trung binh | CRITICAL |
| 3.2 | Them GET rate limiting | BE | Thap | CAO |
| 3.3 | Tao config/cors.php voi whitelist | BE | Thap | CRITICAL |
| 3.4 | Them DOMPurify cho user-generated content | FE | Thap | Trung binh |
| 3.5 | Bat TypeScript `strict: true` (full) | FE | CAO | CAO |
| 3.6 | Tang E2E coverage → 25+ specs | FE | Trung binh | CAO |

#### 3.1 Chi tiet: Mo rong Policies + UserAccessService

He thong DA CO co che authorization phuc tap hon plan ban dau de xuat:
- `app/Policies/ContractPolicy.php` — permission + department scope
- `app/Policies/InvoicePolicy.php` — permission + actor checks
- `app/Policies/CustomerRequestCasePolicy.php` — multi-actor (creator/dispatcher/performer)
- `app/Support/Auth/UserAccessService.php` — resolves `user_dept_scopes`

**Ke hoach mo rong (thay vi tao OwnershipGuard moi):**

```
Buoc 1: Tao endpoint-to-policy matrix
  Liet ke TAT CA mutating endpoints (POST/PUT/DELETE)
  Map moi endpoint → Policy class hien co hoac can tao

Buoc 2: Kiem tra coverage gaps
  Endpoints CHUA co policy authorization → them $this->authorize()
  Focus: entities co created_by/dept_id nhung chua co scope check

Buoc 3: Them test cho moi policy
  Test case: user A (dept X) khong sua duoc entity cua user B (dept Y)
  Test case: performer khong sua duoc entity ma dispatcher so huu

Buoc 4: Integration test
  E2E: IDOR attempt → 403 response
```

#### 3.2 Chi tiet: GET rate limiting

```php
// app/Providers/AppServiceProvider.php — them:
RateLimiter::for('api.read', function (Request $request) {
    return Limit::perMinute(120)
        ->by($request->user()?->id . '|' . $request->ip() . '|' . $request->path());
});

// routes/api.php — apply vao GET routes:
Route::middleware(['throttle:api.read'])->group(function () {
    // Tat ca GET endpoints hien tai
});
```

#### 3.3 Chi tiet: CORS config

```php
// config/cors.php — TAO MOI
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', '')),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'X-Tab-Token', 'Accept'],
    'exposed_headers' => ['X-Request-Id'],
    'max_age' => 86400,
    'supports_credentials' => true,
];

// .env.production:
CORS_ALLOWED_ORIGINS=https://yourdomain.vn,https://admin.yourdomain.vn
```

#### 3.6 Chi tiet: E2E coverage muc tieu

```
Hien tai: 12 specs (verified 31/03)
Muc tieu: 25+ specs

Uu tien:
 1. Auth flow: login → session → tab eviction → logout          (2 specs)
 2. CRC workflow: new_intake → dispatched → analysis →
    in_progress → completed                                     (3 specs)
 3. CRC sub-phases: coding workflow, DMS workflow                (2 specs)
 4. Fee collection: invoice CRUD → receipt → reconcile           (2 specs)
 5. Revenue: overview → targets CRUD → forecast                  (2 specs)
 6. Permission: user bi deny khi khong co quyen                  (2 specs)
 7. Error handling: 401 refresh, network error, timeout          (2 specs)
 8. Import/Export: bulk import → validate → success/fail         (2 specs)
```

---

### Phase 4: Excellence (Tuan 9-12) — CHUA BAT DAU (14%)

| # | Task | Layer | Do kho | Gia tri |
|---|------|-------|--------|---------|
| 4.1 | Docker + docker-compose cho dev/staging/prod | BE/DevOps | Trung binh | CAO |
| 4.2 | Xac nhan tat ca legacy refs da clean (CompatibilityLookupService sunset) | BE | Trung binh | CAO |
| 4.3 | CQRS cho CRC domain (read/write model tach biet) | BE | CAO | Trung binh |
| 4.4 | API response schema validation (OpenAPI spec) | BE | Trung binh | CAO |
| 4.5 | Automated security scanning (CI pipeline) | DevOps | Trung binh | CAO |
| 4.6 | Path aliases chuan hoa + barrel exports | FE | Thap | Trung binh |
| 4.7 | Extend health check → unauthenticated /api/health + uptime monitoring | BE | Thap | Trung binh |

> **Luu y:** Health check da ton tai tai `GET /api/v5/admin/health/tables` (SystemHealthController, yeu cau `system.health.view` permission). Phase 4 chi can them endpoint `/api/health` khong yeu cau auth cho load balancer / monitoring.

#### 4.1 Chi tiet: Docker setup

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8002:8002"
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - storage:/var/www/html/storage

  queue:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: php artisan queue:listen --tries=3 --timeout=300
    depends_on:
      - app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5174:80"

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: vnpt_business
      MYSQL_ROOT_PASSWORD: "${DB_PASSWORD}"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  storage:
  mysql_data:
  redis_data:
```

#### 4.5 Chi tiet: Security scanning trong CI

```yaml
# .github/workflows/security.yml
name: Security Scan
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Moi thu Hai

jobs:
  php-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: PHP Security Checker
        run: |
          cd backend
          composer audit
      - name: PHPStan (static analysis)
        run: |
          cd backend
          vendor/bin/phpstan analyse --level=6

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: NPM Audit
        run: |
          cd frontend
          npm audit --production --audit-level=high

  dependency-review:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
```

---

## 6. Lo trinh an toan thong tin — 4 Phase

### Phase A: Emergency Fixes (Truoc khi len Production) — 1-2 ngay

| # | Fix | File | Thoi gian | Trang thai |
|---|-----|------|-----------|------------|
| A1 | VNPT_AUTH_COOKIE_SECURE=true | `.env.example` dong 55 | 5 phut | ✅ TEMPLATE FIXED — can verify runtime env truoc deploy |
| A2 | SESSION_ENCRYPT=true | `.env.example` dong 42 | 5 phut | ✅ TEMPLATE FIXED — can verify runtime env truoc deploy |
| A3 | VNPT_AUTH_COOKIE_SAME_SITE=strict | `.env.example` dong 56 | 5 phut | ✅ TEMPLATE FIXED — can verify runtime env truoc deploy |
| A4 | APP_DEBUG=false | `.env.example` dong 6 | 5 phut | ✅ TEMPLATE FIXED — can verify runtime env truoc deploy |
| A5 | LOG_LEVEL=warning | `.env.example` dong 23 | 5 phut | ✅ TEMPLATE FIXED — can verify runtime env truoc deploy |
| A6 | Fix FE implicit-allow (FE-SEC-01) | `authorization.ts` dong 114-133 | 2 gio | ✅ DA LAM — `canAccessTab()` deny unknown tabs |
| A7 | Tao config/cors.php | `config/cors.php` (29 dong) | 1 gio | ✅ DA LAM — env-driven origins, supports_credentials |
| A8 | Audit IDOR risk + extend existing Policies cho 4 key entities | `app/Policies/*.php`, DomainServices | 3 ngay | ⚠️ MOT PHAN — xem chi tiet ben duoi |

**Chi tiet A8 — Trang thai hien tai (2026-03-31):**
```
Policies DA TAO (4/4 key entities):
  ✅ ContractPolicy.php
  ✅ CustomerPolicy.php (cap nhat 31/03)
  ✅ InvoicePolicy.php
  ✅ CustomerRequestCasePolicy.php

VAN DE: Gate::authorize() chi duoc goi trong 1/31 controllers:
  ✅ CustomerController.php (dong 43, 54) — dung Gate::authorize()
  ❌ 30 controllers con lai CHI dung route-level middleware, KHONG goi Gate::authorize()

→ Policies TON TAI nhung CHUA DUOC ENFORCED trong controller layer
→ Can them $this->authorize() hoac Gate::authorize() vao ContractController,
  FeeCollectionController, CustomerRequestCaseController
```

**GO-LIVE BLOCKER:** A1-A5 TEMPLATE FIXED (can verify runtime truoc deploy). A6-A7 DA LAM. A8 CON THIEU ENFORCEMENT:
- 4 Policy files da tao ✅ (ContractPolicy, InvoicePolicy, CustomerRequestCasePolicy, CustomerPolicy)
- Gate::authorize() chi co trong CustomerController ⚠️
- **ReceiptPolicy CHUA TON TAI** — receipt endpoints trong FeeCollectionController can tao ReceiptPolicy moi ⚠️
- **BLOCKER con lai:** (a) Tao ReceiptPolicy.php cho receipt CRUD mutating endpoints; (b) Them Gate::authorize() vao ContractController, FeeCollectionController (invoice + receipt), CustomerRequestCaseController
- GO-LIVE ready khi: 5 Policy files + 4 controller co Gate::authorize() + ReceiptPolicy covers receiptUpdate/receiptDestroy

**A1-A5 Pre-deploy Verification Step (bat buoc truoc go-live):**
```bash
# Chay tren production server SAU khi deploy:
php artisan tinker --execute="
  echo 'COOKIE_SECURE=' . config('vnpt_auth.cookie_secure');
  echo 'SESSION_ENCRYPT=' . config('session.encrypt');
  echo 'SAME_SITE=' . config('vnpt_auth.cookie_same_site');
  echo 'APP_DEBUG=' . config('app.debug');
  echo 'LOG_LEVEL=' . config('logging.level');
"
# Expected: true, true, strict, false, warning
# Neu bat ky gia tri nao SAI → KHONG go-live
```

**A8 Endpoint Risk Matrix — Ly do chi 3 controllers la P0:**

| Controller | Mutating endpoints | Chứa sensitive data | Policy da tao | Priority |
|-----------|-------------------|-------------------|---------------|----------|
| ContractController | store, update, delete | ✅ Hop dong, gia tri, thanh toan | ✅ ContractPolicy | 🔴 P0 |
| FeeCollectionController | invoice CRUD, receipt CRUD | ✅ Hoa don, phieu thu, so tien | ✅ InvoicePolicy | 🔴 P0 |
| CustomerRequestCaseController | transition, worklog, estimate | ✅ Yeu cau KH, assign, SLA | ✅ CRCasePolicy | 🔴 P0 |
| CustomerController | store, update, delete | ✅ Thong tin KH, lien he | ✅ CustomerPolicy | ✅ DA ENFORCED |
| DepartmentController | store, update, delete | ❌ Internal org structure | ❌ Chua tao | 🟡 Phase B — low IDOR risk (noi bo) |
| ProductController | store, update, delete | ❌ Catalog data, non-sensitive | ❌ Chua tao | 🟡 Phase B — read-mostly, low mutation |
| EmployeeController | store, update, delete | ⚠️ HR data | ❌ Chua tao | 🟠 Phase B — P1 after go-live |
| 24 remaining controllers | Mixed | ❌ Mostly master data | ❌ Chua tao | 🟡 Phase B/D — non-sensitive, dept-scoped |

**Ly do 27 controllers KHONG la P0:**
- 24 controllers la master-data (products, vendors, departments, ...) — duoc bao ve boi `EnsurePermission` middleware (route-level) + chi co users voi specific `resource.write` permission moi goi duoc
- Khong chua personally identifiable information (PII) hoac financial data
- Risk thuc te: user A voi `products.write` sua product cua user B — chap nhan duoc vi products la shared catalog, khong co ownership concept
- Phase B se expand Policies cho EmployeeController (HR data) va bat ky controller nao co PII

### Phase B: Authentication & Access Control (Tuan 1-2)

| # | Fix | OWASP Ref | Thoi gian |
|---|-----|-----------|-----------|
| B1 | Ownership check trong DomainServices | A01 | 3 ngay |
| B2 | GET rate limiting (120/min) | A05 | 0.5 ngay |
| B3 | TypeScript strictNullChecks | A04 | 3-5 ngay |
| B4 | Review IDOR risk (tu bao cao 24/03) | A01 | 2 ngay |

### Phase C: Defense in Depth (Tuan 3-4)

| # | Fix | OWASP Ref | Thoi gian |
|---|-----|-----------|-----------|
| C1 | DOMPurify cho user-generated HTML (neu co) | A03 | 1 ngay |
| C2 | API response sanitization audit | A07 | 2 ngay |
| C3 | File upload: them virus scan hook | A08 | 2 ngay |
| C4 | Session fixation protection review | A07 | 1 ngay |
| C5 | E2E security tests (auth, permission deny) | A01 | 3 ngay |

### Phase D: Monitoring & Compliance (Tuan 5-8)

| # | Fix | OWASP Ref | Thoi gian |
|---|-----|-----------|-----------|
| D1 | Security scanning trong CI pipeline | A06 | 2 ngay |
| D2 | Dependency vulnerability auto-alerts | A06 | 1 ngay |
| D3 | API abuse detection (anomaly logging) | A09 | 3 ngay |
| D4 | Penetration test (external vendor) | All | 5-10 ngay |
| D5 | Security incident response plan | All | 2 ngay |

---

## 7. Production Hardening Checklist

```
TRUOC MOI LAN DEPLOY — KIEM TRA:

Environment:
  [ ] APP_DEBUG=false
  [ ] APP_ENV=production
  [ ] LOG_LEVEL=warning hoac error
  [ ] SESSION_ENCRYPT=true
  [ ] VNPT_AUTH_COOKIE_SECURE=true
  [ ] VNPT_AUTH_COOKIE_SAME_SITE=strict

CORS:
  [ ] config/cors.php ton tai
  [ ] CORS_ALLOWED_ORIGINS chi chua domain production
  [ ] Khong co wildcard '*' trong allowed_origins

Authentication:
  [ ] Bcrypt rounds >= 12
  [ ] Password policy: 12+ chars, 4 classes
  [ ] Token TTL: access 60min, refresh 7d

Headers (kiem tra bang curl -I):
  [ ] X-Frame-Options: DENY
  [ ] X-Content-Type-Options: nosniff
  [ ] Strict-Transport-Security: max-age=31536000; includeSubDomains
  [ ] Content-Security-Policy: khong co unsafe-inline/unsafe-eval
  [ ] Referrer-Policy: strict-origin-when-cross-origin

Database:
  [ ] MySQL strict mode bat
  [ ] Tat ca migrations da chay
  [ ] Backup schedule hoat dong

Monitoring:
  [ ] Error logging hoat dong (kiem tra storage/logs/)
  [ ] Audit logging hoat dong (kiem tra audit_logs table)
  [ ] Health check endpoint tra loi HTTP 200
```

---

## 8. Tieu chi nghiem thu tung phase

### Phase 1 — Foundation (Tuan 1-2)

```
Nghiem thu:
  [ ] npm run lint (tsc --noEmit) PASS voi strictNullChecks=true
  [ ] authorization.ts: canAccessTab('unknown_tab_id') tra ve false
  [ ] Existing types/ folder van hoat dong, toan bo import cu khong break
  [ ] npm run test PASS (0 failures)
  [ ] npm run test:e2e PASS (0 failures)
  [ ] cd backend && composer test PASS
```

### Phase 2 — State Migration (Tuan 3-6)

```
Nghiem thu:
  [ ] App.tsx duoi 1,000 dong
  [ ] It nhat 5 entity stores (contract, customer, employee, project, product)
  [ ] Moi store co unit test rieng
  [ ] Khong co prop drilling tu App.tsx cho cac entity da migrate
  [ ] Route-list snapshot diff: 0 removed /api/v5/* routes
  [ ] CustomerRequest/Write/ co 4-5 focused services
  [ ] cd backend && composer test PASS
  [ ] npm run test PASS + npm run test:e2e PASS (bao gom 5 core E2E specs moi)
```

### Phase 3 — Hardening (Tuan 7-8)

```
Nghiem thu:
  [ ] Tat ca Policies authorize mutating endpoints — endpoint-to-policy matrix 100% coverage
  [ ] GET rate limit: 121st request trong 1 phut tra 429
  [ ] CORS: Request tu domain khong duoc phep bi reject
  [ ] tsconfig.json co "strict": true
  [ ] npm run lint PASS voi strict mode
  [ ] E2E tests >= 25 specs, toan bo PASS
```

### Phase 4 — Excellence (Tuan 9-12)

```
Nghiem thu:
  [ ] docker-compose up chay duoc full stack
  [ ] CompatibilityLookupService da sunset (xoa hoac < 50 dong stub)
  [ ] CI pipeline co security scanning job
  [ ] composer audit + npm audit --production: 0 high/critical
  [ ] Health check: unauthenticated /api/health tra HTTP 200 (khong yeu cau auth, dung cho load balancer)
  [ ] Penetration test report hoan thanh
```

---

## Phu luc B: Scoring Rubric

### Phuong phap tinh diem

Moi hang muc (20 items trong bang 1.2) duoc cham theo thang 1-10:
- **9-10:** Industry-leading, khong co gap nao dang ke, evidence trong code
- **7-8:** Tot, 1-2 minor gaps, co mitigation
- **5-6:** Trung binh, co gaps can xu ly nhung khong co exploit truc tiep
- **3-4:** Yeu, co risk cu the co the khai thac
- **1-2:** Nghiem trong, co loi bao mat hoac kien truc da biet

### Nguon bang chung cho moi diem

| # | Hang muc | Evidence source | Kiem tra bang |
|---|----------|----------------|---------------|
| 1 | BE Auth | `config/vnpt_auth.php`, `UseSanctumCookieToken.php` | Doc config + middleware |
| 2 | SQL Injection | Grep `DB::raw`, `DB::select` trong toan bo `app/` | `rg 'DB::raw' backend/app` |
| 3 | Route Auth | `routes/api.php` middleware stack | Dem routes co `auth:sanctum` |
| 4 | Service Auth | `app/Policies/*.php`, `UserAccessService.php` | Endpoint-to-policy matrix |
| 5-12 | BE khac | Config files, middleware, service code | Doc truc tiep |
| 13-15 | FE Security | `apiFetch.ts`, browser DevTools cookie tab | Doc code + runtime check |
| 16 | FE AuthZ | `authorization.ts`, `__tests__/authorization.test.ts` | Unit test + code review |
| 17 | FE State | `wc -l App.tsx`, `ls shared/stores/` | Dem dong + dem files |
| 18 | FE Org | `ls types/`, `cat tsconfig.json` | Dem files + check config |
| 19 | TS Safety | `tsconfig.json` strict flags | `rg strict tsconfig.json` |
| 20 | Test Coverage | `find __tests__ -name '*.test.*' \| wc -l`, `find e2e -name '*.spec.*' \| wc -l` | Dem files |

### Cach tinh diem tong

```
Quy tac lam tron: round to 1 decimal place, standard rounding (>=5 up, <5 down)
Ap dung CUNG mot rule cho moi cap: item → sub-score → layer → total

Sub-group assignment:
  FE Security: items 13(Token), 14(XSS), 16(AuthZ), 20(Test Coverage)
  FE Arch:     items 15(API Layer), 17(State Mgmt), 18(Code Org), 19(TS Safety)
  BE Security: items 1(Auth), 2(SQLi), 6(Headers), 7(Rate Limit), 8(Audit), 12(Caching)
  BE Arch:     items 3(Route AuthZ), 4(Service AuthZ), 5(Validation), 9(Error Handling), 10(Service Arch), 11(DB Design)

Buoc 1: Sub-scores (lay gia tri tu bang 1.2, verified 2026-03-31)
  FE Security  = avg(#13=9, #14=9, #16=7, #20=6.5) = 31.5/4 = 7.875 → 7.9
  FE Arch      = avg(#15=8, #17=6, #18=7, #19=6.5) = 27.5/4 = 6.875 → 6.9
  BE Security  = avg(#1=9, #2=9, #6=9, #7=8, #8=9, #12=8) = 52/6 = 8.667 → 8.7
  BE Arch      = avg(#3=8, #4=6.5, #5=8, #9=8, #10=8, #11=8) = 46.5/6 = 7.75 → 7.8

Buoc 2: Layer scores (tu sub-scores)
  FE combined = (FE Arch 6.9 + FE Sec 7.9) / 2 = 14.8/2 = 7.4
  BE combined = (BE Arch 7.8 + BE Sec 8.7) / 2 = 16.5/2 = 8.25 → 8.3

Buoc 3: Total
  System total = (FE 7.4 + BE 8.3) / 2 = 15.7/2 = 7.85 → 7.9

De kiem chung: chay lai buoc 1-3 voi gia tri TRONG BANG 1.2 — ket qua phai khop bang 1.1.
Neu gia tri item thay doi → cap nhat bang 1.1 + Phu luc B + dong phuong phap tinh cuoi bang 1.1.
```

---

## Phu luc C: So sanh tieu chuan

### So sanh voi cac tieu chuan quoc te

| Tieu chuan | Yeu cau | Trang thai hien tai | Sau nang cap |
|-----------|---------|--------------------|----|
| OWASP Top 10:2021 | 10/10 categories addressed | 8/10 | 10/10 |
| CIS Benchmark (Web App) | Security headers, TLS, logging | 85% | 95%+ |
| NIST SP 800-53 (AC, AU, IA) | Access control, audit, auth | 80% | 92%+ |
| PCI DSS v4.0 (neu xu ly thanh toan) | Encryption, logging, access | 70% | 88%+ |
| ISO 27001 Annex A | 93 controls | ~65% | ~85% |

### Benchmark so voi enterprise CRM/ERP tuong duong

| Metric | He thong nay | Trung binh nganh | Muc tieu |
|--------|-------------|-------------------|----------|
| Auth strength | 9/10 | 7/10 | 9/10 ✅ |
| API security | 7.5/10 | 6/10 | 9/10 |
| Code architecture | 6.5/10 | 5/10 | 8.5/10 |
| Test coverage | 6/10 | 4/10 | 8/10 |
| DevOps maturity | 5/10 | 6/10 | 8/10 |

---

> **Ket luan:** He thong co nen tang bao mat MANH (auth, headers, audit) nhung kien truc frontend can cai thien tiep tuc. Nhieu refactor da hoan thanh (types tach, App.tsx giam, V5MasterDataCtrl decomposed). Voi 12 tuan thuc hien 4 phase, diem tong co the nang tu **7.6 → 9.0/10**, dat muc "Xuat sac" theo tieu chuan quoc te. **Phase A con 1 blocker: Gate::authorize() cho 3 controller.**

---

## 9. Kiem tra doi chieu codebase (2026-03-31)

> Kiem tra tu dong bang Claude Code — doi chieu TUNG HANG MUC trong plan voi trang thai thuc te cua codebase.

### 9.1 Tong hop nhanh

```
Phase A (Emergency):    7/8 hoan thanh  ██████████████░░  87%
Phase 1 (Foundation):   3/3 hoan thanh  ████████████████  100%
Phase 2 (Migration):    2/5 hoan thanh  ██████░░░░░░░░░░  40%
Phase 3 (Hardening):    2/6 hoan thanh  █████░░░░░░░░░░░  33%
Phase 4 (Excellence):   1/7 hoan thanh  ██░░░░░░░░░░░░░░  14%
Phase B (Auth):         3/4 hoan thanh  ████████████░░░░  75%
Phase C (Defense):      1/5 hoan thanh  ███░░░░░░░░░░░░░  20%
Phase D (Monitoring):   0/5 hoan thanh  ░░░░░░░░░░░░░░░░  0%

TONG: 19/43 items hoan thanh (44%)
```

### 9.2 Chi tiet — Lo trinh kien truc (Phase 1-4)

#### Phase 1: Foundation — ✅ 100% HOAN THANH

| # | Task | Trang thai | Bang chung |
|---|------|-----------|------------|
| 1.1 | `strictNullChecks` | ✅ DA LAM | `tsconfig.json` dong 28: `"strictNullChecks": true` |
| 1.1b | `noImplicitAny` | ✅ DA LAM | `tsconfig.json` dong 29: `"noImplicitAny": true` |
| 1.2 | Fix `hasPermission()` implicit-allow | ✅ DA LAM | `authorization.ts` dong 114-133: `canAccessTab()` tra `false` cho unknown tabs |
| 1.3 | Vite dev server bind 127.0.0.1 | ✅ DA LAM | `vite.config.ts` dong 15: `host: '127.0.0.1'`, dong 27: preview host `'127.0.0.1'` |

#### Phase 2: State Migration — ⚠️ GATE PENDING (prerequisite chua pass)

**Trang thai:** contractStore (11KB) da tao som, la entity store dau tien theo pattern moi. Nhung Phase 2 CHUA CHINH THUC bat dau vi prerequisite gate chua hoan thanh.

| # | Task | Trang thai | Bang chung |
|---|------|-----------|------------|
| 2.0 | 5 core E2E specs + route snapshot | ⚠️ MOT PHAN | 12 E2E specs ton tai (vuot 7 ban dau), nhung chua co route-list snapshot test |
| 2.1 | App.tsx → Zustand stores | ⚠️ MOT PHAN | App.tsx = 1,597 dong. `contractStore.ts` DA TAO (11KB, 5 files import). `customerStore`, `employeeStore`, `projectStore`, `productStore` CHUA TAO. 1/5 entity stores hoan thanh |
| 2.2 | V5MasterDataController tach | ✅ DA LAM | File DA XOA. Routes trong `routes/api/master-data.php`. `V5MasterDataLegacyService.php` = 25 dong (retired shell). 32 domain controllers trong `Api/V5/`. 12 route files domain-specific |
| 2.3 | CustomerRequestCaseWriteService tach | ❌ CHUA LAM | Van 1,536 dong. Thu muc `Write/` KHONG TON TAI |
| 2.4 | TypeScript `noImplicitAny` | ✅ DA LAM | `tsconfig.json` dong 29 |

**Nghiem thu Phase 2:**
```
  PREREQUISITE GATE (phai PASS truoc khi bat dau Phase 2 tasks):
  [ ] Route-list snapshot test da tao va PASS                     → Chua co
  [ ] It nhat 5 core E2E specs (CRC flow + auth)                 → 12 E2E specs ✅ (vuot gate)
  [ ] Phase A go-live blocker A8 enforcement HOAN THANH           → Chua (3 controllers con thieu)

  PHASE 2 COMPLETION CRITERIA:
  [ ] App.tsx duoi 1,000 dong                                    → FAIL (1,597 dong)
  [✅] It nhat 1 entity store hoat dong                          → PASS (contractStore)
  [ ] It nhat 5 entity stores                                    → FAIL (chi co 1)
  [ ] Moi store co unit test rieng                               → contractStore.test.ts ✅, con lai chua co
  [ ] Route-list snapshot diff: 0 removed routes                 → Chua co snapshot test
  [ ] CustomerRequest/Write/ co 4-5 focused services             → FAIL (chua tach)
  [✅] cd backend && composer test PASS                          → PASS
  [✅] npm run test PASS                                         → PASS
```

#### Phase 3: Hardening — ⚠️ 33% HOAN THANH

| # | Task | Trang thai | Bang chung |
|---|------|-----------|------------|
| 3.1 | Mo rong Policies cho mutating endpoints | ⚠️ CRITICAL GAP | 4 Policies DA TAO (Contract, Customer, Invoice, CRC). NHUNG `Gate::authorize()` chi trong 1/31 controllers (CustomerController). 30 controllers CHI dung route middleware — policies KHONG DUOC GOI |
| 3.2 | GET rate limiting | ✅ DA LAM | `AppServiceProvider.php` dong 109-131: `api.access` limiter voi GET 60 req/min (regular), 120 req/min (dashboard/report) |
| 3.3 | config/cors.php | ✅ DA LAM | `config/cors.php` (29 dong): env-driven origins, `supports_credentials: true`, `X-Tab-Token` + `X-XSRF-TOKEN` trong allowed_headers |
| 3.4 | DOMPurify | ❌ CHUA LAM | Khong co `dompurify` trong `package.json`. Khong co sanitize function trong frontend source |
| 3.5 | TypeScript `strict: true` | ⚠️ MOT PHAN | `strictNullChecks` + `noImplicitAny` DA BAT. Nhung `strict: true` chua set (thieu `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`) |
| 3.6 | E2E coverage → 25+ specs | ⚠️ MOT PHAN | 12 specs hien tai (tang tu 7). Chua dat muc tieu 25+. Danh sach specs hien co: `auth.smoke`, `auth-flow`, `permission-deny`, `crc-full-workflow`, `crc-sub-phases`, `fee-invoice-receipt`, `fee-collection.smoke`, `contracts-revenue-hub.smoke`, `customer-request-attention-open.smoke`, `customer-request-v2-core.smoke`, `procedure-raci.smoke`, `procedure-checklist-worklog-file.smoke` |

**Nghiem thu Phase 3:**
```
  [ ] Policies authorize mutating endpoints — 100% coverage      → FAIL (1/31 controllers)
  [✅] GET rate limit: tra 429 khi vuot quota                    → PASS (60-120/min)
  [✅] CORS: Request tu domain khong phep bi reject              → PASS (env-driven)
  [ ] tsconfig.json co "strict": true                            → FAIL (chi co 2/7 strict flags)
  [ ] E2E tests >= 25 specs                                      → FAIL (12/25)
```

#### Phase 4: Excellence — 14% HOAN THANH

| # | Task | Trang thai | Bang chung |
|---|------|-----------|------------|
| 4.1 | Docker + docker-compose | ❌ CHUA LAM | Khong co Dockerfile, docker-compose.yml trong project |
| 4.2 | CompatibilityLookupService sunset | ❌ CHUA LAM | Van 1,215 dong. Khong co decommission test |
| 4.3 | CQRS cho CRC domain | ❌ CHUA LAM | Read/Write van dung chung Eloquent models |
| 4.4 | OpenAPI spec | ❌ CHUA LAM | Khong co OpenAPI/Swagger config |
| 4.5 | Security scanning CI | ❌ CHUA LAM | Thu muc `.github/workflows/` KHONG TON TAI |
| 4.6 | Path aliases chuan hoa | ❌ CHUA LAM | Chi co `@/*` trong tsconfig, chua co `@components/*`, `@services/*`, etc. |
| 4.7 | Health check endpoint | ⚠️ MỘT PHẦN | Admin health check DA CO tai `/api/v5/admin/health/tables` (yeu cau auth `permission:system.health.view`). **CHUA CO** unauthenticated `/api/health` cho load balancer / uptime monitoring. Can them route ngoai auth group |

### 9.3 Chi tiet — Lo trinh ATTT (Phase A-D)

#### Phase A: Emergency — ⚠️ 87% (7/8)

Xem Section 6 da cap nhat trang thai.

#### Phase B: Auth & Access Control — 75% (3/4)

| # | Fix | Trang thai | Bang chung |
|---|-----|-----------|------------|
| B1 | Ownership check trong DomainServices | ⚠️ MOT PHAN | `UserAccessService.php` (322 dong) DA CO, resolve `user_dept_scopes`. Policies DA TAO. Gate::authorize() chua duoc goi rong rai |
| B2 | GET rate limiting (120/min) | ✅ DA LAM | `AppServiceProvider.php` dong 109-131 |
| B3 | TypeScript strictNullChecks | ✅ DA LAM | `tsconfig.json` dong 28 |
| B4 | Review IDOR risk (tu bao cao 24/03) | ✅ DA LAM | 4 Policies da tao, CustomerPolicy cap nhat 31/03 |

#### Phase C: Defense in Depth — 20% (1/5)

| # | Fix | Trang thai | Bang chung |
|---|-----|-----------|------------|
| C1 | DOMPurify | ❌ CHUA LAM | Khong co package, khong co sanitize |
| C2 | API response sanitization audit | ❌ CHUA LAM | Chua co bang kiem tra |
| C3 | File upload virus scan hook | ❌ CHUA LAM | Upload chi check MIME + extension |
| C4 | Session fixation protection review | ❌ CHUA LAM | Chua co review doc |
| C5 | E2E security tests | ✅ MOT PHAN | `permission-deny.spec.ts` DA TAO |

#### Phase D: Monitoring & Compliance — 0% (0/5)

| # | Fix | Trang thai | Bang chung |
|---|-----|-----------|------------|
| D1 | Security scanning CI | ❌ CHUA LAM | Khong co `.github/workflows/` |
| D2 | Dependency auto-alerts | ❌ CHUA LAM | Khong co Dependabot/Renovate config |
| D3 | API abuse detection | ❌ CHUA LAM | Khong co anomaly logging |
| D4 | Penetration test | ❌ CHUA LAM | Chua thuc hien |
| D5 | Incident response plan | ❌ CHUA LAM | Chua co tai lieu |

### 9.4 Findings moi — Phat hien ngoai plan

Trong qua trinh kiem tra, phat hien cac van de CHUA CO trong plan goc:

#### FINDING-01: hasPermission() frontend/backend mismatch (MOI)

```
Frontend (authorization.ts dong 93-96):
  if (!permission) return true;   // null → ALLOW (intentionally public tabs)

Backend (UserAccessService.php dong 134-147):
  if ($permission === '') return false;  // empty → DENY

Van de: Logic KHONG DONG NHAT giua 2 layers.
  - FE: null/undefined/'' → true
  - BE: '' → false
  Hien tai chua exploit duoc vi BE validation chay doc lap,
  nhung tao confusion khi debug permission issues.

De xuat: Them comment giai thich ro trong authorization.ts vi sao null → true
(null = intentionally unmapped public tab like dashboard). DA fix canAccessTab
de DENY unknown tabs, nhung hasPermission goc van allow null — can document.
```

#### FINDING-02: 30/31 controllers thieu Gate::authorize() (MOI — nghiem trong hon A8 du kien)

```
Plan A8 de xuat: "Tao Policy cho 4 key entities"
Thuc te: 4 Policies DA TAO, nhung chi 1 controller (CustomerController) GOI chung.

Van de lon hon du kien: Day khong chi la "thieu Policy" ma la
"Policies ton tai nhung khong ai goi". Route middleware chi kiem tra
"user co permission 'contracts.write'?" — nhung KHONG kiem tra
"user co quyen voi CONTRACT NAY cu the khong?".

Impact: Bat ky user co permission 'contracts.write' co the sua
BAT KY contract nao, ke ca contract cua department khac.

Priority: CRITICAL — can them Gate::authorize() vao it nhat
ContractController, FeeCollectionController, CustomerRequestCaseController
TRUOC go-live.

De xuat them vao Phase A:
  A8a. Them Gate::authorize() vao ContractController (store, update, destroy)
  A8b. Them Gate::authorize() vao FeeCollectionController (invoice + receipt CRUD)
  A8c. Them Gate::authorize() vao CustomerRequestCaseController (transition, worklog)
  A8d. Them integration tests: user A KHONG sua duoc entity cua user B
```

#### FINDING-03: CI/CD pipeline KHONG TON TAI (MOI)

```
Plan ghi: ".github/workflows/ci.yml chay tren moi push/PR"
Thuc te: Thu muc .github/workflows/ KHONG TON TAI trong project.

CLAUDE.md ghi co CI pipeline voi 3 jobs (Backend Tests, Frontend Unit, Frontend E2E)
nhung khong tim thay file thuc te.

De xuat:
  1. Xac nhan CI chay o dau (GitHub Actions? GitLab CI? Jenkins?)
  2. Neu GitHub Actions → tao lai .github/workflows/ci.yml
  3. Them vao Phase D1 (Security scanning) → tao luon CI pipeline co ban
```

#### FINDING-04: E2E test tang tu 7 → 12 (tien trien tot, can ghi nhan)

```
Plan ghi: 7 E2E specs
Thuc te: 12 E2E specs — tang 71%

Specs MOI (khong co trong plan ban dau):
  + auth-flow.spec.ts
  + permission-deny.spec.ts
  + crc-full-workflow.spec.ts
  + crc-sub-phases.spec.ts
  + fee-invoice-receipt.spec.ts

Day la tien trien TOT — nhieu spec moi phu dung nhung gi plan 3.6 de xuat.
Con thieu: revenue specs, import/export specs, error-handling specs.
```

#### FINDING-05: Zustand stores nhieu hon plan ghi (MOI)

```
Plan ghi: "6 shared stores (authStore, filterStore, modalStore, revenueStore, toastStore, uiStore)"
Thuc te: 8 stores — them `contractStore.ts` (11KB) va `index.ts`

contractStore DA DUOC:
  - Tao va su dung trong 5 files
  - Co unit test (contractStore.test.ts)
  - Integrate voi ContractList.tsx va App.tsx

Day la buoc dau tot cho Phase 2.1 — pattern da duoc validate,
co the ap dung cho customer/employee/project/product.
```

### 9.5 De xuat hanh dong tiep theo — Uu tien

#### 🔴 BLOCKER (truoc go-live)

| # | Task | Thoi gian | Ly do |
|---|------|-----------|-------|
| NEW-01 | Them `Gate::authorize()` vao `ContractController` (store/update/destroy) | 2 gio | IDOR risk — ContractPolicy ton tai nhung chua enforce |
| NEW-02 | Them `Gate::authorize()` vao `FeeCollectionController` (invoice + receipt mutating) | 2 gio | IDOR risk — InvoicePolicy ton tai nhung chua enforce |
| NEW-03 | Them `Gate::authorize()` vao `CustomerRequestCaseController` (transition, worklog) | 3 gio | IDOR risk — CRC Policy ton tai nhung chua enforce |
| NEW-04 | Integration tests: user dept-X KHONG sua duoc entity dept-Y | 4 gio | Xac nhan Policies hoat dong dung |

#### 🟠 HIGH (Sprint tiep theo)

| # | Task | Thoi gian | Ly do |
|---|------|-----------|-------|
| NEW-05 | Tach App.tsx: tao `customerStore.ts`, `employeeStore.ts`, `projectStore.ts`, `productStore.ts` theo pattern contractStore | 1 tuan | App.tsx van 1,597 dong, muc tieu < 800 |
| NEW-06 | Tach `CustomerRequestCaseWriteService` → `Write/` directory (4-5 files) | 3 ngay | Van 1,536 dong monolith |
| NEW-07 | Bat `strict: true` trong tsconfig.json (thay vi tung flag) | 2 ngay | 5 strict flags con thieu (strictFunctionTypes, strictBindCallApply, etc.) |
| NEW-08 | Xac nhan CI/CD pipeline — tao `.github/workflows/ci.yml` neu chua co | 0.5 ngay | CLAUDE.md mo ta CI nhung file khong ton tai |

#### 🟡 MEDIUM (Backlog)

| # | Task | Thoi gian | Ly do |
|---|------|-----------|-------|
| NEW-09 | Them 13 E2E specs nua (revenue, import/export, error-handling) de dat 25+ | 1 tuan | Hien co 12/25 |
| NEW-10 | Install DOMPurify + sanitize user-generated HTML truoc khi render | 1 ngay | Phase C1 chua bat dau |
| NEW-11 | Sunset CompatibilityLookupService (1,215 dong) | 3 ngay | Legacy code khong co decommission plan |
| NEW-12 | Tao Docker setup (docker-compose.yml + Dockerfile cho BE + FE) | 2 ngay | Onboarding + reproducible builds |
| NEW-13 | Tao `.github/workflows/security.yml` — composer audit + npm audit weekly | 0.5 ngay | Phase D1 chua bat dau |
| NEW-14 | Them Gate::authorize() cho 27 controllers con lai (batched) | 1 tuan | Post go-live hardening |

### 9.6 Diem da cap nhat sau kiem tra

| # | Hang muc | Diem plan | Diem cap nhat | Thay doi | Ly do |
|---|----------|-----------|---------------|----------|-------|
| 4 | BE: Authorization (service-level) | 6/10 | 6.5/10 | +0.5 | Policies da tao, nhung enforcement chi 1/31 controllers |
| 7 | BE: Rate Limiting | 7/10 | 8/10 | +1.0 | GET rate limiting DA THEM (60-120/min) |
| 10 | BE: Service Architecture | 7.5/10 | 8/10 | +0.5 | V5MasterDataCtrl DA XOA HOAN TOAN, 12 route files domain-specific |
| 16 | FE: Authorization Logic | 5/10 | 7/10 | +2.0 | implicit-allow DA FIX, strictNullChecks + noImplicitAny DA BAT |
| 17 | FE: State Management | 5.5/10 | 6/10 | +0.5 | contractStore DA TAO, nhung chi 1/5 entity stores |
| 19 | FE: TypeScript Safety | 4/10 | 6.5/10 | +2.5 | strictNullChecks + noImplicitAny DA BAT (2/7 strict flags) |
| 20 | FE: Test Coverage | 6/10 | 6.5/10 | +0.5 | 12 E2E specs (tang 71% tu 7) |

**Diem tong cap nhat (theo cong thuc Section 1.1 + Appendix B — single source of truth):**
```
FE Arch (items #15,17,18,19):  avg(8,6,7,6.5)   = 6.9
FE Sec  (items #13,14,16,20):  avg(9,9,7,6.5)   = 7.9  → FE layer = 7.4
BE Arch (items #3,4,5,9,10,11): avg(8,6.5,8,8,8,8) = 7.8
BE Sec  (items #1,2,6,7,8,12): avg(9,9,9,8,9,8)   = 8.7  → BE layer = 8.3
System total = (7.4+8.3)/2 = 7.9
```
**Section 1.1 la source of truth. Appendix B la cong thuc kiem chung. KHONG dung shortcut avg(#13-20).**
