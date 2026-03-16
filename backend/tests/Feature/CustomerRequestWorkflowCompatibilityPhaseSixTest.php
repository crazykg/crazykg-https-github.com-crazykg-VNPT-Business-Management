<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestWorkflowCompatibilityPhaseSixTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpCompatibilitySchema();
    }

    public function test_list_infers_status_catalog_id_for_legacy_row_without_catalog_reference(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $request = Request::create('/api/v5/customer-requests', 'GET');
        $request->setUserResolver(fn () => new class
        {
            public int $id = 10;
        });

        $result = $service->list($request);
        $row = $result['data'][0];

        $this->assertSame(2, $row['status_catalog_id']);
        $this->assertTrue($row['has_configured_transitions']);
        $this->assertSame('PM', $row['viewer_role_context']['primary_role']);
        $this->assertSame(['START'], array_column($row['available_actions'], 'action_code'));
    }

    public function test_transition_validation_uses_inferred_catalog_id_for_legacy_row(): void
    {
        $service = app(CustomerRequestWorkflowService::class);
        $currentRow = (array) DB::table('customer_requests')->where('id', 100)->first();

        $this->assertNull($service->validateConfiguredTransitionChange($currentRow, 3, 10));
        $this->assertSame(
            'Bạn không có quyền chuyển trạng thái ở bước hiện tại.',
            $service->validateConfiguredTransitionChange($currentRow, 3, 20)
        );
    }

    public function test_create_accepts_legacy_payload_without_status_catalog_id(): void
    {
        $response = $this->postJson('/api/v5/customer-requests', [
            'status' => 'HOAN_THANH',
            'summary' => 'Legacy payload without status catalog id',
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.status', 'HOAN_THANH')
            ->assertJsonPath('data.status_catalog_id', 4);
    }

    private function setUpCompatibilitySchema(): void
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
                'id' => 1,
                'level' => 1,
                'status_code' => 'PHAN_TICH',
                'status_name' => 'Phân tích',
                'parent_id' => null,
                'canonical_status' => 'PHAN_TICH',
                'canonical_sub_status' => null,
                'flow_step' => 'GD8',
                'form_key' => 'programming.phan_tich',
                'is_leaf' => 1,
                'sort_order' => 90,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'level' => 2,
                'status_code' => 'LAP_TRINH_GROUP',
                'status_name' => 'Lập trình',
                'parent_id' => 1,
                'canonical_status' => 'LAP_TRINH',
                'canonical_sub_status' => null,
                'flow_step' => 'GD9',
                'form_key' => 'programming.lap_trinh',
                'is_leaf' => 0,
                'sort_order' => 100,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'level' => 3,
                'status_code' => 'LAP_TRINH_DANG_THUC_HIEN',
                'status_name' => 'Đang thực hiện',
                'parent_id' => 2,
                'canonical_status' => 'LAP_TRINH',
                'canonical_sub_status' => 'DANG_THUC_HIEN',
                'flow_step' => 'GD10',
                'form_key' => 'programming.lap_trinh.dang_thuc_hien',
                'is_leaf' => 1,
                'sort_order' => 110,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'level' => 1,
                'status_code' => 'HOAN_THANH',
                'status_name' => 'Hoàn thành',
                'parent_id' => null,
                'canonical_status' => 'HOAN_THANH',
                'canonical_sub_status' => null,
                'flow_step' => 'GD5',
                'form_key' => 'support.hoan_thanh',
                'is_leaf' => 1,
                'sort_order' => 60,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('workflow_status_transitions')->insert([
            'from_status_catalog_id' => 2,
            'to_status_catalog_id' => 3,
            'action_code' => 'START',
            'action_name' => 'Bắt đầu thực hiện',
            'required_role' => 'PM',
            'notify_targets_json' => json_encode(['EXECUTOR'], JSON_UNESCAPED_UNICODE),
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
                'viewer_role' => 'EXECUTOR',
                'can_view' => 1,
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customer_requests')->insert([
            'id' => 100,
            'uuid' => '00000000-0000-0000-0000-000000000100',
            'request_code' => 'YC000100',
            'status_catalog_id' => null,
            'summary' => 'Legacy row without status catalog id',
            'customer_id' => 1,
            'service_group_id' => 1,
            'receiver_user_id' => 10,
            'assignee_id' => 20,
            'status' => 'LAP_TRINH',
            'sub_status' => null,
            'priority' => 'MEDIUM',
            'requested_date' => '2026-03-13',
            'created_at' => now(),
            'created_by' => 10,
            'updated_at' => now(),
            'updated_by' => 10,
        ]);
    }
}
