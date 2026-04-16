<?php

namespace Tests\Feature;

use App\Models\WorkflowDefinition;
use App\Models\WorkflowTransition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Feature\Concerns\InteractsWithWorkflowTestSchema;

/**
 * Class WorkflowTransitionTest
 * 
 * Feature tests cho WorkflowTransition model
 */
class WorkflowTransitionTest extends TestCase
{
    use RefreshDatabase;
    use InteractsWithWorkflowTestSchema;

    protected WorkflowDefinition $workflow;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpWorkflowSchema();
        
        $this->workflow = WorkflowDefinition::create([
            'code' => 'LUONG_TEST',
            'name' => 'Test Workflow',
            'process_type' => 'customer_request',
            'is_active' => true,
        ]);
    }

    /**
     * Test: Tạo transition thành công
     */
    public function test_can_create_transition(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'sort_order' => 1,
        ]);

        $this->assertDatabaseHas('customer_request_status_transitions', [
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
        ]);

        $this->assertEquals(['all'], $transition->allowed_roles);
        $this->assertEquals(1, $transition->sort_order);
    }

    /**
     * Test: Relationship với workflow
     */
    public function test_belongs_to_workflow(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $this->assertInstanceOf(WorkflowDefinition::class, $transition->workflow);
        $this->assertEquals($this->workflow->id, $transition->workflow->id);
        $this->assertEquals('LUONG_TEST', $transition->workflow->code);
    }

    /**
     * Test: Scope active()
     */
    public function test_scope_active(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'is_active' => true,
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
            'is_active' => false,
        ]);

        $activeTransitions = WorkflowTransition::active()->get();

        $this->assertEquals(1, $activeTransitions->count());
        $this->assertEquals('pending_dispatch', $activeTransitions->first()->to_status_code);
    }

    /**
     * Test: Scope forWorkflow()
     */
    public function test_scope_for_workflow(): void
    {
        $workflow2 = WorkflowDefinition::create([
            'code' => 'LUONG_TEST_2',
            'name' => 'Test Workflow 2',
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $workflow2->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
        ]);

        $transitions = WorkflowTransition::forWorkflow($this->workflow->id)->get();

        $this->assertEquals(1, $transitions->count());
        $this->assertEquals('pending_dispatch', $transitions->first()->to_status_code);
    }

    /**
     * Test: Scope fromStatus()
     */
    public function test_scope_from_status(): void
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

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'completed',
            'allowed_roles' => ['A'],
        ]);

        $transitions = WorkflowTransition::fromStatus('new_intake')->get();

        $this->assertEquals(2, $transitions->count());
    }

    /**
     * Test: Scope toStatus()
     */
    public function test_scope_to_status(): void
    {
        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'assigned_to_receiver',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['R'],
        ]);

        WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
        ]);

        $transitions = WorkflowTransition::toStatus('pending_dispatch')->get();

        $this->assertEquals(2, $transitions->count());
    }

    /**
     * Test: Method canExecute() với role 'all'
     */
    public function test_can_execute_with_all_role(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $this->assertTrue($transition->canExecute('R'));
        $this->assertTrue($transition->canExecute('A'));
        $this->assertTrue($transition->canExecute('C'));
        $this->assertTrue($transition->canExecute('I'));
    }

    /**
     * Test: Method canExecute() với role cụ thể
     */
    public function test_can_execute_with_specific_role(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'assigned_to_receiver',
            'allowed_roles' => ['R'],
        ]);

        $this->assertTrue($transition->canExecute('R'));
        $this->assertFalse($transition->canExecute('A'));
        $this->assertFalse($transition->canExecute('C'));
    }

    /**
     * Test: Method canExecute() với multiple roles
     */
    public function test_can_execute_with_multiple_roles(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'pending_dispatch',
            'to_status_code' => 'analysis',
            'allowed_roles' => ['A', 'R'],
        ]);

        $this->assertTrue($transition->canExecute('A'));
        $this->assertTrue($transition->canExecute('R'));
        $this->assertFalse($transition->canExecute('C'));
    }

    /**
     * Test: Method isAutoTransition()
     */
    public function test_is_auto_transition(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'transition_config' => ['auto' => true],
        ]);

        $this->assertTrue($transition->isAutoTransition());
    }

    /**
     * Test: Method isAutoTransition() với auto = false
     */
    public function test_is_not_auto_transition(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'transition_config' => ['auto' => false],
        ]);

        $this->assertFalse($transition->isAutoTransition());
    }

    /**
     * Test: Method getRequiredFields()
     */
    public function test_get_required_fields(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'required_fields' => ['notes', 'performer'],
        ]);

        $this->assertEquals(['notes', 'performer'], $transition->getRequiredFields());
    }

    /**
     * Test: Method getRequiredFields() với empty
     */
    public function test_get_required_fields_empty(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $this->assertEquals([], $transition->getRequiredFields());
    }

    /**
     * Test: Method getConfigValue()
     */
    public function test_get_config_value(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'transition_config' => [
                'notification_enabled' => true,
                'sla_hours' => 24,
            ],
        ]);

        $this->assertTrue($transition->getConfigValue('notification_enabled'));
        $this->assertEquals(24, $transition->getConfigValue('sla_hours'));
        $this->assertEquals('default', $transition->getConfigValue('unknown', 'default'));
    }

    /**
     * Test: Method hasConfig()
     */
    public function test_has_config(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'transition_config' => ['notification_enabled' => true],
        ]);

        $this->assertTrue($transition->hasConfig('notification_enabled'));
        $this->assertFalse($transition->hasConfig('unknown_key'));
    }

    /**
     * Test: Attribute getFromStatusNameAttribute()
     */
    public function test_from_status_name_attribute(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $this->assertEquals('Tiếp nhận', $transition->from_status_name);
    }

    /**
     * Test: Attribute getToStatusNameAttribute()
     */
    public function test_to_status_name_attribute(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $this->assertEquals('Giao PM/Trả YC cho PM', $transition->to_status_name);
    }

    /**
     * Test: Method getFullData()
     */
    public function test_get_full_data(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
            'required_fields' => ['notes'],
            'sort_order' => 1,
        ]);

        $fullData = $transition->getFullData();

        $this->assertEquals('new_intake', $fullData['from_status_code']);
        $this->assertEquals('Tiếp nhận', $fullData['from_status_name']);
        $this->assertEquals('pending_dispatch', $fullData['to_status_code']);
        $this->assertEquals('Giao PM/Trả YC cho PM', $fullData['to_status_name']);
        $this->assertEquals(['all'], $fullData['allowed_roles']);
        $this->assertEquals(['notes'], $fullData['required_fields']);
        $this->assertEquals(1, $fullData['sort_order']);
        $this->assertEquals('LUONG_TEST', $fullData['workflow']['code']);
    }

    /**
     * Test: Soft deletes
     */
    public function test_deletes_transition_record(): void
    {
        $transition = WorkflowTransition::create([
            'workflow_definition_id' => $this->workflow->id,
            'from_status_code' => 'new_intake',
            'to_status_code' => 'pending_dispatch',
            'allowed_roles' => ['all'],
        ]);

        $transitionId = $transition->id;

        $transition->delete();

        $this->assertDatabaseMissing('customer_request_status_transitions', ['id' => $transitionId]);
        $this->assertNull(WorkflowTransition::find($transitionId));
    }
}
