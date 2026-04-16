<?php

namespace Tests\Feature;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Feature\Concerns\InteractsWithWorkflowTestSchema;

/**
 * Class WorkflowTransitionApiTest
 * 
 * Integration tests cho Workflow Transition API endpoints
 */
class WorkflowTransitionApiTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithWorkflowTestSchema;
    protected WorkflowDefinition $workflow;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpWorkflowSchema();
        $this->withoutMiddleware();

        // Create workflow for testing
        $this->workflow = WorkflowDefinition::create([
            'code' => 'LUONG_TEST',
            'name' => 'Test Workflow',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{workflowId}/transitions - List transitions
     */
    public function test_can_list_transitions(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        $response = $this->getJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'from_status_code', 'to_status_code', 'allowed_roles'],
                ],
                'meta' => ['total', 'workflow_definition_id'],
            ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{workflowId}/transitions - Create transition
     */
    public function test_can_create_transition(): void
    {
        $payload = [
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
            'sort_order' => 1,
        ];

        $response = $this->postJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions", $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Transition created successfully',
                'data' => [
                    'from_status_code' => 'new_intake',
                    'to_status_code' => 'assigned_to_receiver',
                ],
            ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{workflowId}/transitions - Duplicate transition
     */
    public function test_cannot_create_duplicate_transition(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $payload = [
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ];

        $response = $this->postJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions", $payload);

        $response->assertStatus(422);
    }

    /**
     * Test: PUT /api/v5/workflow-transitions/{id} - Update transition
     */
    public function test_can_update_transition(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        $payload = [
            'allowed_roles' => ['A'],
            'sort_order' => 2,
        ];

        $response = $this->putJson("/api/v5/workflow-transitions/{$transition->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Transition updated successfully',
                'data' => [
                    'allowed_roles' => ['A'],
                    'sort_order' => 2,
                ],
            ]);
    }

    /**
     * Test: DELETE /api/v5/workflow-transitions/{id} - Delete transition
     */
    public function test_can_delete_transition(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $response = $this->deleteJson("/api/v5/workflow-transitions/{$transition->id}");

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Transition deleted successfully',
            ]);

        $this->assertDatabaseMissing('customer_request_status_transitions', ['id' => $transition->id]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{workflowId}/transitions/from/{status} - Get transitions from status
     */
    public function test_can_get_transitions_from_status(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
        ]);

        // Different from_status (should not be included)
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'completed',
            'allowed_roles' => ['A'],
        ]);

        $response = $this->getJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions/from/new_intake");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['from_status_code', 'to_status_code'],
                ],
                'meta' => ['from_status_code', 'total'],
            ]);

        $data = $response->json('data');
        $this->assertEquals(2, count($data));
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{workflowId}/transitions/check - Check transition
     */
    public function test_can_check_transition(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['A'],
        ]);

        $response = $this->getJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions/check?from_status_code=new_intake&to_status_code=pending_dispatch");

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'is_allowed' => true,
                    'allowed_roles' => ['A'],
                ],
            ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{workflowId}/transitions/bulk - Bulk create
     */
    public function test_can_bulk_create_transitions(): void
    {
        $payload = [
            'transitions' => [
                [
                    'from_status_code' => 'new_intake',
                    'to_status_code' => 'pending_dispatch',
                    'allowed_roles' => ['all'],
                    'sort_order' => 1,
                ],
                [
                    'from_status_code' => 'pending_dispatch',
                    'to_status_code' => 'completed',
                    'allowed_roles' => ['A'],
                    'sort_order' => 2,
                ],
            ],
        ];

        $response = $this->postJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions/bulk", $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Transitions created successfully',
                'meta' => ['total' => 2],
            ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{workflowId}/transitions/import - Import with duplicates
     */
    public function test_can_import_transitions_with_skip_duplicates(): void
    {
        // Create existing transition
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $payload = [
            'transitions' => [
                [
                    'from_status_code' => 'new_intake',
                    'to_status_code' => 'pending_dispatch',
                    'allowed_roles' => ['all'],
                    'sort_order' => 1,
                ],
                [
                    'from_status_code' => 'pending_dispatch',
                    'to_status_code' => 'completed',
                    'allowed_roles' => ['A'],
                    'sort_order' => 2,
                ],
            ],
            'skip_duplicates' => true,
        ];

        $response = $this->postJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions/import", $payload);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'data' => ['success', 'skipped', 'updated', 'errors'],
            ]);

        $data = $response->json('data');
        $this->assertEquals(1, $data['success']);
        $this->assertEquals(1, $data['skipped']);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{workflowId}/transitions/statistics - Get statistics
     */
    public function test_can_get_transition_statistics(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'completed',
            'allowed_roles' => ['A'],
        ]);

        $response = $this->getJson("/api/v5/workflow-definitions/{$this->workflow->id}/transitions/statistics");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'total_transitions',
                    'active_transitions',
                    'allowed_roles_all',
                    'allowed_roles_R',
                    'allowed_roles_A',
                ],
            ]);
    }
}
