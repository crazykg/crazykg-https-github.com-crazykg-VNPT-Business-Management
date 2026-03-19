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

    public function test_template_step_cannot_be_deleted_even_by_admin(): void
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

        $response = $this->controller()->deleteStep(
            $templateStepId,
            $this->makeRequest('DELETE', [], $admin),
        );

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame('Không thể xóa bước thuộc mẫu thủ tục.', $response->getData(true)['message'] ?? null);
        $this->assertSame(1, DB::table('project_procedure_steps')->where('id', $templateStepId)->count());
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
        Schema::dropIfExists('project_procedure_raci');
        Schema::dropIfExists('project_procedure_steps');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
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
