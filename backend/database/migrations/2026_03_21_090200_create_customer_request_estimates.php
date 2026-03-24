<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_request_estimates')) {
            return;
        }

        Schema::create('customer_request_estimates', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->index()->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->index()->comment('Instance trạng thái liên quan');
            $table->string('status_code', 80)->nullable()->index()->comment('Mã trạng thái lúc estimate');
            $table->decimal('estimated_hours', 8, 2)->comment('Số giờ estimate');
            $table->string('estimate_type', 50)->nullable()->comment('Loại estimate');
            $table->string('estimate_scope', 50)->default('total')->comment('Phạm vi estimate');
            $table->string('phase_label', 255)->nullable()->comment('Nhãn giai đoạn');
            $table->text('note')->nullable()->comment('Ghi chú');
            $table->unsignedBigInteger('estimated_by_user_id')->nullable()->index()->comment('Người estimate');
            $table->dateTime('estimated_at')->nullable()->index()->comment('Thời điểm estimate');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();

            $table->index(['request_case_id', 'estimated_at', 'id'], 'idx_cre_case_estimated_at_id');
            $table->index(['request_case_id', 'estimate_scope', 'estimated_at', 'id'], 'idx_cre_case_scope_estimated_at_id');
            $table->foreign('request_case_id', 'fk_customer_request_estimates_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_customer_request_estimates_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->nullOnDelete();
        });

        $this->addSharedForeignIfExists('customer_request_estimates', 'estimated_by_user_id', 'internal_users');
        $this->addSharedForeignIfExists('customer_request_estimates', 'created_by', 'internal_users');
        $this->addSharedForeignIfExists('customer_request_estimates', 'updated_by', 'internal_users');
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_request_estimates');
    }

    private function addSharedForeignIfExists(string $tableName, string $column, string $targetTable, string $targetColumn = 'id'): void
    {
        if (! Schema::hasTable($tableName) || ! Schema::hasTable($targetTable) || ! Schema::hasColumn($tableName, $column)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($column, $targetTable, $targetColumn, $tableName): void {
            $table->foreign($column, "fk_{$tableName}_{$column}")
                ->references($targetColumn)
                ->on($targetTable)
                ->nullOnDelete();
        });
    }
};
