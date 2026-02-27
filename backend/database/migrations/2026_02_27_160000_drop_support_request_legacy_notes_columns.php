<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        Schema::table('support_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('support_requests', 'change_log')) {
                $table->dropColumn('change_log');
            }

            if (Schema::hasColumn('support_requests', 'test_note')) {
                $table->dropColumn('test_note');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        Schema::table('support_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_requests', 'change_log')) {
                $table->text('change_log')->nullable()->comment('Hướng xử lý / Ghi chú kỹ thuật');
            }

            if (! Schema::hasColumn('support_requests', 'test_note')) {
                $table->text('test_note')->nullable()->comment('Kết quả kiểm thử');
            }
        });
    }
};

