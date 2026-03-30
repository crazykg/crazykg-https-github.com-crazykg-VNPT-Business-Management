<?php

namespace App\Policies;

use App\Models\CustomerRequestCase;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class CustomerRequestCasePolicy
{
    use ResolvesDepartmentScopedAccess;

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
