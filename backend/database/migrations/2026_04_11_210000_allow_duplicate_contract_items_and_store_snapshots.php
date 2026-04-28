<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contract_items')) {
            return;
        }

        $hasProductName = Schema::hasColumn('contract_items', 'product_name');
        $hasUnit = Schema::hasColumn('contract_items', 'unit');

        if (! $hasProductName || ! $hasUnit) {
            Schema::table('contract_items', function (Blueprint $table) use ($hasProductName, $hasUnit): void {
                if (! $hasProductName) {
                    $table->string('product_name', 500)->nullable()->after('product_id');
                }
                if (! $hasUnit) {
                    $table->string('unit', 100)->nullable()->after('product_name');
                }
            });
        }

        try {
            Schema::table('contract_items', function (Blueprint $table): void {
                $table->dropUnique('uq_ci_contract_product');
            });
        } catch (\Throwable) {
            // index already removed or named differently in local/test schemas
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('contract_items')) {
            return;
        }

        try {
            Schema::table('contract_items', function (Blueprint $table): void {
                $table->unique(['contract_id', 'product_id'], 'uq_ci_contract_product');
            });
        } catch (\Throwable) {
            // ignore duplicate recreate failures
        }

        $hasProductName = Schema::hasColumn('contract_items', 'product_name');
        $hasUnit = Schema::hasColumn('contract_items', 'unit');

        if ($hasProductName || $hasUnit) {
            Schema::table('contract_items', function (Blueprint $table) use ($hasProductName, $hasUnit): void {
                $dropColumns = [];
                if ($hasProductName) {
                    $dropColumns[] = 'product_name';
                }
                if ($hasUnit) {
                    $dropColumns[] = 'unit';
                }
                if ($dropColumns !== []) {
                    $table->dropColumn($dropColumns);
                }
            });
        }
    }
};
