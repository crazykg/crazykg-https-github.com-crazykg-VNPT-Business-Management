<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds penalty tracking columns to payment_schedules.
 *
 * Invariant: expected_amount = original_amount - penalty_amount (when penalty > 0).
 * Backward compat: all three columns NULL for contracts without penalty.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table): void {
            if (! Schema::hasColumn('payment_schedules', 'original_amount')) {
                $col = $table->decimal('original_amount', 18, 2)->nullable()
                    ->comment('Giá trị gốc trước penalty');
                if (DB::getDriverName() === 'mysql') {
                    $col->after('expected_amount');
                }
            }

            if (! Schema::hasColumn('payment_schedules', 'penalty_rate')) {
                $col = $table->decimal('penalty_rate', 5, 4)->nullable()
                    ->comment('Copy từ contract.penalty_rate tại thời điểm generate');
                if (DB::getDriverName() === 'mysql') {
                    $col->after('original_amount');
                }
            }

            if (! Schema::hasColumn('payment_schedules', 'penalty_amount')) {
                $col = $table->decimal('penalty_amount', 18, 2)->nullable()
                    ->comment('Số tiền bị trừ: original_amount * penalty_rate');
                if (DB::getDriverName() === 'mysql') {
                    $col->after('penalty_rate');
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table): void {
            $columns = ['penalty_amount', 'penalty_rate', 'original_amount'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('payment_schedules', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
