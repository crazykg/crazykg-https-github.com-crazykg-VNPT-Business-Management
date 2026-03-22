<?php

namespace App\Services\V5\Support;

use Illuminate\Support\Facades\DB;

class OwnershipResolver
{
    public function __construct(
        private readonly SchemaCapabilityService $schema,
        private readonly PayloadMutationSupport $payloadSupport,
    ) {}

    public function resolveEmployeeTable(): ?string
    {
        if ($this->schema->hasTable('internal_users')) {
            return 'internal_users';
        }

        return null;
    }

    public function resolveEmployeeDepartmentColumn(?string $employeeTable): ?string
    {
        if ($employeeTable === null) {
            return null;
        }

        if ($this->schema->hasColumn($employeeTable, 'department_id')) {
            return 'department_id';
        }

        if ($this->schema->hasColumn($employeeTable, 'dept_id')) {
            return 'dept_id';
        }

        return null;
    }

    public function countEmployeesByDepartment(int $departmentId, string $employeeTable, string $departmentColumn): int
    {
        if ($departmentId <= 0 || ! $this->schema->hasTable($employeeTable) || ! $this->schema->hasColumn($employeeTable, $departmentColumn)) {
            return 0;
        }

        return (int) DB::table($employeeTable)
            ->where($departmentColumn, $departmentId)
            ->count();
    }

    public function resolveDefaultOwnerId(): ?int
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return null;
        }

        $internalId = DB::table($employeeTable)->orderBy('id')->value('id');

        return $internalId !== null ? (int) $internalId : null;
    }

    public function ownerExists(int $ownerId): bool
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return false;
        }

        return DB::table($employeeTable)->where('id', $ownerId)->exists();
    }

    /**
     * @param array<string, mixed> $record
     * @param array<int, string> $keys
     */
    public function extractIntFromRecord(array $record, array $keys): ?int
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $record)) {
                continue;
            }

            $value = $this->payloadSupport->parseNullableInt($record[$key]);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    public function resolveOpportunityDepartmentIdById(?int $opportunityId): ?int
    {
        if ($opportunityId === null || ! $this->schema->hasTable('opportunities')) {
            return null;
        }

        $selects = ['id'];
        if ($this->schema->hasColumn('opportunities', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->schema->hasColumn('opportunities', 'department_id')) {
            $selects[] = 'department_id';
        }

        if (count($selects) <= 1) {
            return null;
        }

        $row = DB::table('opportunities')
            ->select($selects)
            ->where('id', $opportunityId)
            ->first();
        if ($row === null) {
            return null;
        }

        return $this->extractIntFromRecord((array) $row, ['dept_id', 'department_id']);
    }

    public function resolveProjectDepartmentIdById(?int $projectId): ?int
    {
        if ($projectId === null || ! $this->schema->hasTable('projects')) {
            return null;
        }

        $selects = ['id'];
        if ($this->schema->hasColumn('projects', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->schema->hasColumn('projects', 'department_id')) {
            $selects[] = 'department_id';
        }
        if ($this->schema->hasColumn('projects', 'opportunity_id')) {
            $selects[] = 'opportunity_id';
        }

        $row = DB::table('projects')
            ->select($selects)
            ->where('id', $projectId)
            ->first();
        if ($row === null) {
            return null;
        }

        $data = (array) $row;
        $departmentId = $this->extractIntFromRecord($data, ['dept_id', 'department_id']);
        if ($departmentId !== null) {
            return $departmentId;
        }

        $opportunityId = $this->extractIntFromRecord($data, ['opportunity_id']);

        return $this->resolveOpportunityDepartmentIdById($opportunityId);
    }

    /**
     * @param array<string, mixed> $record
     */
    public function resolveDepartmentIdForTableRecord(string $table, array $record): ?int
    {
        $normalizedTable = strtolower($table);
        if ($normalizedTable === 'contracts') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $projectId = $this->extractIntFromRecord($record, ['project_id']);

            return $this->resolveProjectDepartmentIdById($projectId);
        }

        if ($normalizedTable === 'projects') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $opportunityId = $this->extractIntFromRecord($record, ['opportunity_id']);

            return $this->resolveOpportunityDepartmentIdById($opportunityId);
        }

        if ($normalizedTable === 'opportunities') {
            return $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
        }

        if ($normalizedTable === 'documents' || $normalizedTable === 'support_requests') {
            $departmentId = $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
            if ($departmentId !== null) {
                return $departmentId;
            }

            $projectId = $this->extractIntFromRecord($record, ['project_id']);

            return $this->resolveProjectDepartmentIdById($projectId);
        }

        return $this->extractIntFromRecord($record, ['dept_id', 'department_id']);
    }
}
