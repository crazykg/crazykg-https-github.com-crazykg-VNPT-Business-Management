<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dunning_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('invoice_id');
            $table->unsignedBigInteger('customer_id');

            $table->tinyInteger('dunning_level')->default(1)
                ->comment('1=nhắc lần 1, 2=nhắc lần 2, 3=cảnh báo');
            $table->timestamp('sent_at')->useCurrent();
            $table->string('sent_via', 30)->default('SYSTEM')
                ->comment('SYSTEM | EMAIL | MANUAL');
            $table->text('message')->nullable()->comment('Nội dung nhắc');
            $table->text('response_note')->nullable()->comment('Ghi chú phản hồi từ KH');

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            // No softDeletes: audit trail should be immutable

            $table->index('invoice_id', 'idx_dl_invoice');
            $table->index('customer_id', 'idx_dl_customer');
            $table->index('dunning_level', 'idx_dl_level');

            $table->foreign('invoice_id')->references('id')->on('invoices');
            $table->foreign('customer_id')->references('id')->on('customers');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dunning_logs');
    }
};
