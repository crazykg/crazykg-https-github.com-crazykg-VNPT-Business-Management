<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_request_cases', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID yêu cầu');
            $table->string('request_code', 50)->unique()->comment('Mã yêu cầu');
            $table->unsignedBigInteger('legacy_customer_request_id')->nullable()->index()->comment('ID yêu cầu cũ để truy vết');
            $table->unsignedBigInteger('customer_id')->nullable()->index()->comment('Khách hàng');
            $table->unsignedBigInteger('customer_personnel_id')->nullable()->index()->comment('Người yêu cầu phía khách hàng');
            $table->unsignedBigInteger('support_service_group_id')->nullable()->index()->comment('Nhóm hỗ trợ');
            $table->unsignedBigInteger('project_id')->nullable()->index()->comment('Dự án liên quan');
            $table->unsignedBigInteger('project_item_id')->nullable()->index()->comment('Hạng mục dự án');
            $table->unsignedBigInteger('product_id')->nullable()->index()->comment('Sản phẩm liên quan');
            $table->unsignedBigInteger('received_by_user_id')->nullable()->index()->comment('Người tiếp nhận');
            $table->string('requester_name_snapshot', 255)->nullable()->comment('Tên người yêu cầu chụp tại thời điểm tạo');
            $table->string('summary', 500)->comment('Nội dung yêu cầu');
            $table->text('description')->nullable()->comment('Mô tả chi tiết');
            $table->unsignedTinyInteger('priority')->default(2)->comment('Độ ưu tiên 1-4');
            $table->string('source_channel', 100)->nullable()->comment('Kênh tiếp nhận');
            $table->string('current_status_code', 80)->default('new_intake')->index()->comment('Trạng thái hiện tại');
            $table->unsignedBigInteger('current_status_instance_id')->nullable()->index()->comment('ID trạng thái hiện tại');
            $table->dateTime('received_at')->nullable()->comment('Ngày giờ tiếp nhận');
            $table->dateTime('completed_at')->nullable()->comment('Ngày hoàn thành');
            $table->dateTime('reported_to_customer_at')->nullable()->comment('Ngày báo khách hàng');
            $table->dateTime('current_status_changed_at')->nullable()->comment('Thời điểm đổi trạng thái gần nhất');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->softDeletes();
            $table->comment('Yêu cầu khách hàng - bảng master trung tâm');
        });

        Schema::create('customer_request_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID trạng thái');
            $table->string('status_code', 80)->unique()->comment('Mã trạng thái tiếng Anh');
            $table->string('status_name_vi', 255)->comment('Tên trạng thái tiếng Việt');
            $table->string('table_name', 120)->comment('Tên bảng trạng thái');
            $table->unsignedSmallInteger('sort_order')->default(0)->comment('Thứ tự hiển thị');
            $table->boolean('is_active')->default(true)->comment('Còn sử dụng');
            $table->timestamps();
            $table->comment('Danh mục trạng thái workflow yêu cầu khách hàng');
        });

        Schema::create('customer_request_status_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID cấu hình chuyển trạng thái');
            $table->string('from_status_code', 80)->comment('Trạng thái đi');
            $table->string('to_status_code', 80)->comment('Trạng thái đến');
            $table->string('direction', 20)->default('forward')->comment('Hướng chuyển trạng thái');
            $table->boolean('is_default')->default(false)->comment('Luồng mặc định');
            $table->boolean('is_active')->default(true)->comment('Còn hiệu lực');
            $table->unsignedSmallInteger('sort_order')->default(0)->comment('Thứ tự ưu tiên');
            $table->text('notes')->nullable()->comment('Ghi chú cấu hình');
            $table->timestamps();
            $table->unique(['from_status_code', 'to_status_code', 'direction'], 'uq_customer_request_status_transitions');
            $table->index(['from_status_code', 'is_active'], 'idx_customer_request_status_transitions_from');
            $table->comment('Cấu hình chuyển bước workflow yêu cầu khách hàng');
        });

        Schema::create('customer_request_status_instances', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID instance trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->string('status_code', 80)->comment('Mã trạng thái');
            $table->string('status_table', 120)->comment('Tên bảng trạng thái');
            $table->unsignedBigInteger('status_row_id')->nullable()->comment('ID dòng trạng thái thực tế');
            $table->unsignedBigInteger('previous_instance_id')->nullable()->index()->comment('Instance trạng thái trước');
            $table->unsignedBigInteger('next_instance_id')->nullable()->index()->comment('Instance trạng thái sau');
            $table->dateTime('entered_at')->nullable()->comment('Thời điểm vào trạng thái');
            $table->dateTime('exited_at')->nullable()->comment('Thời điểm rời trạng thái');
            $table->boolean('is_current')->default(true)->comment('Có phải trạng thái hiện tại');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo instance');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật instance');
            $table->timestamps();
            $table->foreign('request_case_id', 'fk_customer_request_status_instances_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->index(['request_case_id', 'status_code'], 'idx_customer_request_status_instances_case_status');
            $table->comment('Chuỗi trạng thái thực tế của từng yêu cầu');
        });

        $this->createStatusTable(
            'customer_request_waiting_customer_feedbacks',
            'Trạng thái đợi phản hồi từ khách hàng',
            function (Blueprint $table): void {
                $table->text('feedback_request_content')->nullable()->comment('Nội dung yêu cầu khách hàng phản hồi');
                $table->dateTime('feedback_requested_at')->nullable()->comment('Ngày gửi yêu cầu phản hồi');
                $table->dateTime('customer_due_at')->nullable()->comment('Hạn phản hồi của khách hàng');
                $table->dateTime('customer_feedback_at')->nullable()->comment('Ngày khách hàng phản hồi');
                $table->text('customer_feedback_content')->nullable()->comment('Nội dung khách hàng phản hồi');
            }
        );

        $this->createStatusTable(
            'customer_request_in_progress',
            'Trạng thái đang xử lý',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('performer_user_id')->nullable()->index()->comment('Người thực hiện');
                $table->dateTime('started_at')->nullable()->comment('Ngày bắt đầu xử lý');
                $table->dateTime('expected_completed_at')->nullable()->comment('Ngày dự kiến hoàn thành');
                $table->unsignedTinyInteger('progress_percent')->default(0)->comment('Tiến độ phần trăm');
                $table->text('processing_content')->nullable()->comment('Nội dung xử lý');
            }
        );

        $this->createStatusTable(
            'customer_request_not_executed',
            'Trạng thái không thực hiện',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('decision_by_user_id')->nullable()->index()->comment('Người xác nhận không thực hiện');
                $table->dateTime('decision_at')->nullable()->comment('Ngày xác nhận không thực hiện');
                $table->text('decision_reason')->nullable()->comment('Lý do không thực hiện');
            }
        );

        $this->createStatusTable(
            'customer_request_completed',
            'Trạng thái hoàn thành',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('completed_by_user_id')->nullable()->index()->comment('Người hoàn thành');
                $table->dateTime('completed_at')->nullable()->comment('Ngày hoàn thành');
                $table->text('result_content')->nullable()->comment('Kết quả thực hiện');
            }
        );

        $this->createStatusTable(
            'customer_request_customer_notified',
            'Trạng thái báo khách hàng',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('notified_by_user_id')->nullable()->index()->comment('Người báo khách hàng');
                $table->dateTime('notified_at')->nullable()->comment('Ngày báo khách hàng');
                $table->string('notification_channel', 100)->nullable()->comment('Kênh báo khách hàng');
                $table->text('notification_content')->nullable()->comment('Nội dung báo khách hàng');
                $table->text('customer_feedback')->nullable()->comment('Phản hồi của khách hàng');
            }
        );

        $this->createStatusTable(
            'customer_request_returned_to_manager',
            'Trạng thái chuyển trả người quản lý',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('returned_by_user_id')->nullable()->index()->comment('Người chuyển trả');
                $table->dateTime('returned_at')->nullable()->comment('Ngày chuyển trả');
                $table->text('return_reason')->nullable()->comment('Lý do chuyển trả');
            }
        );

        $this->createStatusTable(
            'customer_request_analysis',
            'Trạng thái phân tích',
            function (Blueprint $table): void {
                $table->unsignedBigInteger('performer_user_id')->nullable()->index()->comment('Người phân tích');
                $table->text('analysis_content')->nullable()->comment('Nội dung phân tích');
                $table->dateTime('analysis_completed_at')->nullable()->comment('Ngày hoàn thành phân tích');
            }
        );

        Schema::create('customer_request_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID worklog');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->comment('Instance trạng thái');
            $table->string('status_code', 80)->comment('Mã trạng thái');
            $table->unsignedBigInteger('performed_by_user_id')->nullable()->index()->comment('Người thực hiện');
            $table->text('work_content')->comment('Nội dung worklog');
            $table->dateTime('work_started_at')->nullable()->comment('Giờ bắt đầu');
            $table->dateTime('work_ended_at')->nullable()->comment('Giờ kết thúc');
            $table->decimal('hours_spent', 8, 2)->nullable()->comment('Số giờ thực hiện');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->foreign('request_case_id', 'fk_customer_request_worklogs_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_customer_request_worklogs_status_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('cascade');
            $table->index(['request_case_id', 'status_instance_id'], 'idx_customer_request_worklogs_case_status');
            $table->comment('Worklog dùng chung cho toàn bộ trạng thái yêu cầu khách hàng');
        });

        Schema::create('customer_request_status_ref_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID liên kết task tham chiếu');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->comment('Instance trạng thái');
            $table->unsignedBigInteger('ref_task_id')->nullable()->comment('Task tham chiếu');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->foreign('request_case_id', 'fk_customer_request_status_ref_tasks_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_customer_request_status_ref_tasks_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('cascade');
            $table->index(['status_instance_id', 'ref_task_id'], 'idx_customer_request_status_ref_tasks_lookup');
            $table->comment('Liên kết task tham chiếu theo từng trạng thái yêu cầu');
        });

        Schema::create('customer_request_status_attachments', function (Blueprint $table): void {
            $table->bigIncrements('id')->comment('ID liên kết file đính kèm');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->comment('Instance trạng thái');
            $table->unsignedBigInteger('attachment_id')->nullable()->comment('File đính kèm');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $table->timestamps();
            $table->foreign('request_case_id', 'fk_customer_request_status_attachments_case')
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', 'fk_customer_request_status_attachments_instance')
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('cascade');
            $table->index(['status_instance_id', 'attachment_id'], 'idx_customer_request_status_attachments_lookup');
            $table->comment('Liên kết file đính kèm theo từng trạng thái yêu cầu');
        });

        $this->addSharedForeignIfExists('customer_request_cases', 'customer_id', 'customers');
        $this->addSharedForeignIfExists('customer_request_cases', 'customer_personnel_id', 'customer_personnel');
        $this->addSharedForeignIfExists('customer_request_cases', 'support_service_group_id', 'support_service_groups');
        $this->addSharedForeignIfExists('customer_request_cases', 'project_id', 'projects');
        $this->addSharedForeignIfExists('customer_request_cases', 'project_item_id', 'project_items');
        $this->addSharedForeignIfExists('customer_request_cases', 'product_id', 'products');
        $this->addSharedForeignIfExists('customer_request_cases', 'received_by_user_id', 'internal_users');
        $this->addSharedForeignIfExists('customer_request_cases', 'created_by', 'internal_users');
        $this->addSharedForeignIfExists('customer_request_cases', 'updated_by', 'internal_users');

        foreach ([
            'customer_request_waiting_customer_feedbacks' => [],
            'customer_request_in_progress' => ['performer_user_id'],
            'customer_request_not_executed' => ['decision_by_user_id'],
            'customer_request_completed' => ['completed_by_user_id'],
            'customer_request_customer_notified' => ['notified_by_user_id'],
            'customer_request_returned_to_manager' => ['returned_by_user_id'],
            'customer_request_analysis' => ['performer_user_id'],
        ] as $tableName => $userColumns) {
            foreach (['created_by', 'updated_by', ...$userColumns] as $column) {
                $this->addSharedForeignIfExists($tableName, $column, 'internal_users');
            }
        }

        foreach ([
            'customer_request_status_instances' => ['created_by', 'updated_by'],
            'customer_request_worklogs' => ['performed_by_user_id', 'created_by', 'updated_by'],
            'customer_request_status_ref_tasks' => ['created_by', 'updated_by'],
            'customer_request_status_attachments' => ['created_by', 'updated_by'],
        ] as $tableName => $userColumns) {
            foreach ($userColumns as $column) {
                $this->addSharedForeignIfExists($tableName, $column, 'internal_users');
            }
        }

        $this->addSharedForeignIfExists('customer_request_status_ref_tasks', 'ref_task_id', 'request_ref_tasks');
        $this->addSharedForeignIfExists('customer_request_status_attachments', 'attachment_id', 'attachments');

        $this->seedStatusCatalogs();
        $this->seedStatusTransitions();
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        Schema::dropIfExists('customer_request_status_attachments');
        Schema::dropIfExists('customer_request_status_ref_tasks');
        Schema::dropIfExists('customer_request_worklogs');
        Schema::dropIfExists('customer_request_analysis');
        Schema::dropIfExists('customer_request_returned_to_manager');
        Schema::dropIfExists('customer_request_customer_notified');
        Schema::dropIfExists('customer_request_completed');
        Schema::dropIfExists('customer_request_not_executed');
        Schema::dropIfExists('customer_request_in_progress');
        Schema::dropIfExists('customer_request_waiting_customer_feedbacks');
        Schema::dropIfExists('customer_request_status_instances');
        Schema::dropIfExists('customer_request_status_transitions');
        Schema::dropIfExists('customer_request_status_catalogs');
        Schema::dropIfExists('customer_request_cases');

        Schema::enableForeignKeyConstraints();
    }

    private function createStatusTable(string $tableName, string $comment, \Closure $extraColumns): void
    {
        $constraintToken = substr(md5($tableName), 0, 10);

        Schema::create($tableName, function (Blueprint $table) use ($tableName, $comment, $extraColumns, $constraintToken): void {
            $table->bigIncrements('id')->comment('ID dòng trạng thái');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->text('notes')->nullable()->comment('Ghi chú');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');
            $extraColumns($table);
            $table->timestamps();
            $table->unique('status_instance_id', "uq_crs_{$constraintToken}_inst");
            $table->foreign('request_case_id', "fk_crs_{$constraintToken}_case")
                ->references('id')
                ->on('customer_request_cases')
                ->onDelete('cascade');
            $table->foreign('status_instance_id', "fk_crs_{$constraintToken}_inst")
                ->references('id')
                ->on('customer_request_status_instances')
                ->onDelete('set null');
            $table->index('request_case_id', "idx_crs_{$constraintToken}_case");
            $table->comment($comment);
        });
    }

    private function addSharedForeignIfExists(string $tableName, string $column, string $targetTable, string $targetColumn = 'id'): void
    {
        if (! Schema::hasTable($tableName) || ! Schema::hasTable($targetTable)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($column, $targetTable, $targetColumn, $tableName): void {
            $table->foreign($column, "fk_{$tableName}_{$column}")
                ->references($targetColumn)
                ->on($targetTable)
                ->nullOnDelete();
        });
    }

    private function seedStatusCatalogs(): void
    {
        $now = now();

        DB::table('customer_request_status_catalogs')->insert([
            ['status_code' => 'new_intake', 'status_name_vi' => 'Mới tiếp nhận', 'table_name' => 'customer_request_cases', 'sort_order' => 10, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'waiting_customer_feedback', 'status_name_vi' => 'Đợi phản hồi từ khách hàng', 'table_name' => 'customer_request_waiting_customer_feedbacks', 'sort_order' => 20, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'in_progress', 'status_name_vi' => 'Đang xử lý', 'table_name' => 'customer_request_in_progress', 'sort_order' => 30, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'not_executed', 'status_name_vi' => 'Không thực hiện', 'table_name' => 'customer_request_not_executed', 'sort_order' => 40, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'completed', 'status_name_vi' => 'Hoàn thành', 'table_name' => 'customer_request_completed', 'sort_order' => 50, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'customer_notified', 'status_name_vi' => 'Báo khách hàng', 'table_name' => 'customer_request_customer_notified', 'sort_order' => 60, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'returned_to_manager', 'status_name_vi' => 'Chuyển trả người quản lý', 'table_name' => 'customer_request_returned_to_manager', 'sort_order' => 70, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['status_code' => 'analysis', 'status_name_vi' => 'Phân tích', 'table_name' => 'customer_request_analysis', 'sort_order' => 80, 'is_active' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    private function seedStatusTransitions(): void
    {
        $now = now();
        $rows = [
            ['new_intake', 'waiting_customer_feedback', 'forward', 1, 10],
            ['new_intake', 'in_progress', 'forward', 0, 20],
            ['new_intake', 'analysis', 'forward', 0, 30],
            ['new_intake', 'returned_to_manager', 'forward', 0, 40],
            ['new_intake', 'not_executed', 'forward', 0, 50],
            ['waiting_customer_feedback', 'in_progress', 'forward', 1, 10],
            ['waiting_customer_feedback', 'returned_to_manager', 'forward', 0, 20],
            ['waiting_customer_feedback', 'not_executed', 'forward', 0, 30],
            ['analysis', 'in_progress', 'forward', 1, 10],
            ['analysis', 'returned_to_manager', 'forward', 0, 20],
            ['analysis', 'not_executed', 'forward', 0, 30],
            ['returned_to_manager', 'analysis', 'forward', 1, 10],
            ['returned_to_manager', 'in_progress', 'forward', 0, 20],
            ['returned_to_manager', 'waiting_customer_feedback', 'forward', 0, 30],
            ['returned_to_manager', 'not_executed', 'forward', 0, 40],
            ['in_progress', 'completed', 'forward', 1, 10],
            ['in_progress', 'waiting_customer_feedback', 'forward', 0, 20],
            ['in_progress', 'analysis', 'forward', 0, 30],
            ['in_progress', 'returned_to_manager', 'forward', 0, 40],
            ['in_progress', 'not_executed', 'forward', 0, 50],
            ['completed', 'customer_notified', 'forward', 1, 10],
            ['completed', 'in_progress', 'backward', 0, 20],
            ['customer_notified', 'completed', 'backward', 1, 10],
            ['waiting_customer_feedback', 'new_intake', 'backward', 0, 40],
            ['analysis', 'new_intake', 'backward', 0, 40],
            ['returned_to_manager', 'new_intake', 'backward', 0, 50],
            ['in_progress', 'new_intake', 'backward', 0, 60],
            ['in_progress', 'analysis', 'backward', 0, 70],
            ['in_progress', 'returned_to_manager', 'backward', 0, 80],
            ['not_executed', 'returned_to_manager', 'backward', 1, 10],
            ['not_executed', 'analysis', 'backward', 0, 20],
            ['not_executed', 'new_intake', 'backward', 0, 30],
        ];

        DB::table('customer_request_status_transitions')->insert(array_map(
            static fn (array $row): array => [
                'from_status_code' => $row[0],
                'to_status_code' => $row[1],
                'direction' => $row[2],
                'is_default' => (bool) $row[3],
                'is_active' => true,
                'sort_order' => $row[4],
                'notes' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            $rows
        ));
    }
};
