<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestWorkflowAuditEnrichmentPhaseSevenTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
    }

    public function test_update_persists_standardized_transition_audit_fields_and_audit_log(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $service->update(100, [
            'status_catalog_id' => 3,
            'summary' => 'Đã duyệt yêu cầu',
            'workflow_reason' => 'Phê duyệt theo checklist',
            'transition_note' => 'PM đã kiểm tra và duyệt',
        ], 10);

        $transition = DB::table('request_transitions')->orderByDesc('id')->first();

        $this->assertNotNull($transition);
        $this->assertSame(2, (int) $transition->from_status_catalog_id);
        $this->assertSame(3, (int) $transition->to_status_catalog_id);
        $this->assertSame('APPROVE', $transition->workflow_action_code);
        $this->assertSame('Phê duyệt theo checklist', $transition->workflow_reason);

        $viewerRoleContext = json_decode((string) ($transition->viewer_role_context_json ?? ''), true);
        $this->assertIsArray($viewerRoleContext);
        $this->assertSame('PM', $viewerRoleContext['primary_role'] ?? null);
        $this->assertSame(['PM'], $viewerRoleContext['roles'] ?? null);

        $transitionMetadata = json_decode((string) ($transition->transition_metadata ?? ''), true);
        $this->assertIsArray($transitionMetadata);
        $this->assertSame(2, $transitionMetadata['from_status_catalog_id'] ?? null);
        $this->assertSame(3, $transitionMetadata['to_status_catalog_id'] ?? null);
        $this->assertSame('APPROVE', $transitionMetadata['workflow_action_code'] ?? null);
        $this->assertSame('Phê duyệt theo checklist', $transitionMetadata['workflow_reason'] ?? null);

        $audit = DB::table('audit_logs')
            ->where('auditable_type', 'request_transitions')
            ->orderByDesc('id')
            ->first();

        $this->assertNotNull($audit);
        $this->assertSame('INSERT', $audit->event);
        $this->assertSame((int) $transition->id, (int) $audit->auditable_id);

        $newValues = json_decode((string) ($audit->new_values ?? ''), true);
        $this->assertIsArray($newValues);
        $this->assertSame('APPROVE', $newValues['workflow_action_code'] ?? null);
        $this->assertSame('Phê duyệt theo checklist', $newValues['workflow_reason'] ?? null);
        $this->assertSame(2, $newValues['notification_summary']['total'] ?? null);
        $this->assertSame(2, $newValues['notification_summary']['resolved'] ?? null);
        $this->assertSame(0, $newValues['notification_summary']['skipped'] ?? null);
    }

    public function test_history_exposes_notification_summary_and_viewer_role_context(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $service->update(101, [
            'status_catalog_id' => 3,
            'summary' => 'Đã duyệt nhưng chưa phân công',
            'workflow_action_code' => 'APPROVE_NO_ASSIGNEE',
            'transition_note' => 'Duyệt trước, phân công sau',
        ], 10);

        $history = $service->history(101);
        $transition = $history['transitions'][0] ?? null;

        $this->assertIsArray($transition);
        $this->assertSame('APPROVE_NO_ASSIGNEE', $transition['workflow_action_code'] ?? null);
        $this->assertSame('Duyệt trước, phân công sau', $transition['workflow_reason'] ?? null);
        $this->assertSame('PM', $transition['viewer_role_context']['primary_role'] ?? null);
        $this->assertSame(1, $transition['notification_summary']['total'] ?? null);
        $this->assertSame(0, $transition['notification_summary']['resolved'] ?? null);
        $this->assertSame(1, $transition['notification_summary']['skipped'] ?? null);
        $this->assertSame(['EXECUTOR'], $transition['notification_summary']['target_roles'] ?? null);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('workflow_notification_logs');
        Schema::dropIfExists('request_transitions');
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_transitions');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');

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
            $table->unsignedBigInteger('from_status_catalog_id')->nullable();
            $table->unsignedBigInteger('to_status_catalog_id')->nullable();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->string('workflow_action_code', 80)->nullable();
            $table->text('workflow_reason')->nullable();
            $table->json('viewer_role_context_json')->nullable();
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

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('event', 20);
            $table->string('auditable_type');
            $table->unsignedBigInteger('auditable_id');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('url')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
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
            ['id' => 20, 'full_name' => 'Nguyễn Nhựt Trường'],
            ['id' => 30, 'full_name' => 'Hồ Sơn Tùng'],
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
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'APPROVE',
                'action_name' => 'Duyệt',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['CREATOR', 'EXECUTOR'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'APPROVE_NO_ASSIGNEE',
                'action_name' => 'Duyệt chưa phân công',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['EXECUTOR'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->seedRequest(100, 20);
        $this->seedRequest(101, null);
    }

    private function seedRequest(int $requestId, ?int $assigneeId): void
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
