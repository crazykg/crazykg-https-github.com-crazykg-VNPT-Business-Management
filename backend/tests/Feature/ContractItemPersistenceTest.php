<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContractItemPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_creates_contract_and_syncs_contract_items(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-001',
            'contract_name' => 'Hop dong co hang muc',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 150000000],
                ['product_id' => 2, 'quantity' => 1, 'unit_price' => 80000000],
            ],
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_name', 'Phan mem VNPT HIS')
            ->assertJsonPath('data.items.0.unit', 'License');

        $this->assertSame(2, DB::table('contract_items')->count());
    }

    public function test_it_returns_contract_detail_with_items_but_keeps_index_compact(): void
    {
        DB::table('contracts')->insert([
            'id' => 100,
            'contract_code' => 'HD-CI-100',
            'contract_name' => 'Hop dong chi tiet',
            'customer_id' => 1,
            'project_id' => 1,
            'dept_id' => 10,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('contract_items')->insert([
            'contract_id' => 100,
            'product_id' => 1,
            'quantity' => 1,
            'unit_price' => 150000000,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/v5/contracts?page=1&per_page=10')
            ->assertOk()
            ->assertJsonMissingPath('data.0.items');

        $this->getJson('/api/v5/contracts/100')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.product_code', 'P001')
            ->assertJsonPath('data.items.0.unit', 'License');
    }

    public function test_it_rejects_duplicate_product_ids_before_insert(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-DUP',
            'contract_name' => 'Hop dong trung san pham',
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 230000000,
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 150000000],
                ['product_id' => 1, 'quantity' => 2, 'unit_price' => 20000000],
            ],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items.1.product_id']);
    }

    public function test_it_blocks_item_updates_when_payment_schedules_exist(): void
    {
        DB::table('contracts')->insert([
            'id' => 200,
            'contract_code' => 'HD-CI-200',
            'contract_name' => 'Hop dong da co lich thu',
            'customer_id' => 1,
            'project_id' => 1,
            'dept_id' => 10,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('payment_schedules')->insert([
            'contract_id' => 200,
            'project_id' => 1,
            'milestone_name' => 'Thanh toan ky 1',
            'cycle_number' => 1,
            'expected_date' => '2026-04-01',
            'expected_amount' => 1000000,
            'actual_paid_amount' => 0,
            'status' => 'PENDING',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/api/v5/contracts/200', [
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 999999],
            ],
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Không thể sửa hạng mục khi đã có kỳ thanh toán.');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contract_items');
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
            $table->date('sign_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('term_unit', 10)->nullable();
            $table->decimal('term_value', 10, 2)->nullable();
            $table->boolean('expiry_date_manual_override')->default(false);
            $table->string('data_scope', 255)->nullable();
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

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'KH001',
            'customer_name' => 'Khach hang A',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'DA001',
            'project_name' => 'Du an A',
            'customer_id' => 1,
            'dept_id' => 10,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('products')->insert([
            [
                'id' => 1,
                'product_code' => 'P001',
                'product_name' => 'Phan mem VNPT HIS',
                'standard_price' => 150000000,
                'unit' => 'License',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'product_code' => 'P002',
                'product_name' => 'Dich vu giam sat SOC',
                'standard_price' => 80000000,
                'unit' => 'Thang',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);
    }
}
