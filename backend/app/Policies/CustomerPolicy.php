<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;
use Illuminate\Support\Facades\Schema;

class CustomerPolicy
{
    use ResolvesDepartmentScopedAccess;

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
     * @return array<int, int>
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
