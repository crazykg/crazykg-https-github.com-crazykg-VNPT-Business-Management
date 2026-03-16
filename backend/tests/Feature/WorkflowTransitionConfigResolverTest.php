<?php

namespace Tests\Feature;

use App\Services\V5\Workflow\CustomerRequestWorkflowService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WorkflowTransitionConfigResolverTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpWorkflowConfigSchema();
    }

    public function test_it_lists_workflow_status_transitions_with_joined_names_and_decoded_json(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $rows = $service->listWorkflowStatusTransitions($this->statusId('CHO_DUYET'));

        $this->assertCount(2, $rows);
        $this->assertSame('Chờ duyệt', $rows[0]['from_status_name']);
        $this->assertSame('Đã duyệt', $rows[0]['to_status_name']);
        $this->assertSame('APPROVE', $rows[0]['action_code']);
        $this->assertSame(['CREATOR', 'EXECUTOR'], $rows[0]['notify_targets_json']);
    }

    public function test_it_filters_available_actions_by_viewer_role(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $pendingActionsForPm = $service->resolveConfiguredAvailableActions($this->statusId('CHO_DUYET'), 'PM');
        $pendingActionsForCreator = $service->resolveConfiguredAvailableActions($this->statusId('CHO_DUYET'), 'CREATOR');
        $newActionsForCreator = $service->resolveConfiguredAvailableActions($this->statusId('MOI_TIEP_NHAN'), 'CREATOR');

        $this->assertSame(['APPROVE', 'REJECT'], array_column($pendingActionsForPm, 'action_code'));
        $this->assertSame([], $pendingActionsForCreator);
        $this->assertSame(['SUBMIT_APPROVAL'], array_column($newActionsForCreator, 'action_code'));
    }

    public function test_it_lists_view_rules_for_status(): void
    {
        $service = app(CustomerRequestWorkflowService::class);

        $rules = $service->listWorkflowStatusViewRules($this->statusId('CHO_DUYET'));

        $this->assertCount(5, $rules);
        $this->assertSame('Chờ duyệt', $rules[0]['status_name']);
        $this->assertSame('CUSTOMER', $rules[0]['viewer_role']);
        $this->assertSame(1, (int) $rules[0]['can_view']);
        $this->assertSame('EXECUTOR', $rules[3]['viewer_role']);
        $this->assertSame(0, (int) $rules[3]['can_view']);
    }

    private function statusId(string $statusCode): int
    {
        $id = DB::table('workflow_status_catalogs')
            ->where('status_code', $statusCode)
            ->value('id');

        $this->assertNotNull($id, "Unable to resolve status id for {$statusCode}.");

        return (int) $id;
    }

    private function setUpWorkflowConfigSchema(): void
    {
        Schema::dropIfExists('workflow_status_view_rules');
        Schema::dropIfExists('workflow_status_transitions');
        Schema::dropIfExists('workflow_status_catalogs');

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

        DB::table('workflow_status_catalogs')->insert([
            [
                'id' => 1,
                'level' => 1,
                'status_code' => 'MOI_TIEP_NHAN',
                'status_name' => 'Mới tiếp nhận',
                'canonical_status' => 'MOI_TIEP_NHAN',
                'flow_step' => 'GD1',
                'form_key' => 'support.moi_tiep_nhan',
                'is_leaf' => 1,
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'level' => 1,
                'status_code' => 'CHO_DUYET',
                'status_name' => 'Chờ duyệt',
                'canonical_status' => 'CHO_DUYET',
                'flow_step' => 'GD1A',
                'form_key' => 'support.cho_duyet',
                'is_leaf' => 1,
                'sort_order' => 25,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'level' => 1,
                'status_code' => 'DA_DUYET',
                'status_name' => 'Đã duyệt',
                'canonical_status' => 'DA_DUYET',
                'flow_step' => 'GD1B',
                'form_key' => 'support.da_duyet',
                'is_leaf' => 1,
                'sort_order' => 35,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'level' => 1,
                'status_code' => 'TU_CHOI',
                'status_name' => 'Từ chối',
                'canonical_status' => 'TU_CHOI',
                'flow_step' => 'GD4A',
                'form_key' => 'support.tu_choi',
                'is_leaf' => 1,
                'sort_order' => 55,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('workflow_status_transitions')->insert([
            [
                'from_status_catalog_id' => 1,
                'to_status_catalog_id' => 2,
                'action_code' => 'SUBMIT_APPROVAL',
                'action_name' => 'Gửi duyệt',
                'required_role' => 'CREATOR',
                'notify_targets_json' => json_encode(['PM'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 3,
                'action_code' => 'APPROVE',
                'action_name' => 'Duyệt',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['CREATOR', 'EXECUTOR'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 10,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'from_status_catalog_id' => 2,
                'to_status_catalog_id' => 4,
                'action_code' => 'REJECT',
                'action_name' => 'Từ chối',
                'required_role' => 'PM',
                'notify_targets_json' => json_encode(['CREATOR'], JSON_UNESCAPED_UNICODE),
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('workflow_status_view_rules')->insert([
            ['status_catalog_id' => 2, 'viewer_role' => 'CUSTOMER', 'can_view' => 1, 'sort_order' => 10, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['status_catalog_id' => 2, 'viewer_role' => 'CREATOR', 'can_view' => 1, 'sort_order' => 20, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['status_catalog_id' => 2, 'viewer_role' => 'PM', 'can_view' => 1, 'sort_order' => 30, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['status_catalog_id' => 2, 'viewer_role' => 'EXECUTOR', 'can_view' => 0, 'sort_order' => 40, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['status_catalog_id' => 2, 'viewer_role' => 'ADMIN', 'can_view' => 1, 'sort_order' => 50, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
