<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products') || Schema::hasColumn('products', 'unit')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->string('unit', 50)->nullable()->after('standard_price');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('products') || ! Schema::hasColumn('products', 'unit')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('unit');
        });
    }
};
