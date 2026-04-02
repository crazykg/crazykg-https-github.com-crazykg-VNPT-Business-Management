<?php

namespace App\Services\V5\CustomerRequest\Write;

use App\Models\CustomerRequestCase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Orchestrator that delegates to sub-services while preserving the original public API.
 *
 * **TEMPORARY:** This currently wraps the original CustomerRequestCaseWriteService for backward compatibility.
 * Individual methods will be extracted to sub-services (CaseCreateService, CaseTransitionService, CaseDeleteService)
 * in a gradual refactor.
 *
 * This pattern ensures consumers can be updated before the implementation is fully split.
 */
class CaseWriteOrchestrator
{
    public function __construct(
        private readonly \App\Services\V5\CustomerRequest\CustomerRequestCaseWriteService $originalWriteService,
    ) {}

    /**
     * Create a new customer request case.
     *
     * @param callable(CustomerRequestCase,string,?int): array<string,mixed> $buildStatusDetailData
     */
    public function store(Request $request, callable $buildStatusDetailData): JsonResponse
    {
        return $this->originalWriteService->store($request, $buildStatusDetailData);
    }

    /**
     * Save status for a case without transitioning.
     */
    public function saveStatus(Request $request, int $id, string $statusCode, callable $buildStatusDetailData): JsonResponse
    {
        return $this->originalWriteService->saveStatus($request, $id, $statusCode, $buildStatusDetailData);
    }

    /**
     * Transition case to a new status.
     */
    public function transition(Request $request, int $id, callable $buildStatusDetailData): JsonResponse
    {
        return $this->originalWriteService->transition($request, $id, $buildStatusDetailData);
    }

    /**
     * Update sub-status (coding_phase or dms_phase).
     */
    public function updateSubStatus(Request $request, int $id): JsonResponse
    {
        return $this->originalWriteService->updateSubStatus($request, $id);
    }

    /**
     * Delete (soft-delete) a customer request case.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->originalWriteService->destroy($request, $id);
    }

    /**
     * Filter payload to only include columns that exist in the given table.
     * Delegated for backward compatibility.
     */
    public function filterByTableColumns(string $table, array $payload): array
    {
        return $this->originalWriteService->filterByTableColumns($table, $payload);
    }

    /**
     * Resolve requester name snapshot.
     * Delegated for backward compatibility.
     */
    public function resolveRequesterSnapshot(?int $customerPersonnelId, mixed $fallback = null): ?string
    {
        return $this->originalWriteService->resolveRequesterSnapshot($customerPersonnelId, $fallback);
    }
}
