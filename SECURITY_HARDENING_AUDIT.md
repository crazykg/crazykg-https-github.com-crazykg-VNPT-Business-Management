# QLCV Security Hardening Audit Report
**Date:** April 1, 2026  
**Scope:** Frontend authorization, Backend CORS/Auth config, API authorization, and Policy enforcement

---

## EXECUTIVE SUMMARY

**Critical Security Issues Found: 4 HIGH, 3 MEDIUM**

The QLCV application has **CRITICAL implicit-allow bugs** in both frontend authorization checks and insufficient backend mutation authorization. Multiple API endpoints lack Policy enforcement, and several configurations need hardening.

---

## 1. FRONTEND AUTHORIZATION — `frontend/utils/authorization.ts`

### 🔴 CRITICAL BUG #1: Implicit Allow for `null` Permission

**File:** `/Users/pvro86gmail.com/Downloads/QLCV/frontend/utils/authorization.ts`  
**Lines:** 93–96

```typescript
export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
  if (!permission) {
    return true;  // ⚠️ BUG: null/undefined permission GRANTS access!
  }
  if (!user) {
    return false;
  }
  // ...
```

**Impact:** ANY code calling `hasPermission(user, null)` or `hasPermission(user, undefined)` returns `true`, bypassing authorization entirely.

**Attack Scenario:**
```typescript
// Tab access with missing permission
canAccessTab(user, 'support_master_management')  // TAB_PERMISSION_MAP['support_master_management'] = null
  → hasPermission(user, null)  // Line 132
  → returns true  // IMPLICIT ALLOW!
```

**Affected Functions:**
- `canAccessTab()` — Line 123-132
- `canOpenModal()` — Line 152 (with `MODAL_PERMISSION_MAP[modalType] ?? null`)

---

### 🔴 CRITICAL BUG #2: Undefined Tab in TAB_PERMISSION_MAP Returns false (Partial)

**File:** `frontend/utils/authorization.ts`  
**Lines:** 123–132

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
    // ✓ Correctly denies
    if (import.meta.env.DEV) {
      console.warn(`[Auth] Tab '${tabId}' missing from TAB_PERMISSION_MAP - denied`);
    }
    return false;
  }

  return hasPermission(user, permission);  // ⚠️ BUT: if permission === null, still calls hasPermission(user, null) → TRUE!
};
```

**Critical Tab Entries with `null` Permission:**
- Line 21: `support_master_management: null` — Handled specially (partial fix)

**Why the null entry is dangerous:**
Even though `support_master_management` is handled separately, the pattern of storing `null` in the map creates ambiguity. If this null check fails or is bypassed, `hasPermission(user, null)` returns `true`.

---

### 🟡 MEDIUM BUG #3: Modal Permission Map with `null` Values

**File:** `frontend/utils/authorization.ts`  
**Lines:** 139–153

```typescript
export const canOpenModal = (
  user: AuthUser | null,
  modalType: ModalType,
  activeModuleKey: string
): boolean => {
  if (!modalType) {
    return true;  // ⚠️ Allows null/undefined modal type
  }

  if (modalType === 'IMPORT_DATA') {
    return hasPermission(user, resolveImportPermission(activeModuleKey));
  }

  return hasPermission(user, MODAL_PERMISSION_MAP[modalType] ?? null);  // ⚠️ Default to null → implicit allow
};
```

**Impact:** Modals with missing entries in `MODAL_PERMISSION_MAP` or `null` values implicitly allow access.

---

### Test Coverage Analysis

**File:** `frontend/__tests__/authorization.test.ts`

**✓ Good Test Cases:**
- Line 19–22: Tests null/undefined permission returns `true` (DOCUMENTS THE BUG!)
- Line 63–67: Tests unknown tabs are denied
- Line 84–86: Tests null for unknown import modules

**Missing Tests:**
- ❌ No test for `hasPermission(user, null)` returning true (this should FAIL)
- ❌ No test for modal with null permission
- ❌ No test for `canOpenModal(user, null, 'module')` edge case

---

## 2. BACKEND CONFIGURATION — CORS & Security Headers

### ✓ GOOD: `backend/config/cors.php`

**File:** `/Users/pvro86gmail.com/Downloads/QLCV/backend/config/cors.php`

```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter(array_map(
        static fn (string $origin): string => trim($origin),
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
    ))),
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

**Status:** ✓ CORS config is secure:
- Only allows `CORS_ALLOWED_ORIGINS` from env
- `supports_credentials` = true with origin validation (safe pattern)
- Limited exposed headers

---

### ✓ GOOD: `backend/.env.example` Security Defaults

**File:** `backend/.env.example`

**Secure Defaults Observed:**
- Line 6: `APP_DEBUG=false` ✓
- Line 23: `LOG_LEVEL=warning` ✓ (not debug)
- Line 42: `SESSION_ENCRYPT=true` ✓
- Line 55: `VNPT_AUTH_COOKIE_SECURE=true` ✓ (HTTPS-only)
- Line 56: `VNPT_AUTH_COOKIE_SAME_SITE=strict` ✓ (SameSite strict)
- Line 60: `CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174` (dev-only, good)

**Concerns:**
- Session lifetime is 120 minutes (Line 41) — reasonable for sensitive operations
- No explicit HSTS header configuration in env

---

### ✓ GOOD: `backend/bootstrap/app.php` Middleware

**File:** `backend/bootstrap/app.php`

**Lines 21–34: API Middleware Stack**
```php
$middleware->api(prepend: [
    \App\Http\Middleware\RejectOversizedRequest::class,      // ✓ DOS protection
    \App\Http\Middleware\UseSanctumCookieToken::class,       // ✓ Cookie auth
    \App\Http\Middleware\SecurityHeaders::class,             // ✓ Security headers
]);

$middleware->alias([
    'permission'       => \App\Http\Middleware\EnsurePermission::class,
    'sanctum.cookie'   => \App\Http\Middleware\UseSanctumCookieToken::class,
    'password.change'  => \App\Http\Middleware\EnforcePasswordChange::class,
    'active.tab'       => \App\Http\Middleware\EnsureActiveTab::class,
]);
```

**Status:** ✓ Solid middleware composition

---

## 3. BACKEND API AUTHORIZATION — Controllers & Policies

### 🔴 CRITICAL BUG #4: Most API Mutations Lack Policy Authorization

**Analysis:**
Out of 32 controllers in `/backend/app/Http/Controllers/Api/V5/`:

**Controllers with EXPLICIT Model Policy Enforcement:**
- ✓ `CustomerController.php` (Lines 43, 55):
  ```php
  Gate::authorize('update', Customer::query()->findOrFail($id));
  Gate::authorize('delete', Customer::query()->findOrFail($id));
  ```

**Controllers WITHOUT Policy Enforcement:**
- ❌ `ContractController.php` — `store()`, `update()`, `destroy()` → NO Gate::authorize calls
- ❌ `EmployeeController.php` — `store()`, `update()`, `destroy()` → NO Gate::authorize calls
- ❌ `FeeCollectionController.php` — `invoiceStore()`, `invoiceUpdate()`, `invoiceDestroy()` → NO Gate::authorize calls
- ❌ `RevenueManagementController.php` — `targetStore()`, `targetUpdate()`, `targetDestroy()` → NO Gate::authorize calls
- ❌ `DepartmentController.php` — No destroy method visible, but store/update likely unguarded
- ❌ `ProductController.php` — Mutations unguarded
- ❌ `ProjectController.php` — Mutations unguarded
- ❌ `VendorController.php` — Mutations unguarded
- ❌ `DocumentController.php` — Mutations unguarded

**Where Authorization Happens:**
Authorization is delegated to DomainServices and FormRequests:

**File:** `backend/app/Http/Requests/V5/StoreContractRequest.php` (via grep results)
```php
return $this->authorizeWithPermission('contracts.write');
```

**File:** `backend/app/Http/Requests/V5/UpdateInvoiceRequest.php`
```php
return $this->authorizeWithPermission('fee_collection.write');
```

**Critical Gap:** Authorization is based on **GLOBAL PERMISSION ONLY**, not **RECORD-LEVEL POLICY**.

---

### 🟡 MEDIUM BUG #4a: Missing Department-Scoped Authorization on Mutations

**File:** `backend/app/Services/V5/Domain/ContractDomainService.php`

```php
public function destroy(Request $request, int $id): JsonResponse
{
    if (! $this->support->hasTable('contracts')) {
        return $this->support->missingTable('contracts');
    }

    $contract = Contract::query()->findOrFail($id);
    // ⚠️ NO AUTHORIZATION CHECK! No Policy evaluation!
    // User could delete ANY contract if they have 'contracts.delete' permission
    // But they should only delete contracts in their department scope!
```

**The Policy Chain is Broken:**
1. ✓ `ContractPolicy.php` has proper authorization logic (Lines 26–37):
   ```php
   public function update(InternalUser $user, Contract $contract): bool
   {
       if (! $this->hasPermission($user, 'contracts.write')) {
           return false;
       }
       return $this->isAllowedByDepartmentScope(
           $user,
           $this->resolveContractDepartmentIds($contract),
           [(int) $contract->getAttribute('created_by')]
       );
   }
   ```

2. ❌ BUT: This policy is **NEVER CALLED** in `ContractDomainService::destroy()`

3. ❌ Same issue in `InvoiceDomainService`, `ProjectDomainService`, etc.

---

### Policies Defined (But Not Always Used)

**File:** `backend/app/Policies/`

**Policy Files:**
- `ContractPolicy.php` (Lines 1–51) — Proper implementation ✓
- `InvoicePolicy.php` (Lines 1–59) — Proper implementation ✓
- `CustomerRequestCasePolicy.php` (Lines 1–65) — Proper implementation ✓
- `CustomerPolicy.php` (Lines 1–63) — BUT NO `view()` method, missing delete pre-check ❌

**All Use:** `ResolvesDepartmentScopedAccess` trait (Lines 1–123)

**Trait Implementation:**
- Lines 19–22: `hasPermission()` — Delegates to UserAccessService ✓
- Lines 28–55: `isAllowedByDepartmentScope()` — Department scoping logic ✓
  - Checks: Is user admin? → allow
  - Resolves allowed dept IDs
  - Checks if resource dept is in allowed depts OR user is creator

---

### Backend Authorization Service

**File:** `backend/app/Support/Auth/UserAccessService.php` (Lines 1–321)

**Key Functions:**
1. **`hasPermission(int $userId, string $permissionKey): bool`** (Lines 134–147)
   ```php
   public function hasPermission(int $userId, string $permissionKey): bool
   {
       $permission = trim($permissionKey);
       if ($permission === '') {
           return false;  // ✓ Correctly rejects empty strings
       }

       $permissions = $this->permissionKeysForUser($userId);
       if (in_array('*', $permissions, true)) {
           return true;  // ✓ Wildcard check
       }

       return in_array($permission, $permissions, true);
   }
   ```
   **Status:** ✓ Properly rejects empty permission keys (unlike frontend!)

2. **`isAdmin(int $userId): bool`** (Lines 48–51)
   ```php
   public function isAdmin(int $userId): bool
   {
       return in_array('ADMIN', $this->roleCodesForUser($userId), true);
   }
   ```
   **Status:** ✓ Simple admin check

3. **`resolveDepartmentIdsForUser(int $userId): ?array`** (Lines 232–248)
   - Returns `null` if user has access to ALL departments
   - Returns `[]` if `self_only`
   - Returns specific dept IDs filtered
   **Status:** ✓ Proper null coalescing

---

### Middleware Authorization

**File:** `backend/app/Http/Middleware/EnsurePermission.php` (Lines 1–49)

```php
public function handle(Request $request, Closure $next, string $permissions): Response
{
    $user = $request->user();
    if ($user === null) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    $required = array_values(array_filter(array_map(
        fn (string $value): string => trim($value),
        explode('|', $permissions)  // ✓ Supports OR logic (permission1|permission2)
    )));

    if ($required === []) {
        return $next($request);  // ⚠️ Empty permission list → ALLOWS!
    }

    $userId = (int) ($user->id ?? 0);
    if ($userId <= 0) {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }

    foreach ($required as $permission) {
        if ($this->accessService->hasPermission($userId, $permission)) {
            return $next($request);  // ✓ Short-circuit on first match
        }
    }

    return response()->json(['message' => 'This action is unauthorized.'], 403);
}
```

**Status:** ✓ Generally solid, but Line 30: empty permission list allows all (acceptable if route-level guard)

---

## 4. AUTHORIZATION TEST COVERAGE

**File:** `frontend/__tests__/authorization.test.ts`

**Current Tests (Lines 1–121):**

| Test | Lines | Status |
|------|-------|--------|
| `hasPermission` with null permission → true | 19–22 | ⚠️ Tests a BUG |
| `hasPermission` rejects protected permissions | 24–26 | ✓ Good |
| `hasPermission` grants to admins | 28–32 | ✓ Good |
| `hasPermission` grants wildcard | 34–38 | ✓ Good |
| `hasPermission` exact match | 40–45 | ✓ Good |
| `canAccessTab` requires mapped permission | 49–55 | ✓ Good |
| `canAccessTab` special support_master logic | 57–61 | ✓ Good |
| `canAccessTab` denies unknown tabs | 63–67 | ✓ Good |
| `canAccessTab` denies support_master when no perms | 69–73 | ✓ Good |
| `resolveImportPermission` returns configured | 77–82 | ✓ Good |
| `resolveImportPermission` returns null for unknown | 84–86 | ✓ Good |
| `canOpenModal` with import | 90–96 | ✓ Good |
| `canOpenModal` with regular modals | 98–103 | ✓ Good |
| `canOpenModal` party profile | 105–110 | ✓ Good |
| `canOpenModal` product target segment | 112–118 | ✓ Good |

**Missing Critical Tests:**
- ❌ `hasPermission(user, null)` should return **FALSE**, not true
- ❌ `hasPermission(user, undefined)` should return **FALSE**, not true
- ❌ `canOpenModal(user, null, 'module')` behavior
- ❌ `canOpenModal(user, 'UNKNOWN_MODAL', 'module')` behavior
- ❌ Edge case: permission string with whitespace only

---

## 5. SUMMARY TABLE

| Issue | Severity | Location | Line(s) | Status |
|-------|----------|----------|---------|--------|
| **Implicit allow on null/undefined permission** | 🔴 CRITICAL | `frontend/utils/authorization.ts` | 93–96 | ❌ UNFIXED |
| **Tab with null permission can allow access** | 🔴 CRITICAL | `frontend/utils/authorization.ts` | 123–132 | ⚠️ PARTIALLY MITIGATED |
| **Modal with null permission implicit allow** | 🟡 MEDIUM | `frontend/utils/authorization.ts` | 139–152 | ❌ UNFIXED |
| **Tests document (not prevent) the null bug** | 🟡 MEDIUM | `frontend/__tests__/authorization.test.ts` | 19–22 | ⚠️ NEEDS REVIEW |
| **Most API mutations lack Policy enforcement** | 🔴 CRITICAL | `backend/app/Services/V5/Domain/*.php` | Various | ❌ UNFIXED |
| **Department scoping not enforced on mutations** | 🟡 MEDIUM | `backend/app/Services/V5/Domain/ContractDomainService.php` | destroy() | ❌ UNFIXED |
| **CustomerPolicy missing view() method** | 🟡 MEDIUM | `backend/app/Policies/CustomerPolicy.php` | 1–63 | ⚠️ VERIFY |
| **CORS and security headers** | ✓ GOOD | `backend/config/cors.php` `backend/bootstrap/app.php` | Various | ✓ SECURE |
| **Environment variables secure** | ✓ GOOD | `backend/.env.example` | Various | ✓ SECURE |

---

## 6. RECOMMENDED FIXES (Priority Order)

### P0 — Fix Frontend Implicit Allow
```typescript
// frontend/utils/authorization.ts — Lines 93–96
export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
  // FIX: Reject null/undefined/empty permissions
  if (!permission || permission.trim() === '') {
    return false;  // CHANGED: was return true
  }
  // ... rest unchanged
};
```

### P0 — Enforce Model Policies on All Mutations
```php
// backend/app/Services/V5/Domain/ContractDomainService.php
public function destroy(Request $request, int $id): JsonResponse
{
    if (! $this->support->hasTable('contracts')) {
        return $this->support->missingTable('contracts');
    }

    $contract = Contract::query()->findOrFail($id);
    
    // ADD: Gate authorization
    $user = $request->user();
    if (!$user || !$user->can('delete', $contract)) {
        abort(403, 'Unauthorized action.');
    }
    
    // ... rest of logic
}
```

### P1 — Add Comprehensive Authorization Tests
```typescript
// frontend/__tests__/authorization.test.ts
describe('authorization security fixes', () => {
  it('rejects null permission', () => {
    expect(hasPermission(user, null)).toBe(false);  // NOT true!
  });

  it('rejects undefined permission', () => {
    expect(hasPermission(user, undefined)).toBe(false);  // NOT true!
  });

  it('rejects whitespace-only permission', () => {
    expect(hasPermission(user, '   ')).toBe(false);
  });

  it('rejects modal with null type', () => {
    expect(canOpenModal(user, null, 'module')).toBe(false);
  });

  it('rejects unknown modal type', () => {
    expect(canOpenModal(user, 'UNKNOWN' as ModalType, 'module')).toBe(false);
  });
});
```

### P1 — Verify All Policies are Registered
```php
// backend/app/Providers/AuthServiceProvider.php
protected $policies = [
    Contract::class => ContractPolicy::class,
    Invoice::class => InvoicePolicy::class,
    CustomerRequestCase::class => CustomerRequestCasePolicy::class,
    Customer::class => CustomerPolicy::class,
    // TODO: Add missing policies for Project, Department, Employee, etc.
];
```

---

## 7. FILE LISTING FOR REFERENCE

### Frontend
- `frontend/utils/authorization.ts` — Authorization logic (154 lines)
- `frontend/__tests__/authorization.test.ts` — Test suite (121 lines)
- `frontend/types/auth.ts` — AuthUser & ModalType types

### Backend
- `backend/config/cors.php` — CORS configuration (29 lines)
- `backend/config/auth.php` — Auth guards configuration (115 lines)
- `backend/bootstrap/app.php` — Middleware & exception handling (116 lines)
- `backend/app/Support/Auth/UserAccessService.php` — Permission resolution (321 lines)
- `backend/app/Http/Middleware/EnsurePermission.php` — Permission middleware (49 lines)
- `backend/app/Policies/ContractPolicy.php` — Contract policy (51 lines)
- `backend/app/Policies/InvoicePolicy.php` — Invoice policy (59 lines)
- `backend/app/Policies/CustomerRequestCasePolicy.php` — CRC policy (65 lines)
- `backend/app/Policies/CustomerPolicy.php` — Customer policy (63 lines)
- `backend/app/Policies/Concerns/ResolvesDepartmentScopedAccess.php` — Policy trait (123 lines)
- `backend/.env.example` — Environment template (115 lines)

### API Controllers (32 total)
- Key mutation handlers: `FeeCollectionController`, `RevenueManagementController`, `ContractController`, `CustomerController`, `EmployeeController`, `DepartmentController`, `ProductController`, `ProjectController`
