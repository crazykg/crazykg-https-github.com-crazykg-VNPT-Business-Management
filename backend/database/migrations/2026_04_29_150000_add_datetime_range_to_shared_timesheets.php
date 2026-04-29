<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('shared_timesheets')) {
            return;
        }

        Schema::table('shared_timesheets', function (Blueprint $table) {
            if (! Schema::hasColumn('shared_timesheets', 'work_started_at')) {
                $table->dateTime('work_started_at')->nullable()->after('work_date');
            }

            if (! Schema::hasColumn('shared_timesheets', 'work_ended_at')) {
                $table->dateTime('work_ended_at')->nullable()->after('work_started_at');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('shared_timesheets')) {
            return;
        }

        Schema::table('shared_timesheets', function (Blueprint $table) {
            if (Schema::hasColumn('shared_timesheets', 'work_ended_at')) {
                $table->dropColumn('work_ended_at');
            }

            if (Schema::hasColumn('shared_timesheets', 'work_started_at')) {
                $table->dropColumn('work_started_at');
            }
        });
    }
};
