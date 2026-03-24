<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Thêm cột priority cho bảng opportunities.
 *
 * Giá trị: 1 = Thấp, 2 = Trung bình (default), 3 = Cao, 4 = Khẩn
 * Dùng chung thang đo 1-4 với customer_request_cases để nhất quán.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('opportunities') && ! Schema::hasColumn('opportunities', 'priority')) {
            Schema::table('opportunities', function (Blueprint $table) {
                $table->unsignedTinyInteger('priority')->default(2)->after('stage')
                    ->comment('1=Thấp 2=TB 3=Cao 4=Khẩn');
                $table->index('priority', 'idx_opp_priority');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('opportunities') && Schema::hasColumn('opportunities', 'priority')) {
            Schema::table('opportunities', function (Blueprint $table) {
                $table->dropIndex('idx_opp_priority');
                $table->dropColumn('priority');
            });
        }
    }
};
