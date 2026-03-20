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
use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use App\Services\V5\Workflow\StatusDrivenSlaResolver;
use App\Services\V5\Workflow\WorkflowFlowResolver;
use App\Support\Audit\AuditValueSanitizer;
use App\Support\Auth\UserAccessService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class V5MasterDataController extends Controller
{
    private const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

    private const EMPLOYEE_INPUT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'TRANSFERRED'];
    private const EMPLOYEE_MIN_AGE_EXCLUSIVE = 20;
    private const EMPLOYEE_MAX_AGE_EXCLUSIVE = 66;

    private const PROJECT_STATUSES = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];
    private const PROJECT_INPUT_STATUSES = [
        'TRIAL',
        'ONGOING',
        'WARRANTY',
        'COMPLETED',
        'CANCELLED',
        'PLANNING',
        'ACTIVE',
        'TERMINATED',
        'SUSPENDED',
        'EXPIRED',
    ];

    private const CONTRACT_STATUSES = ['DRAFT', 'SIGNED', 'RENEWED'];

    private const CONTRACT_TERM_UNITS = ['MONTH', 'DAY'];

    private const PAYMENT_CYCLES = ['ONCE', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

    private const PAYMENT_SCHEDULE_STATUSES = ['PENDING', 'INVOICED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];

    private const PAYMENT_ALLOCATION_MODES = ['EVEN', 'MILESTONE'];

    private const OPPORTUNITY_STAGES = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    private const LEGACY_OPPORTUNITY_STAGE_MAP = [
        'LEAD' => 'NEW',
        'QUALIFIED' => 'NEW',
        'CLOSED_WON' => 'WON',
        'CLOSED_LOST' => 'LOST',
    ];
    private const DEFAULT_OPPORTUNITY_STAGE_DEFINITIONS = [
        [
            'stage_code' => 'NEW',
            'stage_name' => 'Mới',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 10,
        ],
        [
            'stage_code' => 'PROPOSAL',
            'stage_name' => 'Đề xuất',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 20,
        ],
        [
            'stage_code' => 'NEGOTIATION',
            'stage_name' => 'Đàm phán',
            'description' => null,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 30,
        ],
        [
            'stage_code' => 'WON',
            'stage_name' => 'Thắng',
            'description' => null,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 40,
        ],
        [
            'stage_code' => 'LOST',
            'stage_name' => 'Thất bại',
            'description' => null,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 50,
        ],
    ];

    private const SUPPORT_REQUEST_STATUSES = [
        'NEW',
        'IN_PROGRESS',
        'WAITING_CUSTOMER',
        'COMPLETED',
        'PAUSED',
        'TRANSFER_DEV',
        'TRANSFER_DMS',
        'UNABLE_TO_EXECUTE',
    ];

    private const LEGACY_SUPPORT_REQUEST_STATUS_MAP = [
        'OPEN' => 'NEW',
        'HOTFIXING' => 'TRANSFER_DEV',
        'RESOLVED' => 'COMPLETED',
        'DEPLOYED' => 'COMPLETED',
        'PENDING' => 'WAITING_CUSTOMER',
        'CANCELLED' => 'UNABLE_TO_EXECUTE',
    ];

    private const DEFAULT_SUPPORT_REQUEST_STATUS_DEFINITIONS = [
        [
            'status_code' => 'NEW',
            'status_name' => 'Mới tiếp nhận',
            'description' => 'Yêu cầu vừa được ghi nhận',
            'requires_completion_dates' => false,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 10,
        ],
        [
            'status_code' => 'IN_PROGRESS',
            'status_name' => 'Đang xử lý',
            'description' => 'Yêu cầu đang được xử lý',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 20,
        ],
        [
            'status_code' => 'WAITING_CUSTOMER',
            'status_name' => 'Chờ phản hồi KH',
            'description' => 'Đang chờ phản hồi từ khách hàng',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 30,
        ],
        [
            'status_code' => 'COMPLETED',
            'status_name' => 'Hoàn thành',
            'description' => 'Yêu cầu đã hoàn thành',
            'requires_completion_dates' => true,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 40,
        ],
        [
            'status_code' => 'PAUSED',
            'status_name' => 'Tạm dừng',
            'description' => 'Yêu cầu tạm dừng xử lý',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 50,
        ],
        [
            'status_code' => 'TRANSFER_DEV',
            'status_name' => 'Chuyển Dev',
            'description' => 'Yêu cầu chuyển cho đội phát triển',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_transfer_dev' => true,
            'is_active' => true,
            'sort_order' => 60,
        ],
        [
            'status_code' => 'TRANSFER_DMS',
            'status_name' => 'Chuyển DMS',
            'description' => 'Yêu cầu chuyển cho đội DMS',
            'requires_completion_dates' => true,
            'is_terminal' => false,
            'is_active' => true,
            'sort_order' => 70,
        ],
        [
            'status_code' => 'UNABLE_TO_EXECUTE',
            'status_name' => 'Không thực hiện được',
            'description' => 'Không thể thực hiện yêu cầu',
            'requires_completion_dates' => true,
            'is_terminal' => true,
            'is_active' => true,
            'sort_order' => 80,
        ],
    ];

    private const SUPPORT_REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    private const SUPPORT_REQUEST_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED'];

    private const SUPPORT_REQUEST_CODE_PREFIX = 'YC';

    private const SUPPORT_REQUEST_TASK_STATUS_ALIASES = [
        'VỪA TẠO' => 'TODO',
        'VUA TAO' => 'TODO',
        'CẦN LÀM' => 'TODO',
        'CAN LAM' => 'TODO',

        'ĐANG THỰC HIỆN' => 'IN_PROGRESS',
        'DANG THUC HIEN' => 'IN_PROGRESS',
        'ĐANG LÀM' => 'IN_PROGRESS',
        'DANG LAM' => 'IN_PROGRESS',

        'ĐÃ HOÀN THÀNH' => 'DONE',
        'DA HOAN THANH' => 'DONE',
        'HOÀN THÀNH' => 'DONE',
        'HOAN THANH' => 'DONE',

        'HUỶ' => 'CANCELLED',
        'HỦY' => 'CANCELLED',
        'HUY' => 'CANCELLED',

        'CHUYỂN SANG TASK KHÁC' => 'BLOCKED',
        'CHUYEN SANG TASK KHAC' => 'BLOCKED',
        'ĐANG CHẶN' => 'BLOCKED',
        'DANG CHAN' => 'BLOCKED',
    ];

    private const ATTACHMENT_SIGNED_URL_TTL_MINUTES = 15;

    private const DOCUMENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'EXPIRED'];

    private const DOCUMENT_SCOPE_DEFAULT = 'DEFAULT';

    private const DOCUMENT_SCOPE_PRODUCT_PRICING = 'PRODUCT_PRICING';

    private const PRODUCT_PRICING_DOCUMENT_TYPE_CODE = 'DT_PRICING';

    private const USER_DEPT_SCOPE_TYPES = ['SELF_ONLY', 'DEPT_ONLY', 'DEPT_AND_CHILDREN', 'ALL'];

    private const ROOT_DEPARTMENT_CODE = 'BGĐVT';

    private const BACKBLAZE_B2_INTEGRATION_PROVIDER = 'BACKBLAZE_B2';

    private const BACKBLAZE_B2_STORAGE_DISK = 'backblaze_b2';

    private const GOOGLE_DRIVE_INTEGRATION_PROVIDER = 'GOOGLE_DRIVE';

    private const GOOGLE_DRIVE_DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.file';

    private const CONTRACT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_ALERT';

    private const CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER = 'CONTRACT_PAYMENT_ALERT';

    private const DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS = 30;

    private const DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS = 30;

    private const MIN_CONTRACT_EXPIRY_WARNING_DAYS = 1;

    private const MAX_CONTRACT_EXPIRY_WARNING_DAYS = 365;

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
                'phone',
                'phone_number',
                'mobile',
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

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($employeeTable, $like): void {
                $builder->whereRaw('1 = 0');

                foreach (['user_code', 'username', 'full_name', 'phone', 'phone_number', 'mobile', 'email', 'job_title_raw'] as $column) {
                    if ($this->hasColumn($employeeTable, $column)) {
                        $builder->orWhere("{$employeeTable}.{$column}", 'like', $like);
                    }
                }
            });
        }

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::EMPLOYEE_STATUSES, true) && $this->hasColumn($employeeTable, 'status')) {
            $query->where("{$employeeTable}.status", $status);
        }

        $departmentFilter = $this->parseNullableInt($this->readFilterParam($request, 'department_id'));
        if ($departmentFilter !== null) {
            $departmentColumn = $this->hasColumn($employeeTable, 'department_id')
                ? 'department_id'
                : ($this->hasColumn($employeeTable, 'dept_id') ? 'dept_id' : null);
            if ($departmentColumn !== null) {
                $query->where("{$employeeTable}.{$departmentColumn}", $departmentFilter);
            }
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => "{$employeeTable}.id",
            'user_code' => "{$employeeTable}.user_code",
            'username' => "{$employeeTable}.username",
            'full_name' => "{$employeeTable}.full_name",
            'email' => "{$employeeTable}.email",
            'status' => "{$employeeTable}.status",
            'department_id' => "{$employeeTable}.department_id",
            'created_at' => "{$employeeTable}.created_at",
        ], "{$employeeTable}.id");
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== "{$employeeTable}.id" && $this->hasColumn($employeeTable, 'id')) {
            $query->orderBy("{$employeeTable}.id", 'asc');
        }

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 10, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Model $employee): array => $this->serializeEmployee($employee))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function customers(Request $request): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $query = Customer::query()
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
            ]));

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['customer_code', 'customer_name', 'company_name', 'tax_code', 'address'] as $column) {
                    if ($this->hasColumn('customers', $column)) {
                        $builder->orWhere("customers.{$column}", 'like', $like);
                    }
                }
            });
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => 'customers.id',
            'customer_code' => 'customers.customer_code',
            'customer_name' => 'customers.customer_name',
            'tax_code' => 'customers.tax_code',
            'created_at' => 'customers.created_at',
        ], 'customers.id');
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'customers.id' && $this->hasColumn('customers', 'id')) {
            $query->orderBy('customers.id', 'asc');
        }

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 10, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Customer $customer): array => $this->serializeCustomer($customer))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Customer $customer): array => $this->serializeCustomer($customer))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Customer $customer): array => $this->serializeCustomer($customer))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
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

    public function projects(Request $request): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $query = Project::query()
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
            ]));

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['project_code', 'project_name'] as $column) {
                    if ($this->hasColumn('projects', $column)) {
                        $builder->orWhere("projects.{$column}", 'like', $like);
                    }
                }

                $canSearchCustomer = $this->hasTable('customers')
                    && ($this->hasColumn('customers', 'customer_code') || $this->hasColumn('customers', 'customer_name'));
                if ($canSearchCustomer) {
                    $builder->orWhereHas('customer', function ($customerQuery) use ($like): void {
                        $customerQuery->where(function ($customerFilter) use ($like): void {
                            if ($this->hasColumn('customers', 'customer_code')) {
                                $customerFilter->orWhere('customer_code', 'like', $like);
                            }
                            if ($this->hasColumn('customers', 'customer_name')) {
                                $customerFilter->orWhere('customer_name', 'like', $like);
                            }
                        });
                    });
                }
            });
        }

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::PROJECT_STATUSES, true) && $this->hasColumn('projects', 'status')) {
            $query->where('projects.status', $status);
        }

        $customerId = $this->parseNullableInt($this->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->hasColumn('projects', 'customer_id')) {
            $query->where('projects.customer_id', $customerId);
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => 'projects.id',
            'project_code' => 'projects.project_code',
            'project_name' => 'projects.project_name',
            'status' => 'projects.status',
            'start_date' => 'projects.start_date',
            'expected_end_date' => 'projects.expected_end_date',
            'created_at' => 'projects.created_at',
        ], 'projects.id');
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'projects.id' && $this->hasColumn('projects', 'id')) {
            $query->orderBy('projects.id', 'asc');
        }

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 10, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Project $project): array => $this->serializeProject($project))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Project $project): array => $this->serializeProject($project))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Project $project): array => $this->serializeProject($project))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
    }

    public function projectItems(Request $request): JsonResponse
    {
        if (! $this->hasTable('project_items')) {
            return $this->missingTable('project_items');
        }

        $query = $this->buildProjectItemsQuery($request);

        return $this->respondWithProjectItemsQuery($request, $query);
    }

    public function customerRequestProjectItems(Request $request): JsonResponse
    {
        if (! $this->hasTable('project_items')) {
            return $this->missingTable('project_items');
        }

        $userId = $this->resolveAuthenticatedUserId($request);
        if ($userId === null) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $query = $this->buildProjectItemsQuery($request);
        $includeProjectItemId = $this->parseNullableInt($this->readFilterParam($request, 'include_project_item_id'));
        $canFilterByRaci = $this->hasColumn('project_items', 'project_id')
            && $this->hasTable('raci_assignments')
            && $this->hasColumn('raci_assignments', 'entity_type')
            && $this->hasColumn('raci_assignments', 'entity_id')
            && $this->hasColumn('raci_assignments', 'user_id')
            && $this->hasColumn('raci_assignments', 'raci_role');

        $query->where(function ($builder) use ($canFilterByRaci, $includeProjectItemId, $userId): void {
            if ($canFilterByRaci) {
                $builder->whereExists(function ($exists) use ($userId): void {
                    $exists->selectRaw('1')
                        ->from('raci_assignments as ra')
                        ->whereColumn('ra.entity_id', 'pi.project_id')
                        ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
                        ->where('ra.user_id', $userId)
                        ->whereIn('ra.raci_role', ['A', 'R', 'C', 'I']);
                });
            } else {
                $builder->whereRaw('1 = 0');
            }

            if ($includeProjectItemId !== null) {
                $builder->orWhere('pi.id', $includeProjectItemId);
            }
        });

        return $this->respondWithProjectItemsQuery($request, $query);
    }

    public function contracts(Request $request): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $query = Contract::query()
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
                'effective_date',
                'expiry_date',
                'term_unit',
                'term_value',
                'expiry_date_manual_override',
                'status',
                'data_scope',
                'created_at',
                'updated_at',
            ]));

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['contract_code', 'contract_number', 'contract_name'] as $column) {
                    if ($this->hasColumn('contracts', $column)) {
                        $builder->orWhere("contracts.{$column}", 'like', $like);
                    }
                }

                $canSearchCustomer = $this->hasTable('customers')
                    && ($this->hasColumn('customers', 'customer_code') || $this->hasColumn('customers', 'customer_name'));
                if ($canSearchCustomer) {
                    $builder->orWhereHas('customer', function ($customerQuery) use ($like): void {
                        $customerQuery->where(function ($customerFilter) use ($like): void {
                            if ($this->hasColumn('customers', 'customer_code')) {
                                $customerFilter->orWhere('customer_code', 'like', $like);
                            }
                            if ($this->hasColumn('customers', 'customer_name')) {
                                $customerFilter->orWhere('customer_name', 'like', $like);
                            }
                        });
                    });
                }

                $canSearchProject = $this->hasTable('projects')
                    && ($this->hasColumn('projects', 'project_code') || $this->hasColumn('projects', 'project_name'));
                if ($canSearchProject) {
                    $builder->orWhereHas('project', function ($projectQuery) use ($like): void {
                        $projectQuery->where(function ($projectFilter) use ($like): void {
                            if ($this->hasColumn('projects', 'project_code')) {
                                $projectFilter->orWhere('project_code', 'like', $like);
                            }
                            if ($this->hasColumn('projects', 'project_name')) {
                                $projectFilter->orWhere('project_name', 'like', $like);
                            }
                        });
                    });
                }
            });
        }

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::CONTRACT_STATUSES, true) && $this->hasColumn('contracts', 'status')) {
            $query->where('contracts.status', $status);
        }

        $customerId = $this->parseNullableInt($this->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->hasColumn('contracts', 'customer_id')) {
            $query->where('contracts.customer_id', $customerId);
        }

        $projectId = $this->parseNullableInt($this->readFilterParam($request, 'project_id'));
        if ($projectId !== null && $this->hasColumn('contracts', 'project_id')) {
            $query->where('contracts.project_id', $projectId);
        }

        $resolvedContractValueSortColumn = 'contracts.id';
        if ($this->hasColumn('contracts', 'value')) {
            $resolvedContractValueSortColumn = 'contracts.value';
        } elseif ($this->hasColumn('contracts', 'total_value')) {
            $resolvedContractValueSortColumn = 'contracts.total_value';
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => 'contracts.id',
            'contract_code' => 'contracts.contract_code',
            'contract_name' => 'contracts.contract_name',
            'status' => 'contracts.status',
            'value' => $resolvedContractValueSortColumn,
            'sign_date' => 'contracts.sign_date',
            'effective_date' => 'contracts.effective_date',
            'expiry_date' => 'contracts.expiry_date',
            'created_at' => 'contracts.created_at',
        ], 'contracts.id');
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'contracts.id' && $this->hasColumn('contracts', 'id')) {
            $query->orderBy('contracts.id', 'asc');
        }

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 10, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (Contract $contract): array => $this->serializeContract($contract))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (Contract $contract): array => $this->serializeContract($contract))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (Contract $contract): array => $this->serializeContract($contract))
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => $this->buildPaginationMeta(1, max(1, (int) $rows->count()), (int) $rows->count()),
        ]);
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

    public function businesses(Request $request): JsonResponse
    {
        if (! $this->hasTable('business_domains')) {
            return $this->missingTable('business_domains');
        }

        if ($this->shouldPaginate($request)) {
            $query = DB::table('business_domains')
                ->select($this->selectColumns('business_domains', [
                    'id',
                    'domain_code',
                    'domain_name',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($builder) use ($like): void {
                    $builder->whereRaw('1 = 0');
                    if ($this->hasColumn('business_domains', 'domain_code')) {
                        $builder->orWhere('domain_code', 'like', $like);
                    }
                    if ($this->hasColumn('business_domains', 'domain_name')) {
                        $builder->orWhere('domain_name', 'like', $like);
                    }
                });
            }

            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => (array) $item)
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = collect(Cache::remember('v5:business_domains:list:v1', now()->addMinutes(30), function (): array {
            return DB::table('business_domains')
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
                ->values()
                ->all();
        }));

        return response()->json(['data' => $rows]);
    }

    public function storeBusiness(Request $request): JsonResponse
    {
        if (! $this->hasTable('business_domains')) {
            return $this->missingTable('business_domains');
        }

        $rules = [
            'domain_code' => ['required', 'string', 'max:50'],
            'domain_name' => ['required', 'string', 'max:100'],
        ];

        if ($this->hasColumn('business_domains', 'domain_code')) {
            $rules['domain_code'][] = Rule::unique('business_domains', 'domain_code');
        }

        $validated = $request->validate($rules);

        $insertPayload = [
            'domain_code' => trim((string) $validated['domain_code']),
            'domain_name' => trim((string) $validated['domain_name']),
        ];

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            if ($this->hasColumn('business_domains', 'created_by')) {
                $insertPayload['created_by'] = $actorId;
            }
            if ($this->hasColumn('business_domains', 'updated_by')) {
                $insertPayload['updated_by'] = $actorId;
            }
        }

        if ($this->hasColumn('business_domains', 'updated_at')) {
            $insertPayload['updated_at'] = now();
        }

        $insertPayload = $this->filterPayloadByTableColumns('business_domains', $insertPayload);
        if ($insertPayload === []) {
            throw new \RuntimeException('Không thể chuẩn bị dữ liệu lưu lĩnh vực.');
        }

        $newId = (int) DB::table('business_domains')->insertGetId($insertPayload);
        Cache::forget('v5:business_domains:list:v1');

        $created = DB::table('business_domains')
            ->select($this->selectColumns('business_domains', [
                'id',
                'domain_code',
                'domain_name',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $newId)
            ->first();

        return response()->json([
            'data' => $created !== null ? (array) $created : ['id' => $newId],
        ], 201);
    }

    public function updateBusiness(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('business_domains')) {
            return $this->missingTable('business_domains');
        }

        $business = DB::table('business_domains')->where('id', $id)->first();
        if ($business === null) {
            return response()->json(['message' => 'Business not found.'], 404);
        }

        $rules = [
            'domain_code' => ['sometimes', 'required', 'string', 'max:50'],
            'domain_name' => ['sometimes', 'required', 'string', 'max:100'],
        ];

        if ($this->hasColumn('business_domains', 'domain_code')) {
            $rules['domain_code'][] = Rule::unique('business_domains', 'domain_code')->ignore($id);
        }

        $validated = $request->validate($rules);

        $updatePayload = [];
        if (array_key_exists('domain_code', $validated)) {
            $updatePayload['domain_code'] = trim((string) $validated['domain_code']);
        }
        if (array_key_exists('domain_name', $validated)) {
            $updatePayload['domain_name'] = trim((string) $validated['domain_name']);
        }

        if ($updatePayload !== []) {
            $actorId = $this->resolveAuthenticatedUserId($request);
            if ($actorId !== null && $this->hasColumn('business_domains', 'updated_by')) {
                $updatePayload['updated_by'] = $actorId;
            }
            if ($this->hasColumn('business_domains', 'updated_at')) {
                $updatePayload['updated_at'] = now();
            }

            $filteredPayload = $this->filterPayloadByTableColumns('business_domains', $updatePayload);
            if ($filteredPayload !== []) {
                DB::table('business_domains')
                    ->where('id', $id)
                    ->update($filteredPayload);
            }
        }

        Cache::forget('v5:business_domains:list:v1');

        $updated = DB::table('business_domains')
            ->select($this->selectColumns('business_domains', [
                'id',
                'domain_code',
                'domain_name',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->first();

        return response()->json([
            'data' => $updated !== null ? (array) $updated : (array) $business,
        ]);
    }

    public function deleteBusiness(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('business_domains')) {
            return $this->missingTable('business_domains');
        }

        $business = DB::table('business_domains')->where('id', $id)->first();
        if ($business === null) {
            return response()->json(['message' => 'Business not found.'], 404);
        }

        try {
            DB::table('business_domains')->where('id', $id)->delete();
            Cache::forget('v5:business_domains:list:v1');

            return response()->json(['message' => 'Business deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Business is referenced by other records and cannot be deleted.',
            ], 422);
        }
    }

    public function products(Request $request): JsonResponse
    {
        if (! $this->hasTable('products')) {
            return $this->missingTable('products');
        }

        if ($this->shouldPaginate($request)) {
            $query = DB::table('products')
                ->select($this->selectColumns('products', [
                    'id',
                    'product_code',
                    'product_name',
                    'domain_id',
                    'vendor_id',
                    'standard_price',
                    'unit',
                    'description',
                    'is_active',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            if ($this->hasColumn('products', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($builder) use ($like): void {
                    $builder->whereRaw('1 = 0');
                    if ($this->hasColumn('products', 'product_code')) {
                        $builder->orWhere('product_code', 'like', $like);
                    }
                    if ($this->hasColumn('products', 'product_name')) {
                        $builder->orWhere('product_name', 'like', $like);
                    }
                });
            }

            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = collect(Cache::remember('v5:products:list:v1', now()->addMinutes(15), function (): array {
            $query = DB::table('products')
                ->select($this->selectColumns('products', [
                    'id',
                    'product_code',
                    'product_name',
                    'domain_id',
                    'vendor_id',
                    'standard_price',
                    'unit',
                    'description',
                    'is_active',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]))
                ->orderBy('id');

            if ($this->hasColumn('products', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            return $query
                ->get()
                ->map(fn (object $item): array => $this->serializeProductRecord((array) $item))
                ->values()
                ->all();
        }));

        return response()->json(['data' => $rows]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        if (! $this->hasTable('products')) {
            return $this->missingTable('products');
        }

        $rules = [
            'product_code' => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'domain_id' => ['required', 'integer'],
            'vendor_id' => ['required', 'integer'],
            'standard_price' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
        ];

        if ($this->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code');
            if ($this->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        $domainId = $this->parseNullableInt($validated['domain_id'] ?? null);
        if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
            return response()->json(['message' => 'domain_id is invalid.'], 422);
        }

        $vendorId = $this->parseNullableInt($validated['vendor_id'] ?? null);
        if ($vendorId === null || ! $this->tableRowExists('vendors', $vendorId)) {
            return response()->json(['message' => 'vendor_id is invalid.'], 422);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $payload = $this->filterPayloadByTableColumns('products', [
            'product_code' => trim((string) $validated['product_code']),
            'product_name' => trim((string) $validated['product_name']),
            'domain_id' => $domainId,
            'vendor_id' => $vendorId,
            'standard_price' => max(0, (float) ($validated['standard_price'] ?? 0)),
            'unit' => $this->normalizeNullableString($validated['unit'] ?? null),
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        if ($this->hasColumn('products', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('products', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        try {
            $insertId = (int) DB::table('products')->insertGetId($payload);
        } catch (QueryException $exception) {
            return response()->json([
                'message' => $this->isUniqueConstraintViolation($exception)
                    ? 'Mã sản phẩm đã tồn tại.'
                    : 'Không thể tạo sản phẩm.',
            ], 422);
        }

        Cache::forget('v5:products:list:v1');

        $record = $this->loadProductById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Product created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateProduct(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('products')) {
            return $this->missingTable('products');
        }

        $currentQuery = DB::table('products')->where('id', $id);
        if ($this->hasColumn('products', 'deleted_at')) {
            $currentQuery->whereNull('deleted_at');
        }
        $current = $currentQuery->first();
        if ($current === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $rules = [
            'product_code' => ['sometimes', 'string', 'max:100'],
            'product_name' => ['sometimes', 'string', 'max:255'],
            'domain_id' => ['sometimes', 'integer'],
            'vendor_id' => ['sometimes', 'integer'],
            'standard_price' => ['sometimes', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ];

        if ($this->hasColumn('products', 'product_code')) {
            $uniqueRule = Rule::unique('products', 'product_code')->ignore($id);
            if ($this->hasColumn('products', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['product_code'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);
        $payload = [];

        if (array_key_exists('product_code', $validated)) {
            $payload['product_code'] = trim((string) $validated['product_code']);
        }
        if (array_key_exists('product_name', $validated)) {
            $payload['product_name'] = trim((string) $validated['product_name']);
        }
        if (array_key_exists('domain_id', $validated)) {
            $domainId = $this->parseNullableInt($validated['domain_id']);
            if ($domainId === null || ! $this->tableRowExists('business_domains', $domainId)) {
                return response()->json(['message' => 'domain_id is invalid.'], 422);
            }
            $payload['domain_id'] = $domainId;
        }
        if (array_key_exists('vendor_id', $validated)) {
            $vendorId = $this->parseNullableInt($validated['vendor_id']);
            if ($vendorId === null || ! $this->tableRowExists('vendors', $vendorId)) {
                return response()->json(['message' => 'vendor_id is invalid.'], 422);
            }
            $payload['vendor_id'] = $vendorId;
        }
        if (array_key_exists('standard_price', $validated)) {
            $payload['standard_price'] = max(0, (float) $validated['standard_price']);
        }
        if (array_key_exists('unit', $validated)) {
            $payload['unit'] = $this->normalizeNullableString($validated['unit']);
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }

        if ($payload === []) {
            $record = $this->serializeProductRecord((array) $current);
            return response()->json(['data' => $record]);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null && $this->hasColumn('products', 'updated_by')) {
            $payload['updated_by'] = $actorId;
        }
        if ($this->hasColumn('products', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $payload = $this->filterPayloadByTableColumns('products', $payload);

        if ($payload !== []) {
            try {
                DB::table('products')->where('id', $id)->update($payload);
            } catch (QueryException $exception) {
                return response()->json([
                    'message' => $this->isUniqueConstraintViolation($exception)
                        ? 'Mã sản phẩm đã tồn tại.'
                        : 'Không thể cập nhật sản phẩm.',
                ], 422);
            }
        }

        Cache::forget('v5:products:list:v1');

        $record = $this->loadProductById($id);
        if ($record === null) {
            return response()->json(['message' => 'Product updated but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record]);
    }

    public function deleteProduct(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('products')) {
            return $this->missingTable('products');
        }

        $productQuery = DB::table('products')->where('id', $id);
        if ($this->hasColumn('products', 'deleted_at')) {
            $productQuery->whereNull('deleted_at');
        }
        $product = $productQuery->first();
        if ($product === null) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        try {
            if ($this->hasColumn('products', 'deleted_at')) {
                $updatePayload = ['deleted_at' => now()];
                $actorId = $this->resolveAuthenticatedUserId($request);
                if ($actorId !== null && $this->hasColumn('products', 'updated_by')) {
                    $updatePayload['updated_by'] = $actorId;
                }
                if ($this->hasColumn('products', 'updated_at')) {
                    $updatePayload['updated_at'] = now();
                }
                DB::table('products')->where('id', $id)->update($this->filterPayloadByTableColumns('products', $updatePayload));
            } else {
                DB::table('products')->where('id', $id)->delete();
            }
            Cache::forget('v5:products:list:v1');

            return response()->json(['message' => 'Product deleted.']);
        } catch (QueryException) {
            return response()->json([
                'message' => 'Sản phẩm đang được sử dụng và không thể xóa.',
            ], 422);
        }
    }

    public function customerPersonnel(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_personnel')) {
            return $this->missingTable('customer_personnel');
        }

        $query = DB::table('customer_personnel');
        if ($this->hasColumn('customer_personnel', 'deleted_at')) {
            $query->whereNull('customer_personnel.deleted_at');
        }
        $joinSupportContactPositions =
            $this->hasTable('support_contact_positions')
            && $this->hasColumn('customer_personnel', 'position_id')
            && $this->hasColumn('support_contact_positions', 'id');
        if ($joinSupportContactPositions) {
            $query->leftJoin('support_contact_positions as scp', 'customer_personnel.position_id', '=', 'scp.id');
        }

        $columns = [];
        foreach (['id', 'customer_id', 'full_name', 'date_of_birth', 'position_id', 'position_type', 'phone', 'email', 'status', 'created_at'] as $column) {
            if (! $this->hasColumn('customer_personnel', $column)) {
                continue;
            }
            $columns[] = $joinSupportContactPositions
                ? "customer_personnel.{$column} as {$column}"
                : $column;
        }

        if ($joinSupportContactPositions) {
            if ($this->hasColumn('support_contact_positions', 'position_code')) {
                $columns[] = 'scp.position_code as position_code';
            }
            if ($this->hasColumn('support_contact_positions', 'position_name')) {
                $columns[] = 'scp.position_name as position_name';
            }
        }

        $query->select($columns);

        $customerId = $this->parseNullableInt($this->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->hasColumn('customer_personnel', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));
        if (
            $status !== ''
            && in_array($status, ['ACTIVE', 'INACTIVE'], true)
            && $this->hasColumn('customer_personnel', 'status')
        ) {
            $query->where('customer_personnel.status', $status);
        }

        $query->orderBy('customer_personnel.id');

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeCustomerPersonnelRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeCustomerPersonnel(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_personnel')) {
            return $this->missingTable('customer_personnel');
        }

        $validated = $request->validate([
            'customer_id' => ['required', 'integer'],
            'full_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'position_type' => ['nullable', 'string', 'max:50'],
            'position_id' => ['nullable', 'integer'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(['ACTIVE', 'INACTIVE', 'Active', 'Inactive'])],
        ]);

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();
            throw ValidationException::withMessages(['date_of_birth' => [$message]]);
        }

        $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
            $validated['position_type'] ?? null,
            $validated['position_id'] ?? null,
            ! array_key_exists('position_type', $validated) && ! array_key_exists('position_id', $validated)
        );
        if ($resolvedPosition === null) {
            return response()->json(['message' => 'position_type hoặc position_id không tồn tại trong danh mục chức vụ.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('customer_personnel', [
            'customer_id' => $customerId,
            'full_name' => trim((string) $validated['full_name']),
            'date_of_birth' => $this->normalizeNullableString($validated['date_of_birth'] ?? null),
            'position_id' => $resolvedPosition['id'],
            'position_type' => $resolvedPosition['position_code'],
            'phone' => $this->normalizeNullableString($validated['phone'] ?? null),
            'email' => $this->normalizeNullableString($validated['email'] ?? null),
            'status' => $this->normalizeCustomerPersonnelStorageStatus((string) ($validated['status'] ?? 'ACTIVE')),
        ]);

        if ($this->hasColumn('customer_personnel', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('customer_personnel', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('customer_personnel')->insertGetId($payload);
        $record = $this->loadCustomerPersonnelById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Customer personnel created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateCustomerPersonnel(Request $request, string $id): JsonResponse
    {
        if (! $this->hasTable('customer_personnel')) {
            return $this->missingTable('customer_personnel');
        }

        $validated = $request->validate([
            'customer_id' => ['sometimes', 'required', 'integer'],
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'position_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'position_id' => ['sometimes', 'nullable', 'integer'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(['ACTIVE', 'INACTIVE', 'Active', 'Inactive'])],
        ]);

        $targetId = trim($id);
        if ($targetId === '') {
            return response()->json(['message' => 'id is invalid.'], 422);
        }

        $current = DB::table('customer_personnel')
            ->where('id', $targetId)
            ->when($this->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();
        if ($current === null) {
            return response()->json(['message' => 'Customer personnel not found.'], 404);
        }

        if (array_key_exists('customer_id', $validated)) {
            $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customer_id is invalid.'], 422);
            }
        }

        if (
            array_key_exists('date_of_birth', $validated)
            && $this->isOutOfAllowedEmployeeAgeRange($validated['date_of_birth'])
        ) {
            $message = $this->employeeDateOfBirthRangeMessage();
            throw ValidationException::withMessages(['date_of_birth' => [$message]]);
        }

        $payload = [];
        if (array_key_exists('customer_id', $validated)) {
            $payload['customer_id'] = $this->parseNullableInt($validated['customer_id']);
        }
        if (array_key_exists('full_name', $validated)) {
            $payload['full_name'] = trim((string) $validated['full_name']);
        }
        if (array_key_exists('date_of_birth', $validated)) {
            $payload['date_of_birth'] = $this->normalizeNullableString($validated['date_of_birth']);
        }
        if (array_key_exists('position_type', $validated) || array_key_exists('position_id', $validated)) {
            $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
                $validated['position_type'] ?? null,
                $validated['position_id'] ?? null,
                false
            );
            if ($resolvedPosition === null) {
                return response()->json(['message' => 'position_type hoặc position_id không tồn tại trong danh mục chức vụ.'], 422);
            }

            $payload['position_type'] = $resolvedPosition['position_code'];
            $payload['position_id'] = $resolvedPosition['id'];
        }
        if (array_key_exists('phone', $validated)) {
            $payload['phone'] = $this->normalizeNullableString($validated['phone']);
        }
        if (array_key_exists('email', $validated)) {
            $payload['email'] = $this->normalizeNullableString($validated['email']);
        }
        if (array_key_exists('status', $validated)) {
            $payload['status'] = $this->normalizeCustomerPersonnelStorageStatus((string) ($validated['status'] ?? 'ACTIVE'));
        }

        $payload = $this->filterPayloadByTableColumns('customer_personnel', $payload);
        if ($payload === []) {
            $existing = $this->loadCustomerPersonnelById((int) $targetId);
            if ($existing === null) {
                return response()->json(['message' => 'Customer personnel not found.'], 404);
            }

            return response()->json(['data' => $existing]);
        }

        if ($this->hasColumn('customer_personnel', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('customer_personnel')
            ->where('id', $targetId)
            ->update($payload);

        $record = $this->loadCustomerPersonnelById((int) $targetId);
        if ($record === null) {
            return response()->json(['message' => 'Customer personnel updated but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record]);
    }

    public function deleteCustomerPersonnel(Request $request, string $id): JsonResponse
    {
        if (! $this->hasTable('customer_personnel')) {
            return $this->missingTable('customer_personnel');
        }

        $targetId = trim($id);
        if ($targetId === '') {
            return response()->json(['message' => 'id is invalid.'], 422);
        }

        $deleteQuery = DB::table('customer_personnel')->where('id', $targetId);
        if ($this->hasColumn('customer_personnel', 'deleted_at')) {
            $payload = ['deleted_at' => now()];
            if ($this->hasColumn('customer_personnel', 'updated_at')) {
                $payload['updated_at'] = now();
            }
            $deleted = $deleteQuery
                ->whereNull('deleted_at')
                ->update($this->filterPayloadByTableColumns('customer_personnel', $payload));
        } else {
            $deleted = $deleteQuery->delete();
        }

        if ($deleted <= 0) {
            return response()->json(['message' => 'Customer personnel not found.'], 404);
        }

        return response()->json(['message' => 'Customer personnel deleted.']);
    }

    public function documents(Request $request): JsonResponse
    {
        if (! $this->hasTable('documents')) {
            return $this->missingTable('documents');
        }

        $query = DB::table('documents')
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
            ]));

        if ($this->hasColumn('documents', 'deleted_at')) {
            $query->whereNull('documents.deleted_at');
        }

        $this->applyDocumentReadScope($request, $query);

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['id', 'document_code', 'document_name'] as $column) {
                    if ($this->hasColumn('documents', $column)) {
                        $builder->orWhere("documents.{$column}", 'like', $like);
                    }
                }
            });
        }

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));
        if ($status !== '' && in_array($status, self::DOCUMENT_STATUSES, true) && $this->hasColumn('documents', 'status')) {
            $query->where('documents.status', $status);
        }

        $customerId = $this->parseNullableInt($this->readFilterParam($request, 'customer_id'));
        if ($customerId !== null && $this->hasColumn('documents', 'customer_id')) {
            $query->where('documents.customer_id', $customerId);
        }

        $projectId = $this->parseNullableInt($this->readFilterParam($request, 'project_id'));
        if ($projectId !== null && $this->hasColumn('documents', 'project_id')) {
            $query->where('documents.project_id', $projectId);
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => 'documents.id',
            'document_code' => 'documents.document_code',
            'document_name' => 'documents.document_name',
            'status' => 'documents.status',
            'expiry_date' => 'documents.expiry_date',
            'created_at' => 'documents.created_at',
        ], 'documents.id');
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'documents.id' && $this->hasColumn('documents', 'id')) {
            $query->orderBy('documents.id', 'desc');
        }

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 10, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();

                $documentTypeCodeById = $this->buildDocumentTypeCodeMap();
                $documentIds = $rows
                    ->map(fn (array $row): ?int => $this->parseNullableInt($row['id'] ?? null))
                    ->filter(fn (?int $id): bool => $id !== null)
                    ->values()
                    ->all();
                $attachmentMap = $this->loadDocumentAttachmentMap($documentIds);
                $productIdsMap = $this->loadDocumentProductIdsMap($documentIds);

                $serializedRows = $rows
                    ->map(fn (array $row): array => $this->serializeDocumentRecord(
                        $row,
                        $documentTypeCodeById,
                        $attachmentMap,
                        $productIdsMap
                    ))
                    ->values();

                return response()->json([
                    'data' => $serializedRows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $serializedRows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => (array) $item)
                ->values();

            $documentTypeCodeById = $this->buildDocumentTypeCodeMap();
            $documentIds = $rows
                ->map(fn (array $row): ?int => $this->parseNullableInt($row['id'] ?? null))
                ->filter(fn (?int $id): bool => $id !== null)
                ->values()
                ->all();
            $attachmentMap = $this->loadDocumentAttachmentMap($documentIds);
            $productIdsMap = $this->loadDocumentProductIdsMap($documentIds);

            $serializedRows = $rows
                ->map(fn (array $row): array => $this->serializeDocumentRecord(
                    $row,
                    $documentTypeCodeById,
                    $attachmentMap,
                    $productIdsMap
                ))
                ->values();

            return response()->json([
                'data' => $serializedRows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $documentTypeCodeById = $this->buildDocumentTypeCodeMap();
        $documentIds = $rows
            ->map(fn (array $row): ?int => $this->parseNullableInt($row['id'] ?? null))
            ->filter(fn (?int $id): bool => $id !== null)
            ->values()
            ->all();

        $attachmentMap = $this->loadDocumentAttachmentMap($documentIds);
        $productIdsMap = $this->loadDocumentProductIdsMap($documentIds);

        $serializedRows = $rows
            ->map(fn (array $row): array => $this->serializeDocumentRecord(
                $row,
                $documentTypeCodeById,
                $attachmentMap,
                $productIdsMap
            ))
            ->values();

        return response()->json([
            'data' => $serializedRows,
            'meta' => $this->buildPaginationMeta(1, max(1, (int) $serializedRows->count()), (int) $serializedRows->count()),
        ]);
    }

    public function reminders(Request $request): JsonResponse
    {
        if (! $this->hasTable('reminders')) {
            return $this->missingTable('reminders');
        }

        $query = DB::table('reminders')
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
            ->orderByDesc('id');

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                if ($this->hasColumn('reminders', 'reminder_title')) {
                    $builder->orWhere('reminder_title', 'like', $like);
                }
                if ($this->hasColumn('reminders', 'content')) {
                    $builder->orWhere('content', 'like', $like);
                }
            });
        }

        $serializeRows = fn ($items) => collect($items)
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

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = $serializeRows($paginator->items());

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = $serializeRows($paginator->items());

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $serializeRows($query->get());

        return response()->json(['data' => $rows]);
    }

    public function userDeptHistory(Request $request): JsonResponse
    {
        if (! $this->hasTable('user_dept_history')) {
            return $this->missingTable('user_dept_history');
        }

        $query = DB::table('user_dept_history')
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
            ->orderByDesc('id');

        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $serializedRows = $this->serializeUserDeptHistoryRows(collect($paginator->items()));

                return response()->json([
                    'data' => $serializedRows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $serializedRows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $serializedRows = $this->serializeUserDeptHistoryRows(collect($paginator->items()));

            return response()->json([
                'data' => $serializedRows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query->get();
        $serializedRows = $this->serializeUserDeptHistoryRows($rows);

        return response()->json(['data' => $serializedRows]);
    }

    /**
     * @param \Illuminate\Support\Collection<int, object> $rows
     */
    private function serializeUserDeptHistoryRows($rows): \Illuminate\Support\Collection
    {

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
        return $serializedRows;
    }

    public function auditLogs(Request $request): JsonResponse
    {
        if (! $this->hasTable('audit_logs')) {
            return $this->missingTable('audit_logs');
        }

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
            ]));

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');
                foreach (['id', 'event', 'auditable_type', 'auditable_id', 'url', 'ip_address'] as $column) {
                    if ($this->hasColumn('audit_logs', $column)) {
                        $builder->orWhere("audit_logs.{$column}", 'like', $like);
                    }
                }
            });
        }

        $event = strtoupper(trim((string) ($this->readFilterParam($request, 'event', '') ?? '')));
        if ($event !== '' && in_array($event, ['INSERT', 'UPDATE', 'DELETE', 'RESTORE'], true) && $this->hasColumn('audit_logs', 'event')) {
            $query->where('audit_logs.event', $event);
        }

        $sortBy = $this->resolveSortColumn($request, [
            'id' => 'audit_logs.id',
            'event' => 'audit_logs.event',
            'auditable_type' => 'audit_logs.auditable_type',
            'auditable_id' => 'audit_logs.auditable_id',
            'created_by' => 'audit_logs.created_by',
            'created_at' => 'audit_logs.created_at',
        ], 'audit_logs.created_at');
        $sortDir = $this->resolveSortDirection($request);

        $query->orderBy($sortBy, $sortDir);
        if ($sortBy !== 'audit_logs.id' && $this->hasColumn('audit_logs', 'id')) {
            $query->orderBy('audit_logs.id', 'desc');
        }

        $meta = null;
        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();
                $meta = $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages());
            } else {
                $paginator = $query->paginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => (array) $item)
                    ->values();
                $meta = $this->buildPaginationMeta($page, $perPage, (int) $paginator->total());
            }
        } else {
            $limit = $request->integer('limit', 200);
            $limit = max(1, min($limit, 1000));
            $rows = $query
                ->limit($limit)
                ->get()
                ->map(fn (object $item): array => (array) $item)
                ->values();
            $meta = $this->buildPaginationMeta(1, $limit, (int) $rows->count());
        }

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

        return response()->json([
            'data' => $serializedRows,
            'meta' => $meta,
        ]);
    }

    public function supportServiceGroups(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByGroupId = $this->supportServiceGroupUsageSummaryById();
        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
        ];

        if ($this->hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
            $selects[] = 'ssg.workflow_status_catalog_id';
            if ($this->hasTable('workflow_status_catalogs')) {
                $query->leftJoin('workflow_status_catalogs as wsc_bind', 'ssg.workflow_status_catalog_id', '=', 'wsc_bind.id');
                if ($this->hasColumn('workflow_status_catalogs', 'status_code')) {
                    $selects[] = 'wsc_bind.status_code as workflow_status_code';
                }
                if ($this->hasColumn('workflow_status_catalogs', 'status_name')) {
                    $selects[] = 'wsc_bind.status_name as workflow_status_name';
                }
                if ($this->hasColumn('workflow_status_catalogs', 'form_key')) {
                    $selects[] = 'wsc_bind.form_key as workflow_status_form_key';
                }
            }
        }
        if ($this->hasColumn('support_service_groups', 'workflow_form_key')) {
            $selects[] = 'ssg.workflow_form_key';
        }

        if ($this->hasColumn('support_service_groups', 'customer_id')) {
            $selects[] = 'ssg.customer_id';
            if ($this->hasTable('customers')) {
                $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
                if ($this->hasColumn('customers', 'customer_code')) {
                    $selects[] = 'c.customer_code as customer_code';
                }
                if ($this->hasColumn('customers', 'customer_name')) {
                    $selects[] = 'c.customer_name as customer_name';
                }
            }
        }

        $query->select($selects);

        if (! $includeInactive && $this->hasColumn('support_service_groups', 'is_active')) {
            $query->where('ssg.is_active', 1);
        }

        if ($this->hasColumn('support_service_groups', 'customer_id') && $this->hasColumn('customers', 'customer_name')) {
            $query->orderBy('c.customer_name');
        }

        if ($this->hasColumn('support_service_groups', 'group_name')) {
            $query->orderBy('ssg.group_name');
        }
        if ($this->hasColumn('support_service_groups', 'id')) {
            $query->orderBy('ssg.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendSupportServiceGroupUsageMetadata(
                $this->serializeSupportServiceGroupRecord((array) $item),
                $usageByGroupId
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function availableSupportServiceGroups(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        if (! $this->hasColumn('support_service_groups', 'customer_id')) {
            return response()->json(['message' => 'support_service_groups.customer_id is not available.'], 503);
        }

        $validated = $request->validate([
            'customer_id' => ['required', 'integer'],
            'include_group_id' => ['nullable', 'integer'],
            'include_inactive' => ['nullable', 'boolean'],
        ]);

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $includeGroupId = $this->parseNullableInt($validated['include_group_id'] ?? null);
        if ($includeGroupId !== null && ! $this->tableRowExists('support_service_groups', $includeGroupId)) {
            return response()->json(['message' => 'include_group_id is invalid.'], 422);
        }

        $includeInactive = filter_var($validated['include_inactive'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $usageByGroupId = $this->supportServiceGroupUsageSummaryById();

        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
            'ssg.customer_id',
        ];

        if ($this->hasTable('customers')) {
            $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
            if ($this->hasColumn('customers', 'customer_code')) {
                $selects[] = 'c.customer_code as customer_code';
            }
            if ($this->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
        }

        $query->select($selects)
            ->where(function ($builder) use ($customerId, $includeInactive, $includeGroupId): void {
                $builder->where(function ($matched) use ($customerId, $includeInactive): void {
                    $matched->where('ssg.customer_id', $customerId);
                    if (! $includeInactive) {
                        $matched->where('ssg.is_active', 1);
                    }
                });

                if ($includeGroupId !== null) {
                    $builder->orWhere('ssg.id', $includeGroupId);
                }
            })
            ->orderBy('ssg.group_name')
            ->orderBy('ssg.id');

        $rows = $query
            ->get()
            ->unique(fn (object $item): string => (string) ($item->id ?? ''))
            ->map(fn (object $item): array => $this->appendSupportServiceGroupUsageMetadata(
                $this->serializeSupportServiceGroupRecord((array) $item),
                $usageByGroupId
            ))
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
            'group_code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'customer_id' => ['required', 'integer'],
            'workflow_status_catalog_id' => ['nullable', 'integer'],
            'workflow_form_key' => ['nullable', 'string', 'max:120'],
            'created_by' => ['nullable', 'integer'],
        ];

        $validated = $request->validate($rules);

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $workflowStatusCatalogId = $this->parseNullableInt($validated['workflow_status_catalog_id'] ?? null);
        if (
            $workflowStatusCatalogId !== null
            && (! $this->hasTable('workflow_status_catalogs') || ! $this->tableRowExists('workflow_status_catalogs', $workflowStatusCatalogId))
        ) {
            return response()->json(['message' => 'workflow_status_catalog_id is invalid.'], 422);
        }

        $groupName = trim((string) $validated['group_name']);
        if ($this->supportServiceGroupNameExists($groupName, null, $customerId)) {
            return response()->json(['message' => 'group_name has already been taken.'], 422);
        }

        $payload = [
            'group_name' => $groupName,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'customer_id' => $customerId,
            'workflow_status_catalog_id' => $workflowStatusCatalogId,
            'workflow_form_key' => $this->normalizeNullableString($validated['workflow_form_key'] ?? null),
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        if ($this->hasColumn('support_service_groups', 'group_code')) {
            $inputGroupCode = $this->sanitizeSupportServiceGroupCode((string) ($validated['group_code'] ?? ''));
            if ($inputGroupCode === '') {
                $payload['group_code'] = $this->generateSupportServiceGroupCode($groupName, null, $customerId);
            } else {
                if ($this->supportServiceGroupCodeExists($inputGroupCode, null, $customerId)) {
                    return response()->json(['message' => 'group_code has already been taken.'], 422);
                }
                $payload['group_code'] = $inputGroupCode;
            }
        }

        $payload = $this->filterPayloadByTableColumns('support_service_groups', $payload);

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

        $record = $this->appendSupportServiceGroupUsageMetadata(
            $record,
            $this->supportServiceGroupUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function storeSupportServiceGroupsBulk(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-service-groups', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeSupportServiceGroup($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo nhóm Zalo/Telegram yêu cầu.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo nhóm Zalo/Telegram yêu cầu.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
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
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Không thể tạo nhóm Zalo/Telegram yêu cầu.',
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
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function updateSupportServiceGroup(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_service_groups')) {
            return $this->missingTable('support_service_groups');
        }

        $current = DB::table('support_service_groups')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support service group not found.'], 404);
        }

        $rules = [
            'group_name' => ['required', 'string', 'max:100'],
            'group_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'customer_id' => ['required', 'integer'],
            'workflow_status_catalog_id' => ['sometimes', 'nullable', 'integer'],
            'workflow_form_key' => ['sometimes', 'nullable', 'string', 'max:120'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ];

        $validated = $request->validate($rules);

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $workflowStatusCatalogId = array_key_exists('workflow_status_catalog_id', $validated)
            ? $this->parseNullableInt($validated['workflow_status_catalog_id'] ?? null)
            : $this->parseNullableInt($current->workflow_status_catalog_id ?? null);
        if (
            $workflowStatusCatalogId !== null
            && (! $this->hasTable('workflow_status_catalogs') || ! $this->tableRowExists('workflow_status_catalogs', $workflowStatusCatalogId))
        ) {
            return response()->json(['message' => 'workflow_status_catalog_id is invalid.'], 422);
        }

        $groupName = trim((string) $validated['group_name']);
        if ($this->supportServiceGroupNameExists($groupName, $id, $customerId)) {
            return response()->json(['message' => 'group_name has already been taken.'], 422);
        }

        $payload = ['group_name' => $groupName];
        if ($this->hasColumn('support_service_groups', 'customer_id')) {
            $payload['customer_id'] = $customerId;
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('workflow_status_catalog_id', $validated)) {
            $payload['workflow_status_catalog_id'] = $workflowStatusCatalogId;
        }
        if (array_key_exists('workflow_form_key', $validated)) {
            $payload['workflow_form_key'] = $this->normalizeNullableString($validated['workflow_form_key'] ?? null);
        }
        if ($this->hasColumn('support_service_groups', 'group_code') && array_key_exists('group_code', $validated)) {
            $inputGroupCode = $this->sanitizeSupportServiceGroupCode((string) ($validated['group_code'] ?? ''));
            if ($inputGroupCode === '') {
                $payload['group_code'] = $this->generateSupportServiceGroupCode($groupName, $id, $customerId);
            } else {
                if ($this->supportServiceGroupCodeExists($inputGroupCode, $id, $customerId)) {
                    return response()->json(['message' => 'group_code has already been taken.'], 422);
                }
                $payload['group_code'] = $inputGroupCode;
            }
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('support_service_groups', $payload);
        if ($this->hasColumn('support_service_groups', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_service_groups')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportServiceGroupById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support service group not found.'], 404);
        }

        $record = $this->appendSupportServiceGroupUsageMetadata(
            $record,
            $this->supportServiceGroupUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    public function supportContactPositions(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_contact_positions')) {
            return $this->missingTable('support_contact_positions');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageByPositionId = $this->supportContactPositionUsageSummaryById();
        $query = DB::table('support_contact_positions')
            ->select($this->selectColumns('support_contact_positions', [
                'id',
                'position_code',
                'position_name',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->hasColumn('support_contact_positions', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->hasColumn('support_contact_positions', 'position_name')) {
            $query->orderBy('position_name');
        }
        if ($this->hasColumn('support_contact_positions', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendSupportContactPositionUsageMetadata(
                $this->serializeSupportContactPositionRecord((array) $item),
                $usageByPositionId
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSupportContactPosition(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_contact_positions')) {
            return $this->missingTable('support_contact_positions');
        }

        $validated = $request->validate([
            'position_code' => ['required', 'string', 'max:50'],
            'position_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($validated['position_code'] ?? ''));
        if ($positionCode === '') {
            return response()->json(['message' => 'position_code is invalid.'], 422);
        }

        if ($this->supportContactPositionCodeExists($positionCode)) {
            return response()->json(['message' => 'position_code has already been taken.'], 422);
        }

        $positionName = trim((string) ($validated['position_name'] ?? ''));
        if ($positionName === '') {
            return response()->json(['message' => 'position_name is required.'], 422);
        }

        if ($this->supportContactPositionNameExists($positionName)) {
            return response()->json(['message' => 'position_name has already been taken.'], 422);
        }

        $payload = [
            'position_code' => $positionCode,
            'position_name' => $positionName,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        $payload = $this->filterPayloadByTableColumns('support_contact_positions', $payload);
        if ($this->hasColumn('support_contact_positions', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('support_contact_positions', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_contact_positions')->insertGetId($payload);
        $record = $this->loadSupportContactPositionById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Support contact position created but cannot be reloaded.'], 500);
        }

        $record = $this->appendSupportContactPositionUsageMetadata(
            $record,
            $this->supportContactPositionUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function storeSupportContactPositionsBulk(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_contact_positions')) {
            return $this->missingTable('support_contact_positions');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-contact-positions', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeSupportContactPosition($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo chức vụ liên hệ.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo chức vụ liên hệ.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
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
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Không thể tạo chức vụ liên hệ.',
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
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function updateSupportContactPosition(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_contact_positions')) {
            return $this->missingTable('support_contact_positions');
        }

        $current = DB::table('support_contact_positions')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support contact position not found.'], 404);
        }

        $validated = $request->validate([
            'position_code' => ['required', 'string', 'max:50'],
            'position_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($validated['position_code'] ?? ''));
        if ($positionCode === '') {
            return response()->json(['message' => 'position_code is invalid.'], 422);
        }
        if ($this->supportContactPositionCodeExists($positionCode, $id)) {
            return response()->json(['message' => 'position_code has already been taken.'], 422);
        }

        $positionName = trim((string) ($validated['position_name'] ?? ''));
        if ($positionName === '') {
            return response()->json(['message' => 'position_name is required.'], 422);
        }
        if ($this->supportContactPositionNameExists($positionName, $id)) {
            return response()->json(['message' => 'position_name has already been taken.'], 422);
        }

        $payload = [
            'position_code' => $positionCode,
            'position_name' => $positionName,
        ];
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('support_contact_positions', $payload);
        if ($this->hasColumn('support_contact_positions', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_contact_positions')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportContactPositionById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support contact position not found.'], 404);
        }

        $record = $this->appendSupportContactPositionUsageMetadata(
            $record,
            $this->supportContactPositionUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    public function opportunityStages(Request $request): JsonResponse
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $definitions = $this->opportunityStageDefinitions($includeInactive);
        $usageByCode = $this->opportunityStageUsageSummaryByCode();

        return response()->json([
            'data' => array_values(array_map(
                fn (array $row): array => $this->appendOpportunityStageUsageMetadata($row, $usageByCode),
                $definitions
            )),
        ]);
    }

    public function storeOpportunityStage(Request $request): JsonResponse
    {
        if (! $this->hasTable('opportunity_stages')) {
            return $this->missingTable('opportunity_stages');
        }

        $validated = $request->validate([
            'stage_code' => ['required', 'string', 'max:50'],
            'stage_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_terminal' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $stageCode = $this->sanitizeOpportunityStageCode((string) ($validated['stage_code'] ?? ''));
        if ($stageCode === '') {
            return response()->json(['message' => 'stage_code is invalid.'], 422);
        }

        $stageName = trim((string) ($validated['stage_name'] ?? ''));
        if ($stageName === '') {
            return response()->json(['message' => 'stage_name is required.'], 422);
        }

        if ($this->hasColumn('opportunity_stages', 'stage_code')) {
            $exists = DB::table('opportunity_stages')
                ->whereRaw('UPPER(TRIM(stage_code)) = ?', [$stageCode])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'stage_code has already been taken.'], 422);
            }
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('opportunity_stages', [
            'stage_code' => $stageCode,
            'stage_name' => $stageName,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_terminal' => array_key_exists('is_terminal', $validated)
                ? (bool) $validated['is_terminal']
                : in_array($stageCode, ['WON', 'LOST'], true),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->hasColumn('opportunity_stages', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('opportunity_stages', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('opportunity_stages')->insertGetId($payload);
        $record = $this->loadOpportunityStageById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Opportunity stage created but cannot be reloaded.'], 500);
        }

        $record = $this->appendOpportunityStageUsageMetadata(
            $record,
            $this->opportunityStageUsageSummaryByCode()
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateOpportunityStage(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('opportunity_stages')) {
            return $this->missingTable('opportunity_stages');
        }

        $current = DB::table('opportunity_stages')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Opportunity stage not found.'], 404);
        }

        $validated = $request->validate([
            'stage_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'stage_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_terminal' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeOpportunityStageCode((string) ($current->stage_code ?? ''));
        $nextCode = array_key_exists('stage_code', $validated)
            ? $this->sanitizeOpportunityStageCode((string) ($validated['stage_code'] ?? ''))
            : $currentCode;

        if ($nextCode === '') {
            return response()->json(['message' => 'stage_code is invalid.'], 422);
        }

        $stageName = trim((string) ($validated['stage_name'] ?? ''));
        if ($stageName === '') {
            return response()->json(['message' => 'stage_name is required.'], 422);
        }

        if ($nextCode !== $currentCode) {
            $usageByCode = $this->opportunityStageUsageSummaryByCode();
            $usage = $usageByCode[$currentCode] ?? 0;
            if ((int) $usage > 0) {
                return response()->json(['message' => 'Không thể đổi mã giai đoạn đã phát sinh dữ liệu.'], 422);
            }
        }

        if ($this->hasColumn('opportunity_stages', 'stage_code')) {
            $exists = DB::table('opportunity_stages')
                ->whereRaw('UPPER(TRIM(stage_code)) = ?', [$nextCode])
                ->where('id', '<>', $id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'stage_code has already been taken.'], 422);
            }
        }

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'stage_code' => $nextCode,
            'stage_name' => $stageName,
        ];

        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_terminal', $validated)) {
            $payload['is_terminal'] = (bool) $validated['is_terminal'];
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('opportunity_stages', $payload);
        if ($this->hasColumn('opportunity_stages', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('opportunity_stages')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadOpportunityStageById($id);
        if ($record === null) {
            return response()->json(['message' => 'Opportunity stage not found.'], 404);
        }

        $record = $this->appendOpportunityStageUsageMetadata(
            $record,
            $this->opportunityStageUsageSummaryByCode()
        );

        return response()->json(['data' => $record]);
    }

    // ────────────────────────────────────────────────────────────────
    // Project Types (Loại dự án)
    // ────────────────────────────────────────────────────────────────

    public function projectTypes(Request $request): JsonResponse
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $definitions = $this->projectTypeDefinitions($includeInactive);
        $usageByCode = $this->projectTypeUsageSummaryByCode();

        return response()->json([
            'data' => array_values(array_map(
                fn (array $row): array => $this->appendProjectTypeUsageMetadata($row, $usageByCode),
                $definitions
            )),
        ]);
    }

    public function storeProjectType(Request $request): JsonResponse
    {
        if (! $this->hasTable('project_types')) {
            return $this->missingTable('project_types');
        }

        $validated = $request->validate([
            'type_code'   => ['required', 'string', 'max:100'],
            'type_name'   => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active'   => ['nullable', 'boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
            'created_by'  => ['nullable', 'integer'],
        ]);

        $typeCode = $this->sanitizeProjectTypeCode((string) ($validated['type_code'] ?? ''));
        if ($typeCode === '') {
            return response()->json(['message' => 'type_code is invalid.'], 422);
        }

        $typeName = trim((string) ($validated['type_name'] ?? ''));
        if ($typeName === '') {
            return response()->json(['message' => 'type_name is required.'], 422);
        }

        if ($this->hasColumn('project_types', 'type_code')) {
            $exists = DB::table('project_types')
                ->whereRaw('UPPER(TRIM(type_code)) = ?', [$typeCode])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'type_code has already been taken.'], 422);
            }
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('project_types', [
            'type_code'   => $typeCode,
            'type_name'   => $typeName,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active'   => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order'  => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by'  => $createdById,
            'updated_by'  => $createdById,
        ]);

        if ($this->hasColumn('project_types', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('project_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('project_types')->insertGetId($payload);
        $record = $this->loadProjectTypeById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Project type created but cannot be reloaded.'], 500);
        }

        $record = $this->appendProjectTypeUsageMetadata(
            $record,
            $this->projectTypeUsageSummaryByCode()
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateProjectType(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('project_types')) {
            return $this->missingTable('project_types');
        }

        $current = DB::table('project_types')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Project type not found.'], 404);
        }

        $validated = $request->validate([
            'type_code'   => ['sometimes', 'nullable', 'string', 'max:100'],
            'type_name'   => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active'   => ['sometimes', 'boolean'],
            'sort_order'  => ['sometimes', 'integer', 'min:0'],
            'updated_by'  => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeProjectTypeCode((string) ($current->type_code ?? ''));
        $nextCode = array_key_exists('type_code', $validated)
            ? $this->sanitizeProjectTypeCode((string) ($validated['type_code'] ?? ''))
            : $currentCode;

        if ($nextCode === '') {
            return response()->json(['message' => 'type_code is invalid.'], 422);
        }

        $typeName = trim((string) ($validated['type_name'] ?? ''));
        if ($typeName === '') {
            return response()->json(['message' => 'type_name is required.'], 422);
        }

        if ($nextCode !== $currentCode) {
            $usageByCode = $this->projectTypeUsageSummaryByCode();
            $usage = $usageByCode[$currentCode] ?? 0;
            if ((int) $usage > 0) {
                return response()->json(['message' => 'Không thể đổi mã loại dự án đã phát sinh dữ liệu.'], 422);
            }
        }

        if ($this->hasColumn('project_types', 'type_code')) {
            $exists = DB::table('project_types')
                ->whereRaw('UPPER(TRIM(type_code)) = ?', [$nextCode])
                ->where('id', '<>', $id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'type_code has already been taken.'], 422);
            }
        }

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'type_code' => $nextCode,
            'type_name' => $typeName,
        ];

        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('project_types', $payload);
        if ($this->hasColumn('project_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('project_types')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadProjectTypeById($id);
        if ($record === null) {
            return response()->json(['message' => 'Project type not found.'], 404);
        }

        $record = $this->appendProjectTypeUsageMetadata(
            $record,
            $this->projectTypeUsageSummaryByCode()
        );

        return response()->json(['data' => $record]);
    }

    public function supportRequestStatuses(Request $request): JsonResponse
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $definitions = $this->supportRequestStatusDefinitions($includeInactive);
        $usageByCode = $this->supportRequestStatusUsageSummaryByCode();

        return response()->json([
            'data' => array_values(array_map(
                fn (array $row): array => $this->appendSupportRequestStatusUsageMetadata($row, $usageByCode),
                $definitions
            )),
        ]);
    }

    public function storeSupportRequestStatus(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_request_statuses')) {
            return $this->missingTable('support_request_statuses');
        }

        $validated = $request->validate([
            'status_code' => ['required', 'string', 'max:50'],
            'status_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'requires_completion_dates' => ['nullable', 'boolean'],
            'is_terminal' => ['nullable', 'boolean'],
            'is_transfer_dev' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($validated['status_code'] ?? ''));
        if ($statusCode === '') {
            return response()->json(['message' => 'status_code is invalid.'], 422);
        }

        $statusName = trim((string) ($validated['status_name'] ?? ''));
        if ($statusName === '') {
            return response()->json(['message' => 'status_name is required.'], 422);
        }

        if ($this->hasColumn('support_request_statuses', 'status_code')) {
            $exists = DB::table('support_request_statuses')
                ->whereRaw('UPPER(status_code) = ?', [$statusCode])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'status_code has already been taken.'], 422);
            }
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('support_request_statuses', [
            'status_code' => $statusCode,
            'status_name' => $statusName,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'requires_completion_dates' => array_key_exists('requires_completion_dates', $validated)
                ? (bool) $validated['requires_completion_dates']
                : $statusCode !== 'NEW',
            'is_terminal' => array_key_exists('is_terminal', $validated)
                ? (bool) $validated['is_terminal']
                : in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true),
            'is_transfer_dev' => array_key_exists('is_transfer_dev', $validated)
                ? (bool) $validated['is_transfer_dev']
                : $statusCode === 'TRANSFER_DEV',
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->hasColumn('support_request_statuses', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('support_request_statuses', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('support_request_statuses')->insertGetId($payload);
        $record = $this->loadSupportRequestStatusById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Support request status created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function storeSupportRequestStatusesBulk(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_request_statuses')) {
            return $this->missingTable('support_request_statuses');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-request-statuses', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeSupportRequestStatus($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo trạng thái yêu cầu hỗ trợ.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo trạng thái yêu cầu hỗ trợ.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
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
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Không thể tạo trạng thái yêu cầu hỗ trợ.',
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
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function updateSupportRequestStatusDefinition(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_request_statuses')) {
            return $this->missingTable('support_request_statuses');
        }

        $current = DB::table('support_request_statuses')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request status not found.'], 404);
        }

        $validated = $request->validate([
            'status_code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status_name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'requires_completion_dates' => ['sometimes', 'boolean'],
            'is_terminal' => ['sometimes', 'boolean'],
            'is_transfer_dev' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeSupportRequestStatusCode((string) ($current->status_code ?? ''));
        $nextCode = array_key_exists('status_code', $validated)
            ? $this->sanitizeSupportRequestStatusCode((string) ($validated['status_code'] ?? ''))
            : $currentCode;

        if ($nextCode === '') {
            return response()->json(['message' => 'status_code is invalid.'], 422);
        }

        $statusName = trim((string) ($validated['status_name'] ?? ''));
        if ($statusName === '') {
            return response()->json(['message' => 'status_name is required.'], 422);
        }

        if ($nextCode !== $currentCode) {
            $usage = $this->supportRequestStatusUsageSummaryByCode()[$currentCode] ?? [
                'used_in_requests' => 0,
                'used_in_history' => 0,
            ];
            $usedInRequests = (int) ($usage['used_in_requests'] ?? 0);
            $usedInHistory = (int) ($usage['used_in_history'] ?? 0);
            if ($usedInRequests > 0 || $usedInHistory > 0) {
                return response()->json([
                    'message' => 'Không thể đổi mã trạng thái đã phát sinh dữ liệu.',
                ], 422);
            }
        }

        if ($this->hasColumn('support_request_statuses', 'status_code')) {
            $exists = DB::table('support_request_statuses')
                ->whereRaw('UPPER(TRIM(status_code)) = ?', [$nextCode])
                ->where('id', '<>', $id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'status_code has already been taken.'], 422);
            }
        }

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'status_code' => $nextCode,
            'status_name' => $statusName,
        ];

        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('requires_completion_dates', $validated)) {
            $payload['requires_completion_dates'] = (bool) $validated['requires_completion_dates'];
        }
        if (array_key_exists('is_terminal', $validated)) {
            $payload['is_terminal'] = (bool) $validated['is_terminal'];
        }
        if (array_key_exists('is_transfer_dev', $validated)) {
            $payload['is_transfer_dev'] = (bool) $validated['is_transfer_dev'];
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('support_request_statuses', $payload);
        if ($this->hasColumn('support_request_statuses', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('support_request_statuses')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportRequestStatusById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support request status not found.'], 404);
        }

        $record = $this->appendSupportRequestStatusUsageMetadata(
            $record,
            $this->supportRequestStatusUsageSummaryByCode()
        );

        return response()->json(['data' => $record]);
    }

    public function worklogActivityTypes(Request $request): JsonResponse
    {
        if (! $this->hasTable('worklog_activity_types')) {
            return $this->missingTable('worklog_activity_types');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $usageById = $this->worklogActivityTypeUsageSummaryById();
        $query = DB::table('worklog_activity_types')
            ->select($this->selectColumns('worklog_activity_types', [
                'id',
                'code',
                'name',
                'description',
                'default_is_billable',
                'phase_hint',
                'sort_order',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if (! $includeInactive && $this->hasColumn('worklog_activity_types', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($this->hasColumn('worklog_activity_types', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->hasColumn('worklog_activity_types', 'name')) {
            $query->orderBy('name');
        }
        if ($this->hasColumn('worklog_activity_types', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->appendWorklogActivityTypeUsageMetadata(
                $this->serializeWorklogActivityTypeRecord((array) $item),
                $usageById
            ))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeWorklogActivityType(Request $request): JsonResponse
    {
        if (! $this->hasTable('worklog_activity_types')) {
            return $this->missingTable('worklog_activity_types');
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'default_is_billable' => ['nullable', 'boolean'],
            'phase_hint' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $code = $this->sanitizeSupportContactPositionCode((string) ($validated['code'] ?? ''));
        if ($code === '') {
            return response()->json(['message' => 'code is invalid.'], 422);
        }
        if ($this->worklogActivityTypeCodeExists($code)) {
            return response()->json(['message' => 'code has already been taken.'], 422);
        }

        $name = trim((string) ($validated['name'] ?? ''));
        if ($name === '') {
            return response()->json(['message' => 'name is required.'], 422);
        }
        if ($this->worklogActivityTypeNameExists($name)) {
            return response()->json(['message' => 'name has already been taken.'], 422);
        }

        $phaseHint = $this->normalizeWorklogPhaseHint($validated['phase_hint'] ?? null);
        if (array_key_exists('phase_hint', $validated) && $validated['phase_hint'] !== null && $phaseHint === null) {
            return response()->json(['message' => 'phase_hint is invalid.'], 422);
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->resolveAuthenticatedUserId($request);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $payload = $this->filterPayloadByTableColumns('worklog_activity_types', [
            'code' => $code,
            'name' => $name,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'default_is_billable' => array_key_exists('default_is_billable', $validated)
                ? (bool) $validated['default_is_billable']
                : true,
            'phase_hint' => $phaseHint,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ]);

        if ($this->hasColumn('worklog_activity_types', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('worklog_activity_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('worklog_activity_types')->insertGetId($payload);
        $record = $this->loadWorklogActivityTypeById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'Worklog activity type created but cannot be reloaded.'], 500);
        }

        $record = $this->appendWorklogActivityTypeUsageMetadata(
            $record,
            $this->worklogActivityTypeUsageSummaryById()
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateWorklogActivityType(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('worklog_activity_types')) {
            return $this->missingTable('worklog_activity_types');
        }

        $current = DB::table('worklog_activity_types')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Worklog activity type not found.'], 404);
        }

        $validated = $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_is_billable' => ['sometimes', 'boolean'],
            'phase_hint' => ['sometimes', 'nullable', 'string', 'max:50'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $currentCode = $this->sanitizeSupportContactPositionCode((string) ($current->code ?? ''));
        $nextCode = array_key_exists('code', $validated)
            ? $this->sanitizeSupportContactPositionCode((string) ($validated['code'] ?? ''))
            : $currentCode;
        if ($nextCode === '') {
            return response()->json(['message' => 'code is invalid.'], 422);
        }

        $name = trim((string) ($validated['name'] ?? ''));
        if ($name === '') {
            return response()->json(['message' => 'name is required.'], 422);
        }

        $usage = $this->worklogActivityTypeUsageSummaryById()[$id] ?? 0;
        if ($nextCode !== $currentCode && (int) $usage > 0) {
            return response()->json(['message' => 'Không thể đổi mã loại công việc đã phát sinh dữ liệu.'], 422);
        }

        if ($this->worklogActivityTypeCodeExists($nextCode, $id)) {
            return response()->json(['message' => 'code has already been taken.'], 422);
        }
        if ($this->worklogActivityTypeNameExists($name, $id)) {
            return response()->json(['message' => 'name has already been taken.'], 422);
        }

        $phaseHint = array_key_exists('phase_hint', $validated)
            ? $this->normalizeWorklogPhaseHint($validated['phase_hint'] ?? null)
            : $this->normalizeWorklogPhaseHint($current->phase_hint ?? null);
        if (array_key_exists('phase_hint', $validated) && $validated['phase_hint'] !== null && $phaseHint === null) {
            return response()->json(['message' => 'phase_hint is invalid.'], 422);
        }

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $payload = [
            'code' => $nextCode,
            'name' => $name,
        ];
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('default_is_billable', $validated)) {
            $payload['default_is_billable'] = (bool) $validated['default_is_billable'];
        }
        if (array_key_exists('phase_hint', $validated)) {
            $payload['phase_hint'] = $phaseHint;
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('worklog_activity_types', $payload);
        if ($this->hasColumn('worklog_activity_types', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('worklog_activity_types')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadWorklogActivityTypeById($id);
        if ($record === null) {
            return response()->json(['message' => 'Worklog activity type not found.'], 404);
        }

        $record = $this->appendWorklogActivityTypeUsageMetadata(
            $record,
            $this->worklogActivityTypeUsageSummaryById()
        );

        return response()->json(['data' => $record]);
    }

    public function supportSlaConfigs(Request $request): JsonResponse
    {
        if (! $this->hasTable('sla_configs')) {
            return $this->missingTable('sla_configs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $joinServiceGroup = $this->hasTable('support_service_groups')
            && $this->hasColumn('sla_configs', 'service_group_id')
            && $this->hasColumn('support_service_groups', 'id');

        $columns = collect([
            'id',
            'status',
            'to_status',
            'sub_status',
            'priority',
            'sla_hours',
            'resolution_hours',
            'request_type_prefix',
            'service_group_id',
            'workflow_action_code',
            'description',
            'is_active',
            'sort_order',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
        ])
            ->filter(fn (string $column): bool => $this->hasColumn('sla_configs', $column))
            ->map(fn (string $column): string => "sc.{$column} as {$column}")
            ->values()
            ->all();

        if ($joinServiceGroup && $this->hasColumn('support_service_groups', 'group_name')) {
            $columns[] = 'ssg.group_name as service_group_name';
        }

        $query = DB::table('sla_configs as sc')->select($columns);
        if ($joinServiceGroup) {
            $query->leftJoin('support_service_groups as ssg', 'sc.service_group_id', '=', 'ssg.id');
        }

        if (! $includeInactive && $this->hasColumn('sla_configs', 'is_active')) {
            $query->where('sc.is_active', 1);
        }

        if ($this->hasColumn('sla_configs', 'sort_order')) {
            $query->orderBy('sc.sort_order');
        }
        if ($this->hasColumn('sla_configs', 'status')) {
            $query->orderBy('sc.status');
        } elseif ($this->hasColumn('sla_configs', 'to_status')) {
            $query->orderBy('sc.to_status');
        }
        if ($this->hasColumn('sla_configs', 'sub_status')) {
            $query->orderBy('sc.sub_status');
        }
        if ($this->hasColumn('sla_configs', 'priority')) {
            $query->orderBy('sc.priority');
        }
        if ($this->hasColumn('sla_configs', 'service_group_id')) {
            $query->orderBy('sc.service_group_id');
        }
        if ($this->hasColumn('sla_configs', 'workflow_action_code')) {
            $query->orderBy('sc.workflow_action_code');
        }
        if ($this->hasColumn('sla_configs', 'id')) {
            $query->orderBy('sc.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportSlaConfigRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSupportSlaConfig(Request $request): JsonResponse
    {
        if (! $this->hasTable('sla_configs')) {
            return $this->missingTable('sla_configs');
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'max:50'],
            'sub_status' => ['nullable', 'string', 'max:50'],
            'priority' => ['required', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'sla_hours' => ['required', 'numeric', 'gt:0'],
            'request_type_prefix' => ['nullable', 'string', 'max:20'],
            'service_group_id' => ['nullable', 'integer'],
            'workflow_action_code' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $status = $this->sanitizeSupportRequestStatusCode((string) ($validated['status'] ?? ''));
        if ($status === '') {
            return response()->json(['message' => 'status is invalid.'], 422);
        }
        $subStatus = $this->normalizeNullableSupportRequestStatusCode($validated['sub_status'] ?? null);
        $priority = $this->normalizeSupportRequestPriority((string) ($validated['priority'] ?? 'MEDIUM'));
        $requestTypePrefix = $this->normalizeNullableSupportRequestStatusCode($validated['request_type_prefix'] ?? null);
        $serviceGroupId = $this->parseNullableInt($validated['service_group_id'] ?? null);
        $workflowActionCode = $this->normalizeNullableWorkflowActionCode($validated['workflow_action_code'] ?? null);

        if ($serviceGroupId !== null && ! $this->tableRowExists('support_service_groups', $serviceGroupId)) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }

        if ($this->supportSlaConfigExists($status, $subStatus, $priority, $requestTypePrefix, $serviceGroupId, $workflowActionCode)) {
            return response()->json(['message' => 'SLA rule already exists for this status/sub_status/priority/scope.'], 422);
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->resolveAuthenticatedUserId($request);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $slaHours = (float) ($validated['sla_hours'] ?? 0);
        $payload = [
            'priority' => $priority,
            'request_type_prefix' => $requestTypePrefix,
            'service_group_id' => $serviceGroupId,
            'workflow_action_code' => $workflowActionCode,
            'description' => $this->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];
        if ($this->hasColumn('sla_configs', 'status')) {
            $payload['status'] = $status;
        }
        if ($this->hasColumn('sla_configs', 'to_status')) {
            $payload['to_status'] = $status;
        }
        if ($this->hasColumn('sla_configs', 'sub_status')) {
            $payload['sub_status'] = $subStatus;
        }
        if ($this->hasColumn('sla_configs', 'sla_hours')) {
            $payload['sla_hours'] = $slaHours;
        }
        if ($this->hasColumn('sla_configs', 'resolution_hours')) {
            $payload['resolution_hours'] = $slaHours;
        }

        $payload = $this->filterPayloadByTableColumns('sla_configs', $payload);
        if ($this->hasColumn('sla_configs', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->hasColumn('sla_configs', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('sla_configs')->insertGetId($payload);
        $record = $this->loadSupportSlaConfigById($insertId);
        if ($record === null) {
            return response()->json(['message' => 'SLA config created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateSupportSlaConfig(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('sla_configs')) {
            return $this->missingTable('sla_configs');
        }

        $current = DB::table('sla_configs')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'SLA config not found.'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'max:50'],
            'sub_status' => ['nullable', 'string', 'max:50'],
            'priority' => ['required', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'sla_hours' => ['required', 'numeric', 'gt:0'],
            'request_type_prefix' => ['nullable', 'string', 'max:20'],
            'service_group_id' => ['sometimes', 'nullable', 'integer'],
            'workflow_action_code' => ['sometimes', 'nullable', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
        ]);

        $status = $this->sanitizeSupportRequestStatusCode((string) ($validated['status'] ?? ''));
        if ($status === '') {
            return response()->json(['message' => 'status is invalid.'], 422);
        }
        $subStatus = $this->normalizeNullableSupportRequestStatusCode($validated['sub_status'] ?? null);
        $priority = $this->normalizeSupportRequestPriority((string) ($validated['priority'] ?? 'MEDIUM'));
        $requestTypePrefix = $this->normalizeNullableSupportRequestStatusCode($validated['request_type_prefix'] ?? null);
        $serviceGroupId = array_key_exists('service_group_id', $validated)
            ? $this->parseNullableInt($validated['service_group_id'] ?? null)
            : $this->parseNullableInt($current->service_group_id ?? null);
        $workflowActionCode = array_key_exists('workflow_action_code', $validated)
            ? $this->normalizeNullableWorkflowActionCode($validated['workflow_action_code'] ?? null)
            : $this->normalizeNullableWorkflowActionCode($current->workflow_action_code ?? null);

        if ($serviceGroupId !== null && ! $this->tableRowExists('support_service_groups', $serviceGroupId)) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }

        if ($this->supportSlaConfigExists(
            $status,
            $subStatus,
            $priority,
            $requestTypePrefix,
            $serviceGroupId,
            $workflowActionCode,
            $id
        )) {
            return response()->json(['message' => 'SLA rule already exists for this status/sub_status/priority/scope.'], 422);
        }

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->resolveAuthenticatedUserId($request);
        }
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $slaHours = (float) ($validated['sla_hours'] ?? 0);
        $payload = [
            'priority' => $priority,
            'request_type_prefix' => $requestTypePrefix,
            'service_group_id' => $serviceGroupId,
            'workflow_action_code' => $workflowActionCode,
        ];
        if ($this->hasColumn('sla_configs', 'status')) {
            $payload['status'] = $status;
        }
        if ($this->hasColumn('sla_configs', 'to_status')) {
            $payload['to_status'] = $status;
        }
        if ($this->hasColumn('sla_configs', 'sub_status')) {
            $payload['sub_status'] = $subStatus;
        }
        if ($this->hasColumn('sla_configs', 'sla_hours')) {
            $payload['sla_hours'] = $slaHours;
        }
        if ($this->hasColumn('sla_configs', 'resolution_hours')) {
            $payload['resolution_hours'] = $slaHours;
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->normalizeNullableString($validated['description'] ?? null);
        }
        if (array_key_exists('is_active', $validated)) {
            $payload['is_active'] = (bool) $validated['is_active'];
        }
        if (array_key_exists('sort_order', $validated)) {
            $payload['sort_order'] = max(0, (int) $validated['sort_order']);
        }
        if ($updatedById !== null) {
            $payload['updated_by'] = $updatedById;
        }

        $payload = $this->filterPayloadByTableColumns('sla_configs', $payload);
        if ($this->hasColumn('sla_configs', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table('sla_configs')
            ->where('id', $id)
            ->update($payload);

        $record = $this->loadSupportSlaConfigById($id);
        if ($record === null) {
            return response()->json(['message' => 'SLA config not found.'], 404);
        }

        return response()->json(['data' => $record]);
    }

    public function customerRequests(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', 'string', 'max:50'],
            'filters.sub_status' => ['nullable', 'string', 'max:50'],
            'filters.service_group_id' => ['nullable', 'integer'],
            'filters.workflow_action_code' => ['nullable', 'string', 'max:80'],
            'filters.to_status_catalog_id' => ['nullable', 'integer'],
        ]);

        $result = $this->customerRequestWorkflowService()->list($request);
        return response()->json($result);
    }

    public function customerRequestDashboardSummary(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', 'string', 'max:50'],
            'filters.sub_status' => ['nullable', 'string', 'max:50'],
            'filters.service_group_id' => ['nullable', 'integer'],
            'filters.workflow_action_code' => ['nullable', 'string', 'max:80'],
            'filters.to_status_catalog_id' => ['nullable', 'integer'],
            'filters.date_from' => ['nullable', 'date'],
            'filters.date_to' => ['nullable', 'date'],
        ]);

        return response()->json([
            'data' => $this->customerRequestWorkflowService()->dashboardSummary($request),
        ]);
    }

    public function storeCustomerRequest(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }
        $workflowService = $this->customerRequestWorkflowService();

        $validated = $request->validate([
            'status_catalog_id' => ['nullable', 'integer'],
            'summary' => ['nullable', 'string', 'max:500'],
            'project_item_id' => ['nullable', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'requester_name' => ['nullable', 'string', 'max:120'],
            'reporter_contact_id' => ['nullable', 'integer'],
            'service_group_id' => ['nullable', 'integer'],
            'receiver_user_id' => ['nullable', 'integer'],
            'assignee_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:50'],
            'sub_status' => ['nullable', 'string', 'max:50'],
            'priority' => ['nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['nullable', 'date'],
            'assigned_date' => ['nullable', 'date'],
            'hours_estimated' => ['nullable', 'numeric', 'min:0'],
            'reference_ticket_code' => ['nullable', 'string', 'max:100'],
            'reference_request_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
            'transition_note' => ['nullable', 'string'],
            'workflow_reason' => ['nullable', 'string'],
            'internal_note' => ['nullable', 'string'],
            'transition_metadata' => ['nullable', 'array'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
            'ref_tasks' => ['nullable', 'array'],
            'tasks' => ['nullable', 'array'],
            'tasks.*.task_code' => ['nullable', 'string', 'max:100'],
            'tasks.*.task_link' => ['nullable', 'string'],
            'tasks.*.status' => ['nullable', Rule::in($this->supportRequestTaskStatusValidationValues())],
            'tasks.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'worklogs' => ['nullable', 'array'],
        ]);

        $rawTransitionMetadata = $validated['transition_metadata'] ?? null;
        $metadataCanonical = $this->extractCustomerRequestCanonicalFieldsFromMetadata(
            is_array($rawTransitionMetadata) ? $rawTransitionMetadata : null
        );
        $normalizedTransitionMetadata = $this->normalizeCustomerRequestTransitionMetadata($rawTransitionMetadata);
        $transitionDateConstraintError = $this->validateCustomerRequestExchangeFeedbackDateConstraint($normalizedTransitionMetadata);
        if ($transitionDateConstraintError !== null) {
            return response()->json(['message' => $transitionDateConstraintError], 422);
        }
        $hoursEstimated = $this->parseNullableFloat($validated['hours_estimated'] ?? null);
        if ($hoursEstimated !== null && $this->numericValueHasMoreThanTwoDecimals($validated['hours_estimated'] ?? null)) {
            return response()->json(['message' => 'Số giờ dự kiến thực hiện chỉ được tối đa 2 chữ số thập phân.'], 422);
        }
        $validated['hours_estimated'] = $hoursEstimated;

        $serviceGroupSource = $validated['service_group_id'] ?? null;
        if (($serviceGroupSource === null || $serviceGroupSource === '') && array_key_exists('service_group_id', $metadataCanonical)) {
            $serviceGroupSource = $metadataCanonical['service_group_id'];
        }
        $serviceGroupId = $this->resolveSupportServiceGroupIdFromMixed($serviceGroupSource);
        if (($serviceGroupSource !== null && $serviceGroupSource !== '') && $serviceGroupId === null) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }
        if ($serviceGroupSource !== null || array_key_exists('service_group_id', $metadataCanonical)) {
            $validated['service_group_id'] = $serviceGroupId;
        }

        $statusSnapshotPayload = array_merge($validated, [
            'service_group_id' => $serviceGroupId,
        ]);
        $statusSnapshot = $workflowService->resolveStatusSnapshotForPayload($statusSnapshotPayload);
        $targetStatusCatalogId = $this->parseNullableInt($statusSnapshot['status_catalog_id'] ?? null);
        $creatingAnalysisRoot = $workflowService->isAnalysisRootCatalogId($targetStatusCatalogId)
            || $workflowService->isAnalysisStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $creatingAnalysisDescendant = $workflowService->isAnalysisDescendantCatalogId($targetStatusCatalogId);
        $creatingProcessing = $workflowService->isProcessingStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $creatingWaitingCustomerFeedback = $workflowService->isWaitingCustomerFeedbackStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $hasIncomingAnalysisProgress = $workflowService->hasIncomingAnalysisProgressInMetadata($normalizedTransitionMetadata);
        $incomingAnalysisProgress = $workflowService->extractIncomingAnalysisProgressFromMetadata($normalizedTransitionMetadata);
        $exchangeDateResult = is_array($normalizedTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($normalizedTransitionMetadata, $this->customerRequestExchangeDateTokenCandidates())
            : ['value' => null, 'invalid' => false];
        $exchangeContent = $this->extractCustomerRequestMetadataTextByTokens(
            $normalizedTransitionMetadata,
            $this->customerRequestExchangeContentTokenCandidates()
        );
        $feedbackDateResult = is_array($normalizedTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($normalizedTransitionMetadata, $this->customerRequestCustomerFeedbackDateTokenCandidates())
            : ['value' => null, 'invalid' => false];
        $feedbackContent = $this->extractCustomerRequestMetadataTextByTokens(
            $normalizedTransitionMetadata,
            $this->customerRequestCustomerFeedbackContentTokenCandidates()
        );
        if ($hasIncomingAnalysisProgress && $incomingAnalysisProgress === null) {
            return response()->json(['message' => 'Tiến độ phân tích không hợp lệ. Vui lòng nhập số nguyên từ 0 đến 100.'], 422);
        }
        if ($incomingAnalysisProgress !== null) {
            if (! $this->numericValueIsWholeNumber($incomingAnalysisProgress)) {
                return response()->json(['message' => 'Tiến độ phân tích phải là số nguyên từ 0 đến 100.'], 422);
            }
            if ($incomingAnalysisProgress < 0 || $incomingAnalysisProgress > 100) {
                return response()->json(['message' => 'Tiến độ phân tích phải trong khoảng từ 0 đến 100.'], 422);
            }
        }
        if ($creatingAnalysisDescendant) {
            return response()->json(['message' => 'Yêu cầu mới phải bắt đầu ở bước Phân tích trước khi chọn Hướng xử lý hoặc Trạng thái xử lý tiếp theo.'], 422);
        }
        if ($creatingAnalysisRoot) {
            if (! $hasIncomingAnalysisProgress || $incomingAnalysisProgress === null) {
                return response()->json(['message' => 'Tiến độ phân tích là bắt buộc.'], 422);
            }
            if ($incomingAnalysisProgress >= 100) {
                return response()->json(['message' => 'Khi tạo mới, Tiến độ phân tích phải nhỏ hơn 100%.'], 422);
            }
            if ($hoursEstimated === null) {
                return response()->json(['message' => 'Số giờ dự kiến thực hiện là bắt buộc.'], 422);
            }
        }
        if ($creatingProcessing && $hoursEstimated === null) {
            return response()->json(['message' => 'Số giờ dự kiến xử lý là bắt buộc.'], 422);
        }
        $requiresProgress = $workflowService->requiresProgressForPayload($statusSnapshotPayload);
        $hasIncomingProgress = $workflowService->hasIncomingProgressInMetadata($normalizedTransitionMetadata);
        $incomingProgress = $workflowService->extractIncomingProgressFromMetadata($normalizedTransitionMetadata);
        if ($requiresProgress && ! $hasIncomingProgress) {
            return response()->json(['message' => 'Tiến độ là bắt buộc.'], 422);
        }
        if ($hasIncomingProgress && $incomingProgress === null) {
            return response()->json(['message' => 'Tiến độ không hợp lệ. Vui lòng nhập số từ 0 đến 100.'], 422);
        }
        if ($incomingProgress !== null && ($incomingProgress < 0 || $incomingProgress > 100)) {
            return response()->json(['message' => 'Tiến độ phải trong khoảng từ 0 đến 100.'], 422);
        }

        $summary = $this->normalizeNullableString($validated['summary'] ?? null)
            ?? $this->normalizeNullableString($metadataCanonical['summary'] ?? null);
        if ($summary === null) {
            return response()->json(['message' => 'summary is required.'], 422);
        }
        $validated['summary'] = $summary;
        $validated['transition_metadata'] = $normalizedTransitionMetadata;

        $projectItemContext = null;
        $projectItemId = $this->parseNullableInt($validated['project_item_id'] ?? null);
        if ($projectItemId !== null) {
            $projectItemContext = $this->resolveSupportProjectItemContext($projectItemId);
            if ($projectItemContext === null) {
                return response()->json(['message' => 'project_item_id is invalid.'], 422);
            }
        }

        $customerId = $projectItemContext['customer_id'] ?? $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId !== null && ! $this->tableRowExists('customers', $customerId)) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }
        $serviceGroupError = $this->validateSupportServiceGroupForCustomer($customerId, $serviceGroupId);
        if ($serviceGroupError instanceof JsonResponse) {
            return $serviceGroupError;
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

        $reporterContactId = $this->parseNullableInt($validated['reporter_contact_id'] ?? null);
        if ($reporterContactId !== null) {
            $reporterContactError = $this->validateReporterContactForCustomer($customerId, $reporterContactId);
            if ($reporterContactError instanceof JsonResponse) {
                return $reporterContactError;
            }
        }

        $receiverUserIdInput = $this->parseNullableInt($validated['receiver_user_id'] ?? null);
        $receiverResolution = $this->resolveSupportReceiverUserSelection($projectId, $receiverUserIdInput);
        if (is_string($receiverResolution['error'] ?? null) && ($receiverResolution['error'] ?? '') !== '') {
            return response()->json(['message' => $receiverResolution['error']], 422);
        }
        $receiverUserId = $this->parseNullableInt($receiverResolution['receiver_user_id'] ?? null);

        $shouldRequireWaitingCustomerFeedbackFields = $creatingWaitingCustomerFeedback
            && $receiverUserId !== null
            && $receiverUserId === $assigneeId;
        if ($shouldRequireWaitingCustomerFeedbackFields) {
            if ($exchangeDateResult['value'] === null) {
                return response()->json(['message' => 'Ngày trao đổi với khách hàng là bắt buộc.'], 422);
            }
            if ($exchangeContent === null) {
                return response()->json(['message' => 'Nội dung trao đổi là bắt buộc.'], 422);
            }
            if ($feedbackDateResult['value'] === null) {
                return response()->json(['message' => 'Ngày khách hàng phản hồi là bắt buộc.'], 422);
            }
            if ($feedbackContent === null) {
                return response()->json(['message' => 'Nội dung khách hàng phản hồi là bắt buộc.'], 422);
            }
        }

        $reporterName = $this->normalizeNullableString($validated['requester_name'] ?? null);
        if ($reporterName === null) {
            $reporterName = $this->normalizeNullableString($metadataCanonical['requester_name'] ?? null);
        }
        if ($reporterContactId !== null) {
            $reporterName = $this->resolveReporterNameFromContactId($reporterContactId, $reporterName);
        }

        $referenceRequestId = $this->parseNullableInt($validated['reference_request_id'] ?? null);
        if ($referenceRequestId !== null && ! $this->tableRowExists('support_requests', $referenceRequestId)) {
            return response()->json(['message' => 'reference_request_id is invalid.'], 422);
        }

        $normalizedPayload = array_merge($validated, [
            'project_item_id' => $projectItemContext['project_item_id'] ?? $projectItemId,
            'customer_id' => $customerId,
            'project_id' => $projectId,
            'product_id' => $productId,
            'service_group_id' => $serviceGroupId,
            'assignee_id' => $assigneeId,
            'reporter_contact_id' => $reporterContactId,
            'requester_name' => $reporterName,
            'receiver_user_id' => $receiverUserId,
            'assigned_date' => $this->normalizeNullableString($validated['assigned_date'] ?? null),
            'reference_ticket_code' => $this->normalizeNullableString($validated['reference_ticket_code'] ?? null),
            'reference_request_id' => $referenceRequestId,
        ]);

        $actorId = $this->resolveAuthenticatedUserId($request);
        $record = $workflowService->create($normalizedPayload, $actorId);

        return response()->json(['data' => $record], 201);
    }

    public function updateCustomerRequest(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $current = DB::table('customer_requests')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();
        if (! $current) {
            return response()->json(['message' => 'Không tìm thấy yêu cầu khách hàng.'], 404);
        }

        $workflowService = $this->customerRequestWorkflowService();
        if (! $workflowService->viewerCanAccessCustomerRequestRow((array) $current, $actorId)) {
            return response()->json(['message' => 'Không tìm thấy yêu cầu khách hàng.'], 404);
        }
        $validated = $request->validate([
            'status_catalog_id' => ['sometimes', 'nullable', 'integer'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:500'],
            'project_item_id' => ['sometimes', 'nullable', 'integer'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'product_id' => ['sometimes', 'nullable', 'integer'],
            'requester_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'reporter_contact_id' => ['sometimes', 'nullable', 'integer'],
            'service_group_id' => ['sometimes', 'nullable', 'integer'],
            'receiver_user_id' => ['sometimes', 'nullable', 'integer'],
            'assignee_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'sub_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'priority' => ['sometimes', 'nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['sometimes', 'nullable', 'date'],
            'assigned_date' => ['sometimes', 'nullable', 'date'],
            'hours_estimated' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'reference_ticket_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'reference_request_id' => ['sometimes', 'nullable', 'integer'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'transition_note' => ['sometimes', 'nullable', 'string'],
            'workflow_reason' => ['sometimes', 'nullable', 'string'],
            'internal_note' => ['sometimes', 'nullable', 'string'],
            'transition_metadata' => ['sometimes', 'nullable', 'array'],
            'attachments' => ['sometimes', 'nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
            'ref_tasks' => ['sometimes', 'nullable', 'array'],
            'tasks' => ['sometimes', 'nullable', 'array'],
            'tasks.*.task_code' => ['nullable', 'string', 'max:100'],
            'tasks.*.task_link' => ['nullable', 'string'],
            'tasks.*.status' => ['nullable', Rule::in($this->supportRequestTaskStatusValidationValues())],
            'tasks.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'worklogs' => ['sometimes', 'nullable', 'array'],
        ]);

        $rawTransitionMetadata = array_key_exists('transition_metadata', $validated)
            ? $validated['transition_metadata']
            : null;
        $metadataCanonical = $this->extractCustomerRequestCanonicalFieldsFromMetadata(
            is_array($rawTransitionMetadata) ? $rawTransitionMetadata : null
        );
        $normalizedTransitionMetadata = array_key_exists('transition_metadata', $validated)
            ? $this->normalizeCustomerRequestTransitionMetadata($rawTransitionMetadata)
            : null;

        if (array_key_exists('transition_metadata', $validated)) {
            $validated['transition_metadata'] = $normalizedTransitionMetadata;
            $transitionDateConstraintError = $this->validateCustomerRequestExchangeFeedbackDateConstraint($normalizedTransitionMetadata);
            if ($transitionDateConstraintError !== null) {
                return response()->json(['message' => $transitionDateConstraintError], 422);
            }
        }

        $hoursEstimatedWasProvided = array_key_exists('hours_estimated', $validated);
        $hoursEstimated = $hoursEstimatedWasProvided
            ? $this->parseNullableFloat($validated['hours_estimated'] ?? null)
            : null;
        if ($hoursEstimated !== null && $this->numericValueHasMoreThanTwoDecimals($validated['hours_estimated'] ?? null)) {
            return response()->json(['message' => 'Số giờ dự kiến thực hiện chỉ được tối đa 2 chữ số thập phân.'], 422);
        }
        if ($hoursEstimatedWasProvided) {
            $validated['hours_estimated'] = $hoursEstimated;
        }

        if (! array_key_exists('service_group_id', $validated) && array_key_exists('service_group_id', $metadataCanonical)) {
            $validated['service_group_id'] = $metadataCanonical['service_group_id'];
        } elseif (array_key_exists('service_group_id', $validated)) {
            $serviceGroupInput = $validated['service_group_id'];
            if (($serviceGroupInput === null || $serviceGroupInput === '') && array_key_exists('service_group_id', $metadataCanonical)) {
                $validated['service_group_id'] = $metadataCanonical['service_group_id'];
            }
        }

        $serviceGroupId = null;
        if (array_key_exists('service_group_id', $validated)) {
            $serviceGroupSource = $validated['service_group_id'];
            $serviceGroupId = $this->resolveSupportServiceGroupIdFromMixed($serviceGroupSource);
            if (($serviceGroupSource !== null && $serviceGroupSource !== '') && $serviceGroupId === null) {
                return response()->json(['message' => 'service_group_id is invalid.'], 422);
            }
            $validated['service_group_id'] = $serviceGroupId;
        }

        $statusSnapshotPayload = array_merge($validated, [
            'service_group_id' => array_key_exists('service_group_id', $validated)
                ? $serviceGroupId
                : $this->parseNullableInt($current->service_group_id ?? null),
        ]);
        $statusSnapshot = $workflowService->resolveStatusSnapshotForPayload($statusSnapshotPayload, (array) $current);
        $targetStatusCatalogId = $this->parseNullableInt($statusSnapshot['status_catalog_id'] ?? null);
        $currentStatusToken = Str::upper(trim((string) ($current->status ?? '')));
        $targetStatusToken = Str::upper(trim((string) ($statusSnapshot['status'] ?? '')));
        if ($currentStatusToken !== 'MOI_TIEP_NHAN' && $targetStatusToken === 'MOI_TIEP_NHAN') {
            return response()->json(['message' => 'Yêu cầu đã tiếp nhận không thể quay lại bước Tiếp nhận.'], 422);
        }
        $transitionValidationError = $workflowService->validateConfiguredTransitionChange(
            (array) $current,
            $targetStatusCatalogId,
            $actorId
        );
        if ($transitionValidationError !== null) {
            return response()->json(['message' => $transitionValidationError], 422);
        }
        $currentIsAnalysis = $workflowService->isAnalysisStatus($current->status ?? null, $current->sub_status ?? null);
        $targetIsAnalysis = $workflowService->isAnalysisStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $targetIsAnalysisDescendant = $workflowService->isAnalysisDescendantCatalogId($targetStatusCatalogId);
        $currentIsProcessing = $workflowService->isProcessingStatus($current->status ?? null, $current->sub_status ?? null);
        $targetIsProcessing = $workflowService->isProcessingStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $currentIsWaitingCustomerFeedback = $workflowService->isWaitingCustomerFeedbackStatus($current->status ?? null, $current->sub_status ?? null);
        $targetIsWaitingCustomerFeedback = $workflowService->isWaitingCustomerFeedbackStatus($statusSnapshot['status'] ?? null, $statusSnapshot['sub_status'] ?? null);
        $latestAnalysisSnapshot = ($currentIsAnalysis || $targetIsAnalysis)
            ? $workflowService->resolveLatestAnalysisSnapshotByRequestCode((string) ($current->request_code ?? ''))
            : ['progress' => null, 'hours_estimated' => null, 'transition_metadata' => null];
        $latestProcessingSnapshot = ($currentIsProcessing || $targetIsProcessing)
            ? $workflowService->resolveLatestProcessingSnapshotByRequestCode((string) ($current->request_code ?? ''))
            : ['hours_estimated' => null, 'transition_metadata' => null];
        $latestWaitingCustomerFeedbackSnapshot = ($currentIsWaitingCustomerFeedback || $targetIsWaitingCustomerFeedback)
            ? $workflowService->resolveLatestWaitingCustomerFeedbackSnapshotByRequestCode((string) ($current->request_code ?? ''))
            : ['transition_metadata' => null];
        $currentTransitionMetadata = $currentIsWaitingCustomerFeedback
            ? $this->normalizeCustomerRequestTransitionMetadata($this->decodeJsonColumnIfNeeded($current->transition_metadata ?? null))
            : null;
        $exchangeDateTokens = $this->customerRequestExchangeDateTokenCandidates();
        $exchangeContentTokens = $this->customerRequestExchangeContentTokenCandidates();
        $feedbackDateTokens = $this->customerRequestCustomerFeedbackDateTokenCandidates();
        $feedbackContentTokens = $this->customerRequestCustomerFeedbackContentTokenCandidates();
        $incomingHasExchangeDate = $this->customerRequestMetadataHasAnyToken($normalizedTransitionMetadata, $exchangeDateTokens);
        $incomingHasExchangeContent = $this->customerRequestMetadataHasAnyToken($normalizedTransitionMetadata, $exchangeContentTokens);
        $incomingHasFeedbackDate = $this->customerRequestMetadataHasAnyToken($normalizedTransitionMetadata, $feedbackDateTokens);
        $incomingHasFeedbackContent = $this->customerRequestMetadataHasAnyToken($normalizedTransitionMetadata, $feedbackContentTokens);
        $incomingExchangeDateResult = is_array($normalizedTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($normalizedTransitionMetadata, $exchangeDateTokens)
            : ['value' => null, 'invalid' => false];
        $incomingFeedbackDateResult = is_array($normalizedTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($normalizedTransitionMetadata, $feedbackDateTokens)
            : ['value' => null, 'invalid' => false];
        $currentExchangeDateResult = is_array($currentTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($currentTransitionMetadata, $exchangeDateTokens)
            : ['value' => null, 'invalid' => false];
        $currentFeedbackDateResult = is_array($currentTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($currentTransitionMetadata, $feedbackDateTokens)
            : ['value' => null, 'invalid' => false];
        $latestWaitingTransitionMetadata = is_array($latestWaitingCustomerFeedbackSnapshot['transition_metadata'] ?? null)
            ? $latestWaitingCustomerFeedbackSnapshot['transition_metadata']
            : null;
        $latestWaitingExchangeDateResult = is_array($latestWaitingTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($latestWaitingTransitionMetadata, $exchangeDateTokens)
            : ['value' => null, 'invalid' => false];
        $latestWaitingFeedbackDateResult = is_array($latestWaitingTransitionMetadata)
            ? $this->extractCustomerRequestMetadataDateByTokens($latestWaitingTransitionMetadata, $feedbackDateTokens)
            : ['value' => null, 'invalid' => false];
        $incomingExchangeContent = $this->extractCustomerRequestMetadataTextByTokens($normalizedTransitionMetadata, $exchangeContentTokens);
        $currentExchangeContent = $this->extractCustomerRequestMetadataTextByTokens($currentTransitionMetadata, $exchangeContentTokens);
        $latestWaitingExchangeContent = $this->extractCustomerRequestMetadataTextByTokens($latestWaitingTransitionMetadata, $exchangeContentTokens);
        $incomingFeedbackContent = $this->extractCustomerRequestMetadataTextByTokens($normalizedTransitionMetadata, $feedbackContentTokens);
        $currentFeedbackContent = $this->extractCustomerRequestMetadataTextByTokens($currentTransitionMetadata, $feedbackContentTokens);
        $latestWaitingFeedbackContent = $this->extractCustomerRequestMetadataTextByTokens($latestWaitingTransitionMetadata, $feedbackContentTokens);
        $hasIncomingAnalysisProgress = $workflowService->hasIncomingAnalysisProgressInMetadata($normalizedTransitionMetadata);
        $incomingAnalysisProgress = $workflowService->extractIncomingAnalysisProgressFromMetadata($normalizedTransitionMetadata);
        if ($hasIncomingAnalysisProgress && $incomingAnalysisProgress === null) {
            return response()->json(['message' => 'Tiến độ phân tích không hợp lệ. Vui lòng nhập số nguyên từ 0 đến 100.'], 422);
        }
        if ($incomingAnalysisProgress !== null) {
            if (! $this->numericValueIsWholeNumber($incomingAnalysisProgress)) {
                return response()->json(['message' => 'Tiến độ phân tích phải là số nguyên từ 0 đến 100.'], 422);
            }
            if ($incomingAnalysisProgress < 0 || $incomingAnalysisProgress > 100) {
                return response()->json(['message' => 'Tiến độ phân tích phải trong khoảng từ 0 đến 100.'], 422);
            }
        }

        $effectiveAnalysisProgress = $incomingAnalysisProgress;
        if ($effectiveAnalysisProgress === null) {
            $effectiveAnalysisProgress = $this->parseNullableFloat($latestAnalysisSnapshot['progress'] ?? null);
        }
        $effectiveHoursEstimated = $hoursEstimatedWasProvided
            ? $hoursEstimated
            : $this->parseNullableFloat($latestAnalysisSnapshot['hours_estimated'] ?? null);
        $effectiveProcessingHoursEstimated = $hoursEstimatedWasProvided
            ? $hoursEstimated
            : $this->parseNullableFloat($latestProcessingSnapshot['hours_estimated'] ?? null);
        $effectiveExchangeDate = $incomingHasExchangeDate
            ? $incomingExchangeDateResult['value']
            : ($currentExchangeDateResult['value'] ?? $latestWaitingExchangeDateResult['value']);
        $effectiveExchangeContent = $incomingHasExchangeContent
            ? $incomingExchangeContent
            : ($currentExchangeContent ?? $latestWaitingExchangeContent);
        $effectiveFeedbackDate = $incomingHasFeedbackDate
            ? $incomingFeedbackDateResult['value']
            : ($currentFeedbackDateResult['value'] ?? $latestWaitingFeedbackDateResult['value']);
        $effectiveFeedbackContent = $incomingHasFeedbackContent
            ? $incomingFeedbackContent
            : ($currentFeedbackContent ?? $latestWaitingFeedbackContent);

        if ($targetIsAnalysis) {
            if ($effectiveAnalysisProgress === null) {
                return response()->json(['message' => 'Tiến độ phân tích là bắt buộc.'], 422);
            }
            if (! $this->numericValueIsWholeNumber($effectiveAnalysisProgress)) {
                return response()->json(['message' => 'Tiến độ phân tích phải là số nguyên từ 0 đến 100.'], 422);
            }
            if ($effectiveAnalysisProgress < 0 || $effectiveAnalysisProgress > 100) {
                return response()->json(['message' => 'Tiến độ phân tích phải trong khoảng từ 0 đến 100.'], 422);
            }
            if ($effectiveHoursEstimated === null) {
                return response()->json(['message' => 'Số giờ dự kiến thực hiện là bắt buộc.'], 422);
            }
        }

        if ($currentIsAnalysis && ! $targetIsAnalysis) {
            if (! $targetIsAnalysisDescendant) {
                return response()->json(['message' => 'Từ bước Phân tích chỉ được chuyển tiếp bằng Hướng xử lý và Trạng thái xử lý thuộc luồng tiếp theo.'], 422);
            }
            if ($effectiveAnalysisProgress === null || (int) round($effectiveAnalysisProgress) !== 100) {
                return response()->json(['message' => 'Chỉ khi Tiến độ phân tích = 100% mới được chọn Hướng xử lý và Trạng thái xử lý tiếp theo.'], 422);
            }
            if ($effectiveHoursEstimated === null) {
                return response()->json(['message' => 'Số giờ dự kiến thực hiện là bắt buộc.'], 422);
            }
        }
        if ($targetIsProcessing && $effectiveProcessingHoursEstimated === null) {
            return response()->json(['message' => 'Số giờ dự kiến xử lý là bắt buộc.'], 422);
        }
        $requiresProgress = $workflowService->requiresProgressForPayload($statusSnapshotPayload, (array) $current);
        $hasIncomingProgress = $workflowService->hasIncomingProgressInMetadata($normalizedTransitionMetadata);
        $incomingProgress = $workflowService->extractIncomingProgressFromMetadata($normalizedTransitionMetadata);
        if ($requiresProgress && ! $hasIncomingProgress) {
            return response()->json(['message' => 'Tiến độ là bắt buộc.'], 422);
        }
        if ($hasIncomingProgress && $incomingProgress === null) {
            return response()->json(['message' => 'Tiến độ không hợp lệ. Vui lòng nhập số từ 0 đến 100.'], 422);
        }
        if ($incomingProgress !== null) {
            if ($incomingProgress < 0 || $incomingProgress > 100) {
                return response()->json(['message' => 'Tiến độ phải trong khoảng từ 0 đến 100.'], 422);
            }

            $previousProgress = $workflowService->resolveLatestProgressByRequestCode((string) ($current->request_code ?? ''));
            if ($previousProgress !== null && $incomingProgress <= $previousProgress) {
                return response()->json([
                    'message' => sprintf(
                        'Tiến độ mới phải lớn hơn lần trước (%s%%).',
                        $this->formatProgressValue($previousProgress)
                    ),
                ], 422);
            }
        }

        if (array_key_exists('summary', $validated)) {
            $summary = $this->normalizeNullableString($validated['summary']);
            if ($summary === null) {
                $summary = $this->normalizeNullableString($metadataCanonical['summary'] ?? null);
            }
            if ($summary === null) {
                return response()->json(['message' => 'summary is required.'], 422);
            }
            $validated['summary'] = $summary;
        } elseif (array_key_exists('summary', $metadataCanonical)) {
            $metadataSummary = $this->normalizeNullableString($metadataCanonical['summary'] ?? null);
            if ($metadataSummary !== null) {
                $validated['summary'] = $metadataSummary;
            }
        }

        if (! array_key_exists('requester_name', $validated) && array_key_exists('requester_name', $metadataCanonical)) {
            $validated['requester_name'] = $metadataCanonical['requester_name'];
        } elseif (array_key_exists('requester_name', $validated)) {
            $reporterName = $this->normalizeNullableString($validated['requester_name']);
            if ($reporterName === null && array_key_exists('requester_name', $metadataCanonical)) {
                $validated['requester_name'] = $metadataCanonical['requester_name'];
            }
        }

        $updates = $validated;
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
            $updates['service_group_id'] = $serviceGroupId;
        }

        if (array_key_exists('assigned_date', $validated)) {
            $updates['assigned_date'] = $this->normalizeNullableString($validated['assigned_date']);
        }

        if (array_key_exists('customer_id', $validated) && ! $projectItemBound) {
            $customerId = $this->parseNullableInt($validated['customer_id']);
            if ($customerId !== null && ! $this->tableRowExists('customers', $customerId)) {
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

        if (array_key_exists('service_group_id', $updates)) {
            $effectiveCustomerId = array_key_exists('customer_id', $updates)
                ? $this->parseNullableInt($updates['customer_id'])
                : $this->parseNullableInt($current->customer_id ?? null);
            $serviceGroupError = $this->validateSupportServiceGroupForCustomer(
                $effectiveCustomerId,
                $this->parseNullableInt($updates['service_group_id'] ?? null),
                $this->parseNullableInt($current->service_group_id ?? null)
            );
            if ($serviceGroupError instanceof JsonResponse) {
                return $serviceGroupError;
            }
        }

        if (array_key_exists('assignee_id', $validated)) {
            $assigneeId = $this->parseNullableInt($validated['assignee_id']);
            if ($assigneeId !== null && ! $this->tableRowExists('internal_users', $assigneeId)) {
                return response()->json(['message' => 'assignee_id is invalid.'], 422);
            }
            $updates['assignee_id'] = $assigneeId;
        }

        if (array_key_exists('reporter_contact_id', $validated)) {
            $reporterContactId = $this->parseNullableInt($validated['reporter_contact_id']);
            $effectiveCustomerId = array_key_exists('customer_id', $updates)
                ? $this->parseNullableInt($updates['customer_id'])
                : $this->parseNullableInt($current->customer_id ?? null);

            if ($reporterContactId !== null) {
                $reporterContactError = $this->validateReporterContactForCustomer($effectiveCustomerId, $reporterContactId);
                if ($reporterContactError instanceof JsonResponse) {
                    return $reporterContactError;
                }
            }

            $updates['reporter_contact_id'] = $reporterContactId;
            if (! array_key_exists('requester_name', $validated) && $reporterContactId !== null) {
                $updates['requester_name'] = $this->resolveReporterNameFromContactId(
                    $reporterContactId,
                    $this->normalizeNullableString($current->requester_name ?? null)
                );
            } elseif (! array_key_exists('requester_name', $validated) && $reporterContactId === null) {
                $updates['requester_name'] = null;
            }
        }

        if (array_key_exists('receiver_user_id', $validated)) {
            $receiverUserIdInput = $this->parseNullableInt($validated['receiver_user_id']);
            $effectiveProjectId = array_key_exists('project_id', $updates)
                ? $this->parseNullableInt($updates['project_id'])
                : $this->parseNullableInt($current->project_id ?? null);
            $receiverResolution = $this->resolveSupportReceiverUserSelection($effectiveProjectId, $receiverUserIdInput);
            if (is_string($receiverResolution['error'] ?? null) && ($receiverResolution['error'] ?? '') !== '') {
                return response()->json(['message' => $receiverResolution['error']], 422);
            }
            $updates['receiver_user_id'] = $this->parseNullableInt($receiverResolution['receiver_user_id'] ?? null);
        }

        $effectiveReceiverUserId = array_key_exists('receiver_user_id', $updates)
            ? $this->parseNullableInt($updates['receiver_user_id'])
            : $this->parseNullableInt($current->receiver_user_id ?? null);
        $effectiveAssigneeId = array_key_exists('assignee_id', $updates)
            ? $this->parseNullableInt($updates['assignee_id'])
            : $this->parseNullableInt($current->assignee_id ?? null);
        $shouldRequireWaitingCustomerFeedbackFields = $targetIsWaitingCustomerFeedback
            && $effectiveReceiverUserId !== null
            && $effectiveReceiverUserId === $effectiveAssigneeId;
        if ($shouldRequireWaitingCustomerFeedbackFields) {
            if ($effectiveExchangeDate === null) {
                return response()->json(['message' => 'Ngày trao đổi với khách hàng là bắt buộc.'], 422);
            }
            if ($effectiveExchangeContent === null) {
                return response()->json(['message' => 'Nội dung trao đổi là bắt buộc.'], 422);
            }
            if ($effectiveFeedbackDate === null) {
                return response()->json(['message' => 'Ngày khách hàng phản hồi là bắt buộc.'], 422);
            }
            if ($effectiveFeedbackContent === null) {
                return response()->json(['message' => 'Nội dung khách hàng phản hồi là bắt buộc.'], 422);
            }
        }

        if (array_key_exists('reference_request_id', $validated)) {
            $referenceRequestId = $this->parseNullableInt($validated['reference_request_id']);
            if ($referenceRequestId !== null && ! $this->tableRowExists('support_requests', $referenceRequestId)) {
                return response()->json(['message' => 'reference_request_id is invalid.'], 422);
            }
            $updates['reference_request_id'] = $referenceRequestId;
        }

        if (array_key_exists('reference_ticket_code', $validated)) {
            $updates['reference_ticket_code'] = $this->normalizeNullableString($validated['reference_ticket_code']);
        }

        $record = $workflowService->update($id, $updates, $actorId);

        return response()->json(['data' => $record]);
    }

    public function deleteCustomerRequest(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $current = DB::table('customer_requests')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();
        if (! $current) {
            return response()->json(['message' => 'Không tìm thấy yêu cầu khách hàng.'], 404);
        }
        if (! $this->customerRequestWorkflowService()->viewerCanAccessCustomerRequestRow((array) $current, $actorId)) {
            return response()->json(['message' => 'Không tìm thấy yêu cầu khách hàng.'], 404);
        }
        $this->customerRequestWorkflowService()->delete($id, $actorId);

        return response()->json(['success' => true]);
    }

    public function customerRequestHistory(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $actorId = $this->resolveAuthenticatedUserId($request);

        return response()->json([
            'data' => $this->customerRequestWorkflowService()->history($id, $actorId),
        ]);
    }

    public function customerRequestHistories(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $validated = $request->validate([
            'request_id' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'filters' => ['nullable', 'array'],
            'filters.service_group_id' => ['nullable', 'integer'],
            'filters.workflow_action_code' => ['nullable', 'string', 'max:80'],
            'filters.to_status_catalog_id' => ['nullable', 'integer'],
            'filters.date_from' => ['nullable', 'date'],
            'filters.date_to' => ['nullable', 'date'],
        ]);

        $requestId = $this->parseNullableInt($validated['request_id'] ?? null);
        $limit = min(1000, max(1, (int) ($validated['limit'] ?? 200)));
        $filters = is_array($validated['filters'] ?? null) ? $validated['filters'] : [];
        $actorId = $this->resolveAuthenticatedUserId($request);

        return response()->json([
            'data' => $this->customerRequestWorkflowService()->histories($requestId, $limit, $filters, $actorId),
        ]);
    }

    public function importCustomerRequests(Request $request): JsonResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return $this->missingTable('customer_requests');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:1000'],
            'items.*' => ['required', 'array'],
        ]);

        $actorId = $this->resolveAuthenticatedUserId($request);
        $result = $this->customerRequestWorkflowService()->import($validated['items'], $actorId);

        return response()->json(['data' => $result], ($result['failed_count'] ?? 0) > 0 ? 200 : 201);
    }

    public function exportCustomerRequests(Request $request): StreamedResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return response()->streamDownload(
                static function (): void {},
                'customer_requests_empty.csv',
                ['Content-Type' => 'text/csv; charset=UTF-8']
            );
        }

        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', 'string', 'max:50'],
            'filters.sub_status' => ['nullable', 'string', 'max:50'],
            'filters.service_group_id' => ['nullable', 'integer'],
            'filters.workflow_action_code' => ['nullable', 'string', 'max:80'],
            'filters.to_status_catalog_id' => ['nullable', 'integer'],
        ]);

        return $this->customerRequestWorkflowService()->export($request);
    }

    public function exportCustomerRequestDashboardSummary(Request $request): StreamedResponse
    {
        if (! $this->hasTable('customer_requests')) {
            return response()->streamDownload(
                static function (): void {},
                'customer_request_dashboard_summary_empty.csv',
                ['Content-Type' => 'text/csv; charset=UTF-8']
            );
        }

        $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'filters' => ['nullable', 'array'],
            'filters.status' => ['nullable', 'string', 'max:50'],
            'filters.sub_status' => ['nullable', 'string', 'max:50'],
            'filters.service_group_id' => ['nullable', 'integer'],
            'filters.workflow_action_code' => ['nullable', 'string', 'max:80'],
            'filters.to_status_catalog_id' => ['nullable', 'integer'],
            'filters.date_from' => ['nullable', 'date'],
            'filters.date_to' => ['nullable', 'date'],
        ]);

        return $this->customerRequestWorkflowService()->exportDashboardSummary($request);
    }

    public function workflowStatusCatalogs(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_status_catalogs')) {
            return $this->missingTable('workflow_status_catalogs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $rows = $this->customerRequestWorkflowService()->listWorkflowStatusCatalogs($includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function storeWorkflowStatusCatalog(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_status_catalogs')) {
            return $this->missingTable('workflow_status_catalogs');
        }

        $validated = $request->validate([
            'level' => ['required', 'integer', 'between:1,3'],
            'status_code' => ['required', 'string', 'max:80'],
            'status_name' => ['required', 'string', 'max:150'],
            'parent_id' => ['nullable', 'integer'],
            'canonical_status' => ['nullable', 'string', 'max:50'],
            'canonical_sub_status' => ['nullable', 'string', 'max:50'],
            'flow_step' => ['nullable', 'string', 'max:20'],
            'form_key' => ['nullable', 'string', 'max:120'],
            'is_leaf' => ['nullable', 'boolean'],
            'allow_pending_selection' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = $this->customerRequestWorkflowService()
            ->storeWorkflowStatusCatalog($validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row], 201);
    }

    public function updateWorkflowStatusCatalog(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('workflow_status_catalogs')) {
            return $this->missingTable('workflow_status_catalogs');
        }

        $validated = $request->validate([
            'level' => ['sometimes', 'integer', 'between:1,3'],
            'status_code' => ['sometimes', 'string', 'max:80'],
            'status_name' => ['sometimes', 'string', 'max:150'],
            'parent_id' => ['sometimes', 'nullable', 'integer'],
            'canonical_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'canonical_sub_status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'flow_step' => ['sometimes', 'nullable', 'string', 'max:20'],
            'form_key' => ['sometimes', 'nullable', 'string', 'max:120'],
            'is_leaf' => ['sometimes', 'boolean'],
            'allow_pending_selection' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->customerRequestWorkflowService()
            ->updateWorkflowStatusCatalog($id, $validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row]);
    }

    public function workflowFormFieldConfigs(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_form_field_configs')) {
            return $this->missingTable('workflow_form_field_configs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $statusCatalogId = $this->parseNullableInt($request->query('status_catalog_id'));
        $rows = $this->customerRequestWorkflowService()
            ->listWorkflowFormFieldConfigs($statusCatalogId, $includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function workflowStatusTransitions(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_status_transitions')) {
            return $this->missingTable('workflow_status_transitions');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $fromStatusCatalogId = $this->parseNullableInt($request->query('from_status_catalog_id'));
        $rows = $this->customerRequestWorkflowService()
            ->listWorkflowStatusTransitions($fromStatusCatalogId, $includeInactive);

        return response()->json(['data' => $rows]);
    }

    public function storeWorkflowStatusTransition(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_status_transitions')) {
            return $this->missingTable('workflow_status_transitions');
        }

        $validated = $request->validate([
            'from_status_catalog_id' => ['required', 'integer'],
            'to_status_catalog_id' => ['required', 'integer'],
            'action_code' => ['required', 'string', 'max:80'],
            'action_name' => ['required', 'string', 'max:150'],
            'required_role' => ['nullable', 'string', 'max:50'],
            'condition_json' => ['nullable', 'array'],
            'notify_targets_json' => ['nullable', 'array'],
            'notify_targets_json.*' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $row = $this->customerRequestWorkflowService()
            ->storeWorkflowStatusTransition($validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row], 201);
    }

    public function updateWorkflowStatusTransition(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('workflow_status_transitions')) {
            return $this->missingTable('workflow_status_transitions');
        }

        $validated = $request->validate([
            'from_status_catalog_id' => ['sometimes', 'integer'],
            'to_status_catalog_id' => ['sometimes', 'integer'],
            'action_code' => ['sometimes', 'string', 'max:80'],
            'action_name' => ['sometimes', 'string', 'max:150'],
            'required_role' => ['sometimes', 'nullable', 'string', 'max:50'],
            'condition_json' => ['sometimes', 'nullable', 'array'],
            'notify_targets_json' => ['sometimes', 'nullable', 'array'],
            'notify_targets_json.*' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = $this->customerRequestWorkflowService()
            ->updateWorkflowStatusTransition($id, $validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row]);
    }

    public function storeWorkflowFormFieldConfig(Request $request): JsonResponse
    {
        if (! $this->hasTable('workflow_form_field_configs')) {
            return $this->missingTable('workflow_form_field_configs');
        }

        $validated = $request->validate([
            'status_catalog_id' => ['required', 'integer'],
            'field_key' => ['required', 'string', 'max:120'],
            'field_label' => ['required', 'string', 'max:190'],
            'field_type' => ['nullable', 'string', 'max:50'],
            'required' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'excel_column' => ['nullable', 'string', 'max:5'],
            'options_json' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $workflowFieldGuardMessage = $this->validateWorkflowStaticFieldCanonicalKey(
            (string) ($validated['field_label'] ?? ''),
            (string) ($validated['field_key'] ?? '')
        );
        if ($workflowFieldGuardMessage !== null) {
            return response()->json(['message' => $workflowFieldGuardMessage], 422);
        }

        $row = $this->customerRequestWorkflowService()
            ->storeWorkflowFormFieldConfig($validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row], 201);
    }

    public function updateWorkflowFormFieldConfig(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('workflow_form_field_configs')) {
            return $this->missingTable('workflow_form_field_configs');
        }

        $validated = $request->validate([
            'status_catalog_id' => ['sometimes', 'integer'],
            'field_key' => ['sometimes', 'string', 'max:120'],
            'field_label' => ['sometimes', 'string', 'max:190'],
            'field_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'required' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'excel_column' => ['sometimes', 'nullable', 'string', 'max:5'],
            'options_json' => ['sometimes', 'nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $current = DB::table('workflow_form_field_configs')
            ->where('id', $id)
            ->first();
        if ($current === null) {
            return response()->json(['message' => 'Không tìm thấy field config workflow.'], 404);
        }

        $effectiveFieldLabel = array_key_exists('field_label', $validated)
            ? (string) ($validated['field_label'] ?? '')
            : (string) ($current->field_label ?? '');
        $effectiveFieldKey = array_key_exists('field_key', $validated)
            ? (string) ($validated['field_key'] ?? '')
            : (string) ($current->field_key ?? '');

        $workflowFieldGuardMessage = $this->validateWorkflowStaticFieldCanonicalKey(
            $effectiveFieldLabel,
            $effectiveFieldKey
        );
        if ($workflowFieldGuardMessage !== null) {
            return response()->json(['message' => $workflowFieldGuardMessage], 422);
        }

        $row = $this->customerRequestWorkflowService()
            ->updateWorkflowFormFieldConfig($id, $validated, $this->resolveAuthenticatedUserId($request));

        return response()->json(['data' => $row]);
    }

    public function customerRequestReceivers(Request $request): JsonResponse
    {
        return $this->supportRequestReceivers($request);
    }

    public function supportRequestReceivers(Request $request): JsonResponse
    {
        if (! $this->hasTable('internal_users')) {
            return $this->missingTable('internal_users');
        }

        $projectId = $this->parseNullableInt($this->readFilterParam($request, 'project_id'));
        $projectItemId = $this->parseNullableInt($this->readFilterParam($request, 'project_item_id'));

        if ($projectId === null && $projectItemId !== null) {
            $projectItemContext = $this->resolveSupportProjectItemContext($projectItemId);
            $projectId = $projectItemContext['project_id'] ?? null;
        }

        $raciRows = $this->fetchProjectRaciReceiverRows($projectId);
        $defaultReceiverUserId = $this->resolveDefaultReceiverUserIdFromRaciRows($raciRows);

        $options = collect($raciRows)
            ->map(function (array $row) use ($defaultReceiverUserId): array {
                $userId = $this->parseNullableInt($row['user_id'] ?? null);
                return [
                    'user_id' => $userId,
                    'user_code' => $row['user_code'] ?? null,
                    'username' => $row['username'] ?? null,
                    'full_name' => $row['full_name'] ?? null,
                    'raci_role' => $row['raci_role'] ?? null,
                    'is_default' => $userId !== null && $defaultReceiverUserId !== null && $userId === $defaultReceiverUserId,
                ];
            })
            ->filter(fn (array $row): bool => $this->parseNullableInt($row['user_id'] ?? null) !== null)
            ->values();

        if ($options->isEmpty()) {
            $fallbackOptions = DB::table('internal_users')
                ->select($this->selectColumns('internal_users', ['id', 'user_code', 'username', 'full_name', 'status']))
                ->when(
                    $this->hasColumn('internal_users', 'status'),
                    fn ($query) => $query->whereIn('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])
                )
                ->when(
                    $this->hasColumn('internal_users', 'full_name'),
                    fn ($query) => $query->orderBy('full_name'),
                    fn ($query) => $query->orderBy('id')
                )
                ->limit(1000)
                ->get()
                ->map(function (object $item): array {
                    $row = (array) $item;
                    return [
                        'user_id' => $this->parseNullableInt($row['id'] ?? null),
                        'user_code' => $row['user_code'] ?? null,
                        'username' => $row['username'] ?? null,
                        'full_name' => $row['full_name'] ?? null,
                        'raci_role' => null,
                        'is_default' => false,
                    ];
                })
                ->values();

            $options = $fallbackOptions;
        }

        return response()->json([
            'data' => [
                'project_id' => $projectId,
                'project_item_id' => $projectItemId,
                'default_receiver_user_id' => $defaultReceiverUserId,
                'options' => $options,
            ],
        ]);
    }

    public function supportRequestReferenceSearch(Request $request): JsonResponse
    {
        if ($this->hasTable('customer_requests')) {
            return $this->customerRequestReferenceSearch($request);
        }

        if (! $this->hasTable('support_requests')) {
            return response()->json(['data' => []]);
        }

        $supportsRequestCode = $this->hasColumn('support_requests', 'request_code');
        $supportsLegacyTaskLookup = $this->hasTable('support_request_tasks')
            && $this->hasColumn('support_request_tasks', 'request_id')
            && $this->hasColumn('support_request_tasks', 'task_code');

        if (! $supportsRequestCode && ! $supportsLegacyTaskLookup) {
            return response()->json(['data' => []]);
        }

        $queryText = trim((string) ($request->query('q', '') ?? ''));
        $excludeId = $this->parseNullableInt($request->query('exclude_id'));
        $limit = (int) ($request->query('limit', 20) ?? 20);
        $limit = max(1, min(50, $limit));

        $requestCodeRows = [];
        $taskCodeRows = [];

        if ($supportsRequestCode) {
            $requestCodeQuery = DB::table('support_requests as sr')
                ->select([
                    'sr.id as id',
                    'sr.request_code as request_code',
                    'sr.summary as summary',
                    'sr.status as status',
                    'sr.requested_date as requested_date',
                ])
                ->whereNotNull('sr.request_code')
                ->where('sr.request_code', '<>', '');

            $this->applySupportRequestReadScope($request, $requestCodeQuery);

            if ($excludeId !== null) {
                $requestCodeQuery->where('sr.id', '<>', $excludeId);
            }
            if ($this->hasColumn('support_requests', 'deleted_at')) {
                $requestCodeQuery->whereNull('sr.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $requestCodeQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('sr.request_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw("REPLACE(REPLACE(REPLACE(UPPER(sr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?", ['%'.strtoupper($compact).'%']);
                    }

                    if ($this->hasColumn('support_requests', 'summary')) {
                        $builder->orWhere('sr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $requestCodeQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(sr.request_code) = UPPER(?) THEN 0
                        WHEN UPPER(sr.request_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(sr.request_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->hasColumn('support_requests', 'requested_date')) {
                $requestCodeQuery->orderBy('sr.requested_date', 'desc');
            }
            if ($this->hasColumn('support_requests', 'id')) {
                $requestCodeQuery->orderBy('sr.id', 'desc');
            }

            $requestCodeRows = $requestCodeQuery
                ->limit($limit * 2)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));
                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => null,
                        'ticket_code' => null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0)
                ->values();
        }

        if ($supportsLegacyTaskLookup) {
            $legacyQuery = DB::table('support_request_tasks as srt')
                ->join('support_requests as sr', 'srt.request_id', '=', 'sr.id')
                ->select([
                    'sr.id as id',
                    'sr.request_code as request_code',
                    'srt.task_code as task_code',
                    'sr.summary as summary',
                    'sr.status as status',
                    'sr.requested_date as requested_date',
                ])
                ->whereNotNull('srt.task_code')
                ->where('srt.task_code', '<>', '');

            $this->applySupportRequestReadScope($request, $legacyQuery);

            if ($excludeId !== null) {
                $legacyQuery->where('sr.id', '<>', $excludeId);
            }
            if ($this->hasColumn('support_requests', 'deleted_at')) {
                $legacyQuery->whereNull('sr.deleted_at');
            }
            if ($this->hasColumn('support_request_tasks', 'deleted_at')) {
                $legacyQuery->whereNull('srt.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $legacyQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('srt.task_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw("REPLACE(REPLACE(REPLACE(UPPER(srt.task_code), '-', ''), '_', ''), ' ', '') LIKE ?", ['%'.strtoupper($compact).'%']);
                    }

                    if ($this->hasColumn('support_requests', 'summary')) {
                        $builder->orWhere('sr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $legacyQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(srt.task_code) = UPPER(?) THEN 0
                        WHEN UPPER(srt.task_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(srt.task_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->hasColumn('support_requests', 'requested_date')) {
                $legacyQuery->orderBy('sr.requested_date', 'desc');
            }
            if ($this->hasColumn('support_request_tasks', 'id')) {
                $legacyQuery->orderBy('srt.id', 'desc');
            }

            $taskCodeRows = $legacyQuery
                ->limit($limit * 3)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));
                    $taskCode = trim((string) ($row->task_code ?? ''));
                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => $taskCode,
                        'ticket_code' => $taskCode,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0 && $row['task_code'] !== '')
                ->values();
        }

        $resolvedRows = array_merge($taskCodeRows, $requestCodeRows);
        $requestIds = array_values(array_filter(array_map(
            fn (array $row): int => (int) ($row['id'] ?? 0),
            $resolvedRows
        ), fn (int $id): bool => $id > 0));

        $taskCodeMap = $this->loadSupportRequestPrimaryTaskCodeMap($requestIds);
        $resolvedRows = array_values(array_filter(array_map(function (array $row) use ($taskCodeMap): array {
            $requestId = (int) ($row['id'] ?? 0);
            $taskCode = $this->normalizeNullableString($row['task_code'] ?? null);
            $ticketCode = $this->normalizeNullableString($row['ticket_code'] ?? null);
            $requestCode = $this->normalizeNullableString($row['request_code'] ?? null);

            if ($taskCode === null && isset($taskCodeMap[$requestId])) {
                $taskCode = $taskCodeMap[$requestId];
            }
            if ($taskCode === null) {
                $taskCode = $ticketCode;
            }
            if ($taskCode === null) {
                $taskCode = $requestCode;
            }

            if ($ticketCode === null) {
                $ticketCode = $taskCode;
            }
            if ($ticketCode === null) {
                $ticketCode = $requestCode;
            }

            $row['task_code'] = $taskCode;
            $row['ticket_code'] = $ticketCode;
            $row['request_code'] = $requestCode;

            return $row;
        }, $resolvedRows), fn (array $row): bool => trim((string) ($row['ticket_code'] ?? '')) !== ''));

        $rowsByKey = [];
        foreach ($resolvedRows as $row) {
            $requestId = (int) ($row['id'] ?? 0);
            $taskCode = $this->normalizeNullableString($row['task_code'] ?? null);
            $requestCode = $this->normalizeNullableString($row['request_code'] ?? null);
            $rowKey = sprintf(
                'REQ@%d|TASK@%s',
                $requestId,
                strtoupper((string) ($taskCode ?? $requestCode ?? ''))
            );
            if (! isset($rowsByKey[$rowKey])) {
                $rowsByKey[$rowKey] = $row;
            }
        }

        return response()->json([
            'data' => array_values(array_slice(array_values($rowsByKey), 0, $limit)),
        ]);
    }

    private function customerRequestReferenceSearch(Request $request): JsonResponse
    {
        $supportsRequestCode = $this->hasColumn('customer_requests', 'request_code');
        $supportsReferenceTaskLookup = $this->hasTable('request_ref_tasks')
            && $this->hasColumn('request_ref_tasks', 'request_code')
            && $this->hasColumn('request_ref_tasks', 'task_code');

        if (! $supportsRequestCode && ! $supportsReferenceTaskLookup) {
            return response()->json(['data' => []]);
        }

        $queryText = trim((string) ($request->query('q', '') ?? ''));
        $excludeId = $this->parseNullableInt($request->query('exclude_id'));
        $limit = (int) ($request->query('limit', 20) ?? 20);
        $limit = max(1, min(50, $limit));

        $requestCodeRows = [];
        $taskCodeRows = [];

        if ($supportsRequestCode) {
            $requestCodeQuery = DB::table('customer_requests as cr')
                ->select([
                    'cr.id as id',
                    'cr.request_code as request_code',
                    'cr.summary as summary',
                    'cr.status as status',
                    'cr.requested_date as requested_date',
                ])
                ->whereNotNull('cr.request_code')
                ->where('cr.request_code', '<>', '');

            $this->applyCustomerRequestReadScope($request, $requestCodeQuery);

            if ($excludeId !== null) {
                $requestCodeQuery->where('cr.id', '<>', $excludeId);
            }
            if ($this->hasColumn('customer_requests', 'deleted_at')) {
                $requestCodeQuery->whereNull('cr.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $requestCodeQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('cr.request_code', 'like', $like);
                    if ($compact !== '') {
                        $builder->orWhereRaw("REPLACE(REPLACE(REPLACE(UPPER(cr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?", ['%'.strtoupper($compact).'%']);
                    }

                    if ($this->hasColumn('customer_requests', 'summary')) {
                        $builder->orWhere('cr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $requestCodeQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(cr.request_code) = UPPER(?) THEN 0
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 2
                        ELSE 3
                     END",
                    [$queryText, $escaped.'%', '%'.$escaped.'%']
                );
            }

            if ($this->hasColumn('customer_requests', 'requested_date')) {
                $requestCodeQuery->orderBy('cr.requested_date', 'desc');
            }
            if ($this->hasColumn('customer_requests', 'id')) {
                $requestCodeQuery->orderBy('cr.id', 'desc');
            }

            $requestCodeRows = $requestCodeQuery
                ->limit($limit * 2)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => null,
                        'ticket_code' => null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0)
                ->values()
                ->all();
        }

        if ($supportsReferenceTaskLookup) {
            $referenceQuery = DB::table('request_ref_tasks as rrt')
                ->join('customer_requests as cr', function ($join): void {
                    $join->whereRaw('BINARY rrt.request_code = BINARY cr.request_code');
                })
                ->select([
                    'cr.id as id',
                    'cr.request_code as request_code',
                    'rrt.task_code as task_code',
                    'cr.summary as summary',
                    'cr.status as status',
                    'cr.requested_date as requested_date',
                ])
                ->whereNotNull('rrt.request_code')
                ->where('rrt.request_code', '<>', '')
                ->whereNotNull('rrt.task_code')
                ->where('rrt.task_code', '<>', '');

            if ($this->hasColumn('request_ref_tasks', 'task_source')) {
                $referenceQuery->where('rrt.task_source', 'REFERENCE');
            }

            $this->applyCustomerRequestReadScope($request, $referenceQuery);

            if ($excludeId !== null) {
                $referenceQuery->where('cr.id', '<>', $excludeId);
            }
            if ($this->hasColumn('customer_requests', 'deleted_at')) {
                $referenceQuery->whereNull('cr.deleted_at');
            }
            if ($this->hasColumn('request_ref_tasks', 'deleted_at')) {
                $referenceQuery->whereNull('rrt.deleted_at');
            }

            if ($queryText !== '') {
                $like = '%'.$queryText.'%';
                $compact = preg_replace('/[^A-Za-z0-9]+/', '', $queryText) ?? '';

                $referenceQuery->where(function ($builder) use ($like, $compact): void {
                    $builder->where('rrt.task_code', 'like', $like)
                        ->orWhere('cr.request_code', 'like', $like);

                    if ($compact !== '') {
                        $builder
                            ->orWhereRaw("REPLACE(REPLACE(REPLACE(UPPER(rrt.task_code), '-', ''), '_', ''), ' ', '') LIKE ?", ['%'.strtoupper($compact).'%'])
                            ->orWhereRaw("REPLACE(REPLACE(REPLACE(UPPER(cr.request_code), '-', ''), '_', ''), ' ', '') LIKE ?", ['%'.strtoupper($compact).'%']);
                    }

                    if ($this->hasColumn('customer_requests', 'summary')) {
                        $builder->orWhere('cr.summary', 'like', $like);
                    }
                });

                $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryText);
                $referenceQuery->orderByRaw(
                    "CASE
                        WHEN UPPER(rrt.task_code) = UPPER(?) THEN 0
                        WHEN UPPER(rrt.task_code) LIKE UPPER(?) THEN 1
                        WHEN UPPER(cr.request_code) = UPPER(?) THEN 2
                        WHEN UPPER(cr.request_code) LIKE UPPER(?) THEN 3
                        ELSE 4
                     END",
                    [$queryText, $escaped.'%', $queryText, $escaped.'%']
                );
            }

            if ($this->hasColumn('customer_requests', 'requested_date')) {
                $referenceQuery->orderBy('cr.requested_date', 'desc');
            }
            if ($this->hasColumn('request_ref_tasks', 'sort_order')) {
                $referenceQuery->orderBy('rrt.sort_order');
            }
            if ($this->hasColumn('request_ref_tasks', 'id')) {
                $referenceQuery->orderBy('rrt.id', 'desc');
            }

            $taskCodeRows = $referenceQuery
                ->limit($limit * 3)
                ->get()
                ->map(function (object $row): array {
                    $requestCode = trim((string) ($row->request_code ?? ''));
                    $taskCode = trim((string) ($row->task_code ?? ''));

                    return [
                        'id' => (int) ($row->id ?? 0),
                        'request_code' => $requestCode !== '' ? $requestCode : null,
                        'task_code' => $taskCode !== '' ? $taskCode : null,
                        'ticket_code' => $taskCode !== '' ? $taskCode : null,
                        'summary' => (string) ($row->summary ?? ''),
                        'status' => $this->normalizeSupportRequestStatus((string) ($row->status ?? 'NEW')),
                        'requested_date' => $row->requested_date ?? null,
                    ];
                })
                ->filter(fn (array $row): bool => $row['id'] > 0 && trim((string) ($row['task_code'] ?? '')) !== '')
                ->values()
                ->all();
        }

        $resolvedRows = array_merge($taskCodeRows, $requestCodeRows);
        $requestCodes = array_values(array_filter(array_map(
            fn (array $row): ?string => $this->normalizeNullableString($row['request_code'] ?? null),
            $resolvedRows
        )));

        $primaryTaskCodeMap = $this->loadCustomerRequestPrimaryReferenceTaskCodeMap($requestCodes);
        $resolvedRows = array_values(array_filter(array_map(function (array $row) use ($primaryTaskCodeMap): array {
            $requestCode = $this->normalizeNullableString($row['request_code'] ?? null);
            $taskCode = $this->normalizeNullableString($row['task_code'] ?? null);
            $ticketCode = $this->normalizeNullableString($row['ticket_code'] ?? null);

            if ($taskCode === null && $requestCode !== null && isset($primaryTaskCodeMap[$requestCode])) {
                $taskCode = $primaryTaskCodeMap[$requestCode];
            }
            if ($taskCode === null) {
                $taskCode = $ticketCode;
            }
            if ($taskCode === null) {
                $taskCode = $requestCode;
            }

            if ($ticketCode === null) {
                $ticketCode = $taskCode;
            }
            if ($ticketCode === null) {
                $ticketCode = $requestCode;
            }

            $row['request_code'] = $requestCode;
            $row['task_code'] = $taskCode;
            $row['ticket_code'] = $ticketCode;

            return $row;
        }, $resolvedRows), fn (array $row): bool => trim((string) ($row['ticket_code'] ?? '')) !== ''));

        $rowsByKey = [];
        foreach ($resolvedRows as $row) {
            $requestId = (int) ($row['id'] ?? 0);
            $taskCode = $this->normalizeNullableString($row['task_code'] ?? null);
            $requestCode = $this->normalizeNullableString($row['request_code'] ?? null);
            $rowKey = sprintf(
                'REQ@%d|TASK@%s',
                $requestId,
                strtoupper((string) ($taskCode ?? $requestCode ?? ''))
            );
            if (! isset($rowsByKey[$rowKey])) {
                $rowsByKey[$rowKey] = $row;
            }
        }

        return response()->json([
            'data' => array_values(array_slice(array_values($rowsByKey), 0, $limit)),
        ]);
    }

    public function exportSupportRequests(Request $request): StreamedResponse
    {
        $format = strtolower(trim((string) ($request->query('format', 'csv') ?? 'csv')));
        if ($format !== 'csv') {
            $format = 'csv';
        }

        $filename = 'support_requests_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($request): void {
            $output = fopen('php://output', 'wb');
            if (! is_resource($output)) {
                return;
            }

            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'Nội dung yêu cầu',
                'Mã yêu cầu',
                'Khách hàng',
                'Nhóm Zalo/Telegram yêu cầu',
                'Người xử lý',
                'Người tiếp nhận',
                'Trạng thái',
                'Mức ưu tiên',
                'Ngày nhận yêu cầu',
                'Hạn xử lý',
                'Ghi chú',
            ]);

            $page = 1;
            $perPage = 100;
            while (true) {
                $pageRequest = Request::create('/api/v5/support-requests', 'GET', array_merge(
                    $request->query(),
                    [
                        'page' => $page,
                        'per_page' => $perPage,
                        'simple' => 1,
                    ]
                ));
                $pageRequest->setUserResolver($request->getUserResolver());

                /** @var JsonResponse $response */
                $response = $this->supportRequests($pageRequest);
                $payload = $response->getData(true);
                $rows = is_array($payload['data'] ?? null) ? $payload['data'] : [];
                if ($rows === []) {
                    break;
                }

                foreach ($rows as $row) {
                    if (! is_array($row)) {
                        continue;
                    }

                    $requestCode = trim((string) ($row['request_code'] ?? $row['ticket_code'] ?? ''));
                    $referenceRequestCode = trim((string) ($row['reference_request_code'] ?? $row['reference_ticket_code'] ?? ''));
                    $requestCodeSummary = sprintf(
                        'YC: %s | YCTC: %s',
                        $requestCode !== '' ? $requestCode : '--',
                        $referenceRequestCode !== '' ? $referenceRequestCode : '--'
                    );

                    fputcsv($output, [
                        (string) ($row['summary'] ?? ''),
                        $requestCodeSummary,
                        (string) ($row['customer_name'] ?? ''),
                        (string) ($row['service_group_name'] ?? ''),
                        (string) ($row['assignee_name'] ?? ''),
                        (string) ($row['receiver_name'] ?? ''),
                        (string) ($row['status'] ?? ''),
                        (string) ($row['priority'] ?? ''),
                        (string) ($row['requested_date'] ?? ''),
                        (string) ($row['due_date'] ?? ''),
                        (string) ($row['notes'] ?? ''),
                    ]);
                }

                if (count($rows) < $perPage) {
                    break;
                }
                $page++;
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }

    public function supportRequests(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $search = trim((string) ($this->readFilterParam($request, 'q', $request->query('search', '')) ?? ''));

        $status = strtoupper(trim((string) ($this->readFilterParam($request, 'status', '') ?? '')));

        $priority = strtoupper(trim((string) ($this->readFilterParam($request, 'priority', '') ?? '')));

        $serviceGroupId = $this->parseNullableInt(
            $this->readFilterParam($request, 'service_group_id', $this->readFilterParam($request, 'group'))
        );

        $customerId = $this->parseNullableInt(
            $this->readFilterParam($request, 'customer_id', $this->readFilterParam($request, 'customer'))
        );

        $assigneeId = $this->parseNullableInt(
            $this->readFilterParam($request, 'assignee_id', $this->readFilterParam($request, 'assignee'))
        );

        $receiverUserId = $this->parseNullableInt($this->readFilterParam($request, 'receiver_user_id'));

        $requestedFrom = $this->normalizeDateFilter(
            $this->readFilterParam($request, 'requested_from', $this->readFilterParam($request, 'from', ''))
        );

        $requestedTo = $this->normalizeDateFilter(
            $this->readFilterParam($request, 'requested_to', $this->readFilterParam($request, 'to', ''))
        );

        $includeDeleted = filter_var($this->readFilterParam($request, 'include_deleted', false), FILTER_VALIDATE_BOOLEAN);

        $sortableColumns = [
            'id' => 'sr.id',
            'summary' => 'sr.summary',
            'status' => 'sr.status',
            'priority' => 'sr.priority',
            'requested_date' => 'sr.requested_date',
            'due_date' => 'sr.due_date',
            'resolved_date' => 'sr.resolved_date',
            'created_at' => 'sr.created_at',
        ];
        if ($this->hasColumn('support_requests', 'request_code')) {
            $sortableColumns['request_code'] = 'sr.request_code';
        }
        if ($this->hasColumn('support_requests', 'reference_ticket_code')) {
            $sortableColumns['reference_ticket_code'] = 'sr.reference_ticket_code';
        }
        if ($this->hasColumn('support_requests', 'reference_request_id') && $this->hasColumn('support_requests', 'request_code')) {
            $sortableColumns['reference_request_code'] = 'sr_ref.request_code';
        }

        $sortBy = $this->resolveSortColumn($request, $sortableColumns, 'sr.requested_date');
        $sortDir = $this->resolveSortDirection($request);
        $sortParam = trim((string) $request->query('sort', ''));
        if ($sortParam !== '') {
            [$sortKeyFromParam, $sortDirFromParam] = array_pad(
                preg_split('/\s*[:|,]\s*/', $sortParam, 2) ?: [],
                2,
                ''
            );
            $sortKeyFromParam = trim((string) $sortKeyFromParam);
            $sortDirFromParam = strtolower(trim((string) $sortDirFromParam));

            if ($sortKeyFromParam !== '' && array_key_exists($sortKeyFromParam, $sortableColumns)) {
                $sortBy = $sortableColumns[$sortKeyFromParam];
            }
            if ($sortDirFromParam === 'asc' || $sortDirFromParam === 'desc') {
                $sortDir = $sortDirFromParam;
            }
        }

        $applyCommonFilters = function ($query) use (
            $status,
            $priority,
            $serviceGroupId,
            $customerId,
            $assigneeId,
            $receiverUserId,
            $requestedFrom,
            $requestedTo,
            $includeDeleted
        ): void {
            if ($status !== '') {
                $rawStatus = strtoupper(trim($status));
                if (in_array($rawStatus, $this->supportRequestStatusValidationValues(), true)) {
                    $normalizedStatus = $this->normalizeSupportRequestStatus($rawStatus);
                    $query->where('sr.status', $normalizedStatus);
                }
            }

            if ($priority !== '' && in_array($priority, self::SUPPORT_REQUEST_PRIORITIES, true)) {
                $query->where('sr.priority', $priority);
            }

            if ($serviceGroupId !== null && $this->hasColumn('support_requests', 'service_group_id')) {
                $query->where('sr.service_group_id', $serviceGroupId);
            }

            if ($customerId !== null && $this->hasColumn('support_requests', 'customer_id')) {
                $query->where('sr.customer_id', $customerId);
            }

            if ($assigneeId !== null && $this->hasColumn('support_requests', 'assignee_id')) {
                $query->where('sr.assignee_id', $assigneeId);
            }

            if ($receiverUserId !== null && $this->hasColumn('support_requests', 'receiver_user_id')) {
                $query->where('sr.receiver_user_id', $receiverUserId);
            }

            if ($requestedFrom !== null && $this->hasColumn('support_requests', 'requested_date')) {
                $query->where('sr.requested_date', '>=', $requestedFrom);
            }

            if ($requestedTo !== null && $this->hasColumn('support_requests', 'requested_date')) {
                $query->where('sr.requested_date', '<=', $requestedTo);
            }

            if (! $includeDeleted && $this->hasColumn('support_requests', 'deleted_at')) {
                $query->whereNull('sr.deleted_at');
            }
        };

        $applySorting = function ($query) use ($sortBy, $sortDir): void {
            $query->orderBy($sortBy, $sortDir);
            if ($sortBy !== 'sr.id' && $this->hasColumn('support_requests', 'id')) {
                $query->orderBy('sr.id', 'desc');
            }
        };

        $applySearchFilter = function ($query) use ($search): void {
            if ($search === '') {
                return;
            }

            $like = '%'.$search.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->whereRaw('1 = 0');

                if ($this->hasColumn('support_requests', 'summary')) {
                    $builder->orWhere('sr.summary', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'request_code')) {
                    $builder->orWhere('sr.request_code', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'reference_ticket_code')) {
                    $builder->orWhere('sr.reference_ticket_code', 'like', $like);
                }
                if (
                    $this->hasColumn('support_requests', 'reference_request_id')
                    && $this->hasColumn('support_requests', 'request_code')
                ) {
                    $builder->orWhere('sr_ref.request_code', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'reporter_name')) {
                    $builder->orWhere('sr.reporter_name', 'like', $like);
                }
                if ($this->hasColumn('support_requests', 'reference_request_id') && $this->hasColumn('support_requests', 'summary')) {
                    $builder->orWhere('sr_ref.summary', 'like', $like);
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
                if ($this->hasTable('internal_users') && $this->hasColumn('internal_users', 'full_name') && $this->hasColumn('support_requests', 'receiver_user_id')) {
                    $builder->orWhere('iu_receiver.full_name', 'like', $like);
                }
                if ($this->hasTable('customer_personnel') && $this->hasColumn('customer_personnel', 'full_name') && $this->hasColumn('support_requests', 'reporter_contact_id')) {
                    $builder->orWhere('cp.full_name', 'like', $like);
                }
                if ($this->hasTable('support_request_tasks') && $this->hasColumn('support_request_tasks', 'request_id')) {
                    $builder->orWhereExists(function ($taskQuery) use ($like): void {
                        $taskQuery
                            ->selectRaw('1')
                            ->from('support_request_tasks as srt')
                            ->whereColumn('srt.request_id', 'sr.id');

                        if ($this->hasColumn('support_request_tasks', 'task_code')) {
                            $taskQuery->where(function ($taskBuilder) use ($like): void {
                                $taskBuilder->whereRaw('1 = 0');
                                $taskBuilder->orWhere('srt.task_code', 'like', $like);
                                if ($this->hasColumn('support_request_tasks', 'task_link')) {
                                    $taskBuilder->orWhere('srt.task_link', 'like', $like);
                                }
                            });
                        } elseif ($this->hasColumn('support_request_tasks', 'task_link')) {
                            $taskQuery->where('srt.task_link', 'like', $like);
                        }
                    });
                }
                if (
                    $this->hasTable('support_request_tasks')
                    && $this->hasColumn('support_request_tasks', 'request_id')
                    && $this->hasColumn('support_requests', 'reference_request_id')
                    && $this->hasColumn('support_request_tasks', 'task_code')
                ) {
                    $builder->orWhereExists(function ($taskQuery) use ($like): void {
                        $taskQuery
                            ->selectRaw('1')
                            ->from('support_request_tasks as srt_ref')
                            ->whereColumn('srt_ref.request_id', 'sr.reference_request_id');

                        if ($this->hasColumn('support_request_tasks', 'deleted_at')) {
                            $taskQuery->whereNull('srt_ref.deleted_at');
                        }

                        $taskQuery->where('srt_ref.task_code', 'like', $like);
                    });
                }
            });
        };

        $kpiSnapshot = null;
        $resolveKpis = function () use (
            &$kpiSnapshot,
            $request,
            $search,
            $status,
            $priority,
            $serviceGroupId,
            $customerId,
            $assigneeId,
            $receiverUserId,
            $requestedFrom,
            $requestedTo,
            $includeDeleted,
            $applyCommonFilters,
            $applySearchFilter
        ): array {
            if (is_array($kpiSnapshot)) {
                return $kpiSnapshot;
            }

            $authenticatedUser = $request->user();
            $cacheKey = 'v5:support-requests:kpi:'.md5((string) json_encode([
                'user_id' => $authenticatedUser instanceof InternalUser ? (int) $authenticatedUser->id : 0,
                'search' => $search,
                'status' => $status,
                'priority' => $priority,
                'service_group_id' => $serviceGroupId,
                'customer_id' => $customerId,
                'assignee_id' => $assigneeId,
                'receiver_user_id' => $receiverUserId,
                'requested_from' => $requestedFrom,
                'requested_to' => $requestedTo,
                'include_deleted' => $includeDeleted ? 1 : 0,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            $cachedKpis = Cache::get($cacheKey);
            if (is_array($cachedKpis)) {
                $kpiSnapshot = $cachedKpis;
                return $kpiSnapshot;
            }

            $kpiQuery = $search === ''
                ? DB::table('support_requests as sr')
                : $this->supportRequestsBaseQuery();

            $this->applySupportRequestReadScope($request, $kpiQuery);
            $applyCommonFilters($kpiQuery);
            $applySearchFilter($kpiQuery);
            $kpiQuery->selectRaw('COUNT(*) as total_requests');

            if ($this->hasColumn('support_requests', 'status')) {
                $kpiQuery->selectRaw("SUM(CASE WHEN sr.status = 'NEW' THEN 1 ELSE 0 END) as new_count");
                $kpiQuery->selectRaw("SUM(CASE WHEN sr.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count");
                $kpiQuery->selectRaw("SUM(CASE WHEN sr.status = 'WAITING_CUSTOMER' THEN 1 ELSE 0 END) as waiting_customer_count");
            }

            if ($this->hasColumn('support_requests', 'due_date')) {
                $today = now()->toDateString();
                if ($this->hasColumn('support_requests', 'status')) {
                    $terminalStatuses = $this->supportRequestTerminalStatuses();
                    if ($terminalStatuses !== []) {
                        $placeholders = implode(',', array_fill(0, count($terminalStatuses), '?'));
                        $kpiQuery->selectRaw(
                            "SUM(CASE WHEN sr.due_date IS NOT NULL AND DATEDIFF(sr.due_date, ?) BETWEEN 0 AND 1 AND sr.status NOT IN ({$placeholders}) THEN 1 ELSE 0 END) as approaching_due_count",
                            array_merge([$today], $terminalStatuses)
                        );
                        $kpiQuery->selectRaw(
                            "SUM(CASE WHEN sr.due_date IS NOT NULL AND sr.due_date < ? AND sr.status NOT IN ({$placeholders}) THEN 1 ELSE 0 END) as overdue_count",
                            array_merge([$today], $terminalStatuses)
                        );
                    } else {
                        $kpiQuery->selectRaw(
                            "SUM(CASE WHEN sr.due_date IS NOT NULL AND DATEDIFF(sr.due_date, ?) BETWEEN 0 AND 1 THEN 1 ELSE 0 END) as approaching_due_count",
                            [$today]
                        );
                        $kpiQuery->selectRaw(
                            "SUM(CASE WHEN sr.due_date IS NOT NULL AND sr.due_date < ? THEN 1 ELSE 0 END) as overdue_count",
                            [$today]
                        );
                    }
                } else {
                    $kpiQuery->selectRaw(
                        "SUM(CASE WHEN sr.due_date IS NOT NULL AND DATEDIFF(sr.due_date, ?) BETWEEN 0 AND 1 THEN 1 ELSE 0 END) as approaching_due_count",
                        [$today]
                    );
                    $kpiQuery->selectRaw(
                        "SUM(CASE WHEN sr.due_date IS NOT NULL AND sr.due_date < ? THEN 1 ELSE 0 END) as overdue_count",
                        [$today]
                    );
                }
            }

            $aggregate = $kpiQuery->first();

            $kpiSnapshot = [
                'total_requests' => (int) (is_object($aggregate) ? ($aggregate->total_requests ?? 0) : 0),
                'new_count' => (int) (is_object($aggregate) && $this->hasColumn('support_requests', 'status') ? ($aggregate->new_count ?? 0) : 0),
                'in_progress_count' => (int) (is_object($aggregate) && $this->hasColumn('support_requests', 'status') ? ($aggregate->in_progress_count ?? 0) : 0),
                'waiting_customer_count' => (int) (is_object($aggregate) && $this->hasColumn('support_requests', 'status') ? ($aggregate->waiting_customer_count ?? 0) : 0),
                'approaching_due_count' => (int) (is_object($aggregate) && $this->hasColumn('support_requests', 'due_date') ? ($aggregate->approaching_due_count ?? 0) : 0),
                'overdue_count' => (int) (is_object($aggregate) && $this->hasColumn('support_requests', 'due_date') ? ($aggregate->overdue_count ?? 0) : 0),
            ];
            Cache::put($cacheKey, $kpiSnapshot, now()->addSeconds(12));

            return $kpiSnapshot;
        };

        // Support request list is always paginated to prevent accidental full-table fetches.
        [$page, $perPage] = $this->resolvePaginationParams($request, 10, 100);
        $useSimplePagination = $this->shouldUseSimplePagination($request);

        // Large-data optimization: page by ids first, then hydrate current page rows with joins.
        if ($search === '' && $this->hasColumn('support_requests', 'id')) {
            $idQuery = DB::table('support_requests as sr')
                ->select('sr.id');

            $this->applySupportRequestReadScope($request, $idQuery);
            $applyCommonFilters($idQuery);
            $applySorting($idQuery);

            $totalForMeta = null;
            if ($useSimplePagination) {
                $totalForMeta = (int) ($resolveKpis()['total_requests'] ?? 0);
                $paginator = $idQuery->simplePaginate($perPage, ['*'], 'page', $page);
            } else {
                $paginator = $idQuery->paginate($perPage, ['*'], 'page', $page);
            }

            $ids = collect($paginator->items())
                ->map(function ($item): int {
                    if (is_array($item)) {
                        return (int) ($item['id'] ?? 0);
                    }

                    if (is_object($item)) {
                        return (int) ($item->id ?? 0);
                    }

                    return 0;
                })
                ->filter(fn (int $id): bool => $id > 0)
                ->values();

            if ($ids->isEmpty()) {
                $meta = $useSimplePagination
                    ? $this->buildPaginationMeta($page, $perPage, (int) ($totalForMeta ?? 0))
                    : $this->buildPaginationMeta($page, $perPage, (int) $paginator->total());
                $meta['kpis'] = $resolveKpis();

                return response()->json([
                    'data' => [],
                    'meta' => $meta,
                ]);
            }

            $rows = $this->supportRequestsBaseQuery()
                ->select($this->supportRequestSelectColumns())
                ->whereIn('sr.id', $ids->all())
                ->orderByRaw('FIELD(sr.id, '.implode(',', $ids->all()).')')
                ->get()
                ->map(fn (object $item): array => $this->serializeSupportRequestRecord((array) $item))
                ->values()
                ->all();
            $rows = $this->attachSupportTasksToSerializedRequests($rows);

            $meta = $useSimplePagination
                ? $this->buildPaginationMeta($page, $perPage, (int) ($totalForMeta ?? count($rows)))
                : $this->buildPaginationMeta($page, $perPage, (int) $paginator->total());
            $meta['kpis'] = $resolveKpis();

            return response()->json([
                'data' => $rows,
                'meta' => $meta,
            ]);
        }

        $query = $this->supportRequestsBaseQuery()
            ->select($this->supportRequestSelectColumns());

        $this->applySupportRequestReadScope($request, $query);
        $applyCommonFilters($query);
        $applySearchFilter($query);
        $applySorting($query);

        if ($useSimplePagination) {
            $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeSupportRequestRecord((array) $item))
                ->values()
                ->all();
            $rows = $this->attachSupportTasksToSerializedRequests($rows);

            return response()->json([
                'data' => $rows,
                'meta' => array_merge(
                    $this->buildSimplePaginationMeta($page, $perPage, count($rows), $paginator->hasMorePages()),
                    ['kpis' => $resolveKpis()]
                ),
            ]);
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $rows = collect($paginator->items())
            ->map(fn (object $item): array => $this->serializeSupportRequestRecord((array) $item))
            ->values()
            ->all();
        $rows = $this->attachSupportTasksToSerializedRequests($rows);

        return response()->json([
            'data' => $rows,
            'meta' => array_merge(
                $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
                ['kpis' => $resolveKpis()]
            ),
        ]);
    }

    public function storeSupportRequest(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $this->normalizeOptionalDateInput($request, 'hotfix_date');
        $this->normalizeOptionalDateInput($request, 'noti_date');
        $this->normalizeSupportRequestTaskStatusesInRequest($request);

        $rules = [
            'reference_ticket_code' => ['nullable', 'string', 'max:100'],
            'reference_request_id' => ['nullable', 'integer'],
            'summary' => ['required', 'string'],
            'service_group_id' => ['nullable', 'integer'],
            'project_item_id' => ['nullable', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'reporter_name' => ['nullable', 'string', 'max:100'],
            'reporter_contact_id' => ['nullable', 'integer'],
            'assignee_id' => ['nullable', 'integer'],
            'receiver_user_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in($this->supportRequestStatusValidationValues(false))],
            'priority' => ['nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'resolved_date' => ['nullable', 'date'],
            'hotfix_date' => ['nullable', 'date'],
            'noti_date' => ['nullable', 'date'],
            'tasks' => ['sometimes', 'array', 'max:100'],
            'tasks.*.task_code' => ['nullable', 'string', 'max:100'],
            'tasks.*.task_link' => ['nullable', 'string'],
            'tasks.*.status' => ['nullable', Rule::in($this->supportRequestTaskStatusValidationValues())],
            'tasks.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'created_by' => ['nullable', 'integer'],
        ];

        $validated = $request->validate($rules);

        $taskPayloads = $this->normalizeSupportRequestTaskInputs($validated['tasks'] ?? null);

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
        $serviceGroupError = $this->validateSupportServiceGroupForCustomer($customerId, $serviceGroupId);
        if ($serviceGroupError instanceof JsonResponse) {
            return $serviceGroupError;
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

        $reporterContactId = $this->parseNullableInt($validated['reporter_contact_id'] ?? null);
        if ($reporterContactId !== null) {
            $reporterContactError = $this->validateReporterContactForCustomer($customerId, $reporterContactId);
            if ($reporterContactError instanceof JsonResponse) {
                return $reporterContactError;
            }
        }

        $receiverUserIdInput = $this->parseNullableInt($validated['receiver_user_id'] ?? null);
        $receiverResolution = $this->resolveSupportReceiverUserSelection($projectId, $receiverUserIdInput);
        if (is_string($receiverResolution['error'] ?? null) && ($receiverResolution['error'] ?? '') !== '') {
            return response()->json(['message' => $receiverResolution['error']], 422);
        }
        $receiverUserId = $this->parseNullableInt($receiverResolution['receiver_user_id'] ?? null);

        $reporterName = $this->normalizeNullableString($validated['reporter_name'] ?? null);
        if ($reporterContactId !== null) {
            $reporterName = $this->resolveReporterNameFromContactId($reporterContactId, $reporterName);
        }

        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->resolveAuthenticatedUserId($request);
        }
        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        $scopeError = $this->authorizeMutationByScope(
            $request,
            'yêu cầu hỗ trợ',
            $this->resolveProjectDepartmentIdById($projectId),
            $createdById
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $status = $this->normalizeSupportRequestStatus((string) ($validated['status'] ?? 'NEW'));
        $priority = $this->normalizeSupportRequestPriority((string) ($validated['priority'] ?? 'MEDIUM'));
        $this->resolveWorkflowByStatus($status, null, $priority);
        $requestedDueValidationError = $this->validateSupportRequestRequestedAndDueDates(
            $validated['requested_date'] ?? null,
            $validated['due_date'] ?? null
        );
        if ($requestedDueValidationError instanceof JsonResponse) {
            return $requestedDueValidationError;
        }

        $referenceResolution = $this->resolveSupportRequestReference(
            $this->parseNullableInt($validated['reference_request_id'] ?? null),
            $this->normalizeNullableString($validated['reference_ticket_code'] ?? null),
            null
        );
        if ($referenceResolution instanceof JsonResponse) {
            return $referenceResolution;
        }

        $dateValidationError = $this->validateSupportRequestCompletionDates(
            $status,
            $validated['due_date'] ?? null,
            $validated['resolved_date'] ?? null
        );
        if ($dateValidationError instanceof JsonResponse) {
            return $dateValidationError;
        }

        $payload = [
            'summary' => (string) $validated['summary'],
            'service_group_id' => $serviceGroupId,
            'project_item_id' => $projectItemContext['project_item_id'] ?? $projectItemId,
            'customer_id' => $customerId,
            'project_id' => $projectId,
            'product_id' => $productId,
            'reporter_name' => $reporterName,
            'reporter_contact_id' => $reporterContactId,
            'assignee_id' => $assigneeId,
            'receiver_user_id' => $receiverUserId,
            'status' => $status,
            'priority' => $priority,
            'requested_date' => $validated['requested_date'],
            'due_date' => $validated['due_date'] ?? null,
            'resolved_date' => $validated['resolved_date'] ?? null,
            'hotfix_date' => $validated['hotfix_date'] ?? null,
            'noti_date' => $validated['noti_date'] ?? null,
            'notes' => $this->normalizeNullableString($validated['notes'] ?? null),
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];
        if ($this->hasColumn('support_requests', 'reference_ticket_code')) {
            $payload['reference_ticket_code'] = $referenceResolution['reference_ticket_code'] ?? null;
        }
        if ($this->hasColumn('support_requests', 'reference_request_id')) {
            $payload['reference_request_id'] = $referenceResolution['reference_request_id'] ?? null;
        }

        $insertId = null;
        DB::transaction(function () use ($payload, &$insertId, $status, $createdById, $taskPayloads): void {
            $insertPayload = $this->filterPayloadByTableColumns('support_requests', $payload);
            if ($this->hasColumn('support_requests', 'created_at')) {
                $insertPayload['created_at'] = now();
            }
            if ($this->hasColumn('support_requests', 'updated_at')) {
                $insertPayload['updated_at'] = now();
            }

            $insertId = (int) DB::table('support_requests')->insertGetId($insertPayload);

            if ($this->hasColumn('support_requests', 'request_code')) {
                $this->assignGeneratedSupportRequestCode($insertId);
            }

            $actorId = $this->resolveSupportHistoryActorId($createdById);
            $this->insertSupportRequestHistoryRecord(
                $insertId,
                null,
                $status,
                'Tạo yêu cầu hỗ trợ',
                $actorId
            );

            $this->replaceSupportRequestTasks(
                $insertId,
                $taskPayloads,
                $createdById
            );
        });

        $record = $insertId !== null ? $this->loadSupportRequestById($insertId) : null;
        if ($record === null) {
            return response()->json(['message' => 'Support request created but cannot be reloaded.'], 500);
        }

        $this->recordAuditEvent(
            $request,
            'INSERT',
            'support_requests',
            $insertId,
            null,
            $this->toAuditArray($record)
        );

        return response()->json(['data' => $record], 201);
    }

    public function storeSupportRequestsBulk(Request $request): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/support-requests', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeSupportRequest($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo yêu cầu hỗ trợ.'),
                    ];
                    continue;
                }

                $payload = $response->getData(true);
                $record = is_array($payload['data'] ?? null) ? $payload['data'] : null;
                if ($record === null) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => 'Không thể đọc phản hồi khi tạo yêu cầu hỗ trợ.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                ];
                $created[] = $record;
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
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Không thể tạo yêu cầu hỗ trợ.',
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
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
    }

    public function updateSupportRequest(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $this->normalizeOptionalDateInput($request, 'hotfix_date');
        $this->normalizeOptionalDateInput($request, 'noti_date');
        $this->normalizeSupportRequestTaskStatusesInRequest($request);

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        if ($this->hasColumn('support_requests', 'deleted_at') && ! empty($current->deleted_at)) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $beforeRecord = $this->toAuditArray($current);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'yêu cầu hỗ trợ',
            $this->resolveDepartmentIdForTableRecord('support_requests', $beforeRecord),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'assignee_id', 'receiver_user_id', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $rules = [
            'reference_ticket_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'reference_request_id' => ['sometimes', 'nullable', 'integer'],
            'summary' => ['sometimes', 'required', 'string'],
            'service_group_id' => ['sometimes', 'nullable', 'integer'],
            'project_item_id' => ['sometimes', 'nullable', 'integer'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'product_id' => ['sometimes', 'nullable', 'integer'],
            'reporter_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'reporter_contact_id' => ['sometimes', 'nullable', 'integer'],
            'assignee_id' => ['sometimes', 'nullable', 'integer'],
            'receiver_user_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::in($this->supportRequestStatusValidationValues(false))],
            'priority' => ['sometimes', 'nullable', Rule::in(self::SUPPORT_REQUEST_PRIORITIES)],
            'requested_date' => ['sometimes', 'required', 'date'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'resolved_date' => ['sometimes', 'nullable', 'date'],
            'hotfix_date' => ['sometimes', 'nullable', 'date'],
            'noti_date' => ['sometimes', 'nullable', 'date'],
            'tasks' => ['sometimes', 'array', 'max:100'],
            'tasks.*.task_code' => ['nullable', 'string', 'max:100'],
            'tasks.*.task_link' => ['nullable', 'string'],
            'tasks.*.status' => ['nullable', Rule::in($this->supportRequestTaskStatusValidationValues())],
            'tasks.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
            'status_comment' => ['sometimes', 'nullable', 'string'],
        ];

        $validated = $request->validate($rules);
        $taskPayloads = null;
        if (array_key_exists('tasks', $validated)) {
            $taskPayloads = $this->normalizeSupportRequestTaskInputs($validated['tasks']);
        }
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

        if (array_key_exists('service_group_id', $updates)) {
            $effectiveCustomerId = array_key_exists('customer_id', $updates)
                ? $this->parseNullableInt($updates['customer_id'])
                : $this->parseNullableInt($current->customer_id ?? null);
            $serviceGroupError = $this->validateSupportServiceGroupForCustomer(
                $effectiveCustomerId,
                $this->parseNullableInt($updates['service_group_id'] ?? null),
                $this->parseNullableInt($current->service_group_id ?? null)
            );
            if ($serviceGroupError instanceof JsonResponse) {
                return $serviceGroupError;
            }
        }

        if (array_key_exists('assignee_id', $validated)) {
            $assigneeId = $this->parseNullableInt($validated['assignee_id']);
            if ($assigneeId !== null && ! $this->tableRowExists('internal_users', $assigneeId)) {
                return response()->json(['message' => 'assignee_id is invalid.'], 422);
            }
            $updates['assignee_id'] = $assigneeId;
        }

        if (array_key_exists('reporter_contact_id', $validated)) {
            $reporterContactId = $this->parseNullableInt($validated['reporter_contact_id']);
            $effectiveCustomerId = array_key_exists('customer_id', $updates)
                ? $this->parseNullableInt($updates['customer_id'])
                : $this->parseNullableInt($current->customer_id ?? null);

            if ($reporterContactId !== null) {
                $reporterContactError = $this->validateReporterContactForCustomer($effectiveCustomerId, $reporterContactId);
                if ($reporterContactError instanceof JsonResponse) {
                    return $reporterContactError;
                }
            }

            $updates['reporter_contact_id'] = $reporterContactId;
            if (! array_key_exists('reporter_name', $validated) && $reporterContactId !== null) {
                $updates['reporter_name'] = $this->resolveReporterNameFromContactId(
                    $reporterContactId,
                    $this->normalizeNullableString($current->reporter_name ?? null)
                );
            }
        }

        if (array_key_exists('receiver_user_id', $validated)) {
            $receiverUserIdInput = $this->parseNullableInt($validated['receiver_user_id']);
            $effectiveProjectIdForReceiver = array_key_exists('project_id', $updates)
                ? $this->parseNullableInt($updates['project_id'])
                : $this->parseNullableInt($current->project_id ?? null);

            $receiverResolution = $this->resolveSupportReceiverUserSelection($effectiveProjectIdForReceiver, $receiverUserIdInput);
            if (is_string($receiverResolution['error'] ?? null) && ($receiverResolution['error'] ?? '') !== '') {
                return response()->json(['message' => $receiverResolution['error']], 422);
            }

            $updates['receiver_user_id'] = $this->parseNullableInt($receiverResolution['receiver_user_id'] ?? null);
        }

        $updatedById = null;
        if (array_key_exists('updated_by', $validated)) {
            $updatedById = $this->parseNullableInt($validated['updated_by']);
            if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
                return response()->json(['message' => 'updated_by is invalid.'], 422);
            }
            $updates['updated_by'] = $updatedById;
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
        if (array_key_exists('notes', $validated)) {
            $updates['notes'] = $this->normalizeNullableString($validated['notes']);
        }

        $oldStatus = $this->normalizeSupportRequestStatus((string) ($current->status ?? 'NEW'));
        $newStatus = $oldStatus;
        if (array_key_exists('status', $validated)) {
            $newStatus = $this->normalizeSupportRequestStatus((string) ($validated['status'] ?? 'NEW'));
            $updates['status'] = $newStatus;
        }
        $effectivePriority = array_key_exists('priority', $updates)
            ? $this->normalizeSupportRequestPriority((string) ($updates['priority'] ?? 'MEDIUM'))
            : $this->normalizeSupportRequestPriority((string) ($current->priority ?? 'MEDIUM'));
        $this->resolveWorkflowByStatus($newStatus, null, $effectivePriority);
        $statusChanged = $newStatus !== $oldStatus;
        $effectiveRequestedDate = array_key_exists('requested_date', $updates) ? $updates['requested_date'] : ($current->requested_date ?? null);
        $effectiveDueDate = array_key_exists('due_date', $updates) ? $updates['due_date'] : ($current->due_date ?? null);
        $effectiveResolvedDate = array_key_exists('resolved_date', $updates) ? $updates['resolved_date'] : ($current->resolved_date ?? null);
        $requestedDueValidationError = $this->validateSupportRequestRequestedAndDueDates(
            $effectiveRequestedDate,
            $effectiveDueDate
        );
        if ($requestedDueValidationError instanceof JsonResponse) {
            return $requestedDueValidationError;
        }

        if (array_key_exists('reference_ticket_code', $validated) || array_key_exists('reference_request_id', $validated)) {
            $referenceIdInput = array_key_exists('reference_request_id', $validated)
                ? $this->parseNullableInt($validated['reference_request_id'])
                : null;
            $referenceCodeInput = array_key_exists('reference_ticket_code', $validated)
                ? $this->normalizeNullableString($validated['reference_ticket_code'])
                : null;

            $referenceResolution = $this->resolveSupportRequestReference(
                $referenceIdInput,
                $referenceCodeInput,
                $id
            );
            if ($referenceResolution instanceof JsonResponse) {
                return $referenceResolution;
            }

            if ($this->hasColumn('support_requests', 'reference_request_id')) {
                $updates['reference_request_id'] = $referenceResolution['reference_request_id'] ?? null;
            }
            if ($this->hasColumn('support_requests', 'reference_ticket_code')) {
                $updates['reference_ticket_code'] = $referenceResolution['reference_ticket_code'] ?? null;
            }
        }

        $dateValidationError = $this->validateSupportRequestCompletionDates(
            $newStatus,
            $effectiveDueDate,
            $effectiveResolvedDate
        );
        if ($dateValidationError instanceof JsonResponse) {
            return $dateValidationError;
        }

        $effectiveProjectId = array_key_exists('project_id', $updates)
            ? $this->parseNullableInt($updates['project_id'])
            : $this->parseNullableInt($current->project_id ?? null);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'yêu cầu hỗ trợ',
            $this->resolveProjectDepartmentIdById($effectiveProjectId),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'assignee_id', 'receiver_user_id', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $updates = $this->filterPayloadByTableColumns('support_requests', $updates);
        if ($updates === [] && $taskPayloads === null) {
            $record = $this->loadSupportRequestById($id);
            if ($record === null) {
                return response()->json(['message' => 'Support request not found.'], 404);
            }

            return response()->json(['data' => $record]);
        }

        if ($this->hasColumn('support_requests', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::transaction(function () use (
            $id,
            $updates,
            $statusChanged,
            $oldStatus,
            $newStatus,
            $validated,
            $updatedById,
            $taskPayloads
        ): void {
            if ($updates !== []) {
                DB::table('support_requests')->where('id', $id)->update($updates);
            }

            if ($statusChanged) {
                $actorId = $this->resolveSupportHistoryActorId($updatedById);
                $this->insertSupportRequestHistoryRecord(
                    $id,
                    $oldStatus,
                    $newStatus,
                    $this->normalizeNullableString($validated['status_comment'] ?? null),
                    $actorId
                );
            }

            if (is_array($taskPayloads)) {
                $this->replaceSupportRequestTasks(
                    $id,
                    $taskPayloads,
                    $updatedById
                );
            }
        });

        $record = $this->loadSupportRequestById($id);
        if ($record === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'support_requests',
            $id,
            $beforeRecord,
            $this->toAuditArray($record)
        );

        return response()->json(['data' => $record]);
    }

    public function deleteSupportRequest(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('support_requests')) {
            return $this->missingTable('support_requests');
        }

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $beforeRecord = $this->toAuditArray($current);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'yêu cầu hỗ trợ',
            $this->resolveDepartmentIdForTableRecord('support_requests', $beforeRecord),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'assignee_id', 'receiver_user_id', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($this->hasColumn('support_requests', 'deleted_at')) {
            if (empty($current->deleted_at)) {
                $updates = ['deleted_at' => now()];
                if ($this->hasColumn('support_requests', 'updated_at')) {
                    $updates['updated_at'] = now();
                }
                DB::table('support_requests')->where('id', $id)->update($updates);
            }

            $this->recordAuditEvent(
                $request,
                'DELETE',
                'support_requests',
                $id,
                $beforeRecord,
                null
            );

            return response()->json(['message' => 'Support request deleted.']);
        }

        try {
            DB::transaction(function () use ($id): void {
                DB::table('support_requests')->where('id', $id)->delete();
            });

            $this->recordAuditEvent(
                $request,
                'DELETE',
                'support_requests',
                $id,
                $beforeRecord,
                null
            );

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

        $this->normalizeOptionalDateInput($request, 'hotfix_date');
        $this->normalizeOptionalDateInput($request, 'noti_date');

        $current = DB::table('support_requests')->where('id', $id)->first();
        if ($current === null) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        if ($this->hasColumn('support_requests', 'deleted_at') && ! empty($current->deleted_at)) {
            return response()->json(['message' => 'Support request not found.'], 404);
        }

        $beforeRecord = $this->toAuditArray($current);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'yêu cầu hỗ trợ',
            $this->resolveDepartmentIdForTableRecord('support_requests', $beforeRecord),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'assignee_id', 'receiver_user_id', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $validated = $request->validate([
            'new_status' => ['required', Rule::in($this->supportRequestStatusValidationValues(false))],
            'comment' => ['sometimes', 'nullable', 'string'],
            'updated_by' => ['sometimes', 'nullable', 'integer'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'resolved_date' => ['sometimes', 'nullable', 'date'],
            'hotfix_date' => ['sometimes', 'nullable', 'date'],
            'noti_date' => ['sometimes', 'nullable', 'date'],
        ]);

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        $oldStatus = $this->normalizeSupportRequestStatus((string) ($current->status ?? 'NEW'));
        $newStatus = $this->normalizeSupportRequestStatus((string) $validated['new_status']);
        $this->resolveWorkflowByStatus(
            $newStatus,
            null,
            $this->normalizeSupportRequestPriority((string) ($current->priority ?? 'MEDIUM'))
        );

        $updates = ['status' => $newStatus];
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
        if ($updatedById !== null) {
            $updates['updated_by'] = $updatedById;
        }

        $effectiveRequestedDate = $current->requested_date ?? null;
        $effectiveDueDate = array_key_exists('due_date', $updates) ? $updates['due_date'] : ($current->due_date ?? null);
        $effectiveResolvedDate = array_key_exists('resolved_date', $updates) ? $updates['resolved_date'] : ($current->resolved_date ?? null);
        if (array_key_exists('due_date', $updates)) {
            $requestedDueValidationError = $this->validateSupportRequestRequestedAndDueDates(
                $effectiveRequestedDate,
                $effectiveDueDate
            );
            if ($requestedDueValidationError instanceof JsonResponse) {
                return $requestedDueValidationError;
            }
        }
        $dateValidationError = $this->validateSupportRequestCompletionDates(
            $newStatus,
            $effectiveDueDate,
            $effectiveResolvedDate
        );
        if ($dateValidationError instanceof JsonResponse) {
            return $dateValidationError;
        }

        $updates = $this->filterPayloadByTableColumns('support_requests', $updates);
        if ($this->hasColumn('support_requests', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        $statusChanged = $newStatus !== $oldStatus;
        DB::transaction(function () use ($id, $updates, $oldStatus, $newStatus, $validated, $updatedById, $statusChanged): void {
            DB::table('support_requests')->where('id', $id)->update($updates);

            if (! $statusChanged) {
                return;
            }

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

        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'support_requests',
            $id,
            $beforeRecord,
            $this->toAuditArray($record)
        );

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
        if ($supportsDeptPath) {
            // Ensure insert passes when dept_path is NOT NULL without default.
            $department->setAttribute('dept_path', '0/');
        }
        $department->save();

        if ($supportsDeptPath) {
            $department->dept_path = $this->buildDeptPath($department);
            $department->save();
        }

        return response()->json([
            'data' => $this->serializeDepartment(
                $department->loadMissing(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())])
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
                $department->loadMissing(['parent' => fn ($query) => $query->select($this->departmentRelationColumns())])
            ),
        ]);
    }

    public function deleteDepartment(Request $request, int $id): JsonResponse
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

        return $this->deleteModel($request, $department, 'Department');
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
            'phone_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
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
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
        }
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

        $temporaryPassword = null;
        if ($this->hasColumn($employeeTable, 'password')) {
            $temporaryPassword = $this->generateTemporaryPassword();
            $this->setAttributeIfColumn($employee, $employeeTable, 'password', Hash::make($temporaryPassword));
        }
        $this->setAttributeIfColumn($employee, $employeeTable, 'must_change_password', 1);
        $this->setAttributeIfColumn($employee, $employeeTable, 'password_reset_required_at', now());
        $this->setAttributeIfColumn($employee, $employeeTable, 'password_changed_at', null);

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

    public function storeEmployeesBulk(Request $request): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:200'],
            'items.*' => ['required', 'array'],
        ]);

        $results = [];
        $created = [];

        foreach ($validated['items'] as $index => $itemPayload) {
            try {
                $subRequest = Request::create('/api/v5/internal-users', 'POST', $itemPayload);
                $subRequest->setUserResolver(fn () => $request->user());
                $response = $this->storeEmployee($subRequest);

                if ($response->getStatusCode() >= 400) {
                    $results[] = [
                        'index' => (int) $index,
                        'success' => false,
                        'message' => $this->extractJsonResponseMessage($response, 'Không thể tạo nhân sự.'),
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
                        'message' => 'Không thể đọc phản hồi khi tạo nhân sự.',
                    ];
                    continue;
                }

                $results[] = [
                    'index' => (int) $index,
                    'success' => true,
                    'data' => $record,
                    'provisioning' => $provisioning,
                ];
                $created[] = $record;
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
                    'message' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'Không thể tạo nhân sự.',
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
                'created_count' => count($created),
                'failed_count' => $failedCount,
            ],
        ], $failedCount === 0 ? 201 : 200);
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
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
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
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $normalizedPhone = $this->normalizeNullableString($validated['phone_number'] ?? $validated['phone'] ?? null);
            $this->setAttributeByColumns($employee, $employeeTable, ['phone_number', 'phone', 'mobile'], $normalizedPhone);
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

    public function resetEmployeePassword(Request $request, int $id): JsonResponse
    {
        $employeeTable = $this->resolveEmployeeTable();
        if ($employeeTable === null) {
            return $this->missingTable('internal_users');
        }
        if (! $this->hasColumn($employeeTable, 'password')) {
            return response()->json(['message' => 'Employee password column is not available.'], 422);
        }

        $employeeModel = $this->resolveEmployeeModelClass();
        /** @var Model $employee */
        $employee = $employeeModel::query()->findOrFail($id);

        $temporaryPassword = $this->generateTemporaryPassword();
        $updates = [
            'password' => Hash::make($temporaryPassword),
        ];
        if ($this->hasColumn($employeeTable, 'must_change_password')) {
            $updates['must_change_password'] = 1;
        }
        if ($this->hasColumn($employeeTable, 'password_reset_required_at')) {
            $updates['password_reset_required_at'] = now();
        }
        if ($this->hasColumn($employeeTable, 'password_changed_at')) {
            $updates['password_changed_at'] = null;
        }

        $updatedById = $this->resolveAuthenticatedUserId($request);
        if ($updatedById !== null && $this->hasColumn($employeeTable, 'updated_by')) {
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
            throw new \RuntimeException('Không thể tải lại dữ liệu nhân sự sau khi reset mật khẩu.');
        }
        $freshEmployee->load([
            'department' => fn ($query) => $query->select($this->departmentRelationColumns()),
        ]);
        if ($this->hasTable('positions')) {
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

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->setAttributeIfColumn($customer, 'customers', 'created_by', $actorId);
            $this->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->recordAuditEvent(
            $request,
            'INSERT',
            'customers',
            $customer->getKey(),
            null,
            $this->toAuditArray($customer)
        );

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function updateCustomer(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);
        $scopeError = $this->assertModelMutationAccess($request, $customer, 'khách hàng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->toAuditArray($customer);

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

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->setAttributeIfColumn($customer, 'customers', 'updated_by', $actorId);
        }

        $customer->save();
        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'customers',
            $customer->getKey(),
            $before,
            $this->toAuditArray($customer->fresh() ?? $customer)
        );

        return response()->json(['data' => $this->serializeCustomer($customer)]);
    }

    public function deleteCustomer(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('customers')) {
            return $this->missingTable('customers');
        }

        $customer = Customer::query()->findOrFail($id);

        return $this->deleteModel($request, $customer, 'Customer');
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

    public function deleteVendor(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('vendors')) {
            return $this->missingTable('vendors');
        }

        $vendor = Vendor::query()->findOrFail($id);

        return $this->deleteModel($request, $vendor, 'Vendor');
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
            'status' => ['nullable', Rule::in(self::PROJECT_INPUT_STATUSES)],
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

        $startDateInput = $validated['start_date'] ?? now()->toDateString();
        $expectedEndDateInput = $validated['expected_end_date'] ?? null;
        if ($this->isProjectDateRangeInvalid($startDateInput, $expectedEndDateInput)) {
            return response()->json([
                'message' => 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
                'errors' => [
                    'start_date' => ['Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'],
                    'expected_end_date' => ['Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'],
                ],
            ], 422);
        }

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId !== null && ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json(['message' => 'customer_id is invalid.'], 422);
        }

        $opportunityId = $this->parseNullableInt($validated['opportunity_id'] ?? null);
        if ($opportunityId !== null && $this->hasTable('opportunities') && ! Opportunity::query()->whereKey($opportunityId)->exists()) {
            return response()->json(['message' => 'opportunity_id is invalid.'], 422);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'dự án',
            $this->resolveOpportunityDepartmentIdById($opportunityId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $project = new Project();
        $this->setAttributeIfColumn($project, 'projects', 'project_code', $validated['project_code']);
        $this->setAttributeIfColumn($project, 'projects', 'project_name', $validated['project_name']);
        $this->setAttributeIfColumn($project, 'projects', 'customer_id', $customerId);
        $this->setAttributeIfColumn($project, 'projects', 'status', $this->toProjectStorageStatus((string) ($validated['status'] ?? 'TRIAL')));
        $this->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
        $this->setAttributeIfColumn($project, 'projects', 'investment_mode', $validated['investment_mode'] ?? 'DAU_TU');

        if ($this->hasColumn('projects', 'start_date')) {
            $this->setAttributeIfColumn($project, 'projects', 'start_date', $startDateInput);
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

        if ($this->hasColumn('projects', 'dept_id')) {
            $this->setAttributeIfColumn(
                $project,
                'projects',
                'dept_id',
                $this->resolveOpportunityDepartmentIdById($opportunityId)
            );
        }

        if ($actorId !== null) {
            $this->setAttributeIfColumn($project, 'projects', 'created_by', $actorId);
            $this->setAttributeIfColumn($project, 'projects', 'updated_by', $actorId);
        }

        $project->save();
        $this->recordAuditEvent(
            $request,
            'INSERT',
            'projects',
            $project->getKey(),
            null,
            $this->toAuditArray($project)
        );

        return response()->json([
            'data' => $this->serializeProject(
                $project->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ], 201);
    }

    public function updateProject(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);
        $scopeError = $this->assertModelMutationAccess($request, $project, 'dự án');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->toAuditArray($project);

        $rules = [
            'project_code' => ['sometimes', 'required', 'string', 'max:100'],
            'project_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'status' => ['sometimes', 'nullable', Rule::in(self::PROJECT_INPUT_STATUSES)],
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

        $resolvedStartDate = array_key_exists('start_date', $validated)
            ? $validated['start_date']
            : ($project->getAttribute('start_date') ? (string) $project->getAttribute('start_date') : null);
        $resolvedExpectedEndDate = array_key_exists('expected_end_date', $validated)
            ? $validated['expected_end_date']
            : ($project->getAttribute('expected_end_date') ? (string) $project->getAttribute('expected_end_date') : null);
        if ($this->isProjectDateRangeInvalid($resolvedStartDate, $resolvedExpectedEndDate)) {
            return response()->json([
                'message' => 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
                'errors' => [
                    'start_date' => ['Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'],
                    'expected_end_date' => ['Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'],
                ],
            ], 422);
        }

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
            $scopeError = $this->authorizeMutationByScope(
                $request,
                'dự án',
                $this->resolveOpportunityDepartmentIdById($opportunityId),
                $this->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
            $this->setAttributeIfColumn($project, 'projects', 'opportunity_id', $opportunityId);
            if ($this->hasColumn('projects', 'dept_id')) {
                $this->setAttributeIfColumn(
                    $project,
                    'projects',
                    'dept_id',
                    $this->resolveOpportunityDepartmentIdById($opportunityId)
                );
            }
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

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->setAttributeIfColumn($project, 'projects', 'updated_by', $actorId);
        }

        $project->save();
        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'projects',
            $project->getKey(),
            $before,
            $this->toAuditArray($project->fresh() ?? $project)
        );

        return response()->json([
            'data' => $this->serializeProject(
                $project->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ]);
    }

    public function deleteProject(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('projects')) {
            return $this->missingTable('projects');
        }

        $project = Project::query()->findOrFail($id);

        return $this->deleteModel($request, $project, 'Project');
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
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'term_unit' => ['nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
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

        $resolvedSignDate = $validated['sign_date'] ?? null;
        $resolvedEffectiveDate = $validated['effective_date'] ?? null;
        $resolvedExpiryDate = $validated['expiry_date'] ?? null;
        $manualExpiryOverride = (bool) ($validated['expiry_date_manual_override'] ?? false);

        $termUnitInput = array_key_exists('term_unit', $validated)
            ? strtoupper(trim((string) ($validated['term_unit'] ?? '')))
            : '';
        $termUnit = in_array($termUnitInput, self::CONTRACT_TERM_UNITS, true) ? $termUnitInput : null;
        $termValue = array_key_exists('term_value', $validated)
            ? $this->parseNullableFloat($validated['term_value'])
            : null;

        if (($termUnit !== null && $termValue === null) || ($termUnit === null && $termValue !== null)) {
            return response()->json([
                'message' => 'term_unit và term_value phải đi cùng nhau.',
                'errors' => [
                    'term_value' => ['term_unit và term_value phải đi cùng nhau.'],
                ],
            ], 422);
        }

        if ($termUnit === 'DAY' && $termValue !== null && floor($termValue) !== $termValue) {
            return response()->json([
                'message' => 'Thời hạn theo ngày phải là số nguyên.',
                'errors' => [
                    'term_value' => ['Thời hạn theo ngày phải là số nguyên.'],
                ],
            ], 422);
        }

        if ($manualExpiryOverride && $resolvedExpiryDate === null) {
            return response()->json([
                'message' => 'Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.',
                'errors' => [
                    'expiry_date' => ['Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.'],
                ],
            ], 422);
        }

        if (! $manualExpiryOverride) {
            $resolvedExpiryDate = $this->resolveContractExpiryDateFromTerm(
                $termUnit,
                $termValue,
                $resolvedEffectiveDate,
                $resolvedSignDate
            ) ?? $resolvedExpiryDate;
        }

        if (
            $resolvedEffectiveDate !== null
            && strtotime((string) $resolvedEffectiveDate) !== false
            && strtotime((string) $resolvedSignDate) !== false
            && strtotime((string) $resolvedEffectiveDate) < strtotime((string) $resolvedSignDate)
        ) {
            return response()->json([
                'message' => 'Ngày hiệu lực HĐ phải lớn hơn hoặc bằng ngày ký HĐ.',
                'errors' => [
                    'effective_date' => ['Ngày hiệu lực HĐ phải lớn hơn hoặc bằng ngày ký HĐ.'],
                ],
            ], 422);
        }

        if (
            $resolvedExpiryDate !== null
            && strtotime((string) $resolvedExpiryDate) !== false
            && strtotime((string) ($resolvedEffectiveDate ?? $resolvedSignDate ?? Carbon::now()->subDay()->toDateString())) !== false
            && strtotime((string) $resolvedExpiryDate) < strtotime((string) ($resolvedEffectiveDate ?? $resolvedSignDate ?? Carbon::now()->subDay()->toDateString()))
        ) {
            return response()->json([
                'message' => 'Ngày hết hiệu lực HĐ phải lớn hơn hoặc bằng mốc tính hạn.',
                'errors' => [
                    'expiry_date' => ['Ngày hết hiệu lực HĐ phải lớn hơn hoặc bằng mốc tính hạn.'],
                ],
            ], 422);
        }

        if ($this->usesLegacyContractSchema() && $projectId === null) {
            return response()->json(['message' => 'project_id is required by this schema.'], 422);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'hợp đồng',
            $this->resolveProjectDepartmentIdById($projectId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
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
            $this->setAttributeIfColumn($contract, 'contracts', 'sign_date', $resolvedSignDate);
        }
        if ($this->hasColumn('contracts', 'effective_date')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'effective_date', $resolvedEffectiveDate ?? $resolvedSignDate);
        }
        if ($this->hasColumn('contracts', 'expiry_date')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $resolvedExpiryDate);
        }
        if ($this->hasColumn('contracts', 'term_unit')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'term_unit', $termUnit);
        }
        if ($this->hasColumn('contracts', 'term_value')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'term_value', $termValue);
        }
        if ($this->hasColumn('contracts', 'expiry_date_manual_override')) {
            $this->setAttributeIfColumn(
                $contract,
                'contracts',
                'expiry_date_manual_override',
                $manualExpiryOverride ? 1 : 0
            );
        }
        if ($this->hasColumn('contracts', 'data_scope')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope'] ?? null);
        }

        if ($this->hasColumn('contracts', 'dept_id')) {
            $this->setAttributeIfColumn(
                $contract,
                'contracts',
                'dept_id',
                $this->resolveProjectDepartmentIdById($projectId)
            );
        }

        if ($actorId !== null) {
            $this->setAttributeIfColumn($contract, 'contracts', 'created_by', $actorId);
            $this->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        $contract->save();
        $this->recordAuditEvent(
            $request,
            'INSERT',
            'contracts',
            $contract->getKey(),
            null,
            $this->toAuditArray($contract)
        );

        return response()->json([
            'data' => $this->serializeContract(
                $contract->loadMissing([
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
        $scopeError = $this->assertModelMutationAccess($request, $contract, 'hợp đồng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->toAuditArray($contract);

        $rules = [
            'contract_code' => ['sometimes', 'required', 'string', 'max:100'],
            'contract_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'project_id' => ['sometimes', 'nullable', 'integer'],
            'value' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'payment_cycle' => ['sometimes', 'nullable', Rule::in(self::PAYMENT_CYCLES)],
            'status' => ['sometimes', 'nullable', Rule::in(self::CONTRACT_STATUSES)],
            'sign_date' => ['sometimes', 'nullable', 'date'],
            'effective_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
            'term_unit' => ['sometimes', 'nullable', 'string', Rule::in(self::CONTRACT_TERM_UNITS)],
            'term_value' => ['sometimes', 'nullable', 'numeric', 'gt:0'],
            'expiry_date_manual_override' => ['sometimes', 'boolean'],
            'data_scope' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        if ($this->hasColumn('contracts', 'contract_code')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_code')->ignore($contract->id);
        }
        if ($this->hasColumn('contracts', 'contract_number')) {
            $rules['contract_code'][] = Rule::unique('contracts', 'contract_number')->ignore($contract->id);
        }

        $validated = $request->validate($rules);

        $contractData = $contract->toArray();

        $resolvedSignDate = array_key_exists('sign_date', $validated)
            ? $validated['sign_date']
            : ($contract->getAttribute('sign_date') ? (string) $contract->getAttribute('sign_date') : null);
        $resolvedEffectiveDate = array_key_exists('effective_date', $validated)
            ? $validated['effective_date']
            : ($contract->getAttribute('effective_date') ? (string) $contract->getAttribute('effective_date') : null);
        $resolvedExpiryDate = array_key_exists('expiry_date', $validated)
            ? $validated['expiry_date']
            : ($contract->getAttribute('expiry_date') ? (string) $contract->getAttribute('expiry_date') : null);
        $manualExpiryOverride = array_key_exists('expiry_date_manual_override', $validated)
            ? (bool) $validated['expiry_date_manual_override']
            : (bool) $this->firstNonEmpty($contractData, ['expiry_date_manual_override'], false);

        $currentTermUnitRaw = strtoupper(trim((string) $this->firstNonEmpty($contractData, ['term_unit'], '')));
        $currentTermUnit = in_array($currentTermUnitRaw, self::CONTRACT_TERM_UNITS, true) ? $currentTermUnitRaw : null;
        $currentTermValue = $this->parseNullableFloat($this->firstNonEmpty($contractData, ['term_value']));

        $termUnitInput = array_key_exists('term_unit', $validated)
            ? strtoupper(trim((string) ($validated['term_unit'] ?? '')))
            : null;
        $resolvedTermUnit = $termUnitInput !== null
            ? (in_array($termUnitInput, self::CONTRACT_TERM_UNITS, true) ? $termUnitInput : null)
            : $currentTermUnit;

        $resolvedTermValue = array_key_exists('term_value', $validated)
            ? $this->parseNullableFloat($validated['term_value'])
            : $currentTermValue;

        if (($resolvedTermUnit !== null && $resolvedTermValue === null) || ($resolvedTermUnit === null && $resolvedTermValue !== null)) {
            return response()->json([
                'message' => 'term_unit và term_value phải đi cùng nhau.',
                'errors' => [
                    'term_value' => ['term_unit và term_value phải đi cùng nhau.'],
                ],
            ], 422);
        }

        if ($resolvedTermUnit === 'DAY' && $resolvedTermValue !== null && floor($resolvedTermValue) !== $resolvedTermValue) {
            return response()->json([
                'message' => 'Thời hạn theo ngày phải là số nguyên.',
                'errors' => [
                    'term_value' => ['Thời hạn theo ngày phải là số nguyên.'],
                ],
            ], 422);
        }

        if ($manualExpiryOverride && $resolvedExpiryDate === null) {
            return response()->json([
                'message' => 'Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.',
                'errors' => [
                    'expiry_date' => ['Khi bật chỉnh tay ngày hết hiệu lực, bạn phải nhập expiry_date.'],
                ],
            ], 422);
        }

        if (! $manualExpiryOverride) {
            $resolvedExpiryDate = $this->resolveContractExpiryDateFromTerm(
                $resolvedTermUnit,
                $resolvedTermValue,
                $resolvedEffectiveDate,
                $resolvedSignDate
            ) ?? $resolvedExpiryDate;
        }

        if (
            $resolvedSignDate !== null
            && $resolvedEffectiveDate !== null
            && strtotime((string) $resolvedEffectiveDate) !== false
            && strtotime((string) $resolvedSignDate) !== false
            && strtotime((string) $resolvedEffectiveDate) < strtotime((string) $resolvedSignDate)
        ) {
            return response()->json([
                'message' => 'Ngày hiệu lực HĐ phải lớn hơn hoặc bằng ngày ký HĐ.',
                'errors' => [
                    'effective_date' => ['Ngày hiệu lực HĐ phải lớn hơn hoặc bằng ngày ký HĐ.'],
                ],
            ], 422);
        }

        if (
            $resolvedSignDate !== null
            && $resolvedExpiryDate !== null
            && strtotime((string) $resolvedExpiryDate) !== false
            && strtotime((string) ($resolvedEffectiveDate ?? $resolvedSignDate ?? Carbon::now()->subDay()->toDateString())) !== false
            && strtotime((string) $resolvedExpiryDate) < strtotime((string) ($resolvedEffectiveDate ?? $resolvedSignDate ?? Carbon::now()->subDay()->toDateString()))
        ) {
            return response()->json([
                'message' => 'Ngày hết hiệu lực HĐ phải lớn hơn hoặc bằng mốc tính hạn.',
                'errors' => [
                    'expiry_date' => ['Ngày hết hiệu lực HĐ phải lớn hơn hoặc bằng mốc tính hạn.'],
                ],
            ], 422);
        }

        if (array_key_exists('project_id', $validated)) {
            $projectId = $this->parseNullableInt($validated['project_id']);
            if ($projectId !== null && ! Project::query()->whereKey($projectId)->exists()) {
                return response()->json(['message' => 'project_id is invalid.'], 422);
            }
            if ($this->usesLegacyContractSchema() && $projectId === null) {
                return response()->json(['message' => 'project_id is required by this schema.'], 422);
            }
            $scopeError = $this->authorizeMutationByScope(
                $request,
                'hợp đồng',
                $this->resolveProjectDepartmentIdById($projectId),
                $this->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
            $this->setAttributeIfColumn($contract, 'contracts', 'project_id', $projectId);
            if ($this->hasColumn('contracts', 'dept_id')) {
                $this->setAttributeIfColumn(
                    $contract,
                    'contracts',
                    'dept_id',
                    $this->resolveProjectDepartmentIdById($projectId)
                );
            }
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
        if (array_key_exists('effective_date', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'effective_date', $validated['effective_date']);
        }
        if ($this->hasColumn('contracts', 'expiry_date')) {
            $this->setAttributeIfColumn($contract, 'contracts', 'expiry_date', $resolvedExpiryDate);
        }
        if (array_key_exists('term_unit', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'term_unit', $resolvedTermUnit);
        }
        if (array_key_exists('term_value', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'term_value', $resolvedTermValue);
        }
        if (array_key_exists('expiry_date_manual_override', $validated)) {
            $this->setAttributeIfColumn(
                $contract,
                'contracts',
                'expiry_date_manual_override',
                $manualExpiryOverride ? 1 : 0
            );
        }
        if ($this->hasColumn('contracts', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($contract, 'contracts', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->setAttributeIfColumn($contract, 'contracts', 'updated_by', $actorId);
        }

        $contract->save();
        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'contracts',
            $contract->getKey(),
            $before,
            $this->toAuditArray($contract->fresh() ?? $contract)
        );

        return response()->json([
            'data' => $this->serializeContract(
                $contract->loadMissing([
                    'customer' => fn ($query) => $query->select($this->customerRelationColumns()),
                    'project' => fn ($query) => $query->select($this->projectRelationColumns()),
                ])
            ),
        ]);
    }

    public function deleteContract(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        $contract = Contract::query()->findOrFail($id);

        return $this->deleteModel($request, $contract, 'Contract');
    }

    public function storeDocument(Request $request): JsonResponse
    {
        if (! $this->hasTable('documents')) {
            return $this->missingTable('documents');
        }

        $scope = $this->normalizeDocumentScope((string) ($request->input('scope') ?? self::DOCUMENT_SCOPE_DEFAULT));
        $isProductPricingScope = $scope === self::DOCUMENT_SCOPE_PRODUCT_PRICING;

        $rules = [
            'id' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => [$isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => [$isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['nullable', 'integer'],
            'expiryDate' => ['nullable', 'date'],
            'releaseDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['nullable', 'array'],
            'productIds.*' => ['integer'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
        ];

        if ($this->hasColumn('documents', 'document_code')) {
            $uniqueRule = Rule::unique('documents', 'document_code');
            if ($this->hasColumn('documents', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['id'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        $documentTypeId = null;
        if ($isProductPricingScope) {
            $documentTypeId = $this->resolveOrCreateProductPricingDocumentTypeId();
            if ($this->hasColumn('documents', 'document_type_id') && $documentTypeId === null) {
                return response()->json(['message' => 'Không thể xác định loại tài liệu giá sản phẩm.'], 422);
            }
        } else {
            $documentTypeId = $this->resolveDocumentTypeIdFromInput($validated['typeId'] ?? null);
            if ($documentTypeId === null) {
                return response()->json(['message' => 'Loại tài liệu không hợp lệ.'], 422);
            }
        }

        $customerId = null;
        if ($isProductPricingScope) {
            $customerId = $this->resolveProductPricingDocumentCustomerId();
            if ($this->hasColumn('documents', 'customer_id') && $customerId === null) {
                return response()->json(['message' => 'Không thể xác định customerId cho tài liệu giá sản phẩm.'], 422);
            }
        } else {
            $customerId = $this->parseNullableInt($validated['customerId'] ?? null);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customerId is invalid.'], 422);
            }
        }

        $projectId = null;
        if (! $isProductPricingScope) {
            $projectId = $this->parseNullableInt($validated['projectId'] ?? null);
            if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
                return response()->json(['message' => 'projectId is invalid.'], 422);
            }
        }

        $productIds = $this->normalizeDocumentProductIds($validated['productIds'] ?? []);
        if ($productIds !== [] && ! $this->validateProductIds($productIds)) {
            return response()->json(['message' => 'productIds chứa giá trị không hợp lệ.'], 422);
        }

        $documentCode = trim((string) ($validated['id'] ?? ''));
        $documentName = trim((string) ($validated['name'] ?? ''));
        $status = $this->normalizeDocumentStatus((string) ($validated['status'] ?? 'ACTIVE'));
        $actorId = $this->parseNullableInt($request->user()?->id);
        $attachments = is_array($validated['attachments'] ?? null) ? $validated['attachments'] : [];
        $documentDate = $validated['releaseDate'] ?? ($validated['expiryDate'] ?? null);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->resolveProjectDepartmentIdById($projectId),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $documentId = DB::transaction(function () use (
            $documentCode,
            $documentName,
            $documentTypeId,
            $customerId,
            $projectId,
            $status,
            $actorId,
            $productIds,
            $attachments,
            $documentDate
        ): int {
            $payload = $this->filterPayloadByTableColumns('documents', [
                'document_code' => $documentCode,
                'document_name' => $documentName,
                'document_type_id' => $documentTypeId,
                'customer_id' => $customerId,
                'project_id' => $projectId,
                'expiry_date' => $documentDate,
                'status' => $status,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            $createdId = DB::table('documents')->insertGetId($payload);

            $this->syncDocumentProductLinks($createdId, $productIds, $actorId);
            $this->syncDocumentAttachments($createdId, $attachments, $actorId);

            return $createdId;
        });

        $record = $this->loadDocumentByNumericId($documentId);
        if ($record === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu tài liệu sau khi lưu.'], 500);
        }

        $this->recordAuditEvent(
            $request,
            'INSERT',
            'documents',
            $documentId,
            null,
            $this->toAuditArray($record)
        );

        return response()->json(['data' => $record], 201);
    }

    public function updateDocument(Request $request, string $id): JsonResponse
    {
        if (! $this->hasTable('documents')) {
            return $this->missingTable('documents');
        }

        $scope = $this->normalizeDocumentScope((string) ($request->input('scope') ?? self::DOCUMENT_SCOPE_DEFAULT));
        $isProductPricingScope = $scope === self::DOCUMENT_SCOPE_PRODUCT_PRICING;

        $existingRecord = $this->findDocumentRowByIdentifier($id);
        if ($existingRecord === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $documentId = $this->parseNullableInt($existingRecord['id'] ?? null);
        if ($documentId === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $beforeRecord = $this->toAuditArray($existingRecord);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->resolveDepartmentIdForTableRecord('documents', $beforeRecord),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $rules = [
            'id' => ['sometimes', 'required', 'string', 'max:100'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'scope' => ['nullable', 'string'],
            'typeId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required'],
            'customerId' => ['sometimes', $isProductPricingScope ? 'nullable' : 'required', 'integer'],
            'projectId' => ['sometimes', 'nullable', 'integer'],
            'expiryDate' => ['sometimes', 'nullable', 'date'],
            'releaseDate' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'nullable', Rule::in(self::DOCUMENT_STATUSES)],
            'productIds' => ['sometimes', 'nullable', 'array'],
            'productIds.*' => ['integer'],
            'attachments' => ['sometimes', 'nullable', 'array'],
            'attachments.*.id' => ['nullable', 'string', 'max:100'],
            'attachments.*.fileName' => ['required_with:attachments', 'string', 'max:255'],
            'attachments.*.fileUrl' => ['nullable', 'string'],
            'attachments.*.driveFileId' => ['nullable', 'string', 'max:255'],
            'attachments.*.fileSize' => ['nullable', 'numeric', 'min:0'],
            'attachments.*.mimeType' => ['nullable', 'string', 'max:255'],
            'attachments.*.createdAt' => ['nullable', 'date'],
            'attachments.*.storagePath' => ['nullable', 'string', 'max:1024'],
            'attachments.*.storageDisk' => ['nullable', 'string', 'max:50'],
            'attachments.*.storageVisibility' => ['nullable', 'string', 'max:20'],
            'attachments.*.storageProvider' => ['nullable', 'string', 'max:30'],
        ];

        if ($this->hasColumn('documents', 'document_code')) {
            $uniqueRule = Rule::unique('documents', 'document_code')->ignore($documentId);
            if ($this->hasColumn('documents', 'deleted_at')) {
                $uniqueRule = $uniqueRule->where(fn ($query) => $query->whereNull('deleted_at'));
            }
            $rules['id'][] = $uniqueRule;
        }

        $validated = $request->validate($rules);

        if (! $isProductPricingScope && array_key_exists('customerId', $validated)) {
            $customerId = $this->parseNullableInt($validated['customerId']);
            if ($customerId === null || ! $this->tableRowExists('customers', $customerId)) {
                return response()->json(['message' => 'customerId is invalid.'], 422);
            }
        }

        if (! $isProductPricingScope && array_key_exists('projectId', $validated)) {
            $projectId = $this->parseNullableInt($validated['projectId']);
            if ($projectId !== null && ! $this->tableRowExists('projects', $projectId)) {
                return response()->json(['message' => 'projectId is invalid.'], 422);
            }
            $scopeError = $this->authorizeMutationByScope(
                $request,
                'tài liệu',
                $this->resolveProjectDepartmentIdById($projectId),
                $this->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }

        $documentTypeId = null;
        if ($isProductPricingScope) {
            $documentTypeId = $this->resolveOrCreateProductPricingDocumentTypeId();
            if ($this->hasColumn('documents', 'document_type_id') && $documentTypeId === null) {
                return response()->json(['message' => 'Không thể xác định loại tài liệu giá sản phẩm.'], 422);
            }
        } elseif (array_key_exists('typeId', $validated)) {
            $documentTypeId = $this->resolveDocumentTypeIdFromInput($validated['typeId']);
            if ($documentTypeId === null) {
                return response()->json(['message' => 'Loại tài liệu không hợp lệ.'], 422);
            }
        }

        $customerIdForProductPricing = null;
        if ($isProductPricingScope) {
            $customerIdForProductPricing = $this->resolveProductPricingDocumentCustomerId();
            if ($this->hasColumn('documents', 'customer_id') && $customerIdForProductPricing === null) {
                return response()->json(['message' => 'Không thể xác định customerId cho tài liệu giá sản phẩm.'], 422);
            }
        }

        $productIds = null;
        if (array_key_exists('productIds', $validated)) {
            $productIds = $this->normalizeDocumentProductIds($validated['productIds'] ?? []);
            if ($productIds !== [] && ! $this->validateProductIds($productIds)) {
                return response()->json(['message' => 'productIds chứa giá trị không hợp lệ.'], 422);
            }
        }

        $actorId = $this->parseNullableInt($request->user()?->id);

        DB::transaction(function () use (
            $documentId,
            $validated,
            $documentTypeId,
            $actorId,
            $productIds,
            $isProductPricingScope,
            $customerIdForProductPricing
        ): void {
            $updates = [];
            if (array_key_exists('id', $validated)) {
                $updates['document_code'] = trim((string) $validated['id']);
            }
            if (array_key_exists('name', $validated)) {
                $updates['document_name'] = trim((string) $validated['name']);
            }
            if ($isProductPricingScope || array_key_exists('typeId', $validated)) {
                $updates['document_type_id'] = $documentTypeId;
            }
            if ($isProductPricingScope) {
                $updates['customer_id'] = $customerIdForProductPricing;
                $updates['project_id'] = null;
            } elseif (array_key_exists('customerId', $validated)) {
                $updates['customer_id'] = $this->parseNullableInt($validated['customerId']);
            }
            if (! $isProductPricingScope && array_key_exists('projectId', $validated)) {
                $updates['project_id'] = $this->parseNullableInt($validated['projectId']);
            }
            if (array_key_exists('expiryDate', $validated)) {
                $updates['expiry_date'] = $validated['expiryDate'];
            }
            if (array_key_exists('releaseDate', $validated)) {
                $updates['expiry_date'] = $validated['releaseDate'];
            }
            if (array_key_exists('status', $validated)) {
                $updates['status'] = $this->normalizeDocumentStatus((string) $validated['status']);
            }
            if ($this->hasColumn('documents', 'updated_by') && $actorId !== null) {
                $updates['updated_by'] = $actorId;
            }

            $filteredUpdates = $this->filterPayloadByTableColumns('documents', $updates);
            if ($filteredUpdates !== []) {
                DB::table('documents')->where('id', $documentId)->update($filteredUpdates);
            }

            if ($productIds !== null) {
                $this->syncDocumentProductLinks($documentId, $productIds, $actorId);
            }

            if (array_key_exists('attachments', $validated)) {
                $attachments = is_array($validated['attachments']) ? $validated['attachments'] : [];
                $this->syncDocumentAttachments($documentId, $attachments, $actorId);
            }
        });

        $record = $this->loadDocumentByNumericId($documentId);
        if ($record === null) {
            return response()->json(['message' => 'Không thể tải dữ liệu tài liệu sau khi cập nhật.'], 500);
        }

        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'documents',
            $documentId,
            $beforeRecord,
            $this->toAuditArray($record)
        );

        return response()->json(['data' => $record]);
    }

    public function deleteDocument(Request $request, string $id): JsonResponse
    {
        if (! $this->hasTable('documents')) {
            return $this->missingTable('documents');
        }

        $existingRecord = $this->findDocumentRowByIdentifier($id);
        if ($existingRecord === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $documentId = $this->parseNullableInt($existingRecord['id'] ?? null);
        if ($documentId === null) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        $beforeRecord = $this->toAuditArray($existingRecord);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'tài liệu',
            $this->resolveDepartmentIdForTableRecord('documents', $beforeRecord),
            $this->extractIntFromRecord($beforeRecord, ['created_by', 'updated_by'])
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        DB::transaction(function () use ($documentId, $request): void {
            if ($this->hasColumn('documents', 'deleted_at')) {
                $payload = ['deleted_at' => now()];
                $actorId = $this->resolveAuthenticatedUserId($request);
                if ($actorId !== null && $this->hasColumn('documents', 'updated_by')) {
                    $payload['updated_by'] = $actorId;
                }
                if ($this->hasColumn('documents', 'updated_at')) {
                    $payload['updated_at'] = now();
                }

                DB::table('documents')
                    ->where('id', $documentId)
                    ->whereNull('deleted_at')
                    ->update($this->filterPayloadByTableColumns('documents', $payload));

                return;
            }

            if ($this->hasTable('attachments') && $this->hasColumn('attachments', 'reference_type') && $this->hasColumn('attachments', 'reference_id')) {
                DB::table('attachments')
                    ->where('reference_type', 'DOCUMENT')
                    ->where('reference_id', $documentId)
                    ->delete();
            }

            if ($this->hasTable('document_product_links')) {
                DB::table('document_product_links')
                    ->where('document_id', $documentId)
                    ->delete();
            }

            DB::table('documents')->where('id', $documentId)->delete();
        });

        $this->recordAuditEvent(
            $request,
            'DELETE',
            'documents',
            $documentId,
            $beforeRecord,
            null
        );

        return response()->json(['message' => 'Document deleted.']);
    }

    public function uploadDocumentAttachment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:20480',
                'mimes:pdf,doc,docx,xlsx,xls,txt,png,jpg,jpeg',
                'mimetypes:application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,image/png,image/jpeg',
            ],
        ]);

        /** @var UploadedFile|null $file */
        $file = $validated['file'] ?? null;
        if (! $file instanceof UploadedFile) {
            return response()->json(['message' => 'File upload không hợp lệ.'], 422);
        }

        $allowedExtensions = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'txt', 'png', 'jpg', 'jpeg'];
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if ($extension === '' || ! in_array($extension, $allowedExtensions, true)) {
            return response()->json([
                'message' => 'Định dạng file không được hỗ trợ.',
            ], 422);
        }

        try {
            $uploadResult = $this->uploadDocumentFileToStorage($file);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Tải file thất bại: '.$exception->getMessage(),
            ], 500);
        }

        return response()->json([
            'data' => [
                'id' => (string) Str::uuid(),
                'fileName' => (string) $uploadResult['fileName'],
                'mimeType' => (string) $uploadResult['mimeType'],
                'fileSize' => (int) $uploadResult['fileSize'],
                'fileUrl' => (string) $uploadResult['fileUrl'],
                'driveFileId' => (string) ($uploadResult['driveFileId'] ?? ''),
                'createdAt' => now()->toDateString(),
                'storageProvider' => (string) ($uploadResult['storageProvider'] ?? 'LOCAL'),
                'storagePath' => $uploadResult['storagePath'] ?? null,
                'storageDisk' => $uploadResult['storageDisk'] ?? null,
                'storageVisibility' => $uploadResult['storageVisibility'] ?? null,
                'warningMessage' => $uploadResult['warningMessage'] ?? null,
            ],
        ]);
    }

    public function deleteUploadedDocumentAttachment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'attachmentId' => ['nullable', 'integer'],
            'driveFileId' => ['nullable', 'string', 'max:255'],
            'fileUrl' => ['nullable', 'string'],
            'storagePath' => ['nullable', 'string', 'max:1024'],
            'storageDisk' => ['nullable', 'string', 'max:50'],
        ]);

        $attachmentId = $this->parseNullableInt($validated['attachmentId'] ?? null);
        $driveFileId = $this->normalizeNullableString($validated['driveFileId'] ?? null);
        $fileUrl = $this->normalizeNullableString($validated['fileUrl'] ?? null);
        $storagePath = $this->normalizeNullableString($validated['storagePath'] ?? null);
        $storageDisk = $this->normalizeNullableString($validated['storageDisk'] ?? null);

        if ($attachmentId !== null && $this->hasTable('attachments')) {
            $attachmentRecord = DB::table('attachments')->where('id', $attachmentId)->first();
            if ($attachmentRecord !== null) {
                $attachmentData = (array) $attachmentRecord;
                $driveFileId = $driveFileId ?? $this->normalizeNullableString($attachmentData['drive_file_id'] ?? null);
                $fileUrl = $fileUrl ?? $this->normalizeNullableString($attachmentData['file_url'] ?? null);
                $storagePath = $storagePath ?? $this->normalizeNullableString($attachmentData['storage_path'] ?? null);
                $storageDisk = $storageDisk ?? $this->normalizeNullableString($attachmentData['storage_disk'] ?? null);
            }
        }

        if ($driveFileId !== null && $this->isGoogleDriveConfigured()) {
            try {
                $this->deleteGoogleDriveFile($driveFileId);
            } catch (\Throwable $exception) {
                return response()->json([
                    'message' => 'Không thể xóa file trên Google Drive: '.$exception->getMessage(),
                ], 500);
            }
        }

        if ($storagePath !== null && $storageDisk === self::BACKBLAZE_B2_STORAGE_DISK) {
            try {
                $this->deleteBackblazeB2FileByStoragePath($storagePath);
            } catch (\Throwable $exception) {
                return response()->json([
                    'message' => 'Không thể xóa file trên Backblaze B2: '.$exception->getMessage(),
                ], 500);
            }
        } elseif ($storagePath !== null) {
            $this->deleteLocalDocumentFileByStoragePath($storagePath, $storageDisk ?? 'local');
        }

        if ($fileUrl !== null && $storageDisk !== self::BACKBLAZE_B2_STORAGE_DISK) {
            $this->deleteLocalDocumentFileByUrl($fileUrl);
        }

        return response()->json(['message' => 'Đã xóa file đính kèm.']);
    }

    public function downloadDocumentAttachment(Request $request, int $id): Response
    {
        $attachment = $this->findAttachmentDownloadRow($id, 'DOCUMENT');
        if ($attachment instanceof Response) {
            return $attachment;
        }

        return $this->downloadAttachmentResponse($attachment);
    }

    public function downloadAttachment(Request $request, int $id): Response
    {
        $attachment = $this->findAttachmentDownloadRow($id);
        if ($attachment instanceof Response) {
            return $attachment;
        }

        return $this->downloadAttachmentResponse($attachment);
    }

    public function downloadTemporaryDocumentAttachment(Request $request): Response
    {
        $disk = trim((string) $request->query('disk', 'local'));
        $path = trim((string) $request->query('path', ''));
        $name = trim((string) $request->query('name', 'attachment'));

        if ($path === '') {
            return response()->json(['message' => 'Invalid attachment path.'], 422);
        }

        if ($disk === self::BACKBLAZE_B2_STORAGE_DISK) {
            return $this->downloadBackblazeB2AttachmentResponse($path, $name);
        }

        $this->prepareConfiguredStorageDisk($disk);

        if (! Storage::disk($disk)->exists($path)) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return Storage::disk($disk)->download($path, $name);
    }

    /**
     * @return array<string, mixed>|Response
     */
    private function findAttachmentDownloadRow(int $id, ?string $referenceType = null): array|Response
    {
        if (! $this->hasTable('attachments')) {
            return $this->missingTable('attachments');
        }

        $attachment = DB::table('attachments')
            ->select($this->selectColumns('attachments', [
                'id',
                'reference_type',
                'file_name',
                'file_url',
                'drive_file_id',
                'storage_disk',
                'storage_path',
                'storage_visibility',
            ]))
            ->where('id', $id)
            ->when(
                $referenceType !== null && $this->hasColumn('attachments', 'reference_type'),
                fn ($query) => $query->where('reference_type', $referenceType)
            )
            ->first();

        if ($attachment === null) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return (array) $attachment;
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function downloadAttachmentResponse(array $attachment): Response
    {
        $storagePath = $this->normalizeNullableString($attachment['storage_path'] ?? null);
        $storageDisk = $this->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';

        if ($storagePath !== null && $storageDisk === self::BACKBLAZE_B2_STORAGE_DISK) {
            return $this->downloadBackblazeB2AttachmentResponse($storagePath, $fileName);
        }

        $this->prepareConfiguredStorageDisk($storageDisk);

        if ($storagePath !== null && Storage::disk($storageDisk)->exists($storagePath)) {
            return Storage::disk($storageDisk)->download($storagePath, $fileName);
        }

        $fileUrl = $this->normalizeNullableString($attachment['file_url'] ?? null);
        if ($fileUrl !== null) {
            return redirect()->away($fileUrl);
        }

        return response()->json(['message' => 'Attachment file is unavailable.'], 404);
    }

    public function backblazeB2IntegrationSettings(): JsonResponse
    {
        $runtimeConfig = $this->resolveBackblazeB2RuntimeConfig();
        $settingsRow = $this->loadBackblazeB2IntegrationSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::BACKBLAZE_B2_INTEGRATION_PROVIDER,
                'is_enabled' => (bool) ($runtimeConfig['is_enabled'] ?? false),
                'access_key_id' => $runtimeConfig['access_key_id'] ?? null,
                'bucket_id' => $runtimeConfig['bucket_id'] ?? null,
                'bucket_name' => $runtimeConfig['bucket_name'] ?? null,
                'region' => $runtimeConfig['region'] ?? null,
                'endpoint' => $runtimeConfig['endpoint'] ?? null,
                'file_prefix' => $runtimeConfig['file_prefix'] ?? null,
                'has_secret_access_key' => (bool) ($runtimeConfig['has_secret_access_key'] ?? false),
                'secret_access_key_preview' => $this->maskBackblazeB2SecretAccessKey($runtimeConfig['secret_access_key'] ?? null),
                'source' => $runtimeConfig['source'] ?? 'ENV',
                'last_tested_at' => $settingsRow['last_tested_at'] ?? null,
                'last_test_status' => $settingsRow['last_test_status'] ?? null,
                'last_test_message' => $settingsRow['last_test_message'] ?? null,
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateBackblazeB2IntegrationSettings(Request $request): JsonResponse
    {
        if (! $this->hasTable('integration_settings')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa tồn tại. Vui lòng chạy migration trước.',
            ], 422);
        }

        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'access_key_id' => ['nullable', 'string', 'max:255'],
            'bucket_id' => ['nullable', 'string', 'max:255'],
            'bucket_name' => ['nullable', 'string', 'max:255'],
            'region' => ['nullable', 'string', 'max:100'],
            'file_prefix' => ['nullable', 'string', 'max:100'],
            'secret_access_key' => ['nullable', 'string', 'max:120000'],
            'clear_secret_access_key' => ['nullable', 'boolean'],
        ]);

        $actorId = $this->parseNullableInt($request->user()?->id ?? null);
        $now = now();
        $existing = $this->loadBackblazeB2IntegrationSettingsRow();

        $payload = [
            'is_enabled' => (bool) ($validated['is_enabled'] ?? false),
            'access_key_id' => $this->normalizeNullableString($validated['access_key_id'] ?? null),
            'bucket_id' => $this->normalizeNullableString($validated['bucket_id'] ?? null),
            'bucket_name' => $this->normalizeNullableString($validated['bucket_name'] ?? null),
            'region' => $this->normalizeNullableString($validated['region'] ?? null),
            'endpoint' => $this->resolveBackblazeB2Endpoint(
                $validated['region'] ?? null,
                $existing['endpoint'] ?? null
            ),
            'file_prefix' => $this->normalizeNullableString($validated['file_prefix'] ?? null),
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $shouldClearSecret = (bool) ($validated['clear_secret_access_key'] ?? false);
        $secretAccessKey = $this->normalizeNullableString($validated['secret_access_key'] ?? null);

        if ($shouldClearSecret) {
            $payload['secret_access_key'] = null;
        } elseif ($secretAccessKey !== null) {
            $payload['secret_access_key'] = Crypt::encryptString($secretAccessKey);
        }

        $configurationChanged = $existing === null
            || (bool) ($existing['is_enabled'] ?? false) !== (bool) $payload['is_enabled']
            || $this->normalizeNullableString($existing['access_key_id'] ?? null) !== $this->normalizeNullableString($payload['access_key_id'] ?? null)
            || $this->normalizeNullableString($existing['bucket_id'] ?? null) !== $this->normalizeNullableString($payload['bucket_id'] ?? null)
            || $this->normalizeNullableString($existing['bucket_name'] ?? null) !== $this->normalizeNullableString($payload['bucket_name'] ?? null)
            || $this->normalizeNullableString($existing['region'] ?? null) !== $this->normalizeNullableString($payload['region'] ?? null)
            || $this->normalizeNullableString($existing['endpoint'] ?? null) !== $this->normalizeNullableString($payload['endpoint'] ?? null)
            || $this->normalizeNullableString($existing['file_prefix'] ?? null) !== $this->normalizeNullableString($payload['file_prefix'] ?? null)
            || $shouldClearSecret
            || array_key_exists('secret_access_key', $payload);

        if ($configurationChanged) {
            $payload['last_tested_at'] = null;
            $payload['last_test_status'] = null;
            $payload['last_test_message'] = 'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.';
        }

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::BACKBLAZE_B2_INTEGRATION_PROVIDER],
            $payload
        );

        return $this->backblazeB2IntegrationSettings();
    }

    public function testBackblazeB2IntegrationSettings(Request $request): JsonResponse
    {
        $runtimeConfig = $this->resolveBackblazeB2RuntimeConfig();
        $hasOverrides = $request->hasAny([
            'is_enabled',
            'access_key_id',
            'bucket_id',
            'bucket_name',
            'region',
            'file_prefix',
            'secret_access_key',
            'clear_secret_access_key',
        ]);

        if ($hasOverrides) {
            $validated = $request->validate([
                'is_enabled' => ['nullable', 'boolean'],
                'access_key_id' => ['nullable', 'string', 'max:255'],
                'bucket_id' => ['nullable', 'string', 'max:255'],
                'bucket_name' => ['nullable', 'string', 'max:255'],
                'region' => ['nullable', 'string', 'max:100'],
                'file_prefix' => ['nullable', 'string', 'max:100'],
                'secret_access_key' => ['nullable', 'string', 'max:120000'],
                'clear_secret_access_key' => ['nullable', 'boolean'],
            ]);

            $overrideResult = $this->applyBackblazeB2RuntimeConfigOverrides($runtimeConfig, $validated);
            if (! ($overrideResult['success'] ?? false)) {
                return response()->json([
                    'message' => trim((string) ($overrideResult['errorMessage'] ?? 'Cấu hình Backblaze B2 không hợp lệ.')),
                ], 422);
            }

            $runtimeConfig = $overrideResult['config'];
        }

        $shouldPersistTestResult = ! $hasOverrides;

        if (! (bool) ($runtimeConfig['is_enabled'] ?? false)) {
            if ($shouldPersistTestResult) {
                $this->saveBackblazeB2IntegrationTestResult('FAILED', 'Backblaze B2 đang ở trạng thái tắt.');
            }

            return response()->json([
                'message' => 'Backblaze B2 đang ở trạng thái tắt.',
            ], 422);
        }

        $validation = $this->validateBackblazeB2RuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            $message = trim((string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'));
            if ($shouldPersistTestResult) {
                $this->saveBackblazeB2IntegrationTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $result = $this->verifyBackblazeB2UploadCapability($runtimeConfig);
        if (! ($result['success'] ?? false)) {
            $message = trim((string) ($result['errorMessage'] ?? 'Backblaze B2 chưa ghi được file test.'));
            if ($shouldPersistTestResult) {
                $this->saveBackblazeB2IntegrationTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $successMessage = 'Kết nối Backblaze B2 thành công và có thể tải file.';
        if ($shouldPersistTestResult) {
            $this->saveBackblazeB2IntegrationTestResult('SUCCESS', $successMessage);
        }

        return response()->json([
            'data' => [
                'message' => $successMessage,
                'status' => 'SUCCESS',
                'tested_at' => now()->toIso8601String(),
                'persisted' => $shouldPersistTestResult,
            ],
        ]);
    }

    public function googleDriveIntegrationSettings(): JsonResponse
    {
        $runtimeConfig = $this->resolveGoogleDriveRuntimeConfig();
        $settingsRow = $this->loadGoogleDriveIntegrationSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::GOOGLE_DRIVE_INTEGRATION_PROVIDER,
                'is_enabled' => (bool) ($runtimeConfig['is_enabled'] ?? false),
                'account_email' => $runtimeConfig['account_email'] ?? null,
                'folder_id' => $runtimeConfig['folder_id'] ?? null,
                'scopes' => $runtimeConfig['scopes'] ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE,
                'impersonate_user' => $runtimeConfig['impersonate_user'] ?? null,
                'file_prefix' => $runtimeConfig['file_prefix'] ?? null,
                'has_service_account_json' => (bool) ($runtimeConfig['has_credentials'] ?? false),
                'source' => $runtimeConfig['source'] ?? 'ENV',
                'last_tested_at' => $settingsRow['last_tested_at'] ?? null,
                'last_test_status' => $settingsRow['last_test_status'] ?? null,
                'last_test_message' => $settingsRow['last_test_message'] ?? null,
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function contractExpiryAlertSettings(): JsonResponse
    {
        $settingsRow = $this->loadContractExpiryAlertSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::CONTRACT_ALERT_INTEGRATION_PROVIDER,
                'warning_days' => $this->resolveContractExpiryWarningDays(),
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateContractExpiryAlertSettings(Request $request): JsonResponse
    {
        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_expiry_warning_days')
        ) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa có cột contract_expiry_warning_days. Vui lòng chạy migration mới nhất.',
            ], 422);
        }

        $validated = $request->validate([
            'warning_days' => [
                'required',
                'integer',
                'min:'.self::MIN_CONTRACT_EXPIRY_WARNING_DAYS,
                'max:'.self::MAX_CONTRACT_EXPIRY_WARNING_DAYS,
            ],
        ]);

        $warningDays = (int) $validated['warning_days'];
        $actorId = $this->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => true,
            'contract_expiry_warning_days' => $warningDays,
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $existing = $this->loadContractExpiryAlertSettingsRow();
        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_ALERT_INTEGRATION_PROVIDER],
            $payload
        );

        return $this->contractExpiryAlertSettings();
    }

    public function contractPaymentAlertSettings(): JsonResponse
    {
        $settingsRow = $this->loadContractPaymentAlertSettingsRow();

        return response()->json([
            'data' => [
                'provider' => self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER,
                'warning_days' => $this->resolveContractPaymentWarningDays(),
                'source' => $settingsRow !== null ? 'DB' : 'DEFAULT',
                'updated_at' => $settingsRow['updated_at'] ?? null,
            ],
        ]);
    }

    public function updateContractPaymentAlertSettings(Request $request): JsonResponse
    {
        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_payment_warning_days')
        ) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa có cột contract_payment_warning_days. Vui lòng chạy migration mới nhất.',
            ], 422);
        }

        $validated = $request->validate([
            'warning_days' => [
                'required',
                'integer',
                'min:'.self::MIN_CONTRACT_EXPIRY_WARNING_DAYS,
                'max:'.self::MAX_CONTRACT_EXPIRY_WARNING_DAYS,
            ],
        ]);

        $warningDays = (int) $validated['warning_days'];
        $actorId = $this->parseNullableInt($request->user()?->id ?? null);
        $now = now();

        $payload = [
            'is_enabled' => true,
            'contract_payment_warning_days' => $warningDays,
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $existing = $this->loadContractPaymentAlertSettingsRow();
        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER],
            $payload
        );

        return $this->contractPaymentAlertSettings();
    }

    public function updateGoogleDriveIntegrationSettings(Request $request): JsonResponse
    {
        if (! $this->hasTable('integration_settings')) {
            return response()->json([
                'message' => 'Bảng integration_settings chưa tồn tại. Vui lòng chạy migration trước.',
            ], 422);
        }

        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'account_email' => ['nullable', 'string', 'max:255'],
            'folder_id' => ['nullable', 'string', 'max:255'],
            'scopes' => ['nullable', 'string', 'max:500'],
            'impersonate_user' => ['nullable', 'string', 'max:255'],
            'file_prefix' => ['nullable', 'string', 'max:100'],
            'service_account_json' => ['nullable', 'string', 'max:120000'],
            'clear_service_account_json' => ['nullable', 'boolean'],
        ]);

        $actorId = $this->parseNullableInt($request->user()?->id ?? null);
        $now = now();
        $existing = $this->loadGoogleDriveIntegrationSettingsRow();

        $payload = [
            'is_enabled' => (bool) ($validated['is_enabled'] ?? false),
            'account_email' => $this->normalizeNullableString($validated['account_email'] ?? null),
            'folder_id' => $this->normalizeNullableString($validated['folder_id'] ?? null),
            'scopes' => $this->normalizeNullableString($validated['scopes'] ?? null),
            'impersonate_user' => $this->normalizeNullableString($validated['impersonate_user'] ?? null),
            'file_prefix' => $this->normalizeNullableString($validated['file_prefix'] ?? null),
            'updated_at' => $now,
            'updated_by' => $actorId,
        ];

        $shouldClearCredentials = (bool) ($validated['clear_service_account_json'] ?? false);
        $serviceAccountJsonRaw = $this->normalizeNullableString($validated['service_account_json'] ?? null);

        if ($shouldClearCredentials) {
            $payload['service_account_json'] = null;
        } elseif ($serviceAccountJsonRaw !== null) {
            $decoded = json_decode($serviceAccountJsonRaw, true);
            if (! is_array($decoded)) {
                return response()->json([
                    'message' => 'Service Account JSON không đúng định dạng JSON object.',
                ], 422);
            }

            if (
                empty($decoded['client_email']) ||
                empty($decoded['private_key']) ||
                empty($decoded['token_uri'])
            ) {
                return response()->json([
                    'message' => 'Service Account JSON thiếu trường bắt buộc (client_email/private_key/token_uri).',
                ], 422);
            }

            $normalizedJson = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (! is_string($normalizedJson) || trim($normalizedJson) === '') {
                return response()->json([
                    'message' => 'Service Account JSON không hợp lệ.',
                ], 422);
            }

            $payload['service_account_json'] = Crypt::encryptString($normalizedJson);

            $decodedClientEmail = $this->normalizeNullableString($decoded['client_email'] ?? null);
            if ($decodedClientEmail !== null) {
                $payload['account_email'] = $decodedClientEmail;
            }
        }

        $configurationChanged = $existing === null
            || (bool) ($existing['is_enabled'] ?? false) !== (bool) $payload['is_enabled']
            || $this->normalizeNullableString($existing['account_email'] ?? null) !== $this->normalizeNullableString($payload['account_email'] ?? null)
            || $this->normalizeNullableString($existing['folder_id'] ?? null) !== $this->normalizeNullableString($payload['folder_id'] ?? null)
            || $this->normalizeNullableString($existing['scopes'] ?? null) !== $this->normalizeNullableString($payload['scopes'] ?? null)
            || $this->normalizeNullableString($existing['impersonate_user'] ?? null) !== $this->normalizeNullableString($payload['impersonate_user'] ?? null)
            || $this->normalizeNullableString($existing['file_prefix'] ?? null) !== $this->normalizeNullableString($payload['file_prefix'] ?? null)
            || $shouldClearCredentials
            || array_key_exists('service_account_json', $payload);

        if ($configurationChanged) {
            $payload['last_tested_at'] = null;
            $payload['last_test_status'] = null;
            $payload['last_test_message'] = 'Cấu hình đã thay đổi. Vui lòng kiểm tra kết nối lại.';
        }

        if ($existing === null) {
            $payload['created_at'] = $now;
            $payload['created_by'] = $actorId;
        }

        DB::table('integration_settings')->updateOrInsert(
            ['provider' => self::GOOGLE_DRIVE_INTEGRATION_PROVIDER],
            $payload
        );

        return $this->googleDriveIntegrationSettings();
    }

    public function testGoogleDriveIntegrationSettings(Request $request): JsonResponse
    {
        $runtimeConfig = $this->resolveGoogleDriveRuntimeConfig();
        $hasOverrides = $request->hasAny([
            'is_enabled',
            'account_email',
            'folder_id',
            'scopes',
            'impersonate_user',
            'file_prefix',
            'service_account_json',
            'clear_service_account_json',
        ]);

        if ($hasOverrides) {
            $validated = $request->validate([
                'is_enabled' => ['nullable', 'boolean'],
                'account_email' => ['nullable', 'string', 'max:255'],
                'folder_id' => ['nullable', 'string', 'max:255'],
                'scopes' => ['nullable', 'string', 'max:500'],
                'impersonate_user' => ['nullable', 'string', 'max:255'],
                'file_prefix' => ['nullable', 'string', 'max:100'],
                'service_account_json' => ['nullable', 'string', 'max:120000'],
                'clear_service_account_json' => ['nullable', 'boolean'],
            ]);

            $overrideResult = $this->applyGoogleDriveRuntimeConfigOverrides($runtimeConfig, $validated);
            if (! ($overrideResult['success'] ?? false)) {
                return response()->json([
                    'message' => trim((string) ($overrideResult['errorMessage'] ?? 'Cấu hình Google Drive không hợp lệ.')),
                ], 422);
            }

            $runtimeConfig = $overrideResult['config'];
        }

        $shouldPersistTestResult = ! $hasOverrides;

        if (! (bool) ($runtimeConfig['is_enabled'] ?? false)) {
            if ($shouldPersistTestResult) {
                $this->saveGoogleDriveIntegrationTestResult('FAILED', 'Google Drive đang ở trạng thái tắt.');
            }

            return response()->json([
                'message' => 'Google Drive đang ở trạng thái tắt.',
            ], 422);
        }

        $credentials = $runtimeConfig['credentials'] ?? null;
        if (! is_array($credentials)) {
            if ($shouldPersistTestResult) {
                $this->saveGoogleDriveIntegrationTestResult('FAILED', 'Thiếu Service Account JSON.');
            }

            return response()->json([
                'message' => 'Thiếu Service Account JSON. Vui lòng cập nhật cấu hình trước khi kiểm tra.',
            ], 422);
        }

        $accessToken = $this->requestGoogleDriveAccessToken(
            $credentials,
            (string) ($runtimeConfig['scopes'] ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE),
            (string) ($runtimeConfig['impersonate_user'] ?? '')
        );

        if ($accessToken === null) {
            if ($shouldPersistTestResult) {
                $this->saveGoogleDriveIntegrationTestResult('FAILED', 'Không thể lấy access token từ Service Account.');
            }

            return response()->json([
                'message' => 'Không thể lấy access token từ Service Account. Vui lòng kiểm tra lại quyền và JSON.',
            ], 422);
        }

        $response = Http::withToken($accessToken)
            ->timeout(30)
            ->get('https://www.googleapis.com/drive/v3/about', [
                'fields' => 'user(displayName,emailAddress)',
                'supportsAllDrives' => 'true',
            ]);

        if (! $response->successful()) {
            $message = 'Google Drive trả về lỗi khi kiểm tra kết nối.';
            $payload = $response->json();
            if (is_array($payload) && isset($payload['error']['message'])) {
                $message = (string) $payload['error']['message'];
            }

            if ($shouldPersistTestResult) {
                $this->saveGoogleDriveIntegrationTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $driveUser = $response->json('user.emailAddress');
        $uploadCapability = $this->verifyGoogleDriveUploadCapability($runtimeConfig, $accessToken);
        if (! ($uploadCapability['success'] ?? false)) {
            $message = trim((string) ($uploadCapability['errorMessage'] ?? 'Google Drive chưa ghi được file test.'));
            if ($shouldPersistTestResult) {
                $this->saveGoogleDriveIntegrationTestResult('FAILED', $message);
            }

            return response()->json([
                'message' => $message,
            ], 422);
        }

        $successMessage = $driveUser
            ? "Kết nối Google Drive thành công và có thể tải file ({$driveUser})."
            : 'Kết nối Google Drive thành công và có thể tải file.';

        if ($shouldPersistTestResult) {
            $this->saveGoogleDriveIntegrationTestResult('SUCCESS', $successMessage);
        }

        return response()->json([
            'data' => [
                'message' => $successMessage,
                'user_email' => $driveUser,
                'status' => 'SUCCESS',
                'tested_at' => now()->toIso8601String(),
                'persisted' => $shouldPersistTestResult,
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array<string, mixed> $validated
     * @return array{success:bool,config?:array<string,mixed>,errorMessage?:string}
     */
    private function applyBackblazeB2RuntimeConfigOverrides(array $runtimeConfig, array $validated): array
    {
        $config = $runtimeConfig;

        if (array_key_exists('is_enabled', $validated)) {
            $config['is_enabled'] = (bool) ($validated['is_enabled'] ?? false);
        }

        if (array_key_exists('access_key_id', $validated)) {
            $config['access_key_id'] = $this->normalizeNullableString($validated['access_key_id'] ?? null);
        }

        if (array_key_exists('bucket_id', $validated)) {
            $config['bucket_id'] = $this->normalizeNullableString($validated['bucket_id'] ?? null);
        }

        if (array_key_exists('bucket_name', $validated)) {
            $config['bucket_name'] = $this->normalizeNullableString($validated['bucket_name'] ?? null);
        }

        if (array_key_exists('region', $validated)) {
            $config['region'] = $this->normalizeNullableString($validated['region'] ?? null);
        }

        if (array_key_exists('file_prefix', $validated)) {
            $config['file_prefix'] = $this->normalizeNullableString($validated['file_prefix'] ?? null);
        }

        $config['endpoint'] = $this->resolveBackblazeB2Endpoint(
            $config['region'] ?? null,
            $config['endpoint'] ?? null
        );

        $shouldClearSecret = (bool) ($validated['clear_secret_access_key'] ?? false);
        $secretAccessKey = $this->normalizeNullableString($validated['secret_access_key'] ?? null);

        if ($shouldClearSecret) {
            $config['secret_access_key'] = null;
            $config['has_secret_access_key'] = false;
        } elseif ($secretAccessKey !== null) {
            $config['secret_access_key'] = $secretAccessKey;
            $config['has_secret_access_key'] = true;
        }

        return [
            'success' => true,
            'config' => $config,
        ];
    }

    private function applyGoogleDriveRuntimeConfigOverrides(array $runtimeConfig, array $validated): array
    {
        $config = $runtimeConfig;

        if (array_key_exists('is_enabled', $validated)) {
            $config['is_enabled'] = (bool) ($validated['is_enabled'] ?? false);
        }

        if (array_key_exists('account_email', $validated)) {
            $config['account_email'] = $this->normalizeNullableString($validated['account_email'] ?? null);
        }

        if (array_key_exists('folder_id', $validated)) {
            $config['folder_id'] = $this->normalizeNullableString($validated['folder_id'] ?? null);
        }

        if (array_key_exists('scopes', $validated)) {
            $config['scopes'] = $this->normalizeNullableString($validated['scopes'] ?? null) ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE;
        }

        if (array_key_exists('impersonate_user', $validated)) {
            $config['impersonate_user'] = $this->normalizeNullableString($validated['impersonate_user'] ?? null);
        }

        if (array_key_exists('file_prefix', $validated)) {
            $config['file_prefix'] = $this->normalizeNullableString($validated['file_prefix'] ?? null);
        }

        $shouldClearCredentials = (bool) ($validated['clear_service_account_json'] ?? false);
        $serviceAccountJsonRaw = $this->normalizeNullableString($validated['service_account_json'] ?? null);

        if ($shouldClearCredentials) {
            $config['credentials'] = null;
            $config['has_credentials'] = false;
        } elseif ($serviceAccountJsonRaw !== null) {
            $decoded = json_decode($serviceAccountJsonRaw, true);
            if (! is_array($decoded)) {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account JSON không đúng định dạng JSON object.',
                ];
            }

            if (
                empty($decoded['client_email']) ||
                empty($decoded['private_key']) ||
                empty($decoded['token_uri'])
            ) {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account JSON thiếu trường bắt buộc (client_email/private_key/token_uri).',
                ];
            }

            $config['credentials'] = $decoded;
            $config['has_credentials'] = true;
            $decodedClientEmail = $this->normalizeNullableString($decoded['client_email'] ?? null);
            if ($decodedClientEmail !== null) {
                $config['account_email'] = $decodedClientEmail;
            }
        }

        return [
            'success' => true,
            'config' => $config,
        ];
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
                'confirmed_by',
                'confirmed_at',
                'created_at',
                'updated_at',
            ]));

        $contractId = $this->parseNullableInt($request->query('contract_id'));
        if ($contractId !== null) {
            $query->where('contract_id', $contractId);
        }

        $rows = $this->serializePaymentScheduleRows($query
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values());

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

        $before = $this->toAuditArray($schedule);
        $beforeAttachmentMap = $this->loadPaymentScheduleAttachmentMap([$id]);
        $before['attachments'] = $beforeAttachmentMap[(string) $id] ?? [];
        $scopeContractId = $this->extractIntFromRecord($before, ['contract_id']);
        if ($scopeContractId !== null && $this->hasTable('contracts')) {
            $scopeContract = Contract::query()->find($scopeContractId);
            if ($scopeContract instanceof Contract) {
                $scopeError = $this->assertModelMutationAccess($request, $scopeContract, 'kỳ thanh toán');
                if ($scopeError instanceof JsonResponse) {
                    return $scopeError;
                }
            }
        }

        $validated = $request->validate([
            'actual_paid_date' => ['sometimes', 'nullable', 'date'],
            'actual_paid_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'required', Rule::in(self::PAYMENT_SCHEDULE_STATUSES)],
            'notes' => ['sometimes', 'nullable', 'string'],
            'attachments' => ['sometimes', 'array'],
            'attachments.*' => ['array'],
        ]);

        $current = (array) $schedule;
        $updates = [];
        $actorId = $this->resolveAuthenticatedUserId($request);
        $attachmentsProvided = array_key_exists('attachments', $validated);
        $attachments = $attachmentsProvided && is_array($validated['attachments'] ?? null)
            ? $validated['attachments']
            : [];
        $isPaymentConfirmationMutation = array_key_exists('actual_paid_date', $validated)
            || array_key_exists('actual_paid_amount', $validated)
            || array_key_exists('status', $validated);

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

        $resolvedStatus = strtoupper((string) ($updates['status'] ?? $current['status'] ?? 'PENDING'));
        $resolvedActualPaidDate = array_key_exists('actual_paid_date', $updates)
            ? $updates['actual_paid_date']
            : ($current['actual_paid_date'] ?? null);
        $resolvedActualPaidAmount = (float) (
            array_key_exists('actual_paid_amount', $updates)
                ? ($updates['actual_paid_amount'] ?? 0)
                : ($current['actual_paid_amount'] ?? 0)
        );
        $hasConfirmedPayment = in_array($resolvedStatus, ['PAID', 'PARTIAL'], true)
            || $resolvedActualPaidAmount > 0
            || $resolvedActualPaidDate !== null;

        if ($isPaymentConfirmationMutation) {
            if ($hasConfirmedPayment) {
                if ($this->hasColumn('payment_schedules', 'confirmed_by')) {
                    $updates['confirmed_by'] = $actorId;
                }
                if ($this->hasColumn('payment_schedules', 'confirmed_at')) {
                    $updates['confirmed_at'] = now();
                }
            } else {
                if ($this->hasColumn('payment_schedules', 'confirmed_by')) {
                    $updates['confirmed_by'] = null;
                }
                if ($this->hasColumn('payment_schedules', 'confirmed_at')) {
                    $updates['confirmed_at'] = null;
                }
            }
        }

        if ($updates === [] && ! $attachmentsProvided) {
            $currentPayload = $this->serializePaymentScheduleRows(collect([$current]))->first();
            return response()->json(['data' => $currentPayload]);
        }

        if ($updates !== []) {
            $updates['updated_at'] = now();
            DB::table('payment_schedules')->where('id', $id)->update($updates);
        } elseif ($attachmentsProvided && $this->hasColumn('payment_schedules', 'updated_at')) {
            DB::table('payment_schedules')->where('id', $id)->update(['updated_at' => now()]);
        }

        if ($attachmentsProvided) {
            $this->syncPaymentScheduleAttachments($id, $attachments, $actorId);
        }

        $fresh = DB::table('payment_schedules')->where('id', $id)->first();
        if ($fresh === null) {
            return response()->json(['message' => 'Payment schedule not found after update.'], 404);
        }

        $after = $this->toAuditArray($fresh);
        $afterAttachmentMap = $this->loadPaymentScheduleAttachmentMap([$id]);
        $after['attachments'] = $afterAttachmentMap[(string) $id] ?? [];

        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'payment_schedules',
            $id,
            $before,
            $after
        );

        $payload = $this->serializePaymentScheduleRows(collect([(array) $fresh]))->first();

        return response()->json(['data' => $payload]);
    }

    public function generateContractPayments(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('contracts')) {
            return $this->missingTable('contracts');
        }

        if (! $this->hasTable('payment_schedules')) {
            return $this->missingTable('payment_schedules');
        }

        $contract = Contract::query()->findOrFail($id);
        $scopeError = $this->assertModelMutationAccess($request, $contract, 'hợp đồng');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $validated = $request->validate([
            'allocation_mode' => ['sometimes', 'string', Rule::in(self::PAYMENT_ALLOCATION_MODES)],
            'advance_percentage' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'retention_percentage' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'installment_count' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
            'installments' => ['sometimes', 'array'],
            'installments.*.label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'installments.*.percentage' => ['sometimes', 'required', 'numeric', 'min:0.01', 'max:100'],
            'installments.*.expected_date' => ['sometimes', 'nullable', 'date'],
        ]);

        try {
            $generationSummary = $this->generateContractPaymentSchedulesFallback($contract, [
                'allocation_mode' => $validated['allocation_mode'] ?? null,
                'advance_percentage' => $validated['advance_percentage'] ?? null,
                'retention_percentage' => $validated['retention_percentage'] ?? null,
                'installment_count' => $validated['installment_count'] ?? null,
                'installments' => $validated['installments'] ?? [],
            ]);
        } catch (ValidationException $validationException) {
            throw $validationException;
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'Không thể sinh kỳ thanh toán tự động.',
                'error' => $exception->getMessage(),
            ], 422);
        }

        $rows = $this->serializePaymentScheduleRows(DB::table('payment_schedules')
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
                'confirmed_by',
                'confirmed_at',
                'created_at',
                'updated_at',
            ]))
            ->where('contract_id', $contract->id)
            ->orderBy('expected_date')
            ->orderBy('cycle_number')
            ->orderBy('id')
            ->get()
            ->map(fn (object $record): array => (array) $record)
            ->values());

        $auditAfter = [
            'contract_id' => $contract->id,
            'generated_rows' => (int) ($generationSummary['generated_count'] ?? 0),
            'allocation_mode' => (string) ($generationSummary['allocation_mode'] ?? 'EVEN'),
            'generation_mode' => 'backend',
        ];

        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'contracts',
            $contract->id,
            ['contract_id' => $contract->id, 'operation' => 'generate_contract_payments'],
            $auditAfter
        );

        $generatedCycleNumbers = $generationSummary['generated_cycle_numbers'] ?? [];

        return response()->json([
            'message' => 'Đã sinh kỳ thanh toán theo logic backend thống nhất.',
            'data' => $rows,
            'generated_data' => $rows
                ->filter(fn (array $row): bool => in_array(
                    (int) ($row['cycle_number'] ?? 0),
                    $generatedCycleNumbers,
                    true
                ))
                ->values(),
            'meta' => [
                'generated_count' => (int) ($generationSummary['generated_count'] ?? 0),
                'allocation_mode' => (string) ($generationSummary['allocation_mode'] ?? 'EVEN'),
                'generation_mode' => 'backend',
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $options
     * @return array{generated_count:int,allocation_mode:string,generated_cycle_numbers:array<int, int>}
     */
    private function generateContractPaymentSchedulesFallback(Contract $contract, array $options = []): array
    {
        $context = $this->resolveContractPaymentGenerationContext($contract);
        $cycle = (string) $context['cycle'];
        $amount = (float) $context['amount'];
        $startDate = (string) $context['start_date'];
        $endDate = isset($context['end_date']) ? (string) $context['end_date'] : null;
        $investmentMode = $this->normalizeNullableString($context['investment_mode'] ?? null);

        $requestedAllocationMode = $this->normalizeNullableString($options['allocation_mode'] ?? null);
        $allocationMode = $this->resolvePaymentAllocationMode($requestedAllocationMode, $investmentMode);
        $advancePercentage = $this->clampPercentageValue($options['advance_percentage'] ?? null);
        $retentionPercentage = $this->clampPercentageValue($options['retention_percentage'] ?? null);
        $installmentCount = $this->parseNullableInt($options['installment_count'] ?? null);
        $installments = is_array($options['installments'] ?? null) ? $options['installments'] : [];

        if ($allocationMode === 'MILESTONE') {
            $scheduleSpecs = $this->buildMilestonePaymentSchedule(
                $amount,
                $startDate,
                $endDate,
                $advancePercentage,
                $retentionPercentage,
                $installmentCount,
                $installments
            );
        } else {
            $expectedDates = $this->buildExpectedPaymentDatesForCycle($cycle, $startDate, $endDate);
            $cycleCount = max(1, count($expectedDates));
            $expectedAmounts = $this->buildAllocatedExpectedAmounts($amount, $cycleCount);
            $scheduleSpecs = [];
            foreach ($expectedDates as $index => $expectedDate) {
                $cycleNumber = $index + 1;
                $scheduleSpecs[] = [
                    'milestone_name' => $this->buildPaymentMilestoneName($cycle, $cycleNumber, $investmentMode),
                    'expected_date' => $expectedDate,
                    'expected_amount' => max(0, (float) ($expectedAmounts[$index] ?? 0)),
                ];
            }
        }

        $cycleCount = max(1, count($scheduleSpecs));

        $contractData = $contract->toArray();
        $projectId = $this->parseNullableInt($this->firstNonEmpty($contractData, ['project_id']));
        $requiresProjectId = $this->hasColumn('payment_schedules', 'project_id')
            && ! $this->isColumnNullable('payment_schedules', 'project_id');

        if ($requiresProjectId && $projectId === null) {
            throw ValidationException::withMessages([
                'project_id' => ['Không thể sinh kỳ thanh toán vì hợp đồng chưa có dự án liên kết.'],
            ]);
        }

        $insertSpecs = $scheduleSpecs;

        $now = now();
        $rows = [];

        foreach ($insertSpecs as $index => $scheduleSpec) {
            $cycleNumber = $index + 1;
            $expectedDate = (string) ($scheduleSpec['expected_date'] ?? $startDate);
            $expectedAmount = (float) ($scheduleSpec['expected_amount'] ?? 0);

            $row = [
                'contract_id' => $contract->id,
                'milestone_name' => (string) ($scheduleSpec['milestone_name'] ?? $this->buildPaymentMilestoneName($cycle, $cycleNumber, $investmentMode)),
                'cycle_number' => $cycleNumber,
                'expected_date' => $expectedDate,
                'expected_amount' => max(0, $expectedAmount),
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'PENDING',
                'notes' => null,
            ];

            if ($this->hasColumn('payment_schedules', 'project_id')) {
                $row['project_id'] = $projectId;
            }
            if ($this->hasColumn('payment_schedules', 'created_at')) {
                $row['created_at'] = $now;
            }
            if ($this->hasColumn('payment_schedules', 'updated_at')) {
                $row['updated_at'] = $now;
            }

            $rows[] = $row;
        }

        DB::transaction(function () use ($contract, $rows): void {
            DB::table('payment_schedules')
                ->where('contract_id', $contract->id)
                ->delete();

            if ($rows !== []) {
                DB::table('payment_schedules')->insert($rows);
            }
        });

        return [
            'generated_count' => count($rows),
            'allocation_mode' => $allocationMode,
            'generated_cycle_numbers' => array_values(array_map(
                static fn (array $row): int => (int) ($row['cycle_number'] ?? 0),
                $rows
            )),
        ];
    }

    /**
     * @return array{cycle:string,amount:float,start_date:string,end_date:?string,investment_mode:?string}
     */
    private function resolveContractPaymentGenerationContext(Contract $contract): array
    {
        $contractData = $contract->toArray();
        $projectId = $this->parseNullableInt($this->firstNonEmpty($contractData, ['project_id']));

        $cycle = $this->normalizePaymentCycle((string) $this->firstNonEmpty($contractData, ['payment_cycle'], 'ONCE'));
        $amount = (float) $this->firstNonEmpty($contractData, ['value', 'total_value'], 0);
        $effectiveDate = $this->normalizeDateFilter($this->firstNonEmpty($contractData, ['effective_date']));
        $signDate = $this->normalizeDateFilter($this->firstNonEmpty($contractData, ['sign_date']));
        $startDate = $effectiveDate ?? $signDate;
        $endDate = $this->normalizeDateFilter($this->firstNonEmpty($contractData, ['expiry_date']));
        $investmentMode = $this->loadProjectInvestmentMode($projectId);
        $termUnitRaw = strtoupper(trim((string) $this->firstNonEmpty($contractData, ['term_unit'], '')));
        $termUnit = in_array($termUnitRaw, self::CONTRACT_TERM_UNITS, true) ? $termUnitRaw : null;
        $termValue = $this->parseNullableFloat($this->firstNonEmpty($contractData, ['term_value']));

        if (($termUnit !== null && $termValue === null) || ($termUnit === null && $termValue !== null)) {
            throw ValidationException::withMessages([
                'term_value' => ['term_unit và term_value phải đi cùng nhau để suy ra ngày hết hiệu lực.'],
            ]);
        }

        if ($termUnit === 'DAY' && $termValue !== null && floor($termValue) !== $termValue) {
            throw ValidationException::withMessages([
                'term_value' => ['Thời hạn theo ngày phải là số nguyên.'],
            ]);
        }

        if ($endDate === null && $startDate !== null && $termUnit !== null && $termValue !== null) {
            $endDate = $this->resolveContractExpiryDateFromTerm($termUnit, $termValue, $effectiveDate, $signDate);
        }

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'value' => ['Giá trị hợp đồng phải lớn hơn 0 để sinh kỳ thanh toán.'],
            ]);
        }

        if ($startDate === null) {
            throw ValidationException::withMessages([
                'effective_date' => ['Không xác định được mốc bắt đầu hợp đồng để sinh kỳ thanh toán.'],
            ]);
        }

        if ($endDate !== null && $endDate < $startDate) {
            throw ValidationException::withMessages([
                'expiry_date' => ['Ngày hết hiệu lực phải lớn hơn hoặc bằng mốc bắt đầu hợp đồng.'],
            ]);
        }

        return [
            'cycle' => $cycle,
            'amount' => $amount,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'investment_mode' => $investmentMode,
        ];
    }

    private function resolvePaymentAllocationMode(?string $requestedMode, ?string $investmentMode): string
    {
        $normalizedMode = strtoupper(trim((string) ($requestedMode ?? '')));
        if (in_array($normalizedMode, self::PAYMENT_ALLOCATION_MODES, true)) {
            if ($normalizedMode === 'MILESTONE' && strtoupper((string) $investmentMode) !== 'DAU_TU') {
                throw ValidationException::withMessages([
                    'allocation_mode' => ['Chỉ dự án Đầu tư mới dùng được cách phân bổ theo mốc nghiệm thu.'],
                ]);
            }

            return $normalizedMode;
        }

        return strtoupper((string) $investmentMode) === 'DAU_TU' ? 'MILESTONE' : 'EVEN';
    }

    private function clampPercentageValue(mixed $value, float $default = 0): float
    {
        $parsed = $this->parseNullableFloat($value);
        if ($parsed === null) {
            return $default;
        }

        return max(0, min(100, $parsed));
    }

    private function loadProjectInvestmentMode(?int $projectId): ?string
    {
        if (
            $projectId === null
            || ! $this->hasTable('projects')
            || ! $this->hasColumn('projects', 'investment_mode')
        ) {
            return null;
        }

        $rawMode = DB::table('projects')
            ->where('id', $projectId)
            ->value('investment_mode');

        $normalizedMode = strtoupper(trim((string) ($rawMode ?? '')));

        return $normalizedMode !== '' ? $normalizedMode : null;
    }

    /**
     * @param array<int, mixed> $installments
     * @return array<int, array{milestone_name:string,expected_date:string,expected_amount:float}>
     */
    private function buildMilestonePaymentSchedule(
        float $totalAmount,
        string $startDate,
        ?string $endDate,
        float $advancePercentage,
        float $retentionPercentage,
        ?int $installmentCount,
        array $installments = []
    ): array {
        if ($endDate === null || trim($endDate) === '') {
            throw ValidationException::withMessages([
                'expiry_date' => ['Dự án Đầu tư cần có Ngày hết hiệu lực để sinh kỳ thanh toán theo mốc nghiệm thu.'],
            ]);
        }

        $safeTotal = round(max(0, $totalAmount), 2);
        $safeAdvancePercentage = $this->clampPercentageValue($advancePercentage, 15);
        $safeRetentionPercentage = $this->clampPercentageValue($retentionPercentage, 5);
        $installmentSpecs = $this->normalizeMilestoneInstallmentDefinitions($installments);
        $hasCustomInstallments = $installmentSpecs !== [];
        $safeInstallmentCount = $hasCustomInstallments
            ? count($installmentSpecs)
            : max(1, min(50, $installmentCount ?? 3));

        if ($hasCustomInstallments) {
            $customPercentageTotal = round(array_sum(array_map(
                static fn (array $item): float => (float) ($item['percentage'] ?? 0),
                $installmentSpecs
            )), 2);

            $percentageTotal = round($safeAdvancePercentage + $safeRetentionPercentage + $customPercentageTotal, 2);
            if (abs($percentageTotal - 100) >= 0.01) {
                throw ValidationException::withMessages([
                    'installments' => ['Tổng % tạm ứng, các đợt thanh toán và quyết toán phải bằng 100%.'],
                ]);
            }
        } elseif ($safeAdvancePercentage + $safeRetentionPercentage >= 100) {
            throw ValidationException::withMessages([
                'retention_percentage' => ['Tổng % tạm ứng và % giữ lại phải nhỏ hơn 100% để còn phần thanh toán theo đợt.'],
            ]);
        }

        $rows = [];
        $hasAdvance = $safeAdvancePercentage > 0;
        $hasRetention = $safeRetentionPercentage > 0;

        if ($hasAdvance) {
            $rows[] = [
                'milestone_name' => 'Tạm ứng',
                'expected_date' => $startDate,
                'expected_amount' => round(($safeTotal * $safeAdvancePercentage) / 100, 2),
            ];
        }

        $installmentDates = $this->buildMilestoneInstallmentDates(
            $startDate,
            $endDate,
            $safeInstallmentCount,
            $hasAdvance,
            $hasRetention
        );

        if ($hasCustomInstallments) {
            foreach ($installmentSpecs as $index => $installmentSpec) {
                $fallbackDate = $installmentDates[$index] ?? $endDate;
                $rows[] = [
                    'milestone_name' => (string) ($installmentSpec['label'] ?? sprintf('Thanh toán đợt %d', $index + 1)),
                    'expected_date' => (string) ($installmentSpec['expected_date'] ?? $fallbackDate),
                    'expected_amount' => round(($safeTotal * (float) ($installmentSpec['percentage'] ?? 0)) / 100, 2),
                ];
            }
        } else {
            $advanceAmount = round(($safeTotal * $safeAdvancePercentage) / 100, 2);
            $retentionAmount = round(($safeTotal * $safeRetentionPercentage) / 100, 2);
            $installmentPool = max(0, round($safeTotal - $advanceAmount - $retentionAmount, 2));
            $installmentAmounts = $this->buildAllocatedExpectedAmounts($installmentPool, $safeInstallmentCount);

            foreach ($installmentDates as $index => $installmentDate) {
                $rows[] = [
                    'milestone_name' => sprintf('Thanh toán đợt %d', $index + 1),
                    'expected_date' => $installmentDate,
                    'expected_amount' => max(0, (float) ($installmentAmounts[$index] ?? 0)),
                ];
            }
        }

        if ($hasRetention) {
            $rows[] = [
                'milestone_name' => 'Quyết toán',
                'expected_date' => $endDate,
                'expected_amount' => round(($safeTotal * $safeRetentionPercentage) / 100, 2),
            ];
        }

        if ($rows === []) {
            throw ValidationException::withMessages([
                'allocation_mode' => ['Không thể sinh mốc thanh toán đầu tư vì chưa có cấu hình tạm ứng, đợt thanh toán hoặc quyết toán.'],
            ]);
        }

        $totalAllocated = round(array_sum(array_map(
            static fn (array $row): float => (float) ($row['expected_amount'] ?? 0),
            $rows
        )), 2);
        $diff = round($safeTotal - $totalAllocated, 2);
        if (abs($diff) >= 0.01) {
            $lastIndex = count($rows) - 1;
            $rows[$lastIndex]['expected_amount'] = max(0, round(((float) $rows[$lastIndex]['expected_amount']) + $diff, 2));
        }

        return array_map(static function (array $row): array {
            return [
                'milestone_name' => (string) ($row['milestone_name'] ?? ''),
                'expected_date' => (string) ($row['expected_date'] ?? ''),
                'expected_amount' => round(max(0, (float) ($row['expected_amount'] ?? 0)), 2),
            ];
        }, $rows);
    }

    /**
     * @param array<int, mixed> $installments
     * @return array<int, array{label:string,percentage:float,expected_date:?string}>
     */
    private function normalizeMilestoneInstallmentDefinitions(array $installments): array
    {
        $normalized = [];

        foreach ($installments as $index => $installment) {
            if (! is_array($installment)) {
                continue;
            }

            $percentage = $this->parseNullableFloat($installment['percentage'] ?? null);
            if ($percentage === null || $percentage <= 0) {
                throw ValidationException::withMessages([
                    "installments.{$index}.percentage" => ['Mỗi đợt thanh toán phải có tỷ lệ % lớn hơn 0.'],
                ]);
            }

            $expectedDate = $this->normalizeDateFilter($installment['expected_date'] ?? null);

            $normalized[] = [
                'label' => trim((string) ($installment['label'] ?? '')),
                'percentage' => max(0, min(100, $percentage)),
                'expected_date' => $expectedDate,
            ];
        }

        return $normalized;
    }

    /**
     * @return array<int, string>
     */
    private function buildMilestoneInstallmentDates(
        string $startDate,
        string $endDate,
        int $installmentCount,
        bool $hasAdvance,
        bool $hasRetention
    ): array {
        if ($installmentCount <= 0) {
            return [];
        }

        try {
            $start = Carbon::parse($startDate)->startOfDay();
            $end = Carbon::parse($endDate)->startOfDay();
        } catch (\Throwable) {
            return array_fill(0, $installmentCount, $startDate);
        }

        if ($end->lte($start)) {
            return array_fill(0, $installmentCount, $start->toDateString());
        }

        $startMonth = $start->copy()->startOfMonth();
        $endMonth = $end->copy()->startOfMonth();
        $monthSpan = max(1, (($endMonth->year - $startMonth->year) * 12) + ($endMonth->month - $startMonth->month));
        $dates = [];

        for ($index = 1; $index <= $installmentCount; $index++) {
            if ($hasAdvance && $hasRetention) {
                $rawOffsetMonths = ($monthSpan / ($installmentCount + 1)) * $index;
            } elseif ($hasAdvance && ! $hasRetention) {
                $rawOffsetMonths = ($monthSpan / $installmentCount) * $index;
            } elseif (! $hasAdvance && $hasRetention) {
                $rawOffsetMonths = ($monthSpan / ($installmentCount + 1)) * $index;
            } else {
                $rawOffsetMonths = $installmentCount === 1
                    ? $monthSpan
                    : ($monthSpan / max(1, $installmentCount - 1)) * ($index - 1);
            }

            $offsetMonths = (int) ceil(max(0, $rawOffsetMonths) - 0.000001);
            $candidate = $startMonth->copy()->addMonthsNoOverflow($offsetMonths)->startOfMonth();

            if ($candidate->lt($start)) {
                $candidate = $start->copy();
            }
            if ($candidate->gt($end)) {
                $candidate = $end->copy();
            }

            $dates[] = $candidate->toDateString();
        }

        return $dates;
    }

    /**
     * @return array<int, float>
     */
    private function buildAllocatedExpectedAmounts(float $totalAmount, int $cycleCount): array
    {
        $safeTotal = round(max(0, $totalAmount), 2);
        $safeCount = max(1, $cycleCount);

        if ($safeCount === 1) {
            return [$safeTotal];
        }

        $amounts = [];

        $baseAmount = round($safeTotal / $safeCount, 2);
        for ($index = 1; $index <= $safeCount; $index++) {
            if ($index === $safeCount) {
                $amounts[] = max(0, round($safeTotal - ($baseAmount * max(0, $safeCount - 1)), 2));
                continue;
            }

            $amounts[] = $baseAmount;
        }

        if ($amounts === []) {
            return [$safeTotal];
        }

        $sum = round(array_sum($amounts), 2);
        $diff = round($safeTotal - $sum, 2);
        if (abs($diff) >= 0.01) {
            $lastIndex = count($amounts) - 1;
            $amounts[$lastIndex] = max(0, round(((float) $amounts[$lastIndex]) + $diff, 2));
        }

        return array_map(
            static fn (float $value): float => round(max(0, $value), 2),
            array_map(static fn ($value): float => (float) $value, $amounts)
        );
    }

    /**
     * @return array<int, string>
     */
    private function buildExpectedPaymentDatesForCycle(string $cycle, string $startDate, ?string $endDate): array
    {
        try {
            $start = Carbon::parse($startDate)->startOfDay();
        } catch (\Throwable) {
            return [$startDate];
        }

        $intervalMonths = match (strtoupper($cycle)) {
            'MONTHLY' => 1,
            'QUARTERLY' => 3,
            'HALF_YEARLY' => 6,
            'YEARLY' => 12,
            default => null,
        };

        if ($intervalMonths === null) {
            return [$start->toDateString()];
        }

        $end = null;
        if ($endDate !== null && trim($endDate) !== '') {
            try {
                $end = Carbon::parse($endDate)->endOfDay();
            } catch (\Throwable) {
                $end = null;
            }
        }

        if (! $end instanceof Carbon || $end->lt($start)) {
            return [$start->toDateString()];
        }

        $dates = [];
        $safetyCounter = 0;

        while ($safetyCounter < 1200) {
            $currentDate = $start->copy()->addMonthsNoOverflow($intervalMonths * $safetyCounter);
            if ($currentDate->gt($end)) {
                break;
            }

            $dates[] = $currentDate->toDateString();
            $safetyCounter++;
        }

        return $dates !== [] ? $dates : [$start->toDateString()];
    }

    private function buildPaymentMilestoneName(string $cycle, int $cycleNumber, ?string $investmentMode = null): string
    {
        $normalizedInvestmentMode = strtoupper(trim((string) ($investmentMode ?? '')));
        $prefix = $normalizedInvestmentMode === 'THUE_DICH_VU_DACTHU' ? 'Phí dịch vụ kỳ' : 'Thanh toán kỳ';

        return match (strtoupper($cycle)) {
            'ONCE' => 'Thanh toán một lần',
            'MONTHLY' => sprintf('%s %d (tháng)', $prefix, $cycleNumber),
            'QUARTERLY' => sprintf('%s %d (quý)', $prefix, $cycleNumber),
            'HALF_YEARLY' => sprintf('%s %d (6 tháng)', $prefix, $cycleNumber),
            'YEARLY' => sprintf('%s %d (năm)', $prefix, $cycleNumber),
            default => sprintf('%s %d', $prefix, $cycleNumber),
        };
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
            'stage' => ['nullable', 'string', 'max:120'],
            'owner_id' => ['nullable', 'integer'],
            'data_scope' => ['nullable', 'string', 'max:255'],
        ];

        $validated = $request->validate($rules);

        $customerId = $this->parseNullableInt($validated['customer_id'] ?? null);
        if ($customerId === null || ! Customer::query()->whereKey($customerId)->exists()) {
            return response()->json([
                'message' => 'customer_id is invalid.',
            ], 422);
        }

        $resolvedStage = $this->normalizeOpportunityStage((string) ($validated['stage'] ?? 'NEW'), false);
        if ($resolvedStage === null) {
            return response()->json([
                'message' => 'stage is invalid or inactive.',
            ], 422);
        }

        $opportunity = new Opportunity();
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'opp_name', $validated['opp_name']);
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'customer_id', $customerId);
        $this->setAttributeByColumns($opportunity, 'opportunities', ['amount', 'expected_value'], $validated['amount'] ?? 0);
        $this->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->toOpportunityStorageStage($resolvedStage));

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

            if ($this->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }
        }

        if ($this->hasColumn('opportunities', 'data_scope')) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope'] ?? null);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        $scopeError = $this->authorizeMutationByScope(
            $request,
            'cơ hội',
            $this->extractIntFromRecord($this->toAuditArray($opportunity), ['dept_id', 'department_id']),
            $actorId
        );
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        if ($actorId !== null) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'created_by', $actorId);
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        $opportunity->save();
        $this->recordAuditEvent(
            $request,
            'INSERT',
            'opportunities',
            $opportunity->getKey(),
            null,
            $this->toAuditArray($opportunity)
        );

        return response()->json([
            'data' => $this->serializeOpportunity(
                $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ], 201);
    }

    public function updateOpportunity(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);
        $scopeError = $this->assertModelMutationAccess($request, $opportunity, 'cơ hội');
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }
        $before = $this->toAuditArray($opportunity);

        $rules = [
            'opp_name' => ['sometimes', 'required', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'required', 'integer'],
            'amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'stage' => ['sometimes', 'nullable', 'string', 'max:120'],
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
            $resolvedStage = $this->normalizeOpportunityStage((string) ($validated['stage'] ?? ''), false);
            if ($resolvedStage === null) {
                return response()->json(['message' => 'stage is invalid or inactive.'], 422);
            }
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'stage', $this->toOpportunityStorageStage($resolvedStage));
        }
        if (array_key_exists('owner_id', $validated) && $this->hasColumn('opportunities', 'owner_id')) {
            $ownerId = $this->parseNullableInt($validated['owner_id']);
            if ($ownerId === null || ! $this->ownerExists($ownerId)) {
                return response()->json(['message' => 'owner_id is invalid.'], 422);
            }

            $this->setAttributeIfColumn($opportunity, 'opportunities', 'owner_id', $ownerId);
            $ownerDeptId = null;
            if ($this->hasColumn('opportunities', 'dept_id')) {
                $ownerDeptId = $this->parseNullableInt(
                    InternalUser::query()->where('id', $ownerId)->value('department_id')
                );
                $this->setAttributeIfColumn($opportunity, 'opportunities', 'dept_id', $ownerDeptId);
            }
            $scopeError = $this->authorizeMutationByScope(
                $request,
                'cơ hội',
                $ownerDeptId,
                $this->resolveAuthenticatedUserId($request)
            );
            if ($scopeError instanceof JsonResponse) {
                return $scopeError;
            }
        }
        if ($this->hasColumn('opportunities', 'data_scope') && array_key_exists('data_scope', $validated)) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'data_scope', $validated['data_scope']);
        }

        $actorId = $this->resolveAuthenticatedUserId($request);
        if ($actorId !== null) {
            $this->setAttributeIfColumn($opportunity, 'opportunities', 'updated_by', $actorId);
        }

        $opportunity->save();
        $this->recordAuditEvent(
            $request,
            'UPDATE',
            'opportunities',
            $opportunity->getKey(),
            $before,
            $this->toAuditArray($opportunity->fresh() ?? $opportunity)
        );

        return response()->json([
            'data' => $this->serializeOpportunity(
                $opportunity->loadMissing(['customer' => fn ($query) => $query->select($this->customerRelationColumns())])
            ),
        ]);
    }

    public function deleteOpportunity(Request $request, int $id): JsonResponse
    {
        if (! $this->hasTable('opportunities')) {
            return $this->missingTable('opportunities');
        }

        $opportunity = Opportunity::query()->findOrFail($id);

        return $this->deleteModel($request, $opportunity, 'Opportunity');
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
            'document_product_links',
            'reminders',
            'user_dept_history',
            'audit_logs',
            'support_service_groups',
            'support_contact_positions',
            'opportunity_stages',
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

        $rawRoleIds = is_array($validated['role_ids'] ?? null) ? $validated['role_ids'] : [];
        $normalizedRoleIds = [];
        $invalidRoleIds = [];
        $roleIdCounters = [];

        foreach ($rawRoleIds as $rawRoleId) {
            $roleId = (int) $rawRoleId;
            if ($roleId <= 0) {
                $invalidRoleIds[] = $rawRoleId;
                continue;
            }

            $normalizedRoleIds[] = $roleId;
            $roleIdCounters[$roleId] = ($roleIdCounters[$roleId] ?? 0) + 1;
        }

        if ($invalidRoleIds !== []) {
            return response()->json([
                'message' => 'role_ids chứa giá trị không hợp lệ.',
                'errors' => [
                    'role_ids' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidRoleIds))),
                ],
            ], 422);
        }

        $duplicateRoleIds = array_values(array_map(
            'intval',
            array_keys(array_filter($roleIdCounters, static fn (int $count): bool => $count > 1))
        ));

        if ($duplicateRoleIds !== []) {
            return response()->json([
                'message' => 'role_ids bị trùng.',
                'errors' => [
                    'duplicate_role_ids' => $duplicateRoleIds,
                ],
            ], 422);
        }

        $roleIds = array_values(array_unique($normalizedRoleIds));
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

        $rawOverrides = is_array($validated['overrides'] ?? null) ? $validated['overrides'] : [];
        $normalizedOverrides = [];
        $invalidPermissionIds = [];
        $permissionIdCounters = [];

        foreach ($rawOverrides as $override) {
            if (! is_array($override)) {
                continue;
            }

            $permissionId = (int) ($override['permission_id'] ?? 0);
            if ($permissionId <= 0) {
                $invalidPermissionIds[] = $override['permission_id'] ?? null;
                continue;
            }

            $permissionIdCounters[$permissionId] = ($permissionIdCounters[$permissionId] ?? 0) + 1;
            $normalizedOverrides[] = [
                'permission_id' => $permissionId,
                'type' => strtoupper((string) ($override['type'] ?? 'GRANT')) === 'DENY' ? 'DENY' : 'GRANT',
                'reason' => trim((string) ($override['reason'] ?? 'Phân quyền cập nhật từ giao diện')),
                'expires_at' => $override['expires_at'] ?? null,
            ];
        }

        if ($invalidPermissionIds !== []) {
            return response()->json([
                'message' => 'permission_id chứa giá trị không hợp lệ.',
                'errors' => [
                    'permission_id' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidPermissionIds))),
                ],
            ], 422);
        }

        $duplicatePermissionIds = array_values(array_map(
            'intval',
            array_keys(array_filter($permissionIdCounters, static fn (int $count): bool => $count > 1))
        ));
        if ($duplicatePermissionIds !== []) {
            return response()->json([
                'message' => 'overrides bị trùng permission_id.',
                'errors' => [
                    'duplicate_permission_ids' => $duplicatePermissionIds,
                ],
            ], 422);
        }

        $overrides = $normalizedOverrides;
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

        $rawScopes = is_array($validated['scopes'] ?? null) ? $validated['scopes'] : [];
        $normalizedScopes = [];
        $invalidDeptIds = [];
        $duplicateScopeKeys = [];
        $scopeKeyCounters = [];

        foreach ($rawScopes as $scope) {
            if (! is_array($scope)) {
                continue;
            }

            $deptId = (int) ($scope['dept_id'] ?? 0);
            if ($deptId <= 0) {
                $invalidDeptIds[] = $scope['dept_id'] ?? null;
                continue;
            }

            $scopeType = strtoupper((string) ($scope['scope_type'] ?? ''));
            if (! in_array($scopeType, self::USER_DEPT_SCOPE_TYPES, true)) {
                continue;
            }

            $key = $deptId.'|'.$scopeType;
            $scopeKeyCounters[$key] = ($scopeKeyCounters[$key] ?? 0) + 1;
            if ($scopeKeyCounters[$key] > 1) {
                $duplicateScopeKeys[] = $key;
                continue;
            }

            $normalizedScopes[] = [
                'dept_id' => $deptId,
                'scope_type' => $scopeType,
            ];
        }

        if ($invalidDeptIds !== []) {
            return response()->json([
                'message' => 'dept_id chứa giá trị không hợp lệ.',
                'errors' => [
                    'dept_id' => array_values(array_unique(array_map(static fn ($value): string => (string) $value, $invalidDeptIds))),
                ],
            ], 422);
        }

        if ($duplicateScopeKeys !== []) {
            return response()->json([
                'message' => 'scopes bị trùng (dept_id + scope_type).',
                'errors' => [
                    'duplicate_scopes' => array_values(array_unique($duplicateScopeKeys)),
                ],
            ], 422);
        }

        $scopes = $normalizedScopes;
        if ($scopes === []) {
            return response()->json(['message' => 'scopes là bắt buộc.'], 422);
        }

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

    /**
     * @return array<int, int>|null
     */
    private function resolveAllowedDepartmentIdsForRequest(Request $request): ?array
    {
        $authenticatedUser = $request->user();
        if (! $authenticatedUser instanceof InternalUser) {
            return [];
        }

        return app(UserAccessService::class)->resolveDepartmentIdsForUser((int) $authenticatedUser->id);
    }

    private function applyCustomerRequestReadScope(Request $request, $query, string $alias = 'cr'): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId, $alias): void {
            $applied = false;

            if ($this->hasColumn('customer_requests', 'project_id') && $this->hasTable('projects')) {
                if ($this->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', $alias.'.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', $alias.'.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif (
                    $this->hasColumn('projects', 'opportunity_id')
                    && $this->hasTable('opportunities')
                    && $this->hasColumn('opportunities', 'dept_id')
                ) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_proj.id', $alias.'.project_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if (
                $this->hasColumn('customer_requests', 'project_item_id')
                && $this->hasTable('project_items')
                && $this->hasColumn('project_items', 'project_id')
                && $this->hasTable('projects')
                && $this->hasColumn('projects', 'opportunity_id')
                && $this->hasTable('opportunities')
                && $this->hasColumn('opportunities', 'dept_id')
            ) {
                if ($applied) {
                    $scope->orWhereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('project_items as scope_pi')
                            ->join('projects as scope_proj', 'scope_proj.id', '=', 'scope_pi.project_id')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_pi.id', $alias.'.project_item_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                } else {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds, $alias): void {
                        $subQuery->selectRaw('1')
                            ->from('project_items as scope_pi')
                            ->join('projects as scope_proj', 'scope_proj.id', '=', 'scope_pi.project_id')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_pi.id', $alias.'.project_item_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                }
                $applied = true;
            }

            if ($this->hasColumn('customer_requests', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere($alias.'.created_by', $userId);
                } else {
                    $scope->where($alias.'.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    private function applyDocumentReadScope(Request $request, $query): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId): void {
            $applied = false;

            if ($this->hasColumn('documents', 'dept_id')) {
                $scope->whereIn('documents.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->hasColumn('documents', 'department_id')) {
                $scope->whereIn('documents.department_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->hasColumn('documents', 'project_id') && $this->hasTable('projects')) {
                if ($this->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'documents.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'documents.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif (
                    $this->hasColumn('projects', 'opportunity_id')
                    && $this->hasTable('opportunities')
                    && $this->hasColumn('opportunities', 'dept_id')
                ) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_proj.id', 'documents.project_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if ($this->hasColumn('documents', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere('documents.created_by', $userId);
                } else {
                    $scope->where('documents.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    private function applySupportRequestReadScope(Request $request, $query): void
    {
        $allowedDeptIds = $this->resolveAllowedDepartmentIdsForRequest($request);
        if ($allowedDeptIds === null) {
            return;
        }
        if ($allowedDeptIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) ($request->user()?->id ?? 0);

        $query->where(function ($scope) use ($allowedDeptIds, $userId): void {
            $applied = false;

            if ($this->hasColumn('support_requests', 'dept_id')) {
                $scope->whereIn('sr.dept_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->hasColumn('support_requests', 'department_id')) {
                $scope->whereIn('sr.department_id', $allowedDeptIds);
                $applied = true;
            } elseif ($this->hasColumn('support_requests', 'project_id') && $this->hasTable('projects')) {
                if ($this->hasColumn('projects', 'dept_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'sr.project_id')
                            ->whereIn('scope_proj.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif ($this->hasColumn('projects', 'department_id')) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->whereColumn('scope_proj.id', 'sr.project_id')
                            ->whereIn('scope_proj.department_id', $allowedDeptIds);
                    });
                    $applied = true;
                } elseif (
                    $this->hasColumn('projects', 'opportunity_id')
                    && $this->hasTable('opportunities')
                    && $this->hasColumn('opportunities', 'dept_id')
                ) {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('projects as scope_proj')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_proj.id', 'sr.project_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                    $applied = true;
                }
            }

            if (
                $this->hasColumn('support_requests', 'project_item_id')
                && $this->hasTable('project_items')
                && $this->hasColumn('project_items', 'project_id')
                && $this->hasTable('projects')
                && $this->hasColumn('projects', 'opportunity_id')
                && $this->hasTable('opportunities')
                && $this->hasColumn('opportunities', 'dept_id')
            ) {
                if ($applied) {
                    $scope->orWhereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('project_items as scope_pi')
                            ->join('projects as scope_proj', 'scope_proj.id', '=', 'scope_pi.project_id')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_pi.id', 'sr.project_item_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                } else {
                    $scope->whereExists(function ($subQuery) use ($allowedDeptIds): void {
                        $subQuery->selectRaw('1')
                            ->from('project_items as scope_pi')
                            ->join('projects as scope_proj', 'scope_proj.id', '=', 'scope_pi.project_id')
                            ->join('opportunities as scope_opp', 'scope_opp.id', '=', 'scope_proj.opportunity_id')
                            ->whereColumn('scope_pi.id', 'sr.project_item_id')
                            ->whereIn('scope_opp.dept_id', $allowedDeptIds);
                    });
                }
                $applied = true;
            }

            if ($this->hasColumn('support_requests', 'created_by') && $userId > 0) {
                if ($applied) {
                    $scope->orWhere('sr.created_by', $userId);
                } else {
                    $scope->where('sr.created_by', $userId);
                }
                $applied = true;
            }

            if (! $applied) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    private function supportRequestsBaseQuery()
    {
        $query = DB::table('support_requests as sr');

        if ($this->hasColumn('support_requests', 'reference_request_id')) {
            $query->leftJoin('support_requests as sr_ref', 'sr.reference_request_id', '=', 'sr_ref.id');
        }

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
            if ($this->hasColumn('support_requests', 'receiver_user_id')) {
                $query->leftJoin('internal_users as iu_receiver', 'sr.receiver_user_id', '=', 'iu_receiver.id');
            }
        }
        if ($this->hasTable('customer_personnel') && $this->hasColumn('support_requests', 'reporter_contact_id')) {
            $query->leftJoin('customer_personnel as cp', 'sr.reporter_contact_id', '=', 'cp.id');
        }

        return $query;
    }

    private function supportRequestSelectColumns(): array
    {
        $selects = [];

        foreach ([
            'id',
            'request_code',
            'reference_ticket_code',
            'reference_request_id',
            'summary',
            'service_group_id',
            'project_item_id',
            'customer_id',
            'project_id',
            'product_id',
            'reporter_name',
            'reporter_contact_id',
            'assignee_id',
            'receiver_user_id',
            'status',
            'priority',
            'requested_date',
            'due_date',
            'resolved_date',
            'hotfix_date',
            'noti_date',
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
            if ($this->hasColumn('products', 'unit')) {
                $selects[] = 'pr.unit as unit';
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
            if ($this->hasColumn('support_requests', 'receiver_user_id')) {
                if ($this->hasColumn('internal_users', 'full_name')) {
                    $selects[] = 'iu_receiver.full_name as receiver_name';
                }
                if ($this->hasColumn('internal_users', 'username')) {
                    $selects[] = 'iu_receiver.username as receiver_username';
                }
                if ($this->hasColumn('internal_users', 'user_code')) {
                    $selects[] = 'iu_receiver.user_code as receiver_code';
                }
            }
        }

        if ($this->hasColumn('support_requests', 'reference_request_id')) {
            if ($this->hasColumn('support_requests', 'request_code')) {
                $selects[] = 'sr_ref.request_code as reference_request_code';
            }
            if ($this->hasColumn('support_requests', 'summary')) {
                $selects[] = 'sr_ref.summary as reference_request_summary';
            }
            if ($this->hasColumn('support_requests', 'status')) {
                $selects[] = 'sr_ref.status as reference_request_status';
            }
        }

        if ($this->hasTable('customer_personnel') && $this->hasColumn('support_requests', 'reporter_contact_id')) {
            if ($this->hasColumn('customer_personnel', 'full_name')) {
                $selects[] = 'cp.full_name as reporter_contact_name';
            }
            if ($this->hasColumn('customer_personnel', 'phone')) {
                $selects[] = 'cp.phone as reporter_contact_phone';
            }
            if ($this->hasColumn('customer_personnel', 'email')) {
                $selects[] = 'cp.email as reporter_contact_email';
            }
        }

        return $selects;
    }

    private function buildProjectItemsQuery(Request $request)
    {
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

        return $query
            ->select($this->projectItemSelectColumns())
            ->orderByDesc('pi.id');
    }

    private function respondWithProjectItemsQuery(Request $request, $query): JsonResponse
    {
        if ($this->shouldPaginate($request)) {
            [$page, $perPage] = $this->resolvePaginationParams($request, 20, 200);
            if ($this->shouldUseSimplePagination($request)) {
                $paginator = $query->simplePaginate($perPage, ['*'], 'page', $page);
                $rows = collect($paginator->items())
                    ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                    ->values();

                return response()->json([
                    'data' => $rows,
                    'meta' => $this->buildSimplePaginationMeta($page, $perPage, (int) $rows->count(), $paginator->hasMorePages()),
                ]);
            }

            $paginator = $query->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items())
                ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => $this->buildPaginationMeta($page, $perPage, (int) $paginator->total()),
            ]);
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeProjectItemRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
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

    private function assignGeneratedSupportRequestCode(int $requestId): ?string
    {
        if (
            $requestId <= 0
            || ! $this->hasTable('support_requests')
            || ! $this->hasColumn('support_requests', 'request_code')
        ) {
            return null;
        }

        $generatedCode = $this->buildSupportRequestCode($requestId, now());
        if ($generatedCode === '') {
            return null;
        }

        $updates = $this->filterPayloadByTableColumns('support_requests', [
            'request_code' => $generatedCode,
        ]);
        if ($updates === []) {
            return null;
        }

        if ($this->hasColumn('support_requests', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::table('support_requests')
            ->where('id', $requestId)
            ->update($updates);

        return $generatedCode;
    }

    private function buildSupportRequestCode(int $id, CarbonInterface $time): string
    {
        if ($id <= 0) {
            return '';
        }

        return sprintf(
            '%s%s%s%d',
            self::SUPPORT_REQUEST_CODE_PREFIX,
            $time->format('m'),
            $time->format('d'),
            $id
        );
    }

    /**
     * @return array{flow_step:string, form_key:string}
     */
    private function resolveWorkflowByStatus(string $status, ?string $subStatus, ?string $priority): array
    {
        $resolvedFlow = $this->workflowFlowResolver()->resolve($status, $subStatus);
        $this->statusDrivenSlaResolver()->resolve(
            $status,
            $subStatus,
            $this->normalizeSupportRequestPriority((string) ($priority ?? 'MEDIUM')),
            null
        );

        return $resolvedFlow;
    }

    private function workflowFlowResolver(): WorkflowFlowResolver
    {
        return app(WorkflowFlowResolver::class);
    }

    private function customerRequestWorkflowService(): CustomerRequestWorkflowService
    {
        return app(CustomerRequestWorkflowService::class);
    }

    private function statusDrivenSlaResolver(): StatusDrivenSlaResolver
    {
        return app(StatusDrivenSlaResolver::class);
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

        $serialized = $this->serializeSupportRequestRecord((array) $record);
        $rows = $this->attachSupportTasksToSerializedRequests([$serialized]);
        return $rows[0] ?? $serialized;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function attachSupportTasksToSerializedRequests(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $requestIds = collect($rows)
            ->map(fn (array $row): int => (int) ($row['id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $referenceRequestIds = collect($rows)
            ->map(fn (array $row): int => (int) ($row['reference_request_id'] ?? 0))
            ->filter(fn (int $id): bool => $id > 0)
            ->values()
            ->all();

        $taskGroups = $this->loadSupportRequestTaskGroupsByRequestIds($requestIds);
        $referenceTaskCodeMap = $this->loadSupportRequestPrimaryTaskCodeMap($referenceRequestIds);
        $statusTransferDevMap = [];
        foreach ($this->supportRequestStatusDefinitions(true) as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }
            $statusTransferDevMap[$statusCode] = (bool) ($definition['is_transfer_dev'] ?? ($statusCode === 'TRANSFER_DEV'));
        }
        $transferProgrammingRequestMap = $this->loadSupportRequestProgrammingTransferMap($requestIds);

        return array_values(array_map(function (array $row) use ($taskGroups, $referenceTaskCodeMap, $statusTransferDevMap, $transferProgrammingRequestMap): array {
            $requestId = (int) ($row['id'] ?? 0);
            $referenceRequestId = $this->parseNullableInt($row['reference_request_id'] ?? null);
            $tasks = $taskGroups[$requestId] ?? [];
            $requestCode = $this->normalizeNullableString($row['request_code'] ?? null);
            $ticketCode = $this->normalizeNullableString($row['ticket_code'] ?? null);
            $referenceRequestCode = $this->normalizeNullableString($row['reference_request_code'] ?? null);
            $referenceTicketCode = $this->normalizeNullableString($row['reference_ticket_code'] ?? null);

            $row['tasks'] = $tasks;
            $row['task_count'] = count($tasks);

            if ($tasks !== []) {
                $taskProjection = $this->resolveSupportRequestLegacyTaskProjection($tasks);
                if ($ticketCode === null) {
                    $ticketCode = $taskProjection['ticket_code'];
                }
                $row['task_link'] = $taskProjection['task_link'];
            }

            if ($referenceRequestId !== null && isset($referenceTaskCodeMap[$referenceRequestId])) {
                $referenceTicketCode = $referenceTaskCodeMap[$referenceRequestId];
            }

            $row['request_code'] = $requestCode;
            $row['ticket_code'] = $ticketCode;
            $row['reference_request_code'] = $referenceRequestCode;
            $row['reference_ticket_code'] = $referenceTicketCode;

            $statusCode = $this->normalizeSupportRequestStatus((string) ($row['status'] ?? 'NEW'));
            $transferProgrammingRequestId = $transferProgrammingRequestMap[$requestId] ?? null;
            $hasRequiredScope =
                $this->parseNullableInt($row['customer_id'] ?? null) !== null
                && $this->parseNullableInt($row['project_id'] ?? null) !== null
                && $this->parseNullableInt($row['product_id'] ?? null) !== null
                && $this->parseNullableInt($row['project_item_id'] ?? null) !== null;

            $row['transfer_programming_request_id'] = $transferProgrammingRequestId;
            $row['is_transferred_dev'] = $transferProgrammingRequestId !== null;
            $row['can_transfer_dev'] = ($statusTransferDevMap[$statusCode] ?? false)
                && ! $row['is_transferred_dev']
                && $hasRequiredScope;

            return $row;
        }, $rows));
    }

    /**
     * @param array<int, int> $requestIds
     * @return array<int, string>
     */
    private function loadSupportRequestPrimaryTaskCodeMap(array $requestIds): array
    {
        if (
            $requestIds === []
            || ! $this->hasTable('support_request_tasks')
            || ! $this->hasColumn('support_request_tasks', 'request_id')
            || ! $this->hasColumn('support_request_tasks', 'task_code')
        ) {
            return [];
        }

        $query = DB::table('support_request_tasks')
            ->whereIn('request_id', $requestIds)
            ->whereNotNull('task_code')
            ->where('task_code', '<>', '');

        if ($this->hasColumn('support_request_tasks', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->hasColumn('support_request_tasks', 'request_id')) {
            $query->orderBy('request_id');
        }
        if ($this->hasColumn('support_request_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->hasColumn('support_request_tasks', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->select($this->selectColumns('support_request_tasks', ['request_id', 'task_code']))
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $record = (array) $row;
            $requestId = $this->parseNullableInt($record['request_id'] ?? null);
            $taskCode = $this->normalizeNullableString($record['task_code'] ?? null);
            if ($requestId === null || $taskCode === null || isset($map[$requestId])) {
                continue;
            }

            $map[$requestId] = $taskCode;
        }

        return $map;
    }

    /**
     * @param array<int, string> $requestCodes
     * @return array<string, string>
     */
    private function loadCustomerRequestPrimaryReferenceTaskCodeMap(array $requestCodes): array
    {
        $requestCodes = array_values(array_unique(array_filter(array_map(
            fn ($value): ?string => $this->normalizeNullableString((string) $value),
            $requestCodes
        ))));

        if (
            $requestCodes === []
            || ! $this->hasTable('request_ref_tasks')
            || ! $this->hasColumn('request_ref_tasks', 'request_code')
            || ! $this->hasColumn('request_ref_tasks', 'task_code')
        ) {
            return [];
        }

        $query = DB::table('request_ref_tasks')
            ->whereIn('request_code', $requestCodes)
            ->whereNotNull('task_code')
            ->where('task_code', '<>', '');

        if ($this->hasColumn('request_ref_tasks', 'task_source')) {
            $query->where('task_source', 'REFERENCE');
        }
        if ($this->hasColumn('request_ref_tasks', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->hasColumn('request_ref_tasks', 'request_code')) {
            $query->orderBy('request_code');
        }
        if ($this->hasColumn('request_ref_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->hasColumn('request_ref_tasks', 'id')) {
            $query->orderBy('id');
        }

        $rows = $query
            ->select($this->selectColumns('request_ref_tasks', ['request_code', 'task_code']))
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $record = (array) $row;
            $requestCode = $this->normalizeNullableString($record['request_code'] ?? null);
            $taskCode = $this->normalizeNullableString($record['task_code'] ?? null);
            if ($requestCode === null || $taskCode === null || isset($map[$requestCode])) {
                continue;
            }

            $map[$requestCode] = $taskCode;
        }

        return $map;
    }

    /**
     * @param array<int, int> $requestIds
     * @return array<int, int>
     */
    private function loadSupportRequestProgrammingTransferMap(array $requestIds): array
    {
        if (
            $requestIds === []
            || ! $this->hasTable('programming_requests')
            || ! $this->hasColumn('programming_requests', 'support_request_id')
        ) {
            return [];
        }

        $query = DB::table('programming_requests')
            ->whereIn('support_request_id', $requestIds)
            ->select($this->selectColumns('programming_requests', [
                'id',
                'support_request_id',
            ]));

        if ($this->hasColumn('programming_requests', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        if ($this->hasColumn('programming_requests', 'id')) {
            $query->orderBy('id');
        }

        $map = [];
        foreach ($query->get() as $row) {
            $record = (array) $row;
            $requestId = $this->parseNullableInt($record['support_request_id'] ?? null);
            $programmingRequestId = $this->parseNullableInt($record['id'] ?? null);
            if ($requestId === null || $programmingRequestId === null) {
                continue;
            }

            if (! isset($map[$requestId])) {
                $map[$requestId] = $programmingRequestId;
            }
        }

        return $map;
    }

    /**
     * @param array<int, int> $requestIds
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function loadSupportRequestTaskGroupsByRequestIds(array $requestIds): array
    {
        if (
            $requestIds === []
            || ! $this->hasTable('support_request_tasks')
            || ! $this->hasColumn('support_request_tasks', 'request_id')
        ) {
            return [];
        }

        $query = DB::table('support_request_tasks')
            ->whereIn('request_id', $requestIds)
            ->select($this->selectColumns('support_request_tasks', [
                'id',
                'request_id',
                'task_code',
                'task_link',
                'status',
                'sort_order',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]));

        if ($this->hasColumn('support_request_tasks', 'request_id')) {
            $query->orderBy('request_id');
        }
        if ($this->hasColumn('support_request_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->hasColumn('support_request_tasks', 'id')) {
            $query->orderBy('id');
        }

        $groups = [];
        foreach ($query->get() as $item) {
            $serialized = $this->serializeSupportRequestTaskRecord((array) $item);
            $requestId = $this->parseNullableInt($serialized['request_id'] ?? null);
            if ($requestId === null) {
                continue;
            }

            if (! isset($groups[$requestId])) {
                $groups[$requestId] = [];
            }
            $groups[$requestId][] = $serialized;
        }

        return $groups;
    }

    /**
     * @param mixed $tasksInput
     * @return array<int, array<string, mixed>>
     */
    private function normalizeSupportRequestTaskInputs(mixed $tasksInput): array
    {
        if (! is_array($tasksInput)) {
            return [];
        }

        $rows = [];
        foreach ($tasksInput as $index => $taskInput) {
            if (! is_array($taskInput)) {
                continue;
            }

            $taskCode = $this->normalizeNullableString($taskInput['task_code'] ?? null);
            $taskLink = $this->normalizeNullableString($taskInput['task_link'] ?? null);
            $status = $this->normalizeSupportRequestTaskStatus((string) ($taskInput['status'] ?? 'TODO'));

            $sortOrderInput = $taskInput['sort_order'] ?? null;
            $sortOrder = is_numeric($sortOrderInput) ? max(0, (int) $sortOrderInput) : (int) $index;

            if ($taskCode === null && $taskLink === null) {
                continue;
            }

            $rows[] = [
                'task_code' => $taskCode,
                'task_link' => $taskLink,
                'status' => $status,
                'sort_order' => $sortOrder,
            ];
        }

        usort($rows, function (array $left, array $right): int {
            return (int) ($left['sort_order'] ?? 0) <=> (int) ($right['sort_order'] ?? 0);
        });

        return array_values($rows);
    }

    /**
     * @param array<int, array<string, mixed>> $tasks
     * @return array{ticket_code:?string, task_link:?string}
     */
    private function resolveSupportRequestLegacyTaskProjection(array $tasks): array
    {
        if ($tasks === []) {
            return [
                'ticket_code' => null,
                'task_link' => null,
            ];
        }

        $firstTask = $tasks[0];
        return [
            'ticket_code' => $this->normalizeNullableString($firstTask['task_code'] ?? null),
            'task_link' => $this->normalizeNullableString($firstTask['task_link'] ?? null),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $tasks
     */
    private function replaceSupportRequestTasks(int $requestId, array $tasks, ?int $actorId): void
    {
        if (
            ! $this->hasTable('support_request_tasks')
            || ! $this->hasColumn('support_request_tasks', 'request_id')
            || $requestId <= 0
        ) {
            return;
        }

        DB::table('support_request_tasks')
            ->where('request_id', $requestId)
            ->delete();

        if ($tasks === []) {
            return;
        }

        $insertRows = [];
        foreach ($tasks as $index => $task) {
            $payload = $this->filterPayloadByTableColumns('support_request_tasks', [
                'request_id' => $requestId,
                'task_code' => $this->normalizeNullableString($task['task_code'] ?? null),
                'task_link' => $this->normalizeNullableString($task['task_link'] ?? null),
                'status' => $this->normalizeSupportRequestTaskStatus((string) ($task['status'] ?? 'TODO')),
                'sort_order' => is_numeric($task['sort_order'] ?? null) ? max(0, (int) $task['sort_order']) : (int) $index,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if ($this->hasColumn('support_request_tasks', 'created_at')) {
                $payload['created_at'] = now();
            }
            if ($this->hasColumn('support_request_tasks', 'updated_at')) {
                $payload['updated_at'] = now();
            }

            $insertRows[] = $payload;
        }

        if ($insertRows !== []) {
            DB::table('support_request_tasks')->insert($insertRows);
        }
    }

    private function loadSupportServiceGroupById(int $id): ?array
    {
        if (! $this->hasTable('support_service_groups')) {
            return null;
        }

        $query = DB::table('support_service_groups as ssg');
        $selects = [
            'ssg.id',
            'ssg.group_code',
            'ssg.group_name',
            'ssg.description',
            'ssg.is_active',
            'ssg.created_at',
            'ssg.created_by',
            'ssg.updated_at',
            'ssg.updated_by',
        ];

        if ($this->hasColumn('support_service_groups', 'workflow_status_catalog_id')) {
            $selects[] = 'ssg.workflow_status_catalog_id';
            if ($this->hasTable('workflow_status_catalogs')) {
                $query->leftJoin('workflow_status_catalogs as wsc_bind', 'ssg.workflow_status_catalog_id', '=', 'wsc_bind.id');
                if ($this->hasColumn('workflow_status_catalogs', 'status_code')) {
                    $selects[] = 'wsc_bind.status_code as workflow_status_code';
                }
                if ($this->hasColumn('workflow_status_catalogs', 'status_name')) {
                    $selects[] = 'wsc_bind.status_name as workflow_status_name';
                }
                if ($this->hasColumn('workflow_status_catalogs', 'form_key')) {
                    $selects[] = 'wsc_bind.form_key as workflow_status_form_key';
                }
            }
        }
        if ($this->hasColumn('support_service_groups', 'workflow_form_key')) {
            $selects[] = 'ssg.workflow_form_key';
        }

        if ($this->hasColumn('support_service_groups', 'customer_id')) {
            $selects[] = 'ssg.customer_id';
            if ($this->hasTable('customers')) {
                $query->leftJoin('customers as c', 'ssg.customer_id', '=', 'c.id');
                if ($this->hasColumn('customers', 'customer_code')) {
                    $selects[] = 'c.customer_code as customer_code';
                }
                if ($this->hasColumn('customers', 'customer_name')) {
                    $selects[] = 'c.customer_name as customer_name';
                }
            }
        }

        $record = $query
            ->select($selects)
            ->where('ssg.id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportServiceGroupRecord((array) $record);
    }

    private function loadSupportContactPositionById(int $id): ?array
    {
        if (! $this->hasTable('support_contact_positions')) {
            return null;
        }

        $record = DB::table('support_contact_positions')
            ->select($this->selectColumns('support_contact_positions', [
                'id',
                'position_code',
                'position_name',
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

        return $this->serializeSupportContactPositionRecord((array) $record);
    }

    private function loadSupportRequestStatusById(int $id): ?array
    {
        if (! $this->hasTable('support_request_statuses')) {
            return null;
        }

        $record = DB::table('support_request_statuses')
            ->select($this->selectColumns('support_request_statuses', [
                'id',
                'status_code',
                'status_name',
                'description',
                'requires_completion_dates',
                'is_terminal',
                'is_transfer_dev',
                'is_active',
                'sort_order',
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

        return $this->serializeSupportRequestStatusRecord((array) $record);
    }

    private function loadWorklogActivityTypeById(int $id): ?array
    {
        if (! $this->hasTable('worklog_activity_types')) {
            return null;
        }

        $record = DB::table('worklog_activity_types')
            ->select($this->selectColumns('worklog_activity_types', [
                'id',
                'code',
                'name',
                'description',
                'default_is_billable',
                'phase_hint',
                'sort_order',
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

        return $this->serializeWorklogActivityTypeRecord((array) $record);
    }

    private function loadSupportSlaConfigById(int $id): ?array
    {
        if (! $this->hasTable('sla_configs')) {
            return null;
        }

        $joinServiceGroup = $this->hasTable('support_service_groups')
            && $this->hasColumn('sla_configs', 'service_group_id')
            && $this->hasColumn('support_service_groups', 'id');

        $columns = collect([
            'id',
            'status',
            'to_status',
            'sub_status',
            'priority',
            'sla_hours',
            'resolution_hours',
            'request_type_prefix',
            'service_group_id',
            'workflow_action_code',
            'description',
            'is_active',
            'sort_order',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
        ])
            ->filter(fn (string $column): bool => $this->hasColumn('sla_configs', $column))
            ->map(fn (string $column): string => "sc.{$column} as {$column}")
            ->values()
            ->all();

        if ($joinServiceGroup && $this->hasColumn('support_service_groups', 'group_name')) {
            $columns[] = 'ssg.group_name as service_group_name';
        }

        $record = DB::table('sla_configs as sc')
            ->when(
                $joinServiceGroup,
                fn ($query) => $query->leftJoin('support_service_groups as ssg', 'sc.service_group_id', '=', 'ssg.id')
            )
            ->select($columns)
            ->where('sc.id', $id)
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeSupportSlaConfigRecord((array) $record);
    }

    private function loadOpportunityStageById(int $id): ?array
    {
        if (! $this->hasTable('opportunity_stages')) {
            return null;
        }

        $record = DB::table('opportunity_stages')
            ->select($this->selectColumns('opportunity_stages', [
                'id',
                'stage_code',
                'stage_name',
                'description',
                'is_terminal',
                'is_active',
                'sort_order',
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

        return $this->serializeOpportunityStageRecord((array) $record);
    }

    private function loadCustomerPersonnelById(int $id): ?array
    {
        if (! $this->hasTable('customer_personnel')) {
            return null;
        }

        $query = DB::table('customer_personnel');
        $joinSupportContactPositions =
            $this->hasTable('support_contact_positions')
            && $this->hasColumn('customer_personnel', 'position_id')
            && $this->hasColumn('support_contact_positions', 'id');
        if ($joinSupportContactPositions) {
            $query->leftJoin('support_contact_positions as scp', 'customer_personnel.position_id', '=', 'scp.id');
        }

        $columns = [];
        foreach (['id', 'customer_id', 'full_name', 'date_of_birth', 'position_id', 'position_type', 'phone', 'email', 'status', 'created_at'] as $column) {
            if (! $this->hasColumn('customer_personnel', $column)) {
                continue;
            }
            $columns[] = $joinSupportContactPositions
                ? "customer_personnel.{$column} as {$column}"
                : $column;
        }
        if ($joinSupportContactPositions) {
            if ($this->hasColumn('support_contact_positions', 'position_code')) {
                $columns[] = 'scp.position_code as position_code';
            }
            if ($this->hasColumn('support_contact_positions', 'position_name')) {
                $columns[] = 'scp.position_name as position_name';
            }
        }

        $record = $query
            ->select($columns)
            ->where('customer_personnel.id', $id)
            ->when($this->hasColumn('customer_personnel', 'deleted_at'), fn ($builder) => $builder->whereNull('customer_personnel.deleted_at'))
            ->first();

        if ($record === null) {
            return null;
        }

        return $this->serializeCustomerPersonnelRecord((array) $record);
    }

    private function sanitizeSupportRequestStatusCode(string $statusCode): string
    {
        $trimmed = trim($statusCode);
        if ($trimmed === '') {
            return '';
        }

        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($trimmed, 'UTF-8')
            : strtoupper($trimmed);
        $normalized = preg_replace('/[^A-Z0-9_]+/', '_', $upper);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function sanitizeSupportServiceGroupCode(string $groupCode): string
    {
        $trimmed = trim($groupCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function sanitizeSupportContactPositionCode(string $positionCode): string
    {
        $trimmed = trim($positionCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function normalizeWorklogPhaseHint(mixed $phaseHint): ?string
    {
        $token = $this->sanitizeSupportRequestStatusCode((string) ($phaseHint ?? ''));
        if ($token === '') {
            return null;
        }

        return in_array($token, ['SUPPORT_HANDLE', 'ANALYZE', 'CODE', 'UPCODE'], true) ? $token : null;
    }

    private function worklogActivityTypeCodeExists(string $code, ?int $ignoreId = null): bool
    {
        if (
            $code === ''
            || ! $this->hasTable('worklog_activity_types')
            || ! $this->hasColumn('worklog_activity_types', 'code')
        ) {
            return false;
        }

        $query = DB::table('worklog_activity_types')
            ->whereRaw('UPPER(TRIM(code)) = ?', [$code]);

        if ($ignoreId !== null && $this->hasColumn('worklog_activity_types', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function worklogActivityTypeNameExists(string $name, ?int $ignoreId = null): bool
    {
        if (
            trim($name) === ''
            || ! $this->hasTable('worklog_activity_types')
            || ! $this->hasColumn('worklog_activity_types', 'name')
        ) {
            return false;
        }

        $query = DB::table('worklog_activity_types')
            ->whereRaw('UPPER(TRIM(name)) = UPPER(TRIM(?))', [$name]);

        if ($ignoreId !== null && $this->hasColumn('worklog_activity_types', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function normalizeNullableSupportRequestStatusCode(mixed $value): ?string
    {
        $token = $this->sanitizeSupportRequestStatusCode((string) ($value ?? ''));
        return $token === '' ? null : $token;
    }

    private function sanitizeWorkflowActionCode(string $actionCode): string
    {
        $trimmed = trim($actionCode);
        if ($trimmed === '') {
            return '';
        }

        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($trimmed, 'UTF-8')
            : strtoupper($trimmed);
        $normalized = preg_replace('/[^A-Z0-9_]+/', '_', $upper);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 80);
    }

    private function normalizeNullableWorkflowActionCode(mixed $value): ?string
    {
        $token = $this->sanitizeWorkflowActionCode((string) ($value ?? ''));
        return $token === '' ? null : $token;
    }

    private function supportSlaConfigExists(
        string $status,
        ?string $subStatus,
        string $priority,
        ?string $requestTypePrefix,
        ?int $serviceGroupId = null,
        ?string $workflowActionCode = null,
        ?int $ignoreId = null
    ): bool {
        if (! $this->hasTable('sla_configs') || ! $this->hasColumn('sla_configs', 'priority')) {
            return false;
        }

        $statusColumn = null;
        if ($this->hasColumn('sla_configs', 'status')) {
            $statusColumn = 'status';
        } elseif ($this->hasColumn('sla_configs', 'to_status')) {
            $statusColumn = 'to_status';
        }

        if ($statusColumn === null) {
            return false;
        }

        $query = DB::table('sla_configs')
            ->whereRaw(sprintf('UPPER(TRIM(%s)) = ?', $statusColumn), [$status])
            ->whereRaw('UPPER(TRIM(priority)) = ?', [$priority]);

        if ($this->hasColumn('sla_configs', 'sub_status')) {
            if ($subStatus === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('sub_status')
                        ->orWhereRaw('TRIM(sub_status) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(sub_status)) = ?', [$subStatus]);
            }
        }

        if ($this->hasColumn('sla_configs', 'request_type_prefix')) {
            if ($requestTypePrefix === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('request_type_prefix')
                        ->orWhereRaw('TRIM(request_type_prefix) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(request_type_prefix)) = ?', [$requestTypePrefix]);
            }
        }

        if ($this->hasColumn('sla_configs', 'service_group_id')) {
            if ($serviceGroupId === null) {
                $query->whereNull('service_group_id');
            } else {
                $query->where('service_group_id', $serviceGroupId);
            }
        }

        if ($this->hasColumn('sla_configs', 'workflow_action_code')) {
            if ($workflowActionCode === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('workflow_action_code')
                        ->orWhereRaw('TRIM(workflow_action_code) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(workflow_action_code)) = ?', [$workflowActionCode]);
            }
        }

        if ($ignoreId !== null && $this->hasColumn('sla_configs', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportContactPositionCodeExists(string $positionCode, ?int $ignoreId = null): bool
    {
        if (
            $positionCode === ''
            || ! $this->hasTable('support_contact_positions')
            || ! $this->hasColumn('support_contact_positions', 'position_code')
        ) {
            return false;
        }

        $query = DB::table('support_contact_positions')
            ->whereRaw('UPPER(TRIM(position_code)) = ?', [$positionCode]);

        if ($ignoreId !== null && $this->hasColumn('support_contact_positions', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportContactPositionNameExists(string $positionName, ?int $ignoreId = null): bool
    {
        if (
            trim($positionName) === ''
            || ! $this->hasTable('support_contact_positions')
            || ! $this->hasColumn('support_contact_positions', 'position_name')
        ) {
            return false;
        }

        $query = DB::table('support_contact_positions')
            ->whereRaw('LOWER(TRIM(position_name)) = ?', [function_exists('mb_strtolower') ? mb_strtolower(trim($positionName), 'UTF-8') : strtolower(trim($positionName))]);

        if ($ignoreId !== null && $this->hasColumn('support_contact_positions', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportServiceGroupCodeExists(string $groupCode, ?int $ignoreId = null, ?int $customerId = null): bool
    {
        if (
            $groupCode === ''
            || ! $this->hasTable('support_service_groups')
            || ! $this->hasColumn('support_service_groups', 'group_code')
        ) {
            return false;
        }

        $query = DB::table('support_service_groups')
            ->whereRaw('UPPER(TRIM(group_code)) = ?', [$groupCode]);

        if ($customerId !== null && $this->hasColumn('support_service_groups', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($ignoreId !== null && $this->hasColumn('support_service_groups', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function supportServiceGroupNameExists(string $groupName, ?int $ignoreId = null, ?int $customerId = null): bool
    {
        $normalizedName = trim($groupName);
        if (
            $normalizedName === ''
            || ! $this->hasTable('support_service_groups')
            || ! $this->hasColumn('support_service_groups', 'group_name')
        ) {
            return false;
        }

        $query = DB::table('support_service_groups')
            ->where('group_name', $normalizedName);

        if ($customerId !== null && $this->hasColumn('support_service_groups', 'customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($ignoreId !== null && $this->hasColumn('support_service_groups', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function resolveUniqueSupportServiceGroupCode(string $baseCode, ?int $ignoreId = null, ?int $customerId = null): string
    {
        $seed = $this->sanitizeSupportServiceGroupCode($baseCode);
        if ($seed === '') {
            $seed = 'GROUP';
        }

        $candidate = $seed;
        $counter = 1;
        while ($this->supportServiceGroupCodeExists($candidate, $ignoreId, $customerId)) {
            $counter++;
            $suffix = '_'.$counter;
            $prefixLength = 50 - strlen($suffix);
            $prefix = substr($seed, 0, max(1, $prefixLength));
            $candidate = $prefix.$suffix;
        }

        return $candidate;
    }

    private function generateSupportServiceGroupCode(string $groupName, ?int $ignoreId = null, ?int $customerId = null): string
    {
        $seed = $this->sanitizeSupportServiceGroupCode($groupName);
        if ($seed === '') {
            $seed = 'GROUP';
        }

        return $this->resolveUniqueSupportServiceGroupCode($seed, $ignoreId, $customerId);
    }

    private function sanitizeOpportunityStageCode(string $stageCode): string
    {
        $trimmed = trim($stageCode);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);
        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 50);
    }

    private function normalizeOpportunityStageLookupToken(string $value): string
    {
        $ascii = Str::upper(Str::ascii(trim($value)));
        $token = preg_replace('/[^A-Z0-9]+/', '', $ascii);
        return (string) $token;
    }

    private function mapLegacyOpportunityStageCode(string $stageCode): string
    {
        $normalized = $this->sanitizeOpportunityStageCode($stageCode);
        if ($normalized === '') {
            return '';
        }

        return self::LEGACY_OPPORTUNITY_STAGE_MAP[$normalized] ?? $normalized;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function opportunityStageDefinitions(bool $includeInactive = false): array
    {
        if (
            $this->hasTable('opportunity_stages')
            && $this->hasColumn('opportunity_stages', 'stage_code')
            && $this->hasColumn('opportunity_stages', 'stage_name')
        ) {
            $query = DB::table('opportunity_stages')
                ->select($this->selectColumns('opportunity_stages', [
                    'id',
                    'stage_code',
                    'stage_name',
                    'description',
                    'is_terminal',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->hasColumn('opportunity_stages', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->hasColumn('opportunity_stages', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->hasColumn('opportunity_stages', 'stage_name')) {
                $query->orderBy('stage_name');
            } elseif ($this->hasColumn('opportunity_stages', 'stage_code')) {
                $query->orderBy('stage_code');
            }
            if ($this->hasColumn('opportunity_stages', 'id')) {
                $query->orderBy('id');
            }

            $rows = $query->get()->map(function (object $item): array {
                $record = $this->serializeOpportunityStageRecord((array) $item);
                $record['stage_code'] = $this->mapLegacyOpportunityStageCode((string) ($record['stage_code'] ?? ''));
                return $record;
            })->filter(fn (array $record): bool => ((string) ($record['stage_code'] ?? '')) !== '')
                ->values()
                ->all();

            if ($rows !== []) {
                return $rows;
            }
        }

        $definitions = array_map(function (array $definition): array {
            return $this->serializeOpportunityStageRecord($definition);
        }, self::DEFAULT_OPPORTUNITY_STAGE_DEFINITIONS);

        if (! $includeInactive) {
            $definitions = array_values(array_filter(
                $definitions,
                fn (array $definition): bool => (bool) ($definition['is_active'] ?? true)
            ));
        }

        return $definitions;
    }

    /**
     * @return array<string, string>
     */
    private function opportunityStageLookup(bool $includeInactive = false): array
    {
        $lookup = [];
        foreach ($this->opportunityStageDefinitions($includeInactive) as $definition) {
            $stageCode = $this->mapLegacyOpportunityStageCode((string) ($definition['stage_code'] ?? ''));
            if ($stageCode === '') {
                continue;
            }

            $lookup[$stageCode] = $stageCode;

            $codeToken = $this->normalizeOpportunityStageLookupToken($stageCode);
            if ($codeToken !== '') {
                $lookup[$codeToken] = $stageCode;
            }

            $nameToken = $this->normalizeOpportunityStageLookupToken((string) ($definition['stage_name'] ?? ''));
            if ($nameToken !== '') {
                $lookup[$nameToken] = $stageCode;
            }
        }

        return $lookup;
    }

    private function normalizeOpportunityStage(string $stage, bool $includeInactive = false): ?string
    {
        $lookup = $this->opportunityStageLookup($includeInactive);
        if ($lookup === []) {
            return null;
        }

        $normalized = $this->mapLegacyOpportunityStageCode($stage);
        if ($normalized !== '' && isset($lookup[$normalized])) {
            return $lookup[$normalized];
        }

        $token = $this->normalizeOpportunityStageLookupToken($stage);
        if ($token !== '' && isset($lookup[$token])) {
            return $lookup[$token];
        }

        return null;
    }

    /**
     * @return array<string, int>
     */
    private function opportunityStageUsageSummaryByCode(): array
    {
        $usageByCode = [];

        if (! $this->hasTable('opportunities') || ! $this->hasColumn('opportunities', 'stage')) {
            return $usageByCode;
        }

        $query = DB::table('opportunities')
            ->selectRaw('UPPER(TRIM(stage)) as stage_code, COUNT(*) as total')
            ->whereNotNull('stage')
            ->whereRaw('TRIM(stage) <> ?', [''])
            ->groupBy('stage_code');

        if ($this->hasColumn('opportunities', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rows = $query->get();
        foreach ($rows as $row) {
            $stageCode = $this->mapLegacyOpportunityStageCode((string) ($row->stage_code ?? ''));
            if ($stageCode === '') {
                continue;
            }

            if (! isset($usageByCode[$stageCode])) {
                $usageByCode[$stageCode] = 0;
            }
            $usageByCode[$stageCode] += (int) ($row->total ?? 0);
        }

        return $usageByCode;
    }

    /**
     * @param array<string, int> $usageByCode
     * @return array<string, mixed>
     */
    private function appendOpportunityStageUsageMetadata(array $record, array $usageByCode): array
    {
        $stageCode = $this->mapLegacyOpportunityStageCode((string) ($record['stage_code'] ?? ''));
        $usedInOpportunities = (int) ($usageByCode[$stageCode] ?? 0);

        $record['used_in_opportunities'] = $usedInOpportunities;
        $record['is_code_editable'] = $usedInOpportunities === 0;

        return $record;
    }

    private function serializeOpportunityStageRecord(array $record): array
    {
        $stageCode = $this->mapLegacyOpportunityStageCode((string) ($record['stage_code'] ?? ''));
        $stageName = trim((string) ($record['stage_name'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'stage_code' => $stageCode !== '' ? $stageCode : 'NEW',
            'stage_name' => $stageName !== '' ? $stageName : ($stageCode !== '' ? $stageCode : 'NEW'),
            'description' => $record['description'] ?? null,
            'is_terminal' => (bool) ($record['is_terminal'] ?? in_array($stageCode, ['WON', 'LOST'], true)),
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'used_in_opportunities' => isset($record['used_in_opportunities']) ? (int) $record['used_in_opportunities'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function worklogActivityTypeUsageSummaryById(): array
    {
        $usageByActivityTypeId = [];

        if (! $this->hasTable('request_worklogs') || ! $this->hasColumn('request_worklogs', 'activity_type_id')) {
            return $usageByActivityTypeId;
        }

        $query = DB::table('request_worklogs')
            ->selectRaw('activity_type_id, COUNT(*) as total')
            ->whereNotNull('activity_type_id');

        if ($this->hasColumn('request_worklogs', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rows = $query->groupBy('activity_type_id')->get();
        foreach ($rows as $row) {
            $activityTypeId = $this->parseNullableInt($row->activity_type_id ?? null);
            if ($activityTypeId === null) {
                continue;
            }

            $usageByActivityTypeId[$activityTypeId] = (int) ($row->total ?? 0);
        }

        return $usageByActivityTypeId;
    }

    /**
     * @param array<int, int> $usageByActivityTypeId
     * @return array<string, mixed>
     */
    private function appendWorklogActivityTypeUsageMetadata(array $record, array $usageByActivityTypeId): array
    {
        $activityTypeId = $this->parseNullableInt($record['id'] ?? null);
        $usedInWorklogs = $activityTypeId !== null ? (int) ($usageByActivityTypeId[$activityTypeId] ?? 0) : 0;

        $record['used_in_worklogs'] = $usedInWorklogs;
        $record['is_code_editable'] = $usedInWorklogs === 0;

        return $record;
    }

    /**
     * @return array<int, int>
     */
    private function supportContactPositionUsageSummaryById(): array
    {
        $usageByPositionId = [];

        if (! $this->hasTable('customer_personnel') || ! $this->hasColumn('customer_personnel', 'position_id')) {
            return $usageByPositionId;
        }

        $query = DB::table('customer_personnel')
            ->selectRaw('position_id, COUNT(*) as total')
            ->whereNotNull('position_id');

        if ($this->hasColumn('customer_personnel', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rows = $query->groupBy('position_id')->get();
        foreach ($rows as $row) {
            $positionId = $this->parseNullableInt($row->position_id ?? null);
            if ($positionId === null) {
                continue;
            }

            $usageByPositionId[$positionId] = (int) ($row->total ?? 0);
        }

        return $usageByPositionId;
    }

    /**
     * @param array<int, int> $usageByPositionId
     * @return array<string, mixed>
     */
    private function appendSupportContactPositionUsageMetadata(array $record, array $usageByPositionId): array
    {
        $positionId = $this->parseNullableInt($record['id'] ?? null);
        $usedInCustomerPersonnel = $positionId !== null ? (int) ($usageByPositionId[$positionId] ?? 0) : 0;

        $record['used_in_customer_personnel'] = $usedInCustomerPersonnel;
        $record['is_code_editable'] = $usedInCustomerPersonnel === 0;

        return $record;
    }

    /**
     * @return array<int, array{used_in_customer_requests:int}>
     */
    private function supportServiceGroupUsageSummaryById(): array
    {
        $usageByGroupId = [];

        if ($this->hasTable('customer_requests') && $this->hasColumn('customer_requests', 'service_group_id')) {
            $supportQuery = DB::table('customer_requests')
                ->selectRaw('service_group_id, COUNT(*) as total')
                ->whereNotNull('service_group_id');

            if ($this->hasColumn('customer_requests', 'deleted_at')) {
                $supportQuery->whereNull('deleted_at');
            }

            $supportRows = $supportQuery
                ->groupBy('service_group_id')
                ->get();

            foreach ($supportRows as $row) {
                $groupId = $this->parseNullableInt($row->service_group_id ?? null);
                if ($groupId === null) {
                    continue;
                }

                if (! isset($usageByGroupId[$groupId])) {
                    $usageByGroupId[$groupId] = [
                        'used_in_customer_requests' => 0,
                    ];
                }
                $usageByGroupId[$groupId]['used_in_customer_requests'] += (int) ($row->total ?? 0);
            }
        }

        return $usageByGroupId;
    }

    /**
     * @param array<int, array{used_in_customer_requests:int}> $usageByGroupId
     * @return array<string, mixed>
     */
    private function appendSupportServiceGroupUsageMetadata(array $record, array $usageByGroupId): array
    {
        $groupId = $this->parseNullableInt($record['id'] ?? null);
        $usage = $groupId !== null
            ? ($usageByGroupId[$groupId] ?? ['used_in_customer_requests' => 0])
            : ['used_in_customer_requests' => 0];

        $record['used_in_customer_requests'] = (int) ($usage['used_in_customer_requests'] ?? 0);

        return $record;
    }

    /**
     * @return array<string, array{used_in_requests:int,used_in_history:int}>
     */
    private function supportRequestStatusUsageSummaryByCode(): array
    {
        $usageByCode = [];

        if ($this->hasTable('support_requests') && $this->hasColumn('support_requests', 'status')) {
            $requestRows = DB::table('support_requests')
                ->selectRaw('UPPER(TRIM(status)) as status_code, COUNT(*) as total')
                ->whereNotNull('status')
                ->whereRaw('TRIM(status) <> ?', [''])
                ->groupBy('status_code')
                ->get();

            foreach ($requestRows as $row) {
                $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                if ($statusCode === '') {
                    continue;
                }

                if (! isset($usageByCode[$statusCode])) {
                    $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                }
                $usageByCode[$statusCode]['used_in_requests'] += (int) ($row->total ?? 0);
            }
        }

        if ($this->hasTable('support_request_history')) {
            if ($this->hasColumn('support_request_history', 'new_status')) {
                $historyRows = DB::table('support_request_history')
                    ->selectRaw('UPPER(TRIM(new_status)) as status_code, COUNT(*) as total')
                    ->whereNotNull('new_status')
                    ->whereRaw('TRIM(new_status) <> ?', [''])
                    ->groupBy('status_code')
                    ->get();

                foreach ($historyRows as $row) {
                    $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                    if ($statusCode === '') {
                        continue;
                    }

                    if (! isset($usageByCode[$statusCode])) {
                        $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                    }
                    $usageByCode[$statusCode]['used_in_history'] += (int) ($row->total ?? 0);
                }
            }

            if ($this->hasColumn('support_request_history', 'old_status')) {
                $historyRows = DB::table('support_request_history')
                    ->selectRaw('UPPER(TRIM(old_status)) as status_code, COUNT(*) as total')
                    ->whereNotNull('old_status')
                    ->whereRaw('TRIM(old_status) <> ?', [''])
                    ->groupBy('status_code')
                    ->get();

                foreach ($historyRows as $row) {
                    $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($row->status_code ?? ''));
                    if ($statusCode === '') {
                        continue;
                    }

                    if (! isset($usageByCode[$statusCode])) {
                        $usageByCode[$statusCode] = ['used_in_requests' => 0, 'used_in_history' => 0];
                    }
                    $usageByCode[$statusCode]['used_in_history'] += (int) ($row->total ?? 0);
                }
            }
        }

        return $usageByCode;
    }

    /**
     * @param array<string, array{used_in_requests:int,used_in_history:int}> $usageByCode
     * @return array<string, mixed>
     */
    private function appendSupportRequestStatusUsageMetadata(array $record, array $usageByCode): array
    {
        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));
        $usage = $usageByCode[$statusCode] ?? ['used_in_requests' => 0, 'used_in_history' => 0];
        $usedInRequests = (int) ($usage['used_in_requests'] ?? 0);
        $usedInHistory = (int) ($usage['used_in_history'] ?? 0);

        $record['used_in_requests'] = $usedInRequests;
        $record['used_in_history'] = $usedInHistory;
        $record['is_code_editable'] = $usedInRequests === 0 && $usedInHistory === 0;

        return $record;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function supportRequestStatusDefinitions(bool $includeInactive = false): array
    {
        $definitionsByCode = [];
        foreach (self::DEFAULT_SUPPORT_REQUEST_STATUS_DEFINITIONS as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }

            $definitionsByCode[$statusCode] = [
                'id' => null,
                'status_code' => $statusCode,
                'status_name' => (string) ($definition['status_name'] ?? $statusCode),
                'description' => $this->normalizeNullableString($definition['description'] ?? null),
                'requires_completion_dates' => (bool) ($definition['requires_completion_dates'] ?? ($statusCode !== 'NEW')),
                'is_terminal' => (bool) ($definition['is_terminal'] ?? in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true)),
                'is_transfer_dev' => (bool) ($definition['is_transfer_dev'] ?? ($statusCode === 'TRANSFER_DEV')),
                'is_active' => (bool) ($definition['is_active'] ?? true),
                'sort_order' => (int) ($definition['sort_order'] ?? 0),
                'created_at' => null,
                'created_by' => null,
                'updated_at' => null,
                'updated_by' => null,
            ];
        }

        if (
            $this->hasTable('support_request_statuses')
            && $this->hasColumn('support_request_statuses', 'status_code')
            && $this->hasColumn('support_request_statuses', 'status_name')
        ) {
            $query = DB::table('support_request_statuses')
                ->select($this->selectColumns('support_request_statuses', [
                    'id',
                    'status_code',
                    'status_name',
                    'description',
                    'requires_completion_dates',
                    'is_terminal',
                    'is_transfer_dev',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->hasColumn('support_request_statuses', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->hasColumn('support_request_statuses', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->hasColumn('support_request_statuses', 'status_name')) {
                $query->orderBy('status_name');
            } elseif ($this->hasColumn('support_request_statuses', 'status_code')) {
                $query->orderBy('status_code');
            }
            if ($this->hasColumn('support_request_statuses', 'id')) {
                $query->orderBy('id');
            }

            foreach ($query->get() as $item) {
                $record = $this->serializeSupportRequestStatusRecord((array) $item);
                $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));
                if ($statusCode === '') {
                    continue;
                }

                $record['status_code'] = $statusCode;
                $definitionsByCode[$statusCode] = $record;
            }
        }

        $definitions = array_values($definitionsByCode);
        usort($definitions, function (array $left, array $right): int {
            $sortCompare = (int) ($left['sort_order'] ?? 0) <=> (int) ($right['sort_order'] ?? 0);
            if ($sortCompare !== 0) {
                return $sortCompare;
            }

            return strcmp(
                strtoupper((string) ($left['status_code'] ?? '')),
                strtoupper((string) ($right['status_code'] ?? ''))
            );
        });

        return array_values($definitions);
    }

    /**
     * @return array<string, string>
     */
    private function supportRequestStatusLookup(): array
    {
        $lookup = [];
        foreach ($this->supportRequestStatusDefinitions(true) as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }

            $lookup[$statusCode] = $statusCode;

            $codeToken = $this->normalizeSupportRequestStatusLookupToken($statusCode);
            if ($codeToken !== '') {
                $lookup[$codeToken] = $statusCode;
            }

            $nameToken = $this->normalizeSupportRequestStatusLookupToken((string) ($definition['status_name'] ?? ''));
            if ($nameToken !== '') {
                $lookup[$nameToken] = $statusCode;
            }
        }

        return $lookup;
    }

    private function normalizeSupportRequestStatusLookupToken(string $value): string
    {
        $ascii = Str::upper(Str::ascii(trim($value)));
        $token = preg_replace('/[^A-Z0-9]+/', '', $ascii);
        return (string) $token;
    }

    private function normalizeSupportRequestStatus(string $status): string
    {
        $normalized = $this->sanitizeSupportRequestStatusCode($status);
        if ($normalized !== '' && isset(self::LEGACY_SUPPORT_REQUEST_STATUS_MAP[$normalized])) {
            return self::LEGACY_SUPPORT_REQUEST_STATUS_MAP[$normalized];
        }

        $lookup = $this->supportRequestStatusLookup();
        if ($normalized !== '' && isset($lookup[$normalized])) {
            return $lookup[$normalized];
        }

        $token = $this->normalizeSupportRequestStatusLookupToken($status);
        if ($token !== '' && isset($lookup[$token])) {
            return $lookup[$token];
        }

        return isset($lookup['NEW']) ? 'NEW' : ($lookup !== [] ? reset($lookup) : 'NEW');
    }

    private function normalizeSupportRequestTaskStatusesInRequest(Request $request): void
    {
        $tasks = $request->input('tasks');
        if (! is_array($tasks)) {
            return;
        }

        $normalizedTasks = [];
        foreach ($tasks as $index => $task) {
            if (! is_array($task)) {
                $normalizedTasks[$index] = $task;
                continue;
            }

            if (array_key_exists('status', $task)) {
                $rawStatus = (string) ($task['status'] ?? '');
                $statusToken = function_exists('mb_strtoupper')
                    ? mb_strtoupper(trim($rawStatus), 'UTF-8')
                    : strtoupper(trim($rawStatus));

                if (
                    $statusToken === ''
                    || in_array($statusToken, self::SUPPORT_REQUEST_TASK_STATUSES, true)
                    || isset(self::SUPPORT_REQUEST_TASK_STATUS_ALIASES[$statusToken])
                ) {
                    $task['status'] = $this->normalizeSupportRequestTaskStatus($rawStatus);
                }
            }

            $normalizedTasks[$index] = $task;
        }

        $request->merge(['tasks' => $normalizedTasks]);
    }

    private function normalizeSupportRequestTaskStatus(string $status): string
    {
        $trimmed = trim($status);
        if ($trimmed === '') {
            return 'TODO';
        }

        $normalized = function_exists('mb_strtoupper')
            ? mb_strtoupper($trimmed, 'UTF-8')
            : strtoupper($trimmed);
        if (in_array($normalized, self::SUPPORT_REQUEST_TASK_STATUSES, true)) {
            return $normalized;
        }

        if (isset(self::SUPPORT_REQUEST_TASK_STATUS_ALIASES[$normalized])) {
            return self::SUPPORT_REQUEST_TASK_STATUS_ALIASES[$normalized];
        }

        return 'TODO';
    }

    private function supportRequestStatusValidationValues(bool $includeInactive = true): array
    {
        $values = array_keys(self::LEGACY_SUPPORT_REQUEST_STATUS_MAP);
        foreach ($this->supportRequestStatusDefinitions($includeInactive) as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode !== '') {
                $values[] = $statusCode;
            }

            $statusName = trim((string) ($definition['status_name'] ?? ''));
            if ($statusName !== '') {
                $values[] = $statusName;
            }
        }

        return array_values(array_unique($values));
    }

    private function supportRequestTaskStatusValidationValues(): array
    {
        return array_values(array_unique(array_merge(
            self::SUPPORT_REQUEST_TASK_STATUSES,
            array_keys(self::SUPPORT_REQUEST_TASK_STATUS_ALIASES)
        )));
    }

    private function supportRequestRequiresCompletionDates(string $status): bool
    {
        $normalizedStatus = $this->normalizeSupportRequestStatus($status);
        foreach ($this->supportRequestStatusDefinitions(true) as $definition) {
            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode !== $normalizedStatus) {
                continue;
            }

            return (bool) ($definition['requires_completion_dates'] ?? ($normalizedStatus !== 'NEW'));
        }

        return $normalizedStatus !== 'NEW';
    }

    /**
     * @return array<int, string>
     */
    private function supportRequestTerminalStatuses(): array
    {
        $rows = [];
        foreach ($this->supportRequestStatusDefinitions(true) as $definition) {
            if (! ((bool) ($definition['is_terminal'] ?? false))) {
                continue;
            }

            $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($definition['status_code'] ?? ''));
            if ($statusCode === '') {
                continue;
            }

            $rows[] = $statusCode;
        }

        if ($rows === []) {
            return ['COMPLETED', 'UNABLE_TO_EXECUTE'];
        }

        return array_values(array_unique($rows));
    }

    private function validateSupportRequestCompletionDates(string $status, mixed $dueDate, mixed $resolvedDate): ?JsonResponse
    {
        if (! $this->supportRequestRequiresCompletionDates($status)) {
            return null;
        }

        $dueDateValue = $this->normalizeNullableString($dueDate);
        $resolvedDateValue = $this->normalizeNullableString($resolvedDate);

        if ($dueDateValue === null) {
            return response()->json(['message' => 'Hạn hoàn thành là bắt buộc với trạng thái hiện tại.'], 422);
        }

        if ($resolvedDateValue === null) {
            return response()->json(['message' => 'Ngày hoàn thành TT là bắt buộc với trạng thái hiện tại.'], 422);
        }

        return null;
    }

    private function validateSupportRequestRequestedAndDueDates(mixed $requestedDate, mixed $dueDate): ?JsonResponse
    {
        $requestedDateValue = $this->normalizeNullableString($requestedDate);
        $dueDateValue = $this->normalizeNullableString($dueDate);

        if ($requestedDateValue === null || $dueDateValue === null) {
            return null;
        }

        $requestedTimestamp = strtotime($requestedDateValue);
        $dueTimestamp = strtotime($dueDateValue);
        if ($requestedTimestamp === false || $dueTimestamp === false) {
            return null;
        }

        if ($dueTimestamp < $requestedTimestamp) {
            return response()->json(['message' => 'Hạn hoàn thành phải lớn hơn hoặc bằng ngày nhận yêu cầu.'], 422);
        }

        return null;
    }

    private function resolveSupportRequestReference(
        ?int $referenceRequestId,
        ?string $referenceTicketCode,
        ?int $currentRequestId
    ): array|JsonResponse {
        if (! $this->hasTable('support_requests')) {
            return [
                'reference_request_id' => null,
                'reference_ticket_code' => null,
            ];
        }

        $normalizedCode = $this->normalizeNullableString($referenceTicketCode);
        $resolvedById = null;
        $resolvedByCode = null;

        if ($referenceRequestId !== null) {
            if ($currentRequestId !== null && $referenceRequestId === $currentRequestId) {
                return response()->json(['message' => 'Mã yêu cầu tham chiếu không được trùng với chính yêu cầu đang cập nhật.'], 422);
            }

            $resolvedById = $this->loadSupportRequestReferenceById($referenceRequestId);
            if ($resolvedById === null) {
                return response()->json(['message' => 'reference_request_id is invalid.'], 422);
            }
        }

        if ($normalizedCode !== null) {
            $resolvedByCode = $this->loadSupportRequestReferenceByTaskCode($normalizedCode, $currentRequestId);
            if ($resolvedByCode === null) {
                $resolvedByCode = $this->loadSupportRequestReferenceByRequestCode($normalizedCode, $currentRequestId);
            }
            if ($resolvedByCode === null) {
                return response()->json(['message' => 'reference_ticket_code is invalid.'], 422);
            }
        }

        if (
            $resolvedById !== null
            && $resolvedByCode !== null
            && (int) ($resolvedById['id'] ?? 0) !== (int) ($resolvedByCode['id'] ?? 0)
        ) {
            return response()->json([
                'message' => 'reference_request_id và reference_ticket_code đang tham chiếu đến hai yêu cầu khác nhau.',
            ], 422);
        }

        $resolvedReference = $resolvedById ?? $resolvedByCode;
        if ($resolvedReference === null) {
            return [
                'reference_request_id' => null,
                'reference_ticket_code' => null,
            ];
        }

        $resolvedReferenceId = (int) ($resolvedReference['id'] ?? 0);
        if ($resolvedReferenceId <= 0) {
            return response()->json(['message' => 'Không thể xác định bản ghi tham chiếu hợp lệ.'], 422);
        }

        if ($currentRequestId !== null && $resolvedReferenceId === $currentRequestId) {
            return response()->json(['message' => 'Mã yêu cầu tham chiếu không được trùng với chính yêu cầu đang cập nhật.'], 422);
        }

        $resolvedReferenceTicketCode = $this->normalizeNullableString(
            (string) ($resolvedReference['ticket_code'] ?? $normalizedCode ?? '')
        );

        return [
            'reference_request_id' => $resolvedReferenceId,
            'reference_ticket_code' => $resolvedReferenceTicketCode,
        ];
    }

    private function loadSupportRequestReferenceById(int $referenceRequestId): ?array
    {
        if (! $this->hasTable('support_requests') || $referenceRequestId <= 0) {
            return null;
        }

        $query = DB::table('support_requests')
            ->where('id', $referenceRequestId);

        if ($this->hasColumn('support_requests', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $record = $query
            ->select($this->selectColumns('support_requests', ['id', 'request_code']))
            ->first();

        if ($record === null) {
            return null;
        }

        $requestCode = $this->normalizeNullableString($record->request_code ?? null);
        $ticketCode = $this->resolveSupportRequestPrimaryTaskCode((int) ($record->id ?? 0));

        return [
            'id' => (int) ($record->id ?? 0),
            'ticket_code' => $ticketCode ?? $requestCode,
        ];
    }

    private function loadSupportRequestReferenceByRequestCode(string $referenceRequestCode, ?int $currentRequestId): ?array
    {
        if (
            ! $this->hasTable('support_requests')
            || ! $this->hasColumn('support_requests', 'request_code')
        ) {
            return null;
        }

        $normalizedCode = $this->normalizeNullableString($referenceRequestCode);
        if ($normalizedCode === null) {
            return null;
        }

        $query = DB::table('support_requests as sr')
            ->where('sr.request_code', $normalizedCode);

        if ($currentRequestId !== null) {
            $query->where('sr.id', '<>', $currentRequestId);
        }

        if ($this->hasColumn('support_requests', 'deleted_at')) {
            $query->whereNull('sr.deleted_at');
        }

        $record = $query
            ->select($this->selectColumns('support_requests', ['id', 'request_code']))
            ->first();

        if ($record === null) {
            return null;
        }

        $requestId = (int) ($record->id ?? 0);
        if ($requestId <= 0) {
            return null;
        }
        $requestCode = $this->normalizeNullableString($record->request_code ?? null);
        $ticketCode = $this->resolveSupportRequestPrimaryTaskCode($requestId);

        return [
            'id' => $requestId,
            'ticket_code' => $ticketCode ?? $requestCode,
        ];
    }

    private function loadSupportRequestReferenceByTaskCode(string $referenceTicketCode, ?int $currentRequestId): ?array
    {
        if (
            ! $this->hasTable('support_requests')
            || ! $this->hasTable('support_request_tasks')
            || ! $this->hasColumn('support_request_tasks', 'request_id')
            || ! $this->hasColumn('support_request_tasks', 'task_code')
        ) {
            return null;
        }

        $normalizedCode = $this->normalizeNullableString($referenceTicketCode);
        if ($normalizedCode === null) {
            return null;
        }

        $query = DB::table('support_request_tasks as srt')
            ->join('support_requests as sr', 'sr.id', '=', 'srt.request_id')
            ->where('srt.task_code', $normalizedCode);

        if ($currentRequestId !== null) {
            $query->where('sr.id', '<>', $currentRequestId);
        }

        if ($this->hasColumn('support_requests', 'deleted_at')) {
            $query->whereNull('sr.deleted_at');
        }

        if ($this->hasColumn('support_request_tasks', 'sort_order')) {
            $query->orderBy('srt.sort_order');
        }
        $query->orderBy('srt.id');

        $selects = ['sr.id as id', 'srt.task_code as task_code'];
        if ($this->hasColumn('support_requests', 'request_code')) {
            $selects[] = 'sr.request_code as request_code';
        }

        $record = $query
            ->select($selects)
            ->first();

        if ($record === null) {
            return null;
        }

        return [
            'id' => (int) ($record->id ?? 0),
            'ticket_code' => $this->normalizeNullableString($record->task_code ?? null),
        ];
    }

    private function resolveSupportRequestPrimaryTaskCode(int $requestId): ?string
    {
        if (
            $requestId <= 0
            || ! $this->hasTable('support_request_tasks')
            || ! $this->hasColumn('support_request_tasks', 'request_id')
            || ! $this->hasColumn('support_request_tasks', 'task_code')
        ) {
            return null;
        }

        $query = DB::table('support_request_tasks')
            ->where('request_id', $requestId)
            ->whereNotNull('task_code');

        if ($this->hasColumn('support_request_tasks', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        if ($this->hasColumn('support_request_tasks', 'id')) {
            $query->orderBy('id');
        }

        return $this->normalizeNullableString($query->value('task_code'));
    }

    private function normalizeOptionalDateInput(Request $request, string $key): void
    {
        if (! $request->exists($key)) {
            return;
        }

        $value = $request->input($key);
        if ($value === null) {
            return;
        }

        if (is_string($value) && trim($value) === '') {
            $request->merge([$key => null]);
        }
    }

    private function normalizeSupportRequestPriority(string $priority): string
    {
        $normalized = strtoupper(trim($priority));
        return in_array($normalized, self::SUPPORT_REQUEST_PRIORITIES, true) ? $normalized : 'MEDIUM';
    }

    /**
     * @return array{id:int,position_code:string,position_name:string}|null
     */
    private function resolveCustomerPersonnelPositionMaster(
        mixed $positionTypeInput,
        mixed $positionIdInput,
        bool $allowDefault = false
    ): ?array
    {
        if (! $this->hasTable('support_contact_positions')) {
            return null;
        }

        $canResolveById = $this->hasColumn('support_contact_positions', 'id');
        $canResolveByCode = $this->hasColumn('support_contact_positions', 'position_code');
        $canResolveByName = $this->hasColumn('support_contact_positions', 'position_name');
        if (! $canResolveById || (! $canResolveByCode && ! $canResolveByName)) {
            return null;
        }

        $positionId = $this->parseNullableInt($positionIdInput);
        $positionText = trim((string) ($positionTypeInput ?? ''));
        $positionCode = $this->sanitizeSupportContactPositionCode($positionText);

        $record = null;
        if ($positionId !== null) {
            $record = DB::table('support_contact_positions')
                ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->where('id', $positionId)
                ->first();
        }

        if ($record === null && $positionCode !== '' && $canResolveByCode) {
            $record = DB::table('support_contact_positions')
                ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->whereRaw('UPPER(TRIM(position_code)) = ?', [$positionCode])
                ->first();
        }

        if ($record === null && $positionText !== '' && $canResolveByName) {
            $record = DB::table('support_contact_positions')
                ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                ->whereRaw(
                    'LOWER(TRIM(position_name)) = ?',
                    [function_exists('mb_strtolower') ? mb_strtolower($positionText, 'UTF-8') : strtolower($positionText)]
                )
                ->first();
        }

        if ($record === null && $positionText !== '') {
            $matchToken = $this->normalizeSupportContactPositionMatchToken($positionText);
            if ($matchToken !== '') {
                $candidates = DB::table('support_contact_positions')
                    ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                    ->orderBy('id')
                    ->get();

                foreach ($candidates as $candidate) {
                    $candidateCode = (string) ($candidate->position_code ?? '');
                    $candidateName = (string) ($candidate->position_name ?? '');
                    if (
                        $this->normalizeSupportContactPositionMatchToken($candidateCode) === $matchToken
                        || $this->normalizeSupportContactPositionMatchToken($candidateName) === $matchToken
                    ) {
                        $record = $candidate;
                        break;
                    }
                }
            }
        }

        if ($record === null && $allowDefault) {
            if ($canResolveByCode) {
                $record = DB::table('support_contact_positions')
                    ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']))
                    ->whereRaw('UPPER(TRIM(position_code)) = ?', ['DAU_MOI'])
                    ->first();
            }

            if ($record === null) {
                $query = DB::table('support_contact_positions')
                    ->select($this->selectColumns('support_contact_positions', ['id', 'position_code', 'position_name']));

                if ($this->hasColumn('support_contact_positions', 'is_active')) {
                    $query->where('is_active', 1);
                }

                $record = $query->orderBy('id')->first();
            }
        }

        if ($record === null) {
            return null;
        }

        $resolvedId = $this->parseNullableInt($record->id ?? null);
        if ($resolvedId === null) {
            return null;
        }

        $resolvedCode = $this->sanitizeSupportContactPositionCode((string) ($record->position_code ?? ''));
        if ($resolvedCode === '') {
            return null;
        }

        $resolvedName = $this->normalizeNullableString($record->position_name ?? null) ?? $resolvedCode;

        return [
            'id' => $resolvedId,
            'position_code' => $resolvedCode,
            'position_name' => $resolvedName,
        ];
    }

    private function normalizeSupportContactPositionMatchToken(string $value): string
    {
        $normalized = Str::ascii(trim($value));
        if ($normalized === '') {
            return '';
        }

        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', $normalized));
    }

    private function normalizeCustomerPersonnelStorageStatus(string $status): string
    {
        $normalized = strtoupper(trim($status));
        if ($normalized === 'INACTIVE') {
            return 'INACTIVE';
        }

        return 'ACTIVE';
    }

    private function serializeCustomerPersonnelRecord(array $record): array
    {
        $status = $this->normalizeCustomerPersonnelStorageStatus((string) ($record['status'] ?? 'ACTIVE'));
        $positionId = $this->parseNullableInt($record['position_id'] ?? null);
        $positionType = $this->sanitizeSupportContactPositionCode((string) ($record['position_code'] ?? $record['position_type'] ?? ''));
        $positionLabel = $this->normalizeNullableString($record['position_name'] ?? null);

        if ($positionType === '' || $positionLabel === null) {
            $resolvedPosition = $this->resolveCustomerPersonnelPositionMaster(
                $positionType !== '' ? $positionType : ($record['position_type'] ?? null),
                $positionId,
                false
            );
            if ($resolvedPosition !== null) {
                $positionId = $resolvedPosition['id'];
                $positionType = $resolvedPosition['position_code'];
                $positionLabel = $resolvedPosition['position_name'];
            }
        }

        if ($positionType === '') {
            $positionType = $this->sanitizeSupportContactPositionCode((string) ($record['position_type'] ?? 'DAU_MOI'));
        }
        if ($positionType === '') {
            $positionType = 'DAU_MOI';
        }
        if ($positionLabel === null || $positionLabel === '') {
            $positionLabel = $positionType;
        }

        return [
            'id' => (string) ($record['id'] ?? ''),
            'fullName' => (string) ($record['full_name'] ?? ''),
            'birthday' => $this->formatDateColumn($record['date_of_birth'] ?? null),
            'positionType' => $positionType,
            'positionId' => $positionId !== null ? (string) $positionId : null,
            'positionLabel' => $positionLabel,
            'phoneNumber' => (string) ($record['phone'] ?? ''),
            'email' => (string) ($record['email'] ?? ''),
            'customerId' => (string) ($record['customer_id'] ?? ''),
            'status' => $status === 'INACTIVE' ? 'Inactive' : 'Active',
            'createdDate' => $this->formatDateColumn($record['created_at'] ?? null),
        ];
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);
        return $normalized !== '' ? $normalized : null;
    }

    private function normalizeWorkflowFieldToken(mixed $value): string
    {
        $normalized = Str::ascii(trim((string) ($value ?? '')));
        if ($normalized === '') {
            return '';
        }

        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', $normalized));
    }

    /**
     * @param array<string,mixed>|null $metadata
     * @return array<string,mixed>|null
     */
    private function normalizeCustomerRequestTransitionMetadata(mixed $metadata): ?array
    {
        if (! is_array($metadata)) {
            return null;
        }

        $staticAliasTokens = [
            'requestcode',
            'idyeucau',
            'mayeucau',
            'mayc',
            'fieldidyeucu',
            'summary',
            'noidung',
            'noidungyeucau',
            'fieldnidung',
            'customerid',
            'donvi',
            'fielddnv',
            'requestername',
            'reportercontactid',
            'nguoiyeucau',
            'fieldngiyeucu',
            'servicegroupid',
            'nhomhotro',
            'fieldnhomhtr',
            'receiveruserid',
            'nguoitiepnhan',
            'fieldngitipnhn',
            'assigneeid',
            'nguoixuly',
            'fieldngixly',
            'requesteddate',
            'ngaytiepnhan',
            'fieldngaytipnhan',
            'referenceticketcode',
            'mataskthamchieu',
            'fieldmataskthamchiu',
            'referencerequestid',
            'notes',
            'ghichu',
            'projectitemid',
            'projectid',
            'productid',
        ];
        $staticAliasTokenMap = array_flip($staticAliasTokens);

        $cleaned = [];
        foreach ($metadata as $key => $value) {
            $token = $this->normalizeWorkflowFieldToken($key);
            if ($token !== '' && isset($staticAliasTokenMap[$token])) {
                continue;
            }
            $cleaned[$key] = $value;
        }

        return $cleaned === [] ? null : $cleaned;
    }

    /**
     * @param array<string,mixed>|null $metadata
     * @return array{summary?:string,requester_name?:string,service_group_id?:string|int}
     */
    private function extractCustomerRequestCanonicalFieldsFromMetadata(?array $metadata): array
    {
        if (! is_array($metadata) || $metadata === []) {
            return [];
        }

        $summary = null;
        $requesterName = null;
        $serviceGroup = null;

        foreach ($metadata as $key => $value) {
            $token = $this->normalizeWorkflowFieldToken($key);
            if ($token === '') {
                continue;
            }
            if (! is_scalar($value) && $value !== null) {
                continue;
            }

            if ($summary === null && in_array($token, ['summary', 'noidung', 'noidungyeucau', 'fieldnidung'], true)) {
                $summary = $this->normalizeNullableString($value);
                continue;
            }

            if ($requesterName === null && in_array($token, ['requestername', 'reportername', 'nguoiyeucau', 'fieldngiyeucu'], true)) {
                $requesterName = $this->normalizeNullableString($value);
                continue;
            }

            if ($serviceGroup === null && in_array($token, ['servicegroupid', 'nhomhotro', 'fieldnhomhtr'], true)) {
                if (is_scalar($value)) {
                    $serviceGroup = trim((string) $value);
                }
            }
        }

        $result = [];
        if ($summary !== null) {
            $result['summary'] = $summary;
        }
        if ($requesterName !== null) {
            $result['requester_name'] = $requesterName;
        }
        if ($serviceGroup !== null && $serviceGroup !== '') {
            $result['service_group_id'] = $serviceGroup;
        }

        return $result;
    }

    /**
     * @param array<string,mixed>|null $metadata
     */
    private function validateCustomerRequestExchangeFeedbackDateConstraint(?array $metadata): ?string
    {
        if (! is_array($metadata) || $metadata === []) {
            return null;
        }

        $exchangeDateResult = $this->extractCustomerRequestMetadataDateByTokens(
            $metadata,
            $this->customerRequestExchangeDateTokenCandidates()
        );
        if ($exchangeDateResult['invalid']) {
            return 'Ngày trao đổi với khách hàng không đúng định dạng ngày.';
        }

        $feedbackDateResult = $this->extractCustomerRequestMetadataDateByTokens(
            $metadata,
            $this->customerRequestCustomerFeedbackDateTokenCandidates()
        );
        if ($feedbackDateResult['invalid']) {
            return 'Ngày khách hàng phản hồi không đúng định dạng ngày.';
        }

        $exchangeDate = $exchangeDateResult['value'];
        $feedbackDate = $feedbackDateResult['value'];
        if ($exchangeDate === null || $feedbackDate === null) {
            return null;
        }

        return $exchangeDate <= $feedbackDate
            ? null
            : 'Ngày trao đổi với khách hàng phải nhỏ hơn hoặc bằng Ngày khách hàng phản hồi.';
    }

    /**
     * @return array<int,string>
     */
    private function customerRequestExchangeDateTokenCandidates(): array
    {
        return [
            'exchangedate',
            'fieldngaytraodoilaivoikhachhang',
            'fieldngaytraodilivikhachhang',
            'ngaytraodoilaivoikhachhang',
            'ngaytraodilivikhachhang',
        ];
    }

    /**
     * @return array<int,string>
     */
    private function customerRequestExchangeContentTokenCandidates(): array
    {
        return [
            'exchangecontent',
            'fieldnoidungtraodoi',
            'fieldnidungtraodi',
            'noidungtraodoi',
        ];
    }

    /**
     * @return array<int,string>
     */
    private function customerRequestCustomerFeedbackDateTokenCandidates(): array
    {
        return [
            'customerfeedbackdate',
            'fieldngaykhachhangphanhoi',
            'fieldngaykhacahangphnhi',
            'ngaykhachhangphanhoi',
            'ngaykhacahangphnhi',
        ];
    }

    /**
     * @return array<int,string>
     */
    private function customerRequestCustomerFeedbackContentTokenCandidates(): array
    {
        return [
            'customerfeedbackcontent',
            'fieldnoidungkhachhangphanhoi',
            'fieldnidungkhachhangphnhi',
            'noidungkhachhangphanhoi',
            'nidungkhachhangphnhi',
        ];
    }

    /**
     * @param array<string,mixed>|null $metadata
     * @param array<int,string> $tokenCandidates
     */
    private function customerRequestMetadataHasAnyToken(?array $metadata, array $tokenCandidates): bool
    {
        if (! is_array($metadata) || $metadata === []) {
            return false;
        }

        $tokenMap = array_fill_keys($tokenCandidates, true);
        foreach ($metadata as $key => $_value) {
            $token = $this->normalizeWorkflowFieldToken($key);
            if ($token !== '' && isset($tokenMap[$token])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string,mixed> $metadata
     * @param array<int,string> $tokenCandidates
     * @return array{value:?string,invalid:bool}
     */
    private function extractCustomerRequestMetadataDateByTokens(array $metadata, array $tokenCandidates): array
    {
        $tokenMap = array_fill_keys($tokenCandidates, true);
        foreach ($metadata as $key => $value) {
            $token = $this->normalizeWorkflowFieldToken($key);
            if ($token === '' || ! isset($tokenMap[$token])) {
                continue;
            }

            $text = $this->normalizeNullableString($value);
            if ($text === null) {
                return ['value' => null, 'invalid' => false];
            }

            try {
                return ['value' => Carbon::parse($text)->format('Y-m-d'), 'invalid' => false];
            } catch (\Throwable) {
                return ['value' => null, 'invalid' => true];
            }
        }

        return ['value' => null, 'invalid' => false];
    }

    /**
     * @param array<string,mixed>|null $metadata
     * @param array<int,string> $tokenCandidates
     */
    private function extractCustomerRequestMetadataTextByTokens(?array $metadata, array $tokenCandidates): ?string
    {
        if (! is_array($metadata) || $metadata === []) {
            return null;
        }

        $tokenMap = array_fill_keys($tokenCandidates, true);
        foreach ($metadata as $key => $value) {
            $token = $this->normalizeWorkflowFieldToken($key);
            if ($token === '' || ! isset($tokenMap[$token])) {
                continue;
            }

            return $this->normalizeNullableString($value);
        }

        return null;
    }

    private function resolveSupportServiceGroupIdFromMixed(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! $this->hasTable('support_service_groups')) {
            return null;
        }

        $numericId = $this->parseNullableInt($value);
        if ($numericId !== null) {
            return $this->tableRowExists('support_service_groups', $numericId) ? $numericId : null;
        }

        $groupName = $this->normalizeNullableString($value);
        if ($groupName === null || ! $this->hasColumn('support_service_groups', 'group_name')) {
            return null;
        }

        $resolvedIds = DB::table('support_service_groups')
            ->where('group_name', $groupName)
            ->limit(2)
            ->pluck('id')
            ->filter(fn ($item): bool => $item !== null)
            ->values();

        if ($resolvedIds->count() !== 1) {
            return null;
        }

        return $this->parseNullableInt($resolvedIds->first());
    }

    /**
     * @return array{id:int,customer_id:int|null,group_name:string|null}|null
     */
    private function loadSupportServiceGroupValidationRecord(int $id): ?array
    {
        if (! $this->hasTable('support_service_groups')) {
            return null;
        }

        $query = DB::table('support_service_groups')
            ->where('id', $id)
            ->select($this->selectColumns('support_service_groups', [
                'id',
                'customer_id',
                'group_name',
            ]));

        if ($this->hasColumn('support_service_groups', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $record = $query->first();
        if ($record === null) {
            return null;
        }

        $row = (array) $record;

        return [
            'id' => $this->parseNullableInt($row['id'] ?? null) ?? $id,
            'customer_id' => $this->parseNullableInt($row['customer_id'] ?? null),
            'group_name' => $this->normalizeNullableString($row['group_name'] ?? null),
        ];
    }

    private function validateSupportServiceGroupForCustomer(
        ?int $effectiveCustomerId,
        ?int $serviceGroupId,
        ?int $currentServiceGroupId = null
    ): ?JsonResponse {
        if ($serviceGroupId === null) {
            return null;
        }

        $currentGroupId = $this->parseNullableInt($currentServiceGroupId);
        if ($currentGroupId !== null && $currentGroupId === $serviceGroupId) {
            return null;
        }

        $group = $this->loadSupportServiceGroupValidationRecord($serviceGroupId);
        if ($group === null) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }

        $groupCustomerId = $this->parseNullableInt($group['customer_id'] ?? null);
        if ($groupCustomerId === null || $effectiveCustomerId === null || $groupCustomerId !== $effectiveCustomerId) {
            return response()->json(['message' => 'service_group_id does not belong to selected customer.'], 422);
        }

        return null;
    }

    private function resolveWorkflowStaticCanonicalFieldKeyByLabel(string $fieldLabel): ?string
    {
        $token = $this->normalizeWorkflowFieldToken($fieldLabel);
        if ($token === '') {
            return null;
        }

        $map = [
            'idyeucau' => 'request_code',
            'mayeucau' => 'request_code',
            'mayc' => 'request_code',
            'noidung' => 'summary',
            'noidungyeucau' => 'summary',
            'donvi' => 'customer_id',
            'nguoiyeucau' => 'reporter_contact_id',
            'nhomhotro' => 'service_group_id',
            'nguoitiepnhan' => 'receiver_user_id',
            'nguoixuly' => 'assignee_id',
            'ngaytiepnhan' => 'requested_date',
        ];

        return $map[$token] ?? null;
    }

    private function validateWorkflowStaticFieldCanonicalKey(string $fieldLabel, string $fieldKey): ?string
    {
        $canonicalKey = $this->resolveWorkflowStaticCanonicalFieldKeyByLabel($fieldLabel);
        if ($canonicalKey === null) {
            return null;
        }

        $providedKeyToken = $this->normalizeWorkflowFieldToken($fieldKey);
        $canonicalKeyToken = $this->normalizeWorkflowFieldToken($canonicalKey);
        if ($providedKeyToken === $canonicalKeyToken) {
            return null;
        }

        return sprintf(
            'field_label "%s" phải dùng field_key chuẩn là "%s".',
            trim($fieldLabel),
            $canonicalKey
        );
    }

    private function serializeProductRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'product_code' => (string) ($record['product_code'] ?? ''),
            'product_name' => (string) ($record['product_name'] ?? ''),
            'domain_id' => $record['domain_id'] ?? null,
            'vendor_id' => $record['vendor_id'] ?? null,
            'standard_price' => (float) ($record['standard_price'] ?? 0),
            'unit' => $this->normalizeNullableString($record['unit'] ?? null),
            'description' => $this->normalizeNullableString($record['description'] ?? null),
            'is_active' => array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function loadProductById(int $id): ?array
    {
        if (! $this->hasTable('products')) {
            return null;
        }

        $record = DB::table('products')
            ->select($this->selectColumns('products', [
                'id',
                'product_code',
                'product_name',
                'domain_id',
                'vendor_id',
                'standard_price',
                'unit',
                'description',
                'is_active',
                'created_at',
                'created_by',
                'updated_at',
                'updated_by',
            ]))
            ->where('id', $id)
            ->when($this->hasColumn('products', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        return $record !== null ? $this->serializeProductRecord((array) $record) : null;
    }

    private function isUniqueConstraintViolation(QueryException $exception): bool
    {
        $errorInfo = $exception->errorInfo;
        if (is_array($errorInfo) && isset($errorInfo[1])) {
            return (int) $errorInfo[1] === 1062;
        }

        return false;
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

        return $exception->getMessage() !== ''
            ? $exception->getMessage()
            : 'Dữ liệu không hợp lệ.';
    }

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->hasTable($table)) {
            return false;
        }

        $query = DB::table($table)->where('id', $id);
        if ($this->hasColumn($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->exists();
    }

    private function validateReporterContactForCustomer(?int $customerId, ?int $reporterContactId): ?JsonResponse
    {
        if ($reporterContactId === null) {
            return null;
        }

        if (! $this->hasTable('customer_personnel')) {
            return response()->json(['message' => 'reporter_contact_id is invalid.'], 422);
        }

        $record = DB::table('customer_personnel')
            ->select($this->selectColumns('customer_personnel', ['id', 'customer_id']))
            ->where('id', $reporterContactId)
            ->when($this->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        if ($record === null) {
            return response()->json(['message' => 'reporter_contact_id is invalid.'], 422);
        }

        if ($customerId !== null && $this->hasColumn('customer_personnel', 'customer_id')) {
            $row = (array) $record;
            $ownerCustomerId = $this->parseNullableInt($row['customer_id'] ?? null);
            if ($ownerCustomerId === null || $ownerCustomerId !== $customerId) {
                return response()->json(['message' => 'reporter_contact_id does not belong to selected customer.'], 422);
            }
        }

        return null;
    }

    private function resolveReporterNameFromContactId(int $reporterContactId, ?string $fallbackReporterName = null): ?string
    {
        $fallback = $this->normalizeNullableString($fallbackReporterName);
        if (! $this->hasTable('customer_personnel') || ! $this->hasColumn('customer_personnel', 'full_name')) {
            return $fallback;
        }

        $fullName = DB::table('customer_personnel')
            ->where('id', $reporterContactId)
            ->when($this->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->value('full_name');

        return $this->normalizeNullableString($fullName) ?? $fallback;
    }

    /**
     * @return array<int, array{user_id:int, raci_role:string, user_code:string|null, username:string|null, full_name:string|null}>
     */
    private function fetchProjectRaciReceiverRows(?int $projectId): array
    {
        if (
            $projectId === null
            || ! $this->hasTable('raci_assignments')
            || ! $this->hasTable('internal_users')
            || ! $this->hasColumn('raci_assignments', 'entity_type')
            || ! $this->hasColumn('raci_assignments', 'entity_id')
            || ! $this->hasColumn('raci_assignments', 'user_id')
            || ! $this->hasColumn('raci_assignments', 'raci_role')
            || ! $this->hasColumn('internal_users', 'id')
        ) {
            return [];
        }

        $query = DB::table('raci_assignments as ra')
            ->join('internal_users as iu', 'ra.user_id', '=', 'iu.id')
            ->whereRaw('LOWER(ra.entity_type) = ?', ['project'])
            ->where('ra.entity_id', $projectId)
            ->whereIn('ra.raci_role', ['A', 'R', 'C', 'I']);

        if ($this->hasColumn('internal_users', 'status')) {
            $query->whereIn('iu.status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);
        }

        $query->select([
            'ra.user_id as user_id',
            'ra.raci_role as raci_role',
            DB::raw($this->hasColumn('internal_users', 'user_code') ? 'iu.user_code as user_code' : 'NULL as user_code'),
            DB::raw($this->hasColumn('internal_users', 'username') ? 'iu.username as username' : 'NULL as username'),
            DB::raw($this->hasColumn('internal_users', 'full_name') ? 'iu.full_name as full_name' : 'NULL as full_name'),
        ]);

        $query->orderByRaw("CASE WHEN ra.raci_role = 'A' THEN 0 ELSE 1 END");
        $query->orderByRaw("FIELD(ra.raci_role, 'A', 'R', 'C', 'I')");
        if ($this->hasColumn('internal_users', 'full_name')) {
            $query->orderBy('iu.full_name');
        } else {
            $query->orderBy('iu.id');
        }

        $uniqueRows = [];
        foreach ($query->get() as $item) {
            $row = (array) $item;
            $userId = $this->parseNullableInt($row['user_id'] ?? null);
            if ($userId === null || isset($uniqueRows[$userId])) {
                continue;
            }

            $uniqueRows[$userId] = [
                'user_id' => $userId,
                'raci_role' => strtoupper((string) ($row['raci_role'] ?? '')),
                'user_code' => $this->normalizeNullableString($row['user_code'] ?? null),
                'username' => $this->normalizeNullableString($row['username'] ?? null),
                'full_name' => $this->normalizeNullableString($row['full_name'] ?? null),
            ];
        }

        return array_values($uniqueRows);
    }

    /**
     * @param array<int, array{user_id:int, raci_role:string, user_code:string|null, username:string|null, full_name:string|null}> $raciRows
     */
    private function resolveDefaultReceiverUserIdFromRaciRows(array $raciRows): ?int
    {
        foreach ($raciRows as $row) {
            if (($row['raci_role'] ?? '') === 'A') {
                return $this->parseNullableInt($row['user_id'] ?? null);
            }
        }

        foreach ($raciRows as $row) {
            $userId = $this->parseNullableInt($row['user_id'] ?? null);
            if ($userId !== null) {
                return $userId;
            }
        }

        return null;
    }

    /**
     * @return array{receiver_user_id:int|null, default_receiver_user_id:int|null, allowed_user_ids:array<int, int>, error:string|null}
     */
    private function resolveSupportReceiverUserSelection(?int $projectId, ?int $receiverUserId): array
    {
        if ($receiverUserId !== null && ! $this->tableRowExists('internal_users', $receiverUserId)) {
            return [
                'receiver_user_id' => null,
                'default_receiver_user_id' => null,
                'allowed_user_ids' => [],
                'error' => 'receiver_user_id is invalid.',
            ];
        }

        $raciRows = $this->fetchProjectRaciReceiverRows($projectId);
        $allowedUserIds = collect($raciRows)
            ->map(fn (array $row): ?int => $this->parseNullableInt($row['user_id'] ?? null))
            ->filter(fn (?int $value): bool => $value !== null)
            ->values()
            ->all();
        $defaultReceiverUserId = $this->resolveDefaultReceiverUserIdFromRaciRows($raciRows);

        if ($receiverUserId !== null && $allowedUserIds !== [] && ! in_array($receiverUserId, $allowedUserIds, true)) {
            return [
                'receiver_user_id' => null,
                'default_receiver_user_id' => $defaultReceiverUserId,
                'allowed_user_ids' => $allowedUserIds,
                'error' => 'receiver_user_id does not belong to project RACI.',
            ];
        }

        return [
            'receiver_user_id' => $receiverUserId ?? $defaultReceiverUserId,
            'default_receiver_user_id' => $defaultReceiverUserId,
            'allowed_user_ids' => $allowedUserIds,
            'error' => null,
        ];
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

    private function serializeWorklogActivityTypeRecord(array $record): array
    {
        $code = $this->sanitizeSupportContactPositionCode((string) ($record['code'] ?? ''));
        $phaseHint = $this->normalizeWorklogPhaseHint($record['phase_hint'] ?? null);

        return [
            'id' => $record['id'] ?? null,
            'code' => $code,
            'name' => (string) ($record['name'] ?? $code),
            'description' => $record['description'] ?? null,
            'default_is_billable' => (bool) ($record['default_is_billable'] ?? true),
            'phase_hint' => $phaseHint,
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'used_in_worklogs' => isset($record['used_in_worklogs']) ? (int) $record['used_in_worklogs'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeSupportSlaConfigRecord(array $record): array
    {
        $statusRaw = $record['status'] ?? ($record['to_status'] ?? '');
        $status = $this->sanitizeSupportRequestStatusCode((string) $statusRaw);
        $subStatus = $this->normalizeNullableSupportRequestStatusCode($record['sub_status'] ?? null);
        $priority = $this->normalizeSupportRequestPriority((string) ($record['priority'] ?? 'MEDIUM'));
        $slaHours = isset($record['sla_hours'])
            ? (float) $record['sla_hours']
            : (isset($record['resolution_hours']) ? (float) $record['resolution_hours'] : 0.0);
        $requestTypePrefix = $this->normalizeNullableSupportRequestStatusCode($record['request_type_prefix'] ?? null);
        $serviceGroupId = $this->parseNullableInt($record['service_group_id'] ?? null);
        $workflowActionCode = $this->normalizeNullableWorkflowActionCode($record['workflow_action_code'] ?? null);
        $serviceGroupName = $this->normalizeNullableString($record['service_group_name'] ?? null);

        return [
            'id' => $record['id'] ?? null,
            'status' => $status !== '' ? $status : 'IN_PROGRESS',
            'sub_status' => $subStatus,
            'priority' => $priority,
            'sla_hours' => $slaHours,
            'request_type_prefix' => $requestTypePrefix,
            'service_group_id' => $serviceGroupId,
            'service_group_name' => $serviceGroupName,
            'workflow_action_code' => $workflowActionCode,
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'is_status_editable' => true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeSupportRequestStatusRecord(array $record): array
    {
        $statusCode = $this->sanitizeSupportRequestStatusCode((string) ($record['status_code'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'status_code' => $statusCode !== '' ? $statusCode : 'NEW',
            'status_name' => (string) ($record['status_name'] ?? ($statusCode !== '' ? $statusCode : 'NEW')),
            'description' => $record['description'] ?? null,
            'requires_completion_dates' => (bool) ($record['requires_completion_dates'] ?? (($statusCode !== 'NEW'))),
            'is_terminal' => (bool) ($record['is_terminal'] ?? in_array($statusCode, ['COMPLETED', 'UNABLE_TO_EXECUTE'], true)),
            'is_transfer_dev' => (bool) ($record['is_transfer_dev'] ?? ($statusCode === 'TRANSFER_DEV')),
            'is_active' => (bool) ($record['is_active'] ?? true),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeSupportContactPositionRecord(array $record): array
    {
        $positionCode = $this->sanitizeSupportContactPositionCode((string) ($record['position_code'] ?? ''));

        return [
            'id' => $record['id'] ?? null,
            'position_code' => $positionCode,
            'position_name' => (string) ($record['position_name'] ?? $positionCode),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? true),
            'used_in_customer_personnel' => isset($record['used_in_customer_personnel']) ? (int) $record['used_in_customer_personnel'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeSupportServiceGroupRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'group_code' => $this->normalizeNullableString($record['group_code'] ?? null),
            'group_name' => (string) ($record['group_name'] ?? ''),
            'description' => $record['description'] ?? null,
            'is_active' => (bool) ($record['is_active'] ?? false),
            'customer_id' => $this->parseNullableInt($record['customer_id'] ?? null),
            'customer_code' => $this->normalizeNullableString($record['customer_code'] ?? null),
            'customer_name' => $this->normalizeNullableString($record['customer_name'] ?? null),
            'workflow_status_catalog_id' => $this->parseNullableInt($record['workflow_status_catalog_id'] ?? null),
            'workflow_status_code' => $this->normalizeNullableString($record['workflow_status_code'] ?? null),
            'workflow_status_name' => $this->normalizeNullableString($record['workflow_status_name'] ?? null),
            'workflow_status_form_key' => $this->normalizeNullableString($record['workflow_status_form_key'] ?? null),
            'workflow_form_key' => $this->normalizeNullableString($record['workflow_form_key'] ?? null),
            'used_in_customer_requests' => isset($record['used_in_customer_requests']) ? (int) $record['used_in_customer_requests'] : 0,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeProjectItemRecord(array $record): array
    {
        $projectId = $this->parseNullableInt($record['project_id'] ?? null);
        $productId = $this->parseNullableInt($record['product_id'] ?? null);
        $customerId = $this->parseNullableInt($record['customer_id'] ?? null);
        $projectCode = $this->firstNonEmpty($record, ['project_code']);
        $projectName = $this->firstNonEmpty($record, ['project_name']);
        $productCode = $this->firstNonEmpty($record, ['product_code']);
        $productName = $this->firstNonEmpty($record, ['product_name']);

        $projectCodeText = (string) ($projectCode ?? '');
        $projectNameText = (string) ($projectName ?? '');
        $productCodeText = (string) ($productCode ?? '');
        $productNameText = (string) ($productName ?? '');

        $projectPart = trim(($projectCodeText !== '' ? $projectCodeText.' - ' : '').$projectNameText);
        $productPart = trim(($productCodeText !== '' ? $productCodeText.' - ' : '').$productNameText);
        $displayName = trim($projectPart.($projectPart !== '' && $productPart !== '' ? ' | ' : '').$productPart);

        return [
            'id' => $this->parseNullableInt($record['id'] ?? null),
            'project_id' => $projectId,
            'project_code' => $projectCode,
            'project_name' => $projectName,
            'customer_id' => $customerId,
            'customer_code' => $record['customer_code'] ?? null,
            'customer_name' => $this->firstNonEmpty($record, ['customer_name', 'customer_company_name']),
            'product_id' => $productId,
            'product_code' => $productCode,
            'product_name' => $productName,
            'unit' => $record['unit'] ?? null,
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

    private function serializeSupportRequestTaskRecord(array $record): array
    {
        return [
            'id' => $record['id'] ?? null,
            'request_id' => $record['request_id'] ?? null,
            'task_code' => $record['task_code'] ?? null,
            'task_link' => $record['task_link'] ?? null,
            'status' => $this->normalizeSupportRequestTaskStatus((string) ($record['status'] ?? 'TODO')),
            'sort_order' => isset($record['sort_order']) ? (int) $record['sort_order'] : null,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'updated_at' => $record['updated_at'] ?? null,
            'updated_by' => $record['updated_by'] ?? null,
        ];
    }

    private function serializeSupportRequestRecord(array $record): array
    {
        $requestCode = $this->firstNonEmpty($record, ['request_code']);
        $ticketCode = $this->firstNonEmpty($record, ['ticket_code']);
        $referenceRequestCode = $this->firstNonEmpty($record, ['reference_request_code', 'reference_request_ticket_code']);
        $referenceTicketCode = $this->firstNonEmpty($record, ['reference_ticket_code']);
        $referenceStatusRaw = $record['reference_request_status'] ?? null;

        return [
            'id' => $record['id'] ?? null,
            'request_code' => $requestCode,
            'ticket_code' => $ticketCode,
            'reference_request_code' => $referenceRequestCode,
            'reference_ticket_code' => $referenceTicketCode,
            'reference_request_id' => $record['reference_request_id'] ?? null,
            'reference_summary' => $record['reference_request_summary'] ?? null,
            'reference_status' => $referenceStatusRaw !== null
                ? $this->normalizeSupportRequestStatus((string) $referenceStatusRaw)
                : null,
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
            'reporter_contact_id' => $record['reporter_contact_id'] ?? null,
            'reporter_contact_name' => $record['reporter_contact_name'] ?? null,
            'reporter_contact_phone' => $record['reporter_contact_phone'] ?? null,
            'reporter_contact_email' => $record['reporter_contact_email'] ?? null,
            'assignee_id' => $record['assignee_id'] ?? null,
            'assignee_name' => $record['assignee_name'] ?? null,
            'assignee_username' => $record['assignee_username'] ?? null,
            'assignee_code' => $record['assignee_code'] ?? null,
            'receiver_user_id' => $record['receiver_user_id'] ?? null,
            'receiver_name' => $record['receiver_name'] ?? null,
            'receiver_username' => $record['receiver_username'] ?? null,
            'receiver_code' => $record['receiver_code'] ?? null,
            'status' => $this->normalizeSupportRequestStatus((string) ($record['status'] ?? 'NEW')),
            'priority' => $this->normalizeSupportRequestPriority((string) ($record['priority'] ?? 'MEDIUM')),
            'requested_date' => $record['requested_date'] ?? null,
            'due_date' => $record['due_date'] ?? null,
            'resolved_date' => $record['resolved_date'] ?? null,
            'hotfix_date' => $record['hotfix_date'] ?? null,
            'noti_date' => $record['noti_date'] ?? null,
            'task_link' => null,
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
            'new_status' => $this->normalizeSupportRequestStatus((string) ($record['new_status'] ?? 'NEW')),
            'comment' => $record['comment'] ?? null,
            'created_at' => $record['created_at'] ?? null,
            'created_by' => $record['created_by'] ?? null,
            'created_by_name' => $record['created_by_name'] ?? null,
            'created_by_username' => $record['created_by_username'] ?? null,
            'ticket_code' => $record['ticket_code'] ?? null,
            'request_summary' => $record['request_summary'] ?? null,
        ];
    }

    private function normalizeDocumentStatus(string $status): string
    {
        $normalized = strtoupper(trim($status));
        return in_array($normalized, self::DOCUMENT_STATUSES, true) ? $normalized : 'ACTIVE';
    }

    private function normalizeDocumentScope(string $scope): string
    {
        $normalized = strtoupper(trim($scope));
        if ($normalized === self::DOCUMENT_SCOPE_PRODUCT_PRICING) {
            return self::DOCUMENT_SCOPE_PRODUCT_PRICING;
        }

        return self::DOCUMENT_SCOPE_DEFAULT;
    }

    private function resolveOrCreateProductPricingDocumentTypeId(): ?int
    {
        if (! $this->hasTable('document_types')) {
            if (! $this->hasColumn('documents', 'document_type_id')) {
                return null;
            }

            return $this->parseNullableInt(
                DB::table('documents')
                    ->whereNotNull('document_type_id')
                    ->value('document_type_id')
            );
        }

        $columns = $this->selectColumns('document_types', ['id', 'type_code', 'type_name', 'created_at']);
        if (! in_array('id', $columns, true) || ! in_array('type_code', $columns, true)) {
            return null;
        }

        $existingId = DB::table('document_types')
            ->where('type_code', self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE)
            ->value('id');
        $existingNumericId = $this->parseNullableInt($existingId);
        if ($existingNumericId !== null) {
            return $existingNumericId;
        }

        $payload = $this->filterPayloadByTableColumns('document_types', [
            'type_code' => self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE,
            'type_name' => 'Văn bản giá sản phẩm',
            'created_at' => now(),
        ]);

        try {
            $createdId = DB::table('document_types')->insertGetId($payload);
            $createdNumericId = $this->parseNullableInt($createdId);
            if ($createdNumericId !== null) {
                return $createdNumericId;
            }
        } catch (\Throwable) {
            // Ignore unique-race and re-query.
        }

        return $this->parseNullableInt(
            DB::table('document_types')
                ->where('type_code', self::PRODUCT_PRICING_DOCUMENT_TYPE_CODE)
                ->value('id')
        );
    }

    private function resolveProductPricingDocumentCustomerId(): ?int
    {
        if (! $this->hasColumn('documents', 'customer_id')) {
            return null;
        }

        if ($this->isColumnNullable('documents', 'customer_id')) {
            return null;
        }

        if (! $this->hasTable('customers')) {
            return 0;
        }

        return 0;
    }

    /**
     * @return array{
     *     fileName:string,
     *     mimeType:string,
     *     fileSize:int,
     *     fileUrl:string,
     *     driveFileId:?string,
     *     storageProvider:string,
     *     storagePath:?string,
     *     storageDisk:?string,
     *     storageVisibility:?string,
     *     warningMessage:?string
     * }
     */
    private function uploadDocumentFileToStorage(UploadedFile $file): array
    {
        $warnings = [];

        if ($this->isBackblazeB2Configured()) {
            $backblazeResult = $this->uploadFileToBackblazeB2($file);
            if ((bool) ($backblazeResult['success'] ?? false)) {
                return [
                    'fileName' => $file->getClientOriginalName(),
                    'mimeType' => $file->getClientMimeType() ?: 'application/octet-stream',
                    'fileSize' => (int) $file->getSize(),
                    'fileUrl' => (string) ($backblazeResult['fileUrl'] ?? ''),
                    'driveFileId' => null,
                    'storageProvider' => 'BACKBLAZE_B2',
                    'storagePath' => $backblazeResult['storagePath'] ?? null,
                    'storageDisk' => $backblazeResult['storageDisk'] ?? self::BACKBLAZE_B2_STORAGE_DISK,
                    'storageVisibility' => 'private',
                    'warningMessage' => null,
                ];
            }

            $backblazeWarning = $this->normalizeNullableString($backblazeResult['errorMessage'] ?? null);
            if ($backblazeWarning !== null) {
                $warnings[] = 'Backblaze B2: '.$backblazeWarning;
            }
        }

        $storedPath = $file->store('documents', 'local');
        $url = $this->buildSignedTempAttachmentDownloadUrl('local', $storedPath, $file->getClientOriginalName());
        $warningMessage = null;
        if ($warnings !== []) {
            $warningMessage = implode(' ', $warnings).' File đã được lưu tạm trên máy chủ nội bộ.';
        }

        return [
            'fileName' => $file->getClientOriginalName(),
            'mimeType' => $file->getClientMimeType() ?: 'application/octet-stream',
            'fileSize' => (int) $file->getSize(),
            'fileUrl' => $url,
            'driveFileId' => null,
            'storageProvider' => 'LOCAL',
            'storagePath' => $storedPath,
            'storageDisk' => 'local',
            'storageVisibility' => 'private',
            'warningMessage' => $warningMessage,
        ];
    }

    private function isBackblazeB2Configured(): bool
    {
        $config = $this->resolveBackblazeB2RuntimeConfig();
        if (! (bool) ($config['is_enabled'] ?? false)) {
            return false;
        }

        $validation = $this->validateBackblazeB2RuntimeConfig($config);

        return (bool) ($validation['success'] ?? false);
    }

    /**
     * @return array{
     *     is_enabled:bool,
     *     access_key_id:?string,
     *     bucket_id:?string,
     *     secret_access_key:?string,
     *     bucket_name:?string,
     *     region:?string,
     *     endpoint:?string,
     *     file_prefix:?string,
     *     has_secret_access_key:bool,
     *     source:string
     * }
     */
    private function resolveBackblazeB2RuntimeConfig(): array
    {
        $row = $this->loadBackblazeB2IntegrationSettingsRow();
        if ($row !== null) {
            $secretAccessKey = $this->decodeBackblazeB2SecretAccessKey($row['secret_access_key'] ?? null);
            if ($secretAccessKey === null) {
                $secretAccessKey = $this->getBackblazeB2SecretAccessKeyFromEnv();
            }

            return [
                'is_enabled' => (bool) ($row['is_enabled'] ?? false),
                'access_key_id' => $this->normalizeNullableString($row['access_key_id'] ?? null),
                'bucket_id' => $this->normalizeNullableString($row['bucket_id'] ?? null),
                'secret_access_key' => $secretAccessKey,
                'bucket_name' => $this->normalizeNullableString($row['bucket_name'] ?? null),
                'region' => $this->resolveBackblazeB2Region($row['region'] ?? null),
                'endpoint' => $this->resolveBackblazeB2Endpoint($row['region'] ?? null, $row['endpoint'] ?? null),
                'file_prefix' => $this->normalizeNullableString($row['file_prefix'] ?? null),
                'has_secret_access_key' => $secretAccessKey !== null,
                'source' => 'DB',
            ];
        }

        $secretAccessKey = $this->getBackblazeB2SecretAccessKeyFromEnv();
        $region = $this->resolveBackblazeB2Region($this->getBackblazeB2EnvValue('B2_REGION', 'BACKBLAZE_B2_REGION'));

        return [
            'is_enabled' => filter_var(
                $this->getBackblazeB2EnvValue('B2_ENABLED', 'BACKBLAZE_B2_ENABLED') ?? false,
                FILTER_VALIDATE_BOOLEAN
            ),
            'access_key_id' => $this->getBackblazeB2EnvValue('B2_KEY_ID', 'BACKBLAZE_B2_ACCESS_KEY_ID'),
            'bucket_id' => $this->getBackblazeB2EnvValue('B2_BUCKET_ID'),
            'secret_access_key' => $secretAccessKey,
            'bucket_name' => $this->getBackblazeB2EnvValue('B2_BUCKET_NAME', 'BACKBLAZE_B2_BUCKET'),
            'region' => $region,
            'endpoint' => $this->resolveBackblazeB2Endpoint(
                $region,
                $this->getBackblazeB2EnvValue('B2_ENDPOINT', 'BACKBLAZE_B2_ENDPOINT')
            ),
            'file_prefix' => $this->getBackblazeB2EnvValue('B2_FILE_PREFIX', 'BACKBLAZE_B2_FILE_PREFIX'),
            'has_secret_access_key' => $secretAccessKey !== null,
            'source' => 'ENV',
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function loadBackblazeB2IntegrationSettingsRow(): ?array
    {
        if (! $this->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->where('provider', self::BACKBLAZE_B2_INTEGRATION_PROVIDER)
            ->first();

        return $record ? (array) $record : null;
    }

    private function getBackblazeB2EnvValue(string $primaryKey, ?string $legacyKey = null): ?string
    {
        $primaryValue = $this->normalizeNullableString(env($primaryKey));
        if ($primaryValue !== null) {
            return $primaryValue;
        }

        if ($legacyKey !== null) {
            return $this->normalizeNullableString(env($legacyKey));
        }

        return null;
    }

    private function getBackblazeB2SecretAccessKeyFromEnv(): ?string
    {
        return $this->getBackblazeB2EnvValue('B2_APPLICATION_KEY', 'BACKBLAZE_B2_SECRET_ACCESS_KEY');
    }

    private function resolveBackblazeB2Region(mixed $value): string
    {
        return $this->normalizeNullableString($value) ?? 'us-west-004';
    }

    private function resolveBackblazeB2Endpoint(mixed $region, mixed $fallbackEndpoint = null): string
    {
        $normalizedRegion = $this->normalizeNullableString($region);
        if ($normalizedRegion !== null) {
            return sprintf('https://s3.%s.backblazeb2.com', $normalizedRegion);
        }

        return $this->normalizeNullableString($fallbackEndpoint) ?? 'https://s3.us-west-004.backblazeb2.com';
    }

    private function decodeBackblazeB2SecretAccessKey(mixed $value): ?string
    {
        $raw = $this->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($raw);

            return $this->normalizeNullableString($decrypted);
        } catch (\Throwable) {
            return $raw;
        }
    }

    private function maskBackblazeB2SecretAccessKey(mixed $value): ?string
    {
        $raw = $this->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        $length = strlen($raw);
        if ($length <= 8) {
            return str_repeat('*', $length);
        }

        $prefixLength = min(6, max(2, intdiv($length, 4)));
        $suffixLength = min(6, max(2, intdiv($length, 5)));
        $maskedLength = max(4, $length - $prefixLength - $suffixLength);

        return sprintf(
            '%s%s%s',
            substr($raw, 0, $prefixLength),
            str_repeat('*', $maskedLength),
            substr($raw, -$suffixLength)
        );
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function validateBackblazeB2RuntimeConfig(array $runtimeConfig): array
    {
        $accessKeyId = trim((string) ($runtimeConfig['access_key_id'] ?? ''));
        if ($accessKeyId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Key ID của Backblaze B2.',
            ];
        }

        $secretAccessKey = trim((string) ($runtimeConfig['secret_access_key'] ?? ''));
        if ($secretAccessKey === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Application Key của Backblaze B2.',
            ];
        }

        $bucketName = trim((string) ($runtimeConfig['bucket_name'] ?? ''));
        $bucketId = trim((string) ($runtimeConfig['bucket_id'] ?? ''));
        if ($bucketId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Bucket ID của Backblaze B2.',
            ];
        }

        if ($bucketName === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Bucket name của Backblaze B2.',
            ];
        }

        $region = trim((string) ($runtimeConfig['region'] ?? ''));
        if ($region === '') {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Region của Backblaze B2.',
            ];
        }

        return ['success' => true];
    }

    private function prepareConfiguredStorageDisk(string $disk): void
    {
        if ($disk === self::BACKBLAZE_B2_STORAGE_DISK) {
            return;
        }
    }

    private function saveBackblazeB2IntegrationTestResult(string $status, string $message): void
    {
        if (! $this->hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', self::BACKBLAZE_B2_INTEGRATION_PROVIDER)
            ->update([
                'last_tested_at' => now(),
                'last_test_status' => strtoupper($status),
                'last_test_message' => Str::limit(trim($message), 500, '...'),
                'updated_at' => now(),
            ]);
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function verifyBackblazeB2UploadCapability(array $runtimeConfig): array
    {
        try {
            $authorization = $this->authorizeBackblazeB2Account($runtimeConfig);
            $bucket = $this->resolveBackblazeB2Bucket($runtimeConfig, $authorization);
            $testKey = $this->buildBackblazeB2ObjectKey($runtimeConfig, 'connection_test.txt', 'health-check');
            $uploadResult = $this->uploadStringToBackblazeB2(
                $runtimeConfig,
                $authorization,
                $testKey,
                'VNPT Backblaze B2 connection test',
                'text/plain'
            );
            $this->deleteBackblazeB2FileVersion(
                $authorization,
                (string) ($uploadResult['fileId'] ?? ''),
                (string) ($uploadResult['fileName'] ?? $testKey)
            );

            return ['success' => true];
        } catch (\Throwable $exception) {
            return [
                'success' => false,
                'errorMessage' => $this->normalizeBackblazeB2ErrorMessage($exception, 'Backblaze B2 chưa ghi được file test.'),
            ];
        }
    }

    /**
     * @return array{success:bool,fileUrl?:string,storagePath?:string,storageDisk?:string,errorMessage?:string}
     */
    private function uploadFileToBackblazeB2(UploadedFile $file): array
    {
        $runtimeConfig = $this->resolveBackblazeB2RuntimeConfig();
        $validation = $this->validateBackblazeB2RuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            return [
                'success' => false,
                'errorMessage' => (string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'),
            ];
        }

        try {
            $authorization = $this->authorizeBackblazeB2Account($runtimeConfig);
            $this->resolveBackblazeB2Bucket($runtimeConfig, $authorization);
            $objectKey = $this->buildBackblazeB2ObjectKey($runtimeConfig, $file->getClientOriginalName(), 'documents');
            $contents = file_get_contents($file->getRealPath());
            if ($contents === false) {
                throw new \RuntimeException('Không thể đọc nội dung file tải lên.');
            }
            $this->uploadStringToBackblazeB2(
                $runtimeConfig,
                $authorization,
                $objectKey,
                $contents,
                $file->getClientMimeType() ?: 'application/octet-stream'
            );

            return [
                'success' => true,
                'fileUrl' => $this->buildSignedTempAttachmentDownloadUrl(
                    self::BACKBLAZE_B2_STORAGE_DISK,
                    $objectKey,
                    $file->getClientOriginalName()
                ),
                'storagePath' => $objectKey,
                'storageDisk' => self::BACKBLAZE_B2_STORAGE_DISK,
            ];
        } catch (\Throwable $exception) {
            return [
                'success' => false,
                'errorMessage' => $this->normalizeBackblazeB2ErrorMessage($exception),
            ];
        }
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     */
    private function buildBackblazeB2ObjectKey(array $runtimeConfig, string $originalFileName, string $directory = 'documents'): string
    {
        $prefix = trim((string) ($runtimeConfig['file_prefix'] ?? ''), '/');
        $segments = [];

        if ($prefix !== '') {
            $segments[] = $prefix;
        }

        $normalizedDirectory = trim($directory, '/');
        if ($normalizedDirectory !== '') {
            $segments[] = $normalizedDirectory;
        }

        $fileNameStem = Str::slug(pathinfo($originalFileName, PATHINFO_FILENAME));
        if ($fileNameStem === '') {
            $fileNameStem = 'file';
        }

        $fileName = now()->format('Ymd_His').'_'.Str::random(8).'_'.$fileNameStem;
        $extension = trim((string) pathinfo($originalFileName, PATHINFO_EXTENSION));
        if ($extension !== '') {
            $fileName .= '.'.$extension;
        }

        $segments[] = $fileName;

        return implode('/', $segments);
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{api_url:string,authorization_token:string,download_url:string,account_id:string}
     */
    private function authorizeBackblazeB2Account(array $runtimeConfig): array
    {
        $validation = $this->validateBackblazeB2RuntimeConfig($runtimeConfig);
        if (! ($validation['success'] ?? false)) {
            throw new \RuntimeException((string) ($validation['errorMessage'] ?? 'Cấu hình Backblaze B2 chưa hợp lệ.'));
        }

        $accessKeyId = (string) ($runtimeConfig['access_key_id'] ?? '');
        $secretAccessKey = (string) ($runtimeConfig['secret_access_key'] ?? '');

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($accessKeyId.':'.$secretAccessKey),
                'Accept' => 'application/json',
            ])->timeout(30)->get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account');
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeBackblazeB2ErrorMessage($exception, 'Không thể kết nối tới Backblaze B2 API.'));
        }

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Không thể xác thực với Backblaze B2.'
            ));
        }

        $data = $response->json();
        $apiUrl = trim((string) ($data['apiUrl'] ?? ''));
        $authorizationToken = trim((string) ($data['authorizationToken'] ?? ''));
        $downloadUrl = trim((string) ($data['downloadUrl'] ?? ''));
        $accountId = trim((string) ($data['accountId'] ?? ''));

        if ($apiUrl === '' || $authorizationToken === '' || $downloadUrl === '' || $accountId === '') {
            throw new \RuntimeException('Backblaze B2 không trả đủ thông tin xác thực tài khoản.');
        }

        return [
            'api_url' => $apiUrl,
            'authorization_token' => $authorizationToken,
            'download_url' => $downloadUrl,
            'account_id' => $accountId,
        ];
    }

    /**
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @param array<string, mixed> $payload
     */
    private function callBackblazeB2JsonApi(array $authorization, string $action, array $payload): \Illuminate\Http\Client\Response
    {
        try {
            return Http::withHeaders([
                'Authorization' => $authorization['authorization_token'],
                'Accept' => 'application/json',
            ])->timeout(60)->post(rtrim($authorization['api_url'], '/').'/b2api/v2/'.$action, $payload);
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeBackblazeB2ErrorMessage($exception, 'Không thể kết nối tới Backblaze B2 API.'));
        }
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>
     */
    private function resolveBackblazeB2Bucket(array $runtimeConfig, array $authorization): array
    {
        $bucketId = trim((string) ($runtimeConfig['bucket_id'] ?? ''));
        $bucketName = trim((string) ($runtimeConfig['bucket_name'] ?? ''));

        $response = $this->callBackblazeB2JsonApi($authorization, 'b2_list_buckets', [
            'accountId' => $authorization['account_id'],
            'bucketId' => $bucketId,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Không thể kiểm tra Bucket của Backblaze B2.'
            ));
        }

        $buckets = $response->json('buckets');
        if (! is_array($buckets) || $buckets === []) {
            throw new \RuntimeException('Backblaze B2 không tìm thấy Bucket ID đích.');
        }

        $bucket = null;
        foreach ($buckets as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (trim((string) ($item['bucketId'] ?? '')) === $bucketId) {
                $bucket = $item;
                break;
            }
        }

        if ($bucket === null) {
            throw new \RuntimeException('Backblaze B2 không tìm thấy Bucket ID đích.');
        }

        $resolvedBucketName = trim((string) ($bucket['bucketName'] ?? ''));
        if ($bucketName !== '' && $resolvedBucketName !== '' && $resolvedBucketName !== $bucketName) {
            throw new \RuntimeException('Bucket name không khớp với Bucket ID đã cấu hình.');
        }

        return $bucket;
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array{upload_url:string,authorization_token:string}
     */
    private function requestBackblazeB2UploadUrl(array $runtimeConfig, array $authorization): array
    {
        $response = $this->callBackblazeB2JsonApi($authorization, 'b2_get_upload_url', [
            'bucketId' => (string) ($runtimeConfig['bucket_id'] ?? ''),
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Không lấy được upload URL từ Backblaze B2.'
            ));
        }

        $uploadUrl = trim((string) ($response->json('uploadUrl') ?? ''));
        $uploadAuthorizationToken = trim((string) ($response->json('authorizationToken') ?? ''));

        if ($uploadUrl === '' || $uploadAuthorizationToken === '') {
            throw new \RuntimeException('Backblaze B2 không trả đủ thông tin upload URL.');
        }

        return [
            'upload_url' => $uploadUrl,
            'authorization_token' => $uploadAuthorizationToken,
        ];
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>
     */
    private function uploadStringToBackblazeB2(
        array $runtimeConfig,
        array $authorization,
        string $objectKey,
        string $contents,
        string $contentType
    ): array {
        $uploadTarget = $this->requestBackblazeB2UploadUrl($runtimeConfig, $authorization);
        $sha1 = sha1($contents);

        try {
            $response = Http::withHeaders([
                'Authorization' => $uploadTarget['authorization_token'],
                'X-Bz-File-Name' => rawurlencode($objectKey),
                'Content-Type' => $contentType,
                'X-Bz-Content-Sha1' => $sha1,
                'Content-Length' => (string) strlen($contents),
            ])->timeout(300)->withBody($contents, $contentType)->post($uploadTarget['upload_url']);
        } catch (\Throwable $exception) {
            throw new \RuntimeException($this->normalizeBackblazeB2ErrorMessage($exception));
        }

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Backblaze B2 trả về lỗi khi tải file.'
            ));
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            throw new \RuntimeException('Backblaze B2 trả về dữ liệu upload không hợp lệ.');
        }

        return $payload;
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     * @return array<string, mixed>|null
     */
    private function findBackblazeB2FileByName(array $runtimeConfig, array $authorization, string $objectKey): ?array
    {
        $response = $this->callBackblazeB2JsonApi($authorization, 'b2_list_file_names', [
            'bucketId' => (string) ($runtimeConfig['bucket_id'] ?? ''),
            'prefix' => $objectKey,
            'maxFileCount' => 25,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Không thể tra cứu file trên Backblaze B2.'
            ));
        }

        $files = $response->json('files');
        if (! is_array($files)) {
            return null;
        }

        foreach ($files as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (trim((string) ($item['fileName'] ?? '')) !== $objectKey) {
                continue;
            }

            if (trim((string) ($item['action'] ?? 'upload')) !== 'upload') {
                continue;
            }

            return $item;
        }

        return null;
    }

    /**
     * @param array{api_url:string,authorization_token:string,download_url:string,account_id:string} $authorization
     */
    private function deleteBackblazeB2FileVersion(array $authorization, string $fileId, string $fileName): void
    {
        if (trim($fileId) === '' || trim($fileName) === '') {
            return;
        }

        $response = $this->callBackblazeB2JsonApi($authorization, 'b2_delete_file_version', [
            'fileId' => $fileId,
            'fileName' => $fileName,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException($this->normalizeBackblazeB2HttpError(
                $response,
                'Không thể xóa file trên Backblaze B2.'
            ));
        }
    }

    private function deleteBackblazeB2FileByStoragePath(string $storagePath): void
    {
        $path = trim($storagePath);
        if ($path === '') {
            return;
        }

        $runtimeConfig = $this->resolveBackblazeB2RuntimeConfig();
        $authorization = $this->authorizeBackblazeB2Account($runtimeConfig);
        $this->resolveBackblazeB2Bucket($runtimeConfig, $authorization);
        $file = $this->findBackblazeB2FileByName($runtimeConfig, $authorization, $path);

        if ($file === null) {
            return;
        }

        $this->deleteBackblazeB2FileVersion(
            $authorization,
            trim((string) ($file['fileId'] ?? '')),
            trim((string) ($file['fileName'] ?? $path))
        );
    }

    private function downloadBackblazeB2AttachmentResponse(string $storagePath, string $fileName): Response
    {
        $path = trim($storagePath);
        if ($path === '') {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        try {
            $runtimeConfig = $this->resolveBackblazeB2RuntimeConfig();
            $authorization = $this->authorizeBackblazeB2Account($runtimeConfig);
            $bucket = $this->resolveBackblazeB2Bucket($runtimeConfig, $authorization);
            $downloadUrl = rtrim($authorization['download_url'], '/')
                .'/file/'
                .rawurlencode((string) ($bucket['bucketName'] ?? $runtimeConfig['bucket_name'] ?? ''))
                .'/'
                .$this->encodeBackblazeB2ObjectKeyForUrl($path);

            $response = Http::withHeaders([
                'Authorization' => $authorization['authorization_token'],
            ])->withOptions([
                'stream' => true,
            ])->timeout(300)->get($downloadUrl);

            if (! $response->successful()) {
                $status = $response->status() === 404 ? 404 : 422;

                return response()->json([
                    'message' => $this->normalizeBackblazeB2HttpError(
                        $response,
                        'Không thể tải file từ Backblaze B2.'
                    ),
                ], $status);
            }

            $psrResponse = $response->toPsrResponse();
            $stream = $psrResponse->getBody();
            $headers = [];
            $contentType = $response->header('Content-Type');
            if (is_string($contentType) && trim($contentType) !== '') {
                $headers['Content-Type'] = $contentType;
            }
            $headers['Content-Disposition'] = $this->buildInlineContentDispositionHeader($fileName);

            return response()->stream(function () use ($stream): void {
                while (! $stream->eof()) {
                    echo $stream->read(1024 * 1024);
                }
            }, 200, $headers);
        } catch (\Throwable $exception) {
            $message = $this->normalizeBackblazeB2ErrorMessage($exception, 'Không thể tải file từ Backblaze B2.');

            return response()->json(['message' => $message], 422);
        }
    }

    private function buildInlineContentDispositionHeader(string $fileName): string
    {
        $normalizedName = trim($fileName) !== '' ? trim($fileName) : 'attachment';
        $asciiName = str_replace(['\\', '"'], ['_', ''], $normalizedName);
        $encodedName = rawurlencode($normalizedName);

        return sprintf('inline; filename="%s"; filename*=UTF-8\'\'%s', $asciiName, $encodedName);
    }

    private function encodeBackblazeB2ObjectKeyForUrl(string $objectKey): string
    {
        $segments = array_map(
            static fn (string $segment): string => rawurlencode($segment),
            explode('/', $objectKey)
        );

        return implode('/', $segments);
    }

    private function normalizeBackblazeB2HttpError(
        \Illuminate\Http\Client\Response $response,
        string $default = 'Backblaze B2 trả về lỗi khi tải file.'
    ): string {
        $payload = $response->json();
        $code = is_array($payload) ? trim((string) ($payload['code'] ?? '')) : '';
        $message = is_array($payload) ? trim((string) ($payload['message'] ?? '')) : trim($response->body());
        $status = $response->status();

        return $this->mapBackblazeB2ErrorMessage($message, $code, $status, $default);
    }

    private function mapBackblazeB2ErrorMessage(
        string $message,
        string $code = '',
        int $status = 0,
        string $default = 'Backblaze B2 trả về lỗi khi tải file.'
    ): string {
        $messageLower = Str::lower(trim($message));
        $codeLower = Str::lower(trim($code));

        if (
            in_array($codeLower, ['bad_auth_token', 'unauthorized', 'duplicate_bucket_name'], true)
            || ($status === 401 && $messageLower !== '')
            || str_contains($messageLower, 'signature validation failed')
            || str_contains($messageLower, 'invalid access key')
        ) {
            return 'Key ID và Application Key của Backblaze B2 không khớp nhau hoặc không đúng.';
        }

        if (
            in_array($codeLower, ['bad_bucket_id', 'no_such_bucket', 'bucket_not_found'], true)
            || str_contains($messageLower, 'bucket')
                && (str_contains($messageLower, 'not found') || str_contains($messageLower, 'not exist'))
        ) {
            return 'Backblaze B2 không tìm thấy Bucket ID đích.';
        }

        if (
            str_contains($messageLower, 'capab')
            || str_contains($messageLower, 'writefiles')
            || str_contains($messageLower, 'readfiles')
            || str_contains($messageLower, 'listfiles')
            || str_contains($messageLower, 'deletefiles')
            || $status === 403
        ) {
            return 'Application Key của Backblaze B2 chưa có đủ quyền read/list/write/delete trên bucket.';
        }

        if (
            str_contains($messageLower, 'timed out')
            || str_contains($messageLower, 'could not resolve host')
            || str_contains($messageLower, 'connection refused')
            || str_contains($messageLower, 'curl error')
        ) {
            return 'Không thể kết nối tới Backblaze B2 API.';
        }

        if ($message !== '') {
            return 'Backblaze B2 trả về lỗi: '.$message;
        }

        return $default;
    }

    private function normalizeBackblazeB2ErrorMessage(\Throwable $exception, string $default = 'Backblaze B2 trả về lỗi khi tải file.'): string
    {
        $message = trim($exception->getMessage());
        if (
            str_starts_with($message, 'Key ID và Application Key của Backblaze B2')
            || str_starts_with($message, 'Backblaze B2 không tìm thấy')
            || str_starts_with($message, 'Application Key của Backblaze B2')
            || str_starts_with($message, 'Không thể kết nối tới Backblaze B2 API.')
            || str_starts_with($message, 'Bucket name không khớp')
        ) {
            return $message;
        }

        return $this->mapBackblazeB2ErrorMessage($message, '', 0, $default);
    }

    private function isGoogleDriveConfigured(): bool
    {
        $config = $this->resolveGoogleDriveRuntimeConfig();
        if (! (bool) ($config['is_enabled'] ?? false)) {
            return false;
        }

        return is_array($config['credentials'] ?? null);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getGoogleServiceAccountCredentials(): ?array
    {
        $config = $this->resolveGoogleDriveRuntimeConfig();
        $credentials = $config['credentials'] ?? null;
        return is_array($credentials) ? $credentials : null;
    }

    /**
     * @return array{
     *     is_enabled:bool,
     *     account_email:?string,
     *     folder_id:?string,
     *     scopes:string,
     *     impersonate_user:?string,
     *     file_prefix:?string,
     *     credentials:?array<string,mixed>,
     *     has_credentials:bool,
     *     source:string
     * }
     */
    private function resolveGoogleDriveRuntimeConfig(): array
    {
        $row = $this->loadGoogleDriveIntegrationSettingsRow();
        if ($row !== null) {
            $credentials = $this->decodeGoogleServiceAccountCredentials($row['service_account_json'] ?? null);
            $scopes = $this->normalizeNullableString($row['scopes'] ?? null) ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE;
            $accountEmail = $this->normalizeNullableString($row['account_email'] ?? null);

            if ($credentials === null) {
                $credentials = $this->getGoogleServiceAccountCredentialsFromEnv();
            }

            if ($accountEmail === null && is_array($credentials) && ! empty($credentials['client_email'])) {
                $accountEmail = (string) $credentials['client_email'];
            }

            return [
                'is_enabled' => (bool) ($row['is_enabled'] ?? false),
                'account_email' => $accountEmail,
                'folder_id' => $this->normalizeNullableString($row['folder_id'] ?? null),
                'scopes' => $scopes,
                'impersonate_user' => $this->normalizeNullableString($row['impersonate_user'] ?? null),
                'file_prefix' => $this->normalizeNullableString($row['file_prefix'] ?? null),
                'credentials' => $credentials,
                'has_credentials' => is_array($credentials),
                'source' => 'DB',
            ];
        }

        $credentials = $this->getGoogleServiceAccountCredentialsFromEnv();

        return [
            'is_enabled' => filter_var(env('GOOGLE_DRIVE_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
            'account_email' => is_array($credentials) ? $this->normalizeNullableString($credentials['client_email'] ?? null) : null,
            'folder_id' => $this->normalizeNullableString(env('GOOGLE_DRIVE_FOLDER_ID')),
            'scopes' => $this->normalizeNullableString(env('GOOGLE_DRIVE_SCOPES')) ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE,
            'impersonate_user' => $this->normalizeNullableString(env('GOOGLE_DRIVE_IMPERSONATE_USER')),
            'file_prefix' => $this->normalizeNullableString(env('GOOGLE_DRIVE_FILE_PREFIX')),
            'credentials' => $credentials,
            'has_credentials' => is_array($credentials),
            'source' => 'ENV',
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function loadGoogleDriveIntegrationSettingsRow(): ?array
    {
        if (! $this->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->where('provider', self::GOOGLE_DRIVE_INTEGRATION_PROVIDER)
            ->first();

        return $record ? (array) $record : null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function loadContractExpiryAlertSettingsRow(): ?array
    {
        if (! $this->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_ALERT_INTEGRATION_PROVIDER)
            ->first();

        return $record ? (array) $record : null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function loadContractPaymentAlertSettingsRow(): ?array
    {
        if (! $this->hasTable('integration_settings')) {
            return null;
        }

        $record = DB::table('integration_settings')
            ->where('provider', self::CONTRACT_PAYMENT_ALERT_INTEGRATION_PROVIDER)
            ->first();

        return $record ? (array) $record : null;
    }

    private function resolveContractExpiryWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_EXPIRY_WARNING_DAYS;

        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_expiry_warning_days')
        ) {
            return $fallback;
        }

        $row = $this->loadContractExpiryAlertSettingsRow();
        $rawValue = $row['contract_expiry_warning_days'] ?? null;
        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }

    private function resolveContractPaymentWarningDays(): int
    {
        $fallback = self::DEFAULT_CONTRACT_PAYMENT_WARNING_DAYS;

        if (
            ! $this->hasTable('integration_settings')
            || ! $this->hasColumn('integration_settings', 'contract_payment_warning_days')
        ) {
            return $fallback;
        }

        $row = $this->loadContractPaymentAlertSettingsRow();
        $rawValue = $row['contract_payment_warning_days'] ?? null;
        if (! is_numeric($rawValue)) {
            return $fallback;
        }

        $value = (int) $rawValue;
        if ($value < self::MIN_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MIN_CONTRACT_EXPIRY_WARNING_DAYS;
        }
        if ($value > self::MAX_CONTRACT_EXPIRY_WARNING_DAYS) {
            return self::MAX_CONTRACT_EXPIRY_WARNING_DAYS;
        }

        return $value;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function getGoogleServiceAccountCredentialsFromEnv(): ?array
    {
        $jsonFromEnv = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
        if (is_string($jsonFromEnv) && trim($jsonFromEnv) !== '') {
            $decoded = json_decode($jsonFromEnv, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $base64Json = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64');
        if (is_string($base64Json) && trim($base64Json) !== '') {
            $decodedBase64 = base64_decode($base64Json, true);
            if ($decodedBase64 !== false) {
                $decoded = json_decode($decodedBase64, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        $jsonPath = env('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_PATH');
        if (is_string($jsonPath) && trim($jsonPath) !== '' && is_file($jsonPath)) {
            $content = file_get_contents($jsonPath);
            if (is_string($content) && trim($content) !== '') {
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        return null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function decodeGoogleServiceAccountCredentials(mixed $value): ?array
    {
        $raw = $this->normalizeNullableString($value);
        if ($raw === null) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        try {
            $decrypted = Crypt::decryptString($raw);
        } catch (\Throwable) {
            return null;
        }

        $decoded = json_decode($decrypted, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function saveGoogleDriveIntegrationTestResult(string $status, string $message): void
    {
        if (! $this->hasTable('integration_settings')) {
            return;
        }

        DB::table('integration_settings')
            ->where('provider', self::GOOGLE_DRIVE_INTEGRATION_PROVIDER)
            ->update([
                'last_tested_at' => now(),
                'last_test_status' => strtoupper($status),
                'last_test_message' => Str::limit(trim($message), 500, '...'),
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array{success:bool,driveFileId?:string,fileUrl?:string,errorMessage?:string}
     */
    private function uploadFileToGoogleDrive(UploadedFile $file): array
    {
        $config = $this->resolveGoogleDriveRuntimeConfig();
        $credentials = $config['credentials'] ?? null;
        if ($credentials === null) {
            return [
                'success' => false,
                'errorMessage' => 'Thiếu Service Account JSON.',
            ];
        }

        $accessToken = $this->requestGoogleDriveAccessToken(
            $credentials,
            (string) ($config['scopes'] ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE),
            (string) ($config['impersonate_user'] ?? '')
        );
        if ($accessToken === null) {
            return [
                'success' => false,
                'errorMessage' => 'Không thể lấy access token từ Service Account.',
            ];
        }

        $targetValidation = $this->validateGoogleDriveTarget($config, $accessToken);
        if (! ($targetValidation['success'] ?? false)) {
            return [
                'success' => false,
                'errorMessage' => trim((string) ($targetValidation['errorMessage'] ?? 'Google Drive chưa sẵn sàng để nhận file.')),
            ];
        }

        $namePrefix = trim((string) ($config['file_prefix'] ?? ''));
        $safePrefix = $namePrefix !== '' ? $namePrefix.'_' : '';
        $driveFileName = $safePrefix.now()->format('Ymd_His').'_'.Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $extension = trim((string) pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
        if ($extension !== '') {
            $driveFileName .= '.'.$extension;
        }

        $metadata = ['name' => $driveFileName];
        $folderId = trim((string) ($config['folder_id'] ?? ''));
        if ($folderId !== '') {
            $metadata['parents'] = [$folderId];
        }

        $contentType = $file->getClientMimeType() ?: 'application/octet-stream';
        $fileContents = file_get_contents($file->getRealPath());
        if (! is_string($fileContents)) {
            throw new \RuntimeException('Không thể đọc nội dung file tải lên.');
        }

        $uploadResponse = $this->performGoogleDriveMultipartUpload(
            $accessToken,
            $metadata,
            $fileContents,
            $contentType
        );

        if (
            ! $uploadResponse->successful()
            && $folderId !== ''
            && $this->shouldRetryGoogleDriveUploadWithoutFolder($uploadResponse)
        ) {
            $uploadResponse = $this->performGoogleDriveMultipartUpload(
                $accessToken,
                ['name' => $driveFileName],
                $fileContents,
                $contentType
            );
        }

        if (! $uploadResponse->successful()) {
            return [
                'success' => false,
                'errorMessage' => $this->resolveGoogleDriveErrorMessage($uploadResponse),
            ];
        }

        $payload = $uploadResponse->json();
        if (! is_array($payload) || empty($payload['id'])) {
            return [
                'success' => false,
                'errorMessage' => 'Google Drive không trả về thông tin file sau khi tải lên.',
            ];
        }

        $driveFileId = (string) $payload['id'];
        $fileUrl = (string) ($payload['webViewLink'] ?? $payload['webContentLink'] ?? '');
        if ($fileUrl === '') {
            $fileUrl = "https://drive.google.com/file/d/{$driveFileId}/view";
        }

        return [
            'success' => true,
            'driveFileId' => $driveFileId,
            'fileUrl' => $fileUrl,
        ];
    }

    private function performGoogleDriveMultipartUpload(
        string $accessToken,
        array $metadata,
        string $fileContents,
        string $contentType
    ): \Illuminate\Http\Client\Response {
        $boundary = 'vnpt_boundary_'.Str::random(16);
        $multipartBody = "--{$boundary}\r\n";
        $multipartBody .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
        $multipartBody .= json_encode($metadata, JSON_UNESCAPED_UNICODE)."\r\n";
        $multipartBody .= "--{$boundary}\r\n";
        $multipartBody .= "Content-Type: {$contentType}\r\n\r\n";
        $multipartBody .= $fileContents."\r\n";
        $multipartBody .= "--{$boundary}--";

        $uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink&supportsAllDrives=true';

        return Http::withToken($accessToken)
            ->withBody($multipartBody, "multipart/related; boundary={$boundary}")
            ->timeout(60)
            ->post($uploadUrl);
    }

    private function shouldRetryGoogleDriveUploadWithoutFolder(\Illuminate\Http\Client\Response $response): bool
    {
        if (! in_array($response->status(), [403, 404], true)) {
            return false;
        }

        $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
        if (in_array($reason, ['notfound', 'forbidden'], true)) {
            return true;
        }

        $message = strtolower(trim((string) ($response->json('error.message') ?? '')));

        return str_contains($message, 'file not found') || str_contains($message, 'insufficient');
    }

    private function resolveGoogleDriveErrorMessage(\Illuminate\Http\Client\Response $response): string
    {
        $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
        $message = trim((string) ($response->json('error.message') ?? ''));

        if ($reason === 'storagequotaexceeded') {
            return 'Google Drive từ chối tải file vì Service Account không có quota lưu trữ. Hãy dùng Shared Drive hoặc cấu hình Impersonate user.';
        }

        if ($reason === 'notfound') {
            return 'Google Drive không tìm thấy thư mục đích. Hãy kiểm tra lại Folder ID và quyền chia sẻ cho Service Account.';
        }

        if ($reason === 'forbidden') {
            return 'Service Account chưa có quyền ghi file vào Google Drive đích.';
        }

        if ($message !== '') {
            return 'Google Drive trả về lỗi: '.$message;
        }

        return 'Google Drive trả về lỗi khi tải file.';
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function validateGoogleDriveTarget(array $runtimeConfig, string $accessToken): array
    {
        $folderId = trim((string) ($runtimeConfig['folder_id'] ?? ''));
        if ($folderId === '') {
            return ['success' => true];
        }

        $response = Http::withToken($accessToken)
            ->timeout(30)
            ->get('https://www.googleapis.com/drive/v3/files/'.rawurlencode($folderId), [
                'fields' => 'id,name,mimeType,driveId,trashed,capabilities(canAddChildren)',
                'supportsAllDrives' => 'true',
            ]);

        if (! $response->successful()) {
            $driveResponse = Http::withToken($accessToken)
                ->timeout(30)
                ->get('https://www.googleapis.com/drive/v3/drives/'.rawurlencode($folderId));

            if ($driveResponse->successful()) {
                return [
                    'success' => false,
                    'errorMessage' => 'Giá trị Google Drive Folder ID hiện là Shared Drive ID, không phải Folder ID. Hãy mở một thư mục bên trong Shared Drive và copy ID sau /folders/.',
                ];
            }

            $reason = strtolower(trim((string) ($response->json('error.errors.0.reason') ?? '')));
            $message = trim((string) ($response->json('error.message') ?? ''));

            if ($reason === 'notfound') {
                return [
                    'success' => false,
                    'errorMessage' => 'Google Drive không tìm thấy thư mục đích. Hãy kiểm tra lại Folder ID và quyền chia sẻ cho Service Account.',
                ];
            }

            if ($reason === 'forbidden') {
                return [
                    'success' => false,
                    'errorMessage' => 'Service Account chưa có quyền truy cập thư mục Google Drive đích.',
                ];
            }

            return [
                'success' => false,
                'errorMessage' => $message !== ''
                    ? 'Google Drive trả về lỗi: '.$message
                    : 'Không thể truy cập thư mục Google Drive đích.',
            ];
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return [
                'success' => false,
                'errorMessage' => 'Không thể đọc thông tin thư mục Google Drive đích.',
            ];
        }

        $mimeType = trim((string) ($payload['mimeType'] ?? ''));
        if ($mimeType !== 'application/vnd.google-apps.folder') {
            return [
                'success' => false,
                'errorMessage' => 'Google Drive Folder ID hiện không trỏ tới một thư mục hợp lệ.',
            ];
        }

        if ((bool) ($payload['trashed'] ?? false)) {
            return [
                'success' => false,
                'errorMessage' => 'Thư mục Google Drive đích đang nằm trong thùng rác.',
            ];
        }

        $driveId = $this->normalizeNullableString($payload['driveId'] ?? null);
        $impersonateUser = trim((string) ($runtimeConfig['impersonate_user'] ?? ''));
        if ($driveId === null && $impersonateUser === '') {
            return [
                'success' => false,
                'errorMessage' => 'Folder ID hiện trỏ tới thư mục trong My Drive, không phải Shared Drive. Với Service Account, bạn phải dùng Shared Drive hoặc cấu hình Impersonate user.',
            ];
        }

        $canAddChildren = data_get($payload, 'capabilities.canAddChildren');
        if ($canAddChildren === false) {
            return [
                'success' => false,
                'errorMessage' => 'Service Account hiện chưa có quyền thêm file vào thư mục Google Drive đích.',
            ];
        }

        return ['success' => true];
    }

    /**
     * @param array<string, mixed> $runtimeConfig
     * @return array{success:bool,errorMessage?:string}
     */
    private function verifyGoogleDriveUploadCapability(array $runtimeConfig, string $accessToken): array
    {
        $targetValidation = $this->validateGoogleDriveTarget($runtimeConfig, $accessToken);
        if (! ($targetValidation['success'] ?? false)) {
            return $targetValidation;
        }

        $metadata = [
            'name' => 'vnpt_connection_test_'.now()->format('Ymd_His').'.txt',
        ];

        $folderId = trim((string) ($runtimeConfig['folder_id'] ?? ''));
        if ($folderId !== '') {
            $metadata['parents'] = [$folderId];
        }

        $response = $this->performGoogleDriveMultipartUpload(
            $accessToken,
            $metadata,
            'VNPT connection test',
            'text/plain'
        );

        if (! $response->successful()) {
            return [
                'success' => false,
                'errorMessage' => $this->resolveGoogleDriveErrorMessage($response),
            ];
        }

        $payload = $response->json();
        $driveFileId = is_array($payload) ? trim((string) ($payload['id'] ?? '')) : '';
        if ($driveFileId === '') {
            return [
                'success' => false,
                'errorMessage' => 'Google Drive không trả về ID file test sau khi tải lên.',
            ];
        }

        $this->deleteGoogleDriveFileByAccessToken($accessToken, $driveFileId);

        return ['success' => true];
    }

    /**
     * @param array<string,mixed> $credentials
     */
    private function requestGoogleDriveAccessToken(
        array $credentials,
        ?string $scopes = null,
        ?string $impersonateUser = null
    ): ?string
    {
        $clientEmail = trim((string) ($credentials['client_email'] ?? ''));
        $privateKey = (string) ($credentials['private_key'] ?? '');
        if ($clientEmail === '' || trim($privateKey) === '') {
            return null;
        }

        $now = time();
        $tokenUri = trim((string) ($credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token'));
        $resolvedScopes = trim((string) ($scopes ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE));
        if ($resolvedScopes === '') {
            $resolvedScopes = self::GOOGLE_DRIVE_DEFAULT_SCOPE;
        }
        $subject = trim((string) ($impersonateUser ?? ''));

        $claims = [
            'iss' => $clientEmail,
            'scope' => $resolvedScopes,
            'aud' => $tokenUri,
            'exp' => $now + 3600,
            'iat' => $now,
        ];
        if ($subject !== '') {
            $claims['sub'] = $subject;
        }

        $jwt = $this->buildGoogleServiceAccountJwt($claims, $privateKey);
        if ($jwt === null) {
            return null;
        }

        $tokenResponse = Http::asForm()
            ->timeout(30)
            ->post($tokenUri, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

        if (! $tokenResponse->successful()) {
            return null;
        }

        $accessToken = $tokenResponse->json('access_token');
        return is_string($accessToken) && $accessToken !== '' ? $accessToken : null;
    }

    /**
     * @param array<string,mixed> $claims
     */
    private function buildGoogleServiceAccountJwt(array $claims, string $privateKey): ?string
    {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $encodedHeader = $this->base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES) ?: '');
        $encodedClaims = $this->base64UrlEncode(json_encode($claims, JSON_UNESCAPED_SLASHES) ?: '');
        if ($encodedHeader === '' || $encodedClaims === '') {
            return null;
        }

        $signatureInput = $encodedHeader.'.'.$encodedClaims;
        $signature = '';
        $signed = openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        if (! $signed) {
            return null;
        }

        return $signatureInput.'.'.$this->base64UrlEncode($signature);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function deleteGoogleDriveFile(string $driveFileId): void
    {
        if (! $this->isGoogleDriveConfigured()) {
            return;
        }

        $config = $this->resolveGoogleDriveRuntimeConfig();
        $credentials = $config['credentials'] ?? null;
        if ($credentials === null) {
            return;
        }

        $accessToken = $this->requestGoogleDriveAccessToken(
            $credentials,
            (string) ($config['scopes'] ?? self::GOOGLE_DRIVE_DEFAULT_SCOPE),
            (string) ($config['impersonate_user'] ?? '')
        );
        if ($accessToken === null) {
            return;
        }

        $this->deleteGoogleDriveFileByAccessToken($accessToken, $driveFileId);
    }

    private function deleteGoogleDriveFileByAccessToken(string $accessToken, string $driveFileId): void
    {
        $endpoint = 'https://www.googleapis.com/drive/v3/files/'.rawurlencode($driveFileId).'?supportsAllDrives=true';
        Http::withToken($accessToken)->timeout(30)->delete($endpoint);
    }

    private function deleteLocalDocumentFileByUrl(string $fileUrl): void
    {
        $parsedQuery = parse_url($fileUrl, PHP_URL_QUERY);
        if (is_string($parsedQuery) && $parsedQuery !== '') {
            parse_str($parsedQuery, $queryParams);
            $pathFromQuery = isset($queryParams['path']) ? trim((string) $queryParams['path']) : '';
            if ($pathFromQuery !== '') {
                $diskFromQuery = isset($queryParams['disk']) ? trim((string) $queryParams['disk']) : 'local';
                $this->deleteLocalDocumentFileByStoragePath($pathFromQuery, $diskFromQuery !== '' ? $diskFromQuery : 'local');

                return;
            }
        }

        $parsedPath = parse_url($fileUrl, PHP_URL_PATH);
        if (! is_string($parsedPath) || $parsedPath === '') {
            return;
        }

        $storagePrefix = '/storage/';
        if (! str_contains($parsedPath, $storagePrefix)) {
            return;
        }

        $relativePath = Str::after($parsedPath, $storagePrefix);
        if ($relativePath === '' || str_starts_with($relativePath, '/')) {
            return;
        }

        if (Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }
    }

    private function deleteLocalDocumentFileByStoragePath(string $storagePath, string $storageDisk = 'local'): void
    {
        $path = trim($storagePath);
        if ($path === '') {
            return;
        }

        $disk = trim($storageDisk) !== '' ? trim($storageDisk) : 'local';
        if ($disk === self::BACKBLAZE_B2_STORAGE_DISK) {
            $this->deleteBackblazeB2FileByStoragePath($path);

            return;
        }

        $this->prepareConfiguredStorageDisk($disk);
        if (! Storage::disk($disk)->exists($path)) {
            return;
        }

        Storage::disk($disk)->delete($path);
    }

    private function buildDocumentTypeCodeMap(): array
    {
        if (! $this->hasTable('document_types')) {
            return [];
        }

        $rows = DB::table('document_types')
            ->select($this->selectColumns('document_types', ['id', 'type_code']))
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            if (! array_key_exists('id', $row) || ! array_key_exists('type_code', $row)) {
                continue;
            }

            $map[(string) $row['id']] = (string) $row['type_code'];
        }

        return $map;
    }

    private function resolveDocumentTypeIdFromInput(mixed $input): ?int
    {
        if (! $this->hasTable('document_types')) {
            return $this->parseNullableInt($input);
        }

        $numeric = $this->parseNullableInt($input);
        if ($numeric !== null && DB::table('document_types')->where('id', $numeric)->exists()) {
            return $numeric;
        }

        $typeCode = trim((string) ($input ?? ''));
        if ($typeCode === '') {
            return null;
        }

        $resolved = DB::table('document_types')
            ->where('type_code', $typeCode)
            ->value('id');

        if ($resolved === null) {
            $resolved = DB::table('document_types')
                ->whereRaw('UPPER(type_code) = ?', [strtoupper($typeCode)])
                ->value('id');
        }

        return $this->parseNullableInt($resolved);
    }

    private function findDocumentRowByIdentifier(string $identifier): ?array
    {
        if (! $this->hasTable('documents')) {
            return null;
        }

        $token = trim($identifier);
        if ($token === '') {
            return null;
        }

        $numericId = $this->parseNullableInt($token);
        if ($numericId !== null) {
            $byIdQuery = DB::table('documents')->where('id', $numericId);
            if ($this->hasColumn('documents', 'deleted_at')) {
                $byIdQuery->whereNull('deleted_at');
            }
            $byId = $byIdQuery->first();
            if ($byId !== null) {
                return (array) $byId;
            }
        }

        if ($this->hasColumn('documents', 'document_code')) {
            $byCodeQuery = DB::table('documents')->where('document_code', $token);
            if ($this->hasColumn('documents', 'deleted_at')) {
                $byCodeQuery->whereNull('deleted_at');
            }
            $byCode = $byCodeQuery->first();
            if ($byCode !== null) {
                return (array) $byCode;
            }
        }

        return null;
    }

    private function loadDocumentByNumericId(int $documentId): ?array
    {
        if ($documentId <= 0 || ! $this->hasTable('documents')) {
            return null;
        }

        $record = DB::table('documents')
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
            ->where('id', $documentId)
            ->when($this->hasColumn('documents', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->first();

        if ($record === null) {
            return null;
        }

        $typeCodeMap = $this->buildDocumentTypeCodeMap();
        $attachmentMap = $this->loadDocumentAttachmentMap([$documentId]);
        $productIdsMap = $this->loadDocumentProductIdsMap([$documentId]);

        return $this->serializeDocumentRecord((array) $record, $typeCodeMap, $attachmentMap, $productIdsMap);
    }

    /**
     * @param array<int, int> $documentIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadDocumentAttachmentMap(array $documentIds): array
    {
        if (
            $documentIds === []
            || ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $rows = DB::table('attachments')
            ->select($this->selectColumns('attachments', [
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ]))
            ->where('reference_type', 'DOCUMENT')
            ->whereIn('reference_id', $documentIds)
            ->when($this->hasColumn('attachments', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->orderBy('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }

            $map[$referenceId][] = [
                'id' => (string) ($row['id'] ?? ''),
                'fileName' => (string) ($row['file_name'] ?? ''),
                'mimeType' => (string) ($this->firstNonEmpty($row, ['mime_type'], 'application/octet-stream')),
                'fileSize' => (int) ($row['file_size'] ?? 0),
                'fileUrl' => $this->resolveAttachmentFileUrl($row),
                'driveFileId' => (string) ($row['drive_file_id'] ?? ''),
                'createdAt' => $this->formatDateColumn($row['created_at'] ?? null) ?? '',
                'storagePath' => $this->normalizeNullableString($row['storage_path'] ?? null),
                'storageDisk' => $this->normalizeNullableString($row['storage_disk'] ?? null),
                'storageVisibility' => $this->normalizeNullableString($row['storage_visibility'] ?? null),
                'storageProvider' => $this->normalizeNullableString($row['drive_file_id'] ?? null) !== null
                    ? 'GOOGLE_DRIVE'
                    : (($this->normalizeNullableString($row['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
            ];
        }

        return $map;
    }

    /**
     * @param array<int, int> $documentIds
     * @return array<string, array<int, string>>
     */
    private function loadDocumentProductIdsMap(array $documentIds): array
    {
        if (
            $documentIds === []
            || ! $this->hasTable('document_product_links')
            || ! $this->hasColumn('document_product_links', 'document_id')
            || ! $this->hasColumn('document_product_links', 'product_id')
        ) {
            return [];
        }

        $rows = DB::table('document_product_links')
            ->select($this->selectColumns('document_product_links', [
                'document_id',
                'product_id',
            ]))
            ->whereIn('document_id', $documentIds)
            ->orderBy('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $documentId = (string) ($row['document_id'] ?? '');
            $productId = (string) ($row['product_id'] ?? '');
            if ($documentId === '' || $productId === '') {
                continue;
            }

            $map[$documentId] ??= [];
            if (! in_array($productId, $map[$documentId], true)) {
                $map[$documentId][] = $productId;
            }
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $productIds
     * @return array<int, int>
     */
    private function normalizeDocumentProductIds(array $productIds): array
    {
        $normalized = [];
        foreach ($productIds as $value) {
            $productId = $this->parseNullableInt($value);
            if ($productId === null || $productId <= 0) {
                continue;
            }

            $normalized[] = $productId;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param array<int, int> $productIds
     */
    private function validateProductIds(array $productIds): bool
    {
        if ($productIds === []) {
            return true;
        }

        if (! $this->hasTable('products')) {
            return false;
        }

        $query = DB::table('products')->whereIn('id', $productIds);
        if ($this->hasColumn('products', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        $count = $query->count();
        return $count === count($productIds);
    }

    /**
     * @param array<int, int> $productIds
     */
    private function syncDocumentProductLinks(int $documentId, array $productIds, ?int $actorId): void
    {
        if (
            ! $this->hasTable('document_product_links')
            || ! $this->hasColumn('document_product_links', 'document_id')
            || ! $this->hasColumn('document_product_links', 'product_id')
        ) {
            return;
        }

        DB::table('document_product_links')
            ->where('document_id', $documentId)
            ->delete();

        if ($productIds === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($productIds as $productId) {
            $payload = $this->filterPayloadByTableColumns('document_product_links', [
                'document_id' => $documentId,
                'product_id' => $productId,
                'created_at' => $now,
                'created_by' => $actorId,
            ]);

            if (
                array_key_exists('document_id', $payload)
                && array_key_exists('product_id', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('document_product_links')->insert($records);
        }
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncDocumentAttachments(int $documentId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'DOCUMENT')
            ->where('reference_id', $documentId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) $this->firstNonEmpty($item, ['fileName', 'file_name'], ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->parseNullableInt($this->firstNonEmpty($item, ['fileSize', 'file_size'], 0)) ?? 0;
            $storagePath = $this->normalizeNullableString($this->firstNonEmpty($item, ['storagePath', 'storage_path']));
            $storageDisk = $this->normalizeNullableString($this->firstNonEmpty($item, ['storageDisk', 'storage_disk']));
            $storageVisibility = $this->normalizeNullableString($this->firstNonEmpty($item, ['storageVisibility', 'storage_visibility']));
            $payload = $this->filterPayloadByTableColumns('attachments', [
                'reference_type' => 'DOCUMENT',
                'reference_id' => $documentId,
                'file_name' => $fileName,
                'file_url' => $this->normalizeNullableString($this->firstNonEmpty($item, ['fileUrl', 'file_url'])),
                'drive_file_id' => $this->normalizeNullableString($this->firstNonEmpty($item, ['driveFileId', 'drive_file_id'])),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->normalizeNullableString($this->firstNonEmpty($item, ['mimeType', 'mime_type'])),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @param array<int, int> $scheduleIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function loadPaymentScheduleAttachmentMap(array $scheduleIds): array
    {
        if (
            $scheduleIds === []
            || ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return [];
        }

        $rows = DB::table('attachments')
            ->select($this->selectColumns('attachments', [
                'id',
                'reference_id',
                'file_name',
                'file_url',
                'drive_file_id',
                'file_size',
                'mime_type',
                'storage_disk',
                'storage_path',
                'storage_visibility',
                'created_at',
            ]))
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->whereIn('reference_id', $scheduleIds)
            ->when($this->hasColumn('attachments', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
            ->orderBy('id')
            ->get()
            ->map(fn (object $item): array => (array) $item)
            ->values();

        $map = [];
        foreach ($rows as $row) {
            $referenceId = (string) ($row['reference_id'] ?? '');
            if ($referenceId === '') {
                continue;
            }

            $map[$referenceId][] = [
                'id' => (string) ($row['id'] ?? ''),
                'fileName' => (string) ($row['file_name'] ?? ''),
                'mimeType' => (string) ($this->firstNonEmpty($row, ['mime_type'], 'application/octet-stream')),
                'fileSize' => (int) ($row['file_size'] ?? 0),
                'fileUrl' => $this->resolveAttachmentFileUrl($row),
                'driveFileId' => (string) ($row['drive_file_id'] ?? ''),
                'createdAt' => $this->formatDateColumn($row['created_at'] ?? null) ?? '',
                'storagePath' => $this->normalizeNullableString($row['storage_path'] ?? null),
                'storageDisk' => $this->normalizeNullableString($row['storage_disk'] ?? null),
                'storageVisibility' => $this->normalizeNullableString($row['storage_visibility'] ?? null),
                'storageProvider' => $this->normalizeNullableString($row['drive_file_id'] ?? null) !== null
                    ? 'GOOGLE_DRIVE'
                    : (($this->normalizeNullableString($row['storage_disk'] ?? null) === self::BACKBLAZE_B2_STORAGE_DISK) ? 'BACKBLAZE_B2' : 'LOCAL'),
            ];
        }

        return $map;
    }

    /**
     * @param array<int, mixed> $attachments
     */
    private function syncPaymentScheduleAttachments(int $scheduleId, array $attachments, ?int $actorId): void
    {
        if (
            ! $this->hasTable('attachments')
            || ! $this->hasColumn('attachments', 'reference_type')
            || ! $this->hasColumn('attachments', 'reference_id')
        ) {
            return;
        }

        DB::table('attachments')
            ->where('reference_type', 'PAYMENT_SCHEDULE')
            ->where('reference_id', $scheduleId)
            ->delete();

        if ($attachments === []) {
            return;
        }

        $now = now();
        $records = [];
        foreach ($attachments as $item) {
            if (! is_array($item)) {
                continue;
            }

            $fileName = trim((string) $this->firstNonEmpty($item, ['fileName', 'file_name'], ''));
            if ($fileName === '') {
                continue;
            }

            $fileSize = $this->parseNullableInt($this->firstNonEmpty($item, ['fileSize', 'file_size'], 0)) ?? 0;
            $storagePath = $this->normalizeNullableString($this->firstNonEmpty($item, ['storagePath', 'storage_path']));
            $storageDisk = $this->normalizeNullableString($this->firstNonEmpty($item, ['storageDisk', 'storage_disk']));
            $storageVisibility = $this->normalizeNullableString($this->firstNonEmpty($item, ['storageVisibility', 'storage_visibility']));
            $payload = $this->filterPayloadByTableColumns('attachments', [
                'reference_type' => 'PAYMENT_SCHEDULE',
                'reference_id' => $scheduleId,
                'file_name' => $fileName,
                'file_url' => $this->normalizeNullableString($this->firstNonEmpty($item, ['fileUrl', 'file_url'])),
                'drive_file_id' => $this->normalizeNullableString($this->firstNonEmpty($item, ['driveFileId', 'drive_file_id'])),
                'file_size' => max(0, $fileSize),
                'mime_type' => $this->normalizeNullableString($this->firstNonEmpty($item, ['mimeType', 'mime_type'])),
                'storage_path' => $storagePath,
                'storage_disk' => $storageDisk,
                'storage_visibility' => $storageVisibility ?? ($storagePath !== null ? 'private' : null),
                'created_at' => $now,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            if (
                array_key_exists('reference_type', $payload)
                && array_key_exists('reference_id', $payload)
                && array_key_exists('file_name', $payload)
            ) {
                $records[] = $payload;
            }
        }

        if ($records !== []) {
            DB::table('attachments')->insert($records);
        }
    }

    /**
     * @param array<string, mixed> $attachment
     */
    private function resolveAttachmentFileUrl(array $attachment): string
    {
        $storedPath = $this->normalizeNullableString($attachment['storage_path'] ?? null);
        $storedDisk = $this->normalizeNullableString($attachment['storage_disk'] ?? null) ?? 'local';
        $fileName = $this->normalizeNullableString($attachment['file_name'] ?? null) ?? 'attachment';
        $attachmentId = $this->parseNullableInt($attachment['id'] ?? null);

        if ($storedPath !== null) {
            if ($attachmentId !== null) {
                $signedUrl = $this->buildSignedAttachmentDownloadUrl($attachmentId);
                if ($signedUrl !== '') {
                    return $signedUrl;
                }
            }

            $temporaryUrl = $this->buildSignedTempAttachmentDownloadUrl($storedDisk, $storedPath, $fileName);
            if ($temporaryUrl !== '') {
                return $temporaryUrl;
            }
        }

        return (string) ($attachment['file_url'] ?? '');
    }

    private function buildSignedAttachmentDownloadUrl(int $attachmentId): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                ['id' => $attachmentId],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function buildSignedTempAttachmentDownloadUrl(string $disk, string $path, string $name): string
    {
        try {
            return URL::temporarySignedRoute(
                'v5.documents.attachments.temp-download',
                now()->addMinutes(self::ATTACHMENT_SIGNED_URL_TTL_MINUTES),
                [
                    'disk' => $disk,
                    'path' => $path,
                    'name' => $name,
                ],
                false
            );
        } catch (\Throwable) {
            return '';
        }
    }

    private function serializeDocumentRecord(
        array $row,
        array $documentTypeCodeById,
        array $attachmentMap,
        array $productIdsMap
    ): array {
        $status = $this->normalizeDocumentStatus((string) ($row['status'] ?? 'ACTIVE'));
        $documentId = (string) ($row['id'] ?? '');
        $documentCode = (string) ($this->firstNonEmpty($row, ['document_code', 'id'], ''));
        $documentTypeId = (string) ($row['document_type_id'] ?? '');
        $typeId = $documentTypeCodeById[$documentTypeId] ?? $documentTypeId;
        $productIds = $productIdsMap[$documentId] ?? [];
        $customerId = $this->parseNullableInt($row['customer_id'] ?? null);
        $normalizedCustomerId = ($customerId !== null && $customerId > 0) ? (string) $customerId : '';

        return [
            'id' => $documentCode,
            'name' => (string) ($row['document_name'] ?? ''),
            'typeId' => (string) $typeId,
            'customerId' => $normalizedCustomerId,
            'projectId' => $row['project_id'] === null ? null : (string) $row['project_id'],
            'productId' => $productIds[0] ?? null,
            'productIds' => $productIds,
            'expiryDate' => $this->formatDateColumn($row['expiry_date'] ?? null),
            'status' => $status,
            'attachments' => $attachmentMap[$documentId] ?? [],
            'createdDate' => $this->formatDateColumn($row['created_at'] ?? null),
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

    private function isColumnNullable(string $table, string $column): bool
    {
        if (! $this->hasColumn($table, $column)) {
            return false;
        }

        try {
            $databaseName = DB::getDatabaseName();
            $columnInfo = DB::table('information_schema.COLUMNS')
                ->select(['IS_NULLABLE'])
                ->where('TABLE_SCHEMA', $databaseName)
                ->where('TABLE_NAME', $table)
                ->where('COLUMN_NAME', $column)
                ->first();

            if ($columnInfo === null) {
                return false;
            }

            return strtoupper((string) ($columnInfo->IS_NULLABLE ?? 'NO')) === 'YES';
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

    private function resolveAuthenticatedUserId(Request $request): ?int
    {
        return $this->parseNullableInt($request->user()?->id ?? null);
    }

    private function denyScopeMutation(string $resource): JsonResponse
    {
        return response()->json([
            'message' => "Bạn không có quyền truy cập {$resource} này.",
        ], 403);
    }

    private function authorizeMutationByScope(Request $request, string $resource, ?int $departmentId, ?int $ownerId = null): ?JsonResponse
    {
        $userId = $this->resolveAuthenticatedUserId($request);
        if ($userId === null) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $accessService = app(UserAccessService::class);
        if ($accessService->isAdmin($userId)) {
            return null;
        }

        if ($departmentId !== null) {
            $allowedDepartmentIds = $accessService->resolveDepartmentIdsForUser($userId);
            if ($allowedDepartmentIds === null || in_array($departmentId, $allowedDepartmentIds, true)) {
                return null;
            }

            return $this->denyScopeMutation($resource);
        }

        if ($ownerId !== null && $ownerId === $userId) {
            return null;
        }

        return $this->denyScopeMutation($resource);
    }

    private function extractIntFromRecord(array $record, array $keys): ?int
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $record)) {
                continue;
            }

            $value = $this->parseNullableInt($record[$key]);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function resolveOpportunityDepartmentIdById(?int $opportunityId): ?int
    {
        if ($opportunityId === null || ! $this->hasTable('opportunities')) {
            return null;
        }

        $selects = ['id'];
        if ($this->hasColumn('opportunities', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->hasColumn('opportunities', 'department_id')) {
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

    private function resolveProjectDepartmentIdById(?int $projectId): ?int
    {
        if ($projectId === null || ! $this->hasTable('projects')) {
            return null;
        }

        $selects = ['id'];
        if ($this->hasColumn('projects', 'dept_id')) {
            $selects[] = 'dept_id';
        }
        if ($this->hasColumn('projects', 'department_id')) {
            $selects[] = 'department_id';
        }
        if ($this->hasColumn('projects', 'opportunity_id')) {
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

    private function resolveDepartmentIdForTableRecord(string $table, array $record): ?int
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

    private function assertModelMutationAccess(Request $request, Model $model, string $resource): ?JsonResponse
    {
        $table = (string) $model->getTable();
        $record = $model->getAttributes();

        $departmentId = $this->resolveDepartmentIdForTableRecord($table, $record);
        $ownerId = $this->extractIntFromRecord($record, ['created_by', 'owner_id', 'updated_by']);

        return $this->authorizeMutationByScope($request, $resource, $departmentId, $ownerId);
    }

    /**
     * @return array<string, mixed>
     */
    private function toAuditArray(mixed $value): array
    {
        if ($value instanceof Model) {
            return $value->getAttributes();
        }

        if (is_object($value)) {
            return (array) $value;
        }

        if (is_array($value)) {
            return $value;
        }

        return [];
    }

    private function encodeAuditValues(?array $values): ?string
    {
        if ($values === null || $values === []) {
            return null;
        }

        /** @var AuditValueSanitizer $sanitizer */
        $sanitizer = app(AuditValueSanitizer::class);
        $encoded = json_encode(
            $sanitizer->sanitize($values),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        return is_string($encoded) ? $encoded : null;
    }

    private function recordAuditEvent(
        Request $request,
        string $event,
        string $auditableType,
        int|string|null $auditableId,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        if (! $this->hasTable('audit_logs')) {
            return;
        }

        $eventCode = strtoupper(trim($event));
        if (! in_array($eventCode, ['INSERT', 'UPDATE', 'DELETE', 'RESTORE'], true)) {
            return;
        }

        $auditableIdValue = $this->parseNullableInt($auditableId);
        if ($auditableIdValue === null) {
            return;
        }

        try {
            $payload = [
                'uuid' => (string) Str::uuid(),
                'event' => $eventCode,
                'auditable_type' => $auditableType,
                'auditable_id' => $auditableIdValue,
                'old_values' => $this->encodeAuditValues($oldValues),
                'new_values' => $this->encodeAuditValues($newValues),
                'url' => $request->fullUrl(),
                'ip_address' => $request->ip(),
                'user_agent' => $this->normalizeNullableString($request->userAgent()),
                'created_at' => now(),
                'created_by' => $this->resolveAuthenticatedUserId($request),
            ];

            $insertPayload = $this->filterPayloadByTableColumns('audit_logs', $payload);
            if ($insertPayload === []) {
                return;
            }

            DB::table('audit_logs')->insert($insertPayload);
        } catch (\Throwable) {
            // Không để lỗi audit làm gián đoạn luồng nghiệp vụ.
        }
    }

    private function deleteModel(Request $request, Model $model, string $resource): JsonResponse
    {
        $scopeError = $this->assertModelMutationAccess($request, $model, $resource);
        if ($scopeError instanceof JsonResponse) {
            return $scopeError;
        }

        $before = $this->toAuditArray($model);
        $table = (string) $model->getTable();
        $auditableId = $model->getKey();

        try {
            $model->delete();
            $this->recordAuditEvent($request, 'DELETE', $table, $auditableId, $before, null);

            return response()->json(['message' => "{$resource} deleted."]);
        } catch (QueryException) {
            return response()->json([
                'message' => "{$resource} is referenced by other records and cannot be deleted.",
            ], 422);
        }
    }

    private function shouldPaginate(Request $request): bool
    {
        return $request->query->has('page') || $request->query->has('per_page');
    }

    private function shouldUseSimplePagination(Request $request): bool
    {
        return filter_var($request->query('simple', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @return array{0:int,1:int}
     */
    private function resolvePaginationParams(Request $request, int $defaultPerPage = 20, int $maxPerPage = 200): array
    {
        $page = max(1, (int) $request->integer('page', 1));
        $perPage = max(1, min($maxPerPage, (int) $request->integer('per_page', $defaultPerPage)));

        return [$page, $perPage];
    }

    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    private function buildPaginationMeta(int $page, int $perPage, int $total): array
    {
        $safePage = max(1, $page);
        $safePerPage = max(1, $perPage);
        $totalPages = max(1, (int) ceil($total / $safePerPage));

        return [
            'page' => $safePage,
            'per_page' => $safePerPage,
            'total' => max(0, $total),
            'total_pages' => $totalPages,
        ];
    }

    /**
     * @return array{page:int,per_page:int,total:int,total_pages:int}
     */
    private function buildSimplePaginationMeta(int $page, int $perPage, int $currentItemCount, bool $hasMorePages): array
    {
        $safePage = max(1, $page);
        $safePerPage = max(1, $perPage);
        $safeCount = max(0, $currentItemCount);
        $minimumTotal = (($safePage - 1) * $safePerPage) + $safeCount + ($hasMorePages ? 1 : 0);

        return [
            'page' => $safePage,
            'per_page' => $safePerPage,
            'total' => $minimumTotal,
            'total_pages' => $hasMorePages ? ($safePage + 1) : $safePage,
        ];
    }

    private function resolveSortDirection(Request $request): string
    {
        $raw = strtolower(trim((string) $request->query('sort_dir', 'desc')));

        return $raw === 'asc' ? 'asc' : 'desc';
    }

    /**
     * @param array<string, string> $allowed
     */
    private function resolveSortColumn(Request $request, array $allowed, string $fallback): string
    {
        $raw = trim((string) $request->query('sort_by', ''));
        if ($raw === '') {
            return $fallback;
        }

        return $allowed[$raw] ?? $fallback;
    }

    private function readFilterParam(Request $request, string $key, mixed $default = null): mixed
    {
        $filters = $request->query('filters');
        if (is_array($filters) && array_key_exists($key, $filters)) {
            return $filters[$key];
        }

        return $request->query($key, $default);
    }

    private function normalizeDateFilter(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }

        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', $raw);
        $errors = \DateTimeImmutable::getLastErrors();
        if (
            $parsed === false
            || ($errors !== false && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0))
        ) {
            return null;
        }

        return $parsed->format('Y-m-d');
    }

    private function resolveContractStartDateForTerm(?string $effectiveDate, ?string $signDate): ?string
    {
        $normalizedEffectiveDate = $this->normalizeDateFilter($effectiveDate);
        if ($normalizedEffectiveDate !== null) {
            return $normalizedEffectiveDate;
        }

        $normalizedSignDate = $this->normalizeDateFilter($signDate);
        if ($normalizedSignDate !== null) {
            return $normalizedSignDate;
        }

        return Carbon::now()->subDay()->toDateString();
    }

    private function resolveContractExpiryDateFromTerm(
        ?string $termUnit,
        ?float $termValue,
        ?string $effectiveDate,
        ?string $signDate
    ): ?string {
        $normalizedTermUnit = strtoupper(trim((string) ($termUnit ?? '')));
        if (! in_array($normalizedTermUnit, self::CONTRACT_TERM_UNITS, true)) {
            return null;
        }

        if ($termValue === null || ! is_finite($termValue) || $termValue <= 0) {
            return null;
        }

        $startDate = $this->resolveContractStartDateForTerm($effectiveDate, $signDate);
        if ($startDate === null) {
            return null;
        }

        try {
            $start = Carbon::createFromFormat('Y-m-d', $startDate)->startOfDay();
        } catch (\Throwable) {
            return null;
        }

        if ($normalizedTermUnit === 'DAY') {
            if (floor($termValue) !== $termValue) {
                return null;
            }

            return $start->copy()->addDays((int) $termValue - 1)->toDateString();
        }

        $months = (int) floor($termValue);
        $days = (int) round(($termValue - $months) * 30);
        if ($months === 0 && $days === 0) {
            $days = 1;
        }

        return $start
            ->copy()
            ->addMonthsNoOverflow($months)
            ->addDays($days - 1)
            ->toDateString();
    }

    private function parseNullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_float($value) || is_int($value)) {
            return (float) $value;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }

    private function numericValueHasMoreThanTwoDecimals(mixed $value): bool
    {
        $number = $this->parseNullableFloat($value);
        if ($number === null) {
            return false;
        }

        return abs($number - round($number, 2)) > 0.0000001;
    }

    private function numericValueIsWholeNumber(float $value): bool
    {
        return abs($value - round($value)) < 0.0000001;
    }

    private function formatProgressValue(float $value): string
    {
        if (is_infinite($value) || is_nan($value)) {
            return '0';
        }

        if (floor($value) === $value) {
            return (string) (int) $value;
        }

        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
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
        $normalizedPhone = $this->normalizeNullableString($this->firstNonEmpty($data, ['phone_number', 'phone', 'mobile']));
        $data['phone_number'] = $normalizedPhone;
        $data['phone'] = $normalizedPhone;
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

        $data['status'] = $this->fromProjectStorageStatus((string) ($data['status'] ?? 'TRIAL'));

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
        $termUnitRaw = strtoupper(trim((string) $this->firstNonEmpty($data, ['term_unit'], '')));
        $data['term_unit'] = in_array($termUnitRaw, self::CONTRACT_TERM_UNITS, true) ? $termUnitRaw : null;
        $data['term_value'] = $this->parseNullableFloat($this->firstNonEmpty($data, ['term_value']));
        $data['expiry_date_manual_override'] = (bool) $this->firstNonEmpty(
            $data,
            ['expiry_date_manual_override'],
            false
        );

        if ($this->firstNonEmpty($data, ['customer_id']) === null && isset($data['project']['customer_id'])) {
            $data['customer_id'] = $data['project']['customer_id'];
        }

        if (isset($data['customer']) && is_array($data['customer'])) {
            $data['customer']['customer_name'] = (string) $this->firstNonEmpty($data['customer'], ['customer_name', 'company_name'], '');
        }

        return $data;
    }

    private function serializePaymentScheduleRows($records): \Illuminate\Support\Collection
    {
        $normalizedRecords = collect($records)
            ->map(fn ($record): array => is_array($record) ? $record : (array) $record)
            ->values();

        $scheduleIds = $normalizedRecords
            ->map(fn (array $record): ?int => $this->parseNullableInt($record['id'] ?? null))
            ->filter(fn (?int $scheduleId): bool => $scheduleId !== null)
            ->unique()
            ->values()
            ->all();

        $confirmedByIds = $normalizedRecords
            ->map(fn (array $record): ?int => $this->parseNullableInt($record['confirmed_by'] ?? null))
            ->filter(fn (?int $userId): bool => $userId !== null)
            ->unique()
            ->values()
            ->all();

        $attachmentMap = $this->loadPaymentScheduleAttachmentMap($scheduleIds);
        $actorMap = $this->resolveAuditActorMap($confirmedByIds);

        return $normalizedRecords
            ->map(fn (array $record): array => $this->serializePaymentScheduleRecord($record, $attachmentMap, $actorMap))
            ->values();
    }

    private function serializePaymentScheduleRecord(array $record, array $attachmentMap = [], array $actorMap = []): array
    {
        $recordId = (string) ($record['id'] ?? '');
        $confirmedById = $this->parseNullableInt($record['confirmed_by'] ?? null);
        $confirmedByName = null;
        if ($confirmedById !== null) {
            $actor = $actorMap[(string) $confirmedById] ?? null;
            if (is_array($actor)) {
                $resolvedName = trim((string) $this->firstNonEmpty($actor, ['full_name', 'username'], ''));
                $confirmedByName = $resolvedName !== '' ? $resolvedName : null;
            }
        }

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
            'confirmed_by' => $confirmedById,
            'confirmed_by_name' => $confirmedByName,
            'confirmed_at' => $record['confirmed_at'] ?? null,
            'attachments' => $recordId !== '' ? ($attachmentMap[$recordId] ?? []) : [],
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
        $statusEnumValues = $this->projectStatusEnumValues();
        if ($statusEnumValues !== null && $statusEnumValues !== []) {
            if (in_array('PLANNING', $statusEnumValues, true) || in_array('ONGOING', $statusEnumValues, true)) {
                return false;
            }

            if (in_array('ACTIVE', $statusEnumValues, true) || in_array('TERMINATED', $statusEnumValues, true)) {
                return true;
            }
        }

        // Default to non-legacy when enum introspection is unavailable to avoid writing
        // ACTIVE/TERMINATED into modern project schemas.
        return false;
    }

    /**
     * @return array<int, string>|null
     */
    private function projectStatusEnumValues(): ?array
    {
        if (! $this->hasTable('projects') || ! $this->hasColumn('projects', 'status')) {
            return null;
        }

        try {
            $database = DB::connection()->getDatabaseName();
            if (! is_string($database) || $database === '') {
                return null;
            }

            $columnType = DB::table('information_schema.columns')
                ->where('table_schema', $database)
                ->where('table_name', 'projects')
                ->where('column_name', 'status')
                ->value('column_type');

            if (! is_string($columnType) || ! str_starts_with(strtolower($columnType), 'enum(')) {
                return null;
            }

            preg_match_all("/'([^']+)'/", $columnType, $matches);

            if (! isset($matches[1]) || ! is_array($matches[1])) {
                return null;
            }

            $values = array_values(array_unique(array_map(
                static fn (string $value): string => strtoupper(trim($value)),
                $matches[1]
            )));

            return $values === [] ? null : $values;
        } catch (\Throwable) {
            return null;
        }
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
        $normalized = strtoupper(trim($status));

        if ($this->usesLegacyProjectSchema()) {
            return match ($normalized) {
                'PLANNING', 'TRIAL', 'ONGOING' => 'ACTIVE',
                'WARRANTY', 'COMPLETED' => 'COMPLETED',
                'CANCELLED' => 'TERMINATED',
                default => 'ACTIVE',
            };
        }

        if ($normalized === 'PLANNING') {
            return 'TRIAL';
        }

        // Defensive mapping for older clients still sending legacy statuses.
        if ($normalized === 'ACTIVE') {
            return 'ONGOING';
        }
        if (in_array($normalized, ['TERMINATED', 'SUSPENDED', 'EXPIRED'], true)) {
            return 'CANCELLED';
        }

        return in_array($normalized, self::PROJECT_STATUSES, true) ? $normalized : 'TRIAL';
    }

    private function fromProjectStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'PLANNING', 'TRIAL' => 'TRIAL',
            'ONGOING', 'ACTIVE' => 'ONGOING',
            'WARRANTY' => 'WARRANTY',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED', 'TERMINATED', 'SUSPENDED', 'EXPIRED' => 'CANCELLED',
            default => 'TRIAL',
        };
    }

    private function isProjectDateRangeInvalid(?string $startDate, ?string $endDate): bool
    {
        if ($startDate === null || trim($startDate) === '' || $endDate === null || trim($endDate) === '') {
            return false;
        }

        $startTimestamp = strtotime($startDate);
        $endTimestamp = strtotime($endDate);

        if ($startTimestamp === false || $endTimestamp === false) {
            return false;
        }

        return $startTimestamp > $endTimestamp;
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
            'Ngày sinh phải cho số tuổi > %d và < %d.',
            self::EMPLOYEE_MIN_AGE_EXCLUSIVE,
            self::EMPLOYEE_MAX_AGE_EXCLUSIVE
        );
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
                'RENEWED', 'LIQUIDATED', 'EXPIRED', 'TERMINATED' => 'RENEWED',
                default => 'DRAFT',
            };
        }

        return in_array($normalized, self::CONTRACT_STATUSES, true) ? $normalized : 'DRAFT';
    }

    private function fromContractStorageStatus(string $status): string
    {
        $normalized = strtoupper($status);

        return match ($normalized) {
            'DRAFT', 'PENDING' => 'DRAFT',
            'SIGNED' => 'SIGNED',
            'RENEWED', 'EXPIRED', 'TERMINATED', 'LIQUIDATED' => 'RENEWED',
            default => 'DRAFT',
        };
    }

    private function toOpportunityStorageStage(string $stage): string
    {
        $normalized = $this->mapLegacyOpportunityStageCode($stage);
        if ($normalized === '') {
            $normalized = 'NEW';
        }

        if ($this->usesLegacyOpportunitySchema()) {
            return match ($normalized) {
                'NEW' => 'LEAD',
                'PROPOSAL' => 'PROPOSAL',
                'NEGOTIATION' => 'NEGOTIATION',
                'WON' => 'CLOSED_WON',
                'LOST' => 'CLOSED_LOST',
                default => $normalized,
            };
        }

        return $normalized;
    }

    private function fromOpportunityStorageStage(string $stage): string
    {
        $normalized = $this->mapLegacyOpportunityStageCode($stage);
        return $normalized !== '' ? $normalized : 'NEW';
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

    private function customerRelationColumns(): array
    {
        return $this->selectColumns('customers', ['id', 'customer_code', 'customer_name', 'company_name']);
    }

    private function projectRelationColumns(): array
    {
        return $this->selectColumns('projects', ['id', 'project_code', 'project_name', 'customer_id', 'investment_mode']);
    }

    // ── ProjectType helpers ─────────────────────────────────────────

    private function sanitizeProjectTypeCode(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $ascii = Str::ascii($trimmed);
        $upper = function_exists('mb_strtoupper')
            ? mb_strtoupper($ascii, 'UTF-8')
            : strtoupper($ascii);

        $normalized = preg_replace('/[^A-Z0-9]+/', '_', $upper);
        $normalized = preg_replace('/_+/', '_', (string) $normalized);
        $normalized = trim((string) $normalized, '_');

        return substr($normalized, 0, 100);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function projectTypeDefinitions(bool $includeInactive = false): array
    {
        if (
            $this->hasTable('project_types')
            && $this->hasColumn('project_types', 'type_code')
            && $this->hasColumn('project_types', 'type_name')
        ) {
            $this->ensureDefaultProjectTypesExist();

            $query = DB::table('project_types')
                ->select($this->selectColumns('project_types', [
                    'id',
                    'type_code',
                    'type_name',
                    'description',
                    'is_active',
                    'sort_order',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                ]));

            if (! $includeInactive && $this->hasColumn('project_types', 'is_active')) {
                $query->where('is_active', 1);
            }

            if ($this->hasColumn('project_types', 'sort_order')) {
                $query->orderBy('sort_order');
            }
            if ($this->hasColumn('project_types', 'type_name')) {
                $query->orderBy('type_name');
            } elseif ($this->hasColumn('project_types', 'type_code')) {
                $query->orderBy('type_code');
            }
            if ($this->hasColumn('project_types', 'id')) {
                $query->orderBy('id');
            }

            $rows = $query->get()->map(function (object $item): array {
                return $this->serializeProjectTypeRecord((array) $item);
            })->filter(fn (array $record): bool => ((string) ($record['type_code'] ?? '')) !== '')
                ->values()
                ->all();

            if ($rows !== []) {
                return $rows;
            }
        }

        // Fallback to hardcoded defaults
        return array_map(fn (array $d): array => $this->serializeProjectTypeRecord($d), [
            ['type_code' => 'DAU_TU',      'type_name' => 'Đầu tư',             'is_active' => true, 'sort_order' => 10],
            ['type_code' => 'THUE_DICH_VU_DACTHU', 'type_name' => 'Thuê dịch vụ CNTT đặc thù', 'is_active' => true, 'sort_order' => 20],
        ]);
    }

    private function ensureDefaultProjectTypesExist(): void
    {
        if (
            ! $this->hasTable('project_types')
            || ! $this->hasColumn('project_types', 'type_code')
            || ! $this->hasColumn('project_types', 'type_name')
        ) {
            return;
        }

        if (DB::table('project_types')->exists()) {
            return;
        }

        $now = now();
        foreach ([
            ['type_code' => 'DAU_TU', 'type_name' => 'Đầu tư', 'sort_order' => 10],
            ['type_code' => 'THUE_DICH_VU_DACTHU', 'type_name' => 'Thuê dịch vụ CNTT đặc thù', 'sort_order' => 20],
        ] as $row) {
            $payload = $this->filterPayloadByTableColumns('project_types', [
                'type_code' => $row['type_code'],
                'type_name' => $row['type_name'],
                'description' => null,
                'is_active' => true,
                'sort_order' => $row['sort_order'],
            ]);

            if ($this->hasColumn('project_types', 'created_at')) {
                $payload['created_at'] = $now;
            }
            if ($this->hasColumn('project_types', 'updated_at')) {
                $payload['updated_at'] = $now;
            }

            DB::table('project_types')->updateOrInsert(
                ['type_code' => $row['type_code']],
                $payload
            );
        }
    }

    private function loadProjectTypeById(int $id): ?array
    {
        if (! $this->hasTable('project_types')) {
            return null;
        }

        $record = DB::table('project_types')
            ->select($this->selectColumns('project_types', [
                'id',
                'type_code',
                'type_name',
                'description',
                'is_active',
                'sort_order',
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

        return $this->serializeProjectTypeRecord((array) $record);
    }

    private function serializeProjectTypeRecord(array $record): array
    {
        $typeCode = $this->sanitizeProjectTypeCode((string) ($record['type_code'] ?? ''));
        $typeName = trim((string) ($record['type_name'] ?? ''));

        return [
            'id'             => $record['id'] ?? null,
            'type_code'      => $typeCode !== '' ? $typeCode : 'DAU_TU',
            'type_name'      => $typeName !== '' ? $typeName : ($typeCode !== '' ? $typeCode : 'DAU_TU'),
            'description'    => $record['description'] ?? null,
            'is_active'      => (bool) ($record['is_active'] ?? true),
            'sort_order'     => isset($record['sort_order']) ? (int) $record['sort_order'] : 0,
            'used_in_projects' => isset($record['used_in_projects']) ? (int) $record['used_in_projects'] : 0,
            'is_code_editable' => isset($record['is_code_editable']) ? (bool) $record['is_code_editable'] : true,
            'created_at'     => $record['created_at'] ?? null,
            'created_by'     => $record['created_by'] ?? null,
            'updated_at'     => $record['updated_at'] ?? null,
            'updated_by'     => $record['updated_by'] ?? null,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function projectTypeUsageSummaryByCode(): array
    {
        $usageByCode = [];

        if (! $this->hasTable('projects') || ! $this->hasColumn('projects', 'investment_mode')) {
            return $usageByCode;
        }

        $query = DB::table('projects')
            ->selectRaw('UPPER(TRIM(investment_mode)) as type_code, COUNT(*) as total')
            ->whereNotNull('investment_mode')
            ->whereRaw('TRIM(investment_mode) <> ?', [''])
            ->groupBy('type_code');

        if ($this->hasColumn('projects', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $rows = $query->get();
        foreach ($rows as $row) {
            $typeCode = $this->sanitizeProjectTypeCode((string) ($row->type_code ?? ''));
            if ($typeCode === '') {
                continue;
            }

            if (! isset($usageByCode[$typeCode])) {
                $usageByCode[$typeCode] = 0;
            }
            $usageByCode[$typeCode] += (int) ($row->total ?? 0);
        }

        return $usageByCode;
    }

    /**
     * @param array<string, int> $usageByCode
     * @return array<string, mixed>
     */
    private function appendProjectTypeUsageMetadata(array $record, array $usageByCode): array
    {
        $typeCode = $this->sanitizeProjectTypeCode((string) ($record['type_code'] ?? ''));
        $usedInProjects = (int) ($usageByCode[$typeCode] ?? 0);

        $record['used_in_projects']  = $usedInProjects;
        $record['is_code_editable']  = $usedInProjects === 0;

        return $record;
    }

    // =========================================================================
    // MONTHLY CALENDARS — Lịch làm việc
    // =========================================================================

    /**
     * GET /api/v5/monthly-calendars
     *
     * Query params:
     *   - year  (int, optional) — lọc theo năm
     *   - month (int, optional) — lọc theo tháng (kết hợp với year)
     *   - include_inactive (bool, optional) — mặc định false, khi true trả tất cả
     */
    public function monthlyCalendars(Request $request): JsonResponse
    {
        if (! $this->hasTable('monthly_calendars')) {
            return response()->json(['data' => []], 200);
        }

        $year  = $request->query('year')  ? (int) $request->query('year')  : null;
        $month = $request->query('month') ? (int) $request->query('month') : null;
        $includeAll = filter_var($request->query('include_inactive', 'false'), FILTER_VALIDATE_BOOLEAN);

        $query = DB::table('monthly_calendars')
            ->select($this->selectColumns('monthly_calendars', [
                'date', 'year', 'month', 'day', 'week_number', 'day_of_week',
                'is_weekend', 'is_working_day', 'is_holiday', 'holiday_name', 'note',
                'created_at', 'updated_at', 'created_by', 'updated_by',
            ]));

        if ($year !== null && $year > 2000 && $year < 2100) {
            $query->where('year', $year);
        }

        if ($month !== null && $month >= 1 && $month <= 12) {
            $query->where('month', $month);
        }

        // "include_inactive" ở đây nghĩa là bao gồm ngày không làm việc
        // Nếu false → chỉ trả working day, nếu true → trả tất
        if (! $includeAll && $this->hasColumn('monthly_calendars', 'is_working_day')) {
            // Không lọc — luôn trả toàn bộ để FE tự render lịch
        }

        $query->orderBy('date');

        $rows = $query->get()->map(fn (object $row): array =>
            $this->serializeCalendarDayRecord((array) $row)
        )->values()->all();

        return response()->json(['data' => $rows], 200);
    }

    /**
     * PUT /api/v5/monthly-calendars/{date}
     *
     * Cập nhật một ngày trong lịch (is_working_day, is_holiday, holiday_name, note).
     * Nếu ngày chưa tồn tại sẽ tạo mới (upsert).
     */
    public function updateCalendarDay(Request $request, string $date): JsonResponse
    {
        // Validate định dạng ngày
        $parsedDate = \DateTimeImmutable::createFromFormat('Y-m-d', $date);
        if ($parsedDate === false || $parsedDate->format('Y-m-d') !== $date) {
            return response()->json(['message' => 'date format phải là YYYY-MM-DD.'], 422);
        }

        $validated = $request->validate([
            'is_working_day' => ['nullable', 'boolean'],
            'is_holiday'     => ['nullable', 'boolean'],
            'holiday_name'   => ['nullable', 'string', 'max:200'],
            'note'           => ['nullable', 'string', 'max:255'],
            'updated_by'     => ['nullable', 'integer'],
        ]);

        $updatedById = $this->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById !== null && ! $this->tableRowExists('internal_users', $updatedById)) {
            return response()->json(['message' => 'updated_by is invalid.'], 422);
        }

        // Kiểm tra ngày đã tồn tại chưa
        $existing = DB::table('monthly_calendars')
            ->where('date', $date)
            ->first();

        if ($existing === null) {
            // Tự động sinh bản ghi nếu chưa có
            $dt         = $parsedDate;
            $year       = (int) $dt->format('Y');
            $month      = (int) $dt->format('n');
            $day        = (int) $dt->format('j');
            $dow        = (int) $dt->format('w'); // 0=CN, 6=T7
            $weekNum    = (int) $dt->format('W');
            $isWeekend  = $dow === 0 || $dow === 6;
            $dowMapped  = $dow === 0 ? 1 : $dow + 1;

            $isWorkingDay = array_key_exists('is_working_day', $validated)
                ? (bool) $validated['is_working_day']
                : ! $isWeekend;
            $isHoliday = array_key_exists('is_holiday', $validated)
                ? (bool) $validated['is_holiday']
                : false;

            $insertPayload = $this->filterPayloadByTableColumns('monthly_calendars', [
                'date'           => $date,
                'year'           => $year,
                'month'          => $month,
                'day'            => $day,
                'week_number'    => $weekNum,
                'day_of_week'    => $dowMapped,
                'is_weekend'     => $isWeekend,
                'is_working_day' => $isWorkingDay,
                'is_holiday'     => $isHoliday,
                'holiday_name'   => $this->normalizeNullableString($validated['holiday_name'] ?? null),
                'note'           => $this->normalizeNullableString($validated['note'] ?? null),
                'created_by'     => $updatedById,
                'updated_by'     => $updatedById,
                'created_at'     => DB::raw('NOW()'),
                'updated_at'     => DB::raw('NOW()'),
            ]);

            DB::table('monthly_calendars')->insert($insertPayload);
        } else {
            $updatePayload = [];

            if (array_key_exists('is_working_day', $validated)) {
                $updatePayload['is_working_day'] = (bool) $validated['is_working_day'];
            }
            if (array_key_exists('is_holiday', $validated)) {
                $updatePayload['is_holiday'] = (bool) $validated['is_holiday'];
            }
            if (array_key_exists('holiday_name', $validated)) {
                $updatePayload['holiday_name'] = $this->normalizeNullableString($validated['holiday_name'] ?? null);
            }
            if (array_key_exists('note', $validated)) {
                $updatePayload['note'] = $this->normalizeNullableString($validated['note'] ?? null);
            }

            if ($updatePayload === []) {
                return response()->json(['message' => 'Không có trường nào thay đổi.'], 422);
            }

            $updatePayload['updated_by'] = $updatedById;
            $updatePayload['updated_at'] = DB::raw('NOW()');

            $updatePayload = $this->filterPayloadByTableColumns('monthly_calendars', $updatePayload);

            DB::table('monthly_calendars')->where('date', $date)->update($updatePayload);
        }

        $record = $this->loadCalendarDayByDate($date);
        if ($record === null) {
            return response()->json(['message' => 'Calendar day saved but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 200);
    }

    /**
     * POST /api/v5/monthly-calendars/generate
     *
     * Sinh hàng loạt ngày cho một năm.
     * Body: { "year": 2026, "overwrite": false }
     */
    public function generateCalendarYear(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year'       => ['required', 'integer', 'min:2000', 'max:2100'],
            'overwrite'  => ['nullable', 'boolean'],
            'created_by' => ['nullable', 'integer'],
        ]);

        $year      = (int) $validated['year'];
        $overwrite = (bool) ($validated['overwrite'] ?? false);
        $createdById = $this->parseNullableInt($validated['created_by'] ?? null);

        if ($createdById !== null && ! $this->tableRowExists('internal_users', $createdById)) {
            return response()->json(['message' => 'created_by is invalid.'], 422);
        }

        if (! $this->hasTable('monthly_calendars')) {
            return response()->json(['message' => 'monthly_calendars table không tồn tại.'], 500);
        }

        $start   = new \DateTimeImmutable("{$year}-01-01");
        $end     = new \DateTimeImmutable("{$year}-12-31");
        $current = $start;

        $inserted = 0;
        $skipped  = 0;

        while ($current <= $end) {
            $dateStr   = $current->format('Y-m-d');
            $month     = (int) $current->format('n');
            $day       = (int) $current->format('j');
            $dow       = (int) $current->format('w'); // 0=CN, 6=T7
            $weekNum   = (int) $current->format('W');
            $isWeekend = $dow === 0 || $dow === 6;
            $dowMapped = $dow === 0 ? 1 : $dow + 1;

            [$isHoliday, $holidayName] = $this->resolveVietnameseFixedHoliday($month, $day);
            $isWorkingDay = ! $isWeekend && ! $isHoliday;

            $exists = DB::table('monthly_calendars')->where('date', $dateStr)->exists();

            if ($exists && ! $overwrite) {
                $skipped++;
            } else {
                $payload = $this->filterPayloadByTableColumns('monthly_calendars', [
                    'date'           => $dateStr,
                    'year'           => $year,
                    'month'          => $month,
                    'day'            => $day,
                    'week_number'    => $weekNum,
                    'day_of_week'    => $dowMapped,
                    'is_weekend'     => $isWeekend,
                    'is_working_day' => $isWorkingDay,
                    'is_holiday'     => $isHoliday,
                    'holiday_name'   => $holidayName,
                    'note'           => null,
                    'created_by'     => $createdById,
                    'updated_by'     => $createdById,
                    'created_at'     => DB::raw('NOW()'),
                    'updated_at'     => DB::raw('NOW()'),
                ]);

                if ($exists) {
                    DB::table('monthly_calendars')->where('date', $dateStr)->update($payload);
                } else {
                    DB::table('monthly_calendars')->insert($payload);
                }
                $inserted++;
            }

            $current = $current->modify('+1 day');
        }

        return response()->json([
            'message'  => "Đã xử lý lịch năm {$year}.",
            'year'     => $year,
            'inserted' => $inserted,
            'skipped'  => $skipped,
        ], 200);
    }

    // ─── Private helpers — Monthly Calendars ─────────────────────────────────

    private function loadCalendarDayByDate(string $date): ?array
    {
        if (! $this->hasTable('monthly_calendars')) {
            return null;
        }

        $record = DB::table('monthly_calendars')
            ->select($this->selectColumns('monthly_calendars', [
                'date', 'year', 'month', 'day', 'week_number', 'day_of_week',
                'is_weekend', 'is_working_day', 'is_holiday', 'holiday_name', 'note',
                'created_at', 'updated_at', 'created_by', 'updated_by',
            ]))
            ->where('date', $date)
            ->first();

        return $record !== null ? $this->serializeCalendarDayRecord((array) $record) : null;
    }

    private function serializeCalendarDayRecord(array $record): array
    {
        $isWeekend    = (bool) ($record['is_weekend']    ?? false);
        $isWorkingDay = (bool) ($record['is_working_day'] ?? ! $isWeekend);
        $isHoliday    = (bool) ($record['is_holiday']    ?? false);

        return [
            'date'           => $record['date'] ?? null,
            'year'           => isset($record['year'])  ? (int) $record['year']  : null,
            'month'          => isset($record['month']) ? (int) $record['month'] : null,
            'day'            => isset($record['day'])   ? (int) $record['day']   : null,
            'week_number'    => isset($record['week_number'])  ? (int) $record['week_number']  : null,
            'day_of_week'    => isset($record['day_of_week'])  ? (int) $record['day_of_week']  : null,
            'is_weekend'     => $isWeekend,
            'is_working_day' => $isWorkingDay,
            'is_holiday'     => $isHoliday,
            'holiday_name'   => isset($record['holiday_name']) && (string) $record['holiday_name'] !== ''
                ? (string) $record['holiday_name']
                : null,
            'note'           => isset($record['note']) && (string) $record['note'] !== ''
                ? (string) $record['note']
                : null,
            'created_at'     => $record['created_at'] ?? null,
            'updated_at'     => $record['updated_at'] ?? null,
            'created_by'     => $record['created_by'] ?? null,
            'updated_by'     => $record['updated_by'] ?? null,
        ];
    }

    /**
     * Tra cứu ngày lễ cố định Việt Nam theo dương lịch.
     *
     * @return array{bool, string|null}
     */
    private function resolveVietnameseFixedHoliday(int $month, int $day): array
    {
        $key = sprintf('%02d-%02d', $month, $day);

        $fixed = [
            '01-01' => 'Tết Dương lịch',
            '04-30' => 'Ngày Giải phóng miền Nam',
            '05-01' => 'Quốc tế Lao động',
            '09-02' => 'Quốc khánh',
        ];

        if (isset($fixed[$key])) {
            return [true, $fixed[$key]];
        }

        return [false, null];
    }
}
