# Nang cap Kien truc & An toan Thong tin — DEV Plan

**Ngay tao:** 2026-03-30
**Nguon:** `2026_30_03_Nang_cap_kien_truc_va_an_toan_thong_tin.md` (plan goc, Codex APPROVED)
**Trang thai:** DANG THUC HIEN — 35 tasks | 8 DONE | 0 IN PROGRESS | 27 PENDING
**Codex Review:** Round 1 — 10 issues ACCEPTED, all fixed in-place (2026-03-31)

---

## MUC LUC

1. [Trang thai tong hop](#1-trang-thai-tong-hop)
2. [Diem hien tai (baseline verified)](#2-diem-hien-tai)
3. [Phase A — Emergency Fixes (truoc go-live, 1-2 ngay)](#3-phase-a--emergency-fixes)
4. [Phase 1 — Foundation (Tuan 1-2)](#4-phase-1--foundation)
5. [Phase 2 — State Migration (Tuan 3-6)](#5-phase-2--state-migration)
6. [Phase 3 — Hardening (Tuan 7-8)](#6-phase-3--hardening)
7. [Phase 4 — Excellence (Tuan 9-12)](#7-phase-4--excellence)
8. [Lenh verify nhanh](#8-lenh-verify-nhanh)

---

## 1. Trang thai tong hop

| Phase | Tasks | Done | Diem muc tieu |
|-------|-------|------|---------------|
| A — Emergency | 9 | 3 | GO-LIVE GATE |
| 1 — Foundation | 3 | 3 | 7.5 / 10 |
| 2 — State Migration | 10 | 2 | 8.0 / 10 |
| 3 — Hardening | 6 | 0 | 8.5 / 10 |
| 4 — Excellence | 7 | 0 | 9.0 / 10 |
| **Tong** | **35** | **8** | **9.0 / 10** |

---

## 2. Diem hien tai

> Tat ca so lieu verified bang filesystem commands ngay 2026-03-30.

| Metric | Gia tri hien tai | Muc tieu |
|--------|-----------------|----------|
| App.tsx | 1,587 dong | < 800 dong |
| Zustand shared stores | 6 files / 575 dong | + 5 entity stores |
| TypeScript strict | KHONG (strictNullChecks/noImplicitAny/strict deu OFF) | strict: true |
| E2E specs | 7 files | 25+ files |
| Unit tests | 108 files | 130+ files |
| hasPermission implicit-allow | CON TON TAI (line 94-95) | deny-by-default |
| Vite host | 0.0.0.0 | 127.0.0.1 |
| config/cors.php | KHONG TON TAI | Tao moi + whitelist |
| VNPT_AUTH_COOKIE_SECURE | empty | true |
| SESSION_ENCRYPT | false | true |
| COOKIE_SAME_SITE | lax | strict |
| V5MasterDataController | DA XOA | ✅ |
| CRC WriteService | 1,487 dong | 4-5 files < 450 dong/file |
| BE Policies | 3 files (Contract, Invoice, CRC) | + Customer, Receipt |
| UserAccessService | 321 dong | Mo rong scope check |
| GET rate limiter | KHONG TON TAI | api.read 120/min |
| Docker | KHONG TON TAI | docker-compose.yml |

---

## 3. Phase A — Emergency Fixes

> **GO-LIVE BLOCKER** — PHAI hoan thanh TRUOC khi deploy production.

### A1: VNPT_AUTH_COOKIE_SECURE=true ❌ CHUA LAM

**Thoi gian:** 5 phut
**Branch:** `tung/security-env-hardening`

```bash
# File: .env.production (hoac .env tren server)
# Tim dong:
VNPT_AUTH_COOKIE_SECURE=
# Doi thanh:
VNPT_AUTH_COOKIE_SECURE=true
```

**Verify:**
```bash
cd backend
php artisan tinker --execute="echo config('vnpt_auth.cookie_secure');"
# Ket qua mong doi: 1 (truthy)
```

---

### A2: SESSION_ENCRYPT=true ❌ CHUA LAM

**Thoi gian:** 5 phut
**Cung branch:** `tung/security-env-hardening`

```bash
# File: .env.production
# Tim dong:
SESSION_ENCRYPT=false
# Doi thanh:
SESSION_ENCRYPT=true
```

**Verify:**
```bash
cd backend
php artisan tinker --execute="echo config('session.encrypt') ? 'yes' : 'no';"
# Ket qua mong doi: yes
```

**Luu y:** Session encrypt se invalidate tat ca session hien tai. Deploy vao gio thap diem.

---

### A3: VNPT_AUTH_COOKIE_SAME_SITE=strict ❌ CHUA LAM

**Thoi gian:** 5 phut
**Cung branch:** `tung/security-env-hardening`

```bash
# File: .env.production
VNPT_AUTH_COOKIE_SAME_SITE=strict
```

**Luu y:** `strict` se chan cookie trong cross-site navigations (vd: link tu email). Neu he thong co email links den app → dung `lax` thay vi `strict` va ghi lai quyet dinh.

**QUAN TRONG — Sau khi doi A1/A2/A3:** Chay refresh config cache tren production:
```bash
cd backend
php artisan config:clear && php artisan config:cache
# Neu khong chay, Laravel se doc config cu tu cache va .env thay doi khong co tac dung.
```

**Verify:**
```bash
cd backend
php artisan tinker --execute="echo config('vnpt_auth.cookie_same_site');"
# Ket qua mong doi: strict
```

---

### A4: Xac nhan APP_DEBUG=false ❌ CHUA LAM

**Thoi gian:** 5 phut

```bash
# .env.example da co APP_DEBUG=false ✅
# Kiem tra .env tren production server:
grep APP_DEBUG .env
# Phai la: APP_DEBUG=false
```

---

### A5: Xac nhan LOG_LEVEL=warning ❌ CHUA LAM

**Thoi gian:** 5 phut

```bash
# .env.example da co LOG_LEVEL=warning ✅
# Kiem tra .env tren production server:
grep LOG_LEVEL .env
# Phai la: LOG_LEVEL=warning
```

---

### A6: Fix FE hasPermission() implicit-allow ✅ DONE (2026-03-31)

**Thoi gian:** 2 gio
**Branch:** `tung/fix-auth-implicit-allow`
**Files:**
- `frontend/utils/authorization.ts` (sua)
- `frontend/__tests__/authorization.test.ts` (them test)

**TRUOC — line 114-124:**
```typescript
export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  if (tabId === 'support_master_management') {
    return (
      hasPermission(user, 'support_requests.read')
      || hasPermission(user, 'support_service_groups.read')
      || hasPermission(user, 'support_contact_positions.read')
    );
  }
  return hasPermission(user, TAB_PERMISSION_MAP[tabId] ?? null);
};
```

**SAU:**
```typescript
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
    if (import.meta.env.DEV) {
      console.warn(`[Auth] Tab '${tabId}' missing from TAB_PERMISSION_MAP — denied`);
    }
    return false;
  }

  return hasPermission(user, permission);
};
```

**Them test:**
```typescript
// __tests__/authorization.test.ts — them:
// NOTE: Use existing buildUser() helper from this test file for AuthUser construction
import { buildUser } from './helpers'; // hoac inline helper co san

describe('canAccessTab deny-by-default', () => {
  it('should deny access to unknown tab IDs', () => {
    const user = buildUser({ roles: ['user'], permissions: ['dashboard.view'] });
    expect(canAccessTab(user, 'totally_unknown_tab')).toBe(false);
  });

  it('should allow access to mapped tabs with permission', () => {
    const user = buildUser({ roles: ['user'], permissions: ['dashboard.view'] });
    expect(canAccessTab(user, 'dashboard')).toBe(true);
  });

  it('should deny access to support_master_management without any support permission', () => {
    const user = buildUser({ roles: ['user'], permissions: [] });
    expect(canAccessTab(user, 'support_master_management')).toBe(false);
  });
});
```

**Verify:**
```bash
cd frontend
npx vitest run __tests__/authorization.test.ts
```

---

### A7: Tao config/cors.php ✅ DONE (2026-03-31)

**Thoi gian:** 1 gio
**Branch:** `tung/add-cors-config`
**Files:**
- `backend/config/cors.php` (tao moi)
- `backend/.env.example` (them CORS_ALLOWED_ORIGINS)

**Tao file:**
```php
<?php
// backend/config/cors.php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_filter(
        explode(',', env('CORS_ALLOWED_ORIGINS', ''))
    ),
    'allowed_origins_patterns' => [],
    'allowed_headers' => [
        'Content-Type',
        'X-Requested-With',
        'Authorization',
        'X-Tab-Token',
        'Accept',
        'X-XSRF-TOKEN',
    ],
    'exposed_headers' => ['X-Request-Id'],
    'max_age' => 86400,
    'supports_credentials' => true,
];
```

**Them vao .env.example:**
```env
# CORS — danh sach origins duoc phep, cach nhau bang dau phay
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174
```

**Them vao .env.production:**
```env
CORS_ALLOWED_ORIGINS=https://yourdomain.vn,https://admin.yourdomain.vn
```

**Verify:**
```bash
cd backend
# QUAN TRONG: Sau khi tao config/cors.php, refresh config cache:
php artisan config:clear && php artisan config:cache

# Kiem tra CORS header tu domain khong duoc phep:
curl -s -I -H "Origin: https://evil.com" http://127.0.0.1:8002/api/v5/products \
  | grep -i access-control-allow-origin
# Ket qua mong doi: KHONG co header (origin bi reject)

# Kiem tra tu domain duoc phep:
curl -s -I -H "Origin: http://127.0.0.1:5174" http://127.0.0.1:8002/api/v5/products \
  | grep -i access-control-allow-origin
# Ket qua mong doi: Access-Control-Allow-Origin: http://127.0.0.1:5174
```

---

### A8: IDOR audit — 4 key entities ✅ DONE (2026-03-31 — customer write-scope + invoice/receipt/CRC mutation scope da duoc bo sung; contract write-scope da duoc verify ton tai trong service)

**Thoi gian:** 3 ngay
**Branch:** `tung/idor-audit-phase-a`
**Files:**
- `backend/app/Policies/CustomerPolicy.php` (tao moi)
- `backend/app/Policies/ContractPolicy.php` (xem lai)
- `backend/app/Policies/InvoicePolicy.php` (xem lai)
- `backend/app/Policies/CustomerRequestCasePolicy.php` (xem lai)
- Controllers tuong ung (them `Gate::authorize()` — xem ghi chu ISSUE-1 Codex)
- `backend/tests/Feature/` (them IDOR test)

**Cap nhat 2026-03-31:**
- Batch 1: `CustomerPolicy` + `Gate::authorize()` cho customer mutation.
- Batch 2: bo sung resolve scope cho `invoices`, `receipts`, `customer_request_cases` tai `OwnershipResolver` + `V5AccessAuditService`.
- Khoa mutation scope tai `InvoiceDomainService`, `ReceiptDomainService`, `CustomerRequestCaseWriteService`, `CustomerRequestCaseDomainService`.
- Them regression tests cho `FeeCollectionInvoiceCrudTest`, `CustomerRequestCaseMutationScopeTest` va re-verify `AuthorizationPolicyTest`, `CustomerRequestCaseWorkflowCrudTest`, `CustomerRequestCaseWorkflowV4Test`, `CustomerRequestCaseDashboardApiTest`.

**Quy trinh:**

```
Buoc 1: Tao endpoint-to-policy matrix cho 4 entities
   Liet ke tat ca POST/PUT/DELETE endpoints cho:
   - Contract (store, update, delete)
   - Customer (store, update, delete)
   - Invoice (store, update, delete, bulkGenerate)
   - CRC (store, transition, worklog, estimate)

   Kiem tra: moi endpoint da co Gate::authorize() hoac policy check chua?

Buoc 2: Tao CustomerPolicy.php (chua co)
```

```php
<?php
// backend/app/Policies/CustomerPolicy.php
// VERIFIED against repo (Codex Round 4 — CRITICAL FIX):
//   - CustomerDomainService ALREADY HAS `applyReadScope()` at line 664-738
//     that scopes customers by: contracts.dept_id OR projects.dept_id OR created_by
//   - However, applyReadScope() only applies to READ (list/show) queries
//   - UPDATE/DELETE in CustomerDomainService::update()/destroy() do NOT apply scope
//     → User with customers.write CAN update ANY customer even outside their dept
//   - This policy adds the MISSING write-scope check, mirroring the read scope logic
//   - Auth model is InternalUser. Uses UserAccessService (no hasRole() on model).
//   - Customer model has both contracts() and projects() relationships
//   - Contract uses `dept_id`, Project uses `dept_id`

namespace App\Policies;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Support\Auth\UserAccessService;
use Illuminate\Auth\Access\HandlesAuthorization;

class CustomerPolicy
{
    use HandlesAuthorization;

    public function __construct(
        private readonly UserAccessService $accessService,
    ) {}

    /**
     * Mirror logic from CustomerDomainService::applyReadScope() (line 664-738)
     * but for write operations: user can update/delete IF
     *   - Admin bypass, OR
     *   - Customer linked to user's dept via contracts, OR
     *   - Customer linked to user's dept via projects, OR
     *   - User is customer creator (created_by)
     */
    public function update(InternalUser $user, Customer $customer): bool
    {
        $userId = (int) $user->getKey();

        if ($this->accessService->isAdmin($userId)) {
            return true;
        }

        $userDeptIds = $this->accessService->resolveDepartmentIdsForUser($userId);

        // null = unrestricted (e.g. admin-like role), [] = no depts assigned
        if ($userDeptIds === null) {
            return true;
        }
        if ($userDeptIds === []) {
            // Fallback: still allow if user is creator
            return (int) $customer->created_by === $userId;
        }

        // Check contracts dept link
        if ($customer->contracts()->whereIn('dept_id', $userDeptIds)->exists()) {
            return true;
        }

        // Check projects dept link
        if ($customer->projects()->whereIn('dept_id', $userDeptIds)->exists()) {
            return true;
        }

        // Check created_by
        return (int) $customer->created_by === $userId;
    }

    public function delete(InternalUser $user, Customer $customer): bool
    {
        return $this->update($user, $customer);
    }
}
```

```
Buoc 3: Them authorization vao controller methods thieu

   QUAN TRONG: Base Controller.php hien tai KHONG import AuthorizesRequests trait.
   2 cach:
   a. Them `use AuthorizesRequests;` vao Controller.php hoac V5BaseController.php
   b. Hoac dung Gate::authorize() truc tiep: Gate::authorize('update', $model);

   Chon cach (b) de khong anh huong controllers khac:
     // Trong controller method:
     use Illuminate\Support\Facades\Gate;
     Gate::authorize('update', $customer);

Buoc 4: Viet IDOR test
   QUAN TRONG: Repo tests dung InternalUser (KHONG phai User::factory()).
   Pattern tu repo:
     - Sanctum::actingAs(InternalUser::query()->findOrFail(1), ['api.access'])
     - Hoac: DB::table('internal_users')->updateOrInsert([...]) + $this->actingAs($user)
   → Test ben duoi follow pattern tu CustomerCrudTest.php line 254-273.

   LUU Y: CustomerDomainService DA CO `applyReadScope()` cho READ (list/show).
   Test IDOR chi can kiem tra UPDATE/DELETE vi do la phan THIEU scope.
```

```php
// backend/tests/Feature/IadorAuditTest.php
// VERIFIED: follows InternalUser auth pattern from CustomerCrudTest.php
// Tests WRITE-scope (update/delete) — NOT read-scope (already exists in CustomerDomainService)
use App\Models\InternalUser;
use Illuminate\Support\Facades\DB;

public function test_user_cannot_update_customer_outside_their_dept_scope(): void
{
    // Setup schema (SQLite in-memory test)
    $this->setUpSchemaIfNeeded();

    // Tao 2 departments
    $dept1Id = DB::table('departments')->insertGetId(['name' => 'Dept A', 'created_at' => now(), 'updated_at' => now()]);
    $dept2Id = DB::table('departments')->insertGetId(['name' => 'Dept B', 'created_at' => now(), 'updated_at' => now()]);

    // Tao InternalUser in dept1 (follow pattern from CustomerCrudTest line 254-273)
    DB::table('internal_users')->updateOrInsert(
        ['id' => 99],
        ['username' => 'test-user-99', 'full_name' => 'Test User 99', 'department_id' => $dept1Id]
    );
    $userA = new InternalUser();
    $userA->forceFill(['id' => 99, 'username' => 'test-user-99', 'full_name' => 'Test User 99']);
    $userA->exists = true;
    // Seed permissions: userA has customers.write but scoped to dept1 only
    // (via UserAccessService::resolveDepartmentIdsForUser → returns [$dept1Id])

    // Tao customer linked to dept2 ONLY (via contract + project)
    // → userA (dept1) should NOT be able to update this customer
    // NOTE: Schema columns verified from repo models:
    //   Customer.php:L15 → $fillable includes 'customer_name' (NOT 'name')
    //   Contract.php:L17 → $fillable includes 'contract_name' (NOT 'name')
    //   Project.php:L16 → $fillable includes 'project_name' (NOT 'name')
    $customerId = DB::table('customers')->insertGetId([
        'customer_name' => 'Test Customer',
        'created_by' => 999, // NOT userA's id → no created_by bypass
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::table('contracts')->insert([
        'customer_id' => $customerId,
        'dept_id' => $dept2Id,  // dept_id (NOT department_id) — verified from Contract model
        'contract_name' => 'Test Contract',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    // Also link via project to dept2 (mirrors applyReadScope 3-way check)
    DB::table('projects')->insert([
        'customer_id' => $customerId,
        'dept_id' => $dept2Id,
        'project_name' => 'Test Project',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // userA (dept1) cannot update customer linked to dept2 only
    $this->actingAs($userA)
        ->putJson("/api/v5/customers/{$customerId}", ['customer_name' => 'Hacked'])
        ->assertForbidden(); // 403 from CustomerPolicy
}
```

**Verify:**
```bash
cd backend
php artisan test --filter=IadorAudit
php artisan test  # full suite
```

---

### A9: Loai bo plaintext password khoi frontend (inspect/F12 hardening) ❌ CHUA LAM

**Thoi gian:** 1-2 ngay
**Branch:** `tung/password-exposure-hardening`
**Files:**
- `frontend/App.tsx` (bo modal hien thi `temporary_password`)
- `frontend/components/LoginPage.tsx` (giam thoi gian password ton tai trong state)
- `frontend/hooks/useEmployees.ts` (doi luong create/reset account)
- `frontend/services/api/employeeApi.ts` (cap nhat contract API)
- `backend/app/Http/Controllers/Api/AuthController.php` (review auth secret handling)
- Employee create/reset controller/service lien quan (khong tra plaintext password ve FE)

**Van de hien tai (verified 2026-03-31):**
- FE dang render `temporary_password` tren UI sau khi tao/reset tai khoan.
- Form login va doi mat khau dang giu plaintext password trong React state.
- Neu nguoi dung tu mo `F12` / React DevTools / inspect tren may cua chinh ho, secret hien tai co the bi xem lai tren FE.

**Muc tieu:**
- Frontend khong nhan va khong hien thi plaintext `temporary_password`.
- API create/reset account chi tra `reset_link_sent`, `activation_required` hoac `one_time_setup_token` (khong tra secret hoan chinh).
- Password inputs duoc clear ngay sau submit; khong dua vao toast/store/localStorage/sessionStorage/log.

**Buoc thuc hien:**

```bash
# 1. Backend:
#    - Doi API create/reset employee:
#      ❌ KHONG return provisioning.temporary_password
#      ✅ Return metadata an toan:
#         { activation_required: true, delivery: 'manual' | 'email', reset_link_sent: true }
#
# 2. Frontend:
#    - Xoa modal hien thi temporary password trong App.tsx
#    - Doi thanh thong bao an toan:
#      "Tai khoan da duoc khoi tao. Ban giao link kich hoat qua kenh an toan."
#    - Login / change-password form:
#      uu tien uncontrolled input hoac ref; submit xong clear ngay
#
# 3. Hygiene:
#    - grep lai toan FE de dam bao khong con render/log/store plaintext password
```

**Acceptance criteria:**
- Khong con `temporary_password` render tren UI.
- API khong tra plaintext password cho frontend.
- Password duoc clear ngay sau submit / success / failure hop le.
- Khong co password trong Zustand, React Query, browser storage, toast, console.

**Verify:**
```bash
cd frontend
npm run lint
npm test
rg -n "temporary_password|current_password|new_password" App.tsx components hooks services

cd ../backend
php artisan test --filter=EmployeeCrudTest
php artisan test --filter=AuthSessionFlowTest
```

---

## 4. Phase 1 — Foundation

> **Tien quyet:** Phase A hoan thanh.
> **Thoi gian:** Tuan 1-2
> **Branch prefix:** `tung/phase1-*`

### P1.1: Bat TypeScript strictNullChecks ✅ DONE (2026-03-31)

**Thoi gian:** 3-5 ngay
**Branch:** `tung/phase1-strict-null-checks`
**Files:** `frontend/tsconfig.json` + 50-80 file fix

**Tien do 2026-03-31:**
- Da bat `strictNullChecks: true` trong `frontend/tsconfig.json`.
- Da clean duoc compile voi `npx tsc --noEmit --strictNullChecks`.
- Da fix xong cum nullability/generic co leverage cao: `queryKeys`, `usePageDataLoading`, `useCustomers`, `useContracts`, `useEmployees`, `useDocuments`, `useFeedbacks`, `useProjects`, `useSupportConfig`.
- Da fix hang loat component suy luan `never` do destructuring props co default array, gom cac list/modal chinh: `AuditLogList`, `BusinessList`, `ContractList`, `ContractModal`, `CusPersonnelList`, `CustomerList`, `DepartmentList`, `DocumentList`, `EmployeeList`, `EmployeePartyList`, `EmployeePartyProfileModal`, `FeedbackList`, `PaymentScheduleTab`, `ProductList`, `ProductQuotationTab`, `ProjectList`, `ProjectProcedureModal`, `ReminderList`, `UserDeptHistoryList`, `VendorList`, `DepartmentFormModal`, `EmployeeFormModal`, `ProjectFormModal`, `ProjectFormSections`, `FeedbackModals`, `App.tsx`.
- Verify da pass: `npm run lint`, `npm run build`, `npm run test`.

**Buoc thuc hien:**

```bash
# 1. Them vao tsconfig.json:
cd frontend
```

```json
{
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

```bash
# 2. Chay lint, dem loi:
npm run lint 2>&1 | tee /tmp/strict-null-errors.log
grep -c "error TS" /tmp/strict-null-errors.log
# Du kien: 200-400 loi

# 3. Fix theo thu tu uu tien:
#    a. utils/authorization.ts     (bao mat)
#    b. shared/api/apiFetch.ts     (API layer)
#    c. shared/stores/*.ts         (state)
#    d. services/api/*.ts          (API client)
#    e. components/**/*.tsx         (UI)

# 4. Quy tac fix:
#    ✅ Them null guard: if (x != null) { ... }
#    ✅ Them non-null assertion: x! (CHI khi chac chan khong null)
#    ❌ KHONG dung // @ts-ignore
#    ❌ KHONG dung any de bypass

# 5. Verify:
npm run lint   # 0 errors
npm run test   # 0 failures
npm run build  # success
```

---

### P1.2: Fix Vite dev server bind ✅ DONE (2026-03-31)

**Thoi gian:** 10 phut
**Branch:** `tung/phase1-vite-localhost`
**File:** `frontend/vite.config.ts`

**TRUOC (line 15):**
```typescript
host: '0.0.0.0',
```

**SAU:**
```typescript
host: '127.0.0.1',
```

**Lam tuong tu cho preview section** (neu co).

**Verify:**
```bash
cd frontend
npm run dev &
sleep 3
# Chi bind 127.0.0.1, khong bind 0.0.0.0:
# macOS: dung lsof thay vi ss (ss khong co tren macOS)
lsof -iTCP:5174 -sTCP:LISTEN -P -n | grep LISTEN
# Ket qua mong doi: *:5174 hoac 127.0.0.1:5174 (KHONG PHAI 0.0.0.0:5174)
kill %1
```

---

### P1.3: Bat TypeScript noImplicitAny ✅ DONE (2026-03-31)

**Thoi gian:** 2-3 ngay
**Branch:** `tung/phase1-no-implicit-any`
**Tien quyet:** P1.1 da merge
**File:** `frontend/tsconfig.json` + 30-50 file fix

```json
{
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

```bash
cd frontend
npm run lint 2>&1 | grep -c "error TS"
# Du kien: 100-200 loi
# Fix theo cung thu tu P1.1
npm run lint && npm run test && npm run build
```

**Cap nhat 2026-03-31:**
- Da cai `@types/react` + `@types/react-dom` de TypeScript 5 + React 19 resolve JSX/runtime typings dung cach.
- Da bat va verify `noImplicitAny` bang `npx tsc --noEmit --noImplicitAny`.
- Da dong cac cum loi chinh: callback/props mismatch o `AppPages`, shared input/pagination, state typing o `App`, mock test lech type, va cac diem `unknown`/union trong CRC-procedure-fee collection.
- Da verify bang `npm run lint`, `npm run build`, va vitest targeted cho cac file vua chinh.

**Nghiem thu Phase 1:**
```bash
cd frontend
npm run lint   # PASS voi strictNullChecks + noImplicitAny
npx vitest run __tests__/authorization.test.ts  # canAccessTab('unknown') → false
npm run test   # 0 failures
npm run test:e2e  # 0 failures
cd ../backend && php artisan test  # PASS
```

---

## 5. Phase 2 — State Migration

> **Tien quyet:** Phase 1 hoan thanh + PREREQUISITE GATE (duoi day).
> **Thoi gian:** Tuan 3-6
> **Branch prefix:** `tung/phase2-*`

### PREREQUISITE GATE — Truoc khi bat dau Phase 2

```bash
# 1. Route-list snapshot: dung PHPUnit snapshot test (khong phai diff JSON)
cd backend

# Tao baseline file (chi lan dau):
mkdir -p tests/fixtures
php artisan route:list --json \
  | jq '[.[] | select(type=="object" and (.uri|startswith("api/v5/"))) | {method: (.method | split("|") | .[0]), uri: .uri}] | sort_by(.uri, .method)' \
  > tests/fixtures/route-baseline.json
# ↑ IMPORTANT: split("|")[0] normalizes "GET|HEAD" → "GET" to match PHPUnit test which uses $route->methods()[0]
# Commit file nay vao repo: git add tests/fixtures/route-baseline.json

# Moi PR phai PASS:
php artisan test --filter=RouteParitySnapshotTest
# Test nay so sanh current routes la SUPERSET cua baseline (khong co route nao bi xoa)

# 2. 5 core E2E specs phai PASS (task P2.0)
cd frontend && npm run test:e2e
```

---

### P2.0: Them 5 core E2E specs (gate) ✅ DONE (2026-03-31)

**Thoi gian:** 3 ngay
**Branch:** `tung/phase2-core-e2e-gate`
**Files:** `frontend/e2e/` (5 file moi)

```
Tao:
  e2e/auth-flow.spec.ts              — login → session → tab eviction → logout
  e2e/crc-full-workflow.spec.ts       — new_intake → dispatched → analysis → in_progress → completed
  e2e/crc-sub-phases.spec.ts          — coding workflow + DMS workflow
  e2e/fee-invoice-receipt.spec.ts     — invoice CRUD → receipt → reconcile
  e2e/permission-deny.spec.ts         — user khong co quyen bi 403/redirect
```

**Verify:**
```bash
cd frontend
npm run test:e2e
# 24 tests / 12 spec files PASS
```

---

### P2.1: contractStore.ts ✅ DONE (2026-03-31)

**Thoi gian:** 1-2 ngay
**Branch:** `tung/phase2-contract-store`
**Files:**
- `frontend/shared/stores/contractStore.ts` (tao moi)
- `frontend/App.tsx` (xoa contract state + handlers)
- `frontend/components/ContractList.tsx` (chuyen sang useContractStore)
- `frontend/__tests__/contractStore.test.ts` (them test)

**Pattern:**
```typescript
// frontend/shared/stores/contractStore.ts
import { create } from 'zustand';
import type { Contract } from '../../types';
import * as contractApi from '../../services/api/contractApi';
import { useToastStore } from './toastStore';

interface ContractState {
  contracts: Contract[];
  meta: { page: number; per_page: number; total: number; total_pages: number } | null;
  loading: boolean;
  loadPage: (query: Record<string, unknown>) => Promise<void>;
  save: (id: number | null, data: Partial<Contract>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useContractStore = create<ContractState>((set) => ({
  contracts: [],
  meta: null,
  loading: false,

  loadPage: async (query) => {
    set({ loading: true });
    try {
      const res = await contractApi.fetchContractsPage(query);
      set({ contracts: res.data, meta: res.meta });
    } finally {
      set({ loading: false });
    }
  },

  save: async (id, data) => {
    if (id) {
      await contractApi.updateContract(id, data);
    } else {
      await contractApi.createContract(data);
    }
    useToastStore.getState().addToast('success', 'Thanh cong', 'Da luu hop dong');
    // NOTE: contract delete cung can refresh payment_schedules (side-effect tu App.tsx line ~1571)
  },

  remove: async (id) => {
    await contractApi.deleteContract(id);
    set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) }));
    useToastStore.getState().addToast('success', 'Thanh cong', 'Da xoa hop dong');
  },
}));
```

**Verify:**
```bash
cd frontend
npx vitest run __tests__/contractStore.test.ts
npm run lint
npm run test
npm run build
wc -l App.tsx  # 1579 lines
```

---

### P2.2: customerStore.ts ❌ CHUA LAM

**Thoi gian:** 1-2 ngay
**Branch:** `tung/phase2-customer-store`
**Dac thu entity:**
- API: `fetchCustomersPage`, `createCustomer`, `updateCustomer`, `deleteCustomer` (from `customerApi.ts`)
- DELETE co dependency-error modal handling: App.tsx line ~1560 bat `409 Conflict` khi customer con co contracts
- Sau save: reload ca customer list VA customer personnel list (cascading refresh)
- `deleteCustomer` can try/catch va show dependency-error toast rieng, khong chi generic toast

---

### P2.3: employeeStore.ts ❌ CHUA LAM

**Thoi gian:** 1-2 ngay
**Branch:** `tung/phase2-employee-store`
**Dac thu entity:**
- API: `fetchEmployeesPage`, `createEmployeeWithProvisioning`, `updateEmployee`, `deleteEmployee`
- CREATE dung `createEmployeeWithProvisioning` (khong phai `createEmployee`) — bao gom temporary-password handling
- Sau create thanh cong: hien thi password dialog cho admin (App.tsx line ~1494)
- Employee co `department_history` side-effect — khi thay doi department, can refresh dept history list
- Store phai expose `tempPassword` state de dialog hien thi

---

### P2.4: projectStore.ts ❌ CHUA LAM

**Thoi gian:** 1-2 ngay
**Branch:** `tung/phase2-project-store`
**Dac thu entity:**
- API: `fetchProjectsPage`, `createProject`, `updateProject`, `deleteProject`
- SAVE co `sync_items` va `sync_raci` params — project items + RACI matrix dong bo cung luc
- Sau save: reload project items list (App.tsx line ~893)
- Project co procedure steps — store can handle `loadProjectItems()` sau khi save

---

### P2.5: productStore.ts ❌ CHUA LAM

**Thoi gian:** 1-2 ngay
**Branch:** `tung/phase2-product-store`
**Dac thu entity:**
- API: `fetchProductsPage`, `createProduct`, `updateProduct`, `deleteProduct`
- Product co `features` va `target_segments` sub-resources — store can handle nested data
- DELETE phai check co contract items dang reference khong

---

### P2.6: Route parity verify + CompatibilityLookupService review ❌ CHUA LAM

**Thoi gian:** 1 ngay
**Branch:** `tung/phase2-route-parity`

```bash
# 1. Route parity — dung PHPUnit snapshot test (khong phai diff):
cd backend
php artisan test --filter=RouteParitySnapshotTest
# PHAI PASS: current routes la superset cua baseline (0 removed routes)

# 2. Review CompatibilityLookupService — co consumer nao con su dung?
rg 'CompatibilityLookupService' backend/app --type php -l
# Neu khong con consumer → danh dau deprecated, sunset Phase 4
```

---

### P2.7: Tach CustomerRequestCaseWriteService ❌ CHUA LAM

**Thoi gian:** 3 ngay
**Branch:** `tung/phase2-split-crc-write-service`
**Files:**
- `backend/app/Services/V5/CustomerRequest/Write/CaseCreateService.php` (tao moi, ~250 dong)
- `backend/app/Services/V5/CustomerRequest/Write/CaseTransitionService.php` (tao moi, ~450 dong)
- `backend/app/Services/V5/CustomerRequest/Write/WorklogService.php` (tao moi, ~300 dong)
- `backend/app/Services/V5/CustomerRequest/Write/EstimateService.php` (tao moi, ~200 dong)
- `backend/app/Services/V5/CustomerRequest/Write/CaseWriteOrchestrator.php` (tao moi, ~200 dong)
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` (xoa hoac thay bang re-export)

**Quy tac:**
- CaseWriteOrchestrator GIU NGUYEN public API cua WriteService cu
- **QUAN TRONG:** Controller (CustomerRequestCaseController) KHONG inject WriteService truc tiep.
  Cac consumers thuc te la:
  - `CustomerRequestCaseDomainService` (line ~45) — inject WriteService
  - `CustomerRequestCaseExecutionService` (line ~18) — inject WriteService
  → Refactor: doi 2 services tren inject Orchestrator thay vi WriteService
  → Controller KHONG can thay doi (da dung DomainService lam facade)
- Moi service moi co dependency injection rieng

**Files bi touch (chinh xac):**
- `backend/app/Services/V5/CustomerRequest/Write/CaseCreateService.php` (tao moi)
- `backend/app/Services/V5/CustomerRequest/Write/CaseTransitionService.php` (tao moi)
- `backend/app/Services/V5/CustomerRequest/Write/WorklogService.php` (tao moi)
- `backend/app/Services/V5/CustomerRequest/Write/EstimateService.php` (tao moi)
- `backend/app/Services/V5/CustomerRequest/Write/CaseWriteOrchestrator.php` (tao moi)
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php` (xoa hoac alias → Orchestrator)
- `backend/app/Services/V5/Domain/CustomerRequestCaseDomainService.php` (doi inject → Orchestrator)
- `backend/app/Services/V5/CustomerRequest/CustomerRequestCaseExecutionService.php` (doi inject → Orchestrator)

**Verify:**
```bash
cd backend
php artisan test --filter=CustomerRequestCase
# Tat ca tests PASS (khong thay doi behavior)
php artisan test  # full suite PASS

wc -l app/Services/V5/CustomerRequest/Write/*.php
# Moi file < 500 dong
```

---

### P2.8: Route-list snapshot test (CI) ❌ CHUA LAM

**Thoi gian:** 0.5 ngay
**Branch:** cung `tung/phase2-route-parity`
**File:** `backend/tests/Feature/RouteParitySnapshotTest.php` (tao moi)

```php
<?php
// backend/tests/Feature/RouteParitySnapshotTest.php

namespace Tests\Feature;

use Tests\TestCase;

class RouteParitySnapshotTest extends TestCase
{
    public function test_v5_route_count_does_not_decrease(): void
    {
        $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v5/'))
            ->count();

        // Baseline: 334 (verified 2026-03-31 via artisan route:list --json | jq)
        // Cap nhat khi them routes, KHONG BAO GIO giam
        $this->assertGreaterThanOrEqual(
            334, // actual baseline — NOT 170 (stale)
            $routes,
            "Route count giam tu 334! Co route bi xoa."
        );
    }

    public function test_v5_routes_are_superset_of_baseline(): void
    {
        // Compare sorted {method, uri} tuples against committed baseline.
        // IMPORTANT: route:list --json outputs "GET|HEAD" for methods,
        // but Route::getRoutes()->methods()[0] returns "GET".
        // → Normalize BOTH sides to use methods()[0] (first method only).
        $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v5/'))
            ->map(fn ($route) => ['method' => $route->methods()[0], 'uri' => $route->uri()])
            ->sortBy(['uri', 'method'])
            ->values()
            ->toArray();

        // NOTE: Baseline file PHAI duoc commit vao repo truoc khi test nay chay.
        // Tao baseline bang: php artisan route:list --json | jq '[.[] | select(.uri | startswith("api/v5/")) | {method: (.method | split("|") | .[0]), uri: .uri}] | sort_by(.uri, .method)' > tests/fixtures/route-baseline.json
        // ↑ Dung split("|")[0] de normalize "GET|HEAD" → "GET" giong nhu test code.
        $baselinePath = base_path('tests/fixtures/route-baseline.json');
        $this->assertFileExists($baselinePath, 'Baseline file missing. Run: mkdir -p tests/fixtures && generate baseline (see PREREQUISITE GATE).');

        $baseline = json_decode(file_get_contents($baselinePath), true);
        $baselineTuples = array_map(fn ($r) => $r['method'] . ' ' . $r['uri'], $baseline);
        $currentTuples = array_map(fn ($r) => $r['method'] . ' ' . $r['uri'], $routes);

        $removed = array_diff($baselineTuples, $currentTuples);

        $this->assertEmpty(
            $removed,
            "Routes removed from baseline:\n" . implode("\n", $removed)
        );
    }
}
```

**Verify:**
```bash
cd backend
php artisan test --filter=RouteParitySnapshotTest
```

**Nghiem thu Phase 2:**
```bash
cd frontend
wc -l App.tsx          # < 1,000 dong
ls shared/stores/*Store.ts | wc -l  # >= 11 (6 cu + 5 moi)
npm run test           # PASS
npm run test:e2e       # PASS (12+ specs)
npm run build          # success

cd ../backend
php artisan test --filter=RouteParitySnapshot  # PASS
php artisan test --filter=CustomerRequestCase  # PASS
php artisan test                               # PASS
wc -l app/Services/V5/CustomerRequest/Write/*.php  # moi file < 500 dong
```

---

## 6. Phase 3 — Hardening

> **Tien quyet:** Phase 2 hoan thanh.
> **Thoi gian:** Tuan 7-8
> **Branch prefix:** `tung/phase3-*`

### P3.1: Mo rong Policies cho mutating endpoints (SCOPED — KHONG PHAI TAT CA) ❌ CHUA LAM

**Thoi gian:** 5 ngay (Phase 3.1a) + 5 ngay (Phase 3.1b = Phase 4)
**Branch:** `tung/phase3-policy-coverage`

**RE-SCOPED (Codex ISSUE-9):**
He thong hien co 181 mutating api/v5/* routes. Khong kha thi lam het 181 trong 5 ngay.
Chia thanh 2 dot:

**P3.1a (5 ngay — Phase 3):** 4 high-risk entities
- Customer: store, update, delete (3 endpoints) — chua co Policy
- Receipt: store, update (2 endpoints) — co InvoicePolicy nhung chua co ReceiptPolicy
- Employee: store, update, delete (3 endpoints) — chua co ownership check
- CRC transitions: transition, worklog, estimate (5 endpoints) — da co CRC Policy, can review

→ Tong: ~13 endpoints, 2 Policies moi, 2 Policy reviews

**P3.1b (5 ngay — Phase 4):** Con lai
- Product, Project, Department, Vendor, Document, Reminder, v.v.
- Uu tien: endpoints co `$request->user()` nhung khong co scope check
- Low-risk entities (read-mostly) co the dung middleware permission check thay vi Policy

**Files P3.1a:**
- `backend/app/Policies/` — tao them Policies cho entities thieu
- Controllers — them `Gate::authorize('action', $model)` cho moi mutating method
  (KHONG dung `$this->authorize()` — Controller.php va V5BaseController.php deu KHONG co AuthorizesRequests trait)
- `backend/tests/Feature/` — them IDOR test cho moi entity

**Quy trinh:**
```bash
# 1. Tao endpoint-to-policy matrix:
cd backend
# NOTE: Dung --json + jq (--columns khong ho tro trong Laravel 12)
php artisan route:list --json \
  | jq '[.[] | select(type=="object" and (.uri|startswith("api/v5/")) and (.method|test("POST|PUT|PATCH|DELETE")))] | .[] | {method, uri, action}'

# 2. Voi moi endpoint, kiem tra:
#    a. Da co Gate::authorize() hoac policy check trong controller method?
#    b. Da co Policy class cho model tuong ung?
#    c. Policy co kiem tra department scope khong?
#
# 3. Tao Policy cho entities thieu
# 4. Them Gate::authorize() cho endpoints thieu (dung Gate facade, khong phai $this->authorize)
# 5. Viet test IDOR cho moi entity
```

**Verify:**
```bash
cd backend
# Kiem tra moi mutating endpoint co Gate::authorize (KHONG $this->authorize — khong co AuthorizesRequests):
rg 'Gate::authorize' app/Http/Controllers/Api/V5/ --type php -c
# So sanh voi tong so mutating endpoints
php artisan test  # full suite PASS
```

---

### P3.2: GET rate limiting ❌ CHUA LAM

**Thoi gian:** 0.5 ngay
**Branch:** `tung/phase3-read-rate-limit`
**Files:** (12 route files + provider + test)
- `backend/app/Providers/AppServiceProvider.php` (them RateLimiter::for('api.read'))
- `backend/routes/api/admin.php` (wrap GET routes)
- `backend/routes/api/contracts.php` (wrap GET routes)
- `backend/routes/api/customer-requests.php` (wrap GET routes)
- `backend/routes/api/customers.php` (wrap GET routes)
- `backend/routes/api/documents.php` (wrap GET routes)
- `backend/routes/api/fee-collection.php` (wrap GET routes)
- `backend/routes/api/master-data.php` (wrap GET routes)
- `backend/routes/api/projects.php` (wrap GET routes)
- `backend/routes/api/revenue.php` (wrap GET routes)
- `backend/routes/api/scheduling.php` (wrap GET routes)
- `backend/routes/api/support.php` (wrap GET routes)
- `backend/tests/Feature/ReadRateLimitTest.php` (MOI — test rate limit behavior)
NOTE: `routes/api/auth.php` excluded — login already has `throttle:api.auth` (5/min).

**Code:**
```php
// AppServiceProvider.php — them trong boot():
// NOTE: Tat ca V5 routes da grouped voi throttle:api.write.
// Cach implement: them api.read limiter va apply cho GET routes trong route files.
RateLimiter::for('api.read', function (Request $request) {
    return Limit::perMinute(120)
        ->by(($request->user()?->id ?? 'anon') . '|' . $request->ip());
});
```

```php
// TRONG MOI FILE routes/api/*.php (tru auth.php):
// Wrap tat ca GET routes voi middleware(['throttle:api.read']).
// Vi du trong routes/api/customers.php:
Route::middleware(['throttle:api.read'])->group(function () {
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
});
// Lam tuong tu cho tung file:
//   admin.php, contracts.php, customer-requests.php, customers.php,
//   documents.php, fee-collection.php, master-data.php, projects.php,
//   revenue.php, scheduling.php, support.php
```

```php
// backend/tests/Feature/ReadRateLimitTest.php (MOI)
// VERIFIED: follows permission-seeding pattern from SupportServiceGroupPermissionAccessTest.php.
// V5 routes use auth:sanctum + EnsurePermission via UserAccessService::hasPermission()
// which checks `permissions` table + `user_permissions` table (GRANT/DENY).
// Pattern: seed permissions table → seed user_permissions → Sanctum::actingAs(InternalUser)
namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\InternalUser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Laravel\Sanctum\Sanctum;
use App\Http\Middleware\EnforcePasswordChange;
use App\Http\Middleware\EnsureActiveTab;

class ReadRateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware([EnforcePasswordChange::class, EnsureActiveTab::class]);
        $this->setUpSchemaIfNeeded();
    }

    private function seedAuthenticatedUser(): void
    {
        // Follow exact pattern from SupportServiceGroupPermissionAccessTest.php line 28-56
        DB::table('internal_users')->updateOrInsert(
            ['id' => 1],
            ['username' => 'rate-test', 'full_name' => 'Rate Test', 'department_id' => 1]
        );

        // Seed `products.read` permission (needed for GET /api/v5/products)
        // EnsurePermission middleware calls UserAccessService::hasPermission()
        // which queries permissions + user_permissions tables
        DB::table('permissions')->insertOrIgnore([
            'id' => 100,
            'perm_key' => 'products.read',
            'perm_name' => 'Read products',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('user_permissions')->insertOrIgnore([
            'user_id' => 1,
            'permission_id' => 100,
            'type' => 'GRANT',
            'created_at' => now(),
        ]);

        Sanctum::actingAs(InternalUser::query()->findOrFail(1), ['api.access']);
    }

    public function test_get_endpoint_returns_429_after_limit(): void
    {
        $this->seedAuthenticatedUser();

        // Gui 120 requests (within limit)
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/v5/products')->assertSuccessful();
        }

        // Request 121 should be rate-limited
        $this->getJson('/api/v5/products')->assertStatus(429);
    }

    public function test_rate_limit_headers_present(): void
    {
        $this->seedAuthenticatedUser();

        $response = $this->getJson('/api/v5/products');
        $response->assertHeader('X-RateLimit-Limit');
        $response->assertHeader('X-RateLimit-Remaining');
    }
}
```

**Verify:**
```bash
cd backend
php artisan test --filter=ReadRateLimitTest
# PHAI PASS: 2 tests (429 after limit + headers present)
```

---

### P3.3: DOMPurify (neu co user HTML) ❌ CHUA LAM

**Thoi gian:** 1 ngay
**Branch:** `tung/phase3-dompurify`

```bash
# Truoc tien, kiem tra co render user HTML khong:
cd frontend
rg 'dangerouslySetInnerHTML' --type tsx --type ts -l
rg 'innerHTML' --type tsx --type ts -l
# Neu 0 ket qua → SKIP task nay, danh dau N/A
# Neu co ket qua → install dompurify va wrap
```

```bash
# Neu can:
npm install dompurify
npm install -D @types/dompurify
```

---

### P3.4: TypeScript strict: true (full) ❌ CHUA LAM

**Thoi gian:** 2-3 ngay
**Tien quyet:** P1.1 + P1.3 da merge
**Branch:** `tung/phase3-ts-full-strict`
**File:** `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

```bash
cd frontend
npm run lint 2>&1 | grep -c "error TS"
# Du kien: 50-100 loi (strictFunctionTypes, strictPropertyInitialization, v.v.)
# Fix theo cung quy tac P1.1
npm run lint && npm run test && npm run build
```

---

### P3.5: Tang E2E coverage → 25+ specs ❌ CHUA LAM

**Thoi gian:** 5 ngay
**Branch:** `tung/phase3-e2e-25-specs`
**Files:** `frontend/e2e/` (them 13 file moi)

```
Tao (ngoai 5 file da co tu P2.0):
  e2e/revenue-overview.spec.ts          — overview → targets → forecast
  e2e/revenue-targets-crud.spec.ts      — create/update/delete targets
  e2e/crc-escalation.spec.ts            — escalation create → review → resolve
  e2e/crc-worklog-hours.spec.ts         — worklog CRUD + hours attribution
  e2e/contract-crud.spec.ts             — contract create → update → delete
  e2e/customer-crud.spec.ts             — customer CRUD
  e2e/employee-crud.spec.ts             — employee CRUD + department history
  e2e/import-export.spec.ts             — bulk import → validate → export
  e2e/auth-token-refresh.spec.ts        — 401 → auto refresh → retry
  e2e/auth-tab-eviction.spec.ts         — multi-tab → evict old tab
  e2e/error-handling.spec.ts            — network error, timeout
  e2e/sidebar-navigation.spec.ts        — navigate all tabs
  e2e/audit-log.spec.ts                 — audit log visible after mutation
```

**Verify:**
```bash
cd frontend
npm run test:e2e 2>&1 | tail -5
# 25+ specs, all PASS
find e2e -name '*.spec.ts' | wc -l  # >= 25
```

---

### P3.6: Production Hardening Checklist verify ❌ CHUA LAM

**Thoi gian:** 0.5 ngay

```bash
# Chay checklist tu plan goc — moi item phai PASS:

# Environment:
cd backend
grep APP_DEBUG .env.production          # false
grep APP_ENV .env.production            # production
grep LOG_LEVEL .env.production          # warning
grep SESSION_ENCRYPT .env.production    # true
grep VNPT_AUTH_COOKIE_SECURE .env.production   # true
grep VNPT_AUTH_COOKIE_SAME_SITE .env.production # strict (hoac lax — ghi lai ly do)

# CORS:
test -f config/cors.php && echo "EXISTS" || echo "MISSING"
grep CORS_ALLOWED_ORIGINS .env.production  # khong co '*'

# Headers (chay tren server):
curl -s -I https://yourdomain.vn/api/v5/products | grep -E "X-Frame|X-Content|Strict-Transport|Content-Security|Referrer"

# Database:
php artisan migrate:status | grep -c "Pending"  # 0

# Logging:
test -f storage/logs/laravel.log && echo "OK" || echo "MISSING"
php artisan tinker --execute="echo DB::table('audit_logs')->count();"  # > 0
```

**Nghiem thu Phase 3:**
```bash
# FE:
cd frontend
cat tsconfig.json | grep '"strict": true'  # exists
npm run lint    # 0 errors
npm run test    # PASS
npm run test:e2e  # PASS (25+ specs)
find e2e -name '*.spec.ts' | wc -l  # >= 25

# BE:
cd ../backend
php artisan test  # PASS
rg 'Gate::authorize\|->authorize' app/Http/Controllers/Api/V5/ --type php -c
# So phai >= so mutating endpoints (high-risk entities)
```

---

## 7. Phase 4 — Excellence

> **Tien quyet:** Phase 3 hoan thanh.
> **Thoi gian:** Tuan 9-12
> **Branch prefix:** `tung/phase4-*`

### P4.1: Docker + docker-compose ❌ CHUA LAM

**Thoi gian:** 2 ngay
**Branch:** `tung/phase4-docker`
**Files:**
- `docker-compose.yml` (tao o root)
- `backend/Dockerfile` (tao moi)
- `frontend/Dockerfile` (tao moi)
- `.dockerignore` (tao moi)

Xem chi tiet docker-compose.yml trong plan goc (section 4.1).
NOTE: Skeleton inlined below for self-contained execution:

```yaml
# docker-compose.yml (root) — Minimal skeleton
# Adjust .env values per environment
services:
  app:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "${APP_PORT:-8002}:8002"
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=${DB_DATABASE:-vnpt_business}
      - DB_USERNAME=${DB_USERNAME:-root}
      - DB_PASSWORD=${DB_PASSWORD:?required}
      - REDIS_HOST=redis
      - SESSION_ENCRYPT=true
      - VNPT_AUTH_COOKIE_SECURE=true
      - VNPT_AUTH_COOKIE_SAME_SITE=strict
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - storage_data:/var/www/html/storage

  queue:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: php artisan queue:listen --tries=3 --timeout=300
    environment:
      - APP_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT:-5174}:80"

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: ${DB_DATABASE:-vnpt_business}
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD:?required}
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
  storage_data:
  mysql_data:
  redis_data:
```

**Verify:**
```bash
docker-compose up -d
sleep 30
curl -s http://localhost:8002/api/health | head -1  # {"status":"ok","db":"ok",...}
# NOTE: /api/health is a public unauthenticated endpoint (created in P4.3).
# If P4.3 not yet done, verify with: docker-compose exec app php artisan route:list --json | jq length
curl -s http://localhost:5174 | head -1                   # <!DOCTYPE html>
docker-compose down
```

---

### P4.2: CompatibilityLookupService sunset ❌ CHUA LAM

**Thoi gian:** 1 ngay
**Branch:** `tung/phase4-sunset-compat`

```bash
# Kiem tra consumers:
cd backend
rg 'CompatibilityLookupService' app/ --type php -l
# Neu 0 → xoa file
# Neu co → refactor caller, xoa service
php artisan test  # PASS
```

---

### P4.3: Health check endpoint ❌ CHUA LAM

**Thoi gian:** 0.5 ngay
**Branch:** `tung/phase4-health-check`
**File:** `backend/routes/api.php`

```php
// Them NGOAI auth group:
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        $dbOk = true;
    } catch (\Throwable $e) {
        $dbOk = false;
    }

    $cacheOk = Cache::store()->put('health_check', true, 10);

    return response()->json([
        'status' => ($dbOk && $cacheOk) ? 'ok' : 'degraded',
        'db' => $dbOk ? 'ok' : 'error',
        'cache' => $cacheOk ? 'ok' : 'error',
        'timestamp' => now()->toIso8601String(),
    ], ($dbOk && $cacheOk) ? 200 : 503);
});
```

**Verify:**
```bash
curl -s http://127.0.0.1:8002/api/health | jq .
# {"status":"ok","db":"ok","cache":"ok","timestamp":"..."}
```

---

### P4.4: Security scanning CI ❌ CHUA LAM

**Thoi gian:** 1 ngay
**Branch:** `tung/phase4-security-ci`
**File:** `.github/workflows/security.yml` (tao moi)

Xem chi tiet YAML trong plan goc (section 4.5).
NOTE: Skeleton inlined below for self-contained execution:

```yaml
# .github/workflows/security.yml — Minimal skeleton
name: Security Scan
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Moi thu Hai 6:00 AM UTC

jobs:
  php-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.4'
      - run: cd backend && composer install --no-interaction --no-progress
      - name: PHP dependency audit
        run: cd backend && composer audit --format=json

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: cd frontend && npm ci
      - name: NPM audit (production only)
        run: cd frontend && npm audit --production --audit-level=high

  dependency-review:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
```

**Verify:**
```bash
# Local test:
cd backend && composer audit
cd ../frontend && npm audit --omit=dev --audit-level=high
# 0 high/critical
```

---

### P4.5: Path aliases chuan hoa ❌ CHUA LAM

**Thoi gian:** 1 ngay
**Branch:** `tung/phase4-path-aliases`
**Files:**
- `frontend/tsconfig.json` (them paths)
- `frontend/vite.config.ts` (them resolve.alias)
- 20-30 file update imports

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["./components/*"],
      "@stores/*": ["./shared/stores/*"],
      "@utils/*": ["./utils/*"],
      "@services/*": ["./services/*"]
    }
  }
}
```

---

### P4.6: OpenAPI spec + API contract test ❌ CHUA LAM

**Thoi gian:** 3 ngay
**Branch:** `tung/phase4-openapi`

```bash
cd backend
composer require dedoc/scramble  # auto-generate OpenAPI tu Laravel routes
# hoac: viet spec thu cong cho key endpoints
```

---

### P4.7: Penetration test (external vendor) ❌ CHUA LAM

**Thoi gian:** 5-10 ngay (outsource)
**Khong co code — lien he vendor bao mat**

**Yeu cau:**
- Scope: full stack (FE + BE + infrastructure)
- Methodology: OWASP Testing Guide v4.2
- Deliverable: report + remediation priority list

**Nghiem thu Phase 4:**
```bash
# Docker:
docker-compose up -d && curl -s http://localhost:8002/api/health | jq .status
# "ok"

# Security:
cd backend && composer audit                            # 0 high/critical
cd ../frontend && npm audit --omit=dev --audit-level=high  # 0 high/critical

# Cleanup:
cd ../backend
rg 'CompatibilityLookupService' app/ --type php -l  # 0 results

# Health:
curl -s http://127.0.0.1:8002/api/health | jq .status  # "ok"

# Pentest:
# Report hoan thanh, 0 critical findings con lai
```

---

## 8. Lenh verify nhanh

> Copy-paste de chay bat ky luc nao kiem tra trang thai hien tai.

```bash
echo "=== BASELINE METRICS ==="

echo "--- Frontend ---"
cd /Users/pvro86gmail.com/Downloads/QLCV/frontend
echo "App.tsx lines: $(wc -l < App.tsx)"
echo "Stores: $(find shared/stores -name '*Store.ts' | wc -l) files"
echo "E2E specs: $(find e2e -name '*.spec.ts' 2>/dev/null | wc -l) files"
echo "Unit tests: $(find . -path ./node_modules -prune -o \( -name '*.test.*' -o -name '*.spec.*' \) ! -path '*/e2e/*' -print | wc -l) files"
echo "TS strict: $(grep -c '"strict": true' tsconfig.json 2>/dev/null || echo 0)"
echo "Vite host: $(grep 'host:' vite.config.ts | head -1 | xargs)"
echo "Implicit-allow: $(grep -c 'return true;' utils/authorization.ts)"

echo ""
echo "--- Backend ---"
cd /Users/pvro86gmail.com/Downloads/QLCV/backend
echo "cors.php: $(test -f config/cors.php && echo 'EXISTS' || echo 'MISSING')"
echo "COOKIE_SECURE: $(grep VNPT_AUTH_COOKIE_SECURE .env.example | cut -d= -f2)"
echo "SESSION_ENCRYPT: $(grep SESSION_ENCRYPT .env.example | cut -d= -f2)"
echo "WriteService lines: $(wc -l < app/Services/V5/CustomerRequest/CustomerRequestCaseWriteService.php 2>/dev/null || echo 'N/A')"
echo "Policies: $(find app/Policies -name '*.php' -not -path '*/Concerns/*' | wc -l) files"
echo "GET rate limiter: $(grep -c 'api.read' app/Providers/AppServiceProvider.php 2>/dev/null || echo 0)"
echo "Docker: $(test -f ../docker-compose.yml && echo 'EXISTS' || echo 'MISSING')"
echo "Health endpoint: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8002/api/health 2>/dev/null || echo 'DOWN')"

echo ""
echo "--- Tests ---"
echo "BE tests: $(cd /Users/pvro86gmail.com/Downloads/QLCV/backend && php artisan test 2>&1 | tail -1)"
echo "FE lint: $(cd /Users/pvro86gmail.com/Downloads/QLCV/frontend && npm run lint 2>&1 | tail -1)"
```

---

> **Cap nhat trang thai:** Khi hoan thanh moi task, doi `❌ CHUA LAM` thanh `✅ DONE (YYYY-MM-DD)` va cap nhat bang tong hop o Section 1.

---

## 9. OWASP Top 10 (2021) Mapping

> Map tung task trong plan den OWASP category. Muc dich: dam bao khong co gap nao.

| OWASP | Category | Task(s) trong plan | Trang thai hien tai (evidence) | Sau nang cap |
|-------|----------|---------|--------------------|----|
| **A01** | Broken Access Control | A8 (IDOR audit), P3.1 (Policies) | Route-middleware OK. READ scope EXISTS in CustomerDomainService::applyReadScope() (line 664-738: contracts.dept_id OR projects.dept_id OR created_by). WRITE scope (update/delete) MISSING — CustomerController::update() does not call Gate::authorize(). Evidence: `EnsurePermission.php` checks `resource.action` but no entity-level policy on mutations. | Policy for write-scope + Gate::authorize() on mutating controller methods |
| **A02** | Cryptographic Failures | A1 (COOKIE_SECURE), A2 (SESSION_ENCRYPT) | Bcrypt-12 ✅. COOKIE_SECURE=empty → plain HTTP. Evidence: `vnpt_auth.php:10` → `env('VNPT_AUTH_COOKIE_SECURE')` returns null. | COOKIE_SECURE=true, SESSION_ENCRYPT=true |
| **A03** | Injection | Khong can task moi | Eloquent ORM + prepared statements. `rg -c 'DB::raw' app/` → 92 uses, all parameterized. | Maintained ✅ |
| **A04** | Insecure Design | A6 (implicit-allow), P1.1 (strict TS), P2.1-5 (Zustand) | `authorization.ts:94-95` → `hasPermission(null)=true`. App.tsx=1,579 lines. | Default-deny + strict types + modular state |
| **A05** | Security Misconfiguration | A7 (CORS), A4-5 (DEBUG/LOG), P1.2 (vite host) | CSP strict ✅. No `config/cors.php` (using Laravel defaults: `allowed_origins: ['*']`). Note: `.env.example:6` has `APP_DEBUG=false` but devs may override in `.env`. | Explicit CORS whitelist + production env lock |
| **A06** | Vulnerable Components | P4.4 (CI security scan) | Laravel 12 + PHP 8.4 current ✅. npm dev-only vulns. | `composer audit` + `npm audit --omit=dev` in CI |
| **A07** | Identification & Auth | A3 (SameSite=strict), A9 (frontend password exposure), P1.1 (strictNullChecks for auth) | 3-token ✅. Password 12+ chars ✅. SameSite=lax. Frontend van co luong hien thi/giu plaintext secret trong mot so screen. | SameSite=strict + khong tra/khong render plaintext password + TS strict on auth flow |
| **A08** | Software & Data Integrity | P2.8 (route parity), P4.4 (dependency review) | Audit logging ✅. Signed downloads ✅. `V5AccessAuditService` records all mutations. | Route-parity CI + dependency-review action |
| **A09** | Security Logging & Monitoring | P4.3 (health check) | AuditService + AuditValueSanitizer ✅. `audit.php` masks sensitive fields. | Health check endpoint + monitoring |
| **A10** | SSRF | Review during P4.7 (pentest) | Outbound HTTP exists: `GoogleDriveIntegrationService` + `BackblazeB2IntegrationService` use `Http::withToken()` — BUT URLs are constructed from admin-configured settings, NOT user-input. Low risk. | Verify during pentest; add URL allowlist if needed |

### Coverage: 10/10 OWASP categories addressed ✅

---

## 10. Scoring Rubric

> Phuong phap tinh diem voi weight + metric do duoc.

### Dimensions & Weights

| # | Dimension | Weight | Metric | Lenh do | 10/10 | 0/10 |
|---|-----------|--------|--------|---------|-------|------|
| 1 | Auth Security | 15% | Token type + TTL + password policy | Review `vnpt_auth.php` | httpOnly + ≤60min + 12+chars | localStorage or >24h |
| 2 | Access Control | 15% | % mutating endpoints co policy hoac Gate check | `rg 'Gate::authorize\|->authorize\|Policy' backend/app/Http/Controllers/Api/V5/ --type php -c` / (`php artisan route:list --json \| jq '[.[] \| select(.uri \| startswith("api/v5/")) \| select(.method \| test("POST\|PUT\|PATCH\|DELETE"))] \| length'`) | ≥90% | <50% |
| 3 | API Security | 10% | Rate limiting + CORS + CSP | Review AppServiceProvider + cors.php + SecurityHeaders | 3-tier rate + whitelist CORS + strict CSP | Missing any |
| 4 | Input Validation | 10% | % endpoints co FormRequest | `find app/Http/Requests -name '*.php' \| wc -l` / endpoints | ≥80% | <50% |
| 5 | Code Architecture | 15% | max(file_lines) ÷ 1000 penalty | `wc -l App.tsx`, `wc -l V5MasterDataController.php` | All files <1,000 lines | Any file >5,000 lines |
| 6 | Type Safety | 10% | TS strict flags | `grep strict tsconfig.json` | `"strict": true` | No strict |
| 7 | State Management | 5% | Zustand stores vs App.tsx size | `find shared/stores -name '*Store.ts' \| wc -l` | ≥8 stores, App.tsx <1,500 | 0 stores |
| 8 | Test Coverage | 10% | Unit + E2E count | `find __tests__` + `find e2e` | ≥100 unit + ≥20 E2E | <20 unit |
| 9 | DevOps Maturity | 5% | Docker + CI + health | `test -f docker-compose.yml`, review CI | Docker + CI + health + security scan | No CI |
| 10 | Audit & Monitoring | 5% | Audit logging coverage | `rg recordAuditEvent -c` | Auto-audit all mutations | No audit |

### Baseline Calculation (2026-03-31)

```
Measured from repo:
  App.tsx: 1,587 lines (wc -l frontend/App.tsx)
  Unit tests: 108 files (find frontend -name '*.test.*' ! -path '*/e2e/*' | wc -l)
  E2E specs: 7 files (find frontend/e2e -name '*.spec.ts' | wc -l)
  Zustand stores: 6 files (find frontend/shared/stores -name '*Store.ts' | wc -l)
  V5 routes: 334 total, 181 mutating (php artisan route:list --json | jq)
  Policies: checked via rg 'Gate::authorize' — currently 0 in high-risk entities

Score:
  1. Auth Security:     9/10 × 15% = 1.35
  2. Access Control:    5/10 × 15% = 0.75
  3. API Security:      7/10 × 10% = 0.70
  4. Input Validation:  8/10 × 10% = 0.80
  5. Code Architecture: 4/10 × 15% = 0.60
  6. Type Safety:       3/10 × 10% = 0.30
  7. State Management:  4/10 × 5%  = 0.20
  8. Test Coverage:     6/10 × 10% = 0.60
  9. DevOps Maturity:   4/10 × 5%  = 0.20
  10. Audit & Monitor:  9/10 × 5%  = 0.45
  ─────────────────────────────────────────
  TOTAL = 5.95 → 6.0/10 (baseline)
```

### Target per Phase

| Phase | Target | Key Improvements |
|-------|--------|-----------------|
| After Phase A | 6.5 | Access Control +1, API Security +1, Auth +0.5 |
| After Phase 1 | 7.5 | Type Safety +5, Code Arch +1 |
| After Phase 2 | 8.0 | Code Arch +3 (App.tsx <1,000), State Mgmt +4 |
| After Phase 3 | 8.5 | Access Control +3, Test +2, API Security +2 |
| After Phase 4 | 9.0 | DevOps +4, Code Arch +2 |
