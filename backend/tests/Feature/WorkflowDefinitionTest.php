<?php

namespace Tests\Feature;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use App\Models\InternalUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Class WorkflowDefinitionTest
 * 
 * Feature tests cho WorkflowDefinition model
 */
class WorkflowDefinitionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test user
        InternalUser::factory()->create([
            'id' => 1,
            'username' => 'test.admin',
            'full_name' => 'Test Admin',
        ]);
    }

    /**
     * Test: Tạo workflow definition thành công
     */
    public function test_can_create_workflow_definition(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_TEST',
            'name' => 'Luồng xử lý test',
            'description' => 'Workflow dùng cho testing',
            'process_type' => 'customer_request',
            'is_active' => true,
            'is_default' => false,
            'version' => '1.0',
            'created_by' => 1,
        ]);

        $this->assertDatabaseHas('workflow_definitions', [
            'code' => 'LUONG_TEST',
            'name' => 'Luồng xử lý test',
            'process_type' => 'customer_request',
        ]);

        $this->assertEquals('LUONG_TEST', $workflow->code);
        $this->assertTrue($workflow->is_active);
        $this->assertFalse($workflow->is_default);
    }

    /**
     * Test: Workflow code phải unique
     */
    public function test_workflow_code_must_be_unique(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_UNIQUE',
            'name' => 'Luồng 1',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        WorkflowDefinition::create([
            'code' => 'LUONG_UNIQUE',
            'name' => 'Luồng 2',
        ]);
    }

    /**
     * Test: Relationship với transitions
     */
    public function test_has_many_transitions(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_REL',
            'name' => 'Luồng relationship test',
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'completed',
            'allowed_roles' => ['A'],
            'sort_order' => 2,
        ]);

        $this->assertEquals(2, $workflow->transitions()->count());
        $this->assertInstanceOf(WorkflowTransition::class, $workflow->transitions()->first());
    }

    /**
     * Test: Scope active()
     */
    public function test_scope_active(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_ACTIVE',
            'name' => 'Active workflow',
            'is_active' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_INACTIVE',
            'name' => 'Inactive workflow',
            'is_active' => false,
        ]);

        $activeWorkflows = WorkflowDefinition::active()->get();

        $this->assertEquals(1, $activeWorkflows->count());
        $this->assertEquals('LUONG_ACTIVE', $activeWorkflows->first()->code);
    }

    /**
     * Test: Scope active() với process_type
     */
    public function test_scope_active_with_process_type(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_CR',
            'name' => 'Customer Request',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_PROC',
            'name' => 'Project Procedure',
            'process_type' => 'project_procedure',
            'is_active' => true,
        ]);

        $crWorkflows = WorkflowDefinition::active('customer_request')->get();

        $this->assertEquals(1, $crWorkflows->count());
        $this->assertEquals('LUONG_CR', $crWorkflows->first()->code);
    }

    /**
     * Test: Scope default()
     */
    public function test_scope_default(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_DEFAULT',
            'name' => 'Default workflow',
            'is_default' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_NORMAL',
            'name' => 'Normal workflow',
            'is_default' => false,
        ]);

        $defaultWorkflows = WorkflowDefinition::default()->get();

        $this->assertEquals(1, $defaultWorkflows->count());
        $this->assertEquals('LUONG_DEFAULT', $defaultWorkflows->first()->code);
    }

    /**
     * Test: Method activate() - chỉ 1 workflow active tại một thời điểm
     */
    public function test_activate_workflow_deactivates_others(): void
    {
        $workflow1 = WorkflowDefinition::create([
            'code' => 'LUONG_1',
            'name' => 'Workflow 1',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        $workflow2 = WorkflowDefinition::create([
            'code' => 'LUONG_2',
            'name' => 'Workflow 2',
            'process_type' => 'customer_request',
            'is_active' => false,
        ]);

        // Activate workflow 2
        $workflow2->activate();

        // Reload from database
        $workflow1->refresh();
        $workflow2->refresh();

        $this->assertFalse($workflow1->is_active);
        $this->assertTrue($workflow2->is_active);
        $this->assertNotNull($workflow2->activated_at);
    }

    /**
     * Test: Method deactivate()
     */
    public function test_deactivate_workflow(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_DEACTIVATE',
            'name' => 'To deactivate',
            'is_active' => true,
            'activated_at' => now(),
        ]);

        $workflow->deactivate();

        $this->assertFalse($workflow->is_active);
        $this->assertNull($workflow->activated_at);
    }

    /**
     * Test: Method getTransitionsFrom()
     */
    public function test_get_transitions_from_status(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_TRANS',
            'name' => 'Transition test',
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
            'sort_order' => 2,
        ]);

        // Different from_status (should not be included)
        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'completed',
            'allowed_roles' => ['A'],
            'sort_order' => 3,
        ]);

        $transitions = $workflow->getTransitionsFrom('new_intake');

        $this->assertEquals(2, $transitions->count());
        $this->assertEquals(['pending_dispatch', 'assigned_to_receiver'], $transitions->pluck('to_status_code')->toArray());
    }

    /**
     * Test: Method isTransitionAllowed()
     */
    public function test_is_transition_allowed(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_CHECK',
            'name' => 'Check transition',
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'is_active' => true,
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
            'is_active' => false, // Inactive
        ]);

        // Active transition should be allowed
        $this->assertTrue($workflow->isTransitionAllowed('new_intake', 'pending_dispatch'));

        // Inactive transition should not be allowed
        $this->assertFalse($workflow->isTransitionAllowed('new_intake', 'assigned_to_receiver'));

        // Non-existent transition
        $this->assertFalse($workflow->isTransitionAllowed('new_intake', 'completed'));
    }

    /**
     * Test: Method getAllowedRoles()
     */
    public function test_get_allowed_roles(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_ROLES',
            'name' => 'Roles test',
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['A'],
            'is_active' => true,
        ]);

        $roles = $workflow->getAllowedRoles('new_intake', 'pending_dispatch');

        $this->assertEquals(['A'], $roles);
    }

    /**
     * Test: Static method getActiveForProcessType()
     */
    public function test_get_active_for_process_type(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_ACTIVE_CR',
            'name' => 'Active CR',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_INACTIVE_CR',
            'name' => 'Inactive CR',
            'process_type' => 'customer_request',
            'is_active' => false,
        ]);

        $activeWorkflow = WorkflowDefinition::getActiveForProcessType('customer_request');

        $this->assertNotNull($activeWorkflow);
        $this->assertEquals('LUONG_ACTIVE_CR', $activeWorkflow->code);
    }

    /**
     * Test: Static method getDefaultForProcessType()
     */
    public function test_get_default_for_process_type(): void
    {
        WorkflowDefinition::create([
            'code' => 'LUONG_DEFAULT_CR',
            'name' => 'Default CR',
            'process_type' => 'customer_request',
            'is_default' => true,
        ]);

        WorkflowDefinition::create([
            'code' => 'LUONG_NORMAL_CR',
            'name' => 'Normal CR',
            'process_type' => 'customer_request',
            'is_default' => false,
        ]);

        $defaultWorkflow = WorkflowDefinition::getDefaultForProcessType('customer_request');

        $this->assertNotNull($defaultWorkflow);
        $this->assertEquals('LUONG_DEFAULT_CR', $defaultWorkflow->code);
    }

    /**
     * Test: Method getFullData()
     */
    public function test_get_full_data(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_FULL',
            'name' => 'Full data test',
            'process_type' => 'customer_request',
            'is_active' => true,
            'version' => '2.0',
            'config' => ['notification_enabled' => true],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        $fullData = $workflow->getFullData();

        $this->assertEquals('LUONG_FULL', $fullData['code']);
        $this->assertEquals('2.0', $fullData['version']);
        $this->assertTrue($fullData['is_active']);
        $this->assertEquals(['notification_enabled' => true], $fullData['config']);
        $this->assertCount(1, $fullData['transitions']);
        $this->assertEquals('new_intake', $fullData['transitions'][0]['from_status_code']);
    }

    /**
     * Test: Soft deletes
     */
    public function test_soft_deletes(): void
    {
        $workflow = WorkflowDefinition::create([
            'code' => 'LUONG_DELETE',
            'name' => 'To delete',
        ]);

        $workflowId = $workflow->id;

        $workflow->delete();

        // Should be soft deleted
        $this->assertSoftDeleted('workflow_definitions', ['id' => $workflowId]);
        $this->assertNull(WorkflowDefinition::find($workflowId));
        
        // Can still find with trashed
        $this->assertNotNull(WorkflowDefinition::withTrashed()->find($workflowId));
    }
}
