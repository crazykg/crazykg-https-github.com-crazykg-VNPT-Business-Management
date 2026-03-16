<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestVisibilityScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        app()->forgetInstance(CustomerRequestWorkflowService::class);
    }

    public function test_employee_without_admin_or_raci_a_scope_only_sees_assigned_and_new_requests(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $payload = $service->list($this->makeRequestForUser(20));
        $codes = array_column($payload['data'], 'request_code');

        $this->assertSame(['YC-NEW', 'YC-OWN'], $codes);
    }

    public function test_project_raci_a_user_sees_requests_in_their_project_scope(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $payload = $service->list($this->makeRequestForUser(40));
        $codes = array_column($payload['data'], 'request_code');

        $this->assertSame(['YC-OTHER', 'YC-NEW', 'YC-OWN'], $codes);
    }

    public function test_admin_sees_all_requests(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $payload = $service->list($this->makeRequestForUser(99));
        $codes = array_column($payload['data'], 'request_code');

        $this->assertSame(['YC-PROJ2', 'YC-OTHER', 'YC-NEW', 'YC-OWN'], $codes);
    }

    public function test_dashboard_summary_uses_same_visibility_scope(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $employeeSummary = $service->dashboardSummary($this->makeRequestForUser(20, '/api/v5/customer-requests/dashboard-summary'));
        $employeeActions = array_column($employeeSummary['dataset'] ?? [], 'workflow_action_code');
        sort($employeeActions);

        $adminSummary = $service->dashboardSummary($this->makeRequestForUser(99, '/api/v5/customer-requests/dashboard-summary'));
        $adminActions = array_column($adminSummary['dataset'] ?? [], 'workflow_action_code');
        sort($adminActions);

        $this->assertSame(['ASSIGN', 'INTAKE'], $employeeActions);
        $this->assertSame(['ASSIGN', 'INTAKE', 'REVIEW', 'WORK'], $adminActions);
    }

    public function test_history_feed_uses_same_visibility_scope(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $rows = $service->histories(null, 200, [], 20);
        $codes = array_values(array_unique(array_map(
            static fn (array $row): string => (string) ($row['request_code'] ?? ''),
            $rows
        )));
        sort($codes);

        $this->assertSame(['YC-NEW', 'YC-OWN'], $codes);
    }

    private function makeRequestForUser(int $userId, string $uri = '/api/v5/customer-requests'): Request
    {
        $request = Request::create($uri, 'GET');
        $request->setUserResolver(fn () => new class ($userId)
        {
            public function __construct(public int $id)
            {
            }
        });

        return $request;
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('request_transitions');
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('workflow_status_catalogs');
        Schema::dropIfExists('support_service_groups');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('internal_users');
        Schema::dropIfExists('raci_assignments');
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

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
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
            $table->string('request_code', 80)->nullable();
            $table->string('request_summary', 500)->nullable();
            $table->unsignedBigInteger('to_status_catalog_id')->nullable();
            $table->string('to_status', 50)->nullable();
            $table->string('from_status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->string('workflow_action_code', 80)->nullable();
            $table->text('transition_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
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
            ['id' => 30, 'full_name' => 'Lý Thị Ngọc Mai'],
            ['id' => 40, 'full_name' => 'A trong RACI'],
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
            'expires_at' => null,
        ]);

        DB::table('raci_assignments')->insert([
            'entity_type' => 'project',
            'entity_id' => 1,
            'user_id' => 40,
            'raci_role' => 'A',
        ]);

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 1,
                'status_code' => 'MOI_TIEP_NHAN',
                'status_name' => 'Mới tiếp nhận',
                'canonical_status' => 'MOI_TIEP_NHAN',
                'flow_step' => 'GD1',
                'form_key' => 'support.moi_tiep_nhan',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'status_code' => 'LAP_TRINH_GROUP',
                'status_name' => 'Lập trình',
                'canonical_status' => 'LAP_TRINH',
                'flow_step' => 'GD8',
                'form_key' => 'programming.lap_trinh',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'status_code' => 'DANG_XU_LY',
                'status_name' => 'Đang xử lý',
                'canonical_status' => 'DANG_XU_LY',
                'flow_step' => 'GD3',
                'form_key' => 'support.dang_xu_ly',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('customer_requests')->insert([
            [
                'id' => 1,
                'uuid' => '10000000-0000-0000-0000-000000000001',
                'request_code' => 'YC-OWN',
                'status_catalog_id' => 2,
                'summary' => 'Việc giao cho Trường',
                'customer_id' => 1,
                'project_id' => 1,
                'service_group_id' => 1,
                'receiver_user_id' => 10,
                'assignee_id' => 20,
                'status' => 'LAP_TRINH',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'requested_date' => '2026-03-13',
                'created_at' => '2026-03-13 09:00:00',
                'created_by' => 10,
                'updated_at' => '2026-03-13 09:00:00',
                'updated_by' => 10,
            ],
            [
                'id' => 2,
                'uuid' => '10000000-0000-0000-0000-000000000002',
                'request_code' => 'YC-NEW',
                'status_catalog_id' => 1,
                'summary' => 'Yêu cầu mới tiếp nhận',
                'customer_id' => 1,
                'project_id' => 1,
                'service_group_id' => 1,
                'receiver_user_id' => 10,
                'assignee_id' => 30,
                'status' => 'MOI_TIEP_NHAN',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'requested_date' => '2026-03-13',
                'created_at' => '2026-03-13 10:00:00',
                'created_by' => 10,
                'updated_at' => '2026-03-13 10:00:00',
                'updated_by' => 10,
            ],
            [
                'id' => 3,
                'uuid' => '10000000-0000-0000-0000-000000000003',
                'request_code' => 'YC-OTHER',
                'status_catalog_id' => 2,
                'summary' => 'Việc của người khác cùng dự án',
                'customer_id' => 1,
                'project_id' => 1,
                'service_group_id' => 1,
                'receiver_user_id' => 10,
                'assignee_id' => 30,
                'status' => 'LAP_TRINH',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'requested_date' => '2026-03-13',
                'created_at' => '2026-03-13 11:00:00',
                'created_by' => 10,
                'updated_at' => '2026-03-13 11:00:00',
                'updated_by' => 10,
            ],
            [
                'id' => 4,
                'uuid' => '10000000-0000-0000-0000-000000000004',
                'request_code' => 'YC-PROJ2',
                'status_catalog_id' => 3,
                'summary' => 'Việc dự án khác',
                'customer_id' => 1,
                'project_id' => 2,
                'service_group_id' => 1,
                'receiver_user_id' => 10,
                'assignee_id' => 30,
                'status' => 'DANG_XU_LY',
                'sub_status' => null,
                'priority' => 'MEDIUM',
                'requested_date' => '2026-03-13',
                'created_at' => '2026-03-13 12:00:00',
                'created_by' => 10,
                'updated_at' => '2026-03-13 12:00:00',
                'updated_by' => 10,
            ],
        ]);

        DB::table('request_transitions')->insert([
            [
                'id' => 1,
                'request_code' => 'YC-OWN',
                'request_summary' => 'Việc giao cho Trường',
                'to_status_catalog_id' => 2,
                'to_status' => 'LAP_TRINH',
                'from_status' => 'PHAN_TICH',
                'sub_status' => null,
                'workflow_action_code' => 'ASSIGN',
                'created_at' => '2026-03-13 09:00:00',
                'created_by' => 10,
            ],
            [
                'id' => 2,
                'request_code' => 'YC-NEW',
                'request_summary' => 'Yêu cầu mới tiếp nhận',
                'to_status_catalog_id' => 1,
                'to_status' => 'MOI_TIEP_NHAN',
                'from_status' => null,
                'sub_status' => null,
                'workflow_action_code' => 'INTAKE',
                'created_at' => '2026-03-13 10:00:00',
                'created_by' => 10,
            ],
            [
                'id' => 3,
                'request_code' => 'YC-OTHER',
                'request_summary' => 'Việc của người khác cùng dự án',
                'to_status_catalog_id' => 2,
                'to_status' => 'LAP_TRINH',
                'from_status' => 'PHAN_TICH',
                'sub_status' => null,
                'workflow_action_code' => 'REVIEW',
                'created_at' => '2026-03-13 11:00:00',
                'created_by' => 10,
            ],
            [
                'id' => 4,
                'request_code' => 'YC-PROJ2',
                'request_summary' => 'Việc dự án khác',
                'to_status_catalog_id' => 3,
                'to_status' => 'DANG_XU_LY',
                'from_status' => 'DA_DUYET',
                'sub_status' => null,
                'workflow_action_code' => 'WORK',
                'created_at' => '2026-03-13 12:00:00',
                'created_by' => 10,
            ],
        ]);
    }
}
