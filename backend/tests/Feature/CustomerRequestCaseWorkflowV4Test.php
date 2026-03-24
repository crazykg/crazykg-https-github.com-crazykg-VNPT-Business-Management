<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

/**
 * V4 workflow tests after XML alignment.
 *
 * `pending_dispatch` và `dispatched` chỉ còn là legacy data, không còn là
 * runtime status hợp lệ. Intake runtime chỉ dùng `new_intake`.
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

    public function test_create_case_always_stores_new_intake_regardless_of_dispatch_route(): void
    {
        foreach (['assign_pm', 'self_handle', 'assign_direct', null] as $route) {
            $caseId = $this->createCase([
                'master_payload' => ['dispatch_route' => $route],
            ]);

            $row = DB::table('customer_request_cases')->where('id', $caseId)->first();
            $this->assertSame('new_intake', $row->current_status_code);
            $this->assertSame($route, $row->dispatch_route);
            $this->assertSame(1, (int) $row->received_by_user_id);

            DB::table('customer_request_cases')->where('id', $caseId)->delete();
        }
    }

    public function test_new_intake_can_transition_directly_to_pm_review_outcomes(): void
    {
        foreach (['not_executed', 'analysis', 'waiting_customer_feedback'] as $statusCode) {
            $caseId = $this->createCase();

            $this->transition($caseId, $statusCode)->assertOk();
            $this->assertStatus($caseId, $statusCode);

            DB::table('customer_request_cases')->where('id', $caseId)->delete();
        }
    }

    public function test_performer_accept_flow_uses_new_intake_with_assigned_performer(): void
    {
        $caseId = $this->createCase();

        $this->saveStatus($caseId, 'new_intake', [
            'performer_user_id' => 3,
        ])->assertOk();

        $row = DB::table('customer_request_cases')->where('id', $caseId)->first();
        $this->assertSame(3, (int) $row->performer_user_id);
        $this->assertSame('new_intake', $row->current_status_code);

        $this->transition($caseId, 'in_progress')->assertOk();
        $this->assertStatus($caseId, 'in_progress');
    }

    public function test_performer_can_return_to_manager_from_new_intake(): void
    {
        $caseId = $this->createCase();

        $this->saveStatus($caseId, 'new_intake', [
            'performer_user_id' => 3,
        ])->assertOk();

        $this->transition($caseId, 'returned_to_manager')->assertOk();
        $this->assertStatus($caseId, 'returned_to_manager');
    }

    public function test_analysis_to_coding_flow(): void
    {
        $caseId = $this->createCase();
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
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'coding')->assertOk();

        $this->transition($caseId, 'completed')->assertOk();
        $this->assertStatus($caseId, 'completed');
    }

    public function test_dms_transfer_to_completed(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'dms_transfer')->assertOk();

        $this->transition($caseId, 'completed')->assertOk();
        $this->assertStatus($caseId, 'completed');
    }

    public function test_backward_transitions(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'coding')->assertOk();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->assertStatus($caseId, 'analysis');

        $caseId2 = $this->createCase();
        $this->transition($caseId2, 'analysis')->assertOk();
        $this->transition($caseId2, 'dms_transfer')->assertOk();
        $this->transition($caseId2, 'analysis')->assertOk();
        $this->assertStatus($caseId2, 'analysis');
    }

    public function test_sub_status_update_coding_phase(): void
    {
        $caseId = $this->createCase();
        $this->transition($caseId, 'analysis')->assertOk();
        $this->transition($caseId, 'coding')->assertOk();

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
        $caseId = $this->createCase();

        $this->patchJson("/api/v5/customer-request-cases/{$caseId}/sub-status", [
            'created_by' => 1,
            'updated_by' => 1,
            'coding_phase' => 'coding_done',
        ])->assertUnprocessable();
    }

    public function test_invalid_transition_from_new_intake_to_completed_returns_422(): void
    {
        $caseId = $this->createCase();

        $this->transition($caseId, 'completed')->assertUnprocessable();
    }

    public function test_v4_status_catalog_hides_legacy_intake_statuses(): void
    {
        $response = $this->getJson('/api/v5/customer-request-statuses')->assertOk();

        $statuses = collect($response->json('data.statuses') ?? [])
            ->pluck('status_code')
            ->all();

        foreach (['coding', 'dms_transfer'] as $code) {
            $this->assertContains($code, $statuses, "Status catalog missing: {$code}");
        }

        foreach (['pending_dispatch', 'dispatched'] as $code) {
            $this->assertNotContains($code, $statuses, "Legacy status should be hidden: {$code}");
        }
    }

    public function test_status_transitions_do_not_expose_legacy_intake_statuses(): void
    {
        $response = $this->getJson('/api/v5/customer-request-status-transitions')->assertOk();

        $pairs = collect($response->json('data') ?? [])
            ->map(static fn (array $row): string => ($row['from_status_code'] ?? '').'->'.($row['to_status_code'] ?? ''))
            ->all();

        $this->assertContains('new_intake->analysis', $pairs);
        $this->assertContains('new_intake->waiting_customer_feedback', $pairs);
        $this->assertContains('new_intake->not_executed', $pairs);
        $this->assertContains('new_intake->in_progress', $pairs);
        $this->assertContains('new_intake->returned_to_manager', $pairs);

        foreach ($pairs as $pair) {
            $this->assertStringNotContainsString('pending_dispatch', $pair);
            $this->assertStringNotContainsString('dispatched', $pair);
        }
    }

    public function test_dispatch_route_validation(): void
    {
        $payload = $this->createPayload(['master_payload' => ['dispatch_route' => 'invalid_route']]);
        $this->postJson('/api/v5/customer-request-cases', $payload)->assertUnprocessable();
    }
}
