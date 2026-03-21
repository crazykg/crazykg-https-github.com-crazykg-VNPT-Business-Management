<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestCaseMetricsBackfillCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        $this->dropSchema();

        parent::tearDown();
    }

    public function test_command_backfills_hours_estimate_and_performer_from_status_row(): void
    {
        DB::table('customer_request_cases')->insert([
            'id' => 1,
            'request_code' => 'CRC-001',
            'current_status_instance_id' => 101,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_status_instances')->insert([
            'id' => 101,
            'request_case_id' => 1,
            'status_table' => 'customer_request_in_progress',
            'status_row_id' => 201,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_in_progress')->insert([
            'id' => 201,
            'performer_user_id' => 7,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_worklogs')->insert([
            [
                'id' => 301,
                'request_case_id' => 1,
                'performed_by_user_id' => 9,
                'hours_spent' => 1.50,
                'work_ended_at' => '2026-03-21 08:30:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 302,
                'request_case_id' => 1,
                'performed_by_user_id' => 9,
                'hours_spent' => 2.00,
                'work_ended_at' => '2026-03-21 10:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customer_request_estimates')->insert([
            [
                'id' => 401,
                'request_case_id' => 1,
                'estimated_hours' => 4.50,
                'estimated_by_user_id' => 2,
                'estimated_at' => '2026-03-20 09:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 402,
                'request_case_id' => 1,
                'estimated_hours' => 6.00,
                'estimated_by_user_id' => 3,
                'estimated_at' => '2026-03-21 11:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->artisan('customer-request-cases:backfill-metrics')
            ->assertSuccessful();

        $case = DB::table('customer_request_cases')->where('id', 1)->first();

        $this->assertNotNull($case);
        $this->assertSame('3.50', number_format((float) $case->total_hours_spent, 2, '.', ''));
        $this->assertSame(7, (int) $case->performer_user_id);
        $this->assertSame('6.00', number_format((float) $case->estimated_hours, 2, '.', ''));
        $this->assertSame(3, (int) $case->estimated_by_user_id);
        $this->assertSame('2026-03-21 11:00:00', (string) $case->estimated_at);
    }

    public function test_command_falls_back_to_latest_worklog_performer_and_is_safe_to_rerun(): void
    {
        DB::table('customer_request_cases')->insert([
            'id' => 2,
            'request_code' => 'CRC-002',
            'current_status_instance_id' => 102,
            'total_hours_spent' => 99,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_status_instances')->insert([
            'id' => 102,
            'request_case_id' => 2,
            'status_table' => 'customer_request_completed',
            'status_row_id' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('customer_request_worklogs')->insert([
            [
                'id' => 303,
                'request_case_id' => 2,
                'performed_by_user_id' => 11,
                'hours_spent' => 1.00,
                'work_ended_at' => '2026-03-21 09:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 304,
                'request_case_id' => 2,
                'performed_by_user_id' => 12,
                'hours_spent' => 2.00,
                'work_ended_at' => '2026-03-21 11:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->artisan('customer-request-cases:backfill-metrics')
            ->assertSuccessful();

        $this->artisan('customer-request-cases:backfill-metrics')
            ->assertSuccessful();

        $case = DB::table('customer_request_cases')->where('id', 2)->first();

        $this->assertNotNull($case);
        $this->assertSame('3.00', number_format((float) $case->total_hours_spent, 2, '.', ''));
        $this->assertSame(12, (int) $case->performer_user_id);
        $this->assertNull($case->estimated_hours);
        $this->assertNull($case->estimated_by_user_id);
        $this->assertNull($case->estimated_at);
    }

    private function setUpSchema(): void
    {
        $this->dropSchema();

        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code');
            $table->unsignedBigInteger('current_status_instance_id')->nullable();
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->decimal('estimated_hours', 8, 2)->nullable();
            $table->unsignedBigInteger('estimated_by_user_id')->nullable();
            $table->dateTime('estimated_at')->nullable();
            $table->decimal('total_hours_spent', 8, 2)->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customer_request_status_instances', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->nullable();
            $table->string('status_table', 120)->nullable();
            $table->unsignedBigInteger('status_row_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_request_in_progress', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('performer_user_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_request_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->nullable();
            $table->unsignedBigInteger('performed_by_user_id')->nullable();
            $table->decimal('hours_spent', 8, 2)->nullable();
            $table->dateTime('work_ended_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('customer_request_estimates', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->nullable();
            $table->decimal('estimated_hours', 8, 2)->nullable();
            $table->unsignedBigInteger('estimated_by_user_id')->nullable();
            $table->dateTime('estimated_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    private function dropSchema(): void
    {
        Schema::dropIfExists('customer_request_estimates');
        Schema::dropIfExists('customer_request_worklogs');
        Schema::dropIfExists('customer_request_in_progress');
        Schema::dropIfExists('customer_request_status_instances');
        Schema::dropIfExists('customer_request_cases');
    }
}
