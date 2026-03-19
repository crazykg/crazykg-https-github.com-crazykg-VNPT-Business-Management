<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contract_items')) {
            return;
        }

        Schema::create('contract_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('product_id');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['contract_id', 'product_id'], 'uq_ci_contract_product');
            $table->index('contract_id', 'idx_ci_contract');

            $table->foreign('contract_id', 'fk_ci_contract')
                ->references('id')
                ->on('contracts')
                ->cascadeOnDelete();
            $table->foreign('product_id', 'fk_ci_product')
                ->references('id')
                ->on('products');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('contract_items')) {
            return;
        }

        Schema::table('contract_items', function (Blueprint $table): void {
            $table->dropForeign('fk_ci_contract');
            $table->dropForeign('fk_ci_product');
            $table->dropUnique('uq_ci_contract_product');
            $table->dropIndex('idx_ci_contract');
        });

        Schema::dropIfExists('contract_items');
    }
};
