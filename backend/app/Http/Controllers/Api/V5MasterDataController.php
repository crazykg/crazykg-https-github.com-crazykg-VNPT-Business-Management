<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Customer;
use App\Models\Department;
use App\Models\InternalUser;
use App\Models\Opportunity;
use App\Models\Project;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class V5MasterDataController extends Controller
{
    private const DEFAULT_INTERNAL_USER_PASSWORD_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    private const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

    private const EMPLOYEE_INPUT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'TRANSFERRED'];

    private const PROJECT_STATUSES = ['PLANNING', 'ONGOING', 'COMPLETED', 'CANCELLED'];

    private const CONTRACT_STATUSES = ['DRAFT', 'PENDING', 'SIGNED', 'LIQUIDATED'];

    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    private const PAYMENT_SCHEDULE_STATUSES = ['PENDING', 'INVOICED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];

    private const OPPORTUNITY_STAGES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

    public function departments(): JsonResponse
    {
        if (! $this->hasTable('departments')) {
            return $this->missingTable('departments');
        }

        $rows = Department::query()
            ->with(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())])
            ->select($this->selectColumns('departments', [
                'id',
                'dept_code',
                'dept_name',
                'parent_id',
                'dept_path',
                'is_active',
                'status',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Department $department): array => $this->serializeDepartment($department))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function employees(): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $query = $employeeModel::query()
            ->with(['department' => fn ($query) => $query->select($this->departmentRelationColumns())])
            ->select($this->selectColumns($employeeTable, [
                'id',
                'uuid',
                'username',
                'user_code',
                'full_name',
                'email',
                'status',
                'department_id',
                'dept_id',
                'position_id',
                'job_title_raw',
                'date_of_birth',
                'gender',
                'vpn_status',
                'ip_address',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        if ($this->hasTable('positions')) {
            $query->with(['position' => fn ($relationQuery) => $relationQuery->select($this->positionRelationColumns())]);
        }

        $rows = $query
            ->orderBy('id')
            ->get()
            ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function customers(): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $rows = Customer::query()
            ->select($this->selectColumns('customers', [
                'id',
                'uuid',
                'customer_code',
                'customer_name',
                'company_name',
                'tax_code',
                'address',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Customer $customer): array => $this->serializeCustomer($customer))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function vendors(): JsonResponse
    {
        if (! $this->hasTable('vendors')) {
            return $this->missingTable('vendors');
        }

        $rows = Vendor::query()
            ->select($this->selectColumns('vendors', [
                'id',
                'uuid',
                'vendor_code',
                'vendor_name',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Vendor $vendor): array => $this->serializeVendor($vendor))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function projects(): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $rows = Project::query()
            ->with(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ->select($this->selectColumns('projects', [
                'id',
                'project_code',
                'project_name',
                'customer_id',
                'opportunity_id',
                'investment_mode',
                'start_date',
                'expected_end_date',
                'actual_end_date',
                'status',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Project $project): array => $this->serializeProject($project))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function contracts(): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $rows = Contract::query()
            ->with([
                'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
                'project' => fn ($query) => $query->select($this->projectRelationColumns()),
            ])
            ->select($this->selectColumns('contracts', [
                'id',
                'contract_code',
                'contract_number',
                'contract_name',
                'customer_id',
                'project_id',
                'value',
                'total_value',
                'payment_cycle',
                'sign_date',
                'expiry_date',
                'status',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Contract $contract): array => $this->serializeContract($contract))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function opportunities(): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $rows = Opportunity::query()
            ->with(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ->select($this->selectColumns('opportunities', [
                'id',
                'opp_name',
                'customer_id',
                'amount',
                'expected_value',
                'stage',
                'probability',
                'owner_id',
                'data_scope',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (Opportunity $opportunity): array => $this->serializeOpportunity($opportunity))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function businesses(): JsonResponse
    {
        if (! $this->hasTable('business_domains')) {
            return $this->missingTable('business_domains');
        }

        $rows = DB::table('business_domains')
            ->select($this->selectColumns('business_domains', [
                'id',
                'domain_code',
                'domain_name',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->orderBy('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function products(): JsonResponse
    {
        if (! $this->hasTable('products')) {
            return $this->missingTable('products');
        }

        $rows = DB::table('products')
            ->select($this->selectColumns('products', [
                'id',
                'product_code',
                'product_name',
                'domain_id',
                'vendor_id',
                'standard_price',
                'unit',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->orderBy('id')
            ->get()
            ->map(function (object $item): array {
                $row = (array) $item;
                $row['standard_price'] = (float) ($row['standard_price'] ?? 0);

                return $row;
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function customerPersonnel(): JsonResponse
    {
        if (! $this->hasTable('customer_personnel')) {
            return $this->missingTable('customer_personnel');
        }

        $rows = DB::table('customer_personnel')
            ->select($this->selectColumns('customer_personnel', [
                'id',
                'customer_id',
                'full_name',
                'date_of_birth',
                'position_type',
                'phone',
                'email',
                'status',
                'created_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(function (object $item): array {
                $row = (array) $item;
                $status = strtoupper((string) ($row['status'] ?? 'ACTIVE'));

                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'fullName' => (string) ($row['full_name'] ?? ''),
                    'birthday' => $this->formatDateColumn($row['date_of_birth'] ?? null),
                    'positionType' => (string) ($row['position_type'] ?? 'DAU_MOI'),
                    'phoneNumber' => (string) ($row['phone'] ?? ''),
                    'email' => (string) ($row['email'] ?? ''),
                    'customerId' => (string) ($row['customer_id'] ?? ''),
                    'status' => $status === 'INACTIVE' ? 'Inactive' : 'Active',
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function documents(): JsonResponse
    {
        if (! $this->hasTable('documents')) {
            return $this->missingTable('documents');
        }

        $documentTypeCodeById = [];
        if ($this->hasTable('document_types')) {
            $documentTypeRows = DB::table('document_types')
                ->select($this->selectColumns('document_types', ['id', 'type_code']))
                ->get()
                ->map(fn (object $item): array => (array) $item)
                ->values();

            foreach ($documentTypeRows as $typeRow) {
                if (array_key_exists('id', $typeRow) && array_key_exists('type_code', $typeRow)) {
                    $documentTypeCodeById[(string) $typeRow['id']] = (string) $typeRow['type_code'];
                }
            }
        }

        $rows = DB::table('documents')
            ->select($this->selectColumns('documents', [
                'id',
                'document_code',
                'document_name',
                'document_type_id',
                'customer_id',
                'project_id',
                'expiry_date',
                'status',
                'created_at',
            ]))
            ->orderByDesc('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $attachmentMap = [];
        if ($this->hasTable('attachments') && $this->hasColumn('attachments', 'reference_type') && $this->hasColumn('attachments', 'reference_id')) {
            $documentIds = $rows
                ->map(fn (array $row): ?int => $this->parseNullableInt($row['id'] ?? null))
                ->filter(fn (?int $id): bool => $id !== null)
                ->values()
                ->all();

            if (! empty($documentIds)) {
                $attachmentRows = DB::table('attachments')
                    ->select($this->selectColumns('attachments', [
                        'id',
                        'reference_id',
                        'file_name',
                        'file_url',
                        'drive_file_id',
                        'file_size',
                        'created_at',
                    ]))
                    ->where('reference_type', 'DOCUMENT')
                    ->whereIn('reference_id', $documentIds)
                    ->orderBy('id')
                    ->get()
                    ->map(fn (object $item): array => (array) $item)
                    ->values();

                foreach ($attachmentRows as $attachmentRow) {
                    $referenceId = (string) ($attachmentRow['reference_id'] ?? '');
                    if ($referenceId === '') {
                        continue;
                    }

                    $attachmentMap[$referenceId][] = [
                        'id' => (string) ($attachmentRow['id'] ?? ''),
                        'fileName' => (string) ($attachmentRow['file_name'] ?? ''),
                        'mimeType' => 'application/octet-stream',
                        'fileSize' => (int) ($attachmentRow['file_size'] ?? 0),
                        'fileUrl' => (string) ($attachmentRow['file_url'] ?? ''),
                        'driveFileId' => (string) ($attachmentRow['drive_file_id'] ?? ''),
                        'createdAt' => $this->formatDateColumn($attachmentRow['created_at'] ?? null) ?? '',
                    ];
                }
            }
        }

        $serializedRows = $rows
            ->map(function (array $row) use ($attachmentMap, $documentTypeCodeById): array {
                $status = strtoupper((string) ($row['status'] ?? 'ACTIVE'));
                $documentId = (string) ($row['id'] ?? '');
                $documentCode = (string) ($this->firstNonEmpty($row, ['document_code', 'id'], ''));
                $documentTypeId = (string) ($row['document_type_id'] ?? '');
                $typeId = $documentTypeCodeById[$documentTypeId] ?? $documentTypeId;

                return [
                    'id' => $documentCode,
                    'name' => (string) ($row['document_name'] ?? ''),
                    'typeId' => $typeId,
                    'customerId' => (string) ($row['customer_id'] ?? ''),
                    'projectId' => $row['project_id'] === null ? null : (string) $row['project_id'],
                    'expiryDate' => $this->formatDateColumn($row['expiry_date'] ?? null),
                    'status' => in_array($status, ['ACTIVE', 'SUSPENDED', 'EXPIRED'], true) ? $status : 'ACTIVE',
                    'attachments' => $attachmentMap[$documentId] ?? [],
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                ];
            })
            ->values();

        return response()->json(['data' => $serializedRows]);
    }

    public function reminders(): JsonResponse
    {
        if (! $this->hasTable('reminders')) {
            return $this->missingTable('reminders');
        }

        $rows = DB::table('reminders')
            ->select($this->selectColumns('reminders', [
                'id',
                'reminder_title',
                'content',
                'remind_date',
                'assigned_to',
                'status',
                'created_at',
            ]))
            ->orderByDesc('remind_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (object $item): array {
                $row = (array) $item;

                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'title' => (string) ($row['reminder_title'] ?? ''),
                    'content' => (string) ($row['content'] ?? ''),
                    'remindDate' => $this->formatDateColumn($row['remind_date'] ?? null) ?? '',
                    'assignedToUserId' => (string) ($row['assigned_to'] ?? ''),
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                    'status' => strtoupper((string) ($row['status'] ?? 'ACTIVE')),
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function userDeptHistory(): JsonResponse
    {
        if (! $this->hasTable('user_dept_history')) {
            return $this->missingTable('user_dept_history');
        }

        $rows = DB::table('user_dept_history')
            ->select($this->selectColumns('user_dept_history', [
                'id',
                'user_id',
                'from_dept_id',
                'to_dept_id',
                'transfer_date',
                'decision_number',
                'reason',
                'created_at',
            ]))
            ->orderByDesc('transfer_date')
            ->orderByDesc('id')
            ->get();

        $userIds = $rows
            ->pluck('user_id')
            ->filter(fn (mixed $value): bool => $value !== null && $value !== '')
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        $deptIds = $rows
            ->flatMap(fn (object $item): array => [
                $item->from_dept_id ?? null,
                $item->to_dept_id ?? null,
            ])
            ->filter(fn (mixed $value): bool => $value !== null && $value !== '')
            ->map(fn (mixed $value): int => (int) $value)
            ->unique()
            ->values()
            ->all();

        $userMap = $this->resolveTransferUserMap($userIds);
        $deptMap = $this->resolveTransferDepartmentMap($deptIds);

        $serializedRows = $rows
            ->map(function (object $item): array {
                $row = (array) $item;

                return [
                    'id' => (string) ($row['id'] ?? ''),
                    'userId' => (string) ($row['user_id'] ?? ''),
                    'fromDeptId' => (string) ($row['from_dept_id'] ?? ''),
                    'toDeptId' => (string) ($row['to_dept_id'] ?? ''),
                    'transferDate' => $this->formatDateColumn($row['transfer_date'] ?? null) ?? '',
                    'reason' => (string) ($row['reason'] ?? ''),
                    'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
                    'decisionNumber' => (string) ($row['decision_number'] ?? ''),
                ];
            })
            ->map(function (array $row) use ($userMap, $deptMap): array {
                $userId = (string) ($row['userId'] ?? '');
                $fromDeptId = (string) ($row['fromDeptId'] ?? '');
                $toDeptId = (string) ($row['toDeptId'] ?? '');

                $user = $userMap[$userId] ?? null;
                $fromDept = $deptMap[$fromDeptId] ?? null;
                $toDept = $deptMap[$toDeptId] ?? null;

                $userCode = $this->normalizeEmployeeCode(
                    (string) ($user['user_code'] ?? ''),
                    $user['id'] ?? $userId
                );
                $userName = (string) $this->firstNonEmpty($user ?? [], ['full_name', 'username'], '');

                return [
                    ...$row,
                    'userCode' => $userCode,
                    'userName' => $userName,
                    'fromDeptCode' => $fromDept['dept_code'] ?? null,
                    'fromDeptName' => $fromDept['dept_name'] ?? null,
                    'toDeptCode' => $toDept['dept_code'] ?? null,
                    'toDeptName' => $toDept['dept_name'] ?? null,
                ];
            })
            ->values();

        return response()->json(['data' => $serializedRows]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        if (! $this->hasTable('audit_logs')) {
            return $this->missingTable('audit_logs');
        }

        $limit = $request->integer('limit', 200);
        $limit = max(1, min($limit, 1000));

        $query = DB::table('audit_logs')
            ->select($this->selectColumns('audit_logs', [
                'id',
                'uuid',
                'event',
                'auditable_type',
                'auditable_id',
                'old_values',
                'new_values',
                'url',
                'ip_address',
                'user_agent',
                'created_at',
                'created_by',
            ]))
            ->limit($limit);

        if ($this->hasColumn('audit_logs', 'created_at')) {
            $query->orderByDesc('created_at');
        }
        if ($this->hasColumn('audit_logs', 'id')) {
            $query->orderByDesc('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $actorIds = $rows
            ->map(fn (array $row): ?int => $this->parseNullableInt($row['created_by'] ?? null))
            ->filter(fn (?int $id): bool => $id !== null)
            ->unique()
            ->values()
            ->all();

        $actorMap = $this->resolveAuditActorMap($actorIds);

        $serializedRows = $rows
            ->map(function (array $row) use ($actorMap): array {
                if (array_key_exists('old_values', $row)) {
                    $row['old_values'] = $this->decodeJsonColumnIfNeeded($row['old_values']);
                }
                if (array_key_exists('new_values', $row)) {
                    $row['new_values'] = $this->decodeJsonColumnIfNeeded($row['new_values']);
                }

                $actorId = $this->parseNullableInt($row['created_by'] ?? null);
                $row['actor'] = $actorId !== null ? ($actorMap[(string) $actorId] ?? null) : null;

                return $row;
            })
            ->values();

        return response()->json(['data' => $serializedRows]);
    }

    public function storeDepartment(Request $request): JsonResponse
    {
        if (! $this->hasTable('departments')) {
            return $this->missingTable('departments');
        }

        $supportsIsActive = $this->hasColumn('departments', 'is_active');
        $supportsStatus = $this->hasColumn('departments', 'status');
        $supportsDataScope = $this->hasColumn('departments', 'data_scope');
        $supportsDeptPath = $this->hasColumn('departments', 'dept_path');

        $rules = [
            'dept_code' => ['required', 'string', 'max:100', 'unique:departments,dept_code'],
            'dept_name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer'],
        ];
        if ($supportsIsActive || $supportsStatus) {
            $rules['is_active'] = ['nullable', 'boolean'];
        }
        if ($supportsDataScope) {
            $rules['data_scope'] = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        if (! empty($validated['parent_id']) && ! Department::query()->whereKey($validated['parent_id'])->exists()) {
            return response()->json(['message' => 'parent_id is invalid.'], 422);
        }

        $department = new Department();
        $department->dept_code = $validated['dept_code'];
        $department->dept_name = $validated['dept_name'];
        $department->parent_id = $validated['parent_id'] ?? null;
        $isActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true;
        if ($supportsIsActive) {
            $department->setAttribute('is_active', $isActive);
        }
        if ($supportsStatus) {
            $department->setAttribute('status', $isActive ? 'ACTIVE' : 'INACTIVE');
        }
        if ($supportsDataScope) {
            $department->setAttribute('data_scope', $validated['data_scope'] ?? null);
        }
        $department->save();

        if ($supportsDeptPath) {
            $department->dept_path = $this->buildDeptPath($department);
            $department->save();
        }

        return response()->json([
            'data' => $this->serializeDepartment(
                $department->fresh()->load(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())])
            ),
        ], 201);
    }

    public function updateDepartment(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('departments')) {
            return $this->missingTable('departments');
        }

        $department = Department::query()->findOrFail($id);

        $supportsIsActive = $this->hasColumn('departments', 'is_active');
        $supportsStatus = $this->hasColumn('departments', 'status');
        $supportsDataScope = $this->hasColumn('departments', 'data_scope');
        $supportsDeptPath = $this->hasColumn('departments', 'dept_path');

        $rules = [
            'dept_code' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('departments', 'dept_code')->ignore($department->id),
            ],
            'dept_name' => ['sometimes', 'required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer'],
        ];
        if ($supportsIsActive || $supportsStatus) {
            $rules['is_active'] = ['nullable', 'boolean'];
        }
        if ($supportsDataScope) {
            $rules['data_scope'] = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        if (array_key_exists('parent_id', $validated)) {
            if (! empty($validated['parent_id']) && (int) $validated['parent_id'] === (int) $department->id) {
                return response()->json(['message' => 'parent_id cannot be self.'], 422);
            }

            if (! empty($validated['parent_id']) && ! Department::query()->whereKey($validated['parent_id'])->exists()) {
                return response()->json(['message' => 'parent_id is invalid.'], 422);
            }
        }

        if (array_key_exists('dept_code', $validated)) {
            $department->dept_code = $validated['dept_code'];
        }
        if (array_key_exists('dept_name', $validated)) {
            $department->dept_name = $validated['dept_name'];
        }

        $parentChanged = false;
        if (array_key_exists('parent_id', $validated)) {
            $department->parent_id = $validated['parent_id'] ?? null;
            $parentChanged = true;
        }

        if (array_key_exists('is_active', $validated)) {
            $isActive = (bool) $validated['is_active'];
            if ($supportsIsActive) {
                $department->setAttribute('is_active', $isActive);
            }
            if ($supportsStatus) {
                $department->setAttribute('status', $isActive ? 'ACTIVE' : 'INACTIVE');
            }
        }

        if ($supportsDataScope && array_key_exists('data_scope', $validated)) {
            $department->setAttribute('data_scope', $validated['data_scope']);
        }

        $department->save();

        if ($parentChanged && $supportsDeptPath) {
            $department->dept_path = $this->buildDeptPath($department);
            $department->save();
        }

        return response()->json([
            'data' => $this->serializeDepartment(
                $department->fresh()->load(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())])
            ),
        ]);
    }

    public function deleteDepartment(int $id): JsonResponse
    {
        if (! $this->hasTable('departments')) {
            return $this->missingTable('departments');
        }

        $department = Department::query()->findOrFail($id);

        return $this->deleteModel($department, 'Department');
    }

    public function storeEmployee(Request $request): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:100'],
            'user_code' => ['nullable', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['nullable', 'integer'],
            'position_id' => ['nullable', 'integer'],
            'job_title_raw' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid');
        }
        if ($this->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username');
        }
        if ($this->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][0] = 'required';
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code');
        }
        if ($this->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email');
        }

        $validated = $request->validate($rules);

        $departmentId = $this->parseNullableInt($validated['department_id'] ?? null);
        if ($departmentId !== null && ! Department::query()->whereKey($departmentId)->exists()) {
            return response()->json(['message' => 'department_id is invalid.'], 422);
        }

        $employee = new $employeeModel();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $username = (string) ($validated['username'] ?? $validated['user_code'] ?? '');
        $employeeCode = (string) ($validated['user_code'] ?? $validated['username'] ?? '');
        $this->setAttributeIfColumn($employee, $employeeTable, 'uuid', $uuid);
        $this->setAttributeIfColumn($employee, $employeeTable, 'username', $username);
        $this->setAttributeIfColumn($employee, $employeeTable, 'user_code', $employeeCode);
        $this->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        $this->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        $this->setAttributeIfColumn($employee, $employeeTable, 'status', $this->toEmployeeStorageStatus((string) ($validated['status'] ?? 'ACTIVE')));
        $this->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);

        $positionRaw = $validated['position_id'] ?? null;
        $positionId = $this->parseNullableInt($positionRaw);
        if ($this->hasColumn($employeeTable, 'position_id')) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
        } elseif ($this->hasColumn($employeeTable, 'job_title_raw')) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
        }

        if (array_key_exists('job_title_raw', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        if (array_key_exists('gender', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }

        if ($this->hasColumn($employeeTable, 'data_scope')) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope'] ?? null);
        }

        if ($this->hasColumn($employeeTable, 'password')) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'password', self::DEFAULT_INTERNAL_USER_PASSWORD_HASH);
        }

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Không thể tải lại dữ liệu nhân sự sau khi lưu.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->departmentRelationColumns()),
        ]);
        if ($this->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
        ], 201);
    }

    public function updateEmployee(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);
        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'username' => ['sometimes', 'required', 'string', 'max:100'],
            'user_code' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['sometimes', 'nullable', 'integer'],
            'position_id' => ['sometimes', 'nullable', 'integer'],
            'job_title_raw' => ['sometimes', 'nullable', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'gender' => ['sometimes', 'nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['sometimes', 'nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['sometimes', 'nullable', 'string', 'max:45'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid')->ignore($employee->id);
        }
        if ($this->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username')->ignore($employee->id);
        }
        if ($this->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code')->ignore($employee->id);
        }
        if ($this->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email')->ignore($employee->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('department_id', $validated)) {
            $departmentId = $this->parseNullableInt($validated['department_id']);
            if ($departmentId !== null && ! Department::query()->whereKey($departmentId)->exists()) {
                return response()->json(['message' => 'department_id is invalid.'], 422);
            }
            $this->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);
        }

        if (array_key_exists('uuid', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'uuid', $validated['uuid']);
        }
        if (array_key_exists('username', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'username', $validated['username']);
        }
        if (array_key_exists('user_code', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'user_code', $validated['user_code']);
        }
        if (array_key_exists('full_name', $validated)) {
            $this->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        }
        if (array_key_exists('email', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        }
        if (array_key_exists('status', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'status', $this->toEmployeeStorageStatus((string) $validated['status']));
        }
        if (array_key_exists('position_id', $validated)) {
            $positionRaw = $validated['position_id'];
            $positionId = $this->parseNullableInt($positionRaw);

            if ($this->hasColumn($employeeTable, 'position_id')) {
                $this->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
            } elseif ($this->hasColumn($employeeTable, 'job_title_raw')) {
                $this->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
            }
        }
        if (array_key_exists('job_title_raw', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        if (array_key_exists('gender', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }
        if ($this->hasColumn($employeeTable, 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope']);
        }

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Không thể tải lại dữ liệu nhân sự sau khi cập nhật.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->departmentRelationColumns()),
        ]);
        if ($this->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
        ]);
    }

    public function deleteEmployee(int $id): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);
        try {
            DB::transaction(function () use ($employee): void {
                $employee->delete();
            });

            return response()->json(['message' => 'Employee deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Employee is referenced by other records and cannot be deleted.',
            ], 422);
        }
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'customer_code' => ['required', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('customers', 'uuid')) {
            $rules['uuid'][] = Rule::unique('customers', 'uuid');
        }
        if ($this->hasColumn('customers', 'customer_code')) {
            $rules['customer_code'][] = Rule::unique('customers', 'customer_code');
        }

        $validated = $request->validate($rules);

        $customer = new Customer();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->setAttributeIfColumn($customer, 'customers', 'uuid', $uuid);
        $this->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        $this->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        $this->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code'] ?? null);
        $this->setAttributeIfColumn($customer, 'customers', 'address', $validated['address'] ?? null);

        if ($this->hasColumn('customers', 'data_scope')) {
            $this->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope'] ?? null);
        }

        $customer->save();

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function updateCustomer(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_code' => ['sometimes', 'required', 'string', 'max:100'],
            'customer_name' => ['sometimes', 'required', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('customers', 'uuid')) {
            $rules['uuid'][] = Rule::unique('customers', 'uuid')->ignore($customer->id);
        }
        if ($this->hasColumn('customers', 'customer_code')) {
            $rules['customer_code'][] = Rule::unique('customers', 'customer_code')->ignore($customer->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('uuid', $validated)) {
            $this->setAttributeIfColumn($customer, 'customers', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('customer_code', $validated)) {
            $this->setAttributeIfColumn($customer, 'customers', 'customer_code', $validated['customer_code']);
        }
        if (array_key_exists('customer_name', $validated)) {
            $this->setAttributeByColumns($customer, 'customers', ['customer_name', 'company_name'], $validated['customer_name']);
        }
        if (array_key_exists('tax_code', $validated)) {
            $this->setAttributeIfColumn($customer, 'customers', 'tax_code', $validated['tax_code']);
        }
        if (array_key_exists('address', $validated)) {
            $this->setAttributeIfColumn($customer, 'customers', 'address', $validated['address']);
        }
        if ($this->hasColumn('customers', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($customer, 'customers', 'data_scope', $validated['data_scope']);
        }

        $customer->save();

        return response()->json(['data' => $this->serializeCustomer($customer)]);
    }

    public function deleteCustomer(int $id): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);

        return $this->deleteModel($customer, 'Customer');
    }

    public function storeVendor(Request $request): JsonResponse
    {
        if (! $this->hasTable('vendors')) {
            return $this->missingTable('vendors');
        }

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'vendor_code' => ['required', 'string', 'max:100'],
            'vendor_name' => ['required', 'string', 'max:255'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('vendors', 'uuid')) {
            $rules['uuid'][] = Rule::unique('vendors', 'uuid');
        }
        if ($this->hasColumn('vendors', 'vendor_code')) {
            $rules['vendor_code'][] = Rule::unique('vendors', 'vendor_code');
        }

        $validated = $request->validate($rules);

        $vendor = new Vendor();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $this->setAttributeIfColumn($vendor, 'vendors', 'uuid', $uuid);
        $this->setAttributeIfColumn($vendor, 'vendors', 'vendor_code', $validated['vendor_code']);
        $this->setAttributeIfColumn($vendor, 'vendors', 'vendor_name', $validated['vendor_name']);

        if ($this->hasColumn('vendors', 'data_scope')) {
            $this->setAttributeIfColumn($vendor, 'vendors', 'data_scope', $validated['data_scope'] ?? null);
        }

        $vendor->save();

        return response()->json(['data' => $this->serializeVendor($vendor)], 201);
    }

    public function updateVendor(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('vendors')) {
            return $this->missingTable('vendors');
        }

        $vendor = Vendor::query()->findOrFail($id);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'vendor_code' => ['sometimes', 'required', 'string', 'max:100'],
            'vendor_name' => ['sometimes', 'required', 'string', 'max:255'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('vendors', 'uuid')) {
            $rules['uuid'][] = Rule::unique('vendors', 'uuid')->ignore($vendor->id);
        }
        if ($this->hasColumn('vendors', 'vendor_code')) {
            $rules['vendor_code'][] = Rule::unique('vendors', 'vendor_code')->ignore($vendor->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('uuid', $validated)) {
            $this->setAttributeIfColumn($vendor, 'vendors', 'uuid', $validated['uuid']);
        }
        if (array_key_exists('vendor_code', $validated)) {
            $this->setAttributeIfColumn($vendor, 'vendors', 'vendor_code', $validated['vendor_code']);
        }
        if (array_key_exists('vendor_name', $validated)) {
            $this->setAttributeIfColumn($vendor, 'vendors', 'vendor_name', $validated['vendor_name']);
        }
        if ($this->hasColumn('vendors', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($vendor, 'vendors', 'data_scope', $validated['data_scope']);
        }

        $vendor->save();

        return response()->json(['data' => $this->serializeVendor($vendor)]);
    }

    public function deleteVendor(int $id): JsonResponse
    {
        if (! $this->hasTable('vendors')) {
            return $this->missingTable('vendors');
        }

        $vendor = Vendor::query()->findOrFail($id);

        return $this->deleteModel($vendor, 'Vendor');
    }

    public function storeProject(Request $request): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $rules = [
            'project_code' => ['required', 'string', 'max:100'],
            'project_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(self::PROJECT_STATUSES)],
            'opportunity_id' => ['nullable', 'integer'],
            'investment_mode' => ['nullable', 'string', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date'],
            'actual_end_date' => ['nullable', 'date'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code');
        }

        $validated = $request->validate($rules);

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $opportunityId = $this->parseNullableInt($validated['opportunity_id'] ?? null);
        if ($opportunityId !== null && $this->hasTable('opportunities') && ! Opportunity::query()->whereKey($opportunityId)->exists()) {
            return response()->json(['message' => 'opportunity_id is invalid.'], 422);
        }

        $project = new Project();
        $this->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
        $this->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
        $this->setAttributeIfColumn($project, 'projects', 'customer_id', $customerId);
        $this->setAttributeIfColumn($project, 'projects', 'status', $this->toProjectStorageStatus((string) ($validated['status'] ?? 'PLANNING')));
        $this->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
        $this->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode'] ?? 'DAU_TU');

        if ($this->hasColumn('projects', 'start_date')) {
            $this->setAttributeIfColumn($project, 'projects', 'start_date', $validated['start_date'] ?? now()->toDateString());
        }

        if (array_key_exists('expected_end_date', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'expected_end_date', $validated['expected_end_date']);
        }
        if (array_key_exists('actual_end_date', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'actual_end_date', $validated['actual_end_date']);
        }

        if ($this->hasColumn('projects', 'data_scope')) {
            $this->setAttributeIfColumn($project, 'projects', 'data_scope', $validated['data_scope'] ?? null);
        }

        $project->save();

        return response()->json([
            'data' => $this->serializeProject(
                $project->fresh()->load(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ], 201);
    }

    public function updateProject(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);

        $rules = [
            'project_code' => ['sometimes', 'required', 'string', 'max:100'],
            'project_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::in(self::PROJECT_STATUSES)],
            'opportunity_id' => ['sometimes', 'nullable', 'integer'],
            'investment_mode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'expected_end_date' => ['sometimes', 'nullable', 'date'],
            'actual_end_date' => ['sometimes', 'nullable', 'date'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('projects', 'project_code')) {
            $rules['project_code'][] = Rule::unique('projects', 'project_code')->ignore($project->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->parseNullableInt($validated['customer_id']);
            if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->setAttributeIfColumn($project, 'projects', 'customer_id', $customerId);
        }

        if (array_key_exists('opportunity_id', $validated)) {
            $opportunityId = $this->parseNullableInt($validated['opportunity_id']);
            if ($opportunityId !== null && $this->hasTable('opportunities') && ! Opportunity::query()->whereKey($opportunityId)->exists()) {
                return response()->json(['message' => 'opportunity_id is invalid.'], 422);
            }
            $this->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
        }

        if (array_key_exists('project_code', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
        }
        if (array_key_exists('project_name', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
        }
        if (array_key_exists('status', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'status', $this->toProjectStorageStatus((string) $validated['status']));
        }
        if (array_key_exists('investment_mode', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode']);
        }
        if (array_key_exists('start_date', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'start_date', $validated['start_date']);
        }
        if (array_key_exists('expected_end_date', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'expected_end_date', $validated['expected_end_date']);
        }
        if (array_key_exists('actual_end_date', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'actual_end_date', $validated['actual_end_date']);
        }
        if ($this->hasColumn('projects', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($project, 'projects', 'data_scope', $validated['data_scope']);
        }

        $project->save();

        return response()->json([
            'data' => $this->serializeProject(
                $project->fresh()->load(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ]);
    }

    public function deleteProject(int $id): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);

        return $this->deleteModel($project, 'Project');
    }

    public function storeContract(Request $request): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $rules = [
            'contract_code' => ['required', 'string', 'max:100'],
            'contract_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code');
        }
        if ($this->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number');
        }

        $validated = $request->validate($rules);

        $projectId = $this->parseNullableInt($validated['project_id'] ?? null);
        if ($projectId !== null && ! Project::query()->whereKey($projectId)->exists()) {
            return response()->json(['message' => 'project_id is invalid.'], 422);
        }

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        if ($this->usesLegacyContractSchema() && $projectId === null) {
            return response()->json(['message' => 'project_id is required by this schema.'], 422);
        }

        $contract = new Contract();
        $this->setAttributeByColumns($contract, 'contracts', ['contract_code', 'contract_number'], $validated['contract_code']);
        $this->setAttributeIfColumn($contract, 'contracts', 'contract_name', $validated['contract_name']);
        $this->setAttributeIfColumn($contract, 'contracts', 'customer_id', $customerId);
        $this->setAttributeIfColumn($contract, 'contracts', 'project_id', $projectId);
        $this->setAttributeByColumns($contract, 'contracts', ['value', 'total_value'], $validated['value'] ?? 0);
        $this->setAttributeIfColumn(
            $contract,
            'contracts',
            'payment_cycle',
            $this->normalizePaymentCycle((string) ($validated['payment_cycle'] ?? 'ONCE'))
        );
        $this->setAttributeIfColumn($contract, 'contracts', 'status', $this->toContractStorageStatus((string) ($validated['status'] ?? 'DRAFT')));

        if ($this->hasColumn('contracts', 'sign_date')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'sign_date', $validated['sign_date'] ?? now()->toDateString());
        }
        if ($this->hasColumn('contracts', 'expiry_date')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $validated['expiry_date'] ?? null);
        }
        if ($this->hasColumn('contracts', 'data_scope')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope'] ?? null);
        }

        $contract->save();

        return response()->json([
            'data' => $this->serializeContract(
                $contract->fresh()->load([
                    'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
                    'project' => fn ($query) => $query->select($this->projectRelationColumns()),
                ])
            ),
        ], 201);
    }

    public function updateContract(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $contract = Contract::query()->findOrFail($id);

        $rules = [
            'contract_code' => ['sometimes', 'required', 'string', 'max:100'],
            'contract_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'value' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['sometimes', 'nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['sometimes', 'nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contract->id);
        }
        if ($this->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contract->id);
        }

        $validated = $request->validate($rules);

        if (array_key_exists('project_id', $validated)) {
            $projectId = $this->parseNullableInt($validated['project_id']);
            if ($projectId !== null && ! Project::query()->whereKey($projectId)->exists()) {
                return response()->json(['message' => 'project_id is invalid.'], 422);
            }
            if ($this->usesLegacyContractSchema() && $projectId === null) {
                return response()->json(['message' => 'project_id is required by this schema.'], 422);
            }
            $this->setAttributeIfColumn($contract, 'contracts', 'project_id', $projectId);
        }

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->setAttributeIfColumn($contract, 'contracts', 'customer_id', $customerId);
        }

        if (array_key_exists('contract_code', $validated)) {
            $this->setAttributeByColumns($contract, 'contracts', ['contract_code', 'contract_number'], $validated['contract_code']);
        }
        if (array_key_exists('contract_name', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'contract_name', $validated['contract_name']);
        }
        if (array_key_exists('value', $validated)) {
            $this->setAttributeByColumns($contract, 'contracts', ['value', 'total_value'], $validated['value'] ?? 0);
        }
        if (array_key_exists('payment_cycle', $validated)) {
            $this->setAttributeIfColumn(
                $contract,
                'contracts',
                'payment_cycle',
                $this->normalizePaymentCycle((string) ($validated['payment_cycle'] ?? 'ONCE'))
            );
        }
        if (array_key_exists('status', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'status', $this->toContractStorageStatus((string) $validated['status']));
        }
        if (array_key_exists('sign_date', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'sign_date', $validated['sign_date']);
        }
        if (array_key_exists('expiry_date', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $validated['expiry_date']);
        }
        if ($this->hasColumn('contracts', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope']);
        }

        $contract->save();

        return response()->json([
            'data' => $this->serializeContract(
                $contract->fresh()->load([
                    'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
                    'project' => fn ($query) => $query->select($this->projectRelationColumns()),
                ])
            ),
        ]);
    }

    public function deleteContract(int $id): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $contract = Contract::query()->findOrFail($id);

        return $this->deleteModel($contract, 'Contract');
    }

    public function paymentSchedules(Request $request): JsonResponse
    {
        if (! $this->hasTable('payment_schedules')) {
            return $this->missingTable('payment_schedules');
        }

        $query = DB::table('payment_schedules')
            ->select($this->selectColumns('payment_schedules', [
                'id',
                'contract_id',
                'project_id',
                'milestone_name',
                'cycle_number',
                'expected_date',
                'expected_amount',
                'actual_paid_date',
                'actual_paid_amount',
                'status',
                'notes',
                'created_at',
                'updated_at',
            ]));

        $contractId = $this->parseNullableInt($request->query('contract_id'));
        if ($contractId !== null) {
            $query->where('contract_id', $contractId);
        }

        $rows = $query
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => $this->serializePaymentScheduleRecord((array) $record))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function updatePaymentSchedule(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('payment_schedules')) {
            return $this->missingTable('payment_schedules');
        }

        $schedule = DB::table('payment_schedules')->where('id', $id)->first();
        if ($schedule === null) {
            return response()->json(['message' => 'Payment schedule not found.'], 404);
        }

        $validated = $request->validate([
            'actual_paid_date' => ['sometimes', 'nullable', 'date'],
            'actual_paid_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'required', Rule::in(self::PAYMENT_SCHEDULE_STATUSES)],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        $current = (array) $schedule;
        $updates = [];

        if (array_key_exists('actual_paid_date', $validated)) {
            $updates['actual_paid_date'] = $validated['actual_paid_date'];
        }
        if (array_key_exists('actual_paid_amount', $validated)) {
            $updates['actual_paid_amount'] = $validated['actual_paid_amount'] ?? 0;
        }
        if (array_key_exists('status', $validated)) {
            $updates['status'] = strtoupper((string) $validated['status']);
        }
        if (array_key_exists('notes', $validated)) {
            $updates['notes'] = $validated['notes'];
        }

        if (($updates['status'] ?? '') === 'PAID') {
            if (! array_key_exists('actual_paid_date', $updates) || $updates['actual_paid_date'] === null) {
                $updates['actual_paid_date'] = now()->toDateString();
            }

            if (
                ! array_key_exists('actual_paid_amount', $updates) ||
                (float) ($updates['actual_paid_amount'] ?? 0) <= 0
            ) {
                $updates['actual_paid_amount'] = (float) ($current['expected_amount'] ?? 0);
            }
        }

        if ($updates === []) {
            return response()->json(['data' => $this->serializePaymentScheduleRecord($current)]);
        }

        $updates['updated_at'] = now();
        DB::table('payment_schedules')->where('id', $id)->update($updates);

        $fresh = DB::table('payment_schedules')->where('id', $id)->first();
        if ($fresh === null) {
            return response()->json(['message' => 'Payment schedule not found after update.'], 404);
        }

        return response()->json(['data' => $this->serializePaymentScheduleRecord((array) $fresh)]);
    }

    public function generateContractPayments(int $id): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        if (! $this->hasTable('payment_schedules')) {
            return $this->missingTable('payment_schedules');
        }

        $contract = Contract::query()->findOrFail($id);

        try {
            DB::statement('CALL sp_generate_contract_payments(?)', [$contract->id]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Không thể thực thi sp_generate_contract_payments. Vui lòng kiểm tra Procedure trên DB.',
                'error' => $exception->getMessage(),
            ], 422);
        }

        $rows = DB::table('payment_schedules')
            ->select($this->selectColumns('payment_schedules', [
                'id',
                'contract_id',
                'project_id',
                'milestone_name',
                'cycle_number',
                'expected_date',
                'expected_amount',
                'actual_paid_date',
                'actual_paid_amount',
                'status',
                'notes',
                'created_at',
                'updated_at',
            ]))
            ->where('contract_id', $contract->id)
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => $this->serializePaymentScheduleRecord((array) $record))
            ->values();

        return response()->json([
            'message' => 'Đã sinh kỳ thanh toán từ thủ tục sp_generate_contract_payments.',
            'data' => $rows,
        ]);
    }

    public function storeOpportunity(Request $request): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $rules = [
            'opp_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['required', 'integer'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'stage' => ['nullable', Rule::in(self::OPPORTUNITY_STAGES)],
            'owner_id' => ['nullable', 'integer'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        $validated = $request->validate($rules);

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $opportunity = new Opportunity();
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        $this->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->toOpportunityStorageStage((string) ($validated['stage'] ?? 'NEW')));

        if ($this->hasColumn('opportunities', 'owner_id')) {
            $requestedOwnerId = $this->parseNullableInt($validated['owner_id'] ?? null);
            $ownerId = $requestedOwnerId ?? $this->resolveDefaultOwnerId();

            if ($ownerId === null) {
                return response()->json(['message' => 'owner_id is required. Seed internal_users before creating opportunities.'], 422);
            }

            if (! $this->ownerExists($ownerId)) {
                $message = $requestedOwnerId !== null
                    ? 'owner_id is invalid.'
                    : 'owner_id is required. Seed internal_users before creating opportunities.';

                return response()->json(['message' => $message], 422);
            }

            $this->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);
        }

        if ($this->hasColumn('opportunities', 'data_scope')) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope'] ?? null);
        }

        $opportunity->save();

        return response()->json([
            'data' => $this->serializeOpportunity(
                $opportunity->fresh()->load(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ], 201);
    }

    public function updateOpportunity(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);

        $rules = [
            'opp_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'stage' => ['sometimes', 'nullable', Rule::in(self::OPPORTUNITY_STAGES)],
            'owner_id' => ['sometimes', 'nullable', 'integer'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        $validated = $request->validate($rules);

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        }

        if (array_key_exists('opp_name', $validated)) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        }
        if (array_key_exists('amount', $validated)) {
            $this->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        }
        if (array_key_exists('stage', $validated)) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->toOpportunityStorageStage((string) $validated['stage']));
        }
        if (array_key_exists('owner_id', $validated) && $this->hasColumn('opportunities', 'owner_id')) {
            $ownerId = $this->parseNullableInt($validated['owner_id']);
            if ($ownerId === null || ! $this->ownerExists($ownerId)) {
                return response()->json(['message' => 'owner_id is invalid.'], 422);
            }

            $this->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);
        }
        if ($this->hasColumn('opportunities', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope']);
        }

        $opportunity->save();

        return response()->json([
            'data' => $this->serializeOpportunity(
                $opportunity->fresh()->load(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ]);
    }

    public function deleteOpportunity(int $id): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);

        return $this->deleteModel($opportunity, 'Opportunity');
    }

    public function tableHealth(): JsonResponse
    {
        $tables = [
            'departments',
            'internal_users',
            'business_domains',
            'products',
            'customers',
            'customer_personnel',
            'vendors',
            'projects',
            'contracts',
            'payment_schedules',
            'opportunities',
            'documents',
            'reminders',
            'user_dept_history',
            'audit_logs',
        ];

        $status = [];
        foreach ($tables as $table) {
            $status[$table] = $this->hasTable($table);
        }
        $connectionName = (string) config('database.default');
        $databaseName = null;
        try {
            $databaseName = DB::connection()->getDatabaseName();
        } catch (\Throwable) {
            $databaseName = null;
        }

        return response()->json([
            'data' => $status,
            'meta' => [
                'connection' => $connectionName,
                'database' => $databaseName,
                'employee_source' => $this->resolveEmployeeTable(),
            ],
        ]);
    }

    private function formatDateColumn(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $text, $matches) === 1) {
            return $matches[0];
        }

        return $text;
    }

    private function selectColumns(string $table, array $columns): array
    {
        return array_values(array_filter(
            $columns,
            fn (string $column): bool => $this->hasColumn($table, $column)
        ));
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        try {
            return Schema::hasColumn($table, $column);
        } catch (\Throwable) {
            return false;
        }
    }

    private function resolveEmployeeTable(): ?string
    {
        if ($this->hasTable('internal_users')) {
            return 'internal_users';
        }

        return null;
    }

    /**
     * @return class-string<Model>
     */
    private function resolveEmployeeModelClass(): string
    {
        return InternalUser::class;
    }

    private function setAttributeIfColumn(Model $model, string $table, string $column, mixed $value): void
    {
        if ($this->hasColumn($table, $column)) {
            $model->setAttribute($column, $value);
        }
    }

    private function setAttributeByColumns(Model $model, string $table, array $columns, mixed $value): void
    {
        foreach ($columns as $column) {
            if ($this->hasColumn($table, $column)) {
                $model->setAttribute($column, $value);

                return;
            }
        }
    }

    private function deleteModel(Model $model, string $resource): JsonResponse
    {
        try {
            $model->delete();

            return response()->json(['message' => "{$resource} deleted."]);
        } catch (QueryException) {
            return response()->json([
                'message' => "{$resource} is referenced by other records and cannot be deleted.",
            ], 422);
        }
    }

    private function parseNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function firstNonEmpty(array $data, array $keys, mixed $default = null): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
                return $data[$key];
            }
        }

        return $default;
    }

    private function decodeJsonColumnIfNeeded(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return $value;
        }

        $decoded = json_decode($value, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $value;
        }

        return $decoded;
    }

    private function resolveAuditActorMap(array $actorIds): array
    {
        if ($actorIds === []) {
            return [];
        }

        $actorTable = null;
        foreach (['internal_users', 'users'] as $table) {
            if ($this->hasTable($table)) {
                $actorTable = $table;
                break;
            }
        }

        if ($actorTable === null) {
            return [];
        }

        $columns = $this->selectColumns($actorTable, ['id', 'full_name', 'username', 'name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table($actorTable)
            ->select($columns)
            ->whereIn('id', $actorIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => $data['id'] ?? null,
                    'full_name' => $this->firstNonEmpty($data, ['full_name', 'name']),
                    'username' => $this->firstNonEmpty($data, ['username']),
                ];
            })
            ->filter(fn (array $record): bool => array_key_exists('id', $record) && $record['id'] !== null)
            ->keyBy(fn (array $record): string => (string) $record['id'])
            ->all();
    }

    private function resolveTransferUserMap(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $resolved = [];

        foreach (['internal_users', 'users'] as $userTable) {
            if (! $this->hasTable($userTable)) {
                continue;
            }

            $columns = $this->selectColumns($userTable, ['id', 'user_code', 'full_name', 'username', 'name']);
            if (! in_array('id', $columns, true)) {
                continue;
            }

            $rows = DB::table($userTable)
                ->select($columns)
                ->whereIn('id', $userIds)
                ->get()
                ->map(function (object $record): array {
                    $data = (array) $record;

                    return [
                        'id' => (string) ($data['id'] ?? ''),
                        'user_code' => (string) $this->firstNonEmpty($data, ['user_code', 'username', 'id'], ''),
                        'full_name' => (string) $this->firstNonEmpty($data, ['full_name', 'name'], ''),
                        'username' => (string) $this->firstNonEmpty($data, ['username'], ''),
                    ];
                })
                ->filter(fn (array $record): bool => $record['id'] !== '')
                ->keyBy('id')
                ->all();

            foreach ($rows as $id => $payload) {
                if (! array_key_exists($id, $resolved)) {
                    $resolved[$id] = $payload;
                }
            }
        }

        return $resolved;
    }

    private function resolveTransferDepartmentMap(array $deptIds): array
    {
        if ($deptIds === [] || ! $this->hasTable('departments')) {
            return [];
        }

        $columns = $this->selectColumns('departments', ['id', 'dept_code', 'dept_name']);
        if (! in_array('id', $columns, true)) {
            return [];
        }

        return DB::table('departments')
            ->select($columns)
            ->whereIn('id', $deptIds)
            ->get()
            ->map(function (object $record): array {
                $data = (array) $record;

                return [
                    'id' => (string) ($data['id'] ?? ''),
                    'dept_code' => (string) ($data['dept_code'] ?? ''),
                    'dept_name' => (string) ($data['dept_name'] ?? ''),
                ];
            })
            ->filter(fn (array $record): bool => $record['id'] !== '')
            ->keyBy('id')
            ->all();
    }

    private function missingTable(string $table): JsonResponse
    {
        return response()->json([
            'message' => "Table {$table} is not available. Run enterprise v5 migrations first.",
            'data' => [],
        ], 503);
    }

    private function buildDeptPath(Department $department): string
    {
        if (! $department->parent_id) {
            return $department->id.'/';
        }

        $parent = Department::query()->find($department->parent_id);
        $parentPath = $parent?->dept_path ?: ($department->parent_id.'/');

        return rtrim($parentPath, '/').'/'.$department->id.'/';
    }

    private function serializeDepartment(Department $department): array
    {
        $department->loadMissing(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())]);
        $data = $department->toArray();

        if (! array_key_exists('is_active', $data)) {
            $status = strtoupper((string) ($data['status'] ?? 'ACTIVE'));
            $data['is_active'] = $status === 'ACTIVE';
        } else {
            $data['is_active'] = (bool) $data['is_active'];
        }

        if (! array_key_exists('dept_path', $data) || empty($data['dept_path'])) {
            $data['dept_path'] = $this->buildDeptPath($department);
        }

        return $data;
    }

    private function serializeEmployee(Model $employee): array
    {
        $relations = [
            'department' => fn ($query) => $query->select($this->departmentRelationColumns()),
        ];
        if ($this->hasTable('positions')) {
            $relations['position'] = fn ($query) => $query->select($this->positionRelationColumns());
        }
        $employee->loadMissing($relations);

        $data = $employee->toArray();

        $data['username'] = (string) $this->firstNonEmpty($data, ['username', 'user_code'], '');
        $data['user_code'] = (string) $this->firstNonEmpty($data, ['user_code', 'username'], '');
        $data['employee_code'] = $this->normalizeEmployeeCode($data['user_code'], $data['id'] ?? null);
        $data['full_name'] = (string) $this->firstNonEmpty($data, ['full_name'], '');
        $data['department_id'] = $this->firstNonEmpty($data, ['department_id', 'dept_id']);
        $data['position_id'] = $this->firstNonEmpty($data, ['position_id']);
        $data['status'] = $this->fromEmployeeStorageStatus((string) ($data['status'] ?? 'ACTIVE'));
        $positionCode = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_code'] ?? '')
            : '';
        $positionName = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_name'] ?? '')
            : '';

        if ($positionCode === '') {
            $fallbackCode = strtoupper((string) ($this->firstNonEmpty($data, ['position_code']) ?? ''));
            if ($fallbackCode !== '') {
                $positionCode = $fallbackCode;
            }
        }

        if ($positionName === '') {
            $positionName = $this->resolvePositionDisplayName(
                $positionCode !== '' ? $positionCode : ($data['position_id'] ?? null)
            );
        }

        if ($positionName === '') {
            $positionName = $this->resolvePositionDisplayName((string) ($data['job_title_raw'] ?? ''));
        }

        $data['position_code'] = $positionCode !== '' ? $positionCode : null;
        $data['position_name'] = $positionName !== '' ? $positionName : null;

        $jobTitleVi = $this->localizeJobTitle((string) ($data['job_title_vi'] ?? $data['job_title_raw'] ?? ''));
        if ($jobTitleVi === '' && $positionName !== '') {
            $jobTitleVi = $positionName;
        }
        $data['job_title_vi'] = $jobTitleVi !== '' ? $jobTitleVi : null;

        return $data;
    }

    private function serializeCustomer(Customer $customer): array
    {
        $data = $customer->toArray();

        $data['customer_name'] = (string) $this->firstNonEmpty($data, ['customer_name', 'company_name'], '');

        return $data;
    }

    private function serializeVendor(Vendor $vendor): array
    {
        return $vendor->toArray();
    }

    private function serializeProject(Project $project): array
    {
        $project->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())]);
        $data = $project->toArray();

        $data['status'] = $this->fromProjectStorageStatus((string) ($data['status'] ?? 'PLANNING'));

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    private function serializeContract(Contract $contract): array
    {
        $contract->loadMissing([
            'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
            'project' => fn ($query) => $query->select($this->projectRelationColumns()),
        ]);

        $data = $contract->toArray();

        $data['contract_code'] = (string) $this->firstNonEmpty($data, ['contract_code', 'contract_number'], '');
        $data['value'] = (float) $this->firstNonEmpty($data, ['value', 'total_value'], 0);
        $data['payment_cycle'] = $this->normalizePaymentCycle((string) $this->firstNonEmpty($data, ['payment_cycle'], 'ONCE'));
        $data['status'] = $this->fromContractStorageStatus((string) ($data['status'] ?? 'DRAFT'));

        if ($this->firstNonEmpty($data, ['customer_id']) === null && isset($data['project']['customer_id'])) {
            $data['customer_id'] = $data['project']['customer_id'];
        }

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    private function serializePaymentScheduleRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'contract_id' => $record['contract_id'] ?? null,
            'project_id' => $record['project_id'] ?? null,
            'milestone_name' => (string) ($record['milestone_name'] ?? ''),
            'cycle_number' => (int) ($record['cycle_number'] ?? 1),
            'expected_date' => (string) ($record['expected_date'] ?? ''),
            'expected_amount' => (float) ($record['expected_amount'] ?? 0),
            'actual_paid_date' => $record['actual_paid_date'] ?? null,
            'actual_paid_amount' => (float) ($record['actual_paid_amount'] ?? 0),
            'status' => strtoupper((string) ($record['status'] ?? 'PENDING')),
            'notes' => $record['notes'] ?? null,
            'created_at' => $record['created_at'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
        ];
    }

    private function serializeOpportunity(Opportunity $opportunity): array
    {
        $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())]);
        $data = $opportunity->toArray();

        $data['amount'] = (float) $this->firstNonEmpty($data, ['amount', 'expected_value'], 0);
        $data['stage'] = $this->fromOpportunityStorageStage((string) ($data['stage'] ?? 'NEW'));

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    private function usesLegacyProjectSchema(): bool
    {
        return $this->hasColumn('projects', 'start_date') && ! $this->hasColumn('projects', 'data_scope');
    }

    private function usesLegacyContractSchema(): bool
    {
        return $this->hasColumn('contracts', 'contract_number') || $this->hasColumn('contracts', 'total_value');
    }

    private function usesLegacyOpportunitySchema(): bool
    {
        return $this->hasColumn('opportunities', 'expected_value') || $this->hasColumn('opportunities', 'owner_id');
    }

    private function toEmployeeStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'ACTIVE' => 'ACTIVE',
            'INACTIVE', 'BANNED' => 'INACTIVE',
            'SUSPENDED', 'TRANSFERRED' => 'SUSPENDED',
            default => 'ACTIVE',
        };
    }

    private function fromEmployeeStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'ACTIVE' => 'ACTIVE',
            'INACTIVE', 'BANNED' => 'INACTIVE',
            'SUSPENDED', 'TRANSFERRED' => 'SUSPENDED',
            default => 'ACTIVE',
        };
    }

    private function toProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        if ($this->usesLegacyProjectSchema()) {
            return match ($normalized) {
                'PLANNING', 'ONGOING' => 'ACTIVE',
                'COMPLETED' => 'COMPLETED',
                'CANCELLED' => 'TERMINATED',
                default => 'ACTIVE',
            };
        }

        return in_array($normalized, self::PROJECT_STATUSES, true) ? $normalized : 'PLANNING';
    }

    private function fromProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'PLANNING' => 'PLANNING',
            'ONGOING', 'ACTIVE' => 'ONGOING',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED', 'TERMINATED', 'SUSPENDED', 'EXPIRED' => 'CANCELLED',
            default => 'PLANNING',
        };
    }

    private function normalizePaymentCycle(string $cycle): string
    {
        $normalized = strtoupper(trim($cycle));
        return in_array($normalized, self::PAYMENT_CYCLES, true) ? $normalized : 'ONCE';
    }

    private function toContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        if ($this->usesLegacyContractSchema()) {
            return match ($normalized) {
                'DRAFT', 'PENDING' => 'DRAFT',
                'SIGNED' => 'SIGNED',
                'LIQUIDATED' => 'TERMINATED',
                default => 'DRAFT',
            };
        }

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
    }

    private function fromContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'DRAFT' => 'DRAFT',
            'PENDING' => 'PENDING',
            'SIGNED' => 'SIGNED',
            'EXPIRED', 'TERMINATED', 'LIQUIDATED' => 'LIQUIDATED',
            default => 'DRAFT',
        };
    }

    private function toOpportunityStorageStage(string $stage): string
    {
        $normalized = strtoupper($stage);

        if ($this->usesLegacyOpportunitySchema()) {
            return match ($normalized) {
                'NEW' => 'LEAD',
                'PROPOSAL' => 'PROPOSAL',
                'NEGOTIATION' => 'NEGOTIATION',
                'WON' => 'CLOSED_WON',
                'LOST' => 'CLOSED_LOST',
                default => 'LEAD',
            };
        }

        return in_array($normalized, self::OPPORTUNITY_STAGES, true) ? $normalized : 'NEW';
    }

    private function fromOpportunityStorageStage(string $stage): string
    {
        $normalized = strtoupper($stage);

        return match ($normalized) {
            'LEAD', 'QUALIFIED', 'NEW' => 'NEW',
            'PROPOSAL' => 'PROPOSAL',
            'NEGOTIATION' => 'NEGOTIATION',
            'CLOSED_WON', 'WON' => 'WON',
            'CLOSED_LOST', 'LOST' => 'LOST',
            default => 'NEW',
        };
    }

    private function resolveDefaultOwnerId(): ?int
    {
        if ($this->hasTable('internal_users')) {
            $internalId = DB::table('internal_users')->orderBy('id')->value('id');
            if ($internalId !== null) {
                return (int) $internalId;
            }
        }

        if ($this->hasTable('users')) {
            $userId = DB::table('users')->orderBy('id')->value('id');
            if ($userId !== null) {
                return (int) $userId;
            }
        }

        return null;
    }

    private function ownerExists(int $ownerId): bool
    {
        if ($this->hasTable('internal_users')) {
            return DB::table('internal_users')->where('id', $ownerId)->exists();
        }

        if ($this->hasTable('users')) {
            return DB::table('users')->where('id', $ownerId)->exists();
        }

        return false;
    }

    private function departmentRelationColumns(): array
    {
        return $this->selectColumns('departments', ['id', 'dept_code', 'dept_name']);
    }

    private function positionRelationColumns(): array
    {
        return $this->selectColumns('positions', ['id', 'pos_code', 'pos_name']);
    }

    private function resolvePositionDisplayName(mixed $value): string
    {
        $raw = strtoupper(trim((string) $value));
        if ($raw === '') {
            return '';
        }

        $dictionary = [
            '1' => 'Giám đốc',
            '2' => 'Phó giám đốc',
            '3' => 'Trưởng phòng',
            '4' => 'Phó phòng',
            '5' => 'Chuyên viên',
            'P001' => 'Giám đốc',
            'P002' => 'Phó giám đốc',
            'P003' => 'Trưởng phòng',
            'P004' => 'Phó phòng',
            'P005' => 'Chuyên viên',
            'POS001' => 'Giám đốc',
            'POS002' => 'Phó giám đốc',
            'POS003' => 'Trưởng phòng',
            'POS004' => 'Phó phòng',
            'POS005' => 'Chuyên viên',
        ];

        if (array_key_exists($raw, $dictionary)) {
            return $dictionary[$raw];
        }

        if (preg_match('/^\d+$/', $raw) === 1) {
            $normalizedNumber = (string) ((int) $raw);
            if (array_key_exists($normalizedNumber, $dictionary)) {
                return $dictionary[$normalizedNumber];
            }
        }

        if (preg_match('/^(POS|P)(\d+)$/', $raw, $matches) === 1) {
            $normalizedCode = 'POS'.str_pad($matches[2], 3, '0', STR_PAD_LEFT);
            if (array_key_exists($normalizedCode, $dictionary)) {
                return $dictionary[$normalizedCode];
            }
        }

        return '';
    }

    private function localizeJobTitle(string $jobTitleRaw): string
    {
        $normalized = trim($jobTitleRaw);
        if ($normalized === '') {
            return '';
        }

        $positionName = $this->resolvePositionDisplayName($normalized);
        if ($positionName !== '') {
            return $positionName;
        }

        $lower = strtolower($normalized);

        $dictionary = [
            'system administrator' => 'Quản trị hệ thống',
            'sales executive' => 'Chuyên viên kinh doanh',
            'automation operator' => 'Vận hành tự động hóa',
            'director' => 'Giám đốc',
            'deputy director' => 'Phó giám đốc',
            'manager' => 'Trưởng phòng',
            'assistant manager' => 'Phó phòng',
            'specialist' => 'Chuyên viên',
            'engineer' => 'Kỹ sư',
            'developer' => 'Lập trình viên',
            'operator' => 'Nhân viên vận hành',
            'business analyst' => 'Chuyên viên phân tích nghiệp vụ',
            'giam doc' => 'Giám đốc',
            'pho giam doc' => 'Phó giám đốc',
            'truong phong' => 'Trưởng phòng',
            'pho phong' => 'Phó phòng',
            'chuyen vien' => 'Chuyên viên',
        ];

        return $dictionary[$lower] ?? $normalized;
    }

    private function normalizeEmployeeCode(string $rawCode, mixed $id): string
    {
        $code = strtoupper(trim($rawCode));
        if ($code !== '' && preg_match('/^(VNPT|CTV)\d{5,}$/', $code) === 1) {
            return $code;
        }

        if (preg_match('/^NV(\d+)$/', $code, $matches) === 1) {
            return 'VNPT'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        if (preg_match('/^CTV(\d+)$/', $code, $matches) === 1) {
            return 'CTV'.str_pad((string) $matches[1], 6, '0', STR_PAD_LEFT);
        }

        $idDigits = preg_replace('/\D+/', '', (string) $id);
        if ($idDigits !== '') {
            return 'VNPT'.str_pad($idDigits, 6, '0', STR_PAD_LEFT);
        }

        return $code !== '' ? $code : 'VNPT000000';
    }

    private function customerRelationColumns(): array
    {
        return $this->selectColumns('customers', ['id', 'customer_code', 'customer_name', 'company_name']);
    }

    private function projectRelationColumns(): array
    {
        return $this->selectColumns('projects', ['id', 'project_code', 'project_name', 'customer_id']);
    }
}
