<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WorkloadSummaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpSchema();
        $this->actingAs(InternalUser::query()->findOrFail(1));
    }

    protected function tearDown(): void
    {
        $this->dropSchema();
        parent::tearDown();
    }

    public function test_summary_combines_crc_and_project_workload_hours(): void
    {
        $response = $this->getJson('/api/v5/workload/summary?from=2026-04-01&to=2026-04-07')
            ->assertOk();

        $this->assertSame(8.5, (float) $response->json('data.kpis.total_hours'));
        $this->assertSame(2, (int) $response->json('data.kpis.user_count'));

        $bySource = collect($response->json('data.by_source'));
        $this->assertSame(5.5, (float) $bySource->firstWhere('source', 'crc')['total_hours']);
        $this->assertSame(3.0, (float) $bySource->firstWhere('source', 'project')['total_hours']);
    }

    public function test_weekly_alerts_include_text_status_for_overload(): void
    {
        $response = $this->getJson('/api/v5/workload/weekly-alerts?from=2026-04-01&to=2026-04-07')
            ->assertOk();

        $alerts = collect($response->json('data'));
        $this->assertTrue($alerts->contains(fn (array $row): bool => in_array($row['label'], ['Vuot chuan ngay', 'Thieu ghi gio'], true)));
        $this->assertTrue($alerts->every(fn (array $row): bool => isset($row['label'], $row['severity'])));
    }

    public function test_entries_endpoint_filters_by_source(): void
    {
        $response = $this->getJson('/api/v5/workload/entries?from=2026-04-01&to=2026-04-07&source=project')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('project', $data[0]['source']);
        $this->assertSame(3.0, (float) $data[0]['hours_spent']);
    }

    public function test_planned_actual_uses_customer_request_plan_items(): void
    {
        Schema::create('customer_request_plan_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('plan_id')->nullable();
            $table->unsignedBigInteger('request_case_id')->nullable();
            $table->unsignedBigInteger('performer_user_id');
            $table->decimal('planned_hours', 8, 2)->default(0);
            $table->date('planned_start_date')->nullable();
            $table->date('planned_end_date')->nullable();
            $table->timestamps();
        });

        DB::table('customer_request_plan_items')->insert([
            'plan_id' => 10,
            'request_case_id' => 100,
            'performer_user_id' => 1,
            'planned_hours' => 6,
            'planned_start_date' => '2026-04-01',
            'planned_end_date' => '2026-04-07',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v5/workload/planned-actual?from=2026-04-01&to=2026-04-07')
            ->assertOk();

        $this->assertSame(6.0, (float) $response->json('data.totals.planned_hours'));
        $this->assertSame(8.5, (float) $response->json('data.totals.actual_hours'));
        $this->assertSame(2.5, (float) $response->json('data.totals.variance_hours'));
    }

    public function test_export_returns_csv(): void
    {
        $response = $this->get('/api/v5/workload/export?from=2026-04-01&to=2026-04-07');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('CRC', $response->getContent());
    }

    private function setUpSchema(): void
    {
        $this->dropSchema();

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('password', 255)->nullable();
            $table->string('status', 50)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamps();
        });

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_name', 255)->nullable();
        });

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->timestamps();
        });

        Schema::create('customer_request_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id');
            $table->unsignedBigInteger('performed_by_user_id')->nullable();
            $table->string('activity_type_code', 30)->nullable();
            $table->decimal('hours_spent', 8, 2)->default(0);
            $table->boolean('is_billable')->default(true);
            $table->date('work_date')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedures', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('procedure_name', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_step_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id')->nullable();
            $table->text('content')->nullable();
            $table->timestamps();
        });

        Schema::create('shared_timesheets', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_step_worklog_id')->nullable();
            $table->unsignedBigInteger('performed_by_user_id')->nullable();
            $table->decimal('hours_spent', 8, 2)->default(0);
            $table->date('work_date');
            $table->text('activity_description')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('monthly_calendars', function (Blueprint $table): void {
            $table->date('date')->primary();
            $table->boolean('is_working_day')->default(true);
        });

        DB::table('departments')->insert([
            ['id' => 10, 'dept_code' => 'PKT', 'dept_name' => 'Phong Ky thuat'],
        ]);
        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'U001', 'username' => 'a', 'full_name' => 'Nguyen Van A', 'email' => 'a@example.test', 'department_id' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'user_code' => 'U002', 'username' => 'b', 'full_name' => 'Tran Thi B', 'email' => 'b@example.test', 'department_id' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('customers')->insert([['id' => 30, 'customer_name' => 'Khach hang ABC']]);
        DB::table('projects')->insert([['id' => 20, 'project_name' => 'Du an XYZ']]);
        DB::table('customer_request_cases')->insert([
            ['id' => 100, 'request_code' => 'CRC-100', 'customer_id' => 30, 'project_id' => 20, 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('customer_request_worklogs')->insert([
            ['request_case_id' => 100, 'performed_by_user_id' => 1, 'activity_type_code' => 'CODING', 'hours_spent' => 2.5, 'is_billable' => 1, 'work_date' => '2026-04-01', 'created_at' => now(), 'updated_at' => now()],
            ['request_case_id' => 100, 'performed_by_user_id' => 2, 'activity_type_code' => 'TEST', 'hours_spent' => 3.0, 'is_billable' => 1, 'work_date' => '2026-04-02', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('project_procedures')->insert([
            ['id' => 200, 'project_id' => 20, 'procedure_name' => 'Thu tuc du an', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('project_procedure_step_worklogs')->insert([
            ['id' => 300, 'procedure_id' => 200, 'content' => 'Lam thu tuc', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('shared_timesheets')->insert([
            ['procedure_step_worklog_id' => 300, 'performed_by_user_id' => 1, 'hours_spent' => 3.0, 'work_date' => '2026-04-01', 'activity_description' => 'Cau hinh he thong', 'created_by' => 1, 'updated_by' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
        foreach (range(1, 7) as $day) {
            DB::table('monthly_calendars')->insert([
                'date' => sprintf('2026-04-%02d', $day),
                'is_working_day' => $day <= 5,
            ]);
        }
    }

    private function dropSchema(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_request_plan_items');
        Schema::dropIfExists('monthly_calendars');
        Schema::dropIfExists('shared_timesheets');
        Schema::dropIfExists('project_procedure_step_worklogs');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('customer_request_worklogs');
        Schema::dropIfExists('customer_request_cases');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('departments');
        Schema::enableForeignKeyConstraints();
    }
}
