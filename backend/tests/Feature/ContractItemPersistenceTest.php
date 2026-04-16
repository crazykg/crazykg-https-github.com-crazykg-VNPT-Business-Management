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
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 150000000, 'vat_rate' => 10, 'vat_amount' => 15000000],
                ['product_id' => 2, 'quantity' => 1, 'unit_price' => 80000000, 'vat_rate' => 8, 'vat_amount' => 6400000],
            ],
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_name', 'Phan mem VNPT HIS')
            ->assertJsonPath('data.items.0.unit', 'License')
            ->assertJsonPath('data.items.0.vat_rate', 10)
            ->assertJsonPath('data.items.0.vat_amount', 15000000);

        $this->assertSame(2, DB::table('contract_items')->count());
        $this->assertSame(15000000.0, (float) DB::table('contract_items')->where('product_id', 1)->value('vat_amount'));
    }

    public function test_it_syncs_stored_contract_amount_from_contract_items_total(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-AMOUNT',
            'contract_name' => 'Hop dong dong bo gia tri',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 150000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 150000000],
                ['product_id' => 2, 'quantity' => 559, 'unit_price' => 550000],
                ['product_id' => 3, 'quantity' => 10, 'unit_price' => 100000000],
                ['product_id' => 4, 'quantity' => 30, 'unit_price' => 100000000],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.value', 4457450000);

        $storedContract = DB::table('contracts')
            ->where('contract_code', 'HD-CI-AMOUNT')
            ->first();

        $this->assertNotNull($storedContract);
        $this->assertSame(4457450000.0, (float) $storedContract->value);
    }

    public function test_it_snapshots_project_items_when_project_contract_is_created_without_items(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-PROJECT-SNAPSHOT',
            'contract_name' => 'Hop dong tu dong lay hang muc du an',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 18000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_package_id', 11)
            ->assertJsonPath('data.items.0.product_name', 'Thue HIS Tram phu')
            ->assertJsonPath('data.items.1.product_package_id', 12)
            ->assertJsonPath('data.items.1.product_name', 'Thue HIS Tram chinh')
            ->assertJsonPath('data.value', 18000000);

        $storedItems = DB::table('contract_items')
            ->where('contract_id', 1)
            ->orderBy('id')
            ->get(['product_id', 'product_package_id', 'product_name', 'unit', 'quantity', 'unit_price']);

        $this->assertCount(2, $storedItems);
        $this->assertSame(11, (int) $storedItems[0]->product_package_id);
        $this->assertSame(12, (int) $storedItems[1]->product_package_id);
        $this->assertSame('Thue HIS Tram phu', $storedItems[0]->product_name);
        $this->assertSame('Thue HIS Tram chinh', $storedItems[1]->product_name);
    }

    public function test_it_persists_product_package_reference_and_uses_package_snapshot(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-PKG',
            'contract_name' => 'Hop dong tham chieu goi cuoc',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 7200000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'items' => [
                [
                    'product_id' => 1,
                    'product_package_id' => 11,
                    'quantity' => 12,
                    'unit_price' => 600000,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.product_id', 1)
            ->assertJsonPath('data.items.0.product_package_id', 11)
            ->assertJsonPath('data.items.0.product_name', 'Thue HIS Tram phu')
            ->assertJsonPath('data.items.0.unit', 'Tram/Thang')
            ->assertJsonPath('data.items.0.product_code', 'PKG-HIS-TRAM-PHU');

        $storedItem = DB::table('contract_items')
            ->where('contract_id', 1)
            ->first(['product_id', 'product_package_id', 'product_name', 'unit']);

        $this->assertNotNull($storedItem);
        $this->assertSame(1, (int) $storedItem->product_id);
        $this->assertSame(11, (int) $storedItem->product_package_id);
        $this->assertSame('Thue HIS Tram phu', $storedItem->product_name);
        $this->assertSame('Tram/Thang', $storedItem->unit);
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
            'signer_user_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('contract_items')->insert([
            'contract_id' => 100,
            'product_id' => 1,
            'product_name' => 'Snapshot HIS theo tram',
            'unit' => 'Tram/Thang',
            'quantity' => 1,
            'unit_price' => 150000000,
            'vat_rate' => 10,
            'vat_amount' => 15000000,
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
            ->assertJsonPath('data.items.0.product_name', 'Snapshot HIS theo tram')
            ->assertJsonPath('data.items.0.unit', 'Tram/Thang')
            ->assertJsonPath('data.items.0.vat_rate', 10)
            ->assertJsonPath('data.items.0.vat_amount', 15000000);
    }

    public function test_it_allows_duplicate_product_ids_when_each_line_keeps_its_snapshot(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CI-DUP',
            'contract_name' => 'Hop dong trung san pham',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 230000000,
            'items' => [
                [
                    'product_id' => 1,
                    'product_name' => 'Thue HIS Tram phu',
                    'unit' => 'Tram/Thang',
                    'quantity' => 12,
                    'unit_price' => 600000,
                ],
                [
                    'product_id' => 1,
                    'product_name' => 'Thue HIS Tram chinh',
                    'unit' => 'Tram/Thang',
                    'quantity' => 12,
                    'unit_price' => 900000,
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_name', 'Thue HIS Tram phu')
            ->assertJsonPath('data.items.1.product_name', 'Thue HIS Tram chinh')
            ->assertJsonPath('data.items.0.unit', 'Tram/Thang')
            ->assertJsonPath('data.items.1.unit', 'Tram/Thang');

        $storedItems = DB::table('contract_items')
            ->where('contract_id', 1)
            ->orderBy('id')
            ->get(['product_id', 'product_name', 'unit', 'quantity', 'unit_price']);

        $this->assertCount(2, $storedItems);
        $this->assertSame('Thue HIS Tram phu', $storedItems[0]->product_name);
        $this->assertSame('Thue HIS Tram chinh', $storedItems[1]->product_name);
        $this->assertSame(1, (int) $storedItems[0]->product_id);
        $this->assertSame(1, (int) $storedItems[1]->product_id);
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
            'signer_user_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
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
            'signer_user_id' => 1,
            'items' => [
                ['product_id' => 1, 'quantity' => 1, 'unit_price' => 999999],
            ],
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Không thể sửa hạng mục khi hợp đồng đã có kỳ thanh toán.');
    }

    public function test_it_blocks_payment_cycle_updates_with_a_specific_message_when_payment_schedules_exist(): void
    {
        DB::table('contracts')->insert([
            'id' => 201,
            'contract_code' => 'HD-CI-201',
            'contract_name' => 'Hop dong khoa chu ky',
            'customer_id' => 1,
            'project_id' => 1,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('payment_schedules')->insert([
            'contract_id' => 201,
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

        $this->putJson('/api/v5/contracts/201', [
            'signer_user_id' => 1,
            'payment_cycle' => 'MONTHLY',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Không thể sửa chu kỳ thanh toán khi hợp đồng đã có kỳ thanh toán.');
    }

    public function test_it_allows_non_schedule_updates_and_returns_schedule_metadata_when_payment_schedules_exist(): void
    {
        DB::table('contracts')->insert([
            'id' => 202,
            'contract_code' => 'HD-CI-202',
            'contract_name' => 'Hop dong van cho phep doi trang thai',
            'customer_id' => 1,
            'project_id' => 1,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 230000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('payment_schedules')->insert([
            'contract_id' => 202,
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

        $this->putJson('/api/v5/contracts/202', [
            'signer_user_id' => 1,
            'status' => 'SIGNED',
            'payment_cycle' => 'ONCE',
            'contract_name' => 'Hop dong da ky',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-12-31',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'SIGNED')
            ->assertJsonPath('data.contract_name', 'Hop dong da ky')
            ->assertJsonPath('data.payment_schedule_count', 1)
            ->assertJsonPath('data.has_generated_payment_schedules', true)
            ->assertJsonPath('data.can_edit_schedule_source_fields', false)
            ->assertJsonPath('data.can_delete_unpaid_schedules', true);
    }

    public function test_backfill_migration_restores_contract_items_from_matching_project_items(): void
    {
        DB::table('contracts')->insert([
            [
                'id' => 301,
                'contract_code' => 'HD-CI-BACKFILL-OK',
                'contract_name' => 'Hop dong can phuc hoi hang muc',
                'customer_id' => 1,
                'project_id' => 1,
                'dept_id' => 10,
                'signer_user_id' => 1,
                'value' => 18000000,
                'payment_cycle' => 'MONTHLY',
                'status' => 'SIGNED',
                'sign_date' => '2026-03-01',
                'effective_date' => '2026-03-01',
                'expiry_date' => '2027-02-28',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 302,
                'contract_code' => 'HD-CI-BACKFILL-SKIP',
                'contract_name' => 'Hop dong khong du dieu kien backfill',
                'customer_id' => 1,
                'project_id' => 1,
                'dept_id' => 10,
                'signer_user_id' => 1,
                'value' => 9999999,
                'payment_cycle' => 'MONTHLY',
                'status' => 'SIGNED',
                'sign_date' => '2026-03-01',
                'effective_date' => '2026-03-01',
                'expiry_date' => '2027-02-28',
                'created_by' => 1,
                'updated_by' => 1,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        /** @var \Illuminate\Database\Migrations\Migration $migration */
        $migration = require base_path('database/migrations/2026_04_12_090000_backfill_contract_items_from_project_items.php');
        $migration->up();

        $backfilledItems = DB::table('contract_items')
            ->where('contract_id', 301)
            ->orderBy('id')
            ->get(['product_package_id', 'product_name', 'quantity', 'unit_price']);

        $this->assertCount(2, $backfilledItems);
        $this->assertSame(11, (int) $backfilledItems[0]->product_package_id);
        $this->assertSame(12, (int) $backfilledItems[1]->product_package_id);
        $this->assertSame(0, DB::table('contract_items')->where('contract_id', 302)->count());
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('payment_schedules');
        Schema::dropIfExists('contract_items');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('product_packages');
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

        Schema::create('project_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('product_package_id')->nullable();
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
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

        Schema::create('product_packages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('product_id');
            $table->string('package_code', 50)->nullable();
            $table->string('package_name', 255)->nullable();
            $table->string('product_name', 255)->nullable();
            $table->string('unit', 100)->nullable();
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
            $table->unsignedBigInteger('signer_user_id')->nullable();
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
            $table->unsignedBigInteger('product_package_id')->nullable();
            $table->string('product_name', 500)->nullable();
            $table->string('unit', 100)->nullable();
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->decimal('vat_amount', 18, 2)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
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
            [
                'id' => 3,
                'product_code' => 'P003',
                'product_name' => 'Phan mem VNPT RIS-PACS',
                'standard_price' => 100000000,
                'unit' => 'Goi',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 4,
                'product_code' => 'P004',
                'product_name' => 'Phan mem Benh an dien tu',
                'standard_price' => 100000000,
                'unit' => 'Goi',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        DB::table('product_packages')->insert([
            [
                'id' => 11,
                'product_id' => 1,
                'package_code' => 'PKG-HIS-TRAM-PHU',
                'package_name' => 'Thue HIS Tram phu',
                'product_name' => 'Phan mem VNPT HIS',
                'unit' => 'Tram/Thang',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 12,
                'product_id' => 1,
                'package_code' => 'PKG-HIS-TRAM-CHINH',
                'package_name' => 'Thue HIS Tram chinh',
                'product_name' => 'Phan mem VNPT HIS',
                'unit' => 'Tram/Thang',
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);

        DB::table('project_items')->insert([
            [
                'id' => 101,
                'project_id' => 1,
                'product_id' => 1,
                'product_package_id' => 11,
                'quantity' => 12,
                'unit_price' => 600000,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'id' => 102,
                'project_id' => 1,
                'product_id' => 1,
                'product_package_id' => 12,
                'quantity' => 12,
                'unit_price' => 900000,
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
        ]);
    }
}
