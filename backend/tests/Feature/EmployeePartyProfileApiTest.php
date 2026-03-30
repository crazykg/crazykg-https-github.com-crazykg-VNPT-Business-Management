<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmployeePartyProfileApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_upserts_lists_and_bulk_imports_party_profiles(): void
    {
        $createResponse = $this->putJson('/api/v5/internal-users/1/party-profile', [
            'ethnicity' => 'Kinh',
            'religion' => 'Khong',
            'hometown' => 'Nam Dinh',
            'professional_qualification' => 'Ky su CNTT',
            'political_theory_level' => 'Trung cap',
            'party_card_number' => 'DV0001',
            'notes' => 'Ho so dau tien',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.employee_id', 1)
            ->assertJsonPath('data.employee.user_code', 'VNPT000001')
            ->assertJsonPath('data.profile_quality.missing_card_number', false);

        $listResponse = $this->getJson('/api/v5/employee-party-profiles');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.kpis.total_party_members', 1)
            ->assertJsonPath('meta.kpis.missing_party_card_number_count', 0)
            ->assertJsonPath('data.0.employee.department.dept_code', 'BGDVT');

        $showResponse = $this->getJson('/api/v5/internal-users/1/party-profile');
        $showResponse
            ->assertOk()
            ->assertJsonPath('data.party_card_number', 'DV0001')
            ->assertJsonPath('employee.full_name', 'Nguyen Van A');

        $updateResponse = $this->putJson('/api/v5/internal-users/1/party-profile', [
            'party_card_number' => 'DV0001',
            'hometown' => 'Ha Noi',
            'notes' => 'Da cap nhat ghi chu',
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.hometown', 'Ha Noi')
            ->assertJsonPath('data.notes', 'Da cap nhat ghi chu');

        $bulkResponse = $this->postJson('/api/v5/employee-party-profiles/bulk-upsert', [
            'items' => [
                [
                    'employee_code' => 'VNPT000002',
                    'hometown' => 'Hai Phong',
                ],
                [
                    'employee_code' => 'VNPT999999',
                    'hometown' => 'Unknown',
                ],
            ],
        ]);

        $bulkResponse
            ->assertStatus(200)
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.failed_count', 1)
            ->assertJsonPath('data.results.0.success', true)
            ->assertJsonPath('data.results.1.success', false);

        $missingCardFilter = $this->getJson('/api/v5/employee-party-profiles?filters[missing_info]=CARD_NUMBER');
        $missingCardFilter
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.employee.user_code', 'VNPT000002');
    }

    public function test_it_allows_saving_descriptive_fields_without_party_status_or_dates(): void
    {
        $response = $this->putJson('/api/v5/internal-users/1/party-profile', [
            'hometown' => 'Can Tho',
            'notes' => 'Chi luu thong tin mo ta',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.hometown', 'Can Tho')
            ->assertJsonPath('data.notes', 'Chi luu thong tin mo ta');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('employee_party_profiles');
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
            $table->rememberToken();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('employee_party_profiles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('employee_id')->unique();
            $table->string('ethnicity', 120)->nullable();
            $table->string('religion', 120)->nullable();
            $table->string('hometown', 255)->nullable();
            $table->string('professional_qualification', 255)->nullable();
            $table->string('political_theory_level', 255)->nullable();
            $table->string('party_card_number', 120)->nullable()->unique();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
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

        DB::table('internal_users')->insert([
            [
                'id' => 1,
                'uuid' => 'emp-1',
                'username' => 'nguyenvana',
                'user_code' => 'VNPT000001',
                'full_name' => 'Nguyen Van A',
                'email' => 'a@example.com',
                'department_id' => 1,
                'position_id' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'uuid' => 'emp-2',
                'username' => 'tranthib',
                'user_code' => 'VNPT000002',
                'full_name' => 'Tran Thi B',
                'email' => 'b@example.com',
                'department_id' => 2,
                'position_id' => 1,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
