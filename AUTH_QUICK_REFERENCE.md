# Authorization Pattern - Quick Reference Guide

## 1-Minute Pattern Summary

### Step 1: Create a Policy
```php
<?php
namespace App\Policies;

use App\Models\YourModel;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class YourModelPolicy
{
    use ResolvesDepartmentScopedAccess;  // ← Gives you hasPermission() + isAllowedByDepartmentScope()

    public function view(InternalUser $user, YourModel $model): bool
    {
        if (! $this->hasPermission($user, 'domain.read')) {
            return false;
        }
        
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveDepartmentIds($model),
            [(int) $model->created_by]
        );
    }

    public function update(InternalUser $user, YourModel $model): bool
    {
        if (! $this->hasPermission($user, 'domain.write')) {
            return false;
        }
        
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveDepartmentIds($model),
            [(int) $model->created_by]
        );
    }

    public function delete(InternalUser $user, YourModel $model): bool
    {
        if (! $this->hasPermission($user, 'domain.delete')) {
            return false;
        }
        
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveDepartmentIds($model),
            [(int) $model->created_by]
        );
    }

    // Helper: Resolve which department(s) this resource belongs to
    private function resolveDepartmentIds(YourModel $model): array
    {
        // Return array of dept_id from $model or related models
        return [(int) $model->department_id];
    }
}
```

### Step 2: Use in Controller
```php
class YourModelController extends V5BaseController
{
    public function update(Request $request, int $id): JsonResponse
    {
        Gate::authorize('update', YourModel::findOrFail($id));  // ← One line!
        
        return $this->service->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        Gate::authorize('delete', YourModel::findOrFail($id));  // ← One line!
        
        return $this->service->destroy($request, $id);
    }
}
```

---

## Permission Key Naming

```
{domain}.{action}

READ:   domain.read      (view/list operations)
WRITE:  domain.write     (create/update operations)
DELETE: domain.delete    (delete operations)

Examples:
✓ contracts.read
✓ contracts.write
✓ contracts.delete
✓ support_requests.read
✓ fee_collection.write
```

---

## Authorization Check Logic (Decision Tree)

```
Gate::authorize('update', $model)
    ↓
YourModelPolicy::update(InternalUser $user, YourModel $model)
    ↓
┌─────────────────────────────────────────────────────┐
│ [1] hasPermission($user, 'domain.write')            │
│     → If false, return false (permission denied)    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ [2] isAllowedByDepartmentScope(...)                 │
│     → Check: Is admin?                              │
│     → Check: Dept overlap?                          │
│     → Check: Is owner?                              │
│     → Return true if ANY check passes               │
└─────────────────────────────────────────────────────┘
```

---

## isAllowedByDepartmentScope() Logic

```php
isAllowedByDepartmentScope(InternalUser $user, array $deptIds, array $ownerUserIds): bool
```

**Returns TRUE if:**
1. User is ADMIN → Automatic TRUE
2. User has "ALL" scope → Automatic TRUE
3. User's allowed depts INTERSECT with $deptIds → TRUE
4. User ID is in $ownerUserIds → TRUE

**Otherwise:** FALSE

---

## Department Resolution Strategies

### Strategy 1: Direct Department (Simplest)
```php
private function resolveDepartmentIds(Contract $contract): array
{
    return [(int) $contract->dept_id];
}
```

### Strategy 2: Via Related Model
```php
private function resolveDepartmentIds(Contract $contract): array
{
    $project = $contract->project;
    if ($project) {
        return [(int) $project->dept_id];
    }
    return [];
}
```

### Strategy 3: Via Multiple Relations (Complex)
```php
private function resolveDepartmentIds(Invoice $invoice): array
{
    $deptIds = [];
    
    if ($invoice->project) {
        $deptIds[] = (int) $invoice->project->dept_id;
    }
    
    if (!$deptIds && $invoice->contract) {
        $deptIds[] = (int) $invoice->contract->project->dept_id;
    }
    
    return array_filter($deptIds, fn($id) => $id > 0);
}
```

### Strategy 4: Via Eloquent Query (Use Schema Guards)
```php
private function resolveCustomerDepartmentIds(Customer $customer): array
{
    $departmentIds = [];

    if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'customer_id')) {
        $departmentIds = array_merge(
            $departmentIds,
            $customer->contracts()
                ->pluck('dept_id')
                ->filter(fn($id) => (int) $id > 0)
                ->map(fn($id) => (int) $id)
                ->all()
        );
    }

    return array_values(array_unique($departmentIds));
}
```

---

## Ownership Patterns

### Single Owner
```php
$this->isAllowedByDepartmentScope(
    $user,
    $deptIds,
    [(int) $model->created_by]  // Only creator can access
)
```

### Multiple Owners (Support Case)
```php
$this->isAllowedByDepartmentScope(
    $user,
    $deptIds,
    [
        (int) $model->created_by,
        (int) $model->received_by_user_id,
        (int) $model->dispatcher_user_id,
        (int) $model->performer_user_id,  // Multiple people involved
    ]
)
```

### Different Logic for Different Actions
```php
public function update(InternalUser $user, CustomerRequestCase $case): bool
{
    if (! $this->hasPermission($user, 'support_requests.write')) {
        return false;
    }

    // Everyone involved can edit
    return $this->isAllowedByDepartmentScope(
        $user,
        $deptIds,
        [
            (int) $case->created_by,
            (int) $case->received_by_user_id,
            (int) $case->dispatcher_user_id,
            (int) $case->performer_user_id,
        ]
    );
}

public function delete(InternalUser $user, CustomerRequestCase $case): bool
{
    if (! $this->hasPermission($user, 'support_requests.delete')) {
        return false;
    }

    // Only creator/dispatcher can delete (not performer)
    return $this->isAllowedByDepartmentScope(
        $user,
        $deptIds,
        [
            (int) $case->created_by,
            (int) $case->dispatcher_user_id,
        ]
    );
}
```

---

## With Business Rules (Status Checks)

```php
public function update(InternalUser $user, Invoice $invoice): bool
{
    if (! $this->hasPermission($user, 'fee_collection.write')) {
        return false;
    }

    // Additional business rule: Can't edit finalized invoices
    if (in_array((string) $invoice->status, ['PAID', 'CANCELLED', 'VOID'], true)) {
        return false;  // Reject early, before scope check
    }

    return $this->isAllowedByDepartmentScope(
        $user,
        $this->resolveInvoiceDepartmentIds($invoice),
        [(int) $invoice->created_by]
    );
}
```

---

## Policy WITHOUT Permission Key Check

```php
// Sometimes you skip hasPermission() if scope alone is enough
class CustomerPolicy
{
    use ResolvesDepartmentScopedAccess;

    public function update(InternalUser $user, Customer $customer): bool
    {
        // No hasPermission() check - scope/ownership decides everything
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveCustomerDepartmentIds($customer),
            [(int) $customer->created_by]
        );
    }
}
```

---

## Full Real-World Example

### Model: Product
```php
class Product extends Model
{
    public $table = 'products';
    public $timestamps = true;
    
    protected $fillable = ['name', 'sku', 'dept_id', 'created_by'];
    
    public function createdBy()
    {
        return $this->belongsTo(InternalUser::class, 'created_by');
    }
}
```

### Policy: ProductPolicy
```php
<?php
namespace App\Policies;

use App\Models\InternalUser;
use App\Models\Product;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class ProductPolicy
{
    use ResolvesDepartmentScopedAccess;

    public function view(InternalUser $user, Product $product): bool
    {
        if (! $this->hasPermission($user, 'products.read')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            [(int) $product->dept_id],
            [(int) $product->created_by]
        );
    }

    public function update(InternalUser $user, Product $product): bool
    {
        if (! $this->hasPermission($user, 'products.write')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            [(int) $product->dept_id],
            [(int) $product->created_by]
        );
    }

    public function delete(InternalUser $user, Product $product): bool
    {
        if (! $this->hasPermission($user, 'products.delete')) {
            return false;
        }

        return $this->isAllowedByDepartmentScope(
            $user,
            [(int) $product->dept_id],
            [(int) $product->created_by]
        );
    }
}
```

### Controller: ProductController
```php
<?php
namespace App\Http\Controllers\Api\V5;

use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ProductController extends V5BaseController
{
    public function update(Request $request, int $id): JsonResponse
    {
        Gate::authorize('update', Product::findOrFail($id));

        return $this->productService->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        Gate::authorize('delete', Product::findOrFail($id));

        return $this->productService->destroy($request, $id);
    }
}
```

### Database Setup
```sql
-- Add permission keys
INSERT INTO permissions (perm_key, perm_name) VALUES
    ('products.read', 'View Products'),
    ('products.write', 'Create/Edit Products'),
    ('products.delete', 'Delete Products');

-- Link to roles via role_permission table
INSERT INTO role_permission (role_id, permission_id) VALUES
    (1, (SELECT id FROM permissions WHERE perm_key='products.read')),
    (1, (SELECT id FROM permissions WHERE perm_key='products.write')),
    (1, (SELECT id FROM permissions WHERE perm_key='products.delete'));
```

---

## Common Mistakes to Avoid

❌ **Missing hasPermission() check**
```php
// Bad: Only scope, no permission check
public function update(InternalUser $user, Invoice $invoice): bool
{
    return $this->isAllowedByDepartmentScope(...);  // Missing permission check!
}
```

✅ **Correct: Both checks**
```php
public function update(InternalUser $user, Invoice $invoice): bool
{
    if (! $this->hasPermission($user, 'fee_collection.write')) {  // ← Added!
        return false;
    }
    return $this->isAllowedByDepartmentScope(...);
}
```

---

❌ **Forgetting to import Gate**
```php
// Bad: Gate not imported
class ProductController extends V5BaseController
{
    public function update(...) {
        Gate::authorize(...)  // ← Will error: Gate not found
    }
}
```

✅ **Correct: Import Gate**
```php
use Illuminate\Support\Facades\Gate;

class ProductController extends V5BaseController
{
    public function update(...) {
        Gate::authorize('update', Product::findOrFail($id));
    }
}
```

---

❌ **Passing null/0 as owner IDs**
```php
// Bad: Passing null values
return $this->isAllowedByDepartmentScope(
    $user,
    $deptIds,
    [
        (int) $model->created_by,      // Could be null
        (int) $model->optional_field,  // Could be null/0
    ]
);
```

✅ **Correct: Filter nulls**
```php
return $this->isAllowedByDepartmentScope(
    $user,
    $deptIds,
    array_filter([
        (int) $model->created_by,
        (int) ($model->optional_field ?? 0),
    ], fn($id) => $id > 0)
);
```

The trait already handles null filtering, but explicit is better!

---

## Files to Copy From

| Source | Use For |
|--------|---------|
| `app/Policies/CustomerRequestCasePolicy.php` | Multi-owner, complex scope |
| `app/Policies/ContractPolicy.php` | Indirect dept resolution |
| `app/Policies/InvoicePolicy.php` | Business rule checks (status) |
| `app/Policies/CustomerPolicy.php` | No permission key check |
| `app/Http/Controllers/Api/V5/CustomerController.php` | Controller Gate usage |

---

## Database Tables (Reference)

```sql
-- Users and roles
user_roles(id, user_id, role_id, is_active, expires_at)
roles(id, role_code)

-- Permissions
permissions(id, perm_key, perm_name, is_active)
role_permission(role_id, permission_id)
user_permissions(id, user_id, permission_id, type=GRANT|DENY, expires_at)

-- Department scopes
user_dept_scopes(id, user_id, dept_id, scope_type)
-- scope_type: 'ALL', 'SELF_ONLY', 'DEPT_ONLY', 'DEPT_AND_CHILDREN'
```

