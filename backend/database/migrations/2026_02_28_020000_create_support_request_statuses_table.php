<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @return array<int, array<string, mixed>>
     */
    private function defaultStatuses(): array
    {
        return [
            [
                'status_code' => 'NEW',
                'status_name' => 'Mới tiếp nhận',
                'description' => 'Yêu cầu vừa được ghi nhận',
                'requires_completion_dates' => false,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'status_code' => 'IN_PROGRESS',
                'status_name' => 'Đang xử lý',
                'description' => 'Yêu cầu đang được thực hiện',
                'requires_completion_dates' => true,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 20,
            ],
            [
                'status_code' => 'WAITING_CUSTOMER',
                'status_name' => 'Chờ phản hồi KH',
                'description' => 'Đang chờ khách hàng phản hồi',
                'requires_completion_dates' => true,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 30,
            ],
            [
                'status_code' => 'COMPLETED',
                'status_name' => 'Hoàn thành',
                'description' => 'Yêu cầu đã hoàn tất',
                'requires_completion_dates' => true,
                'is_terminal' => true,
                'is_active' => true,
                'sort_order' => 40,
            ],
            [
                'status_code' => 'PAUSED',
                'status_name' => 'Tạm dừng',
                'description' => 'Yêu cầu tạm dừng xử lý',
                'requires_completion_dates' => true,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 50,
            ],
            [
                'status_code' => 'TRANSFER_DEV',
                'status_name' => 'Chuyển dev',
                'description' => 'Yêu cầu chuyển cho đội phát triển',
                'requires_completion_dates' => true,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 60,
            ],
            [
                'status_code' => 'TRANSFER_DMS',
                'status_name' => 'Chuyển DMS',
                'description' => 'Yêu cầu chuyển sang đội DMS',
                'requires_completion_dates' => true,
                'is_terminal' => false,
                'is_active' => true,
                'sort_order' => 70,
            ],
            [
                'status_code' => 'UNABLE_TO_EXECUTE',
                'status_name' => 'Không thực hiện được',
                'description' => 'Không thể thực hiện yêu cầu',
                'requires_completion_dates' => true,
                'is_terminal' => true,
                'is_active' => true,
                'sort_order' => 80,
            ],
        ];
    }

    public function up(): void
    {
        $this->createStatusMasterTable();
        $this->seedDefaultStatuses();
        $this->normalizeStatusColumnsToVarchar();
    }

    public function down(): void
    {
        Schema::dropIfExists('support_request_statuses');
    }

    private function createStatusMasterTable(): void
    {
        if (Schema::hasTable('support_request_statuses')) {
            return;
        }

        Schema::create('support_request_statuses', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('status_code', 50)->unique('uq_support_request_statuses_code');
            $table->string('status_name', 120);
            $table->string('description', 255)->nullable();
            $table->boolean('requires_completion_dates')->default(true);
            $table->boolean('is_terminal')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'sort_order'], 'idx_support_request_statuses_active_sort');
        });

        if (Schema::hasTable('internal_users') && Schema::hasColumn('internal_users', 'id')) {
            Schema::table('support_request_statuses', function (Blueprint $table): void {
                $table->foreign('created_by', 'fk_support_request_statuses_created_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();

                $table->foreign('updated_by', 'fk_support_request_statuses_updated_by')
                    ->references('id')
                    ->on('internal_users')
                    ->nullOnDelete();
            });
        }
    }

    private function seedDefaultStatuses(): void
    {
        if (! Schema::hasTable('support_request_statuses')) {
            return;
        }

        $now = now();
        foreach ($this->defaultStatuses() as $row) {
            $statusCode = strtoupper(trim((string) ($row['status_code'] ?? '')));
            if ($statusCode === '') {
                continue;
            }

            $payload = [
                'status_code' => $statusCode,
                'status_name' => (string) ($row['status_name'] ?? $statusCode),
                'description' => $row['description'] ?? null,
                'requires_completion_dates' => (bool) ($row['requires_completion_dates'] ?? true),
                'is_terminal' => (bool) ($row['is_terminal'] ?? false),
                'is_active' => (bool) ($row['is_active'] ?? true),
                'sort_order' => (int) ($row['sort_order'] ?? 0),
                'updated_at' => $now,
            ];

            DB::table('support_request_statuses')->updateOrInsert(
                ['status_code' => $statusCode],
                array_merge($payload, ['created_at' => $now])
            );
        }
    }

    private function normalizeStatusColumnsToVarchar(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('support_requests') && Schema::hasColumn('support_requests', 'status')) {
            DB::statement("UPDATE `support_requests` SET `status` = 'NEW' WHERE `status` = 'OPEN'");
            DB::statement("UPDATE `support_requests` SET `status` = 'TRANSFER_DEV' WHERE `status` = 'HOTFIXING'");
            DB::statement("UPDATE `support_requests` SET `status` = 'COMPLETED' WHERE `status` IN ('RESOLVED', 'DEPLOYED')");
            DB::statement("UPDATE `support_requests` SET `status` = 'WAITING_CUSTOMER' WHERE `status` = 'PENDING'");
            DB::statement("UPDATE `support_requests` SET `status` = 'UNABLE_TO_EXECUTE' WHERE `status` = 'CANCELLED'");
            DB::statement("UPDATE `support_requests` SET `status` = 'NEW' WHERE `status` IS NULL OR TRIM(`status`) = ''");

            DB::statement("ALTER TABLE `support_requests` MODIFY COLUMN `status` VARCHAR(50) NULL DEFAULT 'NEW'");
        }

        if (Schema::hasTable('support_request_history') && Schema::hasColumn('support_request_history', 'old_status')) {
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'NEW' WHERE `old_status` = 'OPEN'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'TRANSFER_DEV' WHERE `old_status` = 'HOTFIXING'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'COMPLETED' WHERE `old_status` IN ('RESOLVED', 'DEPLOYED')");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'WAITING_CUSTOMER' WHERE `old_status` = 'PENDING'");
            DB::statement("UPDATE `support_request_history` SET `old_status` = 'UNABLE_TO_EXECUTE' WHERE `old_status` = 'CANCELLED'");

            DB::statement("ALTER TABLE `support_request_history` MODIFY COLUMN `old_status` VARCHAR(50) NULL");
        }

        if (Schema::hasTable('support_request_history') && Schema::hasColumn('support_request_history', 'new_status')) {
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'NEW' WHERE `new_status` = 'OPEN'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'TRANSFER_DEV' WHERE `new_status` = 'HOTFIXING'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'COMPLETED' WHERE `new_status` IN ('RESOLVED', 'DEPLOYED')");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'WAITING_CUSTOMER' WHERE `new_status` = 'PENDING'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'UNABLE_TO_EXECUTE' WHERE `new_status` = 'CANCELLED'");
            DB::statement("UPDATE `support_request_history` SET `new_status` = 'NEW' WHERE `new_status` IS NULL OR TRIM(`new_status`) = ''");

            DB::statement("ALTER TABLE `support_request_history` MODIFY COLUMN `new_status` VARCHAR(50) NOT NULL DEFAULT 'NEW'");
        }
    }
};
