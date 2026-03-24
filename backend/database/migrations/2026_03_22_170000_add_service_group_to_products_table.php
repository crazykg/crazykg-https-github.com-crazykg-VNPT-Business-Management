<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        if (! Schema::hasColumn('products', 'service_group')) {
            Schema::table('products', function (Blueprint $table): void {
                $table->string('service_group', 50)->default('GROUP_B')->index();
            });
        }

        DB::table('products')
            ->where(function ($query): void {
                $query->whereNull('service_group')
                    ->orWhere('service_group', '');
            })
            ->update(['service_group' => 'GROUP_B']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('products') || ! Schema::hasColumn('products', 'service_group')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('service_group');
        });
    }
};
