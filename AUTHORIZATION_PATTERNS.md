# Backend Authorization Pattern Exploration

**Date**: 2026-04-01  
**Focus**: Understanding authorization patterns in QLCV backend to replicate for new feature implementation

---

## 1. AUTHORIZATION PATTERN OVERVIEW

### Current Implementation Status
- **Using**: Laravel Gates + Policies (not middleware-based)
- **Policy Registration**: Auto-discovered (NOT explicitly registered in config)
- **Base Service**: `UserAccessService` handles all auth/permissions logic
- **Controllers**: Gradually adopting `Gate::authorize()` for authorization checks

### Controllers Using Authorization (Found)
```
- CustomerController.php:43-55
  Lines 43: Gate::authorize('update', Customer::query()->findOrFail($id));
  Lines 55: Gate::authorize('delete', Customer::query()->findOrFail($id));
```

**Note**: Most other V5 controllers DO NOT have authorization checks yet. This is the main gap.

---

## 2. V5BaseController - Foundation

**File**: `backend/app/Http/Controllers/Api/V5/V5BaseController.php`

```php
<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Controllers\Controller;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;

abstract class V5BaseController extends Controller
{
    public function __construct(
        protected readonly V5DomainSupportService $support,
        protected readonly V5AccessAuditService $accessAudit
    ) {}
}
```

**Pattern**:
- Minimal base controller
- No authorization methods provided (auth is delegated to policies)
- Provides access to domain services and audit logging

---

## 3. AUTHORIZATION TRAIT - Core Pattern

**File**: `backend/app/Policies/Concerns/ResolvesDepartmentScopedAccess.php`

### Key Methods:

```php
/**
 * Checks if user has a specific permission key
 * @param InternalUser $user
 * @param string $permissionKey (e.g., 'contracts.read', 'contracts.write')
 * @return bool
 */
protected function hasPermission(InternalUser $user, string $permissionKey): bool
{
    return $this->accessService()->hasPermission((int) $user->getKey(), $permissionKey);
}

/**
 * Checks if user is allowed by department scope + ownership
 * AUTHORIZATION LOGIC:
 * 1. Admins always allowed
 * 2. Check dept_id overlap with user's allowed departments
 * 3. Check if user is in ownerUserIds array (created_by, received_by, dispatcher, performer)
 * 
 * @param InternalUser $user
 * @param array<int> $deptIds - Department IDs from resource
 * @param array<int> $ownerUserIds - User IDs who can access (created_by, etc.)
 * @return bool
 */
protected function isAllowedByDepartmentScope(
    InternalUser $user, 
    array $deptIds = [], 
    array $ownerUserIds = []
): bool
{
    $userId = (int) $user->getKey();
    
    // Admin bypass
    if ($this->accessService()->isAdmin($userId)) {
        return true;
    }

    // Get user's allowed dept IDs (null = unlimited)
    $allowedDeptIds = $this->accessService()->resolveDepartmentIdsForUser($userId);
    if ($allowedDeptIds === null) {
        return true;  // User has ALL scope
    }

    // Check dept intersection
    $normalizedDeptIds = array_values(array_unique(array_map(
        fn ($value): int => (int) $value,
        array_filter($deptIds, fn ($value): bool => $value !== null && (int) $value > 0)
    )));

    if ($normalizedDeptIds !== [] && array_intersect($allowedDeptIds, $normalizedDeptIds) !== []) {
        return true;  // User's dept matches resource's dept
    }

    // Check ownership
    $normalizedOwnerIds = array_values(array_unique(array_map(
        fn ($value): int => (int) $value,
        array_filter($ownerUserIds, fn ($value): bool => $value !== null && (int) $value > 0)
    )));

    return in_array($userId, $normalizedOwnerIds, true);  // User is owner
}

// Department resolution helpers:
protected function resolveProjectDepartmentIds(?Project $project): array
protected function resolveContractDepartmentIds(Contract $contract): array
protected function resolveInvoiceDepartmentIds(Invoice $invoice): array
protected function resolveCustomerRequestCaseDepartmentIds(CustomerRequestCase $case): array
```

---

## 4. EXISTING POLICY IMPLEMENTATIONS

### Policy 1: CustomerRequestCasePolicy.php

```php
<?php
namespace App\Policies;

use App\Models\CustomerRequestCase;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class CustomerRequestCasePolicy
{
    use ResolvesDepartmentScopedAccess;

    /**
     * READ permission
     * Permission: support_requests.read
     * Scope: Department-scoped + Ownership check
     */
    public function view(InternalUser $user, CustomerRequestCase $case): bool
    {
        if (! $this->hasPermission($user, 'support_requests.read')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveCustomerRequestCaseDepartmentIds($case),
            [
                (int) $case->getAttribute('created_by'),
                (int) $case->getAttribute('received_by_user_id'),
                (int) $case->getAttribute('dispatcher_user_id'),
                (int) $case->getAttribute('performer_user_id'),
            ]
        );
    }

    /**
     * UPDATE permission
     * Permission: support_requests.write
     */
    public function update(InternalUser $user, CustomerRequestCase $case): bool
    {
        if (! $this->hasPermission($user, 'support_requests.write')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveCustomerRequestCaseDepartmentIds($case),
            [
                (int) $case->getAttribute('created_by'),
                (int) $case->getAttribute('received_by_user_id'),
                (int) $case->getAttribute('dispatcher_user_id'),
                (int) $case->getAttribute('performer_user_id'),
            ]
        );
    }

    /**
     * DELETE permission
     * Permission: support_requests.delete
     * Note: Does NOT include performer_user_id in ownership check
     */
    public function delete(InternalUser $user, CustomerRequestCase $case): bool
    {
        if (! $this->hasPermission($user, 'support_requests.delete')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveCustomerRequestCaseDepartmentIds($case),
            [
                (int) $case->getAttribute('created_by'),
                (int) $case->getAttribute('received_by_user_id'),
                (int) $case->getAttribute('dispatcher_user_id'),
            ]
        );
    }
}
```

### Policy 2: ContractPolicy.php

```php
<?php
namespace App\Policies;

use App\Models\Contract;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class ContractPolicy
{
    use ResolvesDepartmentScopedAccess;

    /**
     * READ permission: contracts.read
     * Scope: Via Project → Department
     * Ownership: created_by user only
     */
    public function view(InternalUser $user, Contract $contract): bool
    {
        if (! $this->hasPermission($user, 'contracts.read')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveContractDepartmentIds($contract),
            [(int) $contract->getAttribute('created_by')]
        );
    }

    /**
     * UPDATE permission: contracts.write
     */
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

    /**
     * DELETE permission: contracts.delete
     */
    public function delete(InternalUser $user, Contract $contract): bool
    {
        if (! $this->hasPermission($user, 'contracts.delete')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveContractDepartmentIds($contract),
            [(int) $contract->getAttribute('created_by')]
        );
    }
}
```

### Policy 3: InvoicePolicy.php (with Status Checks)

```php
<?php
namespace App\Policies;

use App\Models\InternalUser;
use App\Models\Invoice;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class InvoicePolicy
{
    use ResolvesDepartmentScopedAccess;

    public function view(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.read')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }

    /**
     * UPDATE with status validation
     * Cannot update PAID, CANCELLED, VOID invoices
     */
    public function update(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.write')) {
            return false;
        }

        // Additional business rule: prevent editing finalized invoices
        if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }

    /**
     * DELETE with same status validation
     */
    public function delete(InternalUser $user, Invoice $invoice): bool
    {
        if (! $this->hasPermission($user, 'fee_collection.delete')) {
            return false;
        }

        if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveInvoiceDepartmentIds($invoice),
            [(int) $invoice->getAttribute('created_by')]
        );
    }
}
```

### Policy 4: CustomerPolicy.php (No Permission Check)

```php
<?php
namespace App\Policies;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;
use Illuminate\Support\Facades\Schema;

class CustomerPolicy
{
    use ResolvesDepartmentScopedAccess;

    /**
     * NOTE: No hasPermission() check - relies only on department scope + ownership
     */
    public function update(InternalUser $user, Customer $customer): bool
    {
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveCustomerDepartmentIds($customer),
            [(int) $customer->getAttribute('created_by')]
        );
    }

    public function delete(InternalUser $user, Customer $customer): bool
    {
        return $this->update($user, $customer);
    }

    /**
     * Department resolution: Via contracts + projects
     * Looks up customer's related contracts/projects for dept_id
     */
    private function resolveCustomerDepartmentIds(Customer $customer): array
    {
        $departmentIds = [];

        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'customer_id') && Schema::hasColumn('contracts', 'dept_id')) {
            $departmentIds = array_merge(
                $departmentIds,
                $customer->contracts()
                    ->whereNotNull('dept_id')
                    ->pluck('dept_id')
                    ->map(static fn (mixed $value): int => (int) $value)
                    ->filter(static fn (int $value): bool => $value > 0)
                    ->all()
            );
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'customer_id') && Schema::hasColumn('projects', 'dept_id')) {
            $departmentIds = array_merge(
                $departmentIds,
                $customer->projects()
                    ->whereNotNull('dept_id')
                    ->pluck('dept_id')
                    ->map(static fn (mixed $value): int => (int) $value)
                    ->filter(static fn (int $value): bool => $value > 0)
                    ->all()
            );
        }

        $departmentIds = array_values(array_unique($departmentIds));

        return $departmentIds;
    }
}
```

---

## 5. CONTROLLER AUTHORIZATION USAGE

### Authorized Controller: CustomerController.php

```php
<?php
namespace App\Http\Controllers\Api\V5;

use App\Http\Requests\V5\StoreCustomerRequest;
use App\Http\Requests\V5\UpdateCustomerRequest;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class CustomerController extends V5BaseController
{
    public function index(Request $request): JsonResponse
    {
        return $this->customerService->index($request);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        return $this->customerService->store($request);
    }

    /**
     * Line 41-50: UPDATE with authorization
     * Pattern: Gate::authorize('update', $model)
     */
    public function update(UpdateCustomerRequest $request, int $id): JsonResponse
    {
        Gate::authorize('update', Customer::query()->findOrFail($id));

        $response = $this->customerService->update($request, $id);
        if ($response->getStatusCode() < 400) {
            $this->insightService->invalidateCustomerCaches($id);
        }

        return $response;
    }

    /**
     * Line 53-62: DELETE with authorization
     * Pattern: Gate::authorize('delete', $model)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        Gate::authorize('delete', Customer::query()->findOrFail($id));

        $response = $this->customerService->destroy($request, $id);
        if ($response->getStatusCode() < 400) {
            $this->insightService->invalidateCustomerCaches($id);
        }

        return $response;
    }
}
```

### NOT Authorized: CustomerRequestCaseController.php

```php
public class CustomerRequestCaseController extends V5BaseController
{
    // Line 47-49: NO authorization check
    public function store(StoreCustomerRequestCaseRequest $request): JsonResponse
    {
        return $this->service->store($request);  // ← Missing Gate::authorize()
    }

    // Line 52-55: NO authorization check
    public function show(Request $request, int $id): JsonResponse
    {
        return $this->service->show($request, $id);  // ← Missing Gate::authorize()
    }

    // Line 157-163: NO authorization check
    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->service->destroy($request, $id);  // ← Missing Gate::authorize()
    }
}
```

---

## 6. USER ACCESS SERVICE - Permission Backend

**File**: `backend/app/Support/Auth/UserAccessService.php`

### Key Methods:

#### Permission Methods
```php
/**
 * Get all permission keys for a user
 * Admin returns ['*']
 * Otherwise: role permissions + user-specific (GRANT/DENY overrides)
 */
public function permissionKeysForUser(int $userId): array

/**
 * Check if user has single permission
 * @param int $userId
 * @param string $permissionKey (e.g., 'contracts.read')
 * @return bool
 */
public function hasPermission(int $userId, string $permissionKey): bool
```

#### Department Scope Methods
```php
/**
 * Get user's department scopes with scope type
 * @return array<{dept_id: int, scope_type: string}>
 * 
 * scope_type values:
 * - 'ALL': User can see all departments
 * - 'SELF_ONLY': User can see only their own department
 * - 'DEPT_AND_CHILDREN': User can see dept + all child departments
 * - 'DEPT_ONLY': User can see specific department only
 */
public function departmentScopesForUser(int $userId): array

/**
 * Resolve employee visibility based on scopes
 * @return {all: bool, self_only: bool, dept_ids: array|null}
 */
public function resolveEmployeeVisibility(int $userId): array

/**
 * Get user's allowed dept IDs or null if unlimited
 * @return array<int>|null
 */
public function resolveDepartmentIdsForUser(int $userId): ?array
```

#### Role Methods
```php
/**
 * Get role codes for user
 * @return array<string> (e.g., ['ADMIN', 'MANAGER'])
 */
public function roleCodesForUser(int $userId): array

/**
 * Check if user is admin
 */
public function isAdmin(int $userId): bool
```

---

## 7. CONTROLLERS MISSING AUTHORIZATION (SAMPLE)

### File Patterns with store/update/destroy:

```
backend/app/Http/Controllers/Api/V5/MonthlyCalendarController.php:26     public function update
backend/app/Http/Controllers/Api/V5/DepartmentWeeklyScheduleController.php:31  public function store
backend/app/Http/Controllers/Api/V5/DepartmentWeeklyScheduleController.php:36  public function update
backend/app/Http/Controllers/Api/V5/DepartmentWeeklyScheduleController.php:41  public function destroy
backend/app/Http/Controllers/Api/V5/CustomerPersonnelController.php:26   public function store
backend/app/Http/Controllers/Api/V5/CustomerPersonnelController.php:31   public function update
backend/app/Http/Controllers/Api/V5/CustomerPersonnelController.php:36   public function destroy
backend/app/Http/Controllers/Api/V5/BusinessController.php:26            public function store
backend/app/Http/Controllers/Api/V5/BusinessController.php:31            public function update
backend/app/Http/Controllers/Api/V5/BusinessController.php:36            public function destroy
backend/app/Http/Controllers/Api/V5/CustomerRequestCaseController.php:47     public function store
backend/app/Http/Controllers/Api/V5/CustomerRequestCaseController.php:157    public function destroy
backend/app/Http/Controllers/Api/V5/DocumentController.php:29            public function store
backend/app/Http/Controllers/Api/V5/DocumentController.php:34            public function update
backend/app/Http/Controllers/Api/V5/DocumentController.php:39            public function destroy
backend/app/Http/Controllers/Api/V5/EmployeeController.php:28            public function store
backend/app/Http/Controllers/Api/V5/EmployeeController.php:38            public function update
backend/app/Http/Controllers/Api/V5/EmployeeController.php:43            public function destroy
[... and 40+ more]
```

---

## 8. PERMISSION KEY NAMING CONVENTION

Based on policies, permission keys follow:
```
{domain}.{action}

Examples:
- support_requests.read      (CustomerRequestCasePolicy)
- support_requests.write
- support_requests.delete
- contracts.read             (ContractPolicy)
- contracts.write
- contracts.delete
- fee_collection.read        (InvoicePolicy)
- fee_collection.write
- fee_collection.delete
```

---

## 9. AUTHORIZATION DECISION TREE

```
Gate::authorize('action', $model)
  ↓
Policy::action(InternalUser $user, Model $model): bool
  ↓
[1] hasPermission($user, 'domain.action')
    ↓ (if false)
    AuthorizationException
    
[2] isAllowedByDepartmentScope($user, $deptIds, $ownerUserIds)
    ├─ Is Admin? → TRUE
    ├─ Has unlimited scope? → TRUE
    ├─ Dept overlap with $deptIds? → TRUE
    └─ In $ownerUserIds? → TRUE
        ↓ (all checks)
        FINAL RESULT
```

---

## 10. REPLICATION CHECKLIST

To add authorization to a new controller/resource:

1. ✅ Create `SomethingPolicy.php` in `backend/app/Policies/`
2. ✅ Use `ResolvesDepartmentScopedAccess` trait
3. ✅ Implement `view()`, `update()`, `delete()` methods
4. ✅ Check permission key: `hasPermission($user, 'domain.action')`
5. ✅ Check scope: `isAllowedByDepartmentScope($user, $deptIds, $ownerIds)`
6. ✅ Add resource-specific dept/owner resolution method if needed
7. ✅ In Controller, add: `Gate::authorize('action', Model::findOrFail($id));`
8. ✅ Define permission key in database (users_permissions table)

---

## 11. KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `app/Support/Auth/UserAccessService.php` | Permission/scope backend logic |
| `app/Policies/Concerns/ResolvesDepartmentScopedAccess.php` | Authorization trait (hasPermission, isAllowedByDepartmentScope) |
| `app/Policies/CustomerRequestCasePolicy.php` | Example: Complete policy with ownership tracking |
| `app/Policies/ContractPolicy.php` | Example: Policy with indirect dept resolution |
| `app/Policies/InvoicePolicy.php` | Example: Policy with business rule checks (status validation) |
| `app/Policies/CustomerPolicy.php` | Example: Policy without explicit permission check |
| `app/Http/Controllers/Api/V5/CustomerController.php` | Example: Authorized controller (lines 41-62) |
| `app/Providers/AppServiceProvider.php` | Service bootstrap (NO explicit policy registration) |

