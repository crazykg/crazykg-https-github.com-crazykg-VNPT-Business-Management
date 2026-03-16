<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestDashboardPhaseEightDrillthroughTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        app()->forgetInstance(CustomerRequestWorkflowService::class);
    }

    public function test_dashboard_summary_uses_safe_fallback_labels_for_null_text_fields(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $payload = $service->dashboardSummary(Request::create('/api/v5/customer-requests/dashboard-summary', 'GET'));
        $dataset = $payload['dataset'] ?? [];

        $this->assertNotEmpty($dataset);
        $nullFallbackRow = collect($dataset)->first(fn (array $row): bool => (int) ($row['service_group_id'] ?? 0) === 1);

        $this->assertNotNull($nullFallbackRow);
        $this->assertSame('UNKNOWN', $nullFallbackRow['workflow_action_code'] ?? null);
        $this->assertSame('Chưa gắn nhóm hỗ trợ', $nullFallbackRow['service_group_name'] ?? null);
        $this->assertSame('UNKNOWN', $nullFallbackRow['to_status_name'] ?? null);
    }

    public function test_histories_support_dashboard_drillthrough_filters_and_return_transition_feed(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $rows = $service->histories(null, 200, [
            'service_group_id' => 2,
            'workflow_action_code' => 'assign',
            'to_status_catalog_id' => 3,
            'date_from' => '2026-03-13',
            'date_to' => '2026-03-13',
        ]);

        $this->assertCount(1, $rows);
        $this->assertSame('TRANSITION', $rows[0]['source_type'] ?? null);
        $this->assertSame('YC-201', $rows[0]['request_code'] ?? null);
        $this->assertSame('ASSIGN', $rows[0]['workflow_action_code'] ?? null);
        $this->assertSame(3, $rows[0]['to_status_catalog_id'] ?? null);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('request_ref_tasks');
        Schema::dropIfExists('request_worklogs');
        Schema::dropIfExists('request_transitions');
        Schema::dropIfExists('customer_requests');
        Schema::dropIfExists('support_service_groups');

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
        });

        Schema::create('customer_requests', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('uuid')->unique();
            $table->string('request_code', 80)->unique();
            $table->string('summary', 255);
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->string('status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->softDeletes();
        });

        Schema::create('request_transitions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 80)->nullable();
            $table->string('request_summary', 255)->nullable();
            $table->unsignedBigInteger('to_status_catalog_id')->nullable();
            $table->string('to_status', 50)->nullable();
            $table->string('from_status', 50)->nullable();
            $table->string('sub_status', 50)->nullable();
            $table->text('transition_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->string('workflow_action_code', 80)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('request_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 80)->nullable();
            $table->string('phase', 50)->nullable();
            $table->text('worklog_note')->nullable();
            $table->text('internal_note')->nullable();
            $table->date('report_date')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('request_ref_tasks', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('request_code', 80)->nullable();
            $table->string('task_code', 80)->nullable();
            $table->string('task_status', 50)->nullable();
            $table->text('task_note')->nullable();
            $table->text('task_link')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('support_service_groups')->insert([
            ['id' => 1, 'group_name' => null],
            ['id' => 2, 'group_name' => 'EMR-Bệnh viện Sản Nhi'],
        ]);

        DB::table('customer_requests')->insert([
            [
                'id' => 200,
                'uuid' => '20000000-0000-0000-0000-000000000001',
                'request_code' => 'YC-200',
                'summary' => 'Fallback labels',
                'service_group_id' => 1,
                'status' => 'MOI_TIEP_NHAN',
                'sub_status' => null,
            ],
            [
                'id' => 201,
                'uuid' => '20000000-0000-0000-0000-000000000002',
                'request_code' => 'YC-201',
                'summary' => 'Assign nhóm EMR',
                'service_group_id' => 2,
                'status' => 'DANG_XU_LY',
                'sub_status' => null,
            ],
            [
                'id' => 202,
                'uuid' => '20000000-0000-0000-0000-000000000003',
                'request_code' => 'YC-202',
                'summary' => 'Approve nhóm EMR',
                'service_group_id' => 2,
                'status' => 'DA_DUYET',
                'sub_status' => null,
            ],
        ]);

        DB::table('request_transitions')->insert([
            [
                'id' => 1,
                'request_code' => 'YC-200',
                'request_summary' => 'Fallback labels',
                'to_status_catalog_id' => null,
                'to_status' => null,
                'from_status' => 'MOI_TIEP_NHAN',
                'sub_status' => null,
                'workflow_action_code' => null,
                'created_at' => '2026-03-12 09:00:00',
            ],
            [
                'id' => 2,
                'request_code' => 'YC-201',
                'request_summary' => 'Assign nhóm EMR',
                'to_status_catalog_id' => 3,
                'to_status' => 'DANG_XU_LY',
                'from_status' => 'DA_DUYET',
                'sub_status' => null,
                'workflow_action_code' => 'ASSIGN',
                'created_at' => '2026-03-13 10:00:00',
            ],
            [
                'id' => 3,
                'request_code' => 'YC-202',
                'request_summary' => 'Approve nhóm EMR',
                'to_status_catalog_id' => 2,
                'to_status' => 'DA_DUYET',
                'from_status' => 'CHO_DUYET',
                'sub_status' => null,
                'workflow_action_code' => 'APPROVE',
                'created_at' => '2026-03-13 11:00:00',
            ],
        ]);

        DB::table('request_worklogs')->insert([
            [
                'id' => 1,
                'request_code' => 'YC-201',
                'phase' => 'DANG_XU_LY',
                'worklog_note' => 'Worklog should not appear in dashboard drillthrough mode',
                'report_date' => '2026-03-13',
                'created_at' => '2026-03-13 12:00:00',
            ],
        ]);

        DB::table('request_ref_tasks')->insert([
            [
                'id' => 1,
                'request_code' => 'YC-201',
                'task_code' => 'IT360-1',
                'task_status' => 'TODO',
                'created_at' => '2026-03-13 12:30:00',
            ],
        ]);
    }
}
