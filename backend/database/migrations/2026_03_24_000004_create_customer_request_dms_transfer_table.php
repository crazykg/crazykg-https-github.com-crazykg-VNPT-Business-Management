<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_request_dms_transfer', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID dòng trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->unsignedBigInteger('dms_contact_user_id')->nullable()->index()->comment('Người phụ trách DMS');
            $table->text('exchange_content')->nullable()->comment('Nội dung trao đổi');
            $table->string('task_ref', 100)->nullable()->comment('Mã task DMS');
            $table->string('task_url', 500)->nullable()->comment('URL task DMS');
            $table->string('dms_phase', 100)->nullable()->comment('Giai đoạn chuyển DMS');
            $table->dateTime('dms_started_at')->nullable()->comment('Ngày bắt đầu');
            $table->dateTime('dms_completed_at')->nullable()->comment('Ngày hoàn thành');
            $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->unique('status_instance_id', 'uq_crdt_status_instance');
            $table->foreign('request_case_id', 'fk_crdt_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_crdt_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('set null');
            $table->index('request_case_id', 'idx_crdt_case');
            $table->comment('Trạng thái Chuyển DMS');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_dms_transfer');
    }
};