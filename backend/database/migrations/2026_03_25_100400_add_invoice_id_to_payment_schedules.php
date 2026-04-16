<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table) {
            if (! Schema::hasColumn('payment_schedules', 'invoice_id')) {
                $table->unsignedBigInteger('invoice_id')->nullable()->after('contract_id')
                    ->comment('Liên kết 1:1 với hóa đơn đã phát hành');
                $table->index('invoice_id', 'idx_ps_invoice');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table) {
            if (Schema::hasColumn('payment_schedules', 'invoice_id')) {
                $table->dropIndex('idx_ps_invoice');
                $table->dropColumn('invoice_id');
            }
        });
    }
};
