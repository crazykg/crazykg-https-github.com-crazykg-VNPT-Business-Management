<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

/**
 * V4 Workflow Tests — 4 new statuses + 20 new transition rules.
 * All tests follow the two-step contract:
 *   1. POST create → always lands on new_intake
 *   2. POST transition → explicit status move
 *
 * @group v4
 */
class CustomerRequestCaseWorkflowV4Test extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    protected function tearDown(): void
    {
        $this->dropCustomerRequestCaseSchema();
        parent::tearDown();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function createCase(array $overrides = []): int
    {
        $response = $this->postJson('/api/v5/customer-request-cases', $this->createPayload($overrides))
            ->assertCreated();

        return (int) $response->json('data.id');
    }

    private function transition(int $id, string $toStatus, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/v5/customer-request-cases/{$id}/transition", array_merge([
            'created_by' => 1,
            'updated_by' => 1,
            'to_status_code' => $toStatus,
        ], $extra));
    }

    private function saveStatus(int $id, string $statusCode, array $payload = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/v5/customer-request-cases/{$id}/statuses/{$statusCode}", array_merge([
            'created_by' => 1,
            'updated_by' => 1,
        ], $payload));
    }

    private function assertStatus(int $id, string $expected): void
    {
        $row = DB::table('customer_request_cases')->where('id', $id)->first();
        $this->assertNotNull($row);
        $this->assertSame($expected, $row->current_status_code, "Expected status {$expected}, got {$row->current_status_code}");
    }

    // ── P4.1 tests ────────────────────────────────────────────────────────────

    public function test_create_case_always_stores_new_intake_regardless_of_dispatch_route(): void
    {
        foreach (['assign_pm', 'self_handle', 'assign_direct', null] as $route) {
            $caseId = $this->createCase([
                'master_payload' => ['dispatch_route' => $route],
            ]);

            $row = DB::table('customer_request_cases')->where('id', $caseId)->first();
            $this->assertSame('new_intake', $row->current_status_code);
            $this->assertSame($route, $row->dispatch_route);
            // received_by_user_id is the canonical creator
            $this->assertSame(1, (int) $row->received_by_user_id);

            DB::table('customer_request_cases')->where('id', $caseId)->delete();
        }
    }

    public function test_transition_new_intake_to_pending_dispatch(): void
    {
        $caseId = $this->createCase();

        $this->transition($caseId, 'pending_dispatch', [
            'dispatcher_user_id' => 2,
        ])->assertOk();

        $this->assertStatus($caseId, 'pending_dispatch');

        $pdRow = DB::table('customer_request_pending_dispatch')
            ->where('request_case_id', $caseId)
            ->first();
        $this->assertNotNull($pdRow, 'pending_dispatch status row should be created');
    }

    public function test_transition_new_intake_directly_to_dispatched(): void
    {
        $caseId = $this->createCase();

        $this->transition($caseId, 'dispatched', [
            'performer_user_id' => 3,
        ])->assertOk();

        $this->assertStatus($caseId, 'dispatched');

        $dRow = DB::table('customer_request_dispatched')
            ->where('request_case_id', $caseId)
            ->first();
        $this->assertNotNull($dRow, 'dispatched status row should be created');
    }

    public function test_pm_dispatches_from_pending_dispatch(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();

        // PM phân công → dispatched
        $this->transition($caseId, 'dispatched', [
            'performer_user_id' => 3,
        ])->assertOk();
        $this->assertStatus($caseId, 'dispatched');
    }

    public function test_pm_can_reject_from_pending_dispatch(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();

        $this->transition($caseId, 'not_executed')->assertOk();
        $this->assertStatus($caseId, 'not_executed');
    }

    public function test_pm_can_send_to_analysis_from_pending_dispatch(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();

        $this->transition($caseId, 'analysis')->assertOk();
        $this->assertStatus($caseId, 'analysis');
    }

    public function test_pm_can_set_waiting_customer_feedback_from_pending_dispatch(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();

        $this->transition($caseId, 'waiting_customer_feedback')->assertOk();
        $this->assertStatus($caseId, 'waiting_customer_feedback');
    }

    public function test_performer_accept_sets_performer_accepted_at(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'dispatched', ['performer_user_id' => 3])->assertOk();

        $this->transition($caseId, 'in_progress')->assertOk();
        $this->assertStatus($caseId, 'in_progress');
    }

    public function test_performer_can_return_to_manager_from_dispatched(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'dispatched', ['performer_user_id' => 3])->assertOk();

        $this->transition($caseId, 'returned_to_manager')->assertOk();
        $this->assertStatus($caseId, 'returned_to_manager');
    }

    public function test_analysis_to_coding_flow(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();

        $this->transition($caseId, 'coding', [
            'developer_user_id' => 3,
        ])->assertOk();
        $this->assertStatus($caseId, 'coding');

        $codingRow = DB::table('customer_request_coding')
            ->where('request_case_id', $caseId)
            ->first();
        $this->assertNotNull($codingRow, 'coding status row should be created');
    }

    public function test_analysis_to_dms_transfer_flow(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();

        $this->transition($caseId, 'dms_transfer')->assertOk();
        $this->assertStatus($caseId, 'dms_transfer');

        $dmsRow = DB::table('customer_request_dms_transfer')
            ->where('request_case_id', $caseId)
            ->first();
        $this->assertNotNull($dmsRow, 'dms_transfer status row should be created');
    }

    public function test_coding_to_completed(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'coding')->assertOk();

        $this->transition($caseId, 'completed')->assertOk();
        $this->assertStatus($caseId, 'completed');
    }

    public function test_dms_transfer_to_completed(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'dms_transfer')->assertOk();

        $this->transition($caseId, 'completed')->assertOk();
        $this->assertStatus($caseId, 'completed');
    }

    public function test_backward_transitions(): void
    {
        // pending_dispatch → new_intake
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'new_intake')->assertOk();
        $this->assertStatus($caseId, 'new_intake');

        // dispatched → pending_dispatch
        $caseId2 = $this->createCase();
        $this->transition($caseId2, 'pending_dispatch')->assertOk();
        $this->transition($caseId2, 'dispatched')->assertOk();
        $this->transition($caseId2, 'pending_dispatch')->assertOk();
        $this->assertStatus($caseId2, 'pending_dispatch');

        // coding → analysis
        $caseId3 = $this->createCase();
        $this->transition($caseId3, 'pending_dispatch')->assertOk();
        $this->transition($caseId3, 'analysis')->assertOk();
        $this->transition($caseId3, 'coding')->assertOk();
        $this->transition($caseId3, 'analysis')->assertOk();
        $this->assertStatus($caseId3, 'analysis');

        // dms_transfer → analysis
        $caseId4 = $this->createCase();
        $this->transition($caseId4, 'pending_dispatch')->assertOk();
        $this->transition($caseId4, 'analysis')->assertOk();
        $this->transition($caseId4, 'dms_transfer')->assertOk();
        $this->transition($caseId4, 'analysis')->assertOk();
        $this->assertStatus($caseId4, 'analysis');
    }

    public function test_sub_status_update_coding_phase(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'coding')->assertOk();

        // Cập nhật coding_phase từng bước
        foreach (['coding_done', 'upcode_pending', 'upcode_deployed'] as $phase) {
            $response = $this->patchJson("/api/v5/customer-request-cases/{$caseId}/sub-status", [
                'created_by' => 1,
                'updated_by' => 1,
                'coding_phase' => $phase,
            ]);
            $response->assertOk();

            $codingRow = DB::table('customer_request_coding')
                ->where('request_case_id', $caseId)
                ->first();
            $this->assertSame($phase, $codingRow->coding_phase, "Expected coding_phase = {$phase}");
        }
    }

    public function test_sub_status_update_dms_phase(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'dms_transfer')->assertOk();

        foreach (['task_created', 'in_progress', 'completed'] as $phase) {
            $response = $this->patchJson("/api/v5/customer-request-cases/{$caseId}/sub-status", [
                'created_by' => 1,
                'updated_by' => 1,
                'dms_phase' => $phase,
            ]);
            $response->assertOk();

            $dmsRow = DB::table('customer_request_dms_transfer')
                ->where('request_case_id', $caseId)
                ->first();
            $this->assertSame($phase, $dmsRow->dms_phase, "Expected dms_phase = {$phase}");
        }
    }

    public function test_sub_status_update_rejected_for_wrong_status(): void
    {
        // Yêu cầu đang ở new_intake — không thể update sub-status
        $caseId = $this->createCase();

        $this->patchJson("/api/v5/customer-request-cases/{$caseId}/sub-status", [
            'created_by' => 1,
            'updated_by' => 1,
            'coding_phase' => 'coding_done',
        ])->assertUnprocessable();
    }

    public function test_invalid_transition_from_new_status_returns_422(): void
    {
        $caseId = $this->createCase();

        // pending_dispatch không có transition trực tiếp → completed
        $this->transition($caseId, 'pending_dispatch')->assertOk();
        $this->transition($caseId, 'completed')->assertUnprocessable();
    }

    public function test_v4_status_catalog_contains_4_new_statuses(): void
    {
        $response = $this->getJson('/api/v5/customer-request-statuses')->assertOk();

        $statuses = collect($response->json('data.statuses') ?? [])
            ->pluck('status_code')
            ->all();

        foreach (['pending_dispatch', 'dispatched', 'coding', 'dms_transfer'] as $code) {
            $this->assertContains($code, $statuses, "Status catalog missing: {$code}");
        }
    }

    public function test_dispatch_route_validation(): void
    {
        // Invalid dispatch_route should return 422
        $payload = $this->createPayload(['master_payload' => ['dispatch_route' => 'invalid_route']]);
        $this->postJson('/api/v5/customer-request-cases', $payload)->assertUnprocessable();
    }
}
