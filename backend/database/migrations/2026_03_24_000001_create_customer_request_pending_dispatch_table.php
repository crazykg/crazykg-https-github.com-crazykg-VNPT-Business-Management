<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_request_pending_dispatch', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID dòng trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->text('dispatch_note')->nullable()->comment('Ghi chú giao PM');
            $table->decimal('estimated_hours_by_creator', 8, 2)->nullable()->comment('Ước lượng giờ bởi người tạo');
            $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->unique('status_instance_id', 'uq_crpd_status_instance');
            $table->foreign('request_case_id', 'fk_crpd_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_crpd_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('set null');
            $table->index('request_case_id', 'idx_crpd_case');
            $table->comment('Trạng thái Chờ PM điều phối');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_pending_dispatch');
    }
};