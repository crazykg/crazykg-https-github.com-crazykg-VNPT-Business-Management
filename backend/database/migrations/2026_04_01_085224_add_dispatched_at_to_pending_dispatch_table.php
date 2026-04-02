<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('customer_request_pending_dispatch')) {
            return;
        }

        Schema::table('customer_request_pending_dispatch', function (Blueprint $table): void {
            if (! Schema::hasColumn('customer_request_pending_dispatch', 'dispatched_at')) {
                $table->dateTime('dispatched_at')->nullable()->after('dispatch_note');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('customer_request_pending_dispatch')) {
            return;
        }

        Schema::table('customer_request_pending_dispatch', function (Blueprint $table): void {
            if (Schema::hasColumn('customer_request_pending_dispatch', 'dispatched_at')) {
                $table->dropColumn('dispatched_at');
            }
        });
    }
};
