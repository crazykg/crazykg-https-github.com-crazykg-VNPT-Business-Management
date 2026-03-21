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
}
