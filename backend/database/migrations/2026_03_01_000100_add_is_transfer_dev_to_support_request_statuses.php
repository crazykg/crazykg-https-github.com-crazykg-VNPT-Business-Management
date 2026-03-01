<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_request_statuses')) {
            return;
        }

        if (! Schema::hasColumn('support_request_statuses', 'is_transfer_dev')) {
            Schema::table('support_request_statuses', function (Blueprint $table): void {
                $table->boolean('is_transfer_dev')->default(false)->after('is_terminal');
            });
        }

        if (Schema::hasColumn('support_request_statuses', 'status_code')) {
            $updates = ['is_transfer_dev' => true];
            if (Schema::hasColumn('support_request_statuses', 'status_name')) {
                $updates['status_name'] = 'Chuyển Dev';
            }
            if (Schema::hasColumn('support_request_statuses', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            DB::table('support_request_statuses')
                ->whereRaw('UPPER(status_code) = ?', ['TRANSFER_DEV'])
                ->update($updates);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_request_statuses')) {
            return;
        }

        if (Schema::hasColumn('support_request_statuses', 'is_transfer_dev')) {
            Schema::table('support_request_statuses', function (Blueprint $table): void {
                $table->dropColumn('is_transfer_dev');
            });
        }
    }
};
