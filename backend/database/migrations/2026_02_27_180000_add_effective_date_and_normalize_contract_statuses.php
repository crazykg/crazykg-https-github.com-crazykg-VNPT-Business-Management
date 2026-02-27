<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contracts')) {
            return;
        }

        if (! Schema::hasColumn('contracts', 'effective_date')) {
            $hasSignDate = Schema::hasColumn('contracts', 'sign_date');
            Schema::table('contracts', function (Blueprint $table) use ($hasSignDate): void {
                $column = $table->date('effective_date')->nullable();
                if ($hasSignDate) {
                    $column->after('sign_date');
                }
            });
        }

        if (! Schema::hasColumn('contracts', 'status')) {
            return;
        }

        DB::table('contracts')->where('status', 'PENDING')->update(['status' => 'DRAFT']);
        DB::table('contracts')
            ->whereIn('status', ['EXPIRED', 'TERMINATED', 'LIQUIDATED'])
            ->update(['status' => 'RENEWED']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE `contracts` MODIFY `status` ENUM('DRAFT','SIGNED','RENEWED') NULL DEFAULT 'DRAFT'"
            );
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('contracts')) {
            return;
        }

        if (Schema::hasColumn('contracts', 'status')) {
            DB::table('contracts')->where('status', 'RENEWED')->update(['status' => 'LIQUIDATED']);

            if (DB::getDriverName() === 'mysql') {
                DB::statement(
                    "ALTER TABLE `contracts` MODIFY `status` ENUM('DRAFT','PENDING','SIGNED','EXPIRED','TERMINATED','LIQUIDATED') NULL DEFAULT 'DRAFT'"
                );
            }
        }

        if (Schema::hasColumn('contracts', 'effective_date')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->dropColumn('effective_date');
            });
        }
    }
};
