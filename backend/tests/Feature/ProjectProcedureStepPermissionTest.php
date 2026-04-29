<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V5\ProjectProcedureController;
use App\Models\InternalUser;
use App\Services\V5\SupportConfig\SupportProjectWorklogDatetimePolicyService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
use ZipArchive;

class ProjectProcedureStepPermissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSchema();
    }

    public function test_admin_can_delete_template_leaf_step_without_blocking_worklogs_and_cleanup_attachments(): void
    {
        $admin = $this->createUser([
            'id' => 1,
            'department_id' => 10,
        ]);
        $this->assignAdminRole((int) $admin->id);

        $procedureId = $this->createProcedure(projectId: 100);
        $templateStepId = $this->createStep([
            'id' => 1000,
            'procedure_id' => $procedureId,
            'template_step_id' => 500,
            'step_name' => 'Bước mẫu',
        ]);
        DB::table('attachments')->insert([
            'id' => 9001,
            'reference_type' => 'PROCEDURE_STEP',
            'reference_id' => $templateStepId,
            'file_name' => 'step.pdf',
            'file_url' => 'https://example.test/step.pdf',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteStep(
            $templateStepId,
            $this->makeRequest('DELETE', [], $admin),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_steps')->where('id', $templateStepId)->count());
        $this->assertSame(0, DB::table('attachments')->where('reference_id', $templateStepId)->count());
    }

    public function test_custom_step_creator_can_still_delete_step_with_only_custom_worklogs(): void
    {
        $creator = $this->createUser([
            'id' => 2,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100);
        $customStepId = $this->createStep([
            'id' => 1001,
            'procedure_id' => $procedureId,
            'template_step_id' => null,
            'step_name' => 'Bước tự thêm',
            'created_by' => $creator->id,
        ]);

        DB::table('project_procedure_step_worklogs')->insert([
            'step_id' => $customStepId,
            'procedure_id' => $procedureId,
            'log_type' => 'CUSTOM',
            'content' => 'Bước tùy chỉnh được thêm',
            'created_by' => $creator->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteStep(
            $customStepId,
            $this->makeRequest('DELETE', [], $creator),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_steps')->where('id', $customStepId)->count());
    }

    public function test_raci_a_can_delete_template_leaf_step_without_blocking_worklogs(): void
    {
        $accountable = $this->createUser([
            'id' => 6,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100);
        DB::table('project_procedure_raci')->insert([
            'procedure_id' => $procedureId,
            'user_id' => $accountable->id,
            'raci_role' => 'A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $templateStepId = $this->createStep([
            'id' => 1006,
            'procedure_id' => $procedureId,
            'template_step_id' => 506,
            'step_name' => 'Bước mẫu cho A',
        ]);

        $response = $this->controller()->deleteStep(
            $templateStepId,
            $this->makeRequest('DELETE', [], $accountable),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_steps')->where('id', $templateStepId)->count());
    }

    public function test_worklog_creator_can_delete_note_worklog_and_cleanup_related_records(): void
    {
        $creator = $this->createUser([
            'id' => 26,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 350);
        $stepId = $this->createStep([
            'id' => 1350,
            'procedure_id' => $procedureId,
            'template_step_id' => 550,
            'step_name' => 'Bước có worklog',
        ]);

        $worklogId = DB::table('project_procedure_step_worklogs')->insertGetId([
            'step_id' => $stepId,
            'procedure_id' => $procedureId,
            'log_type' => 'NOTE',
            'content' => 'Đã cập nhật hồ sơ',
            'created_by' => $creator->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('shared_timesheets')->insert([
            'procedure_step_worklog_id' => $worklogId,
            'hours_spent' => 2.5,
            'work_date' => now()->toDateString(),
            'activity_description' => 'Làm việc với đơn vị',
            'created_by' => $creator->id,
            'updated_by' => $creator->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('shared_issues')->insert([
            'procedure_step_worklog_id' => $worklogId,
            'issue_content' => 'Thiếu phụ lục',
            'proposal_content' => 'Bổ sung bản ký',
            'issue_status' => 'IN_PROGRESS',
            'created_by' => $creator->id,
            'updated_by' => $creator->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteWorklog(
            $this->makeRequest('DELETE', [], $creator),
            $worklogId,
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_step_worklogs')->where('id', $worklogId)->count());
        $this->assertSame(0, DB::table('shared_timesheets')->where('procedure_step_worklog_id', $worklogId)->count());
        $this->assertSame(0, DB::table('shared_issues')->where('procedure_step_worklog_id', $worklogId)->count());
    }

    public function test_non_creator_without_admin_or_raci_a_cannot_delete_note_worklog(): void
    {
        $creator = $this->createUser([
            'id' => 27,
            'department_id' => 10,
        ]);
        $viewer = $this->createUser([
            'id' => 28,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 351);
        $stepId = $this->createStep([
            'id' => 1351,
            'procedure_id' => $procedureId,
            'template_step_id' => 551,
            'step_name' => 'Bước bị chặn xoá',
        ]);

        $worklogId = DB::table('project_procedure_step_worklogs')->insertGetId([
            'step_id' => $stepId,
            'procedure_id' => $procedureId,
            'log_type' => 'NOTE',
            'content' => 'Không thuộc người này',
            'created_by' => $creator->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteWorklog(
            $this->makeRequest('DELETE', [], $viewer),
            $worklogId,
        );

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame('Bạn không có quyền xóa worklog này.', $response->getData(true)['message'] ?? null);
        $this->assertSame(1, DB::table('project_procedure_step_worklogs')->where('id', $worklogId)->count());
    }

    public function test_admin_cannot_delete_non_note_worklog(): void
    {
        $admin = $this->createUser([
            'id' => 29,
            'department_id' => 10,
        ]);
        $this->assignAdminRole((int) $admin->id);

        $procedureId = $this->createProcedure(projectId: 100, id: 352);
        $stepId = $this->createStep([
            'id' => 1352,
            'procedure_id' => $procedureId,
            'template_step_id' => 552,
            'step_name' => 'Bước có log hệ thống',
        ]);

        $worklogId = DB::table('project_procedure_step_worklogs')->insertGetId([
            'step_id' => $stepId,
            'procedure_id' => $procedureId,
            'log_type' => 'CUSTOM',
            'content' => 'Log hệ thống không được xoá',
            'created_by' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteWorklog(
            $this->makeRequest('DELETE', [], $admin),
            $worklogId,
        );

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('Chỉ có thể xóa worklog loại NOTE.', $response->getData(true)['message'] ?? null);
        $this->assertSame(1, DB::table('project_procedure_step_worklogs')->where('id', $worklogId)->count());
    }

    public function test_procedure_steps_excludes_custom_and_blank_content_worklogs_from_counts(): void
    {
        $admin = $this->createUser([
            'id' => 30,
            'department_id' => 10,
        ]);
        $this->assignAdminRole((int) $admin->id);

        $procedureId = $this->createProcedure(projectId: 100, id: 353);
        $stepId = $this->createStep([
            'id' => 1353,
            'procedure_id' => $procedureId,
            'template_step_id' => null,
            'step_name' => 'Bước tự thêm',
            'created_by' => $admin->id,
        ]);

        DB::table('project_procedure_step_worklogs')->insert([
            [
                'step_id' => $stepId,
                'procedure_id' => $procedureId,
                'log_type' => 'CUSTOM',
                'content' => 'Bước tùy chỉnh được thêm: Bước tự thêm',
                'created_by' => $admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $stepId,
                'procedure_id' => $procedureId,
                'log_type' => 'NOTE',
                'content' => '   ',
                'created_by' => $admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $stepId,
                'procedure_id' => $procedureId,
                'log_type' => 'NOTE',
                'content' => 'Đã gọi khách hàng',
                'created_by' => $admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->controller()->procedureSteps(
            $procedureId,
            $this->makeRequest('GET', [], $admin),
        );

        $this->assertSame(200, $response->getStatusCode());
        $steps = $response->getData(true)['data'] ?? [];
        $step = collect($steps)->firstWhere('id', $stepId);

        $this->assertNotNull($step);
        $this->assertSame(1, $step['worklogs_count'] ?? null);
        $this->assertSame(1, $step['blocking_worklogs_count'] ?? null);
    }

    public function test_project_worklog_datetime_policy_defaults_to_disabled_and_can_be_updated(): void
    {
        $actor = $this->createUser([
            'id' => 32,
            'department_id' => 10,
        ]);

        $service = $this->app->make(SupportProjectWorklogDatetimePolicyService::class);

        $defaultResponse = $service->policy();
        $this->assertSame(200, $defaultResponse->getStatusCode());
        $this->assertFalse($defaultResponse->getData(true)['data']['project_worklog_datetime_enabled'] ?? true);

        $enabledResponse = $service->updatePolicy($this->makeRequest('PUT', [
            'project_worklog_datetime_enabled' => true,
        ], $actor));
        $this->assertSame(200, $enabledResponse->getStatusCode());
        $this->assertTrue($enabledResponse->getData(true)['data']['project_worklog_datetime_enabled'] ?? false);

        $disabledResponse = $service->updatePolicy($this->makeRequest('PUT', [
            'project_worklog_datetime_enabled' => false,
        ], $actor));
        $this->assertSame(200, $disabledResponse->getStatusCode());
        $this->assertFalse($disabledResponse->getData(true)['data']['project_worklog_datetime_enabled'] ?? true);
    }

    public function test_project_worklog_datetime_disabled_keeps_existing_hours_flow(): void
    {
        $actor = $this->createUser([
            'id' => 33,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 355);
        $stepId = $this->createStep([
            'id' => 1355,
            'procedure_id' => $procedureId,
            'template_step_id' => 555,
            'step_name' => 'Bước ghi giờ thường',
        ]);

        $response = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Ghi nhanh worklog',
                'hours_spent' => 2,
            ], $actor),
            $stepId,
        );
        $payload = $response->getData(true);
        $worklogId = (int) ($payload['data']['id'] ?? 0);
        $timesheet = DB::table('shared_timesheets')
            ->where('procedure_step_worklog_id', $worklogId)
            ->first();

        $this->assertSame(201, $response->getStatusCode());
        $this->assertNotNull($timesheet);
        $this->assertSame(2.0, (float) $timesheet->hours_spent);
        $this->assertNull($timesheet->work_started_at);
        $this->assertNull($timesheet->work_ended_at);
    }

    public function test_project_worklog_datetime_enabled_requires_valid_range_and_accepts_equal_minutes(): void
    {
        $actor = $this->createUser([
            'id' => 34,
            'department_id' => 10,
        ]);
        $this->enableProjectWorklogDatetimePolicy();

        $procedureId = $this->createProcedure(projectId: 100, id: 356);
        $stepId = $this->createStep([
            'id' => 1356,
            'procedure_id' => $procedureId,
            'template_step_id' => 556,
            'step_name' => 'Bước cần ngày giờ',
        ]);

        $missingResponse = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Thiếu mốc thời gian',
            ], $actor),
            $stepId,
        );
        $invalidResponse = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Sai thứ tự thời gian',
                'work_started_at' => '2026-04-29T10:30',
                'work_ended_at' => '2026-04-29T10:00',
            ], $actor),
            $stepId,
        );
        $equalResponse = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Cùng một phút vẫn hợp lệ',
                'work_started_at' => '2026-04-29T10:00',
                'work_ended_at' => '2026-04-29T10:00',
            ], $actor),
            $stepId,
        );

        $this->assertSame(422, $missingResponse->getStatusCode());
        $this->assertArrayHasKey('work_started_at', $missingResponse->getData(true)['errors'] ?? []);
        $this->assertSame(422, $invalidResponse->getStatusCode());
        $this->assertArrayHasKey('work_ended_at', $invalidResponse->getData(true)['errors'] ?? []);
        $this->assertSame(201, $equalResponse->getStatusCode());
        $this->assertSame(
            0.0,
            (float) DB::table('shared_timesheets')
                ->where('procedure_step_worklog_id', $equalResponse->getData(true)['data']['id'] ?? 0)
                ->value('hours_spent')
        );
    }

    public function test_project_worklog_datetime_enabled_auto_calculates_hours_or_keeps_manual_hours(): void
    {
        $actor = $this->createUser([
            'id' => 35,
            'department_id' => 10,
        ]);
        $this->enableProjectWorklogDatetimePolicy();

        $procedureId = $this->createProcedure(projectId: 100, id: 357);
        $stepId = $this->createStep([
            'id' => 1357,
            'procedure_id' => $procedureId,
            'template_step_id' => 557,
            'step_name' => 'Bước tính giờ',
        ]);

        $autoResponse = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Tự tính 90 phút',
                'work_started_at' => '2026-04-29T08:00',
                'work_ended_at' => '2026-04-29T09:30',
            ], $actor),
            $stepId,
        );
        $manualResponse = $this->controller()->addWorklog(
            $this->makeRequest('POST', [
                'content' => 'Sửa giờ thủ công',
                'work_started_at' => '2026-04-29T08:00',
                'work_ended_at' => '2026-04-29T09:30',
                'hours_spent' => 2.25,
            ], $actor),
            $stepId,
        );

        $this->assertSame(201, $autoResponse->getStatusCode());
        $this->assertSame(201, $manualResponse->getStatusCode());
        $this->assertSame(
            1.5,
            (float) DB::table('shared_timesheets')
                ->where('procedure_step_worklog_id', $autoResponse->getData(true)['data']['id'] ?? 0)
                ->value('hours_spent')
        );
        $this->assertSame(
            2.25,
            (float) DB::table('shared_timesheets')
                ->where('procedure_step_worklog_id', $manualResponse->getData(true)['data']['id'] ?? 0)
                ->value('hours_spent')
        );
        $this->assertSame(
            '2026-04-29 08:00:00',
            (string) DB::table('shared_timesheets')
                ->where('procedure_step_worklog_id', $autoResponse->getData(true)['data']['id'] ?? 0)
                ->value('work_started_at')
        );
    }

    public function test_admin_can_delete_step_when_only_blank_content_worklog_exists(): void
    {
        $admin = $this->createUser([
            'id' => 31,
            'department_id' => 10,
        ]);
        $this->assignAdminRole((int) $admin->id);

        $procedureId = $this->createProcedure(projectId: 100, id: 354);
        $stepId = $this->createStep([
            'id' => 1354,
            'procedure_id' => $procedureId,
            'template_step_id' => 554,
            'step_name' => 'Bước có log trắng',
        ]);

        DB::table('project_procedure_step_worklogs')->insert([
            'step_id' => $stepId,
            'procedure_id' => $procedureId,
            'log_type' => 'NOTE',
            'content' => '   ',
            'created_by' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->deleteStep(
            $stepId,
            $this->makeRequest('DELETE', [], $admin),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_steps')->where('id', $stepId)->count());
    }

    public function test_project_procedures_allows_cross_department_project_raci_members_without_legacy_table(): void
    {
        $member = $this->createUser([
            'id' => 16,
            'department_id' => 20,
        ]);

        Schema::create('raci_assignments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('entity_type', 50);
            $table->unsignedBigInteger('entity_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->timestamps();
        });

        DB::table('raci_assignments')->insert([
            'id' => 1,
            'entity_type' => 'project',
            'entity_id' => 100,
            'user_id' => $member->id,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->projectProcedures(
            100,
            $this->makeRequest('GET', [], $member),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([], $response->getData(true)['data'] ?? null);
    }

    public function test_project_procedures_allows_child_department_users_of_project_owner_department(): void
    {
        $member = $this->createUser([
            'id' => 17,
            'department_id' => 2,
        ]);

        DB::table('departments')->insert([
            ['id' => 1, 'parent_id' => null, 'dept_code' => 'ROOT', 'dept_name' => 'Root', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'parent_id' => 1, 'dept_code' => 'CHILD', 'dept_name' => 'Child', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('projects')
            ->where('id', 100)
            ->update(['department_id' => 1]);

        DB::table('user_dept_scopes')->insert([
            'user_id' => $member->id,
            'dept_id' => 2,
            'scope_type' => 'DEPT_ONLY',
        ]);

        $response = $this->controller()->projectProcedures(
            100,
            $this->makeRequest('GET', [], $member),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([], $response->getData(true)['data'] ?? null);
    }

    public function test_create_public_share_stores_only_hash_and_supported_duration(): void
    {
        $user = $this->createUser([
            'id' => 50,
            'department_id' => 10,
        ]);

        foreach ([10, 30, 90] as $index => $ttlDays) {
            $procedureId = $this->createProcedure(projectId: 100, id: 370 + $index, name: 'Thủ tục public '.$ttlDays);
            $accessKey = 'share-key-'.$ttlDays;

            $response = $this->controller()->createPublicShare(
                $this->makeRequest('POST', [
                    'ttl_days' => $ttlDays,
                    'access_key' => $accessKey,
                ], $user),
                $procedureId,
            );

            $payload = $response->getData(true);
            $token = (string) ($payload['data']['token'] ?? '');
            $expiresAt = \Illuminate\Support\Carbon::parse((string) ($payload['data']['expires_at'] ?? ''));
            $share = DB::table('project_procedure_public_shares')
                ->where('token_hash', hash('sha256', $token))
                ->first();

            $this->assertSame(201, $response->getStatusCode());
            $this->assertSame($ttlDays, $payload['data']['ttl_days'] ?? null);
            $this->assertSame('FAILED', $payload['data']['email']['status'] ?? null);
            $this->assertStringContainsString('/public/project-procedure/', (string) ($payload['data']['public_url'] ?? ''));
            $this->assertGreaterThanOrEqual(48, strlen($token));
            $this->assertSame(0, DB::table('project_procedure_public_shares')->where('token_hash', $token)->count());
            $this->assertNotNull($share);
            $this->assertTrue(Hash::check($accessKey, (string) $share->access_key_hash));
            $this->assertStringNotContainsString($accessKey, json_encode($payload, JSON_UNESCAPED_UNICODE));
            $this->assertTrue($expiresAt->between(now()->addDays($ttlDays)->subMinute(), now()->addDays($ttlDays)->addMinute()));
        }
    }

    public function test_create_public_share_requires_supported_duration_and_access_key(): void
    {
        $user = $this->createUser([
            'id' => 55,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 375, name: 'Thủ tục validate public');

        $missingKeyResponse = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 10,
            ], $user),
            $procedureId,
        );
        $invalidDurationResponse = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 7,
                'access_key' => 'valid-key',
            ], $user),
            $procedureId,
        );

        $this->assertSame(422, $missingKeyResponse->getStatusCode());
        $this->assertSame(422, $invalidDurationResponse->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_public_shares')->count());
    }

    public function test_create_public_share_sends_email_with_link_key_and_expiry(): void
    {
        $user = $this->createUser([
            'id' => 56,
            'department_id' => 10,
            'username' => 'procedure-owner',
            'full_name' => 'Procedure Owner',
        ]);

        DB::table('integration_settings')->insert([
            'provider' => 'EMAIL_SMTP',
            'is_enabled' => 1,
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'no-reply@example.com',
            'smtp_password' => Crypt::encryptString('smtp-secret'),
            'smtp_from_address' => 'no-reply@example.com',
            'smtp_from_name' => 'VNPT Business',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Config::set('audit.project_procedure_public_share_notification_recipients', [
            'pvro86@gmail.com',
            'vnpthishg@gmail.com',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 376, name: 'Thủ tục gửi email public');
        $request = $this->makeRequest('POST', [
            'ttl_days' => 30,
            'access_key' => 'Email-Key-1234',
        ], $user);
        $request->headers->set('Origin', 'http://127.0.0.1:5175');

        Mail::shouldReceive('html')
            ->once()
            ->withArgs(function (string $html, \Closure $callback): bool {
                $this->assertStringContainsString('Public bảng thủ tục dự án', $html);
                $this->assertStringContainsString('DA-100', $html);
                $this->assertStringContainsString('Thủ tục gửi email public', $html);
                $this->assertStringContainsString('Procedure Owner (procedure-owner)', $html);
                $this->assertStringContainsString('/public/project-procedure/', $html);
                $this->assertStringContainsString('Email-Key-1234', $html);
                $this->assertStringContainsString('Hết hạn', $html);

                $message = new class {
                    public array $to = [];
                    public ?string $subject = null;
                    public ?array $from = null;

                    public function to($recipients): self
                    {
                        $this->to = is_array($recipients) ? array_values($recipients) : [$recipients];

                        return $this;
                    }

                    public function subject($subject): self
                    {
                        $this->subject = $subject;

                        return $this;
                    }

                    public function from($address, $name = null): self
                    {
                        $this->from = [$address, $name];

                        return $this;
                    }
                };

                $callback($message);

                $this->assertSame(['pvro86@gmail.com', 'vnpthishg@gmail.com'], $message->to);
                $this->assertSame('[VNPT Business] Public bảng thủ tục - DA-100', $message->subject);
                $this->assertSame(['no-reply@example.com', 'VNPT Business'], $message->from);

                return true;
            });

        $response = $this->controller()->createPublicShare($request, $procedureId);
        $payload = $response->getData(true);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertStringStartsWith('http://127.0.0.1:5175/public/project-procedure/', (string) ($payload['data']['public_url'] ?? ''));
        $this->assertSame('SUCCESS', $payload['data']['email']['status'] ?? null);
        $this->assertSame(['pvro86@gmail.com', 'vnpthishg@gmail.com'], $payload['data']['email']['recipients'] ?? null);
        $this->assertStringNotContainsString('Email-Key-1234', json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    public function test_create_public_share_rejects_user_outside_project_scope(): void
    {
        $outsider = $this->createUser([
            'id' => 51,
            'department_id' => 20,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 371, name: 'Thủ tục nội bộ');

        $response = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 10,
                'access_key' => 'scope-key',
            ], $outsider),
            $procedureId,
        );

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_public_shares')->count());
    }

    public function test_public_share_payload_excludes_sensitive_internal_fields(): void
    {
        $user = $this->createUser([
            'id' => 52,
            'department_id' => 10,
        ]);
        $procedureId = $this->createProcedure(projectId: 100, id: 372, name: 'Thủ tục chia sẻ');
        $stepId = $this->createStep([
            'id' => 1420,
            'procedure_id' => $procedureId,
            'phase_label' => 'Chuẩn bị hồ sơ',
            'step_name' => 'Hoàn thiện biểu mẫu',
            'step_detail' => 'Chỉ nội dung bảng thủ tục được public.',
            'lead_unit' => 'PM',
            'support_unit' => 'Kỹ thuật',
            'expected_result' => 'Hồ sơ hợp lệ',
            'duration_days' => 3,
            'progress_status' => 'DANG_THUC_HIEN',
            'document_number' => 'VB-01',
            'document_date' => '2026-04-20',
            'actual_start_date' => '2026-04-21',
            'actual_end_date' => '2026-04-23',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        DB::table('attachments')->insert([
            'reference_type' => 'PROCEDURE_STEP',
            'reference_id' => $stepId,
            'file_name' => 'secret.pdf',
            'file_url' => 'https://example.test/secret.pdf',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('project_procedure_raci')->insert([
            'procedure_id' => $procedureId,
            'user_id' => $user->id,
            'raci_role' => 'A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('project_procedure_step_worklogs')->insert([
            'step_id' => $stepId,
            'procedure_id' => $procedureId,
            'log_type' => 'NOTE',
            'content' => 'Nội dung worklog không được public.',
            'created_by' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shareResponse = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 30,
                'access_key' => 'payload-key',
            ], $user),
            $procedureId,
        );
        $token = (string) (($shareResponse->getData(true)['data']['token'] ?? ''));

        $missingKeyResponse = $this->controller()->publicShare(
            $this->makePublicRequest('POST', []),
            $token,
        );
        $wrongKeyResponse = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'wrong-key']),
            $token,
        );
        $queryKeyResponse = $this->controller()->publicShare(
            $this->makePublicRequest('GET', ['access_key' => 'payload-key']),
            $token,
        );
        $response = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'payload-key']),
            $token,
        );
        $payload = $response->getData(true);
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $firstStep = $payload['data']['phases'][0]['steps'][0] ?? [];

        $this->assertSame(403, $missingKeyResponse->getStatusCode());
        $this->assertSame(403, $wrongKeyResponse->getStatusCode());
        $this->assertSame(403, $queryKeyResponse->getStatusCode());
        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('DA-100', $payload['data']['project']['project_code'] ?? null);
        $this->assertSame('Hoàn thiện biểu mẫu', $firstStep['step_name'] ?? null);
        $this->assertSame('21/04/2026', \Illuminate\Support\Carbon::parse($firstStep['actual_start_date'])->format('d/m/Y'));
        $this->assertArrayNotHasKey('id', $firstStep);
        $this->assertArrayNotHasKey('procedure_id', $firstStep);
        $this->assertArrayNotHasKey('created_by', $firstStep);
        $this->assertStringNotContainsString('secret.pdf', (string) $json);
        $this->assertStringNotContainsString('file_url', (string) $json);
        $this->assertStringNotContainsString('Nội dung worklog', (string) $json);
        $this->assertStringNotContainsString('raci_role', (string) $json);
    }

    public function test_public_share_uses_project_based_title_for_generic_service_procedure(): void
    {
        $user = $this->createUser([
            'id' => 57,
            'department_id' => 10,
        ]);
        $procedureId = $this->createProcedure(
            projectId: 100,
            id: 377,
            name: 'Thủ tục dự án thuê dịch vụ CNTT đặc thù'
        );

        $shareResponse = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 10,
                'access_key' => 'title-key',
            ], $user),
            $procedureId,
        );
        $token = (string) (($shareResponse->getData(true)['data']['token'] ?? ''));

        $response = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'title-key']),
            $token,
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Kế hoạch triển khai - Checklist Demo', $response->getData(true)['data']['procedure']['procedure_name'] ?? null);
    }

    public function test_public_share_rejects_revoked_expired_and_unknown_tokens(): void
    {
        $user = $this->createUser([
            'id' => 53,
            'department_id' => 10,
        ]);
        $procedureId = $this->createProcedure(projectId: 100, id: 373, name: 'Thủ tục hết hạn');

        $shareResponse = $this->controller()->createPublicShare(
            $this->makeRequest('POST', [
                'ttl_days' => 10,
                'access_key' => 'active-key',
            ], $user),
            $procedureId,
        );
        $token = (string) (($shareResponse->getData(true)['data']['token'] ?? ''));

        $this->controller()->revokePublicShare($this->makeRequest('DELETE', [], $user), $procedureId);

        $revokedResponse = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'active-key']),
            $token,
        );
        $this->assertSame(404, $revokedResponse->getStatusCode());

        $expiredToken = 'expired-token-'.str_repeat('x', 40);
        DB::table('project_procedure_public_shares')->insert([
            'procedure_id' => $procedureId,
            'token_hash' => hash('sha256', $expiredToken),
            'access_key_hash' => Hash::make('expired-key'),
            'created_by' => $user->id,
            'expires_at' => now()->subDay(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $expiredResponse = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'expired-key']),
            $expiredToken,
        );
        $unknownResponse = $this->controller()->publicShare(
            $this->makePublicRequest('POST', ['access_key' => 'anything']),
            'unknown-token-'.str_repeat('z', 40),
        );

        $this->assertSame(404, $expiredResponse->getStatusCode());
        $this->assertSame(404, $unknownResponse->getStatusCode());
    }

    public function test_procedure_export_word_and_excel_use_allow_list_payload(): void
    {
        $user = $this->createUser([
            'id' => 54,
            'department_id' => 10,
        ]);
        $procedureId = $this->createProcedure(projectId: 100, id: 374, name: 'Thủ tục xuất file');
        $this->createStep([
            'id' => 1430,
            'procedure_id' => $procedureId,
            'step_name' => 'Xuất dữ liệu',
            'lead_unit' => 'PM',
            'expected_result' => 'File thủ tục',
            'duration_days' => 2,
            'progress_status' => 'HOAN_THANH',
            'actual_start_date' => '2026-10-10',
            'actual_end_date' => '2026-10-11',
        ]);
        $this->createStep([
            'id' => 1431,
            'procedure_id' => $procedureId,
            'step_number' => 2,
            'phase' => 'CAU_HINH_HE_THONG',
            'phase_label' => 'Cấu hình hệ thống',
            'step_name' => 'Cấu hình hệ thống',
            'lead_unit' => 'IT',
            'expected_result' => 'Hệ thống sẵn sàng',
            'duration_days' => 10,
            'progress_status' => 'DANG_THUC_HIEN',
            'actual_start_date' => '2026-10-10',
            'actual_end_date' => '2026-10-19',
        ]);

        $wordResponse = $this->controller()->exportProcedure(
            $this->makeRequest('GET', ['format' => 'word'], $user),
            $procedureId,
        );
        $excelResponse = $this->controller()->exportProcedure(
            $this->makeRequest('GET', ['format' => 'excel'], $user),
            $procedureId,
        );
        $invalidResponse = $this->controller()->exportProcedure(
            $this->makeRequest('GET', ['format' => 'pdf'], $user),
            $procedureId,
        );

        $this->assertSame(200, $wordResponse->getStatusCode());
        $this->assertStringContainsString('wordprocessingml.document', (string) $wordResponse->headers->get('Content-Type'));
        $this->assertStringContainsString('.docx', (string) $wordResponse->headers->get('Content-Disposition'));
        $wordBinary = (string) $wordResponse->getContent();
        $this->assertGreaterThan(100, strlen($wordBinary));

        $tempWordPath = tempnam(sys_get_temp_dir(), 'procedure_word_');
        $this->assertNotFalse($tempWordPath);
        file_put_contents($tempWordPath, $wordBinary);
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($tempWordPath) === true);
        $wordDocumentXml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($tempWordPath);

        $this->assertIsString($wordDocumentXml);
        $this->assertNotFalse(simplexml_load_string($wordDocumentXml));
        $this->assertStringContainsString('Times New Roman', $wordDocumentXml);
        $this->assertStringContainsString('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', $wordDocumentXml);
        $this->assertStringContainsString('Độc lập - Tự do - Hạnh phúc', $wordDocumentXml);
        $this->assertStringContainsString('Cần Thơ, ngày', $wordDocumentXml);
        $this->assertStringContainsString('<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"', $wordDocumentXml);
        $this->assertStringContainsString('<w:tblW w:w="14280" w:type="dxa"/>', $wordDocumentXml);
        $this->assertSame(1, substr_count($wordDocumentXml, '<w:t xml:space="preserve">TT</w:t>'));
        $this->assertSame(1, substr_count($wordDocumentXml, '<w:t xml:space="preserve">Trình tự công việc</w:t>'));
        $this->assertSame(2, substr_count($wordDocumentXml, '<w:gridSpan w:val="9"/>'));
        $this->assertStringContainsString('2. Cấu hình hệ thống', $wordDocumentXml);
        $this->assertStringContainsString('<w:gridCol w:w="1220"/><w:gridCol w:w="1220"/>', $wordDocumentXml);
        $this->assertGreaterThanOrEqual(6, substr_count($wordDocumentXml, '<w:noWrap/>'));

        $this->assertSame(200, $excelResponse->getStatusCode());
        $this->assertStringContainsString('application/vnd.ms-excel', (string) $excelResponse->headers->get('Content-Type'));
        $this->assertStringContainsString('.xls', (string) $excelResponse->headers->get('Content-Disposition'));
        $excelContent = (string) $excelResponse->getContent();
        $excelXml = preg_replace('/^\xEF\xBB\xBF/', '', $excelContent) ?? $excelContent;
        $this->assertNotFalse(simplexml_load_string($excelXml));
        $this->assertStringContainsString('Xuất dữ liệu', $excelContent);
        $this->assertStringContainsString('Times New Roman', $excelContent);
        $this->assertStringContainsString('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', $excelContent);
        $this->assertStringContainsString('Độc lập - Tự do - Hạnh phúc', $excelContent);
        $this->assertStringContainsString('<Layout x:Orientation="Landscape"/>', $excelContent);
        $this->assertStringContainsString('<PageMargins x:Top="0.79" x:Bottom="0.79" x:Left="1.18" x:Right="0.59"/>', $excelContent);
        $this->assertStringContainsString('<PaperSizeIndex>9</PaperSizeIndex>', $excelContent);
        $this->assertSame(1, substr_count($excelContent, '<Data ss:Type="String">TT</Data>'));
        $this->assertSame(1, substr_count($excelContent, '<Data ss:Type="String">Trình tự công việc</Data>'));
        $this->assertSame(2, substr_count($excelContent, 'ss:StyleID="Phase" ss:MergeAcross="8"'));
        $this->assertStringContainsString('2. Cấu hình hệ thống', $excelContent);
        $this->assertStringContainsString('<Column ss:Width="110"/><Column ss:Width="110"/>', $excelContent);
        $this->assertStringContainsString('<Style ss:ID="Phase"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Times New Roman" ss:Size="13" ss:Color="#000000" ss:Bold="1"/><Borders>', $excelContent);

        $this->assertSame(422, $invalidResponse->getStatusCode());
    }

    public function test_admin_cannot_delete_step_that_still_has_children(): void
    {
        $admin = $this->createUser([
            'id' => 7,
            'department_id' => 10,
        ]);
        $this->assignAdminRole((int) $admin->id);

        $procedureId = $this->createProcedure(projectId: 100);
        $parentStepId = $this->createStep([
            'id' => 1007,
            'procedure_id' => $procedureId,
            'template_step_id' => 507,
            'step_name' => 'Bước cha',
        ]);
        $this->createStep([
            'id' => 1008,
            'procedure_id' => $procedureId,
            'template_step_id' => null,
            'parent_step_id' => $parentStepId,
            'step_name' => 'Bước con',
            'sort_order' => 2,
        ]);

        $response = $this->controller()->deleteStep(
            $parentStepId,
            $this->makeRequest('DELETE', [], $admin),
        );

        $this->assertSame(409, $response->getStatusCode());
        $this->assertSame('Không thể xóa bước đang có bước con.', $response->getData(true)['message'] ?? null);
        $this->assertSame(1, DB::table('project_procedure_steps')->where('id', $parentStepId)->count());
    }

    public function test_reorder_steps_updates_only_sort_order_for_same_procedure_phase(): void
    {
        $user = $this->createUser([
            'id' => 40,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 360);
        $parentStepId = $this->createStep([
            'id' => 1360,
            'procedure_id' => $procedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 10,
            'step_name' => 'Bước cha',
        ]);
        $childStepId = $this->createStep([
            'id' => 1361,
            'procedure_id' => $procedureId,
            'parent_step_id' => $parentStepId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 20,
            'step_name' => 'Bước con',
        ]);
        $nextStepId = $this->createStep([
            'id' => 1362,
            'procedure_id' => $procedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 30,
            'step_name' => 'Bước kế tiếp',
            'progress_status' => 'DANG_THUC_HIEN',
        ]);

        $response = $this->controller()->reorderSteps($this->makeRequest('POST', [
            'steps' => [
                ['id' => $parentStepId, 'sort_order' => 30],
                ['id' => $childStepId, 'sort_order' => 40],
                ['id' => $nextStepId, 'sort_order' => 10],
            ],
        ], $user));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(30, (int) DB::table('project_procedure_steps')->where('id', $parentStepId)->value('sort_order'));
        $this->assertSame(40, (int) DB::table('project_procedure_steps')->where('id', $childStepId)->value('sort_order'));
        $this->assertSame(10, (int) DB::table('project_procedure_steps')->where('id', $nextStepId)->value('sort_order'));
        $this->assertSame($parentStepId, (int) DB::table('project_procedure_steps')->where('id', $childStepId)->value('parent_step_id'));
        $this->assertSame('CHUAN_BI', DB::table('project_procedure_steps')->where('id', $childStepId)->value('phase'));
        $this->assertSame('DANG_THUC_HIEN', DB::table('project_procedure_steps')->where('id', $nextStepId)->value('progress_status'));
    }

    public function test_reorder_steps_rejects_duplicate_step_ids(): void
    {
        $user = $this->createUser([
            'id' => 41,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 361);
        $stepId = $this->createStep([
            'id' => 1370,
            'procedure_id' => $procedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 10,
        ]);

        $response = $this->controller()->reorderSteps($this->makeRequest('POST', [
            'steps' => [
                ['id' => $stepId, 'sort_order' => 20],
                ['id' => $stepId, 'sort_order' => 30],
            ],
        ], $user));

        $this->assertSame(422, $response->getStatusCode());
        $this->assertArrayHasKey('steps', $response->getData(true)['errors'] ?? []);
        $this->assertSame(10, (int) DB::table('project_procedure_steps')->where('id', $stepId)->value('sort_order'));
    }

    public function test_reorder_steps_rejects_steps_from_multiple_procedures(): void
    {
        $user = $this->createUser([
            'id' => 42,
            'department_id' => 10,
        ]);

        $firstProcedureId = $this->createProcedure(projectId: 100, id: 362, name: 'Thủ tục 1');
        $secondProcedureId = $this->createProcedure(projectId: 100, id: 363, name: 'Thủ tục 2');
        $firstStepId = $this->createStep([
            'id' => 1380,
            'procedure_id' => $firstProcedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 10,
        ]);
        $secondStepId = $this->createStep([
            'id' => 1381,
            'procedure_id' => $secondProcedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 20,
        ]);

        $response = $this->controller()->reorderSteps($this->makeRequest('POST', [
            'steps' => [
                ['id' => $firstStepId, 'sort_order' => 20],
                ['id' => $secondStepId, 'sort_order' => 10],
            ],
        ], $user));

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('Các bước sắp xếp phải thuộc cùng một thủ tục.', $response->getData(true)['errors']['steps'][0] ?? null);
        $this->assertSame(10, (int) DB::table('project_procedure_steps')->where('id', $firstStepId)->value('sort_order'));
        $this->assertSame(20, (int) DB::table('project_procedure_steps')->where('id', $secondStepId)->value('sort_order'));
    }

    public function test_reorder_steps_rejects_steps_from_multiple_phases(): void
    {
        $user = $this->createUser([
            'id' => 43,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 364);
        $firstStepId = $this->createStep([
            'id' => 1390,
            'procedure_id' => $procedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 10,
        ]);
        $secondStepId = $this->createStep([
            'id' => 1391,
            'procedure_id' => $procedureId,
            'phase' => 'THUC_HIEN_DAU_TU',
            'sort_order' => 20,
        ]);

        $response = $this->controller()->reorderSteps($this->makeRequest('POST', [
            'steps' => [
                ['id' => $firstStepId, 'sort_order' => 20],
                ['id' => $secondStepId, 'sort_order' => 10],
            ],
        ], $user));

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('Các bước sắp xếp phải thuộc cùng một giai đoạn.', $response->getData(true)['errors']['steps'][0] ?? null);
        $this->assertSame(10, (int) DB::table('project_procedure_steps')->where('id', $firstStepId)->value('sort_order'));
        $this->assertSame(20, (int) DB::table('project_procedure_steps')->where('id', $secondStepId)->value('sort_order'));
    }

    public function test_reorder_steps_rejects_payload_that_attempts_to_change_parent(): void
    {
        $user = $this->createUser([
            'id' => 44,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 365);
        $parentStepId = $this->createStep([
            'id' => 1400,
            'procedure_id' => $procedureId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 10,
        ]);
        $childStepId = $this->createStep([
            'id' => 1401,
            'procedure_id' => $procedureId,
            'parent_step_id' => $parentStepId,
            'phase' => 'CHUAN_BI',
            'sort_order' => 20,
        ]);

        $response = $this->controller()->reorderSteps($this->makeRequest('POST', [
            'steps' => [
                ['id' => $childStepId, 'sort_order' => 15, 'parent_step_id' => null],
            ],
        ], $user));

        $this->assertSame(422, $response->getStatusCode());
        $this->assertArrayHasKey('steps.0.parent_step_id', $response->getData(true)['errors'] ?? []);
        $this->assertSame(20, (int) DB::table('project_procedure_steps')->where('id', $childStepId)->value('sort_order'));
        $this->assertSame($parentStepId, (int) DB::table('project_procedure_steps')->where('id', $childStepId)->value('parent_step_id'));
    }

    public function test_add_custom_step_rejects_parent_step_from_another_procedure(): void
    {
        $user = $this->createUser([
            'id' => 3,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100);
        $otherProcedureId = $this->createProcedure(projectId: 100, id: 201, name: 'Thu tuc khac');
        $foreignParentId = $this->createStep([
            'id' => 1002,
            'procedure_id' => $otherProcedureId,
            'template_step_id' => 700,
            'step_name' => 'Bước cha thủ tục khác',
        ]);

        $beforeCount = DB::table('project_procedure_steps')->where('procedure_id', $procedureId)->count();

        $response = $this->controller()->addCustomStep(
            $this->makeRequest('POST', [
                'step_name' => 'Bước con sai thủ tục',
                'parent_step_id' => $foreignParentId,
            ], $user),
            $procedureId,
        );

        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('parent_step_id phải thuộc cùng thủ tục.', $response->getData(true)['message'] ?? null);
        $this->assertSame($beforeCount, DB::table('project_procedure_steps')->where('procedure_id', $procedureId)->count());
    }

    public function test_add_custom_child_step_is_inserted_immediately_after_parent_block(): void
    {
        $user = $this->createUser([
            'id' => 4,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100);
        $parentStepId = $this->createStep([
            'id' => 1010,
            'procedure_id' => $procedureId,
            'step_number' => 5,
            'sort_order' => 20,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Mục 5',
        ]);
        $this->createStep([
            'id' => 1011,
            'procedure_id' => $procedureId,
            'template_step_id' => null,
            'parent_step_id' => $parentStepId,
            'sort_order' => 21,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Con cũ',
        ]);
        $nextTopLevelId = $this->createStep([
            'id' => 1012,
            'procedure_id' => $procedureId,
            'step_number' => 6,
            'sort_order' => 22,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Mục 6',
        ]);

        $response = $this->controller()->addCustomStep(
            $this->makeRequest('POST', [
                'step_name' => 'Con mới',
                'phase' => 'CHUAN_BI',
                'parent_step_id' => $parentStepId,
            ], $user),
            $procedureId,
        );

        $payload = $response->getData(true);
        $insertedId = (int) ($payload['data']['id'] ?? 0);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(22, (int) DB::table('project_procedure_steps')->where('id', $insertedId)->value('sort_order'));
        $this->assertSame($parentStepId, (int) DB::table('project_procedure_steps')->where('id', $insertedId)->value('parent_step_id'));
        $this->assertSame(23, (int) DB::table('project_procedure_steps')->where('id', $nextTopLevelId)->value('sort_order'));
    }

    public function test_add_custom_top_level_step_is_inserted_at_end_of_selected_phase(): void
    {
        $user = $this->createUser([
            'id' => 5,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100);
        $this->createStep([
            'id' => 1020,
            'procedure_id' => $procedureId,
            'step_number' => 1,
            'sort_order' => 10,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Chuẩn bị 1',
        ]);
        $nextPhaseStepId = $this->createStep([
            'id' => 1021,
            'procedure_id' => $procedureId,
            'step_number' => 2,
            'sort_order' => 20,
            'phase' => 'THUC_HIEN_DAU_TU',
            'step_name' => 'Thực hiện 1',
        ]);

        $response = $this->controller()->addCustomStep(
            $this->makeRequest('POST', [
                'step_name' => 'Thêm trong phase chuẩn bị',
                'phase' => 'CHUAN_BI',
            ], $user),
            $procedureId,
        );

        $payload = $response->getData(true);
        $insertedId = (int) ($payload['data']['id'] ?? 0);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(11, (int) DB::table('project_procedure_steps')->where('id', $insertedId)->value('sort_order'));
        $this->assertSame(21, (int) DB::table('project_procedure_steps')->where('id', $nextPhaseStepId)->value('sort_order'));
    }

    public function test_add_custom_child_step_persists_dates_and_progress_status(): void
    {
        $user = $this->createUser([
            'id' => 8,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 208);
        $parentStepId = $this->createStep([
            'id' => 1080,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước cha có ngày',
            'duration_days' => 10,
            'actual_start_date' => '2025-10-10',
        ]);

        $response = $this->controller()->addCustomStep(
            $this->makeRequest('POST', [
                'step_name' => 'Bước con có trạng thái',
                'parent_step_id' => $parentStepId,
                'duration_days' => 3,
                'actual_start_date' => '2025-10-12',
                'actual_end_date' => '2025-10-14',
                'progress_status' => 'DANG_THUC_HIEN',
            ], $user),
            $procedureId,
        );

        $payload = $response->getData(true);
        $insertedId = (int) ($payload['data']['id'] ?? 0);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('2025-10-12', DB::table('project_procedure_steps')->where('id', $insertedId)->value('actual_start_date'));
        $this->assertSame('2025-10-14', DB::table('project_procedure_steps')->where('id', $insertedId)->value('actual_end_date'));
        $this->assertSame('DANG_THUC_HIEN', DB::table('project_procedure_steps')->where('id', $insertedId)->value('progress_status'));
    }

    public function test_add_custom_child_step_rejects_dates_outside_parent_range(): void
    {
        $user = $this->createUser([
            'id' => 9,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 209);
        $parentStepId = $this->createStep([
            'id' => 1090,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước cha có phạm vi ngày',
            'duration_days' => 10,
            'actual_start_date' => '2025-10-10',
        ]);

        $response = $this->controller()->addCustomStep(
            $this->makeRequest('POST', [
                'step_name' => 'Bước con sai ngày',
                'parent_step_id' => $parentStepId,
                'duration_days' => 3,
                'actual_start_date' => '2025-10-18',
                'actual_end_date' => '2025-10-20',
            ], $user),
            $procedureId,
        );

        $payload = $response->getData(true);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertArrayHasKey('actual_end_date', $payload['errors'] ?? []);
        $this->assertSame(
            0,
            DB::table('project_procedure_steps')
                ->where('procedure_id', $procedureId)
                ->where('step_name', 'Bước con sai ngày')
                ->count()
        );
    }

    public function test_batch_update_steps_persists_duration_days_and_dates(): void
    {
        $user = $this->createUser([
            'id' => 29,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 210);
        $stepId = $this->createStep([
            'id' => 1100,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước cập nhật ngày',
            'duration_days' => 0,
        ]);

        $response = $this->controller()->batchUpdateSteps($this->makeRequest('PUT', [
            'steps' => [
                [
                    'id' => $stepId,
                    'duration_days' => 4,
                    'actual_start_date' => '2025-10-10',
                    'actual_end_date' => '2025-10-13',
                ],
            ],
        ], $user));

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(4, (int) DB::table('project_procedure_steps')->where('id', $stepId)->value('duration_days'));
        $this->assertSame('2025-10-10', DB::table('project_procedure_steps')->where('id', $stepId)->value('actual_start_date'));
        $this->assertSame('2025-10-13', DB::table('project_procedure_steps')->where('id', $stepId)->value('actual_end_date'));
    }

    public function test_batch_update_steps_rejects_end_date_before_resolved_start_date(): void
    {
        $user = $this->createUser([
            'id' => 30,
            'department_id' => 10,
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 211);
        $stepId = $this->createStep([
            'id' => 1110,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước sai ngày',
            'actual_start_date' => '2025-10-10',
            'actual_end_date' => null,
        ]);

        $response = $this->controller()->batchUpdateSteps($this->makeRequest('PUT', [
            'steps' => [
                [
                    'id' => $stepId,
                    'actual_end_date' => '2025-10-09',
                ],
            ],
        ], $user));

        $payload = $response->getData(true);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertArrayHasKey('steps.0.actual_end_date', $payload['errors'] ?? []);
        $this->assertNull(DB::table('project_procedure_steps')->where('id', $stepId)->value('actual_end_date'));
    }

    public function test_set_step_raci_replaces_existing_accountable_assignment(): void
    {
        $actor = $this->createUser([
            'id' => 11,
            'department_id' => 10,
        ]);
        $oldAccountable = $this->createUser([
            'id' => 12,
            'department_id' => 10,
            'full_name' => 'Old Accountable',
        ]);
        $newAccountable = $this->createUser([
            'id' => 13,
            'department_id' => 10,
            'full_name' => 'New Accountable',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 310);
        $stepId = $this->createStep([
            'id' => 1310,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước cần chuyển A',
        ]);

        DB::table('project_procedure_raci')->insert([
            [
                'procedure_id' => $procedureId,
                'user_id' => $oldAccountable->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $newAccountable->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('project_procedure_step_raci')->insert([
            'step_id' => $stepId,
            'user_id' => $oldAccountable->id,
            'raci_role' => 'A',
            'created_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->setStepRaci(
            $this->makeRequest('POST', [
                'user_id' => $newAccountable->id,
                'raci_role' => 'A',
            ], $actor),
            $stepId,
        );

        $this->assertContains($response->getStatusCode(), [200, 201]);
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $stepId)->where('raci_role', 'A')->count());
        $this->assertSame(
            $newAccountable->id,
            DB::table('project_procedure_step_raci')->where('step_id', $stepId)->where('raci_role', 'A')->value('user_id')
        );
    }

    public function test_step_raci_payload_includes_department_allow_list_only(): void
    {
        $actor = $this->createUser([
            'id' => 44,
            'department_id' => 10,
        ]);
        $responsible = $this->createUser([
            'id' => 45,
            'department_id' => 10,
            'full_name' => 'Nguyen Van Responsible',
            'user_code' => 'NV045',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 342);
        $stepId = $this->createStep([
            'id' => 1345,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước có người thực hiện',
        ]);

        DB::table('project_procedure_raci')->insert([
            'procedure_id' => $procedureId,
            'user_id' => $responsible->id,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('project_procedure_step_raci')->insert([
            'step_id' => $stepId,
            'user_id' => $responsible->id,
            'raci_role' => 'R',
            'created_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->getStepRaciBulk(
            $procedureId,
            $this->makeRequest('GET', [], $actor),
        );

        $payload = $response->getData(true);
        $row = collect($payload['data'] ?? [])->firstWhere('user_id', $responsible->id);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertIsArray($row);
        $this->assertSame($stepId, $row['step_id']);
        $this->assertSame('R', $row['raci_role']);
        $this->assertSame('Nguyen Van Responsible', $row['full_name']);
        $this->assertSame(10, $row['department_id']);
        $this->assertSame('Phong Ky thuat', $row['department_name']);
        $this->assertSame('PKT', $row['department_code']);
        $this->assertArrayNotHasKey('email', $row);
        $this->assertArrayNotHasKey('phone', $row);
        $this->assertArrayNotHasKey('permissions', $row);
        $this->assertArrayNotHasKey('dept_scopes', $row);
        $this->assertArrayNotHasKey('avatar_data_url', $row);
    }

    public function test_add_procedure_raci_replaces_existing_accountable_assignment_and_keeps_other_roles(): void
    {
        $actor = $this->createUser([
            'id' => 14,
            'department_id' => 10,
        ]);
        $oldAccountable = $this->createUser([
            'id' => 15,
            'department_id' => 10,
            'full_name' => 'Old Procedure A',
        ]);
        $newAccountable = $this->createUser([
            'id' => 18,
            'department_id' => 10,
            'full_name' => 'New Procedure A',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 311);
        $stepId = $this->createStep([
            'id' => 1311,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước giữ step RACI',
        ]);

        DB::table('project_procedure_raci')->insert([
            [
                'procedure_id' => $procedureId,
                'user_id' => $oldAccountable->id,
                'raci_role' => 'A',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $oldAccountable->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $newAccountable->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('project_procedure_step_raci')->insert([
            'step_id' => $stepId,
            'user_id' => $oldAccountable->id,
            'raci_role' => 'R',
            'created_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->addRaci(
            $this->makeRequest('POST', [
                'user_id' => $newAccountable->id,
                'raci_role' => 'A',
            ], $actor),
            $procedureId,
        );

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(1, DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('raci_role', 'A')->count());
        $this->assertSame(
            $newAccountable->id,
            DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('raci_role', 'A')->value('user_id')
        );
        $this->assertSame(1, DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('user_id', $oldAccountable->id)->where('raci_role', 'R')->count());
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $stepId)->where('user_id', $oldAccountable->id)->where('raci_role', 'R')->count());
    }

    public function test_add_procedure_raci_removes_orphaned_step_raci_for_displaced_accountable(): void
    {
        $actor = $this->createUser([
            'id' => 19,
            'department_id' => 10,
        ]);
        $oldAccountable = $this->createUser([
            'id' => 20,
            'department_id' => 10,
            'full_name' => 'Orphan Procedure A',
        ]);
        $newAccountable = $this->createUser([
            'id' => 25,
            'department_id' => 10,
            'full_name' => 'Replacement Procedure A',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 312);
        $stepId = $this->createStep([
            'id' => 1312,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước xóa step RACI mồ côi',
        ]);

        DB::table('project_procedure_raci')->insert([
            [
                'procedure_id' => $procedureId,
                'user_id' => $oldAccountable->id,
                'raci_role' => 'A',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $newAccountable->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('project_procedure_step_raci')->insert([
            'step_id' => $stepId,
            'user_id' => $oldAccountable->id,
            'raci_role' => 'A',
            'created_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->controller()->addRaci(
            $this->makeRequest('POST', [
                'user_id' => $newAccountable->id,
                'raci_role' => 'A',
            ], $actor),
            $procedureId,
        );

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame(1, DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('raci_role', 'A')->count());
        $this->assertSame(
            $newAccountable->id,
            DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('raci_role', 'A')->value('user_id')
        );
        $this->assertSame(0, DB::table('project_procedure_raci')->where('procedure_id', $procedureId)->where('user_id', $oldAccountable->id)->count());
        $this->assertSame(0, DB::table('project_procedure_step_raci')->where('step_id', $stepId)->where('user_id', $oldAccountable->id)->count());
    }

    public function test_batch_set_step_raci_merge_replaces_accountable_and_keeps_other_roles(): void
    {
        $actor = $this->createUser([
            'id' => 21,
            'department_id' => 10,
        ]);
        $userA = $this->createUser([
            'id' => 22,
            'department_id' => 10,
            'full_name' => 'User A',
        ]);
        $userB = $this->createUser([
            'id' => 23,
            'department_id' => 10,
            'full_name' => 'User B',
        ]);
        $userC = $this->createUser([
            'id' => 24,
            'department_id' => 10,
            'full_name' => 'User C',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 320);
        $targetStepId = $this->createStep([
            'id' => 1320,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước đích',
        ]);

        DB::table('project_procedure_raci')->insert([
            [
                'procedure_id' => $procedureId,
                'user_id' => $userA->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $userB->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $userC->id,
                'raci_role' => 'I',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('project_procedure_step_raci')->insert([
            [
                'step_id' => $targetStepId,
                'user_id' => $userB->id,
                'raci_role' => 'A',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $targetStepId,
                'user_id' => $userC->id,
                'raci_role' => 'I',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->controller()->batchSetStepRaci(
            $this->makeRequest('POST', [
                'mode' => 'merge',
                'assignments' => [
                    [
                        'step_id' => $targetStepId,
                        'user_id' => $userA->id,
                        'raci_role' => 'A',
                    ],
                    [
                        'step_id' => $targetStepId,
                        'user_id' => $userB->id,
                        'raci_role' => 'R',
                    ],
                ],
            ], $actor),
            $procedureId,
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $targetStepId)->where('raci_role', 'A')->count());
        $this->assertSame(
            $userA->id,
            DB::table('project_procedure_step_raci')->where('step_id', $targetStepId)->where('raci_role', 'A')->value('user_id')
        );
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $targetStepId)->where('user_id', $userB->id)->where('raci_role', 'R')->count());
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $targetStepId)->where('user_id', $userC->id)->where('raci_role', 'I')->count());
    }

    public function test_batch_set_step_raci_overwrite_replaces_existing_roles_on_target_step(): void
    {
        $actor = $this->createUser([
            'id' => 31,
            'department_id' => 10,
        ]);
        $userA = $this->createUser([
            'id' => 32,
            'department_id' => 10,
            'full_name' => 'Overwrite A',
        ]);
        $userB = $this->createUser([
            'id' => 33,
            'department_id' => 10,
            'full_name' => 'Overwrite B',
        ]);
        $userC = $this->createUser([
            'id' => 34,
            'department_id' => 10,
            'full_name' => 'Overwrite C',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 330);
        $targetStepId = $this->createStep([
            'id' => 1330,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước overwrite',
        ]);

        DB::table('project_procedure_raci')->insert([
            [
                'procedure_id' => $procedureId,
                'user_id' => $userA->id,
                'raci_role' => 'A',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $userB->id,
                'raci_role' => 'R',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'procedure_id' => $procedureId,
                'user_id' => $userC->id,
                'raci_role' => 'I',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('project_procedure_step_raci')->insert([
            [
                'step_id' => $targetStepId,
                'user_id' => $userB->id,
                'raci_role' => 'A',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $targetStepId,
                'user_id' => $userC->id,
                'raci_role' => 'I',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->controller()->batchSetStepRaci(
            $this->makeRequest('POST', [
                'mode' => 'overwrite',
                'assignments' => [
                    [
                        'step_id' => $targetStepId,
                        'user_id' => $userA->id,
                        'raci_role' => 'A',
                    ],
                    [
                        'step_id' => $targetStepId,
                        'user_id' => $userB->id,
                        'raci_role' => 'R',
                    ],
                ],
            ], $actor),
            $procedureId,
        );

        $this->assertSame(200, $response->getStatusCode());
        $rows = DB::table('project_procedure_step_raci')
            ->where('step_id', $targetStepId)
            ->orderBy('raci_role')
            ->get(['user_id', 'raci_role']);

        $this->assertCount(2, $rows);
        $this->assertSame($userA->id, (int) $rows[0]->user_id);
        $this->assertSame('A', $rows[0]->raci_role);
        $this->assertSame($userB->id, (int) $rows[1]->user_id);
        $this->assertSame('R', $rows[1]->raci_role);
        $this->assertSame(0, DB::table('project_procedure_step_raci')->where('step_id', $targetStepId)->where('user_id', $userC->id)->count());
    }

    public function test_remove_procedure_raci_cascades_related_step_raci_entries(): void
    {
        $actor = $this->createUser([
            'id' => 41,
            'department_id' => 10,
        ]);
        $targetUser = $this->createUser([
            'id' => 42,
            'department_id' => 10,
            'full_name' => 'Cascade Target',
        ]);
        $otherUser = $this->createUser([
            'id' => 43,
            'department_id' => 10,
            'full_name' => 'Cascade Other',
        ]);

        $procedureId = $this->createProcedure(projectId: 100, id: 340);
        $otherProcedureId = $this->createProcedure(projectId: 100, id: 341, name: 'Thu tuc khac');
        $stepOneId = $this->createStep([
            'id' => 1340,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước 1',
        ]);
        $stepTwoId = $this->createStep([
            'id' => 1341,
            'procedure_id' => $procedureId,
            'step_name' => 'Bước 2',
            'sort_order' => 2,
            'step_number' => 2,
        ]);
        $otherProcedureStepId = $this->createStep([
            'id' => 1342,
            'procedure_id' => $otherProcedureId,
            'step_name' => 'Bước khác thủ tục',
        ]);

        $raciId = DB::table('project_procedure_raci')->insertGetId([
            'procedure_id' => $procedureId,
            'user_id' => $targetUser->id,
            'raci_role' => 'A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedure_raci')->insert([
            'procedure_id' => $procedureId,
            'user_id' => $otherUser->id,
            'raci_role' => 'R',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_procedure_step_raci')->insert([
            [
                'step_id' => $stepOneId,
                'user_id' => $targetUser->id,
                'raci_role' => 'A',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $stepTwoId,
                'user_id' => $targetUser->id,
                'raci_role' => 'R',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $stepOneId,
                'user_id' => $otherUser->id,
                'raci_role' => 'C',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'step_id' => $otherProcedureStepId,
                'user_id' => $targetUser->id,
                'raci_role' => 'I',
                'created_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $response = $this->controller()->removeRaci(
            $raciId,
            $this->makeRequest('DELETE', [], $actor),
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(0, DB::table('project_procedure_raci')->where('id', $raciId)->count());
        $this->assertSame(0, DB::table('project_procedure_step_raci')->where('step_id', $stepOneId)->where('user_id', $targetUser->id)->count());
        $this->assertSame(0, DB::table('project_procedure_step_raci')->where('step_id', $stepTwoId)->where('user_id', $targetUser->id)->count());
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $stepOneId)->where('user_id', $otherUser->id)->count());
        $this->assertSame(1, DB::table('project_procedure_step_raci')->where('step_id', $otherProcedureStepId)->where('user_id', $targetUser->id)->count());
    }

    private function controller(): ProjectProcedureController
    {
        return $this->app->make(ProjectProcedureController::class);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function makeRequest(string $method, array $payload, InternalUser $user): Request
    {
        $request = Request::create('/', $method, $payload);
        $request->setUserResolver(fn (): InternalUser => $user);

        return $request;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function makePublicRequest(string $method, array $payload): Request
    {
        return Request::create('/', $method, $payload);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createUser(array $overrides = []): InternalUser
    {
        $defaults = [
            'user_code' => 'U'.str_pad((string) ($overrides['id'] ?? 1), 3, '0', STR_PAD_LEFT),
            'username' => 'user'.($overrides['id'] ?? 1),
            'full_name' => 'Checklist User',
            'password' => bcrypt('password'),
            'department_id' => 10,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        /** @var InternalUser $user */
        $user = InternalUser::query()->create(array_merge($defaults, $overrides));

        return $user;
    }

    private function assignAdminRole(int $userId): void
    {
        DB::table('roles')->insert([
            'id' => 1,
            'role_code' => 'ADMIN',
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role_id' => 1,
            'is_active' => 1,
            'expires_at' => null,
        ]);
    }

    private function enableProjectWorklogDatetimePolicy(): void
    {
        DB::table('integration_settings')->updateOrInsert(
            ['provider' => 'PROJECT_WORKLOG_DATETIME_POLICY'],
            [
                'provider' => 'PROJECT_WORKLOG_DATETIME_POLICY',
                'is_enabled' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function createProcedure(int $projectId, int $id = 200, string $name = 'Thu tuc'): int
    {
        DB::table('project_procedures')->insert([
            'id' => $id,
            'project_id' => $projectId,
            'template_id' => 1,
            'procedure_name' => $name,
            'overall_progress' => 0,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        return $id;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createStep(array $overrides = []): int
    {
        $defaults = [
            'id' => 1000,
            'procedure_id' => 200,
            'template_step_id' => 500,
            'step_number' => 1,
            'parent_step_id' => null,
            'phase' => 'CHUAN_BI',
            'phase_label' => null,
            'step_name' => 'Bước',
            'step_detail' => null,
            'lead_unit' => null,
            'support_unit' => null,
            'expected_result' => null,
            'duration_days' => 0,
            'progress_status' => 'CHUA_THUC_HIEN',
            'document_number' => null,
            'document_date' => null,
            'actual_start_date' => null,
            'actual_end_date' => null,
            'step_notes' => null,
            'sort_order' => 1,
            'created_by' => null,
            'updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $record = array_merge($defaults, $overrides);

        DB::table('project_procedure_steps')->insert($record);

        return (int) $record['id'];
    }

    private function setUpSchema(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('shared_issues');
        Schema::dropIfExists('shared_timesheets');
        Schema::dropIfExists('project_procedure_step_worklogs');
        Schema::dropIfExists('project_procedure_step_raci');
        Schema::dropIfExists('project_procedure_raci');
        Schema::dropIfExists('raci_assignments');
        Schema::dropIfExists('project_procedure_public_shares');
        Schema::dropIfExists('project_procedure_steps');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('user_dept_scopes');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('integration_settings');
        Schema::dropIfExists('internal_users');
        Schema::enableForeignKeyConstraints();

        Schema::create('internal_users', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('user_code', 50)->nullable();
            $table->string('username', 100)->nullable();
            $table->string('password', 255)->nullable();
            $table->string('full_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('dept_code', 50)->nullable();
            $table->string('dept_name', 255)->nullable();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('dept_path', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
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

        Schema::create('user_dept_scopes', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('dept_id');
            $table->string('scope_type', 50)->default('DEPT_ONLY');
            $table->timestamps();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('reference_type', 50);
            $table->unsignedBigInteger('reference_id');
            $table->string('file_name', 255)->nullable();
            $table->string('file_url', 2048)->nullable();
            $table->timestamps();
        });

        Schema::create('integration_settings', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('provider', 50)->unique();
            $table->boolean('is_enabled')->default(false);
            $table->string('smtp_host', 255)->nullable();
            $table->unsignedInteger('smtp_port')->nullable();
            $table->string('smtp_encryption', 20)->nullable();
            $table->string('smtp_username', 255)->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('smtp_from_address', 255)->nullable();
            $table->string('smtp_from_name', 255)->nullable();
            $table->string('smtp_recipient_emails', 1000)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('project_code', 50)->nullable();
            $table->string('project_name', 255)->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('project_procedures', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('template_id')->nullable();
            $table->string('procedure_name', 255);
            $table->decimal('overall_progress', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('project_procedure_steps', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('template_step_id')->nullable();
            $table->unsignedBigInteger('parent_step_id')->nullable();
            $table->integer('step_number')->default(1);
            $table->string('phase', 100)->nullable();
            $table->string('phase_label', 255)->nullable();
            $table->string('step_name', 500);
            $table->text('step_detail')->nullable();
            $table->string('lead_unit', 500)->nullable();
            $table->string('support_unit', 500)->nullable();
            $table->text('expected_result')->nullable();
            $table->integer('duration_days')->default(0);
            $table->string('progress_status', 50)->default('CHUA_THUC_HIEN');
            $table->string('document_number', 255)->nullable();
            $table->date('document_date')->nullable();
            $table->date('actual_start_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->text('step_notes')->nullable();
            $table->integer('sort_order')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_public_shares', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id');
            $table->string('token_hash', 64)->unique();
            $table->string('access_key_hash')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_raci', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_step_raci', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('step_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_step_worklogs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('step_id');
            $table->unsignedBigInteger('procedure_id');
            $table->string('log_type', 50);
            $table->text('content');
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('shared_timesheets', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_step_worklog_id')->nullable();
            $table->decimal('hours_spent', 8, 2);
            $table->date('work_date');
            $table->dateTime('work_started_at')->nullable();
            $table->dateTime('work_ended_at')->nullable();
            $table->text('activity_description')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('procedure_step_worklog_id')
                ->references('id')
                ->on('project_procedure_step_worklogs')
                ->cascadeOnDelete();
        });

        Schema::create('shared_issues', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_step_worklog_id')->nullable();
            $table->text('issue_content');
            $table->text('proposal_content')->nullable();
            $table->string('issue_status', 50)->default('JUST_ENCOUNTERED');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('procedure_step_worklog_id')
                ->references('id')
                ->on('project_procedure_step_worklogs')
                ->cascadeOnDelete();
        });

        DB::table('departments')->insert([
            'id' => 10,
            'dept_code' => 'PKT',
            'dept_name' => 'Phong Ky thuat',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('projects')->insert([
            'id' => 100,
            'project_code' => 'DA-100',
            'project_name' => 'Checklist Demo',
            'department_id' => 10,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
