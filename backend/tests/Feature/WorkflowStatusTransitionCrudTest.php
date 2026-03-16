<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WorkflowStatusTransitionCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpWorkflowTransitionCrudSchema();
    }

    public function test_it_creates_and_lists_workflow_status_transition_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/workflow-status-transitions', [
            'from_status_catalog_id' => 1,
            'to_status_catalog_id' => 2,
            'action_code' => 'SUBMIT_APPROVAL',
            'action_name' => 'Gửi duyệt',
            'required_role' => 'CREATOR',
            'notify_targets_json' => ['PM', 'EXECUTOR'],
            'sort_order' => 10,
            'is_active' => true,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.from_status_name', 'Mới tiếp nhận')
            ->assertJsonPath('data.to_status_name', 'Chờ duyệt')
            ->assertJsonPath('data.action_code', 'SUBMIT_APPROVAL')
            ->assertJsonPath('data.required_role', 'CREATOR')
            ->assertJsonPath('data.notify_targets_json.0', 'PM');

        $listResponse = $this->getJson('/api/v5/workflow-status-transitions?from_status_catalog_id=1');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action_name', 'Gửi duyệt')
            ->assertJsonPath('data.0.to_status_name', 'Chờ duyệt');
    }

    public function test_it_updates_workflow_status_transition_via_api(): void
    {
        DB::table('workflow_status_transitions')->insert([
            'id' => 11,
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
        ]);

        $updateResponse = $this->putJson('/api/v5/workflow-status-transitions/11', [
            'action_name' => 'Trình duyệt',
            'required_role' => 'PM',
            'notify_targets_json' => ['ADMIN', 'EXECUTOR'],
            'sort_order' => 20,
            'is_active' => false,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.action_name', 'Trình duyệt')
            ->assertJsonPath('data.required_role', 'PM')
            ->assertJsonPath('data.notify_targets_json.0', 'ADMIN')
            ->assertJsonPath('data.sort_order', 20)
            ->assertJsonPath('data.is_active', 0);
    }

    private function setUpWorkflowTransitionCrudSchema(): void
    {
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
                'sort_order' => 10,
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
                'sort_order' => 20,
                'is_active' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
