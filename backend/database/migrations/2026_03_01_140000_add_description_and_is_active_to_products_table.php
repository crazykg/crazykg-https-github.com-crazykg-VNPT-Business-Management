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

        Schema::table('products', function (Blueprint $table): void {
            if (! Schema::hasColumn('products', 'description')) {
                $table->text('description')->nullable();
            }

            if (! Schema::hasColumn('products', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });

        if (Schema::hasColumn('products', 'is_active')) {
            DB::table('products')
                ->whereNull('is_active')
                ->update(['is_active' => 1]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            if (Schema::hasColumn('products', 'is_active')) {
                $table->dropColumn('is_active');
            }

            if (Schema::hasColumn('products', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
