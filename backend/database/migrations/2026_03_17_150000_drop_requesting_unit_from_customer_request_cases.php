<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_cases') || ! Schema::hasColumn('customer_request_cases', 'requesting_unit')) {
            return;
        }

        Schema::table('customer_request_cases', function (Blueprint $table): void {
            $table->dropColumn('requesting_unit');
        });
    }

    public function down(): void
    {
        // Không khôi phục lại cột legacy đã bỏ.
    }
};
