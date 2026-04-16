<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Chuyển project.status từ ENUM cứng (TRIAL/ONGOING/...) sang VARCHAR(100)
     * để nhận phase codes từ bảng thủ tục (CHUAN_BI, THUC_HIEN_DAU_TU, ...).
     * Đồng thời migrate dữ liệu cũ sang phase đầu tiên phù hợp với investment_mode.
     */
    public function up(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status')) {
            return;
        }

        if (DB::getDriverName() === 'sqlite') {
            if (Schema::hasColumn('projects', 'investment_mode')) {
                DB::statement("
                    UPDATE `projects`
                    SET `status` = CASE
                        WHEN `investment_mode` = 'THUE_DICH_VU_DACTHU' THEN 'CHUAN_BI_KH_THUE'
                        ELSE 'CHUAN_BI'
                    END
                    WHERE `status` IN ('TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED')
                ");
            } else {
                DB::statement("
                    UPDATE `projects`
                    SET `status` = 'CHUAN_BI'
                    WHERE `status` IN ('TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED')
                ");
            }

            return;
        }

        // B1: Đổi cột từ ENUM sang VARCHAR(100) để nhận phase codes tùy ý
        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` VARCHAR(100) NOT NULL DEFAULT 'CHUAN_BI'");

        // B2: Migrate dữ liệu cũ → phase đầu tiên theo investment_mode
        DB::statement("
            UPDATE `projects`
            SET `status` = CASE
                WHEN `investment_mode` = 'THUE_DICH_VU_DACTHU' THEN 'CHUAN_BI_KH_THUE'
                ELSE 'CHUAN_BI'
            END
            WHERE `status` IN ('TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED')
        ");
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status')) {
            return;
        }

        // Reset phase codes về TRIAL trước khi đổi lại ENUM
        DB::statement("
            UPDATE `projects`
            SET `status` = 'TRIAL'
            WHERE `status` NOT IN ('TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED')
        ");

        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        // Đổi lại ENUM
        DB::statement("ALTER TABLE `projects` MODIFY COLUMN `status` ENUM('TRIAL','ONGOING','WARRANTY','COMPLETED','CANCELLED') NOT NULL DEFAULT 'TRIAL'");
    }
};
