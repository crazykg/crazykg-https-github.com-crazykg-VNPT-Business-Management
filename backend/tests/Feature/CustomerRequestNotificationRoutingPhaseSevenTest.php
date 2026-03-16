<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestNotificationRoutingPhaseSevenTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
    }

    public function test_update_transition_logs_notifications_for_resolved_roles(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $service->update(100, [
            'status_catalog_id' => 3,
            'summary' => 'Đã duyệt yêu cầu',
        ], 10);

        $logs = DB::table('workflow_notification_logs')
            ->where('customer_request_id', 100)
            ->orderBy('target_role')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->all();

        $this->assertCount(4, $logs);

        $recipientMap = [];
        foreach ($logs as $log) {
            $recipientMap[(string) $log['target_role']] = (int) ($log['recipient_user_id'] ?? 0);
            $this->assertSame('APPROVE', $log['action_code']);
            $this->assertSame('IN_APP', $log['channel']);
            $this->assertSame('RESOLVED', $log['delivery_status']);
        }

        $this->assertSame([
            'ADMIN' => 99,
            'CREATOR' => 30,
            'EXECUTOR' => 20,
            'PM' => 10,
        ], $recipientMap);
    }

    public function test_update_transition_marks_notification_target_as_skipped_when_recipient_is_missing(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $service->update(101, [
            'status_catalog_id' => 3,
            'summary' => 'Đã duyệt nhưng chưa có người xử lý',
            'workflow_action_code' => 'APPROVE_NO_ASSIGNEE',
        ], 10);

        $log = DB::table('workflow_notification_logs')
            ->where('customer_request_id', 101)
            ->first();

        $this->assertNotNull($log);
        $this->assertSame('EXECUTOR', $log->target_role);
        $this->assertNull($log->recipient_user_id);
        $this->assertSame('SKIPPED', $log->delivery_status);

        $payload = json_decode((string) ($log->payload_json ?? ''), true);
        $this->assertIsArray($payload);
        $this->assertSame('recipient_not_resolved', $payload['reason'] ?? null);
        $this->assertSame('DA_DUYET', $payload['to_status'] ?? null);
    }

    public function test_update_uses_matching_action_code_when_multiple_transitions_share_the_same_target(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $service->update(102, [
            'status_catalog_id' => 3,
            'summary' => 'Force approve',
            'workflow_action_code' => 'FORCE_APPROVE',
        ], 10);

        $logs = DB::table('workflow_notification_logs')
            ->where('customer_request_id', 102)
            ->orderBy('id')
            ->get()
            ->map(fn (object $row): array => (array) $row)
            ->all();

        $this->assertCount(1, $logs);
        $this->assertSame('ADMIN', $logs[0]['target_role']);
        $this->assertSame(99, (int) $logs[0]['recipient_user_id']);
        $this->assertSame('FORCE_APPROVE', $logs[0]['action_code']);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('workflow_notification_logs');
        Schema::dropIfExists('request_transitions');
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_transitions');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
        });

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('full_name', 255)->nullable();
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

        Schema::create('workflow_status_catalogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('canonical_status', 50)->nullable();
            $table->string('canonical_sub_status', 50)->nullable();
            $table->string('flow_step', 20)->nullable();
            $table->string('form_key', 120)->nullable();
            $table->boolean('is_leaf')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('workflow_status_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('from_status_catalog_id');
            $table->unsignedBigInteger('to_status_catalog_id');
            $table->string('action_code', 80);
            $table->string('action_name', 150);
            $table->string('required_role', 50)->nullable();
            $table->json('condition_json')->nullable();
            $table->json('notify_targets_json')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('request_code', 80)->unique();
            $table->unsignedBigInteger('status_catalog_id')->nullable();
            $table->string('summary', 500);
            $table->unsignedBigInteger('project_item_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('requester_name', 120)->nullable();
            $table->unsignedBigInteger('reporter_contact_id')->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->unsignedBigInteger('receiver_user_id')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
            $table->string('priority', 20)->default('MEDIUM');
            $table->date('requested_date')->nullable();
            $table->unsignedBigInteger('latest_transition_id')->nullable();
            $table->string('reference_ticket_code', 100)->nullable();
            $table->unsignedBigInteger('reference_request_id')->nullable();
            $table->json('transition_metadata')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->softDeletes();
        });

        Schema::create('request_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->nullable();
            $table->string('request_code', 80)->nullable();
            $table->string('request_summary', 500)->nullable();
            $table->string('parent_request_code', 80)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('project_item_id')->nullable();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->unsignedBigInteger('new_assignee_id')->nullable();
            $table->decimal('hours_estimated', 10, 2)->nullable();
            $table->json('transition_metadata')->nullable();
            $table->text('doc_link')->nullable();
            $table->string('drive_file_id', 255)->nullable();
            $table->text('transition_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamp('sla_due_time')->nullable();
            $table->boolean('is_sla_breached')->default(false);
        });

        Schema::create('workflow_notification_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_request_id')->nullable();
            $table->unsignedBigInteger('request_transition_id')->nullable();
            $table->string('request_code', 80)->nullable();
            $table->string('action_code', 80)->nullable();
            $table->string('target_role', 50);
            $table->unsignedBigInteger('recipient_user_id')->nullable();
            $table->string('channel', 30)->default('IN_APP');
            $table->string('delivery_status', 30)->default('RESOLVED');
            $table->json('payload_json')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang',
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 1,
            'group_name' => 'EMR-Bệnh viện Sản Nhi',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 10, 'full_name' => 'Phan Văn Rở'],
            ['id' => 20, 'full_name' => 'Lý Thị Ngọc Mai'],
            ['id' => 30, 'full_name' => 'Hồ Sơn Tùng'],
            ['id' => 99, 'full_name' => 'Admin'],
        ]);

        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'ADMIN',
        ]);

        DB::table('user_roles')->insert([
            'user_id' => 99,
            'role_id' => 1,
            'is_active' => 1,
        ]);

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 2,
                'level' => 1,
                'status_code' => 'CHO_DUYET',
                'status_name' => 'Chờ duyệt',
                'canonical_status' => 'CHO_DUYET',
                'flow_step' => 'GD1A',
                'form_key' => 'support.cho_duyet',
                'is_leaf' => 1,
                'sort_order' => 25,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'level' => 1,
                'status_code' => 'DA_DUYET',
                'status_name' => 'Đã duyệt',
                'canonical_status' => 'DA_DUYET',
                'flow_step' => 'GD1B',
                'form_key' => 'support.da_duyet',
                'is_leaf' => 1,
                'sort_order' => 35,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('workflow_status_transitions')->insert([
            [
                'id' => 1,
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'APPROVE',
                'action_name' => 'Duyệt',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['PM', 'EXECUTOR', 'CREATOR', 'ADMIN'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'FORCE_APPROVE',
                'action_name' => 'Duyệt nhanh',
                'required_role' => 'ADMIN',
                'notify_targets_json' => json_encode(['ADMIN'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'APPROVE_NO_ASSIGNEE',
                'action_name' => 'Duyệt chưa phân công',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['EXECUTOR'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 30,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->seedCustomerRequest(100, 20);
        $this->seedCustomerRequest(101, null);
        $this->seedCustomerRequest(102, 20);
    }

    private function seedCustomerRequest(int $requestId, ?int $assigneeId): void
    {
        DB::table('customer_requests')->insert([
            'id' => $requestId,
            'uuid' => sprintf('00000000-0000-0000-0000-%012d', $requestId),
            'request_code' => 'YC'.str_pad((string) $requestId, 6, '0', STR_PAD_LEFT),
            'status_catalog_id' => 2,
            'summary' => 'Yêu cầu chờ duyệt',
            'customer_id' => 1,
            'service_group_id' => 1,
            'receiver_user_id' => 10,
            'assignee_id' => $assigneeId,
            'status' => 'CHO_DUYET',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
            'created_at' => now(),
            'created_by' => 30,
            'updated_at' => now(),
            'updated_by' => 30,
        ]);
    }
}
