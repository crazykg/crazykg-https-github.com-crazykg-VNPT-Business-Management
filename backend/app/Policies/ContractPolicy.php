<?php

namespace App\Policies;

use App\Models\Contract;
use App\Models\InternalUser;
use App\Policies\Concerns\ResolvesDepartmentScopedAccess;

class ContractPolicy
{
    use ResolvesDepartmentScopedAccess;

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
