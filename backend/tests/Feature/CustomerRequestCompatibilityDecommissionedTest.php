<?php

namespace Tests\Feature;

use Tests\TestCase;

class CustomerRequestCompatibilityDecommissionedTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
    }

    public function test_decommissioned_customer_request_json_endpoints_return_410(): void
    {
        $expect410 = static fn ($response) => $response
            ->assertStatus(410)
            ->assertJsonPath('message', 'This feature has been decommissioned.')
            ->assertJsonPath('data', []);

        $expect410($this->getJson('/api/v5/customer-requests'));
        $expect410($this->getJson('/api/v5/customer-requests/dashboard-summary'));
        $expect410($this->postJson('/api/v5/customer-requests', []));
        $expect410($this->putJson('/api/v5/customer-requests/123', []));
        $expect410($this->deleteJson('/api/v5/customer-requests/123'));
        $expect410($this->getJson('/api/v5/customer-requests/123/history'));
        $expect410($this->getJson('/api/v5/customer-request-history'));
        $expect410($this->postJson('/api/v5/customer-requests/import', []));
    }

    public function test_decommissioned_customer_request_exports_return_compatibility_download(): void
    {
        $this->get('/api/v5/customer-requests/export')
            ->assertOk()
            ->assertHeader('X-Gone', '410')
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition', 'attachment; filename=decommissioned.csv');

        $this->get('/api/v5/customer-requests/dashboard-summary/export')
            ->assertOk()
            ->assertHeader('X-Gone', '410')
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition', 'attachment; filename=decommissioned.csv');
    }
}
