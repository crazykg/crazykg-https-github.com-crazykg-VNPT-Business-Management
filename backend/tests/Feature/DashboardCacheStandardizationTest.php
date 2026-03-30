<?php

namespace Tests\Feature;

use App\Services\V5\CacheService;
use App\Services\V5\Domain\LeadershipDashboardService;
use App\Services\V5\Revenue\RevenueOverviewService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class DashboardCacheStandardizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->dropTables();
    }

    protected function tearDown(): void
    {
        $this->dropTables();

        parent::tearDown();
    }

    public function test_revenue_overview_uses_cache_service_standardized_tags(): void
    {
        $this->setUpRevenueOverviewSchema();

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('rememberTagged')
            ->once()
            ->with(
                ['revenue-overview', 'invoices', 'revenue-targets'],
                Mockery::type('string'),
                120,
                Mockery::type(\Closure::class)
            )
            ->andReturn([
                'meta' => [
                    'fee_collection_available' => false,
                    'data_sources' => ['contracts'],
                ],
                'data' => [
                    'kpis' => [],
                    'by_period' => [],
                    'by_source' => [],
                    'alerts' => [],
                ],
            ]);
        $this->app->instance(CacheService::class, $cache);

        $response = app(RevenueOverviewService::class)->overview(Request::create('/api/v5/revenue/overview', 'GET', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
        ]));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertFalse((bool) data_get($response->getData(true), 'meta.fee_collection_available'));
    }

    public function test_leadership_dashboard_uses_customer_request_case_cache_tag(): void
    {
        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('rememberTagged')
            ->once()
            ->with(
                ['customer-request-cases'],
                Mockery::type('string'),
                120,
                Mockery::type(\Closure::class)
            )
            ->andReturnUsing(fn (array $tags, string $key, int $ttl, \Closure $callback) => $callback());
        $this->app->instance(CacheService::class, $cache);

        $response = app(LeadershipDashboardService::class)->dashboard(Request::create('/api/v5/leadership/dashboard', 'GET', [
            'month' => '2026-03',
        ]));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('2026-03', data_get($response->getData(true), 'data.period'));
    }

    private function setUpRevenueOverviewSchema(): void
    {
        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('payment_cycle', 30)->nullable();
            $table->string('status', 30)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->date('expected_date');
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('revenue_targets', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('period_type', 20);
            $table->string('target_type', 30)->default('TOTAL');
            $table->string('period_key', 10);
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('dept_id')->default(0);
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->timestamp('deleted_at')->nullable();
        });
    }

    private function dropTables(): void
    {
        Schema::dropIfExists('revenue_targets');
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contracts');
    }
}
