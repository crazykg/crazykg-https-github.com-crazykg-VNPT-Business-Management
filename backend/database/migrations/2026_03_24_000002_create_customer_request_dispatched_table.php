<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_request_dispatched')) {
            return;
        }

        Schema::create('customer_request_dispatched', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID dòng trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->string('dispatch_decision', 100)->nullable()->comment('Quyết định phân công');
            $table->unsignedBigInteger('performer_user_id')->nullable()->index()->comment('Người thực hiện');
            $table->decimal('estimated_hours_by_dispatcher', 8, 2)->nullable()->comment('Ước lượng giờ bởi PM');
            $table->text('dispatch_note')->nullable()->comment('Ghi chú phân công');
            $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->unique('status_instance_id', 'uq_crd_status_instance');
            $table->foreign('request_case_id', 'fk_crd_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_crd_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('set null');
            $table->index('request_case_id', 'idx_crd_case');
            $table->comment('Trạng thái Đã phân công');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_dispatched');
    }
};
