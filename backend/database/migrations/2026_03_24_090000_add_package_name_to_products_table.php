<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products') || Schema::hasColumn('products', 'package_name')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->string('package_name', 255)->nullable()->after('product_name');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('products') || ! Schema::hasColumn('products', 'package_name')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('package_name');
        });
    }
};
