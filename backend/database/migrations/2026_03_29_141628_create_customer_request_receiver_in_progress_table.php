<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_request_receiver_in_progress', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->index()->comment('Yêu cầu');
            $table->unsignedBigInteger('receiver_user_id')->nullable()->index()->comment('Người thực hiện (R)');
            $table->dateTime('accepted_at')->nullable()->comment('Ngày chấp nhận xử lý');
            $table->dateTime('started_at')->nullable()->comment('Ngày bắt đầu xử lý');
            $table->dateTime('expected_completed_at')->nullable()->comment('Ngày dự kiến hoàn thành');
            $table->unsignedTinyInteger('progress_percent')->default(0)->comment('Tiến độ %');
            $table->text('processing_content')->nullable()->comment('Nội dung xử lý');
            $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->softDeletes();
            
            $table->foreign('request_case_id', 'fk_crc_receiver_in_progress_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            
            $table->comment('Trạng thái R Đang thực hiện - yêu cầu khách hàng');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_request_receiver_in_progress');
    }
};
