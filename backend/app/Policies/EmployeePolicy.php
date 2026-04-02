<?php

namespace App\Policies;

use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class EmployeePolicy
{
    use ResolvesDepartmentScopedAccess;

    /**
     * Check if user can update an employee within their department scope.
     * Employees scoped by: user's allowed departments OR creator of the employee.
     */
    public function update(InternalUser $user, Model $employee): bool
    {
        return $this->isAllowedByDepartmentScope(
            $user,
            $this->resolveEmployeeDepartmentIds($employee),
            [(int) ($employee->getAttribute('created_by') ?? 0)]
        );
    }

    /**
     * Check if user can delete an employee within their department scope.
     */
    public function delete(InternalUser $user, Model $employee): bool
    {
        return $this->update($user, $employee);
    }

    /**
     * Resolve department IDs linked to an employee.
     * Employees have direct department_id column.
     *
     * @return array<int, int>
     */
    private function resolveEmployeeDepartmentIds(Model $employee): array
    {
        if (! Schema::hasTable('internal_users') || ! Schema::hasColumn('internal_users', 'department_id')) {
            return [];
        }

        $departmentId = $this->toPositiveInt($employee->getAttribute('department_id'));

        return $departmentId !== null ? [$departmentId] : [];
    }
}
