<?php

namespace Tests\Feature;

use App\Models\InternalUser;
use Carbon\CarbonImmutable;
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
        CarbonImmutable::setTestNow('2026-01-10 09:00:00');
        $this->setUpSchema();
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_create_department_weekly_schedule_accepts_hybrid_participants_and_returns_entry_audit(): void
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
            ->assertJsonPath('data.week_start_date', '2026-01-19')
            ->assertJsonPath('data.entries.0.created_by', 1)
            ->assertJsonPath('data.entries.0.created_by_name', 'Quỳnh')
            ->assertJsonPath('data.entries.0.can_delete', true);

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

    public function test_non_admin_department_scope_follows_current_transfer_history_for_schedule_reads_and_writes(): void
    {
        DB::table('internal_users')->where('id', 1)->update(['department_id' => 10]);
        DB::table('user_dept_history')->insert([
            'user_id' => 1,
            'from_dept_id' => 10,
            'to_dept_id' => 20,
            'transfer_date' => '2026-01-09',
            'transfer_type' => 'BIET_PHAI',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('department_weekly_schedules')->insert([
            [
                'id' => 100,
                'department_id' => 10,
                'week_start_date' => '2026-01-19',
                'created_at' => now(),
                'updated_at' => now(),
                'created_by' => 1,
                'updated_by' => 1,
            ],
            [
                'id' => 200,
                'department_id' => 20,
                'week_start_date' => '2026-01-19',
                'created_at' => now(),
                'updated_at' => now(),
                'created_by' => 1,
                'updated_by' => 1,
            ],
        ]);

        $this->actingAs(InternalUser::query()->findOrFail(1));

        $this->getJson('/api/v5/department-weekly-schedules')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.department_id', 20);

        $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'entries' => [
                [
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'work_content' => 'Khong duoc tao o don vi cu',
                ],
            ],
        ])
            ->assertStatus(403)
            ->assertJson(['message' => 'Bạn chỉ được xem và cập nhật lịch tuần của đơn vị hiện tại.']);

        $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 20,
            'week_start_date' => '2026-01-26',
            'entries' => [
                [
                    'calendar_date' => '2026-01-26',
                    'session' => 'MORNING',
                    'work_content' => 'Duoc tao o don vi hien tai',
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.department_id', 20);
    }

    public function test_admin_update_department_weekly_schedule_preserves_entry_created_audit(): void
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
                    'sort_order' => 10,
                    'work_content' => 'Noi dung goc',
                    'participants' => [
                        ['user_id' => 1, 'sort_order' => 10],
                    ],
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');
        $entryId = (int) $created->json('data.entries.0.id');
        $before = DB::table('department_weekly_schedule_entries')->where('id', $entryId)->first();

        $updated = $this->putJson("/api/v5/department-weekly-schedules/{$scheduleId}", [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'updated_by' => 3,
            'entries' => [
                [
                    'id' => $entryId,
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'sort_order' => 10,
                    'work_content' => 'Noi dung da cap nhat',
                    'participants' => [
                        ['user_id' => 2, 'sort_order' => 10],
                    ],
                ],
            ],
        ]);

        $updated
            ->assertOk()
            ->assertJsonPath('data.entries.0.created_by', 1)
            ->assertJsonPath('data.entries.0.created_by_name', 'Quỳnh')
            ->assertJsonPath('data.entries.0.updated_by', 3)
            ->assertJsonPath('data.entries.0.updated_by_name', 'Admin')
            ->assertJsonPath('data.entries.0.can_edit', true)
            ->assertJsonPath('data.entries.0.can_delete', true)
            ->assertJsonPath('data.entries.0.is_locked', false);

        $after = DB::table('department_weekly_schedule_entries')->where('id', $entryId)->first();
        $this->assertNotNull($before);
        $this->assertNotNull($after);
        $this->assertSame((int) $before->created_by, (int) $after->created_by);
        $this->assertSame((string) $before->created_at, (string) $after->created_at);
        $this->assertSame(3, (int) $after->updated_by);
        $this->assertSame('Noi dung da cap nhat', (string) $after->work_content);
        $this->assertSame(1, DB::table('department_weekly_schedule_entries')->count());
    }

    public function test_non_owner_cannot_update_persisted_entry_without_admin_role(): void
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
                    'sort_order' => 10,
                    'work_content' => 'Noi dung goc',
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');
        $entryId = (int) $created->json('data.entries.0.id');

        $this->putJson("/api/v5/department-weekly-schedules/{$scheduleId}", [
            'department_id' => 10,
            'week_start_date' => '2026-01-19',
            'updated_by' => 2,
            'entries' => [
                [
                    'id' => $entryId,
                    'calendar_date' => '2026-01-19',
                    'session' => 'MORNING',
                    'sort_order' => 10,
                    'work_content' => 'User khac khong duoc sua',
                ],
            ],
        ])
            ->assertStatus(403)
            ->assertJson(['message' => 'Chỉ người đăng ký hoặc quản trị viên mới được chỉnh sửa dòng này.']);
    }

    public function test_owner_can_delete_persisted_entry(): void
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
                    'work_content' => 'Cong viec co the xoa',
                    'participants' => [
                        ['user_id' => 1, 'sort_order' => 10],
                    ],
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');
        $entryId = (int) $created->json('data.entries.0.id');

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}/entries/{$entryId}", [
            'actor_id' => 1,
        ])
            ->assertOk()
            ->assertJson(['message' => 'Đã xóa dòng lịch làm việc.']);

        $this->assertSame(0, DB::table('department_weekly_schedule_entries')->count());
        $this->assertSame(0, DB::table('department_weekly_schedule_entry_participants')->count());
    }

    public function test_non_owner_cannot_delete_persisted_entry_without_admin_role(): void
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
                    'work_content' => 'Khong cho xoa boi user khac',
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');
        $entryId = (int) $created->json('data.entries.0.id');

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}/entries/{$entryId}", [
            'actor_id' => 2,
        ])
            ->assertStatus(403)
            ->assertJson(['message' => 'Chỉ người đăng ký hoặc quản trị viên mới được xóa dòng này.']);

        $this->assertSame(1, DB::table('department_weekly_schedule_entries')->count());
    }

    public function test_admin_can_delete_persisted_entry(): void
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
                    'work_content' => 'Admin co the xoa',
                ],
            ],
        ])->assertCreated();

        $scheduleId = (int) $created->json('data.id');
        $entryId = (int) $created->json('data.entries.0.id');

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}/entries/{$entryId}", [
            'actor_id' => 3,
        ])
            ->assertOk()
            ->assertJson(['message' => 'Đã xóa dòng lịch làm việc.']);

        $this->assertSame(0, DB::table('department_weekly_schedule_entries')->count());
    }

    public function test_create_department_weekly_schedule_rejects_past_entries(): void
    {
        $this->postJson('/api/v5/department-weekly-schedules', [
            'department_id' => 10,
            'week_start_date' => '2026-01-05',
            'created_by' => 1,
            'updated_by' => 1,
            'entries' => [
                [
                    'calendar_date' => '2026-01-05',
                    'session' => 'MORNING',
                    'work_content' => 'Lich da qua',
                ],
            ],
        ])
            ->assertStatus(422)
            ->assertJson(['message' => 'entries.0: Lịch làm việc đã qua không thể chỉnh sửa.']);
    }

    public function test_past_persisted_entry_cannot_be_updated_or_deleted(): void
    {
        $scheduleId = (int) DB::table('department_weekly_schedules')->insertGetId([
            'department_id' => 10,
            'week_start_date' => '2026-01-05',
            'created_at' => now(),
            'updated_at' => now(),
            'created_by' => 1,
            'updated_by' => 1,
        ]);

        $entryId = (int) DB::table('department_weekly_schedule_entries')->insertGetId([
            'schedule_id' => $scheduleId,
            'calendar_date' => '2026-01-05',
            'session' => 'MORNING',
            'sort_order' => 10,
            'work_content' => 'Lich cu',
            'created_at' => now(),
            'updated_at' => now(),
            'created_by' => 1,
            'updated_by' => 1,
        ]);

        $this->putJson("/api/v5/department-weekly-schedules/{$scheduleId}", [
            'department_id' => 10,
            'week_start_date' => '2026-01-05',
            'updated_by' => 1,
            'entries' => [
                [
                    'id' => $entryId,
                    'calendar_date' => '2026-01-05',
                    'session' => 'MORNING',
                    'sort_order' => 10,
                    'work_content' => 'Khong duoc sua',
                ],
            ],
        ])
            ->assertStatus(422)
            ->assertJson(['message' => 'entries.0: Lịch làm việc đã qua không thể chỉnh sửa.']);

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}/entries/{$entryId}", [
            'actor_id' => 1,
        ])
            ->assertStatus(422)
            ->assertJson(['message' => 'Lịch làm việc đã qua không thể xóa.']);
    }

    public function test_delete_department_weekly_schedule_is_admin_only(): void
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

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}", [
            'actor_id' => 1,
        ])
            ->assertStatus(403)
            ->assertJson(['message' => 'Chỉ quản trị viên mới được xóa lịch tuần.']);

        $this->deleteJson("/api/v5/department-weekly-schedules/{$scheduleId}", [
            'actor_id' => 3,
        ])
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
        Schema::dropIfExists('user_dept_history');
        Schema::dropIfExists('monthly_calendars');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
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
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('user_dept_history', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('from_dept_id')->nullable();
            $table->unsignedBigInteger('to_dept_id');
            $table->date('transfer_date');
            $table->string('transfer_type', 50)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code', 50);
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
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
        DB::table('departments')->insert([
            'id' => 20,
            'dept_code' => 'VNPT_NINH_KIEU',
            'dept_name' => 'VNPT Ninh Kiều',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'VNPT0001', 'username' => 'quynh', 'full_name' => 'Quỳnh', 'department_id' => 10],
            ['id' => 2, 'user_code' => 'VNPT0002', 'username' => 'thuan', 'full_name' => 'Thuận', 'department_id' => 10],
            ['id' => 3, 'user_code' => 'VNPT0003', 'username' => 'admin', 'full_name' => 'Admin', 'department_id' => 20],
        ]);

        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'ADMIN',
        ]);

        DB::table('user_roles')->insert([
            'user_id' => 3,
            'role_id' => 1,
            'is_active' => 1,
        ]);

        $this->seedCalendarWeek('2026-01-05', 2);
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
