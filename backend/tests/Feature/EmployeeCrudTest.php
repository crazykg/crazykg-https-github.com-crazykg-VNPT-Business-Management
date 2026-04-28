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
            'gmail' => 'nguyenvana@gmail.com',
            'department_id' => 1,
            'position_id' => 1,
            'phone_number' => '0909000001',
            'telechatbot' => '123456789',
            'status' => 'ACTIVE',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.id', 1)
            ->assertJsonPath('data.user_code', 'VNPT000001')
            ->assertJsonPath('data.employee_code', 'VNPT000001')
            ->assertJsonPath('data.full_name', 'Nguyen Van A')
            ->assertJsonPath('data.email', 'a@example.com')
            ->assertJsonPath('data.gmail', 'nguyenvana@gmail.com')
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.phone_number', '0909000001')
            ->assertJsonPath('data.telechatbot', '123456789')
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
            'user_code' => 'VNPT000009',
            'gmail' => 'nguyenvanb@gmail.com',
            'telechatbot' => '-10099887766',
            'status' => 'TRANSFERRED',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Nguyen Van B')
            ->assertJsonPath('data.user_code', 'VNPT000009')
            ->assertJsonPath('data.employee_code', 'VNPT000009')
            ->assertJsonPath('data.gmail', 'nguyenvanb@gmail.com')
            ->assertJsonPath('data.telechatbot', '-10099887766')
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
                    'gmail' => 'employee01@gmail.com',
                    'department_id' => 1,
                ],
                [
                    'username' => 'employee02',
                    'user_code' => 'VNPT000003',
                    'full_name' => 'Employee 02',
                    'email' => 'employee02@example.com',
                    'gmail' => 'employee02@gmail.com',
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
            ->assertJsonPath('data.created.0.gmail', 'employee01@gmail.com')
            ->assertJsonPath('data.created.1.employee_code', 'VNPT000003');
    }

    public function test_it_bulk_imports_minimal_employee_row_by_employee_code(): void
    {
        $response = $this->postJson('/api/v5/employees/bulk', [
            'items' => [
                [
                    'user_code' => 'VNPT000010',
                    'full_name' => 'Imported Employee',
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.updated_count', 0)
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.0.operation', 'created')
            ->assertJsonPath('data.results.0.data.user_code', 'VNPT000010')
            ->assertJsonPath('data.results.0.data.employee_code', 'VNPT000010')
            ->assertJsonPath('data.results.0.data.username', 'vnpt000010')
            ->assertJsonPath('data.results.0.data.full_name', 'Imported Employee')
            ->assertJsonPath('data.results.0.data.email', 'vnpt000010@import.local')
            ->assertJsonPath('data.results.0.data.gmail', null)
            ->assertJsonPath('data.results.0.data.department.id', 1);

        $this->assertDatabaseHas('internal_users', [
            'user_code' => 'VNPT000010',
            'username' => 'vnpt000010',
            'full_name' => 'Imported Employee',
            'email' => 'vnpt000010@import.local',
            'department_id' => 1,
        ]);
    }

    public function test_it_bulk_import_updates_only_supplied_fields_when_employee_code_exists(): void
    {
        DB::table('internal_users')->insert([
            'id' => 1,
            'uuid' => 'emp-1',
            'username' => 'alpha.active',
            'user_code' => 'VNPT100001',
            'full_name' => 'Alpha Active',
            'email' => 'alpha.active@vnpt.vn',
            'gmail' => 'alpha.active@gmail.com',
            'department_id' => 1,
            'position_id' => 1,
            'status' => 'ACTIVE',
            'phone_number' => '0909000001',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/v5/employees/bulk', [
            'items' => [
                [
                    'user_code' => 'VNPT100001',
                    'full_name' => 'Alpha Updated',
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.created_count', 0)
            ->assertJsonPath('data.updated_count', 1)
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.0.operation', 'updated')
            ->assertJsonPath('data.results.0.data.user_code', 'VNPT100001')
            ->assertJsonPath('data.results.0.data.full_name', 'Alpha Updated')
            ->assertJsonPath('data.results.0.data.email', 'alpha.active@vnpt.vn')
            ->assertJsonPath('data.results.0.data.gmail', 'alpha.active@gmail.com')
            ->assertJsonPath('data.results.0.data.status', 'ACTIVE');

        $this->assertDatabaseHas('internal_users', [
            'id' => 1,
            'user_code' => 'VNPT100001',
            'username' => 'alpha.active',
            'full_name' => 'Alpha Updated',
            'email' => 'alpha.active@vnpt.vn',
            'gmail' => 'alpha.active@gmail.com',
            'department_id' => 1,
            'phone_number' => '0909000001',
            'status' => 'ACTIVE',
        ]);
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
                'gmail' => 'alpha.active@gmail.com',
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
                'gmail' => 'alpha.otherdept@gmail.com',
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
                'gmail' => 'beta.inactive@gmail.com',
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
            ->assertJsonPath('data.0.gmail', 'alpha.active@gmail.com')
            ->assertJsonPath('data.0.status', 'ACTIVE')
            ->assertJsonPath('data.0.department.id', 1);
    }

    public function test_it_requires_gmail_domain_when_gmail_is_supplied(): void
    {
        $response = $this->postJson('/api/v5/internal-users', [
            'username' => 'gmail.invalid',
            'user_code' => 'VNPT000012',
            'full_name' => 'Gmail Invalid',
            'email' => 'gmail.invalid@example.com',
            'gmail' => 'gmail.invalid@yahoo.com',
            'department_id' => 1,
            'status' => 'ACTIVE',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('gmail');
    }

    public function test_it_requires_leave_date_when_marking_employee_as_inactive(): void
    {
        $response = $this->postJson('/api/v5/internal-users', [
            'username' => 'inactive.employee',
            'user_code' => 'VNPT000011',
            'full_name' => 'Inactive Employee',
            'email' => 'inactive.employee@example.com',
            'department_id' => 1,
            'status' => 'INACTIVE',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ngày nghỉ việc là bắt buộc khi chọn trạng thái Nghỉ việc.')
            ->assertJsonPath('errors.leave_date.0', 'Ngày nghỉ việc là bắt buộc khi chọn trạng thái Nghỉ việc.');
    }

    public function test_it_persists_leave_date_for_inactive_employee(): void
    {
        DB::table('internal_users')->insert([
            'id' => 1,
            'uuid' => 'emp-1',
            'username' => 'employee.inactive',
            'user_code' => 'VNPT100020',
            'full_name' => 'Employee Inactive',
            'email' => 'employee.inactive@example.com',
            'department_id' => 1,
            'position_id' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->putJson('/api/v5/employees/1', [
            'status' => 'INACTIVE',
            'leave_date' => '2026-04-07',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.status', 'INACTIVE')
            ->assertJsonPath('data.leave_date', '2026-04-07');

        $this->assertDatabaseHas('internal_users', [
            'id' => 1,
            'status' => 'INACTIVE',
            'leave_date' => '2026-04-07',
        ]);
    }

    public function test_it_blocks_employee_delete_when_related_data_exists(): void
    {
        DB::table('internal_users')->insert([
            'id' => 1,
            'uuid' => 'emp-1',
            'username' => 'blocked.employee',
            'user_code' => 'VNPT100010',
            'full_name' => 'Blocked Employee',
            'email' => 'blocked.employee@example.com',
            'department_id' => 1,
            'position_id' => 1,
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'id' => 1,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson('/api/v5/internal-users/1');

        $response
            ->assertStatus(422)
            ->assertJsonPath('message', 'Nhân sự đã phát sinh dữ liệu liên quan tại nhật ký hệ thống nên không thể xóa.');

        $this->assertDatabaseHas('internal_users', [
            'id' => 1,
            'user_code' => 'VNPT100010',
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
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
            $table->string('gmail', 255)->nullable();
            $table->string('password', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('position_id')->nullable();
            $table->string('job_title_raw', 255)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->date('leave_date')->nullable();
            $table->string('phone_number', 50)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('mobile', 50)->nullable();
            $table->string('telechatbot', 255)->nullable();
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

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('created_by')->nullable();
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
