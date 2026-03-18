<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            if (Schema::hasColumn('customer_request_cases', 'intake_notes')) {
                $table->dropColumn('intake_notes');
            }
        });
    }

    public function down(): void
    {
        // Không khôi phục cột intake_notes đã bỏ.
    }
};
