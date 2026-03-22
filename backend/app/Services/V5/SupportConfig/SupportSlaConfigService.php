<?php

namespace App\Services\V5\SupportConfig;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupportSlaConfigService
{
    /**
     * @var array<int, string>
     */
    private const SUPPORT_REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function slaConfigs(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('sla_configs')) {
            return $this->support->missingTable('sla_configs');
        }

        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $joinServiceGroup = $this->support->hasTable('support_service_groups')
            && $this->support->hasColumn('sla_configs', 'service_group_id')
            && $this->support->hasColumn('support_service_groups', 'id');

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
            ->filter(fn (string $column): bool => $this->support->hasColumn('sla_configs', $column))
            ->map(fn (string $column): string => "sc.{$column} as {$column}")
            ->values()
            ->all();

        if ($joinServiceGroup && $this->support->hasColumn('support_service_groups', 'group_name')) {
            $columns[] = 'ssg.group_name as service_group_name';
        }

        $query = DB::table('sla_configs as sc')->select($columns);
        if ($joinServiceGroup) {
            $query->leftJoin('support_service_groups as ssg', 'sc.service_group_id', '=', 'ssg.id');
        }

        if (! $includeInactive && $this->support->hasColumn('sla_configs', 'is_active')) {
            $query->where('sc.is_active', 1);
        }

        if ($this->support->hasColumn('sla_configs', 'sort_order')) {
            $query->orderBy('sc.sort_order');
        }
        if ($this->support->hasColumn('sla_configs', 'status')) {
            $query->orderBy('sc.status');
        } elseif ($this->support->hasColumn('sla_configs', 'to_status')) {
            $query->orderBy('sc.to_status');
        }
        if ($this->support->hasColumn('sla_configs', 'sub_status')) {
            $query->orderBy('sc.sub_status');
        }
        if ($this->support->hasColumn('sla_configs', 'priority')) {
            $query->orderBy('sc.priority');
        }
        if ($this->support->hasColumn('sla_configs', 'service_group_id')) {
            $query->orderBy('sc.service_group_id');
        }
        if ($this->support->hasColumn('sla_configs', 'workflow_action_code')) {
            $query->orderBy('sc.workflow_action_code');
        }
        if ($this->support->hasColumn('sla_configs', 'id')) {
            $query->orderBy('sc.id');
        }

        $rows = $query
            ->get()
            ->map(fn (object $item): array => $this->serializeSupportSlaConfigRecord((array) $item))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSlaConfig(Request $request): JsonResponse
    {
        if (! $this->support->hasTable('sla_configs')) {
            return $this->support->missingTable('sla_configs');
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
        $serviceGroupId = $this->support->parseNullableInt($validated['service_group_id'] ?? null);
        $workflowActionCode = $this->normalizeNullableWorkflowActionCode($validated['workflow_action_code'] ?? null);

        if ($serviceGroupId !== null && ! $this->tableRowExists('support_service_groups', $serviceGroupId)) {
            return response()->json(['message' => 'service_group_id is invalid.'], 422);
        }

        if ($this->supportSlaConfigExists($status, $subStatus, $priority, $requestTypePrefix, $serviceGroupId, $workflowActionCode)) {
            return response()->json(['message' => 'SLA rule already exists for this status/sub_status/priority/scope.'], 422);
        }

        $createdById = $this->support->parseNullableInt($validated['created_by'] ?? null);
        if ($createdById === null) {
            $createdById = $this->support->parseNullableInt($request->user()?->id ?? null);
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
            'description' => $this->support->normalizeNullableString($validated['description'] ?? null),
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'sort_order' => isset($validated['sort_order']) ? max(0, (int) $validated['sort_order']) : 0,
            'created_by' => $createdById,
            'updated_by' => $createdById,
        ];

        if ($this->support->hasColumn('sla_configs', 'status')) {
            $payload['status'] = $status;
        }
        if ($this->support->hasColumn('sla_configs', 'to_status')) {
            $payload['to_status'] = $status;
        }
        if ($this->support->hasColumn('sla_configs', 'sub_status')) {
            $payload['sub_status'] = $subStatus;
        }
        if ($this->support->hasColumn('sla_configs', 'sla_hours')) {
            $payload['sla_hours'] = $slaHours;
        }
        if ($this->support->hasColumn('sla_configs', 'resolution_hours')) {
            $payload['resolution_hours'] = $slaHours;
        }

        $payload = $this->support->filterPayloadByTableColumns('sla_configs', $payload);
        if ($this->support->hasColumn('sla_configs', 'created_at')) {
            $payload['created_at'] = now();
        }
        if ($this->support->hasColumn('sla_configs', 'updated_at')) {
            $payload['updated_at'] = now();
        }

        $insertId = (int) DB::table('sla_configs')->insertGetId($payload);
        $record = $this->loadSupportSlaConfigById($insertId);

        if ($record === null) {
            return response()->json(['message' => 'SLA config created but cannot be reloaded.'], 500);
        }

        return response()->json(['data' => $record], 201);
    }

    public function updateSlaConfig(Request $request, int $id): JsonResponse
    {
        if (! $this->support->hasTable('sla_configs')) {
            return $this->support->missingTable('sla_configs');
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
            ? $this->support->parseNullableInt($validated['service_group_id'] ?? null)
            : $this->support->parseNullableInt($current->service_group_id ?? null);
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

        $updatedById = $this->support->parseNullableInt($validated['updated_by'] ?? null);
        if ($updatedById === null) {
            $updatedById = $this->support->parseNullableInt($request->user()?->id ?? null);
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

        if ($this->support->hasColumn('sla_configs', 'status')) {
            $payload['status'] = $status;
        }
        if ($this->support->hasColumn('sla_configs', 'to_status')) {
            $payload['to_status'] = $status;
        }
        if ($this->support->hasColumn('sla_configs', 'sub_status')) {
            $payload['sub_status'] = $subStatus;
        }
        if ($this->support->hasColumn('sla_configs', 'sla_hours')) {
            $payload['sla_hours'] = $slaHours;
        }
        if ($this->support->hasColumn('sla_configs', 'resolution_hours')) {
            $payload['resolution_hours'] = $slaHours;
        }
        if (array_key_exists('description', $validated)) {
            $payload['description'] = $this->support->normalizeNullableString($validated['description'] ?? null);
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

        $payload = $this->support->filterPayloadByTableColumns('sla_configs', $payload);
        if ($this->support->hasColumn('sla_configs', 'updated_at')) {
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

    private function tableRowExists(string $table, int $id): bool
    {
        if (! $this->support->hasTable($table) || ! $this->support->hasColumn($table, 'id')) {
            return false;
        }

        return DB::table($table)->where('id', $id)->exists();
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

    private function normalizeSupportRequestPriority(string $priority): string
    {
        $normalized = $this->sanitizeSupportRequestStatusCode($priority);

        return in_array($normalized, self::SUPPORT_REQUEST_PRIORITIES, true) ? $normalized : 'MEDIUM';
    }

    private function supportSlaConfigExists(
        string $status,
        ?string $subStatus,
        string $priority,
        ?string $requestTypePrefix,
        ?int $serviceGroupId = null,
        ?string $workflowActionCode = null,
        ?int $ignoreId = null,
    ): bool {
        if (! $this->support->hasTable('sla_configs') || ! $this->support->hasColumn('sla_configs', 'priority')) {
            return false;
        }

        $statusColumn = null;
        if ($this->support->hasColumn('sla_configs', 'status')) {
            $statusColumn = 'status';
        } elseif ($this->support->hasColumn('sla_configs', 'to_status')) {
            $statusColumn = 'to_status';
        }

        if ($statusColumn === null) {
            return false;
        }

        $query = DB::table('sla_configs')
            ->whereRaw(sprintf('UPPER(TRIM(%s)) = ?', $statusColumn), [$status])
            ->whereRaw('UPPER(TRIM(priority)) = ?', [$priority]);

        if ($this->support->hasColumn('sla_configs', 'sub_status')) {
            if ($subStatus === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('sub_status')
                        ->orWhereRaw('TRIM(sub_status) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(sub_status)) = ?', [$subStatus]);
            }
        }

        if ($this->support->hasColumn('sla_configs', 'request_type_prefix')) {
            if ($requestTypePrefix === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('request_type_prefix')
                        ->orWhereRaw('TRIM(request_type_prefix) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(request_type_prefix)) = ?', [$requestTypePrefix]);
            }
        }

        if ($this->support->hasColumn('sla_configs', 'service_group_id')) {
            if ($serviceGroupId === null) {
                $query->whereNull('service_group_id');
            } else {
                $query->where('service_group_id', $serviceGroupId);
            }
        }

        if ($this->support->hasColumn('sla_configs', 'workflow_action_code')) {
            if ($workflowActionCode === null) {
                $query->where(function ($builder): void {
                    $builder->whereNull('workflow_action_code')
                        ->orWhereRaw('TRIM(workflow_action_code) = ?', ['']);
                });
            } else {
                $query->whereRaw('UPPER(TRIM(workflow_action_code)) = ?', [$workflowActionCode]);
            }
        }

        if ($ignoreId !== null && $this->support->hasColumn('sla_configs', 'id')) {
            $query->where('id', '<>', $ignoreId);
        }

        return $query->exists();
    }

    private function loadSupportSlaConfigById(int $id): ?array
    {
        if (! $this->support->hasTable('sla_configs')) {
            return null;
        }

        $joinServiceGroup = $this->support->hasTable('support_service_groups')
            && $this->support->hasColumn('sla_configs', 'service_group_id')
            && $this->support->hasColumn('support_service_groups', 'id');

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
            ->filter(fn (string $column): bool => $this->support->hasColumn('sla_configs', $column))
            ->map(fn (string $column): string => "sc.{$column} as {$column}")
            ->values()
            ->all();

        if ($joinServiceGroup && $this->support->hasColumn('support_service_groups', 'group_name')) {
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

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
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
        $serviceGroupId = $this->support->parseNullableInt($record['service_group_id'] ?? null);
        $workflowActionCode = $this->normalizeNullableWorkflowActionCode($record['workflow_action_code'] ?? null);
        $serviceGroupName = $this->support->normalizeNullableString($record['service_group_name'] ?? null);

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
}
