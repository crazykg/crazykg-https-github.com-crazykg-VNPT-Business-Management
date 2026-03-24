<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_code', 50)->comment('Mã phiếu thu: RCP-YYYYMM-NNNN');

            // Liên kết
            $table->unsignedBigInteger('invoice_id')->nullable()
                ->comment('NULL nếu thu trước khi có hóa đơn');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('customer_id');

            // Chi tiết thanh toán
            $table->date('receipt_date')->comment('Ngày thu');
            $table->decimal('amount', 15, 2)->comment('Số tiền thu');
            $table->string('payment_method', 50)->default('BANK_TRANSFER')
                ->comment('CASH | BANK_TRANSFER | ONLINE | OFFSET | OTHER');

            // Thông tin ngân hàng (optional)
            $table->string('bank_name', 200)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('transaction_ref', 100)->nullable()->comment('Mã giao dịch ngân hàng');

            // Trạng thái (NO REVERSED — use reversal flags instead)
            $table->string('status', 30)->default('CONFIRMED')
                ->comment('CONFIRMED | PENDING_CONFIRM | REJECTED');

            // Reversal tracking
            $table->boolean('is_reversed')->default(false)
                ->comment('true if this receipt has a reversal offset entry');
            $table->boolean('is_reversal_offset')->default(false)
                ->comment('true if this is a negative offset entry (amount < 0)');
            $table->unsignedBigInteger('original_receipt_id')->nullable()
                ->comment('FK to original receipt being reversed');

            // Metadata
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('receipt_code', 'idx_rcp_code');
            $table->index('invoice_id', 'idx_rcp_invoice');
            $table->index('contract_id', 'idx_rcp_contract');
            $table->index('customer_id', 'idx_rcp_customer');
            $table->index('receipt_date', 'idx_rcp_date');
            $table->index('status', 'idx_rcp_status');
            $table->index(['receipt_date', 'invoice_id', 'status'], 'idx_rcp_trend');

            $table->foreign('invoice_id')->references('id')->on('invoices');
            $table->foreign('contract_id')->references('id')->on('contracts');
            $table->foreign('customer_id')->references('id')->on('customers');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipts');
    }
};
