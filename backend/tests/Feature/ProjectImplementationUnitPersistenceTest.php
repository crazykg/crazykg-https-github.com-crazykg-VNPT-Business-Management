<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectImplementationUnitPersistenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_returns_scoped_project_implementation_unit_options(): void
    {
        $this->getJson('/api/v5/projects/implementation-unit-options')
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.user_code', 'USR001')
            ->assertJsonPath('data.0.dept_code', 'P10')
            ->assertJsonPath('data.1.id', 2)
            ->assertJsonPath('data.1.user_code', 'USR002')
            ->assertJsonMissing(['id' => 3]);
    }

    public function test_it_creates_project_with_implementation_unit_snapshot(): void
    {
        $this->postJson('/api/v5/projects', [
            'project_code' => 'DA-IMPL-001',
            'project_name' => 'Du an co don vi trien khai',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'start_date' => '2026-04-07',
            'implementation_user_id' => 2,
        ])
            ->assertCreated()
            ->assertJsonPath('data.project_code', 'DA-IMPL-001')
            ->assertJsonPath('data.implementation_user_id', 2)
            ->assertJsonPath('data.implementation_user_code', 'USR002')
            ->assertJsonPath('data.implementation_full_name', 'Nhan su trien khai 2')
            ->assertJsonPath('data.implementation_unit_code', 'P20')
            ->assertJsonPath('data.implementation_unit_name', 'Phong giai phap 20');

        $projectId = DB::table('projects')->where('project_code', 'DA-IMPL-001')->value('id');
        $this->assertNotNull($projectId);

        $stored = DB::table('project_implementation_units')
            ->where('project_id', $projectId)
            ->first();

        $this->assertNotNull($stored);
        $this->assertSame(2, (int) $stored->implementation_user_id);
        $this->assertSame('USR002', $stored->implementation_user_code);
        $this->assertSame('Nhan su trien khai 2', $stored->implementation_full_name);
        $this->assertSame('P20', $stored->implementation_unit_code);
        $this->assertSame('Phong giai phap 20', $stored->implementation_unit_name);
        $this->assertSame(1, (int) $stored->created_by);
        $this->assertSame(1, (int) $stored->updated_by);
    }

    public function test_it_deletes_project_implementation_unit_snapshot_when_selection_is_cleared(): void
    {
        DB::table('projects')->insert([
            'id' => 10,
            'project_code' => 'DA-IMPL-010',
            'project_name' => 'Du an bo chon don vi trien khai',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'QUARTERLY',
            'status' => 'CHUAN_BI',
            'start_date' => '2026-04-07',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('project_implementation_units')->insert([
            'project_id' => 10,
            'implementation_user_id' => 2,
            'implementation_user_code' => 'USR002',
            'implementation_full_name' => 'Nhan su trien khai 2',
            'implementation_unit_code' => 'P20',
            'implementation_unit_name' => 'Phong giai phap 20',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->putJson('/api/v5/projects/10', [
            'payment_cycle' => 'QUARTERLY',
            'implementation_user_id' => null,
        ])
            ->assertOk()
            ->assertJsonPath('data.id', 10)
            ->assertJsonPath('data.implementation_user_id', null)
            ->assertJsonPath('data.implementation_unit_code', null);

        $this->assertNull(
            DB::table('project_implementation_units')->where('project_id', 10)->first()
        );
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('project_implementation_units');
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 100)->nullable();
            $table->string('user_code', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('password', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('status', 20)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 32)->default('DEPT_ONLY');
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_code', 100)->nullable();
            $table->string('customer_name', 255)->nullable();
            $table->string('company_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 100)->unique();
            $table->string('project_name', 255);
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('opportunity_id')->nullable();
            $table->string('investment_mode', 100)->nullable();
            $table->date('start_date')->nullable();
            $table->date('expected_end_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->string('status', 100)->default('CHUAN_BI');
            $table->text('status_reason')->nullable();
            $table->string('payment_cycle', 20)->nullable();
            $table->string('data_scope', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('project_implementation_units', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('implementation_user_id')->nullable();
            $table->string('implementation_user_code', 100)->nullable();
            $table->string('implementation_full_name', 255)->nullable();
            $table->string('implementation_unit_code', 100)->nullable();
            $table->string('implementation_unit_name', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        DB::table('departments')->insert([
            ['id' => 10, 'dept_code' => 'P10', 'dept_name' => 'Phong giai phap 10', 'deleted_at' => null],
            ['id' => 20, 'dept_code' => 'P20', 'dept_name' => 'Phong giai phap 20', 'deleted_at' => null],
            ['id' => 30, 'dept_code' => 'P30', 'dept_name' => 'Phong giai phap 30', 'deleted_at' => null],
        ]);

        DB::table('internal_users')->insert([
            [
                'id' => 1,
                'username' => 'project-owner',
                'user_code' => 'USR001',
                'full_name' => 'Project Owner',
                'password' => bcrypt('password'),
                'department_id' => 10,
                'status' => 'ACTIVE',
                'deleted_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'username' => 'impl-user-2',
                'user_code' => 'USR002',
                'full_name' => 'Nhan su trien khai 2',
                'password' => bcrypt('password'),
                'department_id' => 20,
                'status' => 'ACTIVE',
                'deleted_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'username' => 'impl-user-3',
                'user_code' => 'USR003',
                'full_name' => 'Nhan su ngoai scope',
                'password' => bcrypt('password'),
                'department_id' => 30,
                'status' => 'ACTIVE',
                'deleted_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('user_dept_scopes')->insert([
            ['user_id' => 1, 'dept_id' => 10, 'scope_type' => 'DEPT_ONLY'],
            ['user_id' => 1, 'dept_id' => 20, 'scope_type' => 'DEPT_ONLY'],
        ]);

        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => '93002',
            'customer_name' => 'Khach hang test',
            'company_name' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
