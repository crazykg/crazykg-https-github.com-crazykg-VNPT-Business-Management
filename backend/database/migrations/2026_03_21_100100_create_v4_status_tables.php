<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V4 Migration P1.2
 * Create 4 new status tables:
 *   - customer_request_pending_dispatch
 *   - customer_request_dispatched
 *   - customer_request_coding
 *   - customer_request_dms_transfer
 *
 * Uses the same createStatusTable() pattern as the existing
 * 2026_03_16_220000_create_customer_request_case_workflow_tables.php migration.
 * SQLite-safe: no ENUM, no raw MySQL DDL.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Chờ PM điều phối ─────────────────────────────────────────────
        if (! Schema::hasTable('customer_request_pending_dispatch')) {
            $this->createStatusTable(
                'customer_request_pending_dispatch',
                'Trạng thái chờ PM điều phối',
                function (Blueprint $table): void {
                    $table->text('dispatch_note')->nullable()->comment('Ghi chú từ Creator khi giao PM');
                    $table->decimal('estimated_hours_by_creator', 8, 2)->nullable()->comment('Ước lượng giờ của Creator');
                }
            );
        }

        // ── 2. Đã phân công ─────────────────────────────────────────────────
        if (! Schema::hasTable('customer_request_dispatched')) {
            $this->createStatusTable(
                'customer_request_dispatched',
                'Trạng thái đã phân công performer',
                function (Blueprint $table): void {
                    // 'assign_performer' | 'self_handle'
                    $table->string('dispatch_decision', 30)->nullable()->comment('Quyết định của PM');
                    $table->unsignedBigInteger('performer_user_id')->nullable()->index()->comment('Performer được giao');
                    $table->decimal('estimated_hours_by_dispatcher', 8, 2)->nullable()->comment('Ước lượng giờ của PM');
                    $table->text('dispatch_note')->nullable()->comment('Ghi chú phân công');
                }
            );
        }

        // ── 3. Đang lập trình ────────────────────────────────────────────────
        if (! Schema::hasTable('customer_request_coding')) {
            $this->createStatusTable(
                'customer_request_coding',
                'Trạng thái đang lập trình',
                function (Blueprint $table): void {
                    $table->unsignedBigInteger('developer_user_id')->nullable()->index()->comment('Dev thực hiện');
                    $table->text('coding_content')->nullable()->comment('Nội dung lập trình');
                    $table->dateTime('coding_started_at')->nullable()->comment('Thời điểm bắt đầu');
                    $table->dateTime('coding_completed_at')->nullable()->comment('Thời điểm hoàn thành code');
                    // 'coding' | 'coding_done' | 'upcode_pending' | 'upcode_deployed' | 'suspended'
                    $table->string('coding_phase', 30)->default('coding')->index()->comment('Sub-status lập trình');
                    $table->dateTime('upcode_at')->nullable()->comment('Thời điểm upcode');
                    $table->string('upcode_version', 100)->nullable()->comment('Phiên bản upcode');
                    $table->string('upcode_environment', 50)->nullable()->comment('Môi trường upcode');
                }
            );
        }

        // ── 4. Chuyển DMS ────────────────────────────────────────────────────
        if (! Schema::hasTable('customer_request_dms_transfer')) {
            $this->createStatusTable(
                'customer_request_dms_transfer',
                'Trạng thái chuyển DMS',
                function (Blueprint $table): void {
                    $table->unsignedBigInteger('dms_contact_user_id')->nullable()->index()->comment('Người phụ trách DMS');
                    $table->text('exchange_content')->nullable()->comment('Nội dung trao đổi');
                    $table->string('task_ref', 200)->nullable()->comment('Mã task DMS');
                    $table->string('task_url', 500)->nullable()->comment('URL task DMS');
                    // 'exchange' | 'task_created' | 'in_progress' | 'completed' | 'suspended'
                    $table->string('dms_phase', 30)->default('exchange')->index()->comment('Sub-status DMS');
                    $table->dateTime('dms_started_at')->nullable()->comment('Thời điểm bắt đầu DMS');
                    $table->dateTime('dms_completed_at')->nullable()->comment('Thời điểm hoàn thành DMS');
                }
            );
        }
    }

    public function down(): void
    {
        foreach ([
            'customer_request_dms_transfer',
            'customer_request_coding',
            'customer_request_dispatched',
            'customer_request_pending_dispatch',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    // ── private helper (mirrors pattern in 2026_03_16_220000_create_...php) ──

    private function createStatusTable(string $tableName, string $comment, \Closure $extraColumns): void
    {
        $constraintToken = substr(md5($tableName), 0, 10);

        Schema::create($tableName, function (Blueprint $table) use ($tableName, $comment, $extraColumns, $constraintToken): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_case_id')->comment('Yêu cầu');
            $table->unsignedBigInteger('status_instance_id')->nullable()->comment('Instance trạng thái');
            $table->text('notes')->nullable()->comment('Ghi chú');
            $table->unsignedBigInteger('created_by')->nullable()->index()->comment('Người tạo');
            $table->unsignedBigInteger('updated_by')->nullable()->index()->comment('Người cập nhật');

            // Status-specific columns
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
};
