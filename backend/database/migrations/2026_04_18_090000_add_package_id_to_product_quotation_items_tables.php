<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('product_quotation_items') && ! Schema::hasColumn('product_quotation_items', 'package_id')) {
            Schema::table('product_quotation_items', function (Blueprint $table): void {
                $table->unsignedBigInteger('package_id')->nullable()->after('product_id');
                $table->index('package_id', 'idx_product_quotation_items_package');
            });
        }

        if (
            Schema::hasTable('product_quotation_version_items')
            && ! Schema::hasColumn('product_quotation_version_items', 'package_id')
        ) {
            Schema::table('product_quotation_version_items', function (Blueprint $table): void {
                $table->unsignedBigInteger('package_id')->nullable()->after('product_id');
                $table->index('package_id', 'idx_product_quotation_version_items_package');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_quotation_version_items') && Schema::hasColumn('product_quotation_version_items', 'package_id')) {
            Schema::table('product_quotation_version_items', function (Blueprint $table): void {
                $table->dropIndex('idx_product_quotation_version_items_package');
                $table->dropColumn('package_id');
            });
        }

        if (Schema::hasTable('product_quotation_items') && Schema::hasColumn('product_quotation_items', 'package_id')) {
            Schema::table('product_quotation_items', function (Blueprint $table): void {
                $table->dropIndex('idx_product_quotation_items_package');
                $table->dropColumn('package_id');
            });
        }
    }
};
