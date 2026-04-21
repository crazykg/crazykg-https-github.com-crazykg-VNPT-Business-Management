<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseServerPaginationTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_index_uses_server_side_pagination_and_role_filters(): void
    {
        $first = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Yêu cầu số 1',
            ],
        ]))->assertCreated();
        $firstCaseId = (int) $first->json('data.request_case.id');

        $second = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Yêu cầu số 2',
            ],
        ]))->assertCreated();
        $secondCaseId = (int) $second->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $firstCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => '2026-03-21 09:00:00',
            ]);

        DB::table('customer_request_cases')
            ->where('id', $secondCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => null,
                'updated_at' => '2026-03-21 10:00:00',
            ]);

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&page=1&per_page=1&my_role=dispatcher')
            ->assertOk()
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $secondCaseId);

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&page=2&per_page=1&my_role=dispatcher')
            ->assertOk()
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstCaseId);

        $this->getJson('/api/v5/customer-request-cases?updated_by=3&my_role=performer')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $firstCaseId);
    }

    public function test_simple_pagination_total_remains_consistent_across_per_page_values(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            $response = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
                'master_payload' => [
                    'summary' => "Yêu cầu phân trang {$i}",
                ],
            ]))->assertCreated();

            DB::table('customer_request_cases')
                ->where('id', (int) $response->json('data.request_case.id'))
                ->update([
                    'dispatcher_user_id' => 2,
                    'performer_user_id' => 3,
                    'updated_at' => sprintf('2026-04-%02d 08:00:00', min($i, 28)),
                ]);
        }

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&my_role=dispatcher&page=1&per_page=20&simple=1')
            ->assertOk()
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.total', 12)
            ->assertJsonPath('meta.total_pages', 1)
            ->assertJsonCount(12, 'data');

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&my_role=dispatcher&page=1&per_page=10&simple=1')
            ->assertOk()
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 12)
            ->assertJsonPath('meta.total_pages', 2)
            ->assertJsonCount(10, 'data');

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&my_role=dispatcher&page=2&per_page=10&simple=1')
            ->assertOk()
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 12)
            ->assertJsonPath('meta.total_pages', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_index_can_sort_by_handler_name_and_prioritize_current_user_cases(): void
    {
        $alphaResponse = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Yêu cầu Alpha',
            ],
        ]))->assertCreated();
        $alphaCaseId = (int) $alphaResponse->json('data.request_case.id');

        $betaResponse = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Yêu cầu Beta',
            ],
        ]))->assertCreated();
        $betaCaseId = (int) $betaResponse->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $alphaCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 1,
                'nguoi_xu_ly_id' => 1,
                'updated_at' => '2026-04-21 09:00:00',
            ]);

        DB::table('customer_request_cases')
            ->where('id', $betaCaseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'nguoi_xu_ly_id' => 3,
                'updated_at' => '2026-04-21 10:00:00',
            ]);

        DB::table('internal_users')->where('id', 1)->update(['full_name' => 'An']);
        DB::table('internal_users')->where('id', 3)->update(['full_name' => 'Bình']);

        $this->getJson('/api/v5/customer-request-cases?updated_by=3&sort_by=to_user_id_name&sort_dir=asc')
            ->assertOk()
            ->assertJsonPath('data.0.id', $betaCaseId)
            ->assertJsonPath('data.1.id', $alphaCaseId);

        $this->getJson('/api/v5/customer-request-cases?updated_by=3&sort_by=to_user_id_name&sort_dir=asc&prioritize_my_cases=0')
            ->assertOk()
            ->assertJsonPath('data.0.id', $alphaCaseId)
            ->assertJsonPath('data.1.id', $betaCaseId);
    }

    public function test_index_filters_by_multiple_status_codes(): void
    {
        $newIntake = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => ['summary' => 'Case new intake'],
        ]))->assertCreated();
        $newIntakeId = (int) $newIntake->json('data.request_case.id');

        $inProgress = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => ['summary' => 'Case in progress'],
        ]))->assertCreated();
        $inProgressId = (int) $inProgress->json('data.request_case.id');

        $completed = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => ['summary' => 'Case completed'],
        ]))->assertCreated();
        $completedId = (int) $completed->json('data.request_case.id');

        DB::table('customer_request_cases')->where('id', $newIntakeId)->update([
            'current_status_code' => 'new_intake',
            'updated_at' => '2026-04-22 09:00:00',
        ]);

        DB::table('customer_request_cases')->where('id', $inProgressId)->update([
            'current_status_code' => 'in_progress',
            'updated_at' => '2026-04-22 09:01:00',
        ]);

        DB::table('customer_request_cases')->where('id', $completedId)->update([
            'current_status_code' => 'completed',
            'updated_at' => '2026-04-22 09:02:00',
        ]);

        $this->getJson('/api/v5/customer-request-cases?status_code[]=new_intake&status_code[]=completed')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['id' => $newIntakeId])
            ->assertJsonFragment(['id' => $completedId]);
    }
}
