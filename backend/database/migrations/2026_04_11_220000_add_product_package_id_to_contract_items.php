<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contract_items') || Schema::hasColumn('contract_items', 'product_package_id')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('product_package_id')->nullable()->after('product_id');
            $table->index('product_package_id', 'idx_contract_items_product_package');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('contract_items') || ! Schema::hasColumn('contract_items', 'product_package_id')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            try {
                $table->dropIndex('idx_contract_items_product_package');
            } catch (\Throwable) {
                // ignore when index name differs across environments
            }
            $table->dropColumn('product_package_id');
        });
    }
};
