<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $isMysql = DB::getDriverName() === 'mysql';

        if ($isMysql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        try {
            Schema::dropIfExists('programming_request_worklogs');
            Schema::dropIfExists('programming_requests');
            Schema::dropIfExists('support_request_tasks');
            Schema::dropIfExists('support_request_history');
            Schema::dropIfExists('support_requests');
        } finally {
            if ($isMysql) {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        }
    }

    public function down(): void
    {
        // Destructive cleanup approved: no rollback recreation.
    }
};
