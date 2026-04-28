<?php

namespace Tests\Feature;

use App\Events\V5\CaseTransitioned;
use App\Services\V5\CacheService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseWorkflowCrudTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

    private function expectedRequestCode(): string
    {
        return sprintf('CRC-%s-0001', now()->format('Ym'));
    }

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

        $transitionResponse = $this->getJson('/api/v5/customer-request-status-transitions')->assertOk();

        $pairs = collect($transitionResponse->json('data') ?? [])
            ->map(static fn (array $row): string => ($row['from_status_code'] ?? '').'->'.($row['to_status_code'] ?? ''))
            ->all();

        $this->assertContains('new_intake->assigned_to_receiver', $pairs);
        $this->assertContains('new_intake->returned_to_manager', $pairs);
        $this->assertContains('assigned_to_receiver->in_progress', $pairs);
        $this->assertContains('analysis->analysis_completed', $pairs);
        $this->assertContains('analysis->analysis_suspended', $pairs);
        $this->assertContains('coding->coding_in_progress', $pairs);
        $this->assertContains('dms_transfer->dms_task_created', $pairs);
    }

    public function test_store_case_creates_master_initial_status_instance_and_shared_links(): void
    {
        $response = $this->postJson('/api/v5/customer-request-cases', $this->createPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.request_case.request_code', $this->expectedRequestCode())
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
            ->assertJsonPath('data.0.request_code', $this->expectedRequestCode())
            ->assertJsonPath('data.0.received_by_name', 'Người tạo');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}")
            ->assertOk()
            ->assertJsonPath('data.request_code', $this->expectedRequestCode())
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

    public function test_store_worklog_accepts_empty_work_content(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 1,
            'performed_by_user_id' => 3,
            'work_content' => null,
            'work_date' => '2026-03-17',
            'hours_spent' => 1.25,
        ])
            ->assertCreated()
            ->assertJsonPath('data.work_content', null)
            ->assertJsonPath('data.work_date', '2026-03-17')
            ->assertJsonPath('meta.hours_report.total_hours_spent', 1.25);

        $this->assertSame(
            '',
            DB::table('customer_request_worklogs')
                ->where('request_case_id', $caseId)
                ->value('work_content')
        );
    }

    public function test_worklog_payload_includes_status_recipient_snapshot(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'assigned_to_receiver',
            'status_payload' => [
                'from_user_id' => 2,
                'to_user_id' => 3,
                'progress_percent' => 10,
                'notes' => 'PM giao xử lý theo WorkflowA.',
            ],
        ])->assertOk();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 2,
            'performed_by_user_id' => 2,
            'work_content' => 'PM giao R xử lý.',
            'work_started_at' => '2026-03-17 08:00:00',
            'work_ended_at' => '2026-03-17 09:00:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status_code', 'assigned_to_receiver')
            ->assertJsonPath('data.status_name_vi', 'Giao R thực hiện')
            ->assertJsonPath('data.from_user_id', 2)
            ->assertJsonPath('data.from_user_id_name', 'Người tiếp nhận')
            ->assertJsonPath('data.to_user_id', 3)
            ->assertJsonPath('data.to_user_id_name', 'Người xử lý')
            ->assertJsonPath('data.assigned_user_id', 3)
            ->assertJsonPath('data.assigned_user_name', 'Người xử lý')
            ->assertJsonPath('data.work_started_at', '2026-03-17 08:00:00');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/worklogs")
            ->assertOk()
            ->assertJsonPath('data.0.to_user_id_name', 'Người xử lý')
            ->assertJsonPath('data.0.assigned_user_name', 'Người xử lý');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/timeline")
            ->assertOk()
            ->assertJsonPath('data.0.status_code', 'assigned_to_receiver')
            ->assertJsonPath('data.0.nguoi_xu_ly_code', 'U003')
            ->assertJsonPath('data.0.nguoi_xu_ly_name', 'Người xử lý');
    }

    public function test_detail_status_worklog_uses_current_instance_when_case_pointer_is_stale(): void
    {
        $detailStatusMigration = require base_path('database/migrations/2026_04_09_210000_add_detail_status_and_worklog_fields_for_crc.php');
        $detailStatusMigration->up();

        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');
        $initialInstanceId = (int) $created->json('data.status_instance.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'assigned_to_receiver',
            'status_payload' => [
                'from_user_id' => 2,
                'to_user_id' => 3,
                'progress_percent' => 10,
                'notes' => 'PM giao xử lý theo WorkflowA.',
            ],
        ])->assertOk();

        $assignedInstanceId = (int) DB::table('customer_request_status_instances')
            ->where('request_case_id', $caseId)
            ->where('status_code', 'assigned_to_receiver')
            ->value('id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update(['current_status_instance_id' => $initialInstanceId]);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/detail-status-worklog", [
            'updated_by' => 2,
            'performed_by_user_id' => 2,
            'detail_status_action' => 'in_progress',
            'work_content' => 'Bắt đầu xử lý theo người nhận.',
            'work_started_at' => '2026-03-17 08:00:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status_instance_id', $assignedInstanceId)
            ->assertJsonPath('data.status_code', 'assigned_to_receiver')
            ->assertJsonPath('data.status_name_vi', 'Giao R thực hiện')
            ->assertJsonPath('data.to_user_id_name', 'Người xử lý')
            ->assertJsonPath('data.assigned_user_name', 'Người xử lý')
            ->assertJsonPath('data.detail_status_action', 'in_progress');
    }

    public function test_store_case_accepts_dispatcher_assignment_in_master_payload(): void
    {
        $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatcher_user_id' => 2,
            ],
        ]))
            ->assertCreated()
            ->assertJsonPath('data.request_case.dispatcher_user_id', 2);

        $this->assertSame(2, (int) DB::table('customer_request_cases')->value('dispatcher_user_id'));
    }

    public function test_new_intake_dispatcher_lane_only_exposes_workflowa_targets(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $statusDetail = $this->getJson("/api/v5/customer-request-cases/{$caseId}/statuses/new_intake")
            ->assertOk();

        $allowed = collect($statusDetail->json('data.allowed_next_processes') ?? [])
            ->pluck('process_code')
            ->all();

        $this->assertSame([
            'assigned_to_receiver',
            'returned_to_manager',
        ], $allowed);

        $statusDetail
            ->assertJsonPath(
                'data.available_actions.pm_missing_customer_info_decision.context_code',
                'pm_missing_customer_info_review'
            )
            ->assertJsonPath(
                'data.available_actions.pm_missing_customer_info_decision.source_status_code',
                'new_intake'
            );
    }

    public function test_transition_dispatches_case_transitioned_event(): void
    {
        Event::fake([CaseTransitioned::class]);

        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'assigned_to_receiver',
            'status_payload' => [
                'from_user_id' => 2,
                'to_user_id' => 3,
                'progress_percent' => 10,
                'notes' => 'PM giao xử lý theo WorkflowA.',
            ],
        ])->assertOk();

        Event::assertDispatched(CaseTransitioned::class, function (CaseTransitioned $event) use ($caseId): bool {
            return (int) $event->case->id === $caseId
                && $event->targetStatus === 'assigned_to_receiver'
                && $event->actorId === 2;
        });
    }

    public function test_transition_flushes_case_cache_tags_via_listener_end_to_end(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('flushTags')->once()->with(['customer-request-cases']);
        $cache->shouldReceive('flushTags')->once()->with(["customer-request-cases:{$caseId}"]);
        $this->app->instance(CacheService::class, $cache);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'assigned_to_receiver',
            'status_payload' => [
                'from_user_id' => 2,
                'to_user_id' => 3,
                'progress_percent' => 10,
                'notes' => 'PM giao xử lý theo WorkflowA.',
            ],
        ])->assertOk();
    }

    public function test_store_worklog_flushes_case_dashboard_cache_tags(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'self_handle',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $cache = Mockery::mock(CacheService::class);
        $cache->shouldReceive('flushTags')->once()->with(['customer-request-cases']);
        $cache->shouldReceive('flushTags')->once()->with(["customer-request-cases:{$caseId}"]);
        $this->app->instance(CacheService::class, $cache);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 3,
            'performed_by_user_id' => 3,
            'work_content' => 'Ghi worklog để cập nhật dashboard.',
            'work_date' => '2026-03-20',
            'hours_spent' => 1.5,
            'activity_type_code' => 'analysis',
            'is_billable' => true,
        ])->assertCreated();
    }

    public function test_returned_to_manager_allows_not_executed_and_sets_current_status(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'self_handle',
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 3,
            'to_status_code' => 'returned_to_manager',
            'status_payload' => [
                'from_user_id' => 3,
                'to_user_id' => 2,
                'notes' => 'Thiếu thông tin nghiệp vụ để tiếp tục xử lý.',
            ],
        ])->assertOk();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'not_executed',
            'status_payload' => [
                'from_user_id' => 2,
                'notes' => 'Khách hàng chưa cung cấp đủ dữ liệu đầu vào.',
            ],
        ])->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'not_executed');
    }

    public function test_new_intake_rejects_waiting_customer_feedback_transition(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'waiting_customer_feedback',
            'status_payload' => [
                'notes' => 'Khách hàng cần bổ sung dữ liệu.',
            ],
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');
    }

    public function test_new_intake_allowed_next_processes_are_filtered_by_case_lane(): void
    {
        $dispatcherCase = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $dispatcherCaseId = (int) $dispatcherCase->json('data.request_case.id');
        $dispatcherAllowed = collect(
            $this->getJson("/api/v5/customer-request-cases/{$dispatcherCaseId}/statuses/new_intake")
                ->assertOk()
                ->json('data.allowed_next_processes') ?? []
        )->pluck('process_code')->all();

        $this->assertSame([
            'assigned_to_receiver',
            'returned_to_manager',
        ], $dispatcherAllowed);

        $performerCase = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'self_handle',
                'performer_user_id' => 3,
            ],
        ]))->assertCreated();

        $performerCaseId = (int) $performerCase->json('data.request_case.id');
        $performerAllowed = collect(
            $this->getJson("/api/v5/customer-request-cases/{$performerCaseId}/statuses/new_intake")
                ->assertOk()
                ->json('data.allowed_next_processes') ?? []
        )->pluck('process_code')->all();

        $this->assertSame([
            'assigned_to_receiver',
            'returned_to_manager',
        ], $performerAllowed);

        $this->postJson("/api/v5/customer-request-cases/{$performerCaseId}/transition", [
            'to_status_code' => 'waiting_customer_feedback',
            'updated_by' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');

        $this->postJson("/api/v5/customer-request-cases/{$performerCaseId}/transition", [
            'to_status_code' => 'returned_to_manager',
            'updated_by' => 1,
            'status_payload' => [
                'returned_by_user_id' => 3,
                'returned_at' => '2026-03-17 11:00:00',
                'return_reason' => 'Cần PM điều phối lại phạm vi.',
            ],
            ])
            ->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'returned_to_manager');
    }

    public function test_in_progress_allowed_next_processes_only_allow_completion_under_xml(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'self_handle',
                'performer_user_id' => 3,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'assigned_to_receiver',
            'updated_by' => 3,
            'status_payload' => [
                'performer_user_id' => 3,
                'started_at' => '2026-03-17 10:00:00',
                'expected_completed_at' => '2026-03-18 17:00:00',
                'progress_percent' => 35,
                'processing_content' => 'Dang xu ly va cap nhat he thong.',
            ],
        ])->assertOk();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'in_progress',
            'updated_by' => 3,
            'status_payload' => [
                'performer_user_id' => 3,
                'started_at' => '2026-03-17 10:30:00',
                'progress_percent' => 35,
                'processing_content' => 'Dang xu ly va cap nhat he thong.',
            ],
        ])->assertOk();

        $allowed = collect(
            $this->getJson("/api/v5/customer-request-cases/{$caseId}/statuses/in_progress")
                ->assertOk()
                ->json('data.allowed_next_processes') ?? []
        )->pluck('process_code')->all();

        $this->assertSame([
            'completed',
            'returned_to_manager',
        ], $allowed);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'analysis',
            'updated_by' => 3,
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'to_status_code' => 'returned_to_manager',
            'updated_by' => 3,
        ])
            ->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'returned_to_manager');
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
            'to_status_code' => 'assigned_to_receiver',
            'updated_by' => 1,
            'status_payload' => [
                'to_user_id' => 3,
                'progress_percent' => 10,
                'notes' => 'Giao R thực hiện theo Workflow A.',
            ],
        ])->assertOk();

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
            ->assertJsonPath('data.status_row.data.progress_percent', 35);

        $this->assertSame(3, DB::table('customer_request_status_instances')->count());
        $this->assertSame(1, DB::table('customer_request_assigned_to_receiver')->count());
        $this->assertSame(1, DB::table('customer_request_in_progress')->count());

        $initial = DB::table('customer_request_status_instances')->where('id', $firstInstanceId)->first();
        $assigned = DB::table('customer_request_status_instances')
            ->where('request_case_id', $caseId)
            ->where('status_code', 'assigned_to_receiver')
            ->first();
        $current = DB::table('customer_request_status_instances')->where('is_current', 1)->first();
        $this->assertNotNull($initial);
        $this->assertNotNull($assigned);
        $this->assertNotNull($current);
        $this->assertSame(0, (int) $initial->is_current);
        $this->assertSame(0, (int) $assigned->is_current);
        $this->assertSame((int) $assigned->id, (int) $initial->next_instance_id);
        $this->assertSame((int) $current->id, (int) $assigned->next_instance_id);
        $this->assertSame((int) $assigned->id, (int) $current->previous_instance_id);

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

    public function test_estimate_api_and_hours_report_update_master_case_metrics(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => now(),
            ]);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 3,
            'performed_by_user_id' => 3,
            'work_content' => 'Phân tích dữ liệu và lập estimate.',
            'work_date' => '2026-03-18',
            'activity_type_code' => 'analysis',
            'hours_spent' => 2.5,
            'is_billable' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.work_date', '2026-03-18')
            ->assertJsonPath('data.activity_type_code', 'analysis')
            ->assertJsonPath('meta.hours_report.total_hours_spent', 2.5);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/estimates", [
            'updated_by' => 2,
            'estimated_hours' => 5,
            'estimate_scope' => 'total',
            'estimate_type' => 'manual',
            'note' => 'Estimate ban đầu cho toàn bộ yêu cầu.',
        ])
            ->assertCreated()
            ->assertJsonPath('data.estimate.estimated_hours', 5)
            ->assertJsonPath('data.estimate.estimated_by_user_id', 2)
            ->assertJsonPath('data.request_case.estimated_hours', 5)
            ->assertJsonPath('data.request_case.total_hours_spent', 2.5);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/estimates?updated_by=3")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.estimated_hours', 5)
            ->assertJsonPath('data.0.estimated_by_user_id', 2);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/hours-report?updated_by=3")
            ->assertOk()
            ->assertJsonPath('data.total_hours_spent', 2.5)
            ->assertJsonPath('data.estimated_hours', 5)
            ->assertJsonPath('data.worklog_count', 1)
            ->assertJsonPath('data.by_performer.0.performed_by_user_id', 3);
    }

    public function test_role_scope_search_and_dashboard_endpoints_follow_creator_dispatcher_performer_and_project_handler(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => now(),
            ]);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=2")
            ->assertOk()
            ->assertJsonPath('data.dispatcher_user_id', 2);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=3")
            ->assertOk()
            ->assertJsonPath('data.performer_user_id', 3);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}?updated_by=4")
            ->assertNotFound();

        $this->getJson('/api/v5/customer-request-cases/search?q='.$this->expectedRequestCode().'&updated_by=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.request_code', $this->expectedRequestCode());

        $this->getJson('/api/v5/customer-request-cases/dashboard/creator?updated_by=1')
            ->assertOk()
            ->assertJsonPath('data.role', 'creator')
            ->assertJsonPath('data.summary.total_cases', 1)
            ->assertJsonPath('data.top_projects.0.project_name', 'Dự án SOC');

        $this->getJson('/api/v5/customer-request-cases/dashboard/dispatcher?updated_by=2')
            ->assertOk()
            ->assertJsonPath('data.role', 'dispatcher')
            ->assertJsonPath('data.summary.total_cases', 1)
            ->assertJsonPath('data.summary.alert_counts.missing_estimate', 1);

        $this->getJson('/api/v5/customer-request-cases/dashboard/performer?updated_by=3')
            ->assertOk()
            ->assertJsonPath('data.role', 'performer')
            ->assertJsonPath('data.summary.total_cases', 1);

        $this->getJson('/api/v5/customer-request-cases/dashboard/overview?updated_by=3')
            ->assertOk()
            ->assertJsonPath('data.role', 'overview')
            ->assertJsonPath('data.summary.total_cases', 1)
            ->assertJsonPath('data.top_customers.0.customer_name', 'TT Phòng, Chống HIV/AIDS tỉnh Hậu Giang')
            ->assertJsonPath('data.top_projects.0.project_name', 'Dự án SOC');
    }

    public function test_performer_weekly_timesheet_aggregates_worklogs_by_week(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload())->assertCreated();
        $caseId = (int) $created->json('data.request_case.id');

        DB::table('customer_request_cases')
            ->where('id', $caseId)
            ->update([
                'dispatcher_user_id' => 2,
                'performer_user_id' => 3,
                'updated_at' => now(),
            ]);

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 3,
            'performed_by_user_id' => 3,
            'work_content' => 'Nhận việc và phân tích ban đầu.',
            'work_date' => '2026-03-17',
            'activity_type_code' => 'analysis',
            'hours_spent' => 1.5,
            'is_billable' => true,
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 3,
            'performed_by_user_id' => 3,
            'work_content' => 'Lập giải pháp và phản hồi.',
            'work_date' => '2026-03-20',
            'activity_type_code' => 'implementation',
            'hours_spent' => 2.25,
            'is_billable' => false,
        ])->assertCreated();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/worklogs", [
            'updated_by' => 2,
            'performed_by_user_id' => 2,
            'work_content' => 'Điều phối không tính vào timesheet performer.',
            'work_date' => '2026-03-19',
            'activity_type_code' => 'coordination',
            'hours_spent' => 3,
            'is_billable' => true,
        ])->assertCreated();

        $this->getJson('/api/v5/customer-request-cases/timesheet/performer-weekly?updated_by=3&start_date=2026-03-17&end_date=2026-03-23')
            ->assertOk()
            ->assertJsonPath('data.performer_user_id', 3)
            ->assertJsonPath('data.total_hours', 3.75)
            ->assertJsonPath('data.billable_hours', 1.5)
            ->assertJsonPath('data.non_billable_hours', 2.25)
            ->assertJsonPath('data.worklog_count', 2)
            ->assertJsonPath('data.days.0.date', '2026-03-17')
            ->assertJsonPath('data.days.0.hours_spent', 1.5)
            ->assertJsonPath('data.top_cases.0.request_case_id', $caseId)
            ->assertJsonPath('data.top_cases.0.hours_spent', 3.75)
            ->assertJsonPath('data.recent_entries.0.request_case_id', $caseId);
    }

}
