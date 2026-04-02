<?php

namespace App\Services\V5\CustomerRequest\Write;

use App\Models\CustomerRequestStatusInstance;
use App\Services\V5\CustomerRequest\CustomerRequestCaseReadQueryService;
use App\Services\V5\V5DomainSupportService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shared utilities for customer request case write operations.
 *
 * Contains reusable helper methods for data normalization, table introspection,
 * and status management. All write sub-services inherit from this class.
 */
abstract class CaseWriteUtilities
{
    private const PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE = 'pm_missing_customer_info_review';
    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO = 'customer_missing_info';
    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON = 'other_reason';

    /**
     * @var array<string, array<int, string>>
     */
    protected array $tableColumns = [];

    public function __construct(
        protected readonly V5DomainSupportService $support,
        protected readonly CustomerRequestCaseReadQueryService $readQueryService,
    ) {}

    /**
     * Filter payload to only include columns that exist in the given table.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function filterByTableColumns(string $table, array $payload): array
    {
        $allowedColumns = array_flip($this->tableColumns($table));
        $filtered = [];
        foreach ($payload as $key => $value) {
            if (isset($allowedColumns[$key])) {
                $filtered[$key] = $value;
            }
        }

        return $filtered;
    }

    /**
     * Resolve requester name from customer_personnel or fallback to snapshot string.
     */
    public function resolveRequesterSnapshot(?int $customerPersonnelId, mixed $fallback = null): ?string
    {
        if (
            $customerPersonnelId !== null
            && $this->support->hasTable('customer_personnel')
            && $this->support->hasColumn('customer_personnel', 'full_name')
        ) {
            $name = DB::table('customer_personnel')
                ->where('id', $customerPersonnelId)
                ->when($this->support->hasColumn('customer_personnel', 'deleted_at'), fn ($query) => $query->whereNull('deleted_at'))
                ->value('full_name');
            if (is_string($name) && trim($name) !== '') {
                return trim($name);
            }
        }

        return $this->normalizeNullableString($fallback);
    }

    /**
     * Normalize field value based on field type definition.
     *
     * @param array<string, mixed> $field
     */
    protected function normalizeFieldValue(array $field, mixed $value): mixed
    {
        $type = (string) ($field['type'] ?? 'text');

        return match ($type) {
            'number', 'priority', 'user_select', 'customer_select', 'customer_personnel_select', 'support_group_select'
                => $this->support->parseNullableInt($value),
            'datetime' => $this->readQueryService->normalizeDateTime($value),
            default => $this->normalizeNullableString($value),
        };
    }

    /**
     * Normalize any value to nullable string.
     */
    protected function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }

    /**
     * Get cached table columns for schema introspection.
     *
     * @return array<int, string>
     */
    protected function tableColumns(string $table): array
    {
        if (! isset($this->tableColumns[$table])) {
            $this->tableColumns[$table] = Schema::hasTable($table)
                ? Schema::getColumnListing($table)
                : [];
        }

        return $this->tableColumns[$table];
    }

    /**
     * Check if status definition is backed by master table (not a detail table).
     *
     * @param array<string, mixed> $statusDefinition
     */
    protected function isMasterBackedStatus(array $statusDefinition): bool
    {
        return (string) ($statusDefinition['table_name'] ?? '') === 'customer_request_cases';
    }

    /**
     * Resolve the "entered_at" timestamp for a status based on context.
     *
     * @param array<string, mixed> $statusPayload
     */
    protected function resolveStatusEnteredAt(string $statusCode, array $statusPayload, \App\Models\CustomerRequestCase $case): string
    {
        $candidates = match ($statusCode) {
            'new_intake' => [$statusPayload['received_at'] ?? null, $case->received_at, $case->created_at],
            'waiting_customer_feedback' => [$statusPayload['feedback_requested_at'] ?? null, $case->received_at],
            'in_progress' => [$statusPayload['started_at'] ?? null, $case->received_at],
            'not_executed' => [$statusPayload['decision_at'] ?? null, now()],
            'completed' => [$statusPayload['completed_at'] ?? null, now()],
            'customer_notified' => [$statusPayload['notified_at'] ?? null, now()],
            'returned_to_manager' => [$statusPayload['returned_at'] ?? null, now()],
            default => [now()],
        };

        foreach ($candidates as $candidate) {
            $normalized = $this->readQueryService->normalizeDateTime($candidate);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return now()->format('Y-m-d H:i:s');
    }

    /**
     * Get the current status instance for a case.
     */
    protected function currentStatusInstance(\App\Models\CustomerRequestCase $case): ?CustomerRequestStatusInstance
    {
        $instanceId = $this->support->parseNullableInt($case->current_status_instance_id);
        if ($instanceId !== null) {
            return CustomerRequestStatusInstance::query()->find($instanceId);
        }

        return CustomerRequestStatusInstance::query()
            ->where('request_case_id', $case->id)
            ->where('is_current', 1)
            ->orderByDesc('id')
            ->first();
    }
}
