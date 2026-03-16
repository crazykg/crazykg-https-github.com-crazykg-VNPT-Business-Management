<?php

namespace App\Services\V5\Workflow;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class StatusDrivenSlaResolver
{
    /**
     * @return array<string, mixed>|null
     */
    public function resolve(
        string $status,
        ?string $subStatus,
        string $priority,
        ?string $requestTypePrefix = null,
        ?int $serviceGroupId = null,
        ?string $workflowActionCode = null
    ): ?array
    {
        if (! Schema::hasTable('sla_configs')) {
            return null;
        }

        $normalizedStatus = $this->normalizeToken($status);
        $normalizedSubStatus = $this->normalizeToken($subStatus);
        $normalizedPriority = $this->normalizeToken($priority);
        $normalizedPrefix = $this->normalizeToken($requestTypePrefix);
        $normalizedWorkflowActionCode = $this->normalizeToken($workflowActionCode);

        if ($normalizedStatus === '' || $normalizedPriority === '') {
            return null;
        }

        $query = DB::table('sla_configs');
        if (Schema::hasColumn('sla_configs', 'is_active')) {
            $query->where('is_active', 1);
        }

        if (Schema::hasColumn('sla_configs', 'status')) {
            $query->whereRaw('UPPER(TRIM(status)) = ?', [$normalizedStatus]);
        } else {
            return $this->resolveLegacyPrefixRule($normalizedPrefix, $normalizedPriority);
        }

        if (Schema::hasColumn('sla_configs', 'priority')) {
            $query->whereRaw('UPPER(TRIM(priority)) = ?', [$normalizedPriority]);
        } else {
            return null;
        }

        $hasSubStatusColumn = Schema::hasColumn('sla_configs', 'sub_status');
        $hasPrefixColumn = Schema::hasColumn('sla_configs', 'request_type_prefix');
        $hasServiceGroupColumn = Schema::hasColumn('sla_configs', 'service_group_id');
        $hasWorkflowActionCodeColumn = Schema::hasColumn('sla_configs', 'workflow_action_code');

        if ($hasSubStatusColumn) {
            if ($normalizedSubStatus !== '') {
                $query->where(function ($builder) use ($normalizedSubStatus): void {
                    $builder->whereRaw('UPPER(TRIM(sub_status)) = ?', [$normalizedSubStatus])
                        ->orWhereNull('sub_status')
                        ->orWhereRaw('TRIM(sub_status) = ?', ['']);
                });
                $query->orderByRaw(
                    "CASE
                        WHEN UPPER(TRIM(sub_status)) = ? THEN 0
                        WHEN sub_status IS NULL OR TRIM(sub_status) = '' THEN 1
                        ELSE 2
                    END",
                    [$normalizedSubStatus]
                );
            } else {
                $query->where(function ($builder): void {
                    $builder->whereNull('sub_status')
                        ->orWhereRaw('TRIM(sub_status) = ?', ['']);
                });
            }
        }

        if ($hasPrefixColumn) {
            if ($normalizedPrefix !== '') {
                $query->where(function ($builder) use ($normalizedPrefix): void {
                    $builder->whereRaw('UPPER(TRIM(request_type_prefix)) = ?', [$normalizedPrefix])
                        ->orWhereNull('request_type_prefix')
                        ->orWhereRaw('TRIM(request_type_prefix) = ?', ['']);
                });
                $query->orderByRaw(
                    "CASE
                        WHEN UPPER(TRIM(request_type_prefix)) = ? THEN 0
                        WHEN request_type_prefix IS NULL OR TRIM(request_type_prefix) = '' THEN 1
                        ELSE 2
                    END",
                    [$normalizedPrefix]
                );
            } else {
                // Status-driven mode: when no prefix is provided, do not restrict by prefix.
                // Prefer wildcard rows first, then allow prefix-specific rows as fallback.
                $query->orderByRaw(
                    "CASE
                        WHEN request_type_prefix IS NULL OR TRIM(request_type_prefix) = '' THEN 0
                        ELSE 1
                    END"
                );
            }
        }

        if ($hasServiceGroupColumn) {
            if ($serviceGroupId !== null) {
                $query->where(function ($builder) use ($serviceGroupId): void {
                    $builder->where('service_group_id', $serviceGroupId)
                        ->orWhereNull('service_group_id');
                });
                $query->orderByRaw(
                    "CASE
                        WHEN service_group_id = ? THEN 0
                        WHEN service_group_id IS NULL THEN 1
                        ELSE 2
                    END",
                    [$serviceGroupId]
                );
            } else {
                $query->whereNull('service_group_id');
            }
        }

        if ($hasWorkflowActionCodeColumn) {
            if ($normalizedWorkflowActionCode !== '') {
                $query->where(function ($builder) use ($normalizedWorkflowActionCode): void {
                    $builder->whereRaw('UPPER(TRIM(workflow_action_code)) = ?', [$normalizedWorkflowActionCode])
                        ->orWhereNull('workflow_action_code')
                        ->orWhereRaw('TRIM(workflow_action_code) = ?', ['']);
                });
                $query->orderByRaw(
                    "CASE
                        WHEN UPPER(TRIM(workflow_action_code)) = ? THEN 0
                        WHEN workflow_action_code IS NULL OR TRIM(workflow_action_code) = '' THEN 1
                        ELSE 2
                    END",
                    [$normalizedWorkflowActionCode]
                );
            } else {
                $query->where(function ($builder): void {
                    $builder->whereNull('workflow_action_code')
                        ->orWhereRaw('TRIM(workflow_action_code) = ?', ['']);
                });
            }
        }

        if (Schema::hasColumn('sla_configs', 'sort_order')) {
            $query->orderBy('sort_order');
        }
        $query->orderBy('id');

        $record = $query->first();
        if (! $record) {
            return null;
        }

        return (array) $record;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveLegacyPrefixRule(string $requestTypePrefix, string $priority): ?array
    {
        if (
            ! Schema::hasColumn('sla_configs', 'request_type_prefix')
            || ! Schema::hasColumn('sla_configs', 'priority')
        ) {
            return null;
        }

        $query = DB::table('sla_configs')
            ->whereRaw('UPPER(TRIM(priority)) = ?', [$priority]);

        if (Schema::hasColumn('sla_configs', 'is_active')) {
            $query->where('is_active', 1);
        }

        if ($requestTypePrefix !== '') {
            $query->where(function ($builder) use ($requestTypePrefix): void {
                $builder->whereRaw('UPPER(TRIM(request_type_prefix)) = ?', [$requestTypePrefix])
                    ->orWhereNull('request_type_prefix')
                    ->orWhereRaw('TRIM(request_type_prefix) = ?', ['']);
            });
            $query->orderByRaw(
                "CASE
                    WHEN UPPER(TRIM(request_type_prefix)) = ? THEN 0
                    WHEN request_type_prefix IS NULL OR TRIM(request_type_prefix) = '' THEN 1
                    ELSE 2
                END",
                [$requestTypePrefix]
            );
        } else {
            $query->orderByRaw(
                "CASE
                    WHEN request_type_prefix IS NULL OR TRIM(request_type_prefix) = '' THEN 0
                    ELSE 1
                END"
            );
        }

        $query->orderBy('id');
        $record = $query->first();

        return $record ? (array) $record : null;
    }

    private function normalizeToken(?string $value): string
    {
        return strtoupper(trim((string) ($value ?? '')));
    }
}
