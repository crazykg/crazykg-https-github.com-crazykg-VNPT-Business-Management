<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internal_users', function (Blueprint $table) {
            $table->string('active_tab_token', 64)->nullable()->after('password')
                  ->comment('Token tab đang active — request từ tab khác nhận 401 TAB_EVICTED');
            $table->timestamp('tab_token_set_at')->nullable()->after('active_tab_token')
                  ->comment('Thời điểm cấp token cho tab hiện tại');

            $table->index('active_tab_token', 'idx_users_active_tab_token');
        });
    }

    public function down(): void
    {
        Schema::table('internal_users', function (Blueprint $table) {
            $table->dropIndex('idx_users_active_tab_token');
            $table->dropColumn(['active_tab_token', 'tab_token_set_at']);
        });
    }
};
