# QLCV Security Hardening Audit — Complete Documentation

## 📋 Document Index

This folder contains a comprehensive security audit of the QLCV codebase with focus on authorization hardening.

### Main Documents

1. **SECURITY_HARDENING_AUDIT.md** — Full audit report
   - Executive summary
   - Detailed findings with line numbers
   - Configuration review
   - Policy enforcement analysis
   - Test coverage assessment
   - Recommended fixes by priority

2. **DETAILED_FINDINGS.md** — Deep technical analysis
   - Critical bug explanations with exact code
   - Attack scenarios
   - Call chain analysis
   - Comparison with correct implementations
   - Fix code snippets
   - Good practices documentation

3. **This file (README_AUDIT.md)** — Navigation guide

---

## 🔴 Critical Issues Summary

| # | Issue | File | Lines | Impact |
|---|-------|------|-------|--------|
| 1 | Frontend implicit allow on null | `frontend/utils/authorization.ts` | 93-96 | Any null permission returns TRUE (should be FALSE) |
| 2 | Tab map with null entries | `frontend/utils/authorization.ts` | 123-132 | Unknown tabs can implicitly allow access |
| 3 | API mutations lack Policy | `backend/app/Services/V5/Domain/*.php` | All | Users can mutate resources outside their department scope |
| 4 | Department scoping unenforced | `backend/app/Services/V5/Domain/*.php` | All mutations | Lateral movement between departments possible |

---

## ✓ Good Practices Found

| Area | File | Status |
|------|------|--------|
| CORS Configuration | `backend/config/cors.php` | ✓ Secure and environment-driven |
| Environment Defaults | `backend/.env.example` | ✓ Secure: APP_DEBUG=false, SameSite=strict, SECURE cookies |
| Middleware Stack | `backend/bootstrap/app.php` | ✓ DOS protection, security headers, auth validation |
| Authorization Service | `backend/app/Support/Auth/UserAccessService.php` | ✓ Proper implementation, correctly rejects empty strings |

---

## 📂 Files Analyzed

### Frontend (3 files)
```
frontend/utils/authorization.ts
  → hasPermission()      (Line 93-112)    ❌ IMPLICIT ALLOW BUG
  → canAccessTab()       (Line 114-133)   ⚠️ Depends on above bug
  → canOpenModal()       (Line 139-153)   🟡 NULL DEFAULT BUG
  → TAB_PERMISSION_MAP   (Line 3-29)      ⚠️ NULL ENTRIES

frontend/__tests__/authorization.test.ts
  → Test suite           (121 lines)      🟡 DOCUMENTS BUG INSTEAD OF PREVENTING

frontend/types/auth.ts
  → Type definitions
```

### Backend Configuration (3 files)
```
backend/config/cors.php                   ✓ GOOD
backend/config/auth.php                   ✓ GOOD
backend/bootstrap/app.php                 ✓ GOOD (Middleware at lines 21-34)
backend/.env.example                      ✓ GOOD (Security settings)
```

### Backend Authentication (5 files)
```
backend/app/Support/Auth/UserAccessService.php
  → hasPermission()      (Line 134-147)   ✓ CORRECT (rejects empty strings)
  → isAdmin()            (Line 48-51)     ✓ GOOD
  → permissionKeysForUser() (Line 56-131) ✓ GOOD
  → departmentScopesForUser() (Line 152-171) ✓ GOOD

backend/app/Http/Middleware/EnsurePermission.php
  → handle()             (Line 17-48)     ✓ GOOD

backend/app/Http/Middleware/SecurityHeaders.php (mentioned but not analyzed)
```

### Backend Policies (5 files)
```
backend/app/Policies/ContractPolicy.php   ⚠️ DEFINED BUT NEVER CALLED
backend/app/Policies/InvoicePolicy.php    ⚠️ DEFINED BUT NEVER CALLED
backend/app/Policies/CustomerRequestCasePolicy.php ⚠️ DEFINED BUT NEVER CALLED
backend/app/Policies/CustomerPolicy.php   ⚠️ PARTIAL USE (only CustomerController)

backend/app/Policies/Concerns/ResolvesDepartmentScopedAccess.php
  → Department scope logic (Line 28-55)   ✓ CORRECT LOGIC, UNUSED
```

### Backend Controllers (32 files total)
```
backend/app/Http/Controllers/Api/V5/

GOOD (has Policy enforcement):
  ✓ CustomerController.php (lines 43, 55: Gate::authorize)

NEEDS FIX (no Policy enforcement):
  ❌ ContractController.php
  ❌ EmployeeController.php
  ❌ FeeCollectionController.php
  ❌ RevenueManagementController.php
  ❌ DepartmentController.php
  ❌ ProductController.php
  ❌ ProjectController.php
  ❌ VendorController.php
  ❌ DocumentController.php
  ❌ CustomerPersonnelController.php
  ... and 22 more (31 out of 32 total)
```

---

## 🔧 Priority Fixes

### P0 — IMMEDIATE (Fix Today)

#### Frontend: Fix hasPermission() bug
**File:** `frontend/utils/authorization.ts` (Line 95)
```typescript
// BEFORE:
if (!permission) {
  return true;  // ❌ BUG

// AFTER:
if (!permission || String(permission).trim() === '') {
  return false;  // ✓ FIX
```

**Impact:** Fixes BUG #1, prevents frontend authorization bypass

#### Backend: Add Gate::authorize() to mutations
**Files:** All `backend/app/Services/V5/Domain/*.php` (or Controllers)

```php
// Add before mutation logic:
$user = $request->user();
if (!$user || !$user->can('delete', $contract)) {
    abort(403, 'Unauthorized action.');
}
```

**Impact:** Fixes BUG #3 and #4, prevents department-scoped bypass

### P1 — HIGH (Fix This Week)

#### Frontend: Update tests
**File:** `frontend/__tests__/authorization.test.ts`
- Change lines 19-22 to expect FALSE instead of TRUE
- Add 8 new test cases for null/undefined safety
- Add modal safety tests

#### Backend: Verify policies
**File:** `backend/app/Providers/AuthServiceProvider.php`
- Register all policies
- Add missing view() methods
- Document authorization pattern

### P2 — MEDIUM (Fix in 2 Weeks)

#### Configuration
- Add HSTS header configuration
- Document why `support_master_management` needs special handling
- Consider removing null entries from permission maps

#### Code Review
- Review all 32 controllers for consistency
- Create authorization guidelines document
- Add security comments to tricky code

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Total lines analyzed | 1,500+ |
| Files analyzed | 50+ |
| Critical bugs found | 4 |
| Medium issues found | 3 |
| Good practices found | 4 |
| Policies defined but unused | 3 |
| Controllers without Policy enforcement | 31/32 |

---

## 🔗 Reading Guide

### For Security Team
1. Start with: `SECURITY_HARDENING_AUDIT.md` (Executive Summary section)
2. Review: All Critical issues table
3. Action: Implement P0 fixes immediately

### For Backend Developers
1. Start with: `DETAILED_FINDINGS.md` (CRITICAL BUG #3 section)
2. Review: All affected controllers list
3. Action: Add Gate::authorize() to all DomainServices
4. Reference: CustomerController.php as example

### For Frontend Developers
1. Start with: `DETAILED_FINDINGS.md` (CRITICAL BUG #1 section)
2. Review: Test case examples
3. Action: Fix hasPermission() line 95
4. Update: Tests to prevent regression

### For DevOps/Infrastructure
1. Review: `SECURITY_HARDENING_AUDIT.md` (CORS & security headers section)
2. Verify: `backend/.env.example` matches production
3. Ensure: APP_DEBUG=false, LOG_LEVEL=warning, SameSite=strict

---

## 🎯 How to Use These Reports

### Finding Specific Issues
Use the file index at the top of each document to navigate to exact line numbers.

Example search:
```
Looking for: "hasPermission null bug"
In file: DETAILED_FINDINGS.md
Find: Section "CRITICAL BUG #1: Frontend Implicit Allow (Line 93-96)"
Action: See exact code and fix snippet
```

### Cross-Reference Issues
Each bug references:
- Exact file path
- Line numbers
- Exact code
- Who calls it
- Impact assessment
- Correct implementation example
- Fix code snippet

### Tracking Fixes
Use the Priority table (P0, P1, P2) to track implementation:
- [ ] P0.1 - Fix hasPermission() frontend
- [ ] P0.2 - Add Gate::authorize() backend
- [ ] P1.1 - Update tests
- [ ] P1.2 - Verify policies
- [ ] P2.1 - Configuration
- [ ] P2.2 - Code review

---

## ❓ FAQ

**Q: Are these confirmed bugs or theoretical vulnerabilities?**
A: Confirmed bugs. The test file documents the behavior (lines 19-22 of authorization.test.ts), and the backend implementation shows the correct approach, which differs from frontend.

**Q: What's the impact if not fixed?**
A: Critical. Users can:
1. Access tabs they shouldn't (frontend)
2. Modify data in other departments (backend)
3. Lateral movement between departments

**Q: Can these be exploited by external attackers?**
A: The frontend bugs require direct access to frontend code or browser manipulation. Backend bugs can be exploited remotely by authenticated users with minimal permissions.

**Q: Is there defense-in-depth?**
A: Partial. Backend policies exist (unused), but frontend has no fallback since it's the primary authorization layer for UI.

**Q: When should these be fixed?**
A: P0 fixes should be deployed today. P1 within 1 week. P2 within 2 weeks.

---

## 📞 Contact

For questions about this audit, refer to:
- Specific findings → DETAILED_FINDINGS.md with line numbers
- High-level overview → SECURITY_HARDENING_AUDIT.md
- Technical implementation → Code snippets in fix sections

---

**Audit Date:** April 1, 2026
**Total Time to Complete:** Full remediation ~3 days (P0+P1)
**Status:** Ready for implementation

---

## 📑 Document Map

```
/QLCV/
├─ README_AUDIT.md ←── You are here
├─ SECURITY_HARDENING_AUDIT.md (Main report, 300+ lines)
├─ DETAILED_FINDINGS.md (Technical deep dive, 500+ lines)
└─ QLCV codebase
   ├─ frontend/
   │  ├─ utils/authorization.ts ❌ BUGS
   │  └─ __tests__/authorization.test.ts 🟡 NEEDS FIX
   ├─ backend/
   │  ├─ config/cors.php ✓ GOOD
   │  ├─ bootstrap/app.php ✓ GOOD
   │  ├─ .env.example ✓ GOOD
   │  ├─ app/
   │  │  ├─ Support/Auth/UserAccessService.php ✓ GOOD
   │  │  ├─ Http/Middleware/EnsurePermission.php ✓ GOOD
   │  │  ├─ Http/Controllers/Api/V5/ ❌ 31/32 UNGUARDED
   │  │  └─ Policies/ ⚠️ DEFINED UNUSED
   └─ ... other files
```

---

**End of Navigation Guide**
