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

        if (! Schema::hasColumn('contracts', 'payment_cycle')) {
            Schema::table('contracts', function (Blueprint $table): void {
                $table->string('payment_cycle', 32)->default('ONCE');
            });
        }

        DB::table('contracts')
            ->where(function ($query): void {
                $query->whereNull('payment_cycle')
                    ->orWhere('payment_cycle', '');
            })
            ->update(['payment_cycle' => 'ONCE']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('contracts') || ! Schema::hasColumn('contracts', 'payment_cycle')) {
            return;
        }

        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropColumn('payment_cycle');
        });
    }
};
