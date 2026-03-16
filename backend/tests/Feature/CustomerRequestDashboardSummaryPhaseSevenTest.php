<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerRequestDashboardSummaryPhaseSevenTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
        app()->forgetInstance(CustomerRequestWorkflowService::class);
    }

    public function test_dashboard_summary_aggregates_action_service_group_status_sla_and_notifications(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $payload = $service->dashboardSummary(Request::create('/api/v5/customer-requests/dashboard-summary', 'GET', [
            'filters' => [
                'date_from' => '2026-03-13',
                'date_to' => '2026-03-13',
            ],
        ]));

        $this->assertSame('2026-03-13', $payload['filters']['date_from'] ?? null);
        $this->assertSame('2026-03-13', $payload['filters']['date_to'] ?? null);

        $dataset = $payload['dataset'] ?? [];
        $this->assertCount(3, $dataset);

        $approveRow = $this->findDatasetRow($dataset, 'APPROVE', 1, 2);
        $this->assertSame('Phê duyệt', $approveRow['action_name'] ?? null);
        $this->assertSame(1, $approveRow['transition_count'] ?? null);
        $this->assertSame(1, $approveRow['sla_tracked_count'] ?? null);
        $this->assertSame(0, $approveRow['sla_breached_count'] ?? null);
        $this->assertSame(1, $approveRow['sla_on_time_count'] ?? null);
        $this->assertSame(2, $approveRow['notification_total'] ?? null);
        $this->assertSame(2, $approveRow['notification_resolved'] ?? null);
        $this->assertSame(0, $approveRow['notification_skipped'] ?? null);

        $assignCoreRow = $this->findDatasetRow($dataset, 'ASSIGN', 1, 3);
        $this->assertSame(1, $assignCoreRow['transition_count'] ?? null);
        $this->assertSame(1, $assignCoreRow['sla_tracked_count'] ?? null);
        $this->assertSame(1, $assignCoreRow['sla_breached_count'] ?? null);
        $this->assertSame(0, $assignCoreRow['sla_on_time_count'] ?? null);
        $this->assertSame(2, $assignCoreRow['notification_total'] ?? null);
        $this->assertSame(1, $assignCoreRow['notification_resolved'] ?? null);
        $this->assertSame(1, $assignCoreRow['notification_skipped'] ?? null);

        $totals = $payload['summary']['totals'] ?? [];
        $this->assertSame(3, $totals['transition_count'] ?? null);
        $this->assertSame(2, $totals['sla_tracked_count'] ?? null);
        $this->assertSame(1, $totals['sla_breached_count'] ?? null);
        $this->assertSame(1, $totals['sla_on_time_count'] ?? null);
        $this->assertSame(5, $totals['notification_total'] ?? null);
        $this->assertSame(3, $totals['notification_resolved'] ?? null);
        $this->assertSame(2, $totals['notification_skipped'] ?? null);

        $byAction = $this->indexSummaryRows($payload['summary']['by_action'] ?? [], 'workflow_action_code');
        $this->assertSame(1, $byAction['APPROVE']['transition_count'] ?? null);
        $this->assertSame(2, $byAction['ASSIGN']['transition_count'] ?? null);
        $this->assertSame(3, $byAction['ASSIGN']['notification_total'] ?? null);
        $this->assertSame(2, $byAction['ASSIGN']['notification_skipped'] ?? null);

        $byServiceGroup = $this->indexSummaryRows($payload['summary']['by_service_group'] ?? [], 'service_group_id');
        $this->assertSame(2, $byServiceGroup['1']['transition_count'] ?? null);
        $this->assertSame(1, $byServiceGroup['1']['sla_breached_count'] ?? null);
        $this->assertSame(1, $byServiceGroup['2']['transition_count'] ?? null);

        $byTargetStatus = $this->indexSummaryRows($payload['summary']['by_target_status'] ?? [], 'to_status_catalog_id');
        $this->assertSame(1, $byTargetStatus['2']['transition_count'] ?? null);
        $this->assertSame(2, $byTargetStatus['3']['transition_count'] ?? null);

        $notifications = $payload['summary']['notifications'] ?? [];
        $this->assertSame(5, $notifications['total_logs'] ?? null);
        $this->assertSame(3, $notifications['resolved_count'] ?? null);
        $this->assertSame(2, $notifications['skipped_count'] ?? null);

        $sla = $payload['summary']['sla'] ?? [];
        $this->assertSame(2, $sla['tracked_count'] ?? null);
        $this->assertSame(1, $sla['breached_count'] ?? null);
        $this->assertSame(1, $sla['on_time_count'] ?? null);
    }

    public function test_dashboard_summary_export_uses_filtered_compact_dataset(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $response = $service->exportDashboardSummary(Request::create('/api/v5/customer-requests/dashboard-summary/export', 'GET', [
            'filters' => [
                'workflow_action_code' => 'ASSIGN',
                'service_group_id' => 1,
            ],
        ]));

        ob_start();
        $response->sendContent();
        $csv = (string) ob_get_clean();

        $this->assertStringContainsString('Action code', $csv);
        $this->assertStringContainsString('ASSIGN', $csv);
        $this->assertStringNotContainsString('APPROVE', $csv);
        $this->assertStringContainsString('EMR-Bệnh viện Sản Nhi', $csv);
        $this->assertStringNotContainsString('DMS-Bệnh viện Sản Nhi', $csv);
    }

    /**
     * @param array<int,array<string,mixed>> $dataset
     * @return array<string,mixed>
     */
    private function findDatasetRow(array $dataset, string $actionCode, int $serviceGroupId, int $toStatusCatalogId): array
    {
        foreach ($dataset as $row) {
            if (
                (string) ($row['workflow_action_code'] ?? '') === $actionCode
                && (int) ($row['service_group_id'] ?? 0) === $serviceGroupId
                && (int) ($row['to_status_catalog_id'] ?? 0) === $toStatusCatalogId
            ) {
                return $row;
            }
        }

        $this->fail(sprintf(
            'Không tìm thấy dataset row action=%s, service_group_id=%d, to_status_catalog_id=%d',
            $actionCode,
            $serviceGroupId,
            $toStatusCatalogId
        ));
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array<string,array<string,mixed>>
     */
    private function indexSummaryRows(array $rows, string $key): array
    {
        $indexed = [];
        foreach ($rows as $row) {
            $indexed[(string) ($row[$key] ?? '')] = $row;
        }

        return $indexed;
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

        Schema::create('customers', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('customer_name', 255)->nullable();
        });

        Schema::create('support_service_groups', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('group_name', 255)->nullable();
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
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->unsignedBigInteger('service_group_id')->nullable();
            $table->unsignedBigInteger('receiver_user_id')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->string('status', 50);
            $table->string('sub_status', 50)->nullable();
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
            $table->string('workflow_action_code', 80)->nullable();
            $table->timestamp('sla_due_time')->nullable();
            $table->boolean('is_sla_breached')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('workflow_notification_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('request_transition_id')->nullable();
            $table->string('delivery_status', 30)->default('RESOLVED');
        });

        DB::table('customers')->insert([
            ['id' => 1, 'customer_name' => 'Bệnh viện Sản - Nhi Hậu Giang'],
        ]);

        DB::table('support_service_groups')->insert([
            ['id' => 1, 'group_name' => 'EMR-Bệnh viện Sản Nhi'],
            ['id' => 2, 'group_name' => 'DMS-Bệnh viện Sản Nhi'],
        ]);

        DB::table('workflow_status_catalogs')->insert([
            ['id' => 2, 'level' => 1, 'status_code' => 'DA_DUYET', 'status_name' => 'Đã duyệt', 'is_leaf' => 1, 'sort_order' => 20, 'is_active' => 1],
            ['id' => 3, 'level' => 1, 'status_code' => 'DANG_XU_LY', 'status_name' => 'Đang xử lý', 'is_leaf' => 1, 'sort_order' => 30, 'is_active' => 1],
        ]);

        DB::table('workflow_status_transitions')->insert([
            [
                'id' => 1,
                'from_status_catalog_id' => 1,
                'to_status_catalog_id' => 2,
                'action_code' => 'APPROVE',
                'action_name' => 'Phê duyệt',
                'sort_order' => 10,
                'is_active' => 1,
            ],
            [
                'id' => 2,
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'ASSIGN',
                'action_name' => 'Phân công',
                'sort_order' => 20,
                'is_active' => 1,
            ],
        ]);

        DB::table('customer_requests')->insert([
            [
                'id' => 100,
                'uuid' => '10000000-0000-0000-0000-000000000001',
                'request_code' => 'YC-100',
                'status_catalog_id' => 2,
                'summary' => 'Yêu cầu 100',
                'customer_id' => 1,
                'service_group_id' => 1,
                'status' => 'DA_DUYET',
                'sub_status' => null,
            ],
            [
                'id' => 101,
                'uuid' => '10000000-0000-0000-0000-000000000002',
                'request_code' => 'YC-101',
                'status_catalog_id' => 3,
                'summary' => 'Yêu cầu 101',
                'customer_id' => 1,
                'service_group_id' => 1,
                'status' => 'DANG_XU_LY',
                'sub_status' => null,
            ],
            [
                'id' => 102,
                'uuid' => '10000000-0000-0000-0000-000000000003',
                'request_code' => 'YC-102',
                'status_catalog_id' => 3,
                'summary' => 'Yêu cầu 102',
                'customer_id' => 1,
                'service_group_id' => 2,
                'status' => 'DANG_XU_LY',
                'sub_status' => null,
            ],
        ]);

        DB::table('request_transitions')->insert([
            [
                'id' => 1,
                'request_code' => 'YC-100',
                'request_summary' => 'Yêu cầu 100',
                'to_status_catalog_id' => 2,
                'to_status' => 'DA_DUYET',
                'workflow_action_code' => 'APPROVE',
                'sla_due_time' => '2026-03-13 12:00:00',
                'is_sla_breached' => 0,
                'created_at' => '2026-03-13 09:00:00',
            ],
            [
                'id' => 2,
                'request_code' => 'YC-101',
                'request_summary' => 'Yêu cầu 101',
                'to_status_catalog_id' => 3,
                'to_status' => 'DANG_XU_LY',
                'workflow_action_code' => 'ASSIGN',
                'sla_due_time' => '2026-03-13 13:00:00',
                'is_sla_breached' => 1,
                'created_at' => '2026-03-13 10:00:00',
            ],
            [
                'id' => 3,
                'request_code' => 'YC-102',
                'request_summary' => 'Yêu cầu 102',
                'to_status_catalog_id' => 3,
                'to_status' => 'DANG_XU_LY',
                'workflow_action_code' => 'ASSIGN',
                'sla_due_time' => null,
                'is_sla_breached' => 0,
                'created_at' => '2026-03-13 11:00:00',
            ],
        ]);

        DB::table('workflow_notification_logs')->insert([
            ['id' => 1, 'request_transition_id' => 1, 'delivery_status' => 'RESOLVED'],
            ['id' => 2, 'request_transition_id' => 1, 'delivery_status' => 'RESOLVED'],
            ['id' => 3, 'request_transition_id' => 2, 'delivery_status' => 'RESOLVED'],
            ['id' => 4, 'request_transition_id' => 2, 'delivery_status' => 'SKIPPED'],
            ['id' => 5, 'request_transition_id' => 3, 'delivery_status' => 'SKIPPED'],
        ]);
    }
}
