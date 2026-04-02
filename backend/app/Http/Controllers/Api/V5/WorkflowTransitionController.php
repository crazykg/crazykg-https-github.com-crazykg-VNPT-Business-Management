<?php

namespace App\Http\Controllers\Api\V5;

use App\Http\Controllers\Controller;
use App\Services\V5\V5AccessAuditService;
use App\Services\V5\Workflow\WorkflowTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Class WorkflowTransitionController
 * 
 * Controller cho Workflow Transition API endpoints
 * 
 * @package App\Http\Controllers\Api\V5
 */
class WorkflowTransitionController extends Controller
{
    /**
     * Create a new controller instance.
     */
    public function __construct(
        protected WorkflowTransitionService $service,
        protected V5AccessAuditService $accessAudit
    ) {}

    /**
     * GET /api/v5/workflow-definitions/{workflowId}/transitions
     * 
     * Get all transitions for a workflow.
     *
     * @param int $workflowId
     * @param Request $request
     * @return JsonResponse
     */
    public function index(int $workflowId, Request $request): JsonResponse
    {
        $activeOnly = $request->boolean('active_only', true);
        
        $transitions = $this->service->getTransitionsForWorkflow($workflowId, $activeOnly);
        
        return response()->json([
            'data' => $transitions->map(fn ($t) => $t->getFullData()),
            'meta' => [
                'workflow_definition_id' => $workflowId,
                'total' => $transitions->count(),
                'active_only' => $activeOnly,
            ],
        ]);
    }

    /**
     * GET /api/v5/workflow-definitions/{workflowId}/transitions/from/{fromStatusCode}
     * 
     * Get transitions from a specific status.
     *
     * @param int $workflowId
     * @param string $fromStatusCode
     * @param Request $request
     * @return JsonResponse
     */
    public function fromStatus(int $workflowId, string $fromStatusCode, Request $request): JsonResponse
    {
        $activeOnly = $request->boolean('active_only', true);
        
        $transitions = $this->service->getTransitionsFromStatus($workflowId, $fromStatusCode, $activeOnly);
        
        return response()->json([
            'data' => $transitions->map(fn ($t) => $t->getFullData()),
            'meta' => [
                'workflow_definition_id' => $workflowId,
                'from_status_code' => $fromStatusCode,
                'total' => $transitions->count(),
                'active_only' => $activeOnly,
            ],
        ]);
    }

    /**
     * GET /api/v5/workflow-definitions/{workflowId}/transitions/check
     * 
     * Check if a transition is allowed and get allowed roles.
     *
     * @param int $workflowId
     * @param Request $request
     * @return JsonResponse
     */
    public function check(int $workflowId, Request $request): JsonResponse
    {
        $fromStatusCode = $request->get('from_status_code');
        $toStatusCode = $request->get('to_status_code');
        $role = $request->get('role');
        
        if (!$fromStatusCode || !$toStatusCode) {
            return response()->json([
                'message' => 'Missing from_status_code or to_status_code',
            ], 422);
        }
        
        $isAllowed = $this->service->isTransitionAllowed($workflowId, $fromStatusCode, $toStatusCode);
        $allowedRoles = $this->service->getAllowedRoles($workflowId, $fromStatusCode, $toStatusCode);
        $canExecute = $role ? $this->service->canUserExecuteTransition($workflowId, $fromStatusCode, $toStatusCode, $role) : null;
        
        return response()->json([
            'data' => [
                'is_allowed' => $isAllowed,
                'allowed_roles' => $allowedRoles,
                'can_execute' => $canExecute,
                'from_status_code' => $fromStatusCode,
                'to_status_code' => $toStatusCode,
            ],
        ]);
    }

    /**
     * GET /api/v5/workflow-transitions/{id}
     * 
     * Get a specific transition.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        $transition = \App\Models\WorkflowTransition::with('workflow')->find($id);
        
        if (!$transition) {
            return response()->json([
                'message' => 'Transition not found',
            ], 404);
        }
        
        return response()->json([
            'data' => $transition->getFullData(),
        ]);
    }

    /**
     * POST /api/v5/workflow-definitions/{workflowId}/transitions
     * 
     * Create a new transition.
     *
     * @param Request $request
     * @param int $workflowId
     * @return JsonResponse
     */
    public function store(Request $request, int $workflowId): JsonResponse
    {
        $userId = $request->user()?->id;
        
        try {
            $transition = $this->service->createTransition($workflowId, $request->all(), $userId);
            
            $this->accessAudit->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $transition->id,
                action: 'INSERT',
                details: [
                    'from_status' => $transition->from_status_code,
                    'to_status' => $transition->to_status_code,
                ],
                actorId: $userId
            );
            
            return response()->json([
                'message' => 'Transition created successfully',
                'data' => $transition->getFullData(),
            ], 201);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * PUT /api/v5/workflow-transitions/{id}
     * 
     * Update an existing transition.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()?->id;
        
        try {
            $transition = $this->service->updateTransition($id, $request->all(), $userId);
            
            $this->accessAudit->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $transition->id,
                action: 'UPDATE',
                details: $request->all(),
                actorId: $userId
            );
            
            return response()->json([
                'message' => 'Transition updated successfully',
                'data' => $transition->getFullData(),
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * DELETE /api/v5/workflow-transitions/{id}
     * 
     * Delete a transition.
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function destroy(int $id, Request $request): JsonResponse
    {
        $userId = $request->user()?->id;
        
        try {
            $this->service->deleteTransition($id, $userId);
            
            $this->accessAudit->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $id,
                action: 'DELETE',
                actorId: $userId
            );
            
            return response()->json([
                'message' => 'Transition deleted successfully',
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /api/v5/workflow-definitions/{workflowId}/transitions/bulk
     * 
     * Bulk create transitions.
     *
     * @param Request $request
     * @param int $workflowId
     * @return JsonResponse
     */
    public function bulkStore(Request $request, int $workflowId): JsonResponse
    {
        $userId = $request->user()?->id;
        $transitionsData = $request->get('transitions', []);
        
        if (empty($transitionsData)) {
            return response()->json([
                'message' => 'No transitions data provided',
            ], 422);
        }
        
        try {
            $transitions = $this->service->bulkCreateTransitions($workflowId, $transitionsData, $userId);
            
            $this->accessAudit->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $workflowId,
                action: 'BULK_INSERT',
                details: ['count' => $transitions->count()],
                actorId: $userId
            );
            
            return response()->json([
                'message' => 'Transitions created successfully',
                'data' => $transitions->map(fn ($t) => $t->getFullData()),
                'meta' => [
                    'total' => $transitions->count(),
                ],
            ], 201);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /api/v5/workflow-definitions/{workflowId}/transitions/import
     * 
     * Import transitions from Excel data.
     *
     * @param Request $request
     * @param int $workflowId
     * @return JsonResponse
     */
    public function import(Request $request, int $workflowId): JsonResponse
    {
        $userId = $request->user()?->id;
        $transitionsData = $request->get('transitions', []);
        $skipDuplicates = $request->boolean('skip_duplicates', false);
        $updateExisting = $request->boolean('update_existing', false);
        
        if (empty($transitionsData)) {
            return response()->json([
                'message' => 'No transitions data provided',
            ], 422);
        }
        
        try {
            $stats = $this->service->bulkImportFromExcel(
                $workflowId,
                $transitionsData,
                $skipDuplicates,
                $updateExisting,
                $userId
            );
            
            $this->accessAudit->recordAuditEvent(
                entityType: 'workflow_transition',
                entityId: $workflowId,
                action: 'BULK_IMPORT',
                details: $stats,
                actorId: $userId
            );
            
            return response()->json([
                'message' => 'Import completed',
                'data' => $stats,
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * GET /api/v5/workflow-definitions/{workflowId}/transitions/statistics
     * 
     * Get transition statistics.
     *
     * @param int $workflowId
     * @return JsonResponse
     */
    public function statistics(int $workflowId): JsonResponse
    {
        $stats = $this->service->getTransitionStatistics($workflowId);
        
        return response()->json([
            'data' => $stats,
        ]);
    }
}
