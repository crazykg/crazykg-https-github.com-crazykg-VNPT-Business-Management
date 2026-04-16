<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RevenueTargetSuggestionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->truncateTables();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('project_revenue_schedules');
        Schema::dropIfExists('projects');

        parent::tearDown();
    }

    public function test_suggest_includes_project_phasing_for_active_non_opportunity_project_without_contract_cashflow(): void
    {
        $projectId = (int) DB::table('projects')->insertGetId([
            'status' => 'CHUAN_BI',
            'dept_id' => 0,
            'deleted_at' => null,
        ]);

        DB::table('project_revenue_schedules')->insert([
            'project_id' => $projectId,
            'cycle_number' => 1,
            'expected_date' => '2026-04-15',
            'expected_amount' => 300000000,
        ]);

        $response = $this->getJson('/api/v5/revenue/targets/suggest?year=2026&period_type=MONTHLY&dept_id=0');

        $response->assertOk();

        $dataByPeriod = collect($response->json('data'))->keyBy('period_key');
        $april = $dataByPeriod->get('2026-04');

        $this->assertNotNull($april);
        $this->assertSame(0.0, (float) $april['contract_amount']);
        $this->assertSame(300000000.0, (float) $april['opportunity_amount']);
        $this->assertSame(300000000.0, (float) $april['suggested_total']);
        $this->assertSame(1, (int) $april['opportunity_count']);
    }

    public function test_suggest_excludes_project_phasing_when_contract_cashflow_exists_for_same_project(): void
    {
        $projectId = (int) DB::table('projects')->insertGetId([
            'status' => 'THUC_HIEN_DAU_TU',
            'dept_id' => 0,
            'deleted_at' => null,
        ]);

        DB::table('project_revenue_schedules')->insert([
            'project_id' => $projectId,
            'cycle_number' => 1,
            'expected_date' => '2026-04-15',
            'expected_amount' => 300000000,
        ]);

        $contractId = (int) DB::table('contracts')->insertGetId([
            'project_id' => $projectId,
            'dept_id' => 0,
            'deleted_at' => null,
        ]);

        DB::table('payment_schedules')->insert([
            'contract_id' => $contractId,
            'expected_date' => '2026-04-20',
            'expected_amount' => 180000000,
            'actual_paid_amount' => 20000000,
            'status' => 'PENDING',
        ]);

        $response = $this->getJson('/api/v5/revenue/targets/suggest?year=2026&period_type=MONTHLY&dept_id=0');

        $response->assertOk();

        $dataByPeriod = collect($response->json('data'))->keyBy('period_key');
        $april = $dataByPeriod->get('2026-04');

        $this->assertNotNull($april);
        $this->assertSame(160000000.0, (float) $april['contract_amount']);
        $this->assertSame(0.0, (float) $april['opportunity_amount']);
        $this->assertSame(160000000.0, (float) $april['suggested_total']);
        $this->assertSame(1, (int) $april['contract_count']);
        $this->assertSame(0, (int) $april['opportunity_count']);
    }

    public function test_suggest_can_include_breakdown_preview_payload_with_department_unit(): void
    {
        DB::table('departments')->insert([
            'id' => 10,
            'dept_name' => 'Phòng Giải pháp 10',
        ]);

        $projectId = (int) DB::table('projects')->insertGetId([
            'status' => 'CO_HOI',
            'dept_id' => 10,
            'deleted_at' => null,
        ]);

        DB::table('project_revenue_schedules')->insert([
            'project_id' => $projectId,
            'cycle_number' => 1,
            'expected_date' => '2026-11-25',
            'expected_amount' => 500000000,
        ]);

        $response = $this->getJson('/api/v5/revenue/targets/suggest?year=2026&period_type=MONTHLY&dept_id=0&include_breakdown=1');

        $response->assertOk();
        $this->assertSame(500000000.0, (float) $response->json('preview.project_total'));
        $this->assertSame(0.0, (float) $response->json('preview.contract_total'));

        $projectPreview = $response->json('preview.project_sources.0');
        $this->assertNotNull($projectPreview);
        $this->assertSame($projectId, (int) $projectPreview['project_id']);
        $this->assertSame(10, (int) $projectPreview['dept_id']);
        $this->assertSame('Phòng Giải pháp 10', $projectPreview['department_name']);
        $this->assertSame(1, (int) $projectPreview['schedule_count']);
        $this->assertSame(500000000.0, (float) $projectPreview['total_amount']);
        $this->assertSame('2026-11', $projectPreview['periods'][0]['period_key']);
    }

    private function setUpSchema(): void
    {
        if (! Schema::hasTable('projects')) {
            Schema::create('projects', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('status', 100)->nullable();
                $table->unsignedBigInteger('dept_id')->default(0);
                $table->timestamp('deleted_at')->nullable();
            });
        }

        if (! Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('dept_name', 255)->nullable();
            });
        }

        if (! Schema::hasTable('project_revenue_schedules')) {
            Schema::create('project_revenue_schedules', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('project_id');
                $table->unsignedInteger('cycle_number')->default(1);
                $table->date('expected_date')->nullable();
                $table->decimal('expected_amount', 18, 2)->default(0);
            });
        }

        if (! Schema::hasTable('contracts')) {
            Schema::create('contracts', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('project_id')->nullable();
                $table->unsignedBigInteger('dept_id')->default(0);
                $table->timestamp('deleted_at')->nullable();
            });
        }

        if (! Schema::hasTable('payment_schedules')) {
            Schema::create('payment_schedules', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('contract_id');
                $table->date('expected_date')->nullable();
                $table->decimal('expected_amount', 18, 2)->default(0);
                $table->decimal('actual_paid_amount', 18, 2)->nullable();
                $table->string('status', 30)->default('PENDING');
            });
        }

        if (! Schema::hasTable('internal_users')) {
            Schema::create('internal_users', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('user_code', 50)->nullable();
                $table->string('username', 100)->nullable();
                $table->string('full_name', 255)->nullable();
                $table->string('status', 30)->nullable();
            });
        }

        if (! Schema::hasTable('raci_assignments')) {
            Schema::create('raci_assignments', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('entity_type', 50);
                $table->unsignedBigInteger('entity_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('raci_role', 10)->nullable();
            });
        }
    }

    private function truncateTables(): void
    {
        DB::table('raci_assignments')->delete();
        DB::table('internal_users')->delete();
        DB::table('departments')->delete();
        DB::table('payment_schedules')->delete();
        DB::table('contracts')->delete();
        DB::table('project_revenue_schedules')->delete();
        DB::table('projects')->delete();
    }
}
