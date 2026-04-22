<?php

namespace App\Services\V5\CustomerRequest;

use App\Services\V5\V5DomainSupportService;
use App\Support\Auth\UserAccessService;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerRequestCaseReadQueryService
{
    /**
     * @var array<string, array<int, int>>
     */
    private array $projectScopeCache = [];

    public function __construct(
        private readonly V5DomainSupportService $support,
        private readonly UserAccessService $userAccess,
        private readonly CustomerRequestCaseMetadataService $metadataService,
    ) {}

    public function missingTablesResponse(): ?JsonResponse
    {
        foreach ($this->requiredTables() as $table) {
            if (! $this->support->hasTable($table)) {
                return $this->support->missingTable($table);
            }
        }

        return null;
    }

    public function resolveActorId(Request $request): ?int
    {
        $authId = $this->support->parseNullableInt($request->user()?->id ?? null);
        if ($authId !== null) {
            return $authId;
        }

        foreach ([
            'updated_by',
            'created_by',
            'performed_by_user_id',
        ] as $key) {
            $value = $this->support->parseNullableInt($request->input($key));
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    public function applyCaseFilters(QueryBuilder $query, Request $request, ?int $actorId, bool $skipStatusFilter): void
    {
        if (! $skipStatusFilter) {
            $statusValuesRaw = $request->query('status_code');
            $statusValues = is_array($statusValuesRaw) ? $statusValuesRaw : [$statusValuesRaw];
            $normalizedStatusValues = array_values(array_filter(
                array_map(fn ($value): ?string => $this->normalizeNullableString($value), $statusValues),
                fn (?string $value): bool => $value !== null
            ));

            if (count($normalizedStatusValues) === 1) {
                $query->where('crc.current_status_code', $normalizedStatusValues[0]);
            } elseif (count($normalizedStatusValues) > 1) {
                $query->whereIn('crc.current_status_code', $normalizedStatusValues);
            }
        }

        foreach ([
            'customer_id',
            'project_id',
            'project_item_id',
            'support_service_group_id',
            'dispatcher_user_id',
            'performer_user_id',
            'created_by',
            'received_by_user_id',
            'priority',
        ] as $column) {
            $rawValues = $request->query($column);
            $normalizedValues = is_array($rawValues) ? $rawValues : [$rawValues];
            $values = [];

            foreach ($normalizedValues as $rawValue) {
                $parsed = $this->support->parseNullableInt($rawValue);
                if ($parsed !== null) {
                    $values[] = $parsed;
                }
            }

            $values = array_values(array_unique($values));

            if ($values === []) {
                continue;
            }

            if (count($values) === 1) {
                $query->where("crc.{$column}", $values[0]);
                continue;
            }

            $query->whereIn("crc.{$column}", $values);
        }

        $keyword = $this->normalizeNullableString($request->query('q', $request->query('search')));
        if ($keyword !== null) {
            $this->applyKeywordSearch($query, $keyword);
        }

        $receivedByName = $this->normalizeNullableString($request->query('received_by_name'));
        if ($receivedByName !== null && $this->support->hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
            $query->where('current_handler.full_name', 'like', '%'.$receivedByName.'%');
        }

        $myRole = $this->normalizeNullableString($request->query('my_role'));
        if ($actorId !== null && $myRole !== null) {
            match ($myRole) {
                'creator' => $query->where('crc.created_by', $actorId),
                'dispatcher' => $query->where(function (QueryBuilder $builder) use ($actorId): void {
                    $builder
                        ->where('crc.dispatcher_user_id', $actorId)
                        ->orWhere('crc.received_by_user_id', $actorId);
                }),
                'performer' => $query->where('crc.performer_user_id', $actorId),
                'receiver' => $query->where('crc.received_by_user_id', $actorId),
                'handler' => $query->whereIn('crc.project_id', $this->projectIdsForUserByRaciRoles($actorId)),
                default => null,
            };
        }

        $createdFrom = $this->normalizeDateTime($request->query('created_from'));
        if ($createdFrom !== null) {
            $query->where('crc.created_at', '>=', $createdFrom);
        }

        $createdTo = $this->normalizeDateTime($request->query('created_to'));
        if ($createdTo !== null) {
            $query->where('crc.created_at', '<=', $createdTo);
        }

        $updatedFrom = $this->normalizeDateTime($request->query('updated_from'));
        if ($updatedFrom !== null) {
            $query->where('crc.updated_at', '>=', $updatedFrom);
        }

        $updatedTo = $this->normalizeDateTime($request->query('updated_to'));
        if ($updatedTo !== null) {
            $query->where('crc.updated_at', '<=', $updatedTo);
        }

        $receivedFrom = $this->normalizeDateTime($request->query('received_from'));
        if ($receivedFrom !== null) {
            $query->where('crc.received_at', '>=', $receivedFrom);
        }

        $receivedTo = $this->normalizeDateTime($request->query('received_to'));
        if ($receivedTo !== null) {
            $query->where('crc.received_at', '<=', $receivedTo);
        }

        $overEstimate = $this->resolveBooleanInput($request->query('over_estimate'));
        if ($overEstimate === true) {
            $query
                ->whereNotNull('crc.estimated_hours')
                ->where('crc.estimated_hours', '>', 0)
                ->whereColumn('crc.total_hours_spent', '>', 'crc.estimated_hours');
        } elseif ($overEstimate === false) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereNull('crc.estimated_hours')
                    ->orWhere('crc.estimated_hours', '<=', 0)
                    ->orWhereColumn('crc.total_hours_spent', '<=', 'crc.estimated_hours');
            });
        }

        $missingEstimate = $this->resolveBooleanInput($request->query('missing_estimate'));
        if ($missingEstimate === true) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereNull('crc.estimated_hours')
                    ->orWhere('crc.estimated_hours', '<=', 0);
            });
        } elseif ($missingEstimate === false) {
            $query->whereNotNull('crc.estimated_hours')->where('crc.estimated_hours', '>', 0);
        }

        $slaRisk = $this->resolveBooleanInput($request->query('sla_risk'));
        if ($slaRisk === true) {
            $query
                ->whereNotIn('crc.current_status_code', ['completed', 'customer_notified', 'not_executed'])
                ->whereRaw($this->slaDueAtExpression().' IS NOT NULL')
                ->whereRaw($this->slaDueAtExpression().' <= ?', [now()->addDay()->format('Y-m-d H:i:s')]);
        } elseif ($slaRisk === false) {
            $query->where(function (QueryBuilder $builder): void {
                $builder
                    ->whereIn('crc.current_status_code', ['completed', 'customer_notified', 'not_executed'])
                    ->orWhereRaw($this->slaDueAtExpression().' IS NULL')
                    ->orWhereRaw($this->slaDueAtExpression().' > ?', [now()->addDay()->format('Y-m-d H:i:s')]);
            });
        }
    }

    public function applyKeywordSearch(QueryBuilder $query, string $keyword): void
    {
        $normalizedKeyword = trim($keyword);
        if ($normalizedKeyword === '') {
            return;
        }

        $like = '%'.$normalizedKeyword.'%';
        $query->where(function (QueryBuilder $builder) use ($normalizedKeyword, $like): void {
            $builder
                ->where('crc.request_code', $normalizedKeyword)
                ->orWhere('crc.request_code', 'like', $like)
                ->orWhere('crc.summary', 'like', $like);
        });
    }

    public function resolveBooleanInput(mixed $value, ?bool $default = null): ?bool
    {
        if ($value === null || $value === '') {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        $normalized = Str::lower(trim((string) $value));

        if (in_array($normalized, ['1', 'true', 'yes', 'y', 'on'], true)) {
            return true;
        }

        if (in_array($normalized, ['0', 'false', 'no', 'n', 'off'], true)) {
            return false;
        }

        return $default;
    }

    public function normalizeNullableDate(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return Carbon::parse(str_replace('T', ' ', $normalized))->format('Y-m-d');
        } catch (\Throwable) {
            return $normalized;
        }
    }

    public function normalizeDateTime(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return Carbon::parse(str_replace('T', ' ', $normalized))->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return $normalized;
        }
    }

    public function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    public function baseCaseQuery(?int $userId): QueryBuilder
    {
        $query = DB::table('customer_request_cases as crc')->whereNull('crc.deleted_at');
        $selects = ['crc.*'];

        if ($this->support->hasTable('customer_request_status_catalogs')) {
            $query->leftJoin('customer_request_status_catalogs as status_catalog', function ($join): void {
                $join->on('status_catalog.status_code', '=', 'crc.current_status_code');

                if ($this->support->hasColumn('customer_request_status_catalogs', 'workflow_definition_id')) {
                    $join->on('status_catalog.workflow_definition_id', '=', 'crc.workflow_definition_id');
                }
            });
            $selects[] = 'status_catalog.status_name_vi as current_status_name_vi';
            if ($this->support->hasColumn('customer_request_status_catalogs', 'handler_field')) {
                $selects[] = 'status_catalog.handler_field as handler_field';
            }
            if ($this->support->hasColumn('customer_request_status_catalogs', 'group_code')) {
                $selects[] = 'status_catalog.group_code as current_status_group_code';
            }
            if ($this->support->hasColumn('customer_request_status_catalogs', 'group_label')) {
                $selects[] = 'status_catalog.group_label as current_status_group_label';
            }
            if ($this->support->hasColumn('customer_request_status_catalogs', 'ui_meta_json')) {
                $selects[] = 'status_catalog.ui_meta_json as current_status_ui_meta_json';
            }
        }

        $selects[] = 'crc.workflow_definition_id';

        if ($this->support->hasTable('customers')) {
            $query->leftJoin('customers as c', 'c.id', '=', 'crc.customer_id');
            if ($this->support->hasColumn('customers', 'customer_name')) {
                $selects[] = 'c.customer_name as customer_name';
            }
        }

        if ($this->support->hasTable('customer_personnel')) {
            $query->leftJoin('customer_personnel as cp', 'cp.id', '=', 'crc.customer_personnel_id');
            if ($this->support->hasColumn('customer_personnel', 'full_name')) {
                $selects[] = 'cp.full_name as requester_name';
            }
        }

        if ($this->support->hasTable('projects')) {
            $query->leftJoin('projects as p', 'p.id', '=', 'crc.project_id');
            if ($this->support->hasColumn('projects', 'project_name')) {
                $selects[] = 'p.project_name as project_name';
            }
        }

        if ($this->support->hasTable('support_service_groups')) {
            $query->leftJoin('support_service_groups as ssg', 'ssg.id', '=', 'crc.support_service_group_id');
            if ($this->support->hasColumn('support_service_groups', 'group_name')) {
                $selects[] = 'ssg.group_name as support_service_group_name';
            }
        }

        if ($this->support->hasTable('internal_users')) {
            $query
                ->leftJoin('internal_users as creator', 'creator.id', '=', 'crc.created_by')
                ->leftJoin('internal_users as updater', 'updater.id', '=', 'crc.updated_by');

            if ($this->support->hasColumn('customer_request_cases', 'received_by_user_id')) {
                $query->leftJoin('internal_users as intake_receiver', 'intake_receiver.id', '=', 'crc.received_by_user_id');
            }

            if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                $query->leftJoin('internal_users as dispatcher', 'dispatcher.id', '=', 'crc.dispatcher_user_id');
            }

            if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                $query->leftJoin('internal_users as performer_owner', 'performer_owner.id', '=', 'crc.performer_user_id');
            }

            if ($this->support->hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
                $query->leftJoin('internal_users as current_handler', 'current_handler.id', '=', 'crc.nguoi_xu_ly_id');
            }

            if ($this->support->hasColumn('internal_users', 'full_name')) {
                if ($this->support->hasColumn('customer_request_cases', 'received_by_user_id')) {
                    $selects[] = 'intake_receiver.full_name as received_by_name';
                }
                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $selects[] = 'dispatcher.full_name as dispatcher_name';
                }
                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $selects[] = 'performer_owner.full_name as performer_name';
                }
                if ($this->support->hasColumn('customer_request_cases', 'nguoi_xu_ly_id')) {
                    $selects[] = 'current_handler.full_name as nguoi_xu_ly_name';
                }
                $selects[] = 'creator.full_name as created_by_name';
                $selects[] = 'updater.full_name as updated_by_name';
            }
        }

        if ($this->support->hasTable('customer_request_in_progress')) {
            $query->leftJoin('customer_request_in_progress as in_progress_status', 'in_progress_status.status_instance_id', '=', 'crc.current_status_instance_id');
        }

        if ($this->support->hasTable('customer_request_waiting_customer_feedbacks')) {
            $query->leftJoin('customer_request_waiting_customer_feedbacks as waiting_feedback_status', 'waiting_feedback_status.status_instance_id', '=', 'crc.current_status_instance_id');
        }

        $selects[] = DB::raw($this->slaDueAtExpression().' as sla_due_at');

        $query->select($selects);

        if ($userId !== null && ! $this->userAccess->isAdmin($userId)) {
            $projectIds = $this->projectIdsForUserByRaciRoles($userId);
            $query->where(function (QueryBuilder $builder) use ($userId, $projectIds): void {
                $builder
                    ->where('crc.created_by', $userId)
                    ->orWhere('crc.received_by_user_id', $userId);

                if ($this->support->hasColumn('customer_request_cases', 'dispatcher_user_id')) {
                    $builder->orWhere('crc.dispatcher_user_id', $userId);
                }

                if ($this->support->hasColumn('customer_request_cases', 'performer_user_id')) {
                    $builder->orWhere('crc.performer_user_id', $userId);
                }

                if ($projectIds !== []) {
                    $builder->orWhereIn('crc.project_id', $projectIds);
                }
            });
        }

        return $query;
    }

    public function projectIdsForUserByRaciRoles(int $userId, array $roles = ['A', 'R']): array
    {
        $normalizedRoles = array_values(array_unique(array_filter(array_map(
            static fn (string $role): string => strtoupper(trim($role)),
            $roles
        ))));
        $cacheKey = $userId.':'.implode(',', $normalizedRoles);

        if (array_key_exists($cacheKey, $this->projectScopeCache)) {
            return $this->projectScopeCache[$cacheKey];
        }

        if (
            ! $this->support->hasTable('raci_assignments')
            || ! $this->support->hasColumn('raci_assignments', 'entity_type')
            || ! $this->support->hasColumn('raci_assignments', 'entity_id')
            || ! $this->support->hasColumn('raci_assignments', 'user_id')
            || ! $this->support->hasColumn('raci_assignments', 'raci_role')
        ) {
            return $this->projectScopeCache[$cacheKey] = [];
        }

        return $this->projectScopeCache[$cacheKey] = DB::table('raci_assignments')
            ->whereRaw('LOWER(entity_type) = ?', ['project'])
            ->where('user_id', $userId)
            ->whereIn('raci_role', $normalizedRoles)
            ->pluck('entity_id')
            ->map(fn ($value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->unique()
            ->values()
            ->all();
    }

    public function slaDueAtExpression(): string
    {
        $expressions = [];

        if ($this->support->hasTable('customer_request_in_progress') && $this->support->hasColumn('customer_request_in_progress', 'expected_completed_at')) {
            $expressions[] = 'in_progress_status.expected_completed_at';
        }

        if (
            $this->support->hasTable('customer_request_waiting_customer_feedbacks')
            && $this->support->hasColumn('customer_request_waiting_customer_feedbacks', 'customer_due_at')
        ) {
            $expressions[] = 'waiting_feedback_status.customer_due_at';
        }

        if ($expressions === []) {
            return 'NULL';
        }

        if (count($expressions) === 1) {
            return $expressions[0];
        }

        return 'COALESCE('.implode(', ', $expressions).')';
    }

    /**
     * @return array<int, string>
     */
    private function requiredTables(): array
    {
        return [
            'customer_request_cases',
            'customer_request_status_catalogs',
            'customer_request_status_transitions',
            'customer_request_status_instances',
            'customer_request_worklogs',
            'customer_request_status_ref_tasks',
            'customer_request_status_attachments',
            ...$this->metadataService->getStatusTables(),
        ];
    }
}
