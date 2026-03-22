<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * P6.11 — Report Service Tests (live-query path, no snapshot dependency)
 *
 * @group reports
 */
class CustomerRequestReportServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->setUpReportSchema();
    }

    protected function tearDown(): void
    {
        $this->dropReportSchema();
        parent::tearDown();
    }

    // ── Schema helpers ────────────────────────────────────────────────────

    private function setUpReportSchema(): void
    {
        $this->dropReportSchema();

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
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
            $table->string('request_code', 30)->nullable();
            $table->string('current_status_code', 50)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->decimal('estimated_hours', 8, 2)->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
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

        // Seed
        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'USR001', 'full_name' => 'Nguyễn Văn A'],
            ['id' => 2, 'user_code' => 'USR002', 'full_name' => 'Trần Thị B'],
        ]);

        DB::table('customers')->insert([
            ['id' => 10, 'customer_name' => 'Khách hàng ABC'],
        ]);

        DB::table('projects')->insert([
            ['id' => 20, 'project_name' => 'Dự án XYZ'],
        ]);

        DB::table('customer_request_cases')->insert([
            ['id' => 101, 'request_code' => 'CRC-202603-0001', 'current_status_code' => 'in_progress', 'customer_id' => 10, 'project_id' => 20, 'estimated_hours' => 10.0, 'received_at' => '2026-03-01 08:00:00', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 102, 'request_code' => 'CRC-202603-0002', 'current_status_code' => 'completed', 'customer_id' => 10, 'project_id' => 20, 'estimated_hours' => 8.0, 'received_at' => '2026-03-05 08:00:00', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Worklogs for 2026-03
        DB::table('customer_request_worklogs')->insert([
            ['request_case_id' => 101, 'performed_by_user_id' => 1, 'activity_type_code' => 'CODING', 'hours_spent' => 4.0, 'is_billable' => 1, 'work_date' => '2026-03-10', 'created_at' => now(), 'updated_at' => now()],
            ['request_case_id' => 101, 'performed_by_user_id' => 1, 'activity_type_code' => 'TESTING', 'hours_spent' => 2.0, 'is_billable' => 1, 'work_date' => '2026-03-11', 'created_at' => now(), 'updated_at' => now()],
            ['request_case_id' => 102, 'performed_by_user_id' => 2, 'activity_type_code' => 'MEETING', 'hours_spent' => 1.5, 'is_billable' => 0, 'work_date' => '2026-03-12', 'created_at' => now(), 'updated_at' => now()],
            ['request_case_id' => 102, 'performed_by_user_id' => 2, 'activity_type_code' => 'CODING', 'hours_spent' => 6.0, 'is_billable' => 1, 'work_date' => '2026-03-15', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function dropReportSchema(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('customer_request_worklogs');
        Schema::dropIfExists('customer_request_cases');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::enableForeignKeyConstraints();
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    public function test_monthly_hours_by_user_returns_data(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/monthly-hours?month=2026-03&group_by=user')
            ->assertOk();

        $data = $response->json('data');
        $meta = $response->json('meta');

        $this->assertNotEmpty($data);
        $this->assertSame('2026-03', $meta['month']);
        $this->assertSame('user', $meta['group_by']);

        // User 1: 6h total, both billable
        $user1Row = collect($data)->firstWhere('user_id', 1);
        $this->assertNotNull($user1Row);
        $this->assertSame(6.0, (float) $user1Row['total_hours']);
        $this->assertSame(6.0, (float) $user1Row['billable_hours']);
        $this->assertSame(0.0, (float) $user1Row['non_billable_hours']);

        // User 2: 7.5h total (1.5 non-bill + 6 bill)
        $user2Row = collect($data)->firstWhere('user_id', 2);
        $this->assertNotNull($user2Row);
        $this->assertSame(7.5, (float) $user2Row['total_hours']);
        $this->assertSame(6.0, (float) $user2Row['billable_hours']);
        $this->assertSame(1.5, (float) $user2Row['non_billable_hours']);
    }

    public function test_monthly_hours_by_project_groups_correctly(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/monthly-hours?month=2026-03&group_by=project')
            ->assertOk();

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        // All worklogs belong to project_id=20
        $projectRow = collect($data)->firstWhere('project_id', 20);
        $this->assertNotNull($projectRow);
        $this->assertSame(13.5, (float) $projectRow['total_hours']); // 4+2+1.5+6
    }

    public function test_monthly_hours_returns_empty_for_future_month(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/monthly-hours?month=2030-01')
            ->assertOk();

        $this->assertEmpty($response->json('data'));
    }

    public function test_weekly_hours_returns_week_structure(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/weekly-hours?user_id=1&from=2026-03-01&to=2026-03-31')
            ->assertOk();

        $data = $response->json('data');
        $this->assertNotEmpty($data);

        $user1 = collect($data)->firstWhere('user_id', 1);
        $this->assertNotNull($user1);
        $this->assertArrayHasKey('weeks', $user1);
        $this->assertNotEmpty($user1['weeks']);
    }

    public function test_trend_returns_month_rows(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/trend?months=3')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(3, $data);

        // Each row should have expected keys
        foreach ($data as $row) {
            $this->assertArrayHasKey('month', $row);
            $this->assertArrayHasKey('total_hours', $row);
            $this->assertArrayHasKey('billable_percent', $row);
            $this->assertArrayHasKey('est_accuracy', $row);
            $this->assertArrayHasKey('backlog_count', $row);
        }
    }

    public function test_pain_points_returns_seven_categories(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/pain-points?month=2026-03')
            ->assertOk();

        $data = $response->json('data');
        $this->assertArrayHasKey('overloaded_users', $data);
        $this->assertArrayHasKey('low_billable_users', $data);
        $this->assertArrayHasKey('estimate_variance', $data);
        $this->assertArrayHasKey('long_running_cases', $data);
        $this->assertArrayHasKey('status_stuck', $data);
        $this->assertArrayHasKey('meeting_heavy', $data);
        $this->assertArrayHasKey('top_customer_load', $data);
    }

    public function test_pain_points_detects_meeting_heavy_user(): void
    {
        // User 2 has 1.5h MEETING / 7.5h total = 20% > 15% threshold
        $response = $this->getJson('/api/v5/customer-request-cases/reports/pain-points?month=2026-03')
            ->assertOk();

        $meetingHeavy = $response->json('data.meeting_heavy');
        $user2 = collect($meetingHeavy)->firstWhere('user_id', 2);
        $this->assertNotNull($user2, 'User 2 should be flagged as meeting-heavy (20% MEETING hours)');
    }

    public function test_pain_points_detects_long_running_case(): void
    {
        // Case 101 is in_progress since 2026-03-01 — more than 14 days
        $response = $this->getJson('/api/v5/customer-request-cases/reports/pain-points?month=2026-03')
            ->assertOk();

        $longRunning = $response->json('data.long_running_cases');
        $case101 = collect($longRunning)->firstWhere('id', 101);
        $this->assertNotNull($case101, 'Case 101 should be flagged as long-running');
    }

    public function test_pain_points_top_customer_load_shows_customer(): void
    {
        $response = $this->getJson('/api/v5/customer-request-cases/reports/pain-points?month=2026-03')
            ->assertOk();

        $topCustomer = $response->json('data.top_customer_load');
        $this->assertNotEmpty($topCustomer);
        $this->assertArrayHasKey('customer_id', $topCustomer[0]);
        $this->assertArrayHasKey('total_hours', $topCustomer[0]);
    }
}
