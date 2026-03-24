<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('invoice_id');
            $table->unsignedBigInteger('product_id')->nullable();

            // Nội dung
            $table->string('description', 500)->comment('Mô tả dịch vụ/sản phẩm');
            $table->string('unit', 50)->nullable()->comment('Đơn vị tính');
            $table->decimal('quantity', 12, 2)->default(1.00);
            $table->decimal('unit_price', 15, 2)->default(0.00);
            $table->decimal('vat_rate', 5, 2)->nullable()->default(10.00);
            // line_total = quantity * unit_price — computed in PHP
            // vat_amount = quantity * unit_price * vat_rate / 100 — computed in PHP

            // Liên kết kỳ thanh toán (optional 1:1)
            $table->unsignedBigInteger('payment_schedule_id')->nullable()
                ->comment('Map 1:1 với payment_schedule nếu có');

            $table->integer('sort_order')->default(0);
            $table->timestamps();
            // No softDeletes: sync = hard-delete + re-insert (same as contract_items pattern)

            $table->index('invoice_id', 'idx_ii_invoice');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
