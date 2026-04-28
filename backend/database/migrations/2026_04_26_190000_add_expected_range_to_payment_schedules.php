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

        $hasExpectedStartDate = Schema::hasColumn('payment_schedules', 'expected_start_date');
        $hasExpectedEndDate = Schema::hasColumn('payment_schedules', 'expected_end_date');

        if ($hasExpectedStartDate && $hasExpectedEndDate) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table) use ($hasExpectedStartDate, $hasExpectedEndDate): void {
            if (! $hasExpectedStartDate) {
                $table->date('expected_start_date')->nullable()->after('expected_date');
            }
            if (! $hasExpectedEndDate) {
                $table->date('expected_end_date')->nullable()->after($hasExpectedStartDate ? 'expected_start_date' : 'expected_date');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payment_schedules')) {
            return;
        }

        $hasExpectedStartDate = Schema::hasColumn('payment_schedules', 'expected_start_date');
        $hasExpectedEndDate = Schema::hasColumn('payment_schedules', 'expected_end_date');

        if (! $hasExpectedStartDate && ! $hasExpectedEndDate) {
            return;
        }

        Schema::table('payment_schedules', function (Blueprint $table) use ($hasExpectedStartDate, $hasExpectedEndDate): void {
            $dropColumns = [];
            if ($hasExpectedEndDate) {
                $dropColumns[] = 'expected_end_date';
            }
            if ($hasExpectedStartDate) {
                $dropColumns[] = 'expected_start_date';
            }
            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
