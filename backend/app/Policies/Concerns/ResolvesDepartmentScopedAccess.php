<?php

namespace App\Policies\Concerns;

use App\Models\Contract;
use App\Models\CustomerRequestCase;
use App\Models\InternalUser;
use App\Models\Invoice;
use App\Models\Project;
use App\Support\Auth\UserAccessService;

trait ResolvesDepartmentScopedAccess
{
    protected function accessService(): UserAccessService
    {
        return app(UserAccessService::class);
    }

    protected function hasPermission(InternalUser $user, string $permissionKey): bool
    {
        return $this->accessService()->hasPermission((int) $user->getKey(), $permissionKey);
    }

    /**
     * @param array<int, int|null> $deptIds
     * @param array<int, int|null> $ownerUserIds
     */
    protected function isAllowedByDepartmentScope(InternalUser $user, array $deptIds = [], array $ownerUserIds = []): bool
    {
        $userId = (int) $user->getKey();
        if ($this->accessService()->isAdmin($userId)) {
            return true;
        }

        $allowedDeptIds = $this->accessService()->resolveDepartmentIdsForUser($userId);
        if ($allowedDeptIds === null) {
            return true;
        }

        $normalizedDeptIds = array_values(array_unique(array_map(
            fn ($value): int => (int) $value,
            array_filter($deptIds, fn ($value): bool => $value !== null && (int) $value > 0)
        )));

        if ($normalizedDeptIds !== [] && array_intersect($allowedDeptIds, $normalizedDeptIds) !== []) {
            return true;
        }

        $normalizedOwnerIds = array_values(array_unique(array_map(
            fn ($value): int => (int) $value,
            array_filter($ownerUserIds, fn ($value): bool => $value !== null && (int) $value > 0)
        )));

        return in_array($userId, $normalizedOwnerIds, true);
    }

    /**
     * @return array<int, int>
     */
    protected function resolveProjectDepartmentIds(?Project $project): array
    {
        if (! $project instanceof Project) {
            return [];
        }

        return array_values(array_unique(array_filter([
            $this->toPositiveInt($project->getAttribute('dept_id')),
            $this->toPositiveInt($project->getAttribute('department_id')),
        ])));
    }

    /**
     * @return array<int, int>
     */
    protected function resolveContractDepartmentIds(Contract $contract): array
    {
        $project = $contract->project;
        if (! $project instanceof Project && $contract->project_id) {
            $project = Project::query()->find($contract->project_id);
        }

        return $this->resolveProjectDepartmentIds($project);
    }

    /**
     * @return array<int, int>
     */
    protected function resolveInvoiceDepartmentIds(Invoice $invoice): array
    {
        $deptIds = $this->resolveProjectDepartmentIds($invoice->project);

        if ($deptIds !== []) {
            return $deptIds;
        }

        $contract = $invoice->contract;
        if ($contract instanceof Contract) {
            return $this->resolveContractDepartmentIds($contract);
        }

        return [];
    }

    /**
     * @return array<int, int>
     */
    protected function resolveCustomerRequestCaseDepartmentIds(CustomerRequestCase $case): array
    {
        $project = $case->project;
        if (! $project instanceof Project && $case->project_id) {
            $project = Project::query()->find($case->project_id);
        }

        return $this->resolveProjectDepartmentIds($project);
    }

    protected function toPositiveInt(mixed $value): ?int
    {
        $normalized = (int) $value;

        return $normalized > 0 ? $normalized : null;
    }
}
