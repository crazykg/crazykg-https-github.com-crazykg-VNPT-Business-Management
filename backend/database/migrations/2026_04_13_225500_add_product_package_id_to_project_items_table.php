<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_items')) {
            if (!Schema::hasColumn('project_items', 'product_package_id')) {
                Schema::table('project_items', function (Blueprint $table) {
                    $table->unsignedBigInteger('product_package_id')->nullable()->after('product_id');

                    // Note: Foreign key constraint intentionally omitted for now to avoid circular dependency issues
                    // It will be added in a separate migration after all related tables are properly set up

                    $table->index('product_package_id', 'idx_project_items_product_package');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_items') && Schema::hasColumn('project_items', 'product_package_id')) {
            Schema::table('project_items', function (Blueprint $table) {
                $table->dropIndex('idx_project_items_product_package');
                $table->dropColumn('product_package_id');
            });
        }
    }
};