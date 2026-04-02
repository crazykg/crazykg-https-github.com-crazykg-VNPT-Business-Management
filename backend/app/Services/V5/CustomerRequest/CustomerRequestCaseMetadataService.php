<?php

namespace App\Services\V5\CustomerRequest;

use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\DB;

class CustomerRequestCaseMetadataService
{
    /**
     * @var array<string, array<string, mixed>|null>
     */
    private array $statusMetaCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $transitionsCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $catalogCache = [];

    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $masterFieldsCache = [];

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    public function resolveWorkflowDefinitionId(?int $workflowDefinitionId = null): ?int
    {
        if ($workflowDefinitionId !== null) {
            return $workflowDefinitionId;
        }

        if (! $this->support->hasTable('workflow_definitions')) {
            return null;
        }

        $defaultWorkflow = DB::table('workflow_definitions')
            ->where('process_type', 'customer_request')
            ->whereNull('deleted_at')
            ->where('is_default', true)
            ->orderByDesc('id')
            ->value('id');

        if ($defaultWorkflow !== null) {
            return (int) $defaultWorkflow;
        }

        $activeWorkflow = DB::table('workflow_definitions')
            ->where('process_type', 'customer_request')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->orderByDesc('id')
            ->value('id');

        return $activeWorkflow === null ? null : (int) $activeWorkflow;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getMasterFields(?int $workflowDefinitionId = null): array
    {
        $resolvedWorkflowId = $this->resolveWorkflowDefinitionId($workflowDefinitionId);
        $cacheKey = (string) ($resolvedWorkflowId ?? 'default');
        if (isset($this->masterFieldsCache[$cacheKey])) {
            return $this->masterFieldsCache[$cacheKey];
        }

        if (
            $resolvedWorkflowId !== null
            && $this->support->hasTable('customer_request_workflow_metadata')
            && $this->support->hasColumn('customer_request_workflow_metadata', 'master_fields_json')
        ) {
            $payload = DB::table('customer_request_workflow_metadata')
                ->where('workflow_definition_id', $resolvedWorkflowId)
                ->value('master_fields_json');

            $decoded = $this->decodeJsonArray($payload);
            if ($decoded !== []) {
                return $this->masterFieldsCache[$cacheKey] = $decoded;
            }
        }

        return $this->masterFieldsCache[$cacheKey] = [];
    }

    /**
     * @return array<int, string>
     */
    public function getStatusTables(?int $workflowDefinitionId = null): array
    {
        return array_values(array_filter(array_map(
            fn (array $meta): string => (string) ($meta['table_name'] ?? ''),
            $this->getStatusCatalog($workflowDefinitionId)
        )));
    }

    public function hasStatusCatalog(?int $workflowDefinitionId = null): bool
    {
        return $this->getStatusCatalog($workflowDefinitionId) !== [];
    }

    public function hasMasterFields(?int $workflowDefinitionId = null): bool
    {
        return $this->getMasterFields($workflowDefinitionId) !== [];
    }

    public function hasStatusMeta(string $statusCode, ?int $workflowDefinitionId = null): bool
    {
        return $this->getStatusMeta($statusCode, $workflowDefinitionId) !== null;
    }

    public function hasTableInCatalog(string $tableName, ?int $workflowDefinitionId = null): bool
    {
        return in_array($tableName, $this->getStatusTables($workflowDefinitionId), true);
    }

    public function resolveInitialStatusCode(?int $workflowDefinitionId = null): ?string
    {
        $catalog = $this->getStatusCatalog($workflowDefinitionId);
        if ($catalog === []) {
            return null;
        }

        foreach ($catalog as $meta) {
            if (($meta['default_status'] ?? null) !== null) {
                return $this->normalizeNullableString($meta['default_status']) ?? $this->normalizeNullableString($meta['status_code'] ?? null);
            }
        }

        return $this->normalizeNullableString($catalog[0]['status_code'] ?? null);
    }

    public function resolveStatusStorageMode(string $statusCode, ?int $workflowDefinitionId = null): string
    {
        return $this->normalizeNullableString($this->getStatusMeta($statusCode, $workflowDefinitionId)['storage_mode'] ?? null)
            ?? 'detail';
    }

    public function resolveStatusTableName(string $statusCode, ?int $workflowDefinitionId = null): ?string
    {
        return $this->normalizeNullableString($this->getStatusMeta($statusCode, $workflowDefinitionId)['table_name'] ?? null);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getStatusCatalog(?int $workflowDefinitionId = null): array
    {
        $resolvedWorkflowId = $this->resolveWorkflowDefinitionId($workflowDefinitionId);
        $cacheKey = (string) ($resolvedWorkflowId ?? 'default');
        if (isset($this->catalogCache[$cacheKey])) {
            return $this->catalogCache[$cacheKey];
        }

        $rows = [];
        if ($this->support->hasTable('customer_request_status_catalogs')) {
            $query = DB::table('customer_request_status_catalogs')
                ->where('is_active', 1)
                ->orderBy('sort_order')
                ->orderBy('id');

            if ($resolvedWorkflowId !== null && $this->support->hasColumn('customer_request_status_catalogs', 'workflow_definition_id')) {
                $query->where('workflow_definition_id', $resolvedWorkflowId);
            }

            $rows = $query->get()
                ->map(function (object $row): array {
                    $statusCode = (string) ($row->status_code ?? '');
                    $uiMeta = $this->decodeJsonAssoc($row->ui_meta_json ?? null);

                    return [
                        'status_code' => $statusCode,
                        'status_name_vi' => (string) ($row->status_name_vi ?? $statusCode),
                        'process_code' => $statusCode,
                        'process_label' => (string) ($row->status_name_vi ?? $statusCode),
                        'group_code' => $this->normalizeNullableString($row->group_code ?? null) ?? 'statuses',
                        'group_label' => $this->normalizeNullableString($row->group_label ?? null) ?? 'Trạng thái',
                        'table_name' => (string) ($row->table_name ?? ''),
                        'handler_field' => $this->normalizeNullableString($row->handler_field ?? null),
                        'default_status' => $statusCode,
                        'read_roles' => [],
                        'write_roles' => [],
                        'allowed_next_processes' => [],
                        'allowed_previous_processes' => [],
                        'list_columns' => $this->decodeJsonArray($row->list_columns_json ?? null, []),
                        'form_fields' => $this->decodeJsonArray($row->form_fields_json ?? null, []),
                        'ui_meta' => $uiMeta,
                        'storage_mode' => $this->normalizeNullableString($row->storage_mode ?? null)
                            ?? (($row->table_name ?? null) === 'customer_request_cases' ? 'master' : 'detail'),
                        'workflow_definition_id' => $this->support->parseNullableInt($row->workflow_definition_id ?? null),
                    ];
                })
                ->filter(fn (array $row): bool => ($row['status_code'] ?? '') !== '')
                ->values()
                ->all();
        }

        return $this->catalogCache[$cacheKey] = $rows;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getStatusMeta(string $statusCode, ?int $workflowDefinitionId = null): ?array
    {
        $resolvedWorkflowId = $this->resolveWorkflowDefinitionId($workflowDefinitionId);
        $cacheKey = ($resolvedWorkflowId ?? 'default').':'.$statusCode;
        if (array_key_exists($cacheKey, $this->statusMetaCache)) {
            return $this->statusMetaCache[$cacheKey];
        }

        foreach ($this->getStatusCatalog($resolvedWorkflowId) as $meta) {
            if (($meta['status_code'] ?? null) === $statusCode) {
                // Prime cache first to avoid recursive loop when transitions map back to this status.
                $this->statusMetaCache[$cacheKey] = [
                    ...$meta,
                    'allowed_next_processes' => [],
                    'allowed_previous_processes' => [],
                ];

                $this->statusMetaCache[$cacheKey]['allowed_next_processes'] = array_map(
                    static fn (array $row): string => (string) ($row['to_status_code'] ?? ''),
                    $this->getAllowedTransitions($statusCode, $resolvedWorkflowId, 'forward')
                );
                $this->statusMetaCache[$cacheKey]['allowed_previous_processes'] = array_map(
                    static fn (array $row): string => (string) ($row['to_status_code'] ?? ''),
                    $this->getAllowedTransitions($statusCode, $resolvedWorkflowId, 'backward')
                );

                return $this->statusMetaCache[$cacheKey];
            }
        }

        return $this->statusMetaCache[$cacheKey] = null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getAllowedTransitions(string $statusCode, ?int $workflowDefinitionId = null, ?string $direction = null): array
    {
        $resolvedWorkflowId = $this->resolveWorkflowDefinitionId($workflowDefinitionId);
        $cacheKey = implode(':', [(string) ($resolvedWorkflowId ?? 'default'), $statusCode, (string) ($direction ?? 'all')]);
        if (isset($this->transitionsCache[$cacheKey])) {
            return $this->transitionsCache[$cacheKey];
        }

        if (! $this->support->hasTable('customer_request_status_transitions')) {
            return $this->transitionsCache[$cacheKey] = [];
        }

        $query = DB::table('customer_request_status_transitions')
            ->where('from_status_code', $statusCode)
            ->where('is_active', 1)
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($direction !== null) {
            $query->where('direction', $direction);
        }

        if ($resolvedWorkflowId !== null && $this->support->hasColumn('customer_request_status_transitions', 'workflow_definition_id')) {
            $query->where('workflow_definition_id', $resolvedWorkflowId);
        }

        $rows = $query->get()
            ->map(function (object $row) use ($resolvedWorkflowId): array {
                $toStatusCode = (string) ($row->to_status_code ?? '');
                $toStatus = $this->getStatusMeta($toStatusCode, $resolvedWorkflowId);
                $transitionMeta = $this->decodeJsonAssoc($row->transition_meta_json ?? null);

                return [
                    'id' => (int) ($row->id ?? 0),
                    'workflow_definition_id' => $this->support->parseNullableInt($row->workflow_definition_id ?? null),
                    'from_status_code' => (string) ($row->from_status_code ?? ''),
                    'to_status_code' => $toStatusCode,
                    'direction' => (string) ($row->direction ?? 'forward'),
                    'is_default' => (bool) ($row->is_default ?? false),
                    'is_active' => (bool) ($row->is_active ?? true),
                    'sort_order' => (int) ($row->sort_order ?? 0),
                    'notes' => $this->normalizeNullableString($row->notes ?? null),
                    'allowed_roles' => $this->decodeJsonArray($row->allowed_roles ?? null, ['all']),
                    'required_fields' => $this->decodeJsonArray($row->required_fields ?? null, []),
                    'transition_meta' => $transitionMeta,
                    'from_status' => $this->getStatusMeta((string) ($row->from_status_code ?? ''), $resolvedWorkflowId),
                    'to_status' => $toStatus,
                    'decision_context_code' => $this->normalizeNullableString($transitionMeta['decision_context_code'] ?? null),
                    'decision_outcome_code' => $this->normalizeNullableString($transitionMeta['decision_outcome_code'] ?? null),
                    'decision_source_status_code' => $this->normalizeNullableString($transitionMeta['decision_source_status_code'] ?? null),
                ];
            })
            ->values()
            ->all();

        return $this->transitionsCache[$cacheKey] = $rows;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getStatusFormFields(string $statusCode, ?int $workflowDefinitionId = null): array
    {
        return array_values($this->getStatusMeta($statusCode, $workflowDefinitionId)['form_fields'] ?? []);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getStatusListColumns(string $statusCode, ?int $workflowDefinitionId = null): array
    {
        return array_values($this->getStatusMeta($statusCode, $workflowDefinitionId)['list_columns'] ?? []);
    }

    public function resolveHandlerField(string $statusCode, ?int $workflowDefinitionId = null): ?string
    {
        return $this->normalizeNullableString($this->getStatusMeta($statusCode, $workflowDefinitionId)['handler_field'] ?? null);
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveUiMeta(string $statusCode, ?int $workflowDefinitionId = null): array
    {
        $uiMeta = $this->getStatusMeta($statusCode, $workflowDefinitionId)['ui_meta'] ?? [];

        return is_array($uiMeta) ? $uiMeta : [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function decodeJsonArray(mixed $value, array $default = []): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return $default;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : $default;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonAssoc(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }
}
