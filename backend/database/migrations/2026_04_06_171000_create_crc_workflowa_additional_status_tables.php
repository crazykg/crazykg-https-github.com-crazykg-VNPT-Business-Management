<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<int, string>
     */
    private array $tables = [
        'customer_request_assigned_to_receiver',
        'customer_request_analysis_completed',
        'customer_request_analysis_suspended',
        'customer_request_dms_task_created',
        'customer_request_dms_in_progress',
        'customer_request_dms_suspended',
        'customer_request_coding_in_progress',
        'customer_request_coding_suspended',
    ];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                continue;
            }

            Schema::create($tableName, function (Blueprint $table): void {
                $table->bigIncrements('id')->comment('ID dòng trạng thái');
                $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
                $table->unsignedBigInteger('status_instance_id')->nullable()->unique()->comment('Instance trạng thái');
                $table->dateTime('received_at')->nullable();
                $table->dateTime('completed_at')->nullable();
                $table->dateTime('extended_at')->nullable();
                $table->unsignedTinyInteger('progress_percent')->nullable();
                $table->unsignedBigInteger('from_user_id')->nullable()->index();
                $table->unsignedBigInteger('to_user_id')->nullable()->index();
                $table->text('notes')->nullable()->comment('Ghi chú trạng thái');
                $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
                $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
                $table->timestamps();

                $table->foreign('request_case_id')
                    ->references('id')
                    ->on('customer_request_cases')
                    ->onDelete('cascade');

                $table->foreign('status_instance_id')
                    ->references('id')
                    ->on('customer_request_status_instances')
                    ->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $tableName) {
            Schema::dropIfExists($tableName);
        }
    }
};
