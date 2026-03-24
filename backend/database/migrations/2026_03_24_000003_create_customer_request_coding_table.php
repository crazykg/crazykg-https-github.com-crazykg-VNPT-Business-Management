<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_request_coding', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID dòng trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->unsignedBigInteger('developer_user_id')->nullable()->index()->comment('Dev thực hiện');
            $table->text('coding_content')->nullable()->comment('Nội dung lập trình');
            $table->string('coding_phase', 100)->nullable()->comment('Giai đoạn lập trình');
            $table->string('upcode_version', 100)->nullable()->comment('Phiên bản upcode');
            $table->string('upcode_environment', 255)->nullable()->comment('Môi trường upcode');
            $table->dateTime('coding_started_at')->nullable()->comment('Ngày bắt đầu code');
            $table->dateTime('coding_completed_at')->nullable()->comment('Ngày hoàn thành code');
            $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->unique('status_instance_id', 'uq_crc_status_instance');
            $table->foreign('request_case_id', 'fk_crc_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_crc_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('set null');
            $table->index('request_case_id', 'idx_crc_case');
            $table->comment('Trạng thái Đang lập trình');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_coding');
    }
};