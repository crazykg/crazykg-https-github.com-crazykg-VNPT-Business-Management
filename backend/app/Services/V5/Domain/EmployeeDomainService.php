<?php

namespace App\Services\V5\Domain;

use App\Models\Department;
use App\Models\InternalUser;
use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use App\Support\Http\ResolvesValidatedInput;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeDomainService
{
    use ResolvesValidatedInput;

    private const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    private const EMPLOYEE_INPUT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'TRANSFERRED'];
    private const EMPLOYEE_MIN_AGE_EXCLUSIVE = 20;
    private const EMPLOYEE_MAX_AGE_EXCLUSIVE = 66;
    private const EMPLOYEE_DELETE_REFERENCE_TABLES = [
        'employee_party_profiles' => ['employee_id', 'created_by', 'updated_by'],
        'audit_logs' => ['created_by'],
        'documents' => ['created_by', 'updated_by'],
        'projects' => ['created_by', 'updated_by'],
        'contracts' => ['created_by', 'updated_by'],
        'feedback_requests' => ['created_by', 'updated_by'],
        'feedback_responses' => ['created_by'],
        'shared_timesheets' => ['created_by', 'updated_by'],
        'shared_issues' => ['created_by', 'updated_by'],
        'project_procedures' => ['created_by', 'updated_by'],
        'project_procedure_steps' => ['created_by', 'updated_by'],
        'project_procedure_step_worklogs' => ['created_by'],
        'project_procedure_raci' => ['user_id', 'created_by', 'updated_by'],
        'project_procedure_step_raci' => ['user_id', 'created_by', 'updated_by'],
        'department_weekly_schedules' => ['created_by', 'updated_by'],
        'department_weekly_schedule_entries' => ['created_by', 'updated_by'],
        'department_weekly_schedule_entry_participants' => ['user_id'],
        'customer_request_cases' => ['created_by', 'received_by_user_id', 'dispatcher_user_id', 'performer_user_id', 'estimated_by_user_id'],
        'customer_request_estimates' => ['estimated_by_user_id', 'created_by', 'updated_by'],
        'customer_request_pending_dispatch' => ['created_by', 'updated_by'],
        'customer_request_dispatched' => ['performer_user_id', 'created_by', 'updated_by'],
        'customer_request_coding' => ['developer_user_id', 'created_by', 'updated_by'],
        'customer_request_plans' => ['dispatcher_user_id', 'created_by', 'updated_by'],
        'customer_request_plan_items' => ['performer_user_id', 'created_by', 'updated_by'],
        'customer_request_escalations' => ['raised_by_user_id', 'proposed_handler_user_id', 'reviewed_by_user_id'],
        'customer_request_dms_transfer' => ['dms_contact_user_id', 'created_by', 'updated_by'],
        'customer_request_worklogs' => ['created_by', 'updated_by'],
        'raci_assignments' => ['user_id', 'created_by', 'updated_by'],
        'opportunity_raci_assignments' => ['user_id', 'created_by', 'updated_by'],
        'leadership_directives' => ['issued_by_user_id', 'assigned_to_user_id', 'created_by', 'updated_by'],
        'invoices' => ['created_by', 'updated_by'],
        'receipts' => ['created_by', 'updated_by'],
        'dunning_logs' => ['created_by'],
        'revenue_targets' => ['created_by', 'updated_by'],
        'async_exports' => ['requested_by'],
    ];
    private const EMPLOYEE_DELETE_REFERENCE_LABELS = [
        'employee_party_profiles' => 'hồ sơ đảng viên',
        'audit_logs' => 'nhật ký hệ thống',
        'documents' => 'hồ sơ tài liệu',
        'projects' => 'dự án',
        'contracts' => 'hợp đồng',
        'feedback_requests' => 'góp ý',
        'feedback_responses' => 'phản hồi góp ý',
        'shared_timesheets' => 'timesheet',
        'shared_issues' => 'issue công việc',
        'project_procedures' => 'quy trình dự án',
        'project_procedure_steps' => 'bước quy trình dự án',
        'project_procedure_step_worklogs' => 'nhật ký bước quy trình',
        'project_procedure_raci' => 'phân công RACI dự án',
        'project_procedure_step_raci' => 'phân công RACI bước quy trình',
        'department_weekly_schedules' => 'lịch tuần phòng ban',
        'department_weekly_schedule_entries' => 'chi tiết lịch tuần phòng ban',
        'department_weekly_schedule_entry_participants' => 'thành phần lịch tuần phòng ban',
        'customer_request_cases' => 'yêu cầu khách hàng',
        'customer_request_estimates' => 'estimate yêu cầu khách hàng',
        'customer_request_pending_dispatch' => 'bản ghi chờ điều phối',
        'customer_request_dispatched' => 'bản ghi điều phối',
        'customer_request_coding' => 'ghi nhận coding',
        'customer_request_plans' => 'kế hoạch xử lý yêu cầu',
        'customer_request_plan_items' => 'đầu việc kế hoạch yêu cầu',
        'customer_request_escalations' => 'escalation yêu cầu',
        'customer_request_dms_transfer' => 'luồng chuyển DMS',
        'customer_request_worklogs' => 'nhật ký xử lý yêu cầu',
        'raci_assignments' => 'phân công RACI',
        'opportunity_raci_assignments' => 'phân công RACI cơ hội',
        'leadership_directives' => 'chỉ đạo điều hành',
        'invoices' => 'hóa đơn',
        'receipts' => 'phiếu thu',
        'dunning_logs' => 'nhật ký nhắc nợ',
        'revenue_targets' => 'chỉ tiêu doanh thu',
        'async_exports' => 'lịch sử xuất dữ liệu',
    ];

    public function __construct(
        private readonly V5DomainSupportService $support
    ) {}

    public function index(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $query = $employeeModel::query()
            ->with(['department' => fn ($query) => $query->select($this->support->departmentRelationColumns())])
            ->select($this->support->selectColumns($employeeTable, [
                'id',
                'uuid',
                'username',
                'user_code',
                'full_name',
                'phone',
                'phone_number',
                'mobile',
                'telechatbot',
                'email',
                'gmail',
                'status',
                'department_id',
                'dept_id',
                'position_id',
                'job_title_raw',
                'date_of_birth',
                'leave_date',
                'gender',
                'vpn_status',
                'ip_address',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        if ($this->support->hasTable('positions')) {
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
                        $departmentColumn = $this->support->hasColumn($employeeTable, 'department_id')
                            ? 'department_id'
                            : ($this->support->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);

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

        $search = trim((string) ($this->support->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($employeeTable, $like): void {
                $builder->whereRaw('1 = 0');

                foreach (['user_code', 'username', 'full_name', 'phone', 'phone_number', 'mobile', 'email', 'gmail', 'job_title_raw'] as $column) {
                    if ($this->support->hasColumn($employeeTable, $column)) {
                        $builder->orWhere("{$employeeTable}.{$column}", 'like', $like);
                    }
                }
            });
        }

        $status = strtoupper(trim((string) ($this->support->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::EMPLOYEE_STATUSES, true) && $this->support->hasColumn($employeeTable, 'status')) {
            $query->where("{$employeeTable}.status", $status);
        }

        $email = trim((string) ($this->support->readFilterParam($request, 'email', '') ?? ''));
        if ($email !== '' && $this->support->hasColumn($employeeTable, 'email')) {
            $query->where("{$employeeTable}.email", 'like', '%'.$email.'%');
        }

        $departmentFilter = $this->support->parseNullableInt($this->support->readFilterParam($request, 'department_id'));
        if ($departmentFilter !== null) {
            $departmentColumn = $this->support->hasColumn($employeeTable, 'department_id')
                ? 'department_id'
                : ($this->support->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);
            if ($departmentColumn !== null) {
                $query->where("{$employeeTable}.{$departmentColumn}", $departmentFilter);
            }
        }

        $sortColumns = [
            'id' => "{$employeeTable}.id",
            'user_code' => "{$employeeTable}.user_code",
            'username' => "{$employeeTable}.username",
            'full_name' => "{$employeeTable}.full_name",
            'email' => "{$employeeTable}.email",
            'status' => "{$employeeTable}.status",
            'department_id' => "{$employeeTable}.department_id",
            'created_at' => "{$employeeTable}.created_at",
        ];
        if ($this->support->hasColumn($employeeTable, 'gmail')) {
            $sortColumns['gmail'] = "{$employeeTable}.gmail";
        }
        if ($this->support->hasColumn($employeeTable, 'phone_number')) {
            $sortColumns['phone_number'] = "{$employeeTable}.phone_number";
        }

        $sortBy = $this->support->resolveSortColumn($request, $sortColumns, "{$employeeTable}.id");
        $sortDir = $this->support->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== "{$employeeTable}.id" && $this->support->hasColumn($employeeTable, 'id')) {
            $query->orderBy("{$employeeTable}.id", 'asc');
        }

        if ($this->support->shouldPaginate($request)) {
            [$page, $perPage] = $this->support->resolvePaginationParams($request, 10, 200);
            if ($this->support->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->support->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->support->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->support->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();

        $rules = [
            'uuid' => ['nullable', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:100'],
            'user_code' => ['nullable', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'gmail' => ['nullable', 'email', 'max:255', 'regex:/^[^@\s]+@gmail\.com$/i'],
            'status' => ['nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['required', 'integer'],
            'position_id' => ['nullable', 'integer'],
            'job_title_raw' => ['nullable', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'leave_date' => ['nullable', 'date'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'telechatbot' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid');
        }
        if ($this->support->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username');
        }
        if ($this->support->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][0] = 'required';
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code');
        }
        if ($this->support->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email');
        }
        if ($this->support->hasColumn($employeeTable, 'gmail')) {
            $rules['gmail'][] = Rule::unique($employeeTable, 'gmail');
        }

        $validated = $this->validatedInput($request, $rules);
        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();

            return response()->json([
                'message' => $message,
                'errors' => [
                    'date_of_birth' => [$message],
                ],
            ], 422);
        }

        $requestedStatus = strtoupper(trim((string) ($validated['status'] ?? 'ACTIVE')));
        $requestedLeaveDate = $this->normalizeEmployeeLeaveDate($validated['leave_date'] ?? null);
        if ($requestedStatus === 'INACTIVE' && $requestedLeaveDate === null) {
            return $this->employeeLeaveDateRequiredResponse();
        }
        $resolvedStatus = $this->toEmployeeStorageStatus((string) ($validated['status'] ?? 'ACTIVE'));
        $effectiveLeaveDate = $this->resolveEmployeeLeaveDateForPersistence($resolvedStatus, $requestedLeaveDate);

        $departmentId = $this->support->parseNullableInt($validated['department_id'] ?? null);
        if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
            return response()->json(['message' => 'department_id is invalid.'], 422);
        }

        $employee = new $employeeModel();
        $uuid = $validated['uuid'] ?? (string) Str::uuid();
        $username = (string) ($validated['username'] ?? $validated['user_code'] ?? '');
        $employeeCode = (string) ($validated['user_code'] ?? $validated['username'] ?? '');
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'uuid', $uuid);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'username', $username);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'user_code', $employeeCode);
        $this->support->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        $this->support->setAttributeIfColumn(
            $employee,
            $employeeTable,
            'gmail',
            $this->support->normalizeNullableString($validated['gmail'] ?? null)
        );
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->support->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->support->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
        }
        if (array_key_exists('telechatbot', $validated)) {
            $this->support->setAttributeIfColumn(
                $employee,
                $employeeTable,
                'telechatbot',
                $this->support->normalizeNullableString($validated['telechatbot'])
            );
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'status', $resolvedStatus);
        $this->support->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);

        $positionRaw = $validated['position_id'] ?? null;
        $positionId = $this->support->parseNullableInt($positionRaw);
        if ($this->support->hasColumn($employeeTable, 'position_id')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
        } elseif ($this->support->hasColumn($employeeTable, 'job_title_raw')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
        }

        if (array_key_exists('job_title_raw', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'leave_date', $effectiveLeaveDate);
        if (array_key_exists('gender', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }
        if ($this->support->hasColumn($employeeTable, 'data_scope')) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope'] ?? null);
        }

        $temporaryPassword = null;
        if ($this->support->hasColumn($employeeTable, 'password')) {
            $temporaryPassword = $this->generateTemporaryPassword();
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'password', Hash::make($temporaryPassword));
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'must_change_password', 1);
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'password_reset_required_at', now());
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'password_changed_at', null);

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi luu.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        $responsePayload = [
            'data' => $this->serializeEmployee($freshEmployee),
        ];
        if ($temporaryPassword !== null) {
            $responsePayload['provisioning'] = [
                'temporary_password' => $temporaryPassword,
                'must_change_password' => true,
                'delivery' => 'one_time',
            ];
        }

        return response()->json($responsePayload, 201);
    }

    public function storeBulk(Request $request): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];
        $updated = [];
        $employeeModel = $this->resolveEmployeeModelClass();

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $normalizedPayload = $this->sanitizeImportedEmployeeBulkPayload((array) $itemPayload);
                $employeeCode = $this->support->normalizeNullableString($normalizedPayload['user_code'] ?? null);
                if ($employeeCode === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Mã nhân viên là bắt buộc.',
                    ];
                    continue;
                }

                $existingEmployee = $employeeModel::query()
                    ->whereRaw('UPPER(user_code) = ?', [strtoupper($employeeCode)])
                    ->first();

                if ($existingEmployee instanceof Model) {
                    $subRequest = Request::create(
                        sprintf('/api/v5/internal-users/%s', $existingEmployee->getKey()),
                        'PUT',
                        $this->buildImportedEmployeeUpdatePayload($normalizedPayload)
                    );
                    $subRequest->setUserResolver(fn () => $request->user());
                    $response = $this->update($subRequest, (int) $existingEmployee->getKey());
                    $operation = 'updated';
                } else {
                    $subRequest = Request::create(
                        '/api/v5/internal-users',
                        'POST',
                        $this->buildImportedEmployeeCreatePayload($normalizedPayload)
                    );
                    $subRequest->setUserResolver(fn () => $request->user());
                    $response = $this->store($subRequest);
                    $operation = 'created';
                }

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Khong the luu nhan su tu file import.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                $provisioning = is_array($payload['provisioning'] ?? null) ? $payload['provisioning'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Khong the doc phan hoi khi tao nhan su.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                    'provisioning' => $provisioning,
                    'operation' => $operation,
                ];
                if ($operation === 'created') {
                    $created[] = $record;
                } else {
                    $updated[] = $record;
                }
            } catch (ValidationException $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => $this->firstValidationMessage($exception),
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'index' => (int) $index,
                    'success' => false,
                    'message' => 'Không thể lưu nhân sự từ file import.',
                ];
            }
        }

        $failedCount = count(array_filter(
            $results,
            fn (array $item): bool => ($item['success'] ?? false) !== true
        ));

        return response()->json([
            'data' => [
                'results' => array_values($results),
                'created' => array_values($created),
                'updated' => array_values($updated),
                'created_count' => count($created),
                'updated_count' => count($updated),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 && $updated === [] ? 201 : 200);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function sanitizeImportedEmployeeBulkPayload(array $payload): array
    {
        $normalized = [];

        foreach (['uuid', 'user_code', 'username', 'full_name', 'email', 'gmail', 'job_title_raw', 'date_of_birth', 'leave_date', 'ip_address', 'telechatbot'] as $field) {
            if (! array_key_exists($field, $payload)) {
                continue;
            }

            $value = $this->support->normalizeNullableString($payload[$field]);
            if ($value === null) {
                continue;
            }

            $normalized[$field] = $field === 'user_code'
                ? $this->normalizeEmployeeCode($value, null)
                : $value;
        }

        foreach (['department_id', 'position_id'] as $field) {
            if (! array_key_exists($field, $payload)) {
                continue;
            }

            $value = $this->support->parseNullableInt($payload[$field]);
            if ($value !== null) {
                $normalized[$field] = $value;
            }
        }

        foreach (['status', 'gender', 'vpn_status'] as $field) {
            if (! array_key_exists($field, $payload)) {
                continue;
            }

            $value = $this->support->normalizeNullableString($payload[$field]);
            if ($value !== null) {
                $normalized[$field] = strtoupper($value);
            }
        }

        if (
            array_key_exists('phone_number', $payload)
            || array_key_exists('phone', $payload)
            || array_key_exists('mobile', $payload)
        ) {
            $normalizedPhone = $this->support->normalizeNullableString(
                $payload['phone_number'] ?? $payload['phone'] ?? $payload['mobile'] ?? null
            );
            if ($normalizedPhone !== null) {
                $normalized['phone_number'] = $normalizedPhone;
                $normalized['phone'] = $normalizedPhone;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function buildImportedEmployeeCreatePayload(array $payload): array
    {
        $employeeCode = (string) ($payload['user_code'] ?? '');
        if ($employeeCode === '') {
            return $payload;
        }

        $createPayload = $payload;
        $createPayload['user_code'] = $employeeCode;
        $createPayload['username'] = (string) ($payload['username'] ?? strtolower($employeeCode));
        $createPayload['full_name'] = (string) ($payload['full_name'] ?? $employeeCode);
        $createPayload['email'] = (string) ($payload['email'] ?? $this->buildImportedEmployeeFallbackEmail($employeeCode));

        if (! array_key_exists('department_id', $createPayload)) {
            $fallbackDepartmentId = $this->resolveImportedEmployeeFallbackDepartmentId();
            if ($fallbackDepartmentId !== null) {
                $createPayload['department_id'] = $fallbackDepartmentId;
            }
        }

        return $createPayload;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function buildImportedEmployeeUpdatePayload(array $payload): array
    {
        return $payload;
    }

    private function resolveImportedEmployeeFallbackDepartmentId(): ?int
    {
        $departments = Department::query()
            ->select(['id', 'dept_code'])
            ->orderBy('id')
            ->get();

        foreach ($departments as $department) {
            if ($this->support->isRootDepartmentCode((string) $department->dept_code)) {
                return (int) $department->id;
            }
        }

        $firstDepartment = $departments->first();

        return $firstDepartment instanceof Department
            ? (int) $firstDepartment->id
            : null;
    }

    private function buildImportedEmployeeFallbackEmail(string $employeeCode): string
    {
        return strtolower($employeeCode).'@import.local';
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);

        $rules = [
            'uuid' => ['sometimes', 'nullable', 'string', 'max:100'],
            'username' => ['sometimes', 'required', 'string', 'max:100'],
            'user_code' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^(VNPT|CTV)\d{5,}$/i'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'gmail' => ['sometimes', 'nullable', 'email', 'max:255', 'regex:/^[^@\s]+@gmail\.com$/i'],
            'status' => ['sometimes', 'nullable', Rule::in(self::EMPLOYEE_INPUT_STATUSES)],
            'department_id' => ['sometimes', 'required', 'integer'],
            'position_id' => ['sometimes', 'nullable', 'integer'],
            'job_title_raw' => ['sometimes', 'nullable', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'leave_date' => ['sometimes', 'nullable', 'date'],
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'telechatbot' => ['sometimes', 'nullable', 'string', 'max:255'],
            'gender' => ['sometimes', 'nullable', Rule::in(['MALE', 'FEMALE', 'OTHER'])],
            'vpn_status' => ['sometimes', 'nullable', Rule::in(['YES', 'NO'])],
            'ip_address' => ['sometimes', 'nullable', 'string', 'max:45'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->support->hasColumn($employeeTable, 'uuid')) {
            $rules['uuid'][] = Rule::unique($employeeTable, 'uuid')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'username')) {
            $rules['username'][] = Rule::unique($employeeTable, 'username')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'user_code')) {
            $rules['user_code'][] = Rule::unique($employeeTable, 'user_code')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'email')) {
            $rules['email'][] = Rule::unique($employeeTable, 'email')->ignore($employee->id);
        }
        if ($this->support->hasColumn($employeeTable, 'gmail')) {
            $rules['gmail'][] = Rule::unique($employeeTable, 'gmail')->ignore($employee->id);
        }

        $validated = $this->validatedInput($request, $rules);
        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();

            return response()->json([
                'message' => $message,
                'errors' => [
                    'date_of_birth' => [$message],
                ],
            ], 422);
        }

        $requestedStatus = array_key_exists('status', $validated)
            ? strtoupper(trim((string) $validated['status']))
            : null;
        $currentLeaveDate = $this->normalizeEmployeeLeaveDate($employee->getAttribute('leave_date'));
        $requestedLeaveDate = array_key_exists('leave_date', $validated)
            ? $this->normalizeEmployeeLeaveDate($validated['leave_date'])
            : $currentLeaveDate;
        if ($requestedStatus === 'INACTIVE' && $requestedLeaveDate === null) {
            return $this->employeeLeaveDateRequiredResponse();
        }
        $resolvedStatus = array_key_exists('status', $validated)
            ? $this->toEmployeeStorageStatus((string) $validated['status'])
            : $this->toEmployeeStorageStatus((string) ($employee->getAttribute('status') ?? 'ACTIVE'));
        $effectiveLeaveDate = $this->resolveEmployeeLeaveDateForPersistence($resolvedStatus, $requestedLeaveDate);

        if (array_key_exists('department_id', $validated)) {
            $departmentId = $this->support->parseNullableInt($validated['department_id']);
            if ($departmentId === null || ! Department::query()->whereKey($departmentId)->exists()) {
                return response()->json(['message' => 'department_id is invalid.'], 422);
            }
            $this->support->setAttributeByColumns($employee, $employeeTable, ['department_id', 'dept_id'], $departmentId);
        } else {
            $currentDepartmentId = $this->support->parseNullableInt((string) $this->support->firstNonEmpty(
                $employee->toArray(),
                ['department_id', 'dept_id']
            ));
            if ($currentDepartmentId === null || ! Department::query()->whereKey($currentDepartmentId)->exists()) {
                return response()->json(['message' => 'department_id is required.'], 422);
            }
        }

        if (array_key_exists('uuid', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'uuid', $validated['uuid']);
        }
        if (array_key_exists('username', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'username', $validated['username']);
        }
        if (array_key_exists('user_code', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'user_code', $validated['user_code']);
        }
        if (array_key_exists('full_name', $validated)) {
            $this->support->setAttributeByColumns($employee, $employeeTable, ['full_name'], $validated['full_name']);
        }
        if (array_key_exists('email', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'email', $validated['email']);
        }
        if (array_key_exists('gmail', $validated)) {
            $this->support->setAttributeIfColumn(
                $employee,
                $employeeTable,
                'gmail',
                $this->support->normalizeNullableString($validated['gmail'])
            );
        }
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->support->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->support->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
        }
        if (array_key_exists('telechatbot', $validated)) {
            $this->support->setAttributeIfColumn(
                $employee,
                $employeeTable,
                'telechatbot',
                $this->support->normalizeNullableString($validated['telechatbot'])
            );
        }
        if (array_key_exists('status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'status', $resolvedStatus);
        }
        if (array_key_exists('position_id', $validated)) {
            $positionRaw = $validated['position_id'];
            $positionId = $this->support->parseNullableInt($positionRaw);

            if ($this->support->hasColumn($employeeTable, 'position_id')) {
                $this->support->setAttributeIfColumn($employee, $employeeTable, 'position_id', $positionId);
            } elseif ($this->support->hasColumn($employeeTable, 'job_title_raw')) {
                $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $positionRaw);
            }
        }
        if (array_key_exists('job_title_raw', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'job_title_raw', $validated['job_title_raw']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'date_of_birth', $validated['date_of_birth']);
        }
        $this->support->setAttributeIfColumn($employee, $employeeTable, 'leave_date', $effectiveLeaveDate);
        if (array_key_exists('gender', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'gender', $validated['gender']);
        }
        if (array_key_exists('vpn_status', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'vpn_status', $validated['vpn_status']);
        }
        if (array_key_exists('ip_address', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'ip_address', $validated['ip_address']);
        }
        if ($this->support->hasColumn($employeeTable, 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->support->setAttributeIfColumn($employee, $employeeTable, 'data_scope', $validated['data_scope']);
        }

        DB::transaction(function () use ($employee): void {
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi cap nhat.');
        }

        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        $employee = $employeeModel::query()->findOrFail($id);

        $dependencyLabels = $this->findEmployeeDeletionDependencyLabels((int) $employee->getKey(), $employeeTable);
        if ($dependencyLabels !== []) {
            return response()->json([
                'message' => $this->buildEmployeeDeleteBlockedMessage($dependencyLabels),
            ], 422);
        }

        try {
            DB::transaction(function () use ($employee): void {
                $employee->delete();
            });

            return response()->json(['message' => 'Employee deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Nhân sự đã phát sinh dữ liệu liên quan trong hệ thống và không thể xóa.',
            ], 422);
        }
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->support->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->support->missingTable('internal_users');
        }
        if (! $this->support->hasColumn($employeeTable, 'password')) {
            return response()->json(['message' => 'Employee password column is not available.'], 422);
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        /** @var Model $employee */
        $employee = $employeeModel::query()->findOrFail($id);

        $temporaryPassword = $this->generateTemporaryPassword();
        $updates = [
            'password' => Hash::make($temporaryPassword),
        ];
        if ($this->support->hasColumn($employeeTable, 'must_change_password')) {
            $updates['must_change_password'] = 1;
        }
        if ($this->support->hasColumn($employeeTable, 'password_reset_required_at')) {
            $updates['password_reset_required_at'] = now();
        }
        if ($this->support->hasColumn($employeeTable, 'password_changed_at')) {
            $updates['password_changed_at'] = null;
        }

        $updatedById = $request->user() instanceof InternalUser ? (int) $request->user()->id : null;
        if ($updatedById !== null && $this->support->hasColumn($employeeTable, 'updated_by')) {
            $updates['updated_by'] = $updatedById;
        }

        DB::transaction(function () use ($employee, $updates): void {
            foreach ($updates as $column => $value) {
                $employee->setAttribute($column, $value);
            }
            $employee->save();
        });

        $freshEmployee = $employee->fresh();
        if (! $freshEmployee instanceof Model) {
            throw new \RuntimeException('Khong the tai lai du lieu nhan su sau khi reset mat khau.');
        }
        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ]);
        if ($this->support->hasTable('positions')) {
            $freshEmployee->load(['position' => fn ($query) => $query->select($this->positionRelationColumns())]);
        }

        return response()->json([
            'data' => $this->serializeEmployee($freshEmployee),
            'provisioning' => [
                'temporary_password' => $temporaryPassword,
                'must_change_password' => true,
                'delivery' => 'one_time',
            ],
        ]);
    }

    /**
     * @return class-string<Model>
     */
    private function resolveEmployeeModelClass(): string
    {
        return InternalUser::class;
    }

    /**
     * @return array<int, string>
     */
    private function positionRelationColumns(): array
    {
        return $this->support->selectColumns('positions', ['id', 'pos_code', 'pos_name']);
    }

    /**
     * @return list<string>
     */
    private function findEmployeeDeletionDependencyLabels(int $employeeId, string $employeeTable): array
    {
        $targets = $this->collectEmployeeDeletionReferenceTargets($employeeTable);
        $labels = [];

        foreach ($targets as $target) {
            $table = (string) ($target['table'] ?? '');
            $columns = array_values(array_filter(
                array_map('strval', (array) ($target['columns'] ?? [])),
                static fn (string $column): bool => $column !== ''
            ));
            if ($table === '' || $columns === []) {
                continue;
            }

            $query = DB::table($table)->where(function ($builder) use ($columns, $employeeId): void {
                foreach ($columns as $index => $column) {
                    if ($index === 0) {
                        $builder->where($column, $employeeId);
                    } else {
                        $builder->orWhere($column, $employeeId);
                    }
                }
            });

            if ($query->exists()) {
                $labels[] = (string) ($target['label'] ?? $this->humanizeReferenceTableName($table));
            }
        }

        return array_values(array_unique(array_filter($labels)));
    }

    /**
     * @return list<array{table:string,columns:list<string>,label:string}>
     */
    private function collectEmployeeDeletionReferenceTargets(string $employeeTable): array
    {
        $schema = DB::connection()->getSchemaBuilder();
        $targets = [];
        $normalizedEmployeeTable = strtolower($employeeTable);

        foreach ($schema->getTables() as $tableMeta) {
            $tableName = (string) ($tableMeta['name'] ?? '');
            if ($tableName === '' || strtolower($tableName) === $normalizedEmployeeTable) {
                continue;
            }

            try {
                $foreignKeys = $schema->getForeignKeys($tableName);
            } catch (\Throwable) {
                $foreignKeys = [];
            }

            foreach ($foreignKeys as $foreignKey) {
                $foreignTable = strtolower((string) ($foreignKey['foreign_table'] ?? ''));
                if ($foreignTable !== $normalizedEmployeeTable) {
                    continue;
                }

                $this->mergeEmployeeDeletionReferenceTarget(
                    $targets,
                    $tableName,
                    array_values(array_filter(
                        array_map('strval', (array) ($foreignKey['columns'] ?? [])),
                        static fn (string $column): bool => $column !== ''
                    ))
                );
            }
        }

        foreach (self::EMPLOYEE_DELETE_REFERENCE_TABLES as $table => $columns) {
            if (! $this->support->hasTable($table)) {
                continue;
            }

            $existingColumns = array_values(array_filter(
                $columns,
                fn (string $column): bool => $this->support->hasColumn($table, $column)
            ));

            if ($existingColumns === []) {
                continue;
            }

            $this->mergeEmployeeDeletionReferenceTarget($targets, $table, $existingColumns);
        }

        return array_values(array_map(function (array $target): array {
            $columns = array_keys($target['columns'] ?? []);
            sort($columns);

            return [
                'table' => (string) $target['table'],
                'columns' => $columns,
                'label' => (string) $target['label'],
            ];
        }, $targets));
    }

    /**
     * @param  array<string, array{table:string,columns:array<string,bool>,label:string}>  $targets
     * @param  list<string>  $columns
     */
    private function mergeEmployeeDeletionReferenceTarget(array &$targets, string $table, array $columns): void
    {
        if ($table === '' || $columns === []) {
            return;
        }

        $key = strtolower($table);
        if (! array_key_exists($key, $targets)) {
            $targets[$key] = [
                'table' => $table,
                'columns' => [],
                'label' => $this->humanizeReferenceTableName($table),
            ];
        }

        foreach ($columns as $column) {
            if ($column === '') {
                continue;
            }

            $targets[$key]['columns'][$column] = true;
        }
    }

    private function humanizeReferenceTableName(string $table): string
    {
        return self::EMPLOYEE_DELETE_REFERENCE_LABELS[$table]
            ?? str_replace('_', ' ', strtolower($table));
    }

    /**
     * @param  list<string>  $labels
     */
    private function buildEmployeeDeleteBlockedMessage(array $labels): string
    {
        if ($labels === []) {
            return 'Nhân sự đã phát sinh dữ liệu liên quan trong hệ thống và không thể xóa.';
        }

        $visibleLabels = array_slice($labels, 0, 3);
        $labelSummary = implode(', ', $visibleLabels);
        $remainingCount = count($labels) - count($visibleLabels);

        if ($remainingCount > 0) {
            $labelSummary .= sprintf(' và %d phân hệ khác', $remainingCount);
        }

        return sprintf(
            'Nhân sự đã phát sinh dữ liệu liên quan tại %s nên không thể xóa.',
            $labelSummary
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEmployee(Model $employee): array
    {
        $relations = [
            'department' => fn ($query) => $query->select($this->support->departmentRelationColumns()),
        ];
        if ($this->support->hasTable('positions')) {
            $relations['position'] = fn ($query) => $query->select($this->positionRelationColumns());
        }
        $employee->loadMissing($relations);

        $data = $employee->toArray();

        $data['username'] = (string) $this->support->firstNonEmpty($data, ['username', 'user_code'], '');
        $data['user_code'] = (string) $this->support->firstNonEmpty($data, ['user_code', 'username'], '');
        $data['employee_code'] = $this->normalizeEmployeeCode($data['user_code'], $data['id'] ?? null);
        $data['full_name'] = (string) $this->support->firstNonEmpty($data, ['full_name'], '');
        $data['gmail'] = $this->support->normalizeNullableString($data['gmail'] ?? null);
        $normalizedPhone = $this->support->normalizeNullableString($this->support->firstNonEmpty($data, ['phone_number', 'phone', 'mobile']));
        $data['phone_number'] = $normalizedPhone;
        $data['phone'] = $normalizedPhone;
        $data['department_id'] = $this->support->firstNonEmpty($data, ['department_id', 'dept_id']);
        $data['position_id'] = $this->support->firstNonEmpty($data, ['position_id']);
        $data['status'] = $this->fromEmployeeStorageStatus((string) ($data['status'] ?? 'ACTIVE'));
        $positionCode = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_code'] ?? '')
            : '';
        $positionName = isset($data['position']) && is_array($data['position'])
            ? (string) ($data['position']['pos_name'] ?? '')
            : '';

        if ($positionCode === '') {
            $fallbackCode = strtoupper((string) ($this->support->firstNonEmpty($data, ['position_code']) ?? ''));
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

    private function normalizeEmployeeLeaveDate(mixed $leaveDate): ?string
    {
        return $this->support->normalizeNullableString($leaveDate);
    }

    private function resolveEmployeeLeaveDateForPersistence(string $resolvedStatus, mixed $leaveDate): ?string
    {
        if ($resolvedStatus !== 'INACTIVE') {
            return null;
        }

        return $this->normalizeEmployeeLeaveDate($leaveDate);
    }

    private function employeeLeaveDateRequiredResponse(): JsonResponse
    {
        $message = 'Ngày nghỉ việc là bắt buộc khi chọn trạng thái Nghỉ việc.';

        return response()->json([
            'message' => $message,
            'errors' => [
                'leave_date' => [$message],
            ],
        ], 422);
    }

    private function isOutOfAllowedEmployeeAgeRange(mixed $dateOfBirth): bool
    {
        $normalized = trim((string) ($dateOfBirth ?? ''));
        if ($normalized === '') {
            return false;
        }

        $birthDate = date_create_immutable($normalized);
        if (! $birthDate instanceof \DateTimeImmutable) {
            return false;
        }

        $today = new \DateTimeImmutable('today');
        if ($birthDate > $today) {
            return true;
        }
        $age = $birthDate->diff($today)->y;

        return $age <= self::EMPLOYEE_MIN_AGE_EXCLUSIVE || $age >= self::EMPLOYEE_MAX_AGE_EXCLUSIVE;
    }

    private function employeeDateOfBirthRangeMessage(): string
    {
        return sprintf(
            'Ngay sinh phai cho so tuoi > %d va < %d.',
            self::EMPLOYEE_MIN_AGE_EXCLUSIVE,
            self::EMPLOYEE_MAX_AGE_EXCLUSIVE
        );
    }

    private function resolvePositionDisplayName(mixed $value): string
    {
        $raw = strtoupper(trim((string) $value));
        if ($raw === '') {
            return '';
        }

        $dictionary = [
            '1' => 'Giam doc',
            '2' => 'Pho giam doc',
            '3' => 'Truong phong',
            '4' => 'Pho phong',
            '5' => 'Chuyen vien',
            'P001' => 'Giam doc',
            'P002' => 'Pho giam doc',
            'P003' => 'Truong phong',
            'P004' => 'Pho phong',
            'P005' => 'Chuyen vien',
            'POS001' => 'Giam doc',
            'POS002' => 'Pho giam doc',
            'POS003' => 'Truong phong',
            'POS004' => 'Pho phong',
            'POS005' => 'Chuyen vien',
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
            'system administrator' => 'Quan tri he thong',
            'sales executive' => 'Chuyen vien kinh doanh',
            'automation operator' => 'Van hanh tu dong hoa',
            'director' => 'Giam doc',
            'deputy director' => 'Pho giam doc',
            'manager' => 'Truong phong',
            'assistant manager' => 'Pho phong',
            'specialist' => 'Chuyen vien',
            'engineer' => 'Ky su',
            'developer' => 'Lap trinh vien',
            'operator' => 'Nhan vien van hanh',
            'business analyst' => 'Chuyen vien phan tich nghiep vu',
            'giam doc' => 'Giam doc',
            'pho giam doc' => 'Pho giam doc',
            'truong phong' => 'Truong phong',
            'pho phong' => 'Pho phong',
            'chuyen vien' => 'Chuyen vien',
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

    private function generateTemporaryPassword(int $length = 16): string
    {
        $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $lower = 'abcdefghijkmnopqrstuvwxyz';
        $digits = '23456789';
        $symbols = '@#$%&*-_=+!?';
        $all = $upper.$lower.$digits.$symbols;

        $passwordChars = [
            $upper[random_int(0, strlen($upper) - 1)],
            $lower[random_int(0, strlen($lower) - 1)],
            $digits[random_int(0, strlen($digits) - 1)],
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];

        for ($index = count($passwordChars); $index < max(12, $length); $index++) {
            $passwordChars[] = $all[random_int(0, strlen($all) - 1)];
        }

        shuffle($passwordChars);

        return implode('', $passwordChars);
    }

    private function extractJsonResponseMessage(JsonResponse $response, string $fallback): string
    {
        $payload = $response->getData(true);
        $message = $payload['message'] ?? null;
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        if (is_array($payload['errors'] ?? null)) {
            foreach ($payload['errors'] as $fieldErrors) {
                if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                    return trim($fieldErrors[0]);
                }
            }
        }

        return $fallback;
    }

    private function firstValidationMessage(ValidationException $exception): string
    {
        $errors = $exception->errors();
        foreach ($errors as $fieldErrors) {
            if (is_array($fieldErrors) && is_string($fieldErrors[0] ?? null) && trim($fieldErrors[0]) !== '') {
                return trim($fieldErrors[0]);
            }
        }

        return 'Dữ liệu không hợp lệ.';
    }
}
