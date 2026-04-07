<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseSearchApiTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_search_respects_scope_and_matches_project_customer_and_request_code(): void
    {
        $expectedRequestCode = sprintf('CRC-%s-0001', now()->format('Ym'));

        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'summary' => 'Tra cứu dự án SOC',
            ],
        ]))->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => now(),
            ]);

        $this->getJson('/api/v5/customer-request-cases/search?q='.$expectedRequestCode.'&updated_by=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.request_code', $expectedRequestCode);

        $this->getJson('/api/v5/customer-request-cases/search?q=Dự án SOC&updated_by=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.project_name', 'Dự án SOC');

        $this->getJson('/api/v5/customer-request-cases/search?q=Giang&updated_by=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang');

        $this->getJson('/api/v5/customer-request-cases/search?q='.$expectedRequestCode.'&updated_by=4')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
