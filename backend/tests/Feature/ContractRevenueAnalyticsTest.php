<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContractRevenueAnalyticsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_returns_period_contract_and_cycle_revenue_analytics(): void
    {
        $this->seedRevenueFixtures();

        $this->getJson('/api/v5/contracts/revenue-analytics?period_from=2026-01-01&period_to=2026-03-31&grouping=month')
            ->assertOk()
            ->assertJsonPath('data.kpis.expected_revenue', 500)
            ->assertJsonPath('data.kpis.actual_collected', 150)
            ->assertJsonPath('data.kpis.outstanding', 350)
            ->assertJsonPath('data.kpis.overdue_amount', 100)
            ->assertJsonPath('data.kpis.overdue_count', 1)
            ->assertJsonPath('data.kpis.carry_over_from_previous', 30)
            ->assertJsonPath('data.kpis.cumulative_collected', 160)
            ->assertJsonPath('data.kpis.collection_rate', 30)
            ->assertJsonPath('data.kpis.avg_days_to_collect', 5)
            ->assertJsonPath('data.kpis.on_time_rate', 0)
            ->assertJsonPath('data.by_period.0.period_key', '2026-01')
            ->assertJsonPath('data.by_period.0.expected', 100)
            ->assertJsonPath('data.by_period.0.actual', 100)
            ->assertJsonPath('data.by_period.0.carry_over', 30)
            ->assertJsonPath('data.by_period.1.period_key', '2026-02')
            ->assertJsonPath('data.by_period.1.expected', 300)
            ->assertJsonPath('data.by_period.1.actual', 50)
            ->assertJsonPath('data.by_period.2.period_key', '2026-03')
            ->assertJsonPath('data.by_period.2.overdue', 100)
            ->assertJsonPath('data.by_cycle.0.cycle', 'MONTHLY')
            ->assertJsonPath('data.by_cycle.0.contract_count', 1)
            ->assertJsonPath('data.by_cycle.0.expected', 300)
            ->assertJsonPath('data.by_cycle.1.cycle', 'QUARTERLY')
            ->assertJsonPath('data.by_cycle.1.expected', 200)
            ->assertJsonPath('data.by_contract.0.contract_code', 'HD-002')
            ->assertJsonPath('data.by_contract.1.contract_code', 'HD-001')
            ->assertJsonPath('data.overdue_details.0.contract_code', 'HD-001')
            ->assertJsonPath('data.by_item', null);
    }

    public function test_it_returns_allocated_item_breakdown_for_selected_contract(): void
    {
        $this->seedRevenueFixtures();

        $this->getJson('/api/v5/contracts/revenue-analytics?period_from=2026-01-01&period_to=2026-03-31&grouping=month&contract_id=100')
            ->assertOk()
            ->assertJsonPath('data.by_contract.0.contract_id', 100)
            ->assertJsonCount(2, 'data.by_item')
            ->assertJsonPath('data.by_item.0.product_code', 'P001')
            ->assertJsonPath('data.by_item.0.unit', 'License')
            ->assertJsonPath('data.by_item.0.proportion', 60)
            ->assertJsonPath('data.by_item.0.allocated_expected', 180)
            ->assertJsonPath('data.by_item.0.allocated_actual', 90)
            ->assertJsonPath('data.by_item.1.product_code', 'P002')
            ->assertJsonPath('data.by_item.1.proportion', 40)
            ->assertJsonPath('data.by_item.1.allocated_expected', 120)
            ->assertJsonPath('data.by_item.1.allocated_actual', 60)
            ->assertJsonPath('data.by_item.1.allocated_outstanding', 60);
    }

    public function test_it_falls_back_to_project_items_for_legacy_contracts_without_contract_items(): void
    {
        $this->seedRevenueFixtures();

        $this->getJson('/api/v5/contracts/revenue-analytics?period_from=2026-01-01&period_to=2026-03-31&grouping=month&contract_id=101')
            ->assertOk()
            ->assertJsonPath('data.by_contract.0.contract_id', 101)
            ->assertJsonCount(2, 'data.by_item')
            ->assertJsonPath('data.by_item.0.product_code', 'P001')
            ->assertJsonPath('data.by_item.0.unit', 'License')
            ->assertJsonPath('data.by_item.0.proportion', 75)
            ->assertJsonPath('data.by_item.0.allocated_expected', 150)
            ->assertJsonPath('data.by_item.0.allocated_actual', 0)
            ->assertJsonPath('data.by_item.0.allocated_outstanding', 150)
            ->assertJsonPath('data.by_item.1.product_code', 'P002')
            ->assertJsonPath('data.by_item.1.unit', 'Thang')
            ->assertJsonPath('data.by_item.1.proportion', 25)
            ->assertJsonPath('data.by_item.1.allocated_expected', 50)
            ->assertJsonPath('data.by_item.1.allocated_outstanding', 50);
    }

    private function seedRevenueFixtures(): void
    {
        DB::table('customers')->insert([
            ['id' => 1, 'customer_code' => 'KH001', 'customer_name' => 'VNPT Ha Noi', 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['id' => 2, 'customer_code' => 'KH002', 'customer_name' => 'VNPT HCM', 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
        ]);

        DB::table('projects')->insert([
            ['id' => 1, 'project_code' => 'DA001', 'project_name' => 'Du an 1', 'customer_id' => 1, 'dept_id' => 10, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['id' => 2, 'project_code' => 'DA002', 'project_name' => 'Du an 2', 'customer_id' => 2, 'dept_id' => 10, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
        ]);

        DB::table('products')->insert([
            ['id' => 1, 'product_code' => 'P001', 'product_name' => 'Phan mem HIS', 'standard_price' => 180, 'unit' => 'License', 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['id' => 2, 'product_code' => 'P002', 'product_name' => 'Dich vu SOC', 'standard_price' => 120, 'unit' => 'Thang', 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
        ]);

        DB::table('contracts')->insert([
            [
                'id' => 100,
                'contract_code' => 'HD-001',
                'contract_name' => 'Hop dong HIS',
                'customer_id' => 1,
                'project_id' => 1,
                'dept_id' => 10,
                'value' => 300,
                'payment_cycle' => 'MONTHLY',
                'status' => 'SIGNED',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 101,
                'contract_code' => 'HD-002',
                'contract_name' => 'Hop dong SOC',
                'customer_id' => 2,
                'project_id' => 2,
                'dept_id' => 10,
                'value' => 200,
                'payment_cycle' => 'QUARTERLY',
                'status' => 'SIGNED',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        DB::table('contract_items')->insert([
            ['contract_id' => 100, 'product_id' => 1, 'quantity' => 1, 'unit_price' => 180, 'created_by' => 1, 'updated_by' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['contract_id' => 100, 'product_id' => 2, 'quantity' => 1, 'unit_price' => 120, 'created_by' => 1, 'updated_by' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('project_items')->insert([
            ['project_id' => 1, 'product_id' => 1, 'quantity' => 1, 'unit_price' => 300, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['project_id' => 2, 'product_id' => 1, 'quantity' => 1, 'unit_price' => 150, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
            ['project_id' => 2, 'product_id' => 2, 'quantity' => 1, 'unit_price' => 50, 'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null],
        ]);

        DB::table('payment_schedules')->insert([
            [
                'id' => 1,
                'contract_id' => 100,
                'project_id' => 1,
                'milestone_name' => 'Ky 0',
                'cycle_number' => 0,
                'expected_date' => '2025-12-15',
                'expected_amount' => 40,
                'actual_paid_date' => '2025-12-20',
                'actual_paid_amount' => 10,
                'status' => 'OVERDUE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'contract_id' => 100,
                'project_id' => 1,
                'milestone_name' => 'Ky 1',
                'cycle_number' => 1,
                'expected_date' => '2026-01-15',
                'expected_amount' => 100,
                'actual_paid_date' => '2026-01-20',
                'actual_paid_amount' => 100,
                'status' => 'PAID',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'contract_id' => 100,
                'project_id' => 1,
                'milestone_name' => 'Ky 2',
                'cycle_number' => 2,
                'expected_date' => '2026-02-15',
                'expected_amount' => 100,
                'actual_paid_date' => '2026-02-20',
                'actual_paid_amount' => 50,
                'status' => 'PARTIAL',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'contract_id' => 100,
                'project_id' => 1,
                'milestone_name' => 'Ky 3',
                'cycle_number' => 3,
                'expected_date' => '2026-03-15',
                'expected_amount' => 100,
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'OVERDUE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 5,
                'contract_id' => 101,
                'project_id' => 2,
                'milestone_name' => 'Ky Q1',
                'cycle_number' => 1,
                'expected_date' => '2026-02-10',
                'expected_amount' => 200,
                'actual_paid_date' => null,
                'actual_paid_amount' => 0,
                'status' => 'PENDING',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contract_items');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 50)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_code', 50)->nullable();
            $table->string('product_name', 255)->nullable();
            $table->decimal('standard_price', 15, 2)->default(0);
            $table->string('unit', 50)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
            $table->decimal('value', 18, 2)->default(0);
            $table->string('payment_cycle', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('contract_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unique(['contract_id', 'product_id']);
        });

        Schema::create('project_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('payment_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('milestone_name', 255);
            $table->unsignedInteger('cycle_number');
            $table->date('expected_date');
            $table->decimal('expected_amount', 18, 2)->default(0);
            $table->date('actual_paid_date')->nullable();
            $table->decimal('actual_paid_amount', 18, 2)->default(0);
            $table->string('status', 32)->default('PENDING');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phong giai phap 10',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 1,
            'user_code' => 'U001',
            'username' => 'tester',
            'full_name' => 'Tester',
            'department_id' => 10,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);
    }
}
