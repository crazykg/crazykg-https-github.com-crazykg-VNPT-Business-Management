<?php

namespace Tests\Feature;

use Illuminate\Routing\Route as IlluminateRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiRateLimitingPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('vnpt_rate_limits.api.read_per_minute', 2);
        config()->set('vnpt_rate_limits.api.dashboard_per_minute', 4);
        config()->set('vnpt_rate_limits.api.export_per_minute', 1);
        config()->set('vnpt_rate_limits.api.write_per_minute', 2);
        config()->set('vnpt_rate_limits.api.write_heavy_per_minute', 1);

        $this->registerTestRoutes();
    }

    public function test_standard_read_routes_use_the_standard_read_bucket(): void
    {
        $headers = ['HTTP_USER_AGENT' => 'rate-limit-standard-read'];

        $this->getJson('/api/v5/testing/entities', $headers)->assertOk();
        $this->getJson('/api/v5/testing/entities', $headers)->assertOk();
        $this->getJson('/api/v5/testing/entities', $headers)
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS_READ');
    }

    public function test_dashboard_and_report_routes_use_the_higher_read_bucket(): void
    {
        $dashboardHeaders = ['HTTP_USER_AGENT' => 'rate-limit-dashboard'];
        $reportHeaders = ['HTTP_USER_AGENT' => 'rate-limit-report'];

        for ($attempt = 0; $attempt < 4; $attempt++) {
            $this->getJson('/api/v5/testing/dashboard', $dashboardHeaders)->assertOk();
        }

        $this->getJson('/api/v5/testing/dashboard', $dashboardHeaders)
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS_DASHBOARD');

        for ($attempt = 0; $attempt < 4; $attempt++) {
            $this->getJson('/api/v5/testing/report', $reportHeaders)->assertOk();
        }

        $this->getJson('/api/v5/testing/report', $reportHeaders)
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS_DASHBOARD');
    }

    public function test_export_routes_use_the_export_bucket(): void
    {
        $headers = ['HTTP_USER_AGENT' => 'rate-limit-export'];

        $this->getJson('/api/v5/testing/export', $headers)->assertOk();
        $this->getJson('/api/v5/testing/export', $headers)
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS_EXPORT');
    }

    public function test_heavy_write_routes_use_the_heavy_write_bucket(): void
    {
        $headers = ['HTTP_USER_AGENT' => 'rate-limit-heavy-write'];

        $this->postJson('/api/v5/testing/import', [], $headers)->assertOk();
        $this->postJson('/api/v5/testing/import', [], $headers)
            ->assertStatus(429)
            ->assertJsonPath('code', 'TOO_MANY_REQUESTS_HEAVY');
    }

    public function test_real_routes_are_mapped_to_the_expected_throttle_buckets(): void
    {
        $feeCollectionDashboard = $this->findRoute('api/v5/fee-collection/dashboard', 'GET');
        $customerRequestExport = $this->findRoute('api/v5/customer-requests/export', 'GET');
        $quotationExportWord = $this->findRoute('api/v5/products/quotation/export-word', 'POST');

        $this->assertContains('throttle:api.access', $feeCollectionDashboard->gatherMiddleware());
        $this->assertContains('throttle:api.access', $customerRequestExport->gatherMiddleware());
        $this->assertContains('throttle:api.read.export', $customerRequestExport->gatherMiddleware());
        $this->assertContains('throttle:api.access', $quotationExportWord->gatherMiddleware());
        $this->assertContains('throttle:api.write.heavy', $quotationExportWord->gatherMiddleware());
    }

    private function registerTestRoutes(): void
    {
        Route::middleware(['api', 'throttle:api.access'])->group(function (): void {
            Route::get('/api/v5/testing/entities', fn () => response()->json(['ok' => true]));
            Route::get('/api/v5/testing/dashboard', fn () => response()->json(['ok' => true]));
            Route::get('/api/v5/testing/report', fn () => response()->json(['ok' => true]));
        });

        Route::middleware(['api', 'throttle:api.access', 'throttle:api.read.export'])
            ->get('/api/v5/testing/export', fn () => response()->json(['ok' => true]));

        Route::middleware(['api', 'throttle:api.access', 'throttle:api.write.heavy'])
            ->post('/api/v5/testing/import', fn () => response()->json(['ok' => true]));
    }

    private function findRoute(string $uri, string $method): IlluminateRoute
    {
        $route = collect(app('router')->getRoutes()->getRoutes())
            ->first(fn (IlluminateRoute $candidate): bool => $candidate->uri() === $uri && in_array($method, $candidate->methods(), true));

        $this->assertNotNull($route, sprintf('Route [%s] %s was not registered.', $method, $uri));

        return $route;
    }
}
