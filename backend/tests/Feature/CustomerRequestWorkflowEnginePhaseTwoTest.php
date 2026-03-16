<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestWorkflowEnginePhaseTwoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpCustomerRequestWorkflowEngineSchema();
    }

    public function test_list_returns_viewer_role_context_and_available_actions_for_pm(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $request = Request::create('/api/v5/customer-requests', 'GET');
        $request->setUserResolver(fn () => new class
        {
            public int $id = 10;
        });

        $result = $service->list($request);
        $row = $result['data'][0];

        $this->assertSame('ASSIGNER', $row['viewer_execution_role']);
        $this->assertSame('PM', $row['viewer_role_context']['primary_role']);
        $this->assertSame(['PM', 'CREATOR'], $row['viewer_role_context']['roles']);
        $this->assertTrue($row['viewer_can_view']);
        $this->assertTrue($row['has_configured_transitions']);
        $this->assertSame(['APPROVE'], array_column($row['available_actions'], 'action_code'));
    }

    public function test_list_marks_executor_without_available_action_when_view_rule_denies_access(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $request = Request::create('/api/v5/customer-requests', 'GET');
        $request->setUserResolver(fn () => new class
        {
            public int $id = 20;
        });

        $result = $service->list($request);
        $row = $result['data'][0];

        $this->assertSame('WORKER', $row['viewer_execution_role']);
        $this->assertSame('EXECUTOR', $row['viewer_role_context']['primary_role']);
        $this->assertSame(['EXECUTOR'], $row['viewer_role_context']['roles']);
        $this->assertFalse($row['viewer_can_view']);
        $this->assertSame([], $row['available_actions']);
    }

    public function test_transition_validation_allows_pm_and_blocks_executor_for_configured_flow(): void
    {
        $service = app(CustomerRequestWorkflowService::class);
        $currentRow = (array) DB::table('customer_requests')->where('id', 100)->first();

        $this->assertNull($service->validateConfiguredTransitionChange($currentRow, 3, 10));
        $this->assertSame(
            'Bạn không có quyền chuyển trạng thái ở bước hiện tại.',
            $service->validateConfiguredTransitionChange($currentRow, 3, 20)
        );
    }

    private function setUpCustomerRequestWorkflowEngineSchema(): void
    {
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_view_rules');
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
            $table->unsignedTinyInteger('level');
            $table->string('status_code', 80);
            $table->string('status_name', 150);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('canonical_status', 50)->nullable();
            $table->string('canonical_sub_status', 50)->nullable();
            $table->string('flow_step', 20)->nullable();
            $table->string('form_key', 120)->nullable();
            $table->boolean('is_leaf')->default(false);
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

        Schema::create('workflow_status_view_rules', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('status_catalog_id');
            $table->string('viewer_role', 50);
            $table->boolean('can_view')->default(true);
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

        DB::table('customers')->insert([
            'id' => 1,
            'customer_name' => 'Benh vien San - Nhi Hau Giang',
        ]);

        DB::table('support_service_groups')->insert([
            'id' => 1,
            'group_name' => 'EMR-Benh vien San Nhi',
        ]);

        DB::table('internal_users')->insert([
            ['id' => 10, 'full_name' => 'Phan Van Ro'],
            ['id' => 20, 'full_name' => 'Ly Thi Ngoc Mai'],
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
        ]);

        DB::table('workflow_status_view_rules')->insert([
            [
                'status_catalog_id' => 2,
                'viewer_role' => 'PM',
                'can_view' => 1,
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'status_catalog_id' => 2,
                'viewer_role' => 'CREATOR',
                'can_view' => 1,
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'status_catalog_id' => 2,
                'viewer_role' => 'EXECUTOR',
                'can_view' => 0,
                'sort_order' => 30,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customer_requests')->insert([
            'id' => 100,
            'uuid' => '00000000-0000-0000-0000-000000000100',
            'request_code' => 'YC000100',
            'status_catalog_id' => 2,
            'summary' => 'Yeu cau cho duyet',
            'customer_id' => 1,
            'service_group_id' => 1,
            'receiver_user_id' => 10,
            'assignee_id' => 20,
            'status' => 'CHO_DUYET',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
            'notes' => 'Can PM duyet',
            'created_at' => now(),
            'created_by' => 10,
            'updated_at' => now(),
            'updated_by' => 10,
        ]);
    }
}
