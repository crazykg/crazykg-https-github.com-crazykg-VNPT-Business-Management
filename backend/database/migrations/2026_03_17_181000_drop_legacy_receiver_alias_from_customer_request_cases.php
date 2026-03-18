<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        try {
            DB::statement('ALTER TABLE customer_request_cases DROP FOREIGN KEY fk_customer_request_cases_receiver_user_id');
        } catch (\Throwable) {
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (Schema::hasColumn('customer_request_cases', 'receiver_user_id')) {
                $table->dropColumn('receiver_user_id');
            }

            if (Schema::hasColumn('customer_request_cases', 'requested_at')) {
                $table->dropColumn('requested_at');
            }
        });
    }

    public function down(): void
    {
        // Không khôi phục alias legacy đã bỏ.
    }
};
