<?php

namespace App\Services\V5\Workflow;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use App\Services\V5\V5AccessAuditService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

/**
 * Class WorkflowTransitionService
 * 
 * Service layer cho WorkflowTransition - CRUD operations và business logic
 * 
 * @package App\Services\V5\Workflow
 */
class WorkflowTransitionService
{
    /**
     * Create a new service instance.
     */
    public function __construct(
        protected V5AccessAuditService $auditService
    ) {}

    /**
     * Get all transitions for a workflow.
     *
     * @param int $workflowId
     * @param bool $activeOnly
     * @return Collection<int, WorkflowTransition>
     */
    public function getTransitionsForWorkflow(int $workflowId, bool $activeOnly = true): Collection
    {
        $query = WorkflowTransition::where('workflow_definition_id', $workflowId);
        
        if ($activeOnly) {
            $query->where('is_active', true);
        }
        
        $query->orderBy('sort_order');
        
        return $query->get();
    }

    /**
     * Get transitions from a specific status code.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param bool $activeOnly
     * @return Collection<int, WorkflowTransition>
     */
    public function getTransitionsFromStatus(
        int $workflowId,
        string $fromStatusCode,
        bool $activeOnly = true
    ): Collection {
        $query = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->where('from_status_code', $fromStatusCode);
        
        if ($activeOnly) {
            $query->where('is_active', true);
        }
        
        $query->orderBy('sort_order');
        
        return $query->get();
    }

    /**
     * Get a specific transition.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @return WorkflowTransition|null
     */
    public function getTransition(
        int $workflowId,
        string $fromStatusCode,
        string $toStatusCode
    ): ?WorkflowTransition {
        return WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->where('from_status_code', $fromStatusCode)
            ->where('to_status_code', $toStatusCode)
            ->first();
    }

    /**
     * Check if a transition is allowed.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @return bool
     */
    public function isTransitionAllowed(
        int $workflowId,
        string $fromStatusCode,
        string $toStatusCode
    ): bool {
        return $this->getTransition($workflowId, $fromStatusCode, $toStatusCode) !== null;
    }

    /**
     * Get allowed roles for a transition.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @return array<int, string>|null
     */
    public function getAllowedRoles(
        int $workflowId,
        string $fromStatusCode,
        string $toStatusCode
    ): ?array {
        $transition = $this->getTransition($workflowId, $fromStatusCode, $toStatusCode);
        
        return $transition?->allowed_roles;
    }

    /**
     * Check if a user role can execute a transition.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param string $toStatusCode
     * @param string $role
     * @return bool
     */
    public function canUserExecuteTransition(
        int $workflowId,
        string $fromStatusCode,
        string $toStatusCode,
        string $role
    ): bool {
        $transition = $this->getTransition($workflowId, $fromStatusCode, $toStatusCode);
        
        if (!$transition) {
            return false;
        }
        
        return $transition->canExecute($role);
    }

    /**
     * Create a new transition.
     *
     * @param int $workflowId
     * @param array<string, mixed> $data
     * @param int|null $userId
     * @return WorkflowTransition
     * @throws RuntimeException
     */
    public function createTransition(int $workflowId, array $data, ?int $userId = null): WorkflowTransition
    {
        // Validate workflow exists
        $workflow = WorkflowDefinition::find($workflowId);
        
        if (!$workflow) {
            throw new RuntimeException('Workflow not found');
        }

        // Validate
        $validator = Validator::make($data, [
            'from_status_code' => 'required|string|max:80',
            'to_status_code' => 'required|string|max:80',
            'allowed_roles' => 'required|array',
            'allowed_roles.*' => 'string|in:all,R,A,C,I',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string',
            'transition_config' => 'nullable|array',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            throw new RuntimeException('Validation failed: ' . json_encode($validator->errors()->all()));
        }

        // Check for duplicate
        $existing = $this->getTransition(
            $workflowId,
            $data['from_status_code'],
            $data['to_status_code']
        );
        
        if ($existing) {
            throw new RuntimeException('Transition already exists for this from_status → to_status combination');
        }

        // Create transition
        $transition = DB::transaction(function () use ($workflow, $validator, $userId) {
            $validated = $validator->validated();
            
            $transition = WorkflowTransition::create([
                'workflow_definition_id' => $workflow->id,
                'from_status_code' => $validated['from_status_code'],
                'to_status_code' => $validated['to_status_code'],
                'allowed_roles' => $validated['allowed_roles'],
                'required_fields' => $validated['required_fields'] ?? [],
                'transition_config' => $validated['transition_config'] ?? [],
                'sort_order' => $validated['sort_order'] ?? 0,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $this->auditService->recordAuditEvent(
                request(),
                'INSERT',
                'customer_request_status_transitions',
                $transition->id,
                null,
                [
                    'workflow_definition_id' => $workflow->id,
                    'workflow_code' => $workflow->code,
                    'from_status_code' => $transition->from_status_code,
                    'to_status_code' => $transition->to_status_code,
                    'allowed_roles' => $transition->allowed_roles,
                ]
            );
            
            return $transition;
        });

        return $transition->fresh();
    }

    /**
     * Update an existing transition.
     *
     * @param int $transitionId
     * @param array<string, mixed> $data
     * @param int|null $userId
     * @return WorkflowTransition
     * @throws RuntimeException
     */
    public function updateTransition(int $transitionId, array $data, ?int $userId = null): WorkflowTransition
    {
        $transition = WorkflowTransition::find($transitionId);
        
        if (!$transition) {
            throw new RuntimeException('Transition not found');
        }

        // Validate
        $validator = Validator::make($data, [
            'from_status_code' => 'sometimes|required|string|max:80',
            'to_status_code' => 'sometimes|required|string|max:80',
            'allowed_roles' => 'sometimes|required|array',
            'allowed_roles.*' => 'string|in:all,R,A,C,I',
            'required_fields' => 'nullable|array',
            'required_fields.*' => 'string',
            'transition_config' => 'nullable|array',
            'sort_order' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            throw new RuntimeException('Validation failed: ' . json_encode($validator->errors()->all()));
        }

        // Check for duplicate if changing from_status or to_status
        if (isset($data['from_status_code']) || isset($data['to_status_code'])) {
            $existing = WorkflowTransition::where('workflow_definition_id', $transition->workflow_definition_id)
                ->where('id', '!=', $transitionId)
                ->where('from_status_code', $data['from_status_code'] ?? $transition->from_status_code)
                ->where('to_status_code', $data['to_status_code'] ?? $transition->to_status_code)
                ->exists();
            
            if ($existing) {
                throw new RuntimeException('Another transition already exists for this from_status → to_status combination');
            }
        }

        // Update transition
        $transition = DB::transaction(function () use ($transition, $validator, $userId) {
            $validated = $validator->validated();
            
            if ($userId !== null) {
                $validated['updated_by'] = $userId;
            }
            
            $transition->update($validated);

            $this->auditService->recordAuditEvent(
                request(),
                'UPDATE',
                'customer_request_status_transitions',
                $transition->id,
                null,
                $validated
            );
            
            return $transition;
        });

        return $transition->fresh();
    }

    /**
     * Delete a transition.
     *
     * @param int $transitionId
     * @param int|null $userId
     * @return bool
     * @throws RuntimeException
     */
    public function deleteTransition(int $transitionId, ?int $userId = null): bool
    {
        $transition = WorkflowTransition::find($transitionId);
        
        if (!$transition) {
            throw new RuntimeException('Transition not found');
        }

        DB::transaction(function () use ($transition, $userId) {
            $transitionId = $transition->id;
            $workflowCode = $transition->workflow->code ?? 'unknown';
            
            $transition->delete();

            $this->auditService->recordAuditEvent(
                request(),
                'DELETE',
                'customer_request_status_transitions',
                $transitionId,
                [
                    'workflow_code' => $workflowCode,
                    'from_status_code' => $transition->from_status_code,
                    'to_status_code' => $transition->to_status_code,
                ],
                null
            );
        });

        return true;
    }

    /**
     * Bulk create transitions from array.
     *
     * @param int $workflowId
     * @param array<int, array<string, mixed>> $transitionsData
     * @param int|null $userId
     * @return Collection<int, WorkflowTransition>
     * @throws RuntimeException
     */
    public function bulkCreateTransitions(
        int $workflowId,
        array $transitionsData,
        ?int $userId = null
    ): Collection {
        $workflow = WorkflowDefinition::find($workflowId);
        
        if (!$workflow) {
            throw new RuntimeException('Workflow not found');
        }

        $createdTransitions = DB::transaction(function () use ($workflow, $transitionsData, $userId) {
            $transitions = [];
            
            foreach ($transitionsData as $index => $data) {
                // Validate each transition
                $validator = Validator::make($data, [
                    'from_status_code' => 'required|string|max:80',
                    'to_status_code' => 'required|string|max:80',
                    'allowed_roles' => 'required|array',
                    'allowed_roles.*' => 'string|in:all,R,A,C,I',
                    'required_fields' => 'nullable|array',
                    'sort_order' => 'integer|min:0',
                    'is_active' => 'boolean',
                ]);

                if ($validator->fails()) {
                    throw new RuntimeException("Transition {$index}: Validation failed - " . json_encode($validator->errors()->all()));
                }

                // Check for duplicate
                $existing = $this->getTransition(
                    $workflow->id,
                    $data['from_status_code'],
                    $data['to_status_code']
                );
                
                if ($existing) {
                    throw new RuntimeException("Transition {$index}: Duplicate - {$data['from_status_code']} → {$data['to_status_code']} already exists");
                }

                $transition = WorkflowTransition::create([
                    'workflow_definition_id' => $workflow->id,
                    'from_status_code' => $data['from_status_code'],
                    'to_status_code' => $data['to_status_code'],
                    'allowed_roles' => $data['allowed_roles'],
                    'required_fields' => $data['required_fields'] ?? [],
                    'transition_config' => $data['transition_config'] ?? [],
                    'sort_order' => $data['sort_order'] ?? 0,
                    'is_active' => $data['is_active'] ?? true,
                ]);

                $transitions[] = $transition;
            }
            
            return new Collection($transitions);
        });

        return $createdTransitions;
    }

    /**
     * Bulk import transitions from Excel data.
     *
     * @param int $workflowId
     * @param array<int, array<string, mixed>> $excelData
     * @param bool $skipDuplicates
     * @param bool $updateExisting
     * @param int|null $userId
     * @return array<string, mixed>
     * @throws RuntimeException
     */
    public function bulkImportFromExcel(
        int $workflowId,
        array $excelData,
        bool $skipDuplicates = false,
        bool $updateExisting = false,
        ?int $userId = null
    ): array {
        $workflow = WorkflowDefinition::find($workflowId);
        
        if (!$workflow) {
            throw new RuntimeException('Workflow not found');
        }

        $stats = [
            'success' => 0,
            'skipped' => 0,
            'updated' => 0,
            'errors' => [],
        ];

        DB::transaction(function () use ($workflow, $excelData, $skipDuplicates, $updateExisting, $userId, &$stats) {
            foreach ($excelData as $index => $row) {
                try {
                    // Validate row data
                    $validator = Validator::make($row, [
                        'from_status_code' => 'required|string|max:80',
                        'to_status_code' => 'required|string|max:80',
                        'allowed_roles' => 'required|array',
                        'allowed_roles.*' => 'string|in:all,R,A,C,I',
                        'required_fields' => 'nullable|array',
                        'sort_order' => 'integer|min:0',
                        'is_active' => 'boolean',
                    ]);

                    if ($validator->fails()) {
                        $stats['errors'][] = "Row {$index}: " . json_encode($validator->errors()->all());
                        continue;
                    }

                    // Check for duplicate
                    $existing = $this->getTransition(
                        $workflow->id,
                        $row['from_status_code'],
                        $row['to_status_code']
                    );

                    if ($existing) {
                        if ($skipDuplicates) {
                            $stats['skipped']++;
                            continue;
                        }

                        if ($updateExisting) {
                            $existing->update([
                                'allowed_roles' => $row['allowed_roles'],
                                'required_fields' => $row['required_fields'] ?? [],
                                'transition_config' => $row['transition_config'] ?? [],
                                'sort_order' => $row['sort_order'] ?? 0,
                                'is_active' => $row['is_active'] ?? true,
                            ]);
                            $stats['updated']++;
                            continue;
                        }

                        $stats['errors'][] = "Row {$index}: Duplicate - {$row['from_status_code']} → {$row['to_status_code']}";
                        continue;
                    }

                    // Create new transition
                    WorkflowTransition::create([
                        'workflow_definition_id' => $workflow->id,
                        'from_status_code' => $row['from_status_code'],
                        'to_status_code' => $row['to_status_code'],
                        'allowed_roles' => $row['allowed_roles'],
                        'required_fields' => $row['required_fields'] ?? [],
                        'transition_config' => $row['transition_config'] ?? [],
                        'sort_order' => $row['sort_order'] ?? 0,
                        'is_active' => $row['is_active'] ?? true,
                    ]);

                    $stats['success']++;
                } catch (RuntimeException $e) {
                    $stats['errors'][] = "Row {$index}: {$e->getMessage()}";
                }
            }

        });

        return $stats;
    }

    /**
     * Get transition statistics for a workflow.
     *
     * @param int $workflowId
     * @return array<string, mixed>
     */
    public function getTransitionStatistics(int $workflowId): array
    {
        $total = WorkflowTransition::where('workflow_definition_id', $workflowId)->count();
        $active = WorkflowTransition::where('workflow_definition_id', $workflowId)->where('is_active', true)->count();
        $inactive = WorkflowTransition::where('workflow_definition_id', $workflowId)->where('is_active', false)->count();
        
        // Count by allowed_roles
        $allRoles = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->whereJsonContains('allowed_roles', 'all')
            ->count();
        $rRoles = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->whereJsonContains('allowed_roles', 'R')
            ->count();
        $aRoles = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->whereJsonContains('allowed_roles', 'A')
            ->count();
        
        // Get unique from_status codes
        $fromStatuses = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->distinct()
            ->pluck('from_status_code');
        
        // Get unique to_status codes
        $toStatuses = WorkflowTransition::where('workflow_definition_id', $workflowId)
            ->distinct()
            ->pluck('to_status_code');
        
        return [
            'total_transitions' => $total,
            'active_transitions' => $active,
            'inactive_transitions' => $inactive,
            'allowed_roles_all' => $allRoles,
            'allowed_roles_R' => $rRoles,
            'allowed_roles_A' => $aRoles,
            'unique_from_statuses' => $fromStatuses->count(),
            'unique_to_statuses' => $toStatuses->count(),
            'from_status_codes' => $fromStatuses->toArray(),
            'to_status_codes' => $toStatuses->toArray(),
        ];
    }
}
