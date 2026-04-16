<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_items')) {
            if (! Schema::hasColumn('project_items', 'product_package_id')) {
                Schema::table('project_items', function (Blueprint $table): void {
                    $table->unsignedBigInteger('product_package_id')->nullable()->after('product_id');
                });
            }

            $indexes = collect(DB::select('SHOW INDEX FROM `project_items`'))
                ->pluck('Key_name')
                ->map(static fn ($value) => (string) $value)
                ->all();

            if (
                ! in_array('idx_project_items_product_package_id', $indexes, true)
                && ! in_array('idx_project_items_product_package', $indexes, true)
            ) {
                Schema::table('project_items', function (Blueprint $table): void {
                    $table->index('product_package_id', 'idx_project_items_product_package_id');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_items') && Schema::hasColumn('project_items', 'product_package_id')) {
            $indexes = collect(DB::select('SHOW INDEX FROM `project_items`'))
                ->pluck('Key_name')
                ->map(static fn ($value) => (string) $value)
                ->all();

            Schema::table('project_items', function (Blueprint $table) use ($indexes): void {
                if (in_array('idx_project_items_product_package_id', $indexes, true)) {
                    $table->dropIndex('idx_project_items_product_package_id');
                }

                if (in_array('idx_project_items_product_package', $indexes, true)) {
                    $table->dropIndex('idx_project_items_product_package');
                }

                $table->dropColumn('product_package_id');
            });
        }
    }
};
