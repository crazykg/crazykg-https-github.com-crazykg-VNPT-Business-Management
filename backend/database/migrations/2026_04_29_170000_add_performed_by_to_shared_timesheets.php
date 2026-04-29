<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('shared_timesheets')) {
            return;
        }

        if (! Schema::hasColumn('shared_timesheets', 'performed_by_user_id')) {
            Schema::table('shared_timesheets', function (Blueprint $table): void {
                $table->unsignedBigInteger('performed_by_user_id')
                    ->nullable()
                    ->after('procedure_step_worklog_id');
            });
        }

        DB::table('shared_timesheets')
            ->whereNull('performed_by_user_id')
            ->whereNotNull('created_by')
            ->update(['performed_by_user_id' => DB::raw('created_by')]);

        Schema::table('shared_timesheets', function (Blueprint $table): void {
            $table->index(['work_date', 'performed_by_user_id'], 'idx_ts_date_performer');
            $table->index('performed_by_user_id', 'idx_ts_performer');
        });

        if (Schema::hasTable('internal_users')) {
            Schema::table('shared_timesheets', function (Blueprint $table): void {
                $table->foreign('performed_by_user_id', 'fk_shared_timesheets_performer')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('shared_timesheets') || ! Schema::hasColumn('shared_timesheets', 'performed_by_user_id')) {
            return;
        }

        Schema::table('shared_timesheets', function (Blueprint $table): void {
            $table->dropForeign('fk_shared_timesheets_performer');
            $table->dropIndex('idx_ts_date_performer');
            $table->dropIndex('idx_ts_performer');
            $table->dropColumn('performed_by_user_id');
        });
    }
};
