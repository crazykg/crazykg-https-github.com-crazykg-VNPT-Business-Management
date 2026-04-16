<?php

namespace Tests\Feature;

use App\Models\WorkflowDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Feature\Concerns\InteractsWithWorkflowTestSchema;

/**
 * Class WorkflowDefinitionApiTest
 * 
 * Integration tests cho Workflow Definition API endpoints
 */
class WorkflowDefinitionApiTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithWorkflowTestSchema;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpWorkflowSchema();
        $this->withoutMiddleware();
    }

    /**
     * Test: GET /api/v5/workflow-definitions - List workflows
     */
    public function test_can_list_workflows(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_TEST',
            'name' => 'Luồng test',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v5/workflow-definitions');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'code', 'name', 'process_type', 'is_active'],
                ],
                'meta' => ['total'],
            ]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{id} - Get workflow detail
     */
    public function test_can_get_workflow_detail(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_DETAIL',
            'name' => 'Detail Test',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        $response = $this->getJson("/api/v5/workflow-definitions/{$workflow->id}");

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $workflow->id,
                    'code' => 'LUONG_DETAIL',
                    'name' => 'Detail Test',
                ],
            ]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/{id} - Not found
     */
    public function test_cannot_get_nonexistent_workflow(): void
    {
        $response = $this->getJson('/api/v5/workflow-definitions/99999');

        $response->assertStatus(404);
    }

    /**
     * Test: POST /api/v5/workflow-definitions - Create workflow
     */
    public function test_can_create_workflow(): void
    {
        $payload = [
            'code' => 'LUONG_NEW',
            'name' => 'Luồng mới',
            'description' => 'Workflow mới tạo',
            'process_type' => 'customer_request',
            'is_active' => true,
        ];

        $response = $this->postJson('/api/v5/workflow-definitions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Workflow created successfully',
                'data' => [
                    'code' => 'LUONG_NEW',
                    'name' => 'Luồng mới',
                ],
            ]);

        $this->assertDatabaseHas('workflow_definitions', [
            'code' => 'LUONG_NEW',
            'name' => 'Luồng mới',
        ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions - Validation error (duplicate code)
     */
    public function test_cannot_create_workflow_with_duplicate_code(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_DUP',
            'name' => 'Existing',
        ]);

        $payload = [
            'code' => 'LUONG_DUP',
            'name' => 'Duplicate',
        ];

        $response = $this->postJson('/api/v5/workflow-definitions', $payload);

        $response->assertStatus(422);
    }

    /**
     * Test: PUT /api/v5/workflow-definitions/{id} - Update workflow
     */
    public function test_can_update_workflow(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_UPDATE',
            'name' => 'Old Name',
        ]);

        $payload = [
            'name' => 'New Name',
            'description' => 'Updated description',
        ];

        $response = $this->putJson("/api/v5/workflow-definitions/{$workflow->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Workflow updated successfully',
                'data' => [
                    'name' => 'New Name',
                    'description' => 'Updated description',
                ],
            ]);

        $this->assertDatabaseHas('workflow_definitions', [
            'id' => $workflow->id,
            'name' => 'New Name',
        ]);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{id}/activate - Activate workflow
     */
    public function test_can_activate_workflow(): void
    {
        $workflow1 = WorkflowDefinition::create([
            'code' => 'LUONG_ACTIVE_1',
            'name' => 'Workflow 1',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        $workflow2 = WorkflowDefinition::create([
            'code' => 'LUONG_ACTIVE_2',
            'name' => 'Workflow 2',
            'process_type' => 'customer_request',
            'is_active' => false,
        ]);

        $response = $this->postJson("/api/v5/workflow-definitions/{$workflow2->id}/activate");

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Workflow activated successfully',
            ]);

        // Verify workflow2 is active and workflow1 is inactive
        $this->assertTrue($workflow2->fresh()->is_active);
        $this->assertFalse($workflow1->fresh()->is_active);
    }

    /**
     * Test: POST /api/v5/workflow-definitions/{id}/deactivate - Deactivate workflow
     */
    public function test_can_deactivate_workflow(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_DEACTIVATE',
            'name' => 'To Deactivate',
            'is_active' => true,
        ]);

        $response = $this->postJson("/api/v5/workflow-definitions/{$workflow->id}/deactivate");

        $response->assertStatus(200);

        $this->assertFalse($workflow->fresh()->is_active);
    }

    /**
     * Test: DELETE /api/v5/workflow-definitions/{id} - Delete workflow
     */
    public function test_can_delete_workflow(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_DELETE',
            'name' => 'To Delete',
        ]);

        $response = $this->deleteJson("/api/v5/workflow-definitions/{$workflow->id}");

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Workflow deleted successfully',
            ]);

        $this->assertSoftDeleted('workflow_definitions', ['id' => $workflow->id]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/statistics - Get statistics
     */
    public function test_can_get_workflow_statistics(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_STAT_1',
            'name' => 'Stat 1',
            'is_active' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_STAT_2',
            'name' => 'Stat 2',
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v5/workflow-definitions/statistics');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'total_workflows',
                    'active_workflows',
                    'inactive_workflows',
                    'total_transitions',
                ],
            ]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/active - Get active workflow
     */
    public function test_can_get_active_workflow(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_ACTIVE',
            'name' => 'Active Workflow',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v5/workflow-definitions/active');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'code' => 'LUONG_ACTIVE',
                ],
            ]);
    }

    /**
     * Test: GET /api/v5/workflow-definitions/code/{code} - Get workflow by code
     */
    public function test_can_get_workflow_by_code(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_CODE',
            'name' => 'Workflow By Code',
        ]);

        $response = $this->getJson('/api/v5/workflow-definitions/code/LUONG_CODE');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'code' => 'LUONG_CODE',
                    'name' => 'Workflow By Code',
                ],
            ]);
    }
}
