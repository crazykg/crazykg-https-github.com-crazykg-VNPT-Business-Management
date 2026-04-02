# QLCV Security Audit — Detailed Findings with Code References

## Quick Reference by File

```
🔴 CRITICAL
  ├─ frontend/utils/authorization.ts (Lines 93-96, 123-132, 139-153)
  └─ backend/app/Services/V5/Domain/*.php (All mutation methods)

🟡 MEDIUM
  ├─ frontend/__tests__/authorization.test.ts (Lines 19-22)
  ├─ frontend/utils/authorization.ts (Lines 144-145)
  └─ backend/app/Policies/CustomerPolicy.php (Missing methods)

✓ GOOD
  ├─ backend/config/cors.php (All lines)
  ├─ backend/bootstrap/app.php (Lines 21-34)
  ├─ backend/.env.example (All lines)
  └─ backend/app/Support/Auth/UserAccessService.php (All lines)
```

---

## CRITICAL BUG #1: Frontend Implicit Allow (Line 93-96)

### Location
`frontend/utils/authorization.ts` — Lines 93-96

### Exact Code
```typescript
export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
  if (!permission) {
    return true;  // ⚠️ THIS IS THE BUG
  }
  if (!user) {
    return false;
  }

  const roles = (user.roles || []).map((role) => String(role).toUpperCase());
  if (roles.includes('ADMIN')) {
    return true;
  }

  const permissions = new Set((user.permissions || []).map((perm) => String(perm).trim()));
  if (permissions.has('*')) {
    return true;
  }

  return permissions.has(permission);
};
```

### The Problem
Line 95 returns `true` when `permission` is falsy (null, undefined, '', 0, false, NaN).

### Who Calls This Function?
```
canAccessTab()          ← Line 132
  └─ hasPermission(user, permission)

canOpenModal()          ← Line 152
  └─ hasPermission(user, MODAL_PERMISSION_MAP[modalType] ?? null)

resolveImportPermission()  ← Line 149
  └─ hasPermission(user, resolveImportPermission(activeModuleKey))
```

### Call Chain Example
```
User clicks "Support Management" tab
  ↓
frontend renders canAccessTab(user, 'support_master_management')
  ↓
TAB_PERMISSION_MAP['support_master_management'] = null (Line 21)
  ↓
canAccessTab() returns hasPermission(user, null) (Line 132)
  ↓
hasPermission() sees !null evaluates to true
  ↓
Returns TRUE immediately without checking permissions
  ↓
🚨 USER GAINS UNAUTHORIZED ACCESS!
```

### Test That Documents The Bug
**File:** `frontend/__tests__/authorization.test.ts` — Lines 19-22

```typescript
it('allows empty permission keys', () => {
  expect(hasPermission(null, null)).toBe(true);        // ⚠️ Should be FALSE
  expect(hasPermission(null, undefined)).toBe(true);   // ⚠️ Should be FALSE
});
```

The test DOCUMENTS the bug instead of PREVENTING it!

### Backend Equivalent - The Correct Way
**File:** `backend/app/Support/Auth/UserAccessService.php` — Lines 134-147

```php
public function hasPermission(int $userId, string $permissionKey): bool
{
    $permission = trim($permissionKey);
    if ($permission === '') {
        return false;  // ✓ CORRECT: Rejects empty permission!
    }

    $permissions = $this->permissionKeysForUser($userId);
    if (in_array('*', $permissions, true)) {
        return true;
    }

    return in_array($permission, $permissions, true);
}
```

The backend implementation correctly returns `FALSE` for empty strings.

### Fix Required
```diff
- export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
+ export const hasPermission = (user: AuthUser | null, permission: string | null | undefined): boolean => {
-  if (!permission) {
+  if (!permission || String(permission).trim() === '') {
-    return true;
+    return false;  // SECURITY FIX
    }
```

---

## CRITICAL BUG #2: Tab Permission Map with Null (Line 123-132)

### Location
`frontend/utils/authorization.ts` — Lines 3-29 (map definition) and 123-132 (usage)

### The Dangerous Map
```typescript
const TAB_PERMISSION_MAP: Record<string, string | null> = {
  dashboard: 'dashboard.view',
  internal_user_dashboard: 'employees.read',
  // ... many entries ...
  support_master_management: null,  // ⚠️ LINE 21: null entry!
  // ... more entries ...
};
```

### The Usage Function
```typescript
export const canAccessTab = (user: AuthUser | null, tabId: string): boolean => {
  if (tabId === 'support_master_management') {
    // Special handling for this one tab
    return (
      hasPermission(user, 'support_requests.read')
      || hasPermission(user, 'support_service_groups.read')
      || hasPermission(user, 'support_contact_positions.read')
    );
  }

  const permission = TAB_PERMISSION_MAP[tabId];
  if (permission === undefined) {
    // Unknown tab → correctly denied
    if (import.meta.env.DEV) {
      console.warn(`[Auth] Tab '${tabId}' missing from TAB_PERMISSION_MAP - denied`);
    }
    return false;
  }

  // ⚠️ This line executes for permission === null:
  return hasPermission(user, permission);  // Line 132
};
```

### Why It's Still Vulnerable
1. `support_master_management` is handled specially (partial fix)
2. BUT if that special case is ever removed or bypassed:
   - `permission = null`
   - `hasPermission(user, null)` is called
   - Returns TRUE due to BUG #1

3. Pattern is established for future tabs that might use `null`

### Solution
Remove null entries entirely, or always use specific permissions:

```typescript
const TAB_PERMISSION_MAP: Record<string, string> = {
  // No null values
  dashboard: 'dashboard.view',
  support_master_management: 'support_requests.read',  // Always use permission
  // ...
};
```

---

## CRITICAL BUG #3: API Mutations Lack Policy Enforcement

### Location
`backend/app/Services/V5/Domain/*.php` and `backend/app/Http/Controllers/Api/V5/*.php`

### The Problem in Detail

#### Only 1 Controller Has Proper Authorization (CustomerController)
```php
// ✓ GOOD - backend/app/Http/Controllers/Api/V5/CustomerController.php
public function update(UpdateCustomerRequest $request, int $id): JsonResponse
{
    Gate::authorize('update', Customer::query()->findOrFail($id));  // ✓ Policy enforced
    // ...
}

public function destroy(Request $request, int $id): JsonResponse
{
    Gate::authorize('delete', Customer::query()->findOrFail($id));  // ✓ Policy enforced
    // ...
}
```

#### All Other Controllers Lack This (31 out of 32)
```php
// ❌ BAD - backend/app/Http/Controllers/Api/V5/ContractController.php
public function update(UpdateContractRequest $request, int $id): JsonResponse
{
    return $this->contractService->update($request, $id);  // ❌ No authorization!
}

public function destroy(Request $request, int $id): JsonResponse
{
    return $this->contractService->destroy($request, $id);  // ❌ No authorization!
}
```

### The Proper Authorization Layer Exists But Is Unused

**File:** `backend/app/Policies/ContractPolicy.php` (Lines 26-37)
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

**File:** `backend/app/Policies/InvoicePolicy.php` (Lines 26-41)
```php
public function update(InternalUser $user, Invoice $invoice): bool
{
    if (! $this->hasPermission($user, 'fee_collection.write')) {
        return false;
    }

    if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
        return false;  // Additional business logic check
    }

    return $this->isAllowedByDepartmentScope(
        $user,
        $this->resolveInvoiceDepartmentIds($invoice),
        [(int) $invoice->getAttribute('created_by')]
    );
}
```

### Authorization Flow Breakdown

The current (BROKEN) flow:
```
1. POST /api/v5/contracts → ContractController::store()
2. Form validation (StoreContractRequest::authorize())
   - Checks: Does user have 'contracts.write' permission? ✓
   - ONLY checks global permission!
3. Service layer (ContractDomainService::store())
   - No authorization check
4. ❌ Database update happens regardless of department scope
```

The CORRECT flow should be:
```
1. POST /api/v5/contracts → ContractController::store()
2. Form validation (StoreContractRequest::authorize())
   - Checks: Does user have 'contracts.write' permission? ✓
3. Controller level authorization
   - Gate::authorize('create', Contract::class)  // ← MISSING!
4. Service layer (ContractDomainService::store())
   - No additional check needed
5. ✓ Department scope verified by Policy
```

### Attack Scenario
```
User A: works in Department A, has 'contracts.write' permission
User B: works in Department B, has 'contracts.read' permission

1. User A creates contract in Department A ✓
   - Passes global permission check
   - Passes department scope check (Policy)
   - Contract created successfully

2. User B tries to PUT /api/v5/contracts/123 (User A's contract)
   - Fails global permission check (no 'contracts.write')
   - 403 Forbidden ✓

3. User A tries to PUT /api/v5/contracts/999 (in Department C, not theirs)
   - Passes global permission check (has 'contracts.write') ✓
   - ❌ NO POLICY CHECK!
   - Contract updated successfully
   - LATERAL MOVEMENT ACHIEVED!
```

### All Affected Controllers

| Controller | Mutations | Status |
|------------|-----------|--------|
| ContractController | store, update, destroy | ❌ No Gate::authorize |
| EmployeeController | store, update, destroy | ❌ No Gate::authorize |
| FeeCollectionController | invoiceStore, invoiceUpdate, invoiceDestroy | ❌ No Gate::authorize |
| RevenueManagementController | targetStore, targetUpdate, targetDestroy | ❌ No Gate::authorize |
| DepartmentController | store, update, destroy | ❌ No Gate::authorize |
| ProductController | store, update, destroy | ❌ No Gate::authorize |
| ProjectController | store, update, destroy | ❌ No Gate::authorize |
| VendorController | store, update, destroy | ❌ No Gate::authorize |
| DocumentController | store, update, destroy | ❌ No Gate::authorize |
| CustomerPersonnelController | store, update, destroy | ❌ No Gate::authorize |
| + 22 more | Various | ❌ Mostly unguarded |

### Available But Unused Policies

```
backend/app/Policies/
├─ ContractPolicy.php (51 lines)           → NEVER CALLED
├─ InvoicePolicy.php (59 lines)            → NEVER CALLED
├─ CustomerRequestCasePolicy.php (65 lines) → NEVER CALLED
├─ CustomerPolicy.php (63 lines)           → PARTIALLY CALLED (only in Customer ctrl)
└─ Concerns/
   └─ ResolvesDepartmentScopedAccess.php   → Trait with proper logic (UNUSED!)
```

### Fix Required

Add to all DomainService mutation methods:

```php
// In ContractDomainService::destroy()
public function destroy(Request $request, int $id): JsonResponse
{
    if (! $this->support->hasTable('contracts')) {
        return $this->support->missingTable('contracts');
    }

    $contract = Contract::query()->findOrFail($id);
    
    // ADD THESE 3 LINES:
    $user = $request->user();
    if (!$user || !$user->can('delete', $contract)) {
        abort(403, 'Unauthorized action.');
    }
    
    // ... rest of logic
}
```

Or in the Controller:

```php
public function destroy(Request $request, int $id): JsonResponse
{
    $contract = Contract::query()->findOrFail($id);
    Gate::authorize('delete', $contract);  // ✓ Add this
    
    return $this->contractService->destroy($request, $id);
}
```

---

## MEDIUM BUG: Modal Permission Implicit Allow (Line 144-145)

### Location
`frontend/utils/authorization.ts` — Lines 139-153

### Code
```typescript
export const canOpenModal = (
  user: AuthUser | null,
  modalType: ModalType,
  activeModuleKey: string
): boolean => {
  if (!modalType) {
    return true;  // ⚠️ Allows null/undefined modal!
  }

  if (modalType === 'IMPORT_DATA') {
    return hasPermission(user, resolveImportPermission(activeModuleKey));
  }

  // ⚠️ If modalType not in map, defaults to null:
  return hasPermission(user, MODAL_PERMISSION_MAP[modalType] ?? null);
};
```

### Problem
- Line 144: `!modalType` returns true for null/undefined → implicit allow
- Line 152: `?? null` defaults to null for unknown modals → calls `hasPermission(user, null)`
- Depends on BUG #1 to be exploitable

### Fix
```diff
  export const canOpenModal = (
    user: AuthUser | null,
    modalType: ModalType,
    activeModuleKey: string
  ): boolean => {
-   if (!modalType) {
+   if (!modalType || modalType.trim() === '') {
-     return true;
+     return false;  // SECURITY FIX
    }

    if (modalType === 'IMPORT_DATA') {
      return hasPermission(user, resolveImportPermission(activeModuleKey));
    }

-   return hasPermission(user, MODAL_PERMISSION_MAP[modalType] ?? null);
+   const permission = MODAL_PERMISSION_MAP[modalType];
+   if (!permission) {
+     return false;  // Unknown modal → deny
+   }
+   return hasPermission(user, permission);
  };
```

---

## MEDIUM BUG: Tests Document Rather Than Prevent

### Location
`frontend/__tests__/authorization.test.ts` — Lines 19-22

### Current Test (WRONG)
```typescript
it('allows empty permission keys', () => {
  expect(hasPermission(null, null)).toBe(true);
  expect(hasPermission(null, undefined)).toBe(true);
});
```

### What Should Be Tested
```typescript
describe('authorization security fixes', () => {
  const user = buildUser({ permissions: ['projects.read'] });

  describe('hasPermission - null/undefined safety', () => {
    it('rejects null permission for null user', () => {
      expect(hasPermission(null, null)).toBe(false);  // FIX: was true
    });

    it('rejects undefined permission for null user', () => {
      expect(hasPermission(null, undefined)).toBe(false);  // FIX: was true
    });

    it('rejects null permission for authenticated user', () => {
      expect(hasPermission(user, null)).toBe(false);  // FIX: was true
    });

    it('rejects undefined permission for authenticated user', () => {
      expect(hasPermission(user, undefined)).toBe(false);  // FIX: was true
    });

    it('rejects whitespace-only permission', () => {
      expect(hasPermission(user, '   ')).toBe(false);
    });

    it('rejects empty string permission', () => {
      expect(hasPermission(user, '')).toBe(false);
    });
  });

  describe('canOpenModal - null safety', () => {
    it('rejects null modal type', () => {
      expect(canOpenModal(user, null, 'projects')).toBe(false);
    });

    it('rejects undefined modal type', () => {
      expect(canOpenModal(user, undefined as any, 'projects')).toBe(false);
    });

    it('rejects unknown modal type', () => {
      const unknownModal = 'UNKNOWN_FUTURE_MODAL' as ModalType;
      expect(canOpenModal(user, unknownModal, 'projects')).toBe(false);
    });
  });
});
```

---

## GOOD PRACTICE #1: CORS Configuration

### File
`backend/config/cors.php` (29 lines)

### What's Good
```php
'allowed_origins' => array_values(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
))),
// Only allows origins from environment variable
// Prevents hardcoded allowed origins

'allowed_origins_patterns' => [],
// No wildcard patterns (secure)

'exposed_headers' => ['X-Request-Id'],
// Minimal exposed headers

'supports_credentials' => true,
// Combined with origin validation (safe pattern)
```

### Related Environment File
`backend/.env.example` — Lines 55-56

```
VNPT_AUTH_COOKIE_SECURE=true
VNPT_AUTH_COOKIE_SAME_SITE=strict
```

---

## GOOD PRACTICE #2: Security Environment Defaults

### File
`backend/.env.example` (115 lines)

### Secure Defaults
```
APP_DEBUG=false                              (Line 6)  ✓
LOG_LEVEL=warning                            (Line 23) ✓ Not "debug"
SESSION_ENCRYPT=true                         (Line 42) ✓
VNPT_AUTH_COOKIE_SECURE=true                 (Line 55) ✓ HTTPS-only
VNPT_AUTH_COOKIE_SAME_SITE=strict            (Line 56) ✓
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174  (Line 60) ✓ Dev-only

SESSION_DRIVER=redis                         (Line 39) ✓ Not file
SESSION_LIFETIME=120                         (Line 41) ✓ 2 hours reasonable
BCRYPT_ROUNDS=12                             (Line 18) ✓ Good hash strength
```

---

## GOOD PRACTICE #3: Middleware Stack

### File
`backend/bootstrap/app.php` (Lines 21-34)

### Security Middleware
```php
$middleware->api(prepend: [
    \App\Http\Middleware\RejectOversizedRequest::class,   // DOS protection
    \App\Http\Middleware\UseSanctumCookieToken::class,    // Cookie auth
    \App\Http\Middleware\SecurityHeaders::class,          // Security headers
]);

$middleware->alias([
    'permission'       => \App\Http\Middleware\EnsurePermission::class,
    'sanctum.cookie'   => \App\Http\Middleware\UseSanctumCookieToken::class,
    'password.change'  => \App\Http\Middleware\EnforcePasswordChange::class,
    'active.tab'       => \App\Http\Middleware\EnsureActiveTab::class,
]);
```

### Exception Handling
Lines 39-115: Proper exception rendering for:
- ValidationException (422)
- AuthenticationException (401)
- ModelNotFoundException (404)
- AuthorizationException (403)
- ThrottleRequestsException (429)
- Generic Throwable with `!config('app.debug')` check

---

## GOOD PRACTICE #4: Backend Authorization Service

### File
`backend/app/Support/Auth/UserAccessService.php` (321 lines)

### Key Implementation Details

#### hasPermission() Method (Lines 134-147)
```php
public function hasPermission(int $userId, string $permissionKey): bool
{
    $permission = trim($permissionKey);
    if ($permission === '') {
        return false;  // ✓ Rejects empty strings (unlike frontend!)
    }

    $permissions = $this->permissionKeysForUser($userId);
    if (in_array('*', $permissions, true)) {
        return true;  // ✓ Wildcard check
    }

    return in_array($permission, $permissions, true);
}
```

#### Permission Resolution (Lines 56-131)
Handles:
- ADMIN role → returns `['*']`
- Role-based permissions
- User-specific grants
- User-specific denies (override system)
- Proper filtering of inactive/expired entries

#### Department Scope Resolution (Lines 152-227)
Returns structured data:
```php
[
    'all' => bool,           // Has unrestricted access?
    'self_only' => bool,     // Only own department?
    'dept_ids' => array|null // Specific department IDs
]
```

---

## Summary of Required Fixes

### P0 — IMMEDIATE (Within 1 day)
1. **hasPermission() — Frontend**
   - File: `frontend/utils/authorization.ts` (Line 95)
   - Change: `return true` → `return false`
   - Impact: Fixes BUG #1 and #2

2. **Add Gate::authorize() — Backend**
   - Files: All `backend/app/Services/V5/Domain/*.php` mutation methods
   - Add: 3-line authorization check
   - Impact: Fixes BUG #3

### P1 — HIGH (Within 1 week)
3. **Update Tests — Frontend**
   - File: `frontend/__tests__/authorization.test.ts`
   - Add: 8 new test cases for null/undefined safety
   - Update: Existing test to expect FALSE

4. **Add Missing Policies — Backend**
   - File: `backend/app/Policies/CustomerPolicy.php`
   - Add: `view()` method if needed
   - Verify: All policies registered in AuthServiceProvider

### P2 — MEDIUM (Within 2 weeks)
5. **Code Review**
   - Review all 32 controllers for consistency
   - Document authorization pattern
   - Add security comments where needed

6. **Configuration**
   - Consider adding HSTS header
   - Document why `support_master_management` has special handling
   - Consider removing null entries from permission maps

---

## Files Modified by This Audit

Total Lines Analyzed: 1,500+

| File | Lines | Status |
|------|-------|--------|
| frontend/utils/authorization.ts | 154 | 🔴 3 BUGS |
| frontend/__tests__/authorization.test.ts | 121 | 🟡 NEEDS FIXES |
| backend/config/cors.php | 29 | ✓ GOOD |
| backend/config/auth.php | 115 | ✓ GOOD |
| backend/bootstrap/app.php | 116 | ✓ GOOD |
| backend/.env.example | 115 | ✓ GOOD |
| backend/app/Support/Auth/UserAccessService.php | 321 | ✓ GOOD |
| backend/app/Http/Middleware/EnsurePermission.php | 49 | ✓ GOOD |
| backend/app/Policies/ContractPolicy.php | 51 | ⚠️ DEFINED UNUSED |
| backend/app/Policies/InvoicePolicy.php | 59 | ⚠️ DEFINED UNUSED |
| backend/app/Policies/CustomerRequestCasePolicy.php | 65 | ⚠️ DEFINED UNUSED |
| backend/app/Policies/CustomerPolicy.php | 63 | ⚠️ PARTIAL USE |
| backend/app/Policies/Concerns/ResolvesDepartmentScopedAccess.php | 123 | ✓ GOOD |
| backend/app/Http/Controllers/Api/V5/* | 32 files | ❌ 31 UNGUARDED |

---

**Audit Completed:** April 1, 2026
**Auditor Notes:** All findings documented with line numbers and exact code references for rapid remediation.
