<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Đảm bảo source_type là VARCHAR(50) nullable và source_id là nullable BIGINT
 * để cho phép insert với source_type = 'CASE' từ CustomerRequestCaseDomainService.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('request_ref_tasks')) {
            return;
        }

        // source_type: đổi thành VARCHAR(50) nullable nếu chưa đúng type
        if (Schema::hasColumn('request_ref_tasks', 'source_type')) {
            // Nếu đang là ENUM hoặc VARCHAR ngắn — MODIFY thành VARCHAR(50) nullable
            DB::statement("
                ALTER TABLE `request_ref_tasks`
                MODIFY COLUMN `source_type` VARCHAR(50) NULL DEFAULT NULL
            ");
        } else {
            Schema::table('request_ref_tasks', function (Blueprint $table): void {
                $table->string('source_type', 50)->nullable()->after('request_code');
            });
        }

        // source_id: đảm bảo nullable (không bắt buộc)
        if (Schema::hasColumn('request_ref_tasks', 'source_id')) {
            DB::statement("
                ALTER TABLE `request_ref_tasks`
                MODIFY COLUMN `source_id` BIGINT UNSIGNED NULL DEFAULT NULL
            ");
        } else {
            Schema::table('request_ref_tasks', function (Blueprint $table): void {
                $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            });
        }
    }

    public function down(): void
    {
        // Không rollback — an toàn hơn khi giữ nguyên VARCHAR nullable
    }
};
