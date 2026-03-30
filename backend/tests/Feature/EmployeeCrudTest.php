<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmployeeCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_lists_updates_resets_and_deletes_employees_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/internal-users', [
            'username' => 'nguyenvana',
            'user_code' => 'VNPT000001',
            'full_name' => 'Nguyen Van A',
            'email' => 'a@example.com',
            'department_id' => 1,
            'position_id' => 1,
            'phone_number' => '0909000001',
            'status' => 'ACTIVE',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.user_code', 'VNPT000001')
            ->assertJsonPath('data.employee_code', 'VNPT000001')
            ->assertJsonPath('data.full_name', 'Nguyen Van A')
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.phone_number', '0909000001')
            ->assertJsonStructure([
                'provisioning' => ['temporary_password', 'must_change_password', 'delivery'],
            ]);

        $listResponse = $this->getJson('/api/v5/employees?search=Nguyen');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.employee_code', 'VNPT000001')
            ->assertJsonPath('data.0.department.dept_code', 'BGDVT');

        $updateResponse = $this->putJson('/api/v5/employees/1', [
            'full_name' => 'Nguyen Van B',
            'status' => 'TRANSFERRED',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Nguyen Van B')
            ->assertJsonPath('data.status', 'SUSPENDED');

        $resetResponse = $this->postJson('/api/v5/employees/1/reset-password');

        $resetResponse
            ->assertOk()
            ->assertJsonPath('data.id', 1)
            ->assertJsonStructure([
                'provisioning' => ['temporary_password', 'must_change_password', 'delivery'],
            ]);

        $deleteResponse = $this->deleteJson('/api/v5/internal-users/1');
        $deleteResponse
            ->assertOk()
            ->assertJsonPath('message', 'Employee deleted.');

        $finalListResponse = $this->getJson('/api/v5/internal-users');
        $finalListResponse
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_it_bulk_creates_employees_via_alias_route(): void
    {
        $bulkResponse = $this->postJson('/api/v5/employees/bulk', [
            'items' => [
                [
                    'username' => 'employee01',
                    'user_code' => 'VNPT000002',
                    'full_name' => 'Employee 01',
                    'email' => 'employee01@example.com',
                    'department_id' => 1,
                ],
                [
                    'username' => 'employee02',
                    'user_code' => 'VNPT000003',
                    'full_name' => 'Employee 02',
                    'email' => 'employee02@example.com',
                    'department_id' => 1,
                ],
            ],
        ]);

        $bulkResponse
            ->assertCreated()
            ->assertJsonPath('data.created_count', 2)
            ->assertJsonPath('data.failed_count', 0)
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.1.success', true)
            ->assertJsonPath('data.created.1.employee_code', 'VNPT000003');
    }

    public function test_it_filters_employees_by_email_department_and_status(): void
    {
        DB::table('internal_users')->insert([
            [
                'id' => 1,
                'uuid' => 'emp-1',
                'username' => 'alpha.active',
                'user_code' => 'VNPT100001',
                'full_name' => 'Alpha Active',
                'email' => 'alpha.active@vnpt.vn',
                'department_id' => 1,
                'position_id' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'emp-2',
                'username' => 'alpha.otherdept',
                'user_code' => 'VNPT100002',
                'full_name' => 'Alpha Other Dept',
                'email' => 'alpha.otherdept@vnpt.vn',
                'department_id' => 2,
                'position_id' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'uuid' => 'emp-3',
                'username' => 'beta.inactive',
                'user_code' => 'VNPT100003',
                'full_name' => 'Beta Inactive',
                'email' => 'beta.inactive@vnpt.vn',
                'department_id' => 1,
                'position_id' => 1,
                'status' => 'INACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->getJson('/api/v5/internal-users?filters[email]=alpha&filters[department_id]=1&filters[status]=ACTIVE');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.0.email', 'alpha.active@vnpt.vn')
            ->assertJsonPath('data.0.status', 'ACTIVE')
            ->assertJsonPath('data.0.department.id', 1);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('positions');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 100);
            $table->string('dept_name', 255);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('positions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('pos_code', 50)->nullable();
            $table->string('pos_name', 120)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('uuid', 100)->nullable();
            $table->string('username', 100)->unique();
            $table->string('user_code', 100)->unique();
            $table->string('full_name', 255);
            $table->string('email', 255)->unique();
            $table->string('password', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('job_title_raw', 255)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('phone_number', 50)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('mobile', 50)->nullable();
            $table->string('status', 20)->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('vpn_status', 20)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('data_scope', 255)->nullable();
            $table->boolean('must_change_password')->nullable();
            $table->timestamp('password_reset_required_at')->nullable();
            $table->timestamp('password_changed_at')->nullable();
            $table->rememberToken();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('departments')->insert([
            [
                'id' => 1,
                'dept_code' => 'BGDVT',
                'dept_name' => 'Ban giam doc',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'dept_code' => 'PGP2',
                'dept_name' => 'Phong giai phap 2',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('positions')->insert([
            'id' => 1,
            'pos_code' => 'POS005',
            'pos_name' => 'Chuyen vien',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
