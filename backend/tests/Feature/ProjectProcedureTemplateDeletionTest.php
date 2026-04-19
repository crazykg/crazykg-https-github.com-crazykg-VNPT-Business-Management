<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectProcedureTemplateDeletionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_delete_route_allows_removing_empty_template(): void
    {
        $this->createTemplate(id: 1);

        $response = $this->deleteJson('/api/v5/project-procedure-templates/1');

        $response
            ->assertOk()
            ->assertJson(['message' => 'Deleted.']);

        $this->assertSame(0, DB::table('project_procedure_templates')->where('id', 1)->count());
    }

    public function test_delete_route_rejects_template_that_still_has_steps(): void
    {
        $this->createTemplate(id: 2);
        DB::table('project_procedure_template_steps')->insert([
            'id' => 20,
            'template_id' => 2,
            'step_number' => 1,
            'parent_step_id' => null,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Bước 1',
            'step_detail' => null,
            'lead_unit' => null,
            'support_unit' => null,
            'expected_result' => null,
            'default_duration_days' => 1,
            'sort_order' => 10,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson('/api/v5/project-procedure-templates/2');

        $response
            ->assertStatus(409)
            ->assertJson([
                'message' => 'Chỉ có thể xóa mẫu khi chưa có bước cấu hình và chưa được áp dụng cho dự án.',
            ]);

        $this->assertSame(1, DB::table('project_procedure_templates')->where('id', 2)->count());
    }

    public function test_delete_route_rejects_template_that_is_already_applied_to_a_project(): void
    {
        $this->createTemplate(id: 3);
        DB::table('project_procedures')->insert([
            'id' => 30,
            'project_id' => 900,
            'template_id' => 3,
            'procedure_name' => 'Checklist dự án',
            'overall_progress' => 0,
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $response = $this->deleteJson('/api/v5/project-procedure-templates/3');

        $response
            ->assertStatus(409)
            ->assertJson([
                'message' => 'Chỉ có thể xóa mẫu khi chưa có bước cấu hình và chưa được áp dụng cho dự án.',
            ]);

        $this->assertSame(1, DB::table('project_procedure_templates')->where('id', 3)->count());
    }

    public function test_bulk_delete_steps_route_removes_selected_steps_in_one_request(): void
    {
        $this->createTemplate(id: 10);
        $this->createStep(id: 100, templateId: 10, stepNumber: 1);
        $this->createStep(id: 101, templateId: 10, stepNumber: 2, parentStepId: 100);
        $this->createStep(id: 102, templateId: 10, stepNumber: 3);

        $response = $this->deleteJson('/api/v5/project-procedure-templates/10/steps', [
            'step_ids' => [100, 101, 102],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.deleted_count', 3);

        $this->assertSame(0, DB::table('project_procedure_template_steps')->where('template_id', 10)->count());
    }

    public function test_bulk_delete_steps_route_rejects_ids_that_do_not_belong_to_template(): void
    {
        $this->createTemplate(id: 11);
        $this->createTemplate(id: 12);
        $this->createStep(id: 120, templateId: 12, stepNumber: 1);

        $response = $this->deleteJson('/api/v5/project-procedure-templates/11/steps', [
            'step_ids' => [120],
        ]);

        $response
            ->assertStatus(404)
            ->assertJson([
                'message' => 'One or more template steps not found.',
            ]);

        $this->assertSame(1, DB::table('project_procedure_template_steps')->where('id', 120)->count());
    }

    public function test_import_steps_route_replaces_template_steps_and_keeps_parent_child_mapping(): void
    {
        $this->createTemplate(id: 21);
        $this->createStep(id: 210, templateId: 21, stepNumber: 1);

        $response = $this->postJson('/api/v5/project-procedure-templates/21/steps/import', [
            'steps' => [
                [
                    'step_key' => '1',
                    'parent_key' => null,
                    'step_number' => 1,
                    'phase' => 'Khảo sát',
                    'step_name' => 'Khảo sát',
                    'step_detail' => 'Bước cha',
                    'lead_unit' => 'Đơn vị A',
                    'support_unit' => null,
                    'expected_result' => 'Biên bản khảo sát',
                    'default_duration_days' => 3,
                    'sort_order' => 10,
                ],
                [
                    'step_key' => '1.1',
                    'parent_key' => '1',
                    'step_number' => 1,
                    'phase' => 'Khảo sát',
                    'step_name' => 'Tiếp cận khách hàng',
                    'step_detail' => 'Bước con',
                    'lead_unit' => 'Đơn vị B',
                    'support_unit' => 'Đơn vị C',
                    'expected_result' => 'Biên bản làm việc',
                    'default_duration_days' => 2,
                    'sort_order' => 20,
                ],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.imported_count', 2)
            ->assertJsonPath('data.root_count', 1);

        $this->assertSame(2, DB::table('project_procedure_template_steps')->where('template_id', 21)->count());
        $this->assertSame(0, DB::table('project_procedure_template_steps')->where('id', 210)->count());

        $parentId = DB::table('project_procedure_template_steps')
            ->where('template_id', 21)
            ->whereNull('parent_step_id')
            ->value('id');

        $this->assertNotNull($parentId);
        $this->assertSame(
            (int) $parentId,
            (int) DB::table('project_procedure_template_steps')
                ->where('template_id', 21)
                ->where('step_name', 'Tiếp cận khách hàng')
                ->value('parent_step_id')
        );
    }

    public function test_import_steps_route_rejects_template_that_is_already_applied_to_project(): void
    {
        $this->createTemplate(id: 22);
        DB::table('project_procedures')->insert([
            'id' => 220,
            'project_id' => 999,
            'template_id' => 22,
            'procedure_name' => 'Thủ tục dự án',
            'overall_progress' => 0,
            'notes' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        $response = $this->postJson('/api/v5/project-procedure-templates/22/steps/import', [
            'steps' => [
                [
                    'step_key' => '1',
                    'parent_key' => null,
                    'step_number' => 1,
                    'phase' => 'Khảo sát',
                    'step_name' => 'Khảo sát',
                    'sort_order' => 10,
                ],
            ],
        ]);

        $response
            ->assertStatus(409)
            ->assertJson([
                'message' => 'Không thể import vì mẫu đã được áp dụng cho dự án. Hãy tạo mẫu mới hoặc đồng bộ lại các thủ tục liên quan trước.',
            ]);
    }

    private function createTemplate(int $id): void
    {
        DB::table('project_procedure_templates')->insert([
            'id' => $id,
            'template_code' => 'TPL_' . $id,
            'template_name' => 'Template ' . $id,
            'description' => null,
            'is_active' => true,
            'created_by' => null,
            'updated_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createStep(int $id, int $templateId, int $stepNumber, ?int $parentStepId = null): void
    {
        DB::table('project_procedure_template_steps')->insert([
            'id' => $id,
            'template_id' => $templateId,
            'step_number' => $stepNumber,
            'parent_step_id' => $parentStepId,
            'phase' => 'CHUAN_BI',
            'step_name' => 'Bước ' . $stepNumber,
            'step_detail' => null,
            'lead_unit' => null,
            'support_unit' => null,
            'expected_result' => null,
            'default_duration_days' => 1,
            'sort_order' => $stepNumber * 10,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function setUpSchema(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('project_procedure_template_steps');
        Schema::dropIfExists('project_procedures');
        Schema::dropIfExists('project_procedure_templates');
        Schema::enableForeignKeyConstraints();

        Schema::create('project_procedure_templates', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('template_code', 50)->unique();
            $table->string('template_name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_procedure_template_steps', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('template_id');
            $table->integer('step_number');
            $table->unsignedBigInteger('parent_step_id')->nullable();
            $table->string('phase', 100)->nullable();
            $table->string('step_name', 500);
            $table->text('step_detail')->nullable();
            $table->string('lead_unit', 500)->nullable();
            $table->string('support_unit', 500)->nullable();
            $table->text('expected_result')->nullable();
            $table->integer('default_duration_days')->nullable()->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('project_procedures', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('template_id');
            $table->string('procedure_name', 255);
            $table->decimal('overall_progress', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }
}
