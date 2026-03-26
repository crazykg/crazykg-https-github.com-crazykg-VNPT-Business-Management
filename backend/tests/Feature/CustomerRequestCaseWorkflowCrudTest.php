<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Concerns\InteractsWithCustomerRequestCaseFixtures;
use Tests\TestCase;

class CustomerRequestCaseWorkflowCrudTest extends TestCase
{
    use InteractsWithCustomerRequestCaseFixtures;

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

        $this->assertContains('new_intake->waiting_customer_feedback', $pairs);
        $this->assertContains('new_intake->analysis', $pairs);
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

    public function test_pm_missing_customer_info_decision_is_exposed_and_persisted_for_dispatcher_lane(): void
    {
        $created = $this->postJson('/api/v5/customer-request-cases', $this->createPayload([
            'master_payload' => [
                'dispatch_route' => 'assign_pm',
                'dispatcher_user_id' => 2,
            ],
        ]))->assertCreated();

        $caseId = (int) $created->json('data.request_case.id');

        $statusDetail = $this->getJson("/api/v5/customer-request-cases/{$caseId}/statuses/new_intake")
            ->assertOk()
            ->assertJsonPath('data.available_actions.pm_missing_customer_info_decision.context_code', 'pm_missing_customer_info_review')
            ->assertJsonPath('data.available_actions.pm_missing_customer_info_decision.source_status_code', 'new_intake')
            ->assertJsonPath('data.available_actions.pm_missing_customer_info_decision.target_status_codes.0', 'waiting_customer_feedback')
            ->assertJsonPath('data.available_actions.pm_missing_customer_info_decision.target_status_codes.1', 'not_executed');

        $waitingFeedbackProcess = collect($statusDetail->json('data.allowed_next_processes') ?? [])
            ->firstWhere('process_code', 'waiting_customer_feedback');
        $notExecutedProcess = collect($statusDetail->json('data.allowed_next_processes') ?? [])
            ->firstWhere('process_code', 'not_executed');

        $this->assertSame('pm_missing_customer_info_review', $waitingFeedbackProcess['decision_context_code'] ?? null);
        $this->assertSame('customer_missing_info', $waitingFeedbackProcess['decision_outcome_code'] ?? null);
        $this->assertSame('new_intake', $waitingFeedbackProcess['decision_source_status_code'] ?? null);
        $this->assertSame('pm_missing_customer_info_review', $notExecutedProcess['decision_context_code'] ?? null);
        $this->assertSame('other_reason', $notExecutedProcess['decision_outcome_code'] ?? null);
        $this->assertSame('new_intake', $notExecutedProcess['decision_source_status_code'] ?? null);

        $transition = $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'waiting_customer_feedback',
            'status_payload' => [
                'feedback_request_content' => 'Bổ sung phiên bản phần mềm và ảnh lỗi.',
                'customer_due_at' => '2026-03-20 17:00:00',
            ],
        ])->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'waiting_customer_feedback')
            ->assertJsonPath('data.status_instance.decision_context_code', 'pm_missing_customer_info_review')
            ->assertJsonPath('data.status_instance.decision_outcome_code', 'customer_missing_info')
            ->assertJsonPath('data.status_instance.decision_source_status_code', 'new_intake');

        $currentInstanceId = (int) $transition->json('data.status_instance.id');

        $this->assertDatabaseHas('customer_request_status_instances', [
            'id' => $currentInstanceId,
            'status_code' => 'waiting_customer_feedback',
            'decision_context_code' => 'pm_missing_customer_info_review',
            'decision_outcome_code' => 'customer_missing_info',
            'decision_source_status_code' => 'new_intake',
        ]);

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/timeline")
            ->assertOk()
            ->assertJsonPath('data.0.decision_context_code', 'pm_missing_customer_info_review')
            ->assertJsonPath('data.0.decision_outcome_code', 'customer_missing_info')
            ->assertJsonPath('data.0.decision_source_status_code', 'new_intake')
            ->assertJsonPath('data.0.ly_do', 'PM xác nhận yêu cầu đang thiếu thông tin từ khách hàng.');

        $this->assertTrue(
            collect(DB::table('audit_logs')->pluck('new_values'))
                ->contains(static fn ($payload): bool => is_string($payload) && str_contains($payload, '"decision_context_code":"pm_missing_customer_info_review"'))
        );
    }

    public function test_pm_missing_customer_info_decision_is_persisted_for_returned_to_manager_lane(): void
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
                'returned_by_user_id' => 3,
                'returned_at' => '2026-03-18 09:00:00',
                'return_reason' => 'Thiếu thông tin nghiệp vụ để tiếp tục xử lý.',
            ],
        ])->assertOk();

        $this->postJson("/api/v5/customer-request-cases/{$caseId}/transition", [
            'updated_by' => 2,
            'to_status_code' => 'not_executed',
            'status_payload' => [
                'decision_reason' => 'Khách hàng chưa cung cấp đủ dữ liệu đầu vào.',
            ],
        ])->assertOk()
            ->assertJsonPath('data.request_case.current_status_code', 'not_executed')
            ->assertJsonPath('data.status_instance.decision_context_code', 'pm_missing_customer_info_review')
            ->assertJsonPath('data.status_instance.decision_outcome_code', 'other_reason')
            ->assertJsonPath('data.status_instance.decision_source_status_code', 'returned_to_manager');

        $this->getJson("/api/v5/customer-request-cases/{$caseId}/full-detail")
            ->assertOk()
            ->assertJsonPath('data.timeline.0.decision_context_code', 'pm_missing_customer_info_review')
            ->assertJsonPath('data.timeline.0.decision_outcome_code', 'other_reason')
            ->assertJsonPath('data.timeline.0.decision_source_status_code', 'returned_to_manager')
            ->assertJsonPath('data.timeline.0.ly_do', 'PM xác nhận yêu cầu không thực hiện vì lý do khác, không phải thiếu thông tin từ khách hàng.');
    }

    public function test_pm_missing_customer_info_decision_rejects_conflicting_client_metadata(): void
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
                'feedback_request_content' => 'Bổ sung dữ liệu kiểm thử.',
                'decision_context_code' => 'pm_missing_customer_info_review',
                'decision_outcome_code' => 'other_reason',
                'decision_source_status_code' => 'new_intake',
            ],
        ])
            ->assertStatus(422)
            ->assertJsonPath('errors.decision_outcome_code.0', 'decision_outcome_code không khớp với luồng decision PM theo XML.');
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
            'not_executed',
            'waiting_customer_feedback',
            'in_progress',
            'analysis',
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
            'in_progress',
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
            'to_status_code' => 'in_progress',
            'updated_by' => 3,
            'status_payload' => [
                'performer_user_id' => 3,
                'started_at' => '2026-03-17 10:00:00',
                'expected_completed_at' => '2026-03-18 17:00:00',
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
            ->assertStatus(422)
            ->assertJsonPath('errors.to_status_code.0', 'Không thể chuyển sang trạng thái đích từ trạng thái hiện tại.');
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

        $this->getJson('/api/v5/customer-request-cases/search?q=CRC-202603-0001&updated_by=3')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.request_code', 'CRC-202603-0001');

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
