<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectSpecialStatusCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    public function test_it_requires_a_reason_for_special_project_statuses(): void
    {
        $this->postJson('/api/v5/projects', [
            'project_code' => 'DA-TN-001',
            'project_name' => 'Du an tam ngung',
            'status' => 'TAM_NGUNG',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'MONTHLY',
            'start_date' => '2026-03-24',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status_reason']);
    }

    public function test_it_creates_and_serializes_a_special_status_reason(): void
    {
        $this->postJson('/api/v5/projects', [
            'project_code' => 'DA-TN-002',
            'project_name' => 'Du an cho phe duyet',
            'status' => 'TAM_NGUNG',
            'status_reason' => 'Cho phe duyet bo sung ngan sach.',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'MONTHLY',
            'start_date' => '2026-03-24',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'TAM_NGUNG')
            ->assertJsonPath('data.status_reason', 'Cho phe duyet bo sung ngan sach.');

        $this->getJson('/api/v5/projects')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'TAM_NGUNG')
            ->assertJsonPath('data.0.status_reason', 'Cho phe duyet bo sung ngan sach.');

        $this->assertSame(
            'Cho phe duyet bo sung ngan sach.',
            DB::table('projects')->where('project_code', 'DA-TN-002')->value('status_reason')
        );
    }

    public function test_it_clears_status_reason_when_project_leaves_special_status(): void
    {
        DB::table('projects')->insert([
            'id' => 100,
            'project_code' => 'DA-HUY-100',
            'project_name' => 'Du an huy',
            'customer_id' => null,
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'MONTHLY',
            'start_date' => '2026-03-24',
            'expected_end_date' => null,
            'actual_end_date' => null,
            'status' => 'HUY',
            'status_reason' => 'Khach hang dung trien khai.',
            'created_by' => 1,
            'updated_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $this->putJson('/api/v5/projects/100', [
            'status' => 'THUC_HIEN_DAU_TU',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'THUC_HIEN_DAU_TU')
            ->assertJsonPath('data.status_reason', null);

        $this->assertNull(DB::table('projects')->where('id', 100)->value('status_reason'));
    }

    public function test_it_keeps_phase_codes_in_varchar_schema_without_mapping_back_to_legacy_statuses(): void
    {
        $this->postJson('/api/v5/projects', [
            'project_code' => 'DA-PHASE-001',
            'project_name' => 'Du an phase',
            'status' => 'CHUAN_BI_DAU_TU',
            'investment_mode' => 'DAU_TU',
            'payment_cycle' => 'MONTHLY',
            'start_date' => '2026-03-24',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'CHUAN_BI_DAU_TU')
            ->assertJsonPath('data.status_reason', null);

        $this->assertSame(
            'CHUAN_BI_DAU_TU',
            DB::table('projects')->where('project_code', 'DA-PHASE-001')->value('status')
        );
    }

    private function setUpSchema(): void
    {
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
            $table->string('payment_cycle', 50)->nullable();
            $table->date('start_date')->nullable();
            $table->date('expected_end_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->string('status', 100)->default('CHUAN_BI');
            $table->text('status_reason')->nullable();
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
