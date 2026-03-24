<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * G7: Thêm 3 boolean flags cảnh báo vượt giờ ước lượng.
 * Reset khi estimate được revision (estimated_hours thay đổi).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table) {
            $table->boolean('warn_70_sent')->default(false)->after('total_hours_spent');
            $table->boolean('warn_90_sent')->default(false)->after('warn_70_sent');
            $table->boolean('warn_100_sent')->default(false)->after('warn_90_sent');
        });
    }

    public function down(): void
    {
        Schema::table('customer_request_cases', function (Blueprint $table) {
            $table->dropColumn(['warn_70_sent', 'warn_90_sent', 'warn_100_sent']);
        });
    }
};
