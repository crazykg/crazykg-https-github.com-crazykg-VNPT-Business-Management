<?php

namespace Tests\Feature;

use App\Services\V5\CacheService;
use App\Services\V5\Revenue\RevenueByContractService;
use App\Services\V5\Revenue\RevenueOverviewService;
use App\Services\V5\Revenue\RevenueReportService;
use App\Services\V5\Support\ReadReplicaConnectionResolver;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class ReadReplicaRevenueServicesTest extends TestCase
{
    private string $primaryDatabasePath;

    private string $replicaDatabasePath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        Carbon::setTestNow(Carbon::parse('2026-03-31 10:00:00'));

        $this->primaryDatabasePath = tempnam(sys_get_temp_dir(), 'qlcv-primary-');
        $this->replicaDatabasePath = tempnam(sys_get_temp_dir(), 'qlcv-replica-');

        $this->configureConnections();
        $this->bindPassthroughCache();
    }

    protected function tearDown(): void
    {
        $this->dropRevenueTables('sqlite');
        $this->dropRevenueTables('analytics_replica');

        DB::disconnect('sqlite');
        DB::disconnect('analytics_replica');
        DB::purge('sqlite');
        DB::purge('analytics_replica');

        Carbon::setTestNow();

        @unlink($this->primaryDatabasePath);
        @unlink($this->replicaDatabasePath);

        Mockery::close();

        parent::tearDown();
    }

    public function test_revenue_by_contract_reads_from_replica_when_enabled(): void
    {
        $this->setUpRevenueSchema('sqlite');
        $this->setUpRevenueSchema('analytics_replica');

        $this->seedRevenueFixture('sqlite', 1000, 250, 2000);
        $this->seedRevenueFixture('analytics_replica', 3000, 1500, 5000);

        $response = app(RevenueByContractService::class)->index(Request::create('/api/v5/revenue/by-contract', 'GET', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
        ]));

        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertEquals(3000.0, data_get($payload, 'meta.kpis.total_expected'));
        $this->assertEquals(1500.0, data_get($payload, 'meta.kpis.total_collected'));
        $this->assertSame('HD-REPLICA', data_get($payload, 'data.0.contract_code'));
    }

    public function test_revenue_report_reads_from_replica_when_enabled(): void
    {
        $this->setUpRevenueSchema('sqlite');
        $this->setUpRevenueSchema('analytics_replica');

        $this->seedRevenueFixture('sqlite', 1000, 250, 2000);
        $this->seedRevenueFixture('analytics_replica', 3000, 1500, 5000);

        $response = app(RevenueReportService::class)->report(Request::create('/api/v5/revenue/report', 'GET', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
            'dimension' => 'customer',
        ]));

        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('customer', data_get($payload, 'data.dimension'));
        $this->assertEquals(3000.0, data_get($payload, 'data.rows.0.expected'));
        $this->assertEquals(1500.0, data_get($payload, 'data.rows.0.collected'));
        $this->assertSame('Khach hang Replica', data_get($payload, 'data.rows.0.customer_name'));
    }

    public function test_revenue_overview_reads_from_replica_when_enabled(): void
    {
        $this->setUpRevenueSchema('sqlite');
        $this->setUpRevenueSchema('analytics_replica');

        $this->seedRevenueFixture('sqlite', 1000, 250, 2000);
        $this->seedRevenueFixture('analytics_replica', 3000, 1500, 5000);

        $response = app(RevenueOverviewService::class)->overview(Request::create('/api/v5/revenue/overview', 'GET', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
        ]));

        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(['contracts'], data_get($payload, 'meta.data_sources'));
        $this->assertEquals(5000.0, data_get($payload, 'data.kpis.target_amount'));
        $this->assertEquals(1500.0, data_get($payload, 'data.kpis.actual_collected'));
        $this->assertEquals(3000.0, data_get($payload, 'data.by_period.0.total_expected'));
        $this->assertEquals(1500.0, data_get($payload, 'data.by_source.3.amount'));
    }

    public function test_revenue_services_fall_back_to_primary_when_replica_connection_is_unavailable(): void
    {
        $this->setUpRevenueSchema('sqlite');
        $this->seedRevenueFixture('sqlite', 1100, 400, 2100);

        config()->set('vnpt_read_replica.connection', 'missing_replica');

        $resolver = app(ReadReplicaConnectionResolver::class);
        $response = app(RevenueByContractService::class)->index(Request::create('/api/v5/revenue/by-contract', 'GET', [
            'period_from' => '2026-03-01',
            'period_to' => '2026-03-31',
        ]));

        $payload = $response->getData(true);

        $this->assertFalse($resolver->usingReplica());
        $this->assertSame('sqlite', $resolver->resolvedConnectionName());
        $this->assertSame(200, $response->getStatusCode());
        $this->assertEquals(1100.0, data_get($payload, 'meta.kpis.total_expected'));
        $this->assertEquals(400.0, data_get($payload, 'meta.kpis.total_collected'));
        $this->assertSame('HD-PRIMARY', data_get($payload, 'data.0.contract_code'));
    }

    private function configureConnections(): void
    {
        $sqliteConfig = config('database.connections.sqlite');
        $sqliteConfig['database'] = $this->primaryDatabasePath;

        $replicaConfig = $sqliteConfig;
        $replicaConfig['database'] = $this->replicaDatabasePath;

        config()->set('database.default', 'sqlite');
        config()->set('database.connections.sqlite', $sqliteConfig);
        config()->set('database.connections.analytics_replica', $replicaConfig);
        config()->set('vnpt_read_replica.enabled', true);
        config()->set('vnpt_read_replica.primary_connection', 'sqlite');
        config()->set('vnpt_read_replica.connection', 'analytics_replica');

        DB::purge('sqlite');
        DB::purge('analytics_replica');
    }

    private function bindPassthroughCache(): void
    {
        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('rememberTagged')
            ->andReturnUsing(fn (array $tags, string $key, int $ttl, \Closure $callback) => $callback());
        $cache->shouldReceive('flushTags')->andReturnNull();
        $this->app->instance(CacheService::class, $cache);
    }

    private function setUpRevenueSchema(string $connection): void
    {
        Schema::connection($connection)->create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name');
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::connection($connection)->create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->string('contract_code')->nullable();
            $table->string('contract_name')->nullable();
            $table->string('status', 30)->nullable();
            $table->string('payment_cycle', 30)->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::connection($connection)->create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->string('milestone_name')->nullable();
            $table->unsignedInteger('cycle_number')->nullable();
            $table->date('expected_date');
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->decimal('actual_amount', 18, 2)->default(0);
            $table->date('actual_paid_date')->nullable();
            $table->string('status', 30)->nullable();
            $table->unsignedBigInteger('invoice_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::connection($connection)->create('revenue_targets', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('period_type', 20);
            $table->string('target_type', 30)->default('TOTAL');
            $table->string('period_key', 10);
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('dept_id')->default(0);
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->timestamp('deleted_at')->nullable();
        });
    }

    private function seedRevenueFixture(string $connection, float $expectedAmount, float $actualAmount, float $targetAmount): void
    {
        $isReplica = $connection === 'analytics_replica';

        DB::connection($connection)->table('customers')->insert([
            'id' => 1,
            'customer_name' => $isReplica ? 'Khach hang Replica' : 'Khach hang Primary',
            'deleted_at' => null,
        ]);

        DB::connection($connection)->table('contracts')->insert([
            'id' => 1,
            'customer_id' => 1,
            'dept_id' => 9,
            'contract_code' => $isReplica ? 'HD-REPLICA' : 'HD-PRIMARY',
            'contract_name' => $isReplica ? 'Hop dong Replica' : 'Hop dong Primary',
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'deleted_at' => null,
        ]);

        DB::connection($connection)->table('payment_schedules')->insert([
            [
                'id' => 1,
                'contract_id' => 1,
                'milestone_name' => 'Dot 1',
                'cycle_number' => 1,
                'expected_date' => '2026-03-15',
                'expected_amount' => $expectedAmount,
                'actual_amount' => $actualAmount,
                'actual_paid_date' => '2026-03-20',
                'status' => 'PARTIAL',
                'invoice_id' => null,
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'contract_id' => 1,
                'milestone_name' => 'Thang truoc',
                'cycle_number' => 2,
                'expected_date' => '2026-02-15',
                'expected_amount' => 300,
                'actual_amount' => 100,
                'actual_paid_date' => '2026-02-18',
                'status' => 'PARTIAL',
                'invoice_id' => null,
                'deleted_at' => null,
            ],
        ]);

        DB::connection($connection)->table('revenue_targets')->insert([
            'id' => 1,
            'period_type' => 'MONTHLY',
            'target_type' => 'TOTAL',
            'period_key' => '2026-03',
            'period_start' => '2026-03-01',
            'period_end' => '2026-03-31',
            'dept_id' => 0,
            'target_amount' => $targetAmount,
            'deleted_at' => null,
        ]);
    }

    private function dropRevenueTables(string $connection): void
    {
        try {
            Schema::connection($connection)->dropIfExists('revenue_targets');
            Schema::connection($connection)->dropIfExists('payment_schedules');
            Schema::connection($connection)->dropIfExists('contracts');
            Schema::connection($connection)->dropIfExists('customers');
        } catch (\Throwable) {
            // The connection may be intentionally invalid in fallback assertions.
        }
    }
}
