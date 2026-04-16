<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_quotation_items')) {
            return;
        }

        Schema::table('product_quotation_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('product_quotation_items', 'product_package_id')) {
                $table->unsignedBigInteger('product_package_id')->nullable()->after('product_id');
                $table->index('product_package_id', 'idx_product_quotation_items_package');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_quotation_items')) {
            return;
        }

        Schema::table('product_quotation_items', function (Blueprint $table): void {
            if (Schema::hasColumn('product_quotation_items', 'product_package_id')) {
                $table->dropIndex('idx_product_quotation_items_package');
                $table->dropColumn('product_package_id');
            }
        });
    }
};
