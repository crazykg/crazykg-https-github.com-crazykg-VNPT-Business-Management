<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DepartmentWeeklyScheduleCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_create_department_weekly_schedule_accepts_hybrid_participants(): void
    {
        $response = $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'created_by' => 1,
            'updated_by' => 1,
            'entries' => [
                [
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'sort_order' => 10,
                    'work_content' => 'Huong dan nhap lieu tai truong Chinh tri Can Tho',
                    'location' => 'Truong Chinh tri Can Tho',
                    'participants' => [
                        ['user_id' => 1, 'sort_order' => 10],
                        ['user_id' => 2, 'sort_order' => 20],
                    ],
                ],
                [
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'sort_order' => 20,
                    'work_content' => 'Phoi hop trien khai Ioffice',
                    'location' => 'VNPT Ninh Kieu',
                    'participant_text' => 'Khach moi',
                    'participants' => [],
                ],
                [
                    'calendar_date' => '2026-01-20',
                    'session' => 'AFTERNOON',
                    'sort_order' => 10,
                    'work_content' => 'Hop trao doi dong bo du lieu',
                    'location' => 'So GD&DT',
                    'participant_text' => 'Cong tac vien',
                    'participants' => [
                        ['user_id' => 1, 'sort_order' => 10],
                    ],
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.department_id', 10)
            ->assertJsonPath('data.week_start_date', '2026-01-19');

        $payload = $response->getData(true);
        $this->assertCount(3, $payload['data']['entries'] ?? []);
        $this->assertSame(1, DB::table('department_weekly_schedules')->count());
        $this->assertSame(3, DB::table('department_weekly_schedule_entries')->count());
        $this->assertSame(3, DB::table('department_weekly_schedule_entry_participants')->count());
    }

    public function test_create_department_weekly_schedule_rejects_non_monday_week_start(): void
    {
        $response = $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-20',
            'entries' => [],
        ]);

        $response
            ->assertStatus(422)
            ->assertJson(['message' => 'week_start_date phải là Thứ Hai.']);
    }

    public function test_create_department_weekly_schedule_rejects_entry_outside_selected_week(): void
    {
        $response = $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'entries' => [
                [
                    'calendar_date' => '2026-01-27',
                    'session' => 'MORNING',
                    'work_content' => 'Ngoai tuan',
                ],
            ],
        ]);

        $response
            ->assertStatus(422)
            ->assertJson(['message' => 'entries.0.calendar_date nằm ngoài tuần đã chọn.']);
    }

    public function test_delete_department_weekly_schedule_cascades_entries_and_participants(): void
    {
        $created = $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'created_by' => 1,
            'updated_by' => 1,
            'entries' => [
                [
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'work_content' => 'Cong viec can xoa',
                    'participant_text' => 'Nguoi tham gia',
                    'participants' => [
                        ['user_id' => 1, 'sort_order' => 10],
                    ],
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}")
            ->assertOk()
            ->assertJson(['message' => 'Đã xóa lịch tuần phòng ban.']);

        $this->assertSame(0, DB::table('department_weekly_schedules')->count());
        $this->assertSame(0, DB::table('department_weekly_schedule_entries')->count());
        $this->assertSame(0, DB::table('department_weekly_schedule_entry_participants')->count());
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('department_weekly_schedule_entry_participants');
        Schema::dropIfExists('department_weekly_schedule_entries');
        Schema::dropIfExists('department_weekly_schedules');
        Schema::dropIfExists('monthly_calendars');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('internal_users');

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255);
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('monthly_calendars', function (Blueprint $table): void {
            $table->date('date')->primary();
            $table->smallInteger('year');
            $table->tinyInteger('month');
            $table->tinyInteger('day');
            $table->tinyInteger('week_number');
            $table->tinyInteger('day_of_week');
            $table->boolean('is_weekend')->default(false);
            $table->boolean('is_working_day')->default(true);
            $table->boolean('is_holiday')->default(false);
            $table->string('holiday_name', 150)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('department_weekly_schedules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('department_id');
            $table->date('week_start_date');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unique(['department_id', 'week_start_date']);
        });

        Schema::create('department_weekly_schedule_entries', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('schedule_id');
            $table->date('calendar_date');
            $table->string('session', 20);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->text('work_content');
            $table->string('location', 255)->nullable();
            $table->text('participant_text')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->foreign('schedule_id')
                ->references('id')
                ->on('department_weekly_schedules')
                ->cascadeOnDelete();
        });

        Schema::create('department_weekly_schedule_entry_participants', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('entry_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('participant_name_snapshot', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('entry_id')
                ->references('id')
                ->on('department_weekly_schedule_entries')
                ->cascadeOnDelete();
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'GIAI_PHAP_2',
            'dept_name' => 'Phòng giải pháp 2',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'VNPT0001', 'username' => 'quynh', 'full_name' => 'Quỳnh'],
            ['id' => 2, 'user_code' => 'VNPT0002', 'username' => 'thuan', 'full_name' => 'Thuận'],
        ]);

        $this->seedCalendarWeek('2026-01-19', 4);
        $this->seedCalendarWeek('2026-01-26', 5);
    }

    private function seedCalendarWeek(string $monday, int $weekNumber): void
    {
        $start = new \DateTimeImmutable($monday);
        $dayOfWeeks = [2, 3, 4, 5, 6, 7, 1];

        foreach ($dayOfWeeks as $offset => $dayOfWeek) {
            $date = $start->modify("+{$offset} days");
            DB::table('monthly_calendars')->insert([
                'date' => $date->format('Y-m-d'),
                'year' => (int) $date->format('Y'),
                'month' => (int) $date->format('m'),
                'day' => (int) $date->format('d'),
                'week_number' => $weekNumber,
                'day_of_week' => $dayOfWeek,
                'is_weekend' => in_array($dayOfWeek, [1, 7], true),
                'is_working_day' => ! in_array($dayOfWeek, [1, 7], true),
                'is_holiday' => false,
                'holiday_name' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
