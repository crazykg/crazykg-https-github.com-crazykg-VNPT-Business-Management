<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customer_requests') || Schema::hasColumn('customer_requests', 'assigned_date')) {
            return;
        }

        Schema::table('customer_requests', function (Blueprint $table): void {
            $table->date('assigned_date')->nullable()->after('requested_date');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customer_requests') || ! Schema::hasColumn('customer_requests', 'assigned_date')) {
            return;
        }

        Schema::table('customer_requests', function (Blueprint $table): void {
            $table->dropColumn('assigned_date');
        });
    }
};
