<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5AccessAuditService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContractSignerMasterService
{
    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly V5AccessAuditService $accessAudit,
    ) {}

    public function contractSignerMasters(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('contract_signer_masters')) {
            return $this->support->missingTable('contract_signer_masters');
        }
        if (! $this->support->hasTable('internal_users')) {
            return $this->support->missingTable('internal_users');
        }
        if (! $this->support->hasTable('departments')) {
            return $this->support->missingTable('departments');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByUserId = $this->contractUsageSummaryBySignerUserId();

        $query = DB::table('contract_signer_masters as master')
            ->leftJoin('internal_users as signer', 'signer.id', '=', 'master.internal_user_id')
            ->leftJoin('departments as dept', 'dept.id', '=', 'signer.department_id')
            ->select($this->buildListSelectColumns());

        if (! $includeInactive && $this->support->hasColumn('contract_signer_masters', 'is_active')) {
            $query->where('master.is_active', 1);
        }

        if ($this->support->hasColumn('departments', 'dept_name')) {
            $query->orderBy('dept.dept_name');
        }
        if ($this->support->hasColumn('internal_users', 'full_name')) {
            $query->orderBy('signer.full_name');
        }
        if ($this->support->hasColumn('contract_signer_masters', 'id')) {
            $query->orderBy('master.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $row): array => $this->serializeContractSignerMasterRecord((array) $row, $usageByUserId))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeContractSignerMaster(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('contract_signer_masters')) {
            return $this->support->missingTable('contract_signer_masters');
        }

        $validated = $request->validate([
            'internal_user_id' => ['required', 'integer'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $internalUserId = $this->support->parseNullableInt($validated['internal_user_id'] ?? null);
        if ($internalUserId === null) {
            return response()->json(['message' => 'internal_user_id is invalid.'], 422);
        }

        if ($this->contractSignerMasterExistsForUser($internalUserId)) {
            return response()->json(['message' => 'internal_user_id has already been taken.'], 422);
        }

        $signer = $this->resolveEligibleSigner($internalUserId);
        if ($signer === null) {
            return response()->json(['message' => 'internal_user_id is invalid or does not belong to a writable ownership department.'], 422);
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->support->filterPayloadByTableColumns('contract_signer_masters', [
            'internal_user_id' => $internalUserId,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->support->hasColumn('contract_signer_masters', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('contract_signer_masters', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('contract_signer_masters')->insertGetId($payload);
        $record = $this->loadContractSignerMasterById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Contract signer master created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateContractSignerMaster(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('contract_signer_masters')) {
            return $this->support->missingTable('contract_signer_masters');
        }

        $current = DB::table('contract_signer_masters')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Contract signer master not found.'], 404);
        }

        $validated = $request->validate([
            'internal_user_id' => ['required', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $internalUserId = $this->support->parseNullableInt($validated['internal_user_id'] ?? null);
        if ($internalUserId === null) {
            return response()->json(['message' => 'internal_user_id is invalid.'], 422);
        }

        if ($this->contractSignerMasterExistsForUser($internalUserId, $id)) {
            return response()->json(['message' => 'internal_user_id has already been taken.'], 422);
        }

        $currentInternalUserId = $this->support->parseNullableInt($current->internal_user_id ?? null);
        $usedInContracts = $this->contractUsageSummaryBySignerUserId()[$currentInternalUserId ?? 0] ?? 0;
        if ($currentInternalUserId !== $internalUserId && $usedInContracts > 0) {
            return response()->json(['message' => 'Khong the doi nguoi ky da phat sinh hop dong.'], 422);
        }

        $signer = $this->resolveEligibleSigner($internalUserId);
        if ($signer === null) {
            return response()->json(['message' => 'internal_user_id is invalid or does not belong to a writable ownership department.'], 422);
        }

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->accessAudit->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'internal_user_id' => $internalUserId,
        ];
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->support->filterPayloadByTableColumns('contract_signer_masters', $payload);
        if ($this->support->hasColumn('contract_signer_masters', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('contract_signer_masters')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadContractSignerMasterById($id);
        if ($record === null) {
            return response()->json(['message' => 'Contract signer master not found.'], 404);
        }

        return response()->json(['data' => $record]);
    }

    /**
     * @return array<int, string|\Illuminate\Contracts\Database\Query\Expression>
     */
    private function buildListSelectColumns(): array
    {
        return [
            $this->support->hasColumn('contract_signer_masters', 'id')
                ? 'master.id as id'
                : DB::raw('NULL as id'),
            $this->support->hasColumn('contract_signer_masters', 'internal_user_id')
                ? 'master.internal_user_id as internal_user_id'
                : DB::raw('NULL as internal_user_id'),
            $this->support->hasColumn('contract_signer_masters', 'is_active')
                ? 'master.is_active as is_active'
                : DB::raw('1 as is_active'),
            $this->support->hasColumn('contract_signer_masters', 'created_at')
                ? 'master.created_at as created_at'
                : DB::raw('NULL as created_at'),
            $this->support->hasColumn('contract_signer_masters', 'created_by')
                ? 'master.created_by as created_by'
                : DB::raw('NULL as created_by'),
            $this->support->hasColumn('contract_signer_masters', 'updated_at')
                ? 'master.updated_at as updated_at'
                : DB::raw('NULL as updated_at'),
            $this->support->hasColumn('contract_signer_masters', 'updated_by')
                ? 'master.updated_by as updated_by'
                : DB::raw('NULL as updated_by'),
            $this->support->hasColumn('internal_users', 'user_code')
                ? 'signer.user_code as user_code'
                : DB::raw('NULL as user_code'),
            $this->support->hasColumn('internal_users', 'full_name')
                ? 'signer.full_name as full_name'
                : DB::raw('NULL as full_name'),
            $this->support->hasColumn('internal_users', 'department_id')
                ? 'signer.department_id as department_id'
                : DB::raw('NULL as department_id'),
            $this->support->hasColumn('departments', 'dept_code')
                ? 'dept.dept_code as dept_code'
                : DB::raw('NULL as dept_code'),
            $this->support->hasColumn('departments', 'dept_name')
                ? 'dept.dept_name as dept_name'
                : DB::raw('NULL as dept_name'),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadContractSignerMasterById(int $id): ?array
    {
        if ($id <= 0 || ! $this->support->hasTable('contract_signer_masters')) {
            return null;
        }

        $record = DB::table('contract_signer_masters as master')
            ->leftJoin('internal_users as signer', 'signer.id', '=', 'master.internal_user_id')
            ->leftJoin('departments as dept', 'dept.id', '=', 'signer.department_id')
            ->where('master.id', $id)
            ->select($this->buildListSelectColumns())
            ->first();

        if (! $record instanceof \stdClass) {
            return null;
        }

        return $this->serializeContractSignerMasterRecord((array) $record, $this->contractUsageSummaryBySignerUserId());
    }

    /**
     * @param array<string, mixed> $record
     * @param array<int, int> $usageByUserId
     * @return array<string, mixed>
     */
    private function serializeContractSignerMasterRecord(array $record, array $usageByUserId): array
    {
        $internalUserId = $this->support->parseNullableInt($record['internal_user_id'] ?? null);
        $rawDepartmentId = $this->support->parseNullableInt($record['department_id'] ?? null);
        $ownershipDepartment = $this->support->resolveOwnershipDepartmentById($rawDepartmentId);

        return [
            'id' => $this->support->parseNullableInt($record['id'] ?? null),
            'internal_user_id' => $internalUserId,
            'user_code' => $this->support->normalizeNullableString($record['user_code'] ?? null),
            'full_name' => $this->support->normalizeNullableString($record['full_name'] ?? null),
            'department_id' => $ownershipDepartment['id'] ?? null,
            'dept_code' => $ownershipDepartment['dept_code'] ?? null,
            'dept_name' => $ownershipDepartment['dept_name'] ?? null,
            'used_in_contracts' => $internalUserId === null ? 0 : (int) ($usageByUserId[$internalUserId] ?? 0),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $this->support->parseNullableInt($record['created_by'] ?? null),
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $this->support->parseNullableInt($record['updated_by'] ?? null),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function contractUsageSummaryBySignerUserId(): array
    {
        if (! $this->support->hasTable('contracts') || ! $this->support->hasColumn('contracts', 'signer_user_id')) {
            return [];
        }

        $query = DB::table('contracts')
            ->select('signer_user_id', DB::raw('COUNT(*) as aggregate'))
            ->whereNotNull('signer_user_id');

        if ($this->support->hasColumn('contracts', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query
            ->groupBy('signer_user_id')
            ->get()
            ->reduce(function (array $carry, object $row): array {
                $signerUserId = $this->support->parseNullableInt($row->signer_user_id ?? null);
                if ($signerUserId !== null) {
                    $carry[$signerUserId] = (int) ($row->aggregate ?? 0);
                }

                return $carry;
            }, []);
    }

    /**
     * @return array{id:int,department_id:int,dept_code:?string,dept_name:?string}|null
     */
    private function resolveEligibleSigner(int $internalUserId): ?array
    {
        if (
            ! $this->support->hasTable('internal_users')
            || ! $this->support->hasColumn('internal_users', 'department_id')
        ) {
            return null;
        }

        $query = DB::table('internal_users')
            ->where('id', $internalUserId);

        if ($this->support->hasColumn('internal_users', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $record = $query->first();
        if (! $record instanceof \stdClass) {
            return null;
        }

        $departmentId = $this->support->parseNullableInt($record->department_id ?? null);
        $ownershipDepartment = $this->support->resolveOwnershipDepartmentById($departmentId);
        if ($ownershipDepartment === null) {
            return null;
        }

        return [
            'id' => $internalUserId,
            'department_id' => (int) $ownershipDepartment['id'],
            'dept_code' => $ownershipDepartment['dept_code'] ?? null,
            'dept_name' => $ownershipDepartment['dept_name'] ?? null,
        ];
    }

    private function contractSignerMasterExistsForUser(int $internalUserId, ?int $ignoreId = null): bool
    {
        if (! $this->support->hasTable('contract_signer_masters')) {
            return false;
        }

        $query = DB::table('contract_signer_masters')
            ->where('internal_user_id', $internalUserId);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }

    private function tableRowExists(string $table, int $id): bool
    {
        return $this->support->hasTable($table) && DB::table($table)->where('id', $id)->exists();
    }
}
