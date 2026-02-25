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
use App\Support\Auth\UserAccessService;
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

    private const SUPPORT_REQUEST_STATUSES = ['OPEN', 'HOTFIXING', 'RESOLVED', 'DEPLOYED', 'PENDING', 'CANCELLED'];

    private const SUPPORT_REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    private const USER_DEPT_SCOPE_TYPES = ['SELF_ONLY', 'DEPT_ONLY', 'DEPT_AND_CHILDREN', 'ALL'];

    private const ROOT_DEPARTMENT_CODE = 'BGĐVT';

    public function departments(Request $request): JsonResponse
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

        $authenticatedUser = $request->user();
        if ($authenticatedUser instanceof InternalUser) {
            $allowedDeptIds = app(UserAccessService::class)->resolveDepartmentIdsForUser((int) $authenticatedUser->id);
            if ($allowedDeptIds !== null) {
                $allowedMap = array_fill_keys(array_map('strval', $allowedDeptIds), true);
                $rows = $rows
                    ->filter(fn (array $row): bool => isset($allowedMap[(string) ($row['id'] ?? '')]))
                    ->values();
            }
        }

        return response()->json(['data' => $rows]);
    }

    public function employees(Request $request): JsonResponse
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

        $authenticatedUser = $request->user();
        if ($authenticatedUser instanceof InternalUser) {
            $visibility = app(UserAccessService::class)->resolveEmployeeVisibility((int) $authenticatedUser->id);
            if (! $visibility['all']) {
                $query->where(function ($builder) use ($visibility, $employeeTable, $authenticatedUser): void {
                    $hasAnyScope = false;

                    if ($visibility['self_only']) {
                        $builder->where("{$employeeTable}.id", (int) $authenticatedUser->id);
                        $hasAnyScope = true;
                    }

                    $deptIds = $visibility['dept_ids'] ?? [];
                    if ($deptIds !== []) {
                        $departmentColumn = $this->hasColumn($employeeTable, 'department_id')
                            ? 'department_id'
                            : ($this->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);

                        if ($departmentColumn !== null) {
                            if ($hasAnyScope) {
                                $builder->orWhereIn("{$employeeTable}.{$departmentColumn}", $deptIds);
                            } else {
                                $builder->whereIn("{$employeeTable}.{$departmentColumn}", $deptIds);
                            }
                            $hasAnyScope = true;
                        }
                    }

                    if (! $hasAnyScope) {
                        $builder->whereRaw('1 = 0');
                    }
                });
            }
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

    public function projectItems(Request $request): JsonResponse
    {
        if (! $this->hasTable('project_items')) {
            return $this->missingTable('project_items');
        }

        $query = DB::table('project_items as pi');
        if ($this->hasTable('projects')) {
            $query->leftJoin('projects as p', 'pi.project_id', '=', 'p.id');
        }
        if ($this->hasTable('customers')) {
            $query->leftJoin('customers as c', 'p.customer_id', '=', 'c.id');
        }
        if ($this->hasTable('products')) {
            $query->leftJoin('products as pr', 'pi.product_id', '=', 'pr.id');
        }

        if ($this->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                $builder->orWhere('pi.id', 'like', $like);

                if ($this->hasTable('projects') && $this->hasColumn('projects', 'project_code')) {
                    $builder->orWhere('p.project_code', 'like', $like);
                }
                if ($this->hasTable('projects') && $this->hasColumn('projects', 'project_name')) {
                    $builder->orWhere('p.project_name', 'like', $like);
                }
                if ($this->hasTable('products') && $this->hasColumn('products', 'product_code')) {
                    $builder->orWhere('pr.product_code', 'like', $like);
                }
                if ($this->hasTable('products') && $this->hasColumn('products', 'product_name')) {
                    $builder->orWhere('pr.product_name', 'like', $like);
                }
                if ($this->hasTable('customers') && $this->hasColumn('customers', 'customer_name')) {
                    $builder->orWhere('c.customer_name', 'like', $like);
                }
            });
        }

        $rows = $query
            ->select($this->projectItemSelectColumns())
            ->orderByDesc('pi.id')
            ->get()
            ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
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

    public function supportServiceGroups(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $query = DB::table('support_service_groups')
            ->select($this->selectColumns('support_service_groups', [
                'id',
                'group_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->hasColumn('support_service_groups', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->hasColumn('support_service_groups', 'group_name')) {
            $query->orderBy('group_name');
        }
        if ($this->hasColumn('support_service_groups', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportServiceGroupRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSupportServiceGroup(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        $rules = [
            'group_name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ];

        if ($this->hasColumn('support_service_groups', 'group_name')) {
            $rules['group_name'][] = Rule::unique('support_service_groups', 'group_name');
        }

        $validated = $request->validate($rules);

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('support_service_groups', [
            'group_name' => trim((string) $validated['group_name']),
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->hasColumn('support_service_groups', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('support_service_groups', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_service_groups')->insertGetId($payload);
        $record = $this->loadSupportServiceGroupById($insertId);

        if ($record === null) {
            return response()->json(['message' => 'Support service group created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function supportRequests(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $query = $this->supportRequestsBaseQuery()
            ->select($this->supportRequestSelectColumns());

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');

                if ($this->hasColumn('support_requests', 'summary')) {
                    $builder->orWhere('sr.summary', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'ticket_code')) {
                    $builder->orWhere('sr.ticket_code', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'reporter_name')) {
                    $builder->orWhere('sr.reporter_name', 'like', $like);
                }
                if ($this->hasTable('customers') && $this->hasColumn('customers', 'customer_name')) {
                    $builder->orWhere('c.customer_name', 'like', $like);
                }
                if ($this->hasTable('projects') && $this->hasColumn('projects', 'project_name')) {
                    $builder->orWhere('p.project_name', 'like', $like);
                }
                if ($this->hasTable('products') && $this->hasColumn('products', 'product_name')) {
                    $builder->orWhere('pr.product_name', 'like', $like);
                }
                if ($this->hasTable('support_service_groups') && $this->hasColumn('support_service_groups', 'group_name')) {
                    $builder->orWhere('ssg.group_name', 'like', $like);
                }
                if ($this->hasTable('internal_users') && $this->hasColumn('internal_users', 'full_name')) {
                    $builder->orWhere('iu.full_name', 'like', $like);
                }
            });
        }

        $status = strtoupper(trim((string) $request->query('status', '')));
        if ($status !== '' && in_array($status, self::SUPPORT_REQUEST_STATUSES, true)) {
            $query->where('sr.status', $status);
        }

        $priority = strtoupper(trim((string) $request->query('priority', '')));
        if ($priority !== '' && in_array($priority, self::SUPPORT_REQUEST_PRIORITIES, true)) {
            $query->where('sr.priority', $priority);
        }

        $serviceGroupId = $this->parseNullableInt($request->query('service_group_id'));
        if ($serviceGroupId !== null && $this->hasColumn('support_requests', 'service_group_id')) {
            $query->where('sr.service_group_id', $serviceGroupId);
        }

        $customerId = $this->parseNullableInt($request->query('customer_id'));
        if ($customerId !== null && $this->hasColumn('support_requests', 'customer_id')) {
            $query->where('sr.customer_id', $customerId);
        }

        $assigneeId = $this->parseNullableInt($request->query('assignee_id'));
        if ($assigneeId !== null && $this->hasColumn('support_requests', 'assignee_id')) {
            $query->where('sr.assignee_id', $assigneeId);
        }

        $includeDeleted = filter_var($request->query('include_deleted', false), FILTER_VALIDATE_BOOLEAN);
        if (! $includeDeleted && $this->hasColumn('support_requests', 'deleted_at')) {
            $query->whereNull('sr.deleted_at');
        }

        if ($this->hasColumn('support_requests', 'requested_date')) {
            $query->orderByDesc('sr.requested_date');
        }
        if ($this->hasColumn('support_requests', 'id')) {
            $query->orderByDesc('sr.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportRequestRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSupportRequest(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $rules = [
            'ticket_code' => ['nullable', 'string', 'max:50'],
            'summary' => ['required', 'string'],
            'service_group_id' => ['nullable', 'integer'],
            'project_item_id' => ['nullable', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'reporter_name' => ['nullable', 'string', 'max:100'],
            'assignee_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(self::SUPPORT_REQUEST_STATUSES)],
            'priority' => ['nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'resolved_date' => ['nullable', 'date'],
            'hotfix_date' => ['nullable', 'date'],
            'noti_date' => ['nullable', 'date'],
            'task_link' => ['nullable', 'string'],
            'change_log' => ['nullable', 'string'],
            'test_note' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'created_by' => ['nullable', 'integer'],
        ];

        if ($this->hasColumn('support_requests', 'ticket_code')) {
            $rules['ticket_code'][] = Rule::unique('support_requests', 'ticket_code');
        }

        $validated = $request->validate($rules);

        $projectItemId = $this->parseNullableInt($validated['project_item_id'] ?? null);
        $projectItemContext = null;
        if ($projectItemId !== null) {
            $projectItemContext = $this->resolveSupportProjectItemContext($projectItemId);
            if ($projectItemContext === null) {
                return response()->json(['message' => 'project_item_id is invalid.'], 422);
            }
        }

        $serviceGroupId = $this->parseNullableInt($validated['service_group_id'] ?? null);
        if ($serviceGroupId !== null && ! $this->tableRowExists('support_service_groups', $serviceGroupId)) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }

        $customerId = $projectItemContext['customer_id'] ?? $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $projectId = $projectItemContext['project_id'] ?? $this->parseNullableInt($validated['project_id'] ?? null);
        if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
            return response()->json(['message' => 'project_id is invalid.'], 422);
        }

        $productId = $projectItemContext['product_id'] ?? $this->parseNullableInt($validated['product_id'] ?? null);
        if ($productId !== null && ! $this->tableRowExists('products', $productId)) {
            return response()->json(['message' => 'product_id is invalid.'], 422);
        }

        $assigneeId = $this->parseNullableInt($validated['assignee_id'] ?? null);
        if ($assigneeId !== null && ! $this->tableRowExists('internal_users', $assigneeId)) {
            return response()->json(['message' => 'assignee_id is invalid.'], 422);
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $status = $this->normalizeSupportRequestStatus((string) ($validated['status'] ?? 'OPEN'));
        $priority = $this->normalizeSupportRequestPriority((string) ($validated['priority'] ?? 'MEDIUM'));

        $payload = [
            'ticket_code' => $this->normalizeNullableString($validated['ticket_code'] ?? null),
            'summary' => (string) $validated['summary'],
            'service_group_id' => $serviceGroupId,
            'project_item_id' => $projectItemContext['project_item_id'] ?? $projectItemId,
            'customer_id' => $customerId,
            'project_id' => $projectId,
            'product_id' => $productId,
            'reporter_name' => $this->normalizeNullableString($validated['reporter_name'] ?? null),
            'assignee_id' => $assigneeId,
            'status' => $status,
            'priority' => $priority,
            'requested_date' => $validated['requested_date'],
            'due_date' => $validated['due_date'] ?? null,
            'resolved_date' => $validated['resolved_date'] ?? null,
            'hotfix_date' => $validated['hotfix_date'] ?? null,
            'noti_date' => $validated['noti_date'] ?? null,
            'task_link' => $this->normalizeNullableString($validated['task_link'] ?? null),
            'change_log' => $this->normalizeNullableString($validated['change_log'] ?? null),
            'test_note' => $this->normalizeNullableString($validated['test_note'] ?? null),
            'notes' => $this->normalizeNullableString($validated['notes'] ?? null),
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        $insertId = null;
        DB::transaction(function () use ($payload, &$insertId, $status, $createdById): void {
            $insertPayload = $this->filterPayloadByTableColumns('support_requests', $payload);
            if ($this->hasColumn('support_requests', 'created_at')) {
                $insertPayload['created_at'] = now();
            }
            if ($this->hasColumn('support_requests', 'updated_at')) {
                $insertPayload['updated_at'] = now();
            }

            $insertId = (int) DB::table('support_requests')->insertGetId($insertPayload);

            $actorId = $this->resolveSupportHistoryActorId($createdById);
            $this->insertSupportRequestHistoryRecord(
                $insertId,
                null,
                $status,
                'Tạo yêu cầu hỗ trợ',
                $actorId
            );
        });

        $record = $insertId !== null ? $this->loadSupportRequestById($insertId) : null;
        if ($record === null) {
            return response()->json(['message' => 'Support request created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateSupportRequest(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        if ($this->hasColumn('support_requests', 'deleted_at') && ! empty($current->deleted_at)) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $rules = [
            'ticket_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'summary' => ['sometimes', 'required', 'string'],
            'service_group_id' => ['sometimes', 'nullable', 'integer'],
            'project_item_id' => ['sometimes', 'nullable', 'integer'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'product_id' => ['sometimes', 'nullable', 'integer'],
            'reporter_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'assignee_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::in(self::SUPPORT_REQUEST_STATUSES)],
            'priority' => ['sometimes', 'nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['sometimes', 'required', 'date'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'resolved_date' => ['sometimes', 'nullable', 'date'],
            'hotfix_date' => ['sometimes', 'nullable', 'date'],
            'noti_date' => ['sometimes', 'nullable', 'date'],
            'task_link' => ['sometimes', 'nullable', 'string'],
            'change_log' => ['sometimes', 'nullable', 'string'],
            'test_note' => ['sometimes', 'nullable', 'string'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
            'status_comment' => ['sometimes', 'nullable', 'string'],
        ];

        if ($this->hasColumn('support_requests', 'ticket_code')) {
            $rules['ticket_code'][] = Rule::unique('support_requests', 'ticket_code')->ignore($id);
        }

        $validated = $request->validate($rules);
        $updates = [];

        $projectItemBound = false;
        if (array_key_exists('project_item_id', $validated)) {
            $projectItemId = $this->parseNullableInt($validated['project_item_id']);
            $updates['project_item_id'] = $projectItemId;

            if ($projectItemId !== null) {
                $projectItemContext = $this->resolveSupportProjectItemContext($projectItemId);
                if ($projectItemContext === null) {
                    return response()->json(['message' => 'project_item_id is invalid.'], 422);
                }

                $updates['customer_id'] = $projectItemContext['customer_id'];
                $updates['project_id'] = $projectItemContext['project_id'];
                $updates['product_id'] = $projectItemContext['product_id'];
                $projectItemBound = true;
            }
        }

        if (array_key_exists('service_group_id', $validated)) {
            $serviceGroupId = $this->parseNullableInt($validated['service_group_id']);
            if ($serviceGroupId !== null && ! $this->tableRowExists('support_service_groups', $serviceGroupId)) {
                return response()->json(['message' => 'service_group_id is invalid.'], 422);
            }
            $updates['service_group_id'] = $serviceGroupId;
        }

        if (array_key_exists('customer_id', $validated) && ! $projectItemBound) {
            $customerId = $this->parseNullableInt($validated['customer_id']);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
            $updates['customer_id'] = $customerId;
        }

        if (array_key_exists('project_id', $validated) && ! $projectItemBound) {
            $projectId = $this->parseNullableInt($validated['project_id']);
            if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
                return response()->json(['message' => 'project_id is invalid.'], 422);
            }
            $updates['project_id'] = $projectId;
        }

        if (array_key_exists('product_id', $validated) && ! $projectItemBound) {
            $productId = $this->parseNullableInt($validated['product_id']);
            if ($productId !== null && ! $this->tableRowExists('products', $productId)) {
                return response()->json(['message' => 'product_id is invalid.'], 422);
            }
            $updates['product_id'] = $productId;
        }

        if (array_key_exists('assignee_id', $validated)) {
            $assigneeId = $this->parseNullableInt($validated['assignee_id']);
            if ($assigneeId !== null && ! $this->tableRowExists('internal_users', $assigneeId)) {
                return response()->json(['message' => 'assignee_id is invalid.'], 422);
            }
            $updates['assignee_id'] = $assigneeId;
        }

        $updatedById = null;
        if (array_key_exists('updated_by', $validated)) {
            $updatedById = $this->parseNullableInt($validated['updated_by']);
            if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
                return response()->json(['message' => 'updated_by is invalid.'], 422);
            }
            $updates['updated_by'] = $updatedById;
        }

        if (array_key_exists('ticket_code', $validated)) {
            $updates['ticket_code'] = $this->normalizeNullableString($validated['ticket_code']);
        }
        if (array_key_exists('summary', $validated)) {
            $updates['summary'] = (string) $validated['summary'];
        }
        if (array_key_exists('reporter_name', $validated)) {
            $updates['reporter_name'] = $this->normalizeNullableString($validated['reporter_name']);
        }
        if (array_key_exists('priority', $validated)) {
            $updates['priority'] = $this->normalizeSupportRequestPriority((string) $validated['priority']);
        }
        if (array_key_exists('requested_date', $validated)) {
            $updates['requested_date'] = $validated['requested_date'];
        }
        if (array_key_exists('due_date', $validated)) {
            $updates['due_date'] = $validated['due_date'];
        }
        if (array_key_exists('resolved_date', $validated)) {
            $updates['resolved_date'] = $validated['resolved_date'];
        }
        if (array_key_exists('hotfix_date', $validated)) {
            $updates['hotfix_date'] = $validated['hotfix_date'];
        }
        if (array_key_exists('noti_date', $validated)) {
            $updates['noti_date'] = $validated['noti_date'];
        }
        if (array_key_exists('task_link', $validated)) {
            $updates['task_link'] = $this->normalizeNullableString($validated['task_link']);
        }
        if (array_key_exists('change_log', $validated)) {
            $updates['change_log'] = $this->normalizeNullableString($validated['change_log']);
        }
        if (array_key_exists('test_note', $validated)) {
            $updates['test_note'] = $this->normalizeNullableString($validated['test_note']);
        }
        if (array_key_exists('notes', $validated)) {
            $updates['notes'] = $this->normalizeNullableString($validated['notes']);
        }

        $oldStatus = $this->normalizeSupportRequestStatus((string) ($current->status ?? 'OPEN'));
        $newStatus = $oldStatus;
        if (array_key_exists('status', $validated)) {
            $newStatus = $this->normalizeSupportRequestStatus((string) ($validated['status'] ?? 'OPEN'));
            $updates['status'] = $newStatus;
        }

        $statusChanged = $newStatus !== $oldStatus;
        if (
            $statusChanged &&
            $newStatus === 'RESOLVED' &&
            ! array_key_exists('resolved_date', $validated) &&
            $this->hasColumn('support_requests', 'resolved_date') &&
            empty($current->resolved_date)
        ) {
            $updates['resolved_date'] = now()->toDateString();
        }

        $updates = $this->filterPayloadByTableColumns('support_requests', $updates);
        if ($updates === []) {
            $record = $this->loadSupportRequestById($id);
            if ($record === null) {
                return response()->json(['message' => 'Support request not found.'], 404);
            }

            return response()->json(['data' => $record]);
        }

        if ($this->hasColumn('support_requests', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::transaction(function () use ($id, $updates, $statusChanged, $oldStatus, $newStatus, $validated, $updatedById): void {
            DB::table('support_requests')->where('id', $id)->update($updates);

            if (! $statusChanged) {
                return;
            }

            $actorId = $this->resolveSupportHistoryActorId($updatedById);
            $this->insertSupportRequestHistoryRecord(
                $id,
                $oldStatus,
                $newStatus,
                $this->normalizeNullableString($validated['status_comment'] ?? null),
                $actorId
            );
        });

        $record = $this->loadSupportRequestById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        return response()->json(['data' => $record]);
    }

    public function deleteSupportRequest(int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        if ($this->hasColumn('support_requests', 'deleted_at')) {
            if (empty($current->deleted_at)) {
                $updates = ['deleted_at' => now()];
                if ($this->hasColumn('support_requests', 'updated_at')) {
                    $updates['updated_at'] = now();
                }
                DB::table('support_requests')->where('id', $id)->update($updates);
            }

            return response()->json(['message' => 'Support request deleted.']);
        }

        try {
            DB::transaction(function () use ($id): void {
                DB::table('support_requests')->where('id', $id)->delete();
            });

            return response()->json(['message' => 'Support request deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Support request is referenced by other records and cannot be deleted.',
            ], 422);
        }
    }

    public function updateSupportRequestStatus(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        if ($this->hasColumn('support_requests', 'deleted_at') && ! empty($current->deleted_at)) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $validated = $request->validate([
            'new_status' => ['required', Rule::in(self::SUPPORT_REQUEST_STATUSES)],
            'comment' => ['sometimes', 'nullable', 'string'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
            'resolved_date' => ['sometimes', 'nullable', 'date'],
            'hotfix_date' => ['sometimes', 'nullable', 'date'],
            'noti_date' => ['sometimes', 'nullable', 'date'],
        ]);

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $oldStatus = $this->normalizeSupportRequestStatus((string) ($current->status ?? 'OPEN'));
        $newStatus = $this->normalizeSupportRequestStatus((string) $validated['new_status']);

        $updates = ['status' => $newStatus];
        if (array_key_exists('resolved_date', $validated)) {
            $updates['resolved_date'] = $validated['resolved_date'];
        } elseif ($newStatus === 'RESOLVED' && $this->hasColumn('support_requests', 'resolved_date') && empty($current->resolved_date)) {
            $updates['resolved_date'] = now()->toDateString();
        }

        if (array_key_exists('hotfix_date', $validated)) {
            $updates['hotfix_date'] = $validated['hotfix_date'];
        }
        if (array_key_exists('noti_date', $validated)) {
            $updates['noti_date'] = $validated['noti_date'];
        }
        if ($updatedById !== null) {
            $updates['updated_by'] = $updatedById;
        }

        $updates = $this->filterPayloadByTableColumns('support_requests', $updates);
        if ($this->hasColumn('support_requests', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::transaction(function () use ($id, $updates, $oldStatus, $newStatus, $validated, $updatedById): void {
            DB::table('support_requests')->where('id', $id)->update($updates);

            $actorId = $this->resolveSupportHistoryActorId($updatedById);
            $this->insertSupportRequestHistoryRecord(
                $id,
                $oldStatus,
                $newStatus,
                $this->normalizeNullableString($validated['comment'] ?? null),
                $actorId
            );
        });

        $record = $this->loadSupportRequestById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        return response()->json(['data' => $record]);
    }

    public function supportRequestHistory(int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        if (! $this->hasTable('support_request_history')) {
            return $this->missingTable('support_request_history');
        }

        $exists = DB::table('support_requests')->where('id', $id)->exists();
        if (! $exists) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $query = DB::table('support_request_history as h');
        if ($this->hasTable('internal_users')) {
            $query->leftJoin('internal_users as iu', 'h.created_by', '=', 'iu.id');
        }

        $selects = [];
        foreach (['id', 'request_id', 'old_status', 'new_status', 'comment', 'created_at', 'created_by'] as $column) {
            if ($this->hasColumn('support_request_history', $column)) {
                $selects[] = "h.{$column} as {$column}";
            }
        }

        if ($this->hasTable('internal_users')) {
            if ($this->hasColumn('internal_users', 'full_name')) {
                $selects[] = 'iu.full_name as created_by_name';
            }
            if ($this->hasColumn('internal_users', 'username')) {
                $selects[] = 'iu.username as created_by_username';
            }
        }

        $rows = $query
            ->select($selects)
            ->where('h.request_id', $id)
            ->orderByDesc('h.created_at')
            ->orderByDesc('h.id')
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportRequestHistoryRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function supportRequestHistories(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_request_history')) {
            return $this->missingTable('support_request_history');
        }

        $query = DB::table('support_request_history as h');
        if ($this->hasTable('support_requests')) {
            $query->leftJoin('support_requests as sr', 'h.request_id', '=', 'sr.id');
        }
        if ($this->hasTable('internal_users')) {
            $query->leftJoin('internal_users as iu', 'h.created_by', '=', 'iu.id');
        }

        $requestId = $this->parseNullableInt($request->query('request_id'));
        if ($requestId !== null) {
            $query->where('h.request_id', $requestId);
        }

        $limit = $request->integer('limit', 200);
        $limit = max(1, min($limit, 1000));

        $selects = [];
        foreach (['id', 'request_id', 'old_status', 'new_status', 'comment', 'created_at', 'created_by'] as $column) {
            if ($this->hasColumn('support_request_history', $column)) {
                $selects[] = "h.{$column} as {$column}";
            }
        }

        if ($this->hasTable('support_requests')) {
            if ($this->hasColumn('support_requests', 'ticket_code')) {
                $selects[] = 'sr.ticket_code as ticket_code';
            }
            if ($this->hasColumn('support_requests', 'summary')) {
                $selects[] = 'sr.summary as request_summary';
            }
        }

        if ($this->hasTable('internal_users')) {
            if ($this->hasColumn('internal_users', 'full_name')) {
                $selects[] = 'iu.full_name as created_by_name';
            }
            if ($this->hasColumn('internal_users', 'username')) {
                $selects[] = 'iu.username as created_by_username';
            }
        }

        $rows = $query
            ->select($selects)
            ->orderByDesc('h.created_at')
            ->orderByDesc('h.id')
            ->limit($limit)
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportRequestHistoryRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
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
            'dept_code' => ['required', 'string', 'max:100'],
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

        $deptCode = $this->canonicalDepartmentCode((string) $validated['dept_code']);
        if (Department::query()->where('dept_code', $deptCode)->exists()) {
            return response()->json(['message' => 'Mã phòng ban đã tồn tại.'], 422);
        }

        $parentId = $this->parseNullableInt($validated['parent_id'] ?? null);
        if ($parentId !== null && ! Department::query()->whereKey($parentId)->exists()) {
            return response()->json(['message' => 'parent_id is invalid.'], 422);
        }

        [$resolvedParentId, $parentValidationError] = $this->resolveDepartmentParentIdForWrite(
            $deptCode,
            $parentId,
            null
        );
        if ($parentValidationError !== null) {
            return response()->json(['message' => $parentValidationError], 422);
        }

        $department = new Department();
        $department->dept_code = $deptCode;
        $department->dept_name = $validated['dept_name'];
        $department->parent_id = $resolvedParentId;
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

        $targetDeptCode = $this->canonicalDepartmentCode((string) ($validated['dept_code'] ?? $department->dept_code));
        if ($this->isRootDepartmentCode((string) $department->dept_code) && ! $this->isRootDepartmentCode($targetDeptCode)) {
            return response()->json(['message' => 'Phòng ban gốc phải giữ mã BGĐVT.'], 422);
        }

        if (Department::query()
            ->where('dept_code', $targetDeptCode)
            ->where('id', '!=', $department->id)
            ->exists()) {
            return response()->json(['message' => 'Mã phòng ban đã tồn tại.'], 422);
        }

        $requestedParentId = array_key_exists('parent_id', $validated)
            ? $this->parseNullableInt($validated['parent_id'])
            : $this->parseNullableInt($department->parent_id);

        if ($requestedParentId !== null && $requestedParentId === (int) $department->id) {
            return response()->json(['message' => 'parent_id cannot be self.'], 422);
        }

        if ($requestedParentId !== null && ! Department::query()->whereKey($requestedParentId)->exists()) {
            return response()->json(['message' => 'parent_id is invalid.'], 422);
        }

        [$resolvedParentId, $parentValidationError] = $this->resolveDepartmentParentIdForWrite(
            $targetDeptCode,
            $requestedParentId,
            (int) $department->id
        );
        if ($parentValidationError !== null) {
            return response()->json(['message' => $parentValidationError], 422);
        }

        if (array_key_exists('dept_code', $validated)) {
            $department->dept_code = $targetDeptCode;
        }
        if (array_key_exists('dept_name', $validated)) {
            $department->dept_name = $validated['dept_name'];
        }

        $parentChanged = (int) ($department->parent_id ?? 0) !== (int) ($resolvedParentId ?? 0);
        $department->parent_id = $resolvedParentId;

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
        if ($this->isRootDepartmentCode((string) $department->dept_code)) {
            return response()->json([
                'message' => 'Không thể xóa phòng ban gốc BGĐVT.',
            ], 422);
        }

        $employeeTable = $this->resolveEmployeeTable();
        $employeeDepartmentColumn = $this->resolveEmployeeDepartmentColumn($employeeTable);
        if ($employeeTable !== null && $employeeDepartmentColumn !== null) {
            $employeeCount = $this->countEmployeesByDepartment((int) $department->id, $employeeTable, $employeeDepartmentColumn);
            if ($employeeCount > 0) {
                return response()->json([
                    'message' => 'Không thể xóa phòng ban đang có nhân sự. Vui lòng điều chuyển nhân sự trước.',
                ], 422);
            }
        }

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
            'department_id' => ['required', 'integer'],
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
        if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
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
            'department_id' => ['sometimes', 'required', 'integer'],
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
            if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
                return response()->json(['message' => 'department_id is invalid.'], 422);
            }
            $this->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);
        } else {
            $currentDepartmentId = $this->parseNullableInt((string) $this->firstNonEmpty(
                $employee->toArray(),
                ['department_id', 'dept_id']
            ));
            if ($currentDepartmentId === null || ! Department::query()->whereKey($currentDepartmentId)->exists()) {
                return response()->json(['message' => 'department_id is required.'], 422);
            }
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
            'project_items',
            'contracts',
            'payment_schedules',
            'opportunities',
            'documents',
            'reminders',
            'user_dept_history',
            'audit_logs',
            'support_service_groups',
            'support_requests',
            'support_request_history',
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

    public function roles(): JsonResponse
    {
        if (! $this->hasTable('roles')) {
            return $this->missingTable('roles');
        }

        $rows = DB::table('roles')
            ->select($this->selectColumns('roles', [
                'id',
                'role_code',
                'role_name',
                'description',
                'is_system',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('id')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;

                return [
                    'id' => isset($data['id']) ? (int) $data['id'] : null,
                    'role_code' => (string) ($data['role_code'] ?? ''),
                    'role_name' => (string) ($data['role_name'] ?? ''),
                    'description' => $data['description'] ?? null,
                    'is_system' => (bool) ($data['is_system'] ?? false),
                    'created_at' => $data['created_at'] ?? null,
                    'updated_at' => $data['updated_at'] ?? null,
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function permissions(): JsonResponse
    {
        if (! $this->hasTable('permissions')) {
            return $this->missingTable('permissions');
        }

        $rows = DB::table('permissions')
            ->select($this->selectColumns('permissions', [
                'id',
                'perm_key',
                'perm_name',
                'perm_group',
                'is_active',
                'created_at',
                'updated_at',
            ]))
            ->orderBy('perm_group')
            ->orderBy('perm_key')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;

                return [
                    'id' => isset($data['id']) ? (int) $data['id'] : null,
                    'perm_key' => (string) ($data['perm_key'] ?? ''),
                    'perm_name' => (string) ($data['perm_name'] ?? ''),
                    'perm_group' => (string) ($data['perm_group'] ?? ''),
                    'is_active' => (bool) ($data['is_active'] ?? true),
                    'created_at' => $data['created_at'] ?? null,
                    'updated_at' => $data['updated_at'] ?? null,
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function userAccess(Request $request): JsonResponse
    {
        if (! $this->hasTable('internal_users')) {
            return $this->missingTable('internal_users');
        }

        $search = trim((string) $request->query('search', ''));
        $rows = $this->buildUserAccessRows(
            userIds: [],
            search: $search !== '' ? $search : null
        );

        return response()->json(['data' => $rows]);
    }

    public function updateUserRoles(Request $request, int $userId): JsonResponse
    {
        if (! $this->hasTable('internal_users') || ! $this->hasTable('user_roles') || ! $this->hasTable('roles')) {
            return response()->json(['message' => 'Bảng phân quyền chưa sẵn sàng.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Không tìm thấy người dùng.'], 404);
        }

        $validated = $request->validate([
            'role_ids' => ['required', 'array'],
            'role_ids.*' => ['integer'],
        ]);

        $roleIds = array_values(array_unique(array_map('intval', $validated['role_ids'] ?? [])));
        if ($roleIds === []) {
            return response()->json(['message' => 'role_ids là bắt buộc.'], 422);
        }

        $validRoleCount = DB::table('roles')->whereIn('id', $roleIds)->count();
        if ($validRoleCount !== count($roleIds)) {
            return response()->json(['message' => 'role_ids chứa giá trị không hợp lệ.'], 422);
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $roleIds, $actorId, $now): void {
            DB::table('user_roles')->where('user_id', $userId)->delete();

            $records = [];
            foreach ($roleIds as $roleId) {
                $record = [
                    'user_id' => $userId,
                    'role_id' => $roleId,
                ];

                if ($this->hasColumn('user_roles', 'is_active')) {
                    $record['is_active'] = 1;
                }
                if ($this->hasColumn('user_roles', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->hasColumn('user_roles', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            if ($records !== []) {
                DB::table('user_roles')->insert($records);
            }
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu sau khi cập nhật.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    public function updateUserPermissions(Request $request, int $userId): JsonResponse
    {
        if (! $this->hasTable('internal_users') || ! $this->hasTable('user_permissions') || ! $this->hasTable('permissions')) {
            return response()->json(['message' => 'Bảng phân quyền chưa sẵn sàng.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Không tìm thấy người dùng.'], 404);
        }

        $validated = $request->validate([
            'overrides' => ['nullable', 'array'],
            'overrides.*.permission_id' => ['required', 'integer'],
            'overrides.*.type' => ['required', Rule::in(['GRANT', 'DENY'])],
            'overrides.*.reason' => ['nullable', 'string', 'max:500'],
            'overrides.*.expires_at' => ['nullable', 'date'],
        ]);

        $overrides = $validated['overrides'] ?? [];
        $permissionIds = array_values(array_unique(array_map(
            fn (array $item): int => (int) ($item['permission_id'] ?? 0),
            $overrides
        )));

        if ($permissionIds !== []) {
            $validPermissionCount = DB::table('permissions')->whereIn('id', $permissionIds)->count();
            if ($validPermissionCount !== count($permissionIds)) {
                return response()->json(['message' => 'permission_id chứa giá trị không hợp lệ.'], 422);
            }
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $overrides, $actorId, $now): void {
            DB::table('user_permissions')->where('user_id', $userId)->delete();

            if ($overrides === []) {
                return;
            }

            $records = [];
            foreach ($overrides as $override) {
                $record = [
                    'user_id' => $userId,
                    'permission_id' => (int) $override['permission_id'],
                    'type' => strtoupper((string) ($override['type'] ?? 'GRANT')),
                    'reason' => trim((string) ($override['reason'] ?? 'Phân quyền cập nhật từ giao diện')),
                ];

                if ($this->hasColumn('user_permissions', 'expires_at')) {
                    $record['expires_at'] = $override['expires_at'] ?? null;
                }
                if ($this->hasColumn('user_permissions', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->hasColumn('user_permissions', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            DB::table('user_permissions')->insert($records);
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu sau khi cập nhật.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    public function updateUserDeptScopes(Request $request, int $userId): JsonResponse
    {
        if (! $this->hasTable('internal_users') || ! $this->hasTable('user_dept_scopes') || ! $this->hasTable('departments')) {
            return response()->json(['message' => 'Bảng phân quyền phạm vi chưa sẵn sàng.'], 503);
        }

        if (! $this->tableRowExists('internal_users', $userId)) {
            return response()->json(['message' => 'Không tìm thấy người dùng.'], 404);
        }

        $validated = $request->validate([
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*.dept_id' => ['required', 'integer'],
            'scopes.*.scope_type' => ['required', Rule::in(self::USER_DEPT_SCOPE_TYPES)],
        ]);

        $scopes = $validated['scopes'] ?? [];
        $deptIds = array_values(array_unique(array_map(
            fn (array $scope): int => (int) ($scope['dept_id'] ?? 0),
            $scopes
        )));

        $validDeptCount = DB::table('departments')->whereIn('id', $deptIds)->count();
        if ($validDeptCount !== count($deptIds)) {
            return response()->json(['message' => 'dept_id chứa giá trị không hợp lệ.'], 422);
        }

        $actorId = $request->user()?->id;
        $now = now();

        DB::transaction(function () use ($userId, $scopes, $actorId, $now): void {
            DB::table('user_dept_scopes')->where('user_id', $userId)->delete();

            $records = [];
            foreach ($scopes as $scope) {
                $record = [
                    'user_id' => $userId,
                    'dept_id' => (int) $scope['dept_id'],
                    'scope_type' => strtoupper((string) $scope['scope_type']),
                ];

                if ($this->hasColumn('user_dept_scopes', 'created_at')) {
                    $record['created_at'] = $now;
                }
                if ($this->hasColumn('user_dept_scopes', 'created_by') && $actorId !== null) {
                    $record['created_by'] = (int) $actorId;
                }

                $records[] = $record;
            }

            DB::table('user_dept_scopes')->insert($records);
        });

        $entry = $this->buildUserAccessRows([$userId], null)[0] ?? null;
        if ($entry === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu sau khi cập nhật.'], 500);
        }

        return response()->json(['data' => $entry]);
    }

    /**
     * @param array<int, int> $userIds
     * @return array<int, array<string, mixed>>
     */
    private function buildUserAccessRows(array $userIds, ?string $search): array
    {
        $query = DB::table('internal_users as iu');
        if ($this->hasTable('departments')) {
            $query->leftJoin('departments as d', 'iu.department_id', '=', 'd.id');
        }

        $query->select($this->resolveUserAccessBaseSelectColumns());

        if ($userIds !== []) {
            $query->whereIn('iu.id', $userIds);
        }

        if ($search !== null && $search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                $builder->orWhere('iu.username', 'like', $like);
                if ($this->hasColumn('internal_users', 'user_code')) {
                    $builder->orWhere('iu.user_code', 'like', $like);
                }
                if ($this->hasColumn('internal_users', 'full_name')) {
                    $builder->orWhere('iu.full_name', 'like', $like);
                }
                if ($this->hasColumn('internal_users', 'email')) {
                    $builder->orWhere('iu.email', 'like', $like);
                }
                if ($this->hasTable('departments') && $this->hasColumn('departments', 'dept_name')) {
                    $builder->orWhere('d.dept_name', 'like', $like);
                }
            });
        }

        $users = $query
            ->orderBy('iu.id')
            ->get()
            ->map(function (object $row): array {
                $data = (array) $row;
                $id = isset($data['id']) ? (int) $data['id'] : 0;

                return [
                    'id' => $id,
                    'user_code' => (string) ($data['user_code'] ?? ''),
                    'username' => (string) ($data['username'] ?? ''),
                    'full_name' => (string) ($data['full_name'] ?? ''),
                    'email' => (string) ($data['email'] ?? ''),
                    'status' => (string) ($data['status'] ?? ''),
                    'department_id' => $data['department_id'] ?? null,
                    'department_code' => $data['department_code'] ?? null,
                    'department_name' => $data['department_name'] ?? null,
                ];
            })
            ->filter(fn (array $item): bool => $item['id'] > 0)
            ->values()
            ->all();

        $targetUserIds = array_values(array_unique(array_map(fn (array $user): int => $user['id'], $users)));
        if ($targetUserIds === []) {
            return [];
        }

        $rolesByUser = [];
        if ($this->hasTable('user_roles') && $this->hasTable('roles')) {
            $now = now();
            DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->whereIn('ur.user_id', $targetUserIds)
                ->when($this->hasColumn('user_roles', 'is_active'), fn ($query) => $query->where('ur.is_active', 1))
                ->when(
                    $this->hasColumn('user_roles', 'expires_at'),
                    fn ($query) => $query->where(function ($builder) use ($now): void {
                        $builder->whereNull('ur.expires_at')->orWhere('ur.expires_at', '>', $now);
                    })
                )
                ->select([
                    'ur.user_id',
                    'r.id as role_id',
                    'r.role_code',
                    'r.role_name',
                ])
                ->orderBy('r.role_code')
                ->get()
                ->each(function (object $row) use (&$rolesByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $rolesByUser[$userId] ??= [];
                    $rolesByUser[$userId][] = [
                        'role_id' => (int) ($row->role_id ?? 0),
                        'role_code' => (string) ($row->role_code ?? ''),
                        'role_name' => (string) ($row->role_name ?? ''),
                    ];
                });
        }

        $permissionsByUser = [];
        if ($this->hasTable('user_permissions') && $this->hasTable('permissions')) {
            $now = now();
            DB::table('user_permissions as up')
                ->join('permissions as p', 'up.permission_id', '=', 'p.id')
                ->whereIn('up.user_id', $targetUserIds)
                ->when(
                    $this->hasColumn('user_permissions', 'expires_at'),
                    fn ($query) => $query->where(function ($builder) use ($now): void {
                        $builder->whereNull('up.expires_at')->orWhere('up.expires_at', '>', $now);
                    })
                )
                ->select([
                    'up.user_id',
                    'up.permission_id',
                    'up.type',
                    'up.reason',
                    'up.expires_at',
                    'p.perm_key',
                    'p.perm_name',
                    'p.perm_group',
                ])
                ->orderBy('p.perm_group')
                ->orderBy('p.perm_key')
                ->get()
                ->each(function (object $row) use (&$permissionsByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $permissionsByUser[$userId] ??= [];
                    $permissionsByUser[$userId][] = [
                        'permission_id' => (int) ($row->permission_id ?? 0),
                        'perm_key' => (string) ($row->perm_key ?? ''),
                        'perm_name' => (string) ($row->perm_name ?? ''),
                        'perm_group' => (string) ($row->perm_group ?? ''),
                        'type' => strtoupper((string) ($row->type ?? 'GRANT')),
                        'reason' => $row->reason ?? null,
                        'expires_at' => $row->expires_at ?? null,
                    ];
                });
        }

        $scopesByUser = [];
        if ($this->hasTable('user_dept_scopes')) {
            $scopeQuery = DB::table('user_dept_scopes as uds')
                ->whereIn('uds.user_id', $targetUserIds);

            if ($this->hasTable('departments')) {
                $scopeQuery->leftJoin('departments as ds', 'uds.dept_id', '=', 'ds.id');
            }

            $scopeSelects = ['uds.user_id', 'uds.id as scope_id', 'uds.dept_id', 'uds.scope_type'];
            if ($this->hasTable('departments') && $this->hasColumn('departments', 'dept_code')) {
                $scopeSelects[] = 'ds.dept_code as dept_code';
            }
            if ($this->hasTable('departments') && $this->hasColumn('departments', 'dept_name')) {
                $scopeSelects[] = 'ds.dept_name as dept_name';
            }

            $scopeQuery
                ->select($scopeSelects)
                ->orderBy('uds.id')
                ->get()
                ->each(function (object $row) use (&$scopesByUser): void {
                    $userId = (int) ($row->user_id ?? 0);
                    if ($userId <= 0) {
                        return;
                    }
                    $scopesByUser[$userId] ??= [];
                    $scopesByUser[$userId][] = [
                        'id' => (int) ($row->scope_id ?? 0),
                        'dept_id' => (int) ($row->dept_id ?? 0),
                        'dept_code' => $row->dept_code ?? null,
                        'dept_name' => $row->dept_name ?? null,
                        'scope_type' => strtoupper((string) ($row->scope_type ?? 'DEPT_ONLY')),
                    ];
                });
        }

        return array_map(function (array $user) use ($rolesByUser, $permissionsByUser, $scopesByUser): array {
            $userId = (int) $user['id'];
            return [
                'user' => $user,
                'roles' => $rolesByUser[$userId] ?? [],
                'permissions' => $permissionsByUser[$userId] ?? [],
                'dept_scopes' => $scopesByUser[$userId] ?? [],
            ];
        }, $users);
    }

    /**
     * @return array<int, string>
     */
    private function resolveUserAccessBaseSelectColumns(): array
    {
        $selects = ['iu.id as id'];
        foreach (['user_code', 'username', 'full_name', 'email', 'status', 'department_id'] as $column) {
            if ($this->hasColumn('internal_users', $column)) {
                $selects[] = "iu.{$column} as {$column}";
            }
        }

        if ($this->hasTable('departments') && $this->hasColumn('departments', 'dept_code')) {
            $selects[] = 'd.dept_code as department_code';
        }
        if ($this->hasTable('departments') && $this->hasColumn('departments', 'dept_name')) {
            $selects[] = 'd.dept_name as department_name';
        }

        return $selects;
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

    private function supportRequestsBaseQuery()
    {
        $query = DB::table('support_requests as sr');

        if ($this->hasTable('support_service_groups')) {
            $query->leftJoin('support_service_groups as ssg', 'sr.service_group_id', '=', 'ssg.id');
        }
        if ($this->hasTable('customers')) {
            $query->leftJoin('customers as c', 'sr.customer_id', '=', 'c.id');
        }
        if ($this->hasTable('projects')) {
            $query->leftJoin('projects as p', 'sr.project_id', '=', 'p.id');
        }
        if ($this->hasTable('products')) {
            $query->leftJoin('products as pr', 'sr.product_id', '=', 'pr.id');
        }
        if ($this->hasTable('internal_users')) {
            $query->leftJoin('internal_users as iu', 'sr.assignee_id', '=', 'iu.id');
        }

        return $query;
    }

    private function supportRequestSelectColumns(): array
    {
        $selects = [];

        foreach ([
            'id',
            'ticket_code',
            'summary',
            'service_group_id',
            'project_item_id',
            'customer_id',
            'project_id',
            'product_id',
            'reporter_name',
            'assignee_id',
            'status',
            'priority',
            'requested_date',
            'due_date',
            'resolved_date',
            'hotfix_date',
            'noti_date',
            'task_link',
            'change_log',
            'test_note',
            'notes',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
            'deleted_at',
        ] as $column) {
            if ($this->hasColumn('support_requests', $column)) {
                $selects[] = "sr.{$column} as {$column}";
            }
        }

        if ($this->hasTable('support_service_groups')) {
            if ($this->hasColumn('support_service_groups', 'group_name')) {
                $selects[] = 'ssg.group_name as service_group_name';
            }
            if ($this->hasColumn('support_service_groups', 'is_active')) {
                $selects[] = 'ssg.is_active as service_group_is_active';
            }
        }

        if ($this->hasTable('customers')) {
            if ($this->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
            if ($this->hasColumn('customers', 'company_name')) {
                $selects[] = 'c.company_name as customer_company_name';
            }
        }

        if ($this->hasTable('projects')) {
            if ($this->hasColumn('projects', 'project_code')) {
                $selects[] = 'p.project_code as project_code';
            }
            if ($this->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
        }

        if ($this->hasTable('products')) {
            if ($this->hasColumn('products', 'product_code')) {
                $selects[] = 'pr.product_code as product_code';
            }
            if ($this->hasColumn('products', 'product_name')) {
                $selects[] = 'pr.product_name as product_name';
            }
        }

        if ($this->hasTable('internal_users')) {
            if ($this->hasColumn('internal_users', 'full_name')) {
                $selects[] = 'iu.full_name as assignee_name';
            }
            if ($this->hasColumn('internal_users', 'username')) {
                $selects[] = 'iu.username as assignee_username';
            }
            if ($this->hasColumn('internal_users', 'user_code')) {
                $selects[] = 'iu.user_code as assignee_code';
            }
        }

        return $selects;
    }

    private function projectItemSelectColumns(): array
    {
        $selects = [];

        foreach ([
            'id',
            'project_id',
            'product_id',
            'quantity',
            'unit_price',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
            'deleted_at',
        ] as $column) {
            if ($this->hasColumn('project_items', $column)) {
                $selects[] = "pi.{$column} as {$column}";
            }
        }

        if ($this->hasTable('projects')) {
            if ($this->hasColumn('projects', 'project_code')) {
                $selects[] = 'p.project_code as project_code';
            }
            if ($this->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
            if ($this->hasColumn('projects', 'customer_id')) {
                $selects[] = 'p.customer_id as customer_id';
            }
        }

        if ($this->hasTable('customers')) {
            if ($this->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
            if ($this->hasColumn('customers', 'company_name')) {
                $selects[] = 'c.company_name as customer_company_name';
            }
        }

        if ($this->hasTable('products')) {
            if ($this->hasColumn('products', 'product_code')) {
                $selects[] = 'pr.product_code as product_code';
            }
            if ($this->hasColumn('products', 'product_name')) {
                $selects[] = 'pr.product_name as product_name';
            }
        }

        return $selects;
    }

    private function resolveSupportProjectItemContext(int $projectItemId): ?array
    {
        if (! $this->hasTable('project_items')) {
            return null;
        }

        $query = DB::table('project_items as pi')
            ->where('pi.id', $projectItemId);

        if ($this->hasColumn('project_items', 'deleted_at')) {
            $query->whereNull('pi.deleted_at');
        }

        if ($this->hasTable('projects')) {
            $query->leftJoin('projects as p', 'pi.project_id', '=', 'p.id');
        }

        $selects = [];
        if ($this->hasColumn('project_items', 'id')) {
            $selects[] = 'pi.id as project_item_id';
        }
        if ($this->hasColumn('project_items', 'project_id')) {
            $selects[] = 'pi.project_id as project_id';
        }
        if ($this->hasColumn('project_items', 'product_id')) {
            $selects[] = 'pi.product_id as product_id';
        }
        if ($this->hasTable('projects') && $this->hasColumn('projects', 'customer_id')) {
            $selects[] = 'p.customer_id as customer_id';
        }

        $record = $query->select($selects)->first();
        if ($record === null) {
            return null;
        }

        $projectId = $this->parseNullableInt($record->project_id ?? null);
        $productId = $this->parseNullableInt($record->product_id ?? null);
        $customerId = $this->parseNullableInt($record->customer_id ?? null);
        if ($projectId === null || $productId === null || $customerId === null) {
            return null;
        }

        return [
            'project_item_id' => $this->parseNullableInt($record->project_item_id ?? null),
            'project_id' => $projectId,
            'product_id' => $productId,
            'customer_id' => $customerId,
        ];
    }

    private function loadSupportRequestById(int $id): ?array
    {
        if (! $this->hasTable('support_requests')) {
            return null;
        }

        $record = $this->supportRequestsBaseQuery()
            ->select($this->supportRequestSelectColumns())
            ->where('sr.id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportRequestRecord((array) $record);
    }

    private function loadSupportServiceGroupById(int $id): ?array
    {
        if (! $this->hasTable('support_service_groups')) {
            return null;
        }

        $record = DB::table('support_service_groups')
            ->select($this->selectColumns('support_service_groups', [
                'id',
                'group_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportServiceGroupRecord((array) $record);
    }

    private function normalizeSupportRequestStatus(string $status): string
    {
        $normalized = strtoupper(trim($status));
        return in_array($normalized, self::SUPPORT_REQUEST_STATUSES, true) ? $normalized : 'OPEN';
    }

    private function normalizeSupportRequestPriority(string $priority): string
    {
        $normalized = strtoupper(trim($priority));
        return in_array($normalized, self::SUPPORT_REQUEST_PRIORITIES, true) ? $normalized : 'MEDIUM';
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized !== '' ? $normalized : null;
    }

    private function filterPayloadByTableColumns(string $table, array $payload): array
    {
        $filtered = [];
        foreach ($payload as $column => $value) {
            if ($this->hasColumn($table, $column)) {
                $filtered[$column] = $value;
            }
        }

        return $filtered;
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        return DB::table($table)->where('id', $id)->exists();
    }

    private function resolveSupportHistoryActorId(?int $preferredActorId): ?int
    {
        if (! $this->hasTable('support_request_history') || ! $this->hasTable('internal_users')) {
            return null;
        }

        if ($preferredActorId !== null && $this->tableRowExists('internal_users', $preferredActorId)) {
            return $preferredActorId;
        }

        $fallback = DB::table('internal_users')->orderBy('id')->value('id');
        return $fallback !== null ? (int) $fallback : null;
    }

    private function insertSupportRequestHistoryRecord(
        int $requestId,
        ?string $oldStatus,
        string $newStatus,
        ?string $comment,
        ?int $actorId
    ): void {
        if (! $this->hasTable('support_request_history') || $actorId === null) {
            return;
        }

        $payload = $this->filterPayloadByTableColumns('support_request_history', [
            'request_id' => $requestId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'comment' => $comment,
            'created_by' => $actorId,
        ]);

        if ($this->hasColumn('support_request_history', 'created_at')) {
            $payload['created_at'] = now();
        }

        DB::table('support_request_history')->insert($payload);
    }

    private function serializeSupportServiceGroupRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'group_name' => (string) ($record['group_name'] ?? ''),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? false),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeProjectItemRecord(array $record): array
    {
        $projectCode = (string) ($record['project_code'] ?? '');
        $projectName = (string) ($record['project_name'] ?? '');
        $productCode = (string) ($record['product_code'] ?? '');
        $productName = (string) ($record['product_name'] ?? '');

        $projectPart = trim(($projectCode !== '' ? $projectCode.' - ' : '').$projectName);
        $productPart = trim(($productCode !== '' ? $productCode.' - ' : '').$productName);
        $displayName = trim($projectPart.($projectPart !== '' && $productPart !== '' ? ' | ' : '').$productPart);

        return [
            'id' => $record['id'] ?? null,
            'project_id' => $record['project_id'] ?? null,
            'project_code' => $record['project_code'] ?? null,
            'project_name' => $record['project_name'] ?? null,
            'customer_id' => $record['customer_id'] ?? null,
            'customer_code' => $record['customer_code'] ?? null,
            'customer_name' => $this->firstNonEmpty($record, ['customer_name', 'customer_company_name']),
            'product_id' => $record['product_id'] ?? null,
            'product_code' => $record['product_code'] ?? null,
            'product_name' => $record['product_name'] ?? null,
            'quantity' => isset($record['quantity']) ? (float) $record['quantity'] : null,
            'unit_price' => isset($record['unit_price']) ? (float) $record['unit_price'] : null,
            'display_name' => $displayName !== '' ? $displayName : ('Hạng mục #'.($record['id'] ?? '--')),
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'deleted_at' => $record['deleted_at'] ?? null,
        ];
    }

    private function serializeSupportRequestRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'ticket_code' => $record['ticket_code'] ?? null,
            'summary' => (string) ($record['summary'] ?? ''),
            'service_group_id' => $record['service_group_id'] ?? null,
            'service_group_name' => $record['service_group_name'] ?? null,
            'project_item_id' => $record['project_item_id'] ?? null,
            'customer_id' => $record['customer_id'] ?? null,
            'customer_code' => $record['customer_code'] ?? null,
            'customer_name' => $this->firstNonEmpty($record, ['customer_name', 'customer_company_name']),
            'project_id' => $record['project_id'] ?? null,
            'project_code' => $record['project_code'] ?? null,
            'project_name' => $record['project_name'] ?? null,
            'product_id' => $record['product_id'] ?? null,
            'product_code' => $record['product_code'] ?? null,
            'product_name' => $record['product_name'] ?? null,
            'reporter_name' => $record['reporter_name'] ?? null,
            'assignee_id' => $record['assignee_id'] ?? null,
            'assignee_name' => $record['assignee_name'] ?? null,
            'assignee_username' => $record['assignee_username'] ?? null,
            'assignee_code' => $record['assignee_code'] ?? null,
            'status' => $this->normalizeSupportRequestStatus((string) ($record['status'] ?? 'OPEN')),
            'priority' => $this->normalizeSupportRequestPriority((string) ($record['priority'] ?? 'MEDIUM')),
            'requested_date' => $record['requested_date'] ?? null,
            'due_date' => $record['due_date'] ?? null,
            'resolved_date' => $record['resolved_date'] ?? null,
            'hotfix_date' => $record['hotfix_date'] ?? null,
            'noti_date' => $record['noti_date'] ?? null,
            'task_link' => $record['task_link'] ?? null,
            'change_log' => $record['change_log'] ?? null,
            'test_note' => $record['test_note'] ?? null,
            'notes' => $record['notes'] ?? null,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
            'deleted_at' => $record['deleted_at'] ?? null,
        ];
    }

    private function serializeSupportRequestHistoryRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'request_id' => $record['request_id'] ?? null,
            'old_status' => $record['old_status'] !== null
                ? $this->normalizeSupportRequestStatus((string) $record['old_status'])
                : null,
            'new_status' => $this->normalizeSupportRequestStatus((string) ($record['new_status'] ?? 'OPEN')),
            'comment' => $record['comment'] ?? null,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'created_by_name' => $record['created_by_name'] ?? null,
            'created_by_username' => $record['created_by_username'] ?? null,
            'ticket_code' => $record['ticket_code'] ?? null,
            'request_summary' => $record['request_summary'] ?? null,
        ];
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

    private function resolveEmployeeDepartmentColumn(?string $employeeTable): ?string
    {
        if ($employeeTable === null) {
            return null;
        }

        if ($this->hasColumn($employeeTable, 'department_id')) {
            return 'department_id';
        }

        if ($this->hasColumn($employeeTable, 'dept_id')) {
            return 'dept_id';
        }

        return null;
    }

    private function countEmployeesByDepartment(int $departmentId, string $employeeTable, string $departmentColumn): int
    {
        if ($departmentId <= 0 || ! $this->hasTable($employeeTable) || ! $this->hasColumn($employeeTable, $departmentColumn)) {
            return 0;
        }

        return (int) DB::table($employeeTable)
            ->where($departmentColumn, $departmentId)
            ->count();
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

    private function canonicalDepartmentCode(string $deptCode): string
    {
        $trimmed = trim($deptCode);
        if ($this->isRootDepartmentCode($trimmed)) {
            return self::ROOT_DEPARTMENT_CODE;
        }

        return $trimmed;
    }

    private function isRootDepartmentCode(string $deptCode): bool
    {
        $normalized = function_exists('mb_strtoupper')
            ? mb_strtoupper(trim($deptCode), 'UTF-8')
            : strtoupper(trim($deptCode));
        $normalized = str_replace([' ', '-', '_'], '', $normalized);

        return in_array($normalized, [self::ROOT_DEPARTMENT_CODE, 'BGDVT'], true);
    }

    private function resolveRootDepartment(?int $excludeDepartmentId = null): ?Department
    {
        $departments = Department::query()
            ->select(['id', 'dept_code', 'parent_id'])
            ->when($excludeDepartmentId !== null, fn ($query) => $query->where('id', '!=', $excludeDepartmentId))
            ->orderBy('id')
            ->get();

        foreach ($departments as $department) {
            if ($this->isRootDepartmentCode((string) $department->dept_code)) {
                return $department;
            }
        }

        return null;
    }

    /**
     * @return array{0:?int,1:?string}
     */
    private function resolveDepartmentParentIdForWrite(string $deptCode, ?int $parentId, ?int $currentDepartmentId): array
    {
        if ($this->isRootDepartmentCode($deptCode)) {
            if ($parentId !== null) {
                return [null, 'Phòng ban BGĐVT không được có phòng ban cha.'];
            }

            return [null, null];
        }

        $rootDepartment = $this->resolveRootDepartment($currentDepartmentId);
        if (! $rootDepartment instanceof Department) {
            return [null, 'Không tìm thấy phòng ban gốc BGĐVT. Vui lòng tạo phòng ban BGĐVT trước.'];
        }

        $rootId = (int) $rootDepartment->id;
        if ($parentId !== null && $parentId !== $rootId) {
            return [null, 'Phòng ban cha phải là Ban giám đốc Viễn Thông (BGĐVT).'];
        }

        return [$rootId, null];
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
