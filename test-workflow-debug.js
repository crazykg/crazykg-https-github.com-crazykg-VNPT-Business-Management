/**
 * Test script for Workflow Management feature
 * Run: node test-workflow-debug.js
 */

const API_BASE_URL = 'http://localhost:8002/api/v5';

async function testWorkflow() {
  process.stdout.write('🧪 Testing Workflow Management Feature\n\n');
  
  // Test 1: Get case 5 detail
  process.stdout.write('📡 Test 1: GET /customer-request-cases/5\n');
  try {
    const response = await fetch(`${API_BASE_URL}/customer-request-cases/5`);
    const data = await response.json();
    process.stdout.write(`✅ Response: ${JSON.stringify({
      workflow_definition_id: data.data?.workflow_definition_id,
      allowed_next_processes: data.data?.allowed_next_processes?.length || 0,
    })}\n`);
  } catch (error) {
    process.stdout.write(`❌ Error: ${error.message}\n`);
  }

  process.stdout.write('\n');

  // Test 2: Get case 5 status detail (new_intake)
  process.stdout.write('📡 Test 2: GET /customer-request-cases/5/statuses/new_intake\n');
  try {
    const response = await fetch(`${API_BASE_URL}/customer-request-cases/5/statuses/new_intake`);
    const data = await response.json();
    process.stdout.write(`✅ Response: ${JSON.stringify({
      workflow_definition_id: data.data?.workflow_definition_id,
      allowed_next_processes: data.data?.allowed_next_processes?.length || 0,
      allowed_next_processes_detail: data.data?.allowed_next_processes?.map(p => ({
        process_code: p.process_code,
        process_name: p.process_name,
        has_group_code: !!p.group_code,
        has_table_name: !!p.table_name,
      })),
    })}\n`);
  } catch (error) {
    process.stdout.write(`❌ Error: ${error.message}\n`);
  }

  process.stdout.write('\n');

  // Test 3: Check database transitions
  process.stdout.write('📡 Test 3: Check database transitions (via API)\n');
  try {
    const response = await fetch(`${API_BASE_URL}/customer-request-status-transitions`);
    const data = await response.json();
    const workflowTransitions = data.data?.filter(t => t.workflow_definition_id === 4) || [];
    const newIntakeTransitions = workflowTransitions.filter(t => t.from_status_code === 'new_intake');
    
    process.stdout.write(`✅ Response: ${JSON.stringify({
      total_workflow_transitions: workflowTransitions.length,
      new_intake_transitions: newIntakeTransitions.length,
      new_intake_targets: newIntakeTransitions.map(t => t.to_status_code),
    })}\n`);
  } catch (error) {
    process.stdout.write(`❌ Error: ${error.message}\n`);
  }

  process.stdout.write('\n🏁 Test completed!\n');
}

// Run test
testWorkflow().catch(console.error);
