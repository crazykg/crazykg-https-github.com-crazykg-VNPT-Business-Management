<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_code', 50)->comment('Mã hóa đơn: INV-YYYYMM-NNNN');
            $table->string('invoice_series', 20)->nullable()->comment('Ký hiệu hóa đơn (series)');

            // Liên kết
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('project_id')->nullable();

            // Ngày tháng
            $table->date('invoice_date')->comment('Ngày xuất hóa đơn');
            $table->date('due_date')->comment('Hạn thanh toán');
            $table->date('period_from')->nullable()->comment('Kỳ cước từ ngày');
            $table->date('period_to')->nullable()->comment('Kỳ cước đến ngày');

            // Giá trị
            $table->decimal('subtotal', 15, 2)->default(0.00)->comment('Tổng trước thuế');
            $table->decimal('vat_rate', 5, 2)->nullable()->default(10.00)->comment('Thuế suất %');
            $table->decimal('vat_amount', 15, 2)->default(0.00)->comment('Tiền thuế');
            $table->decimal('total_amount', 15, 2)->default(0.00)->comment('Tổng sau thuế');
            $table->decimal('paid_amount', 15, 2)->default(0.00)->comment('Đã thu (cập nhật từ receipts)');
            // outstanding = total_amount - paid_amount (computed in PHP, not stored column due to MySQL version compat)

            // Trạng thái
            $table->string('status', 30)->default('DRAFT')
                ->comment('DRAFT | ISSUED | PARTIAL | PAID | CANCELLED | VOID');

            // Metadata
            $table->text('notes')->nullable();
            $table->string('data_scope', 50)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Unique: invoice_code among non-deleted
            $table->index('invoice_code', 'idx_inv_code');
            $table->index('contract_id', 'idx_inv_contract');
            $table->index('customer_id', 'idx_inv_customer');
            $table->index('status', 'idx_inv_status');
            $table->index('due_date', 'idx_inv_due_date');
            $table->index(['invoice_date', 'status'], 'idx_inv_date_status');
            $table->index(['paid_amount', 'total_amount'], 'idx_inv_amounts');

            $table->foreign('contract_id')->references('id')->on('contracts');
            $table->foreign('customer_id')->references('id')->on('customers');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
