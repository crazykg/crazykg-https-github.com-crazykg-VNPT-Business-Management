<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('internal_users')) {
            return;
        }

        if (! Schema::hasColumn('internal_users', 'active_tab_token')) {
            Schema::table('internal_users', function (Blueprint $table) {
                $table->string('active_tab_token', 64)->nullable()->after('password')
                    ->comment('Token tab đang active — request từ tab khác nhận 401 TAB_EVICTED');

                $table->index('active_tab_token', 'idx_users_active_tab_token');
            });
        }

        if (! Schema::hasColumn('internal_users', 'tab_token_set_at')) {
            Schema::table('internal_users', function (Blueprint $table) {
                $table->timestamp('tab_token_set_at')->nullable()->after('active_tab_token')
                    ->comment('Thời điểm cấp token cho tab hiện tại');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('internal_users')) {
            return;
        }

        if (Schema::hasColumn('internal_users', 'active_tab_token')) {
            if (DB::getDriverName() === 'sqlite') {
                DB::statement('DROP INDEX IF EXISTS idx_users_active_tab_token');
            } else {
                Schema::table('internal_users', function (Blueprint $table) {
                    $table->dropIndex('idx_users_active_tab_token');
                });
            }
        }

        $columnsToDrop = [];

        if (Schema::hasColumn('internal_users', 'active_tab_token')) {
            $columnsToDrop[] = 'active_tab_token';
        }

        if (Schema::hasColumn('internal_users', 'tab_token_set_at')) {
            $columnsToDrop[] = 'tab_token_set_at';
        }

        if ($columnsToDrop !== []) {
            Schema::table('internal_users', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }
    }
};
