<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('department_weekly_schedules')) {
            Schema::create('department_weekly_schedules', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('department_id');
                $table->date('week_start_date');
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                $table->unique(['department_id', 'week_start_date'], 'uq_dept_week_schedule');
                $table->index(['week_start_date'], 'idx_dept_week_schedule_start');

                $table->foreign('department_id', 'fk_dept_week_schedule_department')
                    ->references('id')
                    ->on('departments')
                    ->cascadeOnDelete();
                $table->foreign('week_start_date', 'fk_dept_week_schedule_calendar')
                    ->references('date')
                    ->on('monthly_calendars')
                    ->restrictOnDelete();
            });
        }

        if (! Schema::hasTable('department_weekly_schedule_entries')) {
            Schema::create('department_weekly_schedule_entries', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('schedule_id');
                $table->date('calendar_date');
                $table->enum('session', ['MORNING', 'AFTERNOON']);
                $table->unsignedSmallInteger('sort_order')->default(10);
                $table->text('work_content');
                $table->string('location', 255)->nullable();
                $table->text('participant_text')->nullable();
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();

                $table->index(['schedule_id', 'calendar_date', 'session'], 'idx_dept_week_schedule_entry_group');
                $table->index(['calendar_date'], 'idx_dept_week_schedule_entry_date');

                $table->foreign('schedule_id', 'fk_dept_week_schedule_entry_schedule')
                    ->references('id')
                    ->on('department_weekly_schedules')
                    ->cascadeOnDelete();
                $table->foreign('calendar_date', 'fk_dept_week_schedule_entry_calendar')
                    ->references('date')
                    ->on('monthly_calendars')
                    ->restrictOnDelete();
            });
        }

        if (! Schema::hasTable('department_weekly_schedule_entry_participants')) {
            Schema::create('department_weekly_schedule_entry_participants', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('entry_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('participant_name_snapshot', 255)->nullable();
                $table->unsignedSmallInteger('sort_order')->default(10);
                $table->timestamp('created_at')->nullable()->useCurrent();
                $table->timestamp('updated_at')->nullable()->useCurrentOnUpdate();

                $table->index(['entry_id', 'sort_order'], 'idx_dept_week_schedule_participant_entry');

                $table->foreign('entry_id', 'fk_dept_week_schedule_participant_entry')
                    ->references('id')
                    ->on('department_weekly_schedule_entries')
                    ->cascadeOnDelete();
                $table->foreign('user_id', 'fk_dept_week_schedule_participant_user')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('department_weekly_schedule_entry_participants');
        Schema::dropIfExists('department_weekly_schedule_entries');
        Schema::dropIfExists('department_weekly_schedules');
    }
};
