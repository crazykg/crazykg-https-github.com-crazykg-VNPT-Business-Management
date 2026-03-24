<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contract model đã khai báo SoftDeletes từ đầu nhưng không có migration
 * thêm cột deleted_at vào bảng contracts — mọi query whereNull('deleted_at')
 * trong CustomerInsightService đều trả về rỗng.
 *
 * Migration này thêm cột còn thiếu.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contracts') && ! Schema::hasColumn('contracts', 'deleted_at')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->softDeletes()->after('updated_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('contracts') && Schema::hasColumn('contracts', 'deleted_at')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->dropSoftDeletes();
            });
        }
    }
};
