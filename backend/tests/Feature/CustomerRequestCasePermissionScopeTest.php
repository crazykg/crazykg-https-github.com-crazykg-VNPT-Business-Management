<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCasePermissionScopeTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_show_and_index_follow_creator_dispatcher_performer_project_handler_admin_and_outsider_scope(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => null,
                'updated_at' => now(),
            ]);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=1")
            ->assertOk()
            ->assertJsonPath('data.id', $caseId);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=2")
            ->assertOk()
            ->assertJsonPath('data.dispatcher_user_id', 2);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=3")
            ->assertOk()
            ->assertJsonPath('data.id', $caseId);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=9")
            ->assertOk()
            ->assertJsonPath('data.id', $caseId);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=4")
            ->assertNotFound();

        $this->getJson('/api/v5/customer-request-cases?updated_by=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/v5/customer-request-cases?updated_by=2&my_role=dispatcher')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/v5/customer-request-cases?updated_by=3')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/v5/customer-request-cases?updated_by=9')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/v5/customer-request-cases?updated_by=4')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }
}
