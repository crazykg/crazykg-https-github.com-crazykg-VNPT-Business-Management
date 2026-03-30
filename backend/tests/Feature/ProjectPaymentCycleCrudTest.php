<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectPaymentCycleCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_updates_project_payment_cycle_with_canonical_code(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => '93007',
            'customer_name' => 'Benh vien San - Nhi Hau Giang',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 3,
            'project_code' => 'DA003',
            'project_name' => 'Du an Giai phap VNPT HIS',
            'customer_id' => 1,
            'investment_mode' => 'DAU_TU',
            'start_date' => '2026-02-25',
            'expected_end_date' => '2026-11-25',
            'actual_end_date' => null,
            'status' => 'CHUAN_BI',
            'status_reason' => null,
            'payment_cycle' => null,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/projects/3', [
            'payment_cycle' => 'QUARTERLY',
            'investment_mode' => 'DAU_TU',
        ])
            ->assertOk()
            ->assertJsonPath('data.id', 3)
            ->assertJsonPath('data.investment_mode', 'DAU_TU')
            ->assertJsonPath('data.payment_cycle', 'QUARTERLY');

        $this->assertSame('QUARTERLY', DB::table('projects')->where('id', 3)->value('payment_cycle'));
    }

    public function test_it_requires_payment_cycle_for_available_rental_projects(): void
    {
        DB::table('customers')->insert([
            'id' => 1,
            'customer_code' => '93007',
            'customer_name' => 'Benh vien San - Nhi Hau Giang',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 4,
            'project_code' => 'DA004',
            'project_name' => 'Du an thue dich vu co san',
            'customer_id' => 1,
            'investment_mode' => 'THUE_DICH_VU_COSAN',
            'start_date' => '2026-02-25',
            'expected_end_date' => '2026-11-25',
            'actual_end_date' => null,
            'status' => 'CHUAN_BI',
            'status_reason' => null,
            'payment_cycle' => null,
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/projects/4', [
            'investment_mode' => 'THUE_DICH_VU_COSAN',
            'payment_cycle' => null,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'payment_cycle is required for the selected investment_mode.')
            ->assertJsonPath('errors.payment_cycle.0', 'Chu kỳ thanh toán là bắt buộc với loại dự án đã chọn.');
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('username', 100)->unique();
            $table->string('user_code', 100)->unique();
            $table->string('full_name', 255);
            $table->string('password', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('status', 20)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
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

        DB::table('internal_users')->insert([
            'id' => 1,
            'username' => 'project-owner',
            'user_code' => 'USR001',
            'full_name' => 'Project Owner',
            'password' => bcrypt('password'),
            'department_id' => 10,
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
