<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WorkflowConfigCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware();
        $this->setUpSchema();
    }

    public function test_it_creates_and_lists_workflow_status_catalog_via_api(): void
    {
        $createResponse = $this->postJson('/api/v5/workflow-status-catalogs', [
            'level' => 1,
            'status_code' => 'MOI_TIEP_NHAN',
            'status_name' => 'Mới tiếp nhận',
            'canonical_status' => 'MOI_TIEP_NHAN',
            'flow_step' => 'GD1',
            'form_key' => 'support.moi_tiep_nhan',
            'is_leaf' => true,
            'sort_order' => 10,
            'is_active' => true,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.status_code', 'MOI_TIEP_NHAN')
            ->assertJsonPath('data.status_name', 'Mới tiếp nhận');

        $listResponse = $this->getJson('/api/v5/workflow-status-catalogs');

        $listResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status_name', 'Mới tiếp nhận');
    }

    public function test_it_creates_and_updates_workflow_form_field_config_via_api(): void
    {
        $this->postJson('/api/v5/workflow-status-catalogs', [
            'level' => 1,
            'status_code' => 'MOI_TIEP_NHAN',
            'status_name' => 'Mới tiếp nhận',
            'canonical_status' => 'MOI_TIEP_NHAN',
            'flow_step' => 'GD1',
            'form_key' => 'support.moi_tiep_nhan',
            'is_leaf' => true,
            'sort_order' => 10,
            'is_active' => true,
        ])->assertCreated();

        $createResponse = $this->postJson('/api/v5/workflow-form-field-configs', [
            'status_catalog_id' => 1,
            'field_key' => 'request_code',
            'field_label' => 'Mã yêu cầu',
            'field_type' => 'text',
            'required' => true,
            'sort_order' => 5,
            'excel_column' => 'A',
            'options_json' => ['readonly' => true],
            'is_active' => true,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.field_key', 'REQUEST_CODE')
            ->assertJsonPath('data.field_label', 'Mã yêu cầu');

        $updateResponse = $this->putJson('/api/v5/workflow-form-field-configs/1', [
            'field_label' => 'Nội dung',
            'field_key' => 'summary',
            'required' => false,
            'options_json' => ['rows' => 4],
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('data.field_key', 'SUMMARY')
            ->assertJsonPath('data.field_label', 'Nội dung')
            ->assertJsonPath('data.required', 0);
    }

    private function setUpSchema(): void
    {
        Schema::dropIfExists('workflow_form_field_configs');
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
            $table->boolean('allow_pending_selection')->default(false);
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

        Schema::create('workflow_form_field_configs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('status_catalog_id');
            $table->string('field_key', 120);
            $table->string('field_label', 190);
            $table->string('field_type', 50)->nullable();
            $table->boolean('required')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('excel_column', 5)->nullable();
            $table->json('options_json')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });
    }
}
