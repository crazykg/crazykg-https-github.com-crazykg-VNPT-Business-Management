<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestCaseWorkflowCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCustomerRequestCaseSchema();
    }

    public function test_status_catalog_and_transition_config_return_seeded_metadata(): void
    {
        $this->getJson('/api/v5/customer-request-statuses')
            ->assertOk()
            ->assertJsonPath('data.master_fields.0.name', 'project_item_id')
            ->assertJsonPath('data.groups.0.group_code', 'intake')
            ->assertJsonPath('data.statuses.0.status_code', 'new_intake');

        $this->getJson('/api/v5/customer-request-status-transitions')
            ->assertOk()
            ->assertJsonPath('data.0.from_status_code', 'new_intake')
            ->assertJsonPath('data.0.to_status_code', 'waiting_customer_feedback');
    }

    public function test_store_case_creates_master_initial_status_instance_and_shared_links(): void
    {
        $response = $this->postJson('/api/v5/customer-request-cases', $this->createPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.request_case.request_code', 'CRC-202603-0001')
            ->assertJsonPath('data.request_case.current_status_code', 'new_intake')
            ->assertJsonPath('data.request_case.source_channel', 'Phone')
            ->assertJsonPath('data.current_status.status_code', 'new_intake')
            ->assertJsonPath('data.status_row.data.received_by_user_id', 1)
            ->assertJsonPath('data.attachments.0.fileName', 'yeu-cau.pdf')
            ->assertJsonPath('data.ref_tasks.0.task_code', 'TASK-001')
            ->assertJsonFragment(['task_code' => 'IT360-001']);

        $caseId = (int) $response->json('data.request_case.id');
        $instanceId = (int) $response->json('data.status_instance.id');

        $this->assertSame(1, DB::table('customer_request_cases')->count());
        $this->assertSame(1, DB::table('customer_request_status_instances')->count());
        $this->assertSame(2, DB::table('customer_request_status_ref_tasks')->count());
        $this->assertSame(1, DB::table('customer_request_status_attachments')->count());

        $this->assertSame('new_intake', DB::table('customer_request_cases')->where('id', $caseId)->value('current_status_code'));
        $this->assertSame($instanceId, (int) DB::table('customer_request_cases')->where('id', $caseId)->value('current_status_instance_id'));
        $this->assertSame(1, (int) DB::table('customer_request_cases')->where('id', $caseId)->value('received_by_user_id'));
        $this->assertNotNull(DB::table('customer_request_cases')->where('id', $caseId)->value('received_at'));
        $this->assertSame('Phone', DB::table('customer_request_cases')->where('id', $caseId)->value('source_channel'));
        $this->assertSame(2, DB::table('request_ref_tasks')->count());
        $this->assertDatabaseHas('request_ref_tasks', [
            'task_code' => 'IT360-001',
            'task_source' => 'IT360',
            'task_status' => 'IN_PROGRESS',
        ]);
        $this->assertFalse(Schema::hasColumn('customer_request_cases', 'receiver_user_id'));
        $this->assertFalse(Schema::hasColumn('customer_request_cases', 'requested_at'));
        $this->assertFalse(Schema::hasColumn('customer_request_cases', 'intake_notes'));
    }

    public function test_show_worklog_and_index_by_status_follow_current_instance(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');
        $instanceId = (int) $created->json('data.status_instance.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 1,
            'performed_by_user_id' => 3,
            'work_content' => 'Da lien he khach hang va tiep nhan thong tin.',
            'work_started_at' => '2026-03-17 08:00:00',
            'work_ended_at' => '2026-03-17 09:30:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status_instance_id', $instanceId)
            ->assertJsonPath('data.performed_by_name', 'Người xử lý');

        $this->getJson('/api/v5/customer-request-cases?status_code=new_intake')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.request_code', 'CRC-202603-0001')
            ->assertJsonPath('data.0.received_by_name', 'Người tạo');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}")
            ->assertOk()
            ->assertJsonPath('data.request_code', 'CRC-202603-0001')
            ->assertJsonPath('data.support_service_group_name', 'Nhóm SOC 01');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/statuses/new_intake")
            ->assertOk()
            ->assertJsonPath('data.worklogs.0.work_content', 'Da lien he khach hang va tiep nhan thong tin.')
            ->assertJsonPath('data.attachments.0.fileName', 'yeu-cau.pdf')
            ->assertJsonPath('data.ref_tasks.0.task_code', 'TASK-001');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/people")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.vai_tro', 'nguoi_nhap')
            ->assertJsonPath('data.2.vai_tro', 'nguoi_xu_ly')
            ->assertJsonPath('data.2.user_name', 'Người xử lý');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/timeline")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status_code', 'new_intake');
    }

    public function test_transition_moves_case_forward_and_invalid_transition_returns_422(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');
        $firstInstanceId = (int) $created->json('data.status_instance.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'new_intake',
            'updated_by' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang chính trạng thái hiện tại.');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'in_progress',
            'updated_by' => 1,
            'status_payload' => [
                'performer_user_id' => 3,
                'started_at' => '2026-03-17 10:00:00',
                'expected_completed_at' => '2026-03-18 17:00:00',
                'progress_percent' => 35,
                'processing_content' => 'Dang xu ly va cap nhat he thong.',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'in_progress')
            ->assertJsonPath('data.status.status_code', 'in_progress')
            ->assertJsonPath('data.status_row.data.performer_user_id', 3)
            ->assertJsonPath('data.status_row.data.progress_percent', 35);

        $this->assertSame(2, DB::table('customer_request_status_instances')->count());
        $this->assertSame(1, DB::table('customer_request_in_progress')->count());

        $previous = DB::table('customer_request_status_instances')->where('id', $firstInstanceId)->first();
        $current = DB::table('customer_request_status_instances')->where('is_current', 1)->first();
        $this->assertNotNull($previous);
        $this->assertNotNull($current);
        $this->assertSame(0, (int) $previous->is_current);
        $this->assertSame((int) $current->id, (int) $previous->next_instance_id);
        $this->assertSame((int) $previous->id, (int) $current->previous_instance_id);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'customer_notified',
            'updated_by' => 1,
            'status_payload' => [
                'notified_by_user_id' => 2,
                'notified_at' => '2026-03-17 12:00:00',
            ],
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');
    }

    public function test_destroy_case_soft_deletes_for_admin(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        $this->deleteJson("/api/v5/customer-request-cases/{$caseId}", [
            'updated_by' => 9,
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Đã xóa yêu cầu thành công.');

        $this->assertNotNull(DB::table('customer_request_cases')->where('id', $caseId)->value('deleted_at'));
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function createPayload(array $overrides = []): array
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

    private function setUpCustomerRequestCaseSchema(): void
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
            'id' => 10,
            'customer_name' => 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang',
        ]);

        DB::table('customer_personnel')->insert([
            'id' => 20,
            'full_name' => 'Nguyễn Văn A',
            'customer_id' => 10,
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 30,
            'group_name' => 'Nhóm SOC 01',
            'customer_id' => 10,
        ]);

        DB::table('projects')->insert([
            'id' => 200,
            'project_name' => 'Dự án SOC',
        ]);

        DB::table('products')->insert([
            'id' => 300,
            'product_name' => 'Phần mềm SOC',
        ]);

        DB::table('project_items')->insert([
            'id' => 100,
            'project_id' => 200,
            'product_id' => 300,
            'customer_id' => 10,
            'display_name' => 'SOC Item',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 1, 'user_code' => 'U001', 'username' => 'creator', 'full_name' => 'Người tạo', 'department_id' => 10],
            ['id' => 2, 'user_code' => 'U002', 'username' => 'receiver', 'full_name' => 'Người tiếp nhận', 'department_id' => 10],
            ['id' => 3, 'user_code' => 'U003', 'username' => 'assignee', 'full_name' => 'Người xử lý', 'department_id' => 10],
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
    }

    private function dropCustomerRequestCaseSchema(): void
    {
        Schema::disableForeignKeyConstraints();

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
