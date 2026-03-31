<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ContractTermPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_creates_contract_with_term_fields(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-001',
            'contract_name' => 'Hop dong giam sat SOC',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 982019190,
            'payment_cycle' => 'YEARLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'term_unit' => 'DAY',
            'term_value' => 50,
            'expiry_date_manual_override' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('data.payment_cycle', 'YEARLY')
            ->assertJsonPath('data.signer_user_id', 1)
            ->assertJsonPath('data.dept_id', 10)
            ->assertJsonPath('data.term_unit', 'DAY')
            ->assertJsonPath('data.term_value', 50)
            ->assertJsonPath('data.expiry_date_manual_override', false)
            ->assertJsonPath('data.expiry_date', '2026-04-19');

        $stored = DB::table('contracts')->where('contract_code', 'HD-001')->first();
        $this->assertNotNull($stored);
        $this->assertSame('YEARLY', $stored->payment_cycle);
        $this->assertSame(1, (int) $stored->signer_user_id);
        $this->assertSame(10, (int) $stored->dept_id);
        $this->assertSame('DAY', $stored->term_unit);
        $this->assertSame(50.0, (float) $stored->term_value);
        $this->assertSame(0, (int) $stored->expiry_date_manual_override);
        $this->assertSame('2026-04-19', $stored->expiry_date);
    }

    public function test_it_creates_initial_contract_without_project_and_persists_project_type_code(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-INITIAL-001',
            'contract_name' => 'Hop dong dau ky',
            'signer_user_id' => 1,
            'customer_id' => 1,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'value' => 125000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'term_unit' => 'MONTH',
            'term_value' => 12,
            'expiry_date_manual_override' => false,
        ])
            ->assertCreated()
            ->assertJsonPath('data.project_id', null)
            ->assertJsonPath('data.customer_id', 1)
            ->assertJsonPath('data.project_type_code', 'THUE_DICH_VU_COSAN');

        $stored = DB::table('contracts')->where('contract_code', 'HD-INITIAL-001')->first();
        $this->assertNotNull($stored);
        $this->assertNull($stored->project_id);
        $this->assertSame(1, (int) $stored->customer_id);
        $this->assertSame('THUE_DICH_VU_COSAN', $stored->project_type_code);
    }

    public function test_it_derives_customer_from_project_and_clears_initial_project_type_on_update(): void
    {
        DB::table('contracts')->insert([
            'id' => 101,
            'contract_code' => 'HD-101',
            'contract_name' => 'Hop dong dau ky can chuyen mode',
            'customer_id' => 2,
            'project_id' => null,
            'project_type_code' => 'THUE_DICH_VU_COSAN',
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 99000000,
            'payment_cycle' => 'MONTHLY',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-04-30',
            'term_unit' => 'MONTH',
            'term_value' => 2,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/101', [
            'signer_user_id' => 1,
            'project_id' => 1,
            'customer_id' => 2,
            'project_type_code' => null,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.project_id', 1)
            ->assertJsonPath('data.customer_id', 1)
            ->assertJsonPath('data.project_type_code', null);

        $stored = DB::table('contracts')->where('id', 101)->first();
        $this->assertNotNull($stored);
        $this->assertSame(1, (int) $stored->project_id);
        $this->assertSame(1, (int) $stored->customer_id);
        $this->assertNull($stored->project_type_code);
    }

    public function test_it_rejects_conflicting_project_and_initial_project_type_payload(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-CONFLICT-001',
            'contract_name' => 'Hop dong mau thuan',
            'signer_user_id' => 1,
            'customer_id' => 2,
            'project_id' => 1,
            'project_type_code' => 'DAU_TU',
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['project_type_code']);
    }

    public function test_it_updates_and_lists_contract_term_fields(): void
    {
        DB::table('contracts')->insert([
            'id' => 100,
            'contract_code' => 'HD-100',
            'contract_name' => 'Hop dong ban dau',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 150000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => null,
            'term_unit' => null,
            'term_value' => null,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/100', [
            'signer_user_id' => 1,
            'payment_cycle' => 'MONTHLY',
            'term_unit' => 'MONTH',
            'term_value' => 2,
            'expiry_date_manual_override' => false,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.payment_cycle', 'MONTHLY')
            ->assertJsonPath('data.signer_user_id', 1)
            ->assertJsonPath('data.dept_id', 10)
            ->assertJsonPath('data.dept_code', 'P10')
            ->assertJsonPath('data.dept_name', 'Phong giai phap 10')
            ->assertJsonPath('data.term_unit', 'MONTH')
            ->assertJsonPath('data.term_value', 2)
            ->assertJsonPath('data.expiry_date_manual_override', false)
            ->assertJsonPath('data.expiry_date', '2026-04-30');

        $stored = DB::table('contracts')->where('id', 100)->first();
        $this->assertNotNull($stored);
        $this->assertSame('MONTHLY', $stored->payment_cycle);
        $this->assertSame(1, (int) $stored->signer_user_id);
        $this->assertSame(10, (int) $stored->dept_id);
        $this->assertSame('MONTH', $stored->term_unit);
        $this->assertSame(2.0, (float) $stored->term_value);
        $this->assertSame(0, (int) $stored->expiry_date_manual_override);
        $this->assertSame('2026-04-30', $stored->expiry_date);

        $this->getJson('/api/v5/contracts?page=1&per_page=10')
            ->assertOk()
            ->assertJsonPath('data.0.id', 100)
            ->assertJsonPath('data.0.payment_cycle', 'MONTHLY')
            ->assertJsonPath('data.0.signer_user_id', 1)
            ->assertJsonPath('data.0.dept_id', 10)
            ->assertJsonPath('data.0.signer_user_code', 'U001')
            ->assertJsonPath('data.0.signer_full_name', 'Tester')
            ->assertJsonPath('data.0.term_unit', 'MONTH')
            ->assertJsonPath('data.0.term_value', 2)
            ->assertJsonPath('data.0.expiry_date_manual_override', false)
            ->assertJsonPath('data.0.expiry_date', '2026-04-30');
    }

    public function test_it_updates_signer_and_reassigns_contract_department(): void
    {
        DB::table('contracts')->insert([
            'id' => 102,
            'contract_code' => 'HD-102',
            'contract_name' => 'Hop dong doi nguoi ky',
            'customer_id' => 1,
            'project_id' => 1,
            'project_type_code' => null,
            'dept_id' => 10,
            'signer_user_id' => 1,
            'value' => 88000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
            'expiry_date' => '2026-03-31',
            'term_unit' => 'DAY',
            'term_value' => 31,
            'expiry_date_manual_override' => 0,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/contracts/102', [
            'signer_user_id' => 2,
            'sign_date' => '2026-03-01',
            'effective_date' => '2026-03-01',
        ])
            ->assertOk()
            ->assertJsonPath('data.signer_user_id', 2)
            ->assertJsonPath('data.signer_user_code', 'U002')
            ->assertJsonPath('data.signer_full_name', 'Approver 20')
            ->assertJsonPath('data.dept_id', 20)
            ->assertJsonPath('data.dept_code', 'P20')
            ->assertJsonPath('data.dept_name', 'Phong giai phap 20');

        $stored = DB::table('contracts')->where('id', 102)->first();
        $this->assertNotNull($stored);
        $this->assertSame(2, (int) $stored->signer_user_id);
        $this->assertSame(20, (int) $stored->dept_id);
    }

    public function test_it_rejects_signer_without_valid_department(): void
    {
        $this->postJson('/api/v5/contracts', [
            'contract_code' => 'HD-NO-DEPT',
            'contract_name' => 'Hop dong signer loi',
            'signer_user_id' => 4,
            'customer_id' => 1,
            'project_id' => 1,
            'value' => 1000000,
            'payment_cycle' => 'ONCE',
            'status' => 'DRAFT',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['signer_user_id']);
    }

    public function test_it_returns_scoped_signer_options(): void
    {
        $this->getJson('/api/v5/contracts/signer-options')
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.user_code', 'U001')
            ->assertJsonPath('data.0.department_id', 10)
            ->assertJsonPath('data.0.dept_code', 'P10')
            ->assertJsonPath('data.1.id', 2)
            ->assertJsonPath('data.1.user_code', 'U002')
            ->assertJsonMissing(['id' => 3]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('project_types');
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

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 32)->default('DEPT_ONLY');
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
            $table->string('investment_mode', 100)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('project_types', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('type_code', 100)->nullable();
            $table->string('type_name', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('contracts', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('contract_code', 100)->nullable();
            $table->string('contract_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('project_type_code', 100)->nullable();
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

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'P10',
            'dept_name' => 'Phong giai phap 10',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 20,
            'dept_code' => 'P20',
            'dept_name' => 'Phong giai phap 20',
            'parent_id' => null,
            'deleted_at' => null,
        ]);

        DB::table('departments')->insert([
            'id' => 30,
            'dept_code' => 'P30',
            'dept_name' => 'Phong giai phap 30',
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

        DB::table('internal_users')->insert([
            'id' => 2,
            'user_code' => 'U002',
            'username' => 'approver20',
            'full_name' => 'Approver 20',
            'department_id' => 20,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 3,
            'user_code' => 'U003',
            'username' => 'outsider30',
            'full_name' => 'Outsider 30',
            'department_id' => 30,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('internal_users')->insert([
            'id' => 4,
            'user_code' => 'U004',
            'username' => 'nodept',
            'full_name' => 'No Department',
            'department_id' => null,
            'password' => bcrypt('secret'),
            'remember_token' => null,
            'deleted_at' => null,
        ]);

        DB::table('user_dept_scopes')->insert([
            ['user_id' => 1, 'dept_id' => 10, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 1, 'dept_id' => 20, 'scope_type' => 'DEPT_ONLY'],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => 'KH001',
            'customer_name' => 'Trung tam Phong chong HIV',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('customers')->insert([
            'id' => 2,
            'customer_code' => 'KH002',
            'customer_name' => 'Benh vien Da khoa',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('projects')->insert([
            'id' => 1,
            'project_code' => 'DA016',
            'project_name' => 'Du an giam sat SOC',
            'customer_id' => 1,
            'dept_id' => 10,
            'investment_mode' => 'DAU_TU',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('project_types')->insert([
            [
                'id' => 1,
                'type_code' => 'DAU_TU',
                'type_name' => 'Dau tu',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'type_code' => 'THUE_DICH_VU_DACTHU',
                'type_name' => 'Thue dich vu CNTT dac thu',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'type_code' => 'THUE_DICH_VU_COSAN',
                'type_name' => 'Thue dich vu CNTT co san',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
