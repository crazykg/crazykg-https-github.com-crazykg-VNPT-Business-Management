<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('support_requests')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            if (Schema::hasColumn('support_requests', 'hotfix_date')) {
                DB::statement('ALTER TABLE `support_requests` MODIFY `hotfix_date` DATE NULL');
            }
            if (Schema::hasColumn('support_requests', 'noti_date')) {
                DB::statement('ALTER TABLE `support_requests` MODIFY `noti_date` DATE NULL');
            }
            return;
        }

        if ($driver === 'pgsql') {
            if (Schema::hasColumn('support_requests', 'hotfix_date')) {
                DB::statement('ALTER TABLE "support_requests" ALTER COLUMN "hotfix_date" DROP NOT NULL');
            }
            if (Schema::hasColumn('support_requests', 'noti_date')) {
                DB::statement('ALTER TABLE "support_requests" ALTER COLUMN "noti_date" DROP NOT NULL');
            }
        }
    }

    public function down(): void
    {
        // No-op: preserve nullable columns for backward compatibility.
    }
};
