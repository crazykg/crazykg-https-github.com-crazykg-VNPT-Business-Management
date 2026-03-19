<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V5\ProjectProcedureController;
use App\Models\InternalUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

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
     * @param  array<string, mixed>  $overrides
     */
    private function createUser(array $overrides = []): InternalUser
    {
        $defaults = [
            'user_code' => 'U' . str_pad((string) ($overrides['id'] ?? 1), 3, '0', STR_PAD_LEFT),
            'username' => 'user' . ($overrides['id'] ?? 1),
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
        Schema::dropIfExists('project_procedure_step_worklogs');
        Schema::dropIfExists('project_procedure_step_raci');
        Schema::dropIfExists('project_procedure_raci');
        Schema::dropIfExists('project_procedure_steps');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('attachments');
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

        Schema::create('attachments', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('reference_type', 50);
            $table->unsignedBigInteger('reference_id');
            $table->string('file_name', 255)->nullable();
            $table->string('file_url', 2048)->nullable();
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

        Schema::create('project_procedure_raci', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('procedure_id');
            $table->unsignedBigInteger('user_id');
            $table->string('raci_role', 5);
            $table->text('note')->nullable();
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
