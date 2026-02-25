<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('document_product_links')) {
            return;
        }

        Schema::create('document_product_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();

            $table->unique(['document_id', 'product_id'], 'uq_document_product_links_pair');
            $table->index('product_id', 'idx_document_product_links_product');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_product_links');
    }
};

