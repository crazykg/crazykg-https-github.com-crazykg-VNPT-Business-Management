<?php

namespace Tests\Feature\Concerns;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

trait InteractsWithCustomerRequestCaseFixtures
{
    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    protected function createPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'created_by' => 1,
            'updated_by' => 1,
            'master_payload' => [
                'customer_id' => 10,
                'customer_personnel_id' => 20,
                'support_service_group_id' => 30,
                'project_id' => 200,
                'project_item_id' => 100,
                'product_id' => 300,
                'summary' => 'Đồng bộ mẫu báo cáo giám sát SOC',
                'description' => 'Khách hàng yêu cầu đồng bộ biểu mẫu báo cáo tuần.',
                'priority' => 3,
                'source_channel' => 'Phone',
            ],
            'ref_tasks' => [
                50,
                [
                    'task_source' => 'IT360',
                    'task_code' => 'IT360-001',
                    'task_link' => 'https://it360.example.test/tasks/it360-001',
                    'task_status' => 'IN_PROGRESS',
                ],
            ],
            'attachments' => [60],
        ], $overrides);
    }

    protected function setUpCustomerRequestCaseSchema(): void
    {
        $this->dropCustomerRequestCaseSchema();

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('customer_personnel', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('dept_id')->nullable();
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('product_name', 255)->nullable();
        });

        Schema::create('project_items', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('display_name', 255)->nullable();
        });

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 2);
            $table->timestamp('assigned_date')->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('request_ref_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 50)->nullable();
            $table->string('task_code', 50)->nullable();
            $table->string('task_link', 255)->nullable();
            $table->string('task_source', 100)->nullable();
            $table->string('task_status', 100)->nullable();
            $table->text('task_note')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('file_name', 255)->nullable();
            $table->string('file_url', 255)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('role_code', 50);
        });

        Schema::create('user_roles', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('role_id');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 120)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('action', 50)->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('customers')->insert([
            [
                'id' => 10,
                'customer_name' => 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',
            ],
            [
                'id' => 11,
                'customer_name' => 'Trung tâm Y tế khu vực Long Mỹ',
            ],
        ]);

        DB::table('customer_personnel')->insert([
            [
                'id' => 20,
                'full_name' => 'Nguyễn Văn A',
                'customer_id' => 10,
            ],
            [
                'id' => 21,
                'full_name' => 'Trần Thị B',
                'customer_id' => 11,
            ],
        ]);

        DB::table('support_service_groups')->insert([
            [
                'id' => 30,
                'group_name' => 'Nhóm SOC 01',
                'customer_id' => 10,
            ],
            [
                'id' => 31,
                'group_name' => 'Nhóm NOC 02',
                'customer_id' => 11,
            ],
        ]);

        DB::table('projects')->insert([
            [
                'id' => 200,
                'project_name' => 'Dự án SOC',
                'dept_id' => 10,
            ],
            [
                'id' => 201,
                'project_name' => 'Dự án NOC',
                'dept_id' => 11,
            ],
        ]);

        DB::table('products')->insert([
            'id' => 300,
            'product_name' => 'Phần mềm SOC',
        ]);

        DB::table('project_items')->insert([
            [
                'id' => 100,
                'project_id' => 200,
                'product_id' => 300,
                'customer_id' => 10,
                'display_name' => 'SOC Item',
            ],
            [
                'id' => 101,
                'project_id' => 201,
                'product_id' => 300,
                'customer_id' => 11,
                'display_name' => 'NOC Item',
            ],
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'U001', 'username' => 'creator', 'full_name' => 'Người tạo', 'department_id' => 10],
            ['id' => 2, 'user_code' => 'U002', 'username' => 'receiver', 'full_name' => 'Người tiếp nhận', 'department_id' => 10],
            ['id' => 3, 'user_code' => 'U003', 'username' => 'assignee', 'full_name' => 'Người xử lý', 'department_id' => 10],
            ['id' => 4, 'user_code' => 'U004', 'username' => 'outsider', 'full_name' => 'Người ngoài phạm vi', 'department_id' => 10],
            ['id' => 9, 'user_code' => 'U009', 'username' => 'admin', 'full_name' => 'Quản trị viên', 'department_id' => 10],
        ]);

        DB::table('raci_assignments')->insert([
            'entity_type' => 'project',
            'entity_id' => 200,
            'user_id' => 3,
            'raci_role' => 'A',
            'assigned_date' => now(),
        ]);

        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'ADMIN',
        ]);

        DB::table('user_roles')->insert([
            'user_id' => 9,
            'role_id' => 1,
            'is_active' => 1,
        ]);

        DB::table('request_ref_tasks')->insert([
            'id' => 50,
            'request_code' => 'REF-001',
            'task_code' => 'TASK-001',
            'task_link' => 'https://example.test/tasks/1',
            'task_source' => 'DMS',
            'task_status' => 'OPEN',
            'task_note' => 'Task tham chiếu',
            'sort_order' => 10,
        ]);

        DB::table('attachments')->insert([
            'id' => 60,
            'file_name' => 'yeu-cau.pdf',
            'file_url' => 'https://example.test/files/yeu-cau.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1024,
            'created_at' => now(),
        ]);

        $baseMigration = require base_path('database/migrations/2026_03_16_220000_create_customer_request_case_workflow_tables.php');
        $baseMigration->up();

        $followUpMigration = require base_path('database/migrations/2026_03_17_090000_merge_new_intake_into_customer_request_cases.php');
        $followUpMigration->up();

        $dropIntakeNotesMigration = require base_path('database/migrations/2026_03_17_182000_drop_intake_notes_from_customer_request_cases.php');
        $dropIntakeNotesMigration->up();

        $addCaseMetricsMigration = require base_path('database/migrations/2026_03_21_090000_add_roles_and_metrics_to_customer_request_cases.php');
        $addCaseMetricsMigration->up();

        $extendWorklogsMigration = require base_path('database/migrations/2026_03_21_090100_add_extended_fields_to_customer_request_worklogs.php');
        $extendWorklogsMigration->up();

        $createEstimatesMigration = require base_path('database/migrations/2026_03_21_090200_create_customer_request_estimates.php');
        $createEstimatesMigration->up();

        // V4 migrations: 4 new status tables + dispatch columns + seeder
        $v4DispatchColumnsMigration = require base_path('database/migrations/2026_03_21_100000_add_v4_dispatch_columns_to_customer_request_cases.php');
        $v4DispatchColumnsMigration->up();

        $v4StatusTablesMigration = require base_path('database/migrations/2026_03_21_100100_create_v4_status_tables.php');
        $v4StatusTablesMigration->up();

        $v4CatalogSeederMigration = require base_path('database/migrations/2026_03_21_100200_seed_v4_status_catalog_and_transitions.php');
        $v4CatalogSeederMigration->up();

        $alignXmlRuntimeMigration = require base_path('database/migrations/2026_03_23_100000_fix_workflow_align_xml_remove_dispatched.php');
        $alignXmlRuntimeMigration->up();

        $pmDecisionMetadataMigration = require base_path('database/migrations/2026_03_24_090000_add_pm_decision_metadata_to_customer_request_status_instances.php');
        $pmDecisionMetadataMigration->up();

        $alignInProgressTransitionsMigration = require base_path('database/migrations/2026_03_25_100000_align_in_progress_transitions_with_xml.php');
        $alignInProgressTransitionsMigration->up();
    }

    protected function dropCustomerRequestCaseSchema(): void
    {
        Schema::disableForeignKeyConstraints();

        // V4 teardown (reverse order)
        $alignInProgressTransitionsMigration = require base_path('database/migrations/2026_03_25_100000_align_in_progress_transitions_with_xml.php');
        $alignInProgressTransitionsMigration->down();

        $pmDecisionMetadataMigration = require base_path('database/migrations/2026_03_24_090000_add_pm_decision_metadata_to_customer_request_status_instances.php');
        $pmDecisionMetadataMigration->down();

        $alignXmlRuntimeMigration = require base_path('database/migrations/2026_03_23_100000_fix_workflow_align_xml_remove_dispatched.php');
        $alignXmlRuntimeMigration->down();

        $v4CatalogSeederMigration = require base_path('database/migrations/2026_03_21_100200_seed_v4_status_catalog_and_transitions.php');
        $v4CatalogSeederMigration->down();

        $v4StatusTablesMigration = require base_path('database/migrations/2026_03_21_100100_create_v4_status_tables.php');
        $v4StatusTablesMigration->down();

        $v4DispatchColumnsMigration = require base_path('database/migrations/2026_03_21_100000_add_v4_dispatch_columns_to_customer_request_cases.php');
        $v4DispatchColumnsMigration->down();

        $createEstimatesMigration = require base_path('database/migrations/2026_03_21_090200_create_customer_request_estimates.php');
        $createEstimatesMigration->down();

        $extendWorklogsMigration = require base_path('database/migrations/2026_03_21_090100_add_extended_fields_to_customer_request_worklogs.php');
        $extendWorklogsMigration->down();

        $addCaseMetricsMigration = require base_path('database/migrations/2026_03_21_090000_add_roles_and_metrics_to_customer_request_cases.php');
        $addCaseMetricsMigration->down();

        $followUpMigration = require base_path('database/migrations/2026_03_17_090000_merge_new_intake_into_customer_request_cases.php');
        $followUpMigration->down();

        $dropIntakeNotesMigration = require base_path('database/migrations/2026_03_17_182000_drop_intake_notes_from_customer_request_cases.php');
        $dropIntakeNotesMigration->down();

        $baseMigration = require base_path('database/migrations/2026_03_16_220000_create_customer_request_case_workflow_tables.php');
        $baseMigration->down();

        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('request_ref_tasks');
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('project_items');
        Schema::dropIfExists('products');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customer_personnel');
        Schema::dropIfExists('customers');

        Schema::enableForeignKeyConstraints();
    }
}
