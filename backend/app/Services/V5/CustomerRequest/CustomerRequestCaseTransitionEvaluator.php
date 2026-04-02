<?php

namespace App\Services\V5\CustomerRequest;

use App\Models\CustomerRequestCase;
use App\Services\V5\V5DomainSupportService;

class CustomerRequestCaseTransitionEvaluator
{
    private const PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE = 'pm_missing_customer_info_review';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO = 'customer_missing_info';

    private const PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON = 'other_reason';

    public function __construct(
        private readonly V5DomainSupportService $support,
    ) {}

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public function filterAllowedTransitionsForCase(
        ?CustomerRequestCase $case,
        string $statusCode,
        array $rows,
        ?string $direction = null
    ): array {
        if ($case === null || $direction !== 'forward') {
            return $rows;
        }

        $allowedTargets = $this->resolveAllowedTargets($case, $statusCode, $rows);
        if ($allowedTargets === null) {
            return $rows;
        }

        return array_values(array_filter(
            $rows,
            static fn (array $row): bool => in_array((string) ($row['to_status_code'] ?? ''), $allowedTargets, true)
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public function buildDecisionMetadataForTransition(
        CustomerRequestCase $case,
        string $fromStatusCode,
        string $toStatusCode
    ): array {
        if (! in_array($toStatusCode, ['waiting_customer_feedback', 'not_executed'], true)) {
            return [];
        }

        $isDispatcherNewIntake = $fromStatusCode === 'new_intake' && $this->resolveNewIntakeLane($case) === 'dispatcher';
        $isReturnedToManagerReview = $fromStatusCode === 'returned_to_manager';

        if (! $isDispatcherNewIntake && ! $isReturnedToManagerReview) {
            return [];
        }

        return [
            'decision_context_code' => self::PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE,
            'decision_outcome_code' => $toStatusCode === 'waiting_customer_feedback'
                ? self::PM_MISSING_CUSTOMER_INFO_OUTCOME_CUSTOMER_MISSING_INFO
                : self::PM_MISSING_CUSTOMER_INFO_OUTCOME_OTHER_REASON,
            'decision_source_status_code' => $fromStatusCode,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function buildPmMissingCustomerInfoDecisionAction(
        CustomerRequestCase $case,
        string $currentStatusCode,
        bool $enabled
    ): ?array {
        $targets = [];
        foreach (['waiting_customer_feedback', 'not_executed'] as $targetStatusCode) {
            if ($this->buildDecisionMetadataForTransition($case, $currentStatusCode, $targetStatusCode) !== []) {
                $targets[] = $targetStatusCode;
            }
        }

        if ($targets === []) {
            return null;
        }

        return [
            'enabled' => $enabled,
            'context_code' => self::PM_MISSING_CUSTOMER_INFO_DECISION_CONTEXT_CODE,
            'source_status_code' => $currentStatusCode,
            'target_status_codes' => $targets,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, string>|null
     */
    private function resolveAllowedTargets(CustomerRequestCase $case, string $statusCode, array $rows): ?array
    {
        if ($statusCode === 'new_intake') {
            return $this->resolveNewIntakeAllowedTargets($case, $rows);
        }

        if ($statusCode === 'in_progress') {
            return ['completed'];
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, string>
     */
    private function resolveNewIntakeAllowedTargets(CustomerRequestCase $case, array $rows): array
    {
        $lane = $this->resolveNewIntakeLane($case);
        $rowsWithLane = array_values(array_filter(
            $rows,
            fn (array $row): bool => $this->normalizeNullableString(($row['transition_meta']['lane_key'] ?? null)) !== null
        ));

        if ($rowsWithLane !== []) {
            $allowedLaneKeys = $lane === 'performer'
                ? ['performer', 'self_handle']
                : ['dispatcher'];

            $filtered = array_values(array_filter(
                $rows,
                function (array $row) use ($allowedLaneKeys): bool {
                    $laneKey = $this->normalizeNullableString($row['transition_meta']['lane_key'] ?? null);

                    return $laneKey === null || in_array($laneKey, $allowedLaneKeys, true);
                }
            ));

            return array_values(array_map(
                static fn (array $row): string => (string) ($row['to_status_code'] ?? ''),
                $filtered
            ));
        }

        // Fallback: return all available to_status_codes from transitions if no lane-based filtering applies
        // This handles workflows where transitions are defined without lane_key metadata
        if ($rows !== []) {
            return array_values(array_map(
                static fn (array $row): string => (string) ($row['to_status_code'] ?? ''),
                $rows
            ));
        }

        // Last resort: hard-coded defaults for legacy compatibility
        return $lane === 'performer'
            ? ['in_progress', 'returned_to_manager']
            : ['not_executed', 'waiting_customer_feedback', 'in_progress', 'analysis'];
    }

    private function resolveNewIntakeLane(CustomerRequestCase $case): string
    {
        $dispatchRoute = trim((string) ($case->dispatch_route ?? ''));
        $hasPerformer = $this->support->parseNullableInt($case->performer_user_id) !== null;

        if ($dispatchRoute === 'self_handle' || $dispatchRoute === 'assign_direct') {
            return 'performer';
        }

        if ($dispatchRoute === 'assign_pm') {
            return $hasPerformer ? 'performer' : 'dispatcher';
        }

        return $hasPerformer ? 'performer' : 'dispatcher';
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        return $this->support->normalizeNullableString($value);
    }
}
